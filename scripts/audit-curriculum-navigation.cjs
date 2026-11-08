const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { courseUnits, allCourses } = await import(
    "../site/js/course-registry.js"
  );
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
  });
  const p = await b.newPage({
    viewport: { width: 1365, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
  let navigated = 0;
  for (const u of courseUnits) {
    await p.goto(base + "#curriculum/" + u.module);
    await p.waitForSelector(".course-unit");
    const unit = p
      .locator(".course-unit")
      .filter({ has: p.locator('[data-dtopic="' + u.courses[0] + '"]') });
    await unit.locator("summary").click();
    await unit.locator('[data-dtopic="' + u.courses[0] + '"]').click();
    await p.waitForSelector(".mechanism-chapter");
    assert.ok(p.url().includes("depth/" + u.courses[0] + "/"));
    await p.locator(".course-orientation [data-course-home]").click();
    await p.waitForSelector(".course-unit");
    assert.ok(p.url().endsWith("#curriculum/" + u.module));
    navigated++;
  }
  await p.goto(base + "#network/tensor-address");
  await p.waitForSelector("#netFocusSelect");
  assert.equal(
    await p.locator("#netFocusSelect option").count(),
    allCourses.length,
  );
  assert.equal(
    await p.locator("#netFocusSelect").inputValue(),
    "tensor-address",
  );
  await p.locator('[data-net-deep="tensor-address"]').click();
  await p.waitForSelector(".mechanism-chapter");
  await p.locator(".mechanism-record summary").click();
  await p.locator("#focusNote").fill("合成独立课笔记：转置不搬运");
  await p.locator('[data-f-mark="review"]').click();
  if (!(await p.locator("#focusNote").isVisible()))
    await p.locator(".mechanism-record summary").click();
  await p.locator('[data-mech-key="pick"][data-mech-value="1"]').click();
  assert.equal(
    await p.locator("#focusNote").inputValue(),
    "合成独立课笔记：转置不搬运",
  );
  await p.reload();
  await p.waitForSelector(".mechanism-chapter");
  const rec = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ai-inference-depth-progress-v1"))[
        "tensor-address"
      ],
  );
  assert.equal(rec.note, "合成独立课笔记：转置不搬运");
  assert.equal(rec.status, "review");
  await p.goto(base + "#curriculum/compiler");
  await p.waitForSelector("[data-audittoggle]");
  await p.locator("[data-audittoggle]").click();
  await p.locator('[data-auditfilter="prio"]').selectOption("all");
  await p.locator('[data-auditfilter="state"]').selectOption("missing");
  assert.equal(await p.locator(".audit-card").count(), 4);
  await p.locator('[data-auditfilter="state"]').selectOption("partial");
  assert.equal(await p.locator(".audit-card").count(), 3);
  await p.goto(base + "#depth/pipeline-parallel/L2/wave");
  await p.waitForSelector(".mechanism-chapter");
  const colors = await p
    .locator(".mech-time-row:first-of-type span")
    .evaluateAll((n) => n.map((x) => getComputedStyle(x).backgroundColor));
  const allColors = await p
    .locator(".mech-time-row span")
    .evaluateAll((n) => n.map((x) => getComputedStyle(x).backgroundColor));
  assert.equal(new Set(allColors).size, 3);
  await p.screenshot({
    path: "test-results/v5-final-pipeline.png",
    fullPage: true,
  });
  await p.setViewportSize({ width: 360, height: 950 });
  await p.goto(base + "#depth/observation-contract/L2/frame");
  await p.waitForSelector(".mechanism-chapter");
  await p.screenshot({
    path: "test-results/v5-final-coordinates-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await b.close();
  assert.deepEqual(errors, []);
  const report = {
    unitsNavigated: navigated,
    networkCourses: allCourses.length,
    newNotePersistence: true,
    auditFilters: true,
    identityColors: 3,
    errors,
  };
  fs.writeFileSync(
    "test-results/v5-navigation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
