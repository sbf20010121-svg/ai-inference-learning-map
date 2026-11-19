import test from "node:test";
import assert from "node:assert/strict";
import { requestLifecycle, asyncRounds, streamingMetrics, quantizedExecution, ringTopology, quotaRound, arrivalModes } from "../site/js/engine-system-models.js";
import { packedBatch, boundedQueue, pipeline, ringState, banks, residency, measurement } from "../site/js/foundation-numerics.js";
import { scheduleTrace, speculative, warpTrace } from "../site/js/mechanism-models.js";

test("cancellation suppresses delivery without releasing in-flight or shared storage", () => {
  for (const cancelled of [false, true]) {
    const trace = [0, 1, 2, 3].map((step) => requestLifecycle(cancelled, step));
    for (const state of trace) {
      for (const block of state.blocks) {
        assert.equal(block.refs, block.owners.length);
        if (block.reusable) assert.ok(!state.inFlight && block.refs === 0);
      }
      if (state.inFlight) assert.equal(state.delivered, false);
    }
    assert.equal(trace[1].blocks[1].reusable, false);
    assert.equal(trace[2].delivered, !cancelled);
    assert.equal(trace[2].ignored, cancelled);
    assert.equal(trace[3].blocks[0].reusable, false);
    assert.deepEqual(trace[3].blocks[0].owners, ["B"]);
    assert.equal(trace[3].blocks[1].reusable, true);
  }
});

test("overlap respects the previous real token and includes startup and drain", () => {
  for (const cpu of [1, 2, 5]) for (const gpu of [1, 4]) for (const count of [1, 3, 5]) {
    const overlap = asyncRounds(true, count, cpu, gpu);
    assert.equal(overlap.total, cpu + gpu + (count - 1) * Math.max(cpu, gpu));
    assert.equal(asyncRounds(false, count, cpu, gpu).total, count * (cpu + gpu));
    overlap.rounds.forEach((round, i) => {
      assert.ok(round.gpuStart >= round.prepareEnd);
      if (i) assert.ok(round.gpuStart >= overlap.rounds[i - 1].gpuEnd);
    });
  }
  assert.equal(asyncRounds(true).total, 14);
});

test("TTFT, per-token intervals and completion use distinct timestamp boundaries", () => {
  const base = streamingMetrics(), queued = streamingMetrics(3);
  assert.deepEqual(base.itl, [2, 4]);
  assert.equal(base.ttft, 3);
  assert.equal(base.completion, 9);
  assert.equal(base.ttft + base.itl.reduce((a, b) => a + b, 0), base.completion);
  assert.equal(queued.ttft - base.ttft, 3);
  assert.deepEqual(queued.itl, base.itl);
});

test("packed rows preserve request identity and bounded queue counts rejected arrivals", () => {
  const original = packedBatch(), reversed = packedBatch(true);
  assert.deepEqual(original.offsets, [0, 3, 4]);
  assert.deepEqual(reversed.offsets, [0, 1, 4]);
  assert.deepEqual(original.slots.map((s) => `${s.id}:${s.position}`).sort(), reversed.slots.map((s) => `${s.id}:${s.position}`).sort());
  for (const limit of [0, 1, 2]) {
    const q = boundedQueue(limit, 3);
    assert.equal(q.accepted + q.rejected, 7);
    for (const r of q.rows.filter((r) => r.accepted)) {
      const alreadyWaiting = q.rows.filter((p) => p.accepted && p.id < r.id && p.start > r.arrival).length;
      if (r.wait) assert.ok(alreadyWaiting < limit);
      assert.equal(r.end - r.start, 3);
    }
  }
});

test("scheduler enforces both token budget and physical block capacity", () => {
  for (const budget of [4, 8]) for (const capacity of [2, 16]) {
    for (const round of scheduleTrace(budget, capacity)) {
      assert.equal(round.chosen.reduce((n, r) => n + r.n, 0) + round.left, budget);
      assert.equal(round.requests.reduce((n, r) => n + r.blocks, 0) + round.free, capacity);
      assert.ok(round.free >= 0);
      round.requests.forEach((r) => assert.ok(r.blocks * 4 >= r.computed));
    }
  }
});

test("pipeline retains batch dependencies and ring boundaries preserve coordinate sums", () => {
  assert.equal(pipeline(2, 3, [1, 1]).total, 4);
  assert.equal(pipeline(2, 3, [1, 2]).total, 7);
  for (const ranks of [2, 4]) {
    const initial = ringState(ranks, 0), scatter = ringState(ranks, 1), gathered = ringState(ranks, 2);
    const expected = [0, 1, 2, 3].map((i) => initial.input.reduce((s, row) => s + row[i], 0));
    assert.deepEqual(scatter.state.flat().filter((v) => v !== null), expected);
    gathered.state.forEach((row) => assert.deepEqual(row, expected));
    assert.equal(gathered.sendBytes, 2 * (ranks - 1) * (16 / ranks));
  }
});

test("banks count distinct words; resource residency does not prove eligible warps", () => {
  assert.equal(banks(1).maxConflict, 32);
  assert.equal(banks(2).maxConflict, 1);
  assert.equal(banks(3).maxConflict, 1);
  assert.equal(new Set(banks(3).words).size, 1);
  assert.equal(residency(32, 8).blocks, 4);
  assert.equal(residency(96, 8).blocks, 2);
  assert.equal(warpTrace(4)[7].ready.length, 0);
  assert.equal(warpTrace(1)[4].issued, warpTrace(4)[4].issued);
});

test("speculation reconstructs target mass and quantized execution preserves decoded weights", () => {
  for (const mode of ["close", "far"]) {
    const d = speculative(mode);
    d.p.forEach((p, i) => assert.ok(Math.abs(d.accepted[i] + (1 - d.accept) * d.residual[i] - p) < 1e-12));
  }
  for (const materialize of [false, true]) {
    const d = quantizedExecution(materialize);
    assert.equal(d.output, -3.5);
    assert.equal(d.output, d.scale * d.codes.reduce((sum, code, i) => sum + code * d.input[i], 0));
    assert.equal(d.concurrentWeightBytes, d.codeBytes + d.scaleBytes + d.temporaryBytes);
  }
  const m = measurement(true);
  assert.equal(m.meanB, 10.4);
  assert.equal(m.medianB, 8);
});

test("placement changes cross-node traffic and quotas change recipients without creating budget", () => {
  assert.equal(ringTopology(false).crossNodeBytes, 48);
  assert.equal(ringTopology(true).crossNodeBytes, 96);
  assert.equal(ringTopology(false).totalBytes, ringTopology(true).totalBytes);
  for (const fair of [false, true]) {
    const round = quotaRound(fair);
    assert.equal(round.granted.A + round.granted.B, round.budget);
    for (const id of ["A", "B"]) assert.equal(round.granted[id] + round.remaining[id], round.pending[id]);
  }
});

test("closed-loop pressure changes arrival times without speeding up the server", () => {
  const open = arrivalModes(false), closed = arrivalModes(true);
  assert.deepEqual(open.map((r) => r.response), [3, 5, 7, 9]);
  assert.deepEqual(closed.map((r) => r.response), [3, 3, 3, 3]);
  assert.deepEqual(open.map((r) => r.finish), closed.map((r) => r.finish));
  assert.deepEqual(closed.map((r) => r.arrival), [0, 3, 6, 9]);
  for (const r of [...open,...closed]) assert.equal(r.finish-r.start, 3);
});
