import { readPage } from "../_extensions/reference-catalog/infrastructure/pages.ts";
import { linkPages } from "../_extensions/reference-catalog/infrastructure/linker.ts";

// Publication, not a particular course renderer, must install target opening.
const html = '<html><body><details><summary>Answer</summary><div id="sol-answer">42</div></details></body></html>';
const page = readPage("index.html", html);
const linked = linkPages([page], "/* generic target navigation */").pages.get("index.html")!;
if (!linked.includes('<script data-qrc-navigation>/* generic target navigation */</script>'))
  throw new Error("HTML pages must receive target navigation, not only Revealjs");
if (!linked.includes('<div id="sol-answer">42</div>'))
  throw new Error("Navigation must not replace native target IDs or disclosures");
if (linked.match(/data-qrc-navigation/g)?.length !== 1)
  throw new Error("Install navigation exactly once per publication");

const republished = linkPages([readPage("index.html", linked)], "/* updated navigation */").pages.get("index.html")!;
if (republished.match(/data-qrc-navigation/g)?.length !== 1 || !republished.includes("/* updated navigation */") || republished.includes("/* generic target navigation */"))
  throw new Error("Republishing must replace the owned script, not duplicate it");

for (const resource of ["<html><body><p>static", "<p>HTML teaching fragment</p>"]) {
  const preserved = linkPages([readPage("assets/example.html", resource)], "/* navigation */").pages.get("assets/example.html");
  if (preserved !== resource) throw new Error("Preserve static HTML resources without an explicit body end");
}
console.log("PASS navigation publication: HTML injection, native IDs, replacement on republish, static HTML resources");
