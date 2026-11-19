/** Evidence and concise execution skeletons follow the selected mechanism. */
import { linearPhases } from "./mechanism-source.js";
import { engineSystemEvidence, engineSystemFigureTerms } from "./engine-system-evidence.js";
import { math } from "./foundation-lessons.js";
export const chapterEvidence = {
  ...engineSystemEvidence,
  "tensorcore-b200/tile": {
    source:
      "https://docs.nvidia.com/cuda/archive/12.9.2/parallel-thread-execution/index.html#tensor-memory",
    section:
      "PTX ISA 8.8 §9.7.16.1：sm_100a/f的TMEM结构与分配；§9.7.16.10的A/B/D所在空间。",
  },
  "tensorcore-b200/barrier": {
    source:
      "https://docs.nvidia.com/cuda/archive/12.9.2/parallel-thread-execution/index.html#tcgen-async-sync-operations-commit",
    section:
      "PTX ISA 8.8 §9.7.16.6同步规则与§9.7.16.12.1 commit追踪；非可运行Kernel。",
    code: "# 此处省略真实指令操作数、限定符和初始化，不能直接编译\nreserve_tensor_memory()\nissue_TMA_to_shared(A, B)\nwait_for_TMA_completion()  # 仅证明输入就绪\nissue_tcgen05_mma(D_tmem, A_desc, B_desc)\ncommit_tcgen05_to_mbarrier(done_barrier)\nwait_for_matching_barrier_phase(done_barrier)\napply_required_cross_thread_tcgen05_fence()\nload_tmem_result_and_wait_as_required()\n# 满足消费者完成及协议后才复用/释放资源",
  },
  "vla-policy/training": {
    source: "https://www.physicalintelligence.company/download/pi0.pdf",
    section:
      "π₀原论文：§III的条件Flow Matching目标与Euler推理；本章只画两个动作分量。",
    code: "eps = sample_standard_normal_like(A)\nA_tau = tau * A + (1 - tau) * eps\nvelocity = model(A_tau, observation, tau)\nloss = squared_norm(velocity - (A - eps))\n# 推理没有真实A：\na = sample_noise()\nfor tau in integration_grid:\n    a += dt * model(a, observation, tau)",
  },
  "vla-policy/flow": {
    source: "https://www.physicalintelligence.company/download/pi0.pdf",
    section: "π₀原论文：§III Euler积分；本图用手工速度场单独说明数值积分误差。",
  },
  "world-model/rssm": {
    source: "https://arxiv.org/html/2301.04104v2",
    section:
      "DreamerV3：World model learning，Eq.(1)的h、z先验/后验及预测头；非完整训练算法。",
    code: "h = sequence_model(h_prev, z_prev, action_prev)\nprior = dynamics_predictor(h)\nif observation_available:\n    posterior = encoder(h, observation)\n    z = sample(posterior)\nelse:\n    z = sample(prior)\nstate = concatenate(h, z)\n# reward / continuation / reconstruction是不同预测头",
  },
  "linear-state/correction": { code: linearPhases[1].code },
  "linear-state/triangle": {
    code: "L[i,j] = beta[i] * dot(k[i], k[j]) if j < i else 0\nD = forward_substitution(I + L, beta[:,None] * V)\nS_out = S0 + transpose(K) @ D\n# 此骨架限定 S0=0、gamma=1；输出还要按Token前缀读取\n# 正式实现用WY等分块变换，不能把此密集求解当最优Kernel",
  },
  "linear-state/kernel": {
    code: linearPhases[2].code + "\n\n" + linearPhases[3].code,
  },
  "compiler-lowering/program": {
    code: "pid = tl.program_id(0)\noffs = pid * BLOCK + tl.arange(0, BLOCK)\nvalid = offs < N\nx = tl.load(x_ptr + offs, mask=valid, other=0)\ny = tl.load(y_ptr + offs, mask=valid, other=0)\ntl.store(out_ptr + offs, x + y, mask=valid)",
  },
  "fused-norm/rope": {
    source: "https://arxiv.org/abs/2104.09864",
    section: "RoFormer: §3 Rotary Position Embedding；本图只取一个二维特征对。",
    formula: math("<mrow><msubsup><mi>x</mi><mn>0</mn><mo>′</mo></msubsup><mo>=</mo><msub><mi>x</mi><mn>0</mn></msub><mi>cos</mi><mi>θ</mi><mo>−</mo><msub><mi>x</mi><mn>1</mn></msub><mi>sin</mi><mi>θ</mi></mrow>") + math("<mrow><msubsup><mi>x</mi><mn>1</mn><mo>′</mo></msubsup><mo>=</mo><msub><mi>x</mi><mn>0</mn></msub><mi>sin</mi><mi>θ</mi><mo>+</mo><msub><mi>x</mi><mn>1</mn></msub><mi>cos</mi><mi>θ</mi></mrow>"),
    derive: ["x0、x1是同一特征对的两个分量，θ是该位置与该频率对应的旋转角；不是墙钟时间。", "输入[1,0]，θ=90°，cosθ=0、sinθ=1，得到[0,1]。", "平方长度从1²+0²到0²+1²仍为1；真实RoPE对多组特征使用不同频率和配对约定。"],
  },
  "fused-norm/gate": {
    source: "https://arxiv.org/abs/2002.05202",
    section:
      "GLU Variants Improve Transformer：SwiGLU使用Swish门分支与另一线性分支相乘。",
    formula: math("<mrow><mi>h</mi><mo>=</mo><mi>silu</mi><mo>(</mo><mi>g</mi><mo>)</mo><mo>⊙</mo><mi>u</mi><mo>;</mo><mi>silu</mi><mo>(</mo><mi>g</mi><mo>)</mo><mo>=</mo><mfrac><mi>g</mi><mrow><mn>1</mn><mo>+</mo><msup><mi>e</mi><mrow><mo>−</mo><mi>g</mi></mrow></msup></mrow></mfrac></mrow>"),
    derive: ["g是gate分支，u是up分支；⊙表示相同位置相乘。图固定u=[2,3]。", "g=[-1,1]时，silu(g)约为[-0.268941,0.731059]。", "逐元素乘u得到[-0.537883,2.193176]。负gate不必为0，所以不能把silu替换为ReLU；完整FFN通常还需下投影。"],
  },
  "fused-norm/fusion": {
    source: "https://docs.pytorch.org/docs/stable/generated/torch.nn.RMSNorm.html",
    section: "RMSNorm定义；残差相加与逻辑IO账本是原创组合示例，未运行生产融合Kernel。",
    formula: math("<mrow><mi>z</mi><mo>=</mo><mi>x</mi><mo>+</mo><mi>r</mi><mo>;</mo><msub><mi>y</mi><mi>i</mi></msub><mo>=</mo><mfrac><msub><mi>z</mi><mi>i</mi></msub><msqrt><mrow><mfrac><mn>1</mn><mi>H</mi></mfrac><munder><mo>∑</mo><mi>j</mi></munder><msubsup><mi>z</mi><mi>j</mi><mn>2</mn></msubsup><mo>+</mo><mi>ε</mi></mrow></msqrt></mfrac><msub><mi>γ</mi><mi>i</mi></msub></mrow>"),
    derive: ["r是残差输入，H=2，γ=[1,1]，ε=10⁻⁵。z=[1,2]+[2,2]=[3,4]，平方均值12.5。", "两个Kernel逻辑读x/r/z/γ共4H，写z/y共2H；融合且z无外部读者时，读x/r/γ共3H，只写y共H。", "当H=2，读写总量12→8元素次；若z还要对外输出，融合写z/y共2H，总量10。三种安排都须保留相同数值结果。"],
    code: "z = x + residual\nmean_square = sum(z.float()*z.float()) / H\ny = z * rsqrt(mean_square + eps) * gamma\nstore(output, y)\nif residual_sum_is_external_output:\n    store(residual_output, z)\n# 融合可保留局部z；不得省归约、要求的舍入或外部输出",
    question: "本例H=2，融合后z仍供链外使用。读x/r/γ、写y/z，逻辑读写共多少元素次？",
    options: ["8，融合后总能删z输出", "10，6次读与4次写", "12，融合完全没有减少读取"],
    correct: 1,
    explain: "必须读三条长度2输入，共6；写两条长度2输出，共4。相比两个Kernel省掉Norm对全局z的读取，但仍要输出z。计数不等于实测DRAM或时长。",
    limit: "只核对小向量残差+RMSNorm及逻辑IO；生产dtype舍入、外部使用、寄存器与同步需按实际Kernel核验。",
  },
  "runtime-graph/lifetime": {
    code: "# 原创生命周期骨架，不是CUDA API\nkeep_alive(host_input, device_input, device_output, host_output)\nenqueue_copy(host_input, device_input)\n# 同一Stream或显式依赖：Graph读取必须在输入拷贝之后\nreplay_graph_with_bound_device_buffers()\nenqueue_copy_after_graph(device_output, host_output)\nwait_for_input_copy_completion_before_reusing(host_input)\nwait_for_graph_completion_before_reusing(device_input)\nwait_for_output_copy_completion_before_reading(host_output)\n# device_output也须保留到回传完成；换绑定地址须满足图更新/重建协议",
  },
  "gemm-tiling/pressure": {
    question: "M=5、N=6、BN=3，BM从2变4，每Program累加器从6变12格，是否已证明更快？",
    options: ["已证明，Program数更少", "未证明，要核对尾部、真实寄存器/Spill、并发与时长", "已证明，累加器数量等于每线程物理寄存器数"],
    correct: 1,
    explain: "逻辑输出槽数从36增至48，Program数从6降至4；两种计数方向相反。实际线程布局与分配还会改变资源需求，需真实产物及测量。",
  },
  "multi-gpu/gather": {
    ...engineSystemEvidence["multi-gpu/gather"],
    source:
      "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html",
    section: "NCCL：AllGather拼接各Rank输入；ReduceScatter逐坐标归约后分片。",
  },
};
export const figureTerms = {
  ...engineSystemFigureTerms,
  "norm-fusion": [
    ["x / r / z", "输入 / 残差输入 / 相加后的同一行向量z=x+r"],
    ["H / γ / ε", "行长，本例2 / 可学习缩放，本例全1 / 开方前稳定项，本例10⁻⁵"],
    ["逻辑IO", "按输入输出语义计数的读写元素次；不等于DRAM事务"],
    ["外部读者", "融合区域以外还需要z的消费者，要求保留相应输出"],
  ],
  "tensor-memory": [
    ["SMEM / TMEM", "Shared Memory / Tensor Memory，两种不同的片上地址空间"],
    ["lane / 列", "TMEM的行 / 分配轴；TMEM lane不等于CUDA线程号"],
    ["KiB", "1024 Byte；32列×128行×4 Byte=16KiB"],
  ],
  "tensor-completion": [
    ["TMA", "按张量描述符搬运数据的硬件能力"],
    ["mbarrier / phase", "追踪到达及异步完成的屏障对象 / 本轮阶段"],
    ["commit / fence", "建立异步操作完成跟踪 / 满足指定线程间次序和可见性要求"],
  ],
  "flow-training": [
    ["A / ε", "示教动作块 / 同形状高斯噪声；图只显示两个分量"],
    ["τ / θ", "0至1的生成插值时间 / 学习得到的网络参数"],
    ["vθ / 观测", "条件速度预测 / 图像、语言与本体状态等条件"],
  ],
  "world-rssm": [
    ["h / z / x", "确定性记忆 / 随机离散潜状态 / 当前观测"],
    ["p / q", "不看当前观测的动态先验 / 使用当前观测的编码后验"],
    ["logits / 采样", "归一化前评分 / 按概率选取类别；与取最大值不同"],
  ],
  "delta-triangle": [
    ["C", "块内Token数，本例3"],
    ["K / V", "每行一个Token的Key / Value；Kᵀ为转置"],
    ["I / L / D", "单位矩阵 / 严格下三角依赖 / 已乘β的残差矩阵"],
  ],
  "state-tiles": [
    ["BK / BV", "Kernel沿Key / Value维的Tile尺寸"],
    ["WY", "把连续秩一更新组织成便于分块计算的矩阵表示；不是无依赖累加"],
  ],
  "compiler-route": [
    ["FX", "记录张量运算依赖的图表示"],
    ["Guard", "允许复用编译结果的运行条件"],
    ["Graph Break", "无法继续捕获时切开编译区域"],
  ],
  "layout-ownership": [
    ["Shape", "逻辑轴与元素个数"],
    ["Layout", "逻辑元素到线程和寄存器等位置的归属"],
    ["Lane", "Warp中的逻辑线程位置"],
  ],
  "expert-matrices": [
    ["Mₑ", "路由给专家e的Token行数"],
    ["Grouped GEMM", "把不同大小专家矩阵乘法组织成一组执行"],
  ],
  "flow-field": [
    ["τ / Δτ", "动作去噪过程的积分时间 / 数值步长，不是机器人墙钟时间"],
    ["速度场", "当前动作样本随τ变化的方向；本图手工设为1−a"],
  ],
  swiglu: [
    ["silu(x)", "x/(1+exp(−x))，也称Swish"],
    ["gate / up", "门控分支 / 另一个投影分支；结果逐元素相乘"],
  ],
  "world-belief": [
    ["先验", "看到本次观测前对隐状态的预测"],
    ["似然", "给定某个状态时出现这次观测的可能性"],
    ["后验", "先验乘似然后归一化得到的更新信念"],
  ],
  "collective-reduce": [
    ["Rank", "通信组中的参与进程编号"],
    ["AllReduce", "相同坐标归约，结果在每个Rank完整保留"],
  ],
  "collective-gather": [
    ["AllGather", "收集并拼接各Rank的分片，每个Rank得到完整结果"],
    ["ReduceScatter", "逐坐标归约，然后每个Rank只保留一段"],
  ],
};
