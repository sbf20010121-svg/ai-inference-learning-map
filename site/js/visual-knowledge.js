/**
 * V1.5｜中文图解知识层。内容直接出现在专题页：不依赖外部文章才能理解基本机制。
 * 所有图为教学结构图，非 NVIDIA / vLLM 内部真实布线或周期级仿真。
 * stages: [标题, 为什么/数据如何流动]。compare: [方案, 收益, 成本]。
 */
export const illustrated = {
  'llm-block':{
    key:'一个 Transformer Block 不是一个 Kernel，而是一串具有不同数据依赖、张量形状和访存特征的计算。',
    chain:[['输入隐藏状态','X 的常见形状是 [B,S,H]；Prefill 时 S 较长，Decode 每轮新 Token 较少。'],['Q/K/V 投影','线性层将隐藏状态映射为查询、键、值；典型计算可转为 GEMM。'],['注意力','Q 与当前/历史 K、V 计算加权聚合；Decode 常访问 KV Cache。'],['输出投影与残差','Attention 结果投回隐藏维，再与残差连接；Norm 及布局会影响访存。'],['MLP / MoE','Dense MLP 或专家计算产生新隐藏状态；MoE 还有路由和通信。']],
    sample:['张量例子（教学形状）','B=2、S=128、H=4096 时，X=[2,128,4096]；Q/K/V 形状还取决于 Q/KV Head 数与 HeadDim。','不要把一个 Transformer Block 当成单次矩阵乘法，也不要把 Decode 必然判为 HBM 受限。'],
    compare:[['Prefill','较长 Token 维度使 GEMM 的 M 可能更大、并行度更充足','计算量、KV 写入与 TTFT'],['Decode','每轮新增 Token 少，通常需读取历史 KV、循环多次','低 Batch、访存和调度开销可能突出']],
    remember:['模型数学决定算子，算子实现决定 Kernel。','同名算子在 Prefill/Decode 中的 Shape 可能相差很大。','先分模块测量，再讨论算力或带宽瓶颈。']
  },
  'moe-route':{
    key:'MoE 不是每个 Token 计算所有专家，而是先路由再执行被选中的专家；因此多了不规则分组和可能的跨卡通信。',
    chain:[['隐藏状态','每个 Token 到达 MoE 层，形状可展平为 [T,H]。'],['Router 打分','计算每个 Token 对各 Expert 的分数，并选择 Top-k。'],['Dispatch / 分组','按选中的专家重新排列 Token，可能发生 All-to-All。'],['专家计算','各 Expert 执行自己的 GEMM/MLP；不同专家负载不一定均衡。'],['Combine','按路由权重把专家输出还原到原 Token 顺序。']],
    sample:['分组例子','16 个 Token、4 个专家、每 Token 选 2 个专家，理论上产生 32 个 token-expert 分配；并不意味着 32 个独立 GPU Kernel。','Top-k=2 不代表计算量恰好比 Dense 减半；专家宽度、通信和实现都不同。'],
    compare:[['单卡专家','无跨设备 All-to-All，更易控制延迟','显存/专家容量受限'],['Expert Parallel','将更多专家分布到多 GPU','Dispatch、All-to-All、负载倾斜']],
    remember:['Router 决定 Token 去哪里，不等于 GPU Kernel Scheduler。','Grouped GEMM 的专家分组形状是关键性能变量。','计算、Dispatch、网络必须在同一时间线分析。']
  },
  'vla-policy':{
    key:'机器人 VLA 的动作专家根据视觉、语言和当前机器人状态生成一段动作；Flow Matching 动作头可能多次前向，并非 LLM 式逐 Token 解码。',
    chain:[['多相机与语言','图像经过 Patch/ViT 形成视觉特征，文本提供任务条件。'],['机器人状态','关节位置等状态单独编码，与上下文联合条件化。'],['Action Expert','使用 Transformer / Diffusion Transformer 等预测动作更新方向。'],['多步积分 / 采样','Flow Matching 方案迭代更新动作变量；具体步数依模型而定。'],['Action Chunk','输出未来若干控制步动作，由机器人控制系统消费。']],
    sample:['动作形状例子','假设一次输出 A=[B,Chunk,ActionDim]=[1,50,7]；若采样迭代 8 次，则 Action Expert 可能要执行多轮前向。','这里 50 与 8 均为示意；控制频率不等于动作头推理频率。'],
    compare:[['自回归动作 Token','复用语言 Token 解码机制','逐 Token 顺序和离散化成本'],['连续动作生成','一次输出动作块，适合连续动作','多步采样及低 Batch 推理延迟']],
    remember:['强化学习是可选的训练方法，不是所有 VLA 的运行时环节。','先区分视觉编码成本与动作专家多步成本。','优化模型延迟还要看动作播放、缓存与反馈周期。']
  },
  'world-model':{
    key:'世界模型主要预测环境如何变化；它可以服务于训练或规划，不一定在每次机器人实时动作中执行。',
    chain:[['历史观测','视频帧、状态以及可选动作条件描述当前上下文。'],['编码成表征','图像/状态被映射为潜变量或时空 Token。'],['时间与空间建模','利用时序 Attention、卷积或状态空间结构关联帧间变化。'],['预测未来','产生下一状态、未来潜变量或生成式未来帧。'],['交给下游','预测可用于规划、策略训练、仿真或候选动作评价。']],
    sample:['时空 Token 例子','每帧 256 Patch、16 帧，共 4096 Token；若使用全局注意力，注意力分数元素随 Token 数平方增长。','不是所有世界模型都执行全局 Attention；稀疏/局部/潜空间方案不同。'],
    compare:[['直接动作策略','观察→动作，实时链路短','未来预测能力依策略结构而定'],['世界模型辅助规划','能比较候选未来结果','生成成本和误差可能阻碍实时使用']],
    remember:['世界模型≠动作策略，二者可组合。','视频分辨率和帧数共同决定时空负载。','先认清预测目标，再分析其 GPU 计算结构。']
  },
  'vllm-scheduler':{
    key:'vLLM V1 Scheduler 本质是在每一轮把有限的 Token 预算和 KV 资源分配给请求，而不是固定地先运行全部 Prefill 再运行全部 Decode。',
    chain:[['请求队列','请求有状态、已计算 Token 数、等待与运行条件。'],['Token Budget','按 max_num_batched_tokens 等约束分配本轮可计算 Token。'],['KV Block 管理','判断已有缓存、需要新分配多少 Block，以及容量是否足够。'],['Model Runner','将本轮请求打包为模型前向输入，并调用设备执行。'],['更新请求状态','接收计算输出，推进 Token 数或返回等待/结束状态。']],
    sample:['预算例子（仅解释机制）','本轮预算 1024 Token，运行中请求合计需 128 Token，则在不受其他约束影响时可分配部分剩余预算给等待中的 Prefill。','真实调度还会受到优先级、缓存、LoRA、推测解码等约束，不能只看减法。'],
    compare:[['无 Chunked Prefill','长 Prompt 可能形成很大一次性工作','影响其他请求延迟'],['Chunked Prefill','将 Prompt 分批进入多轮预算','更复杂的调度与缓存管理']],
    remember:['Scheduler 负责每轮算谁、算多少。','KV 管理不只是存储空间，还会影响能否调度。','CPU 计划和 GPU 实际执行需在 Trace 上对齐。']
  },
  'kv-cache':{
    key:'Paged KV Cache 把逻辑上的连续 Token 历史映射到可复用的物理 Block，减少分配碎片；Prefix Cache 则使相同前缀的 KV 有机会复用。',
    chain:[['历史 Token','每层 Attention 产生历史 Key 和 Value。'],['逻辑 Block','按固定 Block Size 将 Token 的 KV 划分逻辑块。'],['Block Table','将请求的逻辑块映射到物理缓存块。'],['Attention 读取','Decode 根据映射索引读取所需历史 KV。'],['共享与回收','可复用前缀块，引用与释放遵守具体版本的管理策略。']],
    sample:['KV 体积例子（未压缩）','每 Token 的 KV 字节数约为 2×Layers×KVHeads×HeadDim×bytes_per_element；B、S 与复用情况决定整批 KV 规模。','共享前缀不代表所有请求都直接共享全部 KV；命中和释放条件很重要。'],
    compare:[['连续大块缓存','地址结构较简单','扩缩、碎片与预留浪费'],['分页 Block 缓存','按需分配、便于复用','映射与管理成本，访问形状更复杂']],
    remember:['逻辑顺序≠物理连续。','缓存命中由请求内容及实现规则决定。','KV 大小直接影响并发能力，但并非吞吐唯一瓶颈。']
  },
  'pd-disagg':{
    key:'PD 分离把 Prefill 和 Decode 放到不同实例以降低干扰、独立调优，但必须搬运 KV，并新增调度和网络成本。',
    chain:[['请求路由','将请求送往 Prefill 实例，并记录后续 Decode 去向。'],['Prefill 计算','处理输入上下文并构建用于续算的 KV Cache。'],['KV Connector','协调 KV 对应关系、可用性与跨实例搬运。'],['Decode 实例','接收必要状态并继续逐 Token 生成结果。'],['度量权衡','比较 TTFT、ITL/P99、吞吐与 KV 传输代价。']],
    sample:['关键路径例子','分离后的首 Token 相关路径可能包含：排队P + Prefill计算 + KV传输/同步 + D端就绪 + 首个输出；阶段可能重叠，不能简单总和当真实延迟。','两份模型运行不等于把 Transformer 按层一分为二；PD 说的是推理阶段隔离。'],
    compare:[['混部执行','少一次跨实例 KV 传输、资源共享更灵活','长 Prefill 可能干扰 Decode 尾延迟'],['PD 分离','可独立配置 P/D 容量及批处理','网络传输、KV 一致性与扩缩容复杂度']],
    remember:['分离的目标是 SLO 与资源隔离，而非保证单次请求更快。','KV 传输效率与请求负载决定收益。','必须比较同等硬件预算和真实请求到达分布。']
  },
  'serving-slo':{
    key:'推理部署的优化目标是请求级 SLO 下的有效吞吐与延迟分布，不是单一 Kernel 的平均执行时间。',
    chain:[['请求到达','真实流量具有并发、输入/输出长度与突发性。'],['排队/路由','等待调度时尚未消耗该请求的 GPU Kernel 时间。'],['Prefill 首输出','影响用户开始看到响应的时间，即 TTFT。'],['Decode 连续输出','每轮 Token 间隔形成 ITL、TPOT 与尾延迟。'],['服务运营','看吞吐、P95/P99、失败率、GPU 利用和成本。']],
    sample:['服务指标例子','同样每秒 1000 tokens/s，若大量请求 TTFT 超标或 P99 ITL 很高，在线服务仍可能不合格。','离线吞吐与线上 SLO 不可直接替代。'],
    compare:[['吞吐优先','较大 Batch 更易摊薄成本','排队和尾延迟可能上升'],['时延优先','限制排队、强调持续输出','单位 GPU 吞吐可能下降']],
    remember:['TTFT 与持续生成的 ITL 需要分别测量。','延迟分位数比平均值更能体现在线体验。','任何优化都应在明确 SLO 下比较。']
  },
  'compiler-lowering':{
    key:'编译器逐步把高层张量语义转换为具体设备程序；Runtime 则负责提交已经生成的 GPU 工作，两者职责不同。',
    chain:[['PyTorch 前向','定义运算与张量依赖；可以 Eager 执行，也可以图捕获。'],['TorchDynamo / FX','捕获可追踪的计算图；不支持路径可能 Graph Break。'],['Inductor 优化','针对捕获的图进行融合、布局决策与后端代码生成。'],['Triton / CUDA 后端','部分融合 Kernel 用 Triton 生成；也可能直接调用库 Kernel。'],['PTX / SASS 执行','生成设备代码，经运行时 Launch；具体指令映射需核对二进制。']],
    sample:['一段 Norm+Activation','假设两个算子原先分别写入、读取中间 Tensor，融合可能省一次全局中间写回和读取，但也可能增加寄存器压力。','不是每个 PyTorch 模型都必经 torch.compile；PTX 是虚拟 ISA，SASS 是实际机器指令。'],
    compare:[['Eager / 库执行','易调试、算子库成熟','多个 Kernel 边界与中间数据可能增加开销'],['图编译 / 融合','能跨算子消除冗余数据搬运','编译耗时、Graph Break、布局和寄存器权衡']],
    remember:['Graph → IR → Lowering → Codegen 是编译路径。','Runtime / CUDA Graph 不等于编译器。','确认实际 Kernel、布局和 SASS 才能解释性能变化。']
  },
  'triton-tiling':{
    key:'Triton 中 Tile 与 Layout 的选择会改变并行 Program 数、内存事务、寄存器压力和最终指令；没有通用最优 Tile。',
    chain:[['逻辑张量','从 M/N/K、dtype、Stride 明确数学问题和存储布局。'],['分块 Tile','每个 Program 计算一个输出子区域，并沿 K 维迭代。'],['搬运与复用','合并访问、片上暂存、矩阵指令依具体后端决定。'],['编译和资源','Layout、Warp 数、寄存器、SMEM 改变 Occupancy 和指令序列。'],['测量性能','用 NCU/NSYS 和正确性验证选择参数。']],
    sample:['Tile 数例子','M=1024、N=2048、BLOCK_M=64、BLOCK_N=128，则 16×16=256 个输出 Program；还需考虑 K 与布局。','Program 多不代表 Tensor Core 利用率高，Tile 大也未必更快。'],
    compare:[['小 Tile','Program 多、资源压力可能较小','重复搬运和调度成本可能增加'],['大 Tile','潜在重用更多、Program 更少','寄存器/Shared Memory 压力、尾块浪费']],
    remember:['Shape 与 Stride 决定访存模式。','布局与并行度必须一起看。','无正确性检查的性能结论不可靠。']
  },
  'runtime-graph':{
    key:'CUDA Graph 通过预先记录可重放的 GPU 工作图，减少重复提交开销；它不保证某个单独 Kernel 的设备执行时间变短。',
    chain:[['构建 GPU 操作','普通路径每轮由 CPU/Runtime 提交 Kernel 与 Memcpy。'],['Graph Capture','在满足限制的场景下记录设备任务及其依赖。'],['图实例化','完成图相关准备，可能有额外内存及初始化成本。'],['Graph Replay','用较少 CPU 提交工作重放图中的设备操作。'],['时间线验证','比较空档、CPU 提交、图重放和设备 Kernel 时长。']],
    sample:['重复 Decode 例子','固定或可兼容的执行形状，重复发射大量小 Kernel 时，Graph Replay 有机会减少 CPU 发射开销。','Graph Replay 不等于把多个 Kernel 融合成一个；动态输入可能遇到 Graph Capture 限制。'],
    compare:[['普通 Launch','灵活动态控制、更直接调试','频繁小 Kernel 的 CPU 提交成本'],['CUDA Graph','减少可重复任务的提交开销','图捕获限制、额外内存、形状管理']],
    remember:['Graph 改的是任务提交方式。','编译融合改的是 Kernel 边界与执行代码。','区分 CPU 空档改善与 Kernel 内部加速。']
  },
  'gemm-tiling':{
    key:'GEMM 性能由计算形状、数据复用、片上存储与硬件矩阵指令共同决定，不能只看峰值 FLOPS。',
    chain:[['输入矩阵','A[M,K] 与 B[K,N]，Shape/dtype/布局先决定问题。'],['划分输出 Tile','每个 CTA/Program 负责部分 [BLOCK_M,BLOCK_N] 输出。'],['加载 K 分块','共享/重复使用 A、B 数据，搬运成本受布局与缓存影响。'],['矩阵计算','Tensor Core 或 SIMT 执行乘累加，指令路径取决于数据类型。'],['写回与后处理','Accumulate、Scale/Epilogue 再输出 C[M,N]。']],
    sample:['算术量','矩阵乘法理论 FLOPs 约为 2MNK；但小 M 的 GEMV 式 Decode 不一定高效使用 Tensor Core。','算术强度是估算上界的工具，不是实际执行时间公式。'],
    compare:[['计算受限','矩阵指令与乘加吞吐是重点','硬件利用和数据供应'],['访存受限','数据搬运与缓存复用更关键','带宽下界、事务、低算术强度']],
    remember:['先记录 M/N/K、dtype、Stride。','算术量与内存流量共同决定上界。','Tile 设计要验证寄存器/SMEM/占用与真实时间。']
  },
  'attention-tiling':{
    key:'FlashAttention 的关键不是改变注意力数学语义，而是分块处理 Q/K/V 并在线维护 Softmax 统计量，避免把完整 N×N 注意力分数写入 HBM。',
    chain:[['Q Tile','读取局部 Query 块并准备输出累积。'],['K/V Tile 循环','分批读取 Key 和 Value，在片上计算局部 QKᵀ。'],['在线 Softmax','更新每行最大值和归一化统计，保证数值稳定。'],['加权累积','在线累计 exp(score)×V，无需存全局分数矩阵。'],['输出 Tile','将累积值归一化为输出 O Tile，最后写回全局内存。']],
    sample:['IO 量对比','普通显式注意力可能产生 [B,H,S,S] 分数张量；分块在线算法避免完整矩阵写回，但仍要计算 QKᵀ。','FlashAttention 不代表注意力复杂度从 O(S²) 自动变成 O(S)。'],
    compare:[['显式分数矩阵','数学表达直观、易于教学验证','S² 的中间结果读写/存储压力'],['FlashAttention','减少中间结果 HBM IO','更复杂的 Tile、归约与同步，寄存器/SMEM 限制']],
    remember:['核心是 IO-aware 分块，不是减少全部注意力乘法。','在线 Softmax 维护 m、l 等统计量。','长 Prefill 与短 Decode 的最佳后端可能不同。']
  },
  'profiling':{
    key:'性能归因是一个证据链：先确定端到端热点，再在 NCU 中分析原因，最后用对照实验排除其他解释。',
    chain:[['端到端时间线','用 NSYS 看 CPU/GPU 任务、排队、Memcpy 与空档。'],['定位关键 Kernel','检查热点在总延迟/关键路径上的占比及调用次数。'],['收集硬件指标','NCU 分析 Stall、访存、Tensor Core、资源和指令。'],['提出可证伪假设','例如是依赖延迟、带宽、SMEM 或 Launch 限制。'],['受控对照验证','固定 Shape/设备/配置，重复测量并排查正确性。']],
    sample:['典型误判','看到 Occupancy 12% 并不能直接断言“提高 Occupancy 一定加速”；要结合 Eligible Warp、Pipe Busy 和瓶颈证据。','某个 Kernel 快 30% 不代表模型整体会快 30%。'],
    compare:[['先调 Kernel','可能迅速发现局部热点','忽略系统关键路径和框架等待'],['先看 Timeline','先分清 CPU/调度/Kernel/通信占比','随后仍需 NCU/微基准深入根因']],
    remember:['时间占比与硬件原因必须分开。','一个 Counter 通常不足以证明根因。','优化结论必须有正确性与受控实验。']
  },
  'host-runtime':{
    key:'GPU 空闲未必是 GPU 算不动；CPU 线程、内存准备、DMA、驱动和同步都可能使任务未及时提交。',
    chain:[['CPU 进程线程','数据准备、框架调度、提交 API 与同步。'],['主机内存','普通内存 / Pinned Memory 可能决定 H2D 搬运路径。'],['CUDA Runtime / Driver','通过 Stream、Event 和依赖提交任务。'],['DMA 与设备工作','数据传输与 GPU Kernel 可在满足条件时重叠。'],['结果与同步','等待结果或错误同步会暴露大量空档。']],
    sample:['时间线例子','Kernel 耗时 10 μs，但相邻 Launch 之间空出 40 μs；需追踪 CPU API、同步与调度，不应只优化 Kernel。','异步 API 不代表一定同时进行，依赖/硬件资源可能禁止重叠。'],
    compare:[['同步式调用','流程简单、易定位错误','可能阻塞 CPU 或 GPU 流水'],['异步流水','有机会并行传输与计算','依赖、缓冲与正确性更复杂']],
    remember:['先问“谁在等待”，再问硬件瓶颈。','Pinned Memory 与 DMA 解决的是数据通路。','NSYS 的 CPU/GPU 对齐时间线非常重要。']
  },
  'multi-gpu':{
    key:'模型并行的收益来自单卡容纳不了的权重或并行计算，而代价是同步/通信；通信形状和网络拓扑直接决定可扩展性。',
    chain:[['模型切分','TP、PP、EP 等按不同维度分布权重与计算。'],['每卡局部计算','各卡处理自己的矩阵分片或专家 Token。'],['跨卡通信','All-Reduce / All-Gather / All-to-All 或点对点流量。'],['同步与合并','等必要数据到齐继续后续层或返回结果。'],['端到端评估','比较吞吐/GPU、尾延迟、通信时间与资源利用。']],
    sample:['TP 的简单场景','一层 GEMM 切在两张 GPU，局部计算并行，但后续常需要集体通信才能得到正确输入/输出。','EP 使用 All-to-All 的通信模式与 TP 的 All-Reduce 不同。'],
    compare:[['单卡部署','无需跨卡同步、部署简单','容量或算力受限'],['分布式部署','支持更大模型和并行资源','网络/同步/负载均衡成本']],
    remember:['TP、EP、PP 的切分维度不同。','网络开销要看传输量、拓扑和同步。','扩卡不保证每卡有效吞吐同步提高。']
  },
  'warp-issue':{
    key:'一个 Warp 阻塞不代表整个 SM 停止：调度器可以从其他符合条件的 Warp 中发射指令，但也会受数据依赖与执行资源限制。',
    chain:[['驻留 Warp','线程块占用寄存器、SMEM 和 SM 执行资源。'],['Scoreboard 检查','判断待发射指令的输入是否就绪。'],['Warp Scheduler','从可发射 Warp 中选择指令。'],['执行流水线','标量、访存、Tensor Core 等各有吞吐与延迟限制。'],['结果可用','写回/依赖满足后后续指令才可执行。']],
    sample:['等待并发例子','某 Warp 的 load 依赖尚未满足，调度器可能转而发射另一个就绪 Warp；若所有 Warp 同时等内存则出现空泡。','提高理论 Occupancy 不一定提升 Eligible Warps。'],
    compare:[['延迟受限','依赖链深，需要可并行工作隐藏等待','增加就绪 Warp 与调度机会'],['吞吐受限','目标 Pipe 已忙，更多 Warp 也无法增加峰值','优化指令数量/数据复用']],
    remember:['Latency ≠ Throughput。','Scoreboard 追踪依赖，Scheduler 选择可发射工作。','Stall 原因需要配合 Pipe 利用率解释。']
  },
  'memory-route':{
    key:'寄存器、Shared Memory、L1/L2 与 HBM 有不同的作用和控制方式；Shared Memory 不是 L1→L2→HBM 自动缓存链路的普通一级。',
    chain:[['GPU 内核 Load','指令指定地址空间和访问模式。'],['寄存器 / SM 内部','线程直接使用寄存器；Shared Memory 由程序显式管理。'],['缓存路径','Global Load 可能经过 L1/L2，命中与缓存策略取决于架构/访问。'],['HBM','长距离容量大、带宽高，仍存在访问延迟。'],['数据复用','Tile/布局/访问合并改变数据访问次数与事务量。']],
    sample:['Gather 例子','离散索引访问不一定充分合并，可能造成实际搬运字节远大于有效数据字节。','L2 Hit Rate 高不等于 Kernel 一定快；还需依赖、请求数和事务。'],
    compare:[['随机访问','访问模式灵活','缓存局部性与合并效率可能差'],['Tiled 复用','在片上复用减少重复读取','寄存器/SMEM 占用及同步成本']],
    remember:['区分 Address Space、Cache 和显式 Shared Memory。','访存事务/依赖比数据字节数更接近真实行为。','性能分析先核对源代码访问模式。']
  },
  'tensorcore-b200':{
    key:'Blackwell 上矩阵计算可借助专用 Tensor Core、异步搬运与同步配合；软件必须匹配指令、布局和硬件资源。',
    chain:[['全局输入','矩阵数据位于 HBM/L2 等层次。'],['异步搬运','适用情况下通过 TMA 等机制将数据送入可计算的片上区域。'],['矩阵计算指令','依赖具体 CUDA/编译后端和 dtype 调度 Tensor Core 操作。'],['同步与完成','等待数据就绪及计算结果可用，维护 Barrier 依赖。'],['结果输出','后处理、写回与下一 Tile 重叠需要正确编排。']],
    sample:['Pipeline 例子','计算当前 Tile 时预取下一 Tile，可隐藏部分搬运时间；如果 Barrier 等待错误则结果可能不正确。','不要把所有 Blackwell GPU 产品视为完全相同的矩阵指令/资源配置。'],
    compare:[['串行加载与计算','简单、易验证','Load 与计算难重叠'],['异步流水','更好隐藏部分搬运等待','布局、Barrier、存储资源与正确性复杂']],
    remember:['Blackwell 微架构知识需参照具体设备与官方指南。','异步并不意味着依赖自动消失。','用 SASS / Profiling 核查实际设备指令。']
  },
  'spec-decode':{
    key:'推测解码用较便宜的草稿提出候选，再由目标模型批量验证，目标是减少高成本的串行生成轮数，而非消灭主模型计算。',
    chain:[['Draft 候选','小模型、EAGLE/MTP 等路径生成候选 Token。'],['Target 验证','主模型对候选位置进行验证计算。'],['接受/拒绝','按推测解码算法决定能接受的 Token 前缀与补偿采样。'],['缓存与状态更新','保留正确 KV 状态，处理拒绝后的回退或修正。'],['下一轮输出','接受长度与 Draft 成本共同决定实际加速。']],
    sample:['接受率理解','平均一次 Target 验证接受多个 Token，可能减少主模型串行轮数；但 Draft 和 Verify 本身有耗时。','MTP、独立 Draft 模型和不同采样语义不能混为一个实现。'],
    compare:[['普通 Decode','执行路径较简单','每次 Target 前向只追加少量 Token'],['Spec Decode','可能减少目标模型串行调用','候选质量差或 Draft 昂贵时反而慢']],
    remember:['加速取决于接受长度与额外开销。','保持采样语义需要正确的验证算法。','评估时包含 Scheduler、KV 管理和真实服务负载。']
  },
  'quant-pipeline':{
    key:'权重、激活和 KV Cache 的量化是三个不同问题；低位宽存储需要 Scale/布局/支持的 Kernel，内存减半不代表速度翻倍。',
    chain:[['选择量化对象','权重 W、激活 A、KV Cache 可采用不同格式。'],['Scale 与编码','按照粒度确定缩放因子、表示范围与量化误差。'],['打包与存储','产生低位宽数据和元信息，改变布局与字节流量。'],['计算后端','依硬件/Kernel 使用低精度 MMA 或融合反量化。'],['质量与性能验证','比较误差、实际 Kernel、显存和端到端 SLO。']],
    sample:['类型区分','W8A8 是权重和激活形式，KV FP8 指历史缓存；FP4 和 FP8 并非只差“半个字节”。','不检查实际内核路径就宣称量化提速是不可靠的。'],
    compare:[['高精度 BF16','数值语义和库支持更成熟','权重/访存占用较高'],['低精度量化','可降低存储与数据搬运压力','Scale/重排、低精度 Kernel 和精度风险']],
    remember:['先问量化哪个张量。','Scale 和 Pack Layout 是数据的一部分。','质量、真实速度和显存都要验收。']
  },
  'fused-norm':{
    key:'RMSNorm 是归约，RoPE 是位置相关的成对旋转，SwiGLU 是门控激活；它们是不同类型的计算，不能为了融合而混为同一个算子。',
    chain:[['RMSNorm','沿隐藏维汇总均方并归一化；有归约依赖。'],['Q/K 的 RoPE','基于位置对特征维成对旋转，依赖布局约定。'],['MLP 的 SwiGLU','Gate 与 Up 经过激活和逐元素相乘。'],['可选邻接融合','仅对合法相邻操作合并 Kernel 或 Epilogue。'],['验证与 Profiling','检查误差、临时内存、寄存器和 Kernel Launch。']],
    sample:['计算关系','RMSNorm(x)=x/sqrt(mean(x²)+eps)*weight；RoPE 对部分 Q/K 特征维做位置旋转。','以上三者并不在 Transformer 前向里必然首尾串接或一起融合。'],
    compare:[['拆分 Kernel','调试简单、库复用好','产生临时 Tensor/Launch 开销'],['局部融合','减少部分中间访存/Launch','可能增大寄存器、影响重用和数值顺序']],
    remember:['先弄清语义及数据依赖，再考虑融合。','融合节约的字节不等于同倍数提速。','检查数值容差和边界 Shape。']
  },
  'mla-kv':{
    key:'MLA 利用低秩潜变量压缩历史 KV，并通过投影重排把部分计算移到查询侧；缓存省了，但投影并非零成本。',
    chain:[['隐藏状态压缩','生成较窄的 KV 潜变量和位置相关分量。'],['缓存历史','缓存潜变量而不是显式保存全部展开的 K/V。'],['查询投影','Q 与位置编码路径准备 Attention 条件。'],['矩阵吸收','通过等价变换减少显式 KV 展开；实现因模型不同。'],['MLA Decode','读取压缩缓存并执行专用 Attention 路径。']],
    sample:['表示法','设 KV latent 维度 d_c 远小于所有 Head 展开后 K/V 维度，存储可降低；运行时仍需相关投影。','MLA 不等于 GQA，具体 Rotary 分量、缓存布局由模型定义。'],
    compare:[['显式 KV','计算形式较直观','每 Token 历史 KV 体积较大'],['压缩 KV/吸收','历史缓存更省、利于长上下文','投影及算子实现更复杂']],
    remember:['明确缓存的是哪种表示。','注意位置编码与内容分量。','Cache 节省是否转成性能收益必须实测。']
  },
  'linear-state':{
    key:'线性注意力/状态模型常通过可更新状态汇总历史信息；理论复杂度降低后，Decode 仍可能因为状态访问、依赖和 Kernel Launch 而慢。',
    chain:[['输入/门控','将 Token 特征映射成更新所需参数。'],['Chunk Prefill','分块并行计算状态转移与局部结果。'],['状态合并','把每块贡献组合成可继续递推的状态。'],['Recurrent Decode','用新 Token 与旧状态生成新状态和输出。'],['长期验证','检查数值稳定性及 Chunk/Decode 一致性。']],
    sample:['关键差异','普通 Softmax Attention 读取历史 KV；一些 Linear Attention 把过去压缩为固定形状状态，但不同算法公式各异。','线性复杂度不保证小 Batch 延迟低，也不保证状态足够小能常驻寄存器。'],
    compare:[['Softmax Attention','语义标准、生态成熟','长 KV 随上下文增长'],['状态递推形式','某些形式长序列效率更好','状态更新、误差累积与特殊 Kernel']],
    remember:['先区分具体 Linear Attention / SSM 公式。','Prefill 的 Scan 与 Decode 的状态更新负载不同。','低复杂度是趋势，不是硬件实测结论。']
  },
  'frameworks':{
    key:'推理引擎比较必须同时锁定模型、后端、调度和 SLO；不能用一次 Offline tokens/s 排名代表所有部署场景。',
    chain:[['模型功能要求','量化、MoE、上下文、API、TP/EP 的支持是先决条件。'],['服务入口','请求管理、流控与路由决定队列和可观测性。'],['调度与缓存','不同 Scheduler、Prefix Cache 与 KV 策略影响有效 Batch。'],['Kernel 后端','Torch/CUDA/Triton/TensorRT 等实际执行路径不同。'],['SLO 评估','按同等资源和流量比较 TTFT、ITL、吞吐与稳定性。']],
    sample:['对比框架','vLLM、SGLang、TensorRT-LLM 等常有不同默认设置；应固定模型版本、精度、输入/输出分布和硬件预算。','专用引擎可能没有通用 Serving 的所有功能。'],
    compare:[['功能/易用性优先','开发成本和模型兼容性较低','个别特定负载未必最优'],['专项性能优先','针对特定硬件/模型可能更高效','版本适配、可观测性和维护成本']],
    remember:['先确认框架功能边界。','对比必须对齐后端与测试负载。','在线 P99 和失败率不能用 Offline 峰值替代。']
  }
};
