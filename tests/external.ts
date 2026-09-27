import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import type { Catalog } from "../_extensions/reference-catalog/domain/model.ts";
import { exportedTargets } from "../_extensions/reference-catalog/domain/exports.ts";
import { parseExports } from "../_extensions/reference-catalog/infrastructure/export-config.ts";
import { attr, elements, hasClass, parseHtml, type Element, type Node } from "../_extensions/reference-catalog/infrastructure/html.ts";
import { importTargets } from "../_extensions/reference-catalog/infrastructure/imports.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "qrc-external-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const os = join(root, "os");
const java = join(root, "java");
let server: Deno.HttpServer | undefined;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function write(workspace: string, path: string, value: string) {
  const destination = join(workspace, path);
  await Deno.mkdir(dirname(destination), { recursive: true });
  await Deno.writeTextFile(destination, value);
}
async function render(workspace: string, expectedError?: string) {
  const result = await new Deno.Command(quarto, {
    args: ["render", "--fail-if-warnings"], cwd: workspace,
    env: { QUARTO: quarto }, stdout: "piped", stderr: "piped",
  }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expectedError ? !result.success && output.includes(expectedError) : result.success,
    `${workspace}: ${expectedError ? `expected failure containing ${expectedError}\n` : ""}${output}`);
}
async function rejects(action: () => unknown | Promise<unknown>, message: string) {
  try { await action(); }
  catch (error) {
    assert(error instanceof Error && error.message.includes(message), `Expected ${message}, got ${error}`);
    return;
  }
  throw new Error(`Expected an error containing ${message}`);
}
async function initialize(workspace: string) {
  await Deno.mkdir(workspace, { recursive: true });
  await copy(join(repo, "_extensions"), join(workspace, "_extensions"));
  await write(workspace, "book/_quarto.yml", `project:
  type: website
  output-dir: _site
  render: [index.qmd]
format:
  html:
    number-sections: true
lang: ru
`);
}
function config(extra: string) {
  return `project:
  type: website
  output-dir: _site
  render: []
filters: [reference-catalog]
reference-catalog:
  home: book
  projects:
    book: {path: book, format: html}
${extra}`;
}
async function catalog(workspace: string): Promise<Catalog> {
  return JSON.parse(await Deno.readTextFile(join(workspace, "_site/reference-catalog.json")));
}
async function page(workspace: string, name = "index.html"): Promise<Element[]> {
  return elements(parseHtml(await Deno.readTextFile(join(workspace, "_site", name))));
}
function link(nodes: Element[], key: string, style: string = "default"): Element {
  const node = nodes.find(item => item.tagName === "a" && attr(item, "data-qrc-ref") === key && attr(item, "data-qrc-style") === style);
  assert(node, `Missing ${style} link ${key}`);
  return node;
}
function content(node: Node): string {
  if ("tagName" in node && attr(node, "aria-hidden") === "true") return "";
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(content).join("") : "";
}

