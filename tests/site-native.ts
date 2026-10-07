import { dirname, fromFileUrl, join } from "stdlib/path";
import { assert, assertEquals } from "./support.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = Deno.env.get("COURSE_SITE_TEST_ROOT") ||
  await Deno.makeTempDir({ prefix: "course-site-native-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const mode = Deno.args[0] || "all";
async function write(name: string, text: string) {
  const path = join(root, name);
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, text);
}
async function run(
  args: string[],
  cwd = root,
  success = true,
  env: Record<string, string> = {},
) {
  const r = await new Deno.Command(quarto, {
    args,
    cwd,
    env: {
      QUARTO: quarto,
      COURSE_BUILD_TRACE: join(root, "trace.jsonl"),
      ...env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  await write(`logs/${crypto.randomUUID()}.log`, text);
  assert(
    r.success === success,
    `unexpected exit ${r.code}: ${args.join(" ")}\n${text}`,
  );
  return text;
}
await Deno.mkdir(root, { recursive: true });
console.log(`Fixture: ${root}`);
await write(
  "_quarto.yml",
  `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format:
  html:
    theme: cosmo
subprojects: [part]
`,
);
await write("index.qmd", "# Root\n\n[Lesson](part/index.html)\n");
await write(
  "part/_quarto.yml",
  `project:
  type: website
  output-dir: _output/default
  render: [index.qmd, later.qmd]
  resources: [asset.txt]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format:
  html:
    theme: cosmo
`,
);
await write(
  "part/index.qmd",
  '# Part\n\nPUBLIC_PART\n\n::: {.content-visible when-profile="full"}\nPRIVATE_PART\n:::\n',
);
await write("part/later.qmd", "# Later\n");
await write("part/asset.txt", "CURRENT_ASSET");
for (const profile of ["student", "full"]) {
  await write(
    `_quarto-${profile}.yml`,
    `project:\n  output-dir: _site-${profile}\n`,
  );
  await write(
    `part/_quarto-${profile}.yml`,
    `project:\n  output-dir: _output/${profile}\n`,
  );
}
await run(["add", repo, "--no-prompt"]);
if (mode === "warnings") {
  await write(
    "part/warning.lua",
    "function Pandoc(doc) pandoc.log.warn('NATIVE_WARNING_SENTINEL'); return doc end\n",
  );
  const child = await Deno.readTextFile(join(root, "part/_quarto.yml"));
  await write("part/_quarto.yml", child + "\nfilters: [warning.lua]\n");
  const inherited = await run(["render", "--fail-if-warnings"]);
  assert(
    inherited.includes("NATIVE_WARNING_SENTINEL"),
    "child warning missing",
  );
  assert(
    (await Deno.readTextFile(join(root, "_site/part/index.html"))).includes(
      "PUBLIC_PART",
    ),
  );
  let calls = (await Deno.readTextFile(join(root, "trace.jsonl"))).trim().split(
    "\n",
  ).map((line) => JSON.parse(line)).filter((row) => row.kind === "render");
  assertEquals(calls.length, 1);
  assert(
    !calls[0].args.includes("--fail-if-warnings"),
    "root flag unexpectedly forwarded",
  );
  await write(
    "part/_quarto.yml",
    child + "\nfilters: [warning.lua]\nfail-if-warnings: true\n",
  );
  const strict = await run(["render"], root, false);
  assert(
    strict.includes("NATIVE_WARNING_SENTINEL"),
    "strict child warning missing",
  );
  calls = (await Deno.readTextFile(join(root, "trace.jsonl"))).trim().split(
    "\n",
  ).map((line) => JSON.parse(line)).filter((row) => row.kind === "render");
  assertEquals(calls.length, 2);
  assert(calls[1].exitCode !== 0, "strict warning child succeeded");
  for (
    const path of [
      "_generated/course-site/active.json",
      "_site/part/index.html",
    ]
  ) {
    try {
      await Deno.stat(join(root, path));
      throw new Error(`failed composition exposed ${path}`);
    } catch (error) {
      assert(error instanceof Deno.errors.NotFound, String(error));
    }
  }
  console.log(
    "PASS root warning flag stays local; native child warning strictness aborts composition",
  );
  Deno.exit(0);
}
await run(["render"]);
assert(
  (await Deno.readTextFile(join(root, "_site/part/index.html"))).includes(
    "PUBLIC_PART",
  ),
  "missing mounted current HTML",
);
assertEquals(
  await Deno.readTextFile(join(root, "_site/part/asset.txt")),
  "CURRENT_ASSET",
);
let trace = (await Deno.readTextFile(join(root, "trace.jsonl"))).trim().split(
  "\n",
).map((line) => JSON.parse(line));
assertEquals(trace.filter((x) => x.kind === "render").length, 1);
assert(
  (await Deno.readTextFile(join(root, "_site/part/search.json"))).includes(
    "PUBLIC_PART",
  ),
  "missing fresh search",
);
if (mode === "smoke") {
  console.log(
    "PASS installed native composition, one render, assets and search",
  );
  Deno.exit(0);
}
await write("part/.quarto/cache-sentinel", "keep");
await write("part/_freeze/cache-sentinel", "keep");
await write("part/_output/default/stale.html", "OLD");
await run(["render", "index.qmd"]);
let missing = false;
try {
  await Deno.stat(join(root, "_site/part/stale.html"));
} catch {
  missing = true;
}
assert(missing, "retained output entered fresh collection");
for (const profile of ["student", "full", "student"]) {
  await run(["render", "--profile", profile]);
  const html = await Deno.readTextFile(
    join(root, `_site-${profile}/part/index.html`),
  );
  assertEquals(html.includes("PRIVATE_PART"), profile === "full");
}
assert(
  (await Deno.readTextFile(join(root, "_site-full/part/index.html")))
    .includes("PRIVATE_PART"),
  "student deleted full output",
);
assertEquals(
  await Deno.readTextFile(join(root, "part/.quarto/cache-sentinel")),
  "keep",
);
assertEquals(
  await Deno.readTextFile(join(root, "part/_freeze/cache-sentinel")),
  "keep",
);
await write("part/fail.ts", "throw new Error('LATE_CHILD_FAILURE');\n");
const original = await Deno.readTextFile(join(root, "part/_quarto.yml"));
await write(
  "part/_quarto.yml",
  original.replace(
    "  post-render: ../_extensions/course-site/entrypoints/collect.ts",
    "  post-render:\n    - ../_extensions/course-site/entrypoints/collect.ts\n    - fail.ts",
  ),
);
const failed = await run(["render"], root, false);
assert(
  failed.includes("LATE_CHILD_FAILURE"),
  "native failure lost later-hook diagnostics",
);
assertEquals(failed.split("Error: LATE_CHILD_FAILURE").length - 1, 1);
try {
  await Deno.stat(join(root, "_generated/course-site/active.json"));
  throw new Error("failure retained active result");
} catch (error) {
  assert(error instanceof Deno.errors.NotFound, String(error));
}
await write("part/_quarto.yml", original);
await run(["render"]);
await Deno.remove(join(root, "part/later.qmd"));
await write(
  "part/_quarto.yml",
  original.replace("[index.qmd, later.qmd]", "[index.qmd]"),
);
await run(["render"]);
missing = false;
try {
  await Deno.stat(join(root, "_site/part/later.html"));
} catch {
  missing = true;
}
assert(missing, "deleted source retained mounted HTML");
await run(["render", "index.qmd"], join(root, "part"));
const currentConfig = await Deno.readTextFile(join(root, "part/_quarto.yml"));
await write(
  "part/generate.ts",
  "await Deno.writeTextFile('generated.qmd', '# Fresh generated input\\n');\n",
);
await write(
  "part/_quarto.yml",
  currentConfig.replace(
    "render: [index.qmd]",
    "render: ['*.qmd']\n  pre-render: generate.ts",
  ),
);
await run(["render"]);
assert(
  (await Deno.readTextFile(join(root, "_site/part/generated.html")))
    .includes("Fresh generated input"),
  "author pre-hook generated input missing",
);
const rootConfig = await Deno.readTextFile(join(root, "_quarto.yml"));
await write("_quarto.yml", rootConfig + "\nprofile:\n  default: student\n");
await run(["render"]);
assert(
  !(await Deno.readTextFile(join(root, "_site-student/part/index.html")))
    .includes("PRIVATE_PART"),
  "default profile lost student audience",
);
await write("_quarto.yml", rootConfig);
console.log(
  "PASS installed native selected/root renders, current files, profile isolation, caches, late failure/retry, removed input and standalone member",
);
