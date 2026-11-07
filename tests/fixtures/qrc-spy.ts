import type { publishReferenceCatalog as Publish } from "reference-catalog/public.ts";
export async function publishReferenceCatalog(request: Parameters<typeof Publish>[0]) {
  await Deno.writeTextFile(request.root + "/qrc-call.json", JSON.stringify(request));
  await Deno.writeTextFile(request.stage + "/reference-catalog.json", "{}");
}
