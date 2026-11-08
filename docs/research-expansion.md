# 第二批研究型课程：机制、数值、状态与代码的对应

2026-11-08。延续首批 `research-labs.html` 中的线性注意力/Gated DeltaNet 和 Triton 编译样板。本批增加四条跨层研究链路，不改变六大模块、已有课程 ID 或个人学习进度格式。

| 专题（原有课程链接） | 核心可检查的问题 | 可重放状态 | 一手资料 |
| --- | --- | --- | --- |
| `vllm-scheduler` | 一个 Token Budget 中 Prefill/Decode 如何分配；为什么 KV 资源另是一重约束 | 3 个请求、两种预算、连续轮次 | [vLLM V1 Architecture](https://docs.vllm.ai/en/latest/design/arch_overview/) |
| `moe-route` | Router Top-2 凭什么得分；分桶、EP All-to-All 和 Grouped GEMM 的边界是什么 | 4 个 token、3 个专家、2 张 GPU、5 条跨 GPU token-expert 分配 | [vLLM EP](https://docs.vllm.ai/en/latest/serving/expert_parallel_deployment/), [Megatron Core MoE](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/moe.html) |
| `attention-tiling` | 逐 Tile Online Softmax 为什么要重新缩放历史统计量 | `m/l/a` 分两块更新，与直接 Softmax 一致 | [Dao-AILab FlashAttention](https://github.com/Dao-AILab/flash-attention) |
| `vla-policy` | 动作推理如何与执行重叠，为什么异步不一定消灭停顿 | 同步/异步两行时间轴、4/6 节拍耗时 | [LeRobot Async](https://huggingface.co/docs/lerobot/en/async) |

## 教学边界与数据准确性

- **vLLM**：简化为 A=decode 1、B=prefill 6、C=prefill 4、FCFS 预算分配。没有模拟真实 KV block 分配、异步调度、多模态、抢占的全部分支。`B=8` 第一轮 A1 B6 C1，不意味着实际 vLLM 一定采用相同顺序。
- **MoE**：本例对被选专家的 router logits 做 Softmax，仅用于说明权重合并；真实模型可能采用 Sigmoid、Bias 修正、共享专家与不同归一化。4 个 token 的派发产生 8 条 token-expert 记录，其中 5 条的原始 GPU 与专家所属 GPU 不同。真正的通信字节量受 batch、dtype、布局和实现影响；Grouped GEMM 的有效性也受不同 M、Tile、Padding 影响。
- **FlashAttention**：Value 是标量、Query 为一行。score=[1,2,3,0], value=[2,4,-1,5]，直接值与 online 值数值一致。真实 Kernel 具有多维 Value、多头、Mask、精度和块布局。
- **机器人**：时间轴用“教学节拍”，非物理控制频率；首次推理等候在两种模式都存在。异步需考虑动作覆盖/融合、观测延迟、真实动作质量与网络稳定性。
- 所有图中的数字**不是硬件实测、真实推理服务性能或机器人试验**，不适合作为产品性能结论。

## 继续扩展的质量顺序

1. 固定具体技术对象、公式、假设和可观测状态，验证数值。
2. 选择数据/控制/时间线等能揭示原因的图，而不是通用箭头。
3. 在图旁给出中文词汇、变量、单位和原位示例；外链只为核验。
4. 选固定版本的真实源码或官方资料解释计算路径和实现差异。
5. 给非记忆性判断题、反例及实验验证路径。
6. 对未建立上述证据链的课程，保留概览标签，不标为“研究完成”。

### 现阶段覆盖状态

研究型可用的主要样板：`linear-state`、`compiler-lowering`、`vllm-scheduler`、`moe-route`、`attention-tiling`、`vla-policy`，共 **6 条研究链路**。
其余深度专题仍保留旧概览/机制导读，并非全部达到同等研究深度。优先往下做 `kv-cache`、`pd-disagg`、`gemm-tiling`、`warp-issue`、`quant-pipeline`、`world-model` 等，但需要逐项研究和核验，不能仅凭列表填充。
