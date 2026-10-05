import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { workspace } from "../_extensions/project-publish/infrastructure/config.ts";
import { renderMembers } from "../_extensions/project-publish/infrastructure/render.ts";
import { publish } from "../_extensions/project-publish/infrastructure/publish.ts";
import { runtime } from "../_extensions/project-publish/infrastructure/runtime.ts";
import { owned } from "../_extensions/project-publish/infrastructure/attempt.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const decoder = new TextDecoder();
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function manifest(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(path: string, prefix: string) {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory) {
        await visit(join(path, entry.name), prefix + entry.name + "/");
      } else if (entry.isFile) {
        result[prefix + entry.name] = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await Deno.readFile(join(path, entry.name)),
            ),
          ),
        ).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
  }
  await visit(root, "");
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b)),
  );
}
async function rejects(fn: () => Promise<unknown>, marker: string) {
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert(String(error).includes(marker), `Ожидался ${marker}: ${error}`);
}
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: "managed-portal-" });
  async function write(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  const config = `project:
  type: website
  output-dir: .project-publish/native
  render: []
  resources: [configured.txt, "!member/**", "!modules/**"]
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: _extensions/project-publish/entrypoints/post.ts
format: html
filters: [count.lua]
project-publish:
  portal: index.qmd
  output-dir: _site
  projects:
    member: {path: member, format: html}
  integrations: [modules/guard.ts]
`;
  await write("_quarto.yml", config);
  for (const profile of ["student", "full"]) {
    await write(
      `_quarto-${profile}.yml`,
      `project-publish:\n  output-dir: _site-${profile}\ntitle: ${profile} portal\n`,
    );
    await write(`member/_quarto-${profile}.yml`, "metadata: {}\n");
    await write(`_site-${profile}/index.html`, `${profile} old publication`);
    await write(`_site-${profile}/assets/old.txt`, `${profile} old asset`);
    await write(`_site-${profile}/.nojekyll`, "");
  }
  await write(
    "index.qmd",
    "# Portal\n\nCURRENT_PORTAL\n\n[Member](member/index.html)\n\n[Linked](linked.txt)\n",
  );
  await write("linked.txt", "LINKED_CURRENT");
  await write("configured.txt", "CONFIGURED_CURRENT");
  await write(
    "count.lua",
    'function Pandoc(doc) local f=assert(io.open(os.getenv("PORTAL_EVENTS"),"a")); f:write("portal-body\\n"); f:close(); return doc end\n',
  );
  await write(
    "member/_quarto.yml",
    "project:\n  type: default\n  render: [index.qmd]\nformat: html\n",
  );
  await write("member/index.qmd", "# Member\n\nCURRENT_MEMBER\n");
  await write(
    "modules/guard.ts",
    `export default {
    async beforeRender(c:any) {
      if(!c.portal || c.portal.input!==c.sourceRoot+"/index.qmd" || c.portal.output.startsWith(c.sourceRoot+"/") || c.profiles.join(",")!=="student") throw new Error("BAD_PORTAL_CONTEXT");
      await Deno.writeTextFile(Deno.env.get("PORTAL_EVENTS")!, "before\\n", {append:true});
      if(Deno.env.get("PORTAL_FAILURE")==="before") throw new Error("FAIL_BEFORE");
    },
    async metadata(c:any) {
      await Deno.writeTextFile(Deno.env.get("PORTAL_CONTEXTS")!, JSON.stringify(c)+"\\n", {append:true});
      if(c.namespace===undefined && Deno.env.get("PORTAL_FAILURE")==="child") return {filters:["missing-portal-filter.lua"]};
      if(c.namespace!==undefined && Deno.env.get("PORTAL_FAILURE")==="member") return {filters:["missing-member-filter.lua"]};
      return {title: c.namespace===undefined ? "ACTUAL_PORTAL_METADATA" : "ACTUAL_MEMBER_METADATA"};
    },
    async finalize(c:any) {
      if(!(await Deno.readTextFile(c.stage+"/index.html")).includes("CURRENT_PORTAL")) throw new Error("BAD_PORTAL_STAGE");
      await new Promise(r=>setTimeout(r,100));
      await Deno.writeTextFile(Deno.env.get("PORTAL_EVENTS")!, "finalizer:"+Date.now()+"\\n", {append:true});
      if(Deno.env.get("PORTAL_FAILURE")==="finalizer") throw new Error("FAIL_FINALIZER");
    }
  };\n`,
  );
  const before = {
    student: await manifest(join(root, "_site-student")),
    full: await manifest(join(root, "_site-full")),
    config: await Deno.readTextFile(join(root, "_quarto.yml")),
    profile: await Deno.readTextFile(join(root, "_quarto-student.yml")),
  };
  const env = {
    PORTAL_EVENTS: join(root, "_events.log"),
    PORTAL_CONTEXTS: join(root, "_contexts.jsonl"),
    QUARTO_PROFILE: "student",
    QUARTO_PROJECT_OUTPUT_DIR: "",
  };
  async function render(
    expected: boolean,
    failure = "",
    wrapper = false,
    extra: string[] = [],
  ) {
    const events: { at: number; kind: string; paths: string[] }[] = [];
    const watcher = Deno.watchFs([
      join(root, "_site-student"),
      join(root, "_site-full"),
    ], { recursive: true });
    const observing = (async () => {
      for await (const e of watcher) events.push({ at: Date.now(), ...e });
    })();
    const command = wrapper
      ? [
        "run",
        "_extensions/project-publish/entrypoints/render.ts",
        "--profile",
        "student",
        ...extra,
      ]
      : ["render", ".", "--profile", "student", ...extra];
    const r = await new Deno.Command(quarto, {
      args: command,
      cwd: root,
      env: { ...env, PORTAL_FAILURE: failure },
      stdout: "piped",
      stderr: "piped",
    }).output();
    watcher.close();
    await observing;
    const log = decoder.decode(r.stdout) + decoder.decode(r.stderr);
    assert(r.success === expected, log);
    assert(
      await Deno.readTextFile(join(root, "_quarto.yml")) === before.config,
      "Изменён авторский root config",
    );
    assert(
      await Deno.readTextFile(join(root, "_quarto-student.yml")) ===
        before.profile,
      "Изменён авторский audience profile",
    );
    assert(
      JSON.stringify(await manifest(join(root, "_site-full"))) ===
        JSON.stringify(before.full),
      "Изменён другой профиль",
    );
    if (!expected) {
      assert(
        JSON.stringify(await manifest(join(root, "_site-student"))) ===
          JSON.stringify(before.student),
        "Отказ уничтожил прежний успешный выпуск",
      );
      assert(
        events.length === 0,
        `До commit изменялся public: ${JSON.stringify(events)}`,
      );
    } else {
      const phases = await Deno.readTextFile(join(root, "_events.log"));
      const at = Number(phases.match(/finalizer:(\d+)/)![1]);
      assert(
        events.every((e) => e.at >= at),
        "Public изменялся до финализации stage",
      );
    }
    return log;
  }
  function withEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prior = Object.fromEntries(
      Object.keys(env).map((k) => [k, Deno.env.get(k)]),
    );
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    return fn().finally(() => {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    });
  }
  return { root, write, render, before, withEnv };
}
const cases: Record<
  string,
  (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>
> = {
  async before_failure(f) {
    const log = await f.render(false, "before");
    assert(
      log.includes("FAIL_BEFORE"),
      "beforeRender не выполнен в управляемом режиме: " + log,
    );
  },
  async child_failure(f) {
    assert(
      (await f.render(false, "child")).includes("missing-portal-filter"),
      "Не вызван отказ portal child",
    );
  },
  async member_failure(f) {
    assert(
      (await f.render(false, "member")).includes("missing-member-filter"),
      "Не вызван отказ member child",
    );
  },
  async outer_failure(f) {
    const config = f.before.config.replace(
      "post-render: _extensions/project-publish/entrypoints/post.ts",
      "post-render: [outer-fail.ts, _extensions/project-publish/entrypoints/post.ts]",
    );
    await f.write("_quarto.yml", config);
    f.before.config = config;
    await f.write(
      "outer-fail.ts",
      'if(Deno.env.get("PROJECT_PUBLISH_MEMBER")!=="1")throw new Error("OUTER_NATIVE_FAILURE");\n',
    );
    assert(
      (await f.render(false)).includes("OUTER_NATIVE_FAILURE"),
      "Не вызван native outer отказ до post",
    );
  },
  async finalizer_failure(f) {
    assert(
      (await f.render(false, "finalizer")).includes("FAIL_FINALIZER"),
      "Не вызван отказ finalizer",
    );
  },
  async success(f) {
    await f.render(true);
    const output = join(f.root, "_site-student");
    assert(
      (await Deno.readTextFile(join(output, "index.html"))).includes(
        "ACTUAL_PORTAL_METADATA",
      ),
      "Потерян metadata portal",
    );
    assert(
      (await Deno.readTextFile(join(output, "member/index.html"))).includes(
        "ACTUAL_MEMBER_METADATA",
      ),
      "Потерян metadata member",
    );
    for (const file of ["linked.txt", "configured.txt"]) {
      assert(
        await Deno.readTextFile(join(output, file)) ===
          await Deno.readTextFile(join(f.root, file)),
        "Потеряны текущие ресурсы",
      );
    }
    const phases = await Deno.readTextFile(join(f.root, "_events.log"));
    assert(
      phases.split("portal-body").length === 2,
      "Portal body выполнен не один раз",
    );
    const contexts = (await Deno.readTextFile(join(f.root, "_contexts.jsonl")))
      .trim().split("\n").map((x) => JSON.parse(x));
    assert(
      contexts.length === 2 && contexts[0].namespace === undefined &&
        contexts[1].namespace === "member",
      "Portal получил выдуманный namespace или изменён member context",
    );
    assert(
      contexts[0].output === contexts[0].portal.output,
      "Metadata output не соответствует portal render",
    );
    assert(
      !Object.keys(await manifest(output)).includes(
        "_quarto-publish-portal.yml",
      ),
      "Служебный control опубликован",
    );
    assert(
      !Object.keys(await manifest(output)).includes("assets/old.txt"),
      "Новая публикация содержит старые файлы",
    );
  },
  async commit_failure(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      await rejects(() =>
        publish(w, state, async (from, to) => {
          if (from.endsWith("publish-" + state.id)) {
            throw new Error("INJECTED_COMMIT_FAILURE");
          }
          await Deno.rename(from, to);
        }), "INJECTED_COMMIT_FAILURE");
      assert(
        JSON.stringify(await manifest(w.output)) ===
          JSON.stringify(f.before.student),
        "Rollback потерял прежний выпуск",
      );
      assert(
        JSON.stringify(await manifest(join(f.root, "_site-full"))) ===
          JSON.stringify(f.before.full),
        "Rollback изменил другой профиль",
      );
    });
  },
  async old_rename_failure(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      await rejects(() =>
        publish(w, state, async (from, to) => {
          if (from === w.output) throw new Error("OLD_RENAME_FAILURE");
          await Deno.rename(from, to);
        }), "OLD_RENAME_FAILURE");
      assert(
        JSON.stringify(await manifest(w.output)) ===
          JSON.stringify(f.before.student),
        "Отказ backup rename изменил прежний выпуск",
      );
    });
  },
  async rollback_failure(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      await rejects(() =>
        publish(w, state, async (from, to) => {
          if (
            from.endsWith("publish-" + state.id) ||
            from.endsWith("output-" + state.id)
          ) throw new Error("BROKEN_RENAME");
          await Deno.rename(from, to);
        }), "восстановление");
      const backup = join(f.root, ".project-publish/output-" + state.id);
      assert(
        JSON.stringify(await manifest(backup)) ===
          JSON.stringify(f.before.student),
        "Rollback failure уничтожил backup",
      );
      await runtime().cleanup(w, state, true);
      await rejects(() => runtime().clearState(w), "recovery backup");
      assert(
        JSON.stringify(await manifest(backup)) ===
          JSON.stringify(f.before.student),
        "Следующая попытка удалила recovery backup",
      );
    });
  },
  async backup_cleanup_failure(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      const original = Deno.remove;
      Deno.remove = async (path, options) => {
        if (String(path).endsWith("output-" + state.id)) {
          throw new Error("BACKUP_REMOVE_FAILURE");
        }
        return await original(path, options);
      };
      try {
        await publish(w, state);
      } finally {
        Deno.remove = original;
      }
      assert(
        (await Deno.readTextFile(join(w.output, "index.html"))).includes(
          "CURRENT_PORTAL",
        ),
        "Postcommit cleanup удалил новый выпуск",
      );
    });
  },
  async symlink_public(f) {
    const outside = await Deno.makeTempDir();
    try {
      await Deno.remove(join(f.root, "_site-student"), { recursive: true });
      await Deno.symlink(outside, join(f.root, "_site-student"));
      await f.withEnv(() => rejects(() => workspace(f.root), "символическ"));
    } finally {
      await Deno.remove(outside, { recursive: true });
    }
  },
  async symlink_storage(f) {
    const outside = await Deno.makeTempDir();
    try {
      await Deno.symlink(outside, join(f.root, ".project-publish"));
      await f.withEnv(() => rejects(() => workspace(f.root), "символическ"));
    } finally {
      await Deno.remove(outside, { recursive: true });
    }
  },
  async profile_group(f) {
    await f.write(
      "_quarto.yml",
      f.before.config + "profile:\n  group: [[student, publish-portal]]\n",
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "publish-portal"));
  },
  async control_drift(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      await Deno.writeTextFile((state as any).portal.control, "{}");
      await rejects(() => publish(w, state), "control");
      assert(
        JSON.stringify(await manifest(w.output)) ===
          JSON.stringify(f.before.student),
        "Control drift изменил public",
      );
    });
  },
  async config_drift(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      await Deno.writeTextFile(
        join(state.sourceRoot, "_quarto-student.yml"),
        "title: CHANGED\n",
      );
      await rejects(() => publish(w, state), "config");
      assert(
        JSON.stringify(await manifest(w.output)) ===
          JSON.stringify(f.before.student),
        "Snapshot config drift изменил public",
      );
    });
  },
  async state_drift(f) {
    await f.withEnv(async () => {
      const w = await workspace(f.root), state = await renderMembers(w);
      (state as any).portal.output = w.output;
      await rejects(async () => owned(state, f.root), "поврежден");
      assert(
        JSON.stringify(await manifest(w.output)) ===
          JSON.stringify(f.before.student),
        "State drift изменил public",
      );
    });
  },
  async wrapper_override(f) {
    const log = await f.render(false, "", true, [
      "--output-dir",
      "_site-student",
    ]);
    assert(log.includes("--output-dir"), "Wrapper не объяснил отказ override");
  },
  async wrapper_success(f) {
    await f.render(true, "", true);
  },
  async broad_resources(f) {
    const config = f.before.config.replace(
      'resources: [configured.txt, "!member/**", "!modules/**"]',
      'resources: ["**/*", "!member/**", "!modules/**"]',
    );
    await f.write("_quarto.yml", config);
    f.before.config = config;
    await f.render(true);
    assert(
      !(Object.keys(await manifest(join(f.root, "_site-student"))).includes(
        "_quarto-publish-portal.yml",
      )),
      "Broad selection опубликовала native control",
    );
  },
  async yaml_profile_output(f) {
    await Deno.rename(
      join(f.root, "_quarto-full.yml"),
      join(f.root, "_quarto-full.yaml"),
    );
    const config = f.before.config.replace(
      'resources: [configured.txt, "!member/**", "!modules/**"]',
      'resources: ["**/*", "!member/**", "!modules/**"]',
    );
    await f.write("_quarto.yml", config);
    f.before.config = config;
    await f.render(true, "", true);
    const paths = Object.keys(await manifest(join(f.root, "_site-student")));
    assert(
      !paths.some((path) => path.startsWith("_site-full/")),
      "Previous .yaml profile publication copied into student output",
    );
    await f.withEnv(async () =>
      assert(
        (await workspace(f.root)).outputs.includes("_site-full"),
        "Native .yaml profile output absent from exclusions",
      )
    );
  },
  async yaml_profile_failure(f) {
    await Deno.rename(
      join(f.root, "_quarto-full.yml"),
      join(f.root, "_quarto-full.yaml"),
    );
    const config = f.before.config.replace(
      'resources: [configured.txt, "!member/**", "!modules/**"]',
      'resources: ["**/*", "!member/**", "!modules/**"]',
    );
    await f.write("_quarto.yml", config);
    f.before.config = config;
    assert(
      (await f.render(false, "finalizer", true)).includes("FAIL_FINALIZER"),
      "Не вызван finalizer refusal для .yaml profile",
    );
  },
  async preview_failure(f) {
    await f.render(true);
    const published = await manifest(join(f.root, "_site-student"));
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const pidFile = join(f.root, ".project-publish/preview-test.pid");
    await f.write(
      "preview-test.ts",
      `await Deno.writeTextFile(${
        JSON.stringify(pidFile)
      },String(Deno.pid));await import("./_extensions/project-publish/entrypoints/preview.ts");\n`,
    );
    const child = new Deno.Command(quarto, {
      args: [
        "run",
        "preview-test.ts",
        "--port",
        String(port),
        "--host",
        "127.0.0.1",
      ],
      cwd: f.root,
      env: {
        QUARTO_PROFILE: "student",
        QUARTO_PROJECT_OUTPUT_DIR: "",
        PORTAL_EVENTS: join(f.root, ".project-publish/preview-events.log"),
        PORTAL_CONTEXTS: join(
          f.root,
          ".project-publish/preview-contexts.jsonl",
        ),
        PORTAL_FAILURE: "finalizer",
      },
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    let log = "";
    const pump = async (stream: ReadableStream<Uint8Array>) => {
      for await (const bytes of stream) log += decoder.decode(bytes);
    };
    const readers = [pump(child.stdout), pump(child.stderr)];
    async function waitFor(predicate: () => boolean) {
      const start = Date.now();
      while (!predicate()) {
        assert(Date.now() - start < 45000, "Preview timeout: " + log);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    try {
      await waitFor(() => log.includes("Публикация предпросмотр готов"));
      const original = await (await fetch(`http://127.0.0.1:${port}/`)).text();
      await f.write(
        "index.qmd",
        await Deno.readTextFile(join(f.root, "index.qmd")) +
          "\nPREVIEW_CHANGED\n",
      );
      await waitFor(() =>
        log.includes("продолжает показывать последнюю успешную сборку")
      );
      const retained = await (await fetch(`http://127.0.0.1:${port}/`)).text();
      assert(
        retained === original && !retained.includes("PREVIEW_CHANGED"),
        "Preview отказ заменил успешный снимок",
      );
      assert(
        JSON.stringify(await manifest(join(f.root, "_site-student"))) ===
          JSON.stringify(published),
        "Preview отказ уничтожил опубликованный выпуск",
      );
      assert(
        JSON.stringify(await manifest(join(f.root, "_site-full"))) ===
          JSON.stringify(f.before.full),
        "Preview изменил другой профиль",
      );
    } finally {
      // quarto run запускает отдельный Deno: останавливаем actual HTTP/watch process.
      Deno.kill(Number(await Deno.readTextFile(pidFile)), "SIGTERM");
      await child.status;
      await Promise.all(readers);
    }
  },
  async collision(f) {
    await f.write("_quarto-publish-portal.yml", "project: {}\n");
    await f.withEnv(() => rejects(() => workspace(f.root), "publish-portal"));
  },
  async collision_yaml(f) {
    await f.write("_quarto-publish-portal.yaml", "project: {}\n");
    await f.withEnv(() => rejects(() => workspace(f.root), "publish-portal"));
  },
  async included_profile_group(f) {
    await f.write(
      "_quarto.yml",
      f.before.config + "metadata-files: [options.yml]\n",
    );
    await f.write(
      "options.yml",
      "profile:\n  group: [[student, publish-portal]]\n",
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "publish-portal"));
  },
  async native_source_overlap(f) {
    await f.write(
      "_quarto.yml",
      f.before.config.replace("path: member", "path: .project-publish/native"),
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "пересекаются"));
  },
  async portal_home(f) {
    await f.write(
      "_quarto.yml",
      f.before.config.replace(
        "  portal: index.qmd",
        "  portal: index.qmd\n  home: member",
      ),
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "home"));
  },
  async public_native(f) {
    await f.write(
      "_quarto.yml",
      f.before.config.replace(
        "output-dir: .project-publish/native",
        "output-dir: _site-student",
      ),
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "native"));
  },
  async public_overlap(f) {
    await f.write(
      "_quarto-student.yml",
      "project-publish:\n  output-dir: member\n",
    );
    await f.withEnv(() => rejects(() => workspace(f.root), "пересекаются"));
  },
};
const selection = Deno.args.indexOf("--case"),
  selected = selection >= 0 ? Deno.args[selection + 1] : undefined;
if (selection >= 0 && (!selected || !Object.hasOwn(cases, selected))) {
  throw new Error("Неизвестный managed portal case");
}
for (const [name, test] of Object.entries(cases)) {
  if (selected && selected !== name) continue;
  const f = await fixture();
  try {
    await test(f);
    console.log(`PASS managed portal ${name}`);
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
}
