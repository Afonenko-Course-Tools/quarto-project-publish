// Pure error-value counterexamples. The only executable fixture is a fake CLI.
// Hand-built public Publisher states are never Native/Owner acceptance receipts.
import { dirname, join } from "stdlib/path";
import type {
  BuildState,
  Workspace,
} from "../_extensions/project-publish/domain/model.ts";
import { prepare } from "../_extensions/project-publish/application/workflow.ts";
import { renderMembers } from "../_extensions/project-publish/infrastructure/render.ts";
import { runtime } from "../_extensions/project-publish/infrastructure/runtime.ts";
import { publish } from "../_extensions/project-publish/infrastructure/publish.ts";
import { owned } from "../_extensions/project-publish/infrastructure/attempt.ts";
import {
  failureError,
  notifyFailure,
  registerFailureIntegrations,
} from "../_extensions/project-publish/infrastructure/failure.ts";
import { integrations } from "../_extensions/project-publish/infrastructure/integrations.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function exists(path: string) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
async function caught(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected a rejection, including a thrown undefined value");
}
function displayed(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "UNPRINTABLE_TEST_VALUE";
  }
}
function unprintable(marker: string) {
  const coercion = new Error("COERCION_MUST_NOT_ESCAPE_" + marker);
  return {
    value: {
      [Symbol.toPrimitive]() {
        throw coercion;
      },
    },
    coercion,
  };
}
function exoticError(name: unknown, message: unknown) {
  const error = new Error("initial");
  Object.defineProperties(error, {
    name: { configurable: true, value: name },
    message: { configurable: true, value: message },
  });
  return error;
}
async function digest(path: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
    ),
  ).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
