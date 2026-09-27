import type { ReferenceStyle, Target } from "../_extensions/reference-catalog/domain/model.ts";
import { attr, content, elements, hasClass, parseHtml } from "../_extensions/reference-catalog/infrastructure/html.ts";
import { linkPages } from "../_extensions/reference-catalog/infrastructure/linker.ts";
import { readPage } from "../_extensions/reference-catalog/infrastructure/pages.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function reject(action: () => unknown, message: string) {
  try { action(); } catch (error) {
    assert(error instanceof Error && error.message.includes(message), String(error));
    return;
  }
  throw new Error(`Expected rejection: ${message}`);
}
const imported: Target = {
  namespace: "os", id: "sec-memory", page: "chapters/memory.html", fragment: "sec-memory",
  labelHtml: "Chapter&nbsp;7", numberHtml: "7", label: "Chapter 7", number: "7",
  title: "Memory & <storage>", sourceTitle: "Operating systems <2026>",
  baseUrl: "https://example.edu/courses/os/", defaultStyle: "external",
};
function link(style: ReferenceStyle, custom = "", extra = "") {
  return `<a class="qrc-link author-class" ${extra} href="#qrc-unresolved" data-qrc-ref="os:sec-memory" data-qrc-style="${style}" data-qrc-custom="${!!custom}">${custom || "os:sec-memory"}</a>`;
}
function render(body: string, target = imported, head = true) {
  const html = head ? `<html><head><title>Java</title></head><body>${body}</body></html>` : body;
  return linkPages([readPage("book/index.html", html)], "", [target], ".qrc-source{opacity:.8}").pages.get("book/index.html")!;
}

// A numbered native label must remain available independently of a plain title.
const probeHtml = `<h1 id="sec-memory">7 Memory &amp; storage</h1>
<div class="qrc-probes" data-qrc-namespace="book">
<div class="qrc-probe" data-qrc-id="sec-memory" data-qrc-style="default" data-qrc-title="Memory &amp; storage"><a class="quarto-xref" href="#sec-memory">Chapter&nbsp;7</a></div>
<div class="qrc-probe" data-qrc-id="sec-memory" data-qrc-style="number"><a class="quarto-xref" href="#sec-memory">7</a></div></div>`;
const extracted = readPage("book/index.html", probeHtml).targets[0];
assert(extracted.title === "Memory & storage", "readPage lost or failed to decode the AST title");
assert(extracted.number === "7" && extracted.labelHtml === "Chapter&nbsp;7", "Title capture changed native labels");

const external = render(link("default") + link("external", "<em>Read more &amp; compare</em>", 'rel="author"'));
const externalNodes = elements(parseHtml(external));
const anchors = externalNodes.filter(n => n.tagName === "a");
assert(anchors.length === 2 && anchors.every(n => hasClass(n, "qrc-external") && hasClass(n, "author-class")), "Import style or author classes were lost");
assert(anchors.every(n => attr(n, "href") === "https://example.edu/courses/os/chapters/memory.html#sec-memory"), "Imported URL lost the publication prefix");
assert(anchors.every(n => !attr(n, "target") && attr(n, "rel")?.includes("external")), "Imported links need rel=external without forcing a new tab");
assert(attr(anchors[1], "rel") === "author external", "Existing rel tokens were lost");
assert(external.includes("Memory &amp; &lt;storage&gt;") && external.includes("Operating systems &lt;2026&gt;"), "Title/source metadata was not escaped");
assert(external.includes("<em>Read more &amp; compare</em>"), "Custom rich link text was changed");
assert(externalNodes.filter(n => n.tagName === "style" && attr(n, "data-qrc-external-style") !== undefined).length === 1, "External CSS was not injected once");

const number = render(link("number"));
assert(content(elements(parseHtml(number)).find(n => n.tagName === "a")!) === "7", "Explicit number did not override import style");
assert(!number.includes("data-qrc-external-style"), "CSS was injected without an external-style link");
const title = render(link("title"));
assert(content(elements(parseHtml(title)).find(n => n.tagName === "a")!) === imported.title, "Explicit title did not override import style");
assert(!title.includes("qrc-source"), "Title style unexpectedly appended the publication title");
const legacy: Target = { ...imported, title: undefined, sourceTitle: undefined };
const fallback = render(link("external"), legacy);
assert(fallback.includes('class="qrc-title">Chapter 7</span>') && fallback.includes('class="qrc-source"> — os</span>'), "Schema-2 title and publication fallbacks failed");
const native = render(link("default"), { ...imported, defaultStyle: undefined });
assert(native.includes("Chapter&nbsp;7") && !native.includes('class="qrc-source"'), "The existing default label behavior changed");

const reveal = render(link("external"), { ...imported, page: "lectures/memory.html", fragment: "fig-layout", slide: "sec-memory" });
assert(reveal.includes('href="https://example.edu/courses/os/lectures/memory.html?qrc-target=fig-layout#/sec-memory"'), "External Revealjs destination lost its object/slide navigation");
assert(!render(link("external"), imported, false).includes("<style"), "CSS was inserted into a fragment without a real head");
reject(() => render(link("external"), { ...imported, baseUrl: undefined }), "external style requires an imported target");
reject(() => render(link("number"), { ...imported, number: "", numberHtml: "" }), "is unnumbered");
console.log("PASS link styles: AST title extraction, title/number overrides, schema-2 fallback, rich custom labels, escaped source titles, external metadata, Revealjs URLs and scoped CSS");
