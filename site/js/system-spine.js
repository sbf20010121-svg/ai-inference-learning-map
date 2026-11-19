import { allCourseById } from "./course-registry.js";

const runtimeStages = [
  {
    id: "request", lane: "runtime", title: "请求接纳与排队", short: "请求",
    question: "这是谁的请求？系统现在能接纳并执行它吗？",
    summary: "服务入口接收 Prompt、生成参数和请求元数据，分配 request ID，检查限额与状态，再把请求交给引擎。进入队列不代表 GPU 已经开始计算。",
    objects: "Prompt / 多模态输入、sampling 参数、request ID、请求状态与到达时间。",
    control: "Admission、队列、优先级、超时和取消；Scheduler 后续还会反复决定每一轮执行哪些 Token。",
    compute: "Tokenize 和部分预处理通常在 Host 侧；此时一般还没有执行完整模型前向。",
    boundary: "排队时间属于端到端延迟，但不是 Kernel duration。请求生命周期也不止一个 Scheduler 调用。",
    courses: ["request-lifecycle", "admission-backpressure", "serving-slo", "vllm-scheduler", "process-threads"]
  },
  {
    id: "prepare", lane: "runtime", title: "输入准备与张量表示", short: "输入",
    question: "模型真正接收的是什么数据？",
    summary: "文本先按 Tokenizer 规则变成 Token ID；图像、视频或机器人观测还需要各自的预处理与编码。进入模型后，Embedding 等权重查表把离散 ID 变成连续隐藏向量。",
    objects: "Token ID、位置与 Mask、多模态特征、Embedding 权重、隐藏张量 X⁰。",
    control: "保留请求身份、序列长度、模态边界和位置元数据；变长请求不能只靠 Batch 行号识别。",
    compute: "Tokenizer / 图像预处理可能在 CPU；视觉编码器可能在 GPU。Embedding lookup 属于模型计算，不应与文本 Tokenize 混为一谈。",
    boundary: "不同模型的多模态输入路径不同；Embedding 也可能在 Prefill 的模型前向中执行，而不是独立的预处理阶段。",
    courses: ["token-embedding", "vision-patches", "multimodal-bridge", "observation-contract", "action-representation"]
  },
  {
    id: "prefill", lane: "runtime", title: "Prefill：处理整个输入上下文", short: "Prefill",
    question: "Prompt 如何变成每一层的 KV 和首个输出分布？",
    summary: "模型按层处理 Prompt 的所有有效位置：归一化、投影、Attention、FFN / MoE 和残差等计算共同形成新的隐藏状态。Attention 层为 Prompt 位置建立后续 Decode 可复用的 KV。",
    objects: "X⁰…Xᴸ、Q/K/V、Attention 输出、FFN 中间值、各层 KV Cache、最后位置的 Hidden State。",
    control: "Scheduler 可把长 Prompt 切成多个 Chunk；KV allocator 分配物理块，Prefix Cache 可能复用满足条件的历史块。",
    compute: "GEMM、Attention、Norm、MoE、线性注意力等算子经后端选择后执行；一次模型前向通常由多个 Kernel 组成。",
    boundary: "普通 Prefill 完成后才有用于首轮采样的最后位置 Logits。Chunked Prefill 会跨多个调度轮推进，不改变先计算输入、再从 Logits 采样的逻辑。",
    courses: ["llm-block", "transformer-layer", "attention-patterns", "kv-cache", "vllm-scheduler", "moe-route", "state-families", "linear-state", "attention-tiling", "paged-attention-kernel", "gemm-tiling", "fused-norm", "quant-pipeline", "multi-gpu"]
  },
  {
    id: "sample", lane: "runtime", title: "Logits 与采样", short: "采样",
    question: "模型给出分数后，怎样选出下一个 Token？",
    summary: "输出投影先把最后位置的隐藏状态映射成词表 Logits。随后根据生成配置应用 logits processor、温度和候选筛选，形成概率分布，再通过随机数或确定性规则选出 Token ID。",
    objects: "Hidden State hₜ、输出权重 Wout、Logits z、概率 p、Top-k / Top-p 候选集合、RNG 状态。",
    control: "温度、Top-k、Top-p、重复惩罚、停止条件和随机数状态由请求配置决定；不同后端的处理顺序需核对。",
    compute: "输出投影通常是模型前向的一部分；Softmax、筛选、前缀和与随机选择可能由独立采样算子完成，也可能被融合。",
    boundary: "Logits 不是概率。温度作用于 Logits；Top-p 根据排序后的概率累计质量选择完整 Token 项，之后通常要重新归一化。不能把概率直接乘温度。",
    courses: ["token-embedding", "sampling-distribution", "sampling-kernel", "generation-state"]
  },
  {
    id: "decode", lane: "runtime", title: "Decode：把已采样 Token 再送入模型", short: "Decode",
    question: "刚采样出的 Token，什么时候才有自己的 KV？",
    summary: "把上一轮采样出的 Token ID 作为当前 Decode 输入，模型逐层计算它的 Q/K/V，读取历史 KV 做增量 Attention，再经过 FFN 等模块，追加当前输入位置的 KV，并产生下一位置的 Logits。",
    objects: "当前输入 Token ID、历史 KV、当前 Q/K/V、新增 KV、下一轮 Logits、Batch 行与 request ID 映射。",
    control: "Scheduler 每轮重新组织 Running / Waiting 请求和 Token Budget；连续批处理、KV 容量、抢占与异步依赖都会改变本轮 Batch。",
    compute: "当前 Token 的 K/V 在这次前向中产生；Attention 同时读取历史 K/V。每层仍执行模型计算，不是只做一次采样。",
    boundary: "例如 T1 是由 Prefill 的 Logits 采样得到的；T1 通常要到下一次 Decode 前向作为输入时才产生自己的 KV。采样事件和该 Token 的 KV 计算是两个不同事件。",
    courses: ["generation-state", "llm-block", "vllm-scheduler", "kv-cache", "paged-attention-kernel", "attention-patterns", "async-engine", "linear-state", "moe-route", "kv-preemption", "quant-pipeline"]
  },
  {
    id: "stop", lane: "runtime", title: "停止、取消与状态收尾", short: "停止",
    question: "什么时候不再安排下一轮计算？",
    summary: "每次采样后检查 EOS、最大新增 Token 数、停止字符串、取消或错误状态。满足终止条件后不再为该请求安排后续 Decode，并进入结果与资源收尾。",
    objects: "新采样 Token、EOS / stop 条件、请求终态、在途 Kernel、KV Block 引用。",
    control: "请求状态机决定继续、完成、取消或失败；取消消息不会自动撤销已经提交到 GPU 的工作。",
    compute: "终止后通常不再启动下一次模型前向；已提交工作仍需等待真实完成边界，才能安全回收其使用的缓冲区。",
    boundary: "EOS Token 是否进入下一次前向、停止字符串如何判定以及 KV 何时释放，都依具体生成循环和后端实现。共享前缀块还受其他请求引用约束。",
    courses: ["generation-state", "request-lifecycle", "kv-preemption", "admission-backpressure", "kv-cache"]
  },
  {
    id: "return", lane: "runtime", title: "结果返回与资源释放", short: "返回",
    question: "Token 如何变成用户收到的结果？资源何时能释放？",
    summary: "引擎按 request ID 归属输出 Token，执行必要的 Detokenize / 后处理，流式或一次性返回结果，并更新 TTFT、ITL、吞吐等指标。请求终止后再按引用和在途依赖释放 KV 与其他资源。",
    objects: "输出 Token ID、文本 / 多模态结果、finish reason、请求指标、KV 引用和执行完成事件。",
    control: "输出队列、请求身份映射、异步完成通知和资源引用计数共同决定结果交付与回收时机。",
    compute: "Detokenize 和网络发送通常在 Host；设备端结果需要按 Stream / Event 依赖确认可读。",
    boundary: "端到端时间包含排队、预处理、模型计算、采样、传输与输出。单个 Kernel 的耗时不能替代完整请求延迟。",
    courses: ["request-lifecycle", "serving-slo", "async-engine", "host-runtime", "process-threads", "cuda-context"]
  }
];

