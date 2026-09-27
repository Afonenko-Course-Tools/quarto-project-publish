import type { Workspace, BuildState } from "../domain/model.ts";
import { copyTree, exists, files, join, relative, dirname } from "./files.ts";
import { integrations } from "./integrations.ts";
export async function publish(w: Workspace, state: BuildState): Promise<void> {
  const stage = join(w.root, ".project-publish", "publish-" + state.id);
  await Deno.mkdir(stage, { recursive: true });
  try {
    if (!w.home && await exists(w.output)) await copyTree(w.output, stage);
    // Не допускаем публикацию результатов других профилей как ресурсов корня.
    for (const name of w.outputs) {
      if (!name || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) continue;
      const old = join(stage, name);
      if (await exists(old)) await Deno.remove(old, { recursive: true });
    }
    for (const member of w.members) {
      const sourceCopy = join(stage, relative(w.root, member.path));
      if (await exists(sourceCopy)) await Deno.remove(sourceCopy, { recursive: true });
    }
    const ordered = [...state.members].sort((a, b) => Number(b.mount === "") - Number(a.mount === ""));
    for (const member of ordered) {
      const dest = join(stage, member.mount);
      if (member.mount && await exists(dest)) throw new Error(`Публикация: конфликт размещения ${member.mount}`);
      if (member.format === "pdf") {
        const pdfs = (await files(member.output)).filter(path => path.endsWith(".pdf"));
        if (!pdfs.length) throw new Error(`Публикация: проект ${member.namespace} не создал PDF`);
        for (const path of pdfs) {
          const target = join(dest, relative(member.output, path));
          await Deno.mkdir(dirname(target), { recursive: true }); await Deno.copyFile(path, target);
        }
      } else await copyTree(member.output, dest);
    }
    if (!await exists(join(stage, "index.html"))) throw new Error("Публикация должна содержать index.html; проверьте главный проект");
    for (const adapter of await integrations(w)) await adapter.finalize?.({ root: w.root, stage, quarto: state.quarto, config: w.config, members: w.members });
    await Deno.writeTextFile(join(stage, ".nojekyll"), "");
    const backup = join(w.root, ".project-publish", "output-" + state.id);
    const hadOutput = await exists(w.output);
    if (hadOutput) await Deno.rename(w.output, backup);
    try { await Deno.rename(stage, w.output); }
    catch (error) { if (hadOutput) await Deno.rename(backup, w.output); throw error; }
    if (hadOutput) await Deno.remove(backup, { recursive: true });
  } catch (error) {
    if (await exists(stage)) await Deno.remove(stage, { recursive: true });
    throw error;
  }
}
