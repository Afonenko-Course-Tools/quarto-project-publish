export {};
const [tool, log, ...args] = Deno.args;
if (!tool || !log) throw Error("Нужны executable и путь журнала");
const child = new Deno.Command(tool, { args, stdin: "inherit", stdout: "inherit", stderr: "inherit" }).spawn();
const result = await child.status;
await Deno.writeTextFile(log, JSON.stringify({ kind: args[0], args, cwd: Deno.cwd(), exitCode: result.code }) + "\n", { append: true });
Deno.exitCode = result.code;
