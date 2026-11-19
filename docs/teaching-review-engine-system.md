# Engine / Systems / Microarchitecture 连续正文审读

核查日期：2026-11-19。正文文件：`site/js/teaching-engine-system.js`。

## 本次完成的范围

本轮按照 AGENTS.md 顶部“内容决定表达方式”的最新规则，实际改写 `allCourses` 中 `engine`、`systems`、`microarch` 三个领域的全部 30 门课、104 个既有章节。课程 ID 和章节 ID 全部保持。每门课都有连续开篇、必要前置知识的原位解释、逐章正文、整体收束和一手资料；主文不依赖打开旧交互才能读完。

这次没有把原问句列表批量改成陈述句后就宣布完成。不同内容采用不同方式：状态与所有权用连续因果说明；身份、协议与比较用表；容量、索引、概率和资源限制用 MathML、变量表及推导；确实需要看地址或时间关系的章节才引用静态图。计数只是覆盖证据，不是学习有效性的评分。

| 课程 ID | 章数 | 本次正文建立的主要认识 |
| --- | ---: | --- |
| vllm-scheduler | 6 | 多请求争用资源；输入处理与持续生成的取舍；预算、KV 与跨轮状态一起约束推进 |
| kv-cache | 5 | 逻辑位置查块表；共享前缀的条件；追加、引用、回收与容量 |
| pd-disagg | 4 | P/D 边界的状态交付、所有权、数据量与关键路径 |
| serving-slo | 4 | 到达/首个输出/后续间隔/完成的测量边界；分布与负载 |
| host-runtime | 4 | 提交不等于完成；缓冲最后使用者与真正的流水重叠 |
| multi-gpu | 4 | 不同切分产生不同结果语义，通信必须匹配坐标与归约关系 |
| warp-issue | 4 | 依赖等待、Active/Eligible/Issued、延迟隐藏与资源代价 |
| memory-route | 4 | 地址集合、覆盖段、数据复用和各层流量的计量边界 |
| tensorcore-b200 | 4 | 矩阵操作数合法性、Shared/TMEM、双向缓冲依赖及完成协议 |
| spec-decode | 4 | 连续候选验证、接受概率、拒绝残差、全部接受后的额外 Token 与成本 |
| quant-pipeline | 4 | 数值网格与 Scale、范围/分辨率取舍、格式及真实 Kernel 路径 |
| frameworks | 4 | 固定比较条件，核对实际后端，区分吞吐与尾延迟，保留归因证据 |
| request-lifecycle | 3 | 请求身份、取消、在途访问与资源回收的不同完成边界 |
| model-loading | 3 | 文件分片与设备分片不同；装载峰值、驻留字节与计算类型 |
| batch-executor | 3 | 变长输入边界、Executor/Worker/Runner 职责、结果恢复身份 |
| kv-preemption | 3 | KV 压力下的抢占与恢复；重计算不等于重新交付旧输出 |
| async-engine | 3 | 提前做已知工作；占位不等于真实 Token；停止/取消与依赖一致性 |
| backend-dispatch | 2 | 语义、类型、布局、硬件与执行条件共同决定合法后端 |
| admission-backpressure | 3 | 到达/处理量与积压；队列容量不增加服务能力；公平的资源口径 |
| process-threads | 4 | 进程地址空间、线程状态、丢失更新与整体不变量 |
| host-memory-pages | 3 | 虚拟/物理页面、页锁定内存、主机到设备路径与 NUMA |
| cuda-context | 2 | Runtime/Driver/Context 的不同职责，进程间映射和生命周期 |
| tensor-parallel | 3 | 固定矩阵记号后，输出列切分与归约行切分；DP 的不同职责 |
| pipeline-parallel | 3 | 不同 Microbatch 在层段中交叠；理想时间推导、空泡和慢段 |
| collective-topology | 3 | Ring 的两个阶段、每 Rank 发送字节口径、实际拓扑与关键路径 |
| deployment-compatibility | 3 | 镜像与宿主边界、逐条件验证、可重现部署记录 |
| gpu-execution | 3 | Grid/Block/CTA/Warp/Lane/SM 的关系、索引、同步范围与驻留 |
| shared-bank | 3 | 从地址到 Bank；Padding 改步长；同字广播与不同字冲突 |
| occupancy-resources | 3 | 各资源限制取最紧项、驻留台阶、容量与可发射状态不同 |
| measurement-stability | 3 | 冷暖阶段、均值/中位数/尾部、条件控制与归因 |

当前数据包含 187 段普通正文、23 个 MathML 块、32 张表、10 个静态图引用、8 条边界注记、90 条前置解释。公式块还包含独立的变量解释、推导文字与部分数值步骤；开篇和收束未计入普通正文段数。

## Scheduler 的具体重写

开篇先建立两种用户等待：长输入还没读完，已经开始的回答希望继续输出。随后才解释分块为什么能改变多轮的工作组成，以及输入块较大/较小时各自可能付出的等待代价。A/B/C 从“唯一的主教学例”降为核算机制的小例，表中明确它们只是请求编号和教学长度。

