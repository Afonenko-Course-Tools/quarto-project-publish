// @deno-types="../_extensions/course-site/vendor/parse5/dist/index.d.ts"
import { defaultTreeAdapter as tree, parse, type DefaultTreeAdapterTypes } from "../_extensions/course-site/vendor/parse5/dist/index.js";
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
export async function assertRejects(
  action: () => Promise<unknown>,
  code?: string,
  context: string[] = [],
) {
  let failed = false;
  try {
    await action();
  } catch (error) {
    failed = true;
    if (code) {
      assert(error instanceof Error);
      assert("code" in error);
      assertEquals(error.code, code);
      assertEquals(error.name, "ExtensionDiagnostic");
      for (const value of context) {
        assert(
          error.message.includes(value),
          `missing context ${value}: ${error.message}`,
        );
      }
    }
  }
  assert(failed, "expected rejection");
}

/** Проверяем native Reveal-дерево; слово reveal.js в комментарии обычной страницы не задаёт формат. */
export function isRevealHtml(source: string): boolean {
  let reveal = false, script = false;
  const visit = (node: DefaultTreeAdapterTypes.Node) => {
    if (tree.isElementNode(node)) {
      if (node.tagName === "div" && node.attrs.some(attr => attr.name === "class" && attr.value.split(/\s+/).includes("reveal"))) reveal = true;
      if (node.tagName === "script" && node.attrs.some(attr => attr.name === "src" && /(?:^|\/)reveal\.js(?:[?#]|$)/.test(attr.value))) script = true;
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  };
  visit(parse(source));
  return reveal && script;
}
