import type { Project, Workspace } from "../infrastructure/config.ts";
import type { Record as CollectionRecord } from "../infrastructure/collection.ts";
import { nativeConfig, record, strings, text, type NativeConfig } from "../infrastructure/values.ts";
import { diagnostic } from "../infrastructure/diagnostics.ts";

export function compositionRecord(project: Project, config: NativeConfig, current: CollectionRecord, selectedSources: string[]) {
  return { project, config, record: { ...current, selectedSources } };
}
export function activeState(ws: Workspace, records: ReturnType<typeof compositionRecord>[], run: string) {
  return { ws, records, run };
}

/** Persisted pre/post transport проверяется по формам реальных producer outputs. */
export function readActiveState(value: unknown, root: string): ReturnType<typeof activeState> {
  const raw = record(value, root, "active"), source = record(raw.ws, root, "active.ws");
  const project = (value: unknown): Project => {
    const raw = record(value, root, "active.project");
    return { id: text(raw.id, root, "active.project.id"), path: text(raw.path, root, "active.project.path"), mount: text(raw.mount, root, "active.project.mount") };
  };
  if (!Array.isArray(source.projects) || !Array.isArray(raw.records)) throw diagnostic("SITE.COLLECTION_INVALID", "Активной сборке требуется список проектов и коллекций", { source: root, field: "active.projects/records" });
  const version = text(source.quartoVersion, root, "quarto.version");
  if (!version.trim()) throw diagnostic("SITE.CONFIG_INVALID", "Не задана версия native inspect", { source: root, field: "quarto.version" });
  const ws: Workspace = {
    root: text(source.root, root, "active.ws.root"),
    output: text(source.output, root, "active.ws.output"),
    projects: source.projects.map(project),
    profiles: strings(source.profiles, root, "active.ws.profiles"),
    config: nativeConfig(source.config, root),
    quartoVersion: version,
    resources: strings(source.resources, root, "active.ws.resources"),
    selectedSources: source.selectedSources === undefined ? undefined : strings(source.selectedSources, root, "active.ws.selectedSources"),
  };
  const records = raw.records.map((value: unknown) => {
    const row = record(value, root, "active.records"), current = record(row.record, root, "active.records.record");
    const owner = project(row.project);
    const collected: CollectionRecord = {
      id: text(current.id, root, "active.record.id"),
      projectRoot: text(current.projectRoot, root, "active.record.projectRoot"),
      outputDir: text(current.outputDir, root, "active.record.outputDir"),
      profiles: strings(current.profiles, root, "active.record.profiles"),
      nativeOutputs: strings(current.nativeOutputs, root, "active.record.nativeOutputs"),
      files: strings(current.files, root, "active.record.files"),
    };
    return compositionRecord(owner, nativeConfig(row.config, owner.path), collected, strings(current.selectedSources, root, "active.record.selectedSources"));
  });
  return activeState(ws, records, text(raw.run, root, "active.run"));
}
