import { define, page, math } from "./foundation-lessons.js";
export const systemCourses = [
  define({
    id: "process-threads",
    module: "systems",
    unit: "os-foundations",
    title: "进程、线程、共享状态与同步",
    goal: "区分地址空间、线程执行状态和共享数据，解释丢失更新为何发生。",
    why: "引擎的前端、调度与Worker常分布在多个执行实体；CPU并发正确性不能由GPU Stream顺序替代。",
    prereqs: [
      [
        "request-lifecycle",
        "请求状态在不同执行实体间流动，需要明确共享与通信边界。",
      ],
    ],
    source: "threads",
    section:
      "POSIX线程共享进程数据与堆，各自具有栈；进程地址空间示意未包含显式共享内存。",
    terms:
      "process|具有独立资源和地址空间的执行容器;thread|同一进程内可独立调度的执行流;shared heap|同进程线程可共同访问的堆数据;race|结果取决于未正确约束的并发交错;mutex|用于互斥保护临界区的同步对象",
    chapters: [
      page(
        "spaces",
        "同一个地址是否同一个对象",
        "进程A和B都打印地址0x1000，是否一定共享数据？",
        "图把虚拟地址放在各自进程边界内；同一数值可映射到不同物理页。相反，同进程线程通常共享堆，却有各自栈和执行位置。",
      ),
      page(
        "states",
        "就绪、阻塞与运行",
        "线程在等待I/O时，增加CPU核心为什么未必让它前进？",
        "阻塞线程仍缺外部完成事件，不是已经就绪但暂未分到CPU。事件完成后转为就绪，之后仍需被调度才运行；图明确区分这三个状态，不把CPU调度与GPU Warp发射混为一谈。",
      ),
      page(
        "race",
        "读改写怎样丢失更新",
        "两个线程都把共享计数加1，为什么可能最终只增加1？",
        "从count=0开始，A/B各读0、各算1、再依次写1，最终1。图逐事件追踪实际内存槽，不把加法源码当原子操作。",
        { code: true },
      ),
      page(
        "lock",
        "同步保护什么边界",
        "只保护最后store为什么仍不够？",
        "要保护相关的读—改—写临界区或使用适当原子操作，保证后者读取到前者更新后的值。同步也有成本，应按实际共享关系选择。",
        { quiz: true, formula: true },
      ),
    ],
    formula: math(
      "<mrow><mi>correct</mi><mo>:</mo><mn>0</mn><mo>→</mo><mn>1</mn><mo>→</mo><mn>2</mn></mrow>",
    ),
    derive: [
      "未保护的交错：A读0，B读0。",
      "A写1，B写1，最终1，丢失一次贡献。",
      "完整临界区串行化后，B读到1并写2；这里只证明该共享计数语义。",
    ],
    code: "# 不安全交错的显式模型\na_read=b_read=0\ncount=a_read+1\ncount=b_read+1\nassert count==1",
    quiz: [
      "只给最后一次写操作加锁，是否足以保护整个count+=1？",
      [
        "总是足够",
        "不够，读取和更新的组合也需要正确保护",
        "同进程线程不会共享count",
      ],
      1,
      "需要保护的是依赖旧值的一整个操作语义；互斥store不能修复已经读到的过时值。",
    ],
    limit:
      "抽象共享计数与地址空间；语言内存模型、GIL、fork与跨进程共享机制各有额外条件，不据此推断真实并发性能。",
  }),
  define({
    id: "host-memory-pages",
    module: "systems",
    unit: "os-foundations",
    title: "虚拟页、Pinned Memory、DMA 与 NUMA",
    goal: "把CPU虚拟页、物理驻留和GPU传输分开，解释主机缓冲为什么也有生命周期。",
    why: "H2D不是把CPU虚拟地址数字交给设备就完成；页驻留、注册、拓扑与同步共同影响数据可达性。",
    prereqs: [
      [
        "process-threads",
        "虚拟页映射属于进程地址空间，相同地址数字不保证映射同一物理页。",
      ],
      [
        "host-runtime",
        "Pinned解决页驻留等传输条件，不会自动终止DMA对缓冲区的在途访问。",
      ],
    ],
    source: "cuda",
    section:
      "Page-locked host memory与异步传输；虚拟页映射/NUMA为系统概念教学图。",
    terms:
      "virtual page|进程视角的固定粒度地址区间;physical page|实际主机内存页;Pinned|为设备访问/传输等用途锁定或注册的主机内存;DMA|设备在相应机制下进行内存传输;NUMA|不同CPU节点访问内存距离不同的系统结构",
    chapters: [
      page(
        "pages",
        "连续虚拟地址怎样映射",
        "虚拟页0/1/2能否对应不连续的物理页？",
        "图用显式页表把连续逻辑区间映射到物理页5/2/7。虚拟连续与物理连续是不同性质；设备访问路径由系统机制决定。",
      ),
      page(
        "pin",
        "Pinned改变了哪个条件",
        "把主机页固定后，为什么仍不能在拷贝中随意改写？",
        "Pinned支持相应传输路径的页驻留条件，但不替你管理数据所有权。CPU修改仍可能与DMA读取冲突，必须等待所需完成事件。",
        { quiz: true },
      ),
      page(
        "numa",
        "相同字节为何路径不同",
        "CPU线程与内存位于不同节点时，多了哪一段路径？",
        "图将本地内存、跨节点链路和GPU连接分开。只比较传输字节会遗漏CPU拓扑；实际收益需固定绑核、内存分配和设备位置测量。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>address</mi><mo>=</mo><mi>physicalPage</mi><mo>×</mo><mi>pageSize</mi><mo>+</mo><mi>offset</mi></mrow>",
    ),
    derive: [
      "教学页大小4个槽，虚拟页1映射物理页2。",
      "虚拟地址6的页号1、偏移2，对应物理槽2×4+2=10。",
      "Pinned后仍是主机页，不自动变为GPU显存；传输中的数据也不自动独占给CPU写。",
    ],
    code: "page_table=[5,2,7]; page_size=4\nvirtual=6\nphysical=page_table[virtual//page_size]*page_size+virtual%page_size\nassert physical==10",
    quiz: [
      "主机缓冲已Pinned且H2D未完成，CPU能否立即覆盖数据？",
      [
        "能，Pinned等于拷贝已经完成",
        "不能由Pinned单独证明安全，仍需完成/所有权条件",
        "Pinned会自动复制所有后续写入",
      ],
      1,
      "页驻留与异步访问完成是不同条件。",
    ],
    limit:
      "4槽页和拓扑均为教学抽象；不描述真实页尺寸、IOMMU、PCIe或NUMA带宽，不把Pinned视作所有平台零拷贝保证。",
  }),
  define({
    id: "cuda-context",
    module: "systems",
    unit: "os-foundations",
    title: "CUDA Context、Runtime 与 Driver",
    goal: "明确设备资源属于哪个Context，区分API封装、进程与设备执行状态。",
    why: "多个CPU线程不意味着各有独立GPU地址空间；跨进程地址值相同也不代表可直接共享分配。",
    prereqs: [
      ["process-threads", "CPU线程共享和进程隔离是理解Context边界的基础。"],
    ],
    source:
      "https://docs.nvidia.com/cuda/cuda-runtime-api/driver-vs-runtime-api.html",
    section:
      "CUDA Runtime与Driver API：primary context、context management和资源生命周期。",
    terms:
      "Context|管理设备执行状态和相关资源的上下文;primary context|Runtime通常使用的每设备主要上下文;Runtime API|简化常见设备操作的接口层;Driver API|提供更显式设备/Context控制的接口层",
    chapters: [
      page(
        "owners",
        "谁拥有分配和Stream",
        "两个CPU线程使用同一设备的Runtime，是否必然有两份Context？",
        "图在进程/设备边界内画共享的主要Context。线程各自发起调用，不意味着每线程复制全部GPU资源；具体当前Context状态还需按API管理。",
      ),
      page(
        "boundary",
        "跨进程不能只传指针数字",
        "进程A给B发送一个GPU地址整数，B为何不能默认直接读？",
        "必须通过受支持的IPC、共享或通信机制建立可访问关系与生命周期。仅有地址数值不建立权限、资源身份或完成条件。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>pointerNumber</mi><mo>≠</mo><mi>resourceIdentityAndAccess</mi></mrow>",
    ),
    derive: [
      "进程A在ContextA中分配资源R，指针数值p。",
      "B拿到数值p，没有因此建立到R的有效映射。",
      "受支持的IPC/通信机制还要处理导出/导入、设备可达性、同步和释放。",
    ],
    code: '# Context边界示意；不调用真实CUDA\nallocation={"owner":"contextA","address":4096}\nmessage={"address":allocation["address"]}\nassert "owner" not in message # 数字不足以表达访问协议',
    quiz: [
      "每个CPU线程是否天然拥有完全独立的一份CUDA Runtime主要Context？",
      ["是", "不是，需区分进程、设备和Context管理", "Context就是线程栈"],
      1,
      "Runtime主要Context及Driver显式Context有各自规则，不能把线程数直接等同Context数。",
    ],
    limit:
      "概念与资源归属图，未覆盖所有多Context、MPS、IPC和默认Stream模式；以具体API和设备条件核对。",
  }),
  define({
    id: "tensor-parallel",
    module: "systems",
    unit: "distributed-execution",
    title: "TP 与 DP：切权重还是切请求",
    goal: "按矩阵轴追踪各卡局部结果，决定需要拼接还是逐坐标归约。",
    why: "“多卡推理”不是一种固定通信模式；切分轴决定数据依赖和权重驻留。",
    prereqs: [
      ["multi-gpu", "先理解Collective的拼接与归约语义。"],
      [
        "gemm-tiling",
        "沿输出轴拆分产生不同坐标，沿归约轴拆分产生同坐标部分和，合并方式不同。",
      ],
    ],
    source: "https://arxiv.org/abs/1909.08053",
    section: "Megatron-LM矩阵并行分解；DP请求分配为推理职责对照。",
    terms:
      "TP|把一次模型计算的张量或权重跨卡划分;DP|复制模型并分配不同请求/数据;column split|沿输出特征轴切权重;row split|沿归约输入轴切权重",
    chapters: [
      page(
        "column",
        "沿输出轴切分",
        "xW的不同输出列分到两卡后，结果如何组合？",
        "各卡产生不同输出坐标，直接拼接得到完整向量。输入可能需要复制，不能因此说计算本身完全独立于后续层。",
      ),
      page(
        "row",
        "沿归约轴切分",
        "每卡只算一部分k，为什么结果不能直接拼接？",
        "两卡贡献属于相同输出坐标，应逐坐标相加。图用具体乘积验证拼接与求和给出不同对象。",
        { formula: true, code: true },
      ),
      page(
        "data",
        "DP在复制什么",
        "请求A/B分给两个完整模型副本时，是否仍需要每层归约激活？",
        "普通独立请求DP不因数据分配本身要求这种逐层合并；每卡仍需完整副本及本地KV。真实混合并行还可在每个副本内部使用TP。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>xW</mi><mo>=</mo><msub><mi>x</mi><mn>0</mn></msub><msub><mi>W</mi><mn>0</mn></msub><mo>+</mo><msub><mi>x</mi><mn>1</mn></msub><msub><mi>W</mi><mn>1</mn></msub></mrow>",
    ),
    derive: [
      "x=[1,2]，W=[[1,2],[3,4]]，完整输出[7,10]。",
      "沿输入轴拆分贡献[1,2]与[6,8]，相加[7,10]。",
      "沿输出列拆分则分别得到[7]与[10]，需拼接而非求和成[17]。",
    ],
    code: "x=[1,2]; W=[[1,2],[3,4]]\npartial0=[x[0]*v for v in W[0]]\npartial1=[x[1]*v for v in W[1]]\ny=[a+b for a,b in zip(partial0,partial1)]\nassert y==[7,10]",
    quiz: [
      "沿K轴切分后，各卡得到同坐标部分和，应该怎样合并？",
      ["直接拼接加长向量", "逐坐标归约求和", "只保留最快卡的结果"],
      1,
      "切分归约轴产生的是同一输出的贡献；输出轴切分才产生不同坐标。",
    ],
    limit:
      "单GEMM的TP/DP对照，未涵盖完整Transformer并行切分、通信融合和训练梯度同步。",
  }),
  define({
    id: "pipeline-parallel",
    module: "systems",
    unit: "distributed-execution",
    title: "PP、Microbatch 与流水空泡",
    goal: "沿Microbatch身份追踪层段执行，解释启动、排空与层间激活传输。",
    why: "模型分到不同设备层段后，单请求仍有依赖；并行收益来自不同Microbatch交叠，而非一个请求同时跳过所有层。",
    prereqs: [
      [
        "tensor-parallel",
        "TP切一次算子的张量，PP切模型层段，二者交接对象和执行依赖不同。",
      ],
      [
        "async-engine",
        "PP可让不同Microbatch重叠，但同一批次仍受层段依赖以及启动排空约束。",
      ],
    ],
    source: "https://arxiv.org/abs/1811.06965",
    section:
      "GPipe：pipeline parallelism与microbatch；本例只有前向、无训练反向。",
    terms:
      "stage|一段连续层的计算职责;microbatch|用于流水交叠的小批次;activation transfer|层段之间传递中间激活;bubble|因依赖或无可执行工作形成的空闲时段",
    chapters: [
      page(
        "wave",
        "同一批次怎样跨层段",
        "两段各1拍，三个Microbatch的完成时刻是什么？",
        "A先过段0再段1；B可在A进入段1时进入段0。用A/B/C颜色保持批次身份，展示总共4拍完成，而不是6拍串行。",
        { formula: true },
      ),
      page(
        "boundary",
        "交接的是哪种状态",
        "PP层间激活转移与PD的KV交接一样吗？",
        "PP传递本轮计算到层边界的激活，PD在请求阶段间交接历史KV和元数据。两种分离移动不同对象、发生在不同边界，不能混为一谈。",
        { quiz: true },
      ),
      page(
        "imbalance",
        "慢段怎样限制节拍",
        "段1变为2拍时，段0为什么仍会等待或积压？",
        "稳态受最慢段约束。更多Microbatch可能摊薄启动空泡，却不能消除固有段不平衡和传输成本。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>T</mi><mo>=</mo><mo>(</mo><mi>m</mi><mo>+</mo><mi>p</mi><mo>−</mo><mn>1</mn><mo>)</mo><mi>t</mi></mrow>",
    ),
    derive: [
      "理想p=2段、m=3批、每段t=1拍。",
      "完成需要m+p−1=4拍，串行需mpt=6拍。",
      "公式假设等长段且忽略传输；段不平衡或网络等待时不能原样套用。",
    ],
    code: "stage_end=[0,0]; trace=[]\nfor b in range(3):\n first=stage_end[0]+1; stage_end[0]=first\n second=max(first,stage_end[1])+1; stage_end[1]=second\n trace.append((b,first,second))\nassert trace[-1][-1]==4",
    quiz: [
      "PP与PD是否只是同一件事的不同名字？",
      [
        "是，都用了多张卡",
        "不是，切分边界和主要交接对象不同",
        "只有GPU品牌不同",
      ],
      1,
      "PP主要按模型层段交接激活；PD按请求计算阶段交接历史KV等状态。",
    ],
    limit: "理想前向流水；不模拟训练1F1B、异步通信、复杂调度和真实设备时延。",
  }),
  define({
    id: "collective-topology",
    module: "systems",
    unit: "distributed-execution",
    title: "Collective、拓扑与通信量",
    goal: "区分通信数学语义、数据分片和实际路由，计算清楚单向发送量的统计边界。",
    why: "同一个AllReduce可有不同实现；字节数公式不能直接替代拓扑和延迟测量。",
    prereqs: [
      [
        "multi-gpu",
        "先明确AllReduce、AllGather与ReduceScatter各产生什么结果。",
      ],
    ],
    source: "nccl",
    section:
      "NCCL Collectives语义；ring通信量为指定理想算法的分析，不宣称库总选ring。",
    terms:
      "rank|通信组参与者编号;ring|参与者依环连接传递分片的一类算法;link|数据经过的物理或逻辑连接;send volume|本课只统计每Rank单向发出字节，不再加接收",
    chapters: [
      page(
        "ring",
        "分片怎样绕环移动",
        "两Rank的ReduceScatter和AllGather分别传什么？",
        "每Rank从完整局部向量出发，先交换一半并归约到各自片，再交换已归约片形成全结果。保留坐标与阶段身份，不把拼接当归约。",
      ),
      page(
        "volume",
        "通信量怎样计算",
        "p个Rank、每Rank输入N Byte，理想ring发送量是多少？",
        "两阶段各(p−1)轮，每轮发送N/p，单Rank单向总量2(p−1)N/p。若把收发相加或统计全网，需要另行注明边界。",
        { formula: true, code: true },
      ),
      page(
        "topology",
        "字节相同还缺什么",
        "相同算法放到不同链路，耗时为何不同？",
        "拓扑、争用、启动和重叠影响实际时间。图对照逻辑环与跨节点链路；不能用GPU数量推断每条连接的带宽。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>V</mi><mi>send</mi></msub><mo>=</mo><mn>2</mn><mfrac><mrow><mi>p</mi><mo>−</mo><mn>1</mn></mrow><mi>p</mi></mfrac><mi>N</mi></mrow>",
    ),
    derive: [
      "p=2，每Rank输入4元素。",
      "每阶段发送2元素，两阶段共发送4元素；不再把收到的4元素也加到“发送”里。",
      "p=4时单Rank发送1.5N；这个量不包含其它协议开销或特定拓扑重传。",
    ],
    code: "def ring_send_bytes(p,N): return 2*(p-1)*N/p\nassert ring_send_bytes(2,16)==16\nassert ring_send_bytes(4,16)==24",
    quiz: [
      "报告单Rank发送量后，又加同等接收量但仍叫发送量，问题是什么？",
      ["没有问题", "统计边界变了，会混淆不同计量", "必须再乘模型层数才合法"],
      1,
      "先明确单向/双向、每Rank/全网及算法阶段，才能比较通信预算。",
    ],
    limit:
      "指定理想ring分析；NCCL可选择其它算法/协议，实际消息、链路、重叠和多节点瓶颈需实测。",
  }),
  define({
    id: "deployment-compatibility",
    module: "systems",
    unit: "deployment",
    title: "部署环境、兼容性与复现清单",
    goal: "按模型格式、编译目标、Runtime、Driver与GPU能力检查可运行条件，并保留可复现配置。",
    why: "容器封装应用环境，不能凭空替换宿主GPU或消除驱动与二进制目标约束。",
    prereqs: [
      ["cuda-context", "先区分Runtime接口与Driver设备管理。"],
      [
        "backend-dispatch",
        "环境可用还需目标架构、dtype和模型后端相容，安装成功不建立全部执行条件。",
      ],
    ],
    source: "compat",
    section:
      "CUDA Compatibility：minor-version与forward compatibility有明确平台和功能条件。",
    terms:
      "container|封装应用及相应用户态依赖的运行环境;driver|宿主侧设备支持软件;target architecture|编译产物要求的设备能力;reproducibility manifest|可重建实验或部署所需版本与配置记录",
    chapters: [
      page(
        "layers",
        "容器包含和不包含什么",
        "换一个镜像是否自动获得任意GPU指令支持？",
        "图把镜像中的应用/库与宿主Driver/GPU放在不同边界。硬件目标不满足时，打包方式不会使不存在的能力出现；兼容机制也有文档条件。",
      ),
      page(
        "matrix",
        "逐条件检查",
        "三项条件中有一项失败，能否仅凭CUDA名称相同就运行？",
        "教学组合检查Driver能力、目标架构和模型格式。明确显示失败的是哪项；真实版本号必须查官方兼容表，不在本课伪造。",
        { quiz: true },
      ),
      page(
        "manifest",
        "把成功条件记录下来",
        "仅写“同一模型、同一GPU”，为什么仍可能无法复现？",
        "还需模型revision、权重/量化、依赖版本、编译参数、并行配置、输入轨迹和测量方式。冷/热缓存、设备时钟与失败样本也属于比较条件。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>runnable</mi><mo>=</mo><mi>driverOK</mi><mo>∧</mo><mi>targetOK</mi><mo>∧</mo><mi>formatOK</mi></mrow>",
    ),
    derive: [
      "教学配置甲三条件均通过，可进入实际加载/正确性验证。",
      "配置乙Driver和格式通过，但target不匹配，仍不可认定可运行。",
      "兼容检查通过也不是性能或任务质量已验证；还需执行与回归。",
    ],
    code: 'manifest={"model_revision":"fixed_commit","dtype":"specified",\n "driver":"record_actual","runtime":"record_actual",\n "target":"record_actual","parallelism":"record_actual",\n "input_trace":"fixed_file","measurement":"specified"}',
    quiz: [
      "容器镜像可以自动让旧GPU支持目标硬件才有的新指令吗？",
      ["可以，镜像包含指令", "不能，硬件与兼容条件仍需满足", "只需增加显存"],
      1,
      "环境封装和硬件能力是不同层次；某些兼容路径也必须符合官方限制。",
    ],
    limit:
      "概念支持矩阵不含真实版本门槛；请以官方兼容表和目标设备验证，不把安装成功当运行正确或性能达标。",
  }),
];
