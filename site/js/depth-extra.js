/** P0 主流缺口与研究专项：不伪造特定版本的源码行号、性能数据。 */
const V='https://docs.vllm.ai/en/latest/design/arch_overview/';
const SPEC='https://docs.vllm.ai/en/latest/features/speculative_decoding/';
const Q='https://docs.vllm.ai/en/latest/features/quantization/';
const RMS='https://docs.pytorch.org/docs/stable/generated/torch.nn.RMSNorm.html';
const TRT='https://docs.nvidia.com/deeplearning/tensorrt/latest/';
const MLA='https://arxiv.org/abs/2405.04434';
const FLA='https://github.com/fla-org/flash-linear-attention';
const SGL='https://docs.sglang.ai/';
const CUTLASS='https://github.com/NVIDIA/cutlass';
const T=x=>({...x,stage:x.stage.map(([title,data,mechanism,metric,trap])=>({title,data,mechanism,metric,trap})),depth:'L3'});
export const depthExtra=[
 T({id:'spec-decode',module:'engine',parent:'vllm-route',title:'推测解码、MTP 与候选验证',summary:'从草稿 Token → Target 批量验证 → 接受/回退，判断为什么多算了一步也可能更快。',question:'目标模型并没有变小，推测解码究竟节约了什么？',analogy:'小助手先写草稿，主模型一次核对多个字；草稿错误太多时反而拖慢。',stage:[
 ['提出候选','Prompt / KV → γ 个候选 Token','Draft / EAGLE / MTP 等算法形成候选，成本和依赖链因实现而异。','候选长度、Draft 耗时','Draft 不是零成本'],
 ['批量验证','候选序列 → Target 前向结果','Target 一次前向验证多个位置，试图减少逐 Token 串行轮次。','Target Shape、验证时延','并行验证仍然使用主模型算力'],
 ['接受或拒绝','目标分布 → 可接受序列、补充 Token','采样路径应遵守算法分布语义，接受长度并非固定。','接受率、平均接受长度','接受率高不等于总体提速'],
 ['实际服务','新 KV 与结果 → 下一轮 Decode','加入调度、批次、延迟与质量评价，判断真实收益。','TPOT / TTFT / 吞吐','不考虑混合 Batch 可能误判']
 ],insights:['关键是减少目标模型串行调用，不是把 FLOPs 乘以接受率。','需要区分 Draft 架构与采样验证的正确性。'],traces:[['vLLM 功能文档','Speculative Decoding','核对候选方法和可用配置，版本会变化。',SPEC],['vLLM 架构','V1 Scheduler / Model Runner','追踪 Draft、Target 和 Request/KV 如何交互。',V]],experiment:{goal:'开启/关闭推测解码的受控对照',controls:'固定模型、输入分布、候选算法和长度',metrics:'Target/Draft 分段耗时、接受长度、TPOT、总吞吐',validation:'检查 Greedy 或采样分布及模型输出质量，固定版本和请求负载'},quiz:['候选经常被拒绝时最可能发生什么？',['Draft 与验证成本可能超过节省的串行时间','必定加速','Target 自动失去 Attention'],0,'需要看接受率、Draft 成本和 Target 验证成本的合计。'],refs:[['vLLM Speculative Decoding',SPEC],['vLLM Architecture',V]],related:['vllm-scheduler','llm-block','serving-slo']}),
 T({id:'quant-pipeline',module:'engine',parent:'vllm-route',title:'量化部署与 FP8/FP4 Kernel',summary:'区分权重、激活、KV 量化、缩放与实际矩阵计算后端；位宽不等于性能加速比。',question:'数据从 BF16 变成 FP8，为什么显存减小不保证 Token/s 翻倍？',analogy:'货物压缩后搬运更轻，但解包、对齐、加工路径可能更复杂。',stage:[
 ['量化对象','W / A / KV → 不同位宽存储','W8A8、W4A16、KV FP8 等作用于不同张量，不能混为一谈。','显存/Scale、误差','权重量化不自动压缩 KV'],
 ['分组与 Scale','原始值 → Quant + Scale / ZeroPoint','缩放粒度、动态范围、舍入和溢出决定误差与访存。','Scale Bytes、异常值','只算有效位数会低估额外成本'],
 ['Kernel 路径','Packed Data → Dequant / Tensor Core','后端可能使用融合反量化或硬件低精度 MMA；需检查设备支持和 Shape。','实际 Kernel、Tensor Core、寄存器','降低位宽不保证后端匹配'],
 ['服务验收','Checkpoint → 输出、显存和延迟','对齐负载和输出质量，比较模型权重、KV 与中间内存。','P99、吞吐、质量','只看权重显存是不完整的']
 ],insights:['FP8 和 FP4 数值表示、Scale 和兼容硬件各不相同。','量化要联合考虑模型精度、实际 Kernel 与端到端瓶颈。'],traces:[['vLLM 量化','支持的格式与硬件','检查量化 checkpoint、backend、版本兼容。',Q],['CUTLASS','低精度 GEMM 与 Scale','观察布局、矩阵指令与反量化融合。',CUTLASS]],experiment:{goal:'在同模型、同工作负载下比较 BF16/FP8/FP4 的资源与精度',controls:'固定设备、Shape、请求分布，分开改变权重量化与 KV 量化',metrics:'显存、Kernel 时间、TTFT/TPOT、误差与任务质量',validation:'校验动态范围、输出误差和实际运行后端，不编造量化提速'},quiz:['模型权重缩为一半，是否代表推理耗时必减半？',['是，时间与存储线性一致','不是，计算、反量化、Batch、KV、调度共同决定','只有开 FP4 才一定可以'],1,'内存占用与执行时间是不同指标；还需结合实际算子形状、反量化代价及瓶颈验证。'],refs:[['vLLM Quantization',Q],['NVIDIA CUTLASS',CUTLASS]],related:['gemm-tiling','kv-cache','memory-route']}),
 T({id:'fused-norm',module:'kernel',parent:'kernel-analysis',title:'RMSNorm / RoPE / SwiGLU 与算子融合',summary:'把归约、位置旋转与门控分开理解，再研究融合减少的全局内存流量及数值问题。',question:'RMSNorm、RoPE 都是“小算子”，为什么不能用相同的方法优化？',analogy:'RMSNorm 先汇总整行统计量；RoPE 依赖元素配对与位置，数据依赖和布局不相同。',stage:[
 ['归约','X[B,S,H] → RMS / Scale','沿 H 维统计均方后归一化，涉及 Reduction 和数值顺序。','Reduction 与同步成本','不是纯逐元素'],
 ['位置旋转','Q/K + 位置 → RoPE Q/K','在特征维按位置和约定的配对规则旋转。','布局、连续访存','不同实现对偶/半维配对不同'],
 ['门控激活','Gate、Up → SwiGLU 输出','计算分支后逐元素门控，可与周边操作融合。','临时张量读写','融合可能带来更多寄存器压力'],
 ['端到端融合','多个 Kernel → 更少中间写回','兼顾寄存器、正确性与实际 Kernel 时长，而不只比较字节数。','Launch、Global Bytes、误差','融合不保证加速']
 ],insights:['Norm 是归约，RoPE 是位置相关旋转，SwiGLU 是门控激活。','减少临时存储不代表吞吐会按同倍数提高。'],traces:[['PyTorch RMSNorm','定义与数值公式','确认归约维度和 eps 语义。',RMS],['CUTLASS/Triton','Epilogue 与算子实现','核对实际生成的 Kernel 与数据布局。',CUTLASS]],experiment:{goal:'比较拆分和融合小算子的性能',controls:'固定 H、dtype、输入分布和运行环境，仅改变融合路径',metrics:'Kernel Count、内存事务、寄存器、延迟与误差',validation:'随机、极值和长序列测试，检查所有输出而非只看速度'},quiz:['RMSNorm 不能当成 ReLU 直接逐元素做的原因？',['需要在归一化维计算平方均值','它不能在 GPU 上执行','RoPE 不需要 KV'],0,'RMSNorm 必须汇总该维度的数据。'],refs:[['PyTorch RMSNorm',RMS],['CUTLASS',CUTLASS]],related:['compiler-lowering','profiling','llm-block']}),
 T({id:'mla-kv',module:'model',parent:'transformer-workload',title:'MLA：压缩 KV 与矩阵吸收',summary:'拆解 MLA 潜变量、位置编码、Decode 中矩阵吸收的成本交换。',question:'KV Cache 变小以后，为什么还是需要考虑额外矩阵计算？',analogy:'将历史记录存成短码，使用时需要计算还原或移动变换到另一侧。',stage:[
 ['压缩 KV','Hidden → KV Latent + 位置相关分量','低秩缓存降低每 Token 存储；不同模型的细节不同。','KV bytes / Token','MLA 不等同 GQA'],
 ['查询侧','Hidden → Q、RoPE 相关表示','解耦位置分量与内容表示保持注意力语义。','Q/KV Shape、Rotary Head','不能省略位置编码影响'],
 ['投影吸收','潜变量 + 权重 → Attention','调整矩阵乘法顺序可能避免显式展开 KV。','K/V Expand、GEMM','吸收策略不是零成本'],
 ['推理内核','KV Latent → Decode Kernel','衡量节省带宽与额外计算、寄存器需求。','Kernel Time、DRAM、TC','Cache 小也不保证加速']
 ],insights:['MLA 需要在模型数学和 Kernel 实现两个层次理解。','低秩缓存可换取额外的投影计算。'],traces:[['DeepSeek-V2','MLA 论文与结构','核对压缩 KV 的数学公式。',MLA],['vLLM','Attention Backend','查具体模型支持的 Kernel 路径。',V]],experiment:{goal:'固定真实 MLA 模型对照实现路径',controls:'固定模型参数/Batch/Seq/dtype，变化实际内核模式',metrics:'KV bytes、Decode Latency、访存和数值一致性',validation:'不能用通用 GQA 参数代替真实 MLA 实现'},quiz:['为什么 MLA 并不等于缓存减少后计算免费？',['压缩信息仍需投影与注意力计算','缓存一缩小 Layer 自动为零','每个 Token 不再有 Q'],0,'压缩改变表示及计算排列，没有消除所有计算。'],refs:[['DeepSeek-V2 Paper',MLA],['vLLM Architecture',V]],related:['attention-tiling','kv-cache','llm-block']}),
 T({id:'linear-state',module:'model',parent:'transformer-workload',title:'线性注意力与递推状态更新',summary:'对比 Softmax Attention 的长 KV 与线性注意力的状态 Scan/Chunk 更新。',question:'为什么更低的理论复杂度也可能遇到小批次 GPU 延迟问题？',analogy:'维护可更新的状态摘要，而不是每步重新翻查全部历史；不同算法摘要不一样。',stage:[
 ['状态定义','Token Features → State','不同线性注意力、Delta Rule 和 SSM 维护不同递推状态。','State Shape','不能把所有线性 Attention 视为同一公式'],
 ['Prefill','Sequence → Chunk/Scan','分块并行计算状态转移，仍有合并与同步。','Chunk Shape、SMEM','线性复杂度不等于天然高吞吐'],
 ['Decode','上一状态 + 新 Token → 新状态','每步少量矩阵或向量计算，但多次小 Kernel 可能受 Launch 和依赖限制。','Latency、依赖链','小状态不保证常驻寄存器'],
 ['验证','Chunkwise vs Recurrent','在相同数值语义下核对长期误差与性能。','P99、误差、Kernel Count','只比较单次算子可能误导']
 ],insights:['Linear Attention 仍有多种数学形式和特有的数值稳定性问题。','复杂度只说明增长趋势，不能代替具体 Shape 的 Kernel Profiling。'],traces:[['Flash Linear Attention','Chunkwise 与 Recurrent Kernel','查真实模型的状态更新和张量布局。',FLA],['vLLM/框架','推理运行入口','对齐当前模型与调度调用路径。',V]],experiment:{goal:'比较 Chunk/状态布局和 Decode 时延',controls:'固定模型、dtype、状态形状、序列与 Batch',metrics:'Kernel 数、SMEM、Latency、误差',validation:'输出必须与同算法参考实现一致'},quiz:['序列复杂度降低是否保证每步 Decode 更快？',['保证','不保证，状态访问/Launch/资源竞争也有代价','模型不再有参数'],1,'运行形状、布局与真实硬件限制仍在。'],refs:[['Flash Linear Attention',FLA],['vLLM Architecture',V]],related:['llm-block','profiling','memory-route']}),
 T({id:'frameworks',module:'engine',parent:'vllm-route',title:'推理引擎比较：vLLM / SGLang / TensorRT-LLM',summary:'比较引擎结构、调度、Kernel 后端、部署目标，而不是比单条吞吐排名。',question:'为什么 A 框架的 tokens/s 高，不等于真实在线体验更好？',analogy:'不同运输车队，路线和乘客分布不一致时单比最高车速没有意义。',stage:[
 ['功能边界','模型 / 精度 / API','先看目标模型、量化、并行和服务功能。','Feature Matrix','专用引擎不一定提供完整 Serving'],
 ['调度缓存','请求 → Scheduler/KV','对比 Continuous Batching、Prefix Cache、PD 分离。','TTFT、ITL','默认配置不同会误导对比'],
 ['内核编译','Runner → GEMM/Attention','记录实际选中的 Kernel、CUDA Graph 和编译路径。','Kernel Trace','框架性能差异不全来自调度'],
 ['线上评估','Trace + SLO → 负载','对齐设备预算、到达分布与质量。','P99、tokens/s/GPU、失败率','Offline 吞吐不能代替线上指标']
 ],insights:['性能比较应固定模型、配置与工作负载，而不是宣称某引擎永远最快。','DeepInfer 等专用引擎要单独核对具体版本、开源能力和服务范围。'],traces:[['vLLM','Architecture Overview','分解 EngineCore、Scheduler 与 Worker。',V],['SGLang','官方文档','核对当前版本 Runtime 与部署特性。',SGL],['TensorRT-LLM','官方文档','对照 Builder 与 Runtime。',TRT]],experiment:{goal:'同模型跨引擎服务对照',controls:'固定量化、GPU/实例数、输入输出分布、SLO',metrics:'TTFT、TPOT/P99、吞吐、GPU 利用与质量',validation:'按版本核对执行后端、Warmup、编译缓存及错误率'},quiz:['离线最大吞吐较高就一定能改善在线 P99 吗？',['一定','不一定，排队和尾延迟条件还未比较','只看显存即可'],1,'在线请求到达模式和 SLO 是不同约束。'],refs:[['vLLM',V],['SGLang',SGL],['TensorRT-LLM',TRT]],related:['pd-disagg','vllm-scheduler','serving-slo']})
];
