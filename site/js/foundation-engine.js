import { define, page, math } from "./foundation-lessons.js";
export const engineCourses = [
  define({
    id: "request-lifecycle",
    module: "engine",
    unit: "request-engine",
    title: "请求生命周期、结果与取消",
    goal: "沿请求ID贯穿输入准备、排队、执行、输出和资源释放，分清控制消息与模型张量。",
    why: "Scheduler不是整个引擎；错误、取消和结束后的资源处理同样属于完整执行语义。",
    prereqs: [
      [
        "generation-state",
        "引擎组织的是持续生成过程，而非一次无状态函数调用。",
      ],
    ],
    source: "engine",
    section:
      "vLLM Architecture Overview：API server、Engine Core、Scheduler、Executor、Worker与Model Runner。",
    terms:
      "request ID|贯穿输入、状态与返回值的请求身份;control plane|决定安排、取消和完成的控制信息;data plane|Token、激活、KV等实际计算对象;terminal state|完成、取消或失败后不再继续生成的状态",
    chapters: [
      page(
        "identity",
        "同一个请求在各处是什么",
        "排队项、Batch里的行和输出片段怎样对应？",
        "用A/B两条请求贯穿控制时间线和数据切片。Batch可以重排，返回时仍必须按request ID归属，不能以本轮行号永久代替请求身份。",
      ),
      page(
        "cancel",
        "取消与在途工作",
        "GPU已提交时取消请求，是否等于任务立刻消失？",
        "取消先改变控制状态；已提交工作可能仍完成。结果需要按状态丢弃或处理，缓冲区必须等真实使用结束再回收。不能在取消消息到达时立即复用在途内存。",
        { quiz: true },
      ),
      page(
        "finish",
        "完成边界",
        "最终Token返回后，为什么还要处理缓存引用？",
        "输出结果、生成停止和KV释放属于不同对象的收尾。释放本请求引用不等于覆盖仍被其它请求共享的物理块。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>return</mi><mo>(</mo><mi>row</mi><mo>)</mo><mo>→</mo><mi>requestId</mi><mo>(</mo><mi>row</mi><mo>)</mo></mrow>",
    ),
    derive: [
      "本轮打包顺序[B,A]，GPU输出行0属于B、行1属于A。",
      "A取消后，行1即使完成也不能继续作为A的新输出。",
      "A的专有块要等在途使用结束才能回收，共享块还受其它引用保护。",
    ],
    code: 'for row,result in enumerate(batch_results):\n rid=batch_request_ids[row]\n if requests[rid].state not in {"cancelled","failed"}:\n  deliver(rid,result)\n# 教学控制骨架；实际取消与资源回收仍需完成事件',
    quiz: [
      "取消消息已到、GPU仍在读取A的缓冲区，能否立即复用？",
      [
        "可以，逻辑上已取消",
        "不能，必须满足在途使用结束条件",
        "只要换一个request ID就安全",
      ],
      1,
      "控制终止不会自动消除设备端访问；生命周期必须连接真实完成边界。",
    ],
    limit:
      "请求状态教学轨迹；不复现特定vLLM版本的线程、队列、错误恢复和取消实现细节。",
  }),
  define({
    id: "model-loading",
    module: "engine",
    unit: "execution-engine",
    title: "模型装载、权重分片与显存预算",
    goal: "区分Checkpoint分片、并行权重分片、dtype转换与运行时缓存，算清每卡需要承载什么。",
    why: "磁盘文件数量不是GPU并行度；能加载权重也不等于有足够空间服务上下文。",
    prereqs: [
      ["token-embedding", "先知道Embedding与输出头也是权重矩阵。"],
      ["quant-pipeline", "存储位宽、计算格式和Scale元数据不总相同。"],
    ],
    source: "engine",
    section:
      "Model Runner负责模型加载与执行；具体Checkpoint loader和量化路径依后端。",
    terms:
      "checkpoint shard|为了存储和读取而切分的模型文件;parameter shard|按并行策略划分的权重部分;workspace|执行中间操作所需临时空间;KV budget|权重等占用之外可用于持久KV的容量",
    chapters: [
      page(
        "files",
        "文件分片不等于TP",
        "两个文件是否意味着两张卡各放一个就能运行？",
        "图中Checkpoint按行存成两文件，而教学TP按输出列分配。加载器必须按目标张量切分重组；文件边界本身没有定义计算通信。",
      ),
      page(
        "bytes",
        "权重和缓存同时装得下吗",
        "16MiB可用空间，权重8、工作区2、保留1，还能给KV多少？",
        "先用相同单位核算：剩5MiB。改成更大工作区，KV空间相应下降；内存预算是容量账本，不是运行时性能预测。",
        { formula: true, quiz: true },
      ),
      page(
        "dtype",
        "转换在哪一步",
        "磁盘权重较小，为什么加载或执行仍可能需要更多空间？",
        "反量化、Scale、格式重排和临时副本都可能增加峰值。要分别核对磁盘大小、驻留权重、加载峰值和运行峰值。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>M</mi><mi>KV</mi></msub><mo>≤</mo><msub><mi>M</mi><mi>available</mi></msub><mo>−</mo><msub><mi>M</mi><mi>weights</mi></msub><mo>−</mo><msub><mi>M</mi><mi>workspace</mi></msub><mo>−</mo><msub><mi>M</mi><mi>reserve</mi></msub></mrow>",
    ),
    derive: [
      "教学容量16MiB，驻留权重8MiB。",
      "再减工作区2和保留1，得到KV上限5MiB。",
      "若工作区改4，KV只剩3；未计入的临时副本可能进一步增加峰值。",
    ],
    code: "available,weights,workspace,reserve=16,8,2,1 # MiB\nkv=available-weights-workspace-reserve\nassert kv==5",
    quiz: [
      "Checkpoint有4个文件，能否推断模型使用TP=4？",
      ["能", "不能，文件分片与执行分片是不同规则", "必须用4张卡才能读文件"],
      1,
      "需要检查权重张量如何按计算轴分配，而非只数文件。",
    ],
    limit:
      "单位统一的合成容量；未宣称真实模型内存占用或后端加载峰值，权重共享与分片方式需核对实际配置。",
  }),
  define({
    id: "batch-executor",
    module: "engine",
    unit: "execution-engine",
    title: "Executor、Worker 与变长Batch",
    goal: "从调度位置列表构造设备输入，明确进程角色、打包偏移和请求身份。",
    why: "调度输出不是GPU张量本身；执行侧还需组装输入、位置、索引和后端元数据。",
    prereqs: [
      ["vllm-scheduler", "Scheduler先决定本轮哪些位置有资格执行。"],
      ["request-lifecycle", "打包和返回必须保持request ID。"],
    ],
    source: "engine",
    section:
      "Executor/Worker/Model Runner边界与GPU执行；具体变长布局按Attention后端核对。",
    terms:
      "Executor|协调设备Worker执行的组件;Worker|拥有本地设备执行职责的进程或实体;Model Runner|准备并运行模型的执行对象;offsets|每请求在打包数组中的起止边界;ragged batch|各序列长度不同的批次",
    chapters: [
      page(
        "pack",
        "变长输入怎样排在一起",
        "A本轮3位置、B本轮1位置，打包后边界是多少？",
        "输入位置按请求身份依次排成4格，边界[0,3,4]。如果使用填充方案，可能需要2×3=6槽，但具体后端并非都采用同一种表示。",
        { formula: true, code: true },
      ),
      page(
        "workers",
        "多卡各自持有什么",
        "Executor下发任务后，Worker之间还需哪些一致条件？",
        "各卡必须对同一模型分片和同一轮请求达成一致；只有API名字相同不能保证位置、dtype和通信组兼容。图按GPU分区标明权重与同一Batch身份。",
      ),
      page(
        "return",
        "结果按谁还原",
        "打包顺序改变，为什么结果仍要还给原请求？",
        "使用偏移、长度和request ID还原相应位置。把短请求放前面会改变行号，不改变它的语义身份。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>offset</mi><mo>[</mo><mi>i</mi><mo>+</mo><mn>1</mn><mo>]</mo><mo>=</mo><mi>offset</mi><mo>[</mo><mi>i</mi><mo>]</mo><mo>+</mo><msub><mi>n</mi><mi>i</mi></msub></mrow>",
    ),
    derive: [
      "本轮长度[3,1]，从offset0=0开始。",
      "累计边界0→3→4，打包槽总数4。",
      "若交换为[1,3]，边界0→1→4；输出还原映射必须同步改变。",
    ],
    code: "lengths=[3,1]; offsets=[0]\nfor n in lengths: offsets.append(offsets[-1]+n)\nassert offsets==[0,3,4]",
    quiz: [
      "交换A/B打包顺序后，只保持输出行号、不更新映射会怎样？",
      [
        "仍然正确，因为总长度相同",
        "可能把结果还给错误请求",
        "只影响性能不影响结果",
      ],
      1,
      "总元素数不保护身份与位置关系；元数据必须与张量布局一致。",
    ],
    limit:
      "变长Batch概念小例，不冒充具体FlashAttention或vLLM元数据完整格式；多模态、推测及并行通信需附加字段。",
  }),
  define({
    id: "kv-preemption",
    module: "engine",
    unit: "cache-scheduling",
    title: "KV不足、抢占与重计算",
    goal: "追踪暂停请求时保留的Token序列和被回收的KV，解释恢复为什么需要额外工作。",
    why: "KV容量是独立约束；讲预算分配不能替代资源不足时的状态转换。",
    prereqs: [
      [
        "kv-cache",
        "抢占要回收真实KV块；共享块还被其它请求引用时不能直接覆盖。",
      ],
      ["vllm-scheduler", "算力预算尚有余量也可能因KV不足而无法安排。"],
    ],
    source: "engine",
    section:
      "vLLM Scheduler：KV耗尽时的抢占策略随配置/版本变化；本例固定重计算式恢复。",
    terms:
      "preemption|暂停已接纳请求以重新安排资源;recompute|根据保留的Token再次计算失去的KV;victim|按策略选择被抢占的请求;swap|把状态转移到另一存储层的另一类方案，不等于重计算",
    chapters: [
      page(
        "capacity",
        "谁占用了物理块",
        "容量3块，A/B各需要2块，为什么不能同时驻留？",
        "图中槽位保留真实请求身份。A占2块后只余1，B需要2；计算预算未用完也不能凭空安排缺失块。",
      ),
      page(
        "evict",
        "抢占释放了什么",
        "回收B的KV以后，是否也应该删除已生成Token？",
        "本例保留B的输入和已生成Token，释放其可回收KV。共享块只能减引用，不能覆盖其它请求仍在使用的内容。",
        { code: true },
      ),
      page(
        "resume",
        "恢复的成本",
        "B已有6个确定Token，KV被清空后能否当作只差1个位置？",
        "需要重建必要历史KV，之后才能接续Decode。重计算式恢复与Swap恢复的数据路径不同，不能把两者都画成“立即继续”。",
        { quiz: true, formula: true },
      ),
    ],
    formula: math(
      "<mrow><mi>capacity</mi><mo>≥</mo><mo>∑</mo><mi>livePhysicalBlocks</mi></mrow>",
    ),
    derive: [
      "块大小4，6个已计算位置需要ceil(6/4)=2块。",
      "释放这2个独占KV块后，Token序列仍可保留在请求状态。",
      "若选择完整重计算，恢复要重算这6位置，而不是直接把它当已有6位置KV。",
    ],
    code: 'request={"tokens":[1,2,3,4,5,6],"computed":6,"blocks":[0,1]}\nrequest["blocks"]=[]\nrequest["computed"]=0 # 本例固定完全重计算\nassert len(request["tokens"])==6',
    quiz: [
      "B的历史KV全被回收，但Token还在，恢复时能否直接读取旧KV？",
      [
        "可以，Token与KV是同一个对象",
        "不能，须重建或恢复对应状态",
        "不需要再做Attention",
      ],
      1,
      "离散序列不是各层K/V张量；保留Token使重计算成为可能，不会自动保留KV。",
    ],
    limit:
      "固定完全重计算、独占块的主例；实际策略、共享、Swap和部分恢复必须按版本核对，不在此声称生产FCFS全实现。",
  }),
  define({
    id: "async-engine",
    module: "engine",
    unit: "execution-engine",
    title: "异步调度、占位与完成依赖",
    goal: "在CPU/GPU时间线上判断哪些工作能提前做、哪些必须等待真实结果。",
    why: "异步可减少空档，但会引入在途状态；占位Token不能被当作已知模型输出。",
    prereqs: [
      [
        "batch-executor",
        "提前准备只能处理不依赖未知Token的元数据，真实输入仍要绑定完成结果。",
      ],
      ["runtime-graph", "Stream顺序与跨设备完成条件是正确重叠的基础。"],
    ],
    source: "engine",
    section:
      "Architecture Overview：异步调度与执行重叠，具体占位和同步路径随版本变化。",
    terms:
      "in-flight|已提交但尚未确认完成的工作;placeholder|占用位置而未给出真实值的标记;dependency|某任务开始或读取结果前必须满足的条件;overlap|独立工作在时间上交叠",
    chapters: [
      page(
        "overlap",
        "可提前做哪一部分",
        "GPU算第N轮时，CPU可以准备第N+1轮的什么？",
        "可以提前完成与未知Token值无关的部分元数据与安排。图把可提前的控制段和依赖结果的输入段分色；不把完整下一轮都假设为独立。",
      ),
      page(
        "placeholder",
        "占位不是答案",
        "位置已预留，为什么还不能用它完成所有输入构造？",
        "位置存在不代表词ID已知；真正读取输出值、停止判定或其它数据相关工作仍需结果。取消和回退也要清理相应在途记录。",
        { code: true, quiz: true },
      ),
      page(
        "critical",
        "重叠的收益上限",
        "CPU准备2节拍、GPU4节拍，稳态周期能否变成2？",
        "在理想可重叠假设下，周期受较慢的4节拍限制，而不是两者都消失。首次启动和最后排空仍要单独计算。",
        { formula: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>T</mi><mi>steady</mi></msub><mo>≥</mo><mi>max</mi><mo>(</mo><msub><mi>T</mi><mi>CPU</mi></msub><mo>,</mo><msub><mi>T</mi><mi>GPU</mi></msub><mo>)</mo></mrow>",
    ),
    derive: [
      "串行每轮CPU2+GPU4，共6个人工节拍。",
      "理想流水稳态由max(2,4)=4限制。",
      "3轮还包括启动和排空，不能把3×4无条件当总时间；图明确显示边界。",
    ],
    code: "meta=prepare_independent_metadata()\nresult=wait_for_previous_output()\ninputs=bind_real_token_ids(meta,result)\nsubmit(inputs)\n# 职责骨架，不是某框架真实API",
    quiz: [
      "占位已预留下一位置，能否据此断定生成的Token不是EOS？",
      [
        "能，已有位置",
        "不能，仍需真实结果和停止配置",
        "占位会自动转为最高概率Token",
      ],
      1,
      "预留控制位置不会产生模型的真实输出值。",
    ],
    limit:
      "人造时间与依赖图，不复现生产异步调度实现；不同推测、采样与后端路径的依赖可能不同。",
  }),
  define({
    id: "backend-dispatch",
    module: "engine",
    unit: "execution-engine",
    title: "模型能力、Kernel后端与派发条件",
    goal: "用支持条件检查实际可执行路径，区分引擎名、模型实现和算子后端。",
    why: "相同API可选择不同Attention/量化/编译路径；功能和精度不兼容时不能直接比较速度。",
    prereqs: [
      ["frameworks", "框架导论中的比较需要落实到真正运行的后端。"],
      [
        "quant-pipeline",
        "量化码、Scale和累加格式影响后端合法输入，不能仅凭引擎名称选择Kernel。",
      ],
    ],
    source: "engine",
    section:
      "Model Runner与模型执行；支持表是本课自设约束，不对应任何真实产品排名。",
    terms:
      "capability|后端支持的dtype、shape、模式等条件;dispatch|按条件选择实现;fallback|首选实现不适用时选择其它有效路径;support matrix|明确记录组合是否被支持的表",
    chapters: [
      page(
        "matrix",
        "支持条件怎样相交",
        "某后端支持f16但只支持HeadDim=4，能运行f16、HeadDim=6吗？",
        "支持dtype只是一个条件。教学后端A要求f16且d=4，B允许f32或f16但不支持量化；切换输入查看每项条件及最终可用集合。",
      ),
      page(
        "selection",
        "选择与静默回退",
        "配置写了A，为什么实际Trace仍要核对后端？",
        "不支持的组合可能报错或回退，具体行为按引擎配置。日志中的请求配置不等于设备端实际Kernel名。把选择结果与证据一起保存。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>supported</mi><mo>=</mo><mi>dtypeOK</mi><mo>∧</mo><mi>shapeOK</mi><mo>∧</mo><mi>modeOK</mi></mrow>",
    ),
    derive: [
      "A：f16且d=4；B：f16/f32、d任意教学正数、无量化。",
      "输入f16,d=6,无量化：A失败，B可用。",
      "输入量化模式后，不能仅保留“dtype支持”就认定B仍可用。",
    ],
    code: 'def A(dtype,d,quant): return dtype=="f16" and d==4 and not quant\ndef B(dtype,d,quant): return dtype in {"f16","f32"} and not quant\nassert not A("f16",6,False) and B("f16",6,False)',
    quiz: [
      "后端支持f16是否足以证明它支持所有f16模型配置？",
      ["足够", "还要检查Shape、模式及其它条件", "只由引擎品牌决定"],
      1,
      "后端选择是条件交集；不匹配可能改变路径或失败。",
    ],
    limit:
      "支持条件完全为教学自设；真实能力矩阵与回退策略需按版本、目标GPU和模型核对。",
  }),
  define({
    id: "admission-backpressure",
    module: "engine",
    unit: "request-engine",
    title: "接纳控制、背压与资源隔离",
    goal: "由到达、服务和队列上限判断接纳、等待或拒绝，区分吞吐与有效服务。",
    why: "无限排队不会创造计算资源；已知过载时仍盲目接纳会放大延迟与内存占用。",
    prereqs: [
      ["serving-slo", "先按请求到达时间和完成时间理解SLO。"],
      ["model-loading", "接纳还受实际KV与工作区容量限制。"],
    ],
    source: "engine",
    section:
      "引擎请求组织与Benchmark边界；有界队列为原创服务模型，不是某框架默认策略。",
    terms:
      "admission|决定是否接纳新请求;backpressure|把消费不及的状态传回生产侧以限制继续发送;queue limit|允许等待的请求数上限;goodput|满足约束的有效完成量",
    chapters: [
      page(
        "queue",
        "排队为何持续增加",
        "每拍来1个请求、每3拍完成1个，有限队列会怎样？",
        "图按请求身份显示到达、服务和等待。服务能力不变时，队列会积累；把等待请求隐藏不等于解决过载。",
        { formula: true },
      ),
      page(
        "policy",
        "满队列如何处理",
        "队列上限2已满，新请求该去哪？",
        "教学策略明确拒绝新到请求并计数，不静默丢弃；也可设计有期限等待或上游限速，但必须保持协议和可观测性。",
        { code: true, quiz: true },
      ),
      page(
        "fairness",
        "请求之间怎样隔离",
        "一个长请求占尽资源时，为什么要区分公平与峰值？",
        "预算、优先级和隔离可以改变谁在等，但不能使总容量无限增大。评价时保留被拒绝、超时和失败请求，不只统计成功样本。",
      ),
    ],
    formula: math(
      "<mrow><mi>Q</mi><mo>′</mo><mo>=</mo><mi>Q</mi><mo>+</mo><mi>accepted</mi><mo>−</mo><mi>started</mi></mrow>",
    ),
    derive: [
      "每拍到达1，服务3拍一个，长期到达率大于服务率。",
      "等待上限2时，忙碌且队列已有2个等待者，再来请求不能继续入队。",
      "拒绝必须计入负载和成功率；不能用过滤后的响应时间宣称全部请求满足SLO。",
    ],
    code: "if worker_idle: start(request)\nelif len(waiting)<2: waiting.append(request)\nelse: reject_with_explicit_status(request)\n# 有界队列策略示意；未实现网络服务",
    quiz: [
      "只统计已完成成功请求，是否足以证明过载服务满足SLO？",
      ["足够", "不够，还需包含拒绝、超时与失败", "提高队列上限即可证明"],
      1,
      "统计边界会改变结论；无限等待也可能让成功样本看起来很好。",
    ],
    limit:
      "单服务台教学模型；真实连续Batch、分布式路由和多资源约束需结合线上轨迹。",
  }),
];
