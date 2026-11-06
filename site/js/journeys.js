/**
 * 场景导览与跨层关系。所有数值示例在课程中标注为教学假设。
 * 维护时参见 skills/knowledge-map-maintenance/SKILL.md。
 */
export const scenarios = [
  {
    id:'llm', name:'LLM 推理', tag:'从你熟悉的 vLLM 出发',
    intro:'一条请求进入服务后，怎样一步步变成 GPU 工作？关键在于把“模型做什么”和“系统怎样执行”分开。',
    caveat:'这是典型执行视角，并非所有 PyTorch 运算都经过 torch.compile 或 Triton。',
    steps:[
      {title:'请求进入',module:'engine',question:'谁安排什么时候算？',detail:'推理引擎接收请求，处理排队、批处理及缓存管理；服务层的等待不等于 GPU Kernel 时间。',work:'请求调度、KV Cache',observe:'队列等待、批次大小、TTFT',lesson:'vllm-route'},
      {title:'模型前向',module:'model',question:'具体要算什么？',detail:'模型按层运行，例如投影、Attention 和 MLP。数学计算会分解为若干算子，但并不一定是一个算子一个 Kernel。',work:'GEMM、Attention、Norm',observe:'张量形状、算子耗时',lesson:'transformer-workload'},
      {title:'生成设备任务',module:'compiler',question:'GPU 代码从哪来？',detail:'系统可能调用库 Kernel、编译出的程序或手写 CUDA/Triton；运行时向 GPU 提交工作。',work:'代码生成、Kernel Launch',observe:'编译/运行模式、Kernel 名称',lesson:'compiler-chain'},
      {title:'分析算子',module:'kernel',question:'真正耗时在哪里？',detail:'先在时间线定位关键路径，再分析具体 Kernel 的计算、访存和同步，不要只盯住一个计数器。',work:'Profiler、性能归因',observe:'端到端占比、Nsight 指标',lesson:'kernel-analysis'},
      {title:'分析硬件',module:'microarch',question:'为什么快或慢？',detail:'从 SM 调度、指令依赖、计算流水线和存储层次解释耗时。自研芯片的细节留在内网独立研究。',work:'Warp、Pipeline、L2/HBM',observe:'可发射 Warp、访存与流水线利用',lesson:'gpu-pipeline'}
    ]
  },
  {
    id:'vla', name:'机器人 VLA', tag:'从看见到产生动作',
    intro:'机器人模型也要执行神经网络，但输出可能是连续动作序列，而不只是逐 Token 生成文字。',
    caveat:'不同 VLA 可以用动作 Token、回归或迭代生成；下方展示其中一种常见的动作生成路线。',
    steps:[
      {title:'理解场景',module:'model',question:'模型看到了什么？',detail:'摄像头图像、语言指令和机器人状态作为条件输入；视觉编码将图像转为可计算特征。',work:'ViT、投影、Attention',observe:'分辨率、Patch 数、视觉编码开销',lesson:'vla-head'},
      {title:'形成动作条件',module:'model',question:'怎样把任务变成动作条件？',detail:'语言、视觉特征和机器人状态提供上下文；这里关心 Action Expert 的输入张量和调用频次。',work:'多模态融合、线性层',observe:'特征形状、缓存方式',lesson:'vla-head'},
      {title:'生成动作块',module:'model',question:'动作是怎么产生的？',detail:'部分模型使用 Flow Matching 多次更新动作变量，最后产生一段连续动作。也存在直接回归和动作 Token 方案。',work:'动作头 Transformer、迭代前向',observe:'迭代步数、每步耗时',lesson:'vla-head'},
      {title:'部署与执行',module:'compiler',question:'为什么端侧可能很慢？',detail:'视觉和动作头共同经过执行引擎、算子库或编译器。小批次、Kernel Launch 与数据搬运都可能影响实时性。',work:'TensorRT、CUDA Graph、Kernel',observe:'端到端延迟、P95/P99、GPU 空档',lesson:'compiler-chain'},
      {title:'追根到 GPU',module:'microarch',question:'硬件瓶颈究竟是什么？',detail:'不同算子可能分别受计算吞吐、存储带宽或指令依赖限制。要先量测，再选择优化方向。',work:'Tensor Core、Cache、Pipeline',observe:'每类算子 Shape、时间和资源使用',lesson:'kernel-analysis'}
    ]
  },
  {
    id:'world', name:'世界模型', tag:'预测环境会怎样变化',
    intro:'与直接输出动作的策略不同，世界模型着重学习状态变化或未来观测，可用于仿真、规划或训练数据生成。',
    caveat:'世界模型不是机器人每一步执行动作都必须调用的模块；模型结构也不一定是视频扩散。',
    steps:[
      {title:'读取历史观测',module:'model',question:'依据什么预测？',detail:'可以接收视频帧、状态、文字或动作条件，输入类型因模型而异。',work:'图像编码、时序特征',observe:'帧数、分辨率、输入维度',lesson:'world-model'},
      {title:'建模时间与空间',module:'model',question:'怎样理解变化？',detail:'时空 Transformer、卷积或潜空间模块对历史状态与变化进行建模。',work:'时空 Attention、Conv',observe:'Token/帧数、显存占用',lesson:'world-model'},
      {title:'预测未来',module:'model',question:'会发生什么？',detail:'模型可能预测未来状态、潜变量或视频帧；生成式方案可能要多轮迭代。',work:'生成头、Diffusion、Flow',observe:'每步计算成本、迭代次数',lesson:'world-model'},
      {title:'分析推理负载',module:'kernel',question:'GPU 花时间在哪里？',detail:'需要比较时间维和空间维带来的计算与访存增长，寻找真实热点。',work:'矩阵乘法、Attention、内存管理',observe:'不同序列长度、分辨率下的延迟',lesson:'kernel-analysis'},
      {title:'用于规划或训练',module:'systems',question:'预测结果被谁使用？',detail:'下游规划器、策略或仿真训练系统可以使用预测结果，但不一定处于机器人实时关键路径。',work:'规划、仿真或数据生成',observe:'是否处于实时链路、调用频率',lesson:'os-runtime'}
    ]
  }
];

