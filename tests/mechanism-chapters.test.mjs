import test from "node:test";
import assert from "node:assert/strict";
import {
  deltaTrace,
  deltaChunkSolve,
  onlineTrace,
  scheduleTrace,
  expertTrace,
  fusionTrace,
  tileTrace,
  queueTrace,
  rotor,
  quantize,
  speculative,
  robotQueue,
  flowSample,
  rssmStep,
} from "../site/js/mechanism-models.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test("triangular Delta solve agrees with token recurrence, including interfering keys", () => {
  for (const beta of [0.5, 1])
    for (const keys of ["orthogonal", "mixed"]) {
      const d = deltaChunkSolve(beta, keys),
        S = deltaTrace({ beta, keys, gamma: 1 }).trace[3].S;
      d.S.flat().forEach((x, i) => near(x, S.flat()[i]));
      for (let i = 0; i < 3; i++)
        for (let v = 0; v < 2; v++)
          near(
            d.D[i][v] + d.L[i].reduce((s, l, j) => s + l * d.D[j][v], 0),
            d.rhs[i][v],
          );
      for (let i = 0; i < 3; i++)
        for (let j = i; j < 3; j++) assert.equal(d.L[i][j], 0);
    }
  assert.notDeepEqual(
    deltaTrace({ keys: "mixed" }).chunk,
    deltaTrace({ keys: "mixed" }).reversed,
  );
});
test("softmax rescaling preserves exact normalization under changed maximum", () => {
  for (const score of [3, 6]) {
    const d = onlineTrace(score);
    near(d.trace[2].out, d.direct);
    near(
      d.weights.reduce((s, x) => s + x, 0),
      1,
    );
    assert.ok(d.trace[2].alpha < 1);
  }
});
test("scheduler enforces KV capacity independently of per-round compute budget", () => {
  for (const B of [4, 8])
    for (const cap of [2, 16])
      for (const r of scheduleTrace(B, cap)) {
        assert.equal(r.used + r.left, B);
        assert.ok(r.requests.reduce((s, x) => s + x.blocks, 0) <= cap);
        for (const req of r.requests) assert.ok(req.blocks * 4 >= req.computed);
      }
  assert.ok(scheduleTrace(8, 2)[0].rejected.length > 0);
  assert.ok(
    scheduleTrace(8, 16)[1].chosen.some(
      (r) => r.id === "B" && r.kind === "decode",
    ),
  );
});
test("router identity, top-k count and normalized combine survive expert redistribution", () => {
  for (const k of [1, 2]) {
    const d = expertTrace(k);
    assert.equal(d.records.length, 4 * k);
    for (const r of d.routes)
      near(
        r.weights.reduce((s, x) => s + x, 0),
        1,
      );
    for (let t = 0; t < 4; t++)
      near(
        d.combined[t],
        d.buckets
          .flatMap((b) => b.records)
          .filter((r) => r.t === t)
          .reduce((s, r) => s + r.w * r.output, 0),
      );
  }
});
test("fusion preserves output but external use retains required materialized array", () => {
  const a = fusionTrace(false),
    b = fusionTrace(true),
    c = fusionTrace(true, true);
  assert.deepEqual(a.y, b.y);
  assert.deepEqual(b.y, c.y);
  assert.equal(a.writes, 12);
  assert.equal(b.writes, 4);
  assert.equal(c.writes, 8);
});
test("tile K accumulation and output ownership are independent of tile height", () => {
  const full = tileTrace(2, 2),
    other = tileTrace(4, 2);
  assert.deepEqual(full.C, other.C);
  assert.notEqual(full.grid, other.grid);
  full.C.forEach((row, i) =>
    row.forEach((v, j) =>
      near(
        v,
        full.A[i].reduce((s, a, k) => s + a * full.B[k][j], 0),
      ),
    ),
  );
  assert.notDeepEqual(tileTrace(2, 1).C, full.C);
});
test("probability mass, rotation norm, quantization and queue timing have independent checks", () => {
  for (const q of ["close", "far"]) {
    const d = speculative(q);
    d.reconstructed.forEach((x, i) => near(x, d.p[i]));
  }
  for (const angle of [0, 45, 90, 180]) {
    const r = rotor(angle);
    near(r.x * r.x + r.y * r.y, 1);
  }
  const d = quantize(0.25);
  d.x.forEach((x, i) => assert.ok(Math.abs(x - d.restored[i]) <= 0.125));
  for (const r of queueTrace(3)) {
    assert.equal(r.end - r.start, 3);
    assert.equal(r.response, r.wait + 3);
  }
  assert.ok(robotQueue("async", 4, 4).waits < robotQueue("sync", 4, 4).waits);
});
test("Flow supervision has correct endpoint and derivative; imaginary RSSM cannot use the observation", () => {
  const a = flowSample(0),
    b = flowSample(1),
    mid = flowSample(0.5);
  assert.deepEqual(a.current, a.noise);
  assert.deepEqual(b.current, b.target);
  mid.current.forEach((x, i) => near(x, (a.noise[i] + b.target[i]) / 2));
  mid.velocity.forEach((x, i) => near(x, b.current[i] - a.current[i]));
  assert.deepEqual(rssmStep(true, 0).probs, rssmStep(true, 1).probs);
  assert.notDeepEqual(rssmStep(false, 0).probs, rssmStep(false, 1).probs);
  near(
    rssmStep(false, 0).probs.reduce((s, x) => s + x, 0),
    1,
  );
  assert.equal(quantize(0.25, true).restored[3], 1.75);
  assert.equal(quantize(0.5, true).restored[3], 3);
});
