import { dirname, join } from "stdlib/path";
import * as config from "../_extensions/course-site/infrastructure/config.ts";
import { assert, assertEquals, assertRejects } from "./support.ts";
const NativeCommand = Deno.Command, commands: any[] = [];
(Deno as any).Command = new Proxy(NativeCommand, {
  construct(target, args: any[]) {
    const command = Reflect.construct(target, args),
      output = command.output.bind(command);
    command.output = async () => {
      const result = await output();
      if (args[1]?.args?.[0] === "inspect" && result.success) {
        const project = JSON.parse(new TextDecoder().decode(result.stdout));
        commands.push({
          args: args[1].args,
          inputs: project.files?.input.length,
          populated: Object.keys(project.fileInformation || {}).length,
        });
      }
      return result;
    };
    return command;
  },
});
const root = await Deno.makeTempDir({ prefix: "site-native-plan-" });
try {
  await Deno.mkdir(join(root, "child"));
  const value = {
    project: { type: "website", "output-dir": "_site" },
    subprojects: [{ path: "child", to: "default" }],
  };
  const ws = await config.validateConfig(root, value, []);
  assertEquals(ws.projects[0].to, "default");
  for (
    const bad of [["child"], [{ path: "child" }], [{
      path: "child",
      to: "pdf",
    }], [{ path: "child", to: "default", unknown: true }]]
  ) {
    await assertRejects(
      () => config.validateConfig(root, { ...value, subprojects: bad }, []),
      "SITE.CONFIG_INVALID",
      ["subprojects"],
    );
  }
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\nformat: html\nsubprojects: [{path: child, to: default}]\n",
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Корень\n");
  const project = await (config as any).inspectProject(root, []);
  assertEquals(project.selectedSources, ["index.qmd"]);
  assertEquals(project.config.project.type, "website");
  await Deno.writeTextFile(join(root, "second.qmd"), "# Второй\n");
  await Deno.writeTextFile(join(root, "third.qmd"), "# Третий\n");
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    (await Deno.readTextFile(join(root, "_quarto.yml"))).replace(
      "render: [index.qmd]",
      "render: [index.qmd, second.qmd, third.qmd]",
    ),
  );
  const three = await config.inspectProject(root, []);
  assertEquals(three.selectedSources, ["index.qmd", "second.qmd", "third.qmd"]);
  assert(
    commands.length === 2 &&
      commands.every((command) => command.args[1] === root),
    "Publisher выполнил document inspect",
  );
  assertEquals(commands.map((command) => command.inputs), [1, 3]);
  assertEquals(commands.map((command) => command.populated), [1, 3]);
  console.log(
    JSON.stringify({
      status: "PASS",
      scope: "native owner selected set",
      commands,
    }),
  );
} finally {
  (Deno as any).Command = NativeCommand;
  await Deno.remove(root, { recursive: true });
}
