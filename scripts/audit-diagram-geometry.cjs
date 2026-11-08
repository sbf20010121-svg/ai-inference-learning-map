const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const { foundationCourses } = await import("../site/js/foundation-index.js");
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1365, height: 1000 } });
  const issues = [];
  let svgCount = 0;
  for (const c of foundationCourses)
    for (const ch of c.chapters) {
      await p.goto("http://127.0.0.1:5173/#depth/" + c.id + "/L2/" + ch.id);
      await p.waitForFunction(
        (figure) =>
          document.querySelector(".mechanism-lab")?.dataset.mechanism ===
          figure,
        ch.figure,
      );
      for (let variant = -1; variant < 4; variant++) {
        if (variant >= 0)
          await p.evaluate(
            async ({ figure, initial, variant }) => {
              const { renderMechanism, defaultLab } = await import(
                "./js/mechanism-visuals.js"
              );
              document.querySelector(".mechanism-lab").innerHTML =
                renderMechanism(figure, {
                  ...defaultLab(),
                  ...initial,
                  case: variant,
                  step: variant,
                  pick: variant,
                });
            },
            { figure: ch.figure, initial: ch.initial, variant },
          );
        const r = await p.locator("svg.ff-svg").evaluateAll((svgs) =>
          svgs.map((svg) => {
            const view = svg.viewBox.baseVal;
            const text = [...svg.querySelectorAll("text")].map((n) => ({
              s: n.textContent,
              b: n.getBBox(),
            }));
            const issues = [];
            for (let i = 0; i < text.length; i++) {
              const a = text[i],
                v = a.b;
              if (
                v.x < view.x - 1 ||
                v.y < view.y - 1 ||
                v.x + v.width > view.width + 1 ||
                v.y + v.height > view.height + 1
              )
                issues.push(["clip", a.s]);
              for (let j = i + 1; j < text.length; j++) {
                const b = text[j],
                  u = b.b;
                const w =
                    Math.min(v.x + v.width, u.x + u.width) - Math.max(v.x, u.x),
                  h =
                    Math.min(v.y + v.height, u.y + u.height) -
                    Math.max(v.y, u.y);
                if (
                  w > 1 &&
                  h > 1 &&
                  w * h >
                    Math.min(v.width * v.height, u.width * u.height) * 0.15
                )
                  issues.push(["overlap", a.s, b.s]);
              }
            }
            return issues;
          }),
        );
        svgCount += r.length;
        if (r.flat().length)
          issues.push({
            course: c.id,
            chapter: ch.id,
            variant,
            issues: r.flat(),
          });
      }
    }
  await b.close();
  fs.writeFileSync(
    "test-results/v5-geometry.json",
    JSON.stringify({ svgCount, issues }, null, 2),
  );
  assert.deepEqual(issues, []);
  console.log(JSON.stringify({ svgCount, issues }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
