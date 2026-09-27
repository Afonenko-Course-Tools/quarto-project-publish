import { fromFileUrl, isAbsolute, resolve } from "./files.ts";

/** Resolve source locations once; sources may live outside the consuming project. */
export function normalizeCatalogSource(value: string, root: string): string {
  if (!value.trim()) throw new Error("QRC import source must be a nonempty path or HTTP(S) URL");
  // The platform path implementation also recognises drive letters on Windows.
  if (isAbsolute(value)) return resolve(value);
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return resolve(root, value);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`QRC invalid import source URL: ${value}`); }
  if (url.protocol === "file:") {
    if (url.search || url.hash) throw new Error("QRC file source must not contain a query or fragment");
    try { return fromFileUrl(url); }
    catch { throw new Error(`QRC invalid file source URL: ${value}`); }
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`QRC unsupported import source protocol ${url.protocol}; use a file or HTTP(S)`);
  if (url.hash || url.username || url.password) throw new Error("QRC HTTP(S) source must not contain a fragment or credentials");
  return url.href;
}

/** Fetch only during preparation, never from a filter or once per document. */
export async function readCatalogSource(source: string): Promise<string> {
  if (!/^https?:\/\//.test(source)) {
    try { return await Deno.readTextFile(source); }
    catch (error) { throw new Error(`QRC cannot read imported catalog ${source}: ${error instanceof Error ? error.message : error}`); }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    const message = controller.signal.aborted ? "request timed out after 30 seconds" : error instanceof Error ? error.message : String(error);
    throw new Error(`QRC cannot fetch imported catalog ${source}: ${message}`);
  } finally { clearTimeout(timeout); }
}
