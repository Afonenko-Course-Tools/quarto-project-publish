import { fixture } from "./fixtures.ts";
import { loadSite } from "./results.ts";
import { record } from "../_extensions/course-site/infrastructure/values.ts";
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "site-inspect-version-" });
const saved = Deno.env.toObject(),
  originalCommand = Deno.Command;
const commands: string[][] = [],
  failures: string[] = [];
let version: unknown = "1.11.5";
let malformed = false;
try {
  const extension = join(root, "_extensions/course-site");
  await copy(join(repo, "_extensions/course-site"), extension);
  const qrc = join(root, "_extensions/reference-catalog");
  await Deno.mkdir(qrc, { recursive: true });
  await Deno.writeTextFile(join(qrc, "public.ts"), await fixture("qrc-spy.ts"));
  const { post } = await loadSite("compose", toFileUrl(join(extension, "application/compose.ts")).href);
  const { workspace } = await loadSite("config", toFileUrl(join(extension, "infrastructure/config.ts")).href);
  Deno.env.set("QUARTO_PROFILE", "student");
  Deno.env.delete("QUARTO_PROJECT_OUTPUT_DIR");
  Deno.env.delete("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES");
  Object.defineProperty(Deno, "Command", {
    configurable: true,
    writable: true,
    value: class extends originalCommand {
      args: string[];
      cwd: string;
      constructor(tool: string | URL, options: Deno.CommandOptions = {}) {
        super(tool, options);
        this.args = [...(options.args || [])];
        this.cwd = options.cwd instanceof URL ? options.cwd.pathname : options.cwd || Deno.cwd();
      }
      override output() {
        commands.push(this.args);
        assert(this.args[0] === "inspect", "Лишняя команда Quarto: " + this.args);
        assertEquals(this.args, ["inspect", this.cwd, "--profile", "student"]);
        return Promise.resolve({
          success: true,
          code: 0,
          signal: null,
          stdout: new TextEncoder().encode(
            malformed
              ? "{"
              : JSON.stringify({
                  quarto: { version },
                  config: {
                    project: { type: "website", "output-dir": "_site" },
                    subprojects: ["child"],
                    "reference-catalog": { namespace: "root" },
                  },
                  files: { input: [join(this.cwd, "index.qmd")], resources: [] },
                }),
          ),
          stderr: new Uint8Array(),
        });
      }
      override spawn(): never {
        throw Error("Рендер запрещён в адресной проверке");
      }
    },
  });
  for (const scope of ["local", "full"]) {
    const owner = join(root, scope),
      output = join(owner, "_site");
    const child = join(owner, "child"),
      childOutput = join(child, "_site");
    await Deno.mkdir(childOutput, { recursive: true });
    await Deno.mkdir(output, { recursive: true });
    await Deno.writeTextFile(join(owner, "index.qmd"), "# Корень\n");
    await Deno.writeTextFile(join(output, "index.html"), "<html><body>Корень</body></html>");
    await Deno.writeTextFile(join(childOutput, "index.html"), "<html><body>Компонент</body></html>");
    Deno.env.set("QUARTO_PROJECT_RENDER_ALL", scope === "full" ? "1" : "0");
    Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", join(output, "index.html"));
    version = scope === "local" ? " 1.11.5\n " : "1.11.6";
    const before = commands.length;
    if (scope === "full") {
      const ws = await workspace(owner),
        run = join(owner, "_generated/course-site/runs/current");
      await Deno.mkdir(run, { recursive: true });
      const project = ws.projects[0];
      assert(project, "Нет проекта workspace для inspect fixture");
      await Deno.writeTextFile(
        join(owner, "_generated/course-site/active.json"),
        JSON.stringify({
          ws,
          run,
          records: [
            {
              project,
              config: {
                project: { type: "website" },
                "reference-catalog": { namespace: "child" },
              },
              record: {
                id: project.id,
                projectRoot: child,
                outputDir: childOutput,
                profiles: ws.profiles,
                nativeOutputs: [join(childOutput, "index.html")],
                files: [join(childOutput, "index.html")],
                selectedSources: [],
              },
            },
          ],
        }),
      );
    }
    const activePath = join(owner, "_generated/course-site/active.json");
    const activeState =
      scope === "full" ? record(JSON.parse(await Deno.readTextFile(activePath)), owner, "active") : undefined;
    try {
      await post(owner);
      const requestValue: unknown = JSON.parse(await Deno.readTextFile(join(owner, "qrc-call.json")));
      const request = record(requestValue, owner, "request");
      assertEquals(request.quarto, scope === "local" ? "1.11.5" : "1.11.6");
      assertEquals(request.scope, scope);
      assertEquals(
        request.outputs,
        scope === "local"
          ? [join(output, "index.html")]
          : [join(output, "index.html"), join(output, "child/index.html")],
      );
      assertEquals(
        request.members,
        scope === "local"
          ? [{ namespace: "root", format: "html" }]
          : [
              { namespace: "child", format: "html" },
              {
                namespace: "root",
                format: "html",
              },
            ],
      );
      assertEquals(commands.length - before, 1);
      if (scope === "full") {
        assert((await Deno.readTextFile(join(output, "child/index.html"))).includes("Компонент"));
        const compositionValue: unknown = JSON.parse(
          await Deno.readTextFile(join(owner, "_generated/course-site/runs/current/composition.json")),
        );
        assertEquals(record(compositionValue, owner, "composition").outputs, request.outputs);
        assert(activeState);
        delete record(activeState.ws, owner, "active.ws").quartoVersion;
        await Deno.writeTextFile(activePath, JSON.stringify(activeState));
        await Deno.remove(join(output, "child"), { recursive: true });
        await Deno.remove(join(owner, "qrc-call.json"));
        let staleError: unknown;
        try {
          await post(owner);
        } catch (error) {
          staleError = error;
        }
        assert(staleError instanceof Error && "code" in staleError);
        assertEquals(staleError.code, "SITE.CONFIG_INVALID");
        assert(String(staleError).includes("quarto.version"));
        for (const path of [join(output, "child"), join(owner, "qrc-call.json")]) {
          let exists = false;
          try {
            await Deno.stat(path);
            exists = true;
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
          assert(!exists, "State без версии начал mount/QRC: " + path);
        }
        assertEquals(commands.length - before, 1);
      }
    } catch (error) {
      failures.push(scope + ": " + error);
    }
  }
  for (version of [undefined, null, 12, "", " \n "]) {
    let error: unknown;
    try {
      await workspace(join(root, "local"));
    } catch (caught) {
      error = caught;
    }
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "SITE.CONFIG_INVALID" ||
      !String(error).includes("quarto.version")
    ) {
      failures.push("Не отклонена native версия: " + JSON.stringify(version));
    }
  }
  malformed = true;
  let malformedFailure: unknown;
  const beforeMalformed = commands.length;
  try {
    await workspace(join(root, "local"));
  } catch (cause) {
    malformedFailure = cause;
  }
  assert(
    malformedFailure instanceof Error && "code" in malformedFailure && malformedFailure.code === "SITE.CONFIG_INVALID",
    "Malformed inspect должен дать адресный SITE.CONFIG_INVALID",
  );
  assert(malformedFailure.cause instanceof SyntaxError, "Inspect потерял исходный JSON cause");
  assert(
    malformedFailure.message.includes(join(root, "local")) && malformedFailure.message.includes("inspect"),
    "Inspect потерял source/field",
  );
  assertEquals(commands.length - beforeMalformed, 1);
  assertEquals(failures, []);
  console.log(
    "PASS local/full QRC используют native inspect version; неверная версия отклоняется; render/--version отсутствуют",
  );
} finally {
  Object.defineProperty(Deno, "Command", {
    configurable: true,
    writable: true,
    value: originalCommand,
  });
  for (const key of Object.keys(Deno.env.toObject())) {
    if (!(key in saved)) Deno.env.delete(key);
  }
  for (const [key, value] of Object.entries(saved)) Deno.env.set(key, value);
  await Deno.remove(root, { recursive: true });
}
