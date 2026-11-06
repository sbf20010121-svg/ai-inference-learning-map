/**
 * 学习地图内容源。增补节点遵循 skills/lesson-authoring/SKILL.md。
 * 所有技术说明为公开通用知识；禁止写入内网芯片规格和内部测量数据。
 */
export const modules = [
  {id:'model', label:'AI 模型与算法', short:'模型', num:'01', sub:'LLM · VLM · VLA · 世界模型', color:'#8b66bd', x:190,y:140, description:'认识不同 AI 模型怎样组织计算，哪些新模型带来了新推理负载。'},
  {id:'engine', label:'推理引擎与部署', short:'推理引擎', num:'02', sub:'vLLM · DeepInfer · Serving', color:'#347fa8', x:575,y:140, description:'理解请求进入推理系统后，调度、缓存、执行和服务如何协作。'},
  {id:'compiler', label:'编译器与 Runtime', short:'编译与运行', num:'03', sub:'IR · CUDA · Triton · TensorRT', color:'#b77938', x:960,y:140, description:'理解模型计算如何经过图优化、代码生成和 Runtime 变成设备工作。'},
  {id:'kernel', label:'GPU 算子与性能', short:'算子分析', num:'04', sub:'Profiling · Kernel · 建模', color:'#168b83', x:985,y:645, description:'从算子与实际测量出发，分析访存、执行与时间开销。'},
  {id:'systems', label:'系统基础', short:'系统基础', num:'05', sub:'OS · Driver · 分布式', color:'#627ca0', x:190,y:645, description:'只补能帮助解释推理执行的 OS、驱动、内存和通信基础。'},
  {id:'microarch', label:'GPU 微架构深入', short:'微架构', num:'06', sub:'B200 · 内网独立对照', color:'#bd755c', x:575,y:645, description:'长期深入硬件调度、计算 Pipeline、存储层次与资源竞争。内网细节留在内网。'},
];

