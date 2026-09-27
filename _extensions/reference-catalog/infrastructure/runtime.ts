import type { BuildPorts } from "../application/workflow.ts";
import { workspace } from "./config.ts";
import { renderMembers } from "./render.ts";
import { publish } from "./publish.ts";
import { importTargets } from "./imports.ts";
import { join, exists } from "./files.ts";
export function runtime(): BuildPorts {
  return {
    workspace: () => workspace(Deno.cwd()),
    async clearState(w) {
      // A change of home/mount must never keep pages from the previous layout.
      if (await exists(w.output)) await Deno.remove(w.output, { recursive: true });
      await Deno.mkdir(join(w.root, ".qrc"), { recursive: true });
      const file = join(w.root, ".qrc/state.json");
      if (await exists(file)) await Deno.remove(file);
      const builds = join(w.root, ".qrc/builds");
      if (await exists(builds)) await Deno.remove(builds, { recursive: true });
      for await (const entry of Deno.readDir(join(w.root, ".qrc"))) {
        if (entry.isDirectory && entry.name.startsWith("publish-")) await Deno.remove(join(w.root, ".qrc", entry.name), { recursive: true });
      }
    },
    imports: (w) => importTargets(w.imports),
    render: renderMembers,
    saveState: (w, state) => Deno.writeTextFile(join(w.root, ".qrc/state.json"), JSON.stringify(state)),
    loadState: async (w) => JSON.parse(await Deno.readTextFile(join(w.root, ".qrc/state.json"))),
    async preparePreview(w) {
      const entry = new URL("../entrypoints/preview.ts", import.meta.url).href;
      await Deno.writeTextFile(join(w.root, ".qrc/preview.ts"), `Deno.chdir(${JSON.stringify(w.root)});\nawait import(${JSON.stringify(entry)});\n`);
    },
    publish,
    async discard(w) {
      if (await exists(w.output)) await Deno.remove(w.output, { recursive: true });
    },
    async cleanup(w, state) {
      await Deno.remove(join(w.root, ".qrc/state.json"));
      await Deno.remove(join(w.root, ".qrc/builds", state.id), { recursive: true });
    },
  };
}
