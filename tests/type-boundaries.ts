import { validateConfig } from "../_extensions/course-site/infrastructure/config.ts";
import { readCollection } from "../_extensions/course-site/infrastructure/collection.ts";
import { assertRejects } from "./support.ts";

const root = await Deno.makeTempDir({ prefix: "site-type-boundaries-" });
try {
  await Deno.mkdir(`${root}/part`);
  await Deno.mkdir(`${root}/_site`);
  const base = { project: { type: "website", "output-dir": "_site" }, subprojects: ["part"] };
  for (const config of [null, [], { ...base, project: { type: "website", "output-dir": 12 } }]) {
    await assertRejects(() => validateConfig(root, config, []), "SITE.CONFIG_INVALID");
  }
  const collection = { id: "part", projectRoot: root, outputDir: `${root}/_site`, profiles: [], nativeOutputs: [], files: [] };
  for (const value of [null, [], { ...collection, files: [12] }, { ...collection, nativeOutputs: [null] }]) {
    await Deno.writeTextFile(`${root}/collection.json`, JSON.stringify(value));
    await assertRejects(() => readCollection(`${root}/collection.json`, "part", root, `${root}/_site`, []), "SITE.COLLECTION_INVALID");
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
console.log("PASS внешние config/collection отклоняют неверную форму до работы с путями");
