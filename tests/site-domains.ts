import { commandProbe } from "./command-probe.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
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
async function run(
  args: string[],
  cwd = root,
  success = true,
  env: Record<string, string> = {},
) {
  const r = await new Deno.Command(quarto, {
    args,
    cwd,
    env: { QUARTO: quarto, ...env },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  await write(`_generated/test-logs/${crypto.randomUUID()}.log`, text);
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
website:
  site-url: https://example.test/course/
profile:
  default: full
filters: [course-core, reference-catalog]
course: {id: portal}
reference-catalog: {namespace: portal}
subprojects: [{path: part, to: default}, {path: second, to: default}]
`,
);
await write(
  "index.qmd",
  "# Portal {#sec-home}\n\n@part:sec-part and @second:sec-second\n\n::: {#exr-native}\nORDINARY_QUARTO_CONDITION\n:::\n\n::: {#sol-native}\nORDINARY_QUARTO_SOLUTION\n:::\n",
);
for (const id of ["part", "second"]) {
  await write(
    `${id}/_quarto.yml`,
    `project:
  type: book
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render:
    - _extensions/reference-catalog/entrypoints/post.ts
    - ../_extensions/course-site/entrypoints/collect.ts
    - _extensions/course-core/entrypoints/post.ts
book:
  title: Bank ${id}
  chapters: [index.qmd]
format: html
filters: [course-core, reference-catalog]
course: {id: shared-course}
exercise-bank: true
reference-catalog: {namespace: ${id}}
`,
  );
  await write(
    `${id}/index.qmd`,
    `---\ntitle: Работа ${id}\nassessment: {id: lab-${id}, kind: lab}\n---\n\n# Lesson ${id} {#sec-${id}}\n\n:::: {#exr-${id} course-role="independent-study" difficulty="introductory" time="10" statement-visibility="open"}\nPUBLIC_${id}\n\n![Public figure](asset.svg)\n\n::: {.solution}\nPRIVATE_${id}\n\n![Closed solution figure](solution.svg)\n:::\n::::\n\n::: {#exr-restricted-${id} difficulty="advanced" time="25" statement-visibility="restricted"}\nRESTRICTED_CONDITION_${id}\n\n![Restricted figure](restricted.svg)\n\n::: {.solution}\nRESTRICTED_SOLUTION_${id}\n:::\n:::\n\n${
      id === "part" ? "@second:sec-second" : "@part:sec-part"
    }\n\n::: {.assessment-preview}\nWORK_PREVIEW_${id}\n:::\n\n::: {.task-items stage="homework" requirement="required" work-mode="pair"}\n- @exr-${id}\n:::\n\n::: {.task-items stage="homework" requirement="optional" work-mode="individual"}\n- @exr-restricted-${id}\n:::\n`,
  );
}
for (const id of ["part", "second"]) {
  for (const asset of ["restricted", "solution"]) {
    await write(
      `${id}/${asset}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg"><text>${asset.toUpperCase()}_RESOURCE_${id}</text></svg>`,
    );
  }
  await write(
    `${id}/asset.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg"><text>PUBLIC_RESOURCE_${id}</text></svg>`,
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
assert(
  html.includes("ORDINARY_QUARTO_CONDITION") &&
    html.includes("ORDINARY_QUARTO_SOLUTION"),
  "ordinary native Quarto outside bank changed",
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
for (const id of ["part", "second"]) {
  const mounted = await Deno.readTextFile(
    join(root, `_site-student/${id}/index.html`),
  );
  assert(
    mounted.includes(`WORK_PREVIEW_${id}`),
    "student work preview missing",
  );
  assert(
    !mounted.match(/RESTRICTED_|PRIVATE_/),
    "student mounted page leaked closed declaration or assignment",
  );
  const catalog = await Deno.readTextFile(
    join(root, "_site-student/reference-catalog.json"),
  );
  assert(
    !catalog.includes("exr-restricted"),
    "student catalog exposed restricted target",
  );
  assert(
    !JSON.stringify(search).match(/RESTRICTED_|PRIVATE_/),
    "student composed search leaked closed content",
  );
  for (const asset of ["restricted", "solution"]) {
    try {
      await Deno.stat(join(root, `_site-student/${id}/${asset}.svg`));
      throw new Error(`student mounted closed resource: ${id}/${asset}.svg`);
    } catch (error) {
      assert(error instanceof Deno.errors.NotFound, String(error));
    }
  }
}
// Каждый owner сохраняет собственные local sources и native operation identity.
async function composition(view: string) {
  const matches = [];
  for await (const directory of Deno.readDir(runs)) {
    if (previousRuns.has(directory.name)) continue;
    try {
      const value = JSON.parse(
        await Deno.readTextFile(join(runs, directory.name, "composition.json")),
      );
      if (
        value.nativeOperations.some((row: any) =>
          row.catalog.identity.profiles.includes(view)
        )
      ) matches.push(value);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  assertEquals(matches.length, 1);
  for await (const directory of Deno.readDir(runs)) {
    previousRuns.add(directory.name);
  }
  return matches[0];
}
async function assertOwners(view: "student" | "full", resources = false) {
  const current = await composition(view);
  const lessons = current.nativeOperations.filter((row: any) =>
    ["part", "second"].includes(row.project)
  );
  assertEquals(lessons.length, 2);
  assertEquals(
    new Set(lessons.map((row: any) => row.catalog.identity.operation)).size,
    2,
  );
  for (const row of lessons) {
    const id = row.project, owner = join(root, id);
    assertEquals(row.catalog.documents.map((d: any) => d.source), [
      "index.qmd",
    ]);
    assertEquals(row.release.proof.documents, [{
      source: "index.qmd",
      format: "html",
    }]);
    assertEquals(row.release.proof.course, {
      id: "shared-course",
      view,
      adapters: [],
    });
    const selectedIds = row.catalog.documents[0].exercises.map((e: any) => e.id)
      .sort();
    assertEquals(
      selectedIds,
      view === "full"
        ? [`exr-${id}`, `exr-restricted-${id}`].sort()
        : [`exr-${id}`],
    );
    const Core = await import(
      toFileUrl(join(owner, "_extensions/course-core/public.ts")).href
    );
    await Core.withCurrentNativeOperation({
      root: owner,
      profiles: [view],
      projection: view === "full" ? "author" : "student",
      outputDirectory: join(owner, `_site-${view}`),
    }, async (op: any) => {
      assertEquals(
        await op.validateRelease({ expectedSources: ["index.qmd"] }),
        row.release.proof,
      );
      const doc = op.document({ source: "index.qmd" });
      assertEquals(doc.context.input, "index.qmd");
      assert(
        !JSON.stringify(doc.occurrences).includes("WORK_PREVIEW_"),
        "Preview вошёл в native exercise Body",
      );
      assertEquals(
        JSON.stringify(doc.occurrences).includes(`PRIVATE_${id}`),
        view === "full",
      );
      if (view === "student") {
        let refused = false;
        try {
          op.condition({
            source: "index.qmd",
            exerciseId: `exr-restricted-${id}`,
            view: "student",
          });
        } catch (error) {
          refused = String(error).includes("CONDITION_OCCURRENCE");
        }
        assert(refused, "Скрытое условие стало current public appearance");
      }
      if (resources) {
        const condition = op.condition({
          source: "index.qmd",
          exerciseId: `exr-${id}`,
          view: view === "full" ? "author" : "student",
        });
        assert(
          condition.resources.includes("asset.svg"),
          "Потерян ресурс current condition",
        );
        assert(
          !JSON.stringify(condition).includes("WORK_PREVIEW_"),
          "Condition захватило website preview",
        );
        const inventory = await op.resourceInventory({
          files: [{ source: "asset.svg", target: "asset.svg" }],
        });
        assertEquals(inventory.operation, op.identity.operation);
        assert(
          new TextDecoder().decode(inventory.files[0].bytes).includes(
            `PUBLIC_RESOURCE_${id}`,
          ),
          "Смешаны ресурсы двух owner с одинаковым именем",
        );
        if (view === "full") {
          const closed = op.condition({
            source: "index.qmd",
            exerciseId: `exr-restricted-${id}`,
            view: "author",
          });
          assert(
            JSON.stringify(closed).includes(`RESTRICTED_CONDITION_${id}`),
            "Author condition потеряло закрытое условие",
          );
          const privateInventory = await op.resourceInventory({
            files: [{ source: "restricted.svg", target: "restricted.svg" }],
          });
          assert(
            new TextDecoder().decode(privateInventory.files[0].bytes).includes(
              `RESTRICTED_RESOURCE_${id}`,
            ),
            "Потеряны author bytes",
          );
        }
      }
    });
  }
}
await assertOwners("student", Deno.args[0] === "resources");
async function assertFullProjection() {
  for (const id of ["part", "second"]) {
    const page = await Deno.readTextFile(
      join(root, `_site-full/${id}/index.html`),
    );
    assert(
      page.includes(`PRIVATE_${id}`) &&
        page.includes(`RESTRICTED_CONDITION_${id}`) &&
        page.includes(`RESTRICTED_SOLUTION_${id}`),
      "full потерял закрытое содержимое",
    );
    assert(
      page.includes(`exr-restricted-${id}`),
      "full потерял закрытый assignment slot",
    );
    assert(
      (await Deno.readTextFile(join(root, "_site-full/reference-catalog.json")))
        .includes(`exr-restricted-${id}`),
      "full потерял QRC target",
    );
    for (const asset of ["restricted", "solution"]) {
      assert(
        (await Deno.readTextFile(join(root, `_site-full/${id}/${asset}.svg`)))
          .includes(`${asset.toUpperCase()}_RESOURCE_${id}`),
        "full потерял закрытый resource",
      );
    }
  }
  assert(
    (await Deno.readTextFile(join(root, "_site-full/search.json"))).includes(
      "RESTRICTED_CONDITION_",
    ),
    "full search потерял закрытое условие",
  );
}
if (Deno.args[0] === "smoke") {
  console.log("PASS installed Core/QRC owner operation/domain smoke");
  Deno.exit(0);
}
await run(["render", "--profile", "full"]);
await assertFullProjection();
await assertOwners("full", Deno.args[0] === "resources");
await run(["render", "--profile", "student"]);
for (const id of ["part", "second"]) {
  assert(
    !(await Deno.readTextFile(join(root, `_site-student/${id}/index.html`)))
      .match(/PRIVATE_|RESTRICTED_/),
    "student retry использовал full result",
  );
  assert(
    (await Deno.readTextFile(join(root, `_site-full/${id}/index.html`)))
      .includes(`PRIVATE_${id}`),
    "student удалил independent full output",
  );
}
await assertOwners("student", Deno.args[0] === "resources");
if (Deno.args[0] === "rootless") {
  await write(
    "second/_quarto-student.yml",
    "project:\n  output-dir: _site-student\ncourse:\n  view: full\n",
  );
  const retainedPaths = [
    "_site-student/index.html",
    "_site-student/second/index.html",
    "second/_site-student/index.html",
  ];
  const retained = await Promise.all(
    retainedPaths.map((p) => Deno.readFile(join(root, p))),
  );
  const trace = join(root, "_generated/test-logs/audience-refusal.jsonl");
  const probe = await commandProbe(root, quarto, trace);
  const mixed = await run(
    ["render", "--profile", "student", "--no-clean"],
    root,
    false,
    { QUARTO: probe },
  );
  assert(
    mixed.includes("SITE.AUDIENCE_MISMATCH"),
    "Отсутствует адресный audience preflight: " + mixed,
  );
  for (const [i, path] of retainedPaths.entries()) {
    const actual = await Deno.readFile(join(root, path));
    assert(
      actual.length === retained[i].length &&
        actual.every((b, n) => b === retained[i][n]),
      "Audience refusal изменил previous bytes: " + path,
    );
  }
  const events = (await Deno.readTextFile(trace)).trim().split("\n").filter(
    Boolean,
  ).map((line) => JSON.parse(line));
  assertEquals(events.filter((e) => e.kind === "render").length, 0);
  assert(
    mixed.includes("course.view"),
    "Смешанная explicit аудитория отвергнута по иной причине: " + mixed,
  );
} else if (Deno.args[0] !== "resources") {
  // Отдельный корень для каждого failed build: Core M1 recovery не маскируется retry.
  const missingTarget = await Deno.makeTempDir({
    prefix: "site-missing-target-",
  });
  const copy = await new Deno.Command("cp", {
    args: ["-R", root + "/.", missingTarget],
  }).output();
  assert(copy.success, "Копия fixture для independent negative");
  // Copied private pointers принадлежат прежнему root: новый fixture начинает без них.
  for (const owner of ["", "part", "second"]) {
    try {
      await Deno.remove(join(missingTarget, owner, "_generated"), {
        recursive: true,
      });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  await Deno.writeTextFile(
    join(missingTarget, "second/index.qmd"),
    "# Removed target {#sec-renamed}\n",
  );
  assert(
    (await run(["render", "--profile", "student"], missingTarget, false))
      .includes("second:sec-second"),
    "strict QRC failure потерял missing target",
  );
  const partConfig = await Deno.readTextFile(join(root, "part/_quarto.yml"));
  await write(
    "part/_quarto.yml",
    partConfig.replace(
      "  pre-render: _extensions/course-core/entrypoints/pre.ts\n",
      "",
    ),
  );
  const missingPre = await run(["render", "--profile", "student"], root, false);
  assert(
    missingPre.includes("DOCUMENT_BINDING") &&
      missingPre.includes("Early sidecar") &&
      missingPre.includes(join(root, "part/index.qmd")),
    "missing Core pre отказал по иной причине: " + missingPre,
  );
  const folders = await Array.fromAsync(Deno.readDir(runs));
  let unfinished = 0;
  for (const folder of folders) {
    try {
      await Deno.stat(join(runs, folder.name, "composition.json"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) unfinished++;
      else throw error;
    }
  }
  assert(unfinished > 0, "Неуспешный render создал final composition");
}
console.log(
  `PASS installed ${
    Deno.args[0] || "all"
  }: owner-local genuine proofs, 2 namespace resources, student/full privacy/search/crossrefs и адресные negative guards`,
);
