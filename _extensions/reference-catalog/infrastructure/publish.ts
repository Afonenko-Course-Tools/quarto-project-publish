import type { Workspace, Catalog } from "../domain/model.ts";
import type { BuildState } from "../application/workflow.ts";
import { copyTree, exists, files, join, relative } from "./files.ts";
import { readPage } from "./pages.ts";
import { linkPages } from "./linker.ts";
import { updateSearch } from "./search.ts";
import { exportedTargets } from "../domain/exports.ts";
export async function publish(w: Workspace, state: BuildState): Promise<void> {
  const stage = join(w.root, ".qrc", "publish-" + state.id);
  await Deno.mkdir(stage, { recursive: true });
  if (!w.home && await exists(w.output)) await copyTree(w.output, stage);
  // Quarto может принять каталоги из метаданных за ресурсы.
  // Исходники подпроекта исключаются из публикации независимо от его mount.
  for (const member of w.members) {
    const sourceCopy = join(stage, relative(w.root, member.path));
    if (await exists(sourceCopy)) await Deno.remove(sourceCopy, { recursive: true });
  }
  const ordered = [...state.members].sort((a, b) => Number(b.mount === "") - Number(a.mount === ""));
  for (const member of ordered) {
    const dest = join(stage, member.mount);
    if (member.mount && await exists(dest)) {
      if (w.home) throw new Error(`QRC конфликт публикации: главный проект уже содержит ${member.mount}`);
      await Deno.remove(dest, { recursive: true });
    }
    await copyTree(member.output, dest);
  }
  if (!await exists(join(stage, "index.html"))) throw new Error("QRC публикация должна содержать index.html; проверьте главный проект");
  if (w.home && (await exists(join(stage, "reference-catalog.json")) || await exists(join(stage, ".nojekyll")))) throw new Error("QRC главный проект использует зарезервированные имена файлов публикации");
  const paths = (await files(stage)).filter((p) => p.endsWith(".html"));
  const pages = await Promise.all(paths.map(async (path) => readPage(relative(stage, path).replaceAll("\\", "/"), await Deno.readTextFile(path))));
  for (const member of w.members) {
    if (!pages.some((p) => p.targets.some((t) => t.namespace === member.namespace))) {
      throw new Error(`QRC ${member.namespace} не предоставил целей; проверьте фильтры подпроекта и явные ID`);
    }
  }
  const script = await Deno.readTextFile(join(w.extension, "browser/navigation.js"));
  const externalCss = await Deno.readTextFile(join(w.extension, "browser/external.css"));
  const local = pages.flatMap(page => page.targets);
  const exported = exportedTargets(local, w.exports);
  const linked = linkPages(pages, script, state.imports ?? [], externalCss);
  for (const [path, html] of linked.pages) await Deno.writeTextFile(join(stage, path), html);
  await updateSearch(stage, (await files(stage)).filter((p) => p.endsWith("/search.json")), linked.pages);
  const catalog: Catalog = { schema: "quarto-reference-catalog", generator: { quarto: state.quarto }, publication: w.publication, targets: exported };
  await Deno.writeTextFile(join(stage, "reference-catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  await Deno.writeTextFile(join(stage, ".nojekyll"), "");
  // Полностью проверенный результат атомарно заменяет прежнюю публикацию.
  const backup = join(w.root, ".qrc", "output-" + state.id);
  const hadOutput = await exists(w.output);
  if (hadOutput) await Deno.rename(w.output, backup);
  try { await Deno.rename(stage, w.output); }
  catch (error) { if (hadOutput) await Deno.rename(backup, w.output); throw error; }
  if (hadOutput) await Deno.remove(backup, { recursive: true });
  console.log(`QRC разрешено ссылок: ${linked.links}; целей: ${linked.targets.size}; страниц: ${pages.length}`);
}
