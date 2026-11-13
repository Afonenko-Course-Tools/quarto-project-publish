// Проверяет правила штатной командой на новых production-файлах; исходники всегда удаляются.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scope } from "../eslint.config.mjs";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
/** @type {string[]} */
const files = [];
function run(helperTypes = false) {
  try {
    return {
      status: 0,
      output: execFileSync(
        helperTypes ? join(root, "node_modules/.bin/tsc") : process.execPath,
        helperTypes ? ["--project", "typecheck/node.json"] : ["tools/check-quality.mjs", ...process.argv.slice(2)],
        {
          cwd: root,
          encoding: "utf8",
          stdio: "pipe",
          maxBuffer: 32 * 1024 * 1024,
        },
      ),
    };
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 1;
    const stdout = error instanceof Error && "stdout" in error ? String(error.stdout) : "";
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr) : String(error);
    return { status, output: stdout + stderr };
  }
}
/** @param {string} path @param {string} source */
function put(path, source) {
  const file = join(root, path);
  if (existsSync(file)) throw Error("Контрольный путь уже занят: " + file);
  writeFileSync(file, source);
  files.push(file);
}
function clean() {
  for (const file of files.splice(0)) unlinkSync(file);
}
/** @type {[string, string][]} */
const cases = [
  ["no-explicit-any", "export const explicit: any = 1;"],
  ["ban-ts-comment", "// @ts-ignore\nexport const ignored = 1;"],
  ["no-unsafe-type-assertion", "export const narrowed = ({} as unknown) as string;"],
  ["no-unsafe-assignment", `export const assigned: string = JSON.parse('{}');`],
  [
    "no-unsafe-argument",
    `function consume(value: string): string { return value; } export const argument = consume(JSON.parse('{}'));`,
  ],
  ["no-unsafe-call", `export const called: unknown = JSON.parse('{}')();`],
  ["no-unsafe-member-access", `export const member: unknown = JSON.parse('{}').field;`],
  ["no-unsafe-return", `export function returned(): string { return JSON.parse('{}'); }`],
  [
    "switch-exhaustiveness-check",
    `export function omitted(value: 'a'|'b'): number | undefined { switch(value) { case 'a': return 1; } return undefined; }`,
  ],
  [
    "complexity",
    "export function complex(value: number): number { " +
      Array.from({ length: 31 }, (_, n) => `if(value === ${n}) return ${n};`).join(" ") +
      " return -1; }",
  ],
  [
    "max-depth",
    "export function deep(value: boolean): number { " +
      "if(value) { ".repeat(6) +
      "return 1;" +
      " }".repeat(6) +
      " return 0; }",
  ],
  [
    "max-params",
    "export function parameters(a: number,b: number,c: number,d: number,e: number,f: number): number { return a+b+c+d+e+f; }",
  ],
  ["noInlineConfig", "// eslint-disable-next-line complexity\nexport const disabled = 1;"],
  ["malformed AST", "export const malformed = ;"],
];
try {
  const positive = run();
  if (positive.status !== 0) throw Error("Исходный production gate не проходит:\n" + positive.output);
  console.log(JSON.stringify({ control: "positive", status: "passed" }));
  const helperPositive = run(true);
  if (helperPositive.status !== 0) throw Error("Node helpers gate не проходит:\n" + helperPositive.output);
  for (const [rule, source] of cases) {
    put(scope[0] + "__quality_negative.ts", source);
    const result = run();
    clean();
    const expected = rule === "malformed AST" ? /[Ss]yntax|[Pp]ars|TS1109|[Ee]xpression expected/ : new RegExp(rule);
    if (result.status === 0 || !expected.test(result.output))
      throw Error("Контроль не обнаружен: " + rule + "\n" + result.output);
    console.log(JSON.stringify({ control: rule, status: "rejected" }));
  }
  put(scope[0] + "__quality_negative.mjs", `export const unsafe = JSON.parse('{}').field;`);
  const mjs = run();
  clean();
  if (mjs.status === 0 || !mjs.output.includes("no-unsafe-member-access"))
    throw Error("Новый .mjs не обнаружен:\n" + mjs.output);
  console.log(JSON.stringify({ control: "new-mjs", status: "rejected" }));
  put("tools/__quality_helper.mjs", "/** @type {string} */ export const typed = 1;");
  const helperNegative = run(true);
  clean();
  if (helperNegative.status === 0 || !helperNegative.output.includes("TS2322"))
    throw Error("Новый helper .mjs не обнаружен:\n" + helperNegative.output);
  console.log(JSON.stringify({ control: "helper-types", status: "rejected" }));
  put(
    scope[0] + "__quality_cycle_a.ts",
    "import { b } from './__quality_cycle_b.ts'; export function a(): number { return b(); }",
  );
  put(
    scope[0] + "__quality_cycle_b.ts",
    "import { a } from './__quality_cycle_a.ts'; export function b(): number { return a(); }",
  );
  const cycle = run();
  clean();
  if (cycle.status === 0 || !cycle.output.includes("no-production-cycles"))
    throw Error("Cycle не обнаружен:\n" + cycle.output);
  console.log(JSON.stringify({ control: "no-production-cycles", status: "rejected" }));
  put(
    scope[0] + "__quality_boundary.ts",
    "import * as internal from 'course-core/domain/vocabulary.ts'; export const boundary = internal;",
  );
  const boundary = run();
  clean();
  if (boundary.status === 0 || !boundary.output.includes("providers-use-public-api"))
    throw Error("Internal import не обнаружен:\n" + boundary.output);
  console.log(JSON.stringify({ control: "providers-use-public-api", status: "rejected" }));
} finally {
  clean();
}
