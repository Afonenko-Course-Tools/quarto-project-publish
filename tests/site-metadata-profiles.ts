import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({
  prefix: "course-site-metadata-profiles-",
});
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[]) {
  const result = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args,
    cwd: root,
    env: { QUARTO_PROFILE: "" },
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
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nsubprojects: [part]\n",
  );
  await write("index.qmd", "# Root\n");
  await write(
    "part/index.qmd",
    "# Child\n\n::: {.content-visible when-profile=full}\nFULL_PROFILE_CONTENT\n:::\n",
  );
  await write("part/_quarto-shared.yml", "format: html\n");
  await write("part/_quarto-full.yml", "project:\n  output-dir: _site-full\n");
  await write(
    "part/_quarto-student.yml",
    "project:\n  output-dir: _site-student\n",
  );
  await run(["add", repo, "--no-prompt"]);
  for (const include of ["shared", "full"]) {
    await write(
      "part/_quarto.yml",
      `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nmetadata-files: [_quarto-${include}.yml]\nformat: html\n`,
    );
    await run(["render", "--fail-if-warnings"]);
    const html = await Deno.readTextFile(join(root, "_site/part/index.html"));
    assert(
      !html.includes("FULL_PROFILE_CONTENT"),
      "metadata include activated a content profile",
    );
  }
  let collections = 0;
  const runs = join(root, "_generated/course-site/runs");
  for await (const directory of Deno.readDir(runs)) {
    for await (const entry of Deno.readDir(join(runs, directory.name))) {
      if (!entry.name.endsWith("-0.json")) continue;
      const collection = JSON.parse(
        await Deno.readTextFile(join(runs, directory.name, entry.name)),
      );
      assertEquals(collection.profiles, []);
      collections++;
    }
  }
  assertEquals(collections, 2);
  console.log(
    "PASS native metadata-files sharing profile filenames, audience outputs and exact empty runtime profiles",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
