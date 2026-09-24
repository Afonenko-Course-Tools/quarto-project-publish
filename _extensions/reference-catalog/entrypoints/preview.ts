import { workspace } from "../infrastructure/config.ts";
import { quarto } from "../infrastructure/process.ts";
import { copyTree, exists, join, relative, resolve } from "../infrastructure/files.ts";
const w = await workspace(Deno.cwd());
const option = (name: string, fallback: string) => {
  const index = Deno.args.indexOf(name); return index >= 0 ? Deno.args[index + 1] : fallback;
};
const port = Number(option("--port", "4200")), hostname = option("--host", "127.0.0.1");
const served = join(w.root, ".qrc/preview-site");
async function snapshot() {
  const next = served + "-next";
  if (await exists(next)) await Deno.remove(next, { recursive: true });
  await copyTree(w.output, next);
  if (await exists(served)) await Deno.remove(served, { recursive: true });
  await Deno.rename(next, served);
}
await snapshot();
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();
const mime: Record<string, string> = { html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", woff: "font/woff", woff2: "font/woff2", pdf: "application/pdf" };
const reloadScript = '<script>new EventSource("/__qrc/events").onmessage=()=>location.reload();</script>';
Deno.serve({ port, hostname, onListen: () => console.log(`QRC preview ready http://${hostname}:${port}`) }, async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/__qrc/events") {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; clients.add(c); c.enqueue(encoder.encode(": connected\n\n")); }, cancel() { clients.delete(controller); } });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  }
  try {
    const path = resolve(served, "." + decodeURIComponent(url.pathname));
    if (relative(served, path).startsWith("..")) return new Response("Forbidden", { status: 403 });
    const file = (await Deno.stat(path)).isDirectory ? join(path, "index.html") : path;
    const type = mime[file.split(".").pop()!] || "application/octet-stream";
    const bytes = type.startsWith("text/html") ? (await Deno.readTextFile(file)).replace("</body>", reloadScript + "</body>") : await Deno.readFile(file);
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return new Response("Not found", { status: 404 });
    return new Response("Preview error", { status: 500 });
  }
});
let timer: number | undefined, running = false, dirty = false;
async function rebuild() {
  if (running) { dirty = true; return; }
  running = true;
  do {
    dirty = false;
    try {
      console.log("QRC rebuilding workspace");
      await quarto(["render", "."], w.root);
      await snapshot();
      for (const client of clients) {
        try { client.enqueue(encoder.encode("data: reload\n\n")); } catch { clients.delete(client); }
      }
      console.log("QRC preview updated");
    } catch (error) { console.error(String(error)); console.error("QRC preview keeps the last successful build"); }
  } while (dirty);
  running = false;
}
const outputRelative = relative(w.root, w.output).split(/[\\/]/)[0];
const ignored = new Set([".qrc", ".quarto", ".git", "node_modules", "_output", "_book", "_site", outputRelative]);
const sourceExtension = /\.(qmd|md|ipynb|ya?ml|bib|css|scss|lua|ts|js|py|r|jl|svg|png|jpe?g|webp|csv|tsv|json|toml|sh|java|gradle|kts|txt|html|xml|c|h|cpp|hpp)$/i;
for await (const event of Deno.watchFs(w.root, { recursive: true })) {
  const changed = event.paths.some((path) => sourceExtension.test(path) && !relative(w.root, path).split(/[\\/]/).some((part) => ignored.has(part)));
  if (!changed || event.kind === "access") continue;
  clearTimeout(timer); timer = setTimeout(() => { void rebuild(); }, 250);
}
