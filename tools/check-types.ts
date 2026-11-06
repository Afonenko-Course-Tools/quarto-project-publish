import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";

const root = dirname(dirname(fromFileUrl(import.meta.url)));
const imports: Record<string, string> = {};
for (const name of ["stdlib/path", "stdlib/fs"]) {
  imports[name] = import.meta.resolve(name).replace("jsr:/", "jsr:");
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
if (typeof coverage !== "object" || coverage === null || !("owned" in coverage) || !Array.isArray(coverage.owned) || !coverage.owned.every((file): file is string => typeof file === "string")) throw Error("Неверный typecheck/coverage.json");
const config = await Deno.makeTempFile({ suffix: ".json" });
try {
  const settings: unknown = JSON.parse(await Deno.readTextFile(join(root, "typecheck/deno.json")));
  if (typeof settings !== "object" || settings === null) throw Error("Неверный typecheck/deno.json");
  await Deno.writeTextFile(config, JSON.stringify({ ...settings, imports }));
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["check", "--no-lock", "--config", config, ...coverage.owned.filter(file => !file.endsWith(".lua")).map(file => join(root, file))],
    cwd: root,
    stdout: "inherit", stderr: "inherit",
  }).output();
  if (!result.success) Deno.exit(result.code);
} finally { await Deno.remove(config); }