预算以 `Σ nᵢ ≤ T_budget` 渲染，并解释每个符号。位置名额既不是字节数，也不是固定时长。默认 8 名额的手算放在取舍说明之后；跨轮变化用静态表完整列出 1/6/1、1/1/3、1/1/1，不要求读者切按钮记住上一轮。

KV 章节区分“已有尾块尚有空槽”与“全局尚有空闲块”。静态图明确是总 16 块的资源充足基准；紧接着说明若总量只够 A 已占的 2 块，A 仍可追加，但 B/C 首次分配失败。没有把默认充足资源图冒充容量耗尽反例。

Runner 章节把请求身份、请求内位置和本轮 Packed 行号分开：A 的 p6、B 的 p0…p5、C 的 p0 分别进入 [0,1)、[1,7)、[7,8)。正文就地说明 Packed 是紧凑拼接，半开区间包含左端、不包含右端，并把 B 的 [1,7) 还原为第 1 到 6 行。最后按“预算耗尽 / KV 分配失败 / 两者都有余量”给出诊断表，收回服务等待和有效服务能力。

本课以同步教学轮次解释关系；没有声称复制 vLLM V1 全部调度分支。真实优先级、异步调度、抢占、推测解码和不同模型状态需要各自实现证据。

## 关键技术边界

- **KV 与 PD：** `2LTH_KVDb` 仅用于所列普通 KV 轴，采用 KV 头数；未直接套到 MLA 或所有混合状态模型。实际每设备传输量另受分片、压缩和协议影响。传输提交、完成可见和可回收分开解释。
- **推测解码：** 接受公式和正残差分布对应经典随机采样算法。解释接受通路保留 `min(p,q)`、剩余通路补 `max(p−q,0)`；`p=q` 时拒绝概率为零。全部接受时可从目标的下一位置分布再采一 Token，同时说明停止条件和新 Token 尚未执行模型的边界。未把任意 MTP 都宣称为该算法。
- **量化：** 均匀网格明确是无 Zero Point 的对称整数量化教学定义；FP8/FP4 的可表示点与 Scale 规则需按格式区分。文件位数不等于计算数据类型或真实速度。
- **B200：** tcgen05/TMEM 依据固定 PTX ISA 8.8 文档说明。A、B、D 的存储位置和异步完成协议不从小矩阵图外推；搬运完成与矩阵运算完成分开。未提供未经实际构建验证的 PTX 序列或真实周期。
- **Warp / Bank / Occupancy：** Warp 依赖表采用人工周期，手机同屏显示加载、等待和加法；32 Bank 公式限定 32 位标量基本模型；Occupancy 数值设备是虚构教学资源账本，明确不是 B200 规格。向量事务、架构分配粒度、不同同步范围另设边界。
- **TP / PP / Ring：** TP 先固定行向量乘 K×N 权重的约定；PP 公式限定等长前向流水并忽略传输；Ring 字节公式明确每 Rank 仅发送量，不混成收发总和或某条链路流量。
- **异步 / 系统：** 主机提交不意味着设备完成，进程间指针数值不等于相同映射，页锁定内存仍是主机内存，容器不替代宿主驱动与硬件能力。
- **测量：** 五样本例子只说明均值与中位数差别，不作为 P99 估计；未把官方文档里的示例吞吐移植成本站实测。

## 静态图与正文对照

逐项阅读了旧章节元数据、默认状态及渲染代码。保留的图都只负责具体关系，不替代正文推导。

| 章节 | 图的实际状态与说明 |
| --- | --- |
| Scheduler / kv | 预算 8、总 16 块、第 1 轮；caption 明确充足基准，再用文字比较 2 块反例 |
| Scheduler / runner | 同一首轮，A/B/C 的位置与累计边界一致 |
| KV / address | 默认选择 A 的逻辑块 1，追到物理块 7；正文位置 6 的例子与该映射一致 |
| SLO / arrival | 普通队列的到达/开始/完成，不冒充包含首 Token 事件的图 |
| Host Runtime / pipeline | `state: {scenario: 1}` 固定理想双缓冲；B0 0–3 搬运、3–8 计算，B1 3–6 搬运、8–13 计算 |
| Memory / addresses | 默认连续的 8 个 4 字节访问；说明段分组不是完整 Warp 或 HBM 事务模拟 |
| Tensor Core / double | 默认两槽，两块的搬运/计算交叠；不把人工阶段当设备时长 |
| Batch Executor / pack | 正文已统一为默认 A3/B1，累计边界 [0,3,4] |
| Async Engine / overlap | 原章节 initial.case=1；CPU 2 拍/GPU 4 拍，忽略绑定与传输成本；三轮总长 14 拍，稳态间隔 4 拍，真实 Token 依赖仍保留 |
| Host Memory / pages | 虚拟页到不连续物理页的固定教学映射，无固定真实分配政策的暗示 |

