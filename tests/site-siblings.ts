import { assert, assertEquals, assertRejects } from "./support.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-site-siblings-" });
try {
  await Deno.mkdir(join(root, "part"));
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  output-dir: _site\nformat: html\ncourse: {id: portal}\nsubprojects: [part]\n",
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Root\n");
  const add = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["add", repo, "--no-prompt"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(add.success);
  const { pre } = await import(
    `file://${root}/_extensions/course-site/application/compose.ts`
  );
  Deno.env.delete("QUARTO_PROJECT_RENDER_ALL");
  await assertRejects(() => pre(root), "SITE.SIBLING_MISSING", [
    "course-core",
    "native-run.ts",
    "module",
  ]);
  const source = join(
    root,
    "_extensions/course-core/infrastructure/native-run.ts",
  );
  await Deno.mkdir(dirname(source), { recursive: true });
  await Deno.writeTextFile(
    source,
    'export function beginNativeRun() { const error = new Error("CORE_SENTINEL", {cause: "original"}); error.name = "ExtensionDiagnostic"; Object.assign(error, {code: "CORE.SENTINEL"}); throw error; }\n',
  );
  try {
    await pre(root);
    throw new Error("expected foreign error");
  } catch (error) {
    assert(error instanceof Error);
    assertEquals((error as Error & { code: string }).code, "CORE.SENTINEL");
    assertEquals(error.cause, "original");
    assert(!error.message.includes("SITE.SIBLING_MISSING"));
    assert(error.stack?.includes("beginNativeRun"));
  }
  // Import-time failures of a present QRC module must also stay foreign.
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  output-dir: _site\nformat: html\nreference-catalog: {namespace: root}\nsubprojects: [part]\n",
  );
  await Deno.mkdir(join(root, "_site"));
  await Deno.writeTextFile(join(root, "_site/index.html"), "current");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "_site/index.html");
  const qrc = join(
    root,
    "_extensions/reference-catalog/infrastructure/publish.ts",
  );
  await Deno.mkdir(dirname(qrc), { recursive: true });
  await Deno.writeTextFile(
    qrc,
    'throw new Error("INITIALIZATION_SENTINEL", {cause: "module cause"});\n',
  );
  const { post } = await import(
    `file://${root}/_extensions/course-site/application/compose.ts`
  );
  try {
    await post(root);
    throw new Error("expected import error");
  } catch (error) {
    assert(error instanceof Error);
    assertEquals(error.message, "INITIALIZATION_SENTINEL");
    assertEquals(error.cause, "module cause");
    assert(error.stack?.includes("publish.ts"));
  }
  console.log(
    "PASS missing sibling distinct from foreign call/import diagnostics and causes",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
