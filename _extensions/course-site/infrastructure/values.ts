import { diagnostic } from "./diagnostics.ts";

/** Внешние JSON/inspect данные остаются unknown до проверки поля. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function record(value: unknown, root: string, field: string) {
  if (!isRecord(value)) {
    throw diagnostic("SITE.CONFIG_INVALID", "Ожидался объект", {
      source: root,
      field,
    });
  }
  return value;
}
export function text(value: unknown, root: string, field: string): string {
  if (typeof value !== "string") {
    throw diagnostic("SITE.CONFIG_INVALID", "Ожидалась строка", {
      source: root,
      field,
    });
  }
  return value;
}
export function optionalText(value: unknown, root: string, field: string) {
  return value === undefined ? undefined : text(value, root, field);
}
export function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === "string");
}
export function strings(value: unknown, root: string, field: string): string[] {
  if (!isStrings(value)) {
    throw diagnostic("SITE.CONFIG_INVALID", "Ожидался список строк", {
      source: root,
      field,
    });
  }
  return value;
}

function courseView(
  value: unknown,
  root: string,
): "student" | "full" | undefined {
  if (value === undefined || value === "student" || value === "full") {
    return value;
  }
  throw diagnostic("SITE.CONFIG_INVALID", "course.view требует student/full", {
    source: root,
    field: "course.view",
  });
}

/** Проверяются только поля, читаемые Publisher; остальные metadata принадлежат Quarto/соседям. */
export function nativeConfig(value: unknown, root: string) {
  const raw = record(value, root, "config");
  const section = (name: string) =>
    raw[name] === undefined || raw[name] === false || raw[name] === null
      ? undefined
      : record(raw[name], root, name);
  const project = section("project"),
    website = section("website"),
    book = section("book"),
    course = section("course");
  const navigation = section("course-navigation"),
    catalog = section("reference-catalog"),
    download = section("project-download");
  const view = courseView(course?.view, root);
  return {
    ...raw,
    filters: raw.filters,
    subprojects: raw.subprojects,
    "course-site": raw["course-site"],
    "course-core-runtime": raw["course-core-runtime"],
    "course-core-projection": raw["course-core-projection"],
    project: project &&
      {
        ...project,
        type: optionalText(project.type, root, "project.type"),
        "output-dir": optionalText(
          project["output-dir"],
          root,
          "project.output-dir",
        ),
      },
    website: website &&
      {
        ...website,
        title: optionalText(website.title, root, "website.title"),
        "site-url": optionalText(website["site-url"], root, "website.site-url"),
      },
    book: book &&
      { ...book, title: optionalText(book.title, root, "book.title") },
    course: course && { ...course, view },
    "course-navigation": navigation &&
      {
        ...navigation,
        enabled: navigation.enabled,
        "course-url": optionalText(
          navigation["course-url"],
          root,
          "course-navigation.course-url",
        ),
      },
    "reference-catalog": catalog &&
      {
        ...catalog,
        namespace: optionalText(
          catalog.namespace,
          root,
          "reference-catalog.namespace",
        ),
      },
    "project-download": download,
  };
}
export type NativeConfig = ReturnType<typeof nativeConfig>;

export function nativeInspect(value: unknown, root: string) {
  const raw = record(value, root, "inspect");
  const files = raw.files === undefined
    ? undefined
    : record(raw.files, root, "files");
  const quarto = raw.quarto === undefined
    ? undefined
    : record(raw.quarto, root, "quarto");
  return {
    config: nativeConfig(raw.config, root),
    quarto,
    files: {
      input: files?.input,
      resources: files?.resources === undefined
        ? []
        : strings(files.resources, root, "files.resources"),
    },
  };
}

/** Синтаксическая ошибка JSON сохраняет исходную причину и фактический источник. */
export function parseJson(
  source: string,
  root: string,
  field: string,
  code = "SITE.CONFIG_INVALID",
): unknown {
  try {
    return JSON.parse(source);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    throw diagnostic(code, "Некорректный JSON", {
      source: root,
      field,
      hint: "Исправьте указанный JSON или повторите успешную native сборку.",
    }, cause);
  }
}
