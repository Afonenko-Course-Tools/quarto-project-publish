// Genuine installed Publisher failures after Pandoc, not Owner/current acceptance.
// This catches moving onFailure after build cleanup, omitting its await, or losing
// the failed child context. Every command uses the actual stock Quarto executable.
import { dirname, fromFileUrl, isAbsolute, join, relative } from "stdlib/path";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const decoder = new TextDecoder();
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
async function sha(bytes: Uint8Array, algorithm = "SHA-256") {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(algorithm, new Uint8Array(bytes).buffer),
    ),
  ).map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function fileMap(root: string) {
  const result: Record<string, { bytes: number; sha256: string }> = {};
  async function visit(path: string) {
    for await (const entry of Deno.readDir(path)) {
      const target = join(path, entry.name);
      assert(!entry.isSymlink, "fixture/package symlink: " + target);
      if (entry.isDirectory) await visit(target);
      else {
        assert(entry.isFile, "nonregular fixture/package file: " + target);
        const bytes = await Deno.readFile(target);
        result[relative(root, target).replaceAll("\\", "/")] = {
          bytes: bytes.length,
          sha256: await sha(bytes),
        };
      }
    }
  }
  await visit(root);
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b)),
  );
}
async function writeJSON(path: string, value: unknown) {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}
async function executable() {
  const configured = Deno.env.get("QUARTO");
  if (configured) {
    assert(isAbsolute(configured), "QUARTO must be an absolute stock CLI");
    return await Deno.realPath(configured);
  }
  for (const directory of (Deno.env.get("PATH") || "").split(":")) {
    if (directory && await exists(join(directory, "quarto"))) {
      return await Deno.realPath(join(directory, "quarto"));
    }
  }
  throw new Error("actual Quarto executable is unavailable");
}
const quarto = await executable();
assert(
  !Deno.env.get("QUARTO_FORCE_VERSION"),
  "a forced Quarto version cannot identify the actual stock provider",
);
const configuredEvidence = Deno.env.get("PUBLISHER_FAILURE_TEST_OUTPUT");
assert(
  !configuredEvidence || isAbsolute(configuredEvidence),
  "PUBLISHER_FAILURE_TEST_OUTPUT must be absolute",
);
const evidence = configuredEvidence ||
  await Deno.makeTempDir({ prefix: "publisher-native-failure-" });
await Deno.mkdir(evidence, { recursive: true });
assert(
  (await Array.fromAsync(Deno.readDir(evidence))).length === 0,
  "fresh diagnostic directory required; no failed-attempt resume",
);