const compileStages = [
  {
    id: "compile-source", lane: "compile", title: "程序入口与目标", short: "程序",
    question: "要编译的计算从哪里来？",
    summary: "入口可能是 PyTorch 算子图、直接 Triton Kernel、手写 CUDA / C++ 扩展，也可能只是调用已经编译好的库 Kernel。不同入口不共享一条固定编译流水线。",
    objects: "源程序、算子语义、Shape / dtype、目标 GPU、库调用接口。",
    control: "框架和运行环境决定采用哪种后端；直接 Triton 或 CUDA 扩展不要求先经过 Dynamo。",
    compute: "这一阶段确定程序和编译目标，还没有因为写了 PyTorch 就必然生成某个 GPU Kernel。",
    boundary: "不要把 PyTorch、Triton、LLVM、CUDA Runtime 当成同一个工具；它们处在不同职责层。",
    courses: ["compiler-lowering", "tensor-address", "ir-ssa"]
  },
  {
    id: "compile-capture", lane: "compile", title: "捕获、形状与特化", short: "捕获",
    question: "编译器如何知道哪些计算可以一起分析？",
    summary: "对于 torch.compile 路径，Dynamo 捕获可编译区域并用 Guard 约束结果复用；动态 Shape、Python 控制流和 Graph Break 会改变捕获边界。直接 Triton / CUDA 路径可以从自己的 Kernel 源码开始。",
    objects: "FX Graph、Guard、符号 Shape、dtype、编译选项和目标架构。",
    control: "Shape / dtype / device 等条件决定特化版本和缓存命中；条件不满足时可能重新编译或走其他路径。",
    compute: "捕获与特化主要准备可分析的程序表示，不等于 GPU 已经执行了模型计算。",
    boundary: "并非所有 PyTorch 运算都进入 Dynamo / Inductor，也不是所有 Kernel 都由 Triton 生成。",
    courses: ["graph-capture", "symbolic-shapes", "compiler-lowering"]
  },
  {
    id: "compile-optimize", lane: "compile", title: "图改写与融合合法性", short: "优化",
    question: "哪些中间结果可以不写回，哪些操作不能重排？",
    summary: "编译器分析生产者、消费者、别名和数值语义，再决定是否重写、融合或保留中间结果。融合必须保持可观察行为，不能只因为 Kernel 数变少就删除外部仍需使用的数据。",
    objects: "算子依赖图、SSA 值、别名关系、活跃区间、精度与读写副作用。",
    control: "合法性约束先于性能选择；融合扩大活跃值范围时也可能提高寄存器压力。",
    compute: "图级优化改变程序结构和中间数据的保存方式，最终是否更快仍要看目标代码与设备执行。",
    boundary: "逻辑 IO 减少不等于实测 HBM 字节一定同比减少；Spill、重算和并发也会改变成本。",
    courses: ["graph-rewrite", "fusion-legality", "buffer-liveness"]
  },
  {
    id: "compile-lower", lane: "compile", title: "循环、Tile 与 GPU Layout", short: "映射",
    question: "逻辑张量怎样分配给 Program、Warp 和线程？",
    summary: "Lowering 把张量操作变成循环、Program 和 Tile；Triton 的 TTIR 表达张量操作，TTGIR 加入 GPU 相关布局和线程组织信息。随后还要处理地址、Mask、Layout Conversion 与资源约束。",
    objects: "循环迭代点、Program ID、Tile、Mask、TTIR、TTGIR、Lane / Warp 所有权。",
    control: "BLOCK、Tile Shape、布局编码和目标架构共同约束执行映射；相同 Shape 不代表相同线程归属。",
    compute: "编译器在这一层决定逻辑元素如何映射到设备执行结构；真实映射必须核对实际 IR 和编译产物。",
    boundary: "TTIR / TTGIR 片段需要标注是示意还是实际 Dump。不能只凭 BLOCK 大小推断 Lane 映射。",
    courses: ["loop-lowering", "triton-tiling", "gpu-layout", "tensor-address", "ir-ssa"]
  },
  {
    id: "compile-codegen", lane: "compile", title: "目标代码与资源分配", short: "代码生成",
    question: "IR 如何变成目标 GPU 可执行的指令？",
    summary: "以 Triton / NVIDIA 路径为例，较低层 IR 经 LLVM / NVPTX 等后端形成 PTX，再由 ptxas 等工具生成目标设备代码；寄存器分配、指令选择和 Spill 会改变最终资源成本。库 Kernel 可能早已预编译。",
    objects: "LLVM IR、PTX、cubin、SASS、虚拟 / 物理寄存器、Shared Memory 与 Spill。",
    control: "目标架构、编译器版本和编译选项影响生成物；不同后端和库调用可能跳过部分阶段。",
    compute: "代码生成建立可加载的设备产物；SASS 才是 NVIDIA GPU 实际执行的指令层级。",
    boundary: "不能把 PTX 行数当作 SASS 指令数，也不能把虚拟寄存器名字数量当成物理寄存器占用。",
    courses: ["target-codegen", "compiler-evidence", "tensorcore-b200"]
  },
  {
    id: "compile-cache", lane: "compile", title: "编译缓存、加载与 Engine 构建", short: "缓存 / 加载",
    question: "为什么编译通常不发生在每一个 Token 上？",
    summary: "编译结果可按程序、Shape、dtype、目标设备等条件缓存；首次遇到某个特化条件时可能触发 JIT，之后复用缓存。TensorRT 等 Engine 构建也可能在部署准备阶段完成。",
    objects: "编译缓存键、cubin / 模块、Engine、动态 Shape Profile、权重和运行时句柄。",
    control: "缓存命中、版本变化、目标架构和动态 Shape 决定是否重新编译或重建 Engine。",
    compute: "模块加载与初始化发生在运行准备阶段；请求执行时再由 Runtime / Driver 提交工作。",
    boundary: "冷启动编译 / 加载时间要与 Warmup 后的稳态请求时间分开统计。",
    courses: ["compile-cache", "engine-build", "deployment-compatibility", "model-loading"]
  },
  {
    id: "dispatch", lane: "join", title: "运行时后端派发：两条路径在这里汇合", short: "汇合 / 派发",
    question: "当前这个算子最终选择调用哪一个 Kernel？",
    summary: "运行时依据 Shape、dtype、设备能力、配置和后端支持情况，在预编译库、手写 CUDA、Triton / 编译生成 Kernel 等路径中选择可用实现，再通过 Runtime / Driver 提交到 Stream。",
    objects: "算子元数据、Backend Dispatch 条件、Kernel 函数 / 模块、Launch 参数、Stream / Event 依赖。",
    control: "派发条件和 Stream 依赖决定何时、以哪个实现提交；编译缓存是可选来源之一，不是每次请求的编译入口。",
    compute: "Kernel Launch 把已准备好的设备工作提交给 GPU；随后由 SM、Tensor Core 和存储层次实际执行。",
    boundary: "不是所有算子都经过 torch.compile / Triton；也不是 Runtime 本身负责高层图融合。",
    courses: ["backend-dispatch", "runtime-graph", "cuda-context", "host-runtime", "frameworks"]
  }
];

