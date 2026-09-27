import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "project-portal-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function write(path: string, value: string) { const p = join(root, path); await Deno.mkdir(dirname(p), {recursive: true}); await Deno.writeTextFile(p, value); }
async function render(success = true, extra: string[] = []) { const r = await new Deno.Command(quarto, { args: ["render", ...extra], cwd: root, stdout: "piped", stderr: "piped" }).output(); assert(r.success === success, new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr)); }
async function config(mount: string) { await write("_quarto.yml", `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: _extensions/project-publish/entrypoints/post.ts
  resources: ["!notes/**"]
format: html
project-publish:
  projects:
    notes: {path: notes, format: html, mount: ${mount}}
`); }
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write("index.qmd", "# Portal\n\nIndependent root page.\n");
  await write("notes/_quarto.yml", "project:\n  type: default\n  render: [index.qmd]\nformat: html\n");
  await write("notes/index.qmd", "# Notes\n\nA mounted project.\n");
  await config("first");
  // Проверяем переход от домашнего подпроекта к самостоятельному порталу.
  const portal = await Deno.readTextFile(join(root, "_quarto.yml"));
  await write("_quarto.yml", portal.replace("render: [index.qmd]", "render: []").replace("project-publish:\n", "project-publish:\n  home: notes\n").replace(", mount: first", ""));
  await write("notes/obsolete.qmd", "# Old page\n\nPRIVATE_OLD_HOME\n");
  await write("notes/_quarto.yml", "project:\n  type: default\n  render: [index.qmd, obsolete.qmd]\nformat: html\n");
  await render();
  await config("first"); await render(); await render();
  try { await Deno.stat(join(root, "_site/obsolete.html")); throw new Error("Старая страница домашнего проекта сохранилась в портале"); } catch(e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }
  assert((await Deno.stat(join(root, "_site/first/index.html"))).isFile, "Повторная публикация потеряла подпроект");
  await config("second"); await render();
  assert((await Deno.stat(join(root, "_site/second/index.html"))).isFile, "Новое размещение не создано");
  try { await Deno.stat(join(root, "_site/first")); throw new Error("Старое размещение осталось в публикации"); } catch(e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }
  assert((await Deno.readTextFile(join(root, "_site/index.html"))).includes("Independent root page"), "Корневая страница потеряна");
  await render(true, ["--output-dir", "_preview"]);
  assert((await Deno.stat(join(root, "_preview/second/index.html"))).isFile, "CLI output-dir проигнорирован");
  console.log("Успех: повторная публикация портала, переход home→portal, изменение mount и CLI output-dir");
} finally { await Deno.remove(root, {recursive: true}); }
