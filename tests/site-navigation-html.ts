import { strict as assert } from "node:assert";
import { addressNavigation } from "../_extensions/course-site/infrastructure/navigation.ts";

async function fixture(
  pages: Record<string, string>,
  check: (root: string, outputs: [string, ...string[]]) => Promise<void>,
) {
  const root = await Deno.makeTempDir({ prefix: "site-navigation-html-" });
  try {
    for (const [path, text] of Object.entries(pages)) {
      const file = `${root}/${path}`;
      await Deno.mkdir(file.slice(0, file.lastIndexOf("/")), {
        recursive: true,
      });
      await Deno.writeTextFile(file, text);
    }
    const [first, ...remaining] = Object.keys(pages).map((path) => `${root}/${path}`);
    assert.ok(first, "HTML fixture должен содержать output");
    await check(root, [first, ...remaining]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

function targets(html: string): string[] {
  const match = /const\s+targets\s*=\s*(\[[^\n]*\])\s*\.map/.exec(html);
  assert.ok(match, "В индекс добавлен действующий скрипт входов в презентации");
  const payload = match[1];
  assert.ok(payload, "В navigation script отсутствует targets payload");
  const value: unknown = JSON.parse(payload);
  assert.ok(Array.isArray(value) && value.every((item) => typeof item === "string"));
  return value;
}

const checks: Array<[string, () => Promise<void>]> = [
  [
    "Существующие ECMAScript type-алиасы не исключают Reveal из целей",
    async () => {
      await fixture(
        {
          "index.html": "<html><body>Индекс</body></html>",
          "text.html":
            '<html><body><div class="reveal"></div><script type="text/ecmascript">Reveal.initialize({});</script></body></html>',
          "application.html":
            '<html><body><div class="reveal"></div><script type="application/ecmascript">Reveal.initialize({});</script></body></html>',
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          assert.deepEqual(targets(await Deno.readTextFile(`${root}/index.html`)), ["text.html", "application.html"]);
        },
      );
    },
  ],
  [
    "Неразрывный пробел не разделяет HTML class tokens",
    async () => {
      await fixture(
        {
          "index.html": "<html><body>Индекс</body></html>",
          "nbsp.html":
            '<html><body><div class="slides\u00a0reveal"></div><script>Reveal.initialize({});</script></body></html>',
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          assert.deepEqual(targets(await Deno.readTextFile(`${root}/index.html`)), []);
        },
      );
    },
  ],
  [
    "Вне navigation script сохраняются DOCTYPE, CRLF, кавычки и сущности HTML",
    async () => {
      const source =
        "<!doctype HTML>\r\n<html lang=ru><head><title>A &amp; B</title></head>\r\n<body data-note='x > y'><main title=\"a &gt; b\">Индекс</main>\r\n</body></html>";
      await fixture({ "index.html": source }, async (root, outputs) => {
        await addressNavigation(root, outputs);
        const html = await Deno.readTextFile(outputs[0]);
        assert.equal(html.replace(/<script id="course-site-navigation">[\s\S]*?<\/script>/, ""), source);
      });
    },
  ],
  [
    "Reveal с одинарными и некавыченными атрибутами остаётся текущей целью",
    async () => {
      await fixture(
        {
          "index.html": '<html><body><a href="deck.html?view=1#slide">Доклад</a></body></html>',
          "deck.html":
            "<html><body><div data-title=\"a > b\" class='slides reveal'></div><script>Reveal.initialize({});</script></body></html>",
          "unquoted.html": "<html><body><div class=reveal></div><script>Reveal.initialize({});</script></body></html>",
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          assert.deepEqual(targets(await Deno.readTextFile(`${root}/index.html`)), ["deck.html", "unquoted.html"]);
        },
      );
    },
  ],
  [
    "Псевдоразметка в комментарии, строке script и template не создаёт Reveal output",
    async () => {
      await fixture(
        {
          "index.html": "<html><body>Индекс</body></html>",
          "comment.html":
            '<html><body><!-- <div class="reveal"></div><script>Reveal.initialize({});</script> --></body></html>',
          "string.html": `<html><body><script>const example = '<div class="reveal"></div>Reveal.initialize({});';</script></body></html>`,
          "template.html":
            '<html><body><template><div class="reveal"></div><script>Reveal.initialize({});</script></template></body></html>',
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          assert.deepEqual(targets(await Deno.readTextFile(`${root}/index.html`)), []);
        },
      );
    },
  ],
  [
    "JSON-контекст определяется по атрибутам, сохраняет суффиксы и экранирование",
    async () => {
      await fixture(
        {
          "nested/deck/index.html": `<html><body><script data-note="a > b" type='application/json' id=course-navigation-context>{"links":[{"text":"Курс < материалы","scope":"course","path":"index.html?lang=ru#start","href":"https://old.example/course/"},{"text":"Проект","scope":"project","href":"./index.html?project=1#top"},{"text":"Репозиторий","scope":"repository","href":"https://github.com/example/course?tab=readme#intro"}]}</script></body></html>`,
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs, true);
          const html = await Deno.readTextFile(outputs[0]);
          assert.ok(html.includes('"href":"../../index.html?lang=ru#start"'));
          assert.ok(html.includes('"href":"./index.html?project=1#top"'));
          assert.ok(html.includes('"href":"https://github.com/example/course?tab=readme#intro"'));
          assert.ok(html.includes('"text":"Курс \\u003c материалы"'));
          assert.ok(!html.includes('"text":"Курс < материалы"'));
        },
      );
    },
  ],
  [
    "Прежний navigation script с иным порядком атрибутов заменяется один раз",
    async () => {
      await fixture(
        {
          "index.html": `<html><body><script data-note=">" id='course-site-navigation'>globalThis.oldNavigation = true;</script><main>Индекс</main></body></html>`,
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          const first = await Deno.readTextFile(outputs[0]);
          assert.ok(!first.includes("globalThis.oldNavigation"));
          assert.equal((first.match(/id="course-site-navigation"/g) || []).length, 1);
          await addressNavigation(root, outputs);
          assert.equal(await Deno.readTextFile(outputs[0]), first, "Повторная обработка побайтно идемпотентна");
        },
      );
    },
  ],
  [
    "Строка с закрывающим body внутри script сохраняется при вставке",
    async () => {
      await fixture(
        {
          "index.html": '<html><body><script>globalThis.example = "</body>";</script><main>Индекс</main></body></html>',
        },
        async (root, outputs) => {
          await addressNavigation(root, outputs);
          const html = await Deno.readTextFile(outputs[0]);
          assert.ok(html.includes('globalThis.example = "</body>";'));
          assert.ok(html.indexOf('id="course-site-navigation"') > html.indexOf("</main>"));
        },
      );
    },
  ],
  [
    "Reveal index, обычный output и отсутствующие в списке файлы не получают индексное правило",
    async () => {
      await fixture(
        {
          "deck/index.html":
            '<html><body><div class="reveal"></div><script>Reveal.initialize({});</script></body></html>',
          "page.html": '<html><body><a href="deck/index.html#second">Страница</a></body></html>',
          "old.html": '<html><body><div class="reveal"></div><script>Reveal.initialize({});</script></body></html>',
          "index.html": "<html><body>Индекс</body></html>",
        },
        async (root, outputs) => {
          const untouched = await Deno.readTextFile(`${root}/page.html`);
          await addressNavigation(
            root,
            outputs.filter((p) => !p.endsWith("/old.html")),
          );
          assert.deepEqual(targets(await Deno.readTextFile(`${root}/index.html`)), ["deck/index.html"]);
          assert.ok(!(await Deno.readTextFile(`${root}/deck/index.html`)).includes('id="course-site-navigation"'));
          assert.equal(await Deno.readTextFile(`${root}/page.html`), untouched);
        },
      );
    },
  ],
];
let failures = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
if (failures) throw new Error(`Не прошли ${failures} HTML-проверок навигации`);
