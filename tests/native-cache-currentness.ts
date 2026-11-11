import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const work = await Deno.makeTempDir({ prefix: "site-native-cache-" });
const root = join(work, "course"), child = join(root, "child");
const quarto = Deno.env.get("QUARTO") || "quarto";
const rows: { step: string; profile: string; wallMs: number }[] = [];
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function contents(directory: string, extension: string): Promise<string> {
  const parts: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const path = join(directory, entry.name);
    if (entry.isDirectory) parts.push(await contents(path, extension));
    else if (entry.isFile && entry.name.endsWith(extension)) {
      parts.push(await Deno.readTextFile(path));
    }
  }
  return parts.join("\n");
}
async function render(step: string, profile = "student") {
  const started = performance.now();
  const result = await new Deno.Command(quarto, {
    args: ["render", ".", "--profile", profile],
    cwd: root,
    env: { XDG_CACHE_HOME: join(work, "cache"), QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, step + ": " + new TextDecoder().decode(result.stderr));
  rows.push({ step, profile, wallMs: performance.now() - started });
  return join(root, "_site-" + profile, "child");
}
const index = (token: string) =>
  `---\ntitle: ${token}\n---\n\n{{< include _fragment.qmd >}}\n\n::: {.content-visible when-profile="full"}\nFULL_ONLY_CACHE_SENTINEL\n:::\n`;
try {
  await Deno.mkdir(child, { recursive: true });
  await copy(
    join(repo, "_extensions/course-site"),
    join(root, "_extensions/course-site"),
  );
  await put(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-site/entrypoints/pre.ts]\n  post-render: [_extensions/course-site/entrypoints/post.ts]\nsubprojects: [child]\nformat: {html: {theme: none}}\n",
  );
  await put("index.qmd", "# Портал\n");
  await put(
    "child/_quarto.yml",
    "project:\n  type: website\n  output-dir: _output\n  render: ['*.qmd']\n  resources: [asset.txt]\n  post-render: [../_extensions/course-site/entrypoints/collect.ts]\nformat:\n  html:\n    theme: [default, theme.scss]\n",
  );
  for (const profile of ["student", "full"]) {
    await put(
      `_quarto-${profile}.yml`,
      `project: {output-dir: _site-${profile}}\n`,
    );
    await put(
      `child/_quarto-${profile}.yml`,
      `project: {output-dir: _output/${profile}}\n`,
    );
  }
  await put("child/index.qmd", index("FIRST_CACHE_TITLE"));
  await put("child/old.qmd", "# OLD_CACHE_DOCUMENT\n");
  await put("child/_fragment.qmd", "FIRST_CACHE_FRAGMENT\n");
  await put("child/asset.txt", "FIRST_CACHE_ASSET\n");
  await put(
    "child/theme.scss",
    "/*-- scss:rules --*/\n.native-cache-token { --native-cache-value: first; }\n",
  );
  let stage = await render("cold");
  const first = await Deno.readTextFile(join(stage, "index.html"));
  assert(
    first.includes("FIRST_CACHE_TITLE") &&
      first.includes("FIRST_CACHE_FRAGMENT"),
    "Cold потерял title/include",
  );
  assert(
    !first.includes("FULL_ONLY_CACHE_SENTINEL"),
    "Cold student содержит full-only текст",
  );
  stage = await render("warm");
  assert(
    await Deno.readTextFile(join(stage, "index.html")) === first,
    "Неизменный warm изменил HTML",
  );
  await put("child/index.qmd", index("SECOND_CACHE_TITLE"));
  await put("child/_fragment.qmd", "SECOND_CACHE_FRAGMENT\n");
  await put("child/asset.txt", "SECOND_CACHE_ASSET\n");
  await put(
    "child/theme.scss",
    "/*-- scss:rules --*/\n.native-cache-token { --native-cache-value: second; }\n",
  );
  await Deno.rename(join(child, "old.qmd"), join(child, "renamed.qmd"));
  await put("child/added.qmd", "# ADDED_CACHE_DOCUMENT\n");
  stage = await render("mutated-inputs");
  const changed = await Deno.readTextFile(join(stage, "index.html"));
  assert(
    changed.includes("SECOND_CACHE_TITLE") &&
      changed.includes("SECOND_CACHE_FRAGMENT") &&
      !changed.includes("FIRST_CACHE_FRAGMENT"),
    "Native cache сохранил старый title/include",
  );
  assert(
    await Deno.readTextFile(join(stage, "asset.txt")) ===
      "SECOND_CACHE_ASSET\n",
    "Native cache сохранил старый resource",
  );
  const css = await contents(stage, ".css");
  assert(
    /--native-cache-value:\s*second/.test(css) &&
      !/--native-cache-value:\s*first/.test(css),
    "Sass cache сохранил старое содержимое",
  );
  assert(
    (await Deno.stat(join(stage, "renamed.html"))).isFile &&
      (await Deno.stat(join(stage, "added.html"))).isFile,
    "Добавленный/переименованный input не опубликован",
  );
  assert(
    !await Deno.stat(join(stage, "old.html")).catch((error) => {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    }),
    "После rename остался stale output",
  );
  await Deno.remove(join(child, "added.qmd"));
  await put(
    "child/_quarto-student.yml",
    "project: {output-dir: _output/changed}\n",
  );
  stage = await render("deleted-input-new-output");
  assert(
    !await Deno.stat(join(stage, "added.html")).catch((error) => {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    }),
    "Удалённый input остался в текущем mount",
  );
  assert(
    (await Deno.stat(join(child, "_output/changed/index.html"))).isFile,
    "Новый output-dir проигнорирован",
  );
  const full = await render("full", "full");
  assert(
    (await Deno.readTextFile(join(full, "index.html"))).includes(
      "FULL_ONLY_CACHE_SENTINEL",
    ),
    "Full не обновил native profile",
  );
  stage = await render("student-after-full");
  assert(
    !(await contents(stage, ".html")).includes("FULL_ONLY_CACHE_SENTINEL"),
    "Student после full содержит закрытый текст",
  );
  console.log(JSON.stringify({
    status: "PASS",
    rows,
    nativeCaches:
      "Сохранены между запусками; глобальные кеши и OS cache не сбрасывались",
    coverage: [
      "source/frontmatter",
      "include",
      "resource",
      "Sass",
      "add/delete/rename",
      "output-dir",
      "student/full/student",
    ],
  }));
} finally {
  await Deno.remove(work, { recursive: true });
}
