import test from "node:test";
import assert from "node:assert/strict";
import { depthTopics } from "../site/js/depth-content.js";
import { lessons } from "../site/js/content.js";
import {
  allCourses,
  allCourseById,
  courseUnits,
  foundationCourses,
  validateCourseRegistry,
} from "../site/js/course-registry.js";
import { chaptersFor } from "../site/js/mechanism-curriculum.js";
import {
  renderFocusReader,
  normalizeReaderRecord,
} from "../site/js/focus-reader.js";
import { renderFoundationFigure } from "../site/js/foundation-figures.js";
import {
  coverageItems,
  statusOf,
  validateCoverage,
} from "../site/js/coverage.js";
import * as N from "../site/js/foundation-numerics.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("domains contain units and independent courses; legacy identities retain one home", () => {
  assert.equal(validateCourseRegistry(), true);
  const parents = new Set(lessons.map((c) => c.id));
  for (const c of allCourses) assert.ok(parents.has(c.parent), c.id);
  for (const old of depthTopics) assert.equal(allCourseById.get(old.id), old);
  const compiler = courseUnits.filter((u) => u.module === "compiler");
  assert.ok(compiler.length > 1);
  assert.ok(compiler.flatMap((u) => u.courses).length > 10);
  assert.equal(
    compiler.filter((u) => u.courses.includes("compiler-lowering")).length,
    1,
  );
  const introRecord = normalizeReaderRecord({
    readerStep: 4,
    seenSteps: [0, 1, 2, 3, 4],
  });
  assert.equal(introRecord.mechanismReading, undefined);
});
test("every authored chapter renders its own object and explicit evidence within its stable route", () => {
  for (const c of foundationCourses) {
    const topic = allCourseById.get(c.id);
    for (const ch of c.chapters) {
      const rendered = renderFocusReader(
        topic,
        { note: "<script>synthetic</script>", status: "known" },
        { chapter: ch.id, lab: ch.initial },
      );
      assert.ok(rendered.includes(ch.question));
      assert.ok(rendered.includes(ch.explain));
      assert.match(rendered, /foundation-figure/);
      assert.match(rendered, /course-orientation/);
      assert.match(rendered, /unit-continuation/);
      assert.match(rendered, /&lt;script/);
      assert.doesNotMatch(
        rendered,
        /NaN|undefined|Unimplemented|尚缺有证据的源码/,
      );
      for (let variant = 0; variant < 4; variant++) {
        const fig = renderFoundationFigure(ch.figure, {
          ...ch.initial,
          case: variant,
          step: variant,
          pick: variant,
        });
        assert.doesNotMatch(fig, /NaN|undefined/);
      }
    }
  }
});
test("scope audit cannot infer a complete mechanism from a topic link alone", () => {
  assert.equal(validateCoverage(), true);
  assert.notEqual(statusOf({ ref: "compiler-lowering" }), "guided");
  assert.notEqual(
    statusOf({ state: "guided", ref: "compiler-lowering" }),
    "guided",
  );
  for (const i of coverageItems.filter((i) => statusOf(i) === "guided")) {
    assert.ok(i.evidence.scope && i.evidence.boundary);
    for (const id of i.evidence.chapters)
      assert.ok(chaptersFor(i.ref).some((ch) => ch.id === id));
  }
  const linux = coverageItems.find((i) => i.ref === "process-threads");
  assert.ok(linux);
  assert.ok(
    !coverageItems.some(
      (i) => i.ref === "host-runtime" && i.name.includes("Linux"),
    ),
  );
});
test("stride views preserve data identity while transpose changes logical traversal", () => {
  assert.deepEqual(N.addressView(false).values, [
    [0, 1, 2],
    [3, 4, 5],
  ]);
  assert.deepEqual(N.addressView(true).values, [
    [0, 3],
    [1, 4],
    [2, 5],
  ]);
  assert.equal(N.addressView(true, true).values[2][1], 99);
});
test("liveness allocation never aliases overlapping intervals; delayed use increases demand", () => {
  for (const late of [false, true]) {
    const d = N.liveAllocation(late);
    for (const a of d.allocated)
      for (const b of d.allocated)
        if (a !== b && a.slot === b.slot)
          assert.ok(a.end < b.start || b.end < a.start);
    assert.equal(d.slots, Math.max(...d.pressure));
  }
  assert.equal(N.liveAllocation(false).slots, 2);
  assert.equal(N.liveAllocation(true).slots, 3);
});
test("shape specialization distinguishes version count and valid dynamic range", () => {
  assert.equal(N.shapeCache(false).versions, 3);
  assert.equal(N.shapeCache(true).versions, 1);
  assert.equal(N.shapeCache(true).valid(16), false);
});
test("loop transforms preserve the exact legal iteration set, including partial tail", () => {
  const set = (a) => a.map((p) => p.join(",")).sort();
  assert.equal(N.loopPoints().length, 12);
  assert.deepEqual(set(N.loopPoints(2)), set(N.loopPoints(1, true)));
  assert.ok(N.loopPoints().every(([i, j, k]) => i < 2 && j < 2 && k < 3));
});
test("probability filtering keeps the threshold-crossing token and restores unit mass", () => {
  const d = N.sampling();
  assert.deepEqual(d.keep, [0, 1]);
  near(d.mass, 0.85);
  near(d.filtered[0], 12 / 17);
  near(d.filtered[1], 5 / 17);
  near(N.total(d.filtered), 1);
  assert.equal(
    d.cdf.findIndex((x) => 0.75 < x),
    1,
  );
  assert.ok(N.sampling(2).probabilities[0] < N.sampling(1).probabilities[0]);
});
test("patch coordinates and local attention reachability retain the intended axes", () => {
  assert.deepEqual(N.patchify().patches[0], [0, 1, 4, 5]);
  assert.equal(N.patchify(8).tokens, 16);
  const d = N.attentionPattern(3, 2);
  assert.equal(d.pairs, 15);
  assert.equal(d.direct[5][1], 0);
  assert.equal(d.reachable[5][1], 1);
  assert.equal(d.reachable[5][0], 0);
});
test("packed offsets and returned row identities change together", () => {
  const a = N.packedBatch(),
    b = N.packedBatch(true);
  assert.deepEqual(a.offsets, [0, 3, 4]);
  assert.deepEqual(b.offsets, [0, 1, 4]);
  assert.equal(a.slots[0].id, "A");
  assert.equal(b.slots[0].id, "B");
  assert.equal(a.slots.length, b.slots.length);
});
test("bounded queue accounts for every arrival and never overlaps serial service", () => {
  for (const limit of [1, 2]) {
    const d = N.boundedQueue(limit),
      accepted = d.rows.filter((r) => r.accepted);
    assert.equal(d.accepted + d.rejected, 7);
    for (let i = 0; i < accepted.length; i++) {
      const r = accepted[i];
      assert.equal(r.end - r.start, 3);
      assert.ok(r.start >= r.arrival);
      if (i) assert.ok(r.start >= accepted[i - 1].end);
    }
    for (let t = 0; t < 7; t++)
      assert.ok(
        accepted.filter((r) => r.arrival <= t && r.start > t).length <= limit,
      );
  }
});
test("pipeline schedule respects same-batch dependencies and stage capacity", () => {
  for (const duration of [
    [1, 1],
    [1, 2],
  ]) {
    const d = N.pipeline(2, 3, duration);
    for (let b = 0; b < 3; b++)
      assert.ok(
        d.trace.find((r) => r.batch === b && r.stage === 1).start >=
          d.trace.find((r) => r.batch === b && r.stage === 0).end,
      );
    for (let stage = 0; stage < 2; stage++) {
      const rows = d.trace.filter((r) => r.stage === stage);
      for (let i = 1; i < rows.length; i++)
        assert.ok(rows[i].start >= rows[i - 1].end);
    }
  }
  assert.equal(N.pipeline().total, 4);
  assert.equal(N.pipeline(2, 3, [1, 2]).total, 7);
});
test("duplicate scatter indices conserve contributions and paged reads match continuous attention", () => {
  assert.deepEqual(N.scatterExample().out, [5, 5, 0]);
  for (const len of [3, 4])
    for (const permuted of [false, true]) {
      const d = N.pagedRead(len, permuted);
      near(d.out, d.reference);
      assert.equal(d.addresses.length, len);
      near(N.total(d.weights), 1);
    }
  assert.notEqual(N.pagedRead(3).out, N.pagedRead(4).out);
});
test("group scales and ring phase boundaries preserve exact coordinates", () => {
  const q = N.quantDot();
  assert.deepEqual(q.weights, [1, -0.5, 0.75, 0.5]);
  near(q.out, 1.75);
  for (const p of [2, 4]) {
    const s = N.ringState(p, 1),
      a = N.ringState(p, 2);
    assert.equal(s.state.flat().filter((v) => v !== null).length, 4);
    for (const row of a.state) assert.deepEqual(row, s.sum);
  }
  assert.equal(N.ringState(2).sendBytes, 16);
  assert.equal(N.ringState(4).sendBytes, 24);
});
test("coordinate and action decoding obey declared reference frames and anchors", () => {
  const t = N.transformPoint(90);
  near(t.world[0], 1);
  near(t.world[1], 3);
  assert.deepEqual(N.actionEncoding().normalized, [-0.5, 0, 0.5]);
  assert.deepEqual(N.actionEncoding().restored, [10, 11, 12]);
  assert.deepEqual(N.actionEncoding(true).restored, [11, 12, 13]);
  assert.deepEqual(N.episodeWindow(1).valid, [true, true, false]);
});
test("feedback uses available observations; KL and diffusion have independent analytic references", () => {
  assert.equal(N.closedLoop(false).final, 4);
  assert.equal(N.closedLoop(true).final, 3);
  assert.equal(N.closedLoop(true, true).final, 4);
  near(N.klState().kl, 0.19274475702175753);
  for (const alpha of [0.25, 0.81]) {
    const d = N.noiseState(alpha);
    d.restored.forEach((x, i) => near(x, d.z0[i]));
  }
});
test("bank mapping distinguishes broadcast from conflicting words and capacity uses the limiting resource", () => {
  assert.equal(N.banks(0).maxConflict, 1);
  assert.equal(N.banks(1).maxConflict, 32);
  assert.equal(N.banks(2).maxConflict, 1);
  assert.equal(N.banks(3).maxConflict, 1);
  assert.equal(new Set(N.banks(1).words).size, 32);
  assert.equal(new Set(N.banks(3).words).size, 1);
  assert.equal(N.residency(32).blocks, 4);
  assert.equal(N.residency(96).blocks, 2);
});
test("sample distributions do not conflate median, mean and cold-start cost", () => {
  const d = N.measurement(true);
  near(d.meanB, 10.4);
  assert.equal(d.medianB, 8);
  assert.equal(d.meanA, 10);
});
test("convolution windows, padding and implicit matrix representation compute the same output", () => {
  assert.equal(N.convolution().size, 3);
  assert.equal(N.convolution(2).size, 2);
  assert.equal(N.convolution(1, 1).size, 5);
  assert.deepEqual(N.convolution().windows[4].values, [5, 6, 9, 10]);
  assert.equal(N.convolution().out[4], 15);
  for (const [stride, pad] of [
    [1, 0],
    [2, 0],
    [1, 1],
  ]) {
    const d = N.convolution(stride, pad);
    assert.deepEqual(
      N.mm(
        d.windows.map((w) => w.values),
        d.kernel.map((v) => [v]),
      ).flat(),
      d.out,
    );
  }
});
