import { strict as assert } from "node:assert";

// Проверяем private-функцию из текущего поставляемого файла без нового API.
const compose = await Deno.readTextFile(new URL(
  "../_extensions/course-site/application/compose.ts", import.meta.url,
));
const start = compose.indexOf("function qualify(");
const end = compose.indexOf("export async function post(", start);
assert(start >= 0 && end > start, "Не найдена фактическая функция qualify");
const { qualify } = await import("data:application/typescript;base64," + btoa(
  compose.slice(start, end) + "\nexport { qualify };\n",
));
const coreRoot = Deno.env.get("COURSE_CORE_PROVIDER");
const core = coreRoot
  ? new URL("file://" + await Deno.realPath(coreRoot) + "/")
  : new URL("../../quarto-course/", import.meta.url);
const { bindProjectMaterializations: bind } = await import(new URL(
  "_extensions/course-core/domain/project-materialization.ts", core,
).href);
const source = "optional/project-maintenance.qmd";
const fact = (id: string, path = source) => ({
  exerciseId: id, source: path, projectRoot: "projects/example",
  bankMember: true, purpose: "independent-study", statementVisibility: "open",
  artifactPolicy: { student: "starter", full: "full", conditions: true },
});
const document = (id: string, path = source) => ({
  source: path, projects: [fact(id, path)],
  document: { source: path }, resources: { source: path },
});
const cases: [string, () => void][] = [
  ["Один project принимается Core после Site-проекции", () => {
    const local = document("exr-one");
    assert.equal(bind([local]).length, 1);
    const projected = qualify(local, "tasks");
    assert.equal(bind([projected]).length, 1);
    assert.equal(projected.source, "tasks/optional/project-maintenance.qmd");
    assert.equal(projected.projects[0].source, projected.source);
  }],
  ["Все facts проецируются без изменения owner/project metadata", () => {
    const local: any = document("exr-first");
    local.projects.push(fact("exr-second"));
    const materialization = { includeGit: true, commonFiles: [
      { source: "common/public.txt", target: "student/public.txt", audience: "student" },
      { source: "common/teacher.txt", target: "tests/teacher.txt", audience: "grading" },
    ] };
    local.projects[0].materialization = materialization;
    local.projects[0].check = { profile: "junit", runtime: "java25-gradle-junit-v1",
      sourceProfile: { mode: "implementation", root: "student", include: ["**/*.java"] },
      "source-profile": "student", tests: ["tests/junit"],
      references: [{ name: "primary", root: "reference", optional: false }],
      "java-build": { kind: "gradle-jar-v1", "main-class": "example.Main", artifact: "gradeapp.jar" },
      "api-precheck": { files: ["binding/API.java"], entry: "binding.API" } };
    local.projectMaterializations = { "exr-first": materialization };
    local.resources.context = { effectiveBase: "/owner", capturedFiles: ["public.txt"] };
    const before = structuredClone(local);
    const projected = qualify(local, "units/tasks");
    assert.equal(bind([projected]).length, 2);
    for (let i = 0; i < 2; i++) {
      assert.equal(projected.projects[i].source, "units/tasks/optional/project-maintenance.qmd");
      assert.deepEqual({ ...projected.projects[i], source }, local.projects[i]);
    }
    assert.deepEqual(projected.projectMaterializations, local.projectMaterializations);
    assert.deepEqual(projected.resources.context, local.resources.context);
    assert.deepEqual(local, before);
    assert.deepEqual(qualify(local, "units/tasks"), projected);
  }],
  ["Разные компоненты сохраняют независимые semantic IDs", () => {
    const left = qualify(document("exr-left"), "left");
    const right = qualify(document("exr-right"), "right");
    assert.deepEqual(bind([left, right]).map((p: any) => p.source), [
      "left/optional/project-maintenance.qmd", "right/optional/project-maintenance.qmd",
    ]);
    assert.throws(() => bind([left, qualify(document("exr-left"), "right")]),
      { code: "CORE.PROJECT_MATERIALIZATION_INVALID" });
  }],
  ["Одноимённый каталог source не считается уже применённым prefix", () => {
    const local = document("exr-nested", "tasks/chapter.qmd");
    const before = structuredClone(local);
    const projected = qualify(local, "tasks");
    assert.equal(projected.source, "tasks/tasks/chapter.qmd");
    assert.equal(projected.projects[0].source, "tasks/tasks/chapter.qmd");
    assert.equal(bind([projected]).length, 1);
    assert.deepEqual(local, before);
    assert.deepEqual(qualify(local, "tasks"), projected);
  }],
  ["Противоречивый source не исправляется источником документа", () => {
    const local = document("exr-wrong");
    local.projects[0].source = "another.qmd";
    assert.throws(() => bind([qualify(local, "tasks")]),
      { code: "CORE.PROJECT_MATERIALIZATION_INVALID" });
  }],
  ["Корневая область сохраняет согласованную identity проекта", () => {
    const projected = qualify(document("exr-root", "index.qmd"), "root");
    assert.equal(projected.source, "root/index.qmd");
    assert.equal(projected.projects[0].source, "root/index.qmd");
    assert.equal(bind([projected]).length, 1);
  }],
  ["Документ без projects сохраняет прежнюю проекцию", () => {
    const local = { source: "index.qmd", document: { source: "index.qmd" } };
    const projected = qualify(local, "root");
    assert.equal(projected.source, "root/index.qmd");
    assert.equal(projected.document.source, "root/index.qmd");
    assert.equal("projects" in projected, false);
    assert.deepEqual(bind([projected]), []);
    assert.deepEqual(local, { source: "index.qmd", document: { source: "index.qmd" } });
  }],
];
let failures = 0;
for (const [name, run] of cases) {
  try { run(); console.log("PASS " + name); }
  catch (error) { failures++; console.error("FAIL " + name, error); }
}
assert.equal(failures, 0, `Отказов: ${failures}/${cases.length}`);
console.log(`PASS Site → Core: ${cases.length} адресных сценариев`);
