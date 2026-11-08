/** One catalogue and stable record space; old IDs retain exactly their old meaning. */
import { depthTopics, depthModules } from "./depth-content.js";
import { foundationCourses, foundationById } from "./foundation-index.js";
export { foundationCourses, foundationById };
export const allCourses = [
  ...depthTopics,
  ...foundationCourses.map((c) => ({
    id: c.id,
    title: c.title,
    module: c.module,
    summary: c.goal,
    question: c.chapters[0].question,
    related: c.prereqs.map((p) => p[0]),
    parent: depthTopics.find((t) => t.module === c.module).parent,
    depth: "机制课",
  })),
];
export const allCourseById = new Map(allCourses.map((c) => [c.id, c]));
const unit = (id, module, title, goal, courses) => ({
  id,
  module,
  title,
  goal,
  courses,
});
export const courseUnits = [
  unit(
    "model-contract",
    "model",
    "模型入口与完整层",
    "从输入文本到隐藏状态与逐层计算，不把一个Attention当整模型。",
    ["token-embedding", "transformer-layer", "llm-block"],
  ),
  unit(
    "generation",
    "model",
    "生成与输出分布",
    "走完整个自回归过程，固定采样和停止语义。",
    ["generation-state", "sampling-distribution"],
  ),
  unit(
    "attention-family",
    "model",
    "注意力、专家与状态模型",
    "按状态与连接结构区分机制，并接回执行成本。",
    [
      "attention-patterns",
      "moe-route",
      "mla-kv",
      "linear-state",
      "state-families",
    ],
  ),
  unit(
    "multimodal",
    "model",
    "视觉与跨模态输入",
    "从像素Patch到视觉Token，再到语言/动作接口。",
    ["vision-patches", "multimodal-bridge"],
  ),
  unit(
    "robot-interface",
    "model",
    "具身观测与动作闭环",
    "先固定时间、坐标、动作表示，再解释控制消费。",
    ["observation-contract", "action-representation", "closed-loop"],
  ),
  unit(
    "robot-policies",
    "model",
    "策略、数据与动作生成",
    "区分策略家族、监督数据、生成过程和异步执行。",
    ["robot-data", "policy-families", "vla-policy"],
  ),
  unit(
    "world-models",
    "model",
    "世界模型与生成模型",
    "分清状态估计、学习目标、想象轨迹和视频去噪。",
    ["world-model", "world-learning", "diffusion-transformer"],
  ),
  unit(
    "request-engine",
    "engine",
    "请求完整生命周期",
    "从接纳到取消、输出与释放，保持身份与统计边界。",
    ["request-lifecycle", "admission-backpressure", "serving-slo"],
  ),
  unit(
    "execution-engine",
    "engine",
    "装载、执行器与异步流水",
    "明确模型权重、执行进程、Batch和后端分别做什么。",
    [
      "quant-pipeline",
      "model-loading",
      "batch-executor",
      "backend-dispatch",
      "async-engine",
      "frameworks",
    ],
  ),
  unit(
    "cache-scheduling",
    "engine",
    "调度、缓存与阶段交接",
    "在计算预算和持久资源两重约束下追踪请求。",
    ["kv-cache", "vllm-scheduler", "kv-preemption", "spec-decode", "pd-disagg"],
  ),
  unit(
    "compiler-intro",
    "compiler",
    "编译全景导论",
    "建立编译问题的全景；导论的掌握不代表整条编译课程已完成。",
    ["compiler-lowering"],
  ),
  unit(
    "representation",
    "compiler",
    "程序与值的表示",
    "把张量逻辑、地址和SSA依赖区分开。",
    ["tensor-address", "ir-ssa"],
  ),
  unit(
    "capture",
    "compiler",
    "捕获、特化与动态形状",
    "判断哪些区域被编译、哪些条件允许复用。",
    ["graph-capture", "symbolic-shapes"],
  ),
  unit(
    "optimization",
    "compiler",
    "图分析与合法变换",
    "先证明保持语义，再讨论节点、IO和资源变化。",
    ["graph-rewrite", "fusion-legality"],
  ),
  unit(
    "lowering",
    "compiler",
    "循环、分块与设备映射",
    "从算子数学到合法迭代点及Program责任。",
    ["loop-lowering", "triton-tiling"],
  ),
  unit(
    "storage",
    "compiler",
    "内存规划与执行布局",
    "跟踪何时可复用、值由谁持有、需要怎样交换。",
    ["buffer-liveness", "gpu-layout"],
  ),
  unit(
    "backend",
    "compiler",
    "后端、产物与优化核验",
    "连接目标代码、编译缓存、真实资源和证据链。",
    ["target-codegen", "compile-cache", "engine-build", "compiler-evidence"],
  ),
  unit(
    "runtime",
    "compiler",
    "运行时次序与重放",
    "编译产物仍需正确绑定、提交、同步和管理生命周期。",
    ["runtime-graph"],
  ),
  unit(
    "kernel-primitives",
    "kernel",
    "基础并行与不规则算子",
    "读懂归约、前缀、索引冲突和采样所依赖的对象。",
    ["reduction-scan", "gather-scatter", "sampling-kernel"],
  ),
  unit(
    "matrix-kernels",
    "kernel",
    "矩阵计算与重用",
    "围绕乘积贡献、Tile与资源解释GEMM。",
    ["gemm-tiling", "convolution-lowering"],
  ),
  unit(
    "attention-kernels",
    "kernel",
    "Attention的存储与计算",
    "从分页地址读到正确K/V，再处理分块归一化。",
    ["attention-tiling", "paged-attention-kernel"],
  ),
  unit(
    "numeric-kernels",
    "kernel",
    "数值算子与低精度计算",
    "区分归约、旋转、门控和分组还原的不同依赖。",
    ["fused-norm", "quantized-matmul", "lowbit-formats"],
  ),
  unit(
    "kernel-validation",
    "kernel",
    "配置搜索与性能归因",
    "正确性和同一任务先行，资源与实际时间共同验证。",
    ["kernel-tuning", "profiling"],
  ),
  unit(
    "os-foundations",
    "systems",
    "按需OS与设备资源基础",
    "理解进程、页、Context和异步访问所需的边界。",
    ["process-threads", "host-memory-pages", "cuda-context", "host-runtime"],
  ),
  unit(
    "distributed-execution",
    "systems",
    "分布式执行与通信",
    "切分轴、层段、专家归属和链路共同决定通信。",
    [
      "tensor-parallel",
      "pipeline-parallel",
      "multi-gpu",
      "collective-topology",
    ],
  ),
  unit(
    "deployment",
    "systems",
    "可复现部署与环境",
    "明确兼容条件和实验配置，不把安装成功当运行正确。",
    ["deployment-compatibility"],
  ),
  unit(
    "gpu-execution",
    "microarch",
    "执行层级、驻留与发射",
    "逻辑线程、容量、就绪和发射是不同的对象。",
    ["gpu-execution", "warp-issue", "occupancy-resources"],
  ),
  unit(
    "gpu-memory",
    "microarch",
    "地址、存储层与Bank",
    "区分全局地址覆盖、Shared分组和显式数据重用。",
    ["memory-route", "shared-bank"],
  ),
  unit(
    "gpu-matrix",
    "microarch",
    "矩阵单元与异步资源协议",
    "理解输入就绪、MMA完成、TMEM及槽位复用条件。",
    ["tensorcore-b200"],
  ),
  unit(
    "gpu-validation",
    "microarch",
    "设备状态与稳定测量",
    "把代码变化与时钟、冷启动、分布漂移分开核验。",
    ["measurement-stability"],
  ),
];
export const unitFor = (id) => courseUnits.find((u) => u.courses.includes(id));
export function coursePosition(id) {
  const u = unitFor(id);
  return { unit: u, index: u?.courses.indexOf(id) ?? -1 };
}
export function validateCourseRegistry() {
  const modules = new Set(depthModules.map((m) => m.id)),
    seen = new Set();
  for (const u of courseUnits) {
    if (!modules.has(u.module)) throw Error("Invalid unit module " + u.id);
    for (const id of u.courses) {
      if (
        seen.has(id) ||
        !allCourseById.has(id) ||
        allCourseById.get(id).module !== u.module
      )
        throw Error("Duplicate/missing placement " + id);
      seen.add(id);
    }
  }
  if (seen.size !== allCourses.length) throw Error("Unplaced courses");
  for (const c of foundationCourses) {
    if (!unitFor(c.id) || c.prereqs.some(([id]) => !allCourseById.has(id)))
      throw Error("Broken prerequisite " + c.id);
  }
  return true;
}
