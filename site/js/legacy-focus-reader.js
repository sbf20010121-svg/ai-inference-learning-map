/** Legacy record compatibility only. No old seven-page UI is rendered. */
export const FOCUS_PAGES = [
  { label: "先看懂", hint: "它是什么" },
  { label: "运行机制", hint: "一步步怎么做" },
  { label: "具体例子", hint: "数据怎样变化" },
  { label: "自己判断", hint: "能否举一反三" },
  { label: "记住重点", hint: "巩固与下一步" },
  { label: "源码追踪", hint: "可选深入" },
  { label: "性能验证", hint: "可选深入" },
];
export function normalizeReaderRecord(raw = {}, size = 7) {
  const last = Number.isInteger(raw.readerStep) ? raw.readerStep : 0;
  const visited = Array.isArray(raw.seenSteps)
    ? raw.seenSteps.filter((n) => Number.isInteger(n) && n >= 0 && n < size)
    : [];
  const visitedSubsteps = Array.isArray(raw.seenSubsteps)
    ? raw.seenSubsteps.filter((n) => Number.isInteger(n) && n >= 0 && n < 12)
    : [];
  return {
    readerStep: Math.max(0, Math.min(size - 1, last)),
    readerSubstep: Math.max(
      0,
      Math.min(11, Number.isInteger(raw.readerSubstep) ? raw.readerSubstep : 0),
    ),
    seenSteps: [...new Set(visited)],
    seenSubsteps: [...new Set(visitedSubsteps)],
  };
}
export const getReaderCounts = (r, stageCount = 1) => ({
  core: (r.seenSteps || []).filter(
    (n) =>
      n >= 0 &&
      n < 5 &&
      (n !== 1 || (r.seenSubsteps || []).length >= stageCount),
  ).length,
  advanced: (r.seenSteps || []).filter((n) => n >= 5 && n < 7).length,
});
