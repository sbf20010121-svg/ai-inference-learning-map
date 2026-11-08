/** Authored independent courses. Objects and questions precede presentation. */
export const sources = {
  mlir: "https://mlir.llvm.org/docs/Tutorials/Toy/",
  buffer: "https://mlir.llvm.org/docs/Bufferization/",
  ir: "https://mlir.llvm.org/docs/LangRef/",
  dynamo:
    "https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamo_overview.html",
  dynamic:
    "https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamic_shapes.html",
  llvm: "https://llvm.org/docs/CodeGenerator.html",
  triton:
    "https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html",
  views: "https://docs.pytorch.org/docs/stable/tensor_view.html",
  engine: "https://docs.vllm.ai/en/latest/design/arch_overview/",
  kv: "https://docs.vllm.ai/en/latest/design/paged_attention/",
  generation:
    "https://huggingface.co/docs/transformers/main_classes/text_generation",
  vit: "https://arxiv.org/abs/2010.11929",
  vlm: "https://arxiv.org/abs/2304.08485",
  mamba: "https://arxiv.org/abs/2312.00752",
  delta: "https://arxiv.org/abs/2412.06464",
  cuda: "https://docs.nvidia.com/cuda/archive/13.0.0/cuda-c-programming-guide/index.html",
  best: "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/",
  nccl: "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html",
  compat: "https://docs.nvidia.com/deploy/cuda-compatibility/",
  threads: "https://man7.org/linux/man-pages/man7/pthreads.7.html",
  mmap: "https://man7.org/linux/man-pages/man2/mmap.2.html",
  robot: "https://huggingface.co/docs/lerobot/main/action_representations",
  dataset: "https://huggingface.co/docs/lerobot/main/lerobot-dataset-v3",
  processors:
    "https://huggingface.co/docs/lerobot/main/introduction_processors",
  act: "https://arxiv.org/abs/2304.13705",
  diffusion: "https://arxiv.org/abs/2303.04137",
  dreamer: "https://arxiv.org/abs/2301.04104",
  dit: "https://arxiv.org/abs/2212.09748",
  ros: "https://github.com/ros2/ros2_documentation/blob/jazzy/source/Concepts/Intermediate/About-Tf2.rst",
};
export const terms = (s) => s.split(";").map((x) => x.split("|"));
export const math = (s) =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${s}</math>`;
export const page = (id, title, question, explain, extras = {}) => ({
  id,
  title,
  question,
  explain,
  ...extras,
});
export const define = (d) => {
  const chapters = d.chapters.map((p) => ({
    ...p,
    figure: `foundation/${d.id}/${p.id}`,
  }));
  return {
    ...d,
    chapters,
    notes: {
      definition: d.goal,
      objective: d.goal,
      reason: d.why,
      terms: terms(d.terms),
      formula: d.formula,
      derive: d.derive,
      source: sources[d.source] || d.source,
      section: d.section,
      code: d.code,
      question: d.quiz[0],
      options: d.quiz[1],
      correct: d.quiz[2],
      explain: d.quiz[3],
      limit: d.limit,
    },
  };
};
export const compilerCourses = [
  define({
    id: "tensor-address",
    module: "compiler",
    unit: "representation",
    title: "张量、Stride 与地址计算",
    goal: "从一个逻辑坐标推到实际元素位置，区分转置视图与数据搬运。",
    why: "编译器需要知道元素地址和别名；Shape相同并不保证相同访问方式。",
    prereqs: [
      ["llm-block", "模型张量的轴需要落实为地址，才能讨论布局与优化。"],
    ],
    source: "views",
    section: "Tensor Views：共享底层存储、contiguous与转置视图。",
    terms:
      "shape|各逻辑轴的长度;stride|沿某轴移动1格跨过的元素数;offset|底层存储中的起始偏移;view|共享原存储的张量视图;contiguous|逻辑遍历与连续存储顺序一致",
    chapters: [
      page(
        "address",
        "从坐标找到元素",
        "逻辑坐标(1,2)为什么对应第5个元素？",
        "对2×3行主序张量，Stride=[3,1]。地址偏移是1×3+2×1=5；单位是元素，转成Byte还要乘dtype字节数。图中同时追踪逻辑位置和底层槽。",
        { formula: true },
      ),
      page(
        "transpose",
        "转置改变了什么",
        "切换转置后，底层数组需要重新排列吗？",
        "转置视图交换Shape和Stride；同一物理槽仍是同一对象。若后端要求连续布局，才可能另行物化复制。不要把转置符号直接等同一次GPU搬运。",
        { code: true },
      ),
      page(
        "alias",
        "共享存储的后果",
        "写视图里的一个位置，谁还能看到改变？",
        "图中两个视图指向同一底层槽时，它们存在别名。编译器重排读写前必须保持这种可观察关系；不重叠的不同切片则未必冲突。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>offset</mi><mo>=</mo><mi>base</mi><mo>+</mo><mo>∑</mo><msub><mi>i</mi><mi>d</mi></msub><msub><mi>stride</mi><mi>d</mi></msub></mrow>",
    ),
    derive: [
      "原Shape=[2,3]，Stride=[3,1]，底层[0,1,2,3,4,5]。",
      "原坐标(1,2)对应槽5；转置Shape=[3,2]、Stride=[1,3]。",
      "转置坐标(2,1)仍对应槽5；数据身份保持，连续性改变。",
    ],
    code: "storage = [0,1,2,3,4,5]\ndef address(index, strides):\n    return sum(i*s for i,s in zip(index,strides))\nassert address([1,2],[3,1]) == address([2,1],[1,3])",
    quiz: [
      "转置视图与原张量共享槽5，写入视图后原张量对应值会怎样？",
      ["仍是旧值，因为Shape不同", "也变化，因为共享存储", "必然先发生完整复制"],
      1,
      "视图改变索引解释，不自动分配新存储；物化副本才具有独立数据。",
    ],
    limit:
      "本例只含正Stride和普通稠密视图；实际重叠、广播Stride=0与后端布局还需分别分析。",
  }),
  define({
    id: "ir-ssa",
    module: "compiler",
    unit: "representation",
    title: "IR、SSA 与使用定义关系",
    goal: "沿值的定义和使用找出真实依赖，理解IR怎样使变换可分析。",
    why: "源码变量名可反复赋值；编译器需要区分每次产生的值，不能靠流程标题判断依赖。",
    prereqs: [
      ["tensor-address", "先分清逻辑值与底层存储，才能区分SSA值和内存读写。"],
    ],
    source: "ir",
    section:
      "MLIR Language Reference：operations、SSA values、blocks与regions。",
    terms:
      "IR|编译器中间表示;SSA|每个值只定义一次的表示;def/use|值的产生位置/消费位置;block|一段有顺序约束的操作区域;region|操作内部的控制或作用域结构",
    chapters: [
      page(
        "values",
        "名字与值的区别",
        "两次x赋值如何变成不同的SSA值？",
        "x先乘2，再加1，会产生%u和%v两个不同值。连线表示消费者使用某次定义，不是笼统的“下一步”；点击输入值，跟踪它能影响哪些结果。",
      ),
      page(
        "dependence",
        "依赖限制重排",
        "哪两个计算可以交换，哪个必须等待？",
        "u=2x与w=3y只读各自输入，可以独立求值；v=u+w必须等待两者。SSA直接描述显式值依赖，但内存副作用仍需额外分析。",
        { code: true },
      ),
      page(
        "effect",
        "数值依赖以外",
        "没有SSA连线，是否已经证明能随意重排？",
        "同一地址的store与后续load有内存依赖，即使结果值之间没有直接连线也不能倒置。图对照先写后读与错误顺序的实际读值。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>u</mi><mo>=</mo><mn>2</mn><mi>x</mi><mo>,</mo><mi>w</mi><mo>=</mo><mn>3</mn><mi>y</mi><mo>,</mo><mi>v</mi><mo>=</mo><mi>u</mi><mo>+</mo><mi>w</mi></mrow>",
    ),
    derive: [
      "x=2、y=1时，独立值u=4、w=3。",
      "消费者v=7必须等u和w可用。",
      "若内存槽初值0，先store(7)再load读7；交换后load读0，语义改变。",
    ],
    code: "%u = arith.muli %x, %two : i32\n%w = arith.muli %y, %three : i32\n%v = arith.addi %u, %w : i32\n// 原创MLIR片段示意；省略函数与常量定义",
    quiz: [
      "没有直接SSA边的load/store可否总是交换？",
      [
        "可以，SSA边就是全部依赖",
        "要检查地址别名与副作用",
        "只要变量名不同即可",
      ],
      1,
      "显式值边之外还有内存与控制语义；可重排需要相应分析证明。",
    ],
    limit:
      "此处展示直线块和内存反例；分支合流、循环携带值与完整支配关系需要结合具体IR分析。",
  }),
  define({
    id: "graph-capture",
    module: "compiler",
    unit: "capture",
    title: "图捕获、Guard 与 Graph Break",
    goal: "解释一次Python调用何时复用编译区域，何时退出或重新捕获。",
    why: "图捕获决定编译器实际看见哪段程序；它和区域内部怎样优化是两个问题。",
    prereqs: [["ir-ssa", "捕获输出是带值依赖的图，先理解图中每个值代表什么。"]],
    source: "dynamo",
    section: "Dynamo Overview：Python bytecode、FX Graph、guards和混合执行。",
    terms:
      "FX|PyTorch运算图表示;Guard|复用已编译程序必须成立的条件;Graph Break|捕获区域在不支持位置断开;backend|接收图并产生可执行结果的后端",
    chapters: [
      page(
        "region",
        "图捕获的边界",
        "张量运算之间夹着Python行为时，编译区域是什么？",
        "将运算a、b与区域外行为分开放在时间线上。Graph Break可能把原函数分成多个区域；区域间仍要执行必要的Python工作，不是把它删除。",
      ),
      page(
        "guard",
        "复用条件",
        "同样调用函数，为什么有的输入能命中同一产物？",
        "本例产物要求dtype=f32、末维4、设备相同。改变Batch不一定违反这组Guard，改变末维则会失败。它是明确的教学Guard，不宣称所有Dynamo版本生成同样条件。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>reuse</mi><mo>=</mo><mi>sameDevice</mi><mo>∧</mo><mi>sameDtype</mi><mo>∧</mo><mo>(</mo><mi>H</mi><mo>=</mo><mn>4</mn><mo>)</mo></mrow>",
    ),
    derive: [
      "假设缓存产物约束H=4、dtype=f32。",
      "输入[B=2,H=4,f32]和[B=3,H=4,f32]均满足这组条件。",
      "H变8或dtype变f16不满足；需要其它有效产物、重新编译或回退，不能强行复用。",
    ],
    code: 'def can_reuse(shape,dtype,device):\n    return shape[-1] == 4 and dtype == "f32" and device == "gpu0"\n# 真实Guard由Dynamo根据捕获和特化条件产生',
    quiz: [
      "缓存只约束H=4；把B从2改3，必然重新编译吗？",
      ["必然", "不能据此判断失败，这组Guard仍成立", "必然产生Graph Break"],
      1,
      "复用检查取决于实际Guard；Shape有变化不等于任意产物都失效。",
    ],
    limit:
      "不复现CPython字节码解释器和全部Guard；Graph Break与Guard失败的具体日志需按PyTorch版本核对。",
  }),
  define({
    id: "symbolic-shapes",
    module: "compiler",
    unit: "capture",
    title: "符号形状、特化与重新编译",
    goal: "由输入序列判断静态特化与符号条件各需要多少有效产物。",
    why: "在线请求形状变化会影响编译成本和缓存；动态不等于没有约束，也不保证更快。",
    prereqs: [
      ["graph-capture", "先知道Guard控制复用，才能解释形状变化与重编译。"],
    ],
    source: "dynamic",
    section:
      "Dynamic Shapes：symbolic dimensions、specialization和recompilation。",
    terms:
      "symbol|运行时才能确定的维度变量;specialization|为满足某组条件的输入生成专用代码;shape guard|限制符号取值的条件;recompile|已有产物不适用时产生新产物",
    chapters: [
      page(
        "sequence",
        "沿输入序列看缓存",
        "B=[2,4,2,8]进入静态缓存，会产生几个形状版本？",
        "完全按B特化时，首次2、4、8分别建版本，第二次2复用。看的是不同条件集合，不是调用次数。",
      ),
      page(
        "constraint",
        "动态仍有条件",
        "一个B可变的版本是否自动适用于所有B？",
        "教学版本允许1≤B≤8且H=4；B=16或H=8仍不适用。Tile、对齐、分支和数据相关形状都可能继续引入约束。",
        { formula: true, quiz: true },
      ),
      page(
        "amortize",
        "编译成本怎样摊销",
        "运行更快的特化产物，为什么短任务仍可能更慢？",
        "假设编译100ms、每次执行省1ms，需要超过100次才抵消编译成本；缓存和冷启动必须进入比较。这里的时间是人为成本账本。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>T</mi><mo>=</mo><mi>C</mi><mo>+</mo><mi>n</mi><msub><mi>t</mi><mi>run</mi></msub></mrow>",
    ),
    derive: [
      "静态序列[2,4,2,8]有3个不同B值。",
      "约束动态版本可覆盖这4次调用，但不覆盖B=16。",
      "若C=100ms且每次节省1ms，n=100只是收支平衡，n>100才有净收益。",
    ],
    code: "seen=set()\nfor batch in [2,4,2,8]:\n    hit = batch in seen\n    seen.add(batch)\n# 此集合只模拟完全静态特化，不是实际编译器缓存键",
    quiz: [
      "B动态且允许范围1到8，B=16可否直接复用？",
      [
        "可以，动态表示无限制",
        "不满足这组范围约束",
        "应把16改为8而保持任务不变",
      ],
      1,
      "动态维度仍受形状关系、布局和执行路径的条件限制。",
    ],
    limit:
      "成本数字为教学假设；真实动态形状策略、自动泛化和缓存限制随版本变化。",
  }),
  define({
    id: "graph-rewrite",
    module: "compiler",
    unit: "optimization",
    title: "模式重写与图优化",
    goal: "追踪公共表达式消除和常量折叠前后的值依赖及计算结果。",
    why: "图优化首先要保持可观察语义；不能只按“节点减少”判断优化合法或有效。",
    prereqs: [["ir-ssa", "公共子表达式必须有相同操作、输入和语义条件。"]],
    source: "mlir",
    section: "Toy Chapter 3/4：pattern rewriting、canonicalization和通用变换。",
    terms:
      "CSE|复用相同的公共子表达式;constant folding|编译期求出常量运算;rewrite|匹配条件成立时替换局部IR;canonicalization|转成便于后续处理的规范形式",
    chapters: [
      page(
        "cse",
        "两个节点能否共用",
        "u=x+1与v=x+1，怎样变成一个定义被使用两次？",
        "图用两条消费边保留u+v的两次贡献，消除重复定义不等于少加一次。输入和类型相同还不足以忽略副作用或不同数学属性。",
        { formula: true },
      ),
      page(
        "fold",
        "常量何时可提前算",
        "(2+3)×x中的哪个部分不依赖运行输入？",
        "2+3可成为常量5；乘x仍必须运行。对照x变化观察输出仍随输入改变。常量传播不能把数据相关值当常量。",
        { code: true },
      ),
      page(
        "float",
        "代数恒等式的边界",
        "实数成立的变形，浮点结果一定逐位相同吗？",
        "大数、小数和抵消的顺序会改变舍入。只有允许的精度语义下才能进行相关重排；图给出显式舍入后的不同中间值。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mo>(</mo><mi>x</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>+</mo><mo>(</mo><mi>x</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>=</mo><mn>2</mn><mo>(</mo><mi>x</mi><mo>+</mo><mn>1</mn><mo>)</mo></mrow>",
    ),
    derive: [
      "x=2时，两次x+1各得到3。",
      "CSE后只有一个3，消费者仍将它贡献两次，输出6。",
      "浮点重排另需数值检查；本等式仅用小整数验证，不据此允许所有浮点重写。",
    ],
    code: "def original(x): return (x+1)+(x+1)\ndef cse(x):\n    u=x+1\n    return u+u\nassert all(original(x)==cse(x) for x in range(-3,4))",
    quiz: [
      "CSE把两次x+1合成一个值后，u+u能否直接变成u？",
      ["可以，只剩一个生产者", "不可以，仍有两次贡献", "取决于GPU Warp数"],
      1,
      "生产者复用不改变消费者的数学语义；计算图的边也承载使用次数。",
    ],
    limit:
      "原创整数重写示例；实际CSE还需类型、属性、内存效应等条件，浮点优化受具体编译选项约束。",
  }),
  define({
    id: "fusion-legality",
    module: "compiler",
    unit: "optimization",
    title: "融合合法性、别名与精度",
    goal: "在减少中间写回之前，判断哪些值必须保留、哪些读写不能重排。",
    why: "融合的首要条件是保留程序可观察行为；寄存器压力是后续成本判断。",
    prereqs: [
      ["tensor-address", "共享存储会让不同名字的读写影响同一对象。"],
      ["compiler-lowering", "导论中的融合IO例子需要补上合法性条件。"],
    ],
    source: "buffer",
    section:
      "Bufferization：read-after-write conflicts、aliasing和in-place analysis。",
    terms:
      "alias|多个引用可能访问同一存储;RAW|写入前后读取的值可能不同;live value|后续还会被使用的值;materialize|在算子边界保存可访问结果",
    chapters: [
      page(
        "external",
        "外部使用不能消失",
        "u在链外还被读取，融合后可以完全不保存u吗？",
        "用消费者位置区分私有中间值和外部可见值。v可以只留在融合内核中，但u若仍有外部消费者，就要以满足语义的形式保留。",
        { code: true },
      ),
      page(
        "alias",
        "别名制造的反例",
        "先保存a[0]再覆盖a[0]，为什么不能把读移到写之后？",
        "初值2，旧值必须读2，写后是9；错误顺序会让旧值变9。这里比对实际槽值，不以变量名推断独立。",
        { quiz: true },
      ),
      page(
        "precision",
        "收益与合法性分开",
        "少一次写回，是否允许改变归约和舍入规则？",
        "归约、dtype转换和外部可见结果都属于语义条件。先确认等价性与误差要求，再讨论减少的字节和可能增加的资源。",
      ),
    ],
    formula: math(
      "<mrow><mi>old</mi><mo>=</mo><mn>2</mn><mo>≠</mo><mn>9</mn><mo>=</mo><mi>afterWrite</mi></mrow>",
    ),
    derive: [
      "a=[2,5]，执行old=a[0]，old=2。",
      "随后a[0]=9，得到a=[9,5]；old仍为2。",
      "如果把读取延迟到写后，old=9，输出改变，不能用减少IO为这种重排辩护。",
    ],
    code: "a=[2,5]\nold=a[0]\na[0]=9\nassert old==2 and a[0]==9",
    quiz: [
      "u还要被另一个算子消费，融合后能否直接删除其所有物化？",
      [
        "只要Kernel变少就能删",
        "须保留外部消费者所需的值与时序",
        "只看u的Shape是否很小",
      ],
      1,
      "融合区域内部的私有中间值与对外可见结果必须分别分析。",
    ],
    limit:
      "本课分析直线读写和别名；不声称复现任一编译器完整效应系统或证明任意融合合法。",
  }),
  define({
    id: "loop-lowering",
    module: "compiler",
    unit: "lowering",
    title: "算子 Lowering 与循环变换",
    goal: "把C=AB展开为迭代点，解释分块、交换和尾部处理改变了什么。",
    why: "算子名称不直接规定循环次序和GPU任务划分；优化要在依赖允许范围内改变访问与重用。",
    prereqs: [
      ["gemm-tiling", "先理解一个输出累加，再观察相同运算集合的不同遍历顺序。"],
    ],
    source: "mlir",
    section: "Toy Chapter 5/6：从高层操作部分Lowering到循环和LLVM。",
    terms:
      "iteration space|所有合法循环索引组成的集合;tiling|把迭代点分成小块;loop interchange|交换循环的遍历次序;reduction axis|对同一输出累加的轴",
    chapters: [
      page(
        "points",
        "算子展开为迭代点",
        "2×3乘3×2的GEMM共有多少次乘加贡献？",
        "(i,j,k)的合法集合有2×2×3=12个点。图在输出坐标和k方向间追踪同一贡献；Lowering必须保留每个所需贡献。",
        { formula: true },
      ),
      page(
        "tiles",
        "分块改变遍历",
        "Tile大小2时，末尾k=2为什么仍需处理？",
        "k分成[0,1]与[2]两块。分块并不把3补成实际可越界访问的4；最后一块要有边界条件。",
      ),
      page(
        "order",
        "循环交换的约束",
        "同一组贡献换次序以后，哪些条件还要核对？",
        "整数小例子可核对精确结果；浮点归约顺序、内存别名和输出更新依赖不能忽略。不同循环次序带来的访存收益需要设备验证。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>C</mi><mi>ij</mi></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow><mn>2</mn></munderover><msub><mi>A</mi><mi>ik</mi></msub><msub><mi>B</mi><mi>kj</mi></msub></mrow>",
    ),
    derive: [
      "M=N=2、K=3，共12个乘积贡献。",
      "BK=2时，k区间是[0,2)和[2,3)。",
      "两块累计到相同C；若错误读取k=3，就超出原张量。",
    ],
    code: "for i in range(2):\n for j in range(2):\n  for k0 in range(0,3,2):\n   for k in range(k0,min(k0+2,3)):\n    C[i][j] += A[i][k]*B[k][j]",
    quiz: [
      "K=3、BK=2时应执行哪些k？",
      ["0,1,2,3全部读取", "0,1与2，屏蔽非法3", "只执行0,1即可"],
      1,
      "合法迭代集合不因Tile尺寸改变；尾部需要显式处理。",
    ],
    limit:
      "整数GEMM迭代空间，不描述真实线程Layout；浮点、向量化与依赖合法性须另行核验。",
  }),
  define({
    id: "buffer-liveness",
    module: "compiler",
    unit: "storage",
    title: "活跃区间、内存规划与 Bufferization",
    goal: "用时间区间判断缓冲区何时能复用，理解张量值到可写内存的边界。",
    why: "SSA值看似不可变，但设备执行需要可写缓冲；过早复用会覆盖尚需读取的数据。",
    prereqs: [
      [
        "ir-ssa",
        "SSA值语义需要落实到可写存储；缓冲复用不能覆盖仍要读取的旧值。",
      ],
      ["fusion-legality", "别名和外部使用决定是否允许原位更新。"],
    ],
    source: "buffer",
    section:
      "One-Shot Bufferize：in-place/out-of-place decisions和read-after-write conflicts。",
    terms:
      "liveness|从产生到最后一次使用的区间;buffer|实际保存数据的可写区域;in-place|复用已有缓冲执行更新;memref|带布局和存储信息的内存引用",
    chapters: [
      page(
        "interval",
        "最后一次使用在哪里",
        "两个大小相同的中间值，何时可以共用槽？",
        "a活跃[0,3]、b活跃[2,5]，有重叠；c活跃[4,6]可在a的最后使用完成后接替其槽。颜色表示值身份，横向位置表示执行边界。",
        { formula: true },
      ),
      page(
        "reuse",
        "复用与覆盖风险",
        "把a的最后使用移晚，原来的分配方案为什么失效？",
        "改动消费者位置会延长活跃区间。内存规划必须基于实际依赖，不能只按生产者相邻或大小相等分配。",
        { quiz: true },
      ),
      page(
        "bufferize",
        "值怎样变成可写对象",
        "原位更新为什么要先分析旧值的后续读取？",
        "如果旧张量仍要被读，原位写入会破坏旧值语义；需要副本或其它合法安排。Bufferization同时决定内存表示和能否复用。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>reuse</mi><mo>⇒</mo><mi>lastUse</mi><mo>(</mo><mi>a</mi><mo>)</mo><mo>&lt;</mo><mi>firstWrite</mi><mo>(</mo><mi>c</mi><mo>)</mo></mrow>",
    ),
    derive: [
      "a的最后使用完成于3，c从4开始写，可用同槽。",
      "b从2开始且a仍活跃，a/b不能按此模型共用。",
      "若a最后使用延到5，c从4覆盖就会造成读到新值的错误。",
    ],
    code: 'intervals={"a":(0,3),"b":(2,5),"c":(4,6)}\ndef disjoint(x,y):\n return x[1]<y[0] or y[1]<x[0]\nassert disjoint(intervals["a"],intervals["c"])',
    quiz: [
      "a最后使用从3延到5，c仍在4写入，可否保留同槽安排？",
      [
        "可以，因为大小相同",
        "不能，活跃区间发生重叠",
        "只要使用不同SSA名字即可",
      ],
      1,
      "值名字不保护物理存储；复用必须等待所有依赖旧值的消费者完成。",
    ],
    limit:
      "简化直线执行区间；异步Stream、条件分支和不同内存空间会增加生命周期约束。",
  }),
  define({
    id: "gpu-layout",
    module: "compiler",
    unit: "storage",
    title: "线程布局与 Layout Conversion",
    goal: "从元素归属推断哪些值需要线程间交换，区分逻辑Shape和执行Layout。",
    why: "布局选择连接张量算法、访存和矩阵指令；相同元素不能凭形状相同就由另一个线程直接读取。",
    prereqs: [
      ["tensor-address", "内存Stride与执行线程归属是两个不同层次。"],
      ["triton-tiling", "Program负责一个Tile之后，还需决定Tile内部归属。"],
    ],
    source: "triton",
    section:
      "Matrix multiplication tutorial：program tiling、memory layout和目标相关优化；四Lane示例为原创。",
    terms:
      "ownership|某个值由哪个线程或寄存器持有;lane|Warp内逻辑线程位置;shuffle|线程间寄存器值交换的一类操作;layout conversion|在保持逻辑值的同时改变执行归属",
    chapters: [
      page(
        "owners",
        "为元素标明持有者",
        "2×2Tile按行与按列持有时，谁必须交换值？",
        "初始Lane0持有00/01，Lane1持有10/11；目标按列持有00/10与01/11。00和11可留在原持有者，01与10必须跨持有者转移。",
      ),
      page(
        "cost",
        "局部变换还是通信",
        "只改变寄存器内排列与跨线程交换，代价为何不同？",
        "同一持有者内的排列不需要向其它线程取值；跨持有者要有目标支持的交换机制。真实编译器可能使用Shuffle、Shared或其它路径，不能从图直接断言最终指令。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>moves</mi><mo>=</mo><mo>∑</mo><mo>[</mo><mi>ownerBefore</mi><mo>≠</mo><mi>ownerAfter</mi><mo>]</mo></mrow>",
    ),
    derive: [
      "2×2有4个逻辑元素，初始按行归属。",
      "改按列后01与10换持有者，共2个跨Lane值。",
      "所有逻辑数值和Shape保持；改变的是可直接读取的位置。",
    ],
    code: "before=[0,0,1,1]\nafter =[0,1,0,1]\nmoves=sum(a!=b for a,b in zip(before,after))\nassert moves==2",
    quiz: [
      "Shape相同，是否足以证明无需Layout Conversion？",
      ["足够", "还要比较元素的实际归属", "只比较总元素数"],
      1,
      "Shape描述逻辑对象，Layout描述对象在执行资源上的分布。",
    ],
    limit:
      "两Lane四元素的所有权模型，不是Triton真实布局编码或某代GPU合法指令映射。",
  }),
  define({
    id: "target-codegen",
    module: "compiler",
    unit: "backend",
    title: "代码生成、寄存器分配与 Spill",
    goal: "区分IR值、虚拟寄存器和有限物理资源，解释溢出为何引入额外访存。",
    why: "高层运算少不保证设备指令或访存少；同时活跃的值可能超过可用寄存器。",
    prereqs: [
      ["buffer-liveness", "寄存器分配同样受值的活跃区间限制。"],
      ["compiler-lowering", "先区分PTX虚拟表示与最终设备代码。"],
    ],
    source: "llvm",
    section:
      "LLVM Code Generator：instruction selection、scheduling、register allocation；NVIDIA最终设备分配还涉及ptxas。",
    terms:
      "instruction selection|把IR操作映射成目标指令;virtual register|尚未绑定有限物理资源的值位置;register allocation|安排同时活跃值使用寄存器;spill|把暂存值放入内存并在需要时重载",
    chapters: [
      page(
        "pressure",
        "同时活跃值怎样竞争",
        "只有2个教学寄存器，3个值同时活跃时会怎样？",
        "图把三个值的活跃区间叠在时间线上。无法全部同时驻留时，编译器要改变安排、重算或溢出；本例固定选择溢出c，展示store与reload。",
      ),
      page(
        "artifact",
        "逐层核对产物",
        "PTX里的名字多，是否就是最终寄存器数量？",
        "高层IR、PTX和SASS属于不同层；值可能合并、重算或被消除。资源判断应使用真实编译报告、二进制及设备Trace，而非数文本变量。",
        { quiz: true },
      ),
      page(
        "tradeoff",
        "融合后的反例",
        "中间全局写回变少，为何可能新增Spill？",
        "融合延长某些值的活跃区间，减少边界物化的同时扩大内部资源需求。比较两个资源账本，区分逻辑中间IO和新增的溢出IO。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>pressure</mi><mo>(</mo><mi>t</mi><mo>)</mo><mo>=</mo><mo>|</mo><mi>liveValues</mi><mo>(</mo><mi>t</mi><mo>)</mo><mo>|</mo></mrow>",
    ),
    derive: [
      "资源上限假设2个槽，时刻2有a/b/c共3个活跃值。",
      "固定将c写到溢出位置，在消费前重载，增加一次写和一次读。",
      "减少高层中间数组不保证这两次额外内存操作不存在；实际需查编译产物。",
    ],
    code: 'live={0:["a"],1:["a","b"],2:["a","b","c"]}\npressure=max(len(v) for v in live.values())\nassert pressure==3\n# 真实分配器还会做合并、调度和重算；不是按此列表机械溢出',
    quiz: [
      "PTX有100个寄存器名字，能否据此报告Kernel用了100个物理寄存器？",
      ["能", "不能，需核对最终分配与编译报告", "只要删掉变量名就能降占用"],
      1,
      "虚拟表示的名字与最终资源分配不是同一个量。",
    ],
    limit:
      "2槽是人为资源模型，未伪造GPU寄存器规格或SASS；LLVM后端与ptxas职责需按目标工具链区分。",
  }),
  define({
    id: "compile-cache",
    module: "compiler",
    unit: "backend",
    title: "JIT、AOT、缓存与运行时派发",
    goal: "追踪一个编译产物的适用条件、缓存命中和真正执行之间的关系。",
    why: "生成代码、持久化产物和按条件调用产物是不同工作；忽略冷启动会误判优化。",
    prereqs: [
      ["symbolic-shapes", "缓存条目不是单纯以函数名区分，而与特化条件相关。"],
      ["runtime-graph", "缓存命中后仍需执行提交与设备工作。"],
    ],
    source: "dynamic",
    section:
      "Dynamic Shapes与编译特化；缓存键图为原创教学结构，不冒充内部完整键。",
    terms:
      "JIT|运行时按需要编译;AOT|运行前准备编译产物;artifact|可加载或调用的编译结果;cache key|区分产物适用条件的标识",
    chapters: [
      page(
        "keys",
        "什么才算同一个缓存项",
        "相同源码但dtype、目标或配置不同，能否无条件复用？",
        "教学键包含源码版本、目标、dtype与Tile配置。改变任何被特化的条件，都不能仅凭相同函数名确认命中；真实系统还可能包含更多上下文。",
      ),
      page(
        "dispatch",
        "从命中到执行",
        "产物已经存在，是否省掉了本轮Kernel执行？",
        "命中省去相应编译工作，仍须检查适用条件、准备地址并启动设备任务。AOT也需要运行时绑定与合法输入，不能理解为没有Runtime。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>T</mi><mi>cold</mi></msub><mo>=</mo><mi>C</mi><mo>+</mo><mi>L</mi><mo>+</mo><mi>E</mi></mrow>",
    ),
    derive: [
      "人为设编译C=100ms、提交L=1ms、执行E=4ms。",
      "冷调用105ms；已命中且条件有效的调用5ms。",
      "AOT把C移到运行前，但L与E仍需发生，成本并未凭空消失。",
    ],
    code: "key=(source_revision,target,dtype,tile)\nif key not in cache:\n    cache[key]=compile_for(key)  # 教学接口名\nassert guards_hold(inputs,key)\nlaunch(cache[key],inputs)",
    quiz: [
      "编译缓存命中以后还需要做什么？",
      [
        "返回缓存的模型输出即可",
        "核对适用条件并执行当前输入",
        "不需要任何设备工作",
      ],
      1,
      "缓存的是程序产物，不是任意新输入对应的模型输出。",
    ],
    limit:
      "JIT/AOT和缓存职责示意；不列举具体框架完整缓存键或承诺不同版本间二进制兼容。",
  }),
  define({
    id: "compiler-evidence",
    module: "compiler",
    unit: "backend",
    title: "编译优化的端到端核验",
    goal: "用一个固定算子建立源码、变换、产物、资源与结果之间的证据链。",
    why: "看到优化Pass名称或理论IO下降，不足以证明目标设备上的改善。",
    prereqs: [
      [
        "graph-rewrite",
        "图优化必须先满足等价条件，才能将产物变化与优化收益建立联系。",
      ],
      [
        "target-codegen",
        "高层IR变量数不等于物理寄存器数，优化证据必须连接真实设备产物。",
      ],
      ["profiling", "Kernel变快只有作用于关键路径的部分才能缩短请求完成时间。"],
    ],
    source: "triton",
    section:
      "官方矩阵乘教程的正确性比较、性能测量与配置；本课证据表为教学构造。",
    terms:
      "parity|在明确误差标准下核对输出;artifact|真实编译生成的文件或表示;counterfactual|只改变目标因素的对照;evidence gap|某个推论缺少直接支撑",
    chapters: [
      page(
        "ledger",
        "每条结论需要什么证据",
        "日志说融合成功，可以直接填上“更快”吗？",
        "分开记录图变化、逻辑IO、真实DRAM、寄存器、Kernel与请求总时间。未知的格子保持未知，不能用上层一项代替所有下层测量。",
      ),
      page(
        "counter",
        "如何区分反例",
        "DRAM下降但总时间不变，下一步该检查哪里？",
        "看Kernel是否在关键路径、提交是否占主导、是否出现Spill或并发变化。教学时间账本保留固定部分，算出局部优化的上限。",
        { formula: true, quiz: true },
      ),
      page(
        "reproduce",
        "从教学例转到实物",
        "别人需要哪些材料才能重现你的结论？",
        "固定源代码提交、输入、dtype、设备、驱动、编译选项、正确性阈值、预热与同步。保存IR/二进制和原始测量，不把页面示意片段冒充真实Dump。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>speedup</mi><mo>=</mo><mfrac><mn>1</mn><mrow><mn>1</mn><mo>−</mo><mi>f</mi><mo>+</mo><mi>f</mi><mo>/</mo><mi>s</mi></mrow></mfrac></mrow>",
    ),
    derive: [
      "端到端10ms，其中目标Kernel占2ms，f=0.2。",
      "即使该Kernel无限快，其余8ms仍在。",
      "整体加速上限10/8=1.25倍；这是串行账本上限，不是实测。",
    ],
    code: "record(version,shape,dtype,device,options)\nassert parity(reference,candidate,tolerance)\nmeasure_cold_and_warm_separately()\nsave(ir,binary,resource_report,raw_times)\n# 测量接口为实验骨架，未执行GPU实验",
    quiz: [
      "目标只占总时间20%，优化后Kernel快10倍，整体必然接近10倍吗？",
      ["是", "不是，串行账本约1/(0.8+0.02)=1.22倍", "必须先增加Batch才能算"],
      1,
      "局部收益要按关键路径上的占比折算；重叠情况还需实际时间线。",
    ],
    limit:
      "此课提供可核验方法及合成反例；本站没有真实GPU编译产物或性能样本，不标记为已完成硬件实验。",
  }),
];
