// Ломается при смешении owner/source identity, утрате native metadata/project origins,
// student/full ресурсов или при обходе Publisher source-containment guard.
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const core = Deno.env.get("COURSE_CORE_PROVIDER") || Deno.env.get("CORE") ||
  join(dirname(repo), "quarto-course");
const root = Deno.env.get("COURSE_SITE_PROJECT_ROOT") ||
  await Deno.makeTempDir({ prefix: "site-project-native-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[], cwd = root) {
  const result = await new Deno.Command(quarto, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  await write(`_generated/test-logs/${crypto.randomUUID()}.log`, text);
  assert(result.success, `Отказ ${result.code}: ${text}`);
}
const owners = ["", "part", "nested/second"], ids = ["root", "first", "second"];
const namespace = "fixture-provider";
for (const [i, owner] of owners.entries()) {
  const prefix = owner ? owner + "/" : "";
  const hook = `_extensions/${namespace}/course-core/entrypoints/`;
  const site = owner
    ? `${
      "../".repeat(owner.split("/").length)
    }_extensions/${namespace}/course-site/entrypoints/collect.ts`
    : `_extensions/${namespace}/course-site/entrypoints/`;
  await write(
    prefix + "_quarto.yml",
    `project:
  type: ${owner ? "default" : "website"}
  render: [index.qmd]
  output-dir: _output
  resources: ["!projects/**", "!common/**", "!_extensions/**", "!_generated/**"${
      owner ? "" : ', "!part/**", "!nested/**"'
    }]
  pre-render: ${owner ? hook + "pre.ts" : site + "pre.ts"}
  post-render: ${
      owner ? "[" + site + ", " + hook + "post.ts]" : site + "post.ts"
    }
format: {html: {theme: none}}
lang: ru
fail-if-warnings: true
filters: [course-core]
course: {id: project-source}
exercise-bank: true
${owner ? "" : "subprojects: [part, nested/second]\n"}course-project:
  build:
    files: {Public.java: common/Public.java}
project-materialization:
  projects:
    exr-${ids[i]}:
      include-git: true
      common-files:
      - {source: common/Public.java, target: student/Public.java, audience: student}
      - {source: common/Teacher.java, target: tests/Teacher.java, audience: grading}
project-checks:
  defaults: {runtime: java25-junit-v1, scoring: {mode: weighted}}
  source-profiles:
    main: {mode: implementation, root: student, include: ["*.java"]}
  profiles:
    junit: {source-profile: main, tests: ["tests/*Test.java"]}
`,
  );
  for (const view of ["student", "full"]) {
    await write(
      prefix + `_quarto-${view}.yml`,
      `project: {output-dir: _output-${view}}\ncourse: {view: ${view}}\n`,
    );
  }
  await write(
    prefix + "index.qmd",
    `# Проект ${ids[i]}\n\n::: {#exr-${
      ids[i]
    } project="/projects/demo" project-check="junit" course-role="independent-study" difficulty="introductory" statement-visibility="open"}\nPUBLIC_${
      ids[i]
    }\n\n![Публичный ресурс](public.svg)\n\n::: {.solution}\nPRIVATE_${
      ids[i]
    }\n\n![Закрытый ресурс](closed.svg)\n:::\n:::\n`,
  );
  await write(
    prefix + "public.svg",
    `<svg xmlns="http://www.w3.org/2000/svg"><text>PUBLIC_RESOURCE_${
      ids[i]
    }</text></svg>`,
  );
  await write(
    prefix + "closed.svg",
    `<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_RESOURCE_${
      ids[i]
    }</text></svg>`,
  );
  await write(
    prefix + "projects/demo/_metadata.yml",
    "course-project:\n  starter: {path: student}\n  solutions: {reference: {path: reference}}\n",
  );
  await write(
    prefix + "projects/demo/student/Demo.java",
    `class Demo {} // STUDENT_${ids[i]}\n`,
  );
  await write(
    prefix + "projects/demo/reference/Demo.java",
    `class Demo {} // REFERENCE_${ids[i]}\n`,
  );
  await write(
    prefix + "projects/demo/tests/DemoTest.java",
    "class DemoTest {}\n",
  );
  await write(
    prefix + "common/Public.java",
    `class Public {} // COMMON_${ids[i]}\n`,
  );
  await write(
    prefix + "common/Teacher.java",
    "class Teacher {} // CLOSED_COMMON\n",
  );
  const cwd = join(root, owner);
  await run(["add", core, "--no-prompt"], cwd);
  await Deno.mkdir(join(cwd, "_extensions", namespace), { recursive: true });
  for (
    const name of ["course-core", "course-presentation", "course-navigation"]
  ) {
    await Deno.rename(
      join(cwd, "_extensions", name),
      join(cwd, "_extensions", namespace, name),
    );
  }
}
await run(["add", repo, "--no-prompt"]);
await Deno.rename(
  join(root, "_extensions/course-site"),
  join(root, "_extensions", namespace, "course-site"),
);
const original = await Deno.readTextFile(join(root, "_quarto.yml"));
for (const view of ["student", "full"]) {
  const prior = new Set(
    await Array.fromAsync(
      Deno.readDir(join(root, "_generated/course-site/runs")),
    ).catch((e) => {
      if (e instanceof Deno.errors.NotFound) return [];
      throw e;
    }).then((rows) => rows.map((r) => r.name)),
  );
  await run(["render", "--profile", view, "--fail-if-warnings"]);
  const runs = await Array.fromAsync(
    Deno.readDir(join(root, "_generated/course-site/runs")),
  );
  const fresh = runs.filter((r) => !prior.has(r.name));
  assertEquals(fresh.length, 1);
  const composition = JSON.parse(
    await Deno.readTextFile(
      join(
        root,
        "_generated/course-site/runs",
        fresh[0].name,
        "composition.json",
      ),
    ),
  );
  assertEquals(composition.nativeOperations.map((r: any) => r.project).sort(), [
    "nested/second",
    "part",
    "root",
  ]);
  const operationIds = [];
  for (const [i, owner] of owners.entries()) {
    const release = composition.nativeOperations.find((row: any) =>
      row.project === (owner || "root")
    );
    assertEquals(release.catalog.documents.map((d: any) => d.source), [
      "index.qmd",
    ]);
    assertEquals(release.release.proof.documents, [{
      source: "index.qmd",
      format: "html",
    }]);
    assertEquals(release.release.proof.course, {
      id: "project-source",
      view,
      adapters: [],
    });
    operationIds.push(release.catalog.identity.operation);
    const ownerRoot = join(root, owner);
    const Core = await import(
      toFileUrl(
        join(ownerRoot, "_extensions", namespace, "course-core/public.ts"),
      ).href
    );
    await Core.withCurrentNativeOperation({
      root: ownerRoot,
      profiles: [view],
      projection: view === "full" ? "author" : "student",
      outputDirectory: join(ownerRoot, `_output-${view}`),
    }, async (op: any) => {
      const proof = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      assertEquals(proof, release.release.proof);
      const doc = op.document({ source: "index.qmd" });
      assertEquals(doc.context.input, "index.qmd");
      assertEquals(doc.definitions[`exr-${ids[i]}`].project, "/projects/demo");
      assertEquals(doc.definitions[`exr-${ids[i]}`]["project-check"], "junit");
      await op.withProjectContexts([{
        owner: ownerRoot,
        inputs: ["projects/demo/native-input.qmd"],
        profiles: [view],
        format: "html",
      }], async (batch: any) => {
        const context = batch.groups[0].contexts[0];
        assert(
          context.input.startsWith(ownerRoot + "/projects/demo/"),
          "Потерян owner проекта",
        );
        const rawChecks = context.effectiveMetadata["project-checks"];
        assertEquals(rawChecks.profiles.junit["source-profile"], "main");
        assertEquals(rawChecks.profiles.junit.tests, ["tests/*Test.java"]);
        const rawMaterialization =
          context.effectiveMetadata["project-materialization"]
            .projects[`exr-${ids[i]}`];
        assertEquals(rawMaterialization["include-git"], true);
        assertEquals(
          rawMaterialization["common-files"].map((f: any) => f.audience),
          ["student", "grading"],
        );
        const plan = await Core.planProject(context, {
          audience: view === "full" ? "full" : "student",
        });
        const inventory = await Core.materializeProject(
          plan,
          op.condition({
            source: "index.qmd",
            exerciseId: `exr-${ids[i]}`,
            view: view === "full" ? "author" : "student",
          }),
          { submission: { files: [], instructions: "Сдайте исходник." } },
        );
        const files = new Map(
          inventory.files.map((
            f: any,
          ) => [f.target, new TextDecoder().decode(f.bytes)]),
        );
        assert(
          String(files.get("Demo.java")).includes(`STUDENT_${ids[i]}`),
          "Нет настоящих starter bytes",
        );
        assert(
          String(files.get("Public.java")).includes(`COMMON_${ids[i]}`),
          "Потеряно native происхождение build файла",
        );
        const text = [...files.values()].join("\n");
        assertEquals(text.includes(`REFERENCE_${ids[i]}`), view === "full");
        assertEquals(text.includes(`PRIVATE_${ids[i]}`), view === "full");
        assert(
          !text.includes("CLOSED_COMMON"),
          "Grading metadata превратились в student ресурс",
        );
      });
    });
    const mounted = join(root, `_output-${view}`, owner, "index.html");
    const html = await Deno.readTextFile(mounted);
    assert(html.includes("PUBLIC_" + ids[i]));
    assertEquals(html.includes("PRIVATE_" + ids[i]), view === "full");
    assert(!html.includes("CLOSED_COMMON"));
    assert(
      (await Deno.readTextFile(
        join(root, `_output-${view}`, owner, "public.svg"),
      )).includes("PUBLIC_RESOURCE_" + ids[i]),
    );
    let closed = false;
    try {
      closed = (await Deno.readTextFile(
        join(root, `_output-${view}`, owner, "closed.svg"),
      )).includes("PRIVATE_RESOURCE_");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    assertEquals(closed, view === "full");
  }
  assertEquals(new Set(operationIds).size, 3);
  assertEquals(await Deno.readTextFile(join(root, "_quarto.yml")), original);
}
// Отказ в конце: следующий positive не зависит от внешнего Core failed-render recovery.
const external = await Deno.makeTempFile({ suffix: ".qmd" });
try {
  const source = join(root, "part/index.qmd"),
    before = await Deno.readTextFile(source);
  await Deno.writeTextFile(external, before);
  await Deno.remove(source);
  await Deno.symlink(external, source);
  const result = await new Deno.Command(quarto, {
    args: ["render", "--profile", "student", "--no-clean"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  await write("_generated/test-logs/foreign-source.log", text);
  assert(!result.success && text.includes("SITE.SUBPROJECT_INVALID"), text);
  await Deno.remove(source);
  await Deno.writeTextFile(source, before);
} finally {
  await Deno.remove(external);
}
console.log(
  "PASS installed namespace, root/child/nested owner-local sources, genuine release/project contexts, native metadata/actual materialization, student/full privacy и foreign-source guard",
);
console.log("FIXTURE " + root);
