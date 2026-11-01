import assert from "node:assert/strict";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const provider = Deno.env.get("CORE") || join(dirname(repo), "quarto-course");
const root = await Deno.makeTempDir({ prefix: "site-composed-navigation-" });
const cli = Deno.env.get("QUARTO") || "quarto";
async function write(path: string, value: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), value);
}
async function run(args: string[], cwd = root) {
  const result = await new Deno.Command(cli, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert.equal(
    result.code,
    0,
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
}
try {
  await write(
    "_quarto.yml",
    `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  resources: ['!theory/**', '!slides/**']
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: course-theme-html
lang: ru
website:
  title: Общий курс
  navbar: {}
filters: [course-navigation]
course-navigation: {enabled: true}
subprojects: [theory, slides, handout]
`,
  );
  await write("index.qmd", "# Портал\n");
  await write(
    "theory/_quarto.yml",
    `project:
  type: website
  output-dir: _output
  render: [index.qmd, nested/chapter.qmd]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: course-theme-html
lang: ru
website: {title: Теория, navbar: {}}
filters: [course-navigation]
course-navigation: {enabled: true}
`,
  );
  await write("theory/index.qmd", "# Теория\n");
  await write("theory/nested/chapter.qmd", "# Вложенная глава\n");
  await write(
    "slides/_quarto.yml",
    `project:
  type: website
  output-dir: _output
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: course-theme-html
lang: ru
website: {title: Занятия, navbar: {}}
filters: [course-navigation]
course-navigation: {enabled: true}
`,
  );
  await write("slides/index.qmd", "# Занятия\n\n[Презентация](lesson.qmd)\n");
  await write(
    "slides/lesson.qmd",
    "---\ntitle: Презентация\nformat: revealjs\nrevealjs-plugins: [course-navigation]\nrepo-url: https://github.com/example/course\nrepo-actions: [source]\n---\n\n## Первый слайд\n\nМатериал.\n",
  );
  await write(
    "handout/_quarto.yml",
    "project:\n  type: default\n  output-dir: _output\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nformat: typst\nlang: ru\n",
  );
  await write("handout/index.qmd", "# Печатные материалы\n\nДополнение.\n");
  for (const scope of ["", "theory", "slides", "handout"]) {
    await run(["add", provider, "--no-prompt"], join(root, scope));
    for (const profile of ["student", "full"]) {
      await write(
        (scope ? scope + "/" : "") + "_quarto-" + profile + ".yml",
        "project:\n  output-dir: " + (scope ? "_output-" : "_site-") + profile +
          "\n",
      );
    }
  }
  await run(["add", repo, "--no-prompt"]);
  for (const profile of ["student", "full"]) {
    await run(["render", "--profile", profile, "--fail-if-warnings"]);
    const output = join(root, "_site-" + profile);
    const chapter = await Deno.readTextFile(
      join(output, "theory/nested/chapter.html"),
    );
    assert.ok(
      chapter.includes('data-course-link="root"'),
      "Site передаёт состав курса в Navigation",
    );
    assert.ok(chapter.includes('href="../../slides/"'));
    const deck = await Deno.readTextFile(join(output, "slides/lesson.html"));
    assert.ok(deck.includes('"href":"../theory/"'));
    assert.ok(
      deck.includes('"scope":"repository"'),
      "Ссылки репозитория сохранены",
    );
    assert.ok(
      !chapter.includes('id="course-site-navigation"'),
      "Готовое меню не требует перебазирования браузером",
    );
    const index = await Deno.readTextFile(join(output, "slides/index.html"));
    assert.ok(/href="[^\"]*lesson.html"[^>]*target="_blank"/.test(index));
  }
  await run(
    ["render", "--profile", "student", "--fail-if-warnings"],
    join(root, "theory"),
  );
  const standalone = await Deno.readTextFile(
    join(root, "theory/_output-student/index.html"),
  );
  assert.ok(
    !standalone.includes('data-course-link="root"'),
    "Standalone не создаёт меню всей композиции",
  );
  const browser = await new Deno.Command("node", {
    args: [join(repo, "tests/site-composed-navigation.browser.cjs"), root],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  assert.equal(browser.code, 0);
  console.log(
    "PASS установленная композиция Navigation/Site: student/full, HTML/Reveal, вложенность и standalone",
  );
} finally {
  if (Deno.env.get("COURSE_SITE_COMPOSITION_KEEP")) {
    console.log("Fixture:", root);
  } else await Deno.remove(root, { recursive: true });
}