const commands: Record<string, unknown>[] = [];
async function command(
  cwd: string,
  args: string[],
  options: {
    executable?: string;
    env?: Record<string, string>;
    failure?: boolean;
  } = {},
) {
  const actual = options.executable || quarto;
  const started = new Date().toISOString();
  const result = await new Deno.Command(actual, {
    cwd,
    args,
    env: {
      QUARTO: quarto,
      QUARTO_RUN_NO_NETWORK: "true",
      ...options.env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const prefix = `command-${commands.length}`;
  const stdout = `${prefix}.stdout.log`, stderr = `${prefix}.stderr.log`;
  await Deno.writeFile(join(evidence, stdout), result.stdout);
  await Deno.writeFile(join(evidence, stderr), result.stderr);
  const receipt = {
    executable: actual,
    cwd,
    args,
    started,
    finished: new Date().toISOString(),
    exitCode: result.code,
    stdout,
    stderr,
    stdoutSha256: await sha(result.stdout),
    stderrSha256: await sha(result.stderr),
  };
  commands.push(receipt);
  await writeJSON(join(evidence, "commands.json"), commands);
  assert(
    options.failure ? !result.success && result.code !== 0 : result.success,
    JSON.stringify(receipt) + "\n" + decoder.decode(result.stderr),
  );
  return {
    receipt,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  };
}

const version = (await command(repo, ["--version"])).stdout.trim();
const expectedVersion = Deno.env.get("PUBLISHER_FAILURE_EXPECTED_QUARTO");
assert(
  !expectedVersion || version === expectedVersion,
  `actual CLI ${version} differs from expected ${expectedVersion}`,
);
const paths = (await command(repo, ["--paths"])).stdout;
const [bin, share] = paths.trim().split(/\r?\n/);
assert(
  bin === dirname(quarto) && await Deno.realPath(bin) === bin &&
    share === join(dirname(bin), "share") &&
    await Deno.realPath(share) === share,
  "actual Quarto paths must identify canonical stock bin/share directories",
);
const providerFiles: Record<
  string,
  { path: string; bytes: number; sha256: string }
> = {};
for (
  const [name, path] of Object.entries({
    cli: quarto,
    bundle: join(bin, "quarto.js"),
    pandoc: join(bin, "tools", Deno.build.arch, "pandoc"),
    deno: Deno.execPath(),
  })
) {
  assert(
    await Deno.realPath(path) === path,
    "noncanonical provider file: " + path,
  );
  const bytes = await Deno.readFile(path);
  providerFiles[name] = { path, bytes: bytes.length, sha256: await sha(bytes) };
}
assert(
  Deno.execPath() === join(bin, "tools", Deno.build.arch, "deno"),
  "probe must execute in the selected stock Quarto Deno",
);
const pandoc = (await command(repo, ["pandoc", "--version"])).stdout;
const head = (await command(repo, ["rev-parse", "HEAD"], {
  executable: "git",
})).stdout.trim();
const tree = (await command(repo, ["rev-parse", "HEAD^{tree}"], {
  executable: "git",
})).stdout.trim();
const status = (await command(repo, ["status", "--porcelain"], {
  executable: "git",
})).stdout;
assert(status === "", "a frozen clean Publisher Source is required: " + status);
const packageFiles = await fileMap(join(repo, "_extensions"));
const archive = join(evidence, "quarto-project-publish-candidate.tar.gz");
await command(repo, [
  "-czf",
  archive,
  "--transform=s,^,quarto-project-publish/,",
  "_extensions",
  "README.md",
], { executable: "tar" });
const archiveSha256 = await sha(await Deno.readFile(archive));
await writeJSON(join(evidence, "source-and-tools.json"), {
  protocol: "publisher-native-failure-diagnostics/1",
  head,
  tree,
  quarto,
  quartoSha256: await sha(await Deno.readFile(quarto)),
  version,
  expectedVersion,
  paths,
  providerFiles,
  pandoc,
  deno: Deno.version,
  testSha256: await sha(await Deno.readFile(fromFileUrl(import.meta.url))),
  archive,
  archiveSha256,
  packageFiles,
  scope: "installed Publisher portal/member native refusal after metadata",
  ownerAcceptance: false,
  publicationAcceptance: false,
});

// A public Pandoc filter observes the real input and public body before writing.
// It returns the document unchanged. A later child post-render hook refuses.
const captureFilter = `local function put(path, bytes)
  local f=assert(io.open(path,'wb')); assert(f:write(bytes)); assert(f:close())
end
function Pandoc(doc)
  assert(#PANDOC_STATE.input_files==1,'DIAGNOSTIC_INPUT_CARDINALITY')
  local folder=pandoc.utils.stringify(doc.meta['publisher-failure-capture'])
  assert(folder~='','DIAGNOSTIC_CAPTURE_PATH')
  local path=PANDOC_STATE.input_files[1]
  local f=assert(io.open(path,'rb')); local input=assert(f:read('*a')); assert(f:close())
  local body=pandoc.write(doc,'json')
  put(folder..'/input.bin',input)
  put(folder..'/body.json',body)
  put(folder..'/witness.json',pandoc.json.encode({
    protocol='publisher-public-pandoc-observation/1',inputPath=path,
    inputBytes=#input,bodyBytes=#body,inputSha1=pandoc.utils.sha1(input),
    bodySha1=pandoc.utils.sha1(body),format=FORMAT}))
  return doc
end
`;

const guard = `
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(m)}
async function sha(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(b=>b.toString(16).padStart(2,'0')).join('')}
const destination=Deno.env.get('PUBLISHER_FAILURE_CASE_DIAGNOSTICS')!;
const target=Deno.env.get('PUBLISHER_FAILURE_TARGET')!;
let notified=false;
export default {
  async metadata(c:any){
    const label=c.namespace===undefined?'portal':c.namespace;
    await Deno.writeTextFile(destination+'/metadata-'+label+'.json',JSON.stringify(c));
    if(label!==target)return {title:'Untargeted child'};
    const capture=c.sourceRoot+'/.native-failure-diagnostics';
    await Deno.mkdir(capture);
    return {title:'Target '+target,filters:[c.sourceRoot+'/modules/capture.lua'],
      'publisher-failure-capture':capture};
  },
  async onFailure(c:any){
    assert(!notified,'DIAGNOSTIC_CALLBACK_DUPLICATED');notified=true;
    const label=c.namespace===undefined?'portal':c.namespace;
    assert(label===target,'DIAGNOSTIC_WRONG_CHILD');
    const expected=JSON.parse(await Deno.readTextFile(destination+'/metadata-'+target+'.json'));
    for(const key of ['root','sourceRoot','attemptId','profiles','config','members','portal','namespace','format','output'])
      assert(JSON.stringify(c[key])===JSON.stringify(expected[key]),'DIAGNOSTIC_CONTEXT_'+key);
    assert(c.failure.phase==='render'&&c.failure.operation===(target==='portal'?'portal-render':'member-render'),'DIAGNOSTIC_FAILURE_BOUNDARY');
    assert(Object.keys(c.failure.error).sort().join(',')==='message,name','DIAGNOSTIC_ERROR_SHAPE');
    assert(Object.keys(c).sort().join(',')===Object.keys({...expected,failure:c.failure}).sort().join(','),'DIAGNOSTIC_CONTEXT_SHAPE');
    assert((await Deno.stat(c.sourceRoot)).isDirectory,'DIAGNOSTIC_SOURCE_ALREADY_REMOVED');
    const childExit=c.failure.error.message.match(/quarto render[^\\n]*кодом ([0-9]+)/);
    assert(childExit&&Number(childExit[1])!==0,'DIAGNOSTIC_ACTUAL_CHILD_NONZERO');
    assert(c.failure.error.message.includes('PUBLISHER_DIAGNOSTIC_POST_RENDER_REFUSAL_'+target),'DIAGNOSTIC_CHILD_REFUSAL_MARKER');
    const originals:Record<string,any>={};
    for(const file of ['input.bin','body.json','witness.json','post-render.json']){
      const original=c.sourceRoot+'/.native-failure-diagnostics/'+file;
      const info=await Deno.lstat(original);assert(info.isFile&&!info.isSymlink,'DIAGNOSTIC_NONREGULAR');
      const bytes=await Deno.readFile(original);
      await Deno.writeFile(destination+'/'+file,bytes,{createNew:true});
      const digest=await sha(bytes);
      assert(await sha(await Deno.readFile(destination+'/'+file))===digest,'DIAGNOSTIC_COPY_CHANGED');
      originals[file]={original,bytes:bytes.length,sha256:digest};
    }
    const output=c.output+'/index.html';
    const html=await Deno.readFile(output);
    await Deno.writeFile(destination+'/unpublished-output.html',html,{createNew:true});
    originals['unpublished-output.html']={original:output,bytes:html.length,sha256:await sha(html)};
    // Each write/read/hash is awaited; this final check happens after all copies.
    assert((await Deno.stat(c.sourceRoot)).isDirectory,'DIAGNOSTIC_CLEANUP_RACED_COPY');
    await Deno.writeTextFile(destination+'/on-failure-receipt.json',JSON.stringify({
      context:c,originals,actualChildExitCode:Number(childExit[1]),
      sourcePresentAfterAwaitedCopies:true,ownerAcceptance:false,publicationAcceptance:false}));
  }
};
`;
const postRender = `
const target=Deno.env.get('PUBLISHER_FAILURE_TARGET');
const child=Deno.cwd().endsWith('/sources/member')?'member':'portal';
if(Deno.env.get('PROJECT_PUBLISH_MEMBER')==='1'&&child===target){
  const sourceRoot=child==='member'?Deno.cwd().slice(0,-'/member'.length):Deno.cwd();
  const folder=sourceRoot+'/.native-failure-diagnostics';
  const bytes=await Deno.readFile(folder+'/body.json');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
  await Deno.writeTextFile(folder+'/post-render.json',JSON.stringify({
    protocol:'publisher-native-post-render-refusal/1',cwd:Deno.cwd(),
    sourceRoot,child,scriptArgs:Deno.args,bodySha256:digest}));
  throw new Error('PUBLISHER_DIAGNOSTIC_POST_RENDER_REFUSAL_'+target);
}
`;
function hasStr(value: unknown, literal: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasStr(item, literal));
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (item.t === "Str" && item.c === literal) return true;
    return Object.values(item).some((child) => hasStr(child, literal));
  }
  return false;
}

const results: Record<string, unknown>[] = [];
for (const target of ["portal", "member"]) {
  const root = join(evidence, `fixture-${target}`);
  const diagnostics = join(evidence, `retained-${target}`);
  await Deno.mkdir(root);
  await Deno.mkdir(diagnostics);
  const added = await command(root, ["add", archive, "--no-prompt"]);
  const installedFiles = await fileMap(join(root, "_extensions"));
  assert(
    JSON.stringify(installedFiles) === JSON.stringify(packageFiles),
    "archive/quarto add changed or omitted installed Publisher files",
  );
  await writeJSON(join(evidence, `${target}-installed-package.json`), {
    archiveSha256,
    command: added.receipt,
    installedFiles,
    packageFiles,
  });
  async function write(path: string, value: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), value);
  }
  await write(
    "_quarto.yml",
    `project:
  type: website
  output-dir: .project-publish/native
  render: []
  resources: ["!member/**", "!modules/**"]
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: [_extensions/project-publish/entrypoints/post.ts, modules/post-render.ts]
format: html
project-publish:
  portal: index.qmd
  output-dir: _site
  projects:
    member: {path: member, format: html}
  integrations: [modules/guard.ts]
`,
  );
  for (const profile of ["student", "full"]) {
    await write(
      `_quarto-${profile}.yml`,
      `project-publish:\n  output-dir: _site-${profile}\n`,
    );
    await write(`member/_quarto-${profile}.yml`, "metadata: {}\n");
    await write(
      `_site-${profile}/index.html`,
      `prior ${profile} publication\n`,
    );
    await write(`_site-${profile}/assets/old.txt`, `prior ${profile} asset\n`);
  }
  await write("index.qmd", "# Portal\n\nACTUAL_NATIVE_DIAGNOSTIC_PORTAL\n");
  await write(
    "member/_quarto.yml",
    "project:\n  type: default\n  render: [index.qmd]\n  post-render: ../modules/post-render.ts\nformat: html\n",
  );
  await write(
    "member/index.qmd",
    "# Member\n\nACTUAL_NATIVE_DIAGNOSTIC_MEMBER\n",
  );
  await write("modules/capture.lua", captureFilter);
  await write("modules/guard.ts", guard);
  await write("modules/post-render.ts", postRender);
  const before = await fileMap(root);
  await writeJSON(join(evidence, `${target}-source-before.json`), before);
  const publicationBefore = {
    student: await fileMap(join(root, "_site-student")),
    full: await fileMap(join(root, "_site-full")),
  };
  const events: { kind: string; paths: string[] }[] = [];
  const watcher = Deno.watchFs([
    join(root, "_site-student"),
    join(root, "_site-full"),
  ], { recursive: true });
  const observing = (async () => {
    for await (const event of watcher) events.push(event);
  })();
  let rendered: Awaited<ReturnType<typeof command>>;
  try {
    rendered = await command(root, [
      "run",
      "_extensions/project-publish/entrypoints/render.ts",
      "--profile",
      "student",
    ], {
      failure: true,
      env: {
        QUARTO_PROFILE: "",
        QUARTO_PROJECT_OUTPUT_DIR: "",
        PUBLISHER_FAILURE_TARGET: target,
        PUBLISHER_FAILURE_CASE_DIAGNOSTICS: diagnostics,
      },
    });
  } finally {
    watcher.close();
    await observing;
  }
  assert(
    (rendered.stdout + rendered.stderr).includes(
      "PUBLISHER_DIAGNOSTIC_POST_RENDER_REFUSAL_" + target,
    ),
    "actual child did not reach its post-Pandoc refusal",
  );
  assert(
    events.length === 0,
    "failed attempt touched public: " + JSON.stringify(events),
  );
  const retained = JSON.parse(
    await Deno.readTextFile(join(diagnostics, "on-failure-receipt.json")),
  );
  assert(
    retained.actualChildExitCode !== 0,
    "actual child falsely reported zero",
  );
  assert(
    retained.sourcePresentAfterAwaitedCopies === true,
    "copies were not awaited",
  );
  assert(
    !await exists(retained.context.sourceRoot),
    "normal cleanup retained failed Source",
  );
  assert(
    !await exists(join(root, ".project-publish/builds")),
    "normal builds cleanup omitted",
  );
  assert(
    !await exists(join(root, ".project-publish/state.json")),
    "failed attempt retained publish state",
  );
  for (const profile of ["student", "full"] as const) {
    assert(
      JSON.stringify(await fileMap(join(root, `_site-${profile}`))) ===
        JSON.stringify(publicationBefore[profile]),
      "failed child changed populated " + profile + " publication",
    );
  }
  const after = await fileMap(root);
  for (const [path, proof] of Object.entries(before)) {
    assert(
      JSON.stringify(after[path]) === JSON.stringify(proof),
      "author/installed bytes changed: " + path,
    );
  }
  for (const path of Object.keys(after)) {
    assert(
      path in before || path.startsWith(".quarto/"),
      "unexpected terminal fixture file: " + path,
    );
  }
  for (
    const [file, proof] of Object.entries(retained.originals) as [string, any][]
  ) {
    const bytes = await Deno.readFile(join(diagnostics, file));
    assert(
      bytes.length === proof.bytes && await sha(bytes) === proof.sha256,
      "retained bytes differ: " + file,
    );
  }
  const input = await Deno.readFile(join(diagnostics, "input.bin"));
  const body = await Deno.readFile(join(diagnostics, "body.json"));
  const witness = JSON.parse(
    await Deno.readTextFile(join(diagnostics, "witness.json")),
  );
  assert(
    witness.protocol === "publisher-public-pandoc-observation/1",
    "wrong Pandoc observation",
  );
  assert(
    witness.inputBytes === input.length && witness.bodyBytes === body.length,
    "Pandoc byte lengths differ",
  );
  assert(
    witness.inputSha1 === await sha(input, "SHA-1") &&
      witness.bodySha1 === await sha(body, "SHA-1"),
    "observed input/body bytes differ",
  );
  assert(witness.format === "html", "unexpected actual Pandoc writer");
  const marker = "ACTUAL_NATIVE_DIAGNOSTIC_" + target.toUpperCase();
  assert(
    decoder.decode(input).includes(marker),
    "actual input omitted authored marker",
  );
  assert(
    hasStr(JSON.parse(decoder.decode(body)).blocks, marker),
    "actual public body omitted authored marker",
  );
  const post = JSON.parse(
    await Deno.readTextFile(join(diagnostics, "post-render.json")),
  );
  assert(
    post.child === target && post.sourceRoot === retained.context.sourceRoot,
    "wrong child post-render observation",
  );
  assert(
    post.bodySha256 === await sha(body),
    "post-render did not observe retained Pandoc body",
  );
  assert(
    (await Deno.readTextFile(join(diagnostics, "unpublished-output.html")))
      .includes(marker),
    "actual unpublished native HTML omitted authored marker",
  );
  const result = {
    target,
    wrapperCommand: rendered.receipt,
    actualChildExitCode: retained.actualChildExitCode,
    sourceRoot: retained.context.sourceRoot,
    sourceRemoved: true,
    awaitedCopies: retained.originals,
    priorPublications: publicationBefore,
    publicEvents: events,
    retainedFiles: await fileMap(diagnostics),
    authorAndInstalledBytesUnchanged: true,
    ownerAcceptance: false,
    publicationAcceptance: false,
  };
  results.push(result);
  await writeJSON(join(evidence, `${target}-result.json`), result);
  console.log(`PASS installed native failure diagnostics: ${target}`);
}
await writeJSON(join(evidence, "receipt.json"), {
  protocol: "publisher-native-failure-diagnostics/1",
  head,
  tree,
  quarto,
  version,
  archiveSha256,
  packageFiles,
  commands,
  results,
  ownerAcceptance: false,
  publicationAcceptance: false,
});
console.log("Publisher native failure diagnostics retained: " + evidence);
