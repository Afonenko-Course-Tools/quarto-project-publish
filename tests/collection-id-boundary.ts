import { collect } from "../_extensions/course-site/infrastructure/collection.ts";
import { assertRejects } from "./support.ts";
const root = await Deno.makeTempDir({ prefix: "site-collection-id-" }),
  cwd = Deno.cwd();
const names = [
  "COURSE_SITE_COLLECTION",
  "COURSE_SITE_PROJECT",
  "QUARTO_PROJECT_OUTPUT_DIR",
  "QUARTO_PROJECT_OUTPUT_FILES",
  "QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES",
];
const previous = new Map(names.map((name) => [name, Deno.env.get(name)]));
try {
  await Deno.mkdir(root + "/_site");
  await Deno.writeTextFile(root + "/_site/page.html", "<html><body>Текущая страница</body></html>");
  Deno.chdir(root);
  Deno.env.set("COURSE_SITE_COLLECTION", root + "/collection.json");
  Deno.env.delete("COURSE_SITE_PROJECT");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_DIR", "_site");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "_site/page.html");
  Deno.env.delete("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES");
  Deno.env.delete("COURSE_SITE_COLLECTION");
  await collect(); // Standalone navigation не требует collection/project id.
  Deno.env.set("COURSE_SITE_COLLECTION", root + "/collection.json");
  await assertRejects(() => collect(), "SITE.COLLECTION_INVALID");
} finally {
  Deno.chdir(cwd);
  for (const [name, value] of previous) {
    if (value === undefined) Deno.env.delete(name);
    else Deno.env.set(name, value);
  }
  await Deno.remove(root, { recursive: true });
}
console.log("PASS collection требует собственный текущий project id");
