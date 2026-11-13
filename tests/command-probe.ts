import { join } from "node:path";
import { fixture } from "./fixtures.ts";
export async function commandProbe(root: string, executable: string, logPath: string): Promise<string> {
  const dir = join(root, "_test-command-probe");
  await Deno.mkdir(dir, { recursive: true });
  const program = join(dir, "record.ts"),
    launcher = join(dir, "quarto");
  await Deno.writeTextFile(program, await fixture("command-probe.ts"));
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  await Deno.writeTextFile(
    launcher,
    await fixture("command-probe.sh", {
      __DENO__: quote(Deno.execPath()),
      __PROGRAM__: quote(program),
      __TOOL__: quote(executable),
      __LOG__: quote(logPath),
    }),
  );
  await Deno.chmod(launcher, 0o700);
  return launcher;
}
