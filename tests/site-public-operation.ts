import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  core = Deno.env.get("CORE"),
  qrc = Deno.env.get("QRC"),
  download = Deno.env.get("DOWNLOAD");
if (!core || !qrc || !download) throw Error("Нужны CORE/QRC/DOWNLOAD");
const root = await Deno.makeTempDir({ prefix: "site-public-operation-" }),
  ext = "_extensions/Afonenko-Course-Tools";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
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
  assert(copied.success, "Install " + name);
  await new Deno.Command("chmod", { args: ["-R", "u+w", target] }).output();
}
try {
  for (
    const [source, name] of [
      [core, "course-core"],
      [qrc, "reference-catalog"],
      [download, "project-download"],
      [repo, "course-site"],
    ]
  ) await install(source!, name);
  for (
    const [source, name] of [
      [core, "course-core"],
      [qrc, "reference-catalog"],
      [download, "project-download"],
    ]
  ) await install(source!, name, "tasks");
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [quarto run ${ext}/course-site/entrypoints/pre.ts]\n  post-render: [quarto run ${ext}/course-site/entrypoints/post.ts]\nformat:\n  html:\n    theme: none\nwebsite:\n  site-url: https://pages.example.test/course/\nsubprojects: [tasks]\nreference-catalog:\n  namespace: portal\n`,
  );
  if (Deno.env.get("B2_ROOT_NATIVE")) {
    const config = await Deno.readTextFile(join(root, "_quarto.yml"));
    await put(
      "_quarto.yml",
      config +
        "\nfilters: [course-core, project-download]\ncourse-core-runtime: native-ts\ncourse-core-projection: student\ncourse-core-role: page\nproject-download:\n  resources:\n    root-data: {path: assets, gitignore: false}\n",
    );
  }
  await put("assets/root.txt", "ROOT_NATIVE_RESOURCE\n");
  await put(
    "index.qmd",
    Deno.env.get("B2_ROOT_NATIVE")
      ? "# Общий сайт\n\n![Файл](assets/root.txt)\n\n{{< project-download root-data >}}\n"
      : "# Общий сайт\n",
  );
  await put(
    "tasks/_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, other.qmd]\n  pre-render: [quarto run ${ext}/project-download/entrypoints/pre.ts, quarto run ${ext}/course-core/entrypoints/native-pre.ts]\n  post-render: [quarto run ../${ext}/course-site/entrypoints/collect.ts, quarto run ${ext}/course-core/entrypoints/native-post.ts, quarto run ${ext}/project-download/entrypoints/post.ts --native]\nformat:\n  html:\n    theme: none\nfilters: [course-core, project-download]\ncourse-core-runtime: native-ts\ncourse-core-projection: student\ncourse-core-role: exercise-bank\nproject-download:\n  course-model: true\n  base-url: https://standalone.example/tasks/\ncourse-project:\n  build:\n    files:\n      build.gradle: shared/build.gradle\n      settings.gradle: shared/settings.gradle\n  instructions:\n    gradle: {path: shared/gradle.md}\nreference-catalog:\n  namespace: tasks\n`,
  );
  await put("tasks/shared/build.gradle", "plugins { id 'java' }\n");
  await put("tasks/shared/settings.gradle", "rootProject.name='site'\n");
  await put("tasks/shared/gradle.md", "JDK25. gradle test.\n");
  await put(
    "tasks/projects/demo/_metadata.yml",
    "course-project:\n  starter: {path: starter}\n",
  );
  await put(
    "tasks/projects/demo/starter/src/main/java/Main.java",
    "class Main {}\n",
  );
  await put("tasks/other.qmd", "# Другая страница {#target}\n");
  await put(
    "tasks/index.qmd",
    '# Упражнения\n\n::: {#exr-demo difficulty=introductory statement-visibility=open project="projects/demo"}\nУсловие с [другой страницей](other.qmd#target).\n\n{{< project-download exr-demo kind=starter >}}\n:::\n',
  );
  if (Deno.env.get("B2_DEFAULT_CORE")) {
    for (const owner of ["_quarto.yml", "tasks/_quarto.yml"]) {
      await put(
        owner,
        (await Deno.readTextFile(join(root, owner))).replace(
          "course-core-runtime: native-ts\n",
          "",
        ),
      );
    }
  }
  const rendered = await new Deno.Command("quarto", {
    args: ["render", "--to", "html"],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(rendered.stdout) +
    new TextDecoder().decode(rendered.stderr);
  await Deno.writeTextFile(join(root, "_generated/render.log"), log);
  assert(rendered.success, "Actual Publisher: " + root + "\n" + log);
  const archive = join(root, "_site/tasks/_downloads/exr-demo-starter.zip");
  const result = await new Deno.Command("unzip", {
    args: ["-p", archive, "README.md"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const readme = new TextDecoder().decode(result.stdout);
  assert(
    result.success &&
      readme.includes(
        "https://pages.example.test/course/tasks/other.html#target",
      ) &&
      readme.includes(
        "https://pages.example.test/course/tasks/_downloads/exr-demo-starter.zip",
      ) && !readme.includes("https://standalone.example/"),
    "Publisher не назначил конечные адреса до единственной упаковки: " + readme,
  );
  if (Deno.env.get("B2_ROOT_NATIVE")) {
    assert(
      (await Deno.stat(join(root, "_site/_downloads/root-data.zip"))).isFile,
      "Publisher не выдал native ordinary resource корня",
    );
  }
  const receipt = JSON.parse(
    await Deno.readTextFile(
      join(root, "tasks/_generated/project-download/artifacts-receipt.json"),
    ),
  );
  const a = await Deno.readFile(archive);
  const sha = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", a)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
  assert(
    receipt.archives.find((item: { name: string; sha256: string }) =>
      item.name === "exr-demo-starter.zip"
    )?.sha256 === sha,
    "Конечный ZIP отличается от подготовленных Download bytes",
  );
  const runs = join(root, "_generated/course-site/runs");
  const dirs = await Array.fromAsync(Deno.readDir(runs));
  const composition = JSON.parse(
    await Deno.readTextFile(join(runs, dirs[0].name, "composition.json")),
  );
  assert(
    composition.nativeOperations?.some((item: { project: string }) =>
      item.project === "tasks"
    ),
    "Publisher не проверил actual public operation",
  );
  await put(
    "_quarto.yml",
    // Core 9 по умолчанию native: отсутствие старого флага не является отказом.
    // Здесь действительно отключаем Core, сохраняя course и прежнюю выдачу.
    (await Deno.readTextFile(join(root, "_quarto.yml"))).replace(
      "course-core-runtime: native-ts\n",
      "",
    ).replace(
      "filters: [course-core, project-download]",
      "filters: [project-download]",
    ) +
      "\ncourse: {id: live-release}\n",
  );
  const refused = await new Deno.Command("quarto", {
    args: ["run", `${ext}/course-site/entrypoints/pre.ts`],
    cwd: root,
    env: {
      QUARTO_RUN_NO_NETWORK: "true",
      QUARTO_PROJECT_RENDER_ALL: "1",
      QUARTO_PROJECT_OUTPUT_DIR: "_site",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    !refused.success &&
      new TextDecoder().decode(refused.stderr).includes(
        "SITE.RELEASE_UNQUALIFIED",
      ),
    "Недостающий Core release proof был молча пропущен",
  );
  const retained = await Deno.readFile(archive);
  assert(
    retained.length === a.length && retained.every((v, i) => v === a[i]),
    "Owner gate удалил прежнюю выдачу до проверки",
  );
  console.log(
    "PASS actual Publisher→native child→public Download: финальные mounted адреса до ZIP, exact copied ZIP, operation/output coverage",
  );
} finally {
  if (Deno.env.get("B2_KEEP")) console.log("B2 fixture " + root);
  else await Deno.remove(root, { recursive: true });
}