const executionStage = {
  id: "kernel-execution", lane: "execution", title: "GPU 执行与性能证据", short: "GPU 执行",
  question: "Kernel 提交之后，GPU 为什么会快或慢？",
  summary: "同一个 Prefill / Decode 前向会调用多个 Kernel。每个 Kernel 在 GPU 上经历线程块调度、Warp 发射、指令依赖、计算流水线、访存与同步；性能结论必须回到具体 Shape、目标设备和可复现实测。",
  objects: "Grid / CTA / Warp / Lane、寄存器、Shared / L1 / L2 / HBM、Tensor Core、指令与完成事件。",
  control: "Runtime 管理 Stream / Event 与依赖；硬件调度器只会在依赖和资源允许时发射可执行 Warp。",
  compute: "SASS 指令在目标 GPU 上执行；不同 Kernel 可能受算力吞吐、内存层次、依赖延迟、Launch 或资源驻留限制。",
  boundary: "Occupancy、某个 Stall 指标或逻辑字节数都不能单独证明瓶颈。先看端到端时间线，再用 NCU 和受控实验验证。",
  courses: ["gpu-execution", "warp-issue", "occupancy-resources", "memory-route", "shared-bank", "tensorcore-b200", "kernel-tuning", "profiling", "measurement-stability", "reduction-scan", "gather-scatter", "quantized-matmul", "lowbit-formats", "multi-gpu", "collective-topology", "tensor-parallel", "pipeline-parallel", "host-memory-pages", "cuda-context"]
};

