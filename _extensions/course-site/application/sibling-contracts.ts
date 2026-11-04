import type * as Core from "course-core/public.ts";
import type * as PrairieLearn from "course-prairielearn/public.ts";
import type { Record as CollectionRecord } from "../infrastructure/collection.ts";
import type { Project, Workspace } from "../infrastructure/config.ts";

/** Формы доверенных соседей задают их действительные публичные модули. */
export interface SiblingModuleMap {
  "course-core": typeof Core;
  "course-prairielearn": typeof PrairieLearn;
}

/** Поля текущего результата, используемые native операцией Java Site. */
export type NativeSiteRecord = Pick<
  CollectionRecord,
  "projectRoot" | "outputDir" | "profiles" | "nativeOutputs"
> & {
  selectedSources?: Workspace["selectedSources"];
  to?: Project["to"];
};

export type {
  NativeCatalog,
  NativeOperation,
  NativeReleaseRequest,
} from "course-core/public.ts";
