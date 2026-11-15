import { isRecord, isStrings } from "./values.ts";
import { createMetrics as __createMetrics } from "../observability/bridge.ts";
const __metrics = __createMetrics("course-site");
import { addressNavigation } from "./navigation.ts";
import { diagnostic } from "./diagnostics.ts";
import { files, resolve, safePath, within } from "./files.ts";
export interface Record {
  id: string;
  projectRoot: string;
  outputDir: string;
  profiles: string[];
  nativeOutputs: string[];
  files: string[];
}
async function publicOutputsImpl(root: string, outputDir: string): Promise<string[]> {
  const file = Deno.env.get("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES");
  const text = file ? await Deno.readTextFile(resolve(root, file)) : Deno.env.get("QUARTO_PROJECT_OUTPUT_FILES");
  if (text === undefined) {
    throw diagnostic("SITE.COLLECTION_INVALID", "Не получен список текущих результатов Quarto", {
      source: root,
      field: "QUARTO_PROJECT_OUTPUT_FILES",
      hint: "Запускайте collect последним post-render hook.",
    });
  }
  const outputs = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => resolve(root, path));
  if (new Set(outputs).size !== outputs.length) {
    throw diagnostic("SITE.COLLECTION_INVALID", "Список результатов содержит повторяющиеся пути", {
      source: root,
      field: "nativeOutputs",
      hint: "Проверьте post-render окружение Quarto.",
    });
  }
  for (const path of outputs) {
    within(outputDir, path);
    await safePath(root, path);
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.lstat(path);
    } catch (cause) {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      throw diagnostic(
        "SITE.CURRENT_RESULT_MISSING",
        "Файл текущего результата отсутствует",
        { source: root, field: "nativeOutputs", related: [{ source: path }] },
        cause,
      );
    }
    if (!stat.isFile) {
      throw diagnostic("SITE.CURRENT_RESULT_MISSING", "Текущий результат Quarto отсутствует", {
        source: root,
        field: "nativeOutputs",
        related: [{ source: path }],
        hint: "Повторите успешную сборку.",
      });
    }
  }
  return outputs;
}
async function collectImpl(): Promise<void> {
  const destination = Deno.env.get("COURSE_SITE_COLLECTION");
  if (
    !destination &&
    !Deno.env.has("QUARTO_PROJECT_OUTPUT_FILES") &&
    !Deno.env.has("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES")
  )
    return;
  const root = Deno.cwd(),
    outputDir = resolve(root, Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || "");
  if (outputDir === root) {
    throw diagnostic("SITE.COLLECTION_INVALID", "Не задан каталог текущего результата", {
      source: root,
      field: "QUARTO_PROJECT_OUTPUT_DIR",
      hint: "Задайте native project.output-dir.",
    });
  }
  const nativeOutputs = await publicOutputs(root, outputDir);
  await addressNavigation(outputDir, nativeOutputs);
  if (!destination) return;
  const id = Deno.env.get("COURSE_SITE_PROJECT");
  if (!id) {
    throw diagnostic("SITE.COLLECTION_INVALID", "Не задан идентификатор текущего компонента", {
      source: root,
      field: "COURSE_SITE_PROJECT",
      hint: "В композиции Publisher задаёт идентификатор автоматически.",
    });
  }
  const record: Record = {
    id,
    projectRoot: root,
    outputDir,
    profiles: (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(Boolean),
    nativeOutputs,
    files: await files(outputDir),
  };
  await Deno.writeTextFile(destination, JSON.stringify(record));
}
async function readCollectionImpl(
  path: string,
  id: string,
  projectRoot: string,
  outputDir: string,
  context: { profiles: string[]; nativeProfileContext: boolean },
): Promise<Record> {
  // Native post-render профили подтверждают неявные defaults/groups.
  const { profiles, nativeProfileContext } = context;
  let value: unknown;
  try {
    value = JSON.parse(await Deno.readTextFile(path));
  } catch (cause) {
    if (!(cause instanceof Deno.errors.NotFound) && !(cause instanceof SyntaxError)) throw cause;
    throw diagnostic(
      cause instanceof SyntaxError ? "SITE.COLLECTION_INVALID" : "SITE.CURRENT_RESULT_MISSING",
      "Не удалось прочитать текущую коллекцию",
      {
        source: projectRoot,
        id,
        field: "collection",
        related: [{ source: path }],
        hint: "Подключите collect последним hook и повторите сборку.",
      },
      cause,
    );
  }
  if (
    !isRecord(value) ||
    value.id !== id ||
    value.projectRoot !== projectRoot ||
    value.outputDir !== outputDir ||
    !isStrings(value.profiles) ||
    value.profiles.some((profile: unknown) => typeof profile !== "string" || !/^[\w][\w.-]*$/.test(profile)) ||
    new Set(value.profiles).size !== value.profiles.length ||
    JSON.stringify(
      nativeProfileContext ? value.profiles.filter((profile: string) => profiles.includes(profile)) : value.profiles,
    ) !== JSON.stringify(profiles) ||
    !isStrings(value.nativeOutputs) ||
    !isStrings(value.files)
  ) {
    throw diagnostic(
      "SITE.COLLECTION_INVALID",
      "Коллекция не соответствует текущему компоненту, каталогам или профилям",
      {
        source: projectRoot,
        id,
        field: "id/projectRoot/outputDir/profiles/nativeOutputs/files",
        related: [{ source: path }, { source: outputDir }],
        hint: "Подключите collect последним hook и повторите сборку.",
      },
    );
  }
  const current = {
    id,
    projectRoot,
    outputDir,
    profiles: value.profiles,
    nativeOutputs: value.nativeOutputs,
    files: value.files,
  };
  for (const path of [...current.nativeOutputs, ...current.files]) {
    within(outputDir, path);
    await safePath(projectRoot, path);
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.lstat(path);
    } catch (cause) {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      throw diagnostic(
        "SITE.CURRENT_RESULT_MISSING",
        "Файл текущей коллекции отсутствует",
        {
          source: projectRoot,
          id,
          field: "files/nativeOutputs",
          related: [{ source: path }],
        },
        cause,
      );
    }
    if (!stat.isFile) {
      throw diagnostic("SITE.CURRENT_RESULT_MISSING", "Файл текущей коллекции отсутствует", {
        source: projectRoot,
        id,
        field: "files/nativeOutputs",
        related: [{ source: path }],
        hint: "Повторите успешную сборку компонента.",
      });
    }
  }
  return current;
}

export const publicOutputs = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.collection.publicOutputs",
    kind: "io",
  },
  publicOutputsImpl,
);
export const collect = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.collection.collect",
    kind: "io",
  },
  collectImpl,
);
const observedReadCollection = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.collection.readCollection",
    kind: "io",
  },
  readCollectionImpl,
);
export async function readCollection(
  ...[path, id, projectRoot, outputDir, profiles, nativeProfileContext = false]: [
    path: string,
    id: string,
    projectRoot: string,
    outputDir: string,
    profiles: string[],
    nativeProfileContext?: boolean,
  ]
): Promise<Record> {
  return await observedReadCollection(path, id, projectRoot, outputDir, {
    profiles,
    nativeProfileContext,
  });
}
