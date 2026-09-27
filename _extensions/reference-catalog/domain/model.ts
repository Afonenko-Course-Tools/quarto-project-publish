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
  /** Consumer-only presentation metadata; never exported. */
  sourceTitle?: string;
  defaultStyle?: ReferenceStyle;
}
export interface Reference {
  key: string;
  style: ReferenceStyle;
  custom: boolean;
}
export interface Catalog {
  schema: "quarto-reference-catalog/2" | "quarto-reference-catalog/3";
  generator: { version: string; quarto: string };
  publication?: { title: string };
  targets: Record<string, Target>;
}
export interface Member { namespace: string; path: string; mount: string; format: "html" | "revealjs" }
export interface Import {
  namespace: string; source: string; sourceNamespace: string; baseUrl: string;
  title?: string; style?: ReferenceStyle;
}
/** Missing selection exports every local target; an empty mapping exports none. */
export type Exports = Record<string, "*" | string[]>;
export interface Workspace {
  root: string; output: string; members: Member[]; imports: Import[];
  extension: string; profiles: string[]; outputs: string[]; home?: string;
  exports?: Exports; publication?: { title: string };
}
