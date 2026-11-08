import { compilerCourses } from "./foundation-lessons.js";
import { modelCourses } from "./foundation-models.js";
import { engineCourses } from "./foundation-engine.js";
import { kernelCourses } from "./foundation-kernels.js";
import { systemCourses } from "./foundation-systems.js";
import { embodiedCourses } from "./foundation-embodied.js";
import { gpuCourses } from "./foundation-gpu.js";
import { interfaceCourses } from "./foundation-interfaces.js";
export const foundationCourses = [
  ...compilerCourses,
  ...modelCourses,
  ...engineCourses,
  ...kernelCourses,
  ...systemCourses,
  ...embodiedCourses,
  ...gpuCourses,
  ...interfaceCourses,
];
export const foundationById = new Map(foundationCourses.map((c) => [c.id, c]));
const starts = {
  "tensor-address/address": { pick: 5 },
  "tensor-address/transpose": { case: 1, pick: 5 },
  "tensor-address/alias": { case: 1, pick: 5 },
  "generation-state/positions": { step: 1 },
  "generation-state/stop": { step: 3 },
  "vision-patches/resolution": { case: 1 },
  "kv-preemption/evict": { step: 1 },
  "kv-preemption/resume": { step: 2 },
  "async-engine/overlap": { case: 1 },
  "occupancy-resources/counter": { case: 1 },
  "shared-bank/map": { case: 1 },
  "shared-bank/padding": { case: 2 },
  "shared-bank/broadcast": { case: 3 },
  "convolution-lowering/window": { pick: 4 },
  "measurement-stability/distribution": { case: 1 },
};
for (const c of foundationCourses)
  for (const p of c.chapters)
    p.initial = {
      case: 0,
      step: 0,
      pick: 0,
      ...(starts[c.id + "/" + p.id] || {}),
    };

foundationById
  .get("lowbit-formats")
  .chapters.find((p) => p.id === "fp8").evidence = {
  source: "https://arxiv.org/abs/2209.05433",
  section:
    "FP8 Formats for Deep Learning原论文：E4M3/E5M2；本图仅比较[1,2)正规区间。",
};
