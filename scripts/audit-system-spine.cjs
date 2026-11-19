/* Isolated browser, synthetic records only; no sign-in or private sync. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { allCourses } = await import("../site/js/course-registry.js");
  const { chaptersFor } = await import("../site/js/mechanism-curriculum.js");
  const { systemSpineStages, spineStageForCourse } = await import("../site/js/system-spine.js");
  const base = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [], report = { coursesRoundTrip: 0, stages: 0, traceBranches: 0, widths: [1365, 390, 360], errors };
  fs.mkdirSync("test-results", { recursive: true });
  try {
    for (const width of report.widths) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(`${width}: ${e.message}`));
      const checkWidth = async (where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${where}: page overflow`);
      for (const stage of systemSpineStages) {
        await page.goto(`${base}#spine/${stage.id}`);
        await page.waitForFunction(title => document.querySelector("#spineStageHeading")?.textContent === title, stage.title);
        assert.equal(await page.locator("#spineStageHeading").innerText(), stage.title);
        await checkWidth(stage.id);
        report.stages++;
      }
      if (width === 1365) for (const c of allCourses) {
        const stage = spineStageForCourse(c.id);
        await page.goto(`${base}#spine/${stage}`);
        const link = page.locator(`[data-spine-open-course="${c.id}"]`).first();
        if (!(await link.isVisible())) await page.locator(".spine-more summary").click();
        await link.click();
        await page.waitForSelector("#mechanismQuestion");
        assert.ok(page.url().includes(`#depth/${c.id}/`), `${c.id}: course link opened wrong route`);
        await page.locator(".course-orientation [data-spine-stage]").click();
        await page.waitForSelector("#spineStageHeading");
        assert.ok(page.url().endsWith(`#spine/${stage}`), `${c.id}: return went to wrong stage`);
        report.coursesRoundTrip++;
      }
      await page.goto(`${base}#spine/sample`);
      for (const scenario of ["length", "eos", "cancel"]) {
        await page.locator(`[data-spine-trace-case="${scenario}"]`).click();
        assert.match(await page.locator(".spine-trace-event").innerText(), /采样/);
        let previous = await page.locator(".spine-trace-event").innerText();
        let clicks = 0;
        while (await page.getByRole("button", { name: "下一步 →", exact: true }).isEnabled()) {
          await page.getByRole("button", { name: "下一步 →", exact: true }).click();
          const current = await page.locator(".spine-trace-event").innerText();
          assert.notEqual(current, previous, `${scenario}: dead step control`);
          previous = current;
          assert.ok(++clicks < 20);
          await checkWidth(`trace/${scenario}/${clicks}`);
        }
        assert.match(previous, /回收独占槽/);
        assert.match(await page.locator(".spine-trace-ledger").innerText(), /持有槽位 0/);
        report.traceBranches++;
      }
      for (const id of ["request", "compile-source", "workload-vla"]) {
        await page.goto(`${base}#spine/${id}`);
        await page.waitForSelector("#spineStageHeading");
        await page.screenshot({ path: `test-results/v6-spine-${id}-${width}.png`, fullPage: true });
      }
      await page.locator('.spine-modes a[href="#spine/compile-source"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => location.hash === "#spine/compile-source");
      assert.equal(await page.locator("#spineOverviewHeading").evaluate(el => el === document.activeElement), true);
      const focusBox = await page.locator("#spineOverviewHeading").boundingBox();
      assert.ok(focusBox.y >= 0 && focusBox.y + focusBox.height <= 950, "mode navigation focus must be visible");
      await page.locator('.spine-stage-nav a[href="#spine/compile-lower"]').click();
      await page.waitForFunction(() => document.activeElement?.id === "spineStageHeading");
      const detailBox = await page.locator("#spineStageHeading").boundingBox();
      assert.ok(detailBox.y >= 70 && detailBox.y + detailBox.height <= 950, "stage navigation focus must be visible");
      await page.locator("#themeToggle").click();
      await checkWidth("dark");
      await page.screenshot({ path: `test-results/v6-spine-dark-${width}.png`, fullPage: true });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    const routes = [
      "transformer-layer/residual", "transformer-layer/axes", "token-embedding/head", "vision-patches/projection",
      "generation-state/positions", "sampling-distribution/nucleus", "attention-patterns/implementation", "linear-state/correction", "linear-state/triangle", "moe-route/grouped",
      "compiler-lowering/ir", "ir-ssa/values", "fusion-legality/precision", "buffer-liveness/bufferize", "engine-build/runtime", "fused-norm/fusion",
      "request-lifecycle/cancel", "async-engine/overlap", "warp-issue/resources", "serving-slo/metrics", "vllm-scheduler/runner", "memory-route/shared", "paged-attention-kernel/compute", "paged-attention-kernel/tail", "profiling/evidence", "convolution-lowering/window",
    ];
    for (const width of [1365, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        const [course, chapter] = route.split("/");
        await page.goto(`${base}#depth/${course}/L2/${chapter}`);
        const expected = chaptersFor(course).find(ch => ch.id === chapter);
        await page.waitForFunction(([id, figure]) => document.querySelector('[data-mech-chapter][aria-current="step"]')?.dataset.mechChapter === id && document.querySelector(".mechanism-lab")?.dataset.mechanism === figure, [chapter, expected.figure]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${route}: screenshot route overflow`);
        await page.screenshot({ path: `test-results/v6-lesson-${course}-${chapter}-${width}.png`, fullPage: true });
      }
    }
    await context.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync("test-results/system-spine-audit.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
