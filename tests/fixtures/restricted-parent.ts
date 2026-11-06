import { quarto } from "site-fixture/process";
const [root, script] = Deno.args;
if (!root || !script) throw Error("Нужны корень команды и shell fixture");
const output = await quarto([script], root, { FUNCTIONAL_EXPLICIT: "override", QUARTO_PROFILE: "student" });
console.log(output);
