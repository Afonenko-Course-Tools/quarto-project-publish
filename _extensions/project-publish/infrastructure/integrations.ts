import type { Workspace, Integration } from "../domain/model.ts";
import { toFileUrl } from "stdlib/path";
export async function integrations(w: Workspace): Promise<Integration[]> {
  const result: Integration[] = [];
  for (const path of w.integrations) {
    const module = await import(toFileUrl(path).href);
    if (!module.default || (typeof module.default.metadata !== "function" && typeof module.default.finalize !== "function")) throw new Error(`Публикация: модуль ${path} не предоставляет интеграцию`);
    result.push(module.default);
  }
  return result;
}
