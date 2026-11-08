const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1365, height: 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (process.env.BASELINE_APP)
    await p.route("**/js/app.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: fs.readFileSync(process.env.BASELINE_APP, "utf8"),
      }),
    );
  await p.route("**/cloud-config.json", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ apiBase: "https://example.workers.dev" }),
    });
  });
  await p.goto("http://127.0.0.1:5173/#curriculum/compiler");
  await p.waitForSelector(".course-unit");
  await p.locator("#curriculumSearch").fill("Stride");
  assert.ok((await p.locator(".course-unit[open]").count()) > 0);
  await p.waitForSelector('#cloudSyncStatus[data-state="signedout"]');
  assert.equal(await p.locator("#curriculumSearch").inputValue(), "Stride");
  assert.ok((await p.locator(".course-unit[open]").count()) > 0);
  await p.close();
  const auth = await b.newPage();
  await auth.addInitScript(() =>
    sessionStorage.setItem(
      "atlas-cloud-return-hash-v1",
      "#curriculum/compiler",
    ),
  );
  await auth.goto("http://127.0.0.1:5173/#cloud_auth=invalid-synthetic-token");
  await auth.waitForSelector(".course-unit");
  assert.ok(auth.url().endsWith("#curriculum/compiler"));
  assert.equal(await auth.locator(".course-unit").count(), 8);
  await b.close();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      delayedCloudConfig: "preserved search and open units",
      oauthReturnRoute: true,
      errors,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
