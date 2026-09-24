import type { Workspace } from "../domain/model.ts";
import { join, relative, copySources } from "./files.ts";
import { quarto } from "./process.ts";
import type { BuildState } from "../application/workflow.ts";
export async function renderMembers(w: Workspace): Promise<BuildState> {
  const id = crypto.randomUUID();
  const state: BuildState = { id, quarto: (await quarto(["--version"], w.root)).trim(), members: [] };
  const snapshot = join(w.root, ".qrc", "builds", id, "sources");
  const excluded = new Set([".qrc", ".quarto", ".git", "node_modules", "site_libs", "_generated", "_book", "_site", "_output", relative(w.root, w.output)]);
  await copySources(w.root, snapshot, excluded);
  const overlay = join(w.root, ".qrc", "member-metadata.json");
  await Deno.mkdir(join(w.root, ".qrc"), { recursive: true });
  await Deno.writeTextFile(overlay, JSON.stringify({
    filters: [
      { at: "pre-ast", path: join(w.extension, "lua/requests.lua") },
      { at: "post-ast", path: join(w.extension, "lua/probes.lua") },
    ],
    shortcodes: [join(w.extension, "lua/shortcodes.lua")],
  }));
  for (const member of w.members) {
    const output = join(w.root, ".qrc", "builds", id, "output", member.namespace);
    const source = join(snapshot, relative(w.root, member.path));
    console.log(`QRC render ${member.namespace} (${member.format})`);
    await quarto(["render", ".", "--to", member.format, "--output-dir", relative(source, output),
      "--metadata-file", overlay, "--fail-if-warnings"], source,
      { QRC_MEMBER: "1", QRC_NAMESPACE: member.namespace });
    state.members.push({ mount: member.mount, output });
  }
  return state;
}
