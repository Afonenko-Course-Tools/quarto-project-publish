import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert } from "./support.ts";
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
  assert(
    r.success,
    new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr),
  );
}
async function render(to = "default", profiles: string[] = []) {
  await write(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nsubprojects: [{path: part, to: ${to}}]\n`,
  );
  await native([
    "render",
    ".",
    ...(profiles.length ? ["--profile", profiles.join(",")] : []),
  ]);
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
  await write("part/index.qmd", "# Native HTML\n");
  await write(
    "part/slides.qmd",
    "---\nformat: revealjs\n---\n# Native слайды\n",
  );
  await Deno.mkdir(join(root, "_extensions"));
  const copied = await new Deno.Command("cp", {
    args: [
      "-R",
      join(repo, "_extensions/course-site"),
      join(root, "_extensions/course-site"),
    ],
  }).output();
  assert(copied.success, "Копирование Publisher");
  let actual = await render();
  assert(
    !actual.index.includes("reveal.js") && actual.slides.includes("reveal.js"),
    "Native mixed default изменён",
  );
  await write("_quarto-full.yml", "project: {output-dir: _site-full}\n");
  await write(
    "part/_quarto-full.yml",
    "project: {output-dir: _site-full}\nformat: revealjs\n",
  );
  actual = await render("default", ["full"]);
  assert(
    actual.index.includes("reveal.js") && actual.slides.includes("reveal.js"),
    "Native profile format потерян",
  );
  await write(
    "part/index.qmd",
    "---\nformat: {html: default, pdf: default}\n---\n# HTML первым\n",
  );
  actual = await render();
  assert(
    !actual.index.includes("reveal.js") && actual.index.includes("HTML первым"),
    "Native default первого формата изменён",
  );
  await write(
    "part/index.qmd",
    "---\nformat: {pdf: default, html: default}\n---\n# Явный HTML\n",
  );
  actual = await render("html");
  assert(
    !actual.index.includes("reveal.js") && !actual.slides.includes("reveal.js"),
    "Явный html не передан native процессу",
  );
  await write(
    "part/_extensions/custom/_extension.yml",
    "title: Custom\nversion: 0.1.0\ncontributes:\n  formats:\n    html:\n      toc: true\n",
  );
  await write(
    "part/index.qmd",
    "---\nformat: custom-html\n---\n# Native Custom\n",
  );
  actual = await render();
  assert(
    actual.index.includes("Native Custom") &&
      !actual.index.includes("reveal.js"),
    "Custom html alias изменён",
  );
  await write(
    "part/index.qmd",
    "---\nformat: {html: default, revealjs: default}\n---\n# Native первый web\n",
  );
  actual = await render();
  assert(
    !actual.index.includes("reveal.js") && actual.slides.includes("reveal.js"),
    "Два web formats должны следовать native default, без собственной ambiguity эвристики",
  );
  console.log(
    "PASS actual mixed native formats, profiles, HTML/PDF intent, custom-html и native default первого web",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
