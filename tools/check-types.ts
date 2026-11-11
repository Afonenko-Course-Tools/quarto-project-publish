import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";

const root = dirname(dirname(fromFileUrl(import.meta.url)));
const scope = Deno.args[0] ?? "--all";
if (!["--all", "--deno", "--node", "--browser", "--lua"].includes(scope) || Deno.args.length > 1) throw Error("Укажите --all, --deno, --node, --browser или --lua");
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
const discovered = (await Promise.all(["_extensions/course-site", "tests", "tools", "examples", "typecheck"].map(sourceFiles))).flat().sort();
if (JSON.stringify(discovered) !== JSON.stringify([...coverage.owned, ...coverage.delegated_to_N3].sort())) throw Error("Состав кода изменился: обновите конечный typecheck/coverage.json");
const bridges = ["_extensions/course-site/observability/bridge.ts", "_extensions/course-site/observability/bridge.lua"];
if (JSON.stringify([...coverage.delegated_to_N3].sort()) !== JSON.stringify(bridges.sort())) throw Error("Делегированы только два канонических bridge Performance");
if (scope === "--lua") {
  const performanceRoot = resolve(Deno.env.get("PERFORMANCE") ?? join(root, "..", "quarto-course-performance"));
  const args = ["run", "--no-config", "--no-lock", "-A", join(performanceRoot, "tools/check-lua.ts"), "--root", root];
  for (const file of coverage.owned.filter(file => file.endsWith(".lua"))) args.push("--scope", file);
  args.push("--exclude", "_extensions/course-site/observability/bridge.lua", "--library", join(root, "_extensions/course-site/observability"));
  const server = Deno.env.get("LUA_LANGUAGE_SERVER");
  if (server) args.push("--server", server);
  const result = await new Deno.Command(Deno.execPath(), { args, cwd: root, stdout: "inherit", stderr: "inherit" }).spawn().status;
  Deno.exitCode = result.code;
} else {
  const imports: Record<string, string> = {};
  for (const [name, source] of [["process", "infrastructure/process.ts"], ["diagnostics", "infrastructure/diagnostics.ts"], ["state", "application/state.ts"]] as const) {
    imports["site-fixture/" + name] = toFileUrl(join(root, "_extensions/course-site", source)).href;
  }

  for (const name of ["stdlib/path", "stdlib/fs"]) {
    imports[name] = import.meta.resolve(name).replace(/^https:\/\/jsr\.io\/@std\/(path|fs)\/([^/]+)\/mod\.ts$/, "jsr:@std/$1@$2").replace("jsr:/", "jsr:");
  }
  const namespaces = new Set<string>();
  const providers = new Map<string, string>();
  for (const [name, variable, fallback] of [
    ["course-core", "CORE", "quarto-course"],
    ["course-prairielearn", "PL", "quarto-course-prairielearn"],
    ["project-download", "DOWNLOAD", "quarto-project-download"],
    ["reference-catalog", "QRC", "quarto-reference-catalog"],
    ["course-navigation", "CORE", "quarto-course"],
  ] as const) {
    const source = Deno.env.get(variable) || join(root, "..", fallback);
    let extension: string | undefined;
    for (const path of [resolve(source, "_extensions", name), resolve(source, "_extensions/Afonenko-Course-Tools", name), resolve(source)]) {
      try {
        if ((await Deno.stat(join(path, "public.ts"))).isFile) { extension = await Deno.realPath(path); break; }
      } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
    }
    if (!extension) throw Error(`${variable}: public.ts ${name} не найден`);
    const target = toFileUrl(extension + "/").href;
    imports[name + "/"] = target;
    providers.set(name, target);
    namespaces.add(dirname(extension));
  }
  for (const namespace of namespaces) {
    for (const [name, target] of providers) imports[toFileUrl(join(namespace, name) + "/").href] = target;
  }
  const config = await Deno.makeTempFile({ dir: root, prefix: ".active-types-", suffix: ".json" });
  try {
    await Deno.writeTextFile(config, JSON.stringify({ imports }));
    let exitCode = 0;
    if (scope === "--all" || scope === "--deno") {
      const result = await new Deno.Command(Deno.execPath(), {
        args: ["check", "--no-lock", "--config", join(root, "typecheck/deno.json"), "--import-map", config, ...coverage.owned.filter(file => file.endsWith(".ts") && file !== "typecheck/browser.d.ts").map(file => join(root, file))],
        cwd: root, stdout: "inherit", stderr: "inherit",
      }).spawn().status;
      console.log(JSON.stringify({ gate: "deno", exitCode: result.code }));
      exitCode ||= result.code;
    }
    for (const target of ["node", "browser"]) {
      if (scope !== "--all" && scope !== "--" + target) continue;
      const result = await new Deno.Command(Deno.env.get("TSC") || "tsc", {
        args: ["--project", join(root, "typecheck", target + ".json")],
        cwd: root, stdout: "inherit", stderr: "inherit",
      }).spawn().status;
      console.log(JSON.stringify({ gate: target, exitCode: result.code }));
      exitCode ||= result.code;
    }
    if (scope === "--all" || scope === "--deno") {
      const lint = await new Deno.Command(Deno.execPath(), {
        args: ["lint", "--config", join(root, "typecheck/deno.json"), ...coverage.owned.filter(file => /\.(ts|js|cjs)$/.test(file)).map(file => join(root, file))],
        cwd: root, stdout: "inherit", stderr: "inherit",
      }).spawn().status;
      exitCode ||= lint.code;
    }
    Deno.exitCode = exitCode;
  } finally { await Deno.remove(config); }

}
