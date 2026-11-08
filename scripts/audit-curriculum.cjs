/* Independent browser profile; synthetic records only. Never logs into private sync. */
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const { allCourses: depthTopics, foundationById } = await import(
    "../site/js/course-registry.js"
  );
  const { chaptersFor } = await import("../site/js/mechanism-curriculum.js");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
  const base = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
  const errors = [],
    results = [],
    unchanged = [];
  let views = 0,
    actions = 0;
  fs.mkdirSync("test-results", { recursive: true });
  const old = {
    status: "known",
    note: "合成反馈：保留机制疑问 <script>不是代码</script>",
    completed: ["L2"],
    readerStep: 4,
    readerSubstep: 2,
    seenSteps: [0, 1, 2, 3, 4],
    seenSubsteps: [0, 1, 2, 3],
  };
  const fixture = {
    format: "ai-inference-learning-map-progress",
    version: 1,
    progress: {
      "compiler-chain": {
        status: "known",
        notes: "合成概览笔记",
        quizPassed: true,
      },
    },
    depthProgress: {
      "linear-state": old,
      "tensor-address": { ...old, note: "合成新课笔记" },
    },
    knowledgeGraph: {
      version: 1,
      nodes: [
        {
          id: "mine-fixture",
          title: "测试关联",
          summary: "合成记录",
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
          why: "验证往返保留",
        },
      ],
    },
  };
  for (const width of [1365, 390, 360]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
    await page.goto(base);
    await page.waitForSelector("#importFile", { state: "attached" });
    await page.locator("#importFile").setInputFiles({
      name: "fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    for (const t of depthTopics) {
      for (const ch of chaptersFor(t.id)) {
        await page.evaluate(
          (hash) => (location.hash = hash),
          `depth/${t.id}/L2/${ch.id}`,
        );
        await page.waitForFunction(
          (id) =>
            document.querySelector('[data-mech-chapter][aria-current="step"]')
              ?.dataset.mechChapter === id,
          ch.id,
        );
        assert.equal(
          await page.locator(".mechanism-lab").getAttribute("data-mechanism"),
          ch.figure,
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false, `${width}/${t.id}/${ch.id} overflow`);
        const badTimeline = await page
          .locator(".mech-time-row")
          .evaluateAll((rows) =>
            rows.some(
              (r) =>
                !r.parentElement.classList.contains("mech-timeline") ||
                r.getBoundingClientRect().height < 38,
            ),
          );
        assert.equal(
          badTimeline,
          false,
          `timeline row geometry ${width}/${t.id}/${ch.id}`,
        );
        views++;
        const opts = await page
          .locator(".mechanism-lab [data-mech-key]")
          .evaluateAll((nodes) =>
            nodes
              .map((n) => ({
                key: n.dataset.mechKey,
                value: n.dataset.mechValue,
              }))
              .filter(
                (x, i, a) =>
                  a.findIndex((y) => y.key === x.key && y.value === x.value) ===
                  i,
              ),
          );
        // Exercise every choice at desktop, a counterfactual per control at mobile.
        const selected =
          width === 1365
            ? opts
            : opts.filter(
                (x, i, a) => i === a.findIndex((y) => y.key === x.key),
              );
        for (const { key, value } of selected) {
          const selector = `.mechanism-lab [data-mech-key="${key}"][data-mech-value="${value}"]`;
          const button = page.locator(selector).first();
          if (!(await button.count())) continue;
          if ((await button.getAttribute("aria-pressed")) === "true") continue;
          const before = await page.locator(".mechanism-lab").innerHTML();
          await button.evaluate((b) => b.click());
          actions++;
          const after = await page.locator(".mechanism-lab").innerHTML();
          if (before === after)
            unchanged.push(`${width}/${t.id}/${ch.id}/${key}:${value}`);
        }
        assert.equal(
          await page
            .locator(".mechanism-lab")
            .innerText()
            .then((s) => /NaN|undefined/.test(s)),
          false,
          `${t.id}/${ch.id} invalid number`,
        );
        if (ch.quiz) {
          await page.locator('[data-f-answer="0"]').click();
          assert.ok(await page.locator(".focus-check-feedback").isVisible());
          await page.locator("[data-f-retry]").click();
          actions += 2;
        }
        if (
          width === 1365 &&
          [
            "triangle",
            "dispatch",
            "rescale",
            "layout",
            "async",
            "reduce",
          ].includes(ch.id)
        ) {
          await page.screenshot({
            path: `test-results/v5-${t.id}-${ch.id}.png`,
            fullPage: true,
          });
        }
      }
      await page.evaluate((hash) => (location.hash = hash), `depth/${t.id}/L3`);
      await page.waitForFunction(
        (id) =>
          document.querySelector('[data-mech-chapter][aria-current="step"]')
            ?.dataset.mechChapter === id,
        chaptersFor(t.id).find((c) => c.code).id,
      );
      await page.waitForSelector(".mechanism-code");
      await page.locator(".mechanism-code>summary").click();
      await page.locator(".mechanism-code>details>summary").click();
      const phases = await page.locator(".ct-phases [data-code-phase]").count();
      for (let i = 0; i < phases; i++) {
        await page
          .locator(`.ct-phases [data-code-phase="${i}"]`)
          .evaluate((b) => b.click());
        assert.ok(
          (await page.locator(".ct-explain-top").innerText()).includes(
            `当前第 ${i + 1}/${phases} 段`,
          ),
        );
        actions++;
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `source ${width}/${t.id}`,
      );
      results.push({ width, topic: t.id, chapters: chaptersFor(t.id).length });
    }
    await page.evaluate(() => (location.hash = "curriculum/compiler"));
    await page.waitForSelector(".course-unit");
    assert.equal(await page.locator(".course-unit").count(), 8);
    assert.equal(await page.locator(".course-unit [data-dtopic]").count(), 16);
    assert.ok(
      (await page.locator(".course-unit").allTextContents())
        .join("")
        .includes("自评掌握0"),
    );
    await page.locator("#curriculumSearch").fill("动作");
    assert.ok((await page.locator(".course-unit [data-dtopic]").count()) > 0);
    await page.locator("#curriculumSearch").fill("不会匹配的课程测试");
    assert.ok(await page.locator(".course-empty").isVisible());
    await page.evaluate(
      () => (location.hash = "depth/linear-state/L2/triangle"),
    );
    await page.waitForFunction(
      () =>
        document.querySelector('[data-mech-chapter][aria-current="step"]')
          ?.dataset.mechChapter === "triangle",
    );
    await page.locator(".mechanism-record summary").click();
    assert.equal(await page.locator("#focusNote").inputValue(), old.note);
    await page.locator("#focusNote").fill(old.note + "；新版追加");
    await page.locator('[data-mech-key="beta"][data-mech-value="1"]').click();
    assert.ok(await page.locator("#focusNote").isVisible());
    assert.equal(
      await page.locator("#focusNote").inputValue(),
      old.note + "；新版追加",
    );
    await page.locator(".mechanism-record summary").click();
    await page.locator("[data-mech-next]").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.hash.endsWith("/kernel"));
    await page.reload();
    await page.waitForSelector(".mechanism-chapter");
    assert.equal(
      await page
        .locator('[data-mech-chapter][aria-current="step"]')
        .getAttribute("data-mech-chapter"),
      "kernel",
    );
    const rec = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ai-inference-depth-progress-v1"))[
          "linear-state"
        ],
    );
    for (const k of [
      "status",
      "completed",
      "readerStep",
      "readerSubstep",
      "seenSteps",
      "seenSubsteps",
    ])
      assert.deepEqual(rec[k], old[k], k);
    assert.ok(rec.mechanismReading.seen.includes("triangle"));
    assert.equal(rec.mechanismReading.last, "kernel");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportBtn").click(),
    ]);
    const data = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(
      data.progress["compiler-chain"].notes,
      fixture.progress["compiler-chain"].notes,
    );
    assert.equal(
      data.depthProgress["linear-state"].note,
      old.note + "；新版追加",
    );
    assert.deepEqual(
      data.depthProgress["linear-state"].mechanismReading,
      rec.mechanismReading,
    );
    assert.equal(data.knowledgeGraph.nodes[0].id, "mine-fixture");
    assert.equal(data.depthProgress["tensor-address"].note, "合成新课笔记");
    assert.equal(data.depthProgress["tensor-address"].status, "known");
    await page.locator("#importFile").setInputFiles({
      name: "roundtrip.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await page.locator("#importFile").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("导入失败"),
    );
    assert.equal(
      await page.locator("#focusNote").inputValue(),
      old.note + "；新版追加",
    );
    await page.locator("#themeToggle").click();
    await page.screenshot({
      path: `test-results/v5-${width}-dark.png`,
      fullPage: true,
    });
    await page.locator(".mechanism-catalog > summary").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `catalog ${width}`,
    );
    await page
      .locator(".catalog-unit")
      .filter({ has: page.locator('[data-dtopic="moe-route"]') })
      .locator("summary")
      .click();
    await page.locator('.mechanism-catalog [data-dtopic="moe-route"]').click();
    await page.waitForFunction(() =>
      location.hash.includes("depth/moe-route/"),
    );
    await page.evaluate(() => (location.hash = "map"));
    await page.waitForSelector("#mapView:not([hidden])");
    if (width === 1365) {
      const z = await page.locator("#zoomDisplay").innerText();
      await page.locator("#zoomIn").click();
      assert.notEqual(await page.locator("#zoomDisplay").innerText(), z);
      await page.locator("#zoomOut").click();
    } else
      assert.equal(await page.locator("#mobileNodeList button").count(), 6);
    await page.locator("#mapSearch").fill("VLA");
    await page.locator("#mapSearch").fill("");
    for (const [url, target] of [
      ["research-labs.html?topic=linear", "linear-state"],
      ["research-labs.html?topic=compiler", "compiler-lowering"],
      ["research-expansion.html?topic=flash", "attention-tiling"],
      ["research-expansion.html?topic=scheduler", "vllm-scheduler"],
      ["research-expansion.html?topic=moe", "moe-route"],
      ["research-expansion.html?topic=vla", "vla-policy"],
    ]) {
      await page.goto(base + url);
      await page.waitForSelector(".mechanism-chapter");
      assert.ok(
        page.url().includes(`/depth/${target}/`) ||
          page.url().includes(`#depth/${target}/`),
      );
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(
    "test-results/curriculum-audit.json",
    JSON.stringify({ views, actions, errors, unchanged, results }, null, 2),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(unchanged, []);
  console.log(
    JSON.stringify({
      views,
      actions,
      errors,
      unchanged,
      widths: [1365, 390, 360],
      progressRoundTrip: "passed",
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
