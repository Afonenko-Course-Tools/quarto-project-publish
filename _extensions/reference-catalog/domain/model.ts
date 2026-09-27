export type ReferenceStyle = "default" | "number" | "title" | "external";
export interface Target {
  namespace: string;
  id: string;
  page: string;
  fragment: string;
  slide?: string;
  labelHtml: string;
  numberHtml: string;
  label: string;
  number: string;
  baseUrl?: string;
  title?: string;
  /** Настройки представления у потребителя; в экспорт не входят. */
  sourceTitle?: string;
  defaultStyle?: ReferenceStyle;
}
export interface Reference {
  key: string;
  style: ReferenceStyle;
  custom: boolean;
}
export interface Catalog {
  schema: "quarto-reference-catalog";
  generator: { quarto: string };
  publication?: { title: string };
  targets: Record<string, Target>;
}
export interface Member { namespace: string; path: string; mount: string; format: "html" | "revealjs" }
export interface Import {
  namespace: string; source: string; sourceNamespace: string; baseUrl: string;
  title?: string; style?: ReferenceStyle;
}
/** Без настройки экспортируются все локальные цели; пустое отображение запрещает экспорт. */
export type Exports = Record<string, "*" | string[]>;
export interface Workspace {
  root: string; output: string; members: Member[]; imports: Import[];
  extension: string; profiles: string[]; outputs: string[]; home?: string;
  exports?: Exports; publication?: { title: string };
}
