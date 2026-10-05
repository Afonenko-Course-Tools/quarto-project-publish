import { assertEquals, assertRejects } from "./support.ts";
import {
  collect,
  readCollection,
} from "../_extensions/course-site/infrastructure/collection.ts";
import { cleanOutput } from "../_extensions/course-site/infrastructure/files.ts";
import { post } from "../_extensions/course-site/application/compose.ts";
const root = await Deno.makeTempDir();
const cwd = Deno.cwd();
try {
  await Deno.mkdir(`${root}/_site`);
  await Deno.writeTextFile(`${root}/_site/index.html`, "current");
  Deno.chdir(root);
  Deno.env.set("COURSE_SITE_COLLECTION", `${root}/record.json`);
  Deno.env.set("COURSE_SITE_PROJECT", "one");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_DIR", "_site");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "_site/index.html");
  Deno.env.delete("QUARTO_PROFILE");
  await collect();
  const record = await readCollection(
    `${root}/record.json`,
    "one",
    root,
    `${root}/_site`,
    [],
  );
  assertEquals(record.nativeOutputs, [`${root}/_site/index.html`]);
  await Deno.remove(`${root}/_site/index.html`);
  await assertRejects(() =>
    readCollection(`${root}/record.json`, "one", root, `${root}/_site`, [])
  );
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "../outside.html");
  await assertRejects(() => collect());
  await Deno.writeTextFile(`${root}/_site/source.qmd`, "author source");
  await assertRejects(() => cleanOutput(root, `${root}/_site`));
  assertEquals(
    await Deno.readTextFile(`${root}/_site/source.qmd`),
    "author source",
  );
  await Deno.remove(`${root}/_site/source.qmd`);
  await Deno.mkdir(`${root}/_site/lessons`);
  await Deno.writeTextFile(`${root}/_site/lessons/author.txt`, "root resource");
  await Deno.writeTextFile(`${root}/_site/index.html`, "root HTML");
  await Deno.mkdir(`${root}/_generated/course-site`, { recursive: true });
  await Deno.writeTextFile(
    `${root}/_generated/course-site/active.json`,
    JSON.stringify({
      ws: { root, output: `${root}/_site`, config: {}, profiles: [] },
      run: `${root}/run`,
      records: [{
        project: { id: "part", mount: "lessons" },
        config: {},
        record: {
          outputDir: `${root}/part/_site`,
          files: [],
          nativeOutputs: [],
        },
      }],
    }),
  );
  Deno.env.set("QUARTO_PROJECT_RENDER_ALL", "1");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "_site/index.html");
  await assertRejects(() => post(root));
  assertEquals(
    await Deno.readTextFile(`${root}/_site/lessons/author.txt`),
    "root resource",
  );
  console.log(
    "PASS missing current outputs, containment and source-preserving cleanup",
  );
} finally {
  Deno.chdir(cwd);
  await Deno.remove(root, { recursive: true });
}
