import { pre } from "../_extensions/course-site/application/compose.ts";
import { join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "publisher-planning-progress-" });
const owners = [root, ...["theory", "tasks", "lectures", "practice", "handbook"].map((name) => join(root, name))];
const events: string[] = [];
let failTasksFull = false; const sentinel = Error("PLANNING_FAILURE_SENTINEL");
const originalCommand = Deno.Command, originalError = console.error;
const previous = Deno.env.get("QUARTO_PROJECT_RENDER_ALL"), previousProfile = Deno.env.get("QUARTO_PROFILE");
const assert = (value: unknown, message: string) => { if (!value) throw Error(message); };
try {
  for (const owner of owners) {
    await Deno.mkdir(owner, { recursive: true });
    await Deno.writeTextFile(join(owner, "_quarto-full.yml"), "project: {output-dir: _site-full}\n");
    await Deno.writeTextFile(join(owner, "index.qmd"), "# Фиксированный источник\n");
  }
  Deno.env.set("QUARTO_PROJECT_RENDER_ALL", "1"); Deno.env.set("QUARTO_PROFILE", "student");
  console.error = (...values) => events.push("LOG " + values.join(" "));
  (Deno as any).Command = class {
    args: string[]; cwd: string;
    constructor(_tool: string, options: any) { this.args = options.args; this.cwd = options.cwd; }
    output() {
      assert(this.args[0] === "inspect", "Unexpected captured command " + this.args);
      const alternate = this.args.includes("full");
      const stage = alternate ? "Проверка аудиторий" : this.cwd === root ? "Планирование корня" : "Планирование компонента";
      assert(events.some((line) => line.includes(stage + ": " + this.cwd + " — начало")), "Missing live stage before native inspect: " + this.cwd);
      events.push("INSPECT " + (alternate ? "full " : "student ") + this.cwd);
      if (failTasksFull && alternate && this.cwd === owners[2]) throw sentinel;
      const config: any = { project: { type: "website", "output-dir": alternate ? "_site-full" : "_site" } };
      if (this.cwd === root) config.subprojects = owners.slice(1).map((owner) => owner.slice(root.length + 1));
      return Promise.resolve({ success: true, code: 0, signal: null, stdout: new TextEncoder().encode(JSON.stringify({ config, files: { input: [join(this.cwd, "index.qmd")], resources: [] } })), stderr: new Uint8Array() });
    }
    spawn() { events.push("RENDER_STOP " + this.cwd); throw Error("STOP_BEFORE_RENDER"); }
  };
  let error = "";
  try { await pre(root); } catch (e) { error = String(e); }
  assert(error.includes("STOP_BEFORE_RENDER"), error);
  assert(events.filter((line) => line.startsWith("INSPECT ")).length === 12, "Planning changed inspect count");
  for (const owner of owners) {
    const stage = owner === root ? "Планирование корня" : "Планирование компонента";
    const inspect = events.indexOf("INSPECT student " + owner);
    const before = events.findIndex((line) => line.includes(stage + ": " + owner + " — начало"));
    const after = events.findIndex((line) => line.includes(stage + ": " + owner + " — готово (") && /\d+\.\d с\)/.test(line));
    assert(before >= 0 && before < inspect && after > inspect, "Missing ordered stage/wall " + owner);
  }
  for (const owner of owners) {
    const inspect = events.indexOf("INSPECT full " + owner);
    const before = events.findIndex((line) => line.includes("Проверка аудиторий: " + owner + " — начало"));
    const after = events.findIndex((line) => line.includes("Проверка аудиторий: " + owner + " — готово (") && /\d+\.\d с\)/.test(line));
    assert(before >= 0 && before < inspect && after > inspect, "Missing alternate-profile stage " + owner);
  }
  assert(events.at(-2)?.startsWith("RENDER_STOP "), "Unexpected post-stop native work");
  const successEvents = [...events]; events.length = 0; failTasksFull = true;
  let failure: unknown;
  try { await pre(root); } catch (e) { failure = e; }
  assert(failure === sentinel, "Planning stage changed original error identity");
  assert(events.filter((line) => line.startsWith("INSPECT ")).length === 6 && !events.some((line) => line.startsWith("RENDER_STOP ")), "Failed planning changed native call count/order");
  assert(events.some((line) => line.includes("Проверка аудиторий: " + owners[2] + " — ошибка (") && /\d+\.\d с\)/.test(line)), "Missing timed planning failure stage");
  originalError(JSON.stringify({ status: "PASS", inspectCount: 12, failedInspectCount: 6, nativeRender: 0, events: successEvents, failureEvents: events }));
} finally {
  (Deno as any).Command = originalCommand; console.error = originalError;
  if (previous === undefined) Deno.env.delete("QUARTO_PROJECT_RENDER_ALL"); else Deno.env.set("QUARTO_PROJECT_RENDER_ALL", previous);
  if (previousProfile === undefined) Deno.env.delete("QUARTO_PROFILE"); else Deno.env.set("QUARTO_PROFILE", previousProfile);
  await Deno.remove(root, { recursive: true });
}
