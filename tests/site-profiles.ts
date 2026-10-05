import { assert, assertRejects } from "./support.ts";
import * as config from "../_extensions/course-site/infrastructure/config.ts";
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
  await Deno.writeTextFile(
    `${root}/_quarto-full.yml`,
    "project:\n  output-dir: _site-full\n",
  );
  await (config as any).validateAudienceOutputs(
    root,
    ["student"],
    `${root}/_site-shared`,
  );
  console.log("PASS native inspect rejects audience output collisions");
} finally {
  await Deno.remove(root, { recursive: true });
}
