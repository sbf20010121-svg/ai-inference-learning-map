const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
(async () => {
  const { lessons } = await import("../site/js/content.js");
  const b = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  let count = 0;
  const errors = [];
  for (const width of [1365, 360]) {
    const p = await b.newPage({ viewport: { width, height: 950 } });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5173/");
    const fit = async () => {
      assert.ok(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 2,
        ),
      );
    };
    for (const l of lessons) {
      await p.evaluate((id) => (location.hash = `lesson/${id}`), l.id);
      await p.waitForSelector("#stepper");
      for (let step = 0; step < l.steps.length; step++) {
        await p.locator(`[data-step="${step}"]`).click();
        await p.waitForSelector("#stepDetail .course-figure");
        await fit();
        count++;
      }
      await p.locator("#stepDetail [data-godepth]").click();
      await p.waitForSelector("#focusReader");
      await fit();
    }
    for (const id of [
      "mla-kv",
      "attention-tiling",
      "fused-norm",
      "linear-state",
    ]) {
      await p.evaluate((id) => (location.hash = `depth/${id}/L2`), id);
      const {chaptersFor}=await import('../site/js/mechanism-curriculum.js');
      const chapter=chaptersFor(id).find(c=>c.formula);
      await p.locator(`[data-mech-chapter="${chapter.id}"]`).click();
      await fit();
      await p.screenshot({
        path: `test-results/${width}-math-${id}.png`,
        fullPage: true,
      });
    }
    await p.evaluate(() => (location.hash = "map"));
    await p.waitForSelector("#mapView:not([hidden])");
    if (width === 1365) {
      const node = p.locator("#knowledgeGraph [data-node]").first();
      await node.focus();
      await p.keyboard.press("Enter");
      assert.ok(await p.locator("#inspector").innerText());
    }
    await p.close();
  }
  await b.close();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      overviewSteps: count,
      widths: [1365, 360],
      mathScreenshots: 8,
      errors,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