export const moduleRoles={
  model:{question:'算什么？',summary:'定义网络结构、输入输出和需要执行的数学运算。',connect:'模型决定算子形状；同一个算子在不同模型中的负载也可能不同。'},
  engine:{question:'什么时候算？',summary:'组织请求、批处理、缓存、执行与结果返回。',connect:'调度方式影响模型运行的形状、频率和端到端等待时间。'},
  compiler:{question:'怎样变成 GPU 任务？',summary:'选择或生成设备代码，并通过运行时提交计算。',connect:'数据布局、代码生成和 Launch 会影响后续 Kernel 行为。'},
  kernel:{question:'哪里真正耗时？',summary:'分析 GPU 算子的形状、执行时间、正确性和瓶颈证据。',connect:'向上对应模型和引擎，向下对应微架构的执行原因。'},
  systems:{question:'哪些基础设施在支撑？',summary:'CPU、内存、驱动、通信与同步支撑各个层次。',connect:'是贯穿全链路的支撑知识，不要求先把操作系统学完。'},
  microarch:{question:'硬件为什么这样执行？',summary:'理解执行调度、计算流水线、访存层次和资源竞争。',connect:'以公开 B200 和通用机制解释性能；内部自研细节只在内网学习。'}
};

export const lessonRelations={
  'full-path|vllm-route':'从完整执行链路深入到请求调度和 Model Runner。',
  'full-path|compiler-chain':'从模型和算子调用继续往下，理解 GPU 代码与任务是如何产生的。',
  'full-path|gpu-pipeline':'从 Kernel 执行深入到 Warp、指令流水线和等待原因。',
  'full-path|os-runtime':'补足 CPU 提交、同步和数据搬运对端到端延迟的影响。',
  'transformer-workload|vla-head':'用已熟悉的 Transformer 算子理解 VLA 新的动作生成负载。',
  'vla-head|world-model':'分清“生成动作”和“预测未来环境”的职责与联系。',
  'vla-head|kernel-analysis':'动作网络的形状与迭代次数需要通过实际 Profiling 验证。',
  'compiler-chain|gpu-pipeline':'观察编译选择如何改变最终指令及其执行资源需求。',
  'gpu-pipeline|gpu-memory':'把指令等待与实际数据访问的路径对应起来。',
  'gpu-pipeline|kernel-analysis':'把调度和依赖机制转化为可验证的性能假设。',
  'gpu-memory|kernel-analysis':'缓存命中与带宽指标必须回到具体 Kernel 情境分析。',
  'vllm-route|os-runtime':'GPU 空档可能来自 CPU 调度、数据准备或同步。',
  'world-model|transformer-workload':'从已知 Transformer 计算扩展到时间与空间维度。'
};
export function reasonBetween(a,b){return lessonRelations[`${a}|${b}`]||lessonRelations[`${b}|${a}`]||'这两个主题共享执行链路或性能分析方法，可互相对照学习。'}

