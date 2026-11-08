/** Scope-based review: a URL or topic ID alone never establishes teaching coverage. */
import { allCourses, foundationById } from "./course-registry.js";
import { depthModules } from "./depth-content.js";
import { chaptersFor } from "./mechanism-curriculum.js";
import { courseNotes } from "./course-notes.js";
import { scopeReview } from "./coverage-review.js";
const groups = [
  ["models", "LLM模型与计算", "model"],
  ["physical", "视觉、机器人与世界模型", "model"],
  ["serving", "推理引擎与部署", "engine"],
  ["compilation", "编译、图优化与Runtime", "compiler"],
  ["operators", "GPU算子与性能", "kernel"],
  ["platform", "系统与分布式", "systems"],
  ["hardware", "GPU微架构", "microarch"],
];
const physical = new Set([
  "vla-policy",
  "world-model",
  "vision-patches",
  "multimodal-bridge",
  "observation-contract",
  "action-representation",
  "policy-families",
  "robot-data",
  "closed-loop",
  "world-learning",
  "diffusion-transformer",
]);
const groupFor = (c) =>
  c.module === "model"
    ? physical.has(c.id)
      ? "physical"
      : "models"
    : {
        engine: "serving",
        compiler: "compilation",
        kernel: "operators",
        systems: "platform",
        microarch: "hardware",
      }[c.module];
const built = allCourses.map((c) => {
  const review = scopeReview[c.id],
    group = groupFor(c);
  return {
    source: foundationById.get(c.id)?.notes.source || courseNotes[c.id]?.source,
    name: review?.[0] || c.title,
    priority: "P0",
    ref: c.id,
    group,
    module: c.module,
    state: review ? "guided" : "partial",
    evidence: review
      ? {
          scope: review[0],
          boundary: review[1],
          chapters: chaptersFor(c.id).map((p) => p.id),
          level: "页面机制与教学模型；非完整源码/实测认证",
        }
      : null,
  };
});
const optional = [
  {
    name: "点云、3D稀疏算子与感知专项",
    module: "model",
    group: "physical",
    priority: "P2",
    state: "missing",
    ref: "",
    boundary: "机器人观测接口已讲，专项感知算法未建设",
  },
  {
    name: "多租户缓存隔离、完整哈希与故障恢复",
    module: "engine",
    group: "serving",
    priority: "P1",
    state: "partial",
    ref: "kv-cache",
    boundary: "基础映射与引用已讲，专项实现仍未审计",
  },
  {
    name: "MTP网络、树状推测与全分支缓存提交",
    module: "engine",
    group: "serving",
    priority: "P1",
    state: "partial",
    ref: "spec-decode",
    boundary: "已讲接受/拒绝概率，不宣称实现这些模型和多步分支",
  },
  {
    name: "RDMA、GPUDirect与实际多节点通信后端",
    module: "systems",
    group: "platform",
    priority: "P1",
    state: "partial",
    ref: "collective-topology",
    boundary: "拓扑和通信量已讲，具体传输协议与实测未实现",
  },
  {
    name: "完整语言前端、解析器和控制流优化实现",
    module: "compiler",
    group: "compilation",
    priority: "P2",
    state: "missing",
    ref: "",
    boundary: "推理所需IR基础已讲，完整传统编译器前端按需扩展",
  },
  {
    name: "机器人完整运动学、动力学与底层控制设计",
    module: "model",
    group: "physical",
    priority: "P2",
    state: "missing",
    ref: "",
    boundary: "本版讲推理接口与闭环认知，未建设完整控制课程",
  },
  {
    name: "训练反向、优化器与完整分布式训练",
    module: "model",
    group: "models",
    priority: "P2",
    state: "missing",
    ref: "",
    boundary: "仅讲理解推理机制所需的训练目标与边界",
  },
];
export const coverageItems = [...built, ...optional];
export const coverage = groups.map(([id, title, module]) => ({
  id,
  title,
  module,
  source: "https://github.com/sbf20010121-svg/ai-inference-learning-map",
  items: coverageItems.filter((i) => i.group === id),
}));
export const statusOf = (i) =>
  i.state === "guided"
    ? i.evidence?.scope && i.evidence?.boundary && i.evidence?.chapters?.length
      ? "guided"
      : "partial"
    : ["partial", "missing"].includes(i.state)
      ? i.state
      : "missing";
export const statusLabels = {
  guided: "限定机制课已建设",
  partial: "相关基础已有，专项仍缺",
  missing: "尚缺深度课程",
};
export function auditSummary(items = coverageItems) {
  const out = { guided: 0, partial: 0, missing: 0 };
  for (const i of items) out[statusOf(i)]++;
  return out;
}
export function validateCoverage() {
  const ids = new Set(allCourses.map((c) => c.id)),
    names = new Set(),
    modules = new Set(depthModules.map((m) => m.id));
  for (const i of coverageItems) {
    if (
      names.has(i.name) ||
      !modules.has(i.module) ||
      !["P0", "P1", "P2"].includes(i.priority) ||
      (i.ref && !ids.has(i.ref))
    )
      throw Error("Invalid audit entry " + i.name);
    names.add(i.name);
    if (
      i.state === "guided" &&
      (!i.evidence ||
        !i.evidence.boundary ||
        !i.evidence.chapters.length ||
        i.evidence.chapters.some(
          (id) => !chaptersFor(i.ref).some((c) => c.id === id),
        ))
    )
      throw Error("Missing explicit mechanism evidence " + i.name);
  }
  return true;
}
