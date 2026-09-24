import type { Workspace, Member, Import } from "../domain/model.ts";
import { dirname, join, within, fromFileUrl, relative, isAbsolute } from "./files.ts";
import { quarto } from "./process.ts";
export async function workspace(root: string): Promise<Workspace> {
  const extension = dirname(dirname(fromFileUrl(import.meta.url)));
  const inspected = JSON.parse(await quarto(["inspect", root], root));
  const config = inspected.config;
  const ref = config["reference-catalog"];
  if (!ref?.projects || typeof ref.projects !== "object") throw new Error("QRC reference-catalog.projects is required at workspace root");
  if (config.project.type !== "website") throw new Error("QRC workspace root must be a website; the book is a member project");
  const home = ref.home;
  if (home !== undefined && (typeof home !== "string" || !Object.hasOwn(ref.projects, home))) throw new Error("QRC home must name a configured project");
  if (home !== undefined && (!Array.isArray(config.project.render) || config.project.render.length !== 0)) throw new Error("QRC home requires project.render: []; the selected project supplies the home page");
  const outputName = config.project["output-dir"] || "_site";
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(outputName)) throw new Error("QRC output-dir must be one directory name, for example _site");
  const output = within(root, outputName);
  const inside = (parent: string, path: string) => {
    const rel = relative(parent, path);
    return !rel || (!rel.startsWith(".." + "/") && !rel.startsWith(".." + "\\") && rel !== ".." && !isAbsolute(rel));
  };
  const members: Member[] = [];
  const used = new Set<string>();
  for (const [namespace, value] of Object.entries(ref.projects)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(namespace)) throw new Error(`QRC invalid namespace ${namespace}`);
    const item = value as Record<string, string>;
    if (!item || typeof item.path !== "string") throw new Error(`QRC project ${namespace} needs path`);
    for (const key of Object.keys(item)) if (!["path", "mount", "format"].includes(key)) throw new Error(`QRC unknown project property ${namespace}.${key}`);
    const path = within(root, item.path);
    if (inside(output, path) || inside(path, output)) throw new Error("QRC source and output paths overlap");
    if (namespace === home && item.mount !== undefined) throw new Error(`QRC home project ${namespace} cannot also specify mount`);
    const mount = namespace === home ? "" : item.mount ?? namespace;
    if ((mount !== "" && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(mount)) || used.has(mount)) throw new Error(`QRC invalid or duplicate mount ${mount}`);
    used.add(mount);
    const format = item.format ?? (namespace === "book" ? "html" : "revealjs");
    if (format !== "html" && format !== "revealjs") throw new Error(`QRC unsupported format ${format}`);
    if (namespace === home && format !== "html") throw new Error("QRC home must use HTML and produce index.html");
    await Deno.stat(join(path, "_quarto.yml"));
    members.push({ namespace, path, mount, format });
  }
  if (!members.length) throw new Error("QRC no project members");
  const imports: Import[] = [];
  for (const [namespace, value] of Object.entries(ref.imports ?? {})) {
    const item = value as Record<string, string>;
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(namespace) || members.some((m) => m.namespace === namespace)) throw new Error(`QRC invalid import namespace ${namespace}`);
    if (!item || typeof item.file !== "string" || typeof item.namespace !== "string") throw new Error(`QRC import ${namespace} needs file and namespace`);
    for (const key of Object.keys(item)) if (!["file", "namespace", "base-url"].includes(key)) throw new Error(`QRC unknown import property ${namespace}.${key}`);
    const url = new URL(item["base-url"]);
    if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash || !url.pathname.endsWith("/")) throw new Error("QRC import base-url must be HTTP(S) ending in /");
    imports.push({ namespace, file: within(root, item.file), sourceNamespace: item.namespace, baseUrl: url.href });
  }
  return { root, output, members, imports, extension, home };
}
