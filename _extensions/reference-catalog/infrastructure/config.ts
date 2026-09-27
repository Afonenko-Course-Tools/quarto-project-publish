import type { Workspace, Member } from "../domain/model.ts";
import { dirname, join, within, fromFileUrl, relative, isAbsolute } from "./files.ts";
import { quarto } from "./process.ts";
import { activeProfiles, profileArguments } from "./profiles.ts";
import { isRecord, parseImports } from "./import-config.ts";
import { parseExports, parsePublication } from "./export-config.ts";
export async function workspace(root: string): Promise<Workspace> {
  const extension = dirname(dirname(fromFileUrl(import.meta.url)));
  const profiles = activeProfiles();
  const inspected = JSON.parse(await quarto(["inspect", root, ...profileArguments(profiles)], root));
  const config = inspected.config;
  const ref = config["reference-catalog"];
  if (!isRecord(ref) || !isRecord(ref.projects)) throw new Error("QRC reference-catalog.projects обязателен в корне составного проекта");
  for (const key of Object.keys(ref)) if (!["namespace", "home", "projects", "imports", "exports", "publication"].includes(key)) throw new Error(`QRC неизвестное свойство reference-catalog.${key}`);
  if (config.project.type !== "website") throw new Error("QRC корневой проект должен иметь тип website; книга подключается как подпроект");
  const home = ref.home;
  if (home !== undefined && (typeof home !== "string" || !Object.hasOwn(ref.projects, home))) throw new Error("QRC home должен указывать имя настроенного подпроекта");
  if (home !== undefined && (!Array.isArray(config.project.render) || config.project.render.length !== 0)) throw new Error("QRC home требует project.render: []; главную страницу предоставляет выбранный подпроект");
  const outputName = config.project["output-dir"] || "_site";
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(outputName)) throw new Error("QRC output-dir должен быть именем одного каталога, например _site");
  const output = within(root, outputName);
  const inside = (parent: string, path: string) => {
    const rel = relative(parent, path);
    return !rel || (!rel.startsWith(".." + "/") && !rel.startsWith(".." + "\\") && rel !== ".." && !isAbsolute(rel));
  };
  const members: Member[] = [];
  const used = new Set<string>();
  for (const [namespace, value] of Object.entries(ref.projects)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(namespace)) throw new Error(`QRC некорректное пространство имён ${namespace}`);
    const item = value as Record<string, string>;
    if (!item || typeof item.path !== "string") throw new Error(`QRC для проекта ${namespace} требуется path`);
    for (const key of Object.keys(item)) if (!["path", "mount", "format"].includes(key)) throw new Error(`QRC неизвестное свойство проекта ${namespace}.${key}`);
    const path = within(root, item.path);
    if (inside(output, path) || inside(path, output)) throw new Error("QRC каталоги исходников и результатов пересекаются");
    if (namespace === home && item.mount !== undefined) throw new Error(`QRC для главного проекта ${namespace} нельзя задавать mount`);
    const mount = namespace === home ? "" : item.mount ?? namespace;
    if ((mount !== "" && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(mount)) || used.has(mount)) throw new Error(`QRC некорректный или повторяющийся mount ${mount}`);
    used.add(mount);
    const format = item.format ?? (namespace === "book" ? "html" : "revealjs");
    if (format !== "html" && format !== "revealjs") throw new Error(`QRC неподдерживаемый формат ${format}`);
    if (namespace === home && format !== "html") throw new Error("QRC главный проект должен иметь формат HTML и создавать index.html");
    await Deno.stat(join(path, "_quarto.yml"));
    for (const profile of profiles) {
      try { await Deno.stat(join(path, `_quarto-${profile}.yml`)); }
      catch (error) {
        if (error instanceof Deno.errors.NotFound) throw new Error(`QRC у проекта ${namespace} отсутствует _quarto-${profile}.yml; все подпроекты должны поддерживать выбранный профиль`);
        throw error;
      }
    }
    members.push({ namespace, path, mount, format });
  }
  if (!members.length) throw new Error("QRC не заданы подпроекты");
  const namespaces = members.map(member => member.namespace);
  const imports = parseImports(ref.imports, root, namespaces);
  const exports = parseExports(ref.exports, namespaces);
  const publication = parsePublication(ref.publication);
  // Предыдущая публикация остаётся результатом сборки и при выборе другого профиля.
  const outputs = new Set([relative(root, output)]);
  for await (const entry of Deno.readDir(root)) {
    const match = entry.isFile && entry.name.match(/^_quarto-([A-Za-z0-9][A-Za-z0-9_.-]*)\.yml$/);
    if (!match) continue;
    const profileConfig = JSON.parse(await quarto(["inspect", root, "--profile", match[1]], root)).config;
    const name = profileConfig.project?.["output-dir"] || "_site";
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) throw new Error(`QRC в профиле ${match[1]} output-dir должен быть именем одного каталога`);
    outputs.add(name);
  }
  return { root, output, members, imports, extension, profiles, outputs: [...outputs], home, exports, publication };
}
