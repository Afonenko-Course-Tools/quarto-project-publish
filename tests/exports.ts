import { exportedTargets } from "../_extensions/reference-catalog/domain/exports.ts";
import { parseExports, parsePublication } from "../_extensions/reference-catalog/infrastructure/export-config.ts";
import { assemble, resolve } from "../_extensions/reference-catalog/domain/catalog.ts";
import type { Target } from "../_extensions/reference-catalog/domain/model.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function rejects(fn: () => unknown, expected: string) {
  try { fn(); } catch (error) {
    assert(String(error).includes(expected), `Unexpected failure: ${error}`);
    return;
  }
  throw new Error(`Expected failure: ${expected}`);
}
const target = (namespace: string, id: string): Target => ({
  namespace, id, page: "memory.html", fragment: id,
  labelHtml: "Chapter 2", label: "Chapter 2", numberHtml: "2", number: "2",
  title: "Memory",
});
const local = [target("book", "sec-private"), target("book", "sec-memory"), target("lectures", "sec-memory")];
const selected = exportedTargets(local, parseExports({ book: ["sec-memory"] }, ["book", "lectures"]));
assert(Object.keys(selected).join() === "book:sec-memory", "Explicit exports exposed another target");
assert(resolve(assemble(local), "book:sec-private", "index.html"), "Export selection removed a local reference");
assert(Object.keys(exportedTargets(local)).length === 3, "Default must export every local target");
assert(Object.keys(exportedTargets(local, {})).length === 0, "Empty selection must export nothing");
assert(Object.keys(exportedTargets(local, { lectures: "*" })).join() === "lectures:sec-memory", "Wildcard leaked another namespace");
assert(JSON.stringify(local.map(t => t.id)) === '["sec-private","sec-memory","sec-memory"]', "Export mutated local targets");
rejects(() => parseExports({ os: "*" }, ["book"]), "не относится к локальному проекту");
rejects(() => parseExports({ book: ["sec-memory", "sec-memory"] }, ["book"]), "неповторяющихся ID целей");
rejects(() => parseExports({ book: "sec-*" }, ["book"]), "неповторяющихся ID целей");
rejects(() => parseExports(null, ["book"]), "должен сопоставлять");
rejects(() => exportedTargets(local, { book: ["sec-removed"] }), "book:sec-removed");
assert(parsePublication({ title: "  Operating systems  " })?.title === "Operating systems", "Publication title normalization failed");
rejects(() => parsePublication({ title: " " }), "непустое название title");
rejects(() => parsePublication({ title: "OS", typo: "value" }), "непустое название title");
console.log("PASS explicit exports: namespace/ID selection, local scope, empty/default export and invalid selections");
