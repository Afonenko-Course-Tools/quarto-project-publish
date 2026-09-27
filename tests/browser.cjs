// Optional browser regression suite. Playwright is a development dependency;
// installing/using the Quarto extension still needs only Quarto itself.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  ({ chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright")));
}

const repo = path.resolve(__dirname, "..");
const quarto = process.env.QUARTO || "quarto";
const navigationPath = path.join(repo, "_extensions/reference-catalog/browser/navigation.js");
const book = `---
title: Disclosure regression
format: html
---

[Open answer](#sol-hidden){#open-answer}

::: {.callout-tip collapse="true"}
## Outer answer

<details id="nested-details"><summary>Inner answer</summary>

::: {#sol-hidden}
This answer has two closed ancestors.
:::

</details>
:::
`;
const slides = `---
title: Fragment regression
format:
  revealjs:
    hash: true
    transition: none
---

## Start {#sec-start}

::: {.fragment}
::: {#sol-zero}
First fragment; native index zero.
:::
:::

::: {.fragment}
Outer fragment.

::: {.fragment}
::: {#sol-nested}
Nested fragment.
:::
:::
:::

## Finish {#sec-finish}

Finished.
`;

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "qrc-browser-"));
  let browser, server;
  try {
    const script = await fs.readFile(navigationPath, "utf8");
    for (const [name, content] of [["book", book], ["slides", slides]]) {
      await fs.writeFile(path.join(root, `${name}.qmd`), content);
      const render = spawnSync(quarto, ["render", `${name}.qmd`, "--fail-if-warnings"], { cwd: root, encoding: "utf8" });
      assert.equal(render.status, 0, render.stdout + render.stderr);
      const output = path.join(root, `${name}.html`);
      const html = await fs.readFile(output, "utf8");
      await fs.writeFile(output, html.replace("</body>", `<script data-qrc-navigation>${script}</script></body>`));
    }
    server = http.createServer(async (req, res) => {
      try {
        const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
        if (!file.startsWith(root + path.sep)) throw new Error("outside fixture");
        const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(file)];
        if (mime) res.setHeader("Content-Type", mime);
        res.end(await fs.readFile(file));
      } catch { res.statusCode = 404; res.end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto(`${base}/book.html`);
    assert.equal(await page.locator("#nested-details").getAttribute("open"), null);
    assert.equal(await page.locator(".collapse.show").count(), 0);
    // Change the query too so this is an actual page arrival, not just a hash
    // transition within the already loaded page.
    await page.goto(`${base}/book.html?arrival=1#sol-hidden`);
    await page.waitForFunction(() => document.querySelector(".collapse.show") && document.querySelector("#nested-details").open);
    assert.equal(await page.locator('[aria-controls][aria-expanded="true"]').count(), 1);
    await page.evaluate(() => {
      document.querySelector("#nested-details").open = false;
      bootstrap.Collapse.getOrCreateInstance(document.querySelector(".collapse")).hide();
    });
    await page.waitForFunction(() => document.querySelector(".collapse:not(.show)") && !document.querySelector(".collapsing"));
    // The current URL already has this hash, so no hashchange is guaranteed.
    await page.locator("#open-answer").click();
    await page.waitForFunction(() => document.querySelector(".collapse.show") && document.querySelector("#nested-details").open);

    // The adapter is not coupled to Bootstrap's presence.
    await page.goto(`${base}/book.html`);
    await page.evaluate(() => { window.bootstrap = undefined; location.hash = "sol-hidden"; });
    await page.waitForFunction(() => document.querySelector(".collapse.show") && document.querySelector("#nested-details").open);
    assert.equal(await page.locator('[aria-controls][aria-expanded="true"]').count(), 1);

    await page.goto(`${base}/slides.html?qrc-target=sol-zero#/sec-start`);
    await page.waitForFunction(() => window.Reveal?.isReady() && Reveal.getIndices().f === 0);
    assert.equal(await page.locator("#sol-zero").evaluate(node => node.closest(".fragment").classList.contains("visible")), true);
    assert.equal(await page.locator("#sol-nested").evaluate(node => node.closest(".fragment").classList.contains("visible")), false);
    await page.goto(`${base}/slides.html?qrc-target=sol-nested#/sec-start`);
    await page.waitForFunction(() => window.Reveal?.isReady() && Reveal.getIndices().f === 2);
    assert.equal(await page.locator("#sol-nested").evaluate(node => {
      for (let parent = node; parent; parent = parent.parentElement)
        if (parent.matches(".fragment") && !parent.classList.contains("visible")) return false;
      return true;
    }), true);
    await page.evaluate(() => Reveal.next());
    await page.waitForFunction(() => Reveal.getCurrentSlide().id === "sec-finish");
    // Flush animation/hash events: the stale qrc-target must never pull us back.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => Reveal.getCurrentSlide().id), "sec-finish");
    assert.deepEqual(errors, []);
    console.log("PASS browser: native HTML collapse + details, same-hash reopening, no-Bootstrap fallback, Reveal index zero + nested fragments, Next after a deep link");
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
