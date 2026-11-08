/** Evidence and concise execution skeletons follow the selected mechanism. */
import { linearPhases } from "./mechanism-source.js";
export const chapterEvidence = {
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
  },
  "fused-norm/gate": {
    source: "https://arxiv.org/abs/2002.05202",
    section:
      "GLU Variants Improve Transformer：SwiGLU使用Swish门分支与另一线性分支相乘。",
  },
  "multi-gpu/gather": {
    source:
      "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html",
    section: "NCCL：AllGather拼接各Rank输入；ReduceScatter逐坐标归约后分片。",
  },
};
export const figureTerms = {
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
