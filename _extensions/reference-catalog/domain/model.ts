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
}
export interface Reference {
  key: string;
  style: "default" | "number";
  custom: boolean;
}
export interface Catalog {
  schema: "quarto-reference-catalog/2";
  generator: { version: string; quarto: string };
  targets: Record<string, Target>;
}
export interface Member { namespace: string; path: string; mount: string; format: "html" | "revealjs" }
export interface Import { namespace: string; file: string; sourceNamespace: string; baseUrl: string }
export interface Workspace { root: string; output: string; members: Member[]; imports: Import[]; extension: string; profiles: string[]; outputs: string[]; home?: string }
