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
export async function addressNavigation(
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
        const context = JSON.parse(scriptText(contextScript));
        for (const link of context.links) {
          if (link.scope === "course") {
            link.href = relative(dirname(output), within(stage, link.path))
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
      const script = `<script id="course-site-navigation">(function(){
const base=${base};
if(base){
 const course=new URL(base.courseUrl); course.pathname=course.pathname.replace(/\\/$/,'')+'/';
 const root=new URL(base.rootHref,document.baseURI);
 for(const link of document.querySelectorAll('#quarto-header a[href],#quarto-sidebar a[href],.quarto-navbar a[href],.quarto-sidebar a[href]')){
  const url=new URL(link.href,document.baseURI);
  if(url.origin===course.origin&&url.pathname.startsWith(course.pathname)){
   let path=url.pathname.slice(course.pathname.length); if(!path||path.endsWith('/')) path+='index.html';
   link.href=new URL(path+url.search+url.hash,root).href;
  }
 }
}
const targets=${
        JSON.stringify(targets).replaceAll("<", "\\u003c")
      }.map(path=>new URL(path,document.baseURI));
for(const link of document.querySelectorAll('a[href]')){
 const url=new URL(link.href,document.baseURI);
 if(targets.some(target=>target.origin===url.origin&&(
  target.pathname===url.pathname || target.pathname.endsWith('/index.html')&&target.pathname.slice(0,-'index.html'.length)===url.pathname
 ))){
  link.target='_blank'; link.rel=[...new Set([...link.rel.split(/\\s+/).filter(Boolean),'noopener','noreferrer'])].join(' ');
 }
}
})();</script>`;
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

// @ts-expect-error JS допускает замену function binding; публичная сигнатура сохраняется.
addressNavigation = metrics.wrapAsync({
  id: "course-site.infrastructure.navigation.addressNavigation",
  kind: "phase",
}, addressNavigation);
