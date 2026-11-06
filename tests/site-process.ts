import { fixture, fixtureImports } from "./fixtures.ts";
import { assert, assertEquals } from "./support.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { quarto } from "../_extensions/course-site/infrastructure/process.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-site-process-" });
const actualQuarto = Deno.env.get("QUARTO") || "quarto";
try {
  const missing = "/nonexistent/final-review-quarto";
  Deno.env.set("QUARTO", missing);
  let startupFailure: unknown;
  try {
    await quarto(["inspect", root], root);
  } catch (error) {
    assert(error instanceof Error);
    startupFailure = error;
  }
  assert(startupFailure instanceof Error, "missing executable did not fail");
  assert("tool" in startupFailure && "exitCode" in startupFailure && "stdout" in startupFailure && "stderr" in startupFailure && "forwarded" in startupFailure);
  assert(
    startupFailure.cause instanceof Deno.errors.NotFound,
    "lost operational NotFound cause",
  );
  const startup = join(root, "startup.ts");
  await Deno.writeTextFile(startup, await fixture("process-hook.ts", fixtureImports));
  const startupResult = await new Deno.Command(actualQuarto, {
    args: ["run", startup, root, "inspect"],
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
  await Deno.writeTextFile(fake, await fixture("native-failure.sh"));
  await Deno.chmod(fake, 0o755);
  Deno.env.set("QUARTO", fake);
  try {
    await Reflect.apply(quarto, undefined, [null, root]);
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
    const failure = error;
    assert("tool" in failure && "exitCode" in failure && "stdout" in failure && "stderr" in failure && "forwarded" in failure);
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
    await Deno.writeTextFile(script, await fixture("process-hook.ts", fixtureImports));
    const result = await new Deno.Command(actualQuarto, {
      args: ["run", script, root, "render", String(forward)],
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
  await Deno.writeTextFile(unknown, await fixture("unknown.ts", fixtureImports));
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