const crossLenses = [
  {
    id: "data-flow", title: "数据流：同一个值经过了哪些变换？",
    summary: "从 Token ID、Embedding、Hidden State、QKV / KV 到 Logits、概率和新 Token，始终区分离散 ID、连续张量和分数。",
    chain: "Token ID → Embedding → Hidden State → Logits → Probability → Token ID",
    courses: ["token-embedding", "transformer-layer", "llm-block", "generation-state", "sampling-distribution", "kv-cache"]
  },
  {
    id: "state-lifecycle", title: "状态生命周期：什么时候产生、更新和释放？",
    summary: "请求状态、已采样 Token、已计算位置、KV Block 引用和异步在途工作有不同生命周期，不能用一个“完成”状态代替。",
    chain: "请求接纳 → Running / Waiting → Token 生成 → 终态 → 在途完成 → 资源回收",
    courses: ["request-lifecycle", "generation-state", "kv-cache", "kv-preemption", "async-engine"]
  },
  {
    id: "compile-transform", title: "编译转换：同一个程序在各层多了什么信息？",
    summary: "从张量语义、图依赖和 SSA 值，逐步进入 GPU Layout、目标指令、资源分配和可加载产物。",
    chain: "Source / Graph → IR → GPU Layout → LLVM / PTX → cubin / SASS",
    courses: ["compiler-lowering", "ir-ssa", "graph-capture", "triton-tiling", "gpu-layout", "target-codegen"]
  },
  {
    id: "data-movement", title: "数据移动：数据到底从哪里搬到哪里？",
    summary: "把 Host / GPU、HBM / Cache、逻辑 KV 块 / 物理块和跨 GPU Token Dispatch 分开画；箭头必须说明移动的是激活、权重还是缓存。",
    chain: "Host ↔ GPU Memory ↔ Cache / Shared ↔ Compute；GPU ↔ GPU",
    courses: ["host-runtime", "host-memory-pages", "memory-route", "paged-attention-kernel", "moe-route", "multi-gpu", "collective-topology", "gather-scatter"]
  },
  {
    id: "performance-evidence", title: "性能证据：每一层结论需要什么证据？",
    summary: "正确性、逻辑 IO、编译产物、寄存器 / Spill、GPU 时间线、Kernel 指标和端到端 SLO 是不同证据，不能互相替代。",
    chain: "Correctness → IR / Binary → Resource Report → NSYS / NCU → End-to-End",
    courses: ["compiler-evidence", "kernel-tuning", "profiling", "serving-slo", "measurement-stability"]
  }
];

