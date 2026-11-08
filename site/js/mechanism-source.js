/** In-page teaching snippets migrated from the original research prototype. Not captured IR. */
export const irStages = [
  {
    name: "Triton 源码",
    tag: "Program 级算法",
    intro: "原始语义：每个程序处理 BLOCK 个偏移，Mask 阻止无效元素访问。",
    code: `pid = tl.program_id(0)\noffs = pid * BLOCK + tl.arange(0, BLOCK)\nmask = offs < N\nx = tl.load(x_ptr + offs, mask=mask, other=0)\ny = tl.load(y_ptr + offs, mask=mask, other=0)\ntl.store(out_ptr + offs, x + y, mask=mask)`,
    why: "这里还没直接规定某个逻辑元素由哪个 SM 的哪条物理指令执行。",
  },
  {
    name: "TTIR",
    tag: "操作与类型",
    intro: "保留 tt.load、算术运算、tt.store 和 shape/type 信息。",
    code: `%offs = arith.addi %base, %range      // 示意\n%mask = arith.cmpi slt, %offs, %N\n%x = tt.load %x_ptrs, %mask\n%y = tt.load %y_ptrs, %mask\n%z = arith.addf %x, %y                // 同一加法\ntt.store %out_ptrs, %z, %mask`,
    why: "这个层次体现操作依赖和张量类型，下一层需要决定怎样映射到线程/布局。",
  },
  {
    name: "TTGIR",
    tag: "GPU Layout",
    intro:
      "TritonGPU Dialect 明确布局编码与线程相关组织。下面只表示 Layout 的作用。",
    code: `#blocked = #triton_gpu.blocked<...>    // 示意\n%tile : tensor<8xf32, #blocked>\n%z = arith.addf %x, %y : tensor<8xf32, #blocked>\n// layout 属性将逻辑元素组织映射到 GPU 执行结构`,
    why: "单纯 BLOCK=8 不能反推物理 Lane、Warp 分配；必须看目标后端选定的布局及编译产物。",
  },
  {
    name: "LLVM IR",
    tag: "低层值与代码生成",
    intro:
      "更低层显式表示标量值、地址与目标相关操作。真实生成经常含 inline PTX/打包值等。",
    code: `%a = ...  ; lower load using target-specific ops\n%b = ...\n%z = fadd float %a, %b\n...       ; lower store / predication\n// 结构性示意；不是原样 LLVM dump`,
    why: "LLVM IR 支撑底层优化与代码生成；并非“LLVM 负责全部高层张量融合”。",
  },
  {
    name: "PTX",
    tag: "NVIDIA 虚拟 ISA",
    intro: "目标相关的虚拟指令级表示，包含显式数据类型和寄存器操作。",
    code: `@%p ld.global.f32 %f1, [%rd1];  // 示意\n@%p ld.global.f32 %f2, [%rd2];\nadd.f32 %f3, %f1, %f2;\n@%p st.global.f32 [%rd3], %f3;`,
    why: "掩码可能对应谓词控制；实际指令序列随版本、目标计算能力、优化和布局改变。",
  },
  {
    name: "SASS",
    tag: "真正设备指令",
    intro:
      "SASS 是目标 GPU 实际执行的指令；不能从 PTX 行数直接数出最终指令和时延。",
    code: `# 本页不伪造 B200 SASS\n# 从真实 cubin 使用 cuobjdump / nvdisasm\n# 对比 NCU 的指令/寄存器/访存指标\n# 并核对编译器版本、架构、优化参数`,
    why: "要证明某次编译优化，应把同一个 Kernel 的真实设备二进制与实测结合起来，而不是从 TTIR 猜测。",
  },
];
export const linearPhases = [
  {
    title: "① 层级输入和执行模式",
    owner: "fla/layers/gated_deltanet.py",
    input: "hidden_states: [B,T,H]",
    action:
      "投影 Q、K、V、门控；短序列推理可走 fused_recurrent，较长序列走 chunk",
    output: "Q/K/V、β、g、上一轮状态",
    why: "模型层准备参数与状态，不等于在模型 Python 循环里逐 Token 运行所有计算。",
    code: `q = q_proj(hidden_states)  # [B,T,heads,K]\nk = k_proj(hidden_states)\nv = v_proj(hidden_states)  # [B,T,heads,V]\nbeta = b_proj(hidden_states)\nmode = choose_chunk_or_recurrent(q_len, training)`,
  },
  {
    title: "② 单步递推的 GPU 状态",
    owner: "fla/ops/gated_delta_rule/fused_recurrent.py",
    input: "每头 S[K,V]、k[K]、v[V]、q[K]、g、β",
    action: "先门控衰减，再预测旧值，计算 delta 后更新 S、算输出",
    output: "新的 S[K,V] 和 o[V]",
    why: "这是 Delta 和 Gate 的实质计算。真实 Kernel 用 BK/BV 分块，可能使用 V-first 状态布局。",
    code: `for t in range(T):\n    S *= exp(g[t])              # γ 衰减\n    old_value = k[t] @ S        # [V]\n    delta = beta[t] * (v[t] - old_value)\n    S += outer(k[t], delta)     # [K,V]\n    out[t] = q[t] @ S           # [V]`,
  },
  {
    title: "③ Prefill 的 Chunk 组织",
    owner: "fla/ops/gated_delta_rule/chunk.py",
    input: "较长序列 [B,T,H,K/V] 和初始状态",
    action: "对门控做块内前缀累积，准备 WY/局部项，再在 Chunk 间传递状态",
    output: "Chunk 输出、最终状态，供下一次 Decode",
    why: "多个 Token 的递推有关联，必须把先前状态对后续状态的影响编码出来。Chunk 并行不是简单改成一个大 for 循环。",
    code: `g_cum = gate_chunk_cumsum(g)\nlocal = compute_chunk_local_terms(k, v, beta, g_cum)\nchunk_states = propagate_state_across_chunks(local, h0)\nout = apply_chunk_states_to_queries(q, local, chunk_states)`,
  },
  {
    title: "④ 设备资源与证据",
    owner: "Kernel Launch / Nsight",
    input: "目标 GPU、序列长度、K/V 维、dtype 与 Kernel 参数",
    action:
      "核对 program grid、BK/BV、状态布局与实际指令；分开测量 Prefill 和 Decode",
    output: "可重现实测的 Kernel 时间与状态访存证据",
    why: "固定形状状态不自动意味着延迟低。小 Batch 时 Launch、状态更新串行依赖与寄存器压力仍可能突出。",
    code: `record(shape, dtype, device, kernel_version)\ncheck_numerical_parity(chunk, recurrent)\nprofile(prefill_and_decode_separately)\ninspect(registers, local_spill, memory_bytes, launch_gap)\n# 不凭 toy model 预测 B200 周期/吞吐`,
  },
];
