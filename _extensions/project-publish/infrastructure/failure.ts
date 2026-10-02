import type {
  BuildState,
  FailureContext,
  Integration,
} from "../domain/model.ts";
import { context, failurePaths } from "./attempt.ts";
import { integrations } from "./integrations.ts";

export interface FailurePoint {
  phase: FailureContext["failure"]["phase"];
  operation: FailureContext["failure"]["operation"];
  namespace?: string;
  format?: FailureContext["format"];
  output?: string;
  stage?: string;
}
const notified = new WeakSet<BuildState>();
const compositions = new WeakMap<
  object,
  { primary: unknown; failures: unknown[] }
>();

export function registerFailureIntegrations(
  state: BuildState,
  adapters: Integration[],
) {
  const paths = [
    ...new Set(
      state.workspace.integrations.filter((_, index) =>
        typeof adapters[index].onFailure === "function"
      ),
    ),
  ];
  if (paths.length) state.failureIntegrations = paths;
}
function summary(error: unknown): { name: string; message: string } {
  try {
    return error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: typeof error, message: String(error) };
  } catch {
    return { name: "Error", message: "Недоступное описание исходного отказа" };
  }
}
/** Diagnostics never throw through rollback/cleanup or certify completion. */
export async function notifyFailure(
  state: BuildState,
  error: unknown,
  point: FailurePoint,
): Promise<unknown[]> {
  if (notified.has(state)) return [];
  notified.add(state);
  const failures: unknown[] = [];
  let paths: string[];
  try {
    paths = failurePaths(state);
  } catch (failure) {
    return [failure];
  }
  for (const path of paths) {
    try {
      const [adapter] = await integrations(state.workspace, state.sourceRoot, [
        path,
      ]);
      if (typeof adapter.onFailure !== "function") {
        throw new Error("Публикация: зарегистрированный onFailure отсутствует");
      }
      const { phase, operation, ...fields } = point;
      await adapter.onFailure({
        ...context(state),
        ...structuredClone(fields),
        failure: { phase, operation, error: summary(error) },
      });
    } catch (failure) {
      failures.push(failure);
    }
  }
  return failures;
}
export function failureError(
  primary: unknown,
  failures: unknown[],
  message?: string,
): unknown {
  if (!failures.length) return primary;
  const previous = primary !== null && typeof primary === "object"
    ? compositions.get(primary)
    : undefined;
  const original = previous ? previous.primary : primary;
  const combined = [...(previous?.failures ?? []), ...failures];
  const aggregate = new AggregateError(
    [original, ...combined],
    message ??
      `Публикация исходный отказ: ${
        summary(primary).message
      }; диагностика/очистка также отказала`,
    { cause: original },
  );
  compositions.set(aggregate, { primary: original, failures: combined });
  return aggregate;
}
