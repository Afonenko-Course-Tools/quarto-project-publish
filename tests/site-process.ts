import { assert, assertEquals } from "./support.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { quarto } from "../_extensions/course-site/infrastructure/process.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({prefix: "course-site-process-"});
const actualQuarto = Deno.env.get("QUARTO") || "quarto";
try {
  const fake = join(root, "fake-quarto");
  await Deno.writeTextFile(fake, '#!/bin/sh\nprintf "CHILD_STDOUT_SENTINEL\\n"\nprintf "CHILD_STDERR_SENTINEL FOREIGN.ID\\n" >&2\nexit 23\n');
  await Deno.chmod(fake, 0o755);
  Deno.env.set("QUARTO", fake);
  try { await quarto(["render", "."], root); throw new Error("expected child failure"); } catch (error) {
    assert(error instanceof Error);
    const failure = error as Error & {tool: string; exitCode: number; stdout: string; stderr: string; forwarded: boolean};
    assertEquals(failure.name, "ExternalToolFailure");
    assertEquals(failure.tool, "quarto");
    assertEquals(failure.exitCode, 23);
    assertEquals(failure.stdout, "CHILD_STDOUT_SENTINEL\n");
    assertEquals(failure.stderr, "CHILD_STDERR_SENTINEL FOREIGN.ID\n");
    assertEquals(failure.forwarded, false);
    assert(failure.cause !== undefined, "missing native result cause");
  }
  Deno.env.set("QUARTO", actualQuarto);
  for (const forward of [false, true]) {
    const script = join(root, `forward-${forward}.ts`);
    await Deno.writeTextFile(script, `import {quarto} from ${JSON.stringify(`file://${repo}/_extensions/course-site/infrastructure/process.ts`)};\nimport {runHook} from ${JSON.stringify(`file://${repo}/_extensions/course-site/infrastructure/diagnostics.ts`)};\nawait runHook(() => quarto(["render", "."], ${JSON.stringify(root)}, {}, ${forward}));\n`);
    const result = await new Deno.Command(actualQuarto, {args: ["run", script], env: {QUARTO: fake}, stdout: "piped", stderr: "piped"}).output();
    assert(!result.success);
    const text = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    assertEquals(text.split("CHILD_STDOUT_SENTINEL").length - 1, 1);
    assertEquals(text.split("CHILD_STDERR_SENTINEL").length - 1, 1);
    assert(!text.includes("SITE."), `foreign ID was reclassified: ${text}`);
  }
  const unknown = join(root, "unknown.ts");
  await Deno.writeTextFile(unknown, `import {runHook} from ${JSON.stringify(`file://${repo}/_extensions/course-site/infrastructure/diagnostics.ts`)};\nfunction internalFailure() { throw new Error("INTERNAL_STACK_SENTINEL"); }\nawait runHook(async () => internalFailure());\n`);
  const result = await new Deno.Command(actualQuarto, {args: ["run", unknown], stdout: "piped", stderr: "piped"}).output();
  const text = new TextDecoder().decode(result.stderr);
  assert(!result.success && text.includes("internalFailure") && text.includes("unknown.ts"), text);
  console.log("PASS native exit/streams/cause retained, single forwarded output, unknown stack");
} finally {
  Deno.env.set("QUARTO", actualQuarto);
  await Deno.remove(root, {recursive: true});
}
