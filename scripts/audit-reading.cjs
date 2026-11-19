/* Reader checks use only an isolated browser profile and synthetic course visits. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { allCourses } = await import("../site/js/course-registry.js");
  const { chaptersFor } = await import("../site/js/mechanism-curriculum.js");
  const { teachingCourses } = await import("../site/js/teaching-courses.js");
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const base = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
  const report = { courseViews: 0, visibleSections: 0, mathPanels: 0, staticFigures: 0, widths: [1365, 390, 360], navigation: [], screenshots: [], errors: [], contentCapture: "Content element images temporarily hide the fixed topbar; viewport and focus checks keep the actual topbar." };
  const snapshots = new Set(["token-embedding", "linear-state", "vllm-scheduler", "ir-ssa", "compiler-lowering", "attention-tiling", "warp-issue", "world-model", "pd-disagg", "tensor-address"]);
  fs.mkdirSync("test-results", { recursive: true });
  try {
    for (const width of report.widths) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
      for (const course of allCourses) {
        await page.goto(`${base}#depth/${course.id}/L2`);
        await page.waitForSelector(".learning-article");
        const chapters = chaptersFor(course.id);
        assert.equal(await page.locator(".learning-section").count(), chapters.length, `${width}/${course.id}: complete course`);
        assert.ok(await page.locator(".learning-prerequisites").isVisible(), course.id + ": prerequisites in the reading path");
        assert.equal(await page.locator("#optionalMechanism").evaluate(panel => panel.open), false, course.id + ": experiment optional");
        assert.equal(await page.locator(".learning-article [data-mech-key]").count(), 0, course.id + ": static reading has no parameter controls");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${course.id}: reading overflow`);
        const math = await page.locator(".learning-article .learning-equation").evaluateAll(panels => panels.map(panel => {
          const formula = panel.querySelector("math"), scroller = panel.querySelector(".learning-math"), box = scroller?.getBoundingClientRect();
          return { native: formula?.namespaceURI === "http://www.w3.org/1998/Math/MathML", height: formula?.getBoundingClientRect().height, variables: panel.querySelectorAll(".learning-variables dt").length, fits: box && box.left >= 0 && box.right <= innerWidth + 1 };
        }));
        for (const panel of math) assert.ok(panel.native && panel.height > 10 && panel.variables && panel.fits, `${width}/${course.id}: rendered mathematics and adjacent variables`);
        const ticksFit = await page.locator('.learning-static-mechanism .mech-time-axis small').evaluateAll(ticks => ticks.every(tick => tick.getBoundingClientRect().height <= 1.6 * parseFloat(getComputedStyle(tick).fontSize)));
        assert.ok(ticksFit, `${width}/${course.id}: timeline labels stay on one line`);
        const ids = await page.locator("[id]").evaluateAll(nodes => nodes.map(n => n.id));
        assert.equal(new Set(ids).size, ids.length, `${width}/${course.id}: duplicate DOM identities`);
        report.courseViews++;
        report.visibleSections += chapters.length;
        report.mathPanels += math.length;
        report.staticFigures += await page.locator(".learning-static-mechanism").count();
        if (width !== 390 && snapshots.has(course.id)) {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          const intro = `v7-reading-${course.id}-intro-${width}.png`;
          await page.locator("#learningCourseStart").screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/${intro}` });
          report.screenshots.push(intro);
          const withMath = chapters.find(ch => teachingCourses[course.id].chapters[ch.id].blocks.some(block => block.type === "math"));
          const representative = withMath || chapters[0];
          const file = `v7-reading-${course.id}-${representative.id}-${width}.png`;
          await page.locator(`[data-learning-chapter="${representative.id}"]`).screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/${file}` });
          report.screenshots.push(file);
        }
        if (width !== 390 && course.module === "model") {
          for (const chapter of chapters.filter(ch => teachingCourses[course.id].chapters[ch.id].blocks.some(block => block.type === "figure"))) {
            const file = `v7-model-figure-${course.id}-${chapter.id}-${width}.png`;
            await page.locator(`[data-learning-chapter="${chapter.id}"]`).screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/${file}` });
            report.screenshots.push(file);
          }
        }
      }
      await page.goto(`${base}#depth/vllm-scheduler/L2`);
      await page.waitForSelector(".learning-contents");
      await page.locator('[data-mech-chapter="rounds"]').click();
      assert.equal(await page.locator(".learning-section").count(), chaptersFor("vllm-scheduler").length, "navigation must not hide the rest of the course");
      const focus = await page.locator("#mechanismQuestion").evaluate(el => ({ active: document.activeElement === el, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, numberTop: el.closest(".learning-section").querySelector(".learning-section-number").getBoundingClientRect().top, header: document.querySelector(".topbar").getBoundingClientRect().bottom }));
      assert.ok(focus.active && focus.top >= focus.header && focus.bottom < 1000, `${width}: chapter focus remains visible`);
      assert.ok(focus.numberTop >= focus.header, `${width}: the chapter number is also below the fixed header`);
      await page.screenshot({ path: `test-results/v7-reading-navigation-viewport-${width}.png`, fullPage: false });
      await page.locator('[data-open-chapter-experiment="budget"]').click();
      assert.equal(await page.locator("#optionalMechanism").evaluate(panel => panel.open), true);
      assert.equal(await page.locator(".mechanism-lab").getAttribute("data-mechanism"), "scheduler-budget");
      await page.locator('.mechanism-lab [data-mech-key="budget"][data-mech-value="4"]').click();
      assert.equal(await page.locator("#optionalMechanism").evaluate(panel => panel.open), true, "changing a condition preserves the open appendix");
      assert.equal(await page.locator('.mechanism-lab [data-scheduler-summary]').getAttribute("data-used"), "4");
      await page.locator('[data-reading-top]').click();
      assert.ok(await page.locator("#learningCourseStart h1").evaluate(el => document.activeElement === el));
      report.navigation.push({ width, chaptersRemainVisible: true, focus, optionalExperiment: true });
      await page.locator("#themeToggle").click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "dark reader overflow");
      await page.locator("#learningCourseStart").screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/v7-reading-dark-${width}.png` });
      for (const chapter of ["budget", "runner"]) {
        await page.locator(`[data-learning-chapter="${chapter}"]`).screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/v7-reading-dark-${chapter}-${width}.png` });
      }
      await page.goto(`${base}#depth/vision-patches/L2`);
      await page.waitForSelector('[data-learning-chapter="patches"]');
      await page.locator('[data-learning-chapter="patches"]').screenshot({ style: ".topbar { visibility: hidden !important; }", path: `test-results/v7-reading-dark-vision-patches-${width}.png` });
      await page.goto(`${base}#curriculum/compiler`);
      await page.locator(".learning-foundations-guide>summary").click();
      await page.locator(".learning-foundation-item>summary").first().click();
      assert.ok(await page.locator(".learning-foundation-item .learning-prose").first().isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "foundation guide overflow");
      await context.close();
    }
    assert.deepEqual(report.errors, []);
    fs.writeFileSync("test-results/reading-audit.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
