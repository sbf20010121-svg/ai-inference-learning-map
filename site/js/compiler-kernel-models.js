/** Small teaching objects. No compiler, GPU, storage or network is invoked. */
export function ssaAssignments(input = 2) {
  return [
    { name: "%x0", source: "x = input", value: input },
    { name: "%u", source: "x = x * 2", value: input * 2 },
    { name: "%v", source: "x = x + 1", value: input * 2 + 1 },
  ];
}

/** Three significant decimal digits, deliberately not an IEEE format emulator. */
export function fusionRounding(keepIntermediateRounding = true) {
  const round = (x) => Number(x.toPrecision(3));
  const wideIntermediate = 1000 + 0.4;
  const storedIntermediate = keepIntermediateRounding
    ? round(wideIntermediate)
    : wideIntermediate;
  return {
    wideIntermediate,
    storedIntermediate,
    output: round(storedIntermediate - 1000),
  };
}

/** Same legal [B,4] interface and weights, different runtime input values. */
export function engineInvocation(batch = 6, offset = 0) {
  if (!Number.isInteger(batch) || batch < 1 || batch > 8)
    throw new RangeError("teaching profile requires integer 1<=B<=8");
  const inputs = Array.from({ length: batch }, (_, i) => [i + offset, 1, 2, 3]);
  const weights = [[1, 0], [0, 1], [1, 0], [0, 1]];
  const outputs = inputs.map((row) =>
    [0, 1].map((j) => row.reduce((sum, x, k) => sum + x * weights[k][j], 0)),
  );
  return { inputs, weights, outputs, inputShape: [batch, 4], outputShape: [batch, 2] };
}

/** Residual add + RMSNorm: logical element IO, not DRAM traffic or speed. */
export function residualRmsFusion(fused = true, external = false) {
  const x = [1, 2], residual = [2, 2], gamma = [1, 1], epsilon = 1e-5;
  const sum = x.map((v, i) => v + residual[i]);
  const squares = sum.map((v) => v * v);
  const meanSquare = squares.reduce((a, b) => a + b, 0) / sum.length;
  const denominator = Math.sqrt(meanSquare + epsilon);
  const output = sum.map((v, i) => (v / denominator) * gamma[i]);
  const H = sum.length;
  return {
    x, residual, gamma, epsilon, sum, squares, meanSquare, denominator, output,
    reads: (fused ? 3 : 4) * H,
    writes: (fused && !external ? 1 : 2) * H,
    materializeSum: !fused || external,
    kernels: fused ? 1 : 2,
  };
}
