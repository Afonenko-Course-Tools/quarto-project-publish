import { quarto } from "site-fixture/process";
import { runHook } from "site-fixture/diagnostics";
const [root, mode, forwarded] = Deno.args;
if (!root || (mode !== "inspect" && mode !== "render")) throw Error("Нужны корень и inspect/render");
await runHook(() => quarto(mode === "inspect" ? ["inspect", root] : ["render", "."], root, {}, forwarded === "true"));
