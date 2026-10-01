import type { BuildState, Workspace } from "../domain/model.ts";
import { unchanged } from "../domain/attempt.ts";
export interface BuildPorts {
  workspace(): Promise<Workspace>;
  clearState(w: Workspace): Promise<void>;
  render(w: Workspace): Promise<BuildState>;
  saveState(w: Workspace, state: BuildState): Promise<void>;
  loadState(): Promise<BuildState>;
  preparePreview(w: Workspace): Promise<void>;
  publish(w: Workspace, state: BuildState): Promise<void>;
  cleanup(w: Workspace, state: BuildState, failed?: boolean): Promise<void>;
}
export async function prepare(ports: BuildPorts): Promise<void> {
  const w = await ports.workspace();
  await ports.clearState(w);
  try {
    const state = await ports.render(w);
    await ports.saveState(w, state);
    await ports.preparePreview(w);
  } catch (error) {
    await ports.clearState(w);
    throw error;
  }
}
export async function finalize(ports: BuildPorts): Promise<void> {
  const state = await ports.loadState();
  let failed = true;
  try {
    const w = await ports.workspace();
    unchanged(w, state);
    await ports.publish(state.workspace, state);
    failed = false;
  } finally {
    await ports.cleanup(state.workspace, state, failed);
  }
}
