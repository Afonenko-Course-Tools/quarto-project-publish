import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join, resolve } from "stdlib/path";
import { attr, elements, parseHtml } from "../_extensions/reference-catalog/infrastructure/html.ts";
import type { Catalog } from "../_extensions/reference-catalog/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "qrc-example-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const cue = Deno.env.get("CUE") || "cue";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function run(executable: string, args: string[], expectedError?: string) {
  const result = await new Deno.Command(executable, {
    args, cwd: root, stdout: "piped", stderr: "piped",
  }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expectedError ? !result.success && output.includes(expectedError) : result.success, output);
}
async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const path = join(directory, entry.name);
    if (entry.isDirectory) result.push(...await files(path));
    else if (entry.isFile) result.push(path);
  }
  return result;
}

try {
  await copy(join(repo, "examples/course"), root, { overwrite: true });
  // Exercise the actual installation command with the extension under test.
  await run(quarto, ["add", repo, "--no-prompt"]);
  await run(quarto, ["render", "--fail-if-warnings"]);
  const output = join(root, "_site");
  const catalogPath = join(output, "reference-catalog.json");
  const schema = join(repo, "schemas/catalog.schema.json");
  const vet = ["vet", "-c", "jsonschema:", schema, "json:"];
  await run(cue, [...vet, catalogPath]);
  const catalog: Catalog = JSON.parse(await Deno.readTextFile(catalogPath));
  for (const key of ["book:sec-objects", "book:fig-demo", "lectures:sec-memory", "practice:exr-demo"])
    assert(catalog.targets[key], `Missing example target: ${key}`);
  assert((await Deno.stat(join(output, "index.html"))).isFile, "Book is not the site home");
  assert((await Deno.stat(join(output, ".nojekyll"))).isFile, "Missing Pages marker");

  const pages = new Map<string, Set<string>>();
  let links = 0;
  for (const path of (await files(output)).filter(path => path.endsWith(".html"))) {
    const nodes = elements(parseHtml(await Deno.readTextFile(path)));
    pages.set(path, new Set(nodes.map(node => attr(node, "id")).filter((id): id is string => !!id)));
    for (const node of nodes) for (const name of ["href", "src"]) {
      const raw = attr(node, name);
      if (!raw || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|#)/.test(raw)) continue;
      const url = decodeURIComponent(raw.split(/[?#]/)[0]);
      if (!url) continue;
      assert(!url.startsWith("/"), `Root-relative URL breaks project Pages: ${raw}`);
      const target = resolve(dirname(path), url);
      try { await Deno.stat(target); }
      catch { throw new Error(`Broken local link ${raw} in ${path}`); }
      links++;
    }
  }
  for (const [key, target] of Object.entries(catalog.targets)) {
    const ids = pages.get(join(output, target.page));
    assert(ids?.has(target.fragment), `Missing catalog destination: ${key}`);
    if (target.slide) assert(ids.has(target.slide), `Missing Revealjs slide: ${key}`);
  }
  // A success-only test could miss an accidentally disabled schema check.
  const invalid = join(root, "invalid-catalog.json");
  await Deno.writeTextFile(invalid, JSON.stringify({ ...catalog, schema: "invalid" }));
  await run(cue, [...vet, invalid], "schema");
  console.log(`PASS example: installed local extension, HTML + Revealjs, CUE catalog, ${links} local links and all catalog anchors`);
} finally {
  await Deno.remove(root, { recursive: true });
}
