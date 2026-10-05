import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "course-site-formats-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[]) {
  const result = await new Deno.Command(quarto, {
    args,
    cwd: root,
    env: { QUARTO: quarto },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    result.success,
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
}
await write(
  "_quarto.yml",
  `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
course-site:
  projects:
    - {id: book, path: book, format: html, mount: book}
    - {id: slides, path: slides, format: revealjs, mount: slides}
`,
);
await write("index.qmd", "# Native formats\n");
await write(
  "book/_quarto.yml",
  `project:
  type: book
  output-dir: _book
  post-render: ../_extensions/course-site/entrypoints/collect.ts
book:
  title: Native Book
  chapters: [index.qmd, chapter.qmd]
format: html
`,
);
await write("book/index.qmd", "# Welcome\n");
await write("book/chapter.qmd", "# Native Chapter\n");
await write(
  "slides/_quarto.yml",
  `project:
  type: default
  output-dir: _slides
  render: [talk.qmd]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: revealjs
`,
);
await write(
  "slides/talk.qmd",
  "# Native Talk\n\n## Visible Slide\n\nSlide content\n",
);
await run(["add", repo, "--no-prompt"]);
await run(["render"]);
await run(["render"]);
const chapter = await Deno.readTextFile(join(root, "_site/book/chapter.html"));
assert(
  chapter.includes("Native Chapter") && chapter.includes("index.html"),
  "native book chapter/navigation missing",
);
const talk = await Deno.readTextFile(join(root, "_site/slides/talk.html"));
assert(
  talk.includes("Visible Slide") && talk.includes("reveal.js"),
  "native reveal output missing",
);
const script = Array.from(talk.matchAll(/src="([^"]*reveal\.js)"/g))[0]?.[1];
assert(script, "reveal library URL absent");
assert(
  (await Deno.stat(join(root, "_site/slides", script))).isFile,
  "mounted reveal library missing",
);
console.log(
  `PASS installed native book and Reveal mounted outputs/assets: ${root}`,
);
