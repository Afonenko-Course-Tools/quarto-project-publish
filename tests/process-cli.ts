// Real Publisher CLI with a deliberately fake native executable: output/exit
// contracts only, never a receipt for a Quarto render or public publication.
import { dirname, fromFileUrl, join } from "stdlib/path";
import { quarto } from "../_extensions/project-publish/infrastructure/process.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const actual = Deno.env.get("QUARTO") || "quarto";
const decoder = new TextDecoder();
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function readPrefix(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  length: number,
): Promise<string> {
  let text = "";
  while (text.length < length) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  return text;
}
const root = await Deno.makeTempDir({ prefix: "publisher-process-cli-" });
const fake = join(root, "fake-quarto.sh");
const prior = Deno.env.get("QUARTO");
try {
  await Deno.mkdir(join(root, "member"));
  await Deno.writeTextFile(join(root, "member/_quarto.yml"), "format: html\n");
  await Deno.writeTextFile(join(root, "member/_quarto-student.yml"), "{}\n");
  await Deno.writeTextFile(join(root, "_quarto-student.yml"), "{}\n");
  await Deno.writeTextFile(join(root, "index.qmd"), "# Fake portal\n");
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    JSON.stringify({
      title: "PRIVATE_INSPECT_SENTINEL",
      project: {
        type: "website",
        "output-dir": ".project-publish/native",
        render: [],
      },
      "project-publish": {
        portal: "index.qmd",
        "output-dir": "_site",
        projects: { member: { path: "member" } },
      },
    }),
  );
  await Deno.writeTextFile(
    fake,
    `#!/bin/sh
case "$1" in
  inspect)
    printf '{"config":'
    cat "$PWD/_quarto.yml" || exit 92
    printf ',"files":{"config":["%s/_quarto.yml"],"input":[]}}' "$PWD"
    printf 'PRIVATE_INSPECT_DIAGNOSTIC\\n' >&2
    exit 0 ;;
  --version)
    printf 'FAKE_VERSION\\n'
    printf 'PRIVATE_VERSION_DIAGNOSTIC\\n' >&2
    exit 0 ;;
  render)
    [ "$2" = "." ] && [ "$3" = "--fail-if-warnings" ] &&
      [ "$4" = "--profile" ] && [ "$5" = "student" ] || exit 93
    [ -z "$QUARTO_PROJECT_OUTPUT_DIR" ] && [ -z "$QUARTO_PROFILE" ] || exit 94
    case "$FAKE_RENDER_MODE" in
      stderr) printf 'NATIVE_STDERR_ONLY\\n' >&2 ;;
      both) printf 'NATIVE_STDOUT\\n'; printf 'NATIVE_STDERR\\n' >&2 ;;
      live)
        printf 'NATIVE_LIVE_STDOUT\\n'; printf 'NATIVE_LIVE_STDERR\\n' >&2
        while [ ! -f "$PWD/release-native" ]; do sleep 0.05; done ;;
      failed) printf 'NATIVE_FAILED_STDOUT\\n'; printf 'NATIVE_FAILED_STDERR\\n' >&2; exit 23 ;;
      warning) printf 'WARNING: NATIVE_WARNING\\n' >&2 ;;
      *) exit 95 ;;
    esac ;;
  *) exit 96 ;;
esac
`,
  );
  await Deno.chmod(fake, 0o700);
  Deno.env.set("QUARTO", fake);
  assert(
    await quarto(["--version"], root) === "FAKE_VERSION\n",
    "Capture lost version stdout",
  );
  const inspected = JSON.parse(await quarto(["inspect", root], root));
  assert(
    inspected.config.title === "PRIVATE_INSPECT_SENTINEL",
    "Capture lost inspect JSON",
  );
  const failures: string[] = [];
  for (const mode of ["stderr", "both", "failed", "warning"]) {
    const result = await new Deno.Command(actual, {
      args: [
        "run",
        join(repo, "_extensions/project-publish/entrypoints/render.ts"),
        "--profile",
        "student",
      ],
      cwd: root,
      env: {
        QUARTO: fake,
        FAKE_RENDER_MODE: mode,
        QUARTO_PROJECT_OUTPUT_DIR: "",
        QUARTO_PROFILE: "",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const out = decoder.decode(result.stdout),
      err = decoder.decode(result.stderr);
    try {
      assert(
        !out.includes("PRIVATE_") && !err.includes("PRIVATE_"),
        "Capture leaked inspection/version data to CLI",
      );
      if (mode === "stderr") {
        assert(result.code === 0, err);
        assert(
          out === "" && err === "NATIVE_STDERR_ONLY\n",
          "Successful stderr-only render bytes were lost",
        );
      } else if (mode === "both") {
        assert(result.code === 0, err);
        assert(
          out === "NATIVE_STDOUT\n" && err === "NATIVE_STDERR\n",
          "Successful render stdout/stderr bytes were lost or mixed",
        );
      } else if (mode === "failed") {
        assert(
          result.code === 1 && err.includes("кодом 23"),
          "CLI lost baseline nonzero exit/child code: " + err,
        );
        assert(
          err.includes("NATIVE_FAILED_STDOUT") &&
            err.includes("NATIVE_FAILED_STDERR"),
          "Primary child error lost diagnostics",
        );
        assert(
          out === "NATIVE_FAILED_STDOUT\n" &&
            err.startsWith("NATIVE_FAILED_STDERR\n"),
          "Failed render did not forward original streams",
        );
      } else {
        assert(
          result.code === 1 && err.includes("предупреждения при сборке"),
          "Successful native warning bypassed fail-if-warnings: " + err,
        );
        assert(
          err.startsWith("WARNING: NATIVE_WARNING\n"),
          "Warning bytes were not forwarded",
        );
      }
      console.log("ok " + mode);
    } catch (error) {
      failures.push(mode + ": " + String(error));
    }
  }
  // Buffering until child exit deadlocks this handshake: each original stream
  // must reach the CLI before the test lets the fake child finish.
  const child = new Deno.Command(actual, {
    args: [
      "run",
      join(repo, "_extensions/project-publish/entrypoints/render.ts"),
      "--profile",
      "student",
    ],
    cwd: root,
    env: {
      QUARTO: fake,
      FAKE_RENDER_MODE: "live",
      QUARTO_PROJECT_OUTPUT_DIR: "",
      QUARTO_PROFILE: "",
    },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const outReader = child.stdout.getReader(),
    errReader = child.stderr.getReader();
  let timer: number | undefined;
  try {
    const first = await Promise.race([
      Promise.all([
        readPrefix(outReader, "NATIVE_LIVE_STDOUT\n".length),
        readPrefix(errReader, "NATIVE_LIVE_STDERR\n".length),
      ]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Native output was buffered until exit")),
          10000,
        );
      }),
    ]);
    assert(
      first[0] === "NATIVE_LIVE_STDOUT\n",
      "Live stdout bytes changed",
    );
    assert(
      first[1] === "NATIVE_LIVE_STDERR\n",
      "Live stderr bytes changed",
    );
  } finally {
    clearTimeout(timer);
    await Deno.writeTextFile(join(root, "release-native"), "");
    while (!(await outReader.read()).done) { /* drain */ }
    while (!(await errReader.read()).done) { /* drain */ }
    assert((await child.status).code === 0, "Live native render failed");
  }
  console.log("ok live streams before native exit");
  assert(failures.length === 0, failures.join("\n"));
} finally {
  if (prior === undefined) Deno.env.delete("QUARTO");
  else Deno.env.set("QUARTO", prior);
  await Deno.remove(root, { recursive: true });
}
