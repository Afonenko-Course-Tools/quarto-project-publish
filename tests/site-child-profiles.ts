import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const mode = Deno.args[0] || "default";
const root = await Deno.makeTempDir({ prefix: `course-site-child-${mode}-` });
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function run(args: string[], cwd = root) {
  const result = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args,
    cwd,
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
    "project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-site/entrypoints/pre.ts\n  post-render: _extensions/course-site/entrypoints/post.ts\nformat: html\nsubprojects: [plain, core]\n",
  );
  await write("index.qmd", "# Root\n");
  for (const part of ["plain", "core"]) {
    const core = part === "core";
    await write(
      `${part}/_quarto.yml`,
      `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n${
        core ? "  pre-render: _extensions/course-core/entrypoints/pre.ts\n" : ""
      }  post-render:\n${
        core ? "    - _extensions/course-core/entrypoints/post.ts\n" : ""
      }    - ../_extensions/course-site/entrypoints/collect.ts\nformat: html\n${
        mode === "default"
          ? "profile:\n  default: full\n"
          : "profile:\n  group:\n    - [web, print]\n    - [content, alternate]\n"
      }${core ? "filters: [course-core]\ncourse: {id: lesson}\n" : ""}`,
    );
    await write(
      `${part}/index.qmd`,
      "# Lesson\n\n::: {.content-visible when-profile=content}\nGROUP_CONTENT\n:::\n",
    );
    await write(
      `${part}/_quarto-full.yml`,
      `project:\n  output-dir: _site-full\n${
        core ? "course: {view: full}\n" : ""
      }`,
    );
    await write(
      `${part}/_quarto-student.yml`,
      `project:\n  output-dir: _site-student\n${
        core ? "course: {view: student}\n" : ""
      }`,
    );
    if (mode === "group") {
      await write(
        `${part}/_quarto-web.yml`,
        `format: html\n${core ? "course: {view: student}\n" : ""}`,
      );
    }
  }
  await run(["add", repo, "--no-prompt"]);
  const provider = Deno.env.get("COURSE_CORE_PROVIDER") ||
    join(dirname(repo), "quarto-course");
  for (const cwd of [root, join(root, "core")]) {
    await run(["add", provider, "--no-prompt"], cwd);
  }
  await run(["render", "--fail-if-warnings"]);
  for (const part of ["plain", "core"]) {
    const html = await Deno.readTextFile(
      join(root, `_site/${part}/index.html`),
    );
    if (mode === "group") {
      assert(
        html.includes("GROUP_CONTENT"),
        "content-only native group profile missing",
      );
    }
  }
  const profiles = mode === "default" ? ["full"] : ["web", "content"];
  let releases = 0, collections = 0;
  const runs = join(root, "_generated/course-site/runs");
  for await (const directory of Deno.readDir(runs)) {
    for await (const entry of Deno.readDir(join(runs, directory.name))) {
      if (entry.name.endsWith("-0.json")) {
        const collection = JSON.parse(
          await Deno.readTextFile(join(runs, directory.name, entry.name)),
        );
        assertEquals(collection.profiles, profiles);
        collections++;
      }
      if (entry.name.endsWith("-release.json")) {
        const release = JSON.parse(
          await Deno.readTextFile(join(runs, directory.name, entry.name)),
        );
        assertEquals(release.documents[0].document.profiles, profiles);
        releases++;
      }
    }
  }
  assertEquals(collections, 2);
  assertEquals(releases, 1);
  console.log(
    `PASS native child ${mode} profiles: audience safety, mounted output, collection and Core release`,
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