export const glossary=[
  {term:'Kernel（GPU 内核）',plain:'一段在 GPU 上并行执行的程序。一个模型前向通常会调用许多 Kernel。',lesson:'full-path'},
  {term:'Runtime（运行时）',plain:'负责把已经准备好的 GPU 工作提交执行、管理流与同步等；不同于编译器。',lesson:'compiler-chain'},
  {term:'IR（中间表示）',plain:'编译器使用的“半成品程序形式”，方便做优化和逐步转换。',lesson:'compiler-chain'},
  {term:'Lowering（降低抽象层）',plain:'把高级计算表达逐步转换为更接近硬件的操作，不等于简单翻译文字。',lesson:'compiler-chain'},
  {term:'Launch（启动 Kernel）',plain:'由 CPU/运行时发起设备执行请求；启动和调度本身也可能带来开销。',lesson:'full-path'},
  {term:'Warp（线程组）',plain:'NVIDIA GPU 中按组进行指令调度和执行的线程集合，通常为 32 个线程。',lesson:'gpu-pipeline'},
  {term:'SM（流多处理器）',plain:'GPU 上调度并执行线程的计算单元集合，包含多类执行资源。',lesson:'gpu-pipeline'},
  {term:'Pipeline（执行流水线）',plain:'指令进入不同的执行路径，多个操作在不同阶段交叠推进。',lesson:'gpu-pipeline'},
  {term:'Scoreboard（依赖跟踪）',plain:'跟踪指令所需数据是否就绪；依赖未满足时可能让 Warp 等待。',lesson:'gpu-pipeline'},
  {term:'HBM（高带宽显存）',plain:'GPU 旁的高带宽存储，给模型权重、KV Cache 等提供大量数据。',lesson:'gpu-memory'},
  {term:'Prefill（输入处理阶段）',plain:'模型一次处理较长输入上下文的阶段，计算形状与逐 Token 生成不同。',lesson:'transformer-workload'},
  {term:'Decode（逐步生成阶段）',plain:'语言模型逐 Token 生成时反复运行网络的阶段。',lesson:'transformer-workload'},
  {term:'KV Cache（注意力缓存）',plain:'缓存已经计算过的 Key 和 Value，减少后续生成时的重复计算。',lesson:'vllm-route'},
  {term:'VLA（视觉-语言-动作模型）',plain:'结合视觉、语言与机器人状态，预测机器人应该执行的动作。',lesson:'vla-head'},
  {term:'Action Head（动作生成头）',plain:'机器人模型中把特征转成动作的部分，可能采用 Transformer、回归或生成模型。',lesson:'vla-head'},
  {term:'Action Chunk（动作块）',plain:'一次输出接下来多个时间步的动作，而非只输出一个瞬间的动作。',lesson:'vla-head'},
  {term:'Flow Matching（流匹配）',plain:'一种连续生成建模方法；部署时可以通过多步更新生成动作等输出。',lesson:'vla-head'},
  {term:'World Model（世界模型）',plain:'学习环境如何随时间或动作变化，可用于预测、规划或仿真。',lesson:'world-model'},
];
