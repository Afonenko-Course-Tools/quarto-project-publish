// Pure failure-seam tests. The executable fixture is a fake CLI, never Quarto.
import { dirname, join } from "stdlib/path";
import type {
  BuildState,
  Workspace,
} from "../_extensions/project-publish/domain/model.ts";
import {
  finalize,
  prepare,
} from "../_extensions/project-publish/application/workflow.ts";
import { renderMembers } from "../_extensions/project-publish/infrastructure/render.ts";
import { runtime } from "../_extensions/project-publish/infrastructure/runtime.ts";
import { publish } from "../_extensions/project-publish/infrastructure/publish.ts";
import { owned } from "../_extensions/project-publish/infrastructure/attempt.ts";
import {
  copySources,
  copyTree,
} from "../_extensions/project-publish/infrastructure/files.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
let proofCase = "unselected";
let proofFixture = 0;
async function exists(path: string): Promise<boolean> {
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
  throw new Error("Expected a failure");
}
async function fixture(
  hook = true,
  mode: "failure" | "success" | "second" = "failure",
) {
  const root = await Deno.makeTempDir({ prefix: "pure-failure-hooks-source-" });
  const retained = await Deno.makeTempDir({
    prefix: "pure-failure-hooks-retained-",
  });
  async function write(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  const cli = join(retained, "fake-quarto.sh");
  await Deno.writeTextFile(
    cli,
    `#!/bin/sh
if [ "$1" = "--version" ]; then printf 'PURE-FAKE-CLI-1\\n'; exit 0; fi
if [ "$1" != "render" ]; then printf 'unexpected fake CLI invocation\\n' >&2; exit 90; fi
mkdir -p "$PWD/.pure-native"
printf 'PURE_INPUT\\000END' > "$PWD/.pure-native/input.json"
printf '{"pure":true,"status":"unsupported"}' > "$PWD/.pure-native/witness.json"
printf '{"pure":true,"observation":"retained"}' > "$PWD/.pure-native/observation.json"
if ${
      mode === "success"
        ? "true"
        : mode === "second"
        ? '[ "$(basename "$PWD")" = "member" ]'
        : "false"
    }; then
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--output-dir" ]; then shift; output="$1"; break; fi
    shift
  done
  if [ -z "$output" ]; then printf 'missing fake output argument\\n' >&2; exit 91; fi
  mkdir -p "$output"
  printf 'PURE_MEMBER_OUTPUT' > "$output/index.html"
  exit 0
fi
printf 'PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA\\n' >&2
exit 23
`,
  );
  await Deno.chmod(cli, 0o700);
  await write("_quarto.yml", "project:\n  output-dir: _site\n");
  await write("member/index.qmd", "# Pure member\n");
  await write(
    "modules/diagnostics.ts",
    `export default {
  beforeRender() {},
  async metadata(c: any) {
    await Deno.writeTextFile(${
      JSON.stringify(join(retained, "metadata.json"))
    }, JSON.stringify(c));
    return {title:"PURE_METADATA"};
  },
  ${
      hook
        ? `async onFailure(c: any) {
    const folder = c.sourceRoot+"/"+c.namespace+"/.pure-native";
    for (const name of ["input.json","witness.json","observation.json"]) {
      await Deno.copyFile(folder+"/"+name, ${
          JSON.stringify(retained)
        }+"/"+name);
    }
    await Deno.writeTextFile(${
          JSON.stringify(join(retained, "failure.json"))
        }, JSON.stringify(c));
  },`
        : ""
    }
};\n`,
  );
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
    outputs: ["_site"],
    integrations: [join(root, "modules/diagnostics.ts")],
    config: { project: { "output-dir": "_site" }, proof: "FROZEN" },
  };
  const prior = Deno.env.get("QUARTO");
  Deno.env.set("QUARTO", cli);
  return {
    root,
    retained,
    w,
    write,
    async close() {
      if (prior === undefined) Deno.env.delete("QUARTO");
      else Deno.env.set("QUARTO", prior);
      const proof = Deno.env.get("FAILURE_HOOKS_PROOF_DIR");
      if (proof) {
        const folder = join(proof, proofCase, `fixture-${++proofFixture}`);
        await Deno.mkdir(folder, { recursive: true });
        for await (const item of Deno.readDir(retained)) {
          if (item.isFile) {
            await Deno.copyFile(
              join(retained, item.name),
              join(folder, item.name),
            );
          }
        }
      }
      await Deno.remove(root, { recursive: true });
      await Deno.remove(retained, { recursive: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function integration(f: Fixture, body: string, name = "diagnostics") {
  await f.write(
    `modules/${name}.ts`,
    `export default {beforeRender() {}, ${body}};\n`,
  );
  const path = join(f.root, `modules/${name}.ts`);
  if (!f.w.integrations.includes(path)) f.w.integrations.push(path);
  return path;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => resolve = done);
  return { promise, resolve };
}
function portsFor(f: Fixture) {
  return { ...runtime(), workspace: async () => f.w };
}
async function declaredSelection(f: Fixture) {
  // Public configuration for authority tests; the fake inspect reports this exact
  // single-file JSON/YAML declaration, without simulating merges or Native work.
  f.w.config = {
    ...f.w.config,
    project: { type: "website", "output-dir": "_site" },
    "project-publish": {
      projects: { member: { path: "member", format: "html" } },
      integrations: f.w.integrations.map((path) =>
        path.slice(f.root.length + 1)
      ),
    },
  };
  await f.write("_quarto.yml", JSON.stringify(f.w.config));
  await f.write("_quarto-student.yml", '{"metadata":{}}');
  await f.write(
    "member/_quarto.yml",
    '{"project":{"type":"default"},"format":"html"}',
  );
  await f.write("member/_quarto-student.yml", '{"metadata":{}}');
  const cli = join(f.retained, "fake-quarto.sh");
  const script = await Deno.readTextFile(cli);
  await Deno.writeTextFile(
    cli,
    script.replace(
      'if [ "$1" != "render" ];',
      `if [ "$1" = "inspect" ]; then
printf '{"config":'
cat "$PWD/_quarto.yml" || exit 92
printf ',"files":{"config":["%s/_quarto.yml"],"input":[]}}' "$PWD"
exit 0
fi
if [ "$1" != "render" ];`,
    ),
  );
}
function activeStudentProfile() {
  const prior = Deno.env.get("QUARTO_PROFILE");
  Deno.env.set("QUARTO_PROFILE", "student");
  return () => {
    if (prior === undefined) Deno.env.delete("QUARTO_PROFILE");
    else Deno.env.set("QUARTO_PROFILE", prior);
  };
}
async function freshResumedCopy(state: BuildState): Promise<BuildState> {
  // A fresh valid Source URL prevents this process's earlier module cache from
  // hiding a missing file/function that a resumed process must report.
  const resumed = structuredClone(state);
  resumed.id = crypto.randomUUID();
  resumed.sourceRoot = join(
    state.workspace.root,
    ".project-publish/builds",
    resumed.id,
    "sources",
  );
  await copySources(state.sourceRoot, resumed.sourceRoot, new Set());
  for (const member of resumed.members) {
    const original = state.members.find((item) =>
      item.namespace === member.namespace
    )!;
    member.output = join(
      state.workspace.root,
      ".project-publish/builds",
      resumed.id,
      "output",
      member.namespace,
    );
    await copyTree(original.output, member.output);
  }
  owned(resumed, state.workspace.root);
  return resumed;
}
async function failureApi() {
  return await import(
    new URL(
      "../_extensions/project-publish/infrastructure/failure.ts",
      import.meta.url,
    ).href
  );
}
async function sha256(path: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function managedState(f: Fixture): Promise<BuildState> {
  // Hand-built public model fixture; this is not a Native inspect/acceptance receipt.
  const state = await renderMembers(f.w);
  const w = state.workspace;
  w.portal = join(f.root, "index.qmd");
  w.nativeOutput = join(f.root, ".project-publish/native");
  w.config = {
    ...w.config,
    project: { "output-dir": ".project-publish/native" },
    "project-publish": { portal: "index.qmd", "output-dir": "_site" },
  };
  const control = join(state.sourceRoot, "_quarto-publish-portal.yml");
  await Deno.writeTextFile(control, '{"project":{"render":["index.qmd"]}}');
  await Deno.writeTextFile(
    join(state.sourceRoot, "index.qmd"),
    "# Pure portal\n",
  );
  const digest = await sha256(control);
  const output = join(f.root, ".project-publish/builds", state.id, "portal");
  await Deno.mkdir(output, { recursive: true });
  await Deno.writeTextFile(join(output, "index.html"), "PURE_NEW_PORTAL");
  state.portal = {
    input: join(state.sourceRoot, "index.qmd"),
    output,
    renderProfiles: ["student", "publish-portal"],
    control,
    controlHash: digest,
    configHashes: { [control]: digest },
  };
  owned(state, f.root);
  await Deno.mkdir(w.output, { recursive: true });
  await Deno.writeTextFile(join(w.output, "index.html"), "PURE_OLD_PUBLIC");
  return state;
}

const cases: Record<string, () => Promise<void>> = {
  // Removing/moving the render catch after clearState loses these exact bytes.
  async native_failure_retained_before_prepare_cleanup() {
    const f = await fixture();
    try {
      let primary: unknown;
      const ports = {
        ...runtime(),
        workspace: async () => f.w,
        render: async (w: Workspace): Promise<BuildState> => {
          try {
            return await renderMembers(w);
          } catch (error) {
            primary = error;
            throw error;
          }
        },
      };
      const error = await caught(() => prepare(ports));
      assert(
        String(primary).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Fake CLI did not reach its explicit post-metadata failure",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "prepare did not clean the failed Source attempt",
      );
      assert(
        await exists(join(f.retained, "failure.json")),
        "onFailure did not retain diagnostics before Source cleanup",
      );
      assert(
        error === primary,
        "A successful diagnostic hook replaced the exact primary error",
      );
      const c = JSON.parse(
        await Deno.readTextFile(join(f.retained, "failure.json")),
      );
      assert(
        c.failure.phase === "render" && c.failure.operation === "member-render",
        "Wrong failure phase/operation",
      );
      assert(
        c.namespace === "member" && c.format === "html",
        "Failed member context is missing",
      );
      assert(
        c.output.startsWith(join(f.root, ".project-publish/builds")) &&
          !c.output.startsWith(c.sourceRoot + "/"),
        "Failure output is not the actual member output",
      );
      assert(
        c.members[0].path === c.sourceRoot + "/member",
        "Failure member path does not refer to the fixed Source snapshot",
      );
      assert(
        c.failure.error.name === "Error" &&
          c.failure.error.message.includes(
            "PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA",
          ),
        "Primary error projection lost its cause",
      );
      const expected = new Uint8Array([
        80,
        85,
        82,
        69,
        95,
        73,
        78,
        80,
        85,
        84,
        0,
        69,
        78,
        68,
      ]);
      const bytes = await Deno.readFile(join(f.retained, "input.json"));
      assert(
        bytes.length === expected.length &&
          bytes.every((value, index) => value === expected[index]),
        "Retained input bytes changed",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "witness.json")) ===
          '{"pure":true,"status":"unsupported"}',
        "Retained witness bytes changed",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "observation.json")) ===
          '{"pure":true,"observation":"retained"}',
        "Retained observation bytes changed",
      );
    } finally {
      await f.close();
    }
  },
  // The current child has not entered state.members when its CLI fails.
  async second_member_failure_reports_current_child() {
    const f = await fixture(true, "second");
    try {
      await f.write("second/index.qmd", "# Second pure member\n");
      f.w.members.push({
        namespace: "second",
        path: join(f.root, "second"),
        mount: "second",
        format: "html",
      });
      const error = await caught(() => prepare(portsFor(f)));
      assert(
        String(error).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Second fake child did not fail",
      );
      const c = JSON.parse(
        await Deno.readTextFile(join(f.retained, "failure.json")),
      );
      assert(
        c.namespace === "second" && c.output.endsWith("/output/second"),
        "Failure used the previously successful child",
      );
      assert(
        c.members.length === 2 &&
          c.members[1].path === c.sourceRoot + "/second",
        "Failure context lost the second configured member",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Partial two-member attempt was not cleaned",
      );
    } finally {
      await f.close();
    }
  },
  async portal_child_failure_reports_actual_portal_context() {
    const f = await fixture();
    try {
      // Fixed fake inspect response describes this test's actual control/input paths.
      // This covers Publisher orchestration only and is not a Native receipt.
      const cli = join(f.retained, "fake-quarto.sh");
      const script = await Deno.readTextFile(cli);
      await Deno.writeTextFile(
        cli,
        script.replace(
          'if [ "$1" != "render" ];',
          `if [ "$1" = "inspect" ]; then
printf '{"files":{"input":["%s/index.qmd"],"config":["%s/_quarto-publish-portal.yml"]},"config":{"project":{"render":["index.qmd"]}}}' "$PWD" "$PWD"
exit 0
fi
if [ "$1" != "render" ];`,
        ),
      );
      f.w.portal = join(f.root, "index.qmd");
      f.w.nativeOutput = join(f.root, ".project-publish/native");
      f.w.config = {
        project: { "output-dir": ".project-publish/native" },
        "project-publish": { portal: "index.qmd", "output-dir": "_site" },
        proof: "FROZEN",
      };
      await f.write("index.qmd", "# Pure portal\n");
      await integration(
        f,
        `async metadata(c:any) {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "portal-metadata.json"))
        }, JSON.stringify(c));
        return {title:"PURE_PORTAL_METADATA"};
      }, async onFailure(c:any) {
        await Deno.copyFile(c.sourceRoot+"/.pure-native/input.json", ${
          JSON.stringify(join(f.retained, "portal-input.json"))
        });
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "portal-failure.json"))
        }, JSON.stringify(c));
      }`,
      );
      const error = await caught(() => prepare(portsFor(f)));
      assert(
        String(error).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Fake portal child did not reach its post-metadata failure",
      );
      const c = JSON.parse(
        await Deno.readTextFile(join(f.retained, "portal-failure.json")),
      );
      assert(
        c.failure.phase === "render" && c.failure.operation === "portal-render",
        "Portal failure was misclassified as a member failure",
      );
      assert(
        c.namespace === undefined && c.format === "html" &&
          c.output === c.portal.output,
        "Failure callback did not get the actual portal output",
      );
      assert(
        c.profiles.join(",") === "student" &&
          c.portal.renderProfiles.join(",") === "student,publish-portal",
        "Portal failure context changed owner audience profiles",
      );
      assert(
        await exists(join(f.retained, "portal-input.json")) &&
          !await exists(join(f.root, ".project-publish/builds")),
        "Portal retention did not finish before cleanup",
      );
    } finally {
      await f.close();
    }
  },
  // Removing await allows clearState to destroy files while the hook is pending.
  async asynchronous_hook_finishes_before_cleanup() {
    const f = await fixture();
    const key = "pureFailureGate_" + crypto.randomUUID();
    const gate = { entered: deferred(), release: deferred() };
    const shared = globalThis as unknown as Record<string, unknown>;
    shared[key] = gate;
    let outcome: Promise<unknown> | undefined;
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        const gate=(globalThis as any)[${JSON.stringify(key)}];
        await Deno.stat(c.sourceRoot+"/member/.pure-native/input.json");
        gate.entered.resolve(); await gate.release.promise;
        await Deno.copyFile(c.sourceRoot+"/member/.pure-native/input.json", ${
          JSON.stringify(join(f.retained, "awaited-input.json"))
        });
      }`,
      );
      outcome = prepare(portsFor(f)).then(
        () => "unexpected success",
        (error) => error,
      );
      const entered = await Promise.race([
        gate.entered.promise.then(() => true),
        outcome.then(() => false),
      ]);
      assert(entered, "prepare completed without entering onFailure");
      assert(
        await exists(join(f.root, ".project-publish/builds")),
        "Source cleanup started before awaited onFailure completed",
      );
      gate.release.resolve();
      const error = await outcome;
      assert(
        String(error).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Primary failure was lost after the deferred hook",
      );
      assert(
        await exists(join(f.retained, "awaited-input.json")),
        "Deferred callback could not finish its retained copy",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Cleanup did not resume after callback completion",
      );
    } finally {
      gate.release.resolve();
      if (outcome) await outcome;
      delete shared[key];
      await f.close();
    }
  },
  // A failed collector must not skip later collectors or mutate their contexts.
  async throwing_hooks_keep_primary_and_isolate_context() {
    const f = await fixture();
    try {
      const events = JSON.stringify(join(f.retained, "events.jsonl"));
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.writeTextFile(${events}, JSON.stringify({hook:"A",context:c})+"\\n", {append:true});
        c.root="MUTATED"; c.sourceRoot="MUTATED"; c.profiles.length=0;
        c.config.proof="MUTATED"; c.members[0].path="MUTATED";
        c.failure.error.message="MUTATED";
        throw new Error("PURE_COLLECTOR_A");
      }`,
      );
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.writeTextFile(${events}, JSON.stringify({hook:"B",context:c})+"\\n", {append:true});
        throw new Error("PURE_COLLECTOR_B");
      }`,
        "second",
      );
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.writeTextFile(${events}, JSON.stringify({hook:"C",context:c})+"\\n", {append:true});
        return {root:"UNTRUSTED_RETURN",sourceRoot:"UNTRUSTED_RETURN"};
      }`,
        "third",
      );
      let primary: unknown;
      const ports = {
        ...portsFor(f),
        render: async (w: Workspace) => {
          try {
            return await renderMembers(w);
          } catch (error) {
            // render's notification aggregate must contain the real CLI error.
            primary = error instanceof AggregateError ? error.errors[0] : error;
            throw error;
          }
        },
      };
      const error = await caught(() => prepare(ports));
      assert(
        error instanceof AggregateError,
        "Collector failures were not reported with the primary failure",
      );
      assert(
        error.errors.length === 3 && error.errors[0] === primary &&
          error.cause === primary,
        "Collector aggregate lost primary identity/order/cause",
      );
      assert(
        error.errors[1].message === "PURE_COLLECTOR_A" &&
          error.errors[2].message === "PURE_COLLECTOR_B",
        "Collector errors did not retain integration order",
      );
      assert(
        error.message.includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Aggregate summary hid the primary reason",
      );
      const rows = (await Deno.readTextFile(join(f.retained, "events.jsonl")))
        .trim().split("\n").map((line) => JSON.parse(line));
      assert(
        rows.map((row) => row.hook).join(",") === "A,B,C",
        "Throwing collector skipped or reordered later callbacks",
      );
      const c = rows[1].context;
      assert(
        c.root === f.root &&
          c.sourceRoot.startsWith(f.root + "/.project-publish/builds/"),
        "First callback changed the next callback's roots",
      );
      assert(
        c.profiles.join(",") === "student" && c.config.proof === "FROZEN",
        "First callback changed the next callback's configuration",
      );
      assert(
        c.members[0].path === c.sourceRoot + "/member" &&
          c.failure.error.message.includes(
            "PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA",
          ),
        "First callback changed nested member/error context",
      );
      assert(
        f.w.config.proof === "FROZEN" && f.w.profiles.join(",") === "student",
        "Callback changed authoritative workspace",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Collector error prevented Source cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async no_hook_failure_keeps_exact_primary_error() {
    const f = await fixture(false);
    try {
      let primary: unknown;
      const ports = {
        ...portsFor(f),
        render: async (w: Workspace) => {
          try {
            return await renderMembers(w);
          } catch (error) {
            primary = error;
            throw error;
          }
        },
      };
      const error = await caught(() => prepare(ports));
      assert(
        error === primary && error instanceof Error &&
          !(error instanceof AggregateError),
        "No-hook failure replaced the existing Error object",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "No-hook failure changed Source cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async success_does_not_notify_and_legacy_state_omits_registration() {
    for (const hook of [false, true]) {
      const f = await fixture(hook, "success");
      try {
        const state = await renderMembers(f.w);
        assert(
          !await exists(join(f.retained, "failure.json")),
          "Successful child triggered a failure hook",
        );
        if (!hook) {
          assert(
            !("failureIntegrations" in state),
            "No-hook state changed its serialized shape",
          );
        }
        await runtime().cleanup(f.w, state);
      } finally {
        await f.close();
      }
    }
  },
  // Workflow must retain successful render state for failures after render returns.
  async save_state_and_preview_failures_notify_before_clear_state() {
    for (const operation of ["save-state", "preview"]) {
      const f = await fixture(true, "success");
      try {
        await integration(
          f,
          `async onFailure(c:any) {
          await Deno.copyFile(c.sourceRoot+"/member/.pure-native/input.json", ${
            JSON.stringify(join(f.retained, "workflow-input.json"))
          });
          await Deno.writeTextFile(${
            JSON.stringify(join(f.retained, "workflow-context.json"))
          }, JSON.stringify(c));
        }`,
        );
        const primary = new Error("PURE_" + operation);
        const ports = portsFor(f);
        if (operation === "save-state") {
          ports.saveState = async () => {
            throw primary;
          };
        } else {ports.preparePreview = async () => {
            throw primary;
          };}
        const error = await caught(() => prepare(ports));
        assert(error === primary, `${operation} replaced the primary Error`);
        const c = JSON.parse(
          await Deno.readTextFile(join(f.retained, "workflow-context.json")),
        );
        assert(
          c.failure.phase === "preparation" &&
            c.failure.operation === operation,
          `Wrong ${operation} context`,
        );
        assert(
          await exists(join(f.retained, "workflow-input.json")) &&
            !await exists(join(f.root, ".project-publish/builds")),
          `${operation} retention/cleanup ordering failed`,
        );
      } finally {
        await f.close();
      }
    }
  },
  async before_render_and_metadata_failures_report_preparation() {
    for (const operation of ["before-render", "metadata"]) {
      const f = await fixture();
      try {
        await f.write(
          "modules/diagnostics.ts",
          `export default {
          ${
            operation === "before-render"
              ? 'beforeRender() {throw new Error("PURE_BEFORE_RENDER");}'
              : 'beforeRender() {}, metadata() {throw new Error("PURE_METADATA");}'
          },
          async onFailure(c:any) {
            await Deno.stat(c.sourceRoot+"/member/index.qmd");
            await Deno.writeTextFile(${
            JSON.stringify(join(f.retained, "preparation-context.json"))
          }, JSON.stringify(c));
          }
        };`,
        );
        const error = await caught(() => prepare(portsFor(f)));
        assert(
          String(error).includes(
            operation === "metadata" ? "PURE_METADATA" : "PURE_BEFORE_RENDER",
          ),
          "Preparation primary reason was lost",
        );
        const c = JSON.parse(
          await Deno.readTextFile(join(f.retained, "preparation-context.json")),
        );
        assert(
          c.failure.phase === "preparation" &&
            c.failure.operation === operation,
          "Preparation point was misclassified",
        );
        if (operation === "metadata") {
          assert(
            c.namespace === "member" && c.output.endsWith("/output/member"),
            "Metadata point lacks current member output",
          );
        }
        assert(
          !await exists(join(f.root, ".project-publish/builds")),
          "Preparation failure left Source behind",
        );
      } finally {
        await f.close();
      }
    }
  },
  async notify_failure_is_once_and_ignores_callback_return_value() {
    const f = await fixture(true, "success");
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "notify.log"))
        }, "notified\\n", {append:true});
        return {sourceRoot:"UNTRUSTED",failureIntegrations:["UNTRUSTED"]};
      }`,
      );
      const state = await renderMembers(f.w);
      const original = JSON.stringify(state);
      const { notifyFailure, failureError } = await failureApi();
      const primary = new Error("PURE_ONCE");
      const point = { phase: "preparation", operation: "save-state" };
      assert(
        (await notifyFailure(state, primary, point)).length === 0,
        "Non-throwing callback return became an error",
      );
      assert(
        (await notifyFailure(state, primary, point)).length === 0,
        "Duplicate notification produced errors",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "notify.log")) ===
          "notified\n",
        "Same state object was notified twice",
      );
      assert(
        JSON.stringify(state) === original,
        "Callback return changed authoritative state",
      );
      assert(
        failureError(primary, []) === primary,
        "Empty diagnostic errors changed primary identity",
      );
      await runtime().cleanup(f.w, state);
    } finally {
      await f.close();
    }
  },
  async failure_only_integrations_register_exact_ordered_subset() {
    const f = await fixture(false, "success");
    try {
      for (const name of ["one", "two"]) {
        await f.write(`modules/${name}.ts`, `export default {onFailure() {}};`);
        f.w.integrations.push(join(f.root, `modules/${name}.ts`));
      }
      const state = await renderMembers(f.w);
      assert(
        JSON.stringify(
          (state as BuildState & { failureIntegrations?: string[] })
            .failureIntegrations,
        ) === JSON.stringify(f.w.integrations.slice(1)),
        "Failure-only adapters were rejected or registered out of configured order",
      );
      owned(state, f.root);
      for (
        const paths of [
          [join(f.root, "modules/unconfigured.ts")],
          [f.w.integrations[2], f.w.integrations[1]],
          [f.w.integrations[1], f.w.integrations[1]],
        ]
      ) {
        const forged = {
          ...structuredClone(state),
          failureIntegrations: paths,
        };
        let rejected = false;
        try {
          owned(forged, f.root);
        } catch {
          rejected = true;
        }
        assert(
          rejected,
          "Forged failure registration passed state ownership validation",
        );
      }
      await runtime().cleanup(f.w, state);
    } finally {
      await f.close();
    }
  },
  async resumed_missing_hook_is_reported_without_throwing_notifier() {
    const f = await fixture(false, "success");
    const restoreProfiles = activeStudentProfile();
    try {
      const path = join(f.root, "modules/fresh-resumed.ts");
      f.w.integrations.push(path);
      await f.write(
        "modules/fresh-resumed.ts",
        "export default {beforeRender() {}};",
      );
      await declaredSelection(f);
      const state = await renderMembers(f.w);
      const resumed = await freshResumedCopy(state);
      resumed.failureIntegrations = [path];
      const { notifyFailure, failureError } = await failureApi();
      const primary = new Error("PURE_RESUMED");
      const errors = await notifyFailure(resumed, primary, {
        phase: "publication",
        operation: "finalize",
      });
      assert(
        errors.length === 1 &&
          String(errors[0]).includes(
            "зарегистрированный onFailure отсутствует",
          ),
        "A previously registered but missing resumed hook was silently skipped",
      );
      const error = failureError(primary, errors);
      assert(
        error instanceof AggregateError && error.errors[0] === primary &&
          error.cause === primary,
        "Resumed-hook failure lost primary identity",
      );
      await runtime().cleanup(resumed.workspace, resumed);
      await runtime().cleanup(state.workspace, state);
    } finally {
      restoreProfiles();
      await f.close();
    }
  },
  async resumed_import_failure_does_not_skip_later_collector() {
    const f = await fixture(false, "success");
    const restoreProfiles = activeStudentProfile();
    try {
      const missing = join(f.root, "modules/fresh-missing.ts");
      const later = join(f.root, "modules/fresh-later.ts");
      f.w.integrations.push(missing, later);
      await f.write(
        "modules/fresh-missing.ts",
        "export default {onFailure() {}};",
      );
      await f.write(
        "modules/fresh-later.ts",
        `export default {async onFailure() {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "later-collector.log"))
        }, "retained");
      }};`,
      );
      await declaredSelection(f);
      const state = await renderMembers(f.w);
      const resumed = await freshResumedCopy(state);
      await Deno.remove(join(resumed.sourceRoot, "modules/fresh-missing.ts"));
      const { notifyFailure } = await failureApi();
      const errors = await notifyFailure(
        resumed,
        new Error("PURE_RESUMED_IMPORT"),
        { phase: "publication", operation: "finalize" },
      );
      assert(
        errors.length === 1 && String(errors[0]).includes("fresh-missing.ts"),
        "Missing resumed module did not produce exactly one diagnostic error",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "later-collector.log")) ===
          "retained",
        "Import failure skipped a later configured collector",
      );
      await runtime().cleanup(resumed.workspace, resumed);
      await runtime().cleanup(state.workspace, state);
    } finally {
      restoreProfiles();
      await f.close();
    }
  },
  async forged_registration_does_not_import_unconfigured_module() {
    const f = await fixture(false, "success");
    try {
      const state = await renderMembers(f.w);
      await Deno.writeTextFile(
        join(state.sourceRoot, "modules/unconfigured.ts"),
        `await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "unconfigured-import.log"))
        },"IMPORTED"); export default {onFailure() {}};`,
      );
      const forged = {
        ...structuredClone(state),
        failureIntegrations: [join(f.root, "modules/unconfigured.ts")],
      };
      const { notifyFailure } = await failureApi();
      const errors = await notifyFailure(forged, new Error("PURE_FORGED"), {
        phase: "publication",
        operation: "finalize",
      });
      assert(
        errors.length === 1,
        "Forged registration was accepted by failure notification",
      );
      assert(
        !await exists(join(f.retained, "unconfigured-import.log")),
        "Forged registration executed unconfigured code before validation",
      );
      await runtime().cleanup(f.w, state);
    } finally {
      await f.close();
    }
  },
  async publication_workspace_failure_retains_source_before_cleanup() {
    const f = await fixture(true, "success");
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.copyFile(c.sourceRoot+"/member/index.qmd", ${
          JSON.stringify(join(f.retained, "workspace-source.qmd"))
        });
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "workspace-context.json"))
        }, JSON.stringify(c));
      }`,
      );
      const state = await renderMembers(f.w);
      const primary = new Error("PURE_WORKSPACE_FAILURE");
      const ports = {
        ...runtime(),
        loadState: async () => state,
        workspace: async () => {
          throw primary;
        },
      };
      const error = await caught(() => finalize(ports));
      assert(error === primary, "Workspace refusal lost its primary Error");
      const c = JSON.parse(
        await Deno.readTextFile(join(f.retained, "workspace-context.json")),
      );
      assert(
        c.failure.phase === "publication" &&
          c.failure.operation === "workspace",
        "Workspace refusal was misclassified",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "workspace-source.qmd")) ===
          "# Pure member\n",
        "Workspace callback did not retain Source before cleanup",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Workspace refusal skipped cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async stage_and_finalizer_failures_notify_before_stage_removal() {
    for (const operation of ["stage", "finalize"]) {
      const f = await fixture(true, "success");
      try {
        await integration(
          f,
          `
          ${
            operation === "finalize"
              ? 'finalize() {throw new Error("PURE_FINALIZER_FAILURE");},'
              : ""
          }
          async onFailure(c:any) {
            await Deno.stat(c.sourceRoot+"/member/index.qmd");
            await Deno.stat(c.stage);
            if(c.failure.operation==="finalize") await Deno.copyFile(c.stage+"/index.html", ${
            JSON.stringify(join(f.retained, "stage-index.html"))
          });
            await Deno.writeTextFile(${
            JSON.stringify(join(f.retained, "publication-context.json"))
          }, JSON.stringify(c));
          }`,
        );
        const state = await renderMembers(f.w);
        if (operation === "finalize") {
          await Deno.mkdir(f.w.output, { recursive: true });
          await Deno.writeTextFile(
            join(f.w.output, "index.html"),
            "PURE_LEGACY_ROOT_OUTPUT",
          );
        }
        let primary: unknown;
        const ports = {
          ...portsFor(f),
          loadState: async () => state,
          publish: async (w: Workspace, s: BuildState) => {
            try {
              await publish(w, s);
            } catch (error) {
              primary = error;
              throw error;
            }
          },
        };
        const error = await caught(() => finalize(ports));
        assert(
          error === primary,
          `${operation} callback replaced primary Error`,
        );
        const c = JSON.parse(
          await Deno.readTextFile(join(f.retained, "publication-context.json")),
        );
        assert(
          c.failure.phase === "publication" &&
            c.failure.operation === operation,
          `Wrong ${operation} classification`,
        );
        if (operation === "finalize") {
          assert(
            await Deno.readTextFile(join(f.retained, "stage-index.html")) ===
              "PURE_LEGACY_ROOT_OUTPUT",
            "Finalizer callback did not retain exact stage bytes",
          );
        }
        assert(
          !await exists(c.stage) &&
            !await exists(join(f.root, ".project-publish/builds")),
          `${operation} did not finish stage/Source cleanup`,
        );
      } finally {
        await f.close();
      }
    }
  },
  async managed_commit_failure_notifies_before_rollback_and_restores_public() {
    const f = await fixture(true, "success");
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.stat(c.sourceRoot+"/member/index.qmd");
        const stage = await Deno.readTextFile(c.stage+"/index.html");
        const backup = await Deno.readTextFile(c.root+"/.project-publish/output-"+c.attemptId+"/index.html");
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "commit-evidence.json"))
        }, JSON.stringify({context:c,stage,backup}));
      }`,
      );
      const state = await managedState(f);
      const stage = join(f.root, ".project-publish/publish-" + state.id);
      const primary = new Error("PURE_COMMIT_FAILURE");
      const rename = async (from: string, to: string) => {
        if (from === stage && to === state.workspace.output) throw primary;
        await Deno.rename(from, to);
      };
      const ports = {
        ...runtime(),
        workspace: async () => state.workspace,
        loadState: async () => state,
        publish: async (w: Workspace, s: BuildState) =>
          await publish(w, s, rename),
      };
      const error = await caught(() => finalize(ports));
      assert(
        error === primary,
        "Managed commit failure replaced primary Error",
      );
      const record = JSON.parse(
        await Deno.readTextFile(join(f.retained, "commit-evidence.json")),
      );
      assert(
        record.context.failure.phase === "publication" &&
          record.context.failure.operation === "commit",
        "Commit failure was misclassified",
      );
      assert(
        record.stage === "PURE_NEW_PORTAL" &&
          record.backup === "PURE_OLD_PUBLIC",
        "Callback ran after rollback removed its stage/backup evidence",
      );
      assert(
        await Deno.readTextFile(join(state.workspace.output, "index.html")) ===
          "PURE_OLD_PUBLIC",
        "Managed rollback did not restore the previous public bytes",
      );
      assert(
        !await exists(stage) &&
          !await exists(join(f.root, ".project-publish/builds")),
        "Managed commit failure skipped private cleanup",
      );
      assert(
        !await exists(join(f.root, ".project-publish/output-" + state.id)),
        "Successful rollback left a backup behind",
      );
    } finally {
      await f.close();
    }
  },
  async managed_rollback_failure_retains_recovery_backup() {
    const f = await fixture(true, "success");
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.stat(c.stage+"/index.html");
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "rollback-notify.log"))
        }, "once\\n", {append:true});
      }`,
      );
      const state = await managedState(f);
      const stage = join(f.root, ".project-publish/publish-" + state.id);
      const backup = join(f.root, ".project-publish/output-" + state.id);
      const primary = new Error("PURE_COMMIT_FAILURE");
      const rollback = new Error("PURE_ROLLBACK_FAILURE");
      const rename = async (from: string, to: string) => {
        if (from === stage && to === state.workspace.output) throw primary;
        if (from === backup && to === state.workspace.output) throw rollback;
        await Deno.rename(from, to);
      };
      const ports = {
        ...runtime(),
        workspace: async () => state.workspace,
        loadState: async () => state,
        publish: async (w: Workspace, s: BuildState) =>
          await publish(w, s, rename),
      };
      const error = await caught(() => finalize(ports));
      assert(
        error instanceof AggregateError && error.errors[0] === primary &&
          error.errors.includes(rollback),
        "Rollback failure lost either primary or rollback error identity",
      );
      assert(
        await Deno.readTextFile(join(backup, "index.html")) ===
          "PURE_OLD_PUBLIC",
        "Failure cleanup destroyed the recovery backup",
      );
      assert(
        await Deno.readTextFile(join(f.retained, "rollback-notify.log")) ===
          "once\n",
        "Rollback or outer workflow notified the same state twice",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Rollback refusal skipped Source cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async successful_publication_does_not_invoke_failure_hook() {
    const f = await fixture(true, "success");
    try {
      await integration(
        f,
        `async onFailure() {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "unexpected-failure.log"))
        }, "called");
      }`,
      );
      const state = await managedState(f);
      await finalize({
        ...runtime(),
        workspace: async () => state.workspace,
        loadState: async () => state,
      });
      assert(
        !await exists(join(f.retained, "unexpected-failure.log")),
        "Successful publication invoked onFailure",
      );
      assert(
        await Deno.readTextFile(join(state.workspace.output, "index.html")) ===
          "PURE_NEW_PORTAL",
        "Successful pure publication did not commit the prepared stage",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Successful publication failed to clean Source",
      );
    } finally {
      await f.close();
    }
  },
  async cleanup_failure_does_not_mask_preparation_primary() {
    const f = await fixture(false, "success");
    try {
      const primary = new Error("PURE_SAVE_FAILURE");
      const cleanup = new Error("PURE_CLEAR_FAILURE");
      const ports = portsFor(f);
      const clear = ports.clearState;
      let calls = 0;
      ports.clearState = async (w) => {
        await clear(w);
        if (++calls === 2) throw cleanup;
      };
      ports.saveState = async () => {
        throw primary;
      };
      const error = await caught(() => prepare(ports));
      assert(
        error instanceof AggregateError && error.errors[0] === primary &&
          error.errors.includes(cleanup) && error.cause === primary,
        "Preparation cleanup masked the primary error",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Cleanup side effect did not occur before its injected error",
      );
    } finally {
      await f.close();
    }
  },
  async cleanup_failure_does_not_mask_publication_primary() {
    const f = await fixture(false, "success");
    try {
      const state = await renderMembers(f.w);
      const primary = new Error("PURE_WORKSPACE_FAILURE");
      const cleanup = new Error("PURE_CLEANUP_FAILURE");
      const ports = {
        ...runtime(),
        workspace: async (): Promise<Workspace> => {
          throw primary;
        },
        loadState: async () => state,
      };
      const clean = ports.cleanup;
      ports.cleanup = async (w, s, failed) => {
        await clean(w, s, failed);
        throw cleanup;
      };
      const error = await caught(() => finalize(ports));
      assert(
        error instanceof AggregateError && error.errors[0] === primary &&
          error.errors.includes(cleanup) && error.cause === primary,
        "Publication cleanup masked the primary error",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Publication cleanup side effect was skipped",
      );
    } finally {
      await f.close();
    }
  },
  async throwing_failure_port_still_cleans_and_keeps_primary() {
    const f = await fixture(false, "success");
    try {
      const primary = new Error("PURE_SAVE_FAILURE");
      const collector = new Error("PURE_FAILURE_PORT_THROW");
      const ports = {
        ...portsFor(f),
        saveState: async () => {
          throw primary;
        },
        failure: async () => {
          throw collector;
        },
      };
      const error = await caught(() => prepare(ports));
      assert(
        error instanceof AggregateError && error.errors[0] === primary &&
          error.errors[1] === collector && error.cause === primary,
        "Throwing failure port masked the primary reason",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Throwing failure port skipped cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async collector_and_prepare_cleanup_failures_keep_flat_primary_order() {
    const f = await fixture();
    try {
      await integration(
        f,
        'onFailure() {throw new Error("PURE_COLLECTOR_FAILURE");}',
      );
      const cleanup = new Error("PURE_CLEAR_FAILURE");
      const ports = portsFor(f);
      const clear = ports.clearState;
      let calls = 0;
      let primary: unknown;
      let collector: unknown;
      ports.clearState = async (w) => {
        await clear(w);
        if (++calls === 2) throw cleanup;
      };
      ports.render = async (w) => {
        try {
          return await renderMembers(w);
        } catch (error) {
          assert(
            error instanceof AggregateError && error.errors.length === 2,
            "Render did not report its original error plus collector failure",
          );
          [primary, collector] = error.errors;
          throw error;
        }
      };
      const error = await caught(() => prepare(ports));
      assert(
        error instanceof AggregateError,
        "Combined render/cleanup failure was not reported",
      );
      assert(
        error.errors.length === 3 && error.errors[0] === primary &&
          error.errors[1] === collector && error.errors[2] === cleanup &&
          error.cause === primary,
        "Later cleanup nested the existing diagnostic aggregate instead of preserving the original primary first/cause",
      );
      assert(
        String(primary).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Combined failure did not originate in the actual fake child",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Combined collector/cleanup failure skipped Source deletion",
      );
    } finally {
      await f.close();
    }
  },
  async foreign_aggregate_remains_the_exact_primary_error() {
    const f = await fixture(false, "success");
    try {
      const underlying = new Error("PURE_FOREIGN_UNDERLYING");
      const primary = new AggregateError(
        [underlying],
        "PURE_FOREIGN_AGGREGATE",
        { cause: underlying },
      );
      const collector = new Error("PURE_PORT_DIAGNOSTIC");
      const ports = {
        ...portsFor(f),
        saveState: async () => {
          throw primary;
        },
        failure: async () => [collector],
      };
      const error = await caught(() => prepare(ports));
      assert(
        error instanceof AggregateError && error.errors.length === 2 &&
          error.errors[0] === primary && error.errors[1] === collector &&
          error.cause === primary,
        "Composition flattened an unrelated user AggregateError instead of preserving exact primary identity",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Foreign aggregate failure skipped cleanup",
      );
    } finally {
      await f.close();
    }
  },
  async duplicate_config_keeps_ordinary_calls_but_notifies_once() {
    const f = await fixture();
    try {
      const log = JSON.stringify(join(f.retained, "duplicate-events.log"));
      const path = await integration(
        f,
        `
        async beforeRender() {await Deno.writeTextFile(${log},"before\\n",{append:true});},
        async metadata() {await Deno.writeTextFile(${log},"metadata\\n",{append:true}); return {};},
        async onFailure() {await Deno.writeTextFile(${log},"failure\\n",{append:true});}
      `,
      );
      f.w.integrations.push(path);
      const error = await caught(() => prepare(portsFor(f)));
      assert(
        String(error).includes("PURE_FAKE_NATIVE_FAILURE_AFTER_METADATA"),
        "Duplicate-config fixture did not reach the real post-metadata fake-child failure",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Duplicate-config failure skipped Source cleanup",
      );
      const events =
        (await Deno.readTextFile(join(f.retained, "duplicate-events.log")))
          .trim().split("\n");
      const counts = {
        before: events.filter((event) => event === "before").length,
        metadata: events.filter((event) => event === "metadata").length,
        failure: events.filter((event) => event === "failure").length,
      };
      await Deno.writeTextFile(
        join(f.retained, "duplicate-counts.json"),
        JSON.stringify({ counts, events }, null, 2) + "\n",
      );
      assert(
        counts.before === 2 && counts.metadata === 2,
        "Deduplicating failure registration changed legacy beforeRender/metadata invocation counts",
      );
      assert(
        counts.failure === 1,
        "Repeated configured path invoked onFailure more than once",
      );
      assert(
        events.join(",") === "before,before,metadata,metadata,failure",
        "Failure registration changed callback order",
      );
    } finally {
      await f.close();
    }
  },
  async duplicated_failure_registration_is_rejected_with_duplicate_config() {
    const f = await fixture(true, "success");
    try {
      const path = await integration(
        f,
        `async onFailure() {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "forged-duplicate-hooks.log"))
        },"called\\n",{append:true});
      }`,
      );
      f.w.integrations.push(path);
      const state = await renderMembers(f.w);
      const forged = {
        ...structuredClone(state),
        failureIntegrations: [path, path],
      };
      let refused = false;
      try {
        owned(forged, f.root);
      } catch {
        refused = true;
      }
      const { notifyFailure } = await failureApi();
      const errors = await notifyFailure(
        forged,
        new Error("PURE_DUPLICATE_REGISTRATION"),
        { phase: "publication", operation: "finalize" },
      );
      const hookCalls =
        await exists(join(f.retained, "forged-duplicate-hooks.log"))
          ? (await Deno.readTextFile(
            join(f.retained, "forged-duplicate-hooks.log"),
          )).trim().split("\n").length
          : 0;
      await Deno.writeTextFile(
        join(f.retained, "duplicate-registration.json"),
        JSON.stringify(
          {
            refused,
            errors: errors.length,
            hookCalls,
            registered:
              (state as BuildState & { failureIntegrations?: string[] })
                .failureIntegrations,
          },
          null,
          2,
        ) + "\n",
      );
      assert(
        refused && errors.length === 1 && hookCalls === 0,
        "Duplicate registration was accepted or invoked hooks when the configured list also contained duplicates",
      );
      assert(
        JSON.stringify(
          (state as BuildState & { failureIntegrations?: string[] })
            .failureIntegrations,
        ) === JSON.stringify([path]),
        "Captured failure registration did not retain only the first configured occurrence",
      );
      owned(state, f.root);
      await runtime().cleanup(state.workspace, state);
    } finally {
      await f.close();
    }
  },
  async whole_saved_selection_forgery_cannot_import_snapshot_module() {
    const f = await fixture(true, "success");
    const previousCwd = Deno.cwd();
    const restoreProfiles = activeStudentProfile();
    try {
      await integration(
        f,
        `async onFailure() {
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "legitimate-frozen-hook.log"))
        },"called");
      }`,
      );
      await f.write(
        "modules/unconfigured.ts",
        `await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "unconfigured-import.log"))
        },"IMPORTED");
        export default {async onFailure() {await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "unconfigured-hook.log"))
        },"CALLED");}};`,
      );
      await declaredSelection(f);
      const state = await renderMembers(f.w);
      assert(
        await exists(join(state.sourceRoot, "modules/unconfigured.ts")),
        "Counterexample module was not copied into the real attempt Source",
      );
      const forged = structuredClone(state);
      const unconfigured = join(f.root, "modules/unconfigured.ts");
      forged.workspace.integrations = [unconfigured];
      forged.failureIntegrations = [unconfigured];
      await runtime().saveState(f.w, forged);
      const ports = portsFor(f);
      let primary: unknown;
      let cleanupCalls = 0;
      let publishCalls = 0;
      const notify = ports.failure;
      assert(
        notify,
        "Runtime did not provide its real failure notification port",
      );
      ports.failure = async (s, error, point) => {
        primary = error;
        return await notify(s, error, point);
      };
      const clean = ports.cleanup;
      ports.cleanup = async (w, s, failed) => {
        cleanupCalls++;
        await clean(w, s, failed);
      };
      ports.publish = async () => {
        publishCalls++;
        throw new Error("Unexpected publication after workspace refusal");
      };
      Deno.chdir(f.root);
      const error = await caught(() => finalize(ports));
      const importMarker = await exists(
        join(f.retained, "unconfigured-import.log"),
      );
      const hookMarker = await exists(
        join(f.retained, "unconfigured-hook.log"),
      );
      const original = error instanceof AggregateError
        ? error.errors[0]
        : error;
      const sourceRemoved = !await exists(state.sourceRoot);
      await Deno.writeTextFile(
        join(f.retained, "whole-selection-forgery.json"),
        JSON.stringify(
          {
            importMarker,
            hookMarker,
            cleanupCalls,
            publishCalls,
            sourceRemoved,
            primaryCaptured: primary !== undefined,
            primaryRetained: original === primary,
            primaryMessage: String(primary),
          },
          null,
          2,
        ) + "\n",
      );
      assert(
        primary instanceof Error &&
          primary.message.includes("изменились после подготовки попытки"),
        "Forged saved selection did not reach the actual workspace mismatch refusal",
      );
      assert(
        original === primary &&
          (!(error instanceof AggregateError) || error.cause === primary),
        "Registration refusal replaced the original workspace mismatch Error",
      );
      assert(
        cleanupCalls === 1 && publishCalls === 0 && sourceRemoved,
        "Registration refusal skipped permitted cleanup or attempted publication",
      );
      assert(
        !importMarker && !hookMarker,
        "Forging both saved integration lists imported the otherwise-unconfigured snapshot module after workspace refusal",
      );
    } finally {
      Deno.chdir(previousCwd);
      restoreProfiles();
      await f.close();
    }
  },
  async legitimate_workspace_drift_uses_frozen_selection_not_current_module() {
    const f = await fixture(true, "success");
    const previousCwd = Deno.cwd();
    const restoreProfiles = activeStudentProfile();
    try {
      await integration(
        f,
        `async onFailure(c:any) {
        await Deno.copyFile(c.sourceRoot+"/member/index.qmd",${
          JSON.stringify(join(f.retained, "drift-retained-source.qmd"))
        });
        await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "frozen-drift-context.json"))
        },JSON.stringify(c));
      }`,
      );
      await f.write(
        "modules/current.ts",
        `await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "current-module-import.log"))
        },"IMPORTED");
        export default {async onFailure() {await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "current-module-hook.log"))
        },"CALLED");}};`,
      );
      await declaredSelection(f);
      const state = await renderMembers(f.w);
      await runtime().saveState(f.w, state);
      const changed = structuredClone(f.w);
      changed.integrations = [join(f.root, "modules/current.ts")];
      const pub = changed.config["project-publish"] as Record<string, unknown>;
      pub.integrations = ["modules/current.ts"];
      await f.write("_quarto.yml", JSON.stringify(changed.config));
      const ports = { ...runtime(), workspace: async () => changed };
      let primary: unknown;
      let cleanupCalls = 0;
      const notify = ports.failure;
      assert(
        notify,
        "Runtime did not provide its real failure notification port",
      );
      ports.failure = async (s, error, point) => {
        primary = error;
        return await notify(s, error, point);
      };
      const clean = ports.cleanup;
      ports.cleanup = async (w, s, failed) => {
        cleanupCalls++;
        await clean(w, s, failed);
      };
      Deno.chdir(f.root);
      const error = await caught(() => finalize(ports));
      assert(
        primary instanceof Error &&
          primary.message.includes("изменились после подготовки попытки") &&
          error === primary,
        "Legitimate workspace drift lost its exact original refusal",
      );
      const c = JSON.parse(
        await Deno.readTextFile(join(f.retained, "frozen-drift-context.json")),
      );
      assert(
        c.failure.phase === "publication" &&
          c.failure.operation === "workspace",
        "Frozen callback did not receive the workspace drift context",
      );
      assert(
        JSON.stringify(c.config["project-publish"].integrations) ===
          JSON.stringify(["modules/diagnostics.ts"]),
        "Current changed declaration replaced the genuinely frozen selection",
      );
      assert(
        await Deno.readTextFile(
          join(f.retained, "drift-retained-source.qmd"),
        ) === "# Pure member\n",
        "Frozen callback could not retain Source before cleanup",
      );
      assert(
        !await exists(join(f.retained, "current-module-import.log")) &&
          !await exists(join(f.retained, "current-module-hook.log")),
        "Workspace drift imported the changed current configuration's module",
      );
      assert(
        cleanupCalls === 1 && !await exists(state.sourceRoot),
        "Legitimate workspace drift did not complete Source cleanup",
      );
    } finally {
      Deno.chdir(previousCwd);
      restoreProfiles();
      await f.close();
    }
  },
  async forged_saved_profile_cannot_authorize_another_frozen_selection() {
    const f = await fixture(true, "success");
    const previousCwd = Deno.cwd();
    const restoreProfiles = activeStudentProfile();
    try {
      await integration(f, "onFailure() {}");
      await f.write(
        "modules/full.ts",
        `await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "full-profile-import.log"))
        },"IMPORTED");
        export default {async onFailure() {await Deno.writeTextFile(${
          JSON.stringify(join(f.retained, "full-profile-hook.log"))
        },"CALLED");}};`,
      );
      await declaredSelection(f);
      const fullConfig = structuredClone(f.w.config);
      (fullConfig["project-publish"] as Record<string, unknown>).integrations =
        ["modules/full.ts"];
      await f.write("_quarto-full.yml", JSON.stringify(fullConfig));
      await f.write("member/_quarto-full.yml", '{"metadata":{}}');
      const cli = join(f.retained, "fake-quarto.sh");
      const script = await Deno.readTextFile(cli);
      await Deno.writeTextFile(
        cli,
        script.replace(
          'cat "$PWD/_quarto.yml" || exit 92',
          `printf 'inspect\\n' >> ${
            JSON.stringify(join(f.retained, "profile-inspect.log"))
          }
selected=""
for arg in "$@"; do
  if [ "$selected" = "next" ]; then selected="$arg"; break; fi
  if [ "$arg" = "--profile" ]; then selected="next"; fi
done
if [ "$selected" = "full" ]; then cat "$PWD/_quarto-full.yml" || exit 92
else cat "$PWD/_quarto.yml" || exit 92; fi`,
        ),
      );
      const state = await renderMembers(f.w);
      assert(
        Deno.env.get("QUARTO_PROFILE") === "student",
        "Fixture changed the actual audience selector",
      );
      const forged = structuredClone(state);
      forged.workspace.profiles = ["full"];
      forged.workspace.config = fullConfig;
      forged.workspace.integrations = [join(f.root, "modules/full.ts")];
      forged.failureIntegrations = [join(f.root, "modules/full.ts")];
      await runtime().saveState(f.w, forged);
      const ports = portsFor(f);
      let primary: unknown;
      let cleanupCalls = 0;
      const notify = ports.failure;
      assert(notify, "Runtime did not provide failure notification");
      ports.failure = async (s, error, point) => {
        primary = error;
        return await notify(s, error, point);
      };
      const clean = ports.cleanup;
      ports.cleanup = async (w, s, failed) => {
        cleanupCalls++;
        await clean(w, s, failed);
      };
      Deno.chdir(f.root);
      const error = await caught(() => finalize(ports));
      const importMarker = await exists(
        join(f.retained, "full-profile-import.log"),
      );
      const hookMarker = await exists(
        join(f.retained, "full-profile-hook.log"),
      );
      const inspectCalls = await exists(join(f.retained, "profile-inspect.log"))
        ? (await Deno.readTextFile(join(f.retained, "profile-inspect.log")))
          .trim().split("\n").length
        : 0;
      const original = error instanceof AggregateError
        ? error.errors[0]
        : error;
      await Deno.writeTextFile(
        join(f.retained, "saved-selector-forgery.json"),
        JSON.stringify(
          {
            actualProfile: Deno.env.get("QUARTO_PROFILE"),
            savedProfiles: forged.workspace.profiles,
            importMarker,
            hookMarker,
            inspectCalls,
            cleanupCalls,
            primaryRetained: original === primary,
            sourceRemoved: !await exists(state.sourceRoot),
          },
          null,
          2,
        ) + "\n",
      );
      assert(
        primary instanceof Error &&
          primary.message.includes("изменились после подготовки попытки") &&
          original === primary &&
          (!(error instanceof AggregateError) || error.cause === primary),
        "Selector rejection replaced the original workspace refusal",
      );
      assert(
        cleanupCalls === 1 && !await exists(state.sourceRoot),
        "Selector rejection skipped permitted cleanup",
      );
      assert(
        !importMarker && !hookMarker,
        "Forged saved profiles authorized a different callback selected by an existing frozen profile",
      );
      assert(
        inspectCalls === 0,
        "Resumed authority inspected a profile chosen only by the forged saved state",
      );
    } finally {
      Deno.chdir(previousCwd);
      restoreProfiles();
      await f.close();
    }
  },
};

const selected = Deno.args.length ? Deno.args : Object.keys(cases);
const results: { name: string; status: "PASS" | "FAIL"; reason?: string }[] =
  [];
const failures: unknown[] = [];
for (const name of selected) {
  assert(cases[name], `Unknown pure failure-seam case: ${name}`);
  proofCase = name;
  proofFixture = 0;
  try {
    await cases[name]();
    results.push({ name, status: "PASS" });
    console.log(`PASS pure failure seam: ${name}`);
  } catch (error) {
    results.push({ name, status: "FAIL", reason: String(error) });
    failures.push(error);
    console.error(`FAIL pure failure seam: ${name}: ${error}`);
  }
}
const proof = Deno.env.get("FAILURE_HOOKS_PROOF_DIR");
if (proof) {
  await Deno.mkdir(proof, { recursive: true });
  await Deno.writeTextFile(
    join(proof, "results.json"),
    JSON.stringify(
      {
        scope: "pure fake CLI; real Native engine not invoked",
        cases: results,
      },
      null,
      2,
    ) + "\n",
  );
}
if (failures.length) {
  throw new AggregateError(
    failures,
    `${failures.length} pure failure-seam cases failed`,
  );
}
console.log(
  `Success: ${selected.length} pure failure-seam cases; real Native engine not invoked`,
);
