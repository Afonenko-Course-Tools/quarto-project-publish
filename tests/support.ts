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
export async function assertRejects(action: () => Promise<unknown>, code?: string, context: string[] = []) {
  let failed = false;
  try {
    await action();
  } catch (error) {
    failed = true;
    if (code) {
      assert(error instanceof Error);
      assertEquals((error as Error & {code?: string}).code, code);
      assertEquals(error.name, "ExtensionDiagnostic");
      for (const value of context) assert(error.message.includes(value), `missing context ${value}: ${error.message}`);
    }
  }
  assert(failed, "expected rejection");
}
