import { record, text } from "./values.ts";
import { diagnostic } from "./diagnostics.ts";
import { createMetrics } from "../observability/bridge.ts";
const metrics = createMetrics("course-site");
import { dirname, relative, within } from "./files.ts";
// @deno-types="../vendor/parse5/dist/index.d.ts"
import {
  defaultTreeAdapter as tree,
  type DefaultTreeAdapterTypes,
  html as htmlNames,
  parse,
} from "../vendor/parse5/dist/index.js";

let browserProgram: Promise<string> | undefined;
function navigationProgram() {
  return browserProgram ??= Deno.readTextFile(new URL("../browser/navigation.js", import.meta.url));
}

function elements(
  node: DefaultTreeAdapterTypes.Node,
): DefaultTreeAdapterTypes.Element[] {
  const found: DefaultTreeAdapterTypes.Element[] = [];
  const visit = (current: DefaultTreeAdapterTypes.Node) => {
    if (
      tree.isElementNode(current) && current.namespaceURI === htmlNames.NS.HTML
    ) found.push(current);
    // Содержимое template инертно и находится в отдельном content, не в childNodes.
    if ("childNodes" in current) {
      for (const child of current.childNodes) visit(child);
    }
  };
  visit(node);
  return found;
}

function attribute(
  element: DefaultTreeAdapterTypes.Element,
  name: string,
): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

function scriptText(element: DefaultTreeAdapterTypes.Element): string {
  return element.childNodes.filter(tree.isTextNode).map((node) => node.value)
    .join("");
}

/** Адреса берутся только из текущих native HTML, без второй карты курса. */
async function addressNavigationImpl(
  stage: string,
  outputs: string[],
  composition = false,
  courseUrl?: string,
): Promise<void> {
  const html = new Map<string, {
    source: string;
    elements: DefaultTreeAdapterTypes.Element[];
  }>();
  for (const output of outputs) {
    within(stage, output);
    if (output.endsWith(".html") && !html.has(output)) {
      const source = await Deno.readTextFile(output);
      const document = parse(source, { sourceCodeLocationInfo: true });
      html.set(output, { source, elements: elements(document) });
    }
  }
  const presentations = [...html].filter(([, page]) =>
    page.elements.some((element) =>
      element.tagName === "div" &&
      attribute(element, "class")?.split(/[\t\n\f\r ]+/).includes("reveal")
    ) &&
    page.elements.some((element) =>
      element.tagName === "script" &&
      /Reveal\.initialize\s*\(/.test(scriptText(element))
    )
  ).map(([path]) => path);
  for (const [output, page] of html) {
    const edits: Array<{ start: number; end: number; text: string }> = [];
    if (composition) {
      // Это payload собственного фильтра Navigation, не чужие metadata/QRC.
      const contextScript = page.elements.find((element) =>
        element.tagName === "script" &&
        attribute(element, "id") === "course-navigation-context" &&
        attribute(element, "type")?.trim().toLowerCase() === "application/json"
      );
      if (contextScript) {
        const raw = record(JSON.parse(scriptText(contextScript)), output, "course-navigation-context");
        if (!Array.isArray(raw.links)) throw diagnostic("SITE.CONFIG_INVALID", "Navigation links требует список", { source: output, field: "course-navigation-context.links" });
        const context = { ...raw, links: raw.links.map((value: unknown) => record(value, output, "course-navigation-context.links")) };
        for (const link of context.links) {
          if (link.scope === "course") {
            link.href = relative(dirname(output), within(stage, text(link.path, output, "course-navigation-context.links.path")))
              .replaceAll("\\", "/");
          }
        }
        const location = contextScript.sourceCodeLocation!;
        edits.push({
          start: location.startTag!.endOffset,
          end: location.endTag?.startOffset ?? location.endOffset,
          text: JSON.stringify(context).replaceAll("<", "\\u003c"),
        });
      }
    }
    // Только штатные страницы index.html получают правило входа в презентации.
    const index = /(^|[\\/])index\.html$/.test(output) &&
      !presentations.includes(output);
    if (index || composition && courseUrl) {
      const targets = (index ? presentations : []).map((path) =>
        relative(dirname(output), path).replaceAll("\\", "/")
      );
      const rootHref =
        (relative(dirname(output), stage).replaceAll("\\", "/") || ".") + "/";
      const base = composition && courseUrl
        ? JSON.stringify({ courseUrl, rootHref }).replaceAll("<", "\\u003c")
        : "null";
      const program = await navigationProgram();
      const script = '<script id="course-site-navigation">' + program
        .replace(/__SITE_BASE__|__SITE_TARGETS__/g, token => token === "__SITE_BASE__" ? base : JSON.stringify(targets).replaceAll("<", "\\u003c")) + '</script>';

      for (const element of page.elements) {
        if (
          element.tagName === "script" &&
          attribute(element, "id") === "course-site-navigation"
        ) {
          const location = element.sourceCodeLocation!;
          edits.push({
            start: location.startOffset,
            end: location.endOffset,
            text: "",
          });
        }
      }
      const body = page.elements.find((element) => element.tagName === "body")!;
      const end = body.sourceCodeLocation?.endTag?.startOffset ??
        body.sourceCodeLocation?.endOffset ?? page.source.length;
      edits.push({ start: end, end, text: script });
    }
    if (edits.length) {
      let text = page.source;
      // Смещения получены от готового HTML-дерева. Остальные байты сохраняются.
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
      }
      if (text !== page.source) await Deno.writeTextFile(output, text);
    }
  }
}

export const addressNavigation = metrics.wrapAsync({
  id: "course-site.infrastructure.navigation.addressNavigation",
  kind: "phase",
}, addressNavigationImpl);
