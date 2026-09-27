import type { Target } from "../domain/model.ts";
import { assemble, resolve } from "../domain/catalog.ts";
import { href } from "../domain/urls.ts";
import type { Page } from "./pages.ts";
import { attr, escape, inner, replace, type Edit } from "./html.ts";
export function linkPages(pages: Page[], revealScript: string, imports: Target[] = [], externalCss = ""): { pages: Map<string, string>; targets: Map<string, Target>; links: number } {
  const targets = assemble([...pages.flatMap((p) => p.targets), ...imports]);
  const result = new Map<string, string>();
  let links = 0;
  for (const page of pages) {
    const edits: Edit[] = [];
    let externalStyle = false;
    for (const node of page.nodes) {
      const key = attr(node, "data-qrc-ref");
      if (!key) continue;
      if (node.tagName !== "a") throw new Error(`QRC invalid link markup in ${page.path}`);
      const target = resolve(targets, key, page.path);
      const requestedStyle = attr(node, "data-qrc-style");
      if (requestedStyle !== "default" && requestedStyle !== "number" && requestedStyle !== "title" && requestedStyle !== "external") throw new Error(`QRC invalid reference style in ${page.path}`);
      const style = requestedStyle === "default" ? target.defaultStyle ?? "default" : requestedStyle;
      if (style === "external" && !target.baseUrl) throw new Error(`QRC external style requires an imported target: ${key}`);
      const custom = attr(node, "data-qrc-custom") === "true";
      if (style === "number" && !custom && !target.numberHtml) throw new Error(`QRC ${key} is unnumbered; use its title or explicit link text`);
      let label = custom ? inner(page.html, node) : style === "number" ? target.numberHtml
        : style === "title" || style === "external" ? escape(target.title ?? target.label) : target.labelHtml;
      const classes = new Set((attr(node, "class") ?? "").split(/\s+/).filter(Boolean));
      const rel = new Set((attr(node, "rel") ?? "").split(/\s+/).filter(Boolean));
      if (target.baseUrl) rel.add("external");
      if (style === "external") {
        externalStyle = true;
        classes.add("qrc-external");
        label = `<span class="qrc-title">${label}</span><span class="qrc-source"> — ${escape(target.sourceTitle || target.namespace)}</span><span class="qrc-external-marker" aria-hidden="true"> ↗</span>`;
      }
      const attributes = node.attrs.filter((a) => !["href", "class", "rel"].includes(a.name));
      if (classes.size) attributes.push({ name: "class", value: [...classes].join(" ") });
      if (rel.size) attributes.push({ name: "rel", value: [...rel].join(" ") });
      const attrs = attributes.map((a) => `${a.name}="${escape(a.value)}"`).join(" ");
      const loc = node.sourceCodeLocation!;
      edits.push({ start: loc.startOffset, end: loc.endOffset,
        value: `<a ${attrs} href="${escape(href(page.path, target))}">${label}</a>` });
      links++;
    }
    for (const probe of page.probes) {
      const loc = probe.sourceCodeLocation!;
      edits.push({ start: loc.startOffset, end: loc.endOffset, value: "" });
    }
    if (externalStyle && externalCss && !page.nodes.some((n) => attr(n, "data-qrc-external-style") !== undefined)) {
      const head = page.nodes.find((n) => n.tagName === "head")?.sourceCodeLocation?.endTag;
      if (head) edits.push({ start: head.startOffset, end: head.startOffset, value: `<style data-qrc-external-style>${externalCss}</style>\n` });
    }
    if (page.reveal) {
      const body = page.nodes.find((n) => n.tagName === "body")?.sourceCodeLocation?.endTag;
      if (!body) throw new Error(`QRC missing HTML body in ${page.path}`);
      edits.push({ start: body.startOffset, end: body.startOffset, value: `<script data-qrc-navigation>${revealScript}</script>\n` });
    }
    result.set(page.path, replace(page.html, edits));
  }
  return { pages: result, targets, links };
}
