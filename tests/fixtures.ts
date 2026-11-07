/** Исполняемые fixtures хранятся исходниками и входят в строгий конечный охват. */
export async function fixture(name: string, replacements: Record<string, string> = {}) {
  let source = await Deno.readTextFile(new URL("./fixtures/" + name, import.meta.url));
  for (const [token, value] of Object.entries(replacements)) source = source.replaceAll(token, value);
  return source;
}
export const fixtureUrl = (name: string) => new URL("./fixtures/" + name, import.meta.url);
export const fixtureImports = {
  '"site-fixture/process"': JSON.stringify(new URL("../_extensions/course-site/infrastructure/process.ts", import.meta.url).href),
  '"site-fixture/diagnostics"': JSON.stringify(new URL("../_extensions/course-site/infrastructure/diagnostics.ts", import.meta.url).href),
  '"site-fixture/state"': JSON.stringify(new URL("../_extensions/course-site/application/state.ts", import.meta.url).href),
};
