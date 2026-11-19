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
  const errors = [], report = { coursesRoundTrip: 0, mobileCourseRoundTrip: 0, stages: 0, traceBranches: 0, widths: [1365, 390, 360], focus: [], scheduler: [], schedulerLegacy: [], schedulerGallery: [], errors };
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
        const labels = page.locator(".spine-map-svg .node-sub");
        if (await labels.count()) {
          const renderedSize = await labels.first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) * Math.abs(el.getScreenCTM().a));
          assert.ok(renderedSize >= 12, `${width}/${stage.id}: diagram labels must remain readable`);
        }
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
      if (width !== 1365) {
        await page.goto(`${base}#spine/request`);
        await page.locator('.spine-detail [data-spine-open-course="request-lifecycle"]').click();
        await page.waitForSelector("#focusReader");
        await page.locator(".course-orientation [data-spine-stage]").click();
        await page.waitForSelector("#spineStageHeading");
        assert.ok(await page.locator(".top-nav").isVisible(), `${width}: mobile navigation must return after leaving the reader`);
        await checkWidth("mobile-course-return");
        report.mobileCourseRoundTrip++;
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
        await page.waitForFunction(title => document.querySelector("#spineStageHeading")?.textContent === title, systemSpineStages.find(stage => stage.id === id).title);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `test-results/v6-spine-${id}-${width}.png`, fullPage: true });
      }
      await page.locator('.spine-modes a[href="#spine/compile-source"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => location.hash === "#spine/compile-source" && document.activeElement?.id === "spineOverviewHeading");
      assert.equal(await page.locator("#spineOverviewHeading").evaluate(el => el === document.activeElement), true);
      const focusBox = await page.locator("#spineOverviewHeading").boundingBox();
      assert.ok(focusBox.y >= 0 && focusBox.y + focusBox.height <= 950, "mode navigation focus must be visible");
      await page.locator('.spine-stage-nav a[href="#spine/compile-lower"]').click();
      await page.waitForFunction(() => document.activeElement?.id === "spineStageHeading");
      const detailBox = await page.locator("#spineStageHeading").boundingBox();
      const headerBox = await page.locator(".topbar").boundingBox();
      await page.screenshot({ path: `test-results/v6-spine-stage-focus-${width}.png` });
      report.focus.push({ width, headerBottom: headerBox.y + headerBox.height, headingTop: detailBox.y, headingBottom: detailBox.y + detailBox.height });
      assert.ok(detailBox.y >= headerBox.y + headerBox.height && detailBox.y + detailBox.height <= 950, `${width}: stage navigation focus must be visible; ${JSON.stringify(report.focus.at(-1))}`);
      await page.locator("#themeToggle").click();
      await checkWidth("dark");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
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
        await page.locator("#optionalMechanism").evaluate(panel => { panel.open = true; });
        if (width === 360) {
          const records = page.locator(".mechanism-lab .es-record-list");
          if (await records.count()) {
            assert.ok(await records.isVisible(), `${route}: mobile records must be displayed`);
            const fieldsFit = await records.locator("dd").evaluateAll(fields => fields.length > 0 && fields.every(el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= innerWidth + 1; }));
            assert.ok(fieldsFit, `${route}: every mobile record value must be horizontally visible`);
          }
          if (route === "serving-slo/metrics") {
            const renderedSize = await page.locator(".mechanism-lab .es-wide-scroll svg text").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) * Math.abs(el.getScreenCTM().a));
            assert.ok(renderedSize >= 12, "mobile SLO timestamps must retain readable text");
          }
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.locator(`[data-learning-chapter="${chapter}"]`).screenshot({ path: `test-results/v7-lesson-${course}-${chapter}-${width}.png` });
      }
    }
    await context.close();
    // Check the teaching state, not merely whether a button changed a caption.
    for (const width of [1365, 360]) {
      const schedulerContext = await browser.newContext({ viewport: { width, height: 1000 } });
      const schedulerPage = await schedulerContext.newPage();
      schedulerPage.on("pageerror", e => errors.push(`scheduler/${width}: ${e.message}`));
      const choose = async (key, value) => {
        const button = schedulerPage.locator(`.mechanism-lab [data-mech-key="${key}"][data-mech-value="${value}"]`);
        if (await button.getAttribute("aria-pressed") !== "true") await button.click();
      };
      const open = async (chapter) => {
        await schedulerPage.goto(`${base}#depth/vllm-scheduler/L2/${chapter}`);
        const expected = chaptersFor("vllm-scheduler").find(ch => ch.id === chapter);
        await schedulerPage.waitForFunction(([id, figure]) => document.querySelector('[data-mech-chapter][aria-current="step"]')?.dataset.mechChapter === id && document.querySelector(".mechanism-lab")?.dataset.mechanism === figure, [chapter, expected.figure]);
        await schedulerPage.locator("#optionalMechanism").evaluate(panel => { panel.open = true; });
        await choose("budget", 8);
        await choose("capacity", 16);
        await choose("round", 0);
        const view = schedulerPage.locator(`.mechanism-lab [data-scheduler-view="${expected.figure}"]`);
        await view.waitFor({ state: "visible" });
        const intro = schedulerPage.locator(".mechanism-lab .scheduler-scenario");
        assert.ok(await intro.isVisible(), `${width}/${chapter}: initial request identities must be visible`);
        const introText = await intro.innerText();
        for (const identity of ["A", "B", "C"]) assert.ok(introText.includes(identity), `${width}/${chapter}: request ${identity} must be introduced`);
        for (const initialCount of ["6", "4"]) assert.ok(introText.includes(initialCount), `${width}/${chapter}: the initial prompt counts must be stated`);
        assert.ok(await intro.evaluate(el => !!(el.compareDocumentPosition(el.closest(".mechanism-lab").querySelector(".mech-figure")) & Node.DOCUMENT_POSITION_FOLLOWING)), `${width}/${chapter}: setup must come before the calculation figure`);
        return view;
      };
      const summary = async (view, expected, label) => {
        const result = await view.locator("[data-scheduler-summary]").evaluate(el => ({ used: +el.dataset.used, left: +el.dataset.left, free: +el.dataset.free }));
        assert.deepEqual(result, expected, `${width}/${label}: rendered budget/KV result`);
        assert.ok(await view.locator("[data-scheduler-summary]").isVisible(), `${width}/${label}: counters must be readable`);
        report.scheduler.push({ width, case: label, ...result });
      };
      const states = async (view, phase) => view.locator(`[data-scheduler-request][data-phase="${phase}"]`).evaluateAll(rows => rows.map(el => ({ id: el.dataset.schedulerRequest, computed: +el.dataset.computed, promptPending: +el.dataset.promptPending, blocks: +el.dataset.blocks })));
      const screenshot = async (label) => {
        assert.equal(await schedulerPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/scheduler/${label}: page overflow`);
        await schedulerPage.waitForFunction(() => !document.querySelector("#toast") || getComputedStyle(document.querySelector("#toast")).opacity === "0");
        await schedulerPage.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        const panel = await schedulerPage.locator("#focusPanel").count() ? schedulerPage.locator("#focusPanel") : schedulerPage.locator(".mg-lab");
        await panel.screenshot({ path: `test-results/v7-scheduler-${label}-${width}.png` });
      };
      let view = await open("requests");
      assert.deepEqual(await states(view, "before"), [{ id: "A", computed: 6, promptPending: 0, blocks: 2 }, { id: "B", computed: 0, promptPending: 6, blocks: 0 }, { id: "C", computed: 0, promptPending: 4, blocks: 0 }]);
      assert.deepEqual(await states(view, "after"), [{ id: "A", computed: 7, promptPending: 0, blocks: 2 }, { id: "B", computed: 6, promptPending: 0, blocks: 2 }, { id: "C", computed: 1, promptPending: 3, blocks: 1 }]);
      await summary(view, { used: 8, left: 0, free: 11 }, "initial-requests");
      await screenshot("requests");

      view = await open("budget");
      const grants = async () => view.locator("[data-scheduler-decision]").evaluateAll(rows => rows.map(el => [el.dataset.schedulerDecision, +el.dataset.granted]));
      assert.deepEqual(await grants(), [["A", 1], ["B", 6], ["C", 1]], "budget8 must expose each allocation");
      await screenshot("budget");
      await choose("budget", 4);
      assert.deepEqual(await grants(), [["A", 1], ["B", 3], ["C", 0]], "budget4 must leave C unscheduled");
      await summary(view, { used: 4, left: 0, free: 13 }, "budget4");

      view = await open("kv");
      await choose("capacity", 2);
      assert.deepEqual(await grants(), [["A", 1], ["B", 0], ["C", 0]], "KV capacity can stop B/C while compute budget remains");
      await summary(view, { used: 1, left: 7, free: 0 }, "kv2-first-round");
      await screenshot("kv-limited");
      await choose("round", 2);
      assert.equal(await view.getAttribute("data-round"), "3");
      await summary(view, { used: 0, left: 8, free: 0 }, "kv2-third-round");

      view = await open("rounds");
      const firstRoundState = await states(view, "before");
      await choose("round", 1);
      assert.equal(await view.getAttribute("data-round"), "2");
      assert.notDeepEqual(await states(view, "before"), firstRoundState, "changing round must change its input state");
      assert.deepEqual(await states(view, "before"), [{ id: "A", computed: 7, promptPending: 0, blocks: 2 }, { id: "B", computed: 6, promptPending: 0, blocks: 2 }, { id: "C", computed: 1, promptPending: 3, blocks: 1 }]);
      assert.deepEqual(await states(view, "after"), [{ id: "A", computed: 8, promptPending: 0, blocks: 2 }, { id: "B", computed: 7, promptPending: 0, blocks: 2 }, { id: "C", computed: 4, promptPending: 0, blocks: 1 }]);
      await summary(view, { used: 5, left: 3, free: 11 }, "second-round");
      await screenshot("rounds");

      view = await open("runner");
      await summary(view, { used: 8, left: 0, free: 11 }, "packed-input");
      const packed = await view.innerText();
      for (const label of ["A@p6", "B@p0", "B@p5", "C@p0"]) assert.ok(packed.includes(label), `${width}: packed input must retain ${label}`);
      await screenshot("runner");

      // The old compact export is retained for compatibility but has no current
      // navigation entry. Render it with the site's real CSS, and label the
      // evidence as a component audit rather than a user-navigation test.
      for (const [step, expected] of [[0, [0, 0, 0, 8]], [2, [1, 1, 3, 3]], [3, [1, 1, 1, 5]]]) {
        await schedulerPage.evaluate(async (step) => {
          const { mechanismFigure } = await import("./js/mechanism-studio.js");
          document.querySelector("#focusPanel").innerHTML = '<h2 id="legacyExperimentQuestion">兼容机制图组件验收 · 主课程同一示例</h2>' + mechanismFigure("vllm-scheduler", step, 0);
        }, step);
        const component = schedulerPage.locator("#focusPanel .m16-compact-figure");
        assert.ok(await component.isVisible());
        const setup = component.locator(".m16-figure-caption").first();
        assert.match(await setup.innerText(), /A\/B\/C 是请求编号/);
        assert.match(await setup.innerText(), /6\/4/);
        assert.ok(await setup.evaluate(el => !!(el.compareDocumentPosition(el.closest(".m16-compact-figure").querySelector(".m16-round")) & Node.DOCUMENT_POSITION_FOLLOWING)), "legacy setup must precede its allocation grid");
        const cells = [];
        for (const name of ["a", "b", "c", "free"]) cells.push(await component.locator(`.m16-slot.m16-${name}`).count());
        assert.deepEqual(cells, expected, `${width}/legacy step${step}: request allocation and unused slots`);
        assert.equal(await component.locator(".m16-slot").count(), 8);
        report.schedulerLegacy.push({ width, mode: "component", step, allocations: cells.slice(0, 3), unused: cells[3] });
        await screenshot(`legacy-component-step${step}`);
      }

      // The gallery is an independently labelled C=9 scenario, reached through
      // its real route and operated using its public controls.
      await schedulerPage.goto(`${base}#network/studio/scheduler`);
      await schedulerPage.waitForFunction(() => document.querySelector("#netStudioSelect")?.value === "scheduler" && !!document.querySelector(".mg-lab"));
      const gallery = schedulerPage.locator(".mg-lab");
      const gallerySetup = gallery.locator('[data-scheduler-scenario="independent-two-decode"]');
      assert.ok(await gallerySetup.isVisible());
      assert.match(await gallerySetup.innerText(), /独立对照示例/);
      assert.match(await gallerySetup.innerText(), /9 位置/);
      assert.match(await gallerySetup.innerText(), /A\/B 都已完成输入/);
      assert.ok(await gallerySetup.evaluate(el => !!(el.compareDocumentPosition(el.closest(".mg-lab").querySelector(".mg-figure")) & Node.DOCUMENT_POSITION_FOLLOWING)), "independent setup must precede its figure");
      for (const [step, expected, remaining] of [[0, [0, 0, 0, 8], 9], [1, [1, 1, 6, 0], 3]]) {
        await gallery.locator(`[data-gallery-step="${step}"]`).click();
        assert.equal(await gallery.locator(`[data-gallery-step="${step}"]`).getAttribute("aria-pressed"), "true");
        const cells = [];
        for (const owner of ["A", "B", "C", "free"]) cells.push(await gallery.locator(`.mg-budget-cell.mg-owner-${owner}`).count());
        assert.deepEqual(cells, expected, `${width}/gallery step${step}: preserve independent request allocations`);
        assert.match(await gallery.locator(".mg-scheduler-rows > div").nth(2).locator("small").innerText(), new RegExp(`输入剩余 ${remaining} 个位置`));
        report.schedulerGallery.push({ width, mode: "navigation", step, allocations: cells.slice(0, 3), unused: cells[3], promptRemaining: remaining });
        await screenshot(`gallery-step${step}`);
      }
      await schedulerContext.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync("test-results/system-spine-audit.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