type Event = {
  hook: string;
  nameType: string;
  messageType: string;
  operation: string;
};
const sharedGlobals = globalThis as unknown as Record<string, unknown>;
async function fixture(hooks: string[] = [""]) {
  const root = await Deno.makeTempDir({ prefix: "pure-error-values-source-" });
  const retained = await Deno.makeTempDir({
    prefix: "pure-error-values-proof-",
  });
  const key = "publisherErrorValues_" + crypto.randomUUID();
  const shared: {
    events: Event[];
    primary?: unknown;
    collector?: unknown;
  } = { events: [] };
  sharedGlobals[key] = shared;
  async function write(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  const integrationNames = hooks.map((_, i) => `modules/hook-${i}.ts`);
  const config = {
    project: { type: "default", "output-dir": "_site" },
    "project-publish": {
      projects: { member: { path: "member", format: "html" } },
      integrations: integrationNames,
    },
  };
  const w: Workspace = {
    root,
    output: join(root, "_site"),
    nativeOutput: join(root, "_site"),
    members: [{
      namespace: "member",
      path: join(root, "member"),
      mount: "member",
      format: "html",
    }],
    profiles: ["student"],
    outputs: ["_site", "_site-full"],
    integrations: integrationNames.map((path) => join(root, path)),
    config,
  };
  await write("_quarto.yml", JSON.stringify(config));
  await write("index.qmd", "# Pure portal\n");
  await write("member/index.qmd", "# Pure member\n");
  await write("_site/index.html", "PURE_OLD_PUBLIC");
  await write("_site-full/index.html", "PURE_OTHER_PROFILE");
  for (let i = 0; i < hooks.length; i++) {
    await write(
      integrationNames[i],
      `const shared=(globalThis as any)[${JSON.stringify(key)}];
export default { beforeRender(){}, async onFailure(c:any){
  shared.events.push({hook:${JSON.stringify(String(i))},
    nameType:typeof c.failure.error.name,messageType:typeof c.failure.error.message,
    operation:c.failure.operation});
  ${hooks[i]}
}};\n`,
    );
  }
  const cli = join(retained, "fake-cli.sh");
  await Deno.writeTextFile(
    cli,
    "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then printf 'PURE-ERROR-VALUES-CLI-1\\n'; exit 0; fi\nprintf 'PURE_TEST_MUST_NOT_RENDER\\n' >&2\nexit 94\n",
  );
  await Deno.chmod(cli, 0o700);
  const prior = Deno.env.get("QUARTO");
  Deno.env.set("QUARTO", cli);
  return {
    root,
    retained,
    key,
    shared,
    w,
    write,
    async close() {
      if (prior === undefined) Deno.env.delete("QUARTO");
      else Deno.env.set("QUARTO", prior);
      delete sharedGlobals[key];
      await Deno.remove(root, { recursive: true });
      await Deno.remove(retained, { recursive: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function stateFor(f: Fixture, managed = false): Promise<BuildState> {
  const id = crypto.randomUUID();
  const sourceRoot = join(f.root, ".project-publish", "builds", id, "sources");
  await Deno.mkdir(sourceRoot, { recursive: true });
  for (const path of ["_quarto.yml", "index.qmd", "member/index.qmd"]) {
    await Deno.mkdir(dirname(join(sourceRoot, path)), { recursive: true });
    await Deno.copyFile(join(f.root, path), join(sourceRoot, path));
  }
  for (const path of f.w.integrations) {
    const name = path.slice(f.root.length + 1);
    await Deno.mkdir(dirname(join(sourceRoot, name)), { recursive: true });
    await Deno.copyFile(path, join(sourceRoot, name));
  }
  const output = join(
    f.root,
    ".project-publish",
    "builds",
    id,
    "output/member",
  );
  await Deno.mkdir(output, { recursive: true });
  await Deno.writeTextFile(join(output, "index.html"), "PURE_NEW_MEMBER");
  const state: BuildState = {
    id,
    quarto: "PURE-HANDBUILT-STATE-NOT-NATIVE",
    sourceRoot,
    workspace: structuredClone(f.w),
    members: [{ namespace: "member", format: "html", mount: "member", output }],
    ...(f.w.integrations.length
      ? { failureIntegrations: [...f.w.integrations] }
      : {}),
  };
  if (managed) {
    const w = state.workspace;
    w.portal = join(f.root, "index.qmd");
    w.nativeOutput = join(f.root, ".project-publish/native");
    w.config = {
      ...w.config,
      project: {
        type: "website",
        "output-dir": ".project-publish/native",
        render: [],
      },
      "project-publish": {
        ...(w.config["project-publish"] as Record<string, unknown>),
        portal: "index.qmd",
        "output-dir": "_site",
      },
    };
    await Deno.writeTextFile(
      join(f.root, "_quarto.yml"),
      JSON.stringify(w.config),
    );
    await Deno.writeTextFile(
      join(sourceRoot, "_quarto.yml"),
      JSON.stringify(w.config),
    );
    const control = join(sourceRoot, "_quarto-publish-portal.yml");
    await Deno.writeTextFile(control, '{"project":{"render":["index.qmd"]}}');
    const portalOutput = join(
      f.root,
      ".project-publish",
      "builds",
      id,
      "portal",
    );
    await Deno.mkdir(portalOutput, { recursive: true });
    await Deno.writeTextFile(
      join(portalOutput, "index.html"),
      "PURE_NEW_PORTAL",
    );
    state.portal = {
      input: join(sourceRoot, "index.qmd"),
      output: portalOutput,
      renderProfiles: ["student", "publish-portal"],
      control,
      controlHash: await digest(control),
      configHashes: {
        [control]: await digest(control),
        [join(sourceRoot, "_quarto.yml")]: await digest(
          join(sourceRoot, "_quarto.yml"),
        ),
      },
    };
  }
  // Register real configured snapshot modules in this invocation; the manually
  // constructed model is never a forged resumed-state registration authority.
  registerFailureIntegrations(
    state,
    await integrations(state.workspace, sourceRoot),
  );
  owned(state, f.root);
  return state;
}
function aggregate(error: unknown, primary: unknown, rest: unknown[]) {
  assert(error instanceof AggregateError, "Failure values did not compose");
  assert(error.errors.length === rest.length + 1, "Wrong composed error count");
  assert(error.errors[0] === primary, "Original primary identity/order lost");
  assert(
    Object.hasOwn(error, "cause") && error.cause === primary,
    "Primary cause lost",
  );
  for (let i = 0; i < rest.length; i++) {
    assert(
      error.errors[i + 1] === rest[i],
      "Original secondary value/order lost",
    );
  }
}
async function descriptors(primary: unknown, hooks = [""]) {
  const f = await fixture(hooks);
  try {
    f.shared.primary = primary;
    const state = await stateFor(f);
    const failures = await notifyFailure(state, primary, {
      phase: "preparation",
      operation: "before-render",
    });
    assert(failures.length === 0, "Value projection made a collector reject");
    assert(
      f.shared.events.length === hooks.length,
      "Collector order/count changed",
    );
    assert(
      f.shared.events.every((event) =>
        event.nameType === "string" && event.messageType === "string"
      ),
      "Raw Error field escaped the plain string descriptor",
    );
  } finally {
    await f.close();
  }
}
async function beforeRender(primary: unknown) {
  const collector = new Error("PURE_COLLECTOR_REJECTED");
  const f = await fixture(["throw shared.collector;"]);
  try {
    f.shared.primary = primary;
    f.shared.collector = collector;
    await f.write(
      "modules/hook-0.ts",
      `const shared=(globalThis as any)[${JSON.stringify(f.key)}];
export default {
  beforeRender(){throw shared.primary;},
  onFailure(c:any){shared.events.push({hook:'0',nameType:typeof c.failure.error.name,
    messageType:typeof c.failure.error.message,operation:c.failure.operation});throw shared.collector;}
};\n`,
    );
    const error = await caught(() =>
      prepare({
        ...runtime(),
        workspace: async () => f.w,
        render: renderMembers,
      })
    );
    assert(
      !await exists(join(f.root, ".project-publish/builds")),
      "Exotic primary prevented Source cleanup",
    );
    aggregate(error, primary, [collector]);
    assert(
      f.shared.events.length === 1,
      "BeforeRender callback missing/duplicated",
    );
  } finally {
    await f.close();
  }
}
async function rollbackValues(primary: unknown, rollback: unknown) {
  const f = await fixture([]);
  try {
    const state = await stateFor(f, true), w = state.workspace;
    const stage = join(f.root, ".project-publish/publish-" + state.id);
    const backup = join(f.root, ".project-publish/output-" + state.id);
    const error = await caught(() =>
      publish(w, state, async (from, to) => {
        if (from === stage) throw primary;
        if (from === backup) throw rollback;
        await Deno.rename(from, to);
      })
    );
    assert(
      await Deno.readTextFile(join(backup, "index.html")) === "PURE_OLD_PUBLIC",
      "Rollback refusal lost recovery backup",
    );
    assert(
      !await exists(w.output),
      "Refused commit unexpectedly published output",
    );
    assert(!await exists(stage), "Rollback refusal skipped stage cleanup");
    assert(
      await Deno.readTextFile(join(f.root, "_site-full/index.html")) ===
        "PURE_OTHER_PROFILE",
      "Recovery changed other profile",
    );
    aggregate(error, primary, [rollback]);
    await runtime().cleanup(w, state, true);
    assert(
      !await exists(state.sourceRoot),
      "Recovery workflow could not remove Source",
    );
    assert(await exists(backup), "Managed cleanup removed recovery backup");
  } finally {
    await f.close();
  }
}
async function stageCleanup(cleanup: unknown) {
  const primary = new Error("PURE_COMMIT_REFUSAL");
  const f = await fixture([]);
  const remove = Deno.remove, log = console.error;
  const logged: string[] = [];
  try {
    const state = await stateFor(f, true), w = state.workspace;
    const stage = join(f.root, ".project-publish/publish-" + state.id);
    const backup = join(f.root, ".project-publish/output-" + state.id);
    console.error = (...values: unknown[]) =>
      logged.push(values.map(displayed).join(" "));
    Deno.remove = (path, options) => {
      if (String(path) === stage) return Promise.reject(cleanup);
      return remove(path, options);
    };
    const error = await caught(() =>
      publish(w, state, async (from, to) => {
        if (from === stage) throw primary;
        await Deno.rename(from, to);
      })
    );
    Deno.remove = remove;
    assert(
      await Deno.readTextFile(join(w.output, "index.html")) ===
        "PURE_OLD_PUBLIC",
      "Stage cleanup error lost restored publication",
    );
    assert(!await exists(backup), "Successful restore left a recovery backup");
    assert(await exists(stage), "Injected stage removal did not refuse");
    aggregate(error, primary, [cleanup]);
    assert(
      logged.length === 1 && typeof logged[0] === "string",
      "Stage cleanup logger did not complete safely",
    );
    await runtime().cleanup(w, state, true);
    assert(
      !await exists(stage) && !await exists(state.sourceRoot),
      "Normal follow-up cleanup failed",
    );
  } finally {
    Deno.remove = remove;
    console.error = log;
    await f.close();
  }
}
async function committedWarning(cleanup: unknown) {
  const f = await fixture([""]);
  const remove = Deno.remove, log = console.error;
  const logged: string[] = [];
  try {
    const state = await stateFor(f, true), w = state.workspace;
    const backup = join(f.root, ".project-publish/output-" + state.id);
    console.error = (...values: unknown[]) =>
      logged.push(values.map(displayed).join(" "));
    Deno.remove = (path, options) => {
      if (String(path) === backup) return Promise.reject(cleanup);
      return remove(path, options);
    };
    await publish(w, state);
    Deno.remove = remove;
    assert(
      await Deno.readTextFile(join(w.output, "index.html")) ===
        "PURE_NEW_PORTAL",
      "Managed warning removed committed publication",
    );
    assert(
      await Deno.readTextFile(join(backup, "index.html")) === "PURE_OLD_PUBLIC",
      "Managed warning removed old backup",
    );
    assert(
      f.shared.events.length === 0,
      "Managed postcommit warning called onFailure",
    );
    assert(
      logged.length === 1,
      "Managed postcommit warning did not log safely",
    );
    await runtime().cleanup(w, state);
    assert(
      !await exists(state.sourceRoot) && await exists(backup),
      "Managed warning changed cleanup/backup policy",
    );
  } finally {
    Deno.remove = remove;
    console.error = log;
    await f.close();
  }
}

const cases: Record<string, () => Promise<void>> = {
  error_object_fields_are_strings: () =>
    descriptors(exoticError({ marker: "NAME" }, { marker: "MESSAGE" })),
  error_symbol_fields_are_strings: () =>
    descriptors(exoticError(Symbol("NAME"), Symbol("MESSAGE"))),
  error_noncoercible_fields_are_strings: () =>
    descriptors(exoticError(Object.create(null), unprintable("MESSAGE").value)),
  async error_object_fields_cannot_mutate_next_hook_or_primary() {
    const name = { marker: "ORIGINAL_NAME" },
      message = { marker: "ORIGINAL_MESSAGE" };
    await descriptors(exoticError(name, message), [
      "if(typeof c.failure.error.name==='object')c.failure.error.name.marker='MUTATED'; if(typeof c.failure.error.message==='object')c.failure.error.message.marker='MUTATED';",
      "assert_unused: { if(shared.primary.name.marker!=='ORIGINAL_NAME'||shared.primary.message.marker!=='ORIGINAL_MESSAGE')throw new Error('RAW_PRIMARY_OBJECT_MUTATED'); }",
    ]);
    assert(
      name.marker === "ORIGINAL_NAME" && message.marker === "ORIGINAL_MESSAGE",
      "First hook mutated raw primary fields",
    );
  },
  async throwing_error_field_getter_is_contained() {
    const primary = new Error("GETTER_PRIMARY");
    Object.defineProperty(primary, "name", {
      get() {
        throw new Error("GETTER_REFUSAL");
      },
    });
    await descriptors(primary);
  },
  before_render_unprintable_primary_and_collector_keep_causes: () =>
    beforeRender(exoticError("EXOTIC", unprintable("BEFORE").value)),
  before_render_undefined_primary_and_collector_keep_causes: () =>
    beforeRender(undefined),
  async foreign_aggregate_primary_is_not_flattened() {
    const primary = new AggregateError(
      [new Error("USER_INNER")],
      "USER_AGGREGATE",
    );
    const collector = new Error("COLLECTOR");
    aggregate(failureError(primary, [collector]), primary, [collector]);
  },
  rollback_unprintable_primary_keeps_exact_rollback: () =>
    rollbackValues(unprintable("COMMIT").value, new Error("ROLLBACK_ORIGINAL")),
  rollback_unprintable_value_keeps_exact_primary: () =>
    rollbackValues(new Error("COMMIT_ORIGINAL"), unprintable("ROLLBACK").value),
  rollback_undefined_primary_keeps_exact_rollback: () =>
    rollbackValues(undefined, unprintable("ROLLBACK_UNDEFINED_PRIMARY").value),
  rollback_symbol_values_keep_exact_causes: () =>
    rollbackValues(Symbol("COMMIT"), Symbol("ROLLBACK")),
  rollback_arbitrary_object_and_undefined_are_retained: () =>
    rollbackValues({ marker: "ARBITRARY_COMMIT" }, undefined),
  stage_cleanup_unprintable_keeps_primary_and_logs_safely: () =>
    stageCleanup(unprintable("STAGE").value),
  stage_cleanup_undefined_keeps_primary_and_logs_safely: () =>
    stageCleanup(undefined),
  committed_backup_unprintable_warning_remains_success: () =>
    committedWarning(unprintable("BACKUP_WARNING").value),
  committed_backup_symbol_warning_remains_success: () =>
    committedWarning(Symbol("BACKUP_WARNING")),
};
const selected = Deno.args.includes("--case")
  ? Deno.args[Deno.args.indexOf("--case") + 1]
  : undefined;
assert(
  !selected || Object.hasOwn(cases, selected),
  "Unknown error-value test case",
);
const results: { name: string; passed: boolean; error?: string }[] = [];
for (const [name, test] of Object.entries(cases)) {
  if (selected && name !== selected) continue;
  try {
    await test();
    results.push({ name, passed: true });
    console.log("PASS pure failure error values " + name);
  } catch (error) {
    results.push({ name, passed: false, error: displayed(error) });
    console.log(
      "FAIL pure failure error values " + name + ": " + displayed(error),
    );
  }
}
const proof = Deno.env.get("FAILURE_ERROR_VALUES_PROOF_DIR");
if (proof) {
  await Deno.mkdir(proof, { recursive: true });
  await Deno.writeTextFile(
    join(proof, "results.json"),
    JSON.stringify(
      {
        scope: "pure Publisher error-value containment; fake CLI only",
        nativeInvoked: false,
        ownerAcceptance: false,
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
assert(
  results.every((result) => result.passed),
  "Pure error-value containment failures: " +
    results.filter((result) => !result.passed).length,
);
console.log(
  `PASS pure error-value total ${results.length}; real Native not invoked`,
);
