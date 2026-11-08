import { define, page, math } from "./foundation-lessons.js";
export const interfaceCourses = [
  define({
    id: "engine-build",
    module: "compiler",
    unit: "backend",
    title: "ONNX、Engine 构建与动态Profile",
    goal: "分清可交换模型图、目标Engine与运行Execution Context，并检查动态输入范围。",
    why: "导出模型成功不等于目标设备上已构建可执行程序；符号维也需要后端可实现的约束。",
    prereqs: [
      ["symbolic-shapes", "符号维不是无限制输入，构建和执行都要检查相应条件。"],
      ["backend-dispatch", "算子支持、dtype和插件影响可构建路径。"],
    ],
    source:
      "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dynamic-shapes.html",
    section:
      "TensorRT Dynamic Shapes：optimization profile、min/opt/max与执行时形状；ONNX为模型交换层，不等同Engine。",
    terms:
      "ONNX|表达模型图、张量类型和算子约定的交换格式;engine|针对目标和配置构建的执行产物;optimization profile|为动态输入指定有效范围及优化形状;execution context|绑定运行时形状与执行状态的对象;plugin|为特定操作提供后端扩展实现的机制",
    chapters: [
      page(
        "export",
        "交换图和目标产物",
        "含符号Batch的图，是否已经决定了所有设备Kernel？",
        "交换图记录算子语义与接口，后端仍要检查支持、精度和目标并选择实现。图中的常量权重和运行输入要分开；未支持操作不能靠文件格式自动获得实现。",
      ),
      page(
        "profile",
        "min/opt/max分别约束什么",
        "范围B=1..8、opt=4时，B=6能否是合法输入？",
        "可以在本例范围内，但还需满足其它维关系和运行约束。opt是优化参考形状，不是唯一合法形状；B=16则越出本Profile。",
        { formula: true, quiz: true },
      ),
      page(
        "runtime",
        "构建之后如何执行",
        "Engine已经生成，为什么还要设置当前Shape和绑定缓冲？",
        "构建产物不包含每个新请求的输入值。执行上下文要使用相容Profile、运行形状和有效缓冲，并满足所需完成与生命周期；序列化文件也不能无条件跨硬件/版本搬用。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>B</mi><mo>∈</mo><mo>[</mo><mn>1</mn><mo>,</mo><mn>8</mn><mo>]</mo><mo>∧</mo><mi>H</mi><mo>=</mo><mn>4</mn></mrow>",
    ),
    derive: [
      "教学Profile：min B=1、opt B=4、max B=8，隐藏维固定4。",
      "输入[6,4]满足范围；[16,4]不满足。",
      "[6,8]虽Batch合法，但固定隐藏维失败；一个条件通过不等于整个输入合法。",
    ],
    code: "def in_profile(B,H): return 1<=B<=8 and H==4\nassert in_profile(6,4)\nassert not in_profile(16,4) and not in_profile(6,8)\n# 这里只验证Profile条件，未构建TensorRT Engine",
    quiz: [
      "opt B=4，范围1..8，是否只能运行B=4？",
      ["是", "不是，opt与合法范围含义不同", "可以运行所有正B"],
      1,
      "min/max界定本例有效范围，opt提供优化参考；其它关系和实际后端条件仍须满足。",
    ],
    limit:
      "Profile与交换/构建/执行职责示意；未导出真实ONNX、构建Engine或验证具体插件/版本兼容。",
  }),
  define({
    id: "lowbit-formats",
    module: "kernel",
    unit: "numeric-kernels",
    title: "FP8、FP4 的数值网格与块Scale",
    goal: "由明确格式的可表示值比较精度和范围，并区分格式本身与分组Scale。",
    why: "位宽相同不代表相同数值集合，块Scale又会进一步改变可覆盖范围；不能统一叫作INT量化。",
    prereqs: [
      [
        "quant-pipeline",
        "低比特格式规定可表示码值，外部Scale再改变还原网格及截断范围。",
      ],
      ["quantized-matmul", "Scale需要与实际分组及运算对应。"],
    ],
    source:
      "https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-quantized-types.html",
    section:
      "TensorRT量化类型与Scale；只显示E4M3/E5M2在[1,2)的正规数网格及E2M1有限值，不冒充所有块格式。",
    terms:
      "E4M3/E5M2|两种常见FP8指数/尾数位数划分;E2M1|此处FP4值集合使用的格式;mantissa precision|同一指数区间内的有效分辨率;block scale|同一组值共享的外部缩放参数;normal/subnormal|正规/次正规数的不同编码区域",
    chapters: [
      page(
        "fp8",
        "同一指数区间有多少格",
        "在[1,2)内，3尾数位与2尾数位的间距怎样不同？",
        "正规数在这个区间的步长分别1/8与1/4。x=1.12的最近值分别1.125与1；这是局部精度比较，不能由此概括全部动态范围。",
        { formula: true },
      ),
      page(
        "fp4",
        "E2M1的正值集合",
        "为什么0到6之间的E2M1正值不是等间距整数？",
        "本图用[0,0.5,1,1.5,2,3,4,6]及符号镜像；高区间间距增大。观察同一个样本落到哪个可表示值，不将其当作INT4统一网格。",
      ),
      page(
        "scale",
        "格式和Scale共同决定范围",
        "最大正码值6，Scale为0.25与0.5时，可还原最大值各多少？",
        "上限分别1.5与3。样本2在前者被截断，在后者可以由码值4精确还原；覆盖范围与小值分辨率都随Scale变化。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>Δ</mi><mrow><mo>[</mo><mn>1</mn><mo>,</mo><mn>2</mn><mo>)</mo></mrow></msub><mo>=</mo><msup><mn>2</mn><mrow><mo>−</mo><mi>m</mi></mrow></msup></mrow>",
    ),
    derive: [
      "正规数区间[1,2)的尾数位m=3时Δ=0.125，m=2时Δ=0.25。",
      "x=1.12，最近网格值分别1.125和1.0，误差0.005和0.12。",
      "E2M1乘Scale0.25时最大1.5，乘0.5时最大3；块格式的Scale编码另有规定。",
    ],
    code: "levels=[0,.5,1,1.5,2,3,4,6]\ndef nearest(x,scale):\n q=min(levels,key=lambda q:abs(x-scale*q))\n return scale*q\nassert nearest(2,.25)==1.5 and nearest(2,.5)==2",
    quiz: [
      "E2M1外部Scale从0.25变0.5，可还原最大正值会怎样？",
      ["仍为6，Scale不影响数值", "从1.5变3", "所有值都自动更精确"],
      1,
      "还原值是格式数值乘Scale；范围扩大并不意味着每个小值误差都变小。",
    ],
    limit:
      "只比较明确局部网格与E2M1值集合，不覆盖特殊值、全部编码与舍入模式；NVFP4/MXFP4的分组及Scale层级不能由本图替代。",
  }),
  define({
    id: "convolution-lowering",
    module: "kernel",
    unit: "matrix-kernels",
    title: "卷积窗口、Stride、Padding 与 GEMM",
    goal: "把卷积输出坐标对应到真实输入窗口，并解释im2col怎样组织相同乘积。",
    why: "视觉编码可能用卷积或Patch投影；只知道GEMM名称不足以解释窗口采样、边界和通道累加。",
    prereqs: [
      ["vision-patches", "Patch切分与重叠卷积窗口的关系需要明确Stride。"],
      ["gemm-tiling", "窗口展平后可用矩阵乘表达对应乘积。"],
    ],
    source:
      "https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html",
    section:
      "Conv2d输入输出、stride/padding/dilation与互相关定义；本例单通道、dilation1。",
    terms:
      "kernel window|一次输出使用的局部输入范围;stride|相邻输出窗口起点移动的距离;padding|按约定在输入边界外补充值;im2col|把各窗口展平为矩阵行的表示;cross-correlation|不翻转Kernel的窗口乘加，深度学习Conv常用此约定",
    chapters: [
      page(
        "window",
        "一个输出使用哪些像素",
        "4×4输入、2×2Kernel、Stride1时，输出(1,1)读哪四格？",
        "起点是输入(1,1)，读取(1,1)/(1,2)/(2,1)/(2,2)。图高亮实际窗口与对应Kernel权重，按元素相乘后求和。",
        { formula: true },
      ),
      page(
        "stride",
        "Stride改变哪些窗口",
        "Stride从1改2，为什么输出从3×3变2×2？",
        "窗口起点由0/1/2改为0/2。它减少输出坐标集合，不只是把已有输出显示得更稀；Padding则会改变可取窗口边界。",
      ),
      page(
        "im2col",
        "窗口怎样变矩阵乘",
        "展平后每一行代表什么，为什么会重复输入值？",
        "每行是一个输出位置的窗口，Kernel展平成列，矩阵乘得到各位置输出。重叠窗口导致相同输入被多次表示，真实实现未必物化整个im2col。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>H</mi><mi>out</mi></msub><mo>=</mo><mo>⌊</mo><mfrac><mrow><mi>H</mi><mo>+</mo><mn>2</mn><mi>P</mi><mo>−</mo><mi>K</mi></mrow><mi>S</mi></mfrac><mo>⌋</mo><mo>+</mo><mn>1</mn></mrow>",
    ),
    derive: [
      "H=4、K=2、P=0、S=1，输出边长floor((4−2)/1)+1=3。",
      "S=2时输出边长2；窗口起点0与2。",
      "输入0..15按行排，窗口(1,1)=[5,6,9,10]，Kernel[1,0,0,1]得到15。",
    ],
    code: "image=[[4*r+c for c in range(4)] for r in range(4)]\nwindow=[image[1+i][1+j] for i in range(2) for j in range(2)]\ny=sum(a*b for a,b in zip(window,[1,0,0,1]))\nassert y==15",
    quiz: [
      "im2col图中一个输入值出现在多行，是否一定表示实际Kernel写了多份副本？",
      ["一定", "不一定，逻辑表达与是否物化不同", "说明卷积公式错误"],
      1,
      "im2col可作为数学表示；具体实现可直接读取窗口或用其它隐式计算。",
    ],
    limit:
      "单通道2×2、无dilation的互相关；多通道/分组卷积、真实Tensor Core布局与性能未由此例完成。",
  }),
];
