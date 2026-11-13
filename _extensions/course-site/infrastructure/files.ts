import { createMetrics as __createMetrics } from "../observability/bridge.ts";
const __metrics = __createMetrics("course-site");
import { contextualize, diagnostic } from "./diagnostics.ts";
import { dirname, fromFileUrl, isAbsolute, join, relative, resolve, toFileUrl } from "stdlib/path";
export { dirname, fromFileUrl, isAbsolute, join, relative, resolve, toFileUrl };
function insideImpl(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\");
}
function withinImpl(root: string, path: string): string {
  const full = resolve(root, path);
  if (full === resolve(root) || !inside(root, full)) {
    throw diagnostic("SITE.SUBPROJECT_INVALID", "Путь должен вести к вложенному объекту проекта", {
      source: root,
      field: "path",
      related: [{ source: path }],
      hint: "Укажите относительный путь внутри проекта.",
    });
  }
  return full;
}
async function safePathImpl(root: string, path: string): Promise<void> {
  if (!inside(root, path)) {
    throw diagnostic("SITE.SUBPROJECT_INVALID", "Путь выходит за пределы проекта", {
      source: root,
      field: "path",
      related: [{ source: path }],
      hint: "Выберите объект внутри проекта.",
    });
  }
  let current = root;
  for (const part of ["", ...relative(root, path).split(/[\\/]/).filter(Boolean)]) {
    current = join(current, part);
    try {
      if ((await Deno.lstat(current)).isSymlink) {
        throw diagnostic("SITE.SUBPROJECT_INVALID", "Символическая ссылка запрещена", {
          source: root,
          field: "path",
          related: [{ source: current }],
          hint: "Используйте обычную папку или файл внутри проекта.",
        });
      }
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return;
      throw e;
    }
  }
}
async function filesImpl(root: string): Promise<string[]> {
  const result: string[] = [];
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);
    if (entry.isSymlink) {
      throw diagnostic("SITE.SUBPROJECT_INVALID", "Символическая ссылка запрещена", {
        source: root,
        field: "path",
        related: [{ source: path }],
        hint: "Используйте обычный файл.",
      });
    }
    if (entry.isDirectory) result.push(...(await files(path)));
    else if (entry.isFile) result.push(path);
  }
  return result.sort();
}
async function outputDirectoryImpl(root: string, name: string): Promise<string> {
  let output: string;
  try {
    output = within(root, name);
  } catch (error) {
    throw contextualize(error, { source: root, field: "project.output-dir" });
  }
  if (
    relative(root, output)
      .split(/[\\/]/)
      .some((p) => [".quarto", "_freeze", "_extensions", "_generated", ".git"].includes(p))
  ) {
    throw diagnostic("SITE.OUTPUT_OVERLAP", "Каталог результата пересекается со служебными или исходными данными", {
      source: root,
      field: "project.output-dir",
      related: [{ source: name }],
      hint: "Выберите отдельный каталог результата.",
    });
  }
  try {
    await safePath(root, output);
  } catch (error) {
    throw contextualize(error, { source: root, field: "project.output-dir" });
  }
  return output;
}
async function recoverableMarkdownCopy(root: string, output: string, file: string): Promise<boolean> {
  let recoverableMarkdown = false;
  const source = resolve(root, relative(output, file));
  if (inside(root, source) && !inside(output, source)) {
    await safePath(root, source);
    try {
      if ((await Deno.lstat(source)).isFile) {
        const original = await Deno.readFile(source);
        const copied = await Deno.readFile(file);
        recoverableMarkdown =
          original.length === copied.length && original.every((byte, index) => byte === copied[index]);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return recoverableMarkdown;
}
async function validateOutputCleanupImpl(root: string, output: string, resources: string[] = []): Promise<boolean> {
  await outputDirectory(root, output);
  const copiedResources = new Set<string>();
  for (const resource of resources) {
    const source = resolve(root, resource);
    if (!inside(root, source) || inside(output, source)) continue;
    await safePath(root, source);
    try {
      if ((await Deno.lstat(source)).isFile && !/\.(qmd|ipynb|rmd|ya?ml)$/i.test(source)) {
        copiedResources.add(join(output, relative(root, source)));
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  try {
    for (const file of await files(output)) {
      const protectedPath = file.split(/[\\/]/).some((p) => [".git", ".quarto", "_freeze", "_extensions"].includes(p));
      let recoverableMarkdown = false;
      if (!protectedPath && /\.md$/i.test(file) && !copiedResources.has(file)) {
        recoverableMarkdown = await recoverableMarkdownCopy(root, output, file);
      }
      if (
        (/\.(qmd|md|ipynb|Rmd|ya?ml)$/i.test(file) &&
          !copiedResources.has(file) &&
          !recoverableMarkdown &&
          !/(?:^|\/)(?:site_)?libs\/revealjs\/plugin\/[A-Za-z0-9._-]+\/plugin\.yml$/.test(
            relative(output, file).replaceAll("\\", "/"),
          )) ||
        protectedPath
      ) {
        throw diagnostic("SITE.OUTPUT_OVERLAP", "Очистка затронет исходный файл или кеш", {
          source: root,
          field: "project.output-dir",
          related: [{ source: file }],
          hint: "Перенесите исходные файлы из каталога результата.",
        });
      }
    }
  } catch (e) {
    // Удалять можно только каталог, обход которого завершился.
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
  return true;
}
async function cleanOutputImpl(root: string, output: string, resources: string[] = []): Promise<void> {
  if (await validateOutputCleanup(root, output, resources)) {
    try {
      await Deno.remove(output, { recursive: true });
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
  await Deno.mkdir(output, { recursive: true });
}
async function copyFilesImpl(source: string, destination: string, paths: string[]): Promise<void> {
  for (const path of paths) {
    within(source, path);
    await safePath(source, path);
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.lstat(path);
    } catch (cause) {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      throw diagnostic(
        "SITE.CURRENT_RESULT_MISSING",
        "Текущий файл результата отсутствует",
        {
          source,
          field: "files",
          related: [{ source: path }],
          hint: "Повторите сборку компонента.",
        },
        cause,
      );
    }
    if (!stat.isFile) {
      throw diagnostic("SITE.CURRENT_RESULT_MISSING", "Текущий файл результата отсутствует", {
        source,
        field: "files",
        related: [{ source: path }],
        hint: "Повторите успешную сборку компонента.",
      });
    }
    const target = within(destination, relative(source, path));
    await safePath(destination, target);
    await Deno.mkdir(dirname(target), { recursive: true });
    await Deno.copyFile(path, target);
  }
}

export const inside = __metrics.wrapSync(
  {
    id: "course-site.infrastructure.files.inside",
    kind: "io",
  },
  insideImpl,
);
export const within = __metrics.wrapSync(
  {
    id: "course-site.infrastructure.files.within",
    kind: "io",
  },
  withinImpl,
);
export const safePath = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.safePath",
    kind: "io",
  },
  safePathImpl,
);
export const files = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.files",
    kind: "io",
  },
  filesImpl,
);
export const outputDirectory = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.outputDirectory",
    kind: "io",
  },
  outputDirectoryImpl,
);
export const validateOutputCleanup = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.validateOutputCleanup",
    kind: "io",
  },
  validateOutputCleanupImpl,
);
export const cleanOutput = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.cleanOutput",
    kind: "io",
  },
  cleanOutputImpl,
);
export const copyFiles = __metrics.wrapAsync(
  {
    id: "course-site.infrastructure.files.copyFiles",
    kind: "io",
  },
  copyFilesImpl,
);
