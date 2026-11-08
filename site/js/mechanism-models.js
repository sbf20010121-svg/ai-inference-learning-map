/** Small executable mechanisms. Every timing is synthetic, never a hardware benchmark. */
import {
  TOKENS,
  zeros,
  scale,
  rowvec,
  outer,
  add,
  affineToken,
  compose,
  applyAffine,
} from "./research-models.js";
import {
  moeScores,
  tokenGPU,
  expertGPU,
  robotTimeline,
} from "./research-expansion-model.js";
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const sm = (a) => {
  const m = Math.max(...a),
    e = a.map((x) => Math.exp(x - m));
  return e.map((x) => x / sum(e));
};
export function deltaTrace({
  beta = 0.5,
  gamma = 1,
  rule = "delta",
  keys = "orthogonal",
} = {}) {
  const tokens = TOKENS.map((t) => ({ ...t, k: [...t.k] }));
  if (keys === "mixed") tokens[1].k = [Math.SQRT1_2, Math.SQRT1_2];
  let S = zeros();
  const trace = [
    {
      S,
      old: zeros(),
      decayed: zeros(),
      pred: [0, 0],
      residual: [0, 0],
      write: zeros(),
      out: [0, 0],
    },
  ];
  for (const t of tokens) {
    const old = S,
      decayed = scale(old, gamma),
      pred = rowvec(t.k, decayed),
      residual = rule === "delta" ? t.v.map((x, j) => x - pred[j]) : t.v;
    const write = scale(outer(t.k, residual), beta);
    S = add(decayed, write);
    trace.push({
      t,
      old,
      decayed,
      pred,
      residual,
      write,
      S,
      out: rowvec(t.q, S),
    });
  }
  const a = affineToken(tokens[0], beta, gamma),
    b = affineToken(tokens[1], beta, gamma),
    combined = compose(b, a),
    reversed = compose(a, b);
  return {
    tokens,
    trace,
    a,
    b,
    combined,
    chunk: applyAffine(combined, zeros()),
    reversed: applyAffine(reversed, zeros()),
  };
}
export function onlineTrace(high = 3) {
  const scores = [1, 2, high, 0],
    values = [2, 4, -1, 5];
  let m = -Infinity,
    l = 0,
    a = 0;
  const trace = [{ m, l, a, out: null, alpha: 0, weights: [] }];
  for (let t = 0; t < 2; t++) {
    const s = scores.slice(t * 2, t * 2 + 2),
      v = values.slice(t * 2, t * 2 + 2),
      mn = Math.max(m, ...s),
      alpha = Number.isFinite(m) ? Math.exp(m - mn) : 0,
      w = s.map((x) => Math.exp(x - mn));
    const old = { m, l, a };
    l = alpha * l + sum(w);
    a = alpha * a + sum(w.map((x, i) => x * v[i]));
    m = mn;
    trace.push({ m, l, a, out: a / l, alpha, old, weights: w });
  }
  const weights = sm(scores),
    direct = sum(weights.map((w, i) => w * values[i]));
  return { scores, values, trace, weights, direct };
}
/** Ungated Delta Rule, S0=0: (I+L)D=βV; K is [C,K], D is [C,V]. */
export function deltaChunkSolve(beta = 0.5, keys = "mixed") {
  const { tokens } = deltaTrace({ beta, keys });
  const K = tokens.map((t) => t.k),
    V = tokens.map((t) => t.v);
  const L = K.map((ki, i) =>
    K.map((kj, j) => (j < i ? beta * sum(ki.map((x, k) => x * kj[k])) : 0)),
  );
  const rhs = V.map((v) => v.map((x) => beta * x)),
    D = [];
  for (let i = 0; i < K.length; i++)
    D.push(
      rhs[i].map(
        (x, v) => x - sum(L[i].slice(0, i).map((l, j) => l * D[j][v])),
      ),
    );
  const S = [0, 1].map((k) =>
    [0, 1].map((v) => sum(K.map((ki, i) => ki[k] * D[i][v]))),
  );
  return { K, V, L, rhs, D, S };
}
export function scheduleTrace(budget = 8, capacity = 16) {
  const requests = [
    { id: "A", prompt: 0, computed: 6, blocks: 2 },
    { id: "B", prompt: 6, computed: 0, blocks: 0 },
    { id: "C", prompt: 4, computed: 0, blocks: 0 },
  ];
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    let left = budget,
      free = capacity - sum(requests.map((r) => r.blocks));
    const chosen = [],
      rejected = [];
    for (const r of requests) {
      const pending = r.prompt > r.computed ? r.prompt - r.computed : 1,
        n = Math.min(pending, left);
      if (!n) continue;
      const extra = Math.max(0, Math.ceil((r.computed + n) / 4) - r.blocks);
      if (extra > free) {
        rejected.push({ id: r.id, n, extra, free });
        continue;
      }
      chosen.push({
        id: r.id,
        n,
        kind: r.prompt > r.computed ? "prefill" : "decode",
        before: r.computed,
        extra,
      });
      r.computed += n;
      r.blocks += extra;
      free -= extra;
      left -= n;
    }
    rounds.push({
      round: round + 1,
      budget,
      used: budget - left,
      left,
      chosen,
      rejected,
      free,
      requests: requests.map((r) => ({
        ...r,
        pending: Math.max(0, r.prompt - r.computed),
      })),
    });
  }
  return rounds;
}
export function expertTrace(k = 2) {
  const routes = moeScores.map((scores, t) => {
    const ids = [0, 1, 2].sort((a, b) => scores[b] - scores[a]).slice(0, k);
    return {
      t,
      src: tokenGPU[t],
      scores,
      ids,
      weights: sm(ids.map((e) => scores[e])),
    };
  });
  const records = routes.flatMap((r) =>
    r.ids.map((e, i) => ({
      t: r.t,
      e,
      src: r.src,
      dst: expertGPU[e],
      w: r.weights[i],
      output: (r.t + 1) * (e + 2),
    })),
  );
  const buckets = [0, 1, 2].map((e) => ({
    e,
    gpu: expertGPU[e],
    records: records.filter((r) => r.e === e),
  }));
  return {
    routes,
    records,
    buckets,
    remote: records.filter((r) => r.src !== r.dst),
    combined: routes.map((r) =>
      sum(records.filter((x) => x.t === r.t).map((x) => x.w * x.output)),
    ),
  };
}
export function fusionTrace(fused = true, externalUse = false) {
  const x = [-2, -1, 1, 2],
    u = x.map((x) => 2 * x),
    v = u.map((x) => x + 1),
    y = v.map((x) => Math.max(0, x));
  const intermediateWrites = fused
    ? externalUse
      ? x.length
      : 0
    : 2 * x.length;
  return {
    x,
    u,
    v,
    y,
    reads: fused ? x.length : 3 * x.length,
    writes: x.length + intermediateWrites,
    kernels: fused ? 1 : 3,
    externalUse,
  };
}
export function tileTrace(bm = 2, kStep = 1) {
  const A = [
      [1, 2, 0, 1],
      [0, 1, 2, 0],
      [1, 0, 1, 2],
      [2, 1, 0, 1],
    ],
    B = [
      [1, 0, 2, 1],
      [0, 1, 1, 0],
      [1, 1, 0, 2],
      [2, 0, 1, 1],
    ],
    K = Math.min(4, kStep * 2);
  const C = A.map((row) =>
    B[0].map((_, j) => sum(row.slice(0, K).map((x, k) => x * B[k][j]))),
  );
  return { A, B, C, K, bm, bn: 2, grid: Math.ceil(4 / bm) * 2 };
}
export function queueTrace(service = 2) {
  const arrivals = [0, 1, 2, 3];
  let end = 0;
  return arrivals.map((arrival, id) => {
    const start = Math.max(arrival, end);
    end = start + service;
    return {
      id,
      arrival,
      start,
      end,
      wait: start - arrival,
      response: end - arrival,
    };
  });
}
export function rotor(angle = 90) {
  const theta = (angle * Math.PI) / 180;
  return { x: Math.cos(theta), y: Math.sin(theta), theta };
}
export function quantize(scale = 0.25, outlier = false) {
  const x = [-1, -0.2, 0.3, outlier ? 3 : 1],
    q = x.map((v) => Math.max(-7, Math.min(7, Math.round(v / scale)))),
    restored = q.map((v) => v * scale);
  return {
    x,
    q,
    restored,
    error: x.map((v, i) => Math.abs(v - restored[i])),
    scale,
  };
}
export function flowTrace(steps = 4) {
  let a = -1;
  const trace = [a],
    dt = 1 / steps;
  for (let i = 0; i < steps; i++) {
    a += dt * (1 - a);
    trace.push(a);
  }
  return { trace, dt, target: 1 };
}
export function flowSample(tau = 0, target = [1, 1]) {
  const noise = [-1, 0.5];
  return {
    noise,
    target,
    tau,
    current: target.map((x, i) => tau * x + (1 - tau) * noise[i]),
    velocity: target.map((x, i) => x - noise[i]),
  };
}
export function rssmStep(imagine = false, observation = 0) {
  const h = Math.tanh(0.5 * 0.2 + 0.2 * 1 + 0.1),
    prior = sm([h, -h]),
    sign = observation ? -1 : 1,
    posterior = sm([h + sign, -h - sign]);
  return { h, prior, posterior, probs: imagine ? prior : posterior };
}
export function speculative(qMode = "close") {
  const p = [0.6, 0.3, 0.1],
    q = qMode === "close" ? [0.5, 0.4, 0.1] : [0.1, 0.1, 0.8],
    accepted = p.map((x, i) => Math.min(x, q[i])),
    accept = sum(accepted),
    residual = p.map((x, i) => Math.max(x - q[i], 0)),
    z = sum(residual);
  return {
    p,
    q,
    accepted,
    accept,
    residual: residual.map((x) => x / z),
    reconstructed: accepted.map((x, i) => x + ((1 - accept) * residual[i]) / z),
  };
}
export const robotQueue = (mode = "async", latency = 4, trigger = 4) =>
  robotTimeline(mode === "async", latency, 6, trigger, 18);
export function warpTrace(count = 1) {
  return Array.from({ length: 8 }, (_, cycle) => ({
    cycle,
    ready:
      cycle === 0
        ? ["W0"]
        : cycle === 4
          ? ["W0"]
          : cycle < count && cycle < 4
            ? [`W${cycle}`]
            : [],
    issued:
      cycle === 0
        ? "W0 LD"
        : cycle === 4
          ? "W0 ADD"
          : cycle < count && cycle < 4
            ? `W${cycle} 独立算术`
            : "空槽",
    wait: cycle > 0 && cycle < 4 ? 4 - cycle : 0,
  }));
}
