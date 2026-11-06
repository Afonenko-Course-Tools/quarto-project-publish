import type * as Core from "course-core/public.ts";
import { assert } from "./support.ts";
import { isRecord, record, strings, text } from "../_extensions/course-site/infrastructure/values.ts";
import { join, toFileUrl } from "stdlib/path";

type TestCore = Pick<typeof Core, "withCurrentNativeOperation" | "planProject" | "materializeProject" | "NativeCatalogSchema" | "NativeReleaseValidationSchema">;
function isCore(value: unknown): value is TestCore {
  if (!isRecord(value)) return false;
  const catalog = value.NativeCatalogSchema, release = value.NativeReleaseValidationSchema;
  return ["withCurrentNativeOperation", "planProject", "materializeProject"].every(key => typeof value[key] === "function") &&
    isRecord(catalog) && typeof catalog.parse === "function" && isRecord(release) && isRecord(release.shape) && isRecord(release.shape.course) && typeof release.shape.course.parse === "function";
}
export async function loadCore(url?: string) {
  const source = url || (Deno.env.get("CORE") ? toFileUrl(join(Deno.env.get("CORE")!, "_extensions/course-core/public.ts")).href : new URL("../../quarto-course/_extensions/course-core/public.ts", import.meta.url).href);
  const loaded: unknown = await import(source);
  assert(isCore(loaded), "Core test provider не содержит требуемых public операций");
  return loaded;
}
export async function readComposition(value: unknown) {
  const raw = record(value, "composition.json", "composition");
  assert(Array.isArray(raw.nativeOperations), "nativeOperations требует список");
  const Core = await loadCore();
  return {
    outputs: strings(raw.outputs, "composition.json", "outputs"),
    nativeOperations: raw.nativeOperations.map((value: unknown) => {
      const row = record(value, "composition.json", "nativeOperations");
      const inspection = row.inspection === undefined ? undefined : record(row.inspection, "composition.json", "inspection");
      return {
        project: text(row.project, "composition.json", "project"),
        catalog: Core.NativeCatalogSchema.parse(row.catalog),
        course: Core.NativeReleaseValidationSchema.shape.course.parse(row.course),
        inspection: inspection && { ...inspection, course: Core.NativeReleaseValidationSchema.shape.course.parse(inspection.course) },
      };
    }),
  };
}
export function readSearch(value: unknown) {
  assert(Array.isArray(value), "search.json требует список");
  return value.map((value: unknown) => {
    const row = record(value, "search.json", "row");
    return { ...row, href: text(row.href, "search.json", "href"), text: text(row.text, "search.json", "text") };
  });
}

export function readCommandEvent(value: unknown) {
  const raw = record(value, "trace.jsonl", "event");
  return { ...raw, kind: text(raw.kind, "trace.jsonl", "kind"), args: strings(raw.args, "trace.jsonl", "args"), cwd: text(raw.cwd, "trace.jsonl", "cwd"), exitCode: raw.exitCode };
}

interface SiteModules {
  compose: Pick<typeof import("../_extensions/course-site/application/compose.ts"), "pre" | "post">;
  config: Pick<typeof import("../_extensions/course-site/infrastructure/config.ts"), "workspace">;
  navigation: Pick<typeof import("../_extensions/course-site/infrastructure/navigation.ts"), "addressNavigation">;
}
function isSiteModule<Name extends keyof SiteModules>(name: Name, value: unknown): value is SiteModules[Name] {
  if (!isRecord(value)) return false;
  const functions = { compose: ["pre", "post"], config: ["workspace"], navigation: ["addressNavigation"] } satisfies { [Key in keyof SiteModules]: (keyof SiteModules[Key])[] };
  return functions[name].every(key => typeof value[key] === "function");
}
export async function loadSite<Name extends keyof SiteModules>(name: Name, url: string) {
  const value: unknown = await import(url);
  assert(isSiteModule(name, value), "Установленный Site не содержит ожидаемых операций: " + url);
  return value;
}
