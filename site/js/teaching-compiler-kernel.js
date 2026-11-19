/** Continuous explanations; presentation is chosen per mechanism, not per template. */
const p = text => ({ type: "p", text });
const note = text => ({ type: "note", text });
const figure = (caption, state) => ({ type: "figure", caption, ...(state ? { state } : {}) });
const table = (caption, columns, rows) => ({ type: "table", caption, columns, rows });
const equation = (label, body, variables, explanation, steps = []) => ({ type: "math", label, html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${body}</math>`, variables, explanation, steps });
const chapter = (title, ...blocks) => ({ title, blocks });
const prerequisite = (term, explain, course) => ({ term, explain, ...(course ? { course } : {}) });
const ref = (label, url) => ({ label, url });
const references = {
  mlir: ref("MLIR：操作、SSA 值与区域", "https://mlir.llvm.org/docs/LangRef/"),
  buffer: ref("MLIR：Bufferization 与读写分析", "https://mlir.llvm.org/docs/Bufferization/"),
  llvm: ref("LLVM：代码生成与寄存器分配", "https://llvm.org/docs/CodeGenerator.html"),
  triton: ref("Triton：矩阵乘分块教程", "https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html"),
  views: ref("PyTorch：Tensor Views", "https://docs.pytorch.org/docs/stable/tensor_view.html"),
  capture: ref("PyTorch：Dynamo 图捕获", "https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamo_overview.html"),
  shapes: ref("PyTorch：动态形状", "https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamic_shapes.html"),
  cuda: ref("CUDA 13.0：编程与执行模型", "https://docs.nvidia.com/cuda/archive/13.0.0/cuda-c-programming-guide/index.html"),
  best: ref("CUDA：性能优化与测量", "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/"),
  flash: ref("FlashAttention 原论文", "https://arxiv.org/abs/2205.14135"),
  paged: ref("vLLM：Paged Attention 的缓存读取", "https://docs.vllm.ai/en/latest/design/paged_attention/"),
  quant: ref("TensorRT：量化类型与缩放", "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-quantized-types.html"),
  profile: ref("TensorRT：动态形状与 Optimization Profile", "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dynamic-shapes.html"),
  ncu: ref("Nsight Compute：性能分析方法", "https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html"),
  sampling: ref("Transformers：生成与采样策略", "https://huggingface.co/docs/transformers/main_classes/text_generation"),
  scatter: ref("PyTorch：scatter_add_ 的索引语义", "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.scatter_add_.html"),
  conv: ref("PyTorch：Conv2d 的数学定义", "https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html"),
};

export const compilerKernelTeaching = {};

Object.assign(compilerKernelTeaching, {
  "sampling-kernel":{
    intro:["语言模型的输出头给出每个候选Token的分数，采样流程把这些分数处理成一个明确的分布，再选出本轮输出。实现可以并行筛选、归约和求前缀，但必须保持每条请求自己的分布与随机选择语义。"],
    prerequisites:[prerequisite("Logits 与概率", "Logits 是实数分数，可以为负且总和不必为1；概率是非负权重并按候选集合归一。两者不是同一数据。", "sampling-distribution"),prerequisite("词表轴与请求轴", "批量分数矩阵的一行对应一条请求，一列对应一个候选Token。不同请求不能共享一个归一化分母。"),prerequisite("RNG", "随机数生成器及其状态，用于产生抽样需要的随机序列。种子、消耗顺序与算法都会影响可复现结果。")],
    chapters:{
      rows:chapter("每条请求独立形成自己的候选分布",
        p("假设两条请求都各有四个候选词。即使它们在同一Kernel里处理，归一化仍应沿各自的词表轴进行，每行概率和各为1。若把两行已经归一的概率再除以共同总和2，每行只剩0.5，就已经改变了目标分布。"),
        equation("按行归一化的稳定写法", "<mrow><msub><mi>p</mi><mrow><mi>r</mi><mi>j</mi></mrow></msub><mo>=</mo><mfrac><msup><mi>e</mi><mrow><msub><mi>z</mi><mrow><mi>r</mi><mi>j</mi></mrow></msub><mo>−</mo><msub><mi>m</mi><mi>r</mi></msub></mrow></msup><mrow><msub><mo>∑</mo><mi>k</mi></msub><msup><mi>e</mi><mrow><msub><mi>z</mi><mrow><mi>r</mi><mi>k</mi></mrow></msub><mo>−</mo><msub><mi>m</mi><mi>r</mi></msub></mrow></msup></mrow></mfrac></mrow>", [["r","请求行索引"],["j,k","该请求的候选Token索引"],["zᵣⱼ","候选分数；此式取温度1"],["mᵣ","该行最大分数，供数值稳定使用"],["pᵣⱼ","该行归一后的概率"]], "减去本行最大值不会改变概率，因为分子分母都乘了相同因子。候选筛选之后，若目标策略要求重新归一，分母也必须按筛选后的集合重算。"),
        p("温度用一个正数缩放分数，改变分布的集中程度；Top-k保留分数最高的k个候选；Top-p按概率从高到低保留累计概率达到阈值的一组候选。它们的顺序和重归一化约定应固定下来，再比较Kernel实现，不能把不同规则产生的输出当成同一任务。")),
      cdf:chapter("用前缀和把概率变成抽样区间",
        p("概率[0.6,0.25,0.1,0.05]可以理解为长度总计1的四段区间。累积和CDF为[0.6,0.85,0.95,1]。从[0,1)取均匀随机数，落入哪段就选择哪个候选；概率越大，对应区间越长。"),
        equation("前缀边界与选择条件", "<mrow><msub><mi>C</mi><mi>i</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>0</mn></mrow><mi>i</mi></munderover><msub><mi>p</mi><mi>j</mi></msub><mo>,</mo><mspace width='0.4em'/><msub><mi>C</mi><mrow><mi>i</mi><mo>−</mo><mn>1</mn></mrow></msub><mo>≤</mo><mi>u</mi><mo>&lt;</mo><msub><mi>C</mi><mi>i</mi></msub></mrow>", [["pⱼ","固定顺序中的候选概率"],["Cᵢ","截至候选i的累计概率，约定C₋₁=0"],["u","[0,1)内的均匀随机数"],["i","被选中的候选位置"]], "u=0.75位于[0.6,0.85)，选择从0编号的候选1。u=0.6也归入第二段；端点约定要前后一致。"),
        table("从同一概率表读出区间",["候选","概率","抽样区间"],[["0","0.60","[0,0.60)"],["1","0.25","[0.60,0.85)"],["2","0.10","[0.85,0.95)"],["3","0.05","[0.95,1)"]])),
      parity:chapter("正确性要区分分布、随机序列与逐位结果",
        p("随机采样两次输出不同并不说明错误，长期目标分布一致也不意味着固定种子下每次都相同。并行算法可能以不同次序消耗随机数，因此需要明确验证的是固定RNG状态下的复现，还是统计分布的一致性。"),
        p("把采样换成总选最大概率的Greedy策略会改变输出分布，不能当成等价加速。对真正等价的实现，应核对按行处理、候选保留、边界、零概率和随机数映射，再在一致策略下测量大词表及不同Batch的性能。"))
    },closing:["采样实现可拆成分布规则、前缀区间和随机选择三层。先固定每层语义，再讨论并行筛选与融合，才能保证更快的实现仍在做同一件事。"],references:[references.sampling,ref("PyTorch：multinomial", "https://docs.pytorch.org/docs/stable/generated/torch.multinomial.html")]
  },
  "kernel-tuning":{
    intro:["Kernel 调优是在多个正确实现之间选择合适配置。块大小、线程组织和流水级数可能同时改变复用、尾部浪费与资源需求，所以不能用单一指标替代选择。这里先把可计算的工作结构列清，再说明哪些结论必须交给真实测量。"],
    prerequisites:[prerequisite("配置", "一组影响执行安排的参数，例如输出块高BM、块宽BN、归约片段BK。参数改变不应改变任务的合法输出。", "triton-tiling"),prerequisite("有效工作与覆盖槽", "有效工作是任务真正要求的输出；覆盖槽包括规则Tile中分配出来但可能越过边界的位置。"),prerequisite("正确性基线", "可用来比较输出的参考实现及误差约定，必须覆盖尾部等容易出错的输入。")],
    chapters:{
      coverage:chapter("实例少了，尾部浪费可能反而增加",
        p("固定输出M=6、N=4，块宽BN=2。块高BM=2时有3×2=6个Program，每个4槽，共24槽，恰好覆盖所有输出。BM=4时有2×2=4个Program，每个8槽，共32槽，其中8槽越过有效输出范围。"),
        table("相同24个输出的两种覆盖",["配置","Program数","覆盖槽","有效槽","无效槽"],[["BM=2，BN=2","6","24","24","0"],["BM=4，BN=2","4","32","24","8"]]),
        p("更少Program可能降低某些组织开销，但不能由6变4直接推出1.5倍加速。第二种配置还须正确屏蔽尾部，实际指令效率和资源变化也要一起考虑。")),
      resources:chapter("块变大时，数据与部分和也变多",
        equation("分块的一项逻辑存储估计", "<mrow><msub><mi>E</mi><mtext>输入</mtext></msub><mo>=</mo><mi>BM</mi><mi>BK</mi><mo>+</mo><mi>BK</mi><mi>BN</mi><mo>,</mo><mspace width='0.4em'/><msub><mi>E</mi><mtext>累加</mtext></msub><mo>=</mo><mi>BM</mi><mi>BN</mi></mrow>", [["BM,BN,BK","输出块两轴与归约片段长度"],["E输入","单段A/B块的逻辑元素总数"],["E累加","输出部分和的逻辑元素数"]], "扩大输出Tile会增加累加状态，扩大BK会增加每段输入。换算字节还要乘各自数据类型大小；实际寄存器、共享内存分配由布局和编译实现决定。"),
        p("流水中若同时保留多段输入，还会进一步增加存储需求。资源不足可能限制驻留数量或导致额外访问，而更大块又可能增加复用。调优需要看这种交换，不能把任意一个参数越大当成越好。")),
      experiment:chapter("搜索结果必须带着条件一起保存",
        p("每个候选先验证合法输入与尾部的正确性，再用相同预热、同步和统计方法计时。搜索空间中出现错误结果时，应排除或修复该候选，不能删掉困难用例来保住速度。"),
        p("结果应绑定张量形状（Shape）、元素数据类型（dtype）、目标设备和相关运行条件。编译时间与搜索时间如果影响任务，也要单独计入。最终选择可以针对常见形状建立配置集合，而不是强求一个参数覆盖所有工作负载。"))
    },closing:["调优的顺序是保持任务一致、解释配置改变了哪些成本、用实测选择合适条件下的实现。覆盖模型帮助提出候选，无法独立产生真实性能排名。"],references:[references.triton,references.best,references.ncu]
  },
  "lowbit-formats":{
    intro:["位宽只规定编码预算，不能单独说明可表示哪些数。低比特浮点用指数与小数部分共同形成非均匀数值网格，外部Scale又会整体缩放网格。理解量化误差，需要同时看格式、数值所在区间和分组缩放。"],
    prerequisites:[prerequisite("浮点表示", "可粗略理解为符号、有效数字和指数三部分：指数改变数量级，小数位决定同一数量级内能分多细。"),prerequisite("舍入与截断", "舍入把输入映射到附近可表示值；当输入超出支持范围时，还需按格式和算子规定处理，不能靠增加小数精度解决。"),prerequisite("外部Scale", "一组编码数共享的额外乘数，使还原值等于格式数值乘Scale。它与浮点数自身的指数不是同一个字段。", "quantized-matmul")],
    chapters:{
      fp8:chapter("在同一数量级比较分辨率",
        p("E4M3与E5M2描述常见FP8格式的指数位数和小数位数。比较局部精度时，可以先固定正规数区间[1,2)：此时有效数字前导1固定，小数位决定区间内的格子间距。特殊值与其它指数范围需按具体格式另查。"),
        equation("[1,2)内的正规数间隔", "<mrow><mi>Δ</mi><mo>=</mo><msup><mn>2</mn><mrow><mo>−</mo><mi>m</mi></mrow></msup></mrow>", [["m","存储的小数位数，不含正规数的隐含前导1"],["Δ","这个固定指数区间内相邻可表示数的间隔"]], "m=3时，间隔为1/8；m=2时，间隔为1/4。比较的是同一区间的分辨率，不能据此直接概括整个格式的动态范围。", ["输入1.12在1/8网格上最近为1.125，误差0.005。","在1/4网格上最近为1.0，误差0.12。"]),
        p("指数位增加通常服务于更广的数量级表示，小数位增加服务于同区间更细分辨率。选择格式还要看输入分布、特殊值规则和硬件支持。")),
      fp4:chapter("E2M1 的间距随数值范围变化",
        p("本课采用E2M1的有限非负值集合[0,0.5,1,1.5,2,3,4,6]，负数由符号对称得到。可以看到小范围内间隔0.5，较大范围内出现1和2的间隔；它不是INT4那种统一整数网格。"),
        table("看相邻值的间距",["部分可表示值","相邻间距","含义"],[["0、0.5、1、1.5、2","0.5","小幅值附近相对密集"],["2、3、4","1","数量级变大，间隔增大"],["4、6","2","较大值的绝对分辨率更粗"]]),
        p("这里展示有限值集合来说明精度，不覆盖所有编码细节和舍入模式。把FP4当成INT4码再乘统一比例，可能得到不同数值集合，不能作为同格式替换。")),
      scale:chapter("Scale 把整套网格一起放大或缩小",
        p("E2M1本身的最大有限正值为6。外部Scale取0.25时，最大还原值是1.5；Scale取0.5时，最大还原值是3。输入2在前者范围外，在后者可以由格式值4精确还原。"),
        equation("格式数值与外部Scale共同还原", "<mrow><mover><mi>x</mi><mo>^</mo></mover><mo>=</mo><mi>s</mi><mi>q</mi></mrow>", [["q","从指定低比特浮点格式解码得到的数值，不是任意整数"],["s","所在组的外部Scale"],["x̂","还原后的近似输入"]], "增大Scale把范围和间隔一起放大，减小Scale把二者一起缩小。范围与分辨率之间存在取舍，不能说Scale增大后所有数都更精确。"),
        p("实际块量化方案还规定组大小、Scale的编码格式及可能的多级缩放。MXFP4与NVFP4等具体方案不能仅因使用4位数据就视为相同接口，应继续核对格式与后端约定。"))
    },closing:["先确定格式提供哪一套数值，再看Scale如何缩放，再将真实输入分布放进这些网格。这样才能解释误差来自局部分辨率不足，还是范围不够。"],references:[ref("FP8 Formats for Deep Learning", "https://arxiv.org/abs/2209.05433"),references.quant,ref("TensorRT：块量化方案", "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-schemes.html")]
  },
  "convolution-lowering":{
    intro:["卷积把每个输出位置对应到输入中的一个局部窗口，再对窗口与权重逐项乘加。窗口怎样移动决定输出坐标，通道怎样累加决定数值，而im2col把这些同样的乘积重新组织成矩阵乘表示。"],
    prerequisites:[prerequisite("输入通道与输出通道", "输入通道是在同一空间位置的不同特征；每个输出通道有自己的一组权重，通常需要汇总相关输入通道。"),prerequisite("卷积核与GPU Kernel", "卷积核指局部权重窗口；GPU Kernel指设备执行程序。二者都叫kernel，但不是同一种对象。"),prerequisite("互相关约定", "深度学习常用Conv按权重当前顺序与输入窗口相乘，不做数学卷积定义中的窗口翻转。本课沿用这一约定。")],
    chapters:{
      window:chapter("一个输出使用一块窗口的对应乘积",
        p("先看单通道、无边界补零（Padding）、窗口步长1的情况。4×4输入按行放入0到15，2×2权重为[1,0;0,1]。输出坐标(1,1)读取输入窗口[5,6;9,10]，对应乘加为5×1+6×0+9×0+10×1=15。"),
        equation("单通道、步长1的窗口乘加", "<mrow><msub><mi>Y</mi><mrow><mi>r</mi><mi>c</mi></mrow></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>u</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>K</mi><mo>−</mo><mn>1</mn></mrow></munderover><munderover><mo>∑</mo><mrow><mi>v</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>K</mi><mo>−</mo><mn>1</mn></mrow></munderover><msub><mi>X</mi><mrow><mi>r</mi><mo>+</mo><mi>u</mi><mo>,</mo><mi>c</mi><mo>+</mo><mi>v</mi></mrow></msub><msub><mi>W</mi><mrow><mi>u</mi><mi>v</mi></mrow></msub></mrow>", [["r,c","输出行列，也是本例窗口起点"],["u,v","窗口内部的行列偏移"],["K","本例方形窗口边长"],["X,W,Y","输入、卷积权重、输出"]], "每个权重与窗口内对应输入相乘，再汇总成一个输出。多输入通道时还要沿输入通道求和；不同输出通道使用各自权重。"),
        figure("输入为4×4，窗口步长1且不补边。高亮窗口[5,6;9,10]产生输出(1,1)=15；权重中的两个0使对应输入不贡献到此输出。", { pick: 4 })),
      stride:chapter("Stride 与 Padding 改变可取的窗口集合",
        p("这里的Stride是相邻输出窗口起点在输入中移动多少格，含义不同于张量存储Stride。输入边长4、窗口边长2时，步长1允许起点0、1、2；步长2只允许起点0、2。输出变少，是计算的窗口集合改变了。"),
        equation("无膨胀、对称Padding时的输出边长", "<mrow><msub><mi>H</mi><mtext>out</mtext></msub><mo>=</mo><mo>⌊</mo><mfrac><mrow><mi>H</mi><mo>+</mo><mn>2</mn><mi>P</mi><mo>−</mo><mi>K</mi></mrow><mi>S</mi></mfrac><mo>⌋</mo><mo>+</mo><mn>1</mn></mrow>", [["H","输入边长"],["K","窗口边长"],["P","每侧Padding宽度，本例为0"],["S","窗口移动步长"],["Hout","该轴输出位置数"],["⌊x⌋","向下取整，留下完整可放置的窗口步数"]], "先算补边后窗口起点可以移动的距离，再按步长计数，最后加上起点0那一个窗口。此式假设膨胀系数为1。", ["H=4,K=2,P=0,S=1，输出边长3。","把S改为2，输出边长2，窗口起点为0与2。"]),
        p("Padding通常按约定在输入边界外提供补充值，让靠边窗口也有定义。膨胀卷积还会拉开权重采样点之间的距离，需要使用对应的有效窗口尺寸，不能继续无条件套用上式。")),
      im2col:chapter("把每个窗口写成矩阵的一行",
        p("把一个窗口中的输入按固定顺序展平成一行，把权重用同一顺序展成一列，行列点积就得到该位置输出。把所有输出位置的窗口逐行放在一起，就把卷积组织成了矩阵乘。这种窗口展开表示常称im2col。"),
        table("多通道情况下的逻辑矩阵形状",["对象","行数","列数"],[["窗口矩阵","输出空间位置数","输入通道数×窗口面积"],["权重矩阵","输入通道数×窗口面积","输出通道数"],["乘积","输出空间位置数","输出通道数"]]),
        p("相邻窗口重叠，同一个输入可能在窗口矩阵的多行出现。展开表示中的重复不说明实际Kernel一定写了多份副本。实现可以把整个im2col矩阵实际写入存储，也可以在取数时隐式生成对应关系；性能分析要继续检查实际搬运与复用。"))
    },closing:["卷积的核心对象是输出坐标对应的输入窗口。窗口位置、通道求和与权重配对先确定，之后才能安全地改变成矩阵乘或其它执行组织。"],references:[references.conv,ref("NVIDIA：卷积性能背景", "https://docs.nvidia.com/deeplearning/performance/dl-performance-convolutional/index.html")]
  }
});

Object.assign(compilerKernelTeaching, {
  "reduction-scan":{
    intro:["并行计算并非每个线程独立算出一个最终结果。归约需要把许多输入汇成一个结果，Scan 则为每个位置保留截至该位置的累计结果。这两种依赖出现在归一化、统计、地址生成与采样中，必须先分清输出要求，再选择并行组织。"],
    prerequisites:[prerequisite("结合运算", "在相应数学语义下，可以改变括号分组而不改变结果的运算。浮点加法受舍入影响，重分组不保证逐位相同。"),prerequisite("同步", "让后续操作等到所需数据已经被产生并可见。不同线程之间不能仅凭源码行序假定写入已完成。")],
    chapters:{
      tree:chapter("归约把多条贡献汇成一个结果",
        p("输入[1,2,3,4]求总和，串行方式逐个累加；树形方式可以先同时计算1+2与3+4，再把部分和3与7合并为10。第二层必须等待第一层两个部分和就绪，这就是图中边的含义。"),
        equation("同一总和的树形分组", "<mrow><mi>s</mi><mo>=</mo><mo>(</mo><msub><mi>x</mi><mn>0</mn></msub><mo>+</mo><msub><mi>x</mi><mn>1</mn></msub><mo>)</mo><mo>+</mo><mo>(</mo><msub><mi>x</mi><mn>2</mn></msub><mo>+</mo><msub><mi>x</mi><mn>3</mn></msub><mo>)</mo></mrow>", [["x₀…x₃","四个输入值"],["s","全部输入的总和，只有一个输出"]], "分组创造了第一层并行机会，但并没有消除后层对前层结果的依赖。更大输入可继续分层；真实实现还需考虑线程范围和数据交换方式。"),
        figure("从叶子沿依赖读到根，区分同时可做的加法与必须等待的合并。")),
      prefix:chapter("Scan 为每个位置保留一个累计结果",
        p("同样输入[1,2,3,4]，Inclusive Scan 要求输出[1,3,6,10]，每个位置包括自己；Exclusive Scan 通常从单位元开始。单位元是参加相应运算却不改变原值的初始值，求和时为0，因此这里得到[0,1,3,6]。二者与只输出10的归约不同。"),
        equation("包含当前位置的前缀和", "<mrow><msub><mi>y</mi><mi>i</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>0</mn></mrow><mi>i</mi></munderover><msub><mi>x</mi><mi>j</mi></msub></mrow>", [["i","当前输出位置"],["j","参与这个前缀的输入索引"],["xⱼ,yᵢ","输入值 / 截至i的累计结果"]], "每个输出对应不同长度的前缀。并行 Scan 可以先计算局部累计，再把前面分组的总贡献传播过来；不能让各块互不知情地从0开始就当全局结果。"),
        p("采样用概率前缀把候选词映射为区间，压缩或分桶可以用前缀确定每组在输出中的起点。应用需要的是每个位置的累计信息，因此仅有总和不够。")),
      boundary:chapter("无效位置要用对应运算的单位元",
        p("尾块可能少于执行块的容量。求和归约可以让无效槽贡献0，因为加0不改变结果；最大值归约则不能一律补0。若所有有效值都为负，补0会错误地让最大值变成0。对实数 max 常用负无穷作为排除值。"),
        table("单位元由运算决定",["运算","不改变合法结果的填充值","示例风险"],[["求和","0","使用任意垃圾值会改变总和"],["最大值","负无穷","对全负输入补0会得到不存在的最大值"],["最小值","正无穷","对全正输入补0会压低结果"]]),
        p("还要检查浮点累加次序、NaN与同步范围。NaN意为‘非数值’，是表示某些运算没有有效数值结果的特殊标记，例如浮点0/0会产生NaN；它参与后续运算的规则也需核对。数学总和相同不代表不同并行树在有限精度下逐位一致，正确性标准应事先说明。"))
    },closing:["归约保留一个汇总结果，Scan保留每个位置的前缀。先固定输出语义，再沿依赖安排分组与同步，尾部处理才有正确的单位元可选。"],references:[references.cuda,ref("PyTorch：cumsum", "https://docs.pytorch.org/docs/stable/generated/torch.cumsum.html"),ref("Triton：融合 Softmax 中的归约", "https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html")]
  },
  "gather-scatter":{
    intro:["按索引搬运数据时，必须区分‘从哪里取’和‘结果交给谁’。MoE提供一个自然例子：Token被分给专家后，数据顺序改变；专家算完，贡献仍须回到原Token。索引保存的正是这种身份联系。", "本课用同一组Token贯穿读取、合并与逆映射，避免把三个无关数组练习误当成一个过程。"],
    prerequisites:[prerequisite("Token 与专家", "Token 在这里是一个输入位置对应的特征向量；专家是处理这份向量的一组前馈参数。一个Token可能被分给多个专家。", "moe-route"),prerequisite("索引", "指明要读或写哪个位置的整数编号。索引数组的顺序是记录顺序，不自动等同原始数据顺序。"),prerequisite("贡献", "一条专家输出在应用对应权重后，对原Token最终结果的那一部分。")],
    chapters:{
      gather:chapter("按专家组织输入，保留原Token身份",
        p("设三个Token为T0、T1、T2。T0交给E0，T1交给E1，T2同时交给E0和E1。按专家分组后，输入记录依次为(E0,T0)、(E0,T2)、(E1,T1)、(E1,T2)，相应读取索引是[0,2,1,2]。T2被读取两次是分配需求，不是重复数据错误。"),
        table("同一条源数据可以被多条记录引用",["专家组","原Token","从源数组读取"],[["E0","T0","源槽0的特征向量"],["E0","T2","源槽2的特征向量"],["E1","T1","源槽1的特征向量"],["E1","T2","源槽2的特征向量"]]),
        p("Gather 的输出位置按索引表排序。若每个Token仅取一个教学标量[10,20,30]来展示索引，读出会是[10,30,20,30]；实际向量的每个分量都要遵循同样身份映射。")),
      scatter:chapter("把专家贡献汇回原Token",
        p("专家输出已经不按原Token顺序排列。沿上表记录，把每条结果写向其原Token位置，就是 Scatter。若T2有两个专家贡献，目标槽2会收到两条记录，必须使用明确的合并语义。MoE中通常还要先应用各自路由权重。"),
        equation("按身份汇总加权专家结果", "<mrow><msub><mi>y</mi><mi>t</mi></msub><mo>=</mo><msub><mo>∑</mo><mrow><mi>r</mi><mo>:</mo><mi>id</mi><mo>(</mo><mi>r</mi><mo>)</mo><mo>=</mo><mi>t</mi></mrow></msub><msub><mi>w</mi><mi>r</mi></msub><msub><mi>z</mi><mi>r</mi></msub></mrow>", [["r","一条派发/专家输出记录"],["id(r)","该记录属于哪个原Token"],["zᵣ,wᵣ","专家输出向量 / 该记录的路由权重"],["yₜ","原Token t的合并结果"]], "只合并身份相同的贡献，并保留每条记录的权重。假设T2的两个标量专家输出为5与3、权重0.4与0.6，最终贡献为2+1.8=3.8。"),
        p("并行写入时，两条线程若都先读0，再各自普通写回2和1.8，可能丢失其中一条贡献。实现需要合适的原子更新、先分组归约或其它正确合并方法；普通覆盖写不能自动代替累加。")),
      inverse:chapter("恢复记录顺序与恢复原始数值是两件事",
        p("只有索引对原位置形成一一对应的排列，并保存相应逆映射时，才能按逆排列恢复顺序。带重复或缺失的Gather不满足这个条件。例如索引[0,2,1,2]多了一条T2记录，不能靠简单逆排列把四条变成三条并自动知道如何合并。"),
        p("专家已经改变了数值，MoE的返回过程也不是把专家运算求逆。它根据身份把计算后的贡献汇总到原Token位置。‘恢复原顺序’描述位置对应，‘恢复原数据’描述数值可逆性，两者不能混用。"))
    },closing:["Gather 按索引取数据，Scatter 按索引放结果；重复读取合理，重复写入则需要明确合并规则。跨分组持续保存身份，才能在内容已变化之后仍把结果交回正确对象。"],references:[references.scatter,ref("PyTorch：gather", "https://docs.pytorch.org/docs/stable/generated/torch.gather.html"),ref("Switch Transformers：稀疏专家路由", "https://arxiv.org/abs/2101.03961")]
  },
  "paged-attention-kernel":{
    intro:["KV缓存可以在物理上分散存放，但Attention仍要针对请求自己的合法上下文计算。分页块表把逻辑位置翻译为物理位置；Kernel依照映射读出正确K/V，再执行相同的分数、归一化与加权计算。"],
    prerequisites:[prerequisite("KV缓存", "保存已处理位置的Key与Value，以便后续生成继续读取这些历史信息。", "kv-cache"),prerequisite("逻辑位置与物理块", "逻辑位置描述请求内的先后顺序，物理块描述缓存实际放在哪里；物理编号大小不表示时间先后。"),prerequisite("Attention加权", "先由Query与Key得到权重，再汇总同一位置的Value。Key和Value的身份必须对应。", "attention-tiling")],
    chapters:{
      read:chapter("把请求位置翻译为缓存地址",
        equation("块表完成两级定位", "<mrow><mi>b</mi><mo>=</mo><mo>⌊</mo><mfrac><mi>t</mi><mi>B</mi></mfrac><mo>⌋</mo><mo>,</mo><mspace width='0.4em'/><mi>p</mi><mo>=</mo><mi>table</mi><mo>[</mo><mi>b</mi><mo>]</mo><mo>,</mo><mspace width='0.4em'/><mi>u</mi><mo>=</mo><mi>t</mi><mspace width='0.2em'/><mi>mod</mi><mspace width='0.2em'/><mi>B</mi></mrow>", [["t","请求内从0开始的逻辑位置"],["B","每个缓存块可容纳的位置数"],["b","逻辑块编号"],["table[b] / p","该逻辑块对应的物理块编号"],["u","物理块内部的槽偏移"]], "先求逻辑位置属于哪个块，再查块表找物理块，最后用余数找到块内槽。真实缓存地址还包含层、头、特征等维度。", ["B=2、块表[3,1]时，逻辑位置0、1在物理块P3的槽0、1。","逻辑位置2、3在P1的槽0、1；P1编号更小，但仍对应后面的上下文。"]),
        figure("块大小为2、块表为[3,1]、有效长度为4。按逻辑顺序先读P3两个槽，再读P1两个槽；每对Key与Value始终属于同一逻辑位置。", { case: 0 })),
      compute:chapter("非连续存储不改变加权对象",
        p("本课用一个标量Query q=1，逻辑Key=[1,0,2,3]、Value=[2,4,1,3]。分页读取若正确，还原的就是这两组同序列数据。物理上先查P3还是P1，不能擅自改变Key与Value的配对。"),
        equation("同一逻辑序列上的直接参考", "<mrow><mi>o</mi><mo>=</mo><mfrac><mrow><munderover><mo>∑</mo><mrow><mi>t</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>L</mi><mo>−</mo><mn>1</mn></mrow></munderover><msup><mi>e</mi><mrow><mi>q</mi><msub><mi>k</mi><mi>t</mi></msub></mrow></msup><msub><mi>v</mi><mi>t</mi></msub></mrow><mrow><munderover><mo>∑</mo><mrow><mi>t</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>L</mi><mo>−</mo><mn>1</mn></mrow></munderover><msup><mi>e</mi><mrow><mi>q</mi><msub><mi>k</mi><mi>t</mi></msub></mrow></msup></mrow></mfrac></mrow>", [["q","本例标量Query，值为1"],["kₜ,vₜ","逻辑位置t的标量Key与Value"],["L","合法上下文长度"],["o","加权输出"]], "分子是指数权重乘Value后的和，分母归一化这些权重。L=4时，直接参考约为2.471149，分页实现应在相同数值条件下得到对应结果。"),
        p("因此可以把问题拆开核对：地址层是否读对对象，数学层是否正确归一和汇总。地址有误时，后面的Softmax即使算术正确，也是在处理错误上下文。")),
      tail:chapter("已分配的槽不一定都是合法上下文",
        p("若请求长度为3，最后物理块仍可能有两个存储槽，但逻辑位置3不属于本次上下文。槽里即使残留很大的Key，也不能让它参与归一化。有效性来自请求长度，而不是槽内恰好有什么数字。"),
        p("屏蔽应使非法位置的概率贡献为0，例如在适当实现中将其分数排除或设为负无穷。仅把Key改为0通常不够，因为指数e⁰仍为1，会改变分母。本例L=3只使用前三对K/V，输出约1.514820。"),
        figure("有效长度为3时，P1的第二个槽仍保存物理内容，但逻辑位置3不属于本次上下文，Attention权重为0；分配容量和有效长度需要同时看。", { case: 0 }))
    },closing:["分页解决存储映射，Mask限定合法位置，Attention定义如何汇总。把这三层分别核对，就能定位‘读错地址’与‘归一化错误’的不同原因。"],references:[references.paged,references.flash]
  },
  "quantized-matmul":{
    intro:["低比特权重文件保存的码值通常不能直接当作原始权重参与计算。量化参数决定码值代表哪个数；分组Scale又让不同位置遵循不同还原比例。因此，分组信息既是存储元数据，也是矩阵乘的数学语义。"],
    prerequisites:[prerequisite("量化码与反量化", "量化码是压缩后的表示，反量化根据码值和参数恢复近似计算值。本课用对称整数模型，没有额外零点偏移。", "quant-pipeline"),prerequisite("Scale", "缩放系数，决定一个码值还原成多大的数。同组位置共享Scale，不同组可以不同。"),prerequisite("点积", "对应元素相乘后求和；量化参数能否移出求和，要看它在求和范围内是否相同。", "gemm-tiling")],
    chapters:{
      groups:chapter("每个码都必须找到自己的Scale",
        p("设存储码为[2,−1,3,2]，前两项属于Scale=0.5的组，后两项属于Scale=0.25的组。还原权重为[1,−0.5,0.75,0.5]。同样码值2在不同组分别代表1和0.5，因此只读取码而丢失分组，得到的就不是原定义的权重。"),
        table("码值与分组共同确定数值",["位置","码q","组Scale","还原值"],[["0","2","0.5","1"],["1","−1","0.5","−0.5"],["2","3","0.25","0.75"],["3","2","0.25","0.5"]]),
        p("组沿哪个轴划分同样重要。按输出通道分组与按归约维分组，会让矩阵乘中Scale的位置不同，不能仅凭都是‘分组量化’就沿用同一融合公式。")),
      dot:chapter("只有共同因子才能移到组内求和之外",
        equation("按组还原后的点积", "<mrow><mi>y</mi><mo>=</mo><msub><mo>∑</mo><mi>g</mi></msub><msub><mi>s</mi><mi>g</mi></msub><mo>(</mo><msub><mo>∑</mo><mrow><mi>k</mi><mo>∈</mo><mi>g</mi></mrow></msub><msub><mi>x</mi><mi>k</mi></msub><msub><mi>q</mi><mi>k</mi></msub><mo>)</mo></mrow>", [["xₖ","输入激活的第k项"],["qₖ","第k项权重量化码"],["g,s_g","一组位置及其共同Scale"],["y","还原权重与输入的点积"]], "先把同一组内的贡献相加，再乘该组的共同Scale，最后合并各组。不同组Scale一般不能用一个统一Scale替代。", ["沿前章分组，输入x=[1,1,1,1]，组内码值乘积和分别为1与5。","乘各组Scale得到0.5与1.25，总和1.75。","若错误使用平均Scale0.375乘总和6，会得到2.25，已经改变运算。"]),
        p("这个代数关系解释融合时必须保留哪些元数据。真实激活还可能有自己的量化参数，非对称格式也可能带零点，届时要从完整还原式重新推导。")),
      backend:chapter("融合反量化仍要正确应用格式语义",
        p("一种实现先把所有权重反量化成高精度数组，再做矩阵乘；另一种实现边读取码值和Scale，边在计算路径中应用还原。后者可能省去完整中间数组，但并没有让Scale从数学中消失。"),
        p("实际后端可能使用专门低精度指令，也可能通过转换和普通计算组合完成。要核对码格式、布局、分组轴、Scale编码、累加精度及目标指令支持。存储位宽降低并不自动说明Kernel更快；额外转换和不匹配的访问也可能产生开销。"))
    },closing:["先写出每个值如何被还原，再把还原式代入点积，最后决定哪些工作可以融合。这样既能解释Scale位置，也能防止把压缩格式误当成一种统一运算。"],references:[references.quant,ref("TensorRT：量化方案", "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-schemes.html")]
  }
});

Object.assign(compilerKernelTeaching, {
  "attention-tiling":{
    intro:["Attention 为每个 Query 汇总它能看到的 Value：先用 Query 与 Key 计算分数，把分数归一成权重，再按权重求和。直接实现可能保存很大的分数矩阵。FlashAttention 通过分块与在线归一化改变中间量的保存和搬运方式，同时保持目标 Attention 计算。", "理解它的核心不需要先记算法名，而要看清：已经处理过的部分如何用少量状态概括，新块到来后又如何与旧部分使用同一个归一化尺度。"],
    prerequisites:[prerequisite("Q、K、V", "Query 表示当前要查找的信息，Key 用于与它匹配打分，Value 是被加权汇总的向量。每个 Key 必须与同一位置的 Value 对应。", "llm-block"),prerequisite("Softmax", "把一组实数分数取指数，再除以指数之和，得到非负且总和为1的权重。减去同一个常数不改变结果。", "sampling-distribution"),prerequisite("Tile", "把较大计算按一部分 Query 或 Key/Value 分组处理。分组改变执行组织，不自动删除 Attention 连接。", "gemm-tiling")],
    chapters:{
      scores:chapter("先把分数、权重和被汇总的值分开",
        equation("从匹配分数到权重，再到输出", "<mtable columnalign='left'><mtr><mtd><mrow><msub><mi>s</mi><mi>j</mi></msub><mo>=</mo><mfrac><mrow><msup><mi>q</mi><mi>T</mi></msup><msub><mi>k</mi><mi>j</mi></msub></mrow><msqrt><mi>d</mi></msqrt></mfrac></mrow></mtd></mtr><mtr><mtd><mrow><msub><mi>p</mi><mi>j</mi></msub><mo>=</mo><mfrac><msup><mi>e</mi><msub><mi>s</mi><mi>j</mi></msub></msup><mrow><msub><mo>∑</mo><mi>r</mi></msub><msup><mi>e</mi><msub><mi>s</mi><mi>r</mi></msub></msup></mrow></mfrac></mrow></mtd></mtr><mtr><mtd><mrow><mi>o</mi><mo>=</mo><msub><mo>∑</mo><mi>j</mi></msub><msub><mi>p</mi><mi>j</mi></msub><msub><mi>v</mi><mi>j</mi></msub></mrow></mtd></mtr></mtable>", [["q,kⱼ","当前 Query 与第j个 Key，长度均为d"],["qᵀkⱼ","两向量的点积，即对应特征相乘后求和"],["d","Query/Key 的特征维数"],["sⱼ,pⱼ","匹配分数 / 归一后的权重"],["vⱼ,o","第j个 Value 向量 / 与Value同长度的输出向量"],["j,r","允许参与 Attention 的位置索引"]], "第一行用点积衡量匹配并除以√d缩放；第二行把分数的指数归一成总和为1的权重；第三行按这些权重汇总Value。Value可以包含负数，权重非负不意味着输出各分量必为正。"),
        p("Mask 规定哪些位置可参与，例如因果注意力排除未来位置。分数、概率和 Value 是三种不同对象，后面分块时仍要保持这种区别。")),
      tiles:chapter("把已处理部分压缩成可继续更新的状态",
        p("一条 Query 对很多 Key 的分数若全部写到GPU主存，再读回做 Softmax 和加权，可能产生大量中间数据搬运。GPU主存是容量较大的设备显存，数据需要经过访问路径送到计算单元。分块方法每次只处理一部分 Key/Value，并保留足够合并后续结果的状态。"),
        equation("处理完若干位置后的三个状态", "<mtable columnalign='left'><mtr><mtd><mrow><mi>m</mi><mo>=</mo><msub><mi>max</mi><mi>j</mi></msub><msub><mi>s</mi><mi>j</mi></msub></mrow></mtd></mtr><mtr><mtd><mrow><mi>l</mi><mo>=</mo><msub><mo>∑</mo><mi>j</mi></msub><msup><mi>e</mi><mrow><msub><mi>s</mi><mi>j</mi></msub><mo>−</mo><mi>m</mi></mrow></msup></mrow></mtd></mtr><mtr><mtd><mrow><mi>a</mi><mo>=</mo><msub><mo>∑</mo><mi>j</mi></msub><msup><mi>e</mi><mrow><msub><mi>s</mi><mi>j</mi></msub><mo>−</mo><mi>m</mi></mrow></msup><msub><mi>v</mi><mi>j</mi></msub><mo>,</mo><mspace width='0.4em'/><mi>o</mi><mo>=</mo><mfrac><mi>a</mi><mi>l</mi></mfrac></mrow></mtd></mtr></mtable>", [["m","已处理位置的最大分数，作为统一指数基准"],["l","已处理部分的归一化分母，标量"],["a","尚未除以分母的 Value 加权和，向量"],["o","当前已处理集合对应的输出"]], "减去最大值使指数更稳定；分子和分母同用这个基准，最后相除得到原 Softmax 加权结果。完整处理结束后才是目标全集的输出。"),
        p("开始时先找到第一个含有效Key的块，直接按上式建立m、l、a；后续块再按下一节的合并关系更新。没有有效Key的块不贡献状态，整行都没有有效Key时则需要另行定义输出，不能做除以0的归一化。"),
        p("关键是保留分母和未归一的分子。只保存每块已经除好的平均值，再等权平均各块输出，会忽略每块在全部注意力权重中所占份额可能不同。")),
      rescale:chapter("新最大值出现时，旧贡献也要换尺度",
        p("若新块里出现更大的分数，新的统一基准 m′ 就会改变。旧的指数是在旧 m 下计算的，不能与新块的指数直接相加；必须把旧分母和旧加权分子一起缩放到新基准。"),
        equation("把新块加入同一归一化账本", "<mtable columnalign='left'><mtr><mtd><mrow><mi>m′</mi><mo>=</mo><mi>max</mi><mo>(</mo><mi>m</mi><mo>,</mo><msub><mi>max</mi><mrow><mi>j</mi><mo>∈</mo><mi>J</mi></mrow></msub><msub><mi>s</mi><mi>j</mi></msub><mo>)</mo><mo>,</mo><mspace width='0.4em'/><mi>α</mi><mo>=</mo><msup><mi>e</mi><mrow><mi>m</mi><mo>−</mo><mi>m′</mi></mrow></msup></mrow></mtd></mtr><mtr><mtd><mrow><mi>l′</mi><mo>=</mo><mi>α</mi><mi>l</mi><mo>+</mo><msub><mo>∑</mo><mrow><mi>j</mi><mo>∈</mo><mi>J</mi></mrow></msub><msup><mi>e</mi><mrow><msub><mi>s</mi><mi>j</mi></msub><mo>−</mo><mi>m′</mi></mrow></msup></mrow></mtd></mtr><mtr><mtd><mrow><mi>a′</mi><mo>=</mo><mi>α</mi><mi>a</mi><mo>+</mo><msub><mo>∑</mo><mrow><mi>j</mi><mo>∈</mo><mi>J</mi></mrow></msub><msup><mi>e</mi><mrow><msub><mi>s</mi><mi>j</mi></msub><mo>−</mo><mi>m′</mi></mrow></msup><msub><mi>v</mi><mi>j</mi></msub></mrow></mtd></mtr></mtable>", [["J","本次新加入的 Key/Value 位置集合"],["m,l,a","旧最大值、分母、未归一加权和"],["m′,l′,a′","合并后的对应状态"],["α","把旧指数贡献换到新基准的系数"],["sⱼ,vⱼ","新块每个位置的分数及 Value"]], "因为 e^(s−m′)=e^(s−m)·e^(m−m′)，旧部分的每项都乘相同的α。分子与分母必须一起换尺度。", ["教学分数依次为0与ln2，Value为2与5。第一项处理后 m=0、l=1、a=2。","第二项使 m′=ln2，α=1/2，于是 l′=1/2+1=1.5，a′=1+5=6。","输出6/1.5=4；直接权重为1/3和2/3，同样得到4。"]),
        p("ln2 是自然对数，满足 e^(ln2)=2。这个两项例子的作用是看清尺度转换，而不是模拟真实头维、指令或运行时间。")),
      io:chapter("保持目标数学，改变中间量的搬运",
        p("FlashAttention 把正在使用的小块与累计状态尽量留在靠近计算单元的寄存器或共享内存里，多次使用已读入的数据。这就是片上复用。它还避免把完整的分数、概率中间矩阵实际写入GPU主存；为逻辑结果分配存储并写入，称为物化。减少这类中间量的保存和读回，是它降低数据搬运的重要来源。"),
        p("它仍要计算目标定义要求的关联；分块本身不等于滑动窗口或稀疏注意力，后两者会改变允许连接的集合。实际数据传输量（IO）的变化取决于块划分、快速存储容量、Query 与 Key/Value 的复用以及实现版本。一个小块示意不能直接换算成生产 Kernel 的加速倍数。")),
      verify:chapter("用直接计算检查分块累计是否正确",
        p("最有针对性的检查，是对同一组分数、Value 和 Mask，分别执行直接 Softmax 加权与分块更新，然后比较输出。应包含新最大值出现在后块、Value有负分量、尾块不满等情况，因为它们能暴露漏缩放和边界错误。"),
        p("数学推导在精确算术下等价，实际浮点实现还要声明数据类型、累加精度和误差范围。没有有效 Key 的行也需由模型或实现约定处理，不能把分母为0的情况当普通归一化。保持边界一致以后，性能比较才有意义。"))
    },closing:["可以把在线 Softmax 记为一份可续算的账本：统一的最大值基准、权重分母、Value加权分子。新块到来时，先统一尺度，再合并贡献。", "这份状态解释了为什么 Attention 可以分块而不保存完整分数矩阵；真实高效实现还包含块调度、数据布局、Mask和硬件流水。"],references:[references.flash,references.triton,ref("Online Normalizer Calculation 原论文", "https://arxiv.org/abs/1805.02867")]
  },
  "fused-norm":{
    intro:["RMSNorm、RoPE 和 SwiGLU 常出现在同一 Transformer 层里，但它们依赖数据的方式不同：归一化要汇总一行，旋转按特征对组合，门控按对应元素相乘。先理解这些数学关系，才能判断哪些中间量值得融合、哪里必须等待。"],
    prerequisites:[prerequisite("特征行", "把一个 Token 的隐藏表示看成长度 H 的向量；同一行的各列是该 Token 的不同特征。", "transformer-layer"),prerequisite("逐元素运算", "输出某一位置只使用对应位置的输入；与需要汇总多位置的归约不同。", "reduction-scan"),prerequisite("残差", "把变换前的输入沿旁路保留，与某个子层输出相加。", "transformer-layer")],
    chapters:{
      row:chapter("RMSNorm 的共同分母来自整行",
        equation("按均方根缩放一行特征", "<mrow><msub><mi>y</mi><mi>i</mi></msub><mo>=</mo><msub><mi>γ</mi><mi>i</mi></msub><mfrac><msub><mi>x</mi><mi>i</mi></msub><msqrt><mrow><mfrac><mn>1</mn><mi>H</mi></mfrac><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>H</mi><mo>−</mo><mn>1</mn></mrow></munderover><msubsup><mi>x</mi><mi>j</mi><mn>2</mn></msubsup><mo>+</mo><mi>ε</mi></mrow></msqrt></mfrac></mrow>", [["xᵢ,yᵢ","第i个输入与输出特征"],["H","一行的特征数"],["γᵢ","可学习的逐特征缩放系数"],["ε","加入均方项后再开方的稳定项"]], "先把整行平方求平均，再开方形成共同分母，最后缩放各特征。RMSNorm 不先减去行均值。", ["对非零行[3,4]，平方均值为(9+16)/2=12.5。","暂取γ=1、ε=0以便手算，输出约[0.8485,1.1314]；生产公式通常保留ε。"]),
        p("共同分母意味着线程即使分别读取不同特征，也要合并整行统计量后才能完成各自输出。这条归约依赖决定了并行实现中的数据交换和同步安排。")),
      zero:chapter("ε 的位置决定零输入如何处理",
        p("若整行都是0，平方均值也是0。没有稳定项时会出现0除以0；加入正的ε后，分母为√ε，输出仍为0。它使公式在这一边界上有定义，也会影响非常小数值附近的结果。"),
        p("ε在平方均值之内、开方之前。把它改成开方后再加，或者换一个数值，都改变了运算。正确性比较要使用相同ε、缩放参数和精度，不能只比较普通幅值输入。")),
      rope:chapter("RoPE 依赖一对特征，而非整行统计量",
        p("Rotary Position Embedding 通过与位置有关的角度旋转 Query/Key 的特征对。先看一个二维向量：旋转后两个新分量都使用原来的两个分量，因此原地实现必须避免先覆盖一个旧值，再把它错当成第二个计算的输入。"),
        equation("一对特征的二维旋转", "<mrow><mo>[</mo><mtable><mtr><mtd><mi>x′</mi></mtd></mtr><mtr><mtd><mi>y′</mi></mtd></mtr></mtable><mo>]</mo><mo>=</mo><mo>[</mo><mtable><mtr><mtd><mi>cos</mi><mi>θ</mi></mtd><mtd><mo>−</mo><mi>sin</mi><mi>θ</mi></mtd></mtr><mtr><mtd><mi>sin</mi><mi>θ</mi></mtd><mtd><mi>cos</mi><mi>θ</mi></mtd></mtr></mtable><mo>]</mo><mo>[</mo><mtable><mtr><mtd><mi>x</mi></mtd></mtr><mtr><mtd><mi>y</mi></mtd></mtr></mtable><mo>]</mo></mrow>", [["x,y","同一特征对的两个旧分量"],["x′,y′","旋转后的两个新分量"],["θ","由位置及频率规则得到的角度"]], "展开后为 x′=x cosθ−y sinθ、y′=x sinθ+y cosθ。以[1,0]与θ=π/2为例，结果为[0,1]。实际模型还需核对特征配对、频率和位置缩放约定。"),
        p("RoPE 与 RMSNorm 都可能处理同一行，但依赖范围不同。前者主要组合指定特征对，后者需要整行统计量，不能仅凭输入形状相同就认为执行组织相同。")),
      gate:chapter("SwiGLU 用一条分支调制另一条分支",
        p("前馈子层通常先从输入生成两条投影分支：一条提供候选特征 u，另一条提供门值 g。SwiGLU 对 g 应用 SiLU 后，与 u 对应元素相乘，再通过后续投影返回模型所需维度。门控是数值调制，不是离散地选开或关。"),
        equation("激活与逐元素门控", "<mrow><mi>SiLU</mi><mo>(</mo><mi>g</mi><mo>)</mo><mo>=</mo><mfrac><mi>g</mi><mrow><mn>1</mn><mo>+</mo><msup><mi>e</mi><mrow><mo>−</mo><mi>g</mi></mrow></msup></mrow></mfrac><mo>,</mo><mspace width='0.5em'/><mi>h</mi><mo>=</mo><mi>SiLU</mi><mo>(</mo><mi>g</mi><mo>)</mo><mo>⊙</mo><mi>u</mi></mrow>", [["g,u","两个同形状的投影输出"],["h","门控后的中间特征"],["⊙","逐元素相乘，各位置分别计算"]], "先计算门分支的非线性结果，再乘候选分支。g=0时该位置输出为0；g为负时SiLU也可能为负，不能简单按0/1开关理解。"),
        p("如果只计算激活与乘法，各位置之间没有整行归约；但产生 u、g 的矩阵投影有自己的归约维。分析融合时要分清是激活融合，还是连投影实现也一起改变。")),
      fusion:chapter("沿数据依赖寻找可省掉的中间物化",
        p("用残差相加后做 RMSNorm 为例：先将[1,2]与[2,2]相加得到[3,4]，再计算平方均值12.5。融合可以在产生残差和时就参与统计，并在统计量就绪后完成缩放，避免仅为交接而把中间和写出再读回。"),
        p("但整行分母仍必须先算完，且[3,4]如果还要交给另一条分支使用，就仍需按接口保留它。减少一次逻辑中间读写，不等于一定减少同样数量的高带宽显存（HBM）访问，更不能直接换算成加速。"),
        figure("这里展示融合且残差和不需要另行输出的情况：z=[3,4]保留在Kernel内部，仍要完成整行平方归约。图取γ=[1,1]、ε=10⁻⁵；读写元素次是逻辑计数，实际显存流量需测量。", { fusion: 1, external: 0 }))
    },closing:["判断融合机会前先识别依赖范围：整行、成对、逐元素或矩阵投影。依赖保留下来，才可以讨论中间结果怎样保存、哪些搬运可以省去。"],references:[ref("RMSNorm 原论文", "https://arxiv.org/abs/1910.07467"),ref("RoFormer / RoPE 原论文", "https://arxiv.org/abs/2104.09864"),ref("GLU Variants Improve Transformer", "https://arxiv.org/abs/2002.05202"),references.triton]
  },
  "profiling":{
    intro:["性能分析的目标是找到决定完成时间的原因，并用一次有针对性的改动验证它。执行时间线（Timeline）帮助定位等待发生在哪里，硬件计数器提供执行现象，受控实验把现象与原因连接起来。只收集更多指标，不能自动得到归因。", "Nsight Systems通常用于查看跨CPU、GPU的执行时间线；Nsight Compute（常简称NCU）提供Kernel级的性能指标。工具分工帮助找到证据，具体指标仍需按设备与工具版本解释。"],
    prerequisites:[prerequisite("测量边界", "计时从哪个事件开始，到哪个完成事件结束。CPU提交返回、Kernel完成、用户收到结果是不同边界。"),prerequisite("吞吐与时延", "吞吐是单位时间完成多少工作，时延是一项任务从指定起点到完成等待多久。提升其中之一不保证另一项同时改善。", "serving-slo"),prerequisite("计数器与比例", "硬件工具统计某种事件或采样状态；比例需要明确分子与分母，不能只看百分号后的数。")],
    chapters:{
      boundary:chapter("先确定要解释哪段完成时间",
        p("GPU 提交常常是异步的，CPU函数返回不代表设备工作结束。如果只用Host时钟测一段提交代码，得到的可能主要是提交开销；若目标是Kernel执行，应使用恰当设备计时与完成关系；若目标是请求延迟，还要包括其它必要阶段和等待。"),
        table("三种常见边界",["观察对象","典型结束条件","容易漏掉什么"],[["Host提交","调用返回","设备尚未完成的计算"],["Kernel执行","对应设备工作完成","队列等待与其它阶段"],["完整请求","目标输出或规定结果可用","若只累计Kernel时间，会漏掉通信、提交及等待"]]),
        p("先画出复制、Kernel、通信和依赖的时间关系，再选择工具。边界不同的两个时间不能直接当成同一项优化前后结果。")),
      counterfactual:chapter("改动前先写出可观察的预测",
        p("假设怀疑重复读取限制了性能，可以先预测：保持计算语义，改善复用后，选定存储层的流量应下降，并且若数据供给确实限制完成时间，耗时应随之改善。若流量下降而时间不变，可能是其它资源或关键路径在限制。"),
        p("这样的预测把实验限制在一个解释上。一次同时改块大小、线程数、精度与算法，即使更快，也很难知道哪项起作用。实际优化可以组合多个改变，但归因阶段需要可区分的对照。")),
      evidence:chapter("百分比变化需要结合绝对量与分母",
        p("构造一组采样计数：原来100个样本中40个处于某种等待，占40%；修改后25个样本中20个等待，占80%。等待计数减少了，比例却升高，因为分母下降得更多。这个例子只说明百分比的逻辑，不把采样数直接当成运行周期。"),
        p("同样，较高的某种 Stall 比例表示采样中常见的一类等待现象，不直接证明它是总时延的主因。需要结合绝对时间、指令与访问行为、并发及受控改动。指标解释还必须使用对应工具和架构的定义。"),
        note("一个指标支持某种解释，不等于排除了其它解释。归因的强度来自预测与实验结果能否互相对应。")),
      experiment:chapter("让性能结论有清楚的条件和可重复证据",
        p("对照实验保持任务、输入、数据类型和正确性要求一致，记录预热、同步、运行次数及统计方法。需要控制或记录缓存、时钟、功耗和并发状态，避免把环境变化当成代码收益。"),
        p("报告时给出有代表性的分布和异常输入，并说明结论的适用条件。没有收益的对照也很重要，它能帮助缩小原因范围。Kernel局部收益最后还需接回完整路径，确认其它阶段是否掩盖或抵消了它。"))
    },closing:["有效的分析是一条可核查的推理：边界明确的现象、针对性的原因假设、预期变化、受控改动和重新测量。工具提供证据，解释仍要靠这些关系成立。"],references:[references.ncu,references.best,ref("Nsight Systems：用户指南", "https://docs.nvidia.com/nsight-systems/UserGuide/index.html")]
  }
});

Object.assign(compilerKernelTeaching, {
  "triton-tiling":{
    intro:["Triton 允许用张量块描述 GPU Kernel。写好一个矩阵乘，先要决定一个 Program 负责哪些输出，再决定怎样沿归约维读入输入并累加；之后才讨论线程布局和资源参数。这个顺序能把数学责任与性能选择分开。"],
    prerequisites:[prerequisite("矩阵乘", "A[M,K]与B[K,N]相乘得到C[M,N]。每个输出需要累加K对输入的乘积。", "gemm-tiling"),prerequisite("Program 与 Tile", "Program 是 Triton 的逻辑执行实例；Tile 是它负责的一块数据或工作。一个 Program 通常会被映射到多个设备线程，不等于一个线程。"),prerequisite("累加器", "保存尚未完成的部分和，随着新的乘积到来不断更新。")],
    chapters:{
      output:chapter("先确定每个实例的输出责任",
        p("设一个 Program 负责 BM 行、BN 列的输出块。Program 的行列编号确定这块在整个 C 中的位置。覆盖整个矩阵需要把所有输出位置分配出去，并保证每个输出按照所选算法由正确的实例完成。"),
        equation("二维输出网格的实例数", "<mrow><msub><mi>N</mi><mtext>program</mtext></msub><mo>=</mo><mo>⌈</mo><mfrac><mi>M</mi><mi>BM</mi></mfrac><mo>⌉</mo><mo>⌈</mo><mfrac><mi>N</mi><mi>BN</mi></mfrac><mo>⌉</mo></mrow>", [["Nprogram","覆盖完整输出所需的逻辑实例数"],["M,N","完整输出矩阵的行数、列数"],["BM,BN","每个实例负责的块高、块宽"],["⌈x⌉","向上取整，使尾部也得到覆盖"]], "沿两条输出轴分别计算需要多少块，再相乘。向上取整带来的多余槽要由边界条件排除。"),
        figure("图取4×4输入，输出块为2行×2列，关注左上输出块。A的前两行与B的前两列共同服务这四个输出；图中结果已累计完整的4个K位置，颜色表示输出块归属。", { bm: 2, kStep: 2, cell: 0 })),
      reduce:chapter("沿 K 分段读取，累加器跨段保留",
        p("选定输出块后，输出仍没有算完，因为它依赖整个 K 维。每次读入 A 的 BM×BK 块和 B 的 BK×BN 块，相乘得到 BM×BN 的部分贡献，加入同一个输出累加器。然后推进 K，直到所有合法位置被处理。"),
        p("BK 决定一次处理多长的归约片段，不改变最终应该覆盖的 K。累加器必须跨片段保留；若每处理一个片段就重置，最后只剩最后一段的贡献。矩阵指令可以加速这段运算，但不能改变求和对象。")),
      layout:chapter("张量块还要落到线程和寄存器",
        p("BM×BN 说明一个逻辑块有多大，却没有说明每个元素由哪个线程持有。编译器需要选择或转换布局，让读取、矩阵运算和后续操作满足各自的执行要求。线程局部值、线程间交换和共享内存承担不同任务。"),
        p("因此仅改变高层 Tile 可能同时改变持有关系、访问模式与资源需求。解释一个性能变化时，应先看实际布局和生成代码，再讨论是否减少了数据移动或增加了并行，不能把逻辑元素数直接当成每线程寄存器数。")),
      edge:chapter("尾块与资源限制一起决定有效工作",
        p("M、N或K无法被块尺寸整除时，最后一块只含部分有效位置。输出轴的 Mask 防止越界写；归约轴的无效输入必须以不会改变结果的方式排除。矩阵乘求和时可以把无效乘积置零，但这不等于允许先做越界读取。"),
        p("扩大 Tile 可能减少实例数并增加复用，也可能增加无效槽、累加器和共享存储需求。一个配置是否好，要同时看有效工作、资源可容纳性及真实执行效率。覆盖槽数仅说明工作如何分配，不能独立给出性能排序。")),
      tune:chapter("Autotune 比较的是合法实现的实测表现",
        p("Autotune 是在一组候选配置中执行测量并选择结果。候选可能改变块尺寸、执行线程组织和流水级数；它们必须实现同一任务、通过正确性检查并满足后端限制。错误的尾块处理不能用更短时间来抵偿。"),
        p("最优配置通常依赖形状、数据类型、目标设备和运行条件。搜索结果应与这些条件一起保存。既要看热态 Kernel 时间，也要按任务需要区分编译、搜索及首次调用开销。一个尺寸上胜出的配置不自动成为所有尺寸的默认答案。"))
    },closing:["Triton 分块可以按四层理解：输出归属、K 维累加、线程布局、资源与实测。前三层把程序说清楚，最后一层才决定具体配置是否值得采用。"],references:[references.triton,ref("Triton 编译阶段", "https://pytorch.org/blog/triton-kernel-compilation-stages/")]
  },
  "runtime-graph":{
    intro:["Kernel 已经编译好以后，仍需把数据和工作按正确次序交给 GPU。CUDA Runtime 管理提交、流、事件与执行资源；CUDA Graph 则把一组操作及依赖组织成可以重复发起的执行结构。它们解决执行组织问题，不替代 Kernel 内部算法。"],
    prerequisites:[prerequisite("异步提交", "CPU 发出工作请求后可以先返回；返回时 GPU 不一定已经完成工作。后续读取或复用数据必须遵守完成依赖。"),prerequisite("Stream", "CUDA 中组织设备操作次序的流。它表达提交和依赖关系，不是为每个流独占一份 GPU。"),prerequisite("Event", "可用于记录某个执行进度并建立等待关系的事件。等待事件可以表达‘这一步完成后才能继续’。")],
    chapters:{
      order:chapter("先表达正确次序，再讨论重叠",
        p("在同一 Stream 中按次序提交输入复制、Kernel、输出复制，可以保留这条依赖链。换到多个 Stream 后，不能仅凭 CPU 代码先后就假定跨流数据已经可用；需要根据 CUDA 语义建立必要的事件或同步关系。默认流等特殊规则也要按实际配置核查。"),
        p("不同 Stream 提供组织重叠的可能，不保证两项工作同时执行。数据依赖、设备资源和运行时限制都可能让它们等待。正确的时间线必须同时标明操作所属的流和依赖，不能只把两行画在一起就称为并行。"),
        figure("图中生产者S0在人工时刻4完成写A，消费者S1等待事件E后才从4开始读取。两个流各有自己的队列，事件建立跨流依赖；这些长度用于说明先后关系。", { scenario: 0 })),
      replay:chapter("Graph Replay 复用一组已建立的执行关系",
        p("普通方式可能由 Host 逐个提交许多短 Kernel。CUDA Graph 把这组操作以及它们之间的依赖构成图，准备好可执行图之后，后续调用可以重放这套结构，减少重复组织和提交工作的开销。"),
        p("Graph Replay 不会自动把多个 Kernel 融合为一个 Kernel，也不会因为捕获成图就减少数学乘加。它主要改变如何启动既定工作。对 Host 提交占比较高的短任务，减少这部分开销可能更有价值；真正效果仍需按完整边界测量。")),
      lifetime:chapter("重放结构不等于重放旧数据",
        p("连续多次运行可以保持图结构和相应地址安排，同时在合法时机提供新输入。执行结果应该反映本次数据。若 GPU 尚在读取，Host 就提前覆盖缓冲区，或者旧地址已经失效，重放仍然可能错误。"),
        p("因此需要管理输入、输出和中间缓冲区的生命周期：何时可以写入、哪个操作正在使用、何时可以回收或复用。形状、地址及图参数如何更新受具体 API 与图兼容条件约束，不能把图理解为任意输入都自动适用的固定快照。")),
      measure:chapter("准备成本与每次收益分开计入",
        equation("简化的重复调用成本", "<mrow><msub><mi>T</mi><mtext>总</mtext></msub><mo>=</mo><msub><mi>T</mi><mtext>准备</mtext></msub><mo>+</mo><mi>N</mi><mo>·</mo><msub><mi>t</mi><mtext>每次</mtext></msub></mrow>", [["T总","所选N次执行及准备的累计时间；各时间使用相同单位"],["T准备","捕获、实例化等一次性准备成本"],["N","有效重放次数"],["t每次","每次重放到所选完成边界的时间"]], "把一次性工作与重复工作分别记录，才知道需要多少次重用才能摊销准备成本。这个串行账本不是实际重叠执行的通用时间模型。"),
        p("如果大部分时间都花在长时间 GPU 计算里，而 Host 提交开销很小，Graph 带来的整体收益可能有限。若每次都需要昂贵的更新或无法复用，也可能抵消收益。比较时应使用相同数据与工作、相同完成边界，并分别报告准备阶段和稳定重放阶段。"))
    },closing:["Stream 和 Event 先保证数据按正确依赖被使用，Graph 再复用一组执行关系。它的收益来自减少合适的重复组织开销，正确性仍依赖输入与资源生命周期。"],references:[references.cuda,ref("CUDA Graphs：结构与重放", "https://developer.nvidia.com/blog/cuda-graphs/")]
  },
  "gemm-tiling":{
    intro:["矩阵乘法看起来只是一个公式，GPU 上的实现却必须反复读入输入、保留部分和并组织大量输出。Tile 分块通过让一份输入服务于多个乘积，提高复用；同时也要求更多片上资源。本课把这两面放在同一条推导中。"],
    prerequisites:[prerequisite("点积", "把两个等长向量对应元素相乘，再把所有乘积相加，得到一个数。"),prerequisite("GEMM", "通用矩阵乘运算的常用名称。本课先用 C=AB，不含额外的缩放或原 C 累加。"),prerequisite("FLOP 与字节", "FLOP 是一次浮点运算的计数单位；字节衡量数据量。常用口径把一次乘法与一次加法合计为2 FLOPs。")],
    chapters:{
      dot:chapter("每个输出来自一行与一列的点积",
        p("令 A 为 M×K，B 为 K×N。输出 C 的第 i 行第 j 列，是 A 第 i 行与 B 第 j 列的点积。K 是被相乘再求和的共同长度，因此两个输入的内维必须匹配。"),
        equation("一个输出元素的完整计算", "<mrow><msub><mi>C</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>K</mi><mo>−</mo><mn>1</mn></mrow></munderover><msub><mi>A</mi><mrow><mi>i</mi><mi>k</mi></mrow></msub><msub><mi>B</mi><mrow><mi>k</mi><mi>j</mi></mrow></msub></mrow>", [["A,B,C","输入矩阵M×K、K×N，与输出矩阵M×N"],["M,N","输出的行数和列数"],["i,j","所求输出的行列索引"],["k","点积中当前配对的输入位置"],["K","每个点积的长度"]], "固定输出位置后，k 遍历整条行和列；每次乘积都加入同一个输出。按乘加2 FLOPs的常见口径，完整矩阵乘工作量近似为2MNK。", ["A的一行为[1,2,3]，B的一列为[4,5,6]。","对应乘积4、10、18相加，输出为32。"])),
      reuse:chapter("一次读入可以服务多个输出",
        p("相邻输出会重复使用输入。例如同一行的多个输出都使用 A 的同一行，只是搭配 B 的不同列；同一列的多个输出又共享 B 的同一列。如果每个输出独自反复从GPU主存读取，复用机会就被浪费。"),
        p("计算 BM×BN 的输出 Tile 时，一次载入 A 的 BM×BK 输入块与 B 的 BK×BN 输入块，可以产生 BM×BN×BK 项乘积。分块让这些输入在局部多次使用，累加器保存输出部分和，再继续下一段 K。"),
        figure("图取4×4矩阵与2×2输出块。A的前两行被左上块的两列输出复用，B的前两列被两行输出复用；结果已累计全部4个K位置，颜色表示输出块的分工。", { bm: 2, kStep: 2, cell: 0 })),
      roofline:chapter("从工作量与数据量得到算术强度",
        equation("用两个上限检查可能的瓶颈", "<mrow><mi>I</mi><mo>=</mo><mfrac><mi>F</mi><mi>Q</mi></mfrac><mo>,</mo><mspace width='0.5em'/><mi>P</mi><mo>≤</mo><mi>min</mi><mo>(</mo><msub><mi>P</mi><mtext>峰值</mtext></msub><mo>,</mo><mi>I</mi><mi>BW</mi><mo>)</mo></mrow>", [["F","浮点运算数，单位 FLOP"],["Q","选定存储层边界上的传输字节数"],["I","算术强度，单位 FLOP/Byte"],["BW","相同存储边界的带宽，Byte/s"],["P","计算吞吐，FLOP/s"],["P峰值","同类运算的计算吞吐上限，FLOP/s"],["b","理想数据量估计中每个元素占的字节数"]], "数据每秒最多送来 BW 字节，每字节支持 I 次运算，因此数据供给给出 I×BW 的吞吐上限；计算单元自身还有另一个上限。Roofline 用较低者形成理想约束。", ["若只估计每个输入读一次、输出写一次，且各元素占 b 字节，则 Q≈b(MK+KN+MN)。","用 F≈2MNK 除以上式得到理想算术强度。实际重复读取、缓存和其它流量会改变 Q。"]),
        p("Q 的统计层级必须明确：程序逻辑上读取的字节、缓存（Cache）与其它层级之间的流量、高带宽显存（HBM）的实际流量不是同一数。Roofline 是识别限制的工具，不能仅凭公式给出真实 Kernel 时间。")),
      pressure:chapter("更强复用需要付出片上存储",
        p("更大的输出 Tile 保存更多累加结果，更深的输入流水保留更多数据。它们可能降低重复搬运，却同时增加寄存器或共享内存需求，从而限制可同时驻留的工作。尾部尺寸还会产生更多无效槽。"),
        p("因此不能从‘Tile 更大’直接推出‘性能更好’。合理选择需要同时看输入复用、输出覆盖、实际资源报告和不同形状的计时。分块是把成本在多个资源之间重新安排，而不是单纯扩大一个参数。"))
    },closing:["矩阵乘优化围绕一个稳定关系：输入被复用来生成更多乘积，而复用需要保存输入和部分和。把这两笔成本与设备上限连接起来，才能理解 Tile 选择。"],references:[references.triton,references.best,ref("NVIDIA：矩阵乘性能背景", "https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html")]
  }
});

Object.assign(compilerKernelTeaching, {
  "gpu-layout": {
    intro:["写出一个矩阵的形状后，还没有决定它的元素分别由哪些线程持有。GPU Layout 处理的正是这种执行归属。理解布局转换，首先要把逻辑位置、实际数值和持有者分开观察。"],
    prerequisites:[prerequisite("线程、Warp 与 Lane", "线程是一条逻辑执行流；Warp是GPU组织执行的一组线程，Lane是组内的线程位置编号。本课用两Lane缩小所有权关系，不表示真实Warp只有两个线程。"),prerequisite("Shape", "Shape 给出逻辑张量各轴长度，不决定某个元素由哪个线程计算或保存。", "tensor-address")],
    chapters:{
      owners:chapter("同一个矩阵可以有不同持有方式",
        p("固定四个元素00、01、10、11，分别表示行列坐标。按行分配时，线程0持有00与01，线程1持有10与11；按列分配时，线程0持有00与10，线程1持有01与11。张量仍为2×2，数值也没有改变，改变的是执行归属。"),
        table("保持元素身份，比较持有者", ["元素","按行持有","按列持有"], [["00","线程0","线程0"],["01","线程0","线程1"],["10","线程1","线程0"],["11","线程1","线程1"]]),
        p("选择布局时要考虑下一步使用这些值的方式：某个操作可能希望同一线程拥有一组元素，另一个操作可能要求它们分布在多个线程上。布局服务于计算与访问，不是仅为了把图画得整齐。")),
      cost:chapter("布局转换的代价来自所有权变化",
        p("上例从按行变为按列，01与10要更换持有者，而00与11可以原地保留。这两次跨持有者传递才是需要解释的执行工作。若只是同一线程内部调整寄存器使用顺序，未必需要线程间通信。"),
        p("实际实现可能使用 Warp 内交换指令，或经共享内存中转并满足同步要求。选哪条路径取决于目标架构和布局形式，不能从 Shape 改变或某个转置符号直接推断。分析时先列元素归属，再查编译产物与实际访问。"),
        figure("图明确取按行→按列转换。元素ID 0、1、2、3依次对应坐标00、01、10、11，ID 1与2更换Lane，另两项保留原持有者。跨持有者元素数为2，具体交换指令和时间仍需看真实实现。", { case: 1 }))
    },closing:["布局不是数值，也不是 Shape 的另一个名字。它描述谁持有哪个值；当后续计算要求改变持有关系时，才需要进一步研究交换路径及成本。"],references:[references.triton,ref("Triton 编译阶段与 GPU Layout", "https://pytorch.org/blog/triton-kernel-compilation-stages/")]
  },
  "target-codegen":{
    intro:["在高层中间表示（IR）中，可以为很多中间结果分别命名；真实设备的快速存储却有限。目标代码生成要选择指令、安排执行，并把这些值映射到物理资源。于是，数学工作量相同的程序也可能产生不同资源需求和性能。"],
    prerequisites:[prerequisite("活跃值", "已经产生且后续还要使用的值。它的保存期限会与其它值重叠。", "buffer-liveness"),prerequisite("寄存器", "设备执行时保存线程工作值的快速存储资源。源码中的一个变量并不固定对应一个物理寄存器。"),prerequisite("Spill", "当某些值无法一直留在寄存器时，把它们保存到后备存储并在需要时重新读取的处理。")],
    chapters:{
      pressure:chapter("同时需要的值竞争有限资源",
        p("把某一时刻需要保留的值列出来，比统计源码变量总数更有意义。若三个值同时活跃，而一个教学资源模型只有两个可用槽，就不能让三个值都一直占用独立槽。编译器可能改变安排、重新计算某些值，或进行 Spill。"),
        p("这个两槽模型只解释竞争关系。真实寄存器分配还受值宽度、指令约束、活跃区间和资源分配粒度影响；不能把三个张量元素直接说成需要三个每线程物理寄存器。"),
        figure("图取峰值3个活跃值、仅2个可用槽的教学条件。柱高表示各时刻需要保留的值数；固定示意策略让c暂存后再读回。它说明有限槽竞争，不是某款GPU的真实寄存器报告。", { case: 1 })),
      artifact:chapter("分清程序表示与设备证据",
        table("每类产物回答不同问题", ["证据","可以判断","不能替代"], [["高层 IR / TTGIR","操作、依赖、布局等信息","最终设备资源报告"],["PTX","虚拟指令和地址操作","最终 SASS 与实际寄存器分配"],["编译资源报告","特定配置的资源使用","完整端到端耗时"],["设备二进制与 SASS","最终指令实现","缓存命中、调度和真实运行状态"],["设备测量","该输入和运行条件下的表现","其它形状和设备上的保证"]]),
        p("比较两个版本时，必须确保这些产物对应同一份源代码、编译选项、目标设备、形状和类型。否则看到的差异可能来自编译目标或配置变化，而不是你正在研究的优化。")),
      tradeoff:chapter("融合减少写回，也可能延长值的生命",
        p("独立 Kernel 的中间结果通常通过全局存储交接，Kernel 内部的临时值可以在各自结束时释放。融合后，为了跨多个计算阶段继续使用值，更多中间量可能同时活跃，因而增加资源压力。"),
        p("需要把两笔变化一起看：省掉多少中间物化，新增多少资源需求和访问。只有真实产物才能说明是否发生 Spill，只有相同条件的计时才能说明总成本是否改善。遇到融合后变慢时，资源压力是一条可验证的解释，而不是先验结论。"))
    },closing:["目标代码把数学和编译决策落实成有限资源上的程序。分析时持续分清逻辑值、虚拟指令、物理资源和运行时间，就不容易把某一层的计数误当成最终性能。"],references:[references.llvm,references.cuda,references.ncu]
  },
  "compile-cache":{
    intro:["编译产生的执行程序往往可以重复使用。缓存负责找到已有产物，派发负责在当前调用条件下选用正确实现。它们共同减少重复编译，却不会消除每次运行的输入绑定、提交和设备执行。"],
    prerequisites:[prerequisite("JIT 与 AOT", "JIT 是运行过程中按需要编译；AOT 是运行前提前准备产物。两者讨论编译发生的时机，不表示哪一种天然更快。"),prerequisite("缓存键", "用于区分编译结果适用条件的标识。它应覆盖影响正确性或产物选择的相关信息。", "graph-capture"),prerequisite("派发", "根据当前输入、设备及可用实现条件，选择本次要调用的执行路径。")],
    chapters:{
      keys:chapter("名字相同不代表可以共用产物",
        p("同一个 Kernel 名字可以对应不同数据类型、目标设备、块尺寸或编译选项。若缓存只按名字匹配，就可能把只适用于一种配置的产物交给另一种输入。缓存键必须体现实际实现所依赖的相关条件。"),
        p("哪些条件进入键、哪些条件在命中后由 Guard 检查，是具体系统的设计。教学表把源码、目标、类型和 Tile 列为示例维度，目的是说明遗漏条件会造成错误复用，不声称所有框架都使用同一种键。"),
        table("两次调用之间需要分清的变化",["变化","应作的判断"],[["只改变输入数值","实现若不依赖这些常量，通常不必因数值变化重编译"],["改变已特化的形状或 Tile","原结果可能不再适用"],["改变设备目标或工具链条件","需检查产物兼容性和缓存失效规则"]])),
      dispatch:chapter("缓存命中之后仍然要完成一次执行",
        p("教学账本设编译100 ms、提交1 ms、设备执行4 ms。首次调用共105 ms；有效命中后省去编译，仍有5 ms。这里假设各阶段串行且没有额外成本，只用于分清冷态和热态，不能当作框架实测数据。"),
        p("拿到产物之后，还要设置本次形状、输入输出地址与必要元数据，按正确依赖提交到设备，并在结果可用后消费它。缓存复用的是执行程序，不是上次调用的输出。测量时应分别报告冷启动与热态，避免把二者混为同一种延迟。"))
    },closing:["缓存回答‘有没有适用的现成程序’，派发回答‘这次调用哪一个’，Runtime 继续负责‘怎样把当前数据交给它并正确完成’。"],references:[references.capture,references.shapes,references.cuda]
  },
  "engine-build":{
    intro:["模型导出文件、目标执行产物和某一次运行的状态是不同对象。ONNX 主要表达模型图与算子约定；TensorRT Engine 是面向目标及配置构建的执行产物；运行时还需要为当前输入建立执行条件。理解这三个层次，才能判断‘导出成功’距离‘实际可用’还有哪些步骤。"],
    prerequisites:[prerequisite("模型图", "记录输入、权重、操作及依赖的表示。图中存在某个算子，并不保证所有目标后端都有它的实现。", "ir-ssa"),prerequisite("动态形状", "输入的某些轴可变化，但仍受明确范围和维度关系约束。", "symbolic-shapes"),prerequisite("执行上下文", "保存一次运行所需形状、地址及执行状态的对象；与可复用执行程序的职责不同。")],
    chapters:{
      export:chapter("交换格式与目标执行程序",
        p("ONNX 让工具之间交换模型结构、张量类型和算子语义。后端读入它后，还要检查支持哪些操作、采用什么精度、选择哪些实现，并满足目标设备限制。因此成功导出模型图，只说明得到了相应表示。"),
        p("Engine 构建把模型及目标约束落实为可执行方案。某个操作若不被支持，可能需要图变换或后端扩展；Plugin 是提供扩展实现的一种机制，并不意味着任意操作都能自动正确、高效地执行。权重等常量也要与每次变化的运行输入分开。")),
      profile:chapter("min、opt、max 分别表达范围与优化参考",
        p("Optimization Profile 为动态输入规定有效范围及一个优化参考形状。设 B 的 min=1、opt=4、max=8，H 固定4。B=6仍在范围内；opt=4不是唯一合法输入。B=16超出范围，[6,8]则违反隐藏维约束。"),
        table("教学 Profile 的逐项检查",["输入形状","B 范围","H 条件","本例结论"],[["[4,4]","满足","满足","有效，且是 opt 形状"],["[6,4]","满足","满足","有效，但不是 opt"],["[16,4]","失败","满足","超出范围"],["[6,8]","满足","失败","仍无效"]]),
        p("范围有效不等于每个尺寸性能相同，也不替代其它输入间关系、内存和后端条件。实际要查看构建时配置与运行时诊断。")),
      runtime:chapter("复用程序，重新绑定本次数据",
        p("固定 X 的形状为[6,4]、W为[4,2]，下一次可以使用新的 X 数值而保持接口不变。Engine 复用计算方案，输出仍应由这次输入算出，不能保留上次结果。运行上下文需要正确设置当前形状、地址与必要状态。"),
        p("提交之后还要遵守完成依赖，保证输入不被过早覆盖、输出不被过早读取。产物能否跨设备或版本使用也要核对相应兼容机制；文件能复制过去，不代表执行语义与运行条件已经满足。"))
    },closing:["导出解决表示交换，构建解决目标实现，执行解决当前数据与完成次序。排查部署问题时先定位失败属于哪一层，避免把它们都归成‘模型文件有问题’。"],references:[references.profile,ref("ONNX：IR 规范", "https://onnx.ai/onnx/repo-docs/IR.html"),ref("TensorRT：工作原理与运行时", "https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/architecture-overview.html")]
  },
  "compiler-evidence":{
    intro:["优化报告需要把‘设想改变了什么’与‘实际观察到什么’接起来。少了一个图节点、少了一次逻辑写回、Kernel 更快、请求更快，是四种不同结论，各自需要相应证据。"],
    prerequisites:[prerequisite("基线", "与修改版本比较的参考实现。输入、结果要求和测量边界必须相同，才能解释差异来自哪里。"),prerequisite("端到端", "从明确的起点到目标结果完成的整段过程，可能包含提交、多个 Kernel、通信与等待。", "profiling"),prerequisite("关键路径", "决定任务最早完成时刻的一串依赖；缩短不在这条路径上的工作，未必缩短总时间。")],
    chapters:{
      ledger:chapter("按结论建立证据对应关系",
        table("不要跨层代替证据",["拟作结论","需要观察"],[["改写保持结果","覆盖边界输入的正确性比较与明确误差规则"],["中间结果不再物化","实际生成 IR、存储操作或实现结构"],["寄存器压力改善","同目标、同配置下资源报告和指令"],["Kernel 更快","同一 Kernel 完成边界的稳定计时"],["请求更快","包含其它阶段与等待的完整路径"]]),
        p("没有采集到的证据应标为未知。例如教学图能够证明地址或公式关系，并不能代替真实编译器是否采用该变换的证据。这样记录，才能知道下一项实验要补哪个环节。")),
      counter:chapter("局部加速受未改变部分限制",
        equation("串行条件下的整体加速上限", "<mrow><mi>S</mi><mo>=</mo><mfrac><mn>1</mn><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>f</mi><mo>)</mo><mo>+</mo><mfrac><mi>f</mi><mi>s</mi></mfrac></mrow></mfrac></mrow>", [["S","完整任务的加速比"],["f","原总时间中被优化部分的占比"],["s","该部分自身的加速比"]], "把原总时间归一为1，未改变部分仍花1−f，优化部分从f变成f/s。这里只适用于相应串行分解，其它开销不变。", ["若热点原占20%，局部变快10倍，总时间变为0.8+0.2/10=0.82。","整体加速约1/0.82=1.22倍，而非10倍。"]),
        p("实际流水和重叠还要结合关键路径。若优化让另一个阶段成为瓶颈，应重新画完成关系，而不是继续用旧占比外推。")),
      reproduce:chapter("让结论可以被另一轮实验复核",
        p("可复现比较需要保留代码版本、编译器和驱动、设备、Shape、dtype、精度规则、预热、同步方式及统计方法。单个最快样本难以代表稳定收益，缓存与设备状态也可能改变结果。"),
        p("实验还应保留无收益或变慢的输入。它们能帮助判断优化依赖哪些条件，例如尾部浪费、资源限制或不同访问路径。一个可用结论应说明在哪些条件下成立、由什么证据支持，以及尚未排除的解释。"))
    },closing:["从正确性到产物、从局部时间到整体完成，证据要逐层对应。这样得到的优化结论才能指导下一次改动，而不只是留下一个加速数字。"],references:[references.llvm,references.ncu,references.best]
  }
});

Object.assign(compilerKernelTeaching, {
  "symbolic-shapes": {
    intro: ["同一个模型可能接收不同批量或序列长度。若每个尺寸都重新编译，冷启动成本会增加；若一个实现兼容很多尺寸，又可能少一些固定尺寸带来的优化机会。符号形状把这个取舍变成可描述、可验证的条件。"],
    prerequisites: [prerequisite("形状与维度", "Shape 是各轴长度组成的列表；例如[B,H]中，B可表示批量大小，H表示每个样本的特征数。", "tensor-address"), prerequisite("Guard 与特化", "Guard 是实现可复用的条件，特化是针对部分已知条件生成实现。条件失败时，旧实现不能直接视为仍然适用。", "graph-capture")],
    chapters: {
      sequence: chapter("沿一串输入看版本怎样产生",
        p("把批量大小依次设为 2、4、2、8。教学上的完全静态策略为每个不同 B 准备一个版本，因此第一次 B=2、B=4、B=8 需要新版本，第二次 B=2 可以复用。这里得到三个版本，是该策略的结果，不是任何框架面对这四次调用都必然编译三次。"),
        p("符号形状会用一个符号代表某个可变化的维度，并给它加约束。若同一实现支持这三个 B，调用之间可以共享实现。编译器仍然要知道哪些轴可以变、哪些关系必须成立；把所有维度换成字母，并不会自动得到合法而高效的程序。")),
      constraint: chapter("动态范围也是程序接口的一部分",
        p("以输入[B,H]为例，本课固定 H=4，并允许 B 在 1 到 8 之间变化。B=6 的输入可满足这组条件，B=16 不满足；[6,8]虽然第一维合法，但第二维违背固定条件。检查必须针对整组约束。"),
        equation("一个明确的动态形状约束", "<mrow><mn>1</mn><mo>≤</mo><mi>B</mi><mo>≤</mo><mn>8</mn><mo>∧</mo><mi>H</mi><mo>=</mo><mn>4</mn></mrow>", [["B","批量维，可在指定整数范围内变化"],["H","本例固定的特征维"],["∧","两个条件必须同时成立"]], "符号 B 不是任意值的通行证；实现只在已证明支持的范围及关系内复用。真实模型还可能要求两个输入的某些轴相等，或要求尺寸满足整除条件。"),
        p("这样才能区分‘输入数值变了’、‘允许动态的维度变了’与‘实现假设被破坏了’。三种变化不能统一归为重新编译，也不能统一归为可以复用。")),
      amortize: chapter("把编译成本放进完整调用账本",
        p("设编译一次花费 100 毫秒，编译后每次运行比原来节省 1 毫秒。在串行、可复用、其它成本相同的教学条件下，运行 100 次才刚好抵消编译成本；超过 100 次才开始产生净收益。单看热态 Kernel 时间，会漏掉这笔前期投入。"),
        equation("编译投入何时被累计收益抵消", "<mrow><mi>N</mi><mo>(</mo><msub><mi>t</mi><mtext>原</mtext></msub><mo>−</mo><msub><mi>t</mi><mtext>新</mtext></msub><mo>)</mo><mo>≥</mo><msub><mi>T</mi><mtext>编译</mtext></msub></mrow>", [["N","同一结果的有效复用次数"],["t原,t新","每次执行时间，单位相同"],["T编译","一次额外编译时间"]], "左边是每次节省乘调用次数，右边是一次性投入。若新实现本身不更快，增加复用次数也不会创造运行收益。", ["教学值：T编译=100 ms，t原−t新=1 ms。","N=100 时持平；N>100 时，这个简化账本才有正收益。"]),
        p("生产服务还要分别评估冷启动、缓存失效和不同形状的访问频率。动态形状支持与最优特化之间通常需要按真实工作负载做选择。"))
    }, closing: ["动态形状的核心是受约束的复用：用符号保留变化空间，用条件保证合法性，用完整调用账本判断是否值得。"], references: [references.shapes,references.capture]
  },
  "graph-rewrite": {
    intro: ["图优化是在保持规定行为的前提下，把一段程序替换成另一种写法。判断的重点是操作语义、输入身份和外部影响。节点变少只是某种改写的结果，不能单独证明改写正确或设备更快。"],
    prerequisites: [prerequisite("定义与使用", "一个结果由哪次操作产生、之后被哪些操作读取，决定它能否共用或删除。", "ir-ssa"),prerequisite("常量", "对当前编译范围已知且不会随这次运行输入变化的值。输入张量中碰巧重复的数字不自动成为编译期常量。")],
    chapters: {
      cse: chapter("相同表达式何时能共用一个结果",
        p("如果程序的两个纯计算都对同一个 x 求 2x，而且类型与其它语义条件相同，那么它们可以共用一个结果 u。这叫公共子表达式消除，常写作 CSE。后续消费者仍然各自读取 u，使用关系不会凭空消失。"),
        table("共用结果需要比较什么", ["观察项","为什么需要"], [["输入是否同一版本的值","同名 x 在更新前后可能不同"],["操作与类型是否一致","不同类型或舍入规则可能得到不同结果"],["操作是否有外部影响","随机状态、写内存等不能仅凭语法相同合并"]]),
        p("例如两次独立加载相同地址，若中间可能有写入，就不能仅凭地址文字相同把第二次加载删除。CSE 是有条件的语义变换，后续还有它是否减少实际工作量的问题。")),
      fold: chapter("把编译时已经知道的计算提前完成",
        p("若表达式是(2+3)x，2 和 3 在编译时已经确定，那么可以提前计算 5，并保留运行时的 5x。这叫常量折叠。它消除的是每次调用都重复做的已知计算，不是把所有操作都提前执行。"),
        p("若系数来自运行时输入、可变状态或当前调用才决定的尺寸，必须先证明它确实固定，才能把它当常量。把一次示例中看到的值硬编码进去，得到的是另一个程序，而不是普遍正确的优化。")),
      float: chapter("实数恒等式与浮点计算有距离",
        p("数学实数的加法满足结合律，但有限精度浮点数每一步都可能舍入。改变括号会改变中间结果，从而改变最终输出。这里用只有三位有效数字的十进制教学算术隔离这个问题，不模拟任何具体 GPU 数据类型。"),
        table("每步舍入到三位有效数字", ["表达式","中间结果","最终结果"], [["(1000+1)−1000","1001 舍入为 1000","0"],["1000+(1−1000)","1−1000=-999，可表示","1"]]),
        p("因此代数重排需要明确数值契约：必须逐位相同，允许一定误差，还是启用了可放宽变换的编译选项。只有把允许的偏差说清楚，才能判断改写是否合法。"))
    }, closing:["先证明两种程序对规定输入与语义等价，再评估减少了哪些真实代价。图中节点数不能替代这两个判断。"], references:[references.mlir, ref("MLIR：Pattern Rewriter", "https://mlir.llvm.org/docs/PatternRewriter/"),ref("LLVM：浮点与 Fast-Math 语义", "https://llvm.org/docs/LangRef.html")]
  },
  "fusion-legality": {
    intro:["融合把多个操作放进同一执行程序，但它不能随意改变外部能观察到的值、内存读写顺序或舍入语义。本课把‘能够融合’与‘融合后值得运行’分开，先确定合法边界。"],
    prerequisites:[prerequisite("物化", "为某个逻辑中间结果准备实际存储，并把结果写到那里。融合有时能省掉只在内部使用的物化。", "compiler-lowering"),prerequisite("别名", "两个访问可能落到同一存储位置；写入其中一个可能影响另一个之后的读取。", "tensor-address")],
    chapters:{
      external:chapter("中间值还有外部使用者时必须保留",
        p("假设先算 u=2x，再算 y=max(u+1,0)，同时另一个分支需要输出 u。即使主路径被融合，u 仍然是外部需要的结果。融合可以使内部直接继续使用 u，却不能取消对外承诺的输出。"),
        p("观察一条边是否跨出融合区域，就能把内部临时值与外部结果区分开。只有内部使用者的值可能留在寄存器等临时位置；跨边界仍需由某种有效接口交付。融合合法性取决于完整的使用关系，而不是只看画面中的主链。")),
      alias:chapter("先读旧值与先覆盖存储并不等价",
        p("设 a 与 b 是同一存储的两个视图，原内容为[2,5]。程序要求先读取 a 的和得到 7，再通过 b 把第一项改成 9。若融合或重排把写入提前，a 的和就变成 14。最终存储都可能是[9,5]，但中间需要返回的和已经不同。"),
        p("这说明只检查最终内存不够，还要检查整个程序对外产生的值。编译器需要分析别名和读写依赖：两个操作是否访问重叠位置，哪个版本的数据必须先被读取，何时才允许覆盖。")),
      precision:chapter("融合收益与数值语义分别核验",
        p("一个算子边界可能意味着把中间结果转换到较低精度，再供后续计算使用。若融合让中间值始终保留更高精度，结果可能更接近实数运算，却不一定与原程序逐位相同。‘更精确’也不能自动代替原有契约。"),
        table("三位有效数字的十进制教学算术", ["中间量u=1000+0.4如何保存","后续计算u−1000","最后结果"], [["先舍入u，存为1000","1000−1000","0"],["保留u=1000.4到后续减法","1000.4−1000","0.4"]]),
        p("这里两种安排计算相同的实数表达式，却在不同位置舍入，差异因此可见。该算术不模拟具体GPU格式；实际应按数据类型、舍入方式及误差容忍度核查，不能凭‘融合’两个字推断中间精度。"),
        note("融合需要同时通过两道判断：它是否保持要求的行为，以及目标设备上的完整代价是否改善。第一道未通过，第二道再快也不能算等价优化。"))
    },closing:["外部使用、别名读写和数值转换都属于程序语义。融合区域必须服从这些边界，资源和速度评估应在语义成立之后进行。"],references:[references.mlir,references.buffer,ref("LLVM：内存与浮点语义", "https://llvm.org/docs/LangRef.html")]
  },
  "loop-lowering":{
    intro:["矩阵乘法用一个符号表达整块结果，但执行程序必须覆盖每一项乘积，并把属于同一输出的乘积累加起来。循环 Lowering 把这种数学定义展开成可遍历的工作，再通过分块和重排改变工作组织。"],
    prerequisites:[prerequisite("矩阵乘法的三个轴", "A 的形状为[M,K]，B为[K,N]，输出为[M,N]。M、N选择输出位置，K是同一输出需要累加的维度。", "gemm-tiling"),prerequisite("迭代点", "一组具体的循环索引。例如(m,n,k)指定把哪两个输入元素的乘积加入哪一个输出。")],
    chapters:{
      points:chapter("从一个公式得到必须覆盖的乘积",
        equation("矩阵乘法的迭代定义", "<mrow><msub><mi>C</mi><mrow><mi>m</mi><mi>n</mi></mrow></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>K</mi><mo>−</mo><mn>1</mn></mrow></munderover><msub><mi>A</mi><mrow><mi>m</mi><mi>k</mi></mrow></msub><msub><mi>B</mi><mrow><mi>k</mi><mi>n</mi></mrow></msub></mrow>", [["m,n","当前输出的行、列索引"],["k","沿输入内维累加的索引"],["M,N,K","输出行数、输出列数、归约长度"]], "固定 m、n 后，依次遍历所有合法 k，把乘积加到同一个输出。改变遍历方式时，这些乘积的身份不能丢失。", ["M=N=2、K=3时共有4个输出。","每个输出累加3项，总共覆盖12个(m,n,k)乘积。"]),
        p("这样可区分数学工作量与执行安排。一次操作可以向量化或交给矩阵指令，但仍须等价地完成这些合法项；线程数或指令条数不必等于迭代点数。")),
      tiles:chapter("分块改变组织，不改变合法元素集合",
        p("把 K=3 按每块 2 项分组，第一块覆盖 k=0、1，第二块只剩 k=2。这个尾部问题与输出轴分块相同：块的容器可能比真正需要的工作大，必须屏蔽无效位置 k=3。"),
        p("Tile 是一组邻近或适合共同处理的迭代点。分块的好处是让输入在较小工作集里复用，并适配设备指令或存储容量。它并不许可漏算某个乘积，重复写同一输出，或访问数组之外的输入。"),
        figure("每个格子是一项带坐标(i,j,k)的乘积；同一输出对应k=0、1、2三个格子。BK=2时先处理前两项，尾段只处理k=2；#标明当前遍历顺序，没有合法k=3。", { case: 0 })),
      order:chapter("循环交换要尊重依赖与数值要求",
        p("若不同输出互不影响，先遍历行还是列主要改变访问顺序与局部性。若改变同一输出的累加顺序，则还会改变浮点舍入路径。数学上属于同一个求和，不等于有限精度下结果逐位一致。"),
        p("存在别名或循环携带依赖时更不能只看索引范围。例如下一次迭代读取上一次刚写出的值，调换时间次序就可能读到错误版本。循环变换需要证明依赖仍被满足，再评估缓存、并行和资源方面的收益。"))
    },closing:["先写清需要覆盖的合法迭代点，再讨论如何分组、映射和重排。这条顺序把算法正确性与设备优化连接起来。"],references:[references.triton,references.mlir,ref("MLIR：Linalg 的结构化操作", "https://mlir.llvm.org/docs/Dialects/Linalg/")]
  },
  "buffer-liveness":{
    intro:["高层程序可以把每个中间结果视为独立的不可变值，设备内存却是有限、可覆盖的存储。内存规划要判断什么时候可以把一块空间交给下一个值，Bufferization 则把张量值的语义落实到实际可读写缓冲区。"],
    prerequisites:[prerequisite("缓冲区", "承载一段数据的实际存储区域，可由地址读取或写入；逻辑值和缓冲区不必一一永久对应。"),prerequisite("活跃", "一个值已被产生，而且后面仍可能需要使用它。最后一次必要使用结束后，才不必继续保留该版本。", "ir-ssa"),prerequisite("别名", "不同名字或视图可能共享同一存储，覆盖一个可能影响另一个。", "tensor-address")],
    chapters:{
      interval:chapter("存储能否释放取决于最后一次使用",
        p("假设 a 在步骤0产生，步骤3还有一次使用。即使步骤1之后主路径暂时没有用到它，也不能在步骤2把它的空间交给别的值。活跃区间要覆盖从产生到最后一次必要使用的全过程。"),
        p("在线性教学时间轴中，可以把 a 画成[0,3]，c 画成[4,6]，二者不重叠，具备复用同一槽的时间条件。真实程序有分支、异步执行和地址别名时，还需要相应的控制与完成依赖分析，不能仅看源码行号。"),
        figure("图取a最后使用于3、c从4开始的安排，所以二者可以共槽。每个整数时刻t画成[t,t+1)宽度；条带覆盖从产生到最后使用，另一活跃值b也需要独立保留。", { case: 0 })),
      reuse:chapter("复用节省容量，也可能提前覆盖旧值",
        p("延长 a 的最后使用到步骤5后，a=[0,5]与c=[4,6]发生重叠。若步骤4就用 c 覆盖同一存储，步骤5读取 a 时得到的可能已是 c 的内容。复用方案因此不再合法。"),
        p("即使时间不重叠，也要满足容量、对齐、存储空间和其它约束。两个值可以共用内存是一项需要证明的结论，不是仅因它们类型相似就能成立。复用减少峰值空间，是否影响访存或并发则需另行判断。")),
      bufferize:chapter("值语义如何变成原地写入或复制",
        p("设张量值 a=[2,5]，新值 b 表示把 a 的第一项改为9，因此 b=[9,5]。高层语义仍允许稍后读取 a，并得到和7。如果把 b 原地写在 a 的缓冲区，而旧 a 仍被使用，就会错误得到14。"),
        table("旧值是否还需要，决定能否直接覆盖", ["后续需求","可考虑的存储安排"], [["旧 a 仍需读取","保留旧内容，给 b 独立存储或采用等价保护方案"],["旧 a 已无必要使用，且其它约束满足","可以考虑把 b 原地写入原缓冲区"]]),
        p("Bufferization 会把张量操作转换为缓冲区读写，并分析这种原地更新是否安全。它不等于简单给每个张量分配一块新内存，也不等于一律尽量原地覆盖。"))
    },closing:["值身份决定必须保留哪个结果，活跃与别名分析决定何时可以覆盖，内存规划再选择实际空间。三者连起来，才能解释‘少分配一块内存’为什么有时正确、有时会破坏结果。"],references:[references.buffer,references.mlir]
  }
});

Object.assign(compilerKernelTeaching, {
  "compiler-lowering": {
    intro: [
      "写出一个张量计算，只规定了应该得到什么结果。GPU 还需要知道由哪些执行单元计算、值放在哪里、怎样读写内存，以及最终执行什么指令。编译器逐步补齐这些决定，这个过程叫 Lowering，中文可理解为把抽象计算落实为更具体的执行表示。",
      "这门导论沿同一条计算的去向建立全景。PyTorch 图编译、直接编写 Triton Kernel、调用预编译库是不同入口，不能把所有程序画成必经 PyTorch→Triton 的单线。读完应能区分每层负责的决定，之后再到独立课程研究其中的合法性与代价。"
    ],
    prerequisites: [
      prerequisite("张量与 Shape", "张量是有轴和元素的数值数组；Shape 列出每条轴的长度。它描述数学对象，不直接说明线程和内存安排。", "tensor-address"),
      prerequisite("算子与 Kernel", "算子描述矩阵乘、归一化等计算；Kernel 是提交给设备执行的一段程序。多个算子可以合成一个 Kernel，一个算子也可能由多个 Kernel 完成。"),
      prerequisite("IR", "Intermediate Representation，即编译器中间表示。它把程序写成编译器可分析、可改写的数据结构，不只是源码换一种语法。", "ir-ssa")
    ],
    chapters: {
      capture: chapter("从张量程序得到可分析的计算区域",
        p("以逐元素计算为例：先把输入乘 2，再加 1，最后把负数截为 0。人能从语句顺序理解过程，编译器需要明确每个结果被谁使用。图捕获会把适合编译的操作及依赖记录下来，形成可分析的区域。"),
        p("在 PyTorch 的相关路径中，TorchDynamo 负责识别可捕获的执行区域；FX 图是一种记录操作和依赖的表示。Python 行为并不都能在同一区域中表达，遇到边界可能发生 Graph Break，即把连续执行拆成多个区域。Guard 则是复用某份编译结果时要检查的条件，例如类型或形状关系。"),
        p("图捕获的意义，是让后续优化看到跨操作的关系。直接写 Triton Kernel 时，程序员已经给出了 Kernel 入口，不需要先用 Dynamo 把它从普通 Python 执行中找出来。")),
      fusion: chapter("融合改变的是中间结果的保存方式",
        p("假设三个独立 Kernel 依次产生数组 u、v、y。u 和 v 如果放在全局内存中，就会先被写出，再被下一步读入。融合让同一个执行程序继续使用刚算出的中间值，因此可能省去这些中间数组的物化。物化就是给一个逻辑结果分配实际存储并把它写进去。"),
        table("保持同一计算，比较中间结果的去向", ["环节", "分别执行", "满足条件时融合"], [["u=2x", "写出 u，下一步再读取", "在执行程序中继续使用 u"],["v=u+1", "写出 v，下一步再读取", "继续使用 v"],["y=max(v,0)", "写出最终 y", "仍需写出最终 y"]]),
        p("省掉存储不等于省掉乘法和加法。如果别的分支还要使用 u，u 就仍然是一个对外可观察的结果，不能因为主路径融合而删除它。理解融合要持续追踪每个中间值的所有使用者。")),
      program: chapter("把逻辑工作分给 Program，并处理尾部",
        p("Triton 的 Program 是一次逻辑执行实例，它负责一个输出块；不要把 Program 直接当成一个线程。程序员用 Program ID 确定块的位置，再由编译器把块内计算映射到线程等执行资源。"),
        p("长度为 10 的向量如果按每块 4 个位置划分，需要 3 个实例：前两个负责 0–3 和 4–7，最后一个只负责 8、9。最后一块虽然使用同样的块形状，其中两个槽并没有合法输入。Mask 是每个位置是否有效的布尔条件，用它限制读取和写入。"),
        table("N=10、BLOCK=4时的输出责任", ["Program","合法位置","必须屏蔽的位置","执行原表达式"], [["P0","0、1、2、3","无","对各合法位置计算y=max(2x+1,0)"],["P1","4、5、6、7","无","对各合法位置计算y=max(2x+1,0)"],["P2","8、9","10、11","只计算并写回8、9，越界槽不访问"]])),
      ir: chapter("不同表示逐层增加执行信息",
        p("可以先把 IR 理解为同一计算在不同阶段的工作稿。高层保留张量和运算，后续阶段逐渐加入线程归属、地址、指令和资源限制。每一层适合回答的问题不同，因此不能只凭某一层代码长短判断快慢。"),
        table("从张量意图到设备产物", ["表示", "重点表达什么", "仍不能直接据此判断什么"], [["TTIR", "Triton 的张量操作、类型及依赖", "最终每个值落在哪个物理寄存器"],["TTGIR / TritonGPU IR", "加入 GPU 数据布局等执行信息", "最终机器指令与实际时间"],["LLVM IR", "更低层的值、地址和目标相关操作", "所有目标后端的最终资源分配"],["PTX", "NVIDIA 的虚拟指令集表示", "它不是最终 SASS"],["SASS / 设备二进制", "目标设备实际指令产物", "没有测量就不知道实际性能"]]),
        p("这些名称用于定位要核对的信息。方言是一组用于某类计算的操作和类型规则，Pass是一次程序分析或改写步骤；具体阶段与规则会随工具链变化。教程的结构示意不能冒充某个版本实际输出的中间表示记录（IR Dump）。")),
      layout: chapter("Shape 之外，还要回答值由谁持有",
        p("一个 2×2 张量始终有四个逻辑元素，但可以按行分给两个线程，也可以按列分配。Shape 完全相同，持有者却不同。这里的 Layout 指逻辑元素与线程、寄存器槽等执行位置之间的对应方式。"),
        p("如果下一步需要的排列与现有持有方式不同，值就可能要在线程之间传递。某些变换只重排同一线程的局部值，某些在一组共同组织执行的线程（Warp）之间交换，另一些经过多线程可访问的共享内存中转。是否发生通信，必须先明确变换前后每个元素的持有者。"),
        table("2×2张量保持四个元素身份", ["坐标","按行持有","按列持有"], [["(0,0)","线程0","线程0"],["(0,1)","线程0","线程1"],["(1,0)","线程1","线程0"],["(1,1)","线程1","线程1"]])),
      target: chapter("从目标指令到真正的运行结果",
        p("后端继续把程序转换为目标指令，并安排有限的物理寄存器。IR 中的值名只是编译器追踪值的身份，不等于设备寄存器编号。PTX 也仍是虚拟指令表示，后续汇编和资源分配会改变最终产物。"),
        p("因此，看到 PTX 少了几行，只能说明该表示发生了变化。要判断执行代价，应继续核对目标二进制、每线程寄存器、共享内存、可能的 Spill，以及真实测量。Spill 是把无法一直留在寄存器里的值移到后备存储，由此可能引入额外访存。")),
      tradeoff: chapter("把优化假设接到证据上",
        p("融合减少中间存储，往往是一个合理的优化方向，但融合也可能让更多中间值同时存活，扩大寄存器需求。两个因素可以同时发生：逻辑写回减少，实际执行却没有更快。"),
        table("一种说法需要对应一种证据", ["要判断的变化", "合适的证据"], [["中间数组是否消失", "图或 IR 中的定义、使用与存储操作"],["是否出现资源压力", "编译资源报告、生成指令及 Spill 迹象"],["设备访问是否减少", "在明确口径下采集的访存指标"],["整个请求是否更快", "相同输入、相同语义、同一完成边界的计时"]]),
        p("导论的终点是建立这种分层判断：数学语义决定什么可以改变，编译产物说明实际改成了什么，运行证据说明代价是否改善。后续独立课分别展开这三类问题。"))
    },
    closing: ["学习编译链时，可以始终追问同一对象：这个值从哪里来、被谁使用、放在哪里、由谁执行。每下降一层，就多确定一部分执行信息。", "示意片段用于建立层次；生产问题仍需固定工具链、目标设备、输入形状和数据类型，获取真实产物后分析。"],
    references: [references.capture, references.triton, references.mlir, references.llvm, ref("Triton Kernel 的编译阶段", "https://pytorch.org/blog/triton-kernel-compilation-stages/")]
  },
  "tensor-address": {
    intro: ["GPU 最终从存储地址读取数字，而模型通常用‘第几行、第几列’描述它们。张量地址课负责接上这两种视角：同一组数可以有不同逻辑视图，逻辑上的转置也不一定真的移动了数据。", "本课用坐标、Stride 和共享存储解释地址，再把结果接到编译器为何必须检查别名。"],
    prerequisites: [prerequisite("索引从 0 开始", "索引 0 表示第一个元素。因此槽 5 是第六个元素，不是第五个。"),prerequisite("元素与字节", "元素是一个数，字节是存储单位；每个元素占多少字节由数据类型决定。例如 16 位数通常占 2 字节。")],
    chapters: {
      address: chapter("把逻辑坐标换成存储偏移",
        p("Shape=[2,3] 表示两行三列。若按行连续存放，从一行同列走到下一行要跨过 3 个元素，从一列走到下一列只跨 1 个，这两个步长就是 Stride=[3,1]。Stride 的单位先按元素计数。"),
        equation("二维视图的地址换算", "<mrow><mi>a</mi><mo>=</mo><msub><mi>a</mi><mn>0</mn></msub><mo>+</mo><mi>b</mi><mo>(</mo><mi>o</mi><mo>+</mo><mi>i</mi><msub><mi>s</mi><mn>0</mn></msub><mo>+</mo><mi>j</mi><msub><mi>s</mi><mn>1</mn></msub><mo>)</mo></mrow>", [["a₀ / a","底层存储起始字节地址 / 当前元素字节地址"],["b","每个元素的字节数"],["o","视图起点相对底层存储的元素偏移"],["i,j","行、列索引"],["s₀,s₁","行、列 Stride，单位为元素"]], "先在括号内算要跨过多少元素，再乘元素字节数。Shape 限制合法坐标，Stride 决定坐标如何落到存储。", ["起点偏移 0，坐标(1,2)，Stride=[3,1]：元素偏移为 1×3+2×1=5。","若每元素 2 字节，则相对底层起点偏移 10 字节。"]),
        figure("逻辑形状[2,3]、步长[3,1]，连线从坐标(1,2)指向底层槽5。槽号以元素计数；换成字节地址仍要乘每元素字节数。", { pick: 5 })),
      transpose: chapter("转置视图改变坐标解释",
        p("原张量是两行三列，转置后逻辑上变成三行两列。一个转置视图可以只把 Shape 改为[3,2]、Stride 改为[1,3]，底层六个数仍按原来的顺序保存。原来的(1,2)与转置后的(2,1)都落在槽 5。"),
        p("View 表示共享底层存储的视图；Contiguous 表示按该视图的逻辑顺序遍历时，存储也是连续的。某个后端若要求特定连续布局，才可能触发物化复制。于是‘写了转置’与‘GPU 搬了一遍数据’要分别核查。")),
      alias: chapter("两个名字可能指向同一份数据",
        p("如果原张量和转置视图都指向槽 5，从其中一个视图写这个位置，另一个就能观察到变化。这种共享关系叫别名，即不同访问表达式可能落到同一存储位置。"),
        p("编译器要把一次读移到一次写之前，必须判断它们是否可能重叠。若读到的是写前值，交换后却读到写后值，程序语义已经改变。不同变量名不能证明不同存储；同一底层存储的互不重叠切片也不一定冲突，关键是实际访问范围。"))
    }, closing:["Shape 告诉你有哪些逻辑位置，Stride 和偏移告诉你怎样找到它们，别名分析告诉你哪些读写可能相互影响。这三件事共同决定访问是否正确以及变换是否合法。"], references:[references.views,references.triton]
  },
  "ir-ssa": {
    intro:["编译器要改写程序，首先需要分清每次计算产生的值。源码允许多次给同一个变量名赋值，直接盯着名字很容易把旧值与新值混在一起。中间表示（IR）把程序组织成可分析的操作和关系；静态单赋值表示（SSA）为每个产生的值保留独立身份。", "这里从‘旧值仍然要使用’开始，再看独立计算能否重排，最后补上仅看数值连线还看不到的内存影响。"],
    prerequisites:[prerequisite("值与存储", "一个值是某次计算的结果；存储是可保存或覆盖数据的位置。两个不同值可以在不同时刻使用同一存储，但这要经过合法性分析。", "tensor-address"),prerequisite("依赖", "后一步需要前一步的结果时，就必须在结果可用后执行。没有这个结果，后一步不能得到规定的输出。")],
    chapters:{
      values:chapter("给旧值与新值保留不同身份",
        p("考虑这样一段程序：输入 x=2，先保存 old=x，再令 x=x+1，最后返回 old+x。正确结果是 2+3=5。若误把 old 也替换为更新后的 x，结果会变成 6。问题不在加法，而在两次使用到底指哪一个值。"),
        table("同名变量背后的不同值", ["源码含义","SSA 中的身份","本例数值"], [["原输入 x","x₀","2"],["更新后的 x=x+1","x₁，使用 x₀ 产生","3"],["返回旧输入加更新值","x₀+x₁","5"]]),
        p("SSA 是 Static Single Assignment，意为每个值只定义一次。x₀、x₁ 是值的名字，不是要求程序运行时复制两个完整数组，也不是物理寄存器编号。独立身份让编译器可靠地追踪后续使用，避免将不同时刻的值混同。")),
      dependence:chapter("用定义与使用关系判断重排",
        p("Definition 指一个值在哪里产生，Use 指哪些操作消费它。假设 u=2x，w=3y，v=u+w。u 与 w 只读取各自输入，可以独立求值；v 必须等待二者。即使源码先写 u 后写 w，也不代表这两个纯计算之间必然有依赖。"),
        p("这正是图表示的用途：优化器可以沿依赖边判断哪些计算能提前、合并或删除，而不只照着源码行号执行。纯操作在这里指没有对外可观察的额外影响；随机状态、内存写入、通信等行为需要另外考虑。"),
        figure("图取x=2、y=1。×2节点产生u=4，×3节点产生w=3，两条分支汇入加法节点v=7；连线表示使用关系，因此最后加法必须等待两个输入。", { case: 0 })),
      effect:chapter("数值连线之外，还有内存与副作用",
        p("假设某个存储槽初值为 0，程序先向它写入 7，再从该槽读出。读操作应得到 7。若仅因读写结果之间没有直接 SSA 数值边，就把读取移到写入前，结果会变成 0。"),
        p("内存副作用是操作对存储等外部状态的影响；别名分析用于判断两个地址表达式能否指向同一位置。合法重排要同时尊重值依赖、内存影响及控制条件。SSA 提供清楚的值身份，但不会替代所有语义分析。"))
    },closing:["SSA 的关键价值是把每次产生的值及其使用者说清楚，从而支持可靠的程序分析。进入融合、内存规划或代码生成时，都要继续保持这种身份关系。","本课覆盖直线程序和内存反例；条件分支合流、循环携带值及支配关系需要结合相应 IR 的区域和控制流继续学习。"],references:[references.mlir,references.llvm]
  },
  "graph-capture":{
    intro:["普通 Python 调用会一边执行一边决定后续行为。编译优化则希望先得到一段可分析的计算，观察多个操作之间的联系。图捕获负责从运行过程中识别这样的区域，但得到图以后，还必须确认下一次输入是否允许继续使用同一结果。"],
    prerequisites:[prerequisite("计算图", "节点表示操作，边表示一个操作产生的值被另一操作使用。图表达依赖，不能仅凭节点排列推断真实运行时间。", "ir-ssa"),prerequisite("特化", "依据已知条件生成针对性实现，例如固定数据类型或某些形状。条件越具体，优化空间可能越大，复用范围也可能越窄。")],
    chapters:{
      region:chapter("捕获区域与普通执行的边界",
        p("以乘法、加法和后续 Python 处理为例，能被捕获的张量运算可以放进图中，后续行为不一定与它们属于同一个可编译区域。区域边界说明优化器当前能看到哪些操作，也限制了跨边界融合的机会。"),
        p("Graph Break 是图捕获中断并分段的边界；它不等同于整个模型计算失败。框架可能回到普通执行，再捕获后续区域。是否发生、在哪发生，依赖具体代码与版本，应查看实际日志或图，不能从‘使用了编译’推断模型已成为单个 Kernel。")),
      guard:chapter("复用前先检查成立条件",
        p("假设某份结果只针对隐藏维 H=4、某种数据类型和设备生成。下一次调用即使函数名一样，若 H 改变，就不能默认继续使用原实现。Guard 就是把这类适用条件变成运行时可检查的约束。"),
        table("命中名字不等于满足条件", ["输入变化","教学判断"], [["数值改变，形状、类型、设备条件仍满足","有机会复用同一编译结果"],["某个已特化的维度改变","原 Guard 可能失败，需要另一实现或重新编译"],["允许动态变化的维度在约束内改变","不必仅因数值不同就生成新版本"]]),
        p("理解图捕获要同时看区域与条件：区域决定能优化哪段计算，Guard 决定优化后的实现能在哪些调用上复用。完整 Guard 还可能涉及步长、对象身份等信息，本例不是某版本的全部规则。"))
    },closing:["捕获、编译和复用是连续但不同的工作。先确认图里包含什么，再确认实现依赖哪些条件，最后检查当前调用是否满足它们。"],references:[references.capture,references.shapes]
  }
});
