import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "course-site-local-" }),
  quarto = Deno.env.get("QUARTO") || "quarto";
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
  const text = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  assert(result.success, text);
  return text;
}
await write(
  "_quarto.yml",
  `project:
  type: website
  output-dir: _site
  render: [index.qmd, about.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
filters: [reference-catalog]
reference-catalog: {namespace: portal}
subprojects: [part]
`,
);
await write("index.qmd", "# Root\n\n@part:sec-later\n");
await write("about.qmd", "# About\n");
// Deliberately invalid component: a selected root page must not render it.
await write(
  "part/_quarto.yml",
  "project:\n  type: website\n  pre-render: missing-script.ts\n",
);
await run(["add", repo, "--no-prompt"]);
await run([
  "add",
  Deno.env.get("QRC_PROVIDER") ||
  join(dirname(repo), "quarto-reference-catalog"),
  "--no-prompt",
]);
const log = await run(["render", "index.qmd"]);
assert(
  log.includes("отложено ссылок: 1"),
  "selected root did not use local QRC finalization",
);
assert(
  (await Deno.readTextFile(join(root, "_site/index.html"))).includes(
    'data-qrc-deferred="true"',
  ),
  "local deferred reference missing",
);
console.log(
  "PASS selected root local scope skips composition and defers unresolved QRC references",
);
