const run = (args: string[]) => {
  const value = new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "null",
  }).outputSync();
  return value.success ? new TextDecoder().decode(value.stdout).trim() : "";
};
const version = new Deno.Command("quarto", {
  args: ["--version"],
  stdout: "piped",
  stderr: "null",
}).outputSync();
if (!version.success) throw new Error("Не удалось записать версию Quarto");
Deno.writeTextFileSync(
  "_site/BUILD.json",
  JSON.stringify(
    {
      producer: "Afonenko-Course-Tools/quarto-project-publish",
      commit: Deno.env.get("DEMO_SOURCE_COMMIT") || run(["rev-parse", "HEAD"]),
      sourceDirty: Deno.env.get("DEMO_SOURCE_DIRTY") === "true" ||
        run(["status", "--porcelain"]).length > 0,
      dependencies: {
        ...{
          "quarto-project-publish": "v4.0.1",
          "quarto-reference-catalog": "v2.2.1",
        },
        quarto: new TextDecoder().decode(version.stdout).trim(),
      },
      projection: "full",
      commands: ["task install", "task render"],
    },
    null,
    2,
  ) + "\n",
);
