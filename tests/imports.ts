import { dirname, join, toFileUrl } from "stdlib/path";
import { parseImports } from "../_extensions/reference-catalog/infrastructure/import-config.ts";
import { importTargets } from "../_extensions/reference-catalog/infrastructure/imports.ts";
import type { Catalog } from "../_extensions/reference-catalog/domain/model.ts";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
async function rejects(action: () => unknown | Promise<unknown>, message: string) {
  try { await action(); }
  catch (error) {
    assert(error instanceof Error && error.message.includes(message), `Expected error containing ${message}; got ${error}`);
    return;
  }
  throw new Error(`Expected rejection: ${message}`);
}
const fixture: Catalog = {
  schema: "quarto-reference-catalog",
  generator: { quarto: "test" },
  publication: { title: "Operating systems" },
  targets: {
    "book:sec-memory": { namespace: "book", id: "sec-memory", page: "chapters/memory.html", fragment: "sec-memory", labelHtml: "Section 1", numberHtml: "1", label: "Section 1", number: "1", title: "Virtual memory" },
    "lectures:sec-memory": { namespace: "lectures", id: "sec-memory", page: "lectures/memory.html", fragment: "sec-memory", slide: "memory", labelHtml: "Section 2", numberHtml: "2", label: "Section 2", number: "2", title: "Memory lecture" },
  },
};
const root = await Deno.makeTempDir({ prefix: "qrc-imports-" });
const consumer = join(root, "java");
const sibling = join(root, "os", "reference.json");
await Deno.mkdir(consumer);
await Deno.mkdir(dirname(sibling));
await Deno.writeTextFile(sibling, JSON.stringify(fixture));
let reads = 0;
const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, (request) => {
  const path = new URL(request.url).pathname;
  if (path === "/redirect") return new Response(null, { status: 302, headers: { location: "/reference.json" } });
  if (path === "/missing") return new Response("missing", { status: 404 });
  if (path === "/invalid-json") return new Response("{broken");
  if (path === "/invalid-schema") return Response.json({ ...fixture, schema: "quarto-reference-catalog/99" });
  reads++;
  return Response.json(fixture);
});
const url = `http://127.0.0.1:${server.addr.port}`;
const config = (source: string, extra: Record<string, unknown> = {}) => ({ os: { source, namespace: "book", "base-url": "https://example.edu/courses/os/", ...extra } });
const parse = (source: string, extra: Record<string, unknown> = {}) => parseImports(config(source, extra), consumer, ["book"]);
try {
  const [local] = parse("../os/reference.json");
  equal(local.source, sibling, "Sibling repositories are independent sources");
  await rejects(() => parseImports({ os: { file: "../os/reference.json", namespace: "book", "base-url": local.baseUrl } }, consumer, ["book"]), "неизвестное свойство импорта");
  equal(parse(toFileUrl(sibling).href)[0].source, sibling, "file URL normalisation");
  equal(parse(sibling)[0].source, sibling, "absolute local source");
  const localTargets = await importTargets([local]);
  equal(localTargets[0].namespace, "os", "Namespace alias");
  equal(localTargets[0].sourceTitle, "Operating systems", "Publication title fallback");
  equal(localTargets[0].title, "Virtual memory", "Target title preserved");
  equal(localTargets[0].baseUrl, local.baseUrl, "Separate publication URL");
  const remote = parse(`${url}/reference.json`, { title: "OS course", style: "external" })[0];
  const remoteTargets = await importTargets([remote, { ...remote, namespace: "os-lectures", sourceNamespace: "lectures" }]);
  equal(reads, 1, "One HTTP read for multiple imported namespaces");
  equal(remoteTargets.length, 2, "Both HTTP namespaces imported");
  equal(remoteTargets[0].sourceTitle, "OS course", "Explicit source title wins");
  equal(remoteTargets[0].defaultStyle, "external", "Import presentation default");
  equal(remoteTargets[1].slide, "memory", "Slide anchor preserved");
  const redirected = await importTargets(parse(`${url}/redirect`));
  equal(redirected[0].page, "chapters/memory.html", "HTTP redirect preserves catalog");
  await rejects(() => importTargets(parse(`${url}/missing`)), "HTTP 404");
  await rejects(() => importTargets(parse(`${url}/invalid-json`)), "некорректный JSON импортированного каталога");
  await rejects(() => importTargets(parse(`${url}/invalid-schema`)), "неподдерживаемая схема импортированного каталога");
  await rejects(() => importTargets([{ ...local, sourceNamespace: "absent" }]), "не содержит пространство имён absent");
  await rejects(() => importTargets(parse("../absent.json")), "не удалось прочитать импортированный каталог");

  for (const schema of ["quarto-reference-catalog/2", "quarto-reference-catalog/3"]) {
    await Deno.writeTextFile(sibling, JSON.stringify({ ...fixture, schema }));
    await rejects(() => importTargets([local]), "неподдерживаемая схема импортированного каталога");
  }
  for (const [property, valid] of [["baseUrl", "https://other.example/"], ["sourceTitle", "Other course"], ["defaultStyle", "external"]]) {
    const candidate = structuredClone(fixture);
    Object.assign(candidate.targets["book:sec-memory"], { [property]: valid });
    await Deno.writeTextFile(sibling, JSON.stringify(candidate));
    await rejects(() => importTargets([local]), `${property} недопустимо в каталоге публикации`);
  }

  for (const [source, message] of [["ftp://example.edu/reference.json", "неподдерживаемый протокол источника импорта"], ["https://[", "некорректный URL источника импорта"], ["https://example.edu/reference.json#part", "не должен содержать фрагмент"], ["file:///tmp/ref.json?query", "источник file: не должен содержать"]]) {
    await rejects(() => parse(source), message);
  }
  await rejects(() => parse("../os/reference.json", { file: "other.json" }), "неизвестное свойство импорта");
  await rejects(() => parse(""), "требуется source");
  await rejects(() => parseImports([], consumer, []), "imports должен сопоставлять");
  await rejects(() => parseImports({ book: config(sibling).os }, consumer, ["book"]), "некорректное пространство имён импорта");
  await rejects(() => parse(sibling, { namespace: "bad:namespace" }), "корректное пространство имён источника");
  await rejects(() => parse(sibling, { style: "italic" }), "некорректный стиль импорта");
  await rejects(() => parse(sibling, { title: 9 }), ".title должен быть непустой строкой");
  await rejects(() => parse(sibling, { unknown: true }), "неизвестное свойство импорта");
  for (const invalid of [undefined, "https://example.edu/os", "ftp://example.edu/os/", "https://example.edu/os/?v=1", "https://example.edu/os/#x"]) {
    await rejects(() => parse(sibling, { "base-url": invalid }), "base-url должен быть HTTP(S) URL");
  }

  const malformed: [unknown, string][] = [
    [{ ...fixture, generator: null }, "поле generator каталога"],
    [{ ...fixture, generator: { quarto: "test", version: "1" } }, "недопустимое поле version"],
    [{ ...fixture, version: "1" }, "недопустимое поле version"],
    [{ ...fixture, targets: [] }, "поле targets каталога"],
    [{ ...fixture, publication: { title: 10 } }, "publication.title"],
  ];
  for (const [property, invalid] of [["page", "../secret.html"], ["page", "/absolute.html"], ["page", "https://other.example/x"], ["page", "folder\\x.html"], ["page", "a//x.html"], ["page", "x.html?q=1"], ["fragment", ""], ["slide", 1], ["title", null], ["sourceTitle", 1], ["defaultStyle", "bad"], ["baseUrl", "javascript:alert(1)"], ["number", 1]] as [string, unknown][]) {
    const candidate = structuredClone(fixture);
    Object.assign(candidate.targets["book:sec-memory"], { [property]: invalid });
    malformed.push([candidate, property]);
  }
  malformed.push([{ ...fixture, targets: { "book:wrong": fixture.targets["book:sec-memory"] } }, "ключ каталога должен совпадать"]);
  for (const [candidate, message] of malformed) {
    await Deno.writeTextFile(sibling, JSON.stringify(candidate));
    await rejects(() => importTargets([local]), message);
  }
  console.log("PASS imports: HTTP and redirects, one snapshot per source, required source, sibling repositories, current schema only, publication metadata, malformed catalog/config rejection");
} finally {
  await server.shutdown();
  await Deno.remove(root, { recursive: true });
}
