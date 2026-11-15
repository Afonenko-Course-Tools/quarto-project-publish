import { isStrings, nativeConfig, nativeInspect, parseJson } from "./values.ts";
import { contextualize, diagnostic } from "./diagnostics.ts";
import { inside, isAbsolute, outputDirectory, relative, resolve, safePath, within } from "./files.ts";
import { profileArguments, quarto } from "./process.ts";
function projectRecord(path: string, mount: string) {
  return { id: `subproject-${encodeURIComponent(mount)}`, path, mount };
}
export type Project = ReturnType<typeof projectRecord>;
export type Workspace = Awaited<ReturnType<typeof workspace>>;
export function activeProfiles(): string[] {
  const profiles = (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(Boolean);
  if (new Set(profiles).size !== profiles.length || profiles.some((p) => !/^[\w][\w.-]*$/.test(p))) {
    throw diagnostic("SITE.CONFIG_INVALID", "Некорректные или повторяющиеся профили", {
      source: Deno.cwd(),
      field: "QUARTO_PROFILE",
      hint: "Укажите уникальные имена профилей.",
    });
  }
  return profiles;
}
export async function validateConfig(root: string, value: unknown, profiles: string[]) {
  root = resolve(root);
  const config = nativeConfig(value, root);
  if (config.project?.type !== "website") {
    throw diagnostic("SITE.CONFIG_INVALID", "Корневой проект должен иметь тип website", {
      source: root,
      field: "project.type",
      hint: "Задайте project.type: website.",
    });
  }
  const output = await outputDirectory(root, config.project["output-dir"] || "_site");
  if (config["course-site"] !== undefined) {
    throw diagnostic("SITE.CONFIG_INVALID", "Прежняя конфигурация course-site заменена списком subprojects", {
      source: root,
      field: "course-site",
      hint: "Перенесите пути компонентов в subprojects.",
    });
  }
  const raw: unknown = config.subprojects;
  if (
    !Array.isArray(raw) ||
    !raw.length ||
    !raw.every((item: unknown): item is string => typeof item === "string" && item.length > 0)
  ) {
    throw diagnostic("SITE.CONFIG_INVALID", "subprojects должен быть непустым списком каталогов", {
      source: root,
      field: "subprojects",
      hint: "Например: subprojects: [theory, tasks, lectures].",
    });
  }
  const projects: Project[] = [];
  for (const item of raw) {
    if (isAbsolute(item) || /^[a-z][a-z0-9+.-]*:/i.test(item)) {
      throw diagnostic("SITE.SUBPROJECT_INVALID", "Путь компонента должен быть относительным", {
        source: root,
        field: "subprojects",
        related: [{ source: item }],
        hint: "Укажите папку внутри корневого проекта.",
      });
    }
    let path: string;
    try {
      path = within(root, item);
    } catch (error) {
      throw contextualize(error, {
        source: root,
        field: "subprojects",
        related: [{ source: item }],
      });
    }
    const mount = relative(root, path).replaceAll("\\", "/");
    try {
      await safePath(root, path);
      await safePath(root, within(output, mount));
    } catch (error) {
      throw contextualize(error, {
        source: root,
        field: "subprojects",
        related: [{ source: item }],
      });
    }
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(path);
    } catch (cause) {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      throw diagnostic(
        "SITE.SUBPROJECT_INVALID",
        "Папка компонента отсутствует",
        {
          source: root,
          id: `subproject-${encodeURIComponent(mount)}`,
          field: "subprojects",
          related: [{ source: path }],
          hint: "Укажите существующую папку самостоятельного проекта.",
        },
        cause,
      );
    }
    if (!stat.isDirectory) {
      throw diagnostic("SITE.SUBPROJECT_INVALID", "Компонент должен быть папкой", {
        source: root,
        id: `subproject-${encodeURIComponent(mount)}`,
        field: "subprojects",
        related: [{ source: path }],
        hint: "Укажите папку с собственной конфигурацией Quarto.",
      });
    }
    if (inside(output, path) || inside(path, output)) {
      throw diagnostic("SITE.OUTPUT_OVERLAP", "Источники компонента и каталог результата пересекаются", {
        source: root,
        id: `subproject-${encodeURIComponent(mount)}`,
        field: "subprojects",
        related: [
          { source: path },
          {
            source: output,
            field: "project.output-dir",
          },
        ],
        hint: "Разделите исходники и результат.",
      });
    }
    for (const prev of projects) {
      if (inside(prev.path, path) || inside(path, prev.path)) {
        throw diagnostic("SITE.SUBPROJECT_INVALID", "Компоненты повторяются или вложены друг в друга", {
          source: root,
          field: "subprojects",
          related: [{ source: path }, { source: prev.path, id: prev.id }],
          hint: "Оставьте непересекающиеся папки компонентов.",
        });
      }
    }
    projects.push(projectRecord(path, mount));
  }
  return { root, output, projects, profiles, config };
}
export async function workspace(root: string) {
  const profiles = activeProfiles();
  const project = nativeInspect(
    parseJson(await quarto(["inspect", root, ...profileArguments(profiles)], root), root, "inspect"),
    root,
  );
  const quartoVersion = project.quarto?.version;
  if (typeof quartoVersion !== "string" || !quartoVersion.trim()) {
    throw diagnostic("SITE.CONFIG_INVALID", "Native inspect не вернул версию Quarto", {
      source: root,
      field: "quarto.version",
    });
  }
  const config = project.config;
  const override = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR");
  if (override) {
    if (!config.project) {
      throw diagnostic("SITE.CONFIG_INVALID", "Не задан project", {
        source: root,
        field: "project",
      });
    }
    config.project["output-dir"] = override;
  }
  return {
    ...(await validateConfig(root, config, profiles)),
    quartoVersion: quartoVersion.trim(),
    resources: project.files?.resources || [],
    selectedSources:
      Deno.env.get("QUARTO_PROJECT_RENDER_ALL") === "1" ? await selectedSources(root, project.files?.input) : undefined,
  };
}

