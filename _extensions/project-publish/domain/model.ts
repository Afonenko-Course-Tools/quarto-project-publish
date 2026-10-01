import type { Format } from "./contract.ts";
export interface Member {
  namespace: string;
  path: string;
  mount: string;
  format: Format;
}
export interface Workspace {
  root: string;
  output: string;
  members: Member[];
  profiles: string[];
  outputs: string[];
  home?: string;
  integrations: string[];
  config: Record<string, unknown>;
}
export interface BuildState {
  id: string;
  quarto: string;
  sourceRoot: string;
  workspace: Workspace;
  /** Документированный override Quarto, зафиксированный при подготовке. */
  outputOverride?: string;
  members: {
    namespace: string;
    format: Format;
    mount: string;
    output: string;
  }[];
}
/** Проверка фиксированного снимка до рендера; path участников находится в sourceRoot. */
export interface BeforeRenderContext {
  root: string;
  sourceRoot: string;
  attemptId: string;
  profiles: string[];
  config: Record<string, unknown>;
  members: Member[];
}
/** Результат уже собран, но ещё не опубликован. */
export interface PublicationContext extends BeforeRenderContext {
  stage: string;
  quarto: string;
}
export interface RenderContext extends BeforeRenderContext {
  /** Фактический абсолютный каталог output текущего подпроекта для native render. */
  output: string;
  namespace: string;
  format: Format;
}
export interface Integration {
  beforeRender?(context: BeforeRenderContext): Promise<void> | void;
  metadata?(
    context: RenderContext,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  finalize?(context: PublicationContext): Promise<void>;
}
