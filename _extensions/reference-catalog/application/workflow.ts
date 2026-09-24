import type { Workspace } from "../domain/model.ts";
export interface BuildState { id: string; quarto: string; members: { mount: string; output: string }[] }
/** Use cases depend on ports; CLI, files, HTML and Quarto stay in adapters. */
export interface BuildPorts {
  workspace(): Promise<Workspace>;
  clearState(w: Workspace): Promise<void>;
  render(w: Workspace): Promise<BuildState>;
  saveState(w: Workspace, state: BuildState): Promise<void>;
  loadState(w: Workspace): Promise<BuildState>;
  preparePreview(w: Workspace): Promise<void>;
  publish(w: Workspace, state: BuildState): Promise<void>;
  discard(w: Workspace): Promise<void>;
  cleanup(w: Workspace, state: BuildState): Promise<void>;
}
export async function prepare(ports: BuildPorts): Promise<void> {
  const w = await ports.workspace();
  await ports.clearState(w);
  const state = await ports.render(w);
  await ports.saveState(w, state);
  await ports.preparePreview(w);
}
export async function finalize(ports: BuildPorts): Promise<void> {
  const w = await ports.workspace();
  const state = await ports.loadState(w);
  try { await ports.publish(w, state); }
  catch (error) { await ports.discard(w); throw error; }
  await ports.cleanup(w, state);
}
