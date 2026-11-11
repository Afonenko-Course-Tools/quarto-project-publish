import { activeState, compositionRecord, readActiveState } from "./state.ts";
import { isSibling } from "./sibling-contracts.ts";
import {
  isRecord,
  type NativeConfig,
  parseJson,
} from "../infrastructure/values.ts";
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
  validateOutputCleanup,
} from "../infrastructure/files.ts";
import {
  inspectProject,
  validateAudience,
  workspace,
} from "../infrastructure/config.ts";
import { profileArguments, quarto } from "../infrastructure/process.ts";
import { publicOutputs, readCollection } from "../infrastructure/collection.ts";
import type {
  NativeCatalog,
  NativeSiteRecord,
  PreparedDownloads,
  PublicationInspection,
  SiblingModuleMap,
} from "./sibling-contracts.ts";
const siblings = dirname(dirname(dirname(fromFileUrl(import.meta.url))));
function ownerSiblings(root: string) {
  const parts = siblings.split("/");
  return join(root, ...parts.slice(parts.lastIndexOf("_extensions")));
}
async function module<Name extends keyof SiblingModuleMap>(
  name: Name,
  path: "public.ts",
  owner?: string,
): Promise<SiblingModuleMap[Name]> {
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
  const value: unknown = await import(toFileUrl(source).href);
  if (!isSibling(name, value)) {
    throw diagnostic(
      "SITE.SIBLING_INVALID",
      "Публичный модуль не содержит требуемых операций",
      { source, id: name, field: "module" },
    );
  }
  return value;
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
// Core 9 использует native TS по умолчанию. Это только выбор технического
// маршрута: право на выдачу всё равно подтверждает текущая операция Core.
function nativeCore(config: NativeConfig): boolean {
  if (config["course-core-runtime"] !== undefined) {
    return config["course-core-runtime"] === "native-ts";
  }
  const filters: unknown[] = Array.isArray(config.filters)
    ? config.filters
    : [config.filters];
  return filters.some((filter: unknown) =>
    filter === "course-core" ||
    isRecord(filter) && filter.path === "course-core"
  );
}
function releaseQualification(config: NativeConfig, root: string) {
  if (config.course && !nativeCore(config)) {
    throw diagnostic(
      "SITE.RELEASE_UNQUALIFIED",
      "Course release требует публичную текущую native operation Core",
      { source: root, field: "filters/course-core-runtime" },
    );
  }

  if (
    (config["course-core-runtime"] !== undefined || nativeCore(config)) &&
    ((config["course-core-runtime"] !== undefined &&
      config["course-core-runtime"] !== "native-ts") ||
      !["student", "author"].some((value) =>
        value === (
          config["course-core-projection"] ??
            (config.course?.view === "full" ? "author" : "student")
        )
      ))
  ) {
    throw diagnostic(
      "SITE.NATIVE_UNQUALIFIED",
      "Публичная операция требует Core native TS и проекцию student/author",
      { source: root, field: "course-core-runtime/projection" },
    );
  }
}
async function coreHook(
  root: string,
  config: NativeConfig,
  phase: "pre" | "post",
) {
  releaseQualification(config, root);
  if (nativeCore(config)) {
    await quarto(
      [
        "run",
        join(siblings, "course-core", "entrypoints", "native-" + phase + ".ts"),
      ],
      root,
      {},
      true,
    );
  }
}
function projection(config: NativeConfig): "student" | "author" {
  const value = config["course-core-projection"] ??
    (config.course?.view === "full" ? "author" : "student");
  if (value !== "student" && value !== "author") {
    throw diagnostic("SITE.NATIVE_UNQUALIFIED", "Неизвестная проекция Core", {
      field: "course-core-projection",
    });
  }
  return value;
}
function catalogCoverage(catalog: NativeCatalog, record: NativeSiteRecord) {
  const documents = catalog.documents;
  const sources = new Set(documents.map((document) => document.source));
  const expectedSources = record.selectedSources &&
    new Set(record.selectedSources);
  const outputs = documents.map((document) =>
    resolve(record.outputDir, document.output)
  );
  const actual = new Set(outputs);
  const expected = new Set(
    record.nativeOutputs.filter((path: string) => path.endsWith(".html")),
  );
  if (
    sources.size !== documents.length ||
    (expectedSources &&
      (sources.size !== expectedSources.size ||
        [...sources].some((source) => !expectedSources.has(source)))) ||
    actual.size !== outputs.length || actual.size !== expected.size ||
    [...actual].some((path) => !expected.has(path))
  ) {
    throw diagnostic(
      "SITE.CURRENT_RESULT_MISSING",
      "Публичный каталог Core не совпадает с native selection или outputs",
      {
        source: record.projectRoot,
        field: "selectedSources/output",
        hint:
          "Проверьте неизменность native selection и текущие outputs компонента.",
      },
    );
  }
}
async function progress<T>(
  stage: string,
  project: string,
  action: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  console.error(`course-site: ${stage}: ${project} — начало`);
  try {
    const value = await action();
    console.error(
      `course-site: ${stage}: ${project} — готово (${
        ((performance.now() - started) / 1000).toFixed(1)
      } с)`,
    );
    return value;
  } catch (error) {
    console.error(
      `course-site: ${stage}: ${project} — ошибка (${
        ((performance.now() - started) / 1000).toFixed(1)
      } с)`,
    );
    throw error;
  }
}
async function finalizeDownloads(
  ...args: Parameters<typeof finalizeDownloadsImpl>
) {
  return await progress(
    "Проверка и загрузки",
    args[0],
    () => finalizeDownloadsImpl(...args),
  );
}
async function finalizeDownloadsImpl(
  root: string,
  config: NativeConfig,
  record: NativeSiteRecord,
  destination: {
    baseUrl?: string | undefined;
    referenceCatalog?: unknown;
    catalogBaseUrl?: string | undefined;
    destinationDirectory?: string | undefined;
  },
) {
  const { baseUrl, referenceCatalog, catalogBaseUrl, destinationDirectory } =
    destination;
  if (!nativeCore(config)) {
    if (config["project-download"]) {
      const Download = await module("project-download", "public.ts", root);
      await Download.finishDownloads(root, {
        profiles: record.profiles,
        outputDirectory: record.outputDir,
        destinationDirectory,
      });
    }
    return undefined;
  }
  const Core = await module("course-core", "public.ts", root);
  const pending: { draft?: PreparedDownloads } = {};
  try {
    const snapshot = await Core.withNativePublication(
      {
        root,
        profiles: record.profiles,
        projection: projection(config),
        outputDirectory: record.outputDir,
      },
      record.selectedSources
        ? { expectedSources: record.selectedSources }
        : undefined,
      async (publication) => {
        catalogCoverage(publication.catalog, record);
        let inspection: PublicationInspection | undefined;
        if (publication.course.adapters.includes("prairielearn")) {
          const PL = await module("course-prairielearn", "public.ts", root);
          inspection = await PL.inspectPublication(publication);
        }
        if (config["project-download"]) {
          const Download = await module("project-download", "public.ts", root);
          // Сохранить handle до await outer closing: catch должен видеть draft.
          pending.draft = await Download.prepareNativeDownloads(publication, {
            destinationDirectory,
            baseUrl,
            referenceCatalog,
            catalogBaseUrl,
          });
        }
        return {
          catalog: publication.catalog,
          course: publication.course,
          ...(inspection ? { inspection } : {}),
        };
      },
    );
    await pending.draft?.publish();
    return snapshot;
  } catch (cause) {
    try {
      await pending.draft?.discard();
    } catch { /* Cleanup не маскирует primary cause. */ }
    throw cause;
  }
}

function validateDestinations(
  ws: Awaited<ReturnType<typeof workspace>>,
  inspected: {
    project: Awaited<ReturnType<typeof workspace>>["projects"][number];
    output: string;
  }[],
) {
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
}
async function preImpl(root = Deno.cwd()): Promise<void> {
  const state = statePath(root);
  await safePath(root, state);
  await Deno.mkdir(dirname(state), { recursive: true });
  await remove(state);
  const ws = await progress("Планирование корня", root, () => workspace(root));
  releaseQualification(ws.config, root);
  const audience = validateAudience(
    root,
    ws.profiles,
    ws.config.course?.view,
    nativeCore(ws.config) ? projection(ws.config) : undefined,
  );
  if (Deno.env.get("QUARTO_PROJECT_RENDER_ALL") !== "1") {
    if (ws.config["project-download"]) {
      await (await module("project-download", "public.ts"))
        .resetDownloadRequests(
          root,
        );
    }
    await coreHook(root, ws.config, "pre");
    return;
  }
  const run = join(dirname(state), "runs", crypto.randomUUID());
  await Deno.mkdir(run, { recursive: true });
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
    const plan = await progress(
      "Планирование компонента",
      project.path,
      () => inspectProject(project.path, ws.profiles),
    );
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
    validateAudience(
      project.path,
      ws.profiles,
      config.course?.view,
      nativeCore(config) ? projection(config) : undefined,
      nativeCore(config) ? audience : undefined,
    );
    inspected.push({ project, config, output, plan });
  }
  validateDestinations(ws, inspected);
  for (const { project, output, plan } of inspected) {
    await validateOutputCleanup(project.path, output, plan.resources);
  }
  await cleanOutput(root, ws.output, [
    ...ws.resources || [],
    ...inspected.flatMap(({ plan }) => plan.resources || []),
  ]);
  if (ws.config["project-download"]) {
    await (await module("project-download", "public.ts")).resetDownloadRequests(
      root,
    );
  }
  const records = [];
  for (const { project, config, output, plan } of inspected) {
    // Предыдущий child render мог изменить содержимое этого каталога.
    await cleanOutput(project.path, output, plan.resources);
    const collection = join(run, `${project.id}-0.json`);
    await progress("Рендер", project.path, () =>
      quarto(
        ["render", ".", ...profileArguments(ws.profiles)],
        project.path,
        {
          COURSE_SITE_COLLECTION: collection,
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
      ));
    const collected = await readCollection(
      collection,
      project.id,
      project.path,
      output,
      ws.profiles,
      true,
    );
    const record = {
      id: project.id,
      projectRoot: project.path,
      outputDir: output,
      profiles: collected.profiles,
      nativeOutputs: collected.nativeOutputs,
      files: collected.files,
      selectedSources: plan.selectedSources,
    };
    records.push(
      compositionRecord(project, config, record, plan.selectedSources),
    );
  }
  await Deno.writeTextFile(
    state,
    JSON.stringify(activeState(ws, records, run)),
  );
  await coreHook(root, ws.config, "pre");
}
async function postLocal(root: string) {
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
      quarto: ws.quartoVersion,
      config: ws.config,
      members: ws.config["reference-catalog"].namespace
        ? [{
          namespace: ws.config["reference-catalog"].namespace,
          format: "html",
        }]
        : [],
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
    {
      baseUrl: ws.config.website?.["site-url"] ||
        ws.config["course-navigation"]?.["course-url"],
    },
  );
}
function validateActiveWorkspace(
  ws: Awaited<ReturnType<typeof workspace>>,
  root: string,
) {
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
  if (typeof ws.quartoVersion !== "string" || !ws.quartoVersion.trim()) {
    throw diagnostic(
      "SITE.CONFIG_INVALID",
      "В активной сборке отсутствует версия native inspect Quarto",
      {
        source: root,
        field: "quarto.version",
        hint: "Запустите полную сборку заново.",
      },
    );
  }
}
async function postImpl(root = Deno.cwd()): Promise<void> {
  const state = statePath(root);
  if (Deno.env.get("QUARTO_PROJECT_RENDER_ALL") !== "1") {
    await postLocal(root);
    return;
  }
  const { ws, records, run } = readActiveState(
    parseJson(
      await Deno.readTextFile(state),
      state,
      "active",
      "SITE.COLLECTION_INVALID",
    ),
    root,
  );
  await remove(state);
  validateActiveWorkspace(ws, root);
  const rootOutputs = await publicOutputs(root, ws.output),
    rootFiles = await files(ws.output);
  const outputs = [...rootOutputs],
    searchIndexes: NonNullable<
      Parameters<
        SiblingModuleMap["reference-catalog"]["publishReferenceCatalog"]
      >[0]["searchIndexes"]
    > = [];
  const rootSearch = join(ws.output, "search.json");
  if (rootFiles.includes(rootSearch)) {
    searchIndexes.push({ path: rootSearch, mount: "" });
  }
  const nativeOperations:
    (NonNullable<Awaited<ReturnType<typeof finalizeDownloads>>> & {
      project: string;
    })[] = [];
  const members: Parameters<
    SiblingModuleMap["reference-catalog"]["publishReferenceCatalog"]
  >[0]["members"] = [];
  for (const { project, config, record } of records) {
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
    const namespace = config["reference-catalog"]?.namespace;
    if (namespace) {
      members.push({
        namespace,
        format: record.nativeOutputs.some((path: string) =>
            path.endsWith(".html")
          )
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
      quarto: ws.quartoVersion,
      config: ws.config,
      members,
      scope: "full",
      outputs,
      searchIndexes,
    });
  }
  if (ws.config["course-navigation"]?.enabled === true) {
    const { composeNavigation } = await module(
      "course-navigation",
      "public.ts",
    );
    await composeNavigation({
      stage: ws.output,
      outputs,
      title: ws.config.website?.title || "Курс",
      members: [
        { id: "root", mount: "", title: ws.config.website?.title || "Курс" },
        ...records.filter(({ record }) =>
          record.nativeOutputs.some((path: string) => path.endsWith(".html"))
        ).map(({ project, config }) => ({
          id: project.id,
          mount: project.mount,
          title: config.book?.title || config.website?.title || project.mount,
        })),
      ],
    });
  } else {
    await addressNavigation(
      ws.output,
      outputs,
      true,
      ws.config["course-navigation"]?.["course-url"] ||
        ws.config.website?.["site-url"],
    );
  }
  await coreHook(root, ws.config, "post");
  const baseUrl = ws.config.website?.["site-url"] ||
    ws.config["course-navigation"]?.["course-url"];
  const catalogPath = join(ws.output, "reference-catalog.json");
  const referenceCatalog: unknown = ws.config["reference-catalog"]
    ? parseJson(
      await Deno.readTextFile(catalogPath),
      catalogPath,
      "reference-catalog",
    )
    : undefined;
  for (const { project, config, record } of records) {
    const catalog = await finalizeDownloads(
      project.path,
      config,
      record,
      {
        baseUrl: baseUrl
          ? new URL(project.mount.replace(/\\/g, "/") + "/", baseUrl).href
          : undefined,
        referenceCatalog,
        catalogBaseUrl: baseUrl,
        destinationDirectory: join(ws.output, project.mount),
      },
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
      selectedSources: ws.selectedSources,
    },
    { baseUrl, referenceCatalog, catalogBaseUrl: baseUrl },
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
      projects: records.map((r) => r.project.id),
    }),
  );
}

export const pre = __metrics.wrapAsync({
  id: "course-site.application.compose.pre",
  kind: "phase",
}, preImpl);
export const post = __metrics.wrapAsync({
  id: "course-site.application.compose.post",
  kind: "phase",
}, postImpl);
