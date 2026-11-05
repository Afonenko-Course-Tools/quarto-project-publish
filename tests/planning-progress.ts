import { pre } from "../_extensions/course-site/application/compose.ts";
import { join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "publisher-planning-progress-" });
const owners = [root, ...["theory", "tasks", "lectures", "practice", "handbook"].map((name) => join(root, name))];
const events: string[] = [];
let failTasks = false; const sentinel = Error("PLANNING_FAILURE_SENTINEL");
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
      assert(this.args.length === 4 && this.args[1] === this.cwd && this.args[2] === "--profile" && this.args[3] === "student", "Inspect должен использовать только активный профиль: " + this.args);
      const stage = this.cwd === root ? "Планирование корня" : "Планирование компонента";
      assert(events.some((line) => line.includes(stage + ": " + this.cwd + " — начало")), "Missing live stage before native inspect: " + this.cwd);
      events.push("INSPECT student " + this.cwd);
      if (failTasks && this.cwd === owners[2]) throw sentinel;
      const config: any = { project: { type: "website", "output-dir": "_site" } };
      if (this.cwd === root) config.subprojects = owners.slice(1).map((owner) => owner.slice(root.length + 1));
      return Promise.resolve({ success: true, code: 0, signal: null, stdout: new TextEncoder().encode(JSON.stringify({ config, files: { input: [join(this.cwd, "index.qmd")], resources: [] } })), stderr: new Uint8Array() });
    }
    spawn() { events.push("RENDER_STOP " + this.cwd); throw Error("STOP_BEFORE_RENDER"); }
  };
  let error = "";
  try { await pre(root); } catch (e) { error = String(e); }
  assert(error.includes("STOP_BEFORE_RENDER"), error);
  assert(JSON.stringify(events.filter((line) => line.startsWith("INSPECT "))) === JSON.stringify(owners.map((owner) => "INSPECT student " + owner)), "Планирование должно inspect каждый owner ровно один раз, в порядке корень/компоненты");
  for (const owner of owners) {
    const stage = owner === root ? "Планирование корня" : "Планирование компонента";
    const inspect = events.indexOf("INSPECT student " + owner);
    const before = events.findIndex((line) => line.includes(stage + ": " + owner + " — начало"));
    const after = events.findIndex((line) => line.includes(stage + ": " + owner + " — готово (") && /\d+\.\d с\)/.test(line));
    assert(before >= 0 && before < inspect && after > inspect, "Missing ordered stage/wall " + owner);
  }
  assert(!events.some((line) => line.includes("Проверка аудиторий:")), "Неактивная аудитория не должна запускать отдельный planning stage");
  assert(events.at(-2)?.startsWith("RENDER_STOP "), "Unexpected post-stop native work");
  const successEvents = [...events]; events.length = 0; failTasks = true;
  let failure: unknown;
  try { await pre(root); } catch (e) { failure = e; }
  assert(failure === sentinel, "Planning stage changed original error identity");
  assert(JSON.stringify(events.filter((line) => line.startsWith("INSPECT "))) === JSON.stringify(owners.slice(0, 3).map((owner) => "INSPECT student " + owner)) && !events.some((line) => line.startsWith("RENDER_STOP ")), "Failed planning changed native call count/order");
  assert(events.some((line) => line.includes("Планирование компонента: " + owners[2] + " — ошибка (") && /\d+\.\d с\)/.test(line)), "Missing timed planning failure stage");
  originalError(JSON.stringify({ status: "PASS", inspectCount: 6, failedInspectCount: 3, nativeRender: 0, events: successEvents, failureEvents: events }));
} finally {
  (Deno as any).Command = originalCommand; console.error = originalError;
  if (previous === undefined) Deno.env.delete("QUARTO_PROJECT_RENDER_ALL"); else Deno.env.set("QUARTO_PROJECT_RENDER_ALL", previous);
  if (previousProfile === undefined) Deno.env.delete("QUARTO_PROFILE"); else Deno.env.set("QUARTO_PROFILE", previousProfile);
  await Deno.remove(root, { recursive: true });
}
