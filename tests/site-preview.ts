/** Installed existing/clean root and component previews, with and without Core. */
import { join, resolve } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";

const positional = Deno.args.filter((arg) => arg !== "--course");
assert(
  positional.length === 1 && !positional[0].startsWith("--"),
  "Usage: quarto run tests/site-preview.ts <fixture-path> [--course]",
);
const root = resolve(positional[0]);
const course = Deno.args.includes("--course");
const quarto = Deno.env.get("QUARTO") || "quarto";
const trace = join(root, "preview-trace.jsonl");

async function renders(): Promise<number> {
  let text: string;
  try {
    text = await Deno.readTextFile(trace);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return 0;
    throw error;
  }
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) =>
    JSON.parse(line)
  ).filter((event) => event.kind === "render").length;
}

function deadline(ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

async function signalGroup(pid: number, signal: string): Promise<void> {
  // setsid gives Quarto and its render/server children their own process group.
  await new Deno.Command("kill", {
    args: [`-${signal}`, "--", `-${pid}`],
    stdout: "null",
    stderr: "null",
  }).output();
}

async function preview(cwd: string, clean = false): Promise<void> {
  if (clean) {
    await Deno.remove(join(cwd, course ? "_site-student" : "_site"), {
      recursive: true,
    });
  }
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  const before = await renders();
  const source = join(cwd, "index.qmd");
  const original = await Deno.readFile(source);
  const args = [
    quarto,
    "preview",
    "--no-browser",
    "--no-watch-inputs",
    "--port",
    String(port),
    ...(course ? ["--profile", "student"] : []),
  ];
  const child = new Deno.Command("setsid", {
    args: ["--wait", ...args],
    cwd,
    env: { COURSE_BUILD_TRACE: trace, QUARTO: quarto },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let exited: Deno.CommandStatus | undefined;
  const status = child.status.then((result) => {
    exited = result;
    return result;
  });
  let output = "";
  let listening = false;
  let ready!: () => void;
  const served = new Promise<void>((resolve) => ready = resolve);
  async function consume(stream: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      await Deno.stdout.write(new TextEncoder().encode(text));
      output = (output + text).slice(-32_768);
      if (!listening && /Listening on|Browse at/.test(output)) {
        listening = true;
        ready();
      }
    }
  }
  const streams = Promise.all([consume(child.stdout), consume(child.stderr)]);
  const stopped = status.then((result): never => {
    throw new Error(`native preview exited ${result.code}\n${output}`);
  });
  // Keep the rejected exit promise observed after the serving race has settled.
  stopped.catch(() => {});
  const startup = deadline(120_000, "native preview did not start serving");
  try {
    await Promise.race([served, stopped, startup.promise]);
    startup.cancel();
    assert(listening && !exited, `native preview stopped serving\n${output}`);
    const edit = new TextEncoder().encode("\nNo-watch acceptance edit.\n");
    const changed = new Uint8Array(original.length + edit.length);
    changed.set(original);
    changed.set(edit, original.length);
    await Deno.writeFile(source, changed);
    let observationTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          observationTimer = setTimeout(resolve, 3_000);
        }),
        stopped,
      ]);
    } finally {
      clearTimeout(observationTimer);
    }
  } finally {
    startup.cancel();
    await Deno.writeFile(source, original);
    await signalGroup(child.pid, "TERM");
    const shutdown = deadline(4_000, "preview shutdown timed out");
    try {
      await Promise.race([status, shutdown.promise]);
    } catch {
      await signalGroup(child.pid, "KILL");
      await status;
    } finally {
      shutdown.cancel();
      // Also clean surviving descendants if the parent had already exited.
      await signalGroup(child.pid, "KILL");
    }
    await streams;
  }
  const expected = clean && cwd === root ? (course ? 2 : 1) : 0;
  assertEquals(await renders() - before, expected);
  if (course && !clean) {
    let completion = false;
    try {
      await Deno.stat(join(cwd, "_generated/course-spec/native-run.json"));
      completion = true;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    assert(!completion, "zero-output hook fabricated completion");
  }
}

await preview(root);
await preview(root, true);
await preview(join(root, "part"));
console.log(
  "PASS existing/clean root and component preview, public native scope, no-watch edits, no fabricated completion",
);