/** Чистый preflight: metadata не разрешают author выдачу в student audience. */
export function validateAudience(
  root: string,
  profiles: string[],
  view?: "student" | "full",
  nativeProjection?: "student" | "author",
  expectedAudience?: "student" | "full",
) {
  const audience =
    expectedAudience ??
    profiles.find((profile) => profile === "student" || profile === "full") ??
    view ??
    (nativeProjection === undefined ? undefined : nativeProjection === "author" ? "full" : "student");
  if (view !== undefined && view !== audience) {
    throw diagnostic("SITE.AUDIENCE_MISMATCH", "course.view не совпадает с выбранной student/full аудиторией", {
      source: root,
      field: "course.view",
      hint: "Согласуйте course.view корня и native компонентов с выбранной аудиторией.",
    });
  }
  if (nativeProjection !== undefined && nativeProjection !== (audience === "full" ? "author" : "student")) {
    throw diagnostic(
      "SITE.AUDIENCE_MISMATCH",
      "Native проекция Core не совпадает с выбранной student/full аудиторией",
      {
        source: root,
        field: "course-core-projection",
        hint: "Используйте student для student audience и author для full.",
      },
    );
  }
  return audience;
}

/** Настоящий native project selected set; форматы документов здесь не вычисляются. */
async function selectedSources(root: string, inputs: unknown): Promise<string[]> {
  if (!isStrings(inputs)) {
    throw diagnostic("SITE.SUBPROJECT_INVALID", "Native inspect не вернул список inputs", {
      source: root,
      field: "input",
    });
  }
  const selected: string[] = [],
    unique = new Set<string>();
  for (const input of inputs) {
    const path = within(root, input);
    try {
      await safePath(root, path);
    } catch (error) {
      throw contextualize(error, {
        source: root,
        field: "input",
        related: [{ source: input }],
      });
    }
    if (!(await Deno.lstat(path)).isFile) {
      throw diagnostic("SITE.SUBPROJECT_INVALID", "Выбранный источник не является файлом", {
        source: root,
        field: "input",
        related: [{ source: input }],
        hint: "Выберите обычный исходный документ.",
      });
    }
    const name = relative(root, path).replaceAll("\\", "/");
    if (unique.has(name)) {
      throw diagnostic("SITE.SUBPROJECT_INVALID", "Native inputs повторяются", {
        source: root,
        field: "input",
        related: [{ source: input }],
      });
    }
    unique.add(name);
    selected.push(name);
  }
  return selected;
}
export async function inspectProject(root: string, profiles: string[]) {
  const project = nativeInspect(
    parseJson(await quarto(["inspect", root, ...profileArguments(profiles)], root), root, "inspect"),
    root,
  );
  return {
    config: project.config,
    selectedSources: await selectedSources(root, project.files?.input),
    resources: project.files?.resources || [],
  };
}
