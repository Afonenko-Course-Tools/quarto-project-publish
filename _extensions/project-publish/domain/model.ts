import type { Format } from "./contract.ts";
export interface Member { namespace: string; path: string; mount: string; format: Format }
export interface Workspace {
  root: string; output: string; members: Member[]; profiles: string[]; outputs: string[];
  home?: string; integrations: string[]; config: Record<string, unknown>;
}
export interface BuildState { id: string; quarto: string; members: { namespace: string; format: Format; mount: string; output: string }[] }
/** Публичный контракт интеграции: результат уже собран, но ещё не опубликован. */
export interface PublicationContext {
  root: string; stage: string; quarto: string; config: Record<string, unknown>;
  members: Member[];
}
export interface RenderContext { root: string; namespace: string; format: Format; config: Record<string, unknown> }
export interface Integration {
  metadata?(context: RenderContext): Promise<Record<string, unknown>> | Record<string, unknown>;
  finalize?(context: PublicationContext): Promise<void>;
}
