/* Run with PLAYWRIGHT_MODULE_PATH when Playwright is installed outside this checkout. */
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const { depthTopics } = await import("../site/js/depth-content.js");
  const { courseNotes } = await import("../site/js/course-notes.js");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  const base = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
  const out = path.resolve("test-results");
  fs.mkdirSync(out, { recursive: true });
  const errors = [],
    results = [];
  let views = 0,
    actions = 0;
  const fixture = {
    format: "ai-inference-learning-map-progress",
    version: 1,
    progress: {
      "compiler-chain": {
        status: "known",
        notes: "兼容性测试笔记：编译路径",
        quizPassed: true,
      },
    },
    depthProgress: {
      "linear-state": {
        status: "known",
        note: "兼容性测试反馈：机制仍需验证",
        completed: ["L2"],
        readerStep: 4,
        readerSubstep: 2,
        seenSteps: [0, 1, 2, 3, 4],
        seenSubsteps: [0, 1, 2, 3],
      },
    },
    knowledgeGraph: {
      version: 1,
      nodes: [
        {
          id: "mine-fixture",
          title: "测试关联",
          summary: "兼容性测试记录",
          module: "model",
          status: "not-verified",
          source: "",
        },
      ],
      edges: [
        {
          id: "mine-edge",
          from: "mine-fixture",
          to: "linear-state",
          type: "extends",
          why: "测试进度导入导出保留",
        },
      ],
    },
  };
  for (const width of [1365, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      errors.push(`${width}: ${e.message}`);
      console.error("PAGEERROR", e.message);
    });
    await page.goto(base);
    await page.waitForSelector("#moduleNav button");
    await page
      .locator("#importFile")
      .setInputFiles({
        name: "old-progress.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture)),
      });
    await page.waitForFunction(() =>
      JSON.parse(
        localStorage.getItem("ai-inference-depth-progress-v1") || "{}",
      )["linear-state"]?.note?.includes("兼容性测试"),
    );
    const noOverflow = async (where) => {
      const info = await page.evaluate(() => ({
        w: document.documentElement.clientWidth,
        s: document.documentElement.scrollWidth,
      }));
      assert.ok(
        info.s <= info.w + 2,
        `${width}/${where}: overflow ${info.s}>${info.w}`,
      );
      views++;
    };
    for (const t of depthTopics) {
      await page.evaluate((id) => {
        location.hash = `depth/${id}/L2`;
      }, t.id);
      await page.waitForFunction(
        (title) =>
          document.querySelector(".focus-header h1")?.textContent === title,
        t.title,
      );
      for (let p = 0; p < 7; p++) {
        await page.locator(`[data-f-page="${p}"]`).click();
        actions++;
        await noOverflow(`${t.id}/${p}`);
        if (p === 1) {
          for (let s = 0; s < 4; s++) {
            await page.locator(`[data-f-sub="${s}"]`).click();
            actions++;
            await noOverflow(`${t.id}/step${s}`);
          }
          const before = await page.locator("#focusPanel").innerText();
          await page.locator('[data-course-scenario="1"]').click();
          actions++;
          const after = await page.locator("#focusPanel").innerText();
          // A single frame can be invariant; compare all four in the changed condition.
          const changed = [];
          for (let s = 0; s < 4; s++) {
            await page.locator(`[data-f-sub="${s}"]`).click();
            changed.push(
              await page.locator(".course-figure").first().innerText(),
            );
            actions++;
          }
          await page.locator('[data-course-scenario="0"]').click();
          const original = [];
          for (let s = 0; s < 4; s++) {
            await page.locator(`[data-f-sub="${s}"]`).click();
            original.push(
              await page.locator(".course-figure").first().innerText(),
            );
            actions++;
          }
          assert.notDeepEqual(
            changed,
            original,
            `${t.id}: no observable change`,
          );
          await noOverflow(`${t.id}/changed`);
        }
        if (p === 2) {
          assert.ok((await page.locator("#focusPanel math").count()) > 0);
          assert.equal(await page.locator("merror").count(), 0);
        }
        if (p === 2 || p === 6) {
          await page.locator('[data-course-scenario="0"]').click();
          const before = await page
            .locator(".course-figure")
            .first()
            .innerText();
          await page.locator('[data-course-scenario="1"]').click();
          assert.notEqual(
            await page.locator(".course-figure").first().innerText(),
            before,
            `${t.id}/page${p} inert condition`,
          );
          actions += 2;
        }
        if (p === 3) {
          await page
            .locator(`[data-f-answer="${courseNotes[t.id].correct}"]`)
            .click();
          await page.waitForSelector(".focus-check-feedback");
          actions++;
        }
      }
      results.push({ width, id: t.id, phases: 7, mechanismSteps: 4 });
    }
    // Inspect representative desktop and mobile views in both themes.
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (th) => (document.documentElement.dataset.theme = th),
        theme,
      );
      for (const id of [
        "linear-state",
        "compiler-lowering",
        "memory-route",
        "world-model",
      ]) {
        await page.evaluate((id) => {
          location.hash = `depth/${id}/L2`;
        }, id);
        await page.waitForFunction((id) => location.hash.includes(id), id);
        await page.locator('[data-f-page="1"]').click();
        await page.locator('[data-f-sub="1"]').click();
        await page
          .locator("#focusReader")
          .screenshot({ path: path.join(out, `${width}-${theme}-${id}.png`) });
        await noOverflow(`${id}/${theme}`);
      }
    }
    await page.evaluate(() => (location.hash = "depth/linear-state/L2"));
    await page.locator('[data-f-page="4"]').click();
    await page.locator(".focus-notes summary").click();
    assert.equal(
      await page.locator("#focusNote").inputValue(),
      fixture.depthProgress["linear-state"].note,
    );
    await page.reload();
    await page.waitForSelector("#focusNote", { state: "attached" });
    assert.equal(
      await page.locator("#focusNote").inputValue(),
      fixture.depthProgress["linear-state"].note,
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ai-inference-depth-progress-v1"))[
            "linear-state"
          ].status,
      ),
      "known",
    );
    // Download without touching any real browser profile or live private sync.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportBtn").click(),
    ]);
    const payload = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(
      payload.depthProgress["linear-state"].note,
      fixture.depthProgress["linear-state"].note,
    );
    assert.equal(payload.depthProgress["linear-state"].status, "known");
    assert.equal(
      payload.progress["compiler-chain"].notes,
      fixture.progress["compiler-chain"].notes,
    );
    assert.equal(payload.knowledgeGraph.nodes[0].id, "mine-fixture");
    await page
      .locator("#importFile")
      .setInputFiles({
        name: "roundtrip.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(payload)),
      });
    await page
      .locator("#importFile")
      .setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{bad"),
      });
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("导入失败"),
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("ai-inference-depth-progress-v1"))[
            "linear-state"
          ].note,
      ),
      fixture.depthProgress["linear-state"].note,
    );
    await page.evaluate(() => (location.hash = "map"));
    await page.waitForSelector("#mapView:not([hidden])");
    if (width === 1365) {
      const before = await page.locator("#zoomDisplay").innerText();
      await page.locator("#zoomIn").click();
      assert.notEqual(await page.locator("#zoomDisplay").innerText(), before);
      await page.locator("#zoomOut").click();
    } else
      assert.equal(await page.locator("#mobileNodeList button").count(), 6);
    await page.locator("#mapSearch").fill("VLA");
    await page.locator("#mapSearch").fill("");
    await page.locator("#themeToggle").focus();
    await page.keyboard.press("Enter");
    await noOverflow("map");
    await context.close();
  }
  await browser.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "browser-audit.json"),
    JSON.stringify({ views, actions, errors, results }, null, 2),
  );
  console.log(
    JSON.stringify({
      views,
      actions,
      errors,
      topics: depthTopics.length,
      widths: [1365, 390],
      screenshots: 16,
      progressRoundTrip: "passed",
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
