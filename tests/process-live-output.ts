import { fixture, fixtureImports } from "./fixtures.ts";
import { record } from "../_extensions/course-site/infrastructure/values.ts";
const root = await Deno.makeTempDir({ prefix: "publisher-live-" });
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const tool = root + "/quarto-fixture.sh", runner = root + "/runner.ts";
await Deno.writeTextFile(tool, await fixture("live-tool.sh"));
await Deno.chmod(tool, 0o700);
await Deno.writeTextFile(runner, await fixture("live-runner.ts", fixtureImports));
async function trial(mode: string) {
  const gate = root + "/" + mode + ".gate";
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "--no-config", "--no-lock", "--no-code-cache", "--cached-only", "-A", runner, mode],
    cwd: root, env: { QUARTO: mode === "missing" ? root + "/absent-tool" : tool, LIVE_GATE: gate }, stdout: "piped", stderr: "piped",
  }).spawn();
  let stdout = "", stderr = "", released = false, earlyOut = false, earlyErr = false;
  let ready!: () => void;
  const first = new Promise<void>((resolve) => ready = resolve);
  const inspect = () => {
    if (!released) {
      earlyOut ||= stdout.includes("OUT_FIRST\n"); earlyErr ||= stderr.includes("ERR_FIRST\n");
      if (earlyOut && earlyErr) ready();
    }
  };
  const read = async (stream: ReadableStream<Uint8Array>, error: boolean) => {
    const decoder = new TextDecoder();
    for await (const bytes of stream) { if (error) stderr += decoder.decode(bytes, {stream:true}); else stdout += decoder.decode(bytes, {stream:true}); inspect(); }
    if (error) stderr += decoder.decode(); else stdout += decoder.decode();
  };
  const readers = Promise.all([read(child.stdout, false), read(child.stderr, true)]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (mode !== "json" && mode !== "missing") await Promise.race([first, new Promise<void>((resolve) => timer = setTimeout(resolve, 5000))]);
  if (timer !== undefined) clearTimeout(timer);
  released = true;
  await Deno.writeTextFile(gate, "go");
  const status = await child.status;
  await readers;
  assert(status.success, "Процесс проверки не завершился");
  const resultLine = stdout.split("\n").find((line) => line.startsWith("RESULT:"));
  assert(resultLine, "Отсутствует результат helper");
  const parsed: unknown = JSON.parse(resultLine!.slice(7));
  const result = record(parsed, runner, "helper");
  return { mode, earlyOut, earlyErr, stdout, stderr, result };
}
const observations: Awaited<ReturnType<typeof trial>>[] = [];
const save = async () => { const path=Deno.env.get("PUBLISHER_PROCESS_OBSERVATIONS"); if(path) await Deno.writeTextFile(path, JSON.stringify(observations,null,2)+"\n"); };
try {
  const live = await trial("render"); observations.push(live); await save();
  assert(live.earlyOut && live.earlyErr, "Publisher буферизует первый stdout/stderr до завершения child");
  assert(live.result.result === "OUT_FIRST\nOUT_LAST\n", "Изменены captured bytes forward=true");
  const failed = await trial("fail"); observations.push(failed); await save();
  assert(failed.earlyOut && failed.earlyErr, "Ненулевой child потерял живые потоки");
  assert(failed.result.name === "ExternalToolFailure" && failed.result.tool === tool && failed.result.exitCode === 9 && failed.result.causeCode === 9 && failed.result.causeSuccess === false && failed.result.forwarded === true, "Потерян контракт native ошибки");
  assert(failed.result.stdout === "OUT_FIRST\nOUT_LAST\n" && failed.result.stderr === "ERR_FIRST\nERR_LAST\n", "Потеряны потоки native ошибки");
  const captured = await trial("json"); observations.push(captured); await save();
  assert(captured.result.result === '{"native":"точный JSON"}\n', "Изменён captured inspect JSON");
  assert(captured.stdout.startsWith("RESULT:") && captured.stderr === "", "Captured inspect загрязняет внешние потоки");
  const missing = await trial("missing"); observations.push(missing); await save();
  assert(missing.result.name === "ExternalToolFailure" && missing.result.exitCode === null && missing.result.forwarded === false && missing.result.stdout === "" && missing.result.stderr === "", "Потерян контракт ошибки запуска");
  console.log("Живые stdout/stderr до завершения, точные captured bytes, JSON и native error сохранены.");
} finally { await Deno.remove(root, {recursive:true}); }
