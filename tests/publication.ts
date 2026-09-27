import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "project-publish-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function write(path: string, value: string) {
  const target = join(root, path); await Deno.mkdir(dirname(target), { recursive: true }); await Deno.writeTextFile(target, value);
}
async function run(profile: string, expected = true) {
  const result = await new Deno.Command(quarto, { args: ["render", "--profile", profile, "--fail-if-warnings"], cwd: root, stdout: "piped", stderr: "piped" }).output();
  assert(result.success === expected, new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
}
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write("_quarto.yml", `project:
  type: website
  output-dir: _site
  render: []
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: _extensions/project-publish/entrypoints/post.ts
project-publish:
  home: main
  projects:
    main: {path: main, format: html}
    slides: {path: slides, format: revealjs}
    handouts: {path: handouts, format: pdf}
`);
  for (const profile of ["full", "student"]) await write(`_quarto-${profile}.yml`, `project:\n  output-dir: _site-${profile}\n`.replaceAll("\\n", "\n"));
  for (const member of ["main", "slides", "handouts"]) {
    await write(`${member}/_quarto.yml`, `project:
  type: default
  render: [index.qmd]
format:
  html: default
  revealjs: default
  pdf:
    pdf-engine: xelatex
mainfont: Latin Modern Roman
`);
    for (const profile of ["full", "student"]) await write(`${member}/_quarto-${profile}.yml`, `title: ${member}-${profile}\n`.replaceAll("\\n", "\n"));
    await write(`${member}/index.qmd`, `# Materials\n\n${member === "main" ? "[Handout](handouts/index.pdf)\n\n[Slides](slides/index.html)\n\n" : ""}::: {.content-visible when-profile="full"}\nPRIVATE_${member}\n:::\n`.replaceAll("\\n", "\n"));
  }
  await run("full"); await run("student");
  for (const profile of ["full", "student"]) {
    const html = await Deno.readTextFile(join(root, `_site-${profile}/index.html`));
    assert(html.includes("PRIVATE_main") === (profile === "full"), "Нарушено разделение HTML по профилям");
    const files = Array.from(Deno.readDirSync(join(root, `_site-${profile}/handouts`)), item => item.name);
    assert(files.length === 1 && files[0] === "index.pdf", "PDF-проект опубликовал лишние файлы");
    const pdf = await Deno.readFile(join(root, `_site-${profile}/handouts/index.pdf`));
    assert(new TextDecoder().decode(pdf.subarray(0, 5)) === "%PDF-", "Раздатка не является PDF");
    try { await Deno.stat(join(root, `_site-${profile}/reference-catalog.json`)); throw new Error("Координатор не должен создавать QRC-каталог"); }
    catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  }
  await Deno.remove(join(root, "handouts/_quarto-student.yml")); await run("student", false);
  console.log("Успех: независимая публикация без QRC/Core, HTML, Reveal, PDF и профили");
} finally { await Deno.remove(root, { recursive: true }); }
