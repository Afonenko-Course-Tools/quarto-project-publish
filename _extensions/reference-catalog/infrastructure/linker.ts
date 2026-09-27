import type { Target } from "../domain/model.ts";
import { assemble, resolve } from "../domain/catalog.ts";
import { href } from "../domain/urls.ts";
import type { Page } from "./pages.ts";
import { attr, escape, inner, replace, type Edit } from "./html.ts";
export function linkPages(pages: Page[], navigationScript: string, imports: Target[] = []): { pages: Map<string, string>; targets: Map<string, Target>; links: number } {
  const targets = assemble([...pages.flatMap((p) => p.targets), ...imports]);
  const result = new Map<string, string>();
  let links = 0;
  for (const page of pages) {
    const edits: Edit[] = [];
    for (const node of page.nodes) {
      const key = attr(node, "data-qrc-ref");
      if (!key) continue;
      if (node.tagName !== "a") throw new Error(`QRC invalid link markup in ${page.path}`);
      const target = resolve(targets, key, page.path);
      const style = attr(node, "data-qrc-style");
      if (style !== "default" && style !== "number") throw new Error(`QRC invalid reference style in ${page.path}`);
      const custom = attr(node, "data-qrc-custom") === "true";
      if (style === "number" && !custom && !target.numberHtml) throw new Error(`QRC ${key} is unnumbered; use its title or explicit link text`);
      const label = custom ? inner(page.html, node) : style === "number" ? target.numberHtml : target.labelHtml;
      const attrs = node.attrs.filter((a) => a.name !== "href").map((a) => `${a.name}="${escape(a.value)}"`).join(" ");
      const loc = node.sourceCodeLocation!;
      edits.push({ start: loc.startOffset, end: loc.endOffset,
        value: `<a ${attrs} href="${escape(href(page.path, target))}">${label}</a>` });
      links++;
    }
    for (const probe of page.probes) {
      const loc = probe.sourceCodeLocation!;
      edits.push({ start: loc.startOffset, end: loc.endOffset, value: "" });
    }
    // HTML hashes can address objects inside native disclosures too. Preserve
    // copied HTML fragments/static resources that have no explicit body end.
    const body = page.nodes.find((n) => n.tagName === "body")?.sourceCodeLocation?.endTag;
    if (!body && page.reveal) throw new Error(`QRC missing HTML body in ${page.path}`);
    if (body) {
      // A portal can reuse its previous output, including our owned script.
      // Replace it on each build rather than accumulating event listeners.
      for (const script of page.nodes.filter(n => n.tagName === "script" && attr(n, "data-qrc-navigation") !== undefined)) {
        const loc = script.sourceCodeLocation!;
        edits.push({ start: loc.startOffset, end: loc.endOffset, value: "" });
      }
      edits.push({ start: body.startOffset, end: body.startOffset, value: `<script data-qrc-navigation>${navigationScript}</script>\n` });
    }
    result.set(page.path, replace(page.html, edits));
  }
  return { pages: result, targets, links };
}
