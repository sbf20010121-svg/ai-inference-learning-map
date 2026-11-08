import { define, page, math } from "./foundation-lessons.js";
export const embodiedCourses = [
  define({
    id: "observation-contract",
    module: "model",
    unit: "robot-interface",
    title: "观测接口：时间戳、坐标系与本体状态",
    goal: "明确策略收到的图像、状态和坐标属于哪个时刻与参考系，避免把不一致观测拼成同一输入。",
    why: "模型张量Shape正确不代表物理含义正确；错误时间或坐标会沿整个动作链传播。",
    prereqs: [
      ["multimodal-bridge", "跨模态接口除隐藏维外，还有真实时间与空间语义。"],
    ],
    source: "ros",
    section:
      "tf2的坐标变换与随时间变化的参考系；时间配对例为本课构造，非ROS同步器默认策略。",
    terms:
      "timestamp|观测对应的采集时间，不一定是接收时间;reference frame|坐标向量所参照的空间基准;extrinsic transform|不同参考系间的旋转与平移;proprioception|关节、速度等机器人本体状态",
    chapters: [
      page(
        "time",
        "收到的最新帧是否同一时刻",
        "相机t=80ms、关节t=100ms，能否直接称为t=100ms同步观测？",
        "图分别标采集、到达和推理时间。20ms差值是观测不对齐，不是模型推理延迟；可以按策略配对、插值或拒绝，但要保留假设。",
      ),
      page(
        "frame",
        "同一个点怎样换参考系",
        "相机坐标[1,0]经过90°旋转和平移[1,2]后在哪里？",
        "先旋转成[0,1]，再平移得到世界坐标[1,3]。图保留两个坐标轴和同一物理点，避免把坐标数字直接复制到控制端。",
        { formula: true, code: true },
      ),
      page(
        "contract",
        "部署时核对什么",
        "位置单位、相机顺序和归一化统计错了，Shape还能正常吗？",
        "同形状输入可能包含不同含义。逐项核对传感器顺序、单位、参考系、时间窗口和训练预处理；这些是模型接口的一部分。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msup><mi>p</mi><mi>world</mi></msup><mo>=</mo><mi>R</mi><msup><mi>p</mi><mi>camera</mi></msup><mo>+</mo><mi>t</mi></mrow>",
    ),
    derive: [
      "二维教学旋转R=[[0,−1],[1,0]]，相机点[1,0]。",
      "旋转后[0,1]；加入平移[1,2]得[1,3]。",
      "若误当同一参考系直接使用[1,0]，位置错误；二维例不代替真实3D标定。",
    ],
    code: "p=[1,0]; R=[[0,-1],[1,0]]; t=[1,2]\nworld=[sum(R[i][j]*p[j] for j in range(2))+t[i] for i in range(2)]\nassert world==[1,3]",
    quiz: [
      "观测Shape完全匹配，是否足以证明可直接接入策略？",
      ["足够", "还需核对单位、时刻、坐标与预处理", "只要分辨率相同就足够"],
      1,
      "Shape是结构约束，物理接口还包括语义与时间。",
    ],
    limit:
      "二维刚体变换与手工时间配对；未执行标定、运动学或机器人控制，实际3D变换和同步按系统约定验证。",
  }),
  define({
    id: "action-representation",
    module: "model",
    unit: "robot-interface",
    title: "动作表示、相对基准与归一化",
    goal: "把模型输出还原为有明确基准和单位的动作，区分绝对目标、相对轨迹与逐步增量。",
    why: "同一个动作数组可能表达完全不同的控制目标；预处理与后处理必须互为一致变换。",
    prereqs: [
      [
        "observation-contract",
        "相对动作的锚点属于指定时刻和坐标系，解码时任意换锚点会改变目标。",
      ],
      ["vla-policy", "动作块是多步向量，不只是一个模型调用结果。"],
    ],
    source: "robot",
    section:
      "LeRobot Action Representations：absolute、relative、delta及normalize顺序；示例为单维位置。",
    terms:
      "absolute target|直接给出目标坐标;relative trajectory|所有未来目标相对同一锚点的偏移;incremental delta|每步相对前一步的增量;normalization|按约定统计量缩放数值;anchor|定义相对量的参考状态",
    chapters: [
      page(
        "anchor",
        "相对谁计算",
        "目标[10,11,12]、固定锚点10，相对轨迹为何是[0,1,2]？",
        "每个未来目标都减同一个锚点10。若采用逐步差分则可能得到[0,1,1]，两种数组不能用同一种解码方式解释。",
        { formula: true },
      ),
      page(
        "normalize",
        "先还原哪一层变换",
        "模型预测的标准化相对值怎样回到绝对目标？",
        "教学顺序先相对转换再归一化；反向必须先反归一化再加锚点。均值和Scale属于训练接口，不可用当前动作块随意重算。",
        { code: true },
      ),
      page(
        "late",
        "返回时锚点已经变了怎么办",
        "推理基于旧状态10，返回时状态11，能否悄悄改用11解码？",
        "会改变目标轨迹。是否重新锚定需要策略训练和执行约定支持，不能把“相对动作”自动理解为可随意绑定最新状态。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>a</mi><mi>abs</mi></msub><mo>=</mo><mi>anchor</mi><mo>+</mo><mi>μ</mi><mo>+</mo><mi>σ</mi><msub><mi>a</mi><mi>norm</mi></msub></mrow>",
    ),
    derive: [
      "固定锚点10，绝对目标[10,11,12]变相对[0,1,2]。",
      "μ=1、σ=2，标准化得到[−0.5,0,0.5]。",
      "反归一化恢复[0,1,2]，再加10恢复原目标；改用11会整体平移成[11,12,13]。",
    ],
    code: "absolute=[10,11,12]; anchor=10; mu=1; sigma=2\nnormalized=[((a-anchor)-mu)/sigma for a in absolute]\nrestored=[anchor+mu+sigma*z for z in normalized]\nassert restored==absolute",
    quiz: [
      "固定锚点相对轨迹[0,1,2]可否按每步累加解释？",
      ["可以，总是相同", "不能，会产生不同目标序列", "只有数组长度影响解释"],
      1,
      "固定参考的偏移与连续增量是不同定义，必须明确解码规则。",
    ],
    limit:
      "单维位置例；旋转、关节、速度、力和夹爪等字段的表示与归一化可能各不相同，不执行真实控制。",
  }),
  define({
    id: "policy-families",
    module: "model",
    unit: "robot-policies",
    title: "ACT、Diffusion、Flow 与离散动作策略",
    goal: "按输出表示和推理依赖区分策略家族，解释为什么不能共用一个“生成动作”流程。",
    why: "动作块可以由直接回归、迭代生成或离散Token解码产生；一次输出的长度并不能辨认内部算法。",
    prereqs: [
      [
        "action-representation",
        "不同策略家族可以产生同Shape但不同表示的动作，比较前需固定解码语义。",
      ],
      ["vla-policy", "Flow动作生成与控制队列是可组合但不同的部分。"],
    ],
    source: "act",
    section:
      "ACT原论文的动作分块与temporal ensembling；Diffusion Policy和Flow为另列来源的机制对照。",
    terms:
      "direct chunk prediction|一次网络前向产生多步动作;diffusion policy|通过迭代去噪生成动作的一类策略;flow matching|学习样本生成路径速度的训练方法;action tokenization|把动作转换为离散表示后生成;temporal ensembling|融合不同预测时刻对同一执行时刻的动作估计",
    chapters: [
      page(
        "paths",
        "相同输出，不同依赖",
        "都输出H=4动作，网络调用次数是否相同？",
        "直接Chunk路径一次产生四步；迭代路径对整块反复更新；自回归离散路径按Token条件逐步生成。图以调用时间和输出位置的二维关系区分它们。",
      ),
      page(
        "ensemble",
        "重叠预测怎样对齐",
        "两次Chunk都预测执行时刻t=3，怎样比较或融合？",
        "按绝对执行时刻对齐同一动作位置，再按方法规定融合。直接把两个数组按相同下标平均，可能混合不同的未来时刻。",
        { formula: true, quiz: true },
      ),
      page(
        "quality",
        "减少调用时还要看什么",
        "迭代步数减半，能否只报告前向次数下降？",
        "需要同时核对任务表现、动作误差、反应延迟及总时间。模型训练方式、推理求解器与控制消费之间不能直接互相替代。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>a</mi><mi>t</mi></msub><mo>=</mo><mfrac><mrow><mo>∑</mo><msub><mi>w</mi><mi>j</mi></msub><msup><msub><mi>a</mi><mi>t</mi></msub><mi>j</mi></msup></mrow><mrow><mo>∑</mo><msub><mi>w</mi><mi>j</mi></msub></mrow></mfrac></mrow>",
    ),
    derive: [
      "Chunk0从时刻0预测[0,1,2,3]；Chunk2从时刻2预测[20,21,22,23]。",
      "执行时刻3对应前者下标3的3、后者下标1的21。",
      "等权教学融合得到12；用同下标3会把3与23错误地当同一时刻。",
    ],
    code: "old={0:0,1:1,2:2,3:3}\nnew={2:20,3:21,4:22,5:23}\nmerged=(old[3]+new[3])/2\nassert merged==12",
    quiz: [
      "两块开始时间不同，融合时应首先对齐什么？",
      ["数组下标", "实际执行时刻和动作表示", "只看谁先返回"],
      1,
      "下标是相对Chunk起点的位置；融合必须保证目标时刻和坐标语义一致。",
    ],
    limit:
      "家族接口对照而非统一网络实现；融合权重为教学自设，不把等权规则冒充ACT默认。其它来源：Diffusion Policy arXiv:2303.04137、π₀原论文。",
  }),
  define({
    id: "robot-data",
    module: "model",
    unit: "robot-policies",
    title: "机器人数据：Episode、窗口与标签对齐",
    goal: "从连续记录构造不跨Episode的观测—动作训练样本，说明统计量与评估划分的作用。",
    why: "策略预测错误可能来自数据接口；模型Shape正确不能发现错一帧的动作标签或跨场景信息泄漏。",
    prereqs: [
      ["observation-contract", "数据中的采集时刻决定输入和标签是否对齐。"],
      ["action-representation", "记录的动作字段需要明确其表示与归一化。"],
    ],
    source: "dataset",
    section:
      "LeRobotDataset v3：episode/frame/timestamp、features及数据组织；窗口规则为本课明确的例子。",
    terms:
      "episode|一次连续交互轨迹，边界处环境可能重置;observation window|作为输入的历史观测集合;action horizon|作为目标的未来动作范围;dataset statistics|训练数据计算出的归一化等统计;split leakage|评估数据包含训练已泄漏的信息",
    chapters: [
      page(
        "window",
        "窗口怎样遇到边界",
        "Episode0结束于帧2，从帧1取未来3动作能否读到帧3？",
        "帧3属于新的Episode。应截断、Mask或按明确规则补齐，而不是把重置后的第一动作当成同一轨迹未来。图同时显示全局帧号与局部Episode位置。",
        { code: true },
      ),
      page(
        "align",
        "偏移一帧会学到什么",
        "观测t配到动作t+1，是否总等价于动作t？",
        "控制约定可能定义不同延迟和目标起点。必须保留训练时窗口偏移；盲目错配会把不同物理时刻当监督关系。",
      ),
      page(
        "split",
        "怎样保留可信评估",
        "把相邻帧随机分到训练和测试，结论可能有什么偏差？",
        "高度相关的同一轨迹可能同时出现在两侧。根据泛化问题选择按Episode、任务或场景划分，并记录训练统计仅从允许数据得到。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>valid</mi><mo>(</mo><mi>t</mi><mo>,</mo><mi>k</mi><mo>)</mo><mo>⇔</mo><mi>episode</mi><mo>[</mo><mi>t</mi><mo>]</mo><mo>=</mo><mi>episode</mi><mo>[</mo><mi>t</mi><mo>+</mo><mi>k</mi><mo>]</mo></mrow>",
    ),
    derive: [
      "全局帧0/1/2属Episode0，3/4/5属Episode1。",
      "从t=1取偏移[0,1,2]，只有帧1/2在同一Episode。",
      "对应Mask=[1,1,0]；帧3不能未经说明成为此样本的未来动作。",
    ],
    code: "episode=[0,0,0,1,1,1]; t=1\nmask=[int(episode[t]==episode[t+k]) for k in range(3)]\nassert mask==[1,1,0]",
    quiz: [
      "轨迹在帧2后重置，跨到下一Episode的动作应怎样处理？",
      [
        "自动当连续未来",
        "使用明确的边界处理和Mask，不默默跨轨迹",
        "只改变文件名即可",
      ],
      1,
      "Episode边界改变状态连续性；训练和评估都需保持这个物理约束。",
    ],
    limit:
      "手工Episode和采样窗口，不代表某个Dataset loader所有默认行为；缺帧、视频时间基和动作延迟需按实际数据核验。",
  }),
  define({
    id: "closed-loop",
    module: "model",
    unit: "robot-interface",
    title: "闭环执行、延迟与任务评价",
    goal: "区分模型提出的动作、控制端实际消费和环境反馈，解释开环误差如何积累。",
    why: "更快生成不自动等于更好的控制；观测年龄、动作有效时刻和重规划决定反应能力。",
    prereqs: [
      ["vla-policy", "异步队列能减少等待，但不保证返回动作仍适合当前环境。"],
      [
        "action-representation",
        "闭环反馈改变控制输入，但动作仍须按训练约定的基准、单位和归一化解释。",
      ],
    ],
    source: "processors",
    section:
      "策略/机器人processor接口；状态演化为手工离散系统，不执行真实机器人。",
    terms:
      "open loop|执行预定动作时不根据新观测修正;closed loop|按新状态反馈修正动作;observation age|使用观测距当前执行时刻的时间;rollout|在环境中持续执行与记录的轨迹",
    chapters: [
      page(
        "disturb",
        "干扰发生后动作还合适吗",
        "目标3，已规划每步+1，中途多移动1以后会怎样？",
        "开环继续预定动作会超过目标；闭环使用新观测可改变后续命令。图把真实状态、期望轨迹和观测时刻分别标出。",
        { formula: true },
      ),
      page(
        "latency",
        "看得见不等于来得及",
        "反馈晚一拍到达，为何修正仍有滞后？",
        "控制端只能使用已经到达的观测，不能偷看未来状态。更早推理、更长Chunk与观测陈旧之间存在具体时间关系。",
      ),
      page(
        "evaluate",
        "任务表现怎样和速度一起看",
        "平均推理时延更低，但失败次数增加，应如何报告？",
        "同时保留成功率、超时、轨迹约束和时延分布。固定任务集与初始条件，不过滤失败后再宣称更快更好。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>x</mi><mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo><msub><mi>x</mi><mi>t</mi></msub><mo>+</mo><msub><mi>u</mi><mi>t</mi></msub><mo>+</mo><msub><mi>d</mi><mi>t</mi></msub></mrow>",
    ),
    derive: [
      "初始x=0、目标3，预定u=[1,1,1]。",
      "第一步额外干扰d=1，状态变2；开环再走两步得到4。",
      "闭环在观测到2后只需累计再走1；如果观测延迟，修正也会推迟。",
    ],
    code: "x=0\nfor u,d in zip([1,1,1],[1,0,0]): x+=u+d\nassert x==4\n# 只演示离散状态，不是机器人控制程序",
    quiz: [
      "优化后时延下降、成功率下降，应只报告哪项？",
      ["只报时延即可", "两者及实验条件都要保留", "只选成功的轨迹重新平均"],
      1,
      "性能优化需要保持任务与质量边界，失败样本不能从结论中消失。",
    ],
    limit:
      "自设一维动态与理想反馈，不提供实际硬件控制参数；真实机械约束、延迟、动力学和任务质量必须实测。",
  }),
  define({
    id: "world-learning",
    module: "model",
    unit: "world-models",
    title: "世界模型的学习目标与想象策略",
    goal: "把观测重建、动态预测、奖励/延续预测和策略学习区分为不同监督与使用路径。",
    why: "世界模型不是只让下一帧看起来像；潜状态还要支持预测和决策，且想象中没有未来真实观测。",
    prereqs: [
      ["world-model", "先理解RSSM的h、z以及先验/后验。"],
      ["robot-data", "训练目标来自明确的轨迹、奖励和结束标记。"],
    ],
    source: "dreamer",
    section:
      "DreamerV3：World model learning Eq.(1–3)、actor/critic和imagined trajectories。",
    terms:
      "reconstruction|从状态重建观测的训练目标;KL divergence|度量两个分布差异的一种量;stop-gradient|前向值不变，但阻止梯度沿指定分支传播;critic|评价长期回报的模型;continuation|轨迹是否继续的预测",
    chapters: [
      page(
        "targets",
        "每个预测头监督什么",
        "同一潜状态为什么同时接图像、奖励和继续标记？",
        "用一条小轨迹标明不同标签。重建保留观测信息，奖励/继续预测服务于任务评价；这些输出不是一个通用“未来状态”框。",
      ),
      page(
        "distributions",
        "先验怎样向后验学习",
        "前向KL数值相同，Stop-gradient为何仍有意义？",
        "后验看到了当前观测，先验只看h。固定一侧梯度会改变哪些参数被推动，而不改变这次前向概率或KL数值。图分别显示数值与允许更新的分支。",
        { formula: true },
      ),
      page(
        "imagination",
        "策略在哪条轨迹里学习",
        "想象未来时为什么不能继续调用未来观测后验？",
        "从真实数据状态出发，由动态先验产生后续状态、奖励和延续，再训练或评价策略。推理时实际环境动作可能直接由Actor给出，不必每次显式搜索规划。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>KL</mi><mo>(</mo><mi>q</mi><mo>∥</mo><mi>p</mi><mo>)</mo><mo>=</mo><mo>∑</mo><msub><mi>q</mi><mi>i</mi></msub><mi>log</mi><mfrac><msub><mi>q</mi><mi>i</mi></msub><msub><mi>p</mi><mi>i</mi></msub></mfrac></mrow>",
    ),
    derive: [
      "教学先验p=[0.5,0.5]，观测后验q=[0.8,0.2]。",
      "KL=0.8ln1.6+0.2ln0.4≈0.1927 nat。",
      "Stop-gradient不会把q改成另一组数；它限制反向更新路径。真实Dreamer还包含损失平衡、free bits等规定。",
    ],
    code: "from math import log\np=[.5,.5]; q=[.8,.2]\nkl=sum(a*log(a/b) for a,b in zip(q,p))\nassert abs(kl-.192744757)<1e-8\n# 这里只求前向KL，不伪造训练结果",
    quiz: [
      "想象未来没有真实下一帧时，可以用该帧编码后验吗？",
      [
        "可以，世界模型会自动知道它",
        "不可以，应使用相应动态预测路径",
        "只要后验更准确就可以",
      ],
      1,
      "使用不可获得的未来观测会造成信息泄漏，改变模型实际可用条件。",
    ],
    limit:
      "前向分布和梯度职责示意，未实现Dreamer完整损失、训练与策略优化；KL小不证明状态已包含足够任务信息。",
  }),
  define({
    id: "diffusion-transformer",
    module: "model",
    unit: "world-models",
    title: "扩散、DiT 与视频生成的计算边界",
    goal: "区分噪声时间、物理帧时间和Token序列，解释去噪网络在每个采样步处理什么。",
    why: "视频世界模型与RSSM是不同模型族；“帧数×生成步数”涉及两条不同的计算轴。",
    prereqs: [
      ["world-model", "先区分视频Token配对与隐状态递推。"],
      ["vision-patches", "空间Patch决定每帧Token接口。"],
    ],
    source: "dit",
    section:
      "DiT的潜空间Patch Transformer；扩散加噪公式参见DDPM arXiv:2006.11239，视频轴为结构扩展示例。",
    terms:
      "latent|编码后的连续特征，不一定是像素;diffusion timestep|加噪/去噪过程的步骤，不是视频帧号;noise prediction|预测加入的噪声分量;conditioning|为去噪提供的时间、文本、动作等条件",
    chapters: [
      page(
        "noise",
        "带噪输入由哪两部分构成",
        "ᾱ=0.25时，干净信号和噪声各乘什么系数？",
        "按sqrt(ᾱ)和sqrt(1−ᾱ)混合。噪声预测训练目标与Flow速度目标不同，不能把同一个变量名当同一种算法。",
        { formula: true, code: true },
      ),
      page(
        "axes",
        "帧时间与生成步数分开",
        "4帧、每帧4Patch、3个生成步，需要怎样理解网络调用？",
        "每个生成步可处理整段16个视频Token，并在定义的时空连接中交换信息；不是自动逐帧自回归3次。实际架构可采用其它分解和缓存。",
      ),
      page(
        "quality",
        "减少步数的验证边界",
        "迭代从4变2，是否已经证明视频预测或规划更好？",
        "要检查生成质量、时序一致性、条件遵循和下游任务。前向调用数减少只说明工作组织改变，不能替代质量与真实成本测量。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>z</mi><mi>t</mi></msub><mo>=</mo><msqrt><msub><mover><mi>α</mi><mo>¯</mo></mover><mi>t</mi></msub></msqrt><msub><mi>z</mi><mn>0</mn></msub><mo>+</mo><msqrt><mrow><mn>1</mn><mo>−</mo><msub><mover><mi>α</mi><mo>¯</mo></mover><mi>t</mi></msub></mrow></msqrt><mi>ε</mi></mrow>",
    ),
    derive: [
      "z0=2、ε=−1、ᾱ=0.25，信号系数0.5、噪声系数√0.75。",
      "zt=1−√0.75≈0.134。",
      "若已知真实ε，可由(zt−√0.75 ε)/0.5恢复2；实际模型需预测ε，误差会影响结果。",
    ],
    code: "from math import sqrt\nz0,eps,alpha=2,-1,.25\nzt=sqrt(alpha)*z0+sqrt(1-alpha)*eps\nrestored=(zt-sqrt(1-alpha)*eps)/sqrt(alpha)\nassert abs(restored-z0)<1e-10",
    quiz: [
      "视频帧号t与扩散去噪步t是同一条时间轴吗？",
      ["是", "不是，分别描述内容时间和生成过程", "只要都写t就相同"],
      1,
      "同一个字母在不同论文中的含义可不同；必须就地说明轴与可并行范围。",
    ],
    limit:
      "标量加噪与时空接口示意；未实现具体视频模型、完整采样器或训练，DiT原论文并不代表所有视频世界模型。",
  }),
];
