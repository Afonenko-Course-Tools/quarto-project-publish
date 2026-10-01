import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { finalize } from "../_extensions/project-publish/application/workflow.ts";
import { renderMembers } from "../_extensions/project-publish/infrastructure/render.ts";
import { publish } from "../_extensions/project-publish/infrastructure/publish.ts";
import { runtime } from "../_extensions/project-publish/infrastructure/runtime.ts";
import { workspace } from "../_extensions/project-publish/infrastructure/config.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function exists(path: string) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
async function rejects(fn: () => Promise<unknown>, marker: string) {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert(
    error && String(error).includes(marker),
    `Ожидался отказ ${marker}, получено ${error}`,
  );
}
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: "publication-stages-" });
  async function write(path: string, text: string) {
    const p = join(root, path);
    await Deno.mkdir(dirname(p), { recursive: true });
    await Deno.writeTextFile(p, text);
  }
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write(
    "_quarto.yml",
    `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  resources: ["!member/**", "!modules/**", "!_events.log"]
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: _extensions/project-publish/entrypoints/post.ts
format: html
proof: FROZEN
project-publish:
  projects:
    member: {path: member, format: html}
  integrations: [modules/guard.ts, modules/legacy.ts, modules/resolve.ts, modules/materialize.ts, modules/package.ts, modules/verify.ts]
`,
  );
  for (const profile of ["student", "full"]) {
    await write(
      `_quarto-${profile}.yml`,
      `project:\n  output-dir: _site-${profile}\n`,
    );
    await write(`member/_quarto-${profile}.yml`, "metadata: {}\n");
  }
  await write("index.qmd", "# Native portal\n\nPreliminary root output.\n");
  await write(
    "member/_quarto.yml",
    "project:\n  type: default\n  render: [index.qmd]\n  pre-render: event.ts\nformat: html\n",
  );
  await write("member/index.qmd", "# Member\n\nNative member output.\n");
  await write(
    "member/event.ts",
    'await Deno.writeTextFile(Deno.env.get("STAGES_LOG")!, "member-render\\n", {append:true});\n',
  );
  await write(
    "modules/helper.ts",
    `export async function event(c:any, name:string) {
  if (!c.sourceRoot || !c.attemptId || c.profiles.join(",")!=="student" || c.config.proof!=="FROZEN") throw new Error("BAD_FROZEN_CONTEXT");
  if(c.members.some((m:any)=>!m.path.startsWith(c.sourceRoot+"/"))) throw new Error("BAD_SNAPSHOT_MEMBER_PATH");
  await Deno.writeTextFile(Deno.env.get("STAGES_LOG")!, name+"\\n", {append:true});
  if(Deno.env.get("STAGES_FAILURE")===name) throw new Error("FAIL_"+name);
}
`,
  );
  await write(
    "modules/guard.ts",
    'import {event} from "./helper.ts"; export default {async beforeRender(c:any) {await event(c,"before:A"); c.config.proof="CHANGED"; c.profiles.length=0;}};\n',
  );
  await write(
    "modules/legacy.ts",
    'import {event} from "./helper.ts"; export default {async beforeRender(c:any){await event(c,"before:B");}, async metadata(c:any){await event(c,"metadata:legacy"); c.config.proof="CHANGED"; return {title:"Legacy metadata retained"};}};\n',
  );
  const prior: Record<string, string | undefined> = {
    resolve: undefined,
    materialize: "resolve",
    package: "materialize",
    verify: "package",
  };
  for (const name of ["resolve", "materialize", "package", "verify"]) {
    await write(
      `modules/${name}.ts`,
      `import {event} from "./helper.ts"; export default {async finalize(c:any) {
      ${
        prior[name]
          ? `await Deno.stat(c.stage+"/${prior[name]}.artifact");`
          : ""
      }
      await event(c, "${name}"); await Deno.writeTextFile(c.stage+"/${name}.artifact", c.attemptId);
    }};\n`,
    );
  }
  Deno.env.set("STAGES_LOG", join(root, "_events.log"));
  Deno.env.set("QUARTO_PROFILE", "student");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_DIR", "_site-student");
  Deno.env.delete("STAGES_FAILURE");
  async function events() {
    return await exists(join(root, "_events.log"))
      ? (await Deno.readTextFile(join(root, "_events.log"))).trim().split("\n")
      : [];
  }
  async function render(expected = true) {
    const r = await new Deno.Command(quarto, {
      args: ["render", "--profile", "student"],
      cwd: root,
      env: { STAGES_LOG: join(root, "_events.log") },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(r.stdout) +
      new TextDecoder().decode(r.stderr);
    assert(r.success === expected, text);
    return text;
  }
  return { root, write, events, render };
}
const cases: Record<
  string,
  (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>
> = {
  async order(f) {
    await f.render();
    assert(
      JSON.stringify(await f.events()) ===
        JSON.stringify([
          "before:A",
          "before:B",
          "metadata:legacy",
          "member-render",
          "resolve",
          "materialize",
          "package",
          "verify",
        ]),
      "Нарушен порядок проверок/рендера/финализации",
    );
    assert(
      (await Deno.readTextFile(join(f.root, "_site-student/member/index.html")))
        .includes("Legacy metadata retained"),
      "Старый metadata callback не выполнен",
    );
    assert(
      await exists(join(f.root, "_site-student/verify.artifact")),
      "Проверенный stage не опубликован",
    );
    assert(
      !await exists(join(f.root, ".project-publish/state.json")),
      "Состояние успешной попытки не очищено",
    );
  },
  async before_failure(f) {
    Deno.env.set("STAGES_FAILURE", "before:A");
    const log = await f.render(false);
    assert(
      log.includes("FAIL_before:A"),
      "Не сохранена причина отказа владельца",
    );
    assert(
      !(await f.events()).includes("member-render"),
      "Рендер начался до проверки владельца",
    );
    assert(
      !await exists(join(f.root, "_site-student")),
      "Проверка перед render оставила output",
    );
    assert(
      !await exists(join(f.root, ".project-publish/builds")),
      "Отказ beforeRender оставил снимок попытки",
    );
  },
  async finalizer_failures(f) {
    await f.write("_site-full/untouched.txt", "Другой профиль");
    for (const phase of ["resolve", "materialize", "package", "verify"]) {
      Deno.env.set("STAGES_FAILURE", phase);
      const log = await f.render(false);
      assert(log.includes(`FAIL_${phase}`), `Не воспроизведён отказ ${phase}`);
      assert(
        !await exists(join(f.root, "_site-student")),
        `Предварительный native portal остался после ${phase}`,
      );
      assert(
        await exists(join(f.root, "_site-full/untouched.txt")),
        "Отказ удалил другой профиль",
      );
      assert(
        !await exists(join(f.root, ".project-publish/state.json")),
        "Отказ сохранил пригодное к повторному выпуску state",
      );
      assert(
        !await exists(join(f.root, ".project-publish/builds")),
        "Отказ сохранил inputs попытки",
      );
    }
  },
  async snapshot_modules(f) {
    const w = await workspace(f.root), state = await renderMembers(w);
    await f.write(
      "modules/resolve.ts",
      'throw new Error("ORIGINAL_MODULE_CHANGED");\n',
    );
    await f.write("_site-student/index.html", "Предварительный portal");
    await publish(w, state);
    assert(
      await exists(join(f.root, "_site-student/verify.artifact")),
      "Finalize загружен из исходного изменённого модуля",
    );
  },
  async drift(f) {
    for (const kind of ["profile", "output", "config"]) {
      Deno.env.delete("STAGES_FAILURE");
      const w = await workspace(f.root), state = await renderMembers(w);
      const ports = runtime();
      await ports.saveState(w, state);
      await f.write("_site-student/index.html", "Предварительный portal");
      await f.write("_site-full/untouched.txt", "Другой профиль");
      const changed = structuredClone(w);
      if (kind === "profile") changed.profiles = ["full"];
      if (kind === "output") changed.output = join(f.root, "_site-full");
      if (kind === "config") changed.config.proof = "NEW_CONFIG";
      const cwd = Deno.cwd();
      Deno.chdir(f.root);
      try {
        await rejects(
          () => finalize({ ...ports, workspace: async () => changed }),
          "изменились",
        );
      } finally {
        Deno.chdir(cwd);
      }
      assert(
        !await exists(join(f.root, "_site-student")),
        `Дрейф ${kind} сохранил предварительный output`,
      );
      assert(
        await exists(join(f.root, "_site-full/untouched.txt")),
        `Дрейф ${kind} удалил не принадлежащий попытке output`,
      );
      assert(
        !await exists(join(f.root, ".project-publish/state.json")),
        `Дрейф ${kind} оставил state`,
      );
    }
  },
  async commit_failure(f) {
    const w = await workspace(f.root), state = await renderMembers(w);
    await f.write("_site-student/index.html", "Предварительный portal");
    await f.write("_site-full/untouched.txt", "Другой профиль");
    // Реальные файловые операции, отказ только в перемещении stage → output.
    const rename = async (from: string, to: string) => {
      if (from.endsWith("publish-" + state.id)) {
        throw new Error("INJECTED_COMMIT_FAILURE");
      }
      await Deno.rename(from, to);
    };
    await rejects(() => publish(w, state, rename), "INJECTED_COMMIT_FAILURE");
    assert(
      !await exists(w.output),
      "Rollback восстановил непроверенный native portal",
    );
    assert(
      !await exists(join(f.root, ".project-publish/output-" + state.id)),
      "Rollback оставил backup текущего output",
    );
    assert(
      !await exists(join(f.root, ".project-publish/publish-" + state.id)),
      "Rollback оставил stage",
    );
    assert(
      await exists(join(f.root, "_site-full/untouched.txt")),
      "Rollback удалил другой профиль",
    );
  },
  async malformed_state(f) {
    const w = await workspace(f.root), state = await renderMembers(w);
    await f.write("member/keep.txt", "Исходник");
    await f.write("_site-full/untouched.txt", "Другой профиль");
    for (const target of ["member", "modules", "_site-full"]) {
      const badOutput = structuredClone(state);
      badOutput.workspace.output = join(f.root, target);
      const ports = runtime();
      await ports.saveState(w, badOutput);
      const cwd = Deno.cwd();
      Deno.chdir(f.root);
      try {
        await rejects(() => ports.loadState(), "поврежден");
      } finally {
        Deno.chdir(cwd);
      }
      await rejects(
        () => ports.cleanup(badOutput.workspace, badOutput, true),
        "поврежден",
      );
    }
    assert(
      await exists(join(f.root, "member/keep.txt")),
      "Повреждённый output удалил исходники",
    );
    const badMount = structuredClone(state);
    badMount.members[0].mount = "../authored-dir";
    await rejects(() => publish(w, badMount), "поврежден");
    const missingMember = structuredClone(state);
    missingMember.members = [];
    await rejects(() => publish(w, missingMember), "поврежден");
    const badFormat = structuredClone(state);
    badFormat.members[0].format = "pdf";
    await rejects(() => publish(w, badFormat), "поврежден");
    assert(
      !await exists(join(f.root, "authored-dir")),
      "Повреждённый mount записал вне stage",
    );
    assert(
      !await exists(join(f.root, ".project-publish/publish-" + state.id)),
      "Повреждённый state создал stage",
    );
    assert(
      await exists(join(f.root, "_site-full/untouched.txt")),
      "Повреждённый state удалил другой профиль",
    );
  },
};
const selected = Deno.args.indexOf("--case"),
  filter = selected >= 0 ? Deno.args[selected + 1] : undefined;
if (selected >= 0 && (!filter || !Object.hasOwn(cases, filter))) {
  throw new Error("Неизвестный stages case");
}
const preserved = new Map(
  [
    "STAGES_LOG",
    "STAGES_FAILURE",
    "QUARTO_PROFILE",
    "QUARTO_PROJECT_OUTPUT_DIR",
  ].map((name) => [name, Deno.env.get(name)]),
);
try {
  for (const [name, test] of Object.entries(cases)) {
    if (filter && filter !== name) continue;
    const f = await fixture();
    try {
      await test(f);
      console.log(`PASS stages: ${name}`);
    } finally {
      await Deno.remove(f.root, { recursive: true });
    }
  }
} finally {
  for (const [name, value] of preserved) {
    if (value === undefined) Deno.env.delete(name);
    else Deno.env.set(name, value);
  }
}
