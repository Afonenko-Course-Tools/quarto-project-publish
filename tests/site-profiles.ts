import { assert, assertEquals, assertRejects } from "./support.ts";
import * as config from "../_extensions/course-site/infrastructure/config.ts";
import { pre } from "../_extensions/course-site/application/compose.ts";
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
  // Согласованная native проекция должна следовать реальной аудитории, даже без Core в root.
  // Проверка активной аудитории не зависит от output невыбранного профиля.
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
      async () =>
        config.validateAudience(root, [...profiles], view, projection, expected),
      "SITE.AUDIENCE_MISMATCH",
      [root, field],
    );
  }
  for (
    const [profiles, view, projection, audience] of [
      [["student"], "student", "student", "student"],
      [["full"], "full", "author", "full"],
      [["web"], "student", "student", "student"],
      [["web"], "full", "author", "full"],
    ] as const
  ) {
    assertEquals(
      config.validateAudience(root, [...profiles], view, projection),
      audience,
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
    "project: {type: website, output-dir: _site}\nformat: html\nsubprojects: [{path: part, to: default}]\nfilters: [course-core]\ncourse: {id: guarded-root, view: full}\n",
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

    // Общий student/full output допустим; активный child mismatch всё ещё
    // обязан остановить композицию до cleanup обеих предыдущих выдач.
    await Deno.writeTextFile(
      `${root}/_quarto.yml`,
      "project: {type: website, output-dir: _site}\nformat: html\nsubprojects: [{path: part, to: default}]\ncourse-core-runtime: native-ts\ncourse: {id: guarded-root, view: student}\n",
    );
    await Deno.writeTextFile(`${root}/part/index.qmd`, "# Part\n");
    await Deno.writeTextFile(
      `${root}/part/_quarto.yml`,
      "project: {type: website, output-dir: _site-shared}\nformat: html\ncourse-core-runtime: native-ts\ncourse: {id: guarded-child, view: full}\n",
    );
    await Deno.mkdir(`${root}/part/_site-shared/_downloads`, { recursive: true });
    await Deno.writeFile(
      `${root}/part/_site-shared/_downloads/keep.zip`,
      new Uint8Array([80, 75, 3, 4, 43]),
    );
    Deno.env.set("QUARTO_PROJECT_RENDER_ALL", "1");
    await assertRejects(() => pre(root), "SITE.AUDIENCE_MISMATCH", [
      `${root}/part`,
      "course.view",
    ]);
    for (const [owner, lastByte] of [[root, 42], [`${root}/part`, 43]] as const) {
      const retained = await Deno.readFile(
        `${owner}/_site-shared/_downloads/keep.zip`,
      );
      assertEquals([...retained], [80, 75, 3, 4, lastByte]);
    }
  } finally {
    if (oldProfile === undefined) Deno.env.delete("QUARTO_PROFILE");
    else Deno.env.set("QUARTO_PROFILE", oldProfile);
    if (oldAll === undefined) Deno.env.delete("QUARTO_PROJECT_RENDER_ALL");
    else Deno.env.set("QUARTO_PROJECT_RENDER_ALL", oldAll);
  }
  console.log(
    "PASS выбранная audience, view/projection и custom profiles; root/child mismatch сохраняют ZIP до cleanup при общем student/full output (3 selected inspect, 0 render)",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