const typedRelations = [
  { from: "请求状态", to: "Scheduler 决策", type: "controls", reason: "Running / Waiting、已计算 Token 和取消状态决定这一轮有哪些请求可被安排。" },
  { from: "Scheduler 输出", to: "Model Runner 输入", type: "schedules", reason: "本轮 Token 数、位置和请求映射决定 Runner 需要组装的张量与元数据。" },
  { from: "Hidden State", to: "Logits", type: "produces", reason: "输出投影把最后位置的隐藏向量映射到词表分数；分数还不是概率。" },
  { from: "Logits", to: "Sampling", type: "consumes", reason: "温度、筛选和归一化读取 Logits，形成候选概率分布并选择 Token。" },
  { from: "Sampled Token", to: "下一轮 Decode 输入", type: "feeds", reason: "本轮采样出的离散 ID 成为下一次模型前向的输入；该 Token 的 KV 通常也在那次前向中产生。" },
  { from: "编译产物 / 预编译库", to: "Backend Dispatch", type: "provides", reason: "派发逻辑从可用 Kernel 实现中选择，而不是在每个 Token 上重新编译整个模型。" },
  { from: "Backend Dispatch", to: "GPU", type: "launches", reason: "Runtime / Driver 按 Stream 和依赖提交 Kernel；GPU 再执行实际指令。" },
  { from: "GPU 完成事件", to: "结果交付 / 下一轮", type: "unblocks", reason: "Host 侧读取输出、复用缓冲区或继续调度前，需要满足相应完成依赖。" }
];

