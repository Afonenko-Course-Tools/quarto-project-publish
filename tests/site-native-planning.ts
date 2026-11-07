import { join } from "stdlib/path";
import { inspectProject } from "../_extensions/course-site/infrastructure/config.ts";
import { assert, assertEquals } from "./support.ts";
const root = await Deno.makeTempDir({ prefix: "site-native-plan-" });
try {
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\nformat: html\nsubprojects: [child]\n",
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Корень\n");
  await Deno.writeTextFile(join(root, "unselected.qmd"), "# Отдельная страница\n");
  const project = await inspectProject(root, []);
  assertEquals(project.selectedSources, ["index.qmd"]);
  assert(project.config.project, "Native inspect должен вернуть project");
  assertEquals(project.config.project.type, "website");
  console.log("PASS native owner selected sources");
} finally {
  await Deno.remove(root, { recursive: true });
}
