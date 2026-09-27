import { dirname, fromFileUrl, join } from "stdlib/path";
import { formats } from "../_extensions/project-publish/domain/contract.ts";
const root = dirname(dirname(fromFileUrl(import.meta.url)));
const temp = await Deno.makeTempDir();
const cases: {value: unknown; valid: boolean}[] = [
  {value: {home: "book", projects: {book: {path: "book"}}}, valid: true},
  {value: {home: "notes", projects: {notes: {path: "notes"}}}, valid: true},
  {value: {home: "missing", projects: {book: {path: "book"}}}, valid: false},
  {value: {home: "book", projects: {book: {path: "book", mount: "book"}}}, valid: false},
  {value: {projects: {}}, valid: false},
  {value: {projects: {book: {path: "book", format: "docx"}}}, valid: false},
  {value: {projects: {book: {path: "book"}}, imports: {}}, valid: false},
  ...formats.map(format => ({value: {projects: {sample: {path: "sample", format}}}, valid: true})),
  ...formats.map(format => ({value: {home: "sample", projects: {sample: {path: "sample", format}}}, valid: format === "html"})),
];
try {
  for (const test of cases) {
    const file = join(temp, "input.json"); await Deno.writeTextFile(file, JSON.stringify(test.value));
    const r = await new Deno.Command(Deno.env.get("CUE") || "cue", {args: ["vet", join(root, "spec/publication.cue"), file, "-d", "#Publication", "-c"], stdout: "piped", stderr: "piped"}).output();
    if (r.success !== test.valid) throw new Error(`Контракт CUE расходится с ожидаемым: ${JSON.stringify(test.value)}\n${new TextDecoder().decode(r.stderr)}`);
  }
  console.log(`Успех: контракт публикации, ${cases.length} сценариев`);
} finally { await Deno.remove(temp, {recursive: true}); }
