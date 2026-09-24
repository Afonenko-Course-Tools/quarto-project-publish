import { join, resolve, relative, isAbsolute, dirname, fromFileUrl } from "stdlib/path";
export { join, resolve, relative, isAbsolute, dirname, fromFileUrl };
export async function exists(path: string): Promise<boolean> {
  try { await Deno.stat(path); return true; } catch (e) { if (e instanceof Deno.errors.NotFound) return false; throw e; }
}
export async function files(root: string): Promise<string[]> {
  const out: string[] = [];
  for await (const item of Deno.readDir(root)) {
    if (item.isSymlink) throw new Error(`QRC symlinks in generated output are not supported: ${join(root, item.name)}`);
    const path = join(root, item.name);
    if (item.isDirectory) out.push(...await files(path)); else if (item.isFile) out.push(path);
  }
  return out.sort();
}
export function within(root: string, path: string): string {
  const result = resolve(root, path), rel = relative(root, result);
  if (!rel || rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) throw new Error(`QRC expected a child path: ${path}`);
  return result;
}
export async function copyTree(from: string, to: string): Promise<void> {
  for (const path of await files(from)) {
    const dest = join(to, relative(from, path));
    await Deno.mkdir(dirname(dest), { recursive: true });
    await Deno.copyFile(path, dest);
  }
}
/** Copy authored inputs, preserving relative includes and shared resources. */
export async function copySources(from: string, to: string, excluded: Set<string>): Promise<void> {
  await Deno.mkdir(to, { recursive: true });
  for await (const item of Deno.readDir(from)) {
    if (excluded.has(item.name) || item.name.endsWith("_files") || item.name === "__pycache__") continue;
    const source = join(from, item.name), destination = join(to, item.name);
    if (item.isSymlink) throw new Error(`QRC source symlinks are not supported: ${source}`);
    if (item.isDirectory) await copySources(source, destination, excluded);
    else if (item.isFile) await Deno.copyFile(source, destination);
  }
}
