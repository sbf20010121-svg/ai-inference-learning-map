# 引擎、系统与 GPU 课程复核

日期：2026-11-19。范围为 **30 门课、104 个现有章节**，包括 18 门基础课和 12 门旧课。课程 ID、章节 ID、领域归属、学习记录与云同步协议均未改变。

本次复核检查的是：章节提出的问题能否由当前图回答；符号是否能就地理解；图、公式、代码和题目是否在解释同一对象；数值与状态变化是否满足不变量；工程观察与性能结论之间是否保留必要条件。保留已经准确、适合当前问题的章节，不给所有章节追加统一的六段模板。

## 修正的主要问题

1. **取消、完成、回收原来共用同一张结果返回图。** 现在可逐事件追踪批次提交、取消消息、设备完成、释放 A 引用。P3 保持 A/B 共享身份，P7 保持 A 独占身份；取消不会让在途访问凭空结束，释放 A 也不会清空 B 的块。
2. **异步占位只画了总体时间线。** 占位章改成具体的“位置预留—元数据准备—真实 Token 就绪—绑定执行”事件表。CPU 2 拍、GPU 4 拍的三轮理想重叠总计 14 拍，并明确首次启动、结果依赖及零绑定成本假设。
3. **几个章节拿到了其它章节的证据。** 显存预算题原来问文件分片；NUMA 章原来显示页地址换算代码；DP 章原来考 TP 归约；PP 慢段章原来代码仍用两段各 1 拍。现已按章修正。
4. **Warp 资源章误用了 Delta 状态矩阵成本图；引擎后端章误用了编译导论图。** 已分别换成寄存器驻留账本，以及同请求在不同能力条件下的派发表。没有虚构 Spill 字节、Kernel 性能或真实产品支持表。
5. **TTFT/ITL 章承认旧图只能算单次响应，仍没有可追踪的流式输出。** 新图用同一请求的 3 个交付时间戳分别计算 TTFT、每个 ITL 和整体完成时延；改变前置等待后可以看到它们的不同反应。
6. **PD 的转运成本被笼统放到 TTFT。** 新图显式选择“P 算完即交首 Token”或“等 D 首次输出才交付”。首 Token 已经交付时，后续转运不能再加入已结束的 TTFT；它可能扩大下一次 ITL。该对照是观测边界教学，不宣称特定 Connector 行为。
7. **量化后端章仍只画舍入数轴。** 新图追踪同一组整数码、Scale、浮点权重及点积结果，比较消费时解码与全量展开的缓冲账本。两个路径都得到 −3.5；8/24 Byte 是限定对象的空间比较，不是加速比。
8. **部分图只有相关标题，没有展示本章机制。** Scheduler→Runner 章现在展开每请求位置与 Packed 区间；Shared 章显示同 Tile 被两个消费者重用；开放/闭环负载章保留不同到达时间；拓扑章比较相同逻辑环在不同节点放置下的跨节点字节；Occupancy 章在相同驻留量下切换 Eligible 状态。

## Scheduler 场景衔接补充修正

再次按读者直接进入章节的路径检查，发现主课程使用 B 的6位置输入，旧详解使用10位置输入，实验馆又使用“两条 Decode + C 的9位置输入”；它们各自的算术可以成立，但缺少场景切换说明。主图的“观察轮次”还只换了说明，没有突出当前轮的输入和结果。预算守恒通过不能证明这些前提已经讲清楚。

- 主课程、课程动画、旧详解和公式例统一使用 `scheduler-model.js`：A起点已算6位置、占2块；B/C输入分别6/4位置、都未算。固定A→B→C顺序，每轮预算重置，每块4位置，轮次同步完成。
- 主课开场直接解释Scheduler的职责和标题里的Chunked Prefill（分块预填充）；预算章用C的4个输入分两轮算1+3明确对应这个名称，避免只能从旧资料找到术语定义。
- 三轮默认分配为 **1/6/1 → 1/1/3 → 1/1/1**，实际用量8/5/3，未用预算0/3/5。请求B不再与预算符号混用；预算写为 `T_budget`。
- 对象图显示所选轮的轮前状态、选中位置和执行完成后的状态；区分“Prompt剩余为0”和“下一轮仍需Decode1”，不把采样直接记为已计算位置。
- 预算图逐请求推导候选数量；KV图另显示新增块需求、拒绝原因和尾块空槽。容量降到2块后，首轮只有A1，第三轮全部暂缓；预算未用不代表KV可分配。
- Runner使用同一分配结果生成请求内位置与Packed半开区间。诊断题改为当前图的KV限制场景，不再继承另一道预算题。
- 实验馆保留独立的“A/B均已生成、C有9位置输入”例，在图前明确标注独立场景，保持其1/1/6与1/1/3的有效对照。

