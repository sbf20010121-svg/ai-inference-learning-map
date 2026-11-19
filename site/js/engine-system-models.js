/** Small, deterministic teaching models. No runtime/GPU simulation or storage. */
export function requestLifecycle(cancelled = false, step = 0) {
  const phase = Math.max(0, Math.min(3, step));
  const inFlight = phase < 2;
  const terminal = phase >= 2 || (cancelled && phase >= 1);
  const released = phase === 3;
  return {
    phase,
    event: ["批次 [B,A] 已提交", cancelled ? "收到取消 A" : "A 仍在执行", "设备完成事件已确认", "释放 A 的请求引用"][phase],
    state: cancelled && phase >= 1 ? "cancelled" : phase >= 2 ? "finished" : "running",
    inFlight,
    terminal,
    delivered: phase >= 2 && !cancelled,
    ignored: phase >= 2 && cancelled,
    blocks: [
      { id: "P3", owners: released ? ["B"] : ["A", "B"], refs: released ? 1 : 2, reusable: false },
      { id: "P7", owners: released ? [] : ["A"], refs: released ? 0 : 1, reusable: released && !inFlight },
    ],
  };
}

export function asyncRounds(overlap = false, count = 3, cpu = 2, gpu = 4) {
  const rounds = [];
  for (let n = 0; n < count; n++) {
    const previous = rounds[n - 1];
    const prepareStart = previous ? overlap ? previous.gpuStart : previous.gpuEnd : 0;
    const prepareEnd = prepareStart + cpu;
    const tokenReady = previous?.gpuEnd ?? 0;
    const gpuStart = Math.max(prepareEnd, tokenReady);
    rounds.push({ n, prepareStart, prepareEnd, tokenReady, gpuStart, gpuEnd: gpuStart + gpu });
  }
  return { rounds, total: rounds.at(-1)?.gpuEnd ?? 0, steady: overlap ? Math.max(cpu, gpu) : cpu + gpu };
}

export function streamingMetrics(extraWait = 0) {
  // Artificial milliseconds. A single request, three emitted tokens; no benchmark.
  const arrival = 0, start = 1 + extraWait;
  const emitted = [3, 5, 9].map((t) => t + extraWait);
  return {
    arrival, start, emitted,
    wait: start - arrival,
    ttft: emitted[0] - arrival,
    itl: emitted.slice(1).map((t, i) => t - emitted[i]),
    completion: emitted.at(-1) - arrival,
  };
}

export function quantizedExecution(materialize = false) {
  // Signed integer codes with one scalar scale, not a complete FP8/FP4 encoding.
  const codes = [2, -4, 1, 0], scale = 0.5, input = [1, 2, -1, 3];
  const weights = codes.map((q) => q * scale);
  const partials = weights.map((w, i) => w * input[i]);
  return {
    codes, scale, input, weights, partials,
    output: partials.reduce((a, b) => a + b, 0),
    codeBytes: 4, scaleBytes: 4,
    temporaryBytes: materialize ? 16 : 0,
    concurrentWeightBytes: materialize ? 24 : 8,
  };
}

export function ringTopology(interleaved = false) {
  const nodes = interleaved ? [0, 1, 0, 1] : [0, 0, 1, 1];
  const edges = nodes.map((node, from) => ({ from, to: (from + 1) % 4, sourceNode: node, targetNode: nodes[(from + 1) % 4], bytes: 24 }));
  return { nodes, edges, totalBytes: 96, crossNodeBytes: edges.filter((edge) => edge.sourceNode !== edge.targetNode).reduce((n, edge) => n + edge.bytes, 0) };
}

export function quotaRound(fair = false) {
  const budget = 8, pending = { A: 12, B: 2 }, granted = { A: fair ? 6 : 8, B: fair ? 2 : 0 };
  return { budget, pending, granted, remaining: { A: pending.A - granted.A, B: pending.B - granted.B } };
}

export function arrivalModes(closed = false) {
  const rows = [];
  let finish = 0;
  for (let id = 0; id < 4; id++) {
    const arrival = closed ? finish : id;
    const start = Math.max(arrival, finish);
    finish = start + 3;
    rows.push({ id, arrival, start, finish, wait: start - arrival, response: finish - arrival });
  }
  return rows;
}
