export async function finishDownloads(): Promise<void> {}
export function prepareNativeDownloads(): never { throw Error("Неиспользуемая операция fixture"); }
export function resetDownloadRequests(): never {
  const error = new Error("CORE_SENTINEL", { cause: "original" });
  error.name = "ExtensionDiagnostic";
  Object.assign(error, { code: "CORE.SENTINEL" });
  throw error;
}
