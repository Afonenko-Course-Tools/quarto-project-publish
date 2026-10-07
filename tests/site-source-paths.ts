import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-site-source-paths-" });
const external = await Deno.makeTempFile({ suffix: ".qmd" });
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[]) {
  return await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args,
    cwd: root,
    env: { QUARTO_PROFILE: "", COURSE_BUILD_TRACE: join(root, "trace.jsonl") },
    stdout: "piped",
    stderr: "piped",
  }).output();
}
try {
  await write(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nsubprojects: [part]\n",
  );
  await write("index.qmd", "# Root\n");
  await write(
    "part/_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nformat: html\n",
  );
  await Deno.writeTextFile(external, "# EXTERNAL_SOURCE\n");
  await Deno.symlink(external, join(root, "part/index.qmd"));
  await write("_site/sentinel.txt", "retain root");
  await write("part/_site/sentinel.txt", "retain child");
  assert((await run(["add", repo, "--no-prompt"])).success);
  // Retain the root's output through Quarto's own pre-hook cleanup so this
  // assertion isolates Publisher's all-member validation before its cleanup.
  const result = await run(["render", "--no-clean"]);
  const text = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  assert(
    !result.success && text.includes("SITE.SUBPROJECT_INVALID") &&
      text.includes("index.qmd") && text.includes("input"),
    `external QMD was not rejected: ${text}`,
  );
  assertEquals(
    await Deno.readTextFile(join(root, "_site/sentinel.txt")),
    "retain root",
  );
  assertEquals(
    await Deno.readTextFile(join(root, "part/_site/sentinel.txt")),
    "retain child",
  );
  const trace = (await Deno.readTextFile(join(root, "trace.jsonl"))).trim()
    .split("\n").map((line) => JSON.parse(line));
  assertEquals(trace.filter((row) => row.kind === "render").length, 0);
  assert(
    !trace.some((row) =>
      row.kind === "inspect" && row.args[1] === join(root, "part/index.qmd")
    ),
    "unsafe document passed to native inspect",
  );
  console.log(
    "PASS explicit QMD symlink rejected without Core before cleanup, document inspect and child render",
  );
} finally {
  await Deno.remove(root, { recursive: true });
  await Deno.remove(external);
}
