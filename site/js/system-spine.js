import { allCourseById } from "./course-registry.js";
import { runtimeDiagram, compileDiagram } from "./spine-diagrams.js";
import { renderRequestTrace } from "./system-trace.js";

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
    summary: "采样后检查 EOS、最大新增 Token 数和停止字符串；取消或故障也可在计算在途时异步到达。进入终态后不再安排后续 Decode，并按完成依赖收尾。",
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
  { from: "Sampling", to: "Logits", type: "consumes", reason: "温度、筛选和归一化读取 Logits，形成候选概率分布并选择 Token。" },
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

const workloadStages = [
  {
    id: "workload-vla", lane: "workload", title: "VLA：观测到动作闭环", short: "VLA",
    question: "动作块什么时候生成、什么时候真正执行？",
    summary: extensions[0].summary,
    objects: "带时间戳与坐标系的观测、动作表示、Action Chunk、控制队列与执行节拍。",
    control: "控制器按物理时间消费动作；异步模型推理要检查新旧观测、队列余量与过期动作。",
    compute: "视觉编码、跨模态条件和动作预测属于模型计算；Flow / Diffusion 的内部迭代不等同于机器人控制周期。",
    boundary: "LLM 的 Token Decode 回环不能直接套在所有动作策略上。动作生成结束也不代表真实任务已完成。",
    courses: extensions[0].courses,
  },
  {
    id: "workload-world", lane: "workload", title: "世界模型：估计与预测", short: "世界模型",
    question: "模型预测的未来由谁使用，能说明什么？",
    summary: extensions[1].summary,
    objects: "观测、动作条件、确定性记忆、随机潜状态、预测奖励或生成的视频。",
    control: "策略或规划器决定是否使用预测结果；训练时的想象轨迹也可能完全离线生成。",
    compute: "RSSM 的先验/后验更新与视频扩散的多步去噪是不同计算结构，不能只按输出是否像视频分类。",
    boundary: "预测不自动产生可靠控制；视频清晰度、状态误差、长滚动偏差和闭环成功率需要分别评价。",
    courses: extensions[1].courses,
  },
];