export const lessons = [
  {
    id:'full-path', module:'engine', title:'一次推理怎样走到 GPU？', short:'模型 → 硬件', level:'基础贯通', minutes:22, x:565,y:310,
    brief:'从模型调用到 Kernel 指令，把你熟悉的 vLLM、CUDA、GPU 微架构接成一条完整路径。',
    analogy:'像一条生产线：模型决定做什么；调度器决定何时做；Runtime 发工单；GPU 执行工序。',
    takeaway:'“模型推理慢”不等于“某个 Kernel 慢”。逐层区分排队、CPU 提交、内存搬运、Kernel 运行和同步。',
    goals:['能说明模型计算与 GPU Kernel 的关系','能说出推理框架、编译器和 Runtime 各自负责什么','会从 Nsight Systems 时间线提出可验证的瓶颈假设'],
    steps:[
      {title:'请求与输入',sub:'文本 / 图片 / 状态',why:'Tokenize、图像预处理或状态整理，确定输入数据和请求约束。',see:'排队之前的预处理时间、输入 Shape'},
      {title:'推理调度',sub:'Scheduler / Batch',why:'引擎决定哪批请求参与执行，并准备缓存管理和执行资源。',see:'排队时间、Batch Shape、调度时间'},
      {title:'模型前向',sub:'Runner / Model',why:'Model Runner 准备模型输入、触发模型计算；一个前向通常包含多个算子和 Kernel。',see:'模型模块耗时、算子分布'},
      {title:'算子与代码',sub:'GEMM / Attention',why:'算子可走库 Kernel、手写 Triton/CUDA 或编译生成的代码；编译和 Graph Capture 可以事先完成。',see:'具体 Kernel 名称、对应 Shape、编译模式'},
      {title:'CUDA Runtime',sub:'Launch / Stream',why:'将设备工作提交到 Stream；排队、提交、同步及 Graph Replay 都可能影响实际时间线。',see:'GPU 空档、Kernel Launch 间隔、同步事件'},
      {title:'GPU 硬件',sub:'SM / Cache / HBM',why:'指令在不同执行单元上运行，读取数据并受到吞吐、延迟、依赖和资源竞争等约束。',see:'Kernel 时间、Warp Stall、带宽与 Tensor Core 指标'},
      {title:'输出与反馈',sub:'结果 / 下一轮',why:'生成 Token、动作块等结果，并决定是否返回用户或继续下一轮推理。',see:'端到端延迟、吞吐、尾延迟'},
    ],
    points:[{t:'关键区分',d:'PyTorch 是高层张量 API，不意味着每一次前向都经过 TorchInductor 或 Triton；库调用、自定义 Kernel、编译路径可以并存。'},{t:'看性能的方法',d:'先看端到端时间线，找到真正占时的阶段；再针对热点进入 Nsight Compute，而不是见到某个慢 Kernel 就默认它是系统瓶颈。'}],
    quiz:{q:'一个 Kernel 从 20 μs 优化到 10 μs，但总推理仍然是 8 ms。最合理的下一步是？',opts:['继续盲目优化同一个 Kernel','测量该 Kernel 在端到端中的占比，以及其他阶段的等待与开销','立刻提高 GPU 主频'],correct:1,why:'先判断是否处在关键路径及其占比。局部加速和端到端收益之间受系统其他部分限制。'},
    related:['vllm-route','compiler-chain','gpu-pipeline'], refs:[['vLLM Architecture','https://docs.vllm.ai/en/latest/design/arch_overview/'],['Nsight Systems','https://docs.nvidia.com/nsight-systems/']], interactive:'latency'
  },
  {
    id:'transformer-workload', module:'model', title:'Transformer 到底产生哪些计算？', short:'LLM 算子拆解', level:'基础贯通', minutes:18, x:395,y:310,
    brief:'不重新讲模型数学，而是沿张量流看 Attention、Norm、MLP 为何对应不同 GPU 负载。',
    analogy:'像工厂流水线：矩阵乘法是大规模加工；Norm 是按统计量校准；Attention 是跨 Token 的信息调度。',
    takeaway:'同样叫 GEMM，Batch、序列长度、M/N/K 和数据布局不同，GPU 瓶颈可能完全不同。',
    goals:['能把 Transformer Block 分成典型算子','区分 Prefill 与 Decode 的负载形状','对算子瓶颈给出基于形状的初步判断'],
    steps:[
      {title:'Token 表示',sub:'[B,S,H]',why:'输入张量组织为 Batch、序列长度、隐藏维度。',see:'实际 B、S、H 与 dtype'},
      {title:'QKV 投影',sub:'Linear / GEMM',why:'线性层映射得到查询、键和值；可融合也可分离实现。',see:'矩阵尺寸和 Tensor Core 利用'},
      {title:'Attention',sub:'QKᵀ / Softmax / AV',why:'计算跨 Token 相关性；通常使用融合 Kernel 减少不必要的中间存储。',see:'访存、算力与序列长度'},
      {title:'输出与 Norm',sub:'Reduce / Elementwise',why:'Reduce、归一化与逐元素操作可能在小 Shape 下产生启动或访存开销。',see:'Kernel 数量和单次耗时'},
      {title:'MLP / MoE',sub:'GEMM / Routing',why:'Dense MLP 以矩阵运算为主；MoE 还涉及路由、Gather/Scatter 和通信。',see:'专家负载分布与通信时间'},
    ],
    points:[{t:'一个常见误解',d:'Decode 不等于所有算子一定是显存带宽瓶颈；具体受 Batch、量化、KV Cache、硬件与实现影响。'},{t:'直接连接你的工作',d:'每次看 Kernel，先记录 Shape、dtype、Memory Layout、是否在关键路径，再分析 Pipeline 和 Warp Stall。'}],
    quiz:{q:'为什么同一个模型的 Prefill 和单请求 Decode 可能有不同的瓶颈？',opts:['因为它们运行在不同型号 GPU 上','因为参与计算的矩阵形状、KV 访问与并行度不同','因为 Decode 不使用 Attention'],correct:1,why:'Prefill 和 Decode 的计算形状与数据重用方式不同，因而可能分别靠近计算/访存/启动等不同瓶颈。'},
    related:['full-path','vla-head'], refs:[['PyTorch scaled_dot_product_attention','https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html']], interactive:'shapes'
  },
  {
    id:'vllm-route', module:'engine', title:'vLLM：从 Scheduler 到 Model Runner', short:'推理引擎链路', level:'已有基础·进阶', minutes:20, x:727,y:310,
    brief:'利用你已经学过的 vLLM 知识，重点追踪执行路径，不重复 KV Cache 入门。',
    analogy:'Scheduler 是排班员；KV Cache 是中间材料库；Model Runner 把这批计算交给 GPU。',
    takeaway:'把 Serving、调度、缓存、执行、GPU Timeline 串起来，才能知道延迟来自哪里。',
    goals:['理解 Scheduler 与 Model Runner 的职责边界','分辨服务层排队与 GPU 内核时间','知道需要检查代码版本，避免混淆旧 vLLM 架构'],
    steps:[
      {title:'请求进入',sub:'API / Engine',why:'用户请求经服务入口进入引擎，可产生排队和输入预处理开销。',see:'请求进入、队列及等待时间'},
      {title:'调度',sub:'Scheduler',why:'在资源约束内决定哪些请求和 Token 参与下一次执行。',see:'运行请求、等待请求、Token budget'},
      {title:'缓存管理',sub:'KV / Block',why:'维护注意力缓存的空间和生命周期，影响是否可继续执行。',see:'Block 使用情况和内存占用'},
      {title:'模型执行',sub:'Worker / Runner',why:'Model Runner 准备计算输入并触发模型执行。',see:'CPU 调度间隔、Graph 模式、GPU Timeline'},
      {title:'返回输出',sub:'Sampling / Stream',why:'根据结果组织输出、流式返回，并让下一轮请求进入调度。',see:'TPOT、TTFT、端到端时延'},
    ],
    points:[{t:'进阶重点',d:'不要以函数名记忆某个旧版本的 vLLM；依据所用 Git commit 绘制当时的真实调用链。'},{t:'与 DeepInfer 对照',d:'优先比较不同引擎如何完成同一任务（调度、缓存、专用 Kernel），再研究具体实现差别。'}],
    quiz:{q:'观察到 GPU 有明显空档，但单个 Kernel 本身很快。应先排查什么？',opts:['只有 GPU 算术吞吐','CPU/Runtime 提交与调度、同步及数据准备','只看显存容量'],correct:1,why:'GPU 空档常在系统执行链路中出现，不能直接归因于单个 Kernel。'},
    related:['full-path','os-runtime'], refs:[['vLLM Documentation','https://docs.vllm.ai/'],['vLLM GitHub','https://github.com/vllm-project/vllm']] 
  },
  {
    id:'compiler-chain', module:'compiler', title:'PyTorch 如何走到 PTX / SASS？', short:'编译链路', level:'基础贯通', minutes:24, x:933,y:315,
    brief:'理解计算图、IR、Lowering、编译与 CUDA Runtime 的边界，弄清源码为什么不等于最终指令。',
    analogy:'高级源码是设计图；IR 是逐步细化的施工图；PTX/SASS 更接近设备的操作指令。',
    takeaway:'IR、数据布局、寄存器分配和指令选择会改变硬件表现，但它们不是同一个编译阶段。',
    goals:['知道 eager、torch.compile、手写 Triton 是不同执行路径','能讲清 IR 与 Lowering 的功能','能从 Triton 源码定位到 PTX/SASS 和硬件执行'],
    steps:[
      {title:'模型 / 算子',sub:'PyTorch / Triton',why:'高层表达式或手写 Kernel 描述数学和并行程序。',see:'源码、张量 Shape、Layout'},
      {title:'计算图 / IR',sub:'FX · TTIR',why:'把计算表示成便于分析与变换的中间形式。',see:'算子节点、依赖、布局信息'},
      {title:'优化 / Lowering',sub:'融合 · Layout',why:'分解高级操作、选择映射、做一系列编译优化。',see:'中间代码和编译开关'},
      {title:'设备代码',sub:'PTX / Cubin',why:'低层代码进一步成为实际设备指令；PTX 不等于最终 SASS。',see:'PTX/SASS 差异、指令数'},
      {title:'CUDA Runtime',sub:'Launch / Stream',why:'Runtime 将编译好的设备程序按 Stream 语义提交执行。',see:'Launch、同步、Graph 与 CPU/GPU 时间线'},
    ],
    points:[{t:'必要的边界',d:'torch.compile 常经 Dynamo/Inductor 路径生成代码，但不是所有 PyTorch 运算都走 Triton；cuBLAS、CUDA 自定义 Kernel 等路径可以同时存在。'},{t:'练习方向',d:'拿一个 Triton GEMM，比较源码 Tile、IR、PTX/SASS、寄存器、真实时间，不要只看编译 IR 猜性能。'}],
    quiz:{q:'在 NVIDIA GPU 上，PTX 和 SASS 是同一个东西吗？',opts:['是，完全相同','不是，PTX 是虚拟 ISA，SASS 是最终执行的设备指令','只有 SASS 才能表示内存指令'],correct:1,why:'PTX 是虚拟指令集，实际硬件执行由目标 GPU 的机器指令决定。'},
    related:['full-path','gpu-pipeline'], refs:[['PyTorch torch.compile','https://docs.pytorch.org/docs/stable/torch.compiler.html'],['Triton Tutorials','https://triton-lang.org/main/getting-started/tutorials/index.html'],['NVIDIA PTX ISA','https://docs.nvidia.com/cuda/parallel-thread-execution/']] 
  },
  {
    id:'gpu-pipeline', module:'microarch', title:'一条 GPU 指令怎样执行？', short:'Warp · Pipeline', level:'微架构主线', minutes:28, x:685,y:466,
    brief:'从 Warp 发射、Scoreboard、执行流水线、写回，理解为什么 GPU 可以隐藏延迟、为什么又会 Stall。',
    analogy:'调度器像车站调度员；不同执行管线像不同站台；Scoreboard 记录哪些指令还在等材料。',
    takeaway:'延迟和吞吐不同；一个 Warp 等待时，其他可运行 Warp 可以利用执行资源，但资源竞争会限制收益。',
    goals:['区分发射、执行、完成与等待','理解数据依赖和 Scoreboard 的作用','能将 Warp Stall 现象转化为待验证的资源/依赖假设'],
    steps:[
      {title:'准备 Warp',sub:'Ready / Eligible',why:'调度单元需要找到满足依赖和资源约束的 Warp/指令。',see:'Active/Eligible Warps，调度效率'},
      {title:'检查依赖',sub:'Scoreboard',why:'依赖的寄存器结果未准备好时，该 Warp 可能无法发射下一条相关指令。',see:'Long / Short Scoreboard 等 Stall 指标'},
      {title:'发射指令',sub:'Issue',why:'一条指令被送往合适执行路径；具体可发射宽度与组织因架构而异。',see:'Issued Warps、Pipe 使用情况'},
      {title:'执行流水线',sub:'ALU / MMA / LSU',why:'计算或访存单元执行指令，受吞吐、访问延迟和资源竞争影响。',see:'计算 Pipe、访存吞吐与请求队列'},
      {title:'结果就绪',sub:'Complete / Dependency',why:'完成数据写回或依赖解除，后续指令才可继续。',see:'依赖链长度与可重叠工作'},
    ],
    points:[{t:'跨架构对照方法',d:'公开 B200 机制可以作为参照；自研芯片的内部调度、Issue/Scoreboard 组织可能不同，只在公司内网完成细节映射。'},{t:'不要误判',d:'Occupancy 低不自动代表性能差；要看实际运行 Warp 数是否足以覆盖当前指令延迟、是否已被吞吐或依赖限制。'}],
    quiz:{q:'为何增加 Occupancy 有时并不能提升 Kernel 性能？',opts:['Occupancy 从不影响性能','Kernel 可能已受计算吞吐或单条串行依赖约束，更多 Warp 不一定带来可用并行工作','因为更多 Warp 总会变慢'],correct:1,why:'需要识别当前瓶颈。增加可运行 Warp 数只有在它真正改善延迟隐藏或资源使用时才有收益。'},
    related:['gpu-memory','kernel-analysis'], refs:[['NVIDIA Blackwell Tuning Guide','https://docs.nvidia.com/cuda/blackwell-tuning-guide/'],['Nsight Compute Profiling Guide','https://docs.nvidia.com/nsight-compute/ProfilingGuide/']], interactive:'pipeline'
  },
  {
    id:'gpu-memory', module:'microarch', title:'寄存器、L1/L2、HBM 怎么协同？', short:'GPU 存储层次', level:'微架构主线', minutes:24, x:492,y:466,
    brief:'从一次 Load 的数据流理解 Cache 命中、带宽、延迟、合并访存和数据复用。',
    analogy:'寄存器是手边工具；片上缓存是车间储物柜；HBM 是远处的大型仓库。',
    takeaway:'容量、延迟、带宽、共享范围是不同维度；“L2 命中高”未必等于性能好。',
    goals:['区分 register、shared memory、L1/L2、HBM','理解数据复用和访存合并对性能的影响','知道怎样配合 Kernel Shape 与 NCU 指标分析缓存表现'],
    steps:[
      {title:'寄存器',sub:'Thread / Warp 工作集',why:'极快的寄存器用于存放临时值；过多使用可能影响并发或导致 Spill。',see:'Registers/thread、Spill 迹象'},
      {title:'Shared / L1',sub:'片上局部存储',why:'软件管理的 Shared Memory 与硬件缓存行为各有作用，适用于块内数据复用。',see:'Shared 使用率、L1/TEX 统计'},
      {title:'L2 Cache',sub:'更大共享缓存',why:'帮助部分跨 SM 或重复访问数据命中缓存，降低对 HBM 的访问。',see:'L2 hit、Bytes、访问模式'},
      {title:'HBM',sub:'显存',why:'容量大、带宽高，但访问延迟和数据搬运成本通常大于片上资源。',see:'DRAM throughput、读写 Bytes'},
      {title:'返回计算',sub:'重用 / 同步',why:'搬运回的数据被计算消耗；是否能与计算重叠取决于依赖与同步。',see:'Memory Stall、可重叠任务与时间线'},
    ],
    points:[{t:'注意',d:'GPU 的 Register、Shared、L1、L2 并非每次访存都严格逐级经过；数据路径和缓存策略取决于指令及架构。上图只是认知顺序。'},{t:'与推理关联',d:'单 Batch Decode、KV Cache、Gather 算子都可以用数据复用与访存模式分析，但要避免只看一个命中率指标。'}],
    quiz:{q:'看到 L2 Hit Rate 从 30% 升至 80%，能否直接断定 Kernel 更快？',opts:['能，必然更快','不能，还要看数据量、执行时间、指令/请求数量和其他瓶颈','不能，因为 Cache 完全没用'],correct:1,why:'单个命中率指标不能反映所有性能原因，甚至不同数据量也会改变分母。'},
    related:['gpu-pipeline','kernel-analysis'], refs:[['CUDA Programming Guide','https://docs.nvidia.com/cuda/cuda-programming-guide/'],['Nsight Compute Profiling Guide','https://docs.nvidia.com/nsight-compute/ProfilingGuide/']] 
  },
  {
    id:'kernel-analysis', module:'kernel', title:'怎么从 Profiling 走到优化？', short:'性能归因闭环', level:'实践核心', minutes:26, x:975,y:468,
    brief:'避免“看一个指标就下结论”，练习从端到端热点、Shape、指标、机制到受控实验。',
    analogy:'像排查交通拥堵：先找堵在哪段路，再确认是路太窄、信号灯还是车流分配。',
    takeaway:'性能归因是证据链：观察现象 → 列假设 → 设计对照 → 复测正确性与收益。',
    goals:['分清 Nsys 与 NCU 的用途','知道计算瓶颈、带宽瓶颈、延迟瓶颈的证据如何不同','能设计一个最小对照实验'],
    steps:[
      {title:'定义问题',sub:'E2E / Kernel 目标',why:'明确优化目标是吞吐、尾延迟、某个 Shape，还是特定 GPU 资源。',see:'可重复的基准、输入数据'},
      {title:'找热点',sub:'Nsight Systems',why:'观察完整 CPU/GPU 时间线与关键路径，识别主要耗时区域。',see:'GPU 空档、Memcpy、Kernel 序列'},
      {title:'测算子',sub:'Nsight Compute',why:'结合执行单元、Cache、Warp Stall、带宽、指令指标提出解释。',see:'统一配置下可对照的计数器'},
      {title:'列出假设',sub:'机制 / 证据',why:'比如依赖链太长、访存不合并或计算管线饱和，并说明替代解释。',see:'指标支持与反例'},
      {title:'验证优化',sub:'单变量对照',why:'改 Tile、并行度、Cache 策略或融合方式，并进行正确性与稳定性验证。',see:'重复测量、误差范围、真实 E2E 收益'},
    ],
    points:[{t:'常见陷阱',d:'单独观察 Long Scoreboard 高不等于一定是 HBM 慢；可能同时包含依赖、Cache Miss、访存请求等因素。'},{t:'建模连接',d:'用硬件机制和 Kernel 源码推导可解释的延迟/资源关系，再用数据校准，而非直接拟合“输入大小→耗时”。'}],
    quiz:{q:'NCU 显示 Long Scoreboard 占比较高，下一步最佳做法？',opts:['直接定性为 HBM 带宽不足','结合访存层次、吞吐、请求量、指令依赖和对照实验判断','只增大 Block Size'],correct:1,why:'Stall 原因通常需要多个指标和实验交叉验证。'},
    related:['gpu-pipeline','compiler-chain'], refs:[['Nsight Systems','https://docs.nvidia.com/nsight-systems/'],['Nsight Compute','https://docs.nvidia.com/nsight-compute/']] 
  },
  {
    id:'os-runtime', module:'systems', title:'系统基础：为什么 GPU 会空等？', short:'OS 与运行时', level:'按需补基础', minutes:19, x:210,y:467,
    brief:'不学整个操作系统课程，只沿 CPU 进程、线程、同步、内存搬运和 GPU 提交路径理解延迟。',
    analogy:'GPU 像工厂设备；CPU/Runtime 负责接单和上料；设备空转未必因为设备太慢。',
    takeaway:'内核性能与端到端性能之间往往还隔着线程调度、数据准备、同步和跨设备传输。',
    goals:['区分 CPU 工作线程与 GPU Kernel','理解异步 Stream、同步、Pinned Memory、DMA 的用途','知道如何在时间线上辨别 CPU 与 GPU 的停顿'],
    steps:[
      {title:'进程与线程',sub:'CPU 调度',why:'服务进程和工作线程准备请求，受到 CPU 执行、锁及线程调度影响。',see:'CPU 栈、线程执行时间'},
      {title:'数据准备',sub:'RAM / Pinned',why:'输入数据在主机内存中准备，某些场景需要主机与设备之间的传输。',see:'内存分配与拷贝时机'},
      {title:'异步提交',sub:'CUDA Stream',why:'CPU 提交 Kernel / Memcpy 后，GPU 通常异步执行；Stream 及事件建立顺序和同步关系。',see:'Launch 到执行的间隔'},
      {title:'GPU 执行',sub:'Compute / Copy',why:'计算和数据传输是否重叠取决于硬件、资源、Stream 及依赖。',see:'Kernel 与传输时间线'},
      {title:'等待与返回',sub:'Sync / Response',why:'不必要的同步可能使 CPU 或 GPU 等待。',see:'Sync API、响应时间'},
    ],
    points:[{t:'无需先学',d:'文件系统内核实现、Linux 内核完整源码、调度算法理论证明等可暂缓。'},{t:'与编译器的边界',d:'编译器决定怎样生成代码；Runtime/驱动负责提交和执行管理；OS 提供进程、线程及内存等基础能力。'}],
    quiz:{q:'CPU 发起 CUDA Kernel Launch 后，一定等待 Kernel 在 GPU 上完成才继续吗？',opts:['一定等待','通常异步提交；显式同步或依赖关系才会形成等待','GPU Kernel 不需要 CPU 发射'],correct:1,why:'大多数 CUDA Launch 对主机异步，但具体操作、同步条件与错误处理有例外。'},
    related:['full-path','compiler-chain'], refs:[['CUDA Runtime API','https://docs.nvidia.com/cuda/cuda-runtime-api/'],['CUDA Programming Guide','https://docs.nvidia.com/cuda/cuda-programming-guide/']] 
  },
  {
    id:'vla-head', module:'model', title:'VLA 动作生成和 LLM Decode 有何不同？', short:'VLA · Flow Matching', level:'重点拓展', minutes:28, x:236,y:310,
    brief:'从一个机器人“看见杯子并伸手”的例子理解视觉、语言、状态与 Action Head 的计算。',
    analogy:'LLM 通常逐 Token 写下一句话；VLA 可以先理解场景，再一次生成一段连续动作，也可能迭代修正动作轨迹。',
    takeaway:'机器人模型不必都按自回归 Token 生成；动作块、Flow Matching 的多步前向和视觉编码会引入不同的 GPU 负载。',
    goals:['区分 VLM、VLA 与机器人 Policy','理解 Flow Matching / Diffusion 动作头的迭代计算','对比不同动作生成方案带来的推理延迟问题'],
    steps:[
      {title:'多模态输入',sub:'图像 / 文字 / 状态',why:'机器人接收摄像头画面、任务文本和关节等状态。',see:'输入分辨率、图像数量、状态维度'},
      {title:'视觉 / 语言编码',sub:'ViT / VLM',why:'提取环境中的语义、物体和上下文特征。',see:'视觉 Encoder 与 Attention/GEMM'},
      {title:'条件融合',sub:'State / Feature',why:'动作策略结合状态、视觉特征与任务条件形成动作生成上下文。',see:'融合层、特征张量和缓存'},
      {title:'动作生成',sub:'Flow / Diffusion',why:'一些 VLA 从噪声动作开始，多次运行 Action Expert 逐步更新动作预测。',see:'迭代次数、每步 Kernel 时间、算子形状'},
      {title:'动作块输出',sub:'Action Chunk',why:'输出多个未来时间步的连续动作，并由执行系统消费。',see:'动作维度、Chunk 长度、规划周期'},
    ],
    points:[{t:'严格区分',d:'强化学习是训练策略的方法之一，推理时通常执行已经学到的 Policy；VLA 也可能通过模仿学习训练。'},{t:'值得优化',d:'重点测量视觉编码和 Action Expert 占比、小 Batch 延迟、迭代推理与 Kernel Launch，而不是假设所有耗时都在 Attention。'}],
    quiz:{q:'基于 Flow Matching 的 VLA Action Head，为什么可能比一次 MLP 前向需要更多 Kernel 调用？',opts:['因为必须每次重新训练','因为可能要经过多次迭代更新动作变量，每次运行动作网络','因为它只能在 CPU 上运行'],correct:1,why:'推理中的多次动作状态更新可能串行调用动作网络，步数与每步延迟共同决定生成成本。'},
    related:['transformer-workload','world-model','kernel-analysis'], refs:[['SmolVLA','https://huggingface.co/docs/lerobot/smolvla'],['openpi','https://github.com/Physical-Intelligence/openpi']], interactive:'vla'
  },
  {
    id:'world-model', module:'model', title:'世界模型为什么值得关注？', short:'世界模型 · 视频', level:'趋势理解', minutes:21, x:75,y:310,
    brief:'理解世界模型预测环境变化的目标，以及它与动作策略、VLA、视频生成的联系和区别。',
    analogy:'动作 Policy 决定下一步做什么；世界模型尝试预测“如果这样做，世界可能变成什么样”。',
    takeaway:'世界模型既可以用于训练、规划或环境模拟，也可能与动作生成耦合；不等于每一步实时控制必经的模型。',
    goals:['区分 Policy 与世界模型的职责','认识视频/时空生成的主要计算结构','明确哪些世界模型推理问题值得做 GPU 性能分析'],
    steps:[
      {title:'观测历史',sub:'Frames / State',why:'视频帧、机器人状态或其他观测提供世界变化的上下文。',see:'视频帧数、分辨率、Token 数'},
      {title:'条件与动作',sub:'Text / Action',why:'可根据文本、控制信号或动作条件进行预测；并非所有模型都接收动作。',see:'条件编码形式'},
      {title:'时空建模',sub:'Spatial / Temporal',why:'使用空间和时间特征理解环境连续变化。',see:'时空 Attention / Conv / Latent'},
      {title:'未来预测',sub:'Video / Latent',why:'预测后续帧、隐状态或其他未来表征，可包含生成式迭代。',see:'推理步数、分辨率与吞吐'},
      {title:'规划或训练',sub:'Policy / Simulator',why:'预测结果可辅助动作选择、合成数据或模型训练。',see:'是否进入实时关键路径'},
    ],
    points:[{t:'常见混淆',d:'世界模型不等同于 VLA，也不是“强化学习模型”的同义词。不同项目对世界模型的定义和使用方式有差异。'},{t:'GPU 研究机会',d:'视频序列增长、跨帧 Attention、潜空间扩散、多步迭代和缓存机制，是值得研究的计算负载。'}],
    quiz:{q:'机器人每次做一个动作，都一定要运行大型世界模型吗？',opts:['一定要','不一定；世界模型可能只用于训练、规划或部分决策','世界模型只用于文字预测'],correct:1,why:'部署方式随系统设计而不同，世界模型不是所有闭环动作的必经模块。'},
    related:['vla-head','transformer-workload'], refs:[['NVIDIA Cosmos','https://developer.nvidia.com/cosmos'],['Genie（Google DeepMind）','https://deepmind.google/discover/blog/genie-2-a-large-scale-foundation-world-model/']] 
  }
];

export const edges = [
  ['model','engine'],['engine','compiler'],['compiler','kernel'],['kernel','microarch'],['microarch','systems'],['systems','engine'],
  ['model','world-model'],['model','vla-head'],['model','transformer-workload'],
  ['engine','full-path'],['engine','vllm-route'],
  ['compiler','compiler-chain'],['kernel','kernel-analysis'],
  ['systems','os-runtime'],['microarch','gpu-pipeline'],['microarch','gpu-memory'],
  ['full-path','compiler-chain'],['full-path','gpu-pipeline'],['transformer-workload','vla-head'],['vla-head','world-model'],['vla-head','kernel-analysis'],
  ['compiler-chain','gpu-pipeline'],['kernel-analysis','gpu-pipeline'],['gpu-pipeline','gpu-memory'],['os-runtime','full-path'],['vllm-route','full-path'],
];

export const allNodes = [...modules.map(m=>({...m,type:'module'})), ...lessons.map(l=>({...l,type:'lesson'}))];
export const nodeMap = new Map(allNodes.map(n=>[n.id,n]));
