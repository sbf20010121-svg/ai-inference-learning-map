import { define, page, math } from "./foundation-lessons.js";
export const gpuCourses = [
  define({
    id: "gpu-execution",
    module: "microarch",
    unit: "gpu-execution",
    title: "Grid、CTA、Warp 与执行资源",
    goal: "把逻辑线程编号、CTA共享范围和SM执行位置分开，建立后续发射与访存分析的坐标系。",
    why: "Program/Block的逻辑任务和实际驻留资源不是同一个层次；线程号不会直接指定某个SM。",
    prereqs: [["triton-tiling", "逻辑Tile分配之后还需要线程协作与硬件执行。"]],
    source: "cuda",
    section:
      "Thread Hierarchy、Hardware Implementation和SIMT；具体SM安排为教学示意。",
    terms:
      "Grid|一次Kernel启动的CTA集合;CTA/Block|具有共享存储与相应协作边界的线程组;Warp|本课CUDA模型中的32线程执行组;SM|执行驻留CTA/Warp的设备处理单元;lane|Warp内0到31的线程位置",
    chapters: [
      page(
        "indices",
        "同一个线程有哪几个编号",
        "Block1中thread5的全局线性ID与Warp内位置是什么？",
        "每Block64线程时，全局ID=1×64+5=69；CTA内Warp号0、Lane5。将三种编号分别画在对应层级，避免混淆全局ID和Lane。",
        { formula: true, code: true },
      ),
      page(
        "scope",
        "共享和同步到哪里",
        "不同CTA的thread0能否因为编号相同就共享同一块Shared？",
        "图把各CTA的Shared区域分开，SM安排只说明驻留位置。一般Block同步不自动建立跨Block屏障；特殊协作机制需要额外条件。",
        { quiz: true },
      ),
      page(
        "schedule",
        "逻辑任务怎样映射资源",
        "能从blockIdx直接推断SM编号或执行先后吗？",
        "本图提供两种合法教学调度，逻辑输出责任保持不变，实际驻留次序不同。调度、资源限制和并发需根据目标硬件验证。",
      ),
    ],
    formula: math(
      "<mrow><mi>globalId</mi><mo>=</mo><mi>blockId</mi><mo>×</mo><mi>blockSize</mi><mo>+</mo><mi>threadId</mi></mrow>",
    ),
    derive: [
      "blockSize=64、blockId=1、threadId=5。",
      "globalId=69；CTA内warp=floor(5/32)=0，lane=5。",
      "threadId=37则CTA内warp1、lane5；同Lane编号不表示同一线程。",
    ],
    code: "block_id,thread_id,block_size=1,5,64\nglobal_id=block_id*block_size+thread_id\nwarp,lane=thread_id//32,thread_id%32\nassert (global_id,warp,lane)==(69,0,5)",
    quiz: [
      "不同CTA的Lane5是否自动指向同一Shared槽和同一线程？",
      [
        "是",
        "不是，编号必须结合CTA/Warp与资源范围解释",
        "只有globalId不相同时才不同",
      ],
      1,
      "局部编号需要作用域；同编号不能越过CTA共享与同步边界。",
    ],
    limit:
      "CUDA的32线程Warp与线性索引例；SM数量和CTA调度为手工安排，不是B200拓扑或周期仿真。",
  }),
  define({
    id: "shared-bank",
    module: "microarch",
    unit: "gpu-memory",
    title: "Shared Memory Bank Conflict 与 Padding",
    goal: "由实际访问字地址计算Bank，区分同Bank不同字冲突与同一字广播。",
    why: "全局内存Coalescing和Shared Bank Conflict是不同地址组织问题，不能用一张“连续访存更好”图概括。",
    prereqs: [
      ["memory-route", "先区分Shared与Cache和全局地址段。"],
      [
        "gpu-execution",
        "Bank冲突分析需要同次访问的Lane地址；局部编号必须保留其Warp作用域。",
      ],
    ],
    source: "best",
    section:
      "Shared Memory and Memory Banks：32个Bank、32-bit word的基本示例；其它访问宽度需另行分析。",
    terms:
      "bank|Shared可并行服务的分组;word address|按本例32-bit字计量的地址;bank conflict|同一访问组向同Bank请求不同字造成的服务冲突;broadcast|多个Lane读取同一字的共享服务情形;padding|在物理布局中插入额外间隔",
    chapters: [
      page(
        "map",
        "先算地址再算Bank",
        "32×32矩阵按列读取时，为什么32个Lane落同一个Bank？",
        "Lane i读取word=i×32，bank=word mod32，全部为0，但字地址各不相同。图同时保留Lane、Word和Bank，不能只数访问条数。",
        { formula: true },
      ),
      page(
        "padding",
        "多一列怎样改变映射",
        "行Stride改33以后，原列读取的Bank变成什么？",
        "word=i×33，bank=i，所以本标量模型中32个Lane分散到32个Bank。Padding改变物理Stride，不改变逻辑矩阵的有效元素数量。",
        { code: true },
      ),
      page(
        "broadcast",
        "同一Bank一定冲突吗",
        "所有Lane读取word0，与读取0/32/64有什么不同？",
        "前者是同一字的重复读，可按相应广播机制服务；后者是不同字。图按每Bank的不同字数量统计，不把相同地址重复读误算32路冲突。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>bank</mi><mo>=</mo><mi>wordAddress</mi><mo>mod</mo><mn>32</mn></mrow>",
    ),
    derive: [
      "列读Stride32：地址0,32,64,…，bank全0。",
      "Padding后Stride33：地址0,33,66,…，bank依次0,1,2,…。",
      "广播：地址全0，虽然bank也全0，但每Bank仅1个不同字；与32个不同字的冲突不同。",
    ],
    code: "banks=lambda stride:[(i*stride)%32 for i in range(32)]\nassert len(set(banks(32)))==1\nassert len(set(banks(33)))==32",
    quiz: [
      "32个Lane读取同一个Shared字，能否直接按32个不同字冲突计算？",
      [
        "能，bank相同就一样",
        "不能，要区分广播与同Bank不同地址",
        "需要改成全局内存才有广播",
      ],
      1,
      "Bank编号还不够，必须看请求的字身份与相应硬件访问规则。",
    ],
    limit:
      "32Bank、单个标量32-bit读取的基础模型；向量化、多事务、写入和特殊布局需单独核对，不预测真实周期。",
  }),
  define({
    id: "occupancy-resources",
    module: "microarch",
    unit: "gpu-execution",
    title: "寄存器、Shared 与驻留上限",
    goal: "用各类资源上限的最小值核算CTA驻留，区分Occupancy、就绪和实际吞吐。",
    why: "增加Warp可隐藏等待，但每CTA资源消耗也可能限制驻留；高Occupancy不保证目标流水线繁忙。",
    prereqs: [
      ["warp-issue", "驻留Warp与Eligible/Issued不是同一个集合。"],
      [
        "target-codegen",
        "代码生成决定实际分配和溢出，寄存器需求再限制每SM可驻留的CTA数量。",
      ],
    ],
    source: "cuda",
    section:
      "Occupancy、Hardware Multithreading和资源限制；容量数字全部为虚构教学设备。",
    terms:
      "resident CTA|当前占有SM资源的Block;occupancy|活跃Warp数量相对设备相应上限的比例;register pressure|同时需要寄存器的值需求;allocation granularity|硬件按特定粒度保留资源的规则",
    chapters: [
      page(
        "limits",
        "谁先耗尽资源",
        "线程、寄存器、Shared三种上限怎样共同限制CTA数？",
        "虚构设备允许8个Warp、4个CTA、16384个寄存器字和32KiB Shared；每CTA64线程、2Warp。逐项算可容纳CTA数，再取最小值。",
        { formula: true },
      ),
      page(
        "counter",
        "资源变化怎样跨过阈值",
        "每线程寄存器32变96时，驻留为何可能从4CTA变2CTA？",
        "按此无额外分配粒度模型，单CTA寄存器从2048变6144，寄存器容量上限从8CTA变2CTA。其它资源即使充足也不能绕过这个约束。",
        { code: true },
      ),
      page(
        "eligible",
        "驻留多为什么还可能慢",
        "8个Warp都在等同一类数据时，高Occupancy说明什么？",
        "它说明有相应资源驻留，不保证就绪、发射或关键路径缩短。仍需观察依赖、内存和实际时间，而非只优化一个比例。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>CTA</mi><mi>resident</mi></msub><mo>≤</mo><mi>min</mi><mo>(</mo><msub><mi>L</mi><mi>warp</mi></msub><mo>,</mo><msub><mi>L</mi><mi>reg</mi></msub><mo>,</mo><msub><mi>L</mi><mi>smem</mi></msub><mo>,</mo><msub><mi>L</mi><mi>CTA</mi></msub><mo>)</mo></mrow>",
    ),
    derive: [
      "每CTA64线程、32寄存器/线程，需2048寄存器字；16384/2048=8CTA。",
      "Warp限制8/2=4CTA、Shared若每CTA8KiB则4CTA、CTA硬上限4，最终4。",
      "每线程96寄存器时需6144字，floor(16384/6144)=2，最终2CTA即4Warp。",
    ],
    code: "def resident(regs_per_thread,smem_kib):\n return min(4,8//2,16384//(64*regs_per_thread),32//smem_kib)\nassert resident(32,8)==4 and resident(96,8)==2",
    quiz: [
      "Occupancy达到100%，是否保证所有周期都有可发射Warp？",
      ["保证", "不保证，驻留Warp也可能全部等待", "只要CTA多就没有依赖"],
      1,
      "驻留是容量状态，Eligible/Issued是随依赖和资源变化的执行状态。",
    ],
    limit:
      "所有容量为虚构教学设备，忽略真实分配粒度与其它限制；不应用这些数值推断B200或其它具体GPU上限。",
  }),
  define({
    id: "measurement-stability",
    module: "microarch",
    unit: "gpu-validation",
    title: "预热、时钟、功耗与测量稳定性",
    goal: "保留运行序列和设备状态，识别冷启动、分布变化与不公平比较。",
    why: "单次更快或平均数相同不能说明优化可靠；设备环境和统计边界会影响结论。",
    prereqs: [
      [
        "profiling",
        "时钟与冷启动会改变计时结果，比较前要固定完成边界、同步和有效工作。",
      ],
      [
        "deployment-compatibility",
        "同一模型名不足以复现，驱动、目标、量化和编译配置都会改变执行路径。",
      ],
    ],
    source: "https://docs.nvidia.com/deploy/nvidia-smi/",
    section:
      "nvidia-smi的时钟、功耗、温度与性能状态观测；本图曲线是合成计时，不对硬件归因。",
    terms:
      "warmup|让编译、缓存等进入预定状态的预运行;cold start|首次加载、编译等成本尚未摊销的调用;median|排序后中间位置的统计值;tail|较慢请求或运行的分布部分;throttle|设备受相应条件限制运行状态的情形",
    chapters: [
      page(
        "cold",
        "第一条慢在哪里",
        "序列[30,10,10,10,10]ms能否直接当稳定Kernel时长？",
        "先确定首次30包含哪些工作。若包含20ms编译和10ms执行，应分开报告冷启动与预热后运行；不能偷偷删除首次样本后仍称全请求结果。",
      ),
      page(
        "distribution",
        "平均与中位数讲了同一件事吗",
        "新方案[8,8,8,14,14]ms比固定10ms方案一定更好吗？",
        "中位数8更低，均值10.4更高，慢样本也更慢。保留完整序列和目标SLO；五个样本不足以严肃估计生产P99。",
        { formula: true, quiz: true },
      ),
      page(
        "conditions",
        "环境记录怎样进入结论",
        "时钟、温度和并发变化以后，能否只归因于代码？",
        "记录设备状态并控制对照条件，必要时交错或重复运行以识别漂移。曲线只提供证据，不自动证明温度、功耗或某个Stall就是根因。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>mean</mi><mo>=</mo><mfrac><mrow><mo>∑</mo><msub><mi>t</mi><mi>i</mi></msub></mrow><mi>n</mi></mfrac></mrow>",
    ),
    derive: [
      "A=[10,10,10,10,10]ms，均值和中位数均10。",
      "B=[8,8,8,14,14]ms，均值52/5=10.4，中位数8。",
      "选择取决于稳定性、尾部与服务目标；不能只挑对自己有利的统计量。",
    ],
    code: "from statistics import mean,median\na=[10]*5; b=[8,8,8,14,14]\nassert mean(b)>mean(a) and median(b)<median(a)\n# 所有时间为合成例，不是GPU测量",
    quiz: [
      "中位数下降但慢样本增多，应怎样报告？",
      ["只报中位数", "同时报告分布、条件和目标约束", "样本少就可以称P99改善"],
      1,
      "不同统计量回答不同问题；少量样本不能支撑稳定长尾结论。",
    ],
    limit:
      "合成时间序列，不提供真实温度/时钟曲线或设置建议；没有硬件实验，不把相关性升级为因果。",
  }),
];
