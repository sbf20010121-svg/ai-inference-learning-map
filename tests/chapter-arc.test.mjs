import test from "node:test";
import assert from "node:assert/strict";
import { allCourses } from "../site/js/course-registry.js";
import { chaptersFor } from "../site/js/mechanism-curriculum.js";
import { chapterArcs, chapterArcFor, validateChapterArcs } from "../site/js/chapter-arc.js";
import { renderFocusReader } from "../site/js/focus-reader.js";

test("every authored chapter arc maps to a real chapter and has a complete learning closure", () => {
  assert.equal(validateChapterArcs(), true);
  for (const [key, arc] of Object.entries(chapterArcs)) {
    const [courseId, chapterId] = key.split("/");
    assert.ok(allCourses.some((course) => course.id === courseId), courseId);
    assert.ok(chaptersFor(courseId).some((chapter) => chapter.id === chapterId), key);
    assert.ok(arc.opening.trim(), key + " opening");
    assert.ok(arc.takeaway.trim(), key + " takeaway");
    assert.ok(arc.bridge.trim(), key + " bridge");
    assert.ok(arc.terms.length > 0, key + " terms");
  }
});

test("chapter reader presents context and first-use terms before its mechanism figure, then closes and bridges", () => {
  for (const [key, arc] of Object.entries(chapterArcs)) {
    const [courseId, chapterId] = key.split("/");
    const course = allCourses.find((item) => item.id === courseId);
    const html = renderFocusReader(course, {}, { chapter: chapterId });
    // Scope to rendered sections: a symbol may also occur in the title or navigation.
    const opening = html.indexOf('class="chapter-opening"');
    const firstTerm = html.indexOf('class="mechanism-vocabulary chapter-first-terms"');
    const figure = html.indexOf('class="mechanism-lab"');
    const takeaway = html.indexOf(arc.takeaway);
    const bridge = html.indexOf(arc.bridge);
    assert.ok(opening >= 0 && opening < firstTerm, key + " opening before terms");
    assert.ok(firstTerm < figure, key + " terms before figure");
    assert.equal((html.match(/class="mechanism-vocabulary/g) || []).length, 1, key + " no duplicate glossary");
    assert.ok(figure < takeaway && takeaway < bridge, key + " closure after mechanism");
  }
});

test("priority cross-topic concepts are not left as unexplained labels", () => {
  for (const [course, chapters] of Object.entries({
    "linear-state": ["state", "write", "correction", "gate", "chunk", "triangle", "kernel", "cost", "diagnosis"],
    "compiler-lowering": ["capture", "fusion", "program", "ir", "layout", "target", "tradeoff"],
    "moe-route": ["router", "dispatch", "ep", "grouped", "combine", "balance"],
    "token-embedding": ["tokens", "lookup", "head"],
    "transformer-layer": ["residual", "axes", "expand"],
    "generation-state": ["positions", "stop"],
    "sampling-distribution": ["temperature", "nucleus", "draw"],
    "attention-patterns": ["mask", "layers", "implementation"],
    "request-lifecycle": ["identity", "cancel", "finish"],
    "state-families": ["updates", "ssm", "compare"],
  })) for (const chapter of chapters)
    assert.ok(chapterArcFor(course, chapter), course + "/" + chapter);
});
