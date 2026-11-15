// @ts-check
/* Реальное HTML-меню, тема и штатный Bootstrap после установленной композиции. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { loadPlaywright } = require("./playwright.cjs");
const { chromium } = loadPlaywright(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright")
    : "playwright",
);
const fixturePath = process.argv[2];
assert.ok(fixturePath, "Укажите путь установленной композиции");
const root = path.resolve(fixturePath);
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname).replace(
    /^\/courses\/security/,
    "",
  );
  let file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      new Map([
        [".html", "text/html; charset=utf-8"],
        [".css", "text/css"],
        [".js", "text/javascript"],
        [".svg", "image/svg+xml"],
      ]).get(path.extname(file)) || "application/octet-stream",
    );
    res.end(data);
  });
});
(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    browser = await chromium.launch({
      headless: true,
      ...(executablePath === undefined ? {} : { executablePath }),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    /** @type {string[]} */
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    /** @type {string[]} */
    const fonts = [];
    page.on("request", (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fonts.push(request.url());
    });
    for (const profile of ["student", "full"]) {
      const base = `http://127.0.0.1:${port}/courses/security/_site-${profile}/`;
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(base + "theory/nested/chapter.html", { waitUntil: "networkidle" });
      const rootLink = page.locator('[data-course-link="root"]');
      assert.equal(
        await rootLink.evaluate((node) => {
          if (!(node instanceof HTMLAnchorElement)) throw Error("Ожидалась HTML ссылка");
          return node.href;
        }),
        base,
      );
      assert.equal(await page.locator('[data-course-link][aria-current="page"]').count(), 1);
      assert.equal(await page.locator("#quarto-search").count(), 1);
      assert.match(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily), /system-ui/);
      await page.setViewportSize({ width: 320, height: 760 });
      const toggle = page.locator("#quarto-header .navbar-toggler");
      assert.equal(await toggle.isVisible(), true);
      await toggle.click();
      await page.locator("#navbarCollapse.show").waitFor();
      const slides = page.locator("[data-course-link]").filter({ hasText: "Занятия" });
      assert.equal(await slides.isVisible(), true);
      await slides.click();
      await page.waitForURL(base + "slides/");
      assert.equal(await page.locator('a[href$="lesson.html"]').getAttribute("target"), "_blank");
    }
    assert.deepEqual(fonts, []);
    assert.deepEqual(errors, []);
    console.log("PASS composed browser: поиск, активный раздел, Bootstrap 320 px, URL-префикс, тема без Google Fonts");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
