import type { Workspace, Member } from "../domain/model.ts";
import { join, within, relative, isAbsolute, resolve } from "./files.ts";
import { quarto } from "./process.ts";
import { activeProfiles, profileArguments } from "./profiles.ts";
import { isRecord, checkKeys, configKeys, memberKeys, formats } from "../domain/contract.ts";
import type { Format } from "../domain/contract.ts";
export async function workspace(root: string): Promise<Workspace> {
  const profiles = activeProfiles();
  const inspected = JSON.parse(await quarto(["inspect", root, ...profileArguments(profiles)], root));
  const config = inspected.config;
  const pub = config["project-publish"];
  if (!isRecord(pub) || !isRecord(pub.projects)) throw new Error("Публикация project-publish.projects обязателен в корне составного проекта");
  checkKeys(pub, configKeys, "project-publish");
  if (config.project.type !== "website") throw new Error("Публикация корневой проект должен иметь тип website; книга подключается как подпроект");
  const home = pub.home;
  if (home !== undefined && (typeof home !== "string" || !Object.hasOwn(pub.projects, home))) throw new Error("Публикация home должен указывать имя настроенного подпроекта");
  if (home !== undefined && (!Array.isArray(config.project.render) || config.project.render.length !== 0)) throw new Error("Публикация home требует project.render: []; главную страницу предоставляет выбранный подпроект");
  const requestedOutput = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR");
  const outputName = requestedOutput ? relative(root, resolve(root, requestedOutput)) : config.project["output-dir"] || "_site";
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(outputName)) throw new Error("Публикация output-dir должен быть именем одного каталога, например _site");
  const output = within(root, outputName);
  const inside = (parent: string, path: string) => {
    const rel = relative(parent, path);
    return !rel || (!rel.startsWith(".." + "/") && !rel.startsWith(".." + "\\") && rel !== ".." && !isAbsolute(rel));
  };
  const members: Member[] = [];
  const used = new Set<string>();
  for (const [namespace, value] of Object.entries(pub.projects)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(namespace)) throw new Error(`Публикация некорректное пространство имён ${namespace}`);
    const item = value as Record<string, string>;
    if (!item || typeof item.path !== "string") throw new Error(`Публикация для проекта ${namespace} требуется path`);
    checkKeys(item, memberKeys, `project-publish.projects.${namespace}`);
    const path = within(root, item.path);
    if (inside(output, path) || inside(path, output)) throw new Error("Публикация каталоги исходников и результатов пересекаются");
    if (namespace === home && item.mount !== undefined) throw new Error(`Публикация для главного проекта ${namespace} нельзя задавать mount`);
    const mount = namespace === home ? "" : item.mount ?? namespace;
    if ((mount !== "" && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(mount)) || used.has(mount)) throw new Error(`Публикация некорректный или повторяющийся mount ${mount}`);
    used.add(mount);
    const format = item.format ?? "html";
    if (!(formats as readonly string[]).includes(format)) throw new Error(`Публикация неподдерживаемый формат ${format}`);
    if (namespace === home && format !== "html") throw new Error("Публикация главный проект должен иметь формат HTML и создавать index.html");
    await Deno.stat(join(path, "_quarto.yml"));
    for (const profile of profiles) {
      try { await Deno.stat(join(path, `_quarto-${profile}.yml`)); }
      catch (error) {
        if (error instanceof Deno.errors.NotFound) throw new Error(`Публикация у проекта ${namespace} отсутствует _quarto-${profile}.yml; все подпроекты должны поддерживать выбранный профиль`);
        throw error;
      }
    }
    members.push({ namespace, path, mount, format: format as Format });
  }
  if (!members.length) throw new Error("Публикация не заданы подпроекты");
  const integrations = pub.integrations ?? [];
  if (!Array.isArray(integrations) || integrations.some(path => typeof path !== "string")) throw new Error("Публикация integrations должен содержать пути к модулям интеграции");
  const integrationPaths = integrations.map(path => within(root, path));
  // Предыдущая публикация остаётся результатом сборки и при выборе другого профиля.
  const outputs = new Set([relative(root, output)]);
  for await (const entry of Deno.readDir(root)) {
    const match = entry.isFile && entry.name.match(/^_quarto-([A-Za-z0-9][A-Za-z0-9_.-]*)\.yml$/);
    if (!match) continue;
    const profileConfig = JSON.parse(await quarto(["inspect", root, "--profile", match[1]], root)).config;
    const name = profileConfig.project?.["output-dir"] || "_site";
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) throw new Error(`Публикация в профиле ${match[1]} output-dir должен быть именем одного каталога`);
    outputs.add(name);
  }
  return { root, output, members, integrations: integrationPaths, config, profiles, outputs: [...outputs], home };
}
