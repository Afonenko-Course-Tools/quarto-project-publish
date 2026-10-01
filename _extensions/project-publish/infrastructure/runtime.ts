import type { BuildPorts } from "../application/workflow.ts";
import { workspace } from "./config.ts";
import { renderMembers } from "./render.ts";
import { publish } from "./publish.ts";
import { exists, join } from "./files.ts";
import { owned } from "./attempt.ts";
export function runtime(): BuildPorts {
  return {
    workspace: () => workspace(Deno.cwd()),
    async clearState(w) {
      // Явно подключённый координатор владеет текущим выходным каталогом проекта.
      // Результаты других профилей не изменяются.
      if (await exists(w.output)) {
        await Deno.remove(w.output, { recursive: true });
      }
      await Deno.mkdir(join(w.root, ".project-publish"), { recursive: true });
      const file = join(w.root, ".project-publish/state.json");
      if (await exists(file)) await Deno.remove(file);
      const builds = join(w.root, ".project-publish/builds");
      if (await exists(builds)) await Deno.remove(builds, { recursive: true });
      for await (
        const entry of Deno.readDir(join(w.root, ".project-publish"))
      ) {
        if (entry.isDirectory && entry.name.startsWith("publish-")) {
          await Deno.remove(join(w.root, ".project-publish", entry.name), {
            recursive: true,
          });
        }
      }
    },
    render: renderMembers,
    saveState: (w, state) =>
      Deno.writeTextFile(
        join(w.root, ".project-publish/state.json"),
        JSON.stringify(state),
      ),
    async loadState() {
      const state = JSON.parse(
        await Deno.readTextFile(
          join(Deno.cwd(), ".project-publish/state.json"),
        ),
      );
      owned(state, Deno.cwd());
      return state;
    },
    async preparePreview(w) {
      const entry = new URL("../entrypoints/preview.ts", import.meta.url).href;
      await Deno.writeTextFile(
        join(w.root, ".project-publish/preview.ts"),
        `Deno.chdir(${JSON.stringify(w.root)});\nawait import(${
          JSON.stringify(entry)
        });\n`,
      );
    },
    publish,
    async cleanup(w, state, failed = false) {
      owned(state, w.root);
      const paths = [
        join(w.root, ".project-publish/state.json"),
        join(w.root, ".project-publish/builds", state.id),
        join(w.root, ".project-publish/publish-" + state.id),
        join(w.root, ".project-publish/output-" + state.id),
      ];
      if (failed) paths.push(w.output);
      for (const path of paths) {
        if (await exists(path)) await Deno.remove(path, { recursive: true });
      }
      const builds = join(w.root, ".project-publish/builds");
      if (
        await exists(builds) &&
        (await Array.fromAsync(Deno.readDir(builds))).length === 0
      ) await Deno.remove(builds);
    },
  };
}
