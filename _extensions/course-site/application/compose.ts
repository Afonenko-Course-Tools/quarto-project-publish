import { createMetrics as __createMetrics } from "../observability/bridge.ts";
const __metrics = __createMetrics("course-site");
import { addressNavigation } from "../infrastructure/navigation.ts";
import { diagnostic } from "../infrastructure/diagnostics.ts";
import {
  cleanOutput,
  copyFiles,
  dirname,
  files,
  fromFileUrl,
  inside,
  join,
  outputDirectory,
  relative,
  resolve,
  safePath,
  toFileUrl,
} from "../infrastructure/files.ts";
import {
  inspectDocuments,
  validateAudienceOutputs,
  workspace,
} from "../infrastructure/config.ts";
import { profileArguments, quarto } from "../infrastructure/process.ts";
import { publicOutputs, readCollection } from "../infrastructure/collection.ts";
const siblings = dirname(dirname(dirname(fromFileUrl(import.meta.url))));
function ownerSiblings(root: string) {
  const parts = siblings.split("/");
  return join(root, ...parts.slice(parts.lastIndexOf("_extensions")));
}
async function module(
  name: string,
  path: string,
  owner?: string,
): Promise<any> {
  const source = join(owner ? ownerSiblings(owner) : siblings, name, path);
  try {
    await Deno.stat(source);
  } catch (cause) {
    if (!(cause instanceof Deno.errors.NotFound)) throw cause;
    throw diagnostic(
      "SITE.SIBLING_MISSING",
      "Не установлен требуемый модуль соседнего расширения",
      {
        source,
        id: name,
        field: "module",
        hint: "Установите Core/QRC рядом с course-site в одном namespace.",
      },
      cause,
    );
  }
  // An existing module's initialization/import failure belongs to its owner.
  return await import(toFileUrl(source).href);
}
const statePath = (root: string) =>
  join(root, "_generated/course-site/active.json");
