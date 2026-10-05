export function assert(
  value: unknown,
  message = "assertion failed",
): asserts value {
  if (!value) throw new Error(message);
}
export function assertEquals(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
export async function assertRejects(action: () => Promise<unknown>) {
  let failed = false;
  try {
    await action();
  } catch {
    failed = true;
  }
  assert(failed, "expected rejection");
}

export async function assertPayloadEqual(
  source: string,
  installed: string,
): Promise<void> {
  async function inventory(root: string): Promise<string[]> {
    const paths: string[] = [];
    for await (const entry of Deno.readDir(root)) {
      if (entry.isDirectory) {
        paths.push(
          ...(await inventory(`${root}/${entry.name}`)).map((path) =>
            `${entry.name}/${path}`
          ),
        );
      } else paths.push(entry.name);
    }
    return paths.sort();
  }
  const expected = await inventory(source), actual = await inventory(installed);
  assertEquals(actual, expected);
  for (const path of expected) {
    const left = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        await Deno.readFile(`${source}/${path}`),
      ),
    );
    const right = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        await Deno.readFile(`${installed}/${path}`),
      ),
    );
    assertEquals(Array.from(left), Array.from(right));
  }
}