const extensions = [
  {
    id: "vla", title: "机器人 VLA：模型输入与输出变了，执行系统仍可复用",
    summary: "视觉、语言和本体状态形成条件输入；Action Head 可能直接回归动作，也可能通过 Flow / Diffusion 迭代生成 Action Chunk，之后进入异步控制闭环。",
    courses: ["vision-patches", "multimodal-bridge", "observation-contract", "action-representation", "robot-data", "policy-families", "vla-policy", "closed-loop"]
  },
  {
    id: "world", title: "世界模型：预测未来状态，不等于每个控制周期都必须调用",
    summary: "历史观测与动作条件进入时空 / 潜变量模型，产生未来状态、视频或潜表示，再供规划、评估或离线数据生成使用。",
    courses: ["world-model", "world-learning", "diffusion-transformer", "closed-loop"]
  }
];

const allStages = [...runtimeStages, ...compileStages, executionStage];
const stageById = new Map(allStages.map((item) => [item.id, item]));
const explicitStage = new Map();
for (const item of runtimeStages) {
  for (const id of item.courses) if (!explicitStage.has(id)) explicitStage.set(id, item.id);
}
for (const item of compileStages) {
  for (const id of item.courses) explicitStage.set(id, item.id);
}
for (const id of executionStage.courses) explicitStage.set(id, executionStage.id);

export function spineStageForCourse(courseId) {
  if (explicitStage.has(courseId)) return explicitStage.get(courseId);
  const course = allCourseById.get(courseId);
  if (!course) return "request";
  return ({
    model: "prefill",
    engine: "request",
    compiler: "compile-source",
    kernel: "kernel-execution",
    systems: "request",
    microarch: "kernel-execution"
  }[course.module] || "request");
}

export function validateSystemSpine() {
  const ids = allStages.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate system spine stage ID");
  for (const item of allStages) {
    for (const courseId of item.courses) {
      if (!allCourseById.has(courseId)) throw new Error("Unknown course " + courseId + " in " + item.id);
    }
  }
  for (const lens of crossLenses) {
    for (const courseId of lens.courses) {
      if (!allCourseById.has(courseId)) throw new Error("Unknown course " + courseId + " in lens " + lens.id);
    }
  }
  for (const relation of typedRelations) {
    if (!relation.from || !relation.to || !relation.type || !relation.reason) throw new Error("Incomplete typed relation");
  }
  return true;
}

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );

