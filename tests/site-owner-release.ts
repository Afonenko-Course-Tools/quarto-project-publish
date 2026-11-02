// Настоящие hooks/loader/owner validators; временная installed layout, не полный курс.
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const core = Deno.env.get("CORE"),
  qrc = Deno.env.get("QRC"),
  download = Deno.env.get("DOWNLOAD"),
  pl = Deno.env.get("PL");
if (!core || !qrc || !download || !pl) {
  throw Error("Нужны exact CORE/QRC/DOWNLOAD/PL");
}
const mode = Deno.args[0] ?? "positive",
  author = mode === "full" || mode === "author-starter",
  slides = mode === "revealjs" || mode === "reveal-model",
  withPL = mode === "pl" || mode === "pl-missing" || mode === "root-pl";
const root = await Deno.makeTempDir({ prefix: "site-b3-owner-" }),
  ext = "_extensions/Afonenko-Course-Tools";
function assert(value: unknown, message: string) {
  if (!value) throw Error(message);
}
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function install(source: string, name: string, owner = "") {
  await Deno.mkdir(join(root, owner, ext), { recursive: true });
  const target = join(root, owner, ext, name);
  const copied = await new Deno.Command("cp", {
    args: ["-R", join(source, "_extensions", name), target],
  }).output();
  assert(copied.success, "Установка " + name);
  const writable = await new Deno.Command("chmod", {
    args: ["-R", "u+w", target],
  }).output();
  assert(writable.success, "Режим fixture " + name);
}
try {
  for (const owner of ["", "tasks"]) {
    for (
      const [source, name] of [
        [core, "course-core"],
        [qrc, "reference-catalog"],
        [download, "project-download"],
        [repo, "course-site"],
      ]
    ) await install(source!, name, owner);
  }
  if (withPL) await install(pl, "course-prairielearn", "tasks");
  if (mode === "root-pl") await install(pl, "course-prairielearn");
  if (mode === "pl-missing") {
    await Deno.remove(
      join(root, "tasks", ext, "course-prairielearn/public.ts"),
    );
  }
  const projection = author ? "author" : "student",
    view = author ? "full" : "student";
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [quarto run ${ext}/course-site/entrypoints/pre.ts]\n  post-render: [quarto run ${ext}/course-site/entrypoints/post.ts]\nformat: {html: {theme: none}}\nwebsite: {site-url: 'https://pages.example.test/course/'}\nsubprojects: [{path: tasks, to: default}]\nreference-catalog: {namespace: portal}\n`,
  );
  await put("index.qmd", "# Общий сайт\n");
  if (mode === "root-pl") {
    await put(
      "_quarto.yml",
      (await Deno.readTextFile(join(root, "_quarto.yml"))) +
        `\ncourse-core-runtime: native-ts\ncourse-core-projection: student\nfilters: [course-core]\n`,
    );
    await put(
      "index.qmd",
      "---\ncourse: {id: root-course, view: student, adapters: [prairielearn]}\nprairielearn: {question-defaults: {topic: Git, grading: {method: manual}, submission: {mode: upload}}}\n---\n# Общий сайт\n",
    );
  }
  if (mode === "inactive-course") {
    await put(
      "_quarto.yml",
      (await Deno.readTextFile(join(root, "_quarto.yml"))) +
        "\ncourse: {id: no-owner, view: student}\n",
    );
  }
  const plPre = withPL && mode !== "pl-missing"
    ? ", quarto run prepare-pl.ts"
    : "";
  await put(
    "tasks/prepare-pl.ts",
    `import * as Core from './${ext}/course-core/public.ts'; import * as PL from './${ext}/course-prairielearn/public.ts'; await PL.prepareNativeAdapter(Core,{root:Deno.cwd(),projection:'${projection}',outputDirectory:Deno.cwd()+'/_site'});`,
  );
  await put(
    "tasks/_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, other.qmd]\n  pre-render: [quarto run ${ext}/project-download/entrypoints/pre.ts, quarto run ${ext}/course-core/entrypoints/native-pre.ts${plPre}]\n  post-render: [quarto run ../${ext}/course-site/entrypoints/collect.ts, quarto run ${ext}/course-core/entrypoints/native-post.ts, quarto run ${ext}/project-download/entrypoints/post.ts --native${
      author ? " --author" : ""
    }]\nformat: {html: {theme: none}}\nfilters: [course-core, project-download]\ncourse-core-runtime: native-ts\ncourse-core-projection: ${projection}\nexercise-bank: true\nproject-download:\n  course-model: true\n  resources: {data: {path: assets, gitignore: false}}\ncourse-project:\n  build:\n    files: {build.gradle: shared/build.gradle, settings.gradle: shared/settings.gradle}\n  instructions:\n    gradle: {path: shared/gradle.md}\n    local: {path: README.local.md}\nreference-catalog: {namespace: tasks}\n`,
  );
  for (
    const [path, text] of Object.entries({
      "shared/build.gradle": "plugins { id 'java' }\n",
      "shared/settings.gradle": "rootProject.name='b3'\n",
      "shared/gradle.md":
        "Общая инструкция [данные](guide.txt?version=1#data).\n",
      "shared/guide.txt": "SHARED_DATA\n",
      "assets/data.txt": "ORDINARY_DATA\n",
      "visible.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
      "private.svg":
        '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_RESOURCE</text></svg>',
      "projects/demo/_metadata.yml":
        "course-project:\n  starter: {path: starter}\n  solutions: {reference: {path: solutions/reference}}\n",
      "projects/demo/README.local.md":
        "Локальная инструкция [данные](guide.txt#local).\n",
      "projects/demo/guide.txt": "LOCAL_DATA\n",
      "projects/demo/starter/src/main/java/Main.java": "class Main {}\n",
      "projects/demo/solutions/reference/src/main/java/Main.java":
        "class Main { int answer=42; }\n",
    })
  ) await put("tasks/" + path, text);
  if (slides) {
    await put(
      "tasks/projects/demo/_metadata.yml",
      (await Deno.readTextFile(
        join(root, "tasks/projects/demo/_metadata.yml"),
      )) + "\nformat: revealjs\n",
    );
  }
  if (mode === "mixed-default") {
    await put(
      "tasks/_quarto.yml",
      (await Deno.readTextFile(join(root, "tasks/_quarto.yml"))).replace(
        "format: {html: {theme: none}}",
        "format: {html: {theme: none}, pdf: default}",
      ),
    );
  }
  const identity = (id = "bounded-course") =>
    `course: {id: ${id}, view: ${view}${
      withPL ? ", adapters: [prairielearn]" : ""
    }}\n`;
  const plConfig = withPL
    ? "prairielearn:\n  question-defaults: {topic: Git, grading: {method: manual}, submission: {mode: upload}}\n"
    : "";
  const kind = mode === "author-starter"
    ? "starter"
    : author
    ? "full"
    : mode === "conditions"
    ? "conditions"
    : "starter";
  const artifact = slides && mode !== "reveal-model"
    ? ""
    : `{{< project-download exr-demo${
      mode === "default" ? "" : " kind=" + kind
    } >}}`;
  const assessment = mode === "assessment"
    ? "assessment: {id: invalid-test, kind: test}\ntitle: Неверная работа\n"
    : "";
  await put(
    "tasks/index.qmd",
    `---\n${
      identity(
        mode === "document-course" ? "different-course" : "bounded-course",
      )
    }${plConfig}${assessment}${
      slides ? "format: revealjs\n" : ""
    }---\n# Упражнения\n\n::: {#exr-demo difficulty=introductory time=7 statement-visibility=open project="projects/demo"${
      withPL ? " target=prairielearn prairielearn-grading=manual" : ""
    }}\n## Задача\nУсловие с [другой страницей](other.qmd#target) и [якорем](#point).\n\n::: {#point}\nТочный якорь.\n:::\n\n![Картинка](visible.svg?version=1#shape)\n\n${artifact}\n\n::: {.solution}\nPRIVATE_SOLUTION42. ![Закрыто](private.svg)\n:::\n:::\n\n![Данные](assets/data.txt)\n\n{{< project-download data >}}\n${
      mode === "assessment"
        ? "\n::: {.task-items stage=homework requirement=required work-mode=individual}\n- @exr-demo\n:::\n"
        : ""
    }`,
  );
  await put(
    "tasks/other.qmd",
    `---\n${identity()}${plConfig}---\n# Другая страница {#target}\n`,
  );
  const rendered = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["render", "--to", "html"],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(rendered.stdout) +
    new TextDecoder().decode(rendered.stderr);
  if (Deno.env.get("B3_LOG")) {
    await Deno.writeTextFile(Deno.env.get("B3_LOG")!, log);
    await Deno.writeTextFile(
      Deno.env.get("B3_LOG")! + ".json",
      JSON.stringify({
        mode,
        renderSuccess: rendered.success,
        exitCode: rendered.code,
      }) + "\n",
    );
  }
  const expected: Record<string, string> = {
    "document-course": "RELEASE.MIXED_COURSE",
    assessment: "CORE.ASSESSMENT_INVALID",
    "pl-missing": "RELEASE.ADAPTER_UNQUALIFIED",
    "reveal-model": "CONDITION_UNQUALIFIED",
    "inactive-course": "SITE.RELEASE_UNQUALIFIED",
    "author-starter": "DOWNLOAD.STARTER_UNQUALIFIED",
  };
  if (mode === "author-starter" && rendered.success && Deno.env.get("B3_LOG")) {
    const listed = await new Deno.Command("unzip", {
      args: ["-Z1", join(root, "_site/tasks/_downloads/exr-demo-starter.zip")],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const names = new TextDecoder().decode(listed.stdout).trim().split("\n");
    await Deno.writeTextFile(
      Deno.env.get("B3_LOG")! + ".privacy.json",
      JSON.stringify({
        mode,
        nativeRenderSuccess: true,
        unzipExit: listed.code,
        names,
        containsAuthor: names.some((n) => n.startsWith("author/")),
      }) + "\n",
    );
  }
  if (expected[mode]) {
    assert(
      !rendered.success && log.includes(expected[mode]),
      `B3 ${mode}: требуется ${expected[mode]}\n${log}`,
    );
    let success = false;
    try {
      await Deno.stat(
        join(root, "tasks/_generated/project-download/artifacts-receipt.json"),
      );
      success = true;
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    assert(!success, "Отказ создал success receipt");
    console.log(
      JSON.stringify({ mode, expected: expected[mode], status: "PASS" }),
    );
  } else {
    assert(rendered.success, `B3 ${mode}: actual render\n${log}`);
    const runs = await Array.fromAsync(
      Deno.readDir(join(root, "_generated/course-site/runs")),
    );
    const composition = JSON.parse(
      await Deno.readTextFile(
        join(
          root,
          "_generated/course-site/runs",
          runs[0].name,
          "composition.json",
        ),
      ),
    );
    if (mode === "root-pl") {
      const rootProof = composition.nativeOperations.find((
        row: { project: string },
      ) => row.project === "root")?.release;
      assert(
        rootProof?.proof.course.id === "root-course" &&
          rootProof.validationPasses === 2,
        "Root public Core/C proof без Download не выполнен",
      );
    }
    const current = composition.nativeOperations.find((
      row: { project: string },
    ) => row.project === "tasks");
    assert(
      current?.release?.proof?.course?.id === "bounded-course",
      "Нет genuine текущего owner release proof",
    );
    assert(
      current.release.proof.documents.length === 2,
      "Proof потерял owner source coverage",
    );
    assert(
      current.release.validationPasses === 1,
      "Download owner должен сообщать один genuine validation pass",
    );
    assert(
      JSON.stringify(current.release.proof.validatedAdapters) ===
        JSON.stringify(withPL ? ["prairielearn"] : []),
      "Download proof потерял actual selected adapter validation",
    );
    for (
      const metric of [
        "inspectCalls",
        "fullWalks",
        "sourceHashReads",
        "sourceHashBytes",
      ]
    ) {
      assert(
        current.release.metricsBefore[metric] ===
          current.release.metricsAfter[metric],
        "Owner validation добавила inspect/discovery/hash: " + metric,
      );
    }
    const archive = join(
      root,
      "_site/tasks/_downloads",
      slides ? "data.zip" : `exr-demo-${kind}.zip`,
    );
    const extracted = await new Deno.Command("unzip", {
      args: ["-p", archive, slides ? "data.txt" : "README.md"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(extracted.stdout);
    assert(extracted.success, "Нет конечного ZIP");
    if (!slides) {
      assert(
        text.includes(
          "https://pages.example.test/course/tasks/other.html#target",
        ),
        "Потерян final mounted URL",
      );
      assert(
        text.includes("SHARED_DATA") === false &&
          text.includes("resources/shared/guide.txt?version=1#data"),
        "Нет owner fragment resource suffix",
      );
      assert(
        text.includes('id="point"') &&
          text.includes("resources/visible.svg?version=1#shape"),
        "Утеряны condition anchor/resource suffix",
      );
      if (!author) {
        assert(
          !text.includes("PRIVATE_SOLUTION42"),
          "Student README содержит решение",
        );
      }
      const names = await new Deno.Command("unzip", { args: ["-Z1", archive] })
        .output();
      const list = new TextDecoder().decode(names.stdout);
      assert(
        author ? list.includes("author/reference/") : !list.includes("author/"),
        "Нарушена student/full privacy",
      );
      if (mode === "conditions") {
        assert(
          !list.includes("Main.java") && !list.includes("build.gradle"),
          "Condition-only включает код/build",
        );
      }
    } else {assert(
        text === "ORDINARY_DATA\n",
        "Обычный reveal resource изменился",
      );}
    console.log(
      JSON.stringify({ mode, status: "PASS", release: current.release }),
    );
  }
} finally {
  if (Deno.env.get("B3_KEEP")) console.log(root);
  else await Deno.remove(root, { recursive: true });
}
