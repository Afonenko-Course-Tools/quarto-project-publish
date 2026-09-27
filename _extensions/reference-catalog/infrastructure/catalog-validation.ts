import type { Catalog, ReferenceStyle, Target } from "../domain/model.ts";
import { isRecord, publicationBaseUrl, referenceStyles } from "./import-config.ts";

function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function target(value: unknown, key: string, source: string, legacy: boolean): Target {
  const invalid = (field: string): never => { throw new Error(`QRC invalid imported target ${key} in ${source}: ${field}`); };
  if (!isRecord(value)) invalid("expected an object");
  const item = value as Record<string, unknown>;
  if (!legacy) {
    for (const field of ["baseUrl", "sourceTitle", "defaultStyle"]) {
      if (Object.hasOwn(item, field)) invalid(`${field} is not allowed in an own-target schema 3 catalog`);
    }
  }
  for (const field of ["namespace", "id", "page", "fragment", "labelHtml", "label"] as const) if (!nonempty(item[field])) invalid(field);
  for (const field of ["numberHtml", "number"] as const) if (typeof item[field] !== "string") invalid(field);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(item.namespace as string)) invalid("namespace");
  if (key !== `${item.namespace}:${item.id}`) invalid("catalog key must match namespace:id");
  const page = item.page as string;
  if (/[\\?#:\u0000-\u001f]/.test(page) || page.split("/").some((part) => !part || part === "." || part === "..")) invalid("page must be a relative publication path");
  for (const field of ["slide", "title", "sourceTitle"] as const) if (item[field] !== undefined && !nonempty(item[field])) invalid(field);
  if (item.baseUrl !== undefined) publicationBaseUrl(item.baseUrl, `imported target ${key} baseUrl in ${source}`);
  if (item.defaultStyle !== undefined && !referenceStyles.includes(item.defaultStyle as ReferenceStyle)) invalid("defaultStyle");
  // Legacy schema 2 catalogs may re-export another publication. Keep its
  // validated URL so upgrading the consumer does not silently relocate links.
  // Attribution and presentation defaults always belong to the new consumer.
  return {
    namespace: item.namespace as string, id: item.id as string,
    page, fragment: item.fragment as string,
    labelHtml: item.labelHtml as string, numberHtml: item.numberHtml as string,
    label: item.label as string, number: item.number as string,
    ...(item.slide === undefined ? {} : { slide: item.slide as string }),
    ...(item.title === undefined ? {} : { title: item.title as string }),
    ...(legacy && item.baseUrl !== undefined ? { baseUrl: item.baseUrl as string } : {}),
  };
}

/** Validate imported JSON before any of it enters the link resolver. */
export function validateImportedCatalog(value: unknown, source: string): Catalog {
  if (!isRecord(value) || !["quarto-reference-catalog/2", "quarto-reference-catalog/3"].includes(value.schema as string)) {
    throw new Error(`QRC unsupported imported catalog schema in ${source}; expected quarto-reference-catalog/2 or /3`);
  }
  if (!isRecord(value.generator) || typeof value.generator.version !== "string" || typeof value.generator.quarto !== "string") {
    throw new Error(`QRC invalid imported catalog generator in ${source}`);
  }
  if (!isRecord(value.targets)) throw new Error(`QRC invalid imported catalog targets in ${source}: expected an object`);
  if (value.publication !== undefined && (!isRecord(value.publication) || !nonempty(value.publication.title))) {
    throw new Error(`QRC invalid imported catalog publication.title in ${source}`);
  }
  const valueSchema = value.schema as Catalog["schema"];
  return {
    schema: valueSchema,
    generator: { version: value.generator.version, quarto: value.generator.quarto },
    ...(value.publication === undefined ? {} : { publication: { title: (value.publication as Record<string, string>).title } }),
    targets: Object.fromEntries(Object.entries(value.targets).map(([key, value]) => [key, target(value, key, source, valueSchema === "quarto-reference-catalog/2")])),
  };
}
