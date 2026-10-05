import { isAbsolute } from "./files.ts";

async function traceNative(
  command: string,
  args: string[],
  cwd: string,
  started: number,
  exitCode: number | null,
): Promise<void> {
  try {
    const path = Deno.env.get("COURSE_BUILD_TRACE");
    if (
      !path || !isAbsolute(path) || !["inspect", "render"].includes(args[0])
    ) return;
    const limited = args[1] && !args[1].startsWith("-") ? [args[1]] : [];
    const profile = args.indexOf("--profile");
    if (profile >= 0 && args[profile + 1]) {
      limited.push("--profile", args[profile + 1]);
    }
    await Deno.writeTextFile(
      path,
      JSON.stringify({
        kind: args[0],
        executable: command,
        cwd,
        args: limited,
        elapsedMs: performance.now() - started,
        exitCode,
      }) + "\n",
      { append: true },
    );
  } catch { /* Optional telemetry cannot replace native output or failure. */ }
}

export async function quarto(
  args: string[],
  cwd: string,
  extra: Record<string, string> = {},
  output: "capture" | "forward" = "capture",
): Promise<string> {
  const command = Deno.env.get("QUARTO") ||
    Deno.env.get("PROJECT_PUBLISH_QUARTO") || "quarto";
  const native = new Deno.Command(command, {
    args,
    cwd,
    env: extra,
    stdout: "piped",
    stderr: "piped",
  });
  let result: Deno.CommandOutput;
  let forwarded: PromiseSettledResult<void>[] = [];
  const started = performance.now();
  let exitCode: number | null = null;
  try {
    if (output === "forward") {
      const child = native.spawn();
      const [stdout, liveOut] = child.stdout.tee();
      const [stderr, liveErr] = child.stderr.tee();
      // Keep both diagnostic captures while forwarding actual bytes during render.
      // Settle forwarding separately so a broken sink cannot replace child failure.
      const forwarding = Promise.allSettled([
        liveOut.pipeTo(Deno.stdout.writable, { preventClose: true }),
        liveErr.pipeTo(Deno.stderr.writable, { preventClose: true }),
      ]);
      const [status, out, err] = await Promise.all([
        child.status,
        new Response(stdout).arrayBuffer(),
        new Response(stderr).arrayBuffer(),
      ]);
      result = {
        ...status,
        stdout: new Uint8Array(out),
        stderr: new Uint8Array(err),
      };
      forwarded = await forwarding;
    } else {
      result = await native.output();
    }
    exitCode = result.code;
  } finally {
    await traceNative(command, args, cwd, started, exitCode);
  }
  const out = new TextDecoder().decode(result.stdout);
  const err = new TextDecoder().decode(result.stderr);
  if (!result.success) {
    throw new Error(
      `Публикация команда quarto ${
        args[0]
      } завершилась с кодом ${result.code}\n${out}\n${err}`,
    );
  }
  if (args[0] === "render" && /(?:WARNING|WARN:)/.test(err)) {
    throw new Error(`Публикация предупреждения при сборке\n${err}`);
  }
  for (const stream of forwarded) {
    if (stream.status === "rejected") throw stream.reason;
  }
  return out;
}
