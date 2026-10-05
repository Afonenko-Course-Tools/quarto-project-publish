// The native fixture records actual subprocesses; workspace validation stays real.
import { join } from "stdlib/path";
import { workspace } from "../_extensions/project-publish/infrastructure/config.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const root = await Deno.makeTempDir({ prefix: "publisher-inspect-" });
const saved = new Map(
  ["QUARTO", "QUARTO_PROFILE", "QUARTO_PROJECT_OUTPUT_DIR"].map(
    (name) => [name, Deno.env.get(name)],
  ),
);
const calls = join(root, "calls.jsonl");
async function count(profiles: string[], expected: string[]) {
  Deno.env.set("QUARTO_PROFILE", profiles.join(","));
  await Deno.writeTextFile(calls, "");
  const result = await workspace(root);
  const actual = (await Deno.readTextFile(calls)).trim().split("\n");
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected inspect profiles ${JSON.stringify(expected)}, got ${
      JSON.stringify(actual)
    }`,
  );
  return result;
}
try {
  await Deno.mkdir(join(root, "member"));
  for (const dir of [root, join(root, "member")]) {
    for (const profile of ["student", "full"]) {
      await Deno.writeTextFile(join(dir, `_quarto-${profile}.yml`), "{}\n");
    }
  }
  await Deno.writeTextFile(join(root, "member/_quarto.yml"), "format: html\n");
  const writeConfig = (title: string) =>
    Deno.writeTextFile(
      join(root, "_quarto.yml"),
      JSON.stringify({
        title,
        project: { type: "website", "output-dir": "_site", render: [] },
        "project-publish": {
          home: "member",
          projects: { member: { path: "member" } },
        },
      }),
    );
  await writeConfig("first");
  const fake = join(root, "quarto.sh");
  await Deno.writeTextFile(
    fake,
    `#!/bin/sh
[ "$1" = inspect ] || exit 91
profile=default
[ "$3" != --profile ] || profile="$4"
printf '%s\\n' "$profile" >> "$PWD/calls.jsonl"
printf '{"config":'
cat "$PWD/_quarto.yml" || exit 92
printf ',"files":{"config":["%s/_quarto.yml"]}}' "$PWD"
`,
  );
  await Deno.chmod(fake, 0o700);
  Deno.env.set("QUARTO", fake);
  Deno.env.set("QUARTO_PROJECT_OUTPUT_DIR", "");
  assert(
    (await count(["student"], ["student", "full"])).config.title === "first",
    "Lost initial native config",
  );
  // Combined profiles are ordered effective configurations, never singleton hits.
  await count(["full", "student"], ["full,student", "full", "student"]);
  await count(["student", "full"], ["student,full", "full", "student"]);
  await count([], ["default", "full", "student"]);
  await writeConfig("changed");
  assert(
    (await count(["student"], ["student", "full"])).config.title === "changed",
    "A later workspace reused stale config",
  );
  await Deno.remove(join(root, "member/_quarto-student.yml"));
  let refused = false;
  try {
    await workspace(root);
  } catch (error) {
    refused = String(error).includes("отсутствует _quarto-student.yml");
  }
  assert(refused, "A later workspace hid a missing child profile");
  await Deno.writeTextFile(join(root, "member/_quarto-student.yml"), "{}\n");
  await count(["student"], ["student", "full"]);
  console.log(
    "PASS workspace inspect: exact singleton reuse, ordered combinations, fresh configs and failed-operation retry",
  );
} finally {
  for (const [name, value] of saved) {
    value === undefined ? Deno.env.delete(name) : Deno.env.set(name, value);
  }
  await Deno.remove(root, { recursive: true });
}
