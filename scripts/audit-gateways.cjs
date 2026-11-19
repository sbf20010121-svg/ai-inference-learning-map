const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
(async () => {
  const { lessons } = await import("../site/js/content.js");
  const { chaptersFor } = await import("../site/js/mechanism-curriculum.js");
  const b = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  let count = 0;
  const errors = [];
  const mathEvidence = [];
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
      const chapter = chaptersFor(id).find((c) => c.formula);
      assert.ok(chapter, `${id}: a formula chapter is required`);
      const hash = `#depth/${id}/L2/${chapter.id}`;
      await p.evaluate((hash) => (location.hash = hash), hash);
      // These selectors come from focus-reader.js. The URL alone can change
      // before hashchange has replaced the previous course's reader DOM.
      await p.waitForFunction(
        ({ id, chapter, figure, hash }) => {
          const reader = document.querySelector("#focusReader");
          return (
            location.hash === hash &&
            reader?.querySelector('.mechanism-catalog [data-dtopic][aria-current="true"]')?.dataset.dtopic === id &&
            reader?.querySelector('.mechanism-chapters [data-mech-chapter][aria-current="step"]')?.dataset.mechChapter === chapter &&
            reader?.querySelector(".mechanism-lab")?.dataset.mechanism === figure
          );
        },
        { id, chapter: chapter.id, figure: chapter.figure, hash },
      );
      const details = p.locator("#focusReader details.mechanism-math");
      assert.equal(await details.count(), 1, `${id}/${chapter.id}: one formula panel`);
      assert.equal(await details.evaluate((el) => el.open), false, `${id}/${chapter.id}: formula starts collapsed`);
      await details.locator(":scope > summary").click();
      await p.waitForSelector("#focusReader details.mechanism-math[open] .course-math math", { state: "visible" });
      const formulas = details.locator(".course-math math");
      const formulaCount = await formulas.count();
      assert.ok(formulaCount > 0, `${id}/${chapter.id}: rendered MathML is required`);
      for (let i = 0; i < formulaCount; i++) {
        assert.ok(await formulas.nth(i).isVisible(), `${id}/${chapter.id}: formula ${i} must be visible`);
        const box = await formulas.nth(i).boundingBox();
        assert.ok(box?.width > 0 && box?.height > 0, `${id}/${chapter.id}: formula ${i} needs visible geometry`);
      }
      await fit();
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await p.screenshot({
        path: `test-results/${width}-math-${id}.png`,
        fullPage: true,
      });
      mathEvidence.push({ width, course: id, chapter: chapter.id, formulas: formulaCount, expanded: true });
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
      mathScreenshots: mathEvidence.length,
      mathEvidence,
      errors,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
