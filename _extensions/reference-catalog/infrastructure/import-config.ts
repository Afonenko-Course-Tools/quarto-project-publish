import type { Import, ReferenceStyle } from "../domain/model.ts";
import { normalizeCatalogSource } from "./catalog-source.ts";

const namespacePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const referenceStyles: readonly ReferenceStyle[] = ["default", "number", "title", "external"];
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function publicationBaseUrl(value: unknown, context: string): string {
  if (typeof value !== "string") throw new Error(`QRC ${context} must be an HTTP(S) URL ending in /`);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`QRC ${context} must be an HTTP(S) URL ending in /`); }
  if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash || url.username || url.password || !url.pathname.endsWith("/")) {
    throw new Error(`QRC ${context} must be an HTTP(S) URL ending in / without a query, fragment, or credentials`);
  }
  return url.href;
}

/** Public configuration boundary, independent of Quarto inspection and rendering. */
export function parseImports(raw: unknown, root: string, memberNamespaces: string[]): Import[] {
  if (raw === undefined) return [];
  if (!isRecord(raw)) throw new Error("QRC imports must be a mapping of namespaces to import settings");
  const result: Import[] = [];
  for (const [namespace, item] of Object.entries(raw)) {
    if (!namespacePattern.test(namespace) || memberNamespaces.includes(namespace)) throw new Error(`QRC invalid import namespace ${namespace}`);
    if (!isRecord(item)) throw new Error(`QRC import ${namespace} must be a mapping`);
    for (const key of Object.keys(item)) {
      if (!["source", "file", "namespace", "base-url", "title", "style"].includes(key)) throw new Error(`QRC unknown import property ${namespace}.${key}`);
    }
    if (Object.hasOwn(item, "source") && Object.hasOwn(item, "file")) throw new Error(`QRC import ${namespace} must specify source or legacy file, not both`);
    const source = item.source ?? item.file;
    if (typeof source !== "string" || !source.trim()) throw new Error(`QRC import ${namespace} needs source (or legacy file)`);
    if (typeof item.namespace !== "string" || !namespacePattern.test(item.namespace)) throw new Error(`QRC import ${namespace} needs a valid source namespace`);
    if (item.title !== undefined && (typeof item.title !== "string" || !item.title.trim())) throw new Error(`QRC import ${namespace}.title must be a nonempty string`);
    if (item.style !== undefined && !referenceStyles.includes(item.style as ReferenceStyle)) throw new Error(`QRC invalid import style ${namespace}.style`);
    result.push({
      namespace,
      source: normalizeCatalogSource(source, root),
      sourceNamespace: item.namespace,
      baseUrl: publicationBaseUrl(item["base-url"], `import ${namespace} base-url`),
      ...(item.title === undefined ? {} : { title: item.title as string }),
      ...(item.style === undefined ? {} : { style: item.style as ReferenceStyle }),
    });
  }
  return result;
}
