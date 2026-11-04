import type * as Core from "course-core/public.ts";
import type * as PrairieLearn from "course-prairielearn/public.ts";
import type * as Download from "project-download/public.ts";
import type { Record as CollectionRecord } from "../infrastructure/collection.ts";
import type { Workspace } from "../infrastructure/config.ts";

/** Формы доверенных соседей задают их действительные публичные модули. */
export interface SiblingModuleMap {
  "course-core": typeof Core;
  "course-prairielearn": typeof PrairieLearn;
  "project-download": typeof Download;
}

/** Поля текущего результата, используемые native операцией Java Site. */
export type NativeSiteRecord = Pick<
  CollectionRecord,
  "projectRoot" | "outputDir" | "profiles" | "nativeOutputs"
> & {
  selectedSources?: Workspace["selectedSources"];
};

export type {
  NativeCatalog,
  NativePublication,
} from "course-core/public.ts";

export type { PreparedDownloads } from "project-download/public.ts";
export type { PublicationInspection } from "course-prairielearn/public.ts";
