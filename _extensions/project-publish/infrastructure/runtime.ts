import type { BuildPorts } from "../application/workflow.ts";
import { workspace } from "./config.ts";
import { renderMembers } from "./render.ts";
import { publish } from "./publish.ts";
import { join, exists } from "./files.ts";
export function runtime(): BuildPorts {
  return {
    workspace: () => workspace(Deno.cwd()),
    async clearState(w) {
      // Явно подключённый координатор владеет текущим выходным каталогом проекта.
      // Результаты других профилей не изменяются.
      if (await exists(w.output)) await Deno.remove(w.output, { recursive: true });
      await Deno.mkdir(join(w.root, ".project-publish"), { recursive: true });
      const file = join(w.root, ".project-publish/state.json");
      if (await exists(file)) await Deno.remove(file);
      const builds = join(w.root, ".project-publish/builds");
      if (await exists(builds)) await Deno.remove(builds, { recursive: true });
      for await (const entry of Deno.readDir(join(w.root, ".project-publish"))) {
        if (entry.isDirectory && entry.name.startsWith("publish-")) await Deno.remove(join(w.root, ".project-publish", entry.name), { recursive: true });
      }
    },
    render: renderMembers,
    saveState: (w, state) => Deno.writeTextFile(join(w.root, ".project-publish/state.json"), JSON.stringify(state)),
    loadState: async (w) => JSON.parse(await Deno.readTextFile(join(w.root, ".project-publish/state.json"))),
    async preparePreview(w) {
      const entry = new URL("../entrypoints/preview.ts", import.meta.url).href;
      await Deno.writeTextFile(join(w.root, ".project-publish/preview.ts"), `Deno.chdir(${JSON.stringify(w.root)});\nawait import(${JSON.stringify(entry)});\n`);
    },
    publish,
    async cleanup(w, state) {
      await Deno.remove(join(w.root, ".project-publish/state.json"));
      await Deno.remove(join(w.root, ".project-publish/builds", state.id), { recursive: true });
    },
  };
}
