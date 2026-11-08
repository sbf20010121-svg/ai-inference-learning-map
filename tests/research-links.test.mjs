import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { researchDestination } from "../site/js/research-redirect.js";
test("old research bookmarks open integrated stable course, including old flash parameter", () => {
  for (const [name, id] of Object.entries({
    linear: "linear-state",
    compiler: "compiler-lowering",
    scheduler: "vllm-scheduler",
    moe: "moe-route",
    flash: "attention-tiling",
    vla: "vla-policy",
  }))
    assert.ok(
      researchDestination(
        "https://example.com/research-labs.html?topic=" + name,
      ).includes("#depth/" + id + "/L2/"),
    );
  for (const page of ["research-labs", "research-expansion"])
    assert.match(
      readFileSync(
        new URL("../site/" + page + ".html", import.meta.url),
        "utf8",
      ),
      /research-redirect\.js/,
    );
  assert.doesNotMatch(
    readFileSync(new URL("../site/index.html", import.meta.url), "utf8"),
    /href="\.\/research-/,
  );
});
