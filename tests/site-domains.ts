import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  base = dirname(repo);
const root = Deno.env.get("COURSE_SITE_DOMAIN_ROOT") ||
  await Deno.makeTempDir({ prefix: "course-site-domains-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[], cwd = root, success = true) {
  const r = await new Deno.Command(quarto, {
    args,
    cwd,
    env: { QUARTO: quarto },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  await write(`logs/${crypto.randomUUID()}.log`, text);
  assert(r.success === success, `exit ${r.code}: ${text}`);
  return text;
}
console.log(`Fixture: ${root}`);
await write(
  "_quarto.yml",
  `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
filters: [course-core, reference-catalog]
course: {id: portal}
reference-catalog: {namespace: portal}
subprojects: [part, second]
`,
);
await write(
  "index.qmd",
  "# Portal {#sec-home}\n\n@part:sec-part and @second:sec-second\n",
);
for (const id of ["part", "second"]) {
  await write(
    `${id}/_quarto.yml`,
    `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render:
    - _extensions/course-core/entrypoints/post.ts
    - _extensions/reference-catalog/entrypoints/post.ts
    - ../_extensions/course-site/entrypoints/collect.ts
format: html
filters: [course-core, reference-catalog]
course: {id: shared-course}
reference-catalog: {namespace: ${id}}
`,
  );
  await write(
    `${id}/index.qmd`,
    `---\nassessment:\n  kind: lab\n---\n\n# Lesson ${id} {#sec-${id}}\n\n:::: {#exr-${id} course-role="independent-study" difficulty="introductory"}\nPUBLIC_${id}\n\n![Public figure](asset.svg)\n\n::: {#sol-${id}}\nPRIVATE_${id}\n:::\n::::\n\n${
      id === "part" ? "@second:sec-second" : "@part:sec-part"
    }\n\n::: {.task-items}\n1. @exr-${id}\n:::\n`,
  );
}
for (const id of ["part", "second"]) {
  await write(
    `${id}/asset.svg`,
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>',
  );
}
if (Deno.args[0] === "rootless") {
  await write(
    "_quarto.yml",
    (await Deno.readTextFile(join(root, "_quarto.yml"))).replace(
      "filters: [course-core, reference-catalog]",
      "filters: [reference-catalog]",
    ).replace("course: {id: portal}\n", ""),
  );
}
for (const id of ["", "part/", "second/"]) {
  for (const view of ["student", "full"]) {
    await write(
      `${id}_quarto-${view}.yml`,
      `project:\n  output-dir: _site-${view}\n${
        Deno.args[0] === "rootless" && id === ""
          ? ""
          : `course:\n  view: ${view}\n`
      }`,
    );
  }
}
await run(["add", repo, "--no-prompt"]);
for (const cwd of [root, join(root, "part"), join(root, "second")]) {
  for (
    const provider of ["quarto-course-capture", "quarto-reference-catalog"]
  ) {
    await run([
      "add",
      (provider === "quarto-course-capture"
        ? Deno.env.get("COURSE_CORE_PROVIDER")
        : Deno.env.get("QRC_PROVIDER")) ||
      join(
        base,
        provider === "quarto-course-capture" ? "quarto-course" : provider,
      ),
      "--no-prompt",
    ], cwd);
  }
}
const runs = join(root, "_generated/course-site/runs");
const previousRuns = new Set<string>();
try {
  for await (const dir of Deno.readDir(runs)) previousRuns.add(dir.name);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
await run(["render", "--profile", "student"]);
const html = await Deno.readTextFile(join(root, "_site-student/index.html"));
assert(
  html.includes("part/index.html#sec-part") &&
    html.includes("second/index.html#sec-second"),
  "full mounted links missing",
);
const search = JSON.parse(
  await Deno.readTextFile(join(root, "_site-student/search.json")),
);
assert(
  search.some((entry: any) =>
    entry.href.startsWith("part/") && entry.text.includes("PUBLIC_part")
  ),
  "root search missing mounted lesson",
);
const releases: any[] = [];
for await (const dir of Deno.readDir(runs)) {
  if (previousRuns.has(dir.name)) continue;
  for await (const file of Deno.readDir(join(runs, dir.name))) {
    if (file.name.endsWith("-release.json")) {
      releases.push(
        JSON.parse(await Deno.readTextFile(join(runs, dir.name, file.name))),
      );
    }
  }
}
const lessonReleases = releases.filter((r) => r.model.exercises.length);
assertEquals(lessonReleases.length, 2);
assertEquals(
  lessonReleases.flatMap((r) => r.documents.map((d: any) => d.source)).sort(),
  [
    "subproject-part/index.qmd",
    "subproject-second/index.qmd",
  ],
);
const release = {
  documents: lessonReleases.flatMap((r) => r.documents),
  model: { exercises: lessonReleases.flatMap((r) => r.model.exercises) },
};
assertEquals(release.model.exercises.length, 2);
assert(
  !JSON.stringify(release).includes("PRIVATE_"),
  "student full release leaked solution",
);
assert(
  !(await Deno.readTextFile(join(root, "_site-student/part/index.html")))
    .includes("PRIVATE_"),
  "student mounted HTML leaked solution",
);
if (["resources", "rootless"].includes(Deno.args[0])) {
  if (Deno.args[0] === "resources") {
    const { buildBodies } = await import(
      new URL(`file://${root}/_extensions/course-core/body-export/producer.ts`)
        .href
    );
    const resources: any[] = [];
    for (const id of ["part", "second"]) {
      const { publicPackage } = await buildBodies(release, {
        projectRoot: root,
        courseId: "shared-course",
        work: `sec-${id}`,
      });
      assertEquals(publicPackage.works.map((work: any) => work.id), [
        `sec-${id}`,
      ]);
      assertEquals(
        publicPackage.questions.map((question: any) => question.id),
        [`exr-${id}`],
      );
      assertEquals(
        publicPackage.resources.map((resource: any) => resource.target),
        [`${id}/asset.svg`],
      );
      resources.push(...publicPackage.resources);
    }
    assertEquals(resources.map((r: any) => r.target).sort(), [
      "part/asset.svg",
      "second/asset.svg",
    ]);
  }
  if (Deno.args[0] === "rootless") {
    await run(["render", "--profile", "full"]);
    assert(
      (await Deno.readTextFile(join(root, "_site-full/part/index.html")))
        .includes("PRIVATE_part"),
      "rootless full audience was lost",
    );
    await write(
      "second/_quarto-student.yml",
      "project:\n  output-dir: _site-student\ncourse:\n  view: full\n",
    );
    assert(
      (await run(["render", "--profile", "student"], root, false)).includes(
        "course.view",
      ),
      "mixed explicit component audience accepted",
    );
  }
  console.log(`PASS composed ${Deno.args[0]} release`);
  Deno.exit(0);
}
if (Deno.args[0] === "smoke") {
  console.log("PASS installed Core/QRC current domain smoke");
  Deno.exit(0);
}
// Retained sidecars are deliberately malformed and must never enter a release.
await write(
  "part/_generated/course-spec/documents/student/poison.json",
  '{"source":"removed.qmd","scope":"document"}',
);
await run(["render", "--profile", "student"]);
const partConfig = await Deno.readTextFile(join(root, "part/_quarto.yml"));
await write(
  "part/_quarto.yml",
  partConfig.replace(
    "  pre-render: _extensions/course-core/entrypoints/pre.ts\n",
    "",
  ).replace("    - _extensions/course-core/entrypoints/post.ts\n", ""),
);
assert(
  (await run(["render", "--profile", "student"], root, false)).includes(
    "native-run.json",
  ),
  "missing Core collector failed for an unrelated reason",
);
await write("part/_quarto.yml", partConfig);
await run(["render", "--profile", "full"]);
assert(
  (await Deno.readTextFile(join(root, "_site-full/part/index.html")))
    .includes("PRIVATE_part"),
  "full lost current solution",
);
await run(["render", "--profile", "student"]);
assert(
  !(await Deno.readTextFile(join(root, "_site-student/part/index.html")))
    .includes("PRIVATE_"),
  "student retry used full result",
);
await write("second/index.qmd", "# Removed target {#sec-renamed}\n");
assert(
  (await run(["render", "--profile", "student"], root, false)).includes(
    "second:sec-second",
  ),
  "strict full failure lost the missing target",
);
console.log(
  "PASS installed Core current-run grouping, shared-course source prefixes, strict mounted QRC links/search, student privacy and missing target refusal",
);
