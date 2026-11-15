import { loadSite } from "./results.ts";
import { strict as assert } from "node:assert";
import { cp } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Копируется только устанавливаемое расширение: без node_modules и sibling owners.
const root = await Deno.makeTempDir({ prefix: "site-installed-navigation-" });
try {
  const extension = `${root}/_extensions/course-site`;
  await cp(new URL("../_extensions/course-site/", import.meta.url), extension, {
    recursive: true,
  });
  const { addressNavigation } = await loadSite(
    "navigation",
    pathToFileURL(`${extension}/infrastructure/navigation.ts`).href,
  );
  const output = `${root}/_site`;
  await Deno.mkdir(`${output}/units/slides`, { recursive: true });
  await Deno.writeTextFile(
    `${output}/index.html`,
    '<html><body><a href="units/slides/talk.html?view=1#second">Доклад</a></body></html>',
  );
  await Deno.writeTextFile(
    `${output}/units/slides/talk.html`,
    `<html><body><div class=reveal data-title="a > b"></div><script>Reveal.initialize({});</script><script type='application/json' id=course-navigation-context>{"links":[{"scope":"course","path":"index.html?view=1#start","href":"https://old.example/course/"}]}</script></body></html>`,
  );
  await addressNavigation(output, [`${output}/index.html`, `${output}/units/slides/talk.html`], true);
  assert.match(
    await Deno.readTextFile(`${output}/index.html`),
    /const\s+targets\s*=\s*\["units\/slides\/talk\.html"\]/,
  );
  assert.ok(
    (await Deno.readTextFile(`${output}/units/slides/talk.html`)).includes('"href":"../../index.html?view=1#start"'),
  );
  console.log("PASS установленная копия course-site: локальные parse5/entities, без node_modules и sibling extensions");
} finally {
  await Deno.remove(root, { recursive: true });
}
