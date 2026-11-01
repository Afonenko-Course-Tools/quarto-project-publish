import { assert, assertRejects } from "./support.ts";
import * as config from "../_extensions/course-site/infrastructure/config.ts";
import { pre } from "../_extensions/course-site/application/compose.ts";
assert(
  typeof (config as any).validateAudienceOutputs === "function",
  "native audience output isolation is missing",
);
const root = await Deno.makeTempDir();
try {
  await Deno.writeTextFile(
    `${root}/_quarto.yml`,
    "project:\n  type: website\n  output-dir: _site\n",
  );
  await Deno.writeTextFile(`${root}/index.qmd`, "# Root\n");
  await Deno.writeTextFile(
    `${root}/_quarto-student.yml`,
    "project:\n  output-dir: _site-shared\n",
  );
  await Deno.writeTextFile(
    `${root}/_quarto-full.yml`,
    "project:\n  output-dir: _site-shared\n",
  );
  await assertRejects(() =>
    (config as any).validateAudienceOutputs(
      root,
      ["student"],
      `${root}/_site-shared`,
    )
  );
  await assertRejects(() =>
    config.validateAudienceOutputs(root, [], `${root}/_site`)
  );
  await Deno.writeTextFile(
    `${root}/_quarto-full.yml`,
    "project:\n  output-dir: _site-full\n",
  );
  await (config as any).validateAudienceOutputs(
    root,
    ["student"],
    `${root}/_site-shared`,
  );
  await config.validateAudienceOutputs(root, [], `${root}/_site-full`);
  await assertRejects(() =>
    config.validateAudienceOutputs(root, [], `${root}/_site-full/nested`)
  );
  await Deno.writeTextFile(`${root}/_quarto-web.yml`, "format: html\n");
  // Согласованная native проекция должна следовать реальной аудитории, даже без Core в root.
  // Удаление preflight guard пропускает эти противоречивые реальные настройки.
  for (
    const [profiles, view, projection, expected, field] of [
      [["student"], "full", undefined, undefined, "course.view"],
      [["full"], "student", undefined, undefined, "course.view"],
      [["student"], "student", "author", undefined, "course-core-projection"],
      [["full"], "full", "student", undefined, "course-core-projection"],
      [["web"], "student", "author", undefined, "course-core-projection"],
      [["web"], "full", "student", undefined, "course-core-projection"],
      [["web"], "full", "author", "student", "course.view"],
      [["web"], "student", "student", "full", "course.view"],
    ] as const
  ) {
    await assertRejects(
      () =>
        (config as any).validateAudienceOutputs(
          root,
          [...profiles],
          `${root}/_site-shared`,
          view,
          projection,
          expected,
        ),
      "SITE.AUDIENCE_MISMATCH",
      [root, field],
    );
  }
  for (
    const [profiles, view, projection, selected] of [
      [["student"], "student", "student", "_site-shared"],
      [["full"], "full", "author", "_site-full"],
      [["web"], "student", "student", "_site-shared"],
      [["web"], "full", "author", "_site-full"],
    ] as const
  ) {
    await (config as any).validateAudienceOutputs(
      root,
      [...profiles],
      `${root}/${selected}`,
      view,
      projection,
    );
  }
  await Deno.mkdir(`${root}/part`);
  await Deno.mkdir(`${root}/_site-shared/_downloads`, { recursive: true });
  await Deno.writeFile(
    `${root}/_site-shared/_downloads/keep.zip`,
    new Uint8Array([80, 75, 3, 4, 42]),
  );
  await Deno.writeTextFile(
    `${root}/_quarto.yml`,
    "project: {type: website, output-dir: _site}\nformat: html\nsubprojects: [part]\nfilters: [course-core]\ncourse: {id: guarded-root, view: full}\n",
  );
  const oldProfile = Deno.env.get("QUARTO_PROFILE"),
    oldAll = Deno.env.get("QUARTO_PROJECT_RENDER_ALL");
  try {
    Deno.env.set("QUARTO_PROFILE", "student");
    Deno.env.delete("QUARTO_PROJECT_RENDER_ALL");
    await assertRejects(() => pre(root), "SITE.AUDIENCE_MISMATCH", [
      root,
      "course.view",
    ]);
    const retained = await Deno.readFile(
      `${root}/_site-shared/_downloads/keep.zip`,
    );
    assert(
      retained.length === 5 &&
        retained.every((b, i) => b === [80, 75, 3, 4, 42][i]),
      "Selected-root refusal изменил previous ZIP",
    );
  } finally {
    if (oldProfile === undefined) Deno.env.delete("QUARTO_PROFILE");
    else Deno.env.set("QUARTO_PROFILE", oldProfile);
    if (oldAll === undefined) Deno.env.delete("QUARTO_PROJECT_RENDER_ALL");
    else Deno.env.set("QUARTO_PROJECT_RENDER_ALL", oldAll);
  }
  console.log(
    "PASS native inspect audience output isolation, view/projection agreement in both directions/custom profiles и selected-root refusal before cleanup",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
