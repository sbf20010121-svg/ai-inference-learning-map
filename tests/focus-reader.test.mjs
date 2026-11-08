import test from "node:test";
import assert from "node:assert/strict";
import { depthTopics } from "../site/js/depth-content.js";
import {
  chaptersFor,
  resolveChapter,
} from "../site/js/mechanism-curriculum.js";
import {
  renderFocusReader,
  normalizeReaderRecord,
  getReaderCounts,
  chapterProgress,
} from "../site/js/focus-reader.js";
import { figureKinds } from "../site/js/mechanism-visuals.js";
test("navigation follows each mechanism, not the archived seven-page template", () => {
  const lists = depthTopics.map((t) => chaptersFor(t.id));
  assert.ok(new Set(lists.map((a) => a.length)).size > 3);
  assert.equal(
    new Set(lists.map((a) => a.map((c) => c.title).join("|"))).size,
    25,
  );
  for (const t of depthTopics) {
    const chapters = chaptersFor(t.id);
    assert.equal(new Set(chapters.map((c) => c.id)).size, chapters.length);
    for (const ch of chapters) {
      assert.ok(figureKinds.has(ch.figure));
      const html = renderFocusReader(t, {}, { chapter: ch.id });
      assert.ok(html.includes(ch.question));
      assert.ok(html.includes(ch.explain));
      assert.match(html, /<figure/);
      assert.match(html, /data-mech-prev/);
      assert.match(html, /data-mech-next/);
      assert.match(html, /id="focusNote"/);
      assert.doesNotMatch(
        html,
        /research-(?:labs|expansion)\.html|data-f-page|focus-mini-arrow/,
      );
      assert.doesNotMatch(html, /undefined|NaN/);
    }
  }
  assert.ok(chaptersFor("linear-state").some((c) => c.id === "triangle"));
  assert.ok(chaptersFor("compiler-lowering").some((c) => c.id === "layout"));
});
test("old record values survive independently of new chapter visits", () => {
  const raw = {
    readerStep: 3,
    readerSubstep: 2,
    seenSteps: [0, 1, 2, 2, 4, 99],
    seenSubsteps: [0, 2],
  };
  const old = normalizeReaderRecord(raw);
  assert.deepEqual(old.seenSteps, [0, 1, 2, 4]);
  assert.equal(getReaderCounts(old, 5).core, 3);
  const withNew = normalizeReaderRecord({
    ...raw,
    mechanismReading: {
      version: 1,
      last: "chunk",
      seen: ["state", "chunk", "chunk", "<script>"],
    },
  });
  assert.deepEqual(withNew.mechanismReading, {
    version: 1,
    last: "chunk",
    seen: ["state", "chunk"],
  });
  for (const k of Object.keys(old)) assert.deepEqual(withNew[k], old[k]);
  assert.deepEqual(chapterProgress({ id: "linear-state" }, withNew), {
    seen: ["state", "chunk"],
    total: 9,
  });
  assert.equal(normalizeReaderRecord({ readerStep: 300 }).readerStep, 6);
});
test("legacy depth routes, resume and explicit chapter links resolve deterministically", () => {
  for (const t of depthTopics) {
    assert.equal(resolveChapter(t.id), chaptersFor(t.id)[0].id);
    assert.ok(
      chaptersFor(t.id).find((c) => c.id === resolveChapter(t.id, {}, "L3"))
        .code,
    );
    assert.ok(
      chaptersFor(t.id).find((c) => c.id === resolveChapter(t.id, {}, "L4"))
        .quiz,
    );
    const last = chaptersFor(t.id).at(-1).id;
    assert.equal(resolveChapter(t.id, { mechanismReading: { last } }), last);
    assert.equal(resolveChapter(t.id, {}, "L3", last), last);
  }
});
test("private note content is escaped and never changes self-assessment", () => {
  const html = renderFocusReader(depthTopics[0], {
    status: "known",
    note: "<img src=x onerror=alert(1)>",
  });
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /自评已掌握/);
});
