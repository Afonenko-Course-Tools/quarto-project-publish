import { quarto } from "site-fixture/process";
const mode = Deno.args[0];
if (!mode) throw Error("Нужен режим команды");
try {
  const result = await quarto([mode], Deno.cwd(), {}, mode !== "json");
  console.log("RESULT:" + JSON.stringify({ result }));
} catch (e) {
  if (!(e instanceof Error) || !("tool" in e) || !("exitCode" in e) || !("stdout" in e) || !("stderr" in e) || !("forwarded" in e)) throw e;
  const cause = e.cause;
  console.log("RESULT:" + JSON.stringify({ name: e.name, tool: e.tool, exitCode: e.exitCode, stdout: e.stdout, stderr: e.stderr, forwarded: e.forwarded, causeCode: typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined, causeSuccess: typeof cause === "object" && cause !== null && "success" in cause ? cause.success : undefined }));
}
