import type { Workspace, Catalog } from "../domain/model.ts";
import type { BuildState } from "../application/workflow.ts";
import { copyTree, exists, files, join, relative } from "./files.ts";
import { readPage } from "./pages.ts";
import { linkPages } from "./linker.ts";
import { updateSearch } from "./search.ts";
import { importTargets } from "./imports.ts";
export async function publish(w: Workspace, state: BuildState): Promise<void> {
  const stage = join(w.root, ".qrc", "publish-" + state.id);
  await Deno.mkdir(stage, { recursive: true });
  if (!w.home && await exists(w.output)) await copyTree(w.output, stage);
  // Quarto may infer directories from custom metadata as resources. Do not
  // publish an authored project tree even when its mount uses another name.
  for (const member of w.members) {
    const sourceCopy = join(stage, relative(w.root, member.path));
    if (await exists(sourceCopy)) await Deno.remove(sourceCopy, { recursive: true });
  }
  const ordered = [...state.members].sort((a, b) => Number(b.mount === "") - Number(a.mount === ""));
  for (const member of ordered) {
    const dest = join(stage, member.mount);
    if (member.mount && await exists(dest)) {
      if (w.home) throw new Error(`QRC publication collision: home project already contains ${member.mount}`);
      await Deno.remove(dest, { recursive: true });
    }
    await copyTree(member.output, dest);
  }
  if (!await exists(join(stage, "index.html"))) throw new Error("QRC publication must contain index.html; check the home project");
  if (w.home && (await exists(join(stage, "reference-catalog.json")) || await exists(join(stage, ".nojekyll")))) throw new Error("QRC home project uses reserved publication filenames");
  const paths = (await files(stage)).filter((p) => p.endsWith(".html"));
  const pages = await Promise.all(paths.map(async (path) => readPage(relative(stage, path).replaceAll("\\", "/"), await Deno.readTextFile(path))));
  for (const member of w.members) {
    if (!pages.some((p) => p.targets.some((t) => t.namespace === member.namespace))) {
      throw new Error(`QRC ${member.namespace} exported no targets; check member filters and explicit IDs`);
    }
  }
  const script = await Deno.readTextFile(join(w.extension, "browser/reveal.js"));
  const linked = linkPages(pages, script, await importTargets(w.imports));
  for (const [path, html] of linked.pages) await Deno.writeTextFile(join(stage, path), html);
  await updateSearch(stage, (await files(stage)).filter((p) => p.endsWith("/search.json")), linked.pages);
  const catalog: Catalog = { schema: "quarto-reference-catalog/2", generator: { version: "1.1.0", quarto: state.quarto }, targets: Object.fromEntries(linked.targets) };
  await Deno.writeTextFile(join(stage, "reference-catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  await Deno.writeTextFile(join(stage, ".nojekyll"), "");
  // Validate the complete candidate before replacing the output tree.
  const backup = join(w.root, ".qrc", "output-" + state.id);
  const hadOutput = await exists(w.output);
  if (hadOutput) await Deno.rename(w.output, backup);
  try { await Deno.rename(stage, w.output); }
  catch (error) { if (hadOutput) await Deno.rename(backup, w.output); throw error; }
  if (hadOutput) await Deno.remove(backup, { recursive: true });
  console.log(`QRC linked ${linked.links} references; ${linked.targets.size} targets; ${pages.length} pages`);
}
