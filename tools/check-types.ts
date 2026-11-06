import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";

const root = dirname(dirname(fromFileUrl(import.meta.url)));
const imports: Record<string, string> = {};
for (const [name, source] of [["process", "infrastructure/process.ts"], ["diagnostics", "infrastructure/diagnostics.ts"], ["state", "application/state.ts"]]) {
  imports["site-fixture/" + name] = toFileUrl(join(root, "_extensions/course-site", source)).href;
}

for (const name of ["stdlib/path", "stdlib/fs"]) {
  imports[name] = import.meta.resolve(name).replace(/^https:\/\/jsr\.io\/@std\/(path|fs)\/([^/]+)\/mod\.ts$/, "jsr:@std/$1@$2").replace("jsr:/", "jsr:");
}
for (const [name, variable, fallback] of [
  ["course-core", "CORE", "quarto-course"],
  ["course-prairielearn", "PL", "quarto-course-prairielearn"],
  ["project-download", "DOWNLOAD", "quarto-project-download"],
  ["reference-catalog", "QRC", "quarto-reference-catalog"],
  ["course-navigation", "CORE", "quarto-course"],
]) {
  const source = Deno.env.get(variable) || join(root, "..", fallback);
  let extension: string | undefined;
  for (const path of [resolve(source, "_extensions", name), resolve(source, "_extensions/Afonenko-Course-Tools", name), resolve(source)]) {
    try {
      if ((await Deno.stat(join(path, "public.ts"))).isFile) { extension = await Deno.realPath(path); break; }
    } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  }
  if (!extension) throw Error(`${variable}: public.ts ${name} не найден`);
  imports[name + "/"] = toFileUrl(extension + "/").href;
}
const coverage: unknown = JSON.parse(await Deno.readTextFile(join(root, "typecheck/coverage.json")));
if (typeof coverage !== "object" || coverage === null || !("owned" in coverage) || !("delegated_to_N3" in coverage) || !Array.isArray(coverage.owned) || !coverage.owned.every((file): file is string => typeof file === "string") || !Array.isArray(coverage.delegated_to_N3) || !coverage.delegated_to_N3.every((file): file is string => typeof file === "string")) throw Error("Неверный typecheck/coverage.json");
async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(join(root, directory))) {
    if (["vendor", "node_modules", "_generated", ".quarto", ".git"].includes(entry.name) || directory.startsWith("examples/") && entry.name === "_extensions") continue;
    const path = directory + "/" + entry.name;
    if (entry.isDirectory) found.push(...await sourceFiles(path));
    else if (entry.isFile && /\.(ts|js|cjs|lua|sh)$/.test(path)) found.push(path);
  }
  return found;
}
const discovered = [...(await Promise.all(["_extensions/course-site", "tests", "tools", "examples"].map(sourceFiles))).flat(), "typecheck/browser.d.ts"].sort();
if (JSON.stringify(discovered) !== JSON.stringify([...coverage.owned, ...coverage.delegated_to_N3].sort())) throw Error("Состав кода изменился: обновите конечный typecheck/coverage.json");
const config = await Deno.makeTempFile({ dir: root, prefix: ".active-types-", suffix: ".json" });
try {
  const settings: unknown = JSON.parse(await Deno.readTextFile(join(root, "typecheck/deno.json")));
  if (typeof settings !== "object" || settings === null) throw Error("Неверный typecheck/deno.json");
  await Deno.writeTextFile(config, JSON.stringify({ ...settings, imports }));
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["check", "--no-lock", "--config", config, ...coverage.owned.filter(file => file.endsWith(".ts") && file !== "typecheck/browser.d.ts").map(file => join(root, file))],
    cwd: root,
    stdout: "inherit", stderr: "inherit",
  }).spawn().status;
  Deno.exitCode = result.code;
  if (result.success) {
    for (const scope of ["node", "browser"]) {
      const result = await new Deno.Command("node", {
        args: [join(root, "node_modules/typescript/bin/tsc"), "--project", join(root, "typecheck", scope + ".json")],
        cwd: root, stdout: "inherit", stderr: "inherit",
      }).spawn().status;
      if (!result.success) { Deno.exitCode = result.code; break; }
    }
  }
  if (Deno.exitCode === 0) {
    const lint = await new Deno.Command(Deno.execPath(), {
      args: ["lint", "--config", config, ...coverage.owned.filter(file => /\.(ts|js|cjs)$/.test(file)).map(file => join(root, file))],
      cwd: root, stdout: "inherit", stderr: "inherit",
    }).spawn().status;
    Deno.exitCode = lint.code;
  }
} finally { await Deno.remove(config); }