function courseLinks(ids) {
  return ids.map((id) => {
    const course = allCourseById.get(id);
    if (!course) return "";
    return '<button type="button" class="spine-course-link" data-spine-course="' + esc(id) + '"><strong>' + esc(course.title) + '</strong><span>' + esc(course.summary) + '</span></button>';
  }).join("");
}

function station(stage, selected) {
  return '<button type="button" class="spine-station ' + (selected === stage.id ? "active" : "") + '" data-spine-stage="' + esc(stage.id) + '" aria-pressed="' + (selected === stage.id) + '"><small>' + esc(stage.short) + '</small><strong>' + esc(stage.title) + '</strong></button>';
}

function stageDetail(stage) {
  const laneLabel = stage.lane === "runtime" ? "请求运行路径" : stage.lane === "compile" ? "编译 / 构建路径" : stage.lane === "join" ? "两条路径汇合" : "执行层下钻";
  return '<section class="spine-detail" aria-live="polite">' +
    '<header><span class="eyebrow">' + esc(laneLabel) + '</span><h2>' + esc(stage.title) + '</h2><p class="spine-question">' + esc(stage.question) + '</p><p>' + esc(stage.summary) + '</p></header>' +
    '<div class="spine-facts">' +
      '<article><h3>数据对象</h3><p>' + esc(stage.objects) + '</p></article>' +
      '<article><h3>控制与调度</h3><p>' + esc(stage.control) + '</p></article>' +
      '<article><h3>实际计算</h3><p>' + esc(stage.compute) + '</p></article>' +
      '<article class="spine-boundary"><h3>边界与常见误解</h3><p>' + esc(stage.boundary) + '</p></article>' +
    '</div><section class="spine-related"><h3>从这里深入现有课程</h3><div>' + courseLinks(stage.courses) + '</div></section></section>';
}

function lensCards() {
  return crossLenses.map((lens) =>
    '<article class="spine-lens"><span class="eyebrow">' + esc(lens.id) + '</span><h3>' + esc(lens.title) + '</h3><p>' + esc(lens.summary) + '</p><div class="spine-chain">' + esc(lens.chain) + '</div><div class="spine-course-list">' + courseLinks(lens.courses) + '</div></article>'
  ).join("");
}

function relationRows() {
  return typedRelations.map((relation) =>
    '<article class="spine-relation"><div><strong>' + esc(relation.from) + '</strong><span>' + esc(relation.type) + '</span><strong>' + esc(relation.to) + '</strong></div><p>' + esc(relation.reason) + '</p></article>'
  ).join("");
}

function extensionCards() {
  return extensions.map((extension) =>
    '<article class="spine-extension"><h3>' + esc(extension.title) + '</h3><p>' + esc(extension.summary) + '</p><div>' + courseLinks(extension.courses) + '</div></article>'
  ).join("");
}

