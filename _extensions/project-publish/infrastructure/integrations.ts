import type { Integration, Workspace } from "../domain/model.ts";
import { toFileUrl } from "stdlib/path";
import { relative, within } from "./files.ts";
export async function integrations(
  w: Workspace,
  sourceRoot: string,
): Promise<Integration[]> {
  const result: Integration[] = [];
  for (const path of w.integrations) {
    const module = await import(
      toFileUrl(within(sourceRoot, relative(w.root, path))).href
    );
    if (
      !module.default ||
      (typeof module.default.beforeRender !== "function" &&
        typeof module.default.metadata !== "function" &&
        typeof module.default.finalize !== "function")
    ) throw new Error(`Публикация: модуль ${path} не предоставляет интеграцию`);
    result.push(module.default);
  }
  return result;
}
