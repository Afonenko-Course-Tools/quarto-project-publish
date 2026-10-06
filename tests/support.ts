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
