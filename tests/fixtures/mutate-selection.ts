import { readActiveState } from "site-fixture/state";
const path = "_generated/course-site/active.json";
const state = readActiveState(JSON.parse(await Deno.readTextFile(path)), Deno.cwd());
const mode = Deno.args[0];
if (mode === "root-missing") state.ws.selectedSources = [];
else if (mode === "missing" || mode === "unexpected") {
  const first = state.records[0];
  if (!first) throw Error("Нет child record для mutant");
  if (mode === "missing") first.record.selectedSources.pop();
  else first.record.selectedSources.push("foreign.qmd");
} else throw Error("Неизвестный mutant");
await Deno.writeTextFile(path, JSON.stringify(state));
