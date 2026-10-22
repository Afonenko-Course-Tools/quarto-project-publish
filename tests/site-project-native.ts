import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
import { deepStrictEqual } from "node:assert/strict";
import { validateConfig } from "../_extensions/course-site/infrastructure/config.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const core = Deno.env.get("COURSE_CORE_PROVIDER") || join(dirname(repo), "quarto-course");
const root = Deno.env.get("COURSE_SITE_PROJECT_ROOT") ||
  await Deno.makeTempDir({ prefix: "site-project-source-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[], cwd = root) {
  const result = await new Deno.Command(quarto, {
    args, cwd, stdout: "piped", stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  await write(`logs/${crypto.randomUUID()}.log`, text);
  assert(result.success, `Отказ ${result.code}: ${text}`);
}
const owners = ["", "part", "nested/second"];
const ids = ["root", "first", "second"];
const expectedPrefixes = ["root", "subproject-part", "subproject-nested%2Fsecond"];
const namespace = "fixture-provider";
for (let i = 0; i < owners.length; i++) {
  const owner = owners[i], prefix = owner ? owner + "/" : "";
  const hook = `_extensions/${namespace}/course-core/entrypoints/`;
  const site = owner ? `${"../".repeat(owner.split("/").length)}_extensions/${namespace}/course-site/entrypoints/collect.ts`
    : `_extensions/${namespace}/course-site/entrypoints/`;
  await write(prefix + "_quarto.yml", `project:
  type: ${owner ? "default" : "website"}
  render: [index.qmd]
  output-dir: _output
  resources: ["!projects/**", "!common/**", "!_extensions/**", "!_generated/**"${owner ? "" : ', "!part/**", "!nested/**"'}]
  pre-render: ${owner ? hook + "pre.ts" : site + "pre.ts"}
  post-render: ${owner ? "[" + hook + "post.ts, " + site + "]" : site + "post.ts"}
format: html
lang: ru
fail-if-warnings: true
filters: [course-core]
course: {id: project-source}
exercise-bank: true
default-exercise-statement-visibility: open
${owner ? "" : "subprojects: [part, nested/second]\n"}project-materialization:
  projects:
    exr-${ids[i]}:
      include-git: true
      common-files:
      - {source: common/Public.java, target: student/Public.java, audience: student}
      - {source: common/Teacher.java, target: tests/Teacher.java, audience: grading}
project-checks:
  defaults:
    runtime: java25-junit-v1
    scoring: {mode: weighted}
  source-profiles:
    main: {mode: implementation, root: student, include: ["*.java"]}
  profiles:
    junit: {source-profile: main, tests: ["tests/*Test.java"]}
`);
  for (const view of ["student", "full"]) {
    await write(prefix + `_quarto-${view}.yml`, `project: {output-dir: _output-${view}}\ncourse: {view: ${view}}\n`);
  }
  await write(prefix + "index.qmd", `# Проект ${ids[i]}\n\n:::: {#exr-${ids[i]} project="/projects/demo" project-check="junit" course-role="independent-study" difficulty="introductory"}\nPUBLIC_${ids[i]}\n\n![Публичный ресурс](public.svg)\n\n::: {#sol-${ids[i]}}\nPRIVATE_${ids[i]}\n\n![Закрытый ресурс](closed.svg)\n:::\n::::\n`);
  await write(prefix + "public.svg", `<svg xmlns="http://www.w3.org/2000/svg"><text>PUBLIC_RESOURCE_${ids[i]}</text></svg>`);
  await write(prefix + "closed.svg", `<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_RESOURCE_${ids[i]}</text></svg>`);
  await write(prefix + "projects/demo/student/Demo.java", "class Demo {}\n");
  await write(prefix + "projects/demo/tests/DemoTest.java", "class DemoTest {}\n");
  await write(prefix + "common/Public.java", "class Public {}\n");
  await write(prefix + "common/Teacher.java", "class Teacher {} // CLOSED_COMMON\n");
  const cwd = join(root, owner);
  await run(["add", core, "--no-prompt"], cwd);
  await Deno.mkdir(join(cwd, "_extensions", namespace), { recursive: true });
  // Полная штатная локальная установка, затем generated namespace fixture.
  for (const name of ["course-core", "course-presentation", "course-navigation"]) {
    await Deno.rename(join(cwd, "_extensions", name), join(cwd, "_extensions", namespace, name));
  }
}
await run(["add", repo, "--no-prompt"]);
await Deno.rename(join(root, "_extensions/course-site"), join(root, "_extensions", namespace, "course-site"));
const configured = await validateConfig(root, {
  project: { type: "website", "output-dir": "_output-student" },
  subprojects: owners.slice(1),
}, ["student"]);
assertEquals(["root", ...configured.projects.map(project => project.id)], expectedPrefixes);
const original = await Deno.readTextFile(join(root, "_quarto.yml"));
for (const view of ["student", "full"]) {
  await run(["render", "--profile", view, "--fail-if-warnings"]);
  const runs = join(root, "_generated/course-site/runs");
  const releases: any[] = [];
  for await (const directory of Deno.readDir(runs)) {
    for await (const file of Deno.readDir(join(runs, directory.name))) {
      if (file.name.endsWith("-release.json")) {
        const release = JSON.parse(await Deno.readTextFile(join(runs, directory.name, file.name)));
        if (release.model.course.view === view) releases.push(release);
      }
    }
  }
  assertEquals(releases.length, 3);
  for (let i = 0; i < owners.length; i++) {
    const source = expectedPrefixes[i] + "/index.qmd";
    const release = releases.find(value => value.model.projects?.[0]?.exerciseId === "exr-" + ids[i]);
    assert(release, "Не сохранён настоящий release проекта " + ids[i]);
    const project = release.model.projects[0];
    assertEquals(project.source, source);
    assertEquals(project.projectRoot, "projects/demo");
    deepStrictEqual(project.materialization, { commonFiles: [
      { source: "common/Public.java", target: "student/Public.java", audience: "student" },
      { source: "common/Teacher.java", target: "tests/Teacher.java", audience: "grading" },
    ], includeGit: true });
    deepStrictEqual(project.check.sourceProfile, { mode: "implementation", root: "student", include: ["*.java"] });
    assertEquals(project.check.tests, ["tests/*Test.java"]);
    assertEquals(release.documents[0].source, source);
    const mounted = join(root, `_output-${view}`, owners[i], "index.html");
    const html = await Deno.readTextFile(mounted);
    assert(html.includes("PUBLIC_" + ids[i]));
    assertEquals(html.includes("PRIVATE_" + ids[i]), view === "full");
    assert(!html.includes("CLOSED_COMMON"));
    const resources = await Deno.readTextFile(join(root, `_output-${view}`, owners[i], "public.svg"));
    assert(resources.includes("PUBLIC_RESOURCE_" + ids[i]));
    let closed = false;
    try { closed = (await Deno.readTextFile(join(root, `_output-${view}`, owners[i], "closed.svg"))).includes("PRIVATE_RESOURCE_"); }
    catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
    assertEquals(closed, view === "full");
  }
  assertEquals(await Deno.readTextFile(join(root, "_quarto.yml")), original);
}
// Native owner containment остаётся отдельным guard, prefix не чинит foreign source.
const external = await Deno.makeTempFile({ suffix: ".qmd" });
try {
  const source = join(root, "part/index.qmd");
  const before = await Deno.readTextFile(source);
  await Deno.writeTextFile(external, before);
  await Deno.remove(source);
  await Deno.symlink(external, source);
  const result = await new Deno.Command(quarto, {
    args: ["render", "--profile", "student", "--no-clean"], cwd: root,
    stdout: "piped", stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  await write("logs/foreign-source.log", text);
  assert(!result.success && text.includes("SITE.SUBPROJECT_INVALID"), text);
  await Deno.remove(source);
  await Deno.writeTextFile(source, before);
} finally { await Deno.remove(external); }
console.log("PASS installed namespace, root/child/nested project sources, actual release/sourceRoots, common/check metadata, student/full privacy и foreign-source guard");
console.log("FIXTURE " + root);
