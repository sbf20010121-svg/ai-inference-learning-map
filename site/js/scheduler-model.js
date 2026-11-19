/** A synchronous teaching schedule, not a reproduction of vLLM policy or timing. */
export const schedulerScenario = Object.freeze({
  id: "three-request-main",
  defaultBudget: 8,
  defaultCapacity: 16,
  blockSize: 4,
  // A's prompt is already complete; prompt=0 means no outstanding prompt in this snapshot.
  // Its next sampled token is known, but position 6 has not run through the model yet.
  requests: Object.freeze([
    Object.freeze({ id: "A", prompt: 0, computed: 6, blocks: 2 }),
    Object.freeze({ id: "B", prompt: 6, computed: 0, blocks: 0 }),
    Object.freeze({ id: "C", prompt: 4, computed: 0, blocks: 0 }),
  ]),
});

function snapshot(request) {
  const promptPending = Math.max(0, request.prompt - request.computed);
  return {
    ...request,
    pending: promptPending, // Existing callers use pending specifically for unfinished prompt positions.
    promptPending,
    kind: promptPending ? "prefill" : "decode",
    nextInput: promptPending || 1,
  };
}

export function scheduleTrace(
  budget = schedulerScenario.defaultBudget,
  capacity = schedulerScenario.defaultCapacity,
  count = 3,
) {
  if (!Number.isInteger(budget) || budget < 1) throw Error("scheduler budget must be a positive integer");
  if (!(capacity === Infinity || (Number.isInteger(capacity) && capacity >= 2))) throw Error("scheduler capacity must cover A's initial two blocks");
  if (!Number.isInteger(count) || count < 0) throw Error("scheduler round count must be a nonnegative integer");
  const requests = schedulerScenario.requests.map((request) => ({ ...request }));
  const rounds = [];
  for (let round = 0; round < count; round++) {
    const beforeRequests = requests.map(snapshot);
    let left = budget;
    let free = capacity - requests.reduce((total, request) => total + request.blocks, 0);
    const freeBefore = free, chosen = [], rejected = [], decisions = [];
    for (const request of requests) {
      const before = snapshot(request);
      const candidate = Math.min(before.nextInput, left);
      const extra = Math.max(0, Math.ceil((before.computed + candidate) / schedulerScenario.blockSize) - before.blocks);
      const reason = !candidate ? "budget" : extra > free ? "kv" : "scheduled";
      const scheduled = reason === "scheduled" ? candidate : 0;
      const decision = {
        id: request.id,
        kind: before.kind,
        requested: before.nextInput,
        candidate,
        scheduled,
        reason,
        before: before.computed,
        blocksBefore: before.blocks,
        budgetBefore: left,
        freeBefore: free,
        extra,
      };
      if (reason === "kv") rejected.push({ id: request.id, n: candidate, extra, free });
      if (scheduled) {
        chosen.push({ id: request.id, n: scheduled, kind: before.kind, before: before.computed, extra });
        request.computed += scheduled;
        request.blocks += extra;
        free -= extra;
        left -= scheduled;
      }
      decisions.push({ ...decision, budgetAfter: left, freeAfter: free });
    }
    rounds.push({
      round: round + 1,
      budget,
      capacity,
      used: budget - left,
      left,
      chosen,
      rejected,
      decisions,
      freeBefore,
      free,
      beforeRequests,
      // This snapshot is AFTER the selected model computations complete, not at enqueue time.
      requests: requests.map(snapshot),
    });
  }
  return rounds;
}
