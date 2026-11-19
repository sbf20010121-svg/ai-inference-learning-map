import test from "node:test";
import assert from "node:assert/strict";
import { schedulerScenario, scheduleTrace } from "../site/js/scheduler-model.js";
import { schedulerRounds, schedRequests } from "../site/js/research-expansion-model.js";

const allocation = (round) => ["A", "B", "C"].map(id => round.chosen.find(r => r.id === id)?.n || 0);
const request = (rows, id) => rows.find(r => r.id === id);

test("scheduler snapshots identify the three requests and preserve each completed round", () => {
  const rounds = scheduleTrace();
  assert.equal(schedulerScenario.blockSize, 4);
  assert.deepEqual(rounds[0].beforeRequests.map(r => [r.id, r.computed, r.promptPending, r.blocks]), [
    ["A", 6, 0, 2], ["B", 0, 6, 0], ["C", 0, 4, 0],
  ]);
  assert.deepEqual(rounds.map(allocation), [[1, 6, 1], [1, 1, 3], [1, 1, 1]]);
  assert.deepEqual(rounds.map(r => r.used), [8, 5, 3]);
  assert.deepEqual(rounds.map(r => r.left), [0, 3, 5]);
  assert.deepEqual(rounds[0].requests.map(r => r.computed), [7, 6, 1]);
  assert.deepEqual(rounds[1].beforeRequests, rounds[0].requests);
  assert.deepEqual(rounds[2].beforeRequests, rounds[1].requests);
  assert.notStrictEqual(rounds[1].beforeRequests[0], rounds[0].requests[0]);
  // Replaying a different condition must not mutate either the shared setup or prior results.
  scheduleTrace(4, 2, 8);
  assert.deepEqual(rounds[0].requests.map(r => r.computed), [7, 6, 1]);
  assert.deepEqual(schedulerScenario.requests.map(r => r.computed), [6, 0, 0]);
});

test("finishing a prompt leaves the sampled token for the next round's model input", () => {
  const rounds = scheduleTrace();
  const firstB = request(rounds[0].beforeRequests, "B"), secondB = request(rounds[1].beforeRequests, "B");
  assert.deepEqual([firstB.kind, firstB.promptPending, firstB.nextInput], ["prefill", 6, 6]);
  assert.deepEqual([secondB.kind, secondB.computed, secondB.promptPending, secondB.nextInput], ["decode", 6, 0, 1]);
  assert.equal(rounds[0].chosen.find(r => r.id === "B").n, 6, "the first sampled token is not a seventh computed input in that same round");
  assert.equal(rounds[1].chosen.find(r => r.id === "B").before, 6, "the next compute position is p6");
  const thirdC = request(rounds[2].beforeRequests, "C");
  assert.deepEqual([thirdC.kind, thirdC.computed, thirdC.promptPending, thirdC.nextInput], ["decode", 4, 0, 1]);
});

test("budget exhaustion and KV rejection have different observable decisions", () => {
  const budgetLimited = scheduleTrace(4, 16);
  assert.deepEqual(budgetLimited.map(allocation), [[1, 3, 0], [1, 3, 0], [1, 1, 2]]);
  const waitingC = budgetLimited[0].decisions.find(r => r.id === "C");
  assert.deepEqual([waitingC.reason, waitingC.requested, waitingC.budgetBefore, waitingC.scheduled], ["budget", 4, 0, 0]);
  assert.equal(budgetLimited[0].free, 13, "unused KV does not replace missing compute budget");

  const cacheLimited = scheduleTrace(8, 2);
  assert.deepEqual(cacheLimited.map(allocation), [[1, 0, 0], [1, 0, 0], [0, 0, 0]]);
  for (const id of ["B", "C"]) {
    const rejected = cacheLimited[0].decisions.find(r => r.id === id);
    assert.equal(rejected.reason, "kv");
    assert.equal(rejected.scheduled, 0);
    assert.equal(rejected.budgetBefore, 7);
    assert.equal(rejected.budgetAfter, 7, "a rejected request consumes no compute positions");
  }
  assert.deepEqual([cacheLimited[2].used, cacheLimited[2].left, cacheLimited[2].free], [0, 8, 0]);
  assert.deepEqual(cacheLimited[2].requests, cacheLimited[2].beforeRequests, "no request advances when every new allocation fails");
  assert.equal(cacheLimited[2].decisions[0].extra, 1, "A needs a new block after its first two blocks contain eight computed positions");
});

test("the visible decision sequence retains the state on both sides of every allocation", () => {
  for (const [budget, capacity] of [[8, 16], [4, 16], [8, 2]]) {
    for (const round of scheduleTrace(budget, capacity)) {
      assert.equal(round.decisions[0].budgetBefore, budget, "the budget resets at the start of each round");
      assert.equal(round.decisions[0].freeBefore, round.freeBefore);
      for (let i = 0; i < round.decisions.length; i++) {
        const decision = round.decisions[i];
        const before = request(round.beforeRequests, decision.id), after = request(round.requests, decision.id);
        assert.equal(after.computed - before.computed, decision.scheduled);
        assert.equal(decision.budgetBefore - decision.budgetAfter, decision.scheduled);
        assert.equal(after.blocks - before.blocks, decision.freeBefore - decision.freeAfter);
        assert.ok(decision.scheduled <= before.nextInput);
        if (i > 0) {
          assert.equal(decision.budgetBefore, round.decisions[i - 1].budgetAfter);
          assert.equal(decision.freeBefore, round.decisions[i - 1].freeAfter);
        }
      }
      assert.equal(round.decisions.at(-1).budgetAfter, round.left);
      assert.equal(round.decisions.at(-1).freeAfter, round.free);
    }
  }
});

test("the course animation and detailed scheduler use the same request setup and allocations", () => {
  const initial = scheduleTrace()[0].beforeRequests;
  assert.deepEqual(schedRequests.map(r => [r.id, r.promptPending, r.kind.toLowerCase()]), initial.map(r => [r.id, r.promptPending, r.kind]));
  for (const budget of [4, 8]) {
    // This legacy animation intentionally omits the KV limit; long replays must stay budget-only.
    const detailed = scheduleTrace(budget, Infinity, 20), course = schedulerRounds(budget, 20);
    assert.equal(course.length, detailed.length);
    course.forEach((round, i) => {
      assert.deepEqual(round.chosen.map(r => [r.id, r.n, r.kind.toLowerCase()]), detailed[i].chosen.map(r => [r.id, r.n, r.kind]));
      assert.deepEqual(round.remaining, { B: request(detailed[i].requests, "B").promptPending, C: request(detailed[i].requests, "C").promptPending });
      assert.equal(round.used, detailed[i].used);
      assert.equal(round.free, detailed[i].left);
    });
  }
});
