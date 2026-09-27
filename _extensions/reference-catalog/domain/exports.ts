import type { Exports, Target } from "./model.ts";
import { assemble } from "./catalog.ts";

/** Export policy changes the public catalog, never the local linking scope. */
export function exportedTargets(local: Target[], selection?: Exports): Record<string, Target> {
  const available = assemble(local);
  const chosen = new Map<string, Target>();
  if (selection === undefined) {
    for (const [key, target] of available) chosen.set(key, target);
  } else {
    for (const [namespace, ids] of Object.entries(selection)) {
      if (ids === "*") {
        for (const [key, target] of available) if (target.namespace === namespace) chosen.set(key, target);
      } else {
        for (const id of ids) {
          const key = `${namespace}:${id}`, target = available.get(key);
          if (!target) throw new Error(`QRC export target does not exist in this publication: ${key}`);
          chosen.set(key, target);
        }
      }
    }
  }
  return Object.fromEntries([...chosen].sort(([a], [b]) => a.localeCompare(b)).map(([key, target]) => {
    // Imported locations and consumer preferences are not a publication contract.
    const { baseUrl: _base, sourceTitle: _source, defaultStyle: _style, ...own } = target;
    return [key, own];
  }));
}
