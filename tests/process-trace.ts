import { join } from "stdlib/path";
import { quarto } from "../_extensions/project-publish/infrastructure/process.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const root = await Deno.makeTempDir({ prefix: "publisher-trace-" });
const saved = new Map(
  ["QUARTO", "COURSE_BUILD_TRACE"].map((name) => [name, Deno.env.get(name)]),
);
const trace = join(root, "trace.jsonl");
const relativeTrace = `relative-trace-${crypto.randomUUID()}.jsonl`;
async function outcome(mode: string) {
  try {
    return await quarto(
      [
        "render",
        ".",
        "--profile",
        "student",
        "--metadata-file",
        "PRIVATE_ARGUMENT",
      ],
      root,
      { MODE: mode },
    );
  } catch (error) {
    return String(error);
  }
}
try {
  const fake = join(root, "quarto.sh");
  await Deno.writeTextFile(
    fake,
    `#!/bin/sh
printf 'PRIVATE_STDOUT\\n'
case "$MODE" in
  failure) printf 'WARNING: PRIVATE_FAILURE\\n' >&2; exit 23 ;;
  warning) printf 'WARNING: PRIVATE_WARNING\\n' >&2 ;;
  *) printf 'PRIVATE_STDERR\\n' >&2 ;;
esac
`,
  );
  await Deno.chmod(fake, 0o700);
  Deno.env.set("QUARTO", fake);
  Deno.env.delete("COURSE_BUILD_TRACE");
  const baseline = await Promise.all([
    outcome("success"),
    outcome("warning"),
    outcome("failure"),
  ]);
  Deno.env.set("COURSE_BUILD_TRACE", trace);
  assert(
    await quarto([
      "inspect",
      root,
      "--profile",
      "student",
      "--metadata-file",
      "PRIVATE_ARGUMENT",
    ], root) === "PRIVATE_STDOUT\n",
    "Tracing changed capture bytes",
  );
  assert(
    await quarto(["--version"], root) === "PRIVATE_STDOUT\n",
    "Tracing changed untracked version capture",
  );
  const traced = [];
  for (const mode of ["success", "warning", "failure"]) {
    traced.push(await outcome(mode));
  }
  assert(
    JSON.stringify(traced) === JSON.stringify(baseline),
    "Tracing changed warning/child failure precedence",
  );
  let bytes = "";
  try {
    bytes = await Deno.readTextFile(trace);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  assert(bytes !== "", "Native calls did not produce optional trace records");
  assert(
    !bytes.includes("PRIVATE_"),
    "Trace leaked command arguments or captured output",
  );
  const rows = bytes.trim().split("\n").map((line) => JSON.parse(line));
  assert(rows.length === 4, "Trace lost native invocations");
  assert(
    rows[0].kind === "inspect" &&
      JSON.stringify(rows[0].args) ===
        JSON.stringify([root, "--profile", "student"]),
    "Trace did not limit inspect arguments to target/profile",
  );
  for (const row of rows) {
    assert(
      JSON.stringify(Object.keys(row).sort()) ===
        JSON.stringify([
          "args",
          "cwd",
          "elapsedMs",
          "executable",
          "exitCode",
          "kind",
        ]),
      "Unexpected trace fields",
    );
    assert(
      row.executable === fake && row.cwd === root &&
        Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0,
      "Invalid native trace identity/timing",
    );
  }
  assert(
    JSON.stringify(rows.map((row) => row.exitCode)) === "[0,0,0,23]",
    "Trace lost native exit codes",
  );
  Deno.env.set("COURSE_BUILD_TRACE", root); // A directory is an unavailable optional sink.
  const broken = [];
  for (const mode of ["success", "warning", "failure"]) {
    broken.push(await outcome(mode));
  }
  assert(
    JSON.stringify(broken) === JSON.stringify(baseline),
    "Optional trace failure replaced native behavior",
  );
  Deno.env.set("COURSE_BUILD_TRACE", relativeTrace);
  assert(
    await outcome("success") === baseline[0],
    "Relative trace path changed native behavior",
  );
  let relativeCreated = true;
  try {
    await Deno.lstat(relativeTrace);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) relativeCreated = false;
    else throw error;
  }
  assert(!relativeCreated, "A relative optional trace path was written");
  console.log(
    "PASS native trace: bounded arguments, private captures, exit codes and optional-sink failure isolation",
  );
} finally {
  for (const [name, value] of saved) {
    value === undefined ? Deno.env.delete(name) : Deno.env.set(name, value);
  }
  await Deno.remove(root, { recursive: true });
  try {
    await Deno.remove(relativeTrace);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}