export const systemSpineStages = [...runtimeStages, ...compileStages, executionStage, ...workloadStages];
const stageById = new Map(systemSpineStages.map(item => [item.id, item]));
// Primary locations are authored choices. Repeated cross-links never overwrite them.
const primaryGroups = {
  request: ["request-lifecycle", "admission-backpressure", "serving-slo", "process-threads"],
  prepare: ["token-embedding", "vision-patches", "multimodal-bridge"],
  prefill: ["llm-block", "transformer-layer", "attention-patterns", "moe-route", "mla-kv", "linear-state", "state-families", "kv-cache", "vllm-scheduler"],
  sample: ["sampling-distribution", "sampling-kernel"],
  decode: ["generation-state", "kv-preemption", "spec-decode", "pd-disagg"],
  "compile-source": ["compiler-lowering", "tensor-address", "ir-ssa"],
  "compile-capture": ["graph-capture", "symbolic-shapes"],
  "compile-optimize": ["graph-rewrite", "fusion-legality", "buffer-liveness"],
  "compile-lower": ["loop-lowering", "triton-tiling", "gpu-layout"],
  "compile-codegen": ["target-codegen", "compiler-evidence"],
  "compile-cache": ["compile-cache", "engine-build", "model-loading", "deployment-compatibility"],
  dispatch: ["backend-dispatch", "runtime-graph", "cuda-context", "host-runtime", "batch-executor", "async-engine", "frameworks"],
  "kernel-execution": ["gpu-execution", "warp-issue", "occupancy-resources", "memory-route", "shared-bank", "tensorcore-b200", "kernel-tuning", "profiling", "measurement-stability", "reduction-scan", "gather-scatter", "quantized-matmul", "lowbit-formats", "multi-gpu", "collective-topology", "tensor-parallel", "pipeline-parallel", "host-memory-pages", "gemm-tiling", "attention-tiling", "fused-norm", "paged-attention-kernel", "convolution-lowering", "quant-pipeline"],
  "workload-vla": ["observation-contract", "action-representation", "robot-data", "policy-families", "vla-policy", "closed-loop"],
  "workload-world": ["world-model", "world-learning", "diffusion-transformer"],
};
const primaryStage = new Map();
for (const [stage, ids] of Object.entries(primaryGroups)) {
  for (const id of ids) {
    if (primaryStage.has(id)) throw new Error("Duplicate primary spine location: " + id);
    primaryStage.set(id, stage);
  }
  stageById.get(stage).courses = [...new Set([...stageById.get(stage).courses, ...ids])];
}
export const spineStageForCourse = id => primaryStage.get(id) || "request";
export function spineLocationsForCourse(id) {
  if (!primaryStage.has(id)) return [];
  return systemSpineStages.filter(s => s.courses.includes(id)).sort((a, b) => Number(b.id === primaryStage.get(id)) - Number(a.id === primaryStage.get(id)));
}
export function validateSystemSpine() {
  if (stageById.size !== systemSpineStages.length) throw new Error("Duplicate system spine stage ID");
  for (const [id] of allCourseById) {
    if (!primaryStage.has(id)) throw new Error("Missing authored spine location: " + id);
    if (!stageById.get(primaryStage.get(id))?.courses.includes(id)) throw new Error("Missing reverse course link: " + id);
  }
  for (const group of [...systemSpineStages, ...crossLenses, ...extensions]) {
    for (const id of group.courses) if (!allCourseById.has(id)) throw new Error("Unknown course " + id + " in " + group.id);
  }
  for (const r of typedRelations) if (!r.from || !r.to || !r.type || !r.reason) throw new Error("Incomplete typed relation");
  return true;
}
const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function courseLinks(ids) {
  return ids.map(id => {
    const c = allCourseById.get(id);
    return `<a class="spine-course-link" data-spine-open-course="${id}" href="#depth/${id}/L2"><strong>${esc(c.title)} →</strong><span>${esc(c.summary)}</span></a>`;
  }).join("");
}
function station(s, selected) {
  return `<a class="spine-station ${selected === s.id ? "active" : ""}" href="#spine/${s.id}" aria-current="${selected === s.id ? "step" : "false"}">${esc(s.short)}</a>`;
}
function stageDetail(s) {
  const first = s.courses.slice(0, 3), rest = s.courses.slice(3);
  return `<section class="spine-detail" aria-labelledby="spineStageHeading"><header><span class="eyebrow">当前环节</span><h2 id="spineStageHeading" tabindex="-1">${esc(s.title)}</h2><p class="spine-question">${esc(s.question)}</p><p>${esc(s.summary)}</p></header><dl class="spine-facts"><div><dt>追踪的对象</dt><dd>${esc(s.objects)}</dd></div><div><dt>需要分清</dt><dd>${esc(s.boundary)}</dd></div></dl><div class="spine-related"><h3>深入这个环节</h3><div>${courseLinks(first)}</div></div><details class="spine-more"><summary>控制、计算${rest.length ? `与其余 ${rest.length} 门关联课程` : "的职责边界"}</summary><p><strong>控制与调度：</strong>${esc(s.control)}</p><p><strong>实际计算：</strong>${esc(s.compute)}</p><div class="spine-course-list">${courseLinks(rest)}</div></details></section>`;
}
function extras() {
  return `<section class="spine-extras" aria-label="跨层追踪与扩展"><details><summary>沿同一对象跨章节追踪：五条机制线</summary><div class="spine-lenses">${crossLenses.map(l => `<details class="spine-lens"><summary>${esc(l.title)}</summary><p>${esc(l.summary)}</p><p class="spine-chain">${esc(l.chain)}</p><div class="spine-course-list">${courseLinks(l.courses)}</div></details>`).join("")}</div></details><details><summary>这些连接为什么成立？</summary><div class="spine-relations">${typedRelations.map(r => `<article><h3>${esc(r.from)} <span>${esc(r.type)}</span> ${esc(r.to)}</h3><p>${esc(r.reason)}</p></article>`).join("")}</div></details><details><summary>VLA 与世界模型的输入、输出和循环</summary><div class="spine-extensions">${extensions.map(x => `<article><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><a href="#spine/workload-${x.id}">查看这类工作负载 →</a></article>`).join("")}</div></details><details><summary>教学边界与一手依据</summary><p>图描述通用逻辑依赖，不是某一框架逐函数调用图。真实实现可以融合、异步或重排；具体采样顺序、缓存和完成事件须按版本核对。直接 Triton 不要求先经 Dynamo；手写 CUDA 和预编译库也有自己的路径。</p><p>参考：<a href="https://huggingface.co/docs/transformers/main/en/generation_strategies" target="_blank" rel="noopener">Transformers 生成策略</a> · <a href="https://pytorch.org/blog/triton-kernel-compilation-stages/" target="_blank" rel="noopener">Triton 编译阶段</a>。按 2026-11-19 核对；动态文档不等于固定版本源码审计。</p></details></section>`;
}
export function renderSystemSpine(selectedId = "request", trace = {}) {
  const selected = stageById.has(selectedId) ? selectedId : "request", stage = stageById.get(selected);
  const mode = stage.lane === "runtime" ? "runtime" : stage.lane === "workload" ? "workload" : stage.lane === "execution" ? "execution" : "compile";
  const family = mode === "runtime" ? runtimeStages : mode === "compile" ? compileStages : mode === "workload" ? workloadStages : [executionStage];
  const tabs = [["runtime", "request", "请求运行路径"], ["compile", "compile-source", "编译与构建路径"], ["execution", "kernel-execution", "GPU 执行与性能证据"], ["workload", "workload-vla", "VLA / 世界模型"]];
  const diagram = mode === "runtime" ? runtimeDiagram(selected) : mode === "compile" ? compileDiagram(selected) : "";
  return `<div class="system-spine"><header class="spine-hero"><span class="eyebrow">系统主线</span><h1 id="spineOverviewHeading" tabindex="-1">跟着一个请求，看清推理怎样发生</h1><p>先看数据与控制依赖，再进入具体课程。编译路径在后端派发处与请求执行汇合；GPU 微架构保留独立的下钻入口。</p></header><nav class="spine-modes" aria-label="系统主线视角">${tabs.map(([m, id, title]) => `<a href="#spine/${id}" aria-current="${mode === m ? "page" : "false"}">${title}</a>`).join("")}</nav>${diagram}<nav class="spine-stage-nav" aria-label="选择主线环节">${family.map(s => station(s, selected)).join("")}</nav>${stageDetail(stage)}${mode === "runtime" ? renderRequestTrace(trace) + `<p id="spineTraceAnnouncement" class="spine-announcement" role="status" aria-atomic="true"></p>` : ""}${mode === "execution" ? `<div class="spine-evidence-table"><h2>把机制结论接到对应证据</h2><table><thead><tr><th>观察对象</th><th>能回答什么</th><th>仍需什么</th></tr></thead><tbody><tr><td>IR / 设备代码</td><td>实际选择了哪些操作与布局</td><td>具体版本、Shape、目标设备</td></tr><tr><td>资源报告 / NCU</td><td>寄存器、访存、指令的局部行为</td><td>改变单一因素的对照实验</td></tr><tr><td>时间线 / 请求指标</td><td>工作是否重叠、瓶颈是否影响完成</td><td>正确性、负载分布与重复测量</td></tr></tbody></table></div>` : ""}${mode === "workload" ? `<p class="spine-note">共同执行底座：输入准备 → 算子派发 → GPU 执行。预测 Token、生成动作和模拟未来各有自己的状态与终止条件；从本页课程进入相应机制。</p>` : ""}${extras()}</div>`;
}
validateSystemSpine();
