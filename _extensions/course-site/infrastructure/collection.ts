import { files, join, resolve, safePath, within } from "./files.ts";
export interface Record {
  id: string;
  projectRoot: string;
  outputDir: string;
  profiles: string[];
  nativeOutputs: string[];
  files: string[];
}
export async function publicOutputs(
  root: string,
  outputDir: string,
): Promise<string[]> {
  const file = Deno.env.get("QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES");
  const text = file
    ? await Deno.readTextFile(resolve(root, file))
    : Deno.env.get("QUARTO_PROJECT_OUTPUT_FILES");
  if (text === undefined) {
    throw new Error("course-site requires public native output list");
  }
  const outputs = text.split(/\r?\n/).filter(Boolean).map((path) =>
    resolve(root, path)
  );
  if (new Set(outputs).size !== outputs.length) {
    throw new Error("course-site duplicate native outputs");
  }
  for (const path of outputs) {
    within(outputDir, path);
    await safePath(root, path);
    if (!(await Deno.lstat(path)).isFile) {
      throw new Error(`course-site missing current native output: ${path}`);
    }
  }
  return outputs;
}
export async function collect(): Promise<void> {
  const destination = Deno.env.get("COURSE_SITE_COLLECTION");
  if (!destination) return;
  const root = Deno.cwd(),
    outputDir = resolve(root, Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || "");
  if (outputDir === root) {
    throw new Error("course-site missing native output directory");
  }
  const record: Record = {
    id: Deno.env.get("COURSE_SITE_PROJECT")!,
    projectRoot: root,
    outputDir,
    profiles: (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(Boolean),
    nativeOutputs: await publicOutputs(root, outputDir),
    files: await files(outputDir),
  };
  await Deno.writeTextFile(destination, JSON.stringify(record));
}
export async function readCollection(
  path: string,
  id: string,
  projectRoot: string,
  outputDir: string,
  profiles: string[],
  nativeProfileContext = false,
): Promise<Record> {
  const value = JSON.parse(await Deno.readTextFile(path));
  if (
    value.id !== id || value.projectRoot !== projectRoot ||
    value.outputDir !== outputDir ||
    !Array.isArray(value.profiles) ||
    value.profiles.some((profile: any) =>
      typeof profile !== "string" || !/^[\w][\w.-]*$/.test(profile)
    ) || new Set(value.profiles).size !== value.profiles.length ||
    JSON.stringify(
        nativeProfileContext
          ? value.profiles.filter((profile: string) =>
            profiles.includes(profile)
          )
          : value.profiles,
      ) !== JSON.stringify(profiles) ||
    !Array.isArray(value.nativeOutputs) || !Array.isArray(value.files)
  ) throw new Error("course-site current collection mismatch");
  if (nativeProfileContext) {
    // Content-only native defaults/groups need not have a profile YAML file.
    // Preserve their actual QUARTO_PROFILE, but never accept an extra profile
    // that could have changed the configuration inspected before cleanup.
    for (
      const profile of value.profiles.filter((p: string) =>
        !profiles.includes(p)
      )
    ) {
      for (const suffix of ["yml", "yaml"]) {
        try {
          await Deno.lstat(join(projectRoot, `_quarto-${profile}.${suffix}`));
          throw new Error("course-site current collection mismatch");
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
      }
    }
  }
  for (const path of [...value.nativeOutputs, ...value.files]) {
    within(outputDir, path);
    await safePath(projectRoot, path);
    if (!(await Deno.lstat(path)).isFile) {
      throw new Error(`course-site missing collected file: ${path}`);
    }
  }
  return value;
}
