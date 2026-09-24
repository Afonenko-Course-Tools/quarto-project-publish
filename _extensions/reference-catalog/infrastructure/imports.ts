import type { Import, Target } from "../domain/model.ts";
export async function importTargets(imports: Import[]): Promise<Target[]> {
  const result: Target[] = [];
  for (const spec of imports) {
    const catalog = JSON.parse(await Deno.readTextFile(spec.file));
    if (catalog.schema !== "quarto-reference-catalog/2" || !catalog.targets) throw new Error(`QRC unsupported imported catalog ${spec.file}`);
    let count = 0;
    for (const value of Object.values(catalog.targets)) {
      const item = value as Target;
      if (item.namespace !== spec.sourceNamespace) continue;
      for (const field of ["id", "page", "fragment", "labelHtml", "numberHtml", "label", "number"] as const) {
        if (typeof item[field] !== "string" || (!item[field] && field !== "number" && field !== "numberHtml")) throw new Error(`QRC invalid imported target ${spec.file}: ${field}`);
      }
      if (item.page.startsWith("/") || item.page.split("/").includes("..") || /[?#:]/.test(item.page)) throw new Error(`QRC invalid imported page ${item.page}`);
      result.push({ ...item, namespace: spec.namespace, baseUrl: item.baseUrl ?? spec.baseUrl }); count++;
    }
    if (!count) throw new Error(`QRC import has no namespace ${spec.sourceNamespace}: ${spec.file}`);
  }
  return result;
}
