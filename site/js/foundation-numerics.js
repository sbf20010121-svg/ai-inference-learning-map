/** Executable reference objects, independent of DOM, storage, network and device APIs. */
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export const mm = (A, B) =>
  A.map((row) => transpose(B).map((col) => dot(row, col)));
export const total = (a) => a.reduce((s, x) => s + x, 0);
export const softmax = (a, T = 1) => {
  const m = Math.max(...a),
    e = a.map((x) => Math.exp((x - m) / T)),
    z = total(e);
  return e.map((x) => x / z);
};
export const cumsum = (a) => a.map((_, i) => total(a.slice(0, i + 1)));
export function sampling(T = 1, p = 0.8, k = 4) {
  const probabilities = softmax([0.6, 0.25, 0.1, 0.05].map(Math.log), T),
    order = [0, 1, 2, 3].sort((a, b) => probabilities[b] - probabilities[a]);
  let mass = 0;
  const keep = [];
  for (const i of order.slice(0, k)) {
    keep.push(i);
    mass += probabilities[i];
    if (mass >= p) break;
  }
  const filtered = probabilities.map((x, i) =>
    keep.includes(i) ? x / mass : 0,
  );
  return { probabilities, order, keep, mass, filtered, cdf: cumsum(filtered) };
}
export function addressView(transposed = false, mutate = false) {
  const storage = [0, 1, 2, 3, 4, mutate ? 99 : 5],
    shape = transposed ? [3, 2] : [2, 3],
    strides = transposed ? [1, 3] : [3, 1];
  const addresses = Array.from({ length: shape[0] }, (_, i) =>
    Array.from({ length: shape[1] }, (_, j) => i * strides[0] + j * strides[1]),
  );
  return {
    storage,
    shape,
    strides,
    addresses,
    values: addresses.map((r) => r.map((i) => storage[i])),
  };
}
export function liveAllocation(late = false) {
  const intervals = [
      { id: "a", start: 0, end: late ? 5 : 3 },
      { id: "b", start: 2, end: 5 },
      { id: "c", start: 4, end: 6 },
    ],
    ends = [];
  const allocated = intervals.map((v) => {
    let slot = ends.findIndex((e) => e < v.start);
    if (slot < 0) slot = ends.length;
    ends[slot] = v.end;
    return { ...v, slot };
  });
  const pressure = Array.from(
    { length: 7 },
    (_, t) => intervals.filter((v) => v.start <= t && v.end >= t).length,
  );
  return { allocated, pressure, slots: ends.length };
}
export function shapeCache(dynamic = false) {
  const batches = [2, 4, 2, 8],
    cache = new Set(),
    rows = batches.map((B) => {
      const key = dynamic ? "1<=B<=8,H=4" : `B=${B},H=4`,
        hit = cache.has(key);
      cache.add(key);
      return { B, key, hit };
    });
  return {
    rows,
    versions: cache.size,
    valid: (B) => (dynamic ? B >= 1 && B <= 8 : cache.has(`B=${B},H=4`)),
  };
}
export function loopPoints(tile = 2, swap = false) {
  const points = [];
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k0 = 0; k0 < 3; k0 += tile)
        for (let k = k0; k < Math.min(3, k0 + tile); k++)
          points.push([i, j, k]);
  if (swap) points.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
  return points;
}
export function patchify(size = 4, patch = 2) {
  const image = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => r * size + c),
  );
  const patches = [];
  for (let r = 0; r < size; r += patch)
    for (let c = 0; c < size; c += patch)
      patches.push(
        Array.from(
          { length: patch * patch },
          (_, i) => image[r + Math.floor(i / patch)][c + (i % patch)],
        ),
      );
  return { image, patches, tokens: patches.length, flatWidth: patch * patch };
}
export function attentionPattern(window = 3, layers = 1) {
  const direct = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) =>
      Number(Math.max(0, i - window + 1) <= j && j <= i),
    ),
  );
  let reachable = direct;
  for (let n = 1; n < layers; n++)
    reachable = direct.map((row, i) =>
      row.map((_, j) => Number(row.some((v, k) => v && reachable[k][j]))),
    );
  return { direct, reachable, pairs: total(direct.flat()) };
}
export function packedBatch(reverse = false) {
  const requests = reverse
      ? [
          ["B", 1],
          ["A", 3],
        ]
      : [
          ["A", 3],
          ["B", 1],
        ],
    offsets = [0],
    slots = [];
  for (const [id, n] of requests) {
    for (let p = 0; p < n; p++) slots.push({ id, position: p });
    offsets.push(slots.length);
  }
  return {
    requests,
    offsets,
    slots,
    padded: Math.max(...requests.map((r) => r[1])) * requests.length,
  };
}
export function boundedQueue(limit = 2, service = 3) {
  const rows = [];
  let end = 0;
  for (let id = 0; id < 7; id++) {
    const arrival = id,
      waiting = rows.filter((r) => r.accepted && r.start > arrival).length;
    if (end > arrival && waiting >= limit) {
      rows.push({ id, arrival, accepted: false });
      continue;
    }
    const start = Math.max(arrival, end);
    end = start + service;
    rows.push({
      id,
      arrival,
      accepted: true,
      start,
      end,
      wait: start - arrival,
    });
  }
  return {
    rows,
    accepted: rows.filter((r) => r.accepted).length,
    rejected: rows.filter((r) => !r.accepted).length,
  };
}
export function pipeline(stages = 2, microbatches = 3, durations = [1, 1]) {
  const ends = Array(stages).fill(0),
    trace = [];
  for (let b = 0; b < microbatches; b++)
    for (let stage = 0; stage < stages; stage++) {
      const previous = stage
          ? trace.find((r) => r.batch === b && r.stage === stage - 1).end
          : 0,
        start = Math.max(ends[stage], previous),
        end = start + durations[stage];
      trace.push({ batch: b, stage, start, end });
      ends[stage] = end;
    }
  return { trace, total: Math.max(...ends) };
}
export function scatterExample(duplicate = true) {
  const indices = duplicate ? [1, 0, 1] : [1, 0, 2],
    values = [2, 5, 3],
    out = [0, 0, 0];
  indices.forEach((i, k) => (out[i] += values[k]));
  return { indices, values, out };
}
export function pagedRead(length = 4, permuted = true) {
  const table = permuted ? [3, 1] : [0, 2],
    K = [1, 0, 2, 3],
    V = [2, 4, 1, 3],
    physical = {};
  table.forEach(
    (p, b) =>
      (physical[p] = {
        K: K.slice(b * 2, b * 2 + 2),
        V: V.slice(b * 2, b * 2 + 2),
      }),
  );
  const addresses = Array.from({ length }, (_, t) => [
      table[Math.floor(t / 2)],
      t % 2,
    ]),
    keys = addresses.map(([p, o]) => physical[p].K[o]),
    values = addresses.map(([p, o]) => physical[p].V[o]),
    weights = softmax(keys),
    out = dot(weights, values);
  return {
    table,
    physical,
    addresses,
    keys,
    values,
    weights,
    out,
    reference: dot(softmax(K.slice(0, length)), V.slice(0, length)),
  };
}
export function quantDot(alternate = false) {
  const q = [2, -1, 3, 2],
    scales = alternate ? [0.5, 0.5] : [0.5, 0.25],
    x = [1, 1, 1, 1],
    weights = q.map((v, i) => v * scales[Math.floor(i / 2)]),
    partial = [dot(x.slice(0, 2), q.slice(0, 2)), dot(x.slice(2), q.slice(2))],
    contributions = partial.map((v, g) => v * scales[g]);
  return {
    q,
    scales,
    x,
    weights,
    partial,
    contributions,
    out: total(contributions),
  };
}
export function ringState(ranks = 2, phase = 0) {
  const input = Array.from({ length: ranks }, (_, r) =>
      Array.from({ length: 4 }, (_, i) => r * 4 + i + 1),
    ),
    sum = Array.from({ length: 4 }, (_, i) => total(input.map((r) => r[i]))),
    chunk = 4 / ranks;
  const state =
    phase === 0
      ? input
      : phase === 1
        ? input.map((_, r) =>
            sum.map((x, i) =>
              i >= r * chunk && i < (r + 1) * chunk ? x : null,
            ),
          )
        : input.map(() => sum.slice());
  return { input, sum, state, sendBytes: ((2 * (ranks - 1)) / ranks) * 16 };
}
export function transformPoint(angle = 90) {
  const clean = (x) => (Math.abs(x) < 1e-12 ? 0 : x);
  const t = (angle * Math.PI) / 180,
    R = [
      [clean(Math.cos(t)), clean(-Math.sin(t))],
      [clean(Math.sin(t)), clean(Math.cos(t))],
    ],
    point = [1, 0],
    translation = [1, 2],
    rotated = R.map((row) => dot(row, point));
  return { R, point, translation, rotated, world: add(rotated, translation) };
}
export function actionEncoding(newAnchor = false) {
  const absolute = [10, 11, 12],
    anchor = 10,
    mu = 1,
    sigma = 2,
    relative = absolute.map((a) => a - anchor),
    normalized = relative.map((a) => (a - mu) / sigma),
    restoreAnchor = newAnchor ? 11 : 10,
    restored = normalized.map((z) => restoreAnchor + mu + sigma * z);
  return { absolute, anchor, relative, normalized, restored, restoreAnchor };
}
export function episodeWindow(start = 1) {
  const episode = [0, 0, 0, 1, 1, 1],
    indices = [0, 1, 2].map((k) => start + k),
    valid = indices.map(
      (i) => i < episode.length && episode[i] === episode[start],
    );
  return { episode, indices, valid };
}
export function closedLoop(feedback = false, delay = false) {
  let x = 0;
  const trace = [{ time: 0, x, u: null, d: 0 }];
  for (let t = 0; t < 3; t++) {
    const observed = delay && t > 0 ? trace[t - 1].x : x,
      u = feedback ? Math.max(0, Math.min(1, 3 - observed)) : 1,
      d = t === 0 ? 1 : 0;
    x += u + d;
    trace.push({ time: t + 1, x, u, d });
  }
  return { trace, final: x, error: Math.abs(x - 3) };
}
export function klState(reverse = false) {
  const p = reverse ? [0.7, 0.3] : [0.5, 0.5],
    q = [0.8, 0.2],
    terms = q.map((x, i) => x * Math.log(x / p[i]));
  return { p, q, terms, kl: total(terms) };
}
export function noiseState(alpha = 0.25) {
  const z0 = [2, 1],
    noise = [-1, 1],
    signal = Math.sqrt(alpha),
    noiseScale = Math.sqrt(1 - alpha),
    zt = z0.map((x, i) => signal * x + noiseScale * noise[i]),
    restored = zt.map((x, i) => (x - noiseScale * noise[i]) / signal);
  return { z0, noise, signal, noiseScale, zt, restored };
}
export function banks(mode = 0) {
  const stride = [1, 32, 33, 0][mode],
    words = Array.from({ length: 32 }, (_, i) => i * stride),
    bank = words.map((w) => w % 32),
    sets = Array.from(
      { length: 32 },
      (_, b) => new Set(words.filter((_, i) => bank[i] === b)),
    ),
    different = sets.map((s) => s.size);
  return {
    stride,
    words,
    bank,
    different,
    maxConflict: Math.max(...different),
  };
}
export function residency(registers = 32, shared = 8) {
  const limits = {
      Warp: 8 / 2,
      Registers: Math.floor(16384 / (64 * registers)),
      Shared: Math.floor(32 / shared),
      CTA: 4,
    },
    blocks = Math.min(...Object.values(limits));
  return {
    registers,
    shared,
    limits,
    blocks,
    warps: blocks * 2,
    occupancy: (blocks * 2) / 8,
  };
}
export function measurement(alternate = false) {
  const a = [10, 10, 10, 10, 10],
    b = alternate ? [8, 8, 8, 14, 14] : [30, 10, 10, 10, 10],
    mean = (x) => total(x) / x.length,
    median = (x) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)];
  return {
    a,
    b,
    meanA: mean(a),
    meanB: mean(b),
    medianA: median(a),
    medianB: median(b),
  };
}
export function convolution(stride = 1, padding = 0) {
  const image = Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => i * 4 + j),
    ),
    kernel = [1, 0, 0, 1],
    size = Math.floor((4 + 2 * padding - 2) / stride) + 1,
    windows = [];
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++) {
      const r = i * stride - padding,
        c = j * stride - padding,
        values = Array.from({ length: 4 }, (_, n) => {
          const a = r + Math.floor(n / 2),
            b = c + (n % 2);
          return a >= 0 && a < 4 && b >= 0 && b < 4 ? image[a][b] : 0;
        });
      windows.push({ r, c, values });
    }
  return {
    image,
    kernel,
    size,
    windows,
    out: windows.map((w) => dot(w.values, kernel)),
  };
}
