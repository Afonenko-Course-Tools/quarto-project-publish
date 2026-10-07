import { assert, assertEquals } from "./support.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { quarto } from "../_extensions/course-site/infrastructure/process.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-site-process-" });
const actualQuarto = Deno.env.get("QUARTO") || "quarto";
try {
  const missing = "/nonexistent/final-review-quarto";
  Deno.env.set("QUARTO", missing);
  let startupFailure:
    | Error & {
      tool: string;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      forwarded: boolean;
    }
    | undefined;
  try {
    await quarto(["inspect", root], root);
  } catch (error) {
    assert(error instanceof Error);
    startupFailure = error as typeof startupFailure;
  }
  assert(startupFailure, "missing executable did not fail");
  assert(
    startupFailure.cause instanceof Deno.errors.NotFound,
    "lost operational NotFound cause",
  );
  const startup = join(root, "startup.ts");
  await Deno.writeTextFile(
    startup,
    `import {quarto} from ${
      JSON.stringify(
        `file://${repo}/_extensions/course-site/infrastructure/process.ts`,
      )
    };
import {runHook} from ${
      JSON.stringify(
        `file://${repo}/_extensions/course-site/infrastructure/diagnostics.ts`,
      )
    };
await runHook(() => quarto(["inspect", ${JSON.stringify(root)}], ${
      JSON.stringify(root)
    }));
`,
  );
  const startupResult = await new Deno.Command(actualQuarto, {
    args: ["run", startup],
    env: { QUARTO: missing },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const startupText = new TextDecoder().decode(startupResult.stdout) +
    new TextDecoder().decode(startupResult.stderr);
  assert(!startupResult.success, "startup hook succeeded");
  assert(
    startupText.includes(missing),
    `configured executable lost at runHook boundary: ${startupText}`,
  );
  assertEquals(startupText.split(startupFailure.cause.message).length - 1, 1);
  assertEquals(startupFailure.name, "ExternalToolFailure");
  assertEquals(startupFailure.tool, missing);
  assertEquals(startupFailure.exitCode, null);
  assertEquals(startupFailure.stdout, "");
  assertEquals(startupFailure.stderr, "");
  assertEquals(startupFailure.forwarded, false);
  assert(
    !startupText.includes("SITE."),
    "startup failure received semantic SITE ID",
  );
  assert(
    !startupText.includes("at runHook"),
    `expected failure leaked wrapper stack: ${startupText}`,
  );
  const fake = join(root, "fake-quarto");
  await Deno.writeTextFile(
    fake,
    '#!/bin/sh\nprintf "CHILD_STDOUT_SENTINEL\\n"\nprintf "CHILD_STDERR_SENTINEL FOREIGN.ID\\n" >&2\nexit 23\n',
  );
  await Deno.chmod(fake, 0o755);
  Deno.env.set("QUARTO", fake);
  try {
    await quarto(null as unknown as string[], root);
    throw new Error("expected invalid internal argument");
  } catch (error) {
    assert(error instanceof Error);
    assertEquals(error.name, "TypeError");
    assert(error.stack?.includes("process.ts"), "lost internal stack");
  }
  try {
    await quarto(["render", "."], root);
    throw new Error("expected child failure");
  } catch (error) {
    assert(error instanceof Error);
    const failure = error as Error & {
      tool: string;
      exitCode: number;
      stdout: string;
      stderr: string;
      forwarded: boolean;
    };
    assertEquals(failure.name, "ExternalToolFailure");
    assertEquals(failure.tool, fake);
    assertEquals(failure.exitCode, 23);
    assertEquals(failure.stdout, "CHILD_STDOUT_SENTINEL\n");
    assertEquals(failure.stderr, "CHILD_STDERR_SENTINEL FOREIGN.ID\n");
    assertEquals(failure.forwarded, false);
    assert(failure.cause !== undefined, "missing native result cause");
  }
  Deno.env.set("QUARTO", actualQuarto);
  for (const forward of [false, true]) {
    const script = join(root, `forward-${forward}.ts`);
    await Deno.writeTextFile(
      script,
      `import {quarto} from ${
        JSON.stringify(
          `file://${repo}/_extensions/course-site/infrastructure/process.ts`,
        )
      };\nimport {runHook} from ${
        JSON.stringify(
          `file://${repo}/_extensions/course-site/infrastructure/diagnostics.ts`,
        )
      };\nawait runHook(() => quarto(["render", "."], ${
        JSON.stringify(root)
      }, {}, ${forward}));\n`,
    );
    const result = await new Deno.Command(actualQuarto, {
      args: ["run", script],
      env: { QUARTO: fake },
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(!result.success);
    const text = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    assertEquals(text.split("CHILD_STDOUT_SENTINEL").length - 1, 1);
    assertEquals(text.split("CHILD_STDERR_SENTINEL").length - 1, 1);
    assert(!text.includes("SITE."), `foreign ID was reclassified: ${text}`);
  }
  const unknown = join(root, "unknown.ts");
  await Deno.writeTextFile(
    unknown,
    `import {runHook} from ${
      JSON.stringify(
        `file://${repo}/_extensions/course-site/infrastructure/diagnostics.ts`,
      )
    };\nfunction internalFailure() { throw new Error("INTERNAL_STACK_SENTINEL"); }\nawait runHook(async () => internalFailure());\n`,
  );
  const result = await new Deno.Command(actualQuarto, {
    args: ["run", unknown],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stderr);
  assert(
    !result.success && text.includes("internalFailure") &&
      text.includes("unknown.ts"),
    text,
  );
  console.log(
    "PASS startup hook retains executable/OS cause once; native exit/streams/cause retained, single forwarded output, unknown stack",
  );
} finally {
  Deno.env.set("QUARTO", actualQuarto);
  await Deno.remove(root, { recursive: true });
}
