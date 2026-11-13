import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, isRevealHtml } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "site-effective-native-" });
const write = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
const executable = Deno.env.get("QUARTO") || "quarto";
async function native(args: string[]) {
  const r = await new Deno.Command(executable, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
    env: { QUARTO: executable, QUARTO_PROFILE: "" },
  }).output();
  assert(r.success, new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr));
}
async function render(profiles: string[] = []) {
  await write(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nsubprojects: [part]\n`,
  );
  await native(["render", ".", ...(profiles.length ? ["--profile", profiles.join(",")] : [])]);
  const output = profiles.length ? "_site-full" : "_site";
  return {
    index: await Deno.readTextFile(join(root, output, "part/index.html")),
    slides: await Deno.readTextFile(join(root, output, "part/slides.html")),
  };
}
try {
  await write("index.qmd", "# Корень\n");
  await write(
    "part/_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, slides.qmd]\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nformat: html\n",
  );
  await Deno.mkdir(join(root, "_extensions"));
  const copied = await new Deno.Command("cp", {
    args: ["-R", join(repo, "_extensions/course-site"), join(root, "_extensions/course-site")],
  }).output();
  assert(copied.success, "Копирование Publisher");
  await write("_quarto-full.yml", "project: {output-dir: _site-full}\n");
  await write("part/_quarto-full.yml", "project: {output-dir: _site-full}\nformat: revealjs\n");
  await write("part/index.qmd", "---\nformat: html\n---\n# Native HTML\n");
  // Этот документ получает Revealjs из профиля дочернего проекта.
  await write("part/slides.qmd", "# Native слайды\n");
  const actual = await render(["full"]);
  assert(
    !isRevealHtml(actual.index) && actual.index.includes("Native HTML"),
    "Дочерний document format или mounted HTML потерян",
  );
  assert(
    isRevealHtml(actual.slides) && actual.slides.includes("Native слайды"),
    "Формат из профиля дочернего Quarto или mounted Revealjs потерян",
  );
  console.log("PASS mounted child HTML/Revealjs from native document and profile formats");
} finally {
  await Deno.remove(root, { recursive: true });
}
