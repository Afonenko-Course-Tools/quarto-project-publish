import { assert, assertEquals, assertRejects } from "./support.ts";
const modulePath = "../_extensions/course-site/infrastructure/config.ts";
let api: any;
try {
  api = await import(modulePath);
} catch { /* missing implementation is the initial RED */ }
assert(api?.validateConfig, "course-site safe native configuration is missing");
const root = await Deno.makeTempDir();
try {
  await Deno.mkdir(`${root}/part`);
  const base = {
    project: { type: "website", "output-dir": "_site" },
    "course-site": {
      projects: [{
        id: "part",
        path: "part",
        format: "html",
        mount: "parts/one",
      }],
    },
  };
  const result = await api.validateConfig(root, base, ["student"]);
  assertEquals(result.projects[0].mount, "parts/one");
  assertEquals(result.profiles, ["student"]);
  for (const output of [".", "..", ".quarto/site", "_freeze/site", "part"]) {
    await assertRejects(() =>
      api.validateConfig(root, {
        ...base,
        project: { ...base.project, "output-dir": output },
      }, [])
    );
  }
  for (
    const patch of [{ path: "." }, { path: "../outside" }, {
      mount: "../escape",
    }, { mount: "" }]
  ) {
    await assertRejects(() =>
      api.validateConfig(root, {
        ...base,
        "course-site": {
          projects: [{ ...base["course-site"].projects[0], ...patch }],
        },
      }, [])
    );
  }
  for (
    const second of [{
      id: "other",
      path: "part",
      mount: "other",
      format: "html",
    }, { id: "other", path: "part2", mount: "parts", format: "html" }]
  ) {
    await Deno.mkdir(`${root}/part2`, { recursive: true });
    await assertRejects(() =>
      api.validateConfig(root, {
        ...base,
        "course-site": { projects: [...base["course-site"].projects, second] },
      }, [])
    );
  }
  await Deno.symlink(`${root}/part`, `${root}/linked`);
  await assertRejects(() =>
    api.validateConfig(root, {
      ...base,
      project: { ...base.project, "output-dir": "linked/site" },
    }, [])
  );
  await assertRejects(() =>
    api.validateConfig(root, {
      ...base,
      "course-site": {
        projects: [{ ...base["course-site"].projects[0], path: "linked" }],
      },
    }, [])
  );
  console.log(
    "PASS native configuration containment, symlinks, overlaps and profiles",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
