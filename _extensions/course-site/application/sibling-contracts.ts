import type * as Core from "course-core/public.ts";
import type * as PrairieLearn from "course-prairielearn/public.ts";
import type * as ReferenceCatalog from "reference-catalog/public.ts";
import type * as Navigation from "course-navigation/public.ts";
import type * as Download from "project-download/public.ts";
import type { Record as CollectionRecord } from "../infrastructure/collection.ts";
import type { Workspace } from "../infrastructure/config.ts";

/** Формы доверенных соседей задают их действительные публичные модули. */
export interface SiblingModuleMap {
  "course-core": Pick<typeof Core, "withNativePublication">;
  "course-prairielearn": Pick<typeof PrairieLearn, "inspectPublication">;
  "project-download": Pick<typeof Download, "finishDownloads" | "prepareNativeDownloads" | "resetDownloadRequests">;
  "reference-catalog": Pick<typeof ReferenceCatalog, "publishReferenceCatalog">;
  "course-navigation": Pick<typeof Navigation, "composeNavigation">;
}

/** Поля текущего результата, используемые native операцией Java Site. */
export type NativeSiteRecord = Pick<CollectionRecord, "projectRoot" | "outputDir" | "profiles" | "nativeOutputs"> & {
  selectedSources?: Workspace["selectedSources"];
};

export type { NativeCatalog, NativePublication } from "course-core/public.ts";

export type { PreparedDownloads } from "project-download/public.ts";
export type { PublicationInspection } from "course-prairielearn/public.ts";

/** Runtime граница проверяет именно операции, используемые данным consumer. */
export function isSibling<Name extends keyof SiblingModuleMap>(
  name: Name,
  value: unknown,
): value is SiblingModuleMap[Name] {
  if (typeof value !== "object" || value === null) return false;
  const required = {
    "course-core": ["withNativePublication"],
    "course-prairielearn": ["inspectPublication"],
    "project-download": ["finishDownloads", "prepareNativeDownloads", "resetDownloadRequests"],
    "reference-catalog": ["publishReferenceCatalog"],
    "course-navigation": ["composeNavigation"],
  } satisfies { [Key in keyof SiblingModuleMap]: (keyof SiblingModuleMap[Key])[] };
  return required[name].every((key) => key in value && typeof Reflect.get(value, key) === "function");
}