async function remove(path: string) {
  try {
    await Deno.remove(path);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
}
function releaseQualification(config: any, root: string) {
  if (config.course && config["course-core-runtime"] !== "native-ts") {
    throw diagnostic(
      "SITE.RELEASE_UNQUALIFIED",
      "Course release требует публичную текущую native operation Core",
      { source: root, field: "course-core-runtime" },
    );
  }

  if (
    config["course-core-runtime"] &&
    (config["course-core-runtime"] !== "native-ts" ||
      !["student", "author"].includes(
        config["course-core-projection"] ??
          (config.course?.view === "full" ? "author" : "student"),
      ))
  ) {
    throw diagnostic(
      "SITE.NATIVE_UNQUALIFIED",
      "Публичная операция требует native-ts и явную student/author projection",
      { source: root, field: "course-core-runtime/projection" },
    );
  }
}
async function coreHook(root: string, config: any, phase: "pre" | "post") {
  releaseQualification(config, root);
  if (config["course-core-runtime"] === "native-ts") {
    await quarto(
      [
        "run",
        join(siblings, "course-core", "entrypoints", "native-" + phase + ".ts"),
      ],
      root,
      {},
      true,
    );
    if (phase === "pre") {
      const path = join(siblings, "course-prairielearn", "public.ts");
      let PL: any;
      try {
        await Deno.stat(path);
        PL = await import(toFileUrl(path).href);
      } catch (cause) {
        if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      }
      if (PL) {
        await PL.prepareNativeAdapter(
          await module("course-core", "public.ts"),
          {
            root,
            profiles: (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(
              Boolean,
            ),
            projection: projection(config),
            outputDirectory: resolve(
              root,
              Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ||
                config.project?.["output-dir"] || "_site",
            ),
          },
        );
      }
    }
  }
}
function projection(config: any): "student" | "author" {
  return config["course-core-projection"] ??
    (config.course?.view === "full" ? "author" : "student");
}
async function ownerRelease(root: string, operation: any, Core: any) {
  let PL: any;
  const path = join(ownerSiblings(root), "course-prairielearn", "public.ts");
  try {
    await Deno.stat(path);
    PL = await import(toFileUrl(path).href);
  } catch (cause) {
    if (!(cause instanceof Deno.errors.NotFound)) throw cause;
  }
  const adapter = PL?.createNativeAdapter({ root, core: Core });
  const request = {
      expectedSources: operation.catalog.documents.map((d: any) => d.source),
    },
    before = operation.metrics;
  let proof = await operation.validateRelease(
      request,
      adapter ? [adapter] : [],
    ),
    validationPasses = 1;
  if (proof.validatedAdapters.includes("prairielearn")) {
    proof = await adapter.validateCourse(operation, request);
    validationPasses++;
  }
  return {
    proof,
    validationPasses,
    metricsBefore: before,
    metricsAfter: operation.metrics,
  };
}
function catalogCoverage(catalog: any, record: any) {
  const actual = catalog.documents.map((d: any) =>
    resolve(record.outputDir, d.output)
  );
  const expected = record.nativeOutputs.filter((p: string) =>
    p.endsWith(".html")
  );
  if (
    new Set(actual).size !== actual.length ||
    expected.some((p: string) => !actual.includes(p)) ||
    actual.some((p: string) => !expected.includes(p))
  ) {
    throw diagnostic(
      "SITE.CURRENT_RESULT_MISSING",
      "Публичный каталог Core не совпадает с текущими native outputs",
      { source: record.projectRoot, field: "output/source coverage" },
    );
  }
}
async function finalizeDownloads(
  root: string,
  config: any,
  record: any,
  baseUrl: string | undefined,
  referenceCatalog: unknown,
  catalogBaseUrl: string | undefined,
  destinationDirectory?: string,
) {
  let catalog, release;
  const observeOperation = (value: any, proof: unknown) => {
    catalogCoverage(value, record);
    catalog = value;
    release = proof;
  };
  if (config["project-download"]) {
    const Download = await module("project-download", "public.ts", root);
    await Download.finishDownloads(root, {
      native: config["course-core-runtime"] === "native-ts",
      outputDirectory: record.outputDir,
      projection: projection(config),
      profiles: record.profiles,
      ...(record.expectedDocuments
        ? { expectedDocuments: record.expectedDocuments }
        : {}),
      baseUrl,
      referenceCatalog,
      catalogBaseUrl,
      observeOperation,
      destinationDirectory,
    });
  } else if (config["course-core-runtime"] === "native-ts") {
    const Core = await module("course-core", "public.ts", root);
    await Core.withCurrentNativeOperation(
      {
        root,
        profiles: record.profiles,
        projection: projection(config),
        ...(record.expectedDocuments
          ? { expectedDocuments: record.expectedDocuments }
          : {}),
        outputDirectory: record.outputDir,
      },
      async (operation: any) =>
        observeOperation(
          operation.catalog,
          await ownerRelease(root, operation, Core),
        ),
    );
  }
  return catalog ? { catalog, release } : undefined;
}
export async function pre(root = Deno.cwd()): Promise<void> {
  const state = statePath(root);
  await safePath(root, state);
  await Deno.mkdir(dirname(state), { recursive: true });
  await remove(state);
  const ws = await workspace(root);
  releaseQualification(ws.config, root);
  if (Deno.env.get("QUARTO_PROJECT_RENDER_ALL") !== "1") {
    if (ws.config["project-download"]) {
      await (await module("project-download", "public.ts")).prepareDownloads(
        root,
      );
    }
    await coreHook(root, ws.config, "pre");
    return;
  }
  const run = join(dirname(state), "runs", crypto.randomUUID());
  await Deno.mkdir(run, { recursive: true });
  await validateAudienceOutputs(root, ws.profiles, ws.output);
  const publicationBase = ws.config.website?.["site-url"] ||
    ws.config["course-navigation"]?.["course-url"];
  if (ws.config["project-download"]?.["course-model"] && !publicationBase) {
    throw diagnostic(
      "SITE.PUBLICATION_REQUIRED",
      "Модельной выдаче требуется конечный URL композиции",
      { source: root, field: "website.site-url/course-navigation.course-url" },
    );
  }
  const inspected = [];
  // Validate all selected destinations before deleting any output.
  for (const project of ws.projects) {
    const plan = await inspectDocuments(project.path, ws.profiles);
    const config = plan.config;
    releaseQualification(config, project.path);
    if (config["project-download"]?.["course-model"] && !publicationBase) {
      throw diagnostic(
        "SITE.PUBLICATION_REQUIRED",
        "Модельной выдаче компонента требуется конечный URL композиции",
        {
          source: project.path,
          field: "website.site-url/course-navigation.course-url",
        },
      );
    }
    if (typeof config.project?.["output-dir"] !== "string") {
      throw diagnostic(
        "SITE.CONFIG_INVALID",
        "Компоненту требуется native каталог результата",
        {
          source: project.path,
          id: project.id,
          field: "project.output-dir",
          hint: "Задайте project.output-dir в конфигурации компонента.",
        },
      );
    }
    const output = await outputDirectory(
      project.path,
      config.project["output-dir"],
    );
    await validateAudienceOutputs(
      project.path,
      ws.profiles,
      output,
      config.course?.view,
    );
    inspected.push({ project, config, output, plan });
  }
  for (const { project, output } of inspected) {
    for (const other of ws.projects) {
      if (
        inside(output, other.path) ||
        inside(other.path, output) && other.path !== project.path
      ) {
        throw diagnostic(
          "SITE.OUTPUT_OVERLAP",
          "Результат компонента пересекается с источником другого компонента",
          {
            source: project.path,
            id: project.id,
            field: "project.output-dir",
            related: [{ source: output }, { source: other.path, id: other.id }],
            hint: "Разделите исходники и результаты проектов.",
          },
        );
      }
    }
    if (inside(output, ws.output) || inside(ws.output, output)) {
      throw diagnostic(
        "SITE.OUTPUT_OVERLAP",
        "Каталоги результата компонента и корня пересекаются",
        {
          source: project.path,
          id: project.id,
          field: "project.output-dir",
          related: [{ source: output }, { source: ws.output }],
          hint: "Выберите независимые каталоги результата.",
        },
      );
    }
  }
  await cleanOutput(root, ws.output, [
    ...ws.resources || [],
    ...inspected.flatMap(({ plan }) => plan.resources || []),
  ]);
  if (ws.config["project-download"]) {
    await (await module("project-download", "public.ts")).prepareDownloads(
      root,
    );
  }
  const records = [];
  for (const { project, config, output, plan } of inspected) {
    await cleanOutput(project.path, output, plan.resources);
    const calls = plan.renderTo === null
      ? plan.documents.map(
        (document) => ["render", document.source, "--to", document.format],
      )
      : [["render", ".", ...(plan.renderTo ? ["--to", plan.renderTo] : [])]];
    const collected: Awaited<ReturnType<typeof readCollection>>[] = [];
    const capture = async (index: number, token?: string) => {
      const collection = join(run, `${project.id}-${index}.json`);
      await quarto(
        [...calls[index], ...profileArguments(ws.profiles)],
        project.path,
        {
          COURSE_SITE_COLLECTION: collection,
          ...(token ? { COURSE_CORE_CAPTURE_TOKEN: token } : {}),
          COURSE_SITE_PROJECT: project.id,
          COURSE_SITE_DEFER_DOWNLOADS: "1",
          ...(publicationBase
            ? {
              COURSE_SITE_PUBLICATION_BASE: new URL(
                project.mount.replace(/\\/g, "/") + "/",
                publicationBase,
              ).href,
            }
            : {}),
        },
        true,
      );
      collected.push(
        await readCollection(
          collection,
          project.id,
          project.path,
          output,
          ws.profiles,
          true,
        ),
      );
    };
    if (config["course-core-runtime"] === "native-ts" && calls.length > 1) {
      const Core = await module("course-core", "public.ts", project.path);
      await Core.withNativeCaptureScope(
        {
          root: project.path,
          projection: projection(config),
          outputDirectory: output,
        },
        { expectedSources: plan.documents.map((d: any) => d.source) },
        async (scope: any) => {
          for (let index = 0; index < calls.length; index++) {
            await scope.captureInputs(
              [plan.documents[index].source],
              async (token: string) => await capture(index, token),
            );
          }
        },
      );
    } else {for (let index = 0; index < calls.length; index++) {
        await capture(index);
      }}
    const record = {
      id: project.id,
      projectRoot: project.path,
      outputDir: output,
      profiles: collected[0].profiles,
      nativeOutputs: [
        ...new Set(collected.flatMap((record) => record.nativeOutputs)),
      ],
      files: [...new Set(collected.flatMap((record) => record.files))],
      expectedDocuments: plan.documents.map((d: any) => ({
        source: d.source,
        format: d.baseFormat,
      })),
    };
    if (
      collected.some((value) =>
        JSON.stringify(value.profiles) !== JSON.stringify(record.profiles)
      )
    ) {
      throw diagnostic(
        "SITE.COLLECTION_INVALID",
        "Профили текущих рендеров документов не согласованы",
        {
          source: project.path,
          id: project.id,
          field: "profiles",
          hint: "Используйте одинаковые профили документов компонента.",
        },
      );
    }
    records.push({
      project,
      config,
      record,
      documents: plan.documents,
    });
  }
  await Deno.writeTextFile(state, JSON.stringify({ ws, records, run }));
  await coreHook(root, ws.config, "pre");
}
export async function post(root = Deno.cwd()): Promise<void> {
  const state = statePath(root);
  if (Deno.env.get("QUARTO_PROJECT_RENDER_ALL") !== "1") {
    const ws = await workspace(root);
    const outputs = (Deno.env.has("QUARTO_PROJECT_OUTPUT_FILES") ||
        Deno.env.get("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES"))
      ? await publicOutputs(root, ws.output)
      : [];
    if (!outputs.length) return;
    if (ws.config["reference-catalog"]) {
      const { publishReferenceCatalog: publish } = await module(
        "reference-catalog",
        "public.ts",
      );
      await publish({
        root,
        stage: ws.output,
        quarto: (await quarto(["--version"], root)).trim(),
        config: ws.config,
        members: [{
          namespace: ws.config["reference-catalog"].namespace,
          format: "html",
        }],
        scope: "local",
        outputs,
      });
    }
    await addressNavigation(ws.output, outputs);
    await coreHook(root, ws.config, "post");
    await finalizeDownloads(
      root,
      ws.config,
      {
        projectRoot: root,
        outputDir: ws.output,
        profiles: ws.profiles,
        nativeOutputs: outputs,
      },
      ws.config.website?.["site-url"] ||
        ws.config["course-navigation"]?.["course-url"],
      undefined,
      undefined,
    );
    return;
  }
  const { ws, records, run } = JSON.parse(await Deno.readTextFile(state));
  await remove(state);
  if (
    ws.root !== root ||
    ws.output !==
      resolve(root, Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || ws.output)
  ) {
    throw diagnostic(
      "SITE.COLLECTION_INVALID",
      "Активная сборка не соответствует корню или каталогу результата",
      {
        source: root,
        field: "root/output",
        related: [{ source: ws.root }, { source: ws.output }],
        hint: "Запустите полную сборку заново.",
      },
    );
  }
  const rootOutputs = await publicOutputs(root, ws.output),
    rootFiles = await files(ws.output);
  const outputs = [...rootOutputs], searchIndexes: any[] = [];
  const rootSearch = join(ws.output, "search.json");
  if (rootFiles.includes(rootSearch)) {
    searchIndexes.push({ path: rootSearch, mount: "" });
  }
  const nativeOperations: any[] = [];
  const members = [];
  for (const { project, config, record, documents } of records) {
    const mount = join(ws.output, project.mount);
    if (rootFiles.some((path: string) => inside(mount, path))) {
      throw diagnostic(
        "SITE.OUTPUT_OVERLAP",
        "Путь монтирования занят корневым результатом",
        {
          source: root,
          id: project.id,
          field: "subprojects",
          related: [{ source: mount }],
          hint: "Измените путь компонента или корневого ресурса.",
        },
      );
    }
    await safePath(root, mount);
    await Deno.mkdir(mount, { recursive: true });
    await copyFiles(record.outputDir, mount, record.files);
    outputs.push(
      ...record.nativeOutputs.map((path: string) =>
        join(mount, relative(record.outputDir, path))
      ),
    );
    if (record.files.includes(join(record.outputDir, "search.json"))) {
      searchIndexes.push({
        path: join(mount, "search.json"),
        mount: project.mount,
      });
    }
    if (config["reference-catalog"]) {
      members.push({
        namespace: config["reference-catalog"].namespace,
        format: documents?.some((document: any) => document.web)
          ? "html"
          : "nonweb",
      });
    }
  }
  if (ws.config["reference-catalog"]) {
    const { publishReferenceCatalog: publish } = await module(
      "reference-catalog",
      "public.ts",
    );
    const namespace = ws.config["reference-catalog"].namespace;
    if (namespace) members.push({ namespace, format: "html" });
    await publish({
      root,
      stage: ws.output,
      quarto: (await quarto(["--version"], root)).trim(),
      config: ws.config,
      members,
      scope: "full",
      outputs,
      searchIndexes,
    });
  }
  await addressNavigation(
    ws.output,
    outputs,
    true,
    ws.config["course-navigation"]?.["course-url"] ||
      ws.config.website?.["site-url"],
  );
  await coreHook(root, ws.config, "post");
  const baseUrl = ws.config.website?.["site-url"] ||
    ws.config["course-navigation"]?.["course-url"];
  const catalogPath = join(ws.output, "reference-catalog.json");
  const referenceCatalog = ws.config["reference-catalog"]
    ? JSON.parse(await Deno.readTextFile(catalogPath))
    : undefined;
  for (const { project, config, record } of records) {
    const catalog = await finalizeDownloads(
      project.path,
      config,
      record,
      baseUrl
        ? new URL(project.mount.replace(/\\/g, "/") + "/", baseUrl).href
        : undefined,
      referenceCatalog,
      baseUrl,
      join(ws.output, project.mount),
    );
    if (catalog) nativeOperations.push({ project: project.mount, ...catalog });
  }
  const rootCatalog = await finalizeDownloads(
    root,
    ws.config,
    {
      projectRoot: root,
      outputDir: ws.output,
      profiles: ws.profiles,
      nativeOutputs: rootOutputs,
    },
    baseUrl,
    referenceCatalog,
    baseUrl,
  );
  if (rootCatalog) {
    nativeOperations.push({ project: "root", ...rootCatalog });
  }
  await Deno.writeTextFile(
    join(run, "composition.json"),
    JSON.stringify({
      outputs,
      searchIndexes,
      nativeOperations,
      projects: records.map((r: any) => r.project.id),
    }),
  );
}

// @ts-expect-error JS допускает замену function binding; сигнатура публичного API сохраняется.
pre = __metrics.wrapAsync({
  id: "course-site.application.compose.pre",
  kind: "phase",
}, pre);
// @ts-expect-error JS допускает замену function binding; сигнатура публичного API сохраняется.
post = __metrics.wrapAsync({
  id: "course-site.application.compose.post",
  kind: "phase",
}, post);

export { stageConditions } from "./conditions.ts";