export function renderSystemSpine(selectedId = "request") {
  const selected = stageById.has(selectedId) ? selectedId : "request";
  const detail = stageById.get(selected);
  return '<div class="system-spine">' +
    '<header class="spine-hero"><span class="eyebrow accent-text">系统完整主线 · 从请求到 GPU，再回到结果</span><h1>一次 AI 推理究竟是怎样发生的？</h1><p>先沿着一次普通自回归 LLM 请求走完，再把编译 / 构建路径叠上来。每个环节都能进入现有课程；这不是把所有模型和后端强行套进同一条实现流水线。</p><div class="spine-hero-actions"><button type="button" class="button primary" data-spine-stage="request">从请求入口开始</button><button type="button" class="button outline" data-spine-stage="compile-source">查看编译 / 构建路径</button></div></header>' +
    '<section class="spine-section"><div class="spine-section-heading"><span class="eyebrow">01 / Request Runtime</span><h2>请求运行路径</h2><p>这是一次请求在运行期间经历的逻辑流程。Prefill 和 Decode 会重复执行模型前向；Scheduler 不是只在入口调用一次。</p></div><div class="spine-lane-label"><strong>请求与模型数据路径</strong><span>按阶段选择，查看数据、控制状态和对应课程</span></div><div class="spine-stations runtime">' + runtimeStages.map((item) => station(item, selected)).join("") + '</div><aside class="spine-control-band"><strong>贯穿全程的控制面</strong><span>Scheduler / Request State / KV Allocator / Async Completion</span><p>它们会在接纳、每轮 Batch 组装、KV 分配、取消和资源回收等时点反复参与；不是一个只出现一次的线性阶段。</p></aside></section>' +
    stageDetail(detail) +
    '<section class="spine-section compile-section"><div class="spine-section-heading"><span class="eyebrow">02 / Compile & Build</span><h2>编译与构建路径</h2><p>这条路径通常在部署准备阶段或首次遇到某个 Shape / dtype / 目标条件时发生；缓存命中后，不会为每个 Token 重新走完整编译。</p></div><div class="spine-lane-label"><strong>从程序到可加载产物</strong><span>不同入口会走不同分支，不是所有代码都经过 Triton</span></div><div class="spine-stations compile">' + compileStages.map((item) => station(item, selected)).join("") + '</div><div class="spine-merge-point"><strong>汇合点：Backend Dispatch</strong><p>运行时按算子 Shape、dtype、设备和后端条件选择预编译库、手写 CUDA 或 Triton / 编译生成的 Kernel，再通过 Runtime / Driver 提交。直接 Triton 不要求先经 Dynamo；预编译库也可能跳过本站展示的部分编译步骤。</p><button type="button" class="button outline small" data-spine-stage="dispatch">查看两条路径如何汇合 →</button></div></section>' +
    '<section class="spine-section execution-section"><div class="spine-section-heading"><span class="eyebrow">03 / GPU Execution</span><h2>Kernel 提交后的 GPU 执行</h2><p>GPU 执行是 Prefill / Decode 内部反复发生的子过程。这里向下连接 Kernel、Warp、指令、存储层次和硬件资源。</p></div>' + station(executionStage, selected) + (selected === executionStage.id ? stageDetail(executionStage) : "") + '</section>' +
    '<section class="spine-section"><div class="spine-section-heading"><span class="eyebrow">04 / Cross-cutting Mechanisms</span><h2>跨章节的五条基础机制线</h2><p>这些不是额外的孤立课程，而是帮助你在不同专题之间追踪同一类对象和因果关系。</p></div><div class="spine-lenses">' + lensCards() + '</div></section>' +
    '<section class="spine-section"><div class="spine-section-heading"><span class="eyebrow">05 / Typed Relations</span><h2>知识点之间到底是什么关系？</h2><p>不只写“相关”，而是标明谁产生谁、谁消费谁、谁控制谁，以及连接成立的具体原因。</p></div><div class="spine-relations">' + relationRows() + '</div></section>' +
    '<section class="spine-section"><div class="spine-section-heading"><span class="eyebrow">06 / Other Workloads</span><h2>VLA 与世界模型怎样接入这条主线？</h2><p>它们的模型结构和输出形式不同，但仍然需要输入准备、模型执行、后端派发、GPU 执行和结果交付。</p></div><div class="spine-extensions">' + extensionCards() + '</div></section>' +
    '<aside class="spine-note"><strong>阅读口径</strong><p>页面描述的是通用逻辑边界。真实框架可能融合、重排或异步执行多个环节；具体组件、采样顺序、KV 生命周期和编译路径应按模型版本与后端核对。教学路径不等于某个框架的逐函数源码审计，也不代表真实性能测量。</p></aside>' +
    '</div>';
}

validateSystemSpine();
