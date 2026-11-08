# 研究型课程首批样板：证据、数学与边界

更新日期：2026-11-08。只引用公开、可核对的材料；不包含内部芯片架构和测试数据。

## A. Gated DeltaNet：单头标量门控递推

**精确定义：** 此页只示范 Gated DeltaNet v1 的一种标量门控、无额外归一化的核心状态更新。简化为 `K=V=2`、单头、`q=k`、单位基 `k`、固定 `beta` 与 `gamma`，并不是完整模型层。省略输入投影、短卷积、输出 Gate、层归一化、不同模型的 head sharing 与训练反向传播。

FLA 公开 `fused_recurrent_gated_delta_rule_fwd_kernel` 实现的标量门控路径，逻辑顺序是：

1. `h *= exp(g)`；
2. `delta = beta * (v - k^T h)`（代码可能因 `STATE_V_FIRST` 改变矩阵朝向）；
3. `h += outer(k, delta)`；
4. `o = q^T h`。

可重写为 `M_t=gamma*S_{t-1}`、`δ_t=v_t−k_tᵀM_t`、`S_t=M_t+beta*k_t*δ_tᵀ`；其中 `gamma=exp(g)`。

数学上有 `S_t=A_t S_{t−1}+B_t`，其中 `A_t=gamma*(I−beta*k_t k_tᵀ)`，`B_t=beta*k_t v_tᵀ`。两个 token 的组合是 `(A2*A1, A2*B1+B2)`；这只是理解 Chunk/Scan 有可能利用结合性的入门桥梁，绝不等价于 FLA 真正的高效 Chunk Kernel 的全部实现（其前向还涉及 Gate cumsum、WY 表示、块内处理和状态传递）。

证据：
- Gated DeltaNet 论文：https://arxiv.org/abs/2412.06464
- FLA 层入口（固定提交）：https://github.com/fla-org/flash-linear-attention/blob/98193113ecb7835143252a786e06933e371b67cc/fla/layers/gated_deltanet.py
- FLA Recurrent Kernel（固定提交）：https://github.com/fla-org/flash-linear-attention/blob/98193113ecb7835143252a786e06933e371b67cc/fla/ops/gated_delta_rule/fused_recurrent.py
- FLA Chunk 入口（固定提交）：https://github.com/fla-org/flash-linear-attention/blob/98193113ecb7835143252a786e06933e371b67cc/fla/ops/gated_delta_rule/chunk.py

**不应推论：** 所有线性注意力共享该式；复杂度降低就一定快；State 永远可驻留寄存器；教学 β/γ 对应具体已训练模型值；纸面 Chunk 合成就是 GPU 分块实现。

## B. Triton IR：官方 Vector Addition 作为最小可观察样本

选用 N=10、BLOCK∈{4,8} 的教学数组，是为了可手算且有尾块 Mask。代码中 `offs=pid*BLOCK+tl.arange(0,BLOCK)`、`mask=offs<N`、`tl.load/store` 的语义对应 Triton 官方向量加法示例。但 **offset 是逻辑元素偏移，不是固定映射到某个 Lane 的证明**。TTGIR 中的 Layout 信息和实际生成物才能解释线程/值分配。

IR 视图为本项目原创、**带显著标识的结构化示意**：TTIR→TTGIR→LLVM IR→PTX→SASS，不是复制实际编译 Dump；生产中必须记录 Triton/PyTorch 版本、GPU SM 目标、编译选项、dtype/shape，并获取 `kernel.asm` 相应条目及 cubin、SASS。不同算子和后端会绕过某些阶段，例如调用预编译库。

另外提供独立 Eager 3 Kernel 与融合 1 Kernel 的逻辑全局访问计数：对于 `y=max(0,2x+1)`，若中间 `u、v` 都在全局物化，理想全量读写是 `6N` 元素；单 Kernel 融合只需 `2N` 元素。这个对比是 **逻辑 IO 示意**，不能当成 HBM 实际字节或性能加速比。

证据：
- Triton 官方教程：https://triton-lang.org/main/getting-started/tutorials/01-vector-add.html
- Triton 官方示例固定提交：https://github.com/triton-lang/triton/blob/6d86e10586dec94539c6390b5cfce4be2d0d621a/python/tutorials/01-vector-add.py
- PyTorch Triton 编译阶段：https://pytorch.org/blog/triton-kernel-compilation-stages/
- torch.compile / Inductor 文档：https://docs.pytorch.org/docs/stable/torch.compiler.html
- MLIR Dialect：https://mlir.llvm.org/docs/LangRef/

## 验证结果与未完成项

- Node 数值测试：重复 Key 覆写、beta/gamma 四组合、两 Token 仿射合成、BLOCK 4/8 的 Mask 与输出。
- Chromium 实际交互检查：桌面宽度 1280px、手机宽度 390px；操作、切换、公式显示、无脚本错误、无整页横向溢出。
- **未执行：** B200 Profiling、真实 Triton 编译 Dump 对照、NCU 指令计数、GDN 的生产精度/性能测试。后续可在允许的环境中补真实结果。
- 这两节是质量样板，不代表原有 25 节都已达到同等内容深度。
