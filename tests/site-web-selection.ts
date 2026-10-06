import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "course-site-web-selection-" });
const executable = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, value: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), value);
}
async function run(args: string[], cwd = root) {
  const result = await new Deno.Command(executable, {
    args,
    cwd,
    env: {
      COURSE_FORMAT_COUNTS: join(root, "counts.txt"),
      COURSE_BUILD_TRACE: join(root, "trace.jsonl"),
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    result.success,
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
}
try {
  await write(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nfilters: [reference-catalog]\nreference-catalog: {namespace: rootpage}\nsubprojects: [a/slides]\n`,
  );
  await write("index.qmd", "# Root\n\n@talk:sec-slide\n");
  await write(
    "a/slides/_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, talk.qmd]\n  post-render:\n    - _extensions/reference-catalog/entrypoints/post.ts\n    - ../../_extensions/course-site/entrypoints/collect.ts\nformat: html\nfilters: [count.lua, reference-catalog]\nreference-catalog: {namespace: talk}\n`,
  );
  await write(
    "a/slides/count.lua",
    'function Pandoc(doc) local file = assert(io.open(os.getenv("COURSE_FORMAT_COUNTS"), "a")); file:write(pandoc.utils.stringify(doc.meta.title) .. "\\n"); file:close() end\n',
  );
  await write(
    "a/slides/index.qmd",
    "---\ntitle: Website\nformat:\n  pdf: default\n  html: default\n---\n# Website {#sec-web}\n\n@talk:sec-slide\n",
  );
  await write(
    "a/slides/talk.qmd",
    "---\ntitle: Slides\nformat: revealjs\n---\n# Slide {#sec-slide}\n\n@talk:sec-web\n",
  );
  await run(["add", repo, "--no-prompt"]);
  const qrc = Deno.env.get("QRC_PROVIDER") ||
    join(dirname(repo), "quarto-reference-catalog");
  await run(["add", qrc, "--no-prompt"]);
  await run(["add", qrc, "--no-prompt"], join(root, "a/slides"));
  await run(["render"]);
  const counts = (await Deno.readTextFile(join(root, "counts.txt"))).trim()
    .split("\n").sort();
  assertEquals(counts, ["Slides", "Website"]);
  const trace = (await Deno.readTextFile(join(root, "trace.jsonl"))).trim()
    .split("\n").map((line) => JSON.parse(line));
  assertEquals(trace.filter((row) => row.kind === "render").length, 2);
  const webpage = await Deno.readTextFile(
    join(root, "_site/a/slides/index.html"),
  );
  assert(
    webpage.includes('href="talk.html#/sec-slide"'),
    "nested local Reveal link was not resolved",
  );
  const talk = await Deno.readTextFile(join(root, "_site/a/slides/talk.html"));
  assert(
    talk.includes('href="index.html#sec-web"'),
    "reverse web link was not resolved",
  );
  assert(
    !(await Deno.readTextFile(join(root, "_site/index.html"))).includes(
      "qrc-unresolved",
    ),
    "root link unresolved",
  );
  const catalog = JSON.parse(
    await Deno.readTextFile(join(root, "_site/reference-catalog.json")),
  );
  assertEquals(catalog.targets["talk:sec-slide"].page, "a/slides/talk.html");
  let pdf = false;
  try {
    await Deno.stat(join(root, "_site/a/slides/index.pdf"));
    pdf = true;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  assert(!pdf, "web composition rendered PDF");
  console.log(
    "PASS PDF-first web selection, nested QRC outputs, circular HTML/Reveal links and one body render per document",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
