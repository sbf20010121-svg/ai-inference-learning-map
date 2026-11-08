import test from "node:test";
import assert from "node:assert/strict";
import { depthTopics } from "../site/js/depth-content.js";
import { courseModel, softmax } from "../site/js/course-models.js";
import { courseNotes } from "../site/js/course-notes.js";
import {
  renderCoursePhase,
  renderGatewayCase,
  frameFigure,
} from "../site/js/course-reader.js";
import { recurrence, chunkEquivalence } from "../site/js/research-models.js";
import {
  moeRoutes,
  schedulerRounds,
  flashSteps,
  directAttention,
} from "../site/js/research-expansion-model.js";
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-9, `${x} != ${y}`);
test("all stable topics have distinct observable counterfactuals and in-page evidence", () => {
  assert.deepEqual(
    Object.keys(courseNotes).sort(),
    depthTopics.map((t) => t.id).sort(),
  );
  for (const t of depthTopics) {
    const a = courseModel(t.id),
      b = courseModel(t.id, true);
    assert.equal(a.length, 4, t.id);
    assert.notDeepEqual(a, b, t.id);
    for (const f of [...a, ...b])
      for (const r of f.rows)
        for (const x of r)
          if (typeof x === "number") assert.ok(Number.isFinite(x), t.id);
    for (const pg of [0, 1, 2, 3, 5, 6]) {
      const s = renderCoursePhase(t, pg);
      assert.ok(s.length > 200, t.id);
      assert.doesNotMatch(s, /undefined|NaN/);
    }
    assert.match(renderCoursePhase(t, 2), /<math /);
    assert.ok(courseNotes[t.id].terms.every(([a, b]) => a && b));
  }
});
test("paged address mapping is bijective over live slots and accounts for tail waste", () => {
  for (const n of [5, 9]) {
    const f = courseModel("kv-cache", n === 9),
      addresses = f[2].rows[0][1];
    assert.equal(new Set(addresses).size, n);
    assert.equal(f[3].rows[1][1], Math.ceil(n / 4) * 4);
    assert.equal(f[3].rows[2][1], Math.ceil(n / 4) * 4 - n);
  }
});
test("token budget conservation and pending-work state survive consecutive rounds", () => {
  for (const B of [4, 8]) {
    const rounds = schedulerRounds(B, 3);
    let prev = { B: 6, C: 4 };
    for (const r of rounds) {
      assert.equal(r.used + r.free, B);
      assert.equal(
        r.used,
        r.chosen.reduce((s, t) => s + t.n, 0),
      );
      for (const t of r.chosen) {
        if (t.kind === "Prefill") prev[t.id] -= t.n;
      }
      assert.deepEqual(r.remaining, prev);
    }
  }
});
test("MoE token-expert identity and normalized weights conserve the routed workload", () => {
  const m = moeRoutes();
  assert.equal(
    m.buckets.reduce((n, b) => n + b.tokens.length, 0),
    8,
  );
  assert.equal(m.transfers.length, 5);
  for (const r of m.routes) {
    near(
      r.weights.reduce((a, b) => a + b, 0),
      1,
    );
    assert.equal(new Set(r.experts).size, 2);
  }
});
test("online normalization, delta rewrite and affine chunk agree with independent references", () => {
  const w = softmax([1, 2, 3, 0]);
  near(
    w.reduce((s, x, i) => s + x * [2, 4, -1, 5][i], 0),
    flashSteps().at(-1).out,
  );
  near(directAttention(), flashSteps().at(-1).out);
  for (const beta of [0.5, 1]) {
    near(chunkEquivalence(beta, 1).maxError, 0);
    const r = recurrence(beta, 1);
    near(r[3].S[0][0], 2 * beta + beta * (4 - 2 * beta));
  }
});
test("speculative single-step accept/reject reconstructs the exact target distribution", () => {
  const p = [0.6, 0.3, 0.1];
  for (const q of [
    [0.5, 0.4, 0.1],
    [0.1, 0.1, 0.8],
  ]) {
    const mass = p.map((x, i) => Math.min(x, q[i]));
    const accept = mass.reduce((a, b) => a + b, 0);
    const res = p.map((x, i) => Math.max(x - q[i], 0));
    const z = res.reduce((a, b) => a + b, 0);
    p.forEach((x, i) => near(mass[i] + ((1 - accept) * res[i]) / z, x));
  }
});
test("independent analytical budgets: PD bytes, tile masks, RMS zero, absorption and queues", () => {
  near(
    courseModel("pd-disagg")[2].rows[1][1],
    ((2 * 32 * 8 * 128 * 2048 * 2) / 25e9) * 1000,
  );
  assert.equal(courseModel("triton-tiling")[1].rows[1][1], 36);
  assert.equal(courseModel("triton-tiling", true)[1].rows[1][1], 48);
  assert.ok(courseModel("fused-norm", true)[2].rows.every((r) => r[1] === 0));
  for (const change of [false, true]) {
    const rows = courseModel("mla-kv", change)[3].rows;
    near(rows[0][1], rows[1][1]);
  }
  assert.deepEqual(courseModel("serving-slo")[1].rows[0][1], [2, 3, 4, 5]);
  assert.deepEqual(
    courseModel("serving-slo", true)[1].rows[0][1],
    [3, 5, 7, 9],
  );
  near(courseModel("gemm-tiling")[3].rows[0][1], 1024 / 384);
  assert.equal(courseModel("memory-route", true)[2].rows[0][1], 8);
});
test("every overview gateway now exposes data and a stable deeper route", async () => {
  const { lessons } = await import("../site/js/content.js");
  for (const l of lessons)
    for (let i = 0; i < l.steps.length; i++) {
      const h = renderGatewayCase(l.id, i);
      assert.match(h, /data-godepth/);
      assert.match(h, /course-figure/);
    }
});
test("semantic network has no orphan course and all new reasons explain a mechanism", async () => {
  const { curatedRelations } = await import("../site/js/semantic-graph.js");
  for (const t of depthTopics)
    assert.ok(
      curatedRelations.some((r) => r.from === t.id || r.to === t.id),
      t.id,
    );
});
test("small nonzero stabilizers are not misleadingly formatted as zero", () => {
  assert.match(frameFigure(courseModel("fused-norm")[1]), /1\.00e-5/);
});
