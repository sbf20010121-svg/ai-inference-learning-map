/** Small, self-contained prerequisite explanations. They do not create course credit. */
import { esc } from "./mechanism-visuals.js";
import { renderTeachingBlocks } from "./teaching-blocks.js";
const p = (text) => ({ type: "p", text });
const math = (label, body, variables, explanation) => ({ type: "math", label, html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${body}</math>`, variables, explanation });

export const learningFoundations = [
  {
    id: "tensors", title: "数、向量、矩阵与张量", aliases: ["张量", "shape", "向量", "矩阵", "维度"],
    blocks: [
      p("一个数称为标量；一列有顺序的数称为向量；按行、列排开的数表称为矩阵。张量把这种有轴的数表推广到更多轴。这里的张量先指逻辑上的数据组织，不自动规定它在内存里的布局。"),
      p("Shape（形状）列出每条轴的长度。例如一个形状为[2,3,4]的张量共有2×3×4=24个数。若三条轴依次表示请求、Token位置、特征，每个请求就有3个位置，每个位置用4个数表示。轴的长度与轴的含义要同时说明。"),
      p("索引从0开始时，[1,2,0]表示第二个请求、第三个位置的第一个特征。后面看到B、S、D时，要先查看它们在本式中代表哪条轴，不要根据字母猜含义。"),
    ],
  },
  {
    id: "matmul", title: "点积与矩阵乘法", aliases: ["矩阵乘", "点积", "gemm", "线性投影"],
    blocks: [
      p("点积把两个等长向量对应的元素相乘，再把乘积加起来。例如[2,1]与[3,4]的点积是2×3+1×4=10。它把多项贡献合成一个数。"),
      p("公式中的下标用来指定元素：Aᵢₖ是A第i行第k列。∑表示把指定索引范围里的各项相加，上下标说明从哪里开始、到哪里结束。先固定输出的i、j，再让k依次变化，就可以逐项读懂下面的公式。"),
      math("矩阵乘法的一个输出元素", '<mrow><msub><mi>C</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub><mo>=</mo><munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow><mrow><mi>K</mi><mo>−</mo><mn>1</mn></mrow></munderover><msub><mi>A</mi><mrow><mi>i</mi><mi>k</mi></mrow></msub><msub><mi>B</mi><mrow><mi>k</mi><mi>j</mi></mrow></msub></mrow>', [["A、B、C", "输入矩阵形状分别为M×K、K×N，输出形状为M×N。"], ["i、j", "指定输出的行与列。"], ["k、K", "k沿共同的中间轴遍历，K是这条轴的长度。"]], "C的第i行第j列，是A的第i行与B的第j列做点积。两个输入的中间轴必须兼容；这条轴在求和后消失。线性投影就是利用权重矩阵，将输入特征按不同权重组合为新特征。"),
    ],
  },
  {
    id: "transpose", title: "转置与向量方向", aliases: ["转置", "行向量", "列向量"],
    blocks: [
      p("矩阵转置交换行与列：原来第i行第j列的元素，成为转置后第j行第i列的元素。上标T表示这个操作，不是时间次序。一个D×1的列向量转置后成为1×D的行向量。"),
      p("数学里的转置只描述元素对应关系。程序里能否只修改视图元数据，还是需要实际重排存储，要看布局及后续算子的要求。推导公式时先核对形状，再讨论设备是否搬运数据。"),
    ],
  },
  {
    id: "outer-product", title: "外积为何生成一个矩阵", aliases: ["外积", "秩一"],
    blocks: [
      math("两个列向量的外积", '<mrow><mi>M</mi><mo>=</mo><mi>k</mi><msup><mi>v</mi><mi>T</mi></msup><mo>,</mo><mspace width="0.6em"/><msub><mi>M</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub><mo>=</mo><msub><mi>k</mi><mi>i</mi></msub><msub><mi>v</mi><mi>j</mi></msub></mrow>', [["k、v", "长度分别为K、V的列向量。"], ["M", "形状为K×V的矩阵；Mᵢⱼ是第i行第j列的元素。"], ["T", "转置，使v从列向量变成行向量。"]], "外积没有把共同轴求和消去，而是保留两条轴。例如k=[1,2]ᵀ、v=[3,4]ᵀ时，M的两行是[3,4]和[6,8]。每行都是v的一个倍数。外积与得到一个数的点积有不同的输出形状。"),
    ],
  },
  {
    id: "functions", title: "函数、线性与仿射变换", aliases: ["仿射", "线性变换", "非线性", "函数"],
    blocks: [
      p("函数给定输入，按规则得到输出。线性变换保持加法和数乘的组合关系，矩阵乘向量是常见例子。仿射变换在线性结果上再加一个偏移，例如y=Ax+b。两次仿射变换能组合，但先后次序通常不能交换。"),
      p("非线性操作不满足上述线性组合规则，例如把负数截为0。神经网络在矩阵变换之间加入非线性，使多层计算能够表示单个线性变换无法表示的关系。公式中的操作顺序决定最终函数，不能只看符号是否相同。"),
    ],
  },
  {
    id: "reduce", title: "逐元素运算与沿轴归约", aliases: ["逐元素", "归约", "reduction", "reduce", "均值", "方差"],
    blocks: [
      p("逐元素运算分别处理对应位置，例如两组同形状数组相加，通常保留原来的各条轴。归约把某条轴上的多个元素合成一个结果，例如求和、最大值或均值；必须说明归约的是哪条轴。"),
      math("同一组数的均值与方差", '<mrow><mi>μ</mi><mo>=</mo><mfrac><mn>1</mn><mi>N</mi></mfrac><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>N</mi></munderover><msub><mi>x</mi><mi>i</mi></msub><mo>,</mo><mspace width="0.6em"/><msup><mi>σ</mi><mn>2</mn></msup><mo>=</mo><mfrac><mn>1</mn><mi>N</mi></mfrac><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>N</mi></munderover><msup><mrow><mo>(</mo><msub><mi>x</mi><mi>i</mi></msub><mo>−</mo><mi>μ</mi><mo>)</mo></mrow><mn>2</mn></msup></mrow>', [["N、xᵢ", "当前归约组的元素个数及第i个元素，本式从1编号。"], ["μ、σ²", "这组数的均值及总体方差。"]], "均值描述中心，方差描述偏离中心的平方距离。对[1,3]，均值是2，方差是((1−2)²+(3−2)²)/2=1。不能把别的请求、别的行混入同一组，除非公式本来要求如此。"),
    ],
  },
  {
    id: "probability", title: "概率分布与一次采样", aliases: ["概率", "采样", "随机数", "分布"],
    blocks: [
      p("离散概率分布为每个候选分配非负概率，全部概率之和为1。例如三个候选的概率为0.2、0.5、0.3。概率描述重复试验的分布，一次抽到概率较小的候选并不违背这个分布。"),
      p("采样可以把[0,1)划成长度分别为0.2、0.5、0.3的区间，再取一个均匀随机数。0.63落在第二个区间[0.2,0.7)，所以这次选第二个候选。固定分布只固定抽样规则；还要固定随机数等条件，才可复现同一次结果。"),
    ],
  },
  {
    id: "exponential", title: "指数、自然对数与比例", aliases: ["指数", "自然对数", "对数", "ln", "exp"],
    blocks: [
      p("指数函数eˣ把实数x映射为正数，e约为2.718。x增大时eˣ增大；输入相差一个固定量，对应输出就相差一个固定倍数。自然对数ln是它的逆运算：ln2是满足eˣ=2的那个x，约为0.693。"),
      math("共同平移分数为什么保持比例", '<mrow><mfrac><msup><mi>e</mi><mrow><mi>a</mi><mo>−</mo><mi>m</mi></mrow></msup><msup><mi>e</mi><mrow><mi>b</mi><mo>−</mo><mi>m</mi></mrow></msup></mfrac><mo>=</mo><msup><mi>e</mi><mrow><mi>a</mi><mo>−</mo><mi>b</mi></mrow></msup><mo>=</mo><mfrac><msup><mi>e</mi><mi>a</mi></msup><msup><mi>e</mi><mi>b</mi></msup></mfrac></mrow>', [["a、b", "两个实数分数。"], ["m", "从所有分数共同减去的基准。"], ["e", "自然指数的底数；指数结果始终为正。"]], "共同减去m等于把每个指数值都乘上e⁻ᵐ，因此分子分母的共同倍数会约掉。Softmax使用这个关系控制中间数值大小，在线Softmax用它把不同块的贡献换到同一个基准。"),
    ],
  },
  {
    id: "softmax", title: "Logits、指数与Softmax", aliases: ["logit", "softmax", "温度", "指数"],
    blocks: [
      p("Logit是模型为候选给出的分数，可以为负，也不要求总和为1。指数函数把分数变成正权重；Softmax再除以全部候选权重之和，得到概率。"),
      math("从分数得到概率", '<mrow><msub><mi>p</mi><mi>i</mi></msub><mo>=</mo><mfrac><msup><mi>e</mi><mrow><mo>(</mo><msub><mi>z</mi><mi>i</mi></msub><mo>−</mo><mi>m</mi><mo>)</mo><mo>/</mo><mi>T</mi></mrow></msup><mrow><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mi>V</mi></munderover><msup><mi>e</mi><mrow><mo>(</mo><msub><mi>z</mi><mi>j</mi></msub><mo>−</mo><mi>m</mi><mo>)</mo><mo>/</mo><mi>T</mi></mrow></msup></mrow></mfrac></mrow>', [["zᵢ、pᵢ", "候选i的分数及归一化后概率。"], ["V、j", "候选总数及遍历候选的索引。"], ["T", "正的温度参数，改变分数差异的影响。"], ["m", "所有分数的最大值；共同减去它不改变比值，有助于数值稳定。"], ["e", "自然指数的底数。"]], "各候选共同除以同一个分母，概率才可相加为1。所有分数相同就得到均匀分布。筛掉候选后若要再次形成概率分布，必须核对分母属于哪个候选集合。"),
    ],
  },
  {
    id: "gradients", title: "训练目标、导数与梯度", aliases: ["梯度", "导数", "损失", "训练", "反向传播"],
    blocks: [
      p("训练用一个损失函数衡量模型输出与训练目标的差异，再调整模型参数。推理使用给定参数计算输出，通常不执行这次参数更新。模型在推理时更新的KV或递推状态，也不等于在更新模型权重。"),
      p("导数描述一个量变化时函数局部如何变化。只改变一个参数、固定其余参数时求出的导数称为偏导数；多个参数的偏导数组成梯度。链式法则把连续变换的局部影响相乘，例如权重先影响预测，预测再影响损失。反向传播沿这些依赖计算各参数对损失的影响。"),
      math("沿损失下降的方向更新一次权重", '<mtable columnalign="left"><mtr><mtd><mrow><mi>y</mi><mo>=</mo><mi>w</mi><mi>x</mi><mo>,</mo><mspace width="0.6em"/><mi>L</mi><mo>=</mo><msup><mrow><mo>(</mo><mi>y</mi><mo>−</mo><mn>3</mn><mo>)</mo></mrow><mn>2</mn></msup></mrow></mtd></mtr><mtr><mtd><mrow><mfrac><mrow><mi>d</mi><mi>L</mi></mrow><mrow><mi>d</mi><mi>w</mi></mrow></mfrac><mo>=</mo><mn>2</mn><mo>(</mo><mi>y</mi><mo>−</mo><mn>3</mn><mo>)</mo><mi>x</mi></mrow></mtd></mtr><mtr><mtd><mrow><msub><mi>w</mi><mtext>new</mtext></msub><mo>=</mo><mi>w</mi><mo>−</mo><mi>η</mi><mfrac><mrow><mi>d</mi><mi>L</mi></mrow><mrow><mi>d</mi><mi>w</mi></mrow></mfrac></mrow></mtd></mtr></mtable>', [["x、w、y", "输入、待训练权重和预测，本例都是标量。"], ["3、L", "训练目标为3，L是预测与目标差的平方。"], ["dL/dw", "损失对权重的导数：权重略增时损失的局部变化率。"], ["η", "正的学习率，控制一次更新沿这个方向走多远。"]], "取x=2、w=1，预测y=2、损失L=1。导数为2×(2−3)×2=−4，说明小幅增加w会降低损失。取η=0.1，更新后w=1.4，预测2.8、损失0.04。步长过大未必降低损失；这个例子说明更新依据，不代表复杂训练总能一步改善。"),
    ],
  },
  {
    id: "token", title: "文本、Token与隐藏向量", aliases: ["token", "分词", "embedding", "隐藏向量", "隐藏状态"],
    blocks: [
      p("Tokenizer按一套规则把文本编码成Token ID序列。Token可能对应字、词片段、符号或其它编码单元，不能普遍当成一个汉字或一个单词。ID是词表中的编号，编号大小本身不是语义距离。"),
      p("Embedding用ID查出一行向量，模型层再不断变换这些向量。隐藏向量指模型内部的数值表示，和用户看到的文字不是同一对象。输出头给出候选Token分数，采样选出ID，再按Tokenizer规则解码回文本。"),
    ],
  },
  {
    id: "recurrence", title: "递推、状态与展开", aliases: ["递推", "状态更新", "门控"],
    blocks: [
      p("递推用上一步留下的状态处理新输入。例如累计和把旧和s与新数x相加，得到新和：读入2、3、1时，状态依次为2、5、6。状态是为后续计算保留的摘要，输出则是当前要交给下一层或用户的结果；两者可以不同。"),
      p("把前一步状态的表达式代入下一步，并反复进行，称为展开递推。累计和展开后就是把之前的数全部相加，但一般的状态更新未必能改写为可并行的求和，必须检查具体更新规则。门控给某项旧状态或新输入乘一个可变化的系数，用来控制其保留与写入程度。"),
      p("固定大小状态并不自动保留历史的每个细节。例如累计和为6，不能判断此前是2+3+1还是1+5。讨论模型状态时，要明确它保留了什么关系、舍弃了什么，以及当前输出怎样读取它。"),
    ],
  },
  {
    id: "state", title: "模型参数、运行状态与缓存", aliases: ["运行状态", "kv", "cache", "缓存", "模型参数"],
    blocks: [
      p("模型参数是训练得到的权重；运行状态是处理当前输入时需要保留的信息。两条请求可以共享同一份模型权重，却需要各自正确的进度与状态。缓存保存以后还会用到的结果，避免从头重新计算。"),
      p("在常见自回归Attention中，KV缓存保存已经计算位置的Key和Value向量，供后续位置读取。一个输出Token刚被采样出来，并不意味着它已经再次经过模型计算，也不意味着它自己的KV已经存在。状态的含义必须由对应机制定义，不能把所有固定大小状态都当成KV缓存。"),
    ],
  },
  {
    id: "address", title: "索引、地址与Stride", aliases: ["stride", "offset", "索引", "地址", "连续布局"],
    blocks: [
      p("逻辑索引回答“数组里的第几个元素”，存储地址回答“这个元素放在哪里”。Stride是某条逻辑轴增加1时，存储偏移增加多少。单位可能是元素，也可能是字节，必须看接口约定。"),
      p("一个2×3的行主序矩阵，元素Stride为[3,1]。坐标(1,2)对应元素偏移1×3+2×1=5；若每元素2字节，就在起始地址之后10字节。转置视图可改变Shape与Stride而共享底层数据，真正的数据搬运要另行判断。"),
    ],
  },
  {
    id: "gpu", title: "GPU中的线程、Warp、CTA与SM", aliases: ["warp", "cta", "thread block", "sm", "gpu", "设备线程"],
    blocks: [
      p("在CUDA编程模型中，一个Kernel启动一批设备线程。线程组成Thread Block，也常称CTA；整个启动的线程块集合称Grid。线程块在GPU的SM（流多处理器）上执行，块内可使用共享内存与相应的同步机制。"),
      p("在这里讨论的NVIDIA CUDA GPU上，Warp是32个线程组成的执行分组。分支或边界条件可使其中部分Lane不参与某条指令。一个线程块可含多个Warp；已驻留的Warp也可能因数据或同步依赖而暂时不能发射指令。"),
      p("这几层有不同职责：Grid描述一次启动的工作集合，Block描述协作范围，Warp关系到指令执行分组，SM是实际硬件资源。逻辑线程数量不等于同一时刻都在执行。"),
    ],
  },
  {
    id: "memory", title: "寄存器、Shared与设备显存", aliases: ["寄存器", "shared", "hbm", "显存", "存储层"],
    blocks: [
      p("寄存器通常保存线程正在使用的值；Shared Memory是线程块内可协作访问的片上存储；设备全局内存提供较大的容量，常承载权重、激活和持久状态。缓存是硬件管理的重用机制，不能与程序显式管理的Shared Memory混为一谈。"),
      p("数据从哪来、会被用几次、由谁持有，决定是否值得搬到更近的存储。更大的Tile可能增加重用，也可能占用更多寄存器或Shared，减少同时驻留的工作。不能只凭“更快的存储”推出整个Kernel一定更快。"),
    ],
  },
  {
    id: "dependency", title: "依赖、同步、异步与并行", aliases: ["依赖", "同步", "异步", "并行", "完成事件"],
    blocks: [
      p("若操作B需要A的结果，B消费数据前必须等待A产生可用结果，这就是数据依赖。并行意味着不同工作可以同时推进；异步表示发起调用后，调用方不必在原地等到工作完成。异步调用本身不保证设备上的工作已经重叠。"),
      p("同步用于保证所需的顺序与可见性。只有等相关访问确实完成，缓冲区才能安全复用或释放。比较实现时应同时看提交时刻、真实开始与结束、结果可用时刻，不能把“已经发起”当成“已经完成”。"),
    ],
  },
  {
    id: "process", title: "进程、线程、Host与Device", aliases: ["进程", "主机线程", "host", "device", "worker"],
    blocks: [
      p("进程是操作系统管理资源与地址空间的重要单位；同一进程里的CPU线程通常共享该进程的内存，但各有执行进度。多线程读写同一对象时，需要正确协调顺序和生命周期。"),
      p("GPU程序中Host通常指CPU侧，Device指设备侧。CPU线程可调用运行时提交GPU工作，但这和GPU Kernel里的大量设备线程不是同一层线程。框架里的Worker是一种职责划分，是否对应进程、线程或远程执行单元，要看具体实现。"),
    ],
  },
  {
    id: "performance", title: "延迟、吞吐与观察边界", aliases: ["延迟", "吞吐", "ttft", "itl", "slo", "时间线"],
    blocks: [
      p("延迟是一个对象从指定起点到指定终点花了多久；吞吐是在一个时间窗口内完成多少工作。必须先定义起终点、工作单位和统计范围。单个Kernel变快，并不自动意味着请求总等待时间按同比例缩短。"),
      p("生成服务常区分首个Token等待时间TTFT，以及相邻输出之间的时间间隔ITL。SLO是服务期望满足的目标，例如某比例请求的延迟不超过阈值。平均值可能掩盖少数很慢的请求，因此还需要关注分位数与负载条件。"),
      p("图上的请求顺序、Token数或合成节拍只能说明模型内的关系。真实毫秒数需要设备、模型、输入和测量边界明确的实验；不能用格子的数量代替耗时。"),
    ],
  },
  {
    id: "units", title: "元素、字节、FLOPs与带宽", aliases: ["字节", "flop", "带宽", "算术强度", "dtype", "数据类型"],
    blocks: [
      p("元素数描述有多少个数；字节数还取决于每个数的存储格式。例如1024个16位元素占2048字节，即2KiB。KiB按1024字节计算，KB常按1000字节计算；比较数据时要统一单位。"),
      math("把运算和数据量放到同一尺度", '<mrow><mi>I</mi><mo>=</mo><mfrac><mi>F</mi><mi>D</mi></mfrac><mo>,</mo><mspace width="0.6em"/><mi>t</mi><mo>≥</mo><mo>max</mo><mo>(</mo><mfrac><mi>F</mi><mi>P</mi></mfrac><mo>,</mo><mfrac><mi>D</mi><mi>W</mi></mfrac><mo>)</mo></mrow>', [["F、D", "按明确口径统计的浮点运算次数FLOPs和经过所分析存储边界的字节数。"], ["I", "算术强度，单位FLOP/字节。"], ["P、W", "该分析所用的算力上限（FLOP/秒）和带宽上限（字节/秒）。"], ["t", "执行时间；右侧是理想资源下界，不是精确预测。"]], "做同样的运算却减少跨这个存储边界的搬运，算术强度会提高。但实际执行还有依赖、调度、启动、访问效率等成本。所选P、W及D必须对应相同设备、精度和存储层。"),
    ],
  },
  {
    id: "compiler", title: "编译器、IR与运行时", aliases: ["编译器", "中间表示", "ir", "ssa", "runtime"],
    blocks: [
      p("编译器把一种程序表示变换为另一种，尽量保持约定的计算语义，并使目标设备能够高效执行。IR是中间表示：它用明确的操作、值、类型和关系描述程序，便于分析与变换。不同IR保留的信息不同。"),
      p("SSA是一种给每次产生的值独立身份的表示方式：同一源变量再次赋值，并不会覆盖此前那个值的身份。运行时则负责在执行时选择产物、绑定输入、管理资源和提交工作。编译得到代码与代码已经在GPU上完成执行，是不同阶段。"),
    ],
  },
  {
    id: "coordinates", title: "机器人中的坐标、单位与动作", aliases: ["坐标", "姿态", "动作", "本体状态"],
    blocks: [
      p("同一个物理点可在不同坐标系下有不同数字。位置向量必须说明相对哪个原点、沿哪几条轴、用什么单位。旋转描述方向关系，平移描述原点偏移；变换方向写反，数值即使合理也可能对应错误位置。"),
      p("动作还要说明是目标位置、位移、速度、关节量还是其它命令，以及相对当前状态还是固定基准。模型输出一串数以后，只有解释成控制器约定的单位、坐标、时间步和范围，才能正确执行。预测未来动作与实时测量当前状态也不能混用。"),
    ],
  },
];

export function foundationForTerm(term) {
  const normalized = String(term).toLowerCase();
  const candidates = learningFoundations.flatMap((item) => item.aliases.map((alias) => ({ item, alias })));
  return candidates.sort((a, b) => b.alias.length - a.alias.length).find(({ alias }) => alias.length > 2 ? normalized.includes(alias) : new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, "i").test(normalized))?.item;
}

export function foundationExpansion(term, namespace) {
  const item = foundationForTerm(term);
  if (!item) return "";
  return `<details class="learning-prerequisite-more" id="${esc(namespace)}-${item.id}"><summary>补充理解：${esc(item.title)}</summary><div class="learning-prose">${renderTeachingBlocks(item.blocks, null, `${namespace}-${item.id}`)}</div></details>`;
}

export function foundationsGuideHTML() {
  return `<details class="learning-foundations-guide"><summary>基础速查：数学对象、程序表示与执行概念</summary><p>需要哪个概念就补哪个。这里不计课程进度，也不要求先读完所有条目。</p><div>${learningFoundations.map((item) => `<details class="learning-foundation-item"><summary>${esc(item.title)}</summary><div class="learning-prose">${renderTeachingBlocks(item.blocks, null, `foundation-${item.id}`)}</div></details>`).join("")}</div><p class="learning-foundation-sources">进一步核对：<a href="https://docs.pytorch.org/docs/stable/tensor_view.html" target="_blank" rel="noopener">PyTorch 张量视图</a> · <a href="https://mlir.llvm.org/docs/LangRef/" target="_blank" rel="noopener">MLIR 语言参考</a> · <a href="https://docs.nvidia.com/cuda/archive/13.0.0/cuda-c-programming-guide/index.html" target="_blank" rel="noopener">CUDA 编程模型</a>。本页数学小例子为说明关系而选取。</p></details>`;
}
