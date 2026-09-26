/** The workspace's selected profiles are explicit inputs to every child render. */
export function activeProfiles(value = Deno.env.get("QUARTO_PROFILE") ?? ""): string[] {
  const result = value.split(",").map((name) => name.trim()).filter(Boolean);
  if (result.some((name) => !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name))) throw new Error("QRC invalid active profile name");
  if (new Set(result).size !== result.length) throw new Error("QRC duplicate active profile");
  return result;
}
export function profileArguments(profiles: string[]): string[] {
  return profiles.length ? ["--profile", profiles.join(",")] : [];
}