新增 `tests/scheduler-teaching.test.mjs` 检查跨视图同源、快照连续性、采样与计算的边界，以及预算不足与KV拒绝的差别。`audit-system-spine.cjs` 增加桌面/手机五种场景截图与状态断言；本次提交实际运行结果与逐图复核记录在 [PR #6](https://github.com/sbf20010121-svg/ai-inference-learning-map/pull/6)，不沿用修改前的截图作为通过证据。

一手核对：[vLLM SchedulerInterface](https://docs.vllm.ai/en/latest/api/vllm/v1/core/sched/interface/)说明每请求调度量和Runner输入准备职责；[架构说明](https://docs.vllm.ai/en/latest/design/arch_overview/)还包含抢占、异步等分支。本例的固定次序、无新到达/停止/抢占、无推测解码均为教学边界，不宣称复现动态文档当前版本。

## 全部章节的复核范围

“保留”表示本次检查未发现需要重写的机制，不表示已经进行真实设备或全源码验证。每行列出的章节是该课的全部章节。

| 课程 | 全部章节 ID | 检查对象、判断与改动 |
|---|---|---|
| request-lifecycle | identity, cancel, finish | 请求身份与行号分离；新增完成事件/引用回收状态表；纠正 refcount 与缓存驻留的混用；收尾代码对应实际回收问题。 |
| model-loading | files, bytes, dtype | 保留文件行分片与 TP 列分片对照；预算为 16−8−2−1=5 MiB；题目改测工作区增大后的 3 MiB；新增 int8 码/Scale/展开副本的 8/24 Byte 例。 |
| batch-executor | pack, workers, return | 保留 [3,1] 与 [1,3] 打包边界；权重分片和批次身份一致；新增逐行输出归属表，注明 Packed 行并非都直接对应新生成 Token。 |
| kv-preemption | capacity, evict, resume | 统一正文、图与代码为 B 已算 4 位置、1 块，第 5 位置需要第 2 块；抢占仍保留请求和离散序列；明确回收时无未完成访问的假设及重建成本。 |
| async-engine | overlap, placeholder, critical | 分开可提前的元数据与未知真实 Token；CPU/GPU 依赖与三轮 14 拍一致；稳态 4 拍不等于三轮总计 12 拍。 |
| backend-dispatch | matrix, selection | 核对 dtype、head dim、量化条件求交集；保留教学 A/B 支持矩阵与日志/Kernel 路径边界，不编造真实后端排名。 |
| admission-backpressure | queue, policy, fairness | 队列上限包含所有接纳与拒绝；新增同预算 8 位置下 A8/B0 与 A6/B2 的配额对照，表明分配规则改变对象而不增加容量。 |
| process-threads | spaces, states, race, lock | 独立进程同数值地址不保证共享；阻塞/就绪/运行有明确事件；读改写交错得到 1，完整保护得到 2；保留语言内存模型边界。 |
| host-memory-pages | pages, pin, numa | 页地址公式与代码移到 pages；Pinned 与 DMA 完成分离；NUMA 图明确 GPU 接节点 0 的教学假设并补 Linux 官方依据。 |
| cuda-context | owners, boundary | 同进程线程与主要 Context 不按线程数复制；跨进程指针数值不足以建立访问关系；boundary 题目改考实际 IPC/生命周期问题。 |
| tensor-parallel | column, row, data | x=[1,2]、W=[[1,2],[3,4]]，列切分拼接 [7,10]，行切分 [1,2]+[6,8]；DP 题目改考独立请求完整副本。 |
| pipeline-parallel | wave, boundary, imbalance | 保留批次身份、段间前向依赖与 PP/PD 对象区别；慢段代码改为 [1,2]，完成时刻 [3,5,7]，不再用等长 4 拍例回答慢段。 |
| collective-topology | ring, volume, topology | 阶段边界保持坐标归约；发送量为每 Rank 单向 2(p−1)N/p；新增 4 Rank 放置对照，总发送 96 Byte 不变，跨节点部分 48→96 Byte。 |
| deployment-compatibility | layers, matrix, manifest | 应用/容器、宿主 Driver 和实际 GPU 边界分别显示；三个支持条件须共同满足；配置记录不被当成运行与性能验证。 |
| gpu-execution | indices, scope, schedule | CTA1/thread5→global69/warp0/lane5；thread37→warp1/lane5；共享范围与 SM 安排分开；两种手工调度不改变逻辑职责。 |
| shared-bank | map, padding, broadcast | 32-bit Word 的 Stride32/33 分别给 32 路/1 路不同字访问；同字广播不误算冲突；各章初始状态改为与本章问题相应的地址模式。 |
| occupancy-resources | limits, counter, eligible | 各资源约束取最小值；32→96 寄存器使本虚构设备 4→2 CTA；Eligible 章新增相同 100% 驻留下 0/2 个就绪 Warp 的对照。 |
| measurement-stability | cold, distribution, conditions | 冷启动单列，五样本不报 P99；8/8/8/14/14 的均值 10.4、中位数 8；distribution 默认显示该例；环境相关不直接推因果。 |
| vllm-scheduler | requests, budget, kv, rounds, runner, diagnose | 预算守恒与 KV 容量分别核对；明确采样出的新 Token 与下轮模型计算分开；Runner 图新增请求内位置、Packed 行区间和累计边界。 |
| kv-cache | address, prefix, append, release, capacity | 保留逻辑块→物理块、完整前缀身份、尾块追加与碎片；release 明确在途结束后减引用；活动引用为零不意味着缓存内容立刻失效。 |
| pd-disagg | ownership, bytes, delivery, critical | 标准 KV 字节推导、目标块预留与完成依赖各自对应；bytes 公式改为本章体积；critical 新增首发策略对 TTFT/ITL 边界的对照。 |
| serving-slo | arrival, metrics, threshold, load | 单服务台到达/响应与阈值保留；metrics 新增 3 Token 时间戳；load 新增开放 [0,1,2,3] 与闭环 [0,3,6,9] 到达，服务能力相同。 |
| host-runtime | owner, pipeline, dependency, observe | Host 输入可复用、设备计算完成、D2H 输出可读分别受依赖约束；两批 3/5 ms 理想双缓冲共 13 ms；dependency 骨架改为精确 Event 生产消费。 |
| multi-gpu | partition, reduce, gather, cost | 输入 [1,2]/[3,4] 的 AllReduce 为每卡 [4,6]；AllGather 为 [1,2,3,4]，ReduceScatter 为 [4]/[6]；按章补拼接/归约骨架，不由字节或卡数推出时延。 |
| warp-issue | dependency, states, hide, resources | load 周期 0→4 的依赖不被其它 Warp 缩短；Active/Eligible/Issued 集合分开；resources 换成对应的资源账本并保留 Spill/计时证据要求。 |
| memory-route | addresses, coverage, shared, measure | 8 线程、32 Byte 有效负载，Stride1/8 覆盖 1/8 个段；Shared 改成同 Tile 的双消费者复用图；逻辑访问与实际 DRAM 流量分别解释。 |
| tensorcore-b200 | tile, double, barrier, limits | 复核公开 PTX 8.8 的 SMEM/TMEM 区别、32 列×128 lane×4 Byte=16 KiB 分配单位及完成协议；逻辑裁片不冒充合法 MMA 形状；人工拍数不冒充 B200 周期。 |
| spec-decode | draft, accept, reject, cost | q 提案、p 条件分布及平均接受质量正确；拒绝分支使用正残差；两种 q 均重新合成 p；保留单步推导不等于多候选 KV 回退与加速验证的边界。 |
| quant-pipeline | grid, range, format, backend | 保留整数网格、范围/误差与浮点结构区别；backend 改为实际解码/点积账本和匹配题目；没有把该整数例冒充 FP8/FP4 格式。 |
| frameworks | contract, backend, tail, repeat | 保留固定预算/模型与 A/B 合成长尾；backend 换成能力匹配和实际派发表，避免把编译导论当引擎差异；原始失败样本和预热条件须保留。 |

## 本轮使用的一手依据

以下是复核的具体依据，不代表逐函数审计了整个项目。动态文档按本次日期查阅；数值例与图为本项目原创教学构造。

| 一手资料 | 本次核对用途 |
|---|---|
| [vLLM Architecture Overview](https://docs.vllm.ai/en/latest/design/arch_overview/) | Scheduler/Executor/Worker/Runner 职责；Token 预算、重计算抢占及异步占位；注意抢占与取消不同。 |
| [vLLM Automatic Prefix Caching](https://docs.vllm.ai/en/latest/design/prefix_caching/) | 活动引用、空闲队列与缓存淘汰不是同一状态；共享块不能因一个请求结束而覆盖。 |
| [vLLM Disaggregated Prefilling](https://docs.vllm.ai/en/latest/features/disagg_prefill/) | P/D 的角色与 KV 连接器边界；本文另用明确交付策略分析 TTFT/ITL，没有归因给未审计的特定实现。 |
| [CUDA API Synchronization Behavior](https://docs.nvidia.com/cuda/cuda-runtime-api/api-sync-behavior.html) | API 返回、数据传输完成与 Kernel 完成分离；Async 名称本身不足以证明并行或安全复用。 |
| [CUDA Best Practices](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html) | Shared Bank、Padding 与广播；驻留约束和性能不由单一 Occupancy 数字决定。 |
| [NCCL Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html) | AllGather、AllReduce、ReduceScatter 的坐标、拼接与归约语义；指定 ring 字节量是本项目独立推导。 |
| [Linux NUMA Memory Policy](https://docs.kernel.org/admin-guide/mm/numa_memory_policy.html) | 分配节点与运行 CPU 的相对关系；图的 GPU 挂接位置是明示假设。 |
| [PTX ISA 8.8 Tensor Memory](https://docs.nvidia.com/cuda/archive/12.9.2/parallel-thread-execution/index.html#tensor-memory) | 保留固定版 32 列分配单位、128 lane、SMEM/TMEM 与异步完成边界。 |
| [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) | 提案接受与残差补偿保持目标分布；不将单步接受概率当实际加速比。 |

## 验证与边界

- `tests/engine-system-review.test.mjs` 的 **10 项**通过：取消/在途/共享引用安全、CPU/GPU 依赖及启动排空、TTFT/ITL 边界、打包与队列、双预算、PP/ring、Bank/驻留、推测质量守恒和量化点积、拓扑/配额、开放/闭环负载。数值预期由独立算式或状态不变量给出。
- 同时运行现有课程结构与机制测试，全部当前章节能生成对应机制内容。该项是代码渲染验证，不冒充浏览器布局验收。
- 本地 Chromium 启动被执行环境的 socket 权限拒绝，没有产生可用截图。浏览器与全站验收统一以主审查记录及隔离 CI 的实际结果为准，不能把本地失败尝试记成通过。
- 不包含真实 GPU 指令生成、Profiler、机器人任务或人类学习效果实验。没有读取或改写真实私人笔记；新模型无存储或网络副作用。

## 手机截图复核与修正

实际逐张读取取消、异步、Warp资源、流式指标、Runner及Shared的1365/360两种宽度，共12张截图。桌面数字与对象关系一致；手机发现小表关键列藏在右侧、SLO时间图缺少固定宽度导致字号过小。修正后，桌面表格与手机完整字段记录共享同一份行数据；SLO保留600px绘图宽度、异步使用0/2/…/18整数刻度，并提供明确的局部横滑提示。未修改计算模型或状态机。

相关41项测试通过。生成内容另外核对取消释放后的P3=B/1/不可复用、P7=无/0/可复用，Runner三个Packed区间，Shared输出10/30及SLO等待4ms时TTFT6、ITL2/4、完成12。修正后的实际截图与最终集成结果以[PR #6](https://github.com/sbf20010121-svg/ai-inference-learning-map/pull/6)记录为准，不能用修前截图替代。