try {
  await initialize(os);
  await initialize(java);
  await write(os, "book/_quarto.yml", `project:
  type: book
  output-dir: _book
book:
  title: Материалы ОС
  chapters: [index.qmd, memory.qmd]
format: html
lang: ru
`);
  await write(os, "_quarto.yml", config(`  publication: {title: "Операционные системы"}
  exports:
    book: [sec-memory, sec-addressing]
`));
  await write(os, "book/index.qmd", "# Введение {.unnumbered}\n\nМатериалы курса операционных систем.\n");
  await write(os, "book/memory.qmd", `# Управление памятью {#sec-memory}

См. @book:sec-implementation.

## Обзор адресации {#sec-addressing}

Обычный раздел с собственным названием.

## Детали реализации {#sec-implementation}

Этот раздел доступен внутри курса, но не входит в его внешний каталог.
`);
  await render(os);
  const published = await catalog(os);
  assert(published.schema === "quarto-reference-catalog/3", "New publications must use catalog schema 3");
  assert(published.publication?.title === "Операционные системы", "Publication title missing from exported catalog");
  assert(Object.keys(published.targets).sort().join() === "book:sec-addressing,book:sec-memory", "Explicit exports must contain only the selected own targets");
  const memory = published.targets["book:sec-memory"];
  assert(memory.title === "Управление памятью", `Heading title includes numbering or is missing: ${memory.title}`);
  assert(published.targets["book:sec-addressing"].title === "Обзор адресации", "Ordinary section title is missing or includes numbering");
  assert(memory.number.length > 0, "Fixture must contain a numbered heading");
  const privateLink = link(await page(os, "memory.html"), "book:sec-implementation");
  assert(attr(privateLink, "href")?.endsWith("#sec-implementation"), "Non-exported own targets must remain available for internal links");

  let requests = 0;
  function expectRequests(expected: number) {
    assert(requests === expected, `Expected ${expected} total HTTP source reads, got ${requests}`);
  }
  let remoteCatalog = JSON.stringify(published);
  const httpServer = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, request => {
    if (new URL(request.url).pathname !== "/catalog/reference.json") return new Response("Not found", { status: 404 });
    requests++;
    return new Response(remoteCatalog, { headers: { "content-type": "application/json" } });
  });
  server = httpServer;
  const source = `http://127.0.0.1:${httpServer.addr.port}/catalog/reference.json`;
  const javaConfig = config(`  imports:
    os:
      source: ${source}
      namespace: book
      base-url: https://example.test/OS/
      style: external
    os-second:
      source: ${source}
      namespace: book
      base-url: https://example.test/OS/
      style: external
    os-local:
      source: ../os/_site/reference-catalog.json
      namespace: book
      base-url: https://example.test/OS/
      style: external
    os-legacy:
      file: ../os/_site/reference-catalog.json
      namespace: book
      base-url: https://example.test/OS/
`);
  await write(java, "_quarto.yml", javaConfig);
  await write(java, "book/index.qmd", `# Java {#sec-memory}

Собственная цель с тем же ID: @book:sec-memory.

Основная ссылка: @os:sec-memory.

Только название: {{< xref os sec-memory style="title" >}}.

Название раздела: {{< xref os sec-addressing style="title" >}}.

Только номер: {{< xref os sec-memory style="number" >}}.

Ещё один псевдоним того же источника: @os-second:sec-memory.

Каталог соседнего репозитория: @os-local:sec-memory.

Совместимость с file: @os-legacy:sec-memory.

Авторский текст: {{< xref os sec-memory "Читать о памяти" style="external" >}}.
`);
  await render(java);
  expectRequests(1);
  let nodes = await page(java);
  const defaultLink = link(nodes, "os:sec-memory");
  const ownLink = link(nodes, "book:sec-memory");
  assert(attr(ownLink, "href") === "index.html#sec-memory" && !hasClass(ownLink, "qrc-external"), "An imported target must not replace an own target with the same ID");
  assert(content(defaultLink) === "Управление памятью — Операционные системы", `Wrong external label: ${content(defaultLink)}`);
  assert(hasClass(defaultLink, "qrc-external"), "External reference is missing its presentation class");
  assert(nodes.filter(node => node.tagName === "style" && attr(node, "data-qrc-external-style") !== undefined).length === 1, "External link CSS must be included once per page");
  assert(attr(defaultLink, "href") === "https://example.test/OS/memory.html#sec-memory", "Catalog location must not replace the configured publication base URL");
  assert(content(link(nodes, "os:sec-memory", "title")) === "Управление памятью", "Explicit title style must override the import default");
  assert(content(link(nodes, "os:sec-addressing", "title")) === "Обзор адресации", "Title style must resolve ordinary book sections");
  assert(content(link(nodes, "os:sec-memory", "number")) === memory.number, "Explicit number style must override the import default");
  assert(content(link(nodes, "os:sec-memory", "external")) === "Читать о памяти — Операционные системы", "External styling must preserve author-supplied title text");
  assert(content(link(nodes, "os-local:sec-memory")) === content(defaultLink), "A sibling file source must resolve like an HTTP source");
  assert(content(link(nodes, "os-legacy:sec-memory")) === memory.label, "Legacy file imports must retain their default Quarto label");
  const javaCatalog = await catalog(java);
  assert(Object.keys(javaCatalog.targets).join() === "book:sec-memory", "Default exports must include own targets and exclude every imported namespace");

  // Each build chooses a fresh snapshot; repeated references and aliases within it share that snapshot.
  remoteCatalog = JSON.stringify({ ...published, publication: { title: "ОС: новая редакция" } });
  await render(java);
  expectRequests(2);
  nodes = await page(java);
  assert(content(link(nodes, "os:sec-memory")) === "Управление памятью — ОС: новая редакция", "A new build reused an old external catalog");
  assert(content(link(nodes, "os-second:sec-memory")) === content(link(nodes, "os:sec-memory")), "Aliases disagree on their build snapshot");

  const own = Object.values(published.targets);
  assert(Object.keys(exportedTargets(own, {})).length === 0, "Empty exports must publish no targets");
  assert(Object.keys(exportedTargets(own, { book: "*" })).sort().join() === "book:sec-addressing,book:sec-memory", "Wildcard must select own namespace targets");
  await rejects(() => exportedTargets(own, { book: ["sec-missing"] }), "sec-missing");
  await rejects(() => parseExports({ os: "*" }, ["book"]), "os");
  await rejects(() => importTargets([{
    namespace: "missing", source: join(os, "_site/reference-catalog.json"),
    sourceNamespace: "not-exported", baseUrl: "https://example.test/OS/",
  }]), "not-exported");

  console.log("PASS external catalogs: selective own exports, HTTP and sibling files, legacy file imports, external/title/number styles, one fetch per build, fresh build snapshot, no reexports, invalid export/import rejection");
} finally {
  if (server) await server.shutdown();
  await Deno.remove(root, { recursive: true });
}
