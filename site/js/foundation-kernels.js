import { define, page, math } from "./foundation-lessons.js";
export const kernelCourses = [
  define({
    id: "reduction-scan",
    module: "kernel",
    unit: "kernel-primitives",
    title: "Reduction、Scan 与跨线程依赖",
    goal: "对同一数组分别求总和与所有前缀，理解归约树与前缀传播为何不同。",
    why: "Norm、Softmax和采样都依赖集合运算；只会逐元素映射不能解释这些Kernel。",
    prereqs: [["fused-norm", "归一化需要整行统计，先从归约依赖展开。"]],
    source:
      "https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html",
    section: "Fused Softmax的行归约；Scan图为原创结合运算示例。",
    terms:
      "reduction|把一组值按运算合成较少结果;inclusive scan|输出含当前位置的全部前缀结果;associative|可改变括号分组而保持抽象运算结果;identity|不改变合并结果的单位元，如加法的0",
    chapters: [
      page(
        "tree",
        "总和怎样在树上汇合",
        "[1,2,3,4]怎样从4个输入合成1个结果？",
        "第一层得到3和7，第二层得到10。线段承载具体部分和；加法归约的输出只有一个，不是每个位置都有同样的局部结果。",
        { formula: true },
      ),
      page(
        "prefix",
        "每个位置都要一个前缀",
        "为什么总和10不足以恢复全部前缀[1,3,6,10]？",
        "Scan必须保留每个前缀边界。图用逐轮传播展示位置i从合法较早位置取得部分和，不能读取未来位置。",
      ),
      page(
        "boundary",
        "Mask和数值次序",
        "尾部用0填充是否总适用于所有归约？",
        "加法的单位元是0，最大值归约的中性填充通常不同。浮点加法的不同树形还可能改变舍入，必须按正确性标准比较。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>prefix</mi><mi>i</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>0</mn></mrow><mi>i</mi></munderover><msub><mi>x</mi><mi>j</mi></msub></mrow>",
    ),
    derive: [
      "输入[1,2,3,4]，树归约第一层[3,7]，最终10。",
      "Scan第i个结果包含0..i，所以得到[1,3,6,10]。",
      "若最大值输入全负，非法槽填0会错误压过有效负值；需使用合适中性值和Mask。",
    ],
    code: "x=[1,2,3,4]; out=[]; running=0\nfor v in x:\n running+=v; out.append(running)\nassert out==[1,3,6,10] and running==10",
    quiz: [
      "最大值归约输入[-3,-2]，尾部无效槽填0并参与计算，结果会怎样？",
      ["正确得到-2", "错误得到0", "会自动忽略0"],
      1,
      "填充值的语义要与归约运算相匹配；Mask不是一个万能常数。",
    ],
    limit:
      "整数树与前缀示意，不固定任何GPU同步代价；实际Warp/CTA级实现及浮点误差需分别核对。",
  }),
  define({
    id: "gather-scatter",
    module: "kernel",
    unit: "kernel-primitives",
    title: "Gather、Scatter 与重复索引",
    goal: "沿索引追踪元素搬运，区分逆置重排、覆盖写与累加写。",
    why: "MoE、Embedding和不规则算子都要按索引读写；重复目的地会引入冲突和语义选择。",
    prereqs: [
      ["tensor-address", "逻辑索引最终必须落到正确的存储槽。"],
      ["moe-route", "专家分桶与还原依赖稳定的Token索引。"],
    ],
    source:
      "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.scatter_add_.html",
    section: "scatter_add_的索引与累加语义；整数例子用于隔离地址冲突。",
    terms:
      "gather|按索引从源数组取值;scatter|按索引把值写入目的位置;duplicate index|多条记录指向同一位置;atomic update|保证并发更新不丢失的一类同步操作",
    chapters: [
      page(
        "gather",
        "沿索引读哪些槽",
        "源[10,20,30,40]、索引[2,0,2]会得到什么？",
        "读出[30,10,30]，同一源槽可以被读取多次。索引表的顺序决定输出顺序，不要求是排列，也不自动可逆。",
      ),
      page(
        "scatter",
        "重复目的地怎么合并",
        "值[2,5,3]写向[1,0,1]时，覆盖与累加有何不同？",
        "Scatter-add应在槽1累计2+3=5；普通覆盖写的冲突规则必须另外明确。并行实现可能需要原子或先分组归约。",
        { formula: true, code: true },
      ),
      page(
        "inverse",
        "什么时候能还原",
        "为什么带重复索引的Gather不能直接当可逆Permutation？",
        "重复或缺失会改变信息数量。只有满足一一对应的排列并保存逆映射，才能按相应规则恢复原顺序。",
        { quiz: true },
      ),
    ],
    formula: math(
      '<mrow><msub><mi>y</mi><mi>j</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>:</mo><msub><mi>idx</mi><mi>i</mi></msub><mo>=</mo><mi>j</mi></mrow><mspace width="0"/></munderover><msub><mi>x</mi><mi>i</mi></msub></mrow>',
    ),
    derive: [
      "Gather源[10,20,30,40]、idx=[2,0,2]得到[30,10,30]。",
      "Scatter-add目标初值[0,0,0]，值[2,5,3]、idx=[1,0,1]。",
      "目标变[5,5,0]；两个写向1的贡献都必须保留。",
    ],
    code: "out=[0,0,0]\nfor i,v in zip([1,0,1],[2,5,3]): out[i]+=v\nassert out==[5,5,0]",
    quiz: [
      "两个线程都向同一槽累加，若各自先读旧值再普通写回，可能怎样？",
      [
        "一定正确保留两个贡献",
        "发生丢失更新，需要正确同步或归约",
        "只改变输出顺序",
      ],
      1,
      "读改写若不具备所需原子性，后一次写可能覆盖另一条贡献。",
    ],
    limit:
      "整数地址语义；不声称并行浮点累加逐位确定，索引合法性和具体原子支持需按后端核对。",
  }),
  define({
    id: "paged-attention-kernel",
    module: "kernel",
    unit: "attention-kernels",
    title: "Paged Attention 的索引与计算",
    goal: "从请求逻辑位置读出非连续K/V，并与连续表示的Attention输出核对。",
    why: "块分配器解决放在哪里；Attention Kernel还必须按逻辑次序读对值、处理尾部与归一化。",
    prereqs: [
      [
        "kv-cache",
        "Attention必须先按块表读取正确K/V，才能保证后续分数和加权计算正确。",
      ],
      ["attention-tiling", "读取数据后仍需执行正确的分数与在线归一化。"],
    ],
    source: "kv",
    section:
      "Paged Attention设计：block table、缓存布局和Kernel读写；标量Key/Value为自设可核对例。",
    terms:
      "logical position|请求上下文中的位置序号;physical slot|实际存储块内的元素位置;valid length|本请求实际可读位置数;tail mask|屏蔽最后物理块中未使用槽的条件",
    chapters: [
      page(
        "read",
        "分数计算前先读对位置",
        "逻辑4个位置放在P3/P1时，读顺序是什么？",
        "每块2位置，表[3,1]得到P3:0、P3:1、P1:0、P1:1。物理编号大小不决定上下文先后；同一Token位置的K/V必须成对对应。",
        { code: true },
      ),
      page(
        "compute",
        "非连续不改变数学对象",
        "把相同K/V换个物理位置，输出应该怎样？",
        "本例q=1，Key=[1,0,2,3]、Value=[2,4,1,3]，从分页或连续读取后做同一Softmax加权，输出应一致。",
        { formula: true },
      ),
      page(
        "tail",
        "不能读入无效尾槽",
        "实际长度3时，P1第二槽里旧数据会不会影响结果？",
        "只有逻辑位置0..2有效，物理槽中即使残留数值也不能参与。图切换尾长并独立计算直接参考，检查Mask真正作用于分数域。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>physical</mi><mo>=</mo><mi>table</mi><mo>[</mo><mo>⌊</mo><mi>t</mi><mo>/</mo><mi>B</mi><mo>⌋</mo><mo>]</mo><mo>,</mo><mi>slot</mi><mo>=</mo><mi>t</mi><mo>mod</mo><mi>B</mi></mrow>",
    ),
    derive: [
      "B=2、表[3,1]，t=2映射P1:0。",
      "分页读取出的逻辑K/V与连续数组完全相同，q=1时分数就是这些标量Key。",
      "长度3时必须排除t=3，不管其物理槽残留什么数值。",
    ],
    code: "table=[3,1]; B=2\naddress=lambda t:(table[t//B],t%B)\nassert [address(t) for t in range(4)]==[(3,0),(3,1),(1,0),(1,1)]",
    quiz: [
      "长度3，但尾块第2槽残留很大Key，应该怎么处理？",
      [
        "让Softmax决定它重要不重要",
        "按合法长度屏蔽该槽",
        "将所有有效Key也归零",
      ],
      1,
      "残留存储不是本请求的有效上下文，必须在计算语义上排除。",
    ],
    limit:
      "标量头、块大小2的地址/数学模型；真实缓存的层/头/向量化布局、GQA及硬件实现仍需专门核验。",
  }),
  define({
    id: "quantized-matmul",
    module: "kernel",
    unit: "numeric-kernels",
    title: "分组Scale、反量化与矩阵乘",
    goal: "追踪量化码与Scale在点积中的位置，解释为何不能任意把所有Scale移到求和之外。",
    why: "压缩存储与实际数值运算之间有格式边界；每组Scale不同会影响融合实现。",
    prereqs: [
      [
        "quant-pipeline",
        "分组点积仍需还原每组Scale；码值相同而Scale不同会改变实际贡献。",
      ],
      ["gemm-tiling", "点积按K轴累加，Scale分组也必须对齐相应轴。"],
    ],
    source:
      "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-quantized-types.html",
    section:
      "Quantization与dequantization的Scale语义；本例只用整数分组，不代表所有FP4/FP8格式。",
    terms:
      "q|存储的量化整数码;s_g|第g组的还原Scale;dequantization|由量化码与参数恢复计算值;group axis|共享同一Scale的索引分组;accumulator|汇总乘积的中间状态",
    chapters: [
      page(
        "groups",
        "每个码属于哪个Scale",
        "四个权重码分成两组时，还原值怎样逐项得到？",
        "q=[2,−1,3,2]、组Scale=[0.5,0.25]，还原[1,−0.5,0.75,0.5]。颜色跨量化码、Scale和还原权重保持分组身份。",
      ),
      page(
        "dot",
        "Scale何时能提出来",
        "两个组的Scale不同，点积该怎样累加？",
        "先在各自组内计算Σxq，再乘对应Scale，最后合并组贡献。不能先把所有整数乘积混合后随便用一个Scale代替。",
        { formula: true, code: true },
      ),
      page(
        "backend",
        "反量化融合的真实边界",
        "减少一次还原张量写回，是否说明Scale开销消失？",
        "Scale仍要正确读取和应用；后端可能融合转换，也可能有专门格式指令。检查数值、元数据、布局和实际Kernel，再谈性能。",
        { quiz: true },
      ),
    ],
    formula: math(
      '<mrow><mi>y</mi><mo>=</mo><mo>∑</mo><msub><mi>s</mi><mi>g</mi></msub><mo>(</mo><munderover><mo>∑</mo><mrow><mi>k</mi><mo>∈</mo><mi>g</mi></mrow><mspace width="0"/></munderover><msub><mi>x</mi><mi>k</mi></msub><msub><mi>q</mi><mi>k</mi></msub><mo>)</mo></mrow>',
    ),
    derive: [
      "q=[2,−1,3,2]，x=[1,1,1,1]，两组Scale分别0.5/0.25。",
      "组内整数点积为1与5；还原贡献0.5与1.25。",
      "最终1.75；若错误用平均Scale0.375乘总整数和6，得到2.25，语义不等价。",
    ],
    code: "x=[1,1,1,1]; q=[2,-1,3,2]; scales=[.5,.25]\ny=sum(scales[g]*sum(x[k]*q[k] for k in range(g*2,g*2+2)) for g in range(2))\nassert y==1.75",
    quiz: [
      "分组Scale不同，能否把Σxq全部算完再统一乘第一个Scale？",
      ["总是可以", "一般不可以，组贡献需分别缩放", "只要整数码相同就可以"],
      1,
      "只有满足相应Scale共享条件才允许因式提取；分组信息是数值语义的一部分。",
    ],
    limit:
      "对称整数、无zero-point的分组点积；非对称量化、块浮点、累加精度和真实指令支持另行核验。",
  }),
  define({
    id: "sampling-kernel",
    module: "kernel",
    unit: "kernel-primitives",
    title: "采样算子：筛选、前缀和与选择",
    goal: "把批量词表分数处理拆成明确的数据依赖，区分按行归一、候选筛选和随机选取。",
    why: "采样在大词表/小Batch场景可能具有独立开销，但不能用语义不同的Greedy替代来声称等价优化。",
    prereqs: [
      ["sampling-distribution", "先固定Top-p/温度的概率语义。"],
      [
        "reduction-scan",
        "采样的CDF来自前缀和，行概率归一来自归约；两种输出边界不同。",
      ],
    ],
    source: "generation",
    section:
      "Generation策略；并行数据分解为本课原创建模，不对应某个后端算法复杂度承诺。",
    terms:
      "vocabulary axis|同一请求的候选词轴;row normalization|各请求独立归一;selection|按规则选候选或按随机数选区间;RNG state|可影响随机序列的状态",
    chapters: [
      page(
        "rows",
        "不同请求不能混着归一",
        "两条请求的词表行，为什么不能共用同一个总和？",
        "图分开画每行概率及CDF。每条请求的分布总和各为1；跨行求一个分母会把请求混成一个不存在的联合候选集合。",
      ),
      page(
        "cdf",
        "前缀和决定随机区间",
        "四词CDF怎样定位u=0.75？",
        "[0.6,0.85,0.95,1]将[0,1)分成四段。u=0.75属于第二段；边界约定必须一致，u不能取1而越过最后一项。",
        { formula: true, code: true },
      ),
      page(
        "parity",
        "怎样检验采样实现",
        "单次输出不同，是否一定说明两个实现分布不同？",
        "随机抽样本来会变化；区分固定RNG可重现、统计分布一致与逐位确定。改变候选过滤或用argmax会改变目标语义。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>C</mi><mi>i</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>0</mn></mrow><mi>i</mi></munderover><msub><mi>p</mi><mi>j</mi></msub></mrow>",
    ),
    derive: [
      "概率[0.6,0.25,0.1,0.05]的CDF为[0.6,0.85,0.95,1]。",
      "u=0.75满足0.6≤u<0.85，对应词1。",
      "每条请求独立形成CDF；有两条请求也不是把每行概率除以2。",
    ],
    code: "p=[.6,.25,.1,.05]; u=.75; acc=0\nfor token,prob in enumerate(p):\n acc+=prob\n if u<acc: break\nassert token==1",
    quiz: [
      "为了更快，把随机采样换成argmax，能否宣称保持同一输出分布？",
      ["能，最高概率总是正确", "不能，这是不同生成策略", "只要同一词表就等价"],
      1,
      "语义一致是比较Kernel优化的前提；不同随机结果与不同目标分布也要区分。",
    ],
    limit:
      "四词精确概率示例；大词表的并行选择、排序/近似算法及RNG映射必须按实现验证。",
  }),
  define({
    id: "kernel-tuning",
    module: "kernel",
    unit: "kernel-validation",
    title: "配置搜索、正确性与性能归因",
    goal: "从合法配置、边界浪费和实测证据三方面评价Tile选择，避免把更大Tile直接当更快。",
    why: "配置会同时改变任务数、无效槽、资源需求和重用；单个计数不能决定最优点。",
    prereqs: [
      ["triton-tiling", "先理解Program负责的输出Tile。"],
      [
        "profiling",
        "Tile覆盖量只给出工作组织，配置优劣仍需正确性与同条件测量核验。",
      ],
    ],
    source: "triton",
    section:
      "矩阵乘教程：autotune配置、grid和边界Mask；本例只做工作量与覆盖量分析。",
    terms:
      "configuration|BM/BN/BK等执行参数组合;valid work|任务真正需要的输出元素;covered slots|Tile分配覆盖的逻辑槽总数;autotune|在合法候选配置上测量和选择",
    chapters: [
      page(
        "coverage",
        "同一输出被哪些Tile覆盖",
        "M=6、N=4，BM从2变4时任务数和无效槽怎样变化？",
        "BN固定2，BM=2有6个Program、24槽；BM=4有4个Program、32槽，其中8个无效。更少Program并没有消除尾块浪费。",
        { formula: true },
      ),
      page(
        "resources",
        "重用与容量一起变化",
        "更大Tile可能在哪些方面付出代价？",
        "更大的累加器和Shared需求可能限制并发。图只展示逻辑元素数量，不把它等同每线程寄存器；实际资源要查编译报告。",
      ),
      page(
        "experiment",
        "搜索必须保留什么约束",
        "配置快但边界结果错，能否保留为最佳？",
        "每个候选先验证正确性，再使用一致的预热、同步和统计方法测量。输入形状、目标与dtype进入搜索条件，结果不能无条件跨配置复用。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>grid</mi><mo>=</mo><mo>⌈</mo><mi>M</mi><mo>/</mo><mi>BM</mi><mo>⌉</mo><mo>⌈</mo><mi>N</mi><mo>/</mo><mi>BN</mi><mo>⌉</mo></mrow>",
    ),
    derive: [
      "M=6、N=4、BN=2，BM=2时grid=3×2=6，覆盖24槽。",
      "BM=4时grid=2×2=4，覆盖32槽。",
      "有效始终24，尾部浪费8；不能由任务数6→4直接推导1.5倍加速。",
    ],
    code: "from math import ceil\nfor bm in [2,4]:\n grid=ceil(6/bm)*ceil(4/2)\n covered=grid*bm*2\n assert covered>=24",
    quiz: [
      "候选A更快但尾块输出不符合参考，应怎样处理？",
      ["选A，因为速度第一", "排除错误配置，先修正确性", "把尾块从测试集中去掉"],
      1,
      "搜索空间中的候选必须执行同一合法任务；丢掉困难输入会伪造收益。",
    ],
    limit:
      "覆盖量与资源逻辑模型，不产生实测排名；计时方法、缓存、精度、并发和设备状态仍需真实实验。",
  }),
];
