import { assertEquals, assertRejects } from "./support.ts";
import { validateConfig } from "../_extensions/course-site/infrastructure/config.ts";
const root = await Deno.makeTempDir();
try {
  for (const path of ["a/slides", "b/slides", "part", "part/nested"]) {
    await Deno.mkdir(`${root}/${path}`, { recursive: true });
  }
  const base = {
    project: { type: "website", "output-dir": "_site" },
    subprojects: ["./a/slides", "b/slides"],
  };
  const result = await validateConfig(root, base, ["student"]);
  assertEquals(result.projects.map((p) => p.mount), ["a/slides", "b/slides"]);
  assertEquals(new Set(result.projects.map((p) => p.id)).size, 2);
  assertEquals(result.profiles, ["student"]);
  await assertRejects(
    () => validateConfig(root, { ...base, subprojects: [] }, []),
    "SITE.CONFIG_INVALID",
    [root, "subprojects"],
  );
  await assertRejects(
    () =>
      validateConfig(
        root,
        { ...base, subprojects: ["part", "part/nested"] },
        [],
      ),
    "SITE.SUBPROJECT_INVALID",
    [root, "part", "subprojects"],
  );
  await assertRejects(
    () =>
      validateConfig(root, {
        ...base,
        project: { ...base.project, "output-dir": ".quarto/site" },
      }, []),
    "SITE.OUTPUT_OVERLAP",
    [root, "output-dir"],
  );
  for (const output of [".", "..", ".quarto/site", "_freeze/site", "a"]) {
    await assertRejects(() =>
      validateConfig(root, {
        ...base,
        project: { ...base.project, "output-dir": output },
      }, [])
    );
  }
  for (
    const subprojects of [
      ["."],
      ["../outside"],
      ["/tmp/outside"],
      ["part", "./part"],
      ["part", "part/nested"],
      [{ path: "part" }],
      [],
    ]
  ) {
    await assertRejects(() =>
      validateConfig(root, { ...base, subprojects }, [])
    );
  }
  await assertRejects(() =>
    validateConfig(root, {
      ...base,
      "course-site": {
        projects: [{ id: "part", path: "part", format: "html", mount: "part" }],
      },
    }, [])
  );
  await Deno.symlink(`${root}/part`, `${root}/linked`);
  await assertRejects(() =>
    validateConfig(root, {
      ...base,
      project: { ...base.project, "output-dir": "linked/site" },
    }, [])
  );
  await assertRejects(() =>
    validateConfig(root, { ...base, subprojects: ["linked"] }, [])
  );
  console.log(
    "PASS normalized subproject paths, symlinks, overlaps, old syntax rejection and profiles",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