阅读器须应用 `block.state`，并将旧图控制改成不可操作静态展示。具体桌面/手机呈现、按钮清理与无溢出验收由整体阅读器集成负责。

## 来源核查

主要一手依据如下。课程对象中的 `references` 提供直接链接；外链是技术依据和延伸阅读，必要知识已写进正文。

- [vLLM v0.11.2 Optimization](https://docs.vllm.ai/en/v0.11.2/configuration/optimization/)：分块预填充的预算/等待取舍、V1 抢占背景。固定版本，不当作永久政策。
- [vLLM v0.11.2 Architecture](https://docs.vllm.ai/en/v0.11.2/design/arch_overview/)：Worker、Model Runner 与模型职责。该页架构概览中有旧引擎路径，正文没有照抄它来冒充 V1 EngineCore 的完整类图。
- [PagedAttention 原论文](https://arxiv.org/abs/2309.06180)：分页、块共享、引用与内存管理背景。
- [Speculative Decoding 原论文](https://arxiv.org/abs/2211.17192)：接受/拒绝规则、分布恢复和额外采样逻辑。
- [CUDA C++ Programming Guide 13.0](https://docs.nvidia.com/cuda/archive/13.0.0/cuda-c-programming-guide/index.html)：执行层次、Stream/同步、页锁定内存和并发条件。
- [PTX ISA 8.8](https://docs.nvidia.com/cuda/archive/12.9.1/parallel-thread-execution/index.html)：tcgen05 操作数空间、TMEM、commit 和 mbarrier 完成关系。
- [CUDA Best Practices](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/)：Shared Bank、广播、资源/Occupancy 与测量背景。
- [NCCL 集合通信](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)及 [NCCL Tests 性能口径](https://github.com/NVIDIA/nccl-tests/blob/master/doc/PERFORMANCE.md)：操作语义、Rank 顺序、带宽系数与计量口径。
- [Nsight Compute Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html)：Active/Eligible/Issued、资源与诊断开销背景。
- [FP8 Formats](https://arxiv.org/abs/2209.05433)：E4M3/E5M2 格式区别。
- [GQA 原论文](https://arxiv.org/abs/2305.13245)与 [DeepSeek-V2 原论文](https://arxiv.org/abs/2405.04434)：补核多个 Query 头共享 KV 头，以及 MLA 压缩潜在状态的容量适用边界。
- Linux [pthreads](https://man7.org/linux/man-pages/man7/pthreads.7.html)、[mmap](https://man7.org/linux/man-pages/man2/mmap.2.html)、[NUMA](https://man7.org/linux/man-pages/man7/numa.7.html)：共享地址空间、映射和相对访问位置。
- [Google SRE Handling Overload](https://sre.google/sre-book/handling-overload/)：请求成本差异与过载处理原则。
- [CUDA Compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/)、[Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)、[NVIDIA SMI](https://docs.nvidia.com/deploy/nvidia-smi/index.html)：部署条件与测量环境记录。没有写未经核查的永久最低版本号。

## 已执行的检查

1. Node 导入模块，按真实 `allCourses` 三领域过滤结果核对课程集合与全部章节集合，30/30 课程、104/104 章节一致，无额外 ID。
2. 校验所有前置链接均指向真实课程，所有课具备开篇、前置、收束、引用；所有章节有具体内容块。
3. 用 Python XML 解析器逐个解析 23 个 MathML 根元素；变量表和解释均存在。所有表的行列数一致。
4. 对教学数值执行独立断言，并与现有纯模型交叉核对：Scheduler 三轮及容量 2 的边界、256 MiB KV、A3/B1 的 offsets、4/2 CTA 驻留、异步三轮 14 拍、推测采样的概率质量恢复、Stride32/33 的 Bank 分布、四 Rank 的 1.5N 发送量、PP 四拍、样本均值 10.4、全局线程编号 101。
5. 初稿读取全部 11 个静态图对应的章节初始状态与渲染实现，修正了默认状态与文字不一致的四处解释，并为 Host 双缓冲明确设置固定状态。手机截图进一步发现 Warp 关键的 ADD@4 需要横滑才见，因此改为三行状态表；最终保留 10 图。
6. 交叉审读后，把 Warp 依赖例子统一为图中的加载后加法；补齐 CTA、Shared Memory、Occupancy、GQA、TP、MLA、PP 在相应课程内的首次释义。另核对了六门 compiler/kernel 课的正文、公式和静态图，向其作者报告 compiler-mask 的无关向量加法输出以及两处初始化/术语解释补缝，由相应作者修订。

上述是内容覆盖、数值与结构检查；不是实机性能测试、完整源码分支审计，也不是读者掌握程度证明。是否足够易懂仍需读者阅读反馈。未增加私人数据访问、存储迁移或网络同步行为，未修改六领域结构，未提交 Git。
