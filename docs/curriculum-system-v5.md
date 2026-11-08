# V5：以领域、单元和独立课程组织知识

2026-11-08。此文描述当前范围；V4及更早文档保留为历史记录。

## 用户问题与本次调整

“编译器”是领域，MoE是一个机制。之前将它们各自做成一门同等粒度的课，即使多添课内章节，仍没有解决领域内容缺失。本版保留六大领域，增加单元层：79门独立课程放入30个单元，合计281个问题章节。54门新课独立记录；25个旧ID继续表示原课，不用旧课的已掌握状态填满新单元。

编译领域现在有8个单元、16门独立课：导论；张量地址与SSA；捕获与符号形状；改写和融合合法性；循环变换与Triton；生命周期与GPU Layout；目标代码与Engine构建；编译缓存和Runtime。旧compiler-lowering只作为编译全景导论，不能代替全部这些课程。

模型领域加入输入嵌入、完整层结构、生成状态、采样、注意力连接、视觉Patch和跨模态桥接。具身部分先交代观测时间/坐标、动作约定、数据边界，再讲策略家族、闭环、世界模型学习和DiT。推理系统加入装载、请求状态、批次执行、抢占、异步和背压；算子与系统补充Reduction/Scan、索引聚合、分页Attention、量化乘法、卷积、进程/线程、虚拟内存、CUDA上下文、TP/PP/集合通信。GPU微架构继续作为并行支线，补齐执行层级、Bank映射、资源驻留与测量稳定性。

## 表达与证据

课程先确定目标、数据对象、假设和问题，再选图。可复用的是渲染工具，不是统一的机制流程。地址图追踪同一元素；SSA图追踪值的定义和使用；生命周期图显示区间重叠；卷积显示窗口和展开行；分页Attention同时显示逻辑索引、物理块和读取值；具身图保留同一物理点及坐标解释；流水线保持批次身份；Bank图以Lane/地址/Bank解释冲突。

术语和变量在页内释义，数学适用章节提供MathML、数值推导，执行骨架明确标注教学抽象。章节可在同一课程内前后学习；独立课程底部接回单元、先修依据和下一门课；不再另开“研究深入”课程体系。桌面和移动端默认保持一个核心问题，公式、代码及来源按需展开。

每课的限定范围和未讲内容在coverage-review.js中逐项维护。coverage.js不能因链接存在或手写guided标志就将无范围证据的项目算作已建设。79门表示这些限定目标已有教学内容，**不表示读完即可独立优化生产系统，也不表示全部AI技术都已穷尽**。仍显式列出3项专项不足及4项按需扩展：多租户缓存/故障、树状推测、RDMA真实后端；3D感知、完整传统编译器前端、完整机器人控制、完整训练。

## 代码位置与记录兼容

- course-registry.js是独立课程与单元的统一注册表；depth-content.js保留旧25门及原L1引用。
- foundation-*.js按技术领域保存54门新课；foundation-numerics.js为无DOM、无存储、无网络的参考计算；foundation-figures.js负责相应对象图。
- mechanism-curriculum.js合并新旧章节；focus-reader.js统一阅读、笔记、来源及前后导航。curriculum-view.js是系统课程入口，知识网络使用同一注册表。
- 原六大领域、L1及25个旧专题ID不变。两个原进度键、版本1导出格式及云同步协议不变。mechanismReading继续只表示浏览；已读不自动变成已理解。新课使用新ID，旧笔记和反馈不重分配。
- 未改动Worker、OAuth或私有仓库内容。Worker健康接口返回HTTP200/ready=true；新课程记录通过模拟Worker读写测试。此检查不代替当前浏览器重新登录及真实私有数据写读验收。备份测试只用隔离浏览器与合成记录，覆盖新旧课及个人知识图谱。

## 研究依据与适用边界

页内引用MLIR Toy/LangRef/Bufferization、LLVM代码生成、PyTorch捕获/动态形状/视图、Triton教程、vLLM架构和Paged Attention、CUDA/NCCL、TensorRT，以及Transformer、ViT、LLaVA、Mamba、DeltaNet、ACT、Diffusion Policy、Dreamer、DiT等原始论文/仓库。39个不同的一手链接进行了可达性核对。ROS文档站触发反自动访问，改用ROS官方仓库的同版本原文。动态文档不构成固定版本源码审计。

新增课程中的算术、时间线、队列、资源上限、低比特舍入示例均为限定假设的教学计算。没有采集真实GPU IR/汇编/Profiler产物，没有真实机器人和生产流量实验。执行骨架保留关键依赖，不能视作完整库实现；图中的合成节拍不是性能预测。真实实现追踪和性能实验仍是后续需要另做的工作，不能由页面或测试数量代替。

## 验证

`npm test`的109项检查包含层级、兼容与数值不变量。`scripts/audit-curriculum.cjs`遍历79门全部章节，在1365/390/360像素宽度核对交互、公式/代码、无整页溢出、目录与搜索、新旧笔记往返、个人图谱、坏备份保护、深色与键盘跳转。`scripts/audit-gateways.cjs`继续检查原L1入口。全量结果为843个页面状态/1511次交互，无脚本异常、无整页溢出；L1入口检查104步。`audit-curriculum-navigation.cjs`验证30单元实际导航、79课程知识网络、新课笔记及审计筛选；`audit-diagram-geometry.cjs`检查默认与四种条件合计200个新课SVG实例的文本重叠/边界。截图人工检查代表性地址、SSA、生命周期、流水线、坐标、卷积、低比特及Bank图。

测试证明计算和页面行为在所测条件下成立；尚无真人学习效果研究，不能保证任何读者仅凭这些课程即掌握整个领域。

## 逐单元索引

下表由统一注册表导出，具体教学边界以每课页内来源和coverage-review.js为准。


| 单元 | 独立课程 |
|---|---|
| 模型入口与完整层 | 分词、Embedding 与输出词表；完整 Transformer 层与残差路径；Transformer 计算与 Prefill / Decode |
| 生成与输出分布 | 自回归生成的状态与停止；温度、Top-k 与 Top-p 采样 |
| 注意力、专家与状态模型 | 因果、滑窗、稀疏与混合注意力；MoE 路由与专家计算；MLA：压缩 KV 与矩阵吸收；线性注意力与递推状态更新；线性注意力、Delta Rule 与 SSM 的边界 |
| 视觉与跨模态输入 | 视觉编码：Patch、位置与Token；跨模态投影、拼接与交叉注意力 |
| 具身观测与动作闭环 | 观测接口：时间戳、坐标系与本体状态；动作表示、相对基准与归一化；闭环执行、延迟与任务评价 |
| 策略、数据与动作生成 | 机器人数据：Episode、窗口与标签对齐；ACT、Diffusion、Flow 与离散动作策略；VLA Action Expert 与 Flow Matching |
| 世界模型与生成模型 | 世界模型的时空计算与推理；世界模型的学习目标与想象策略；扩散、DiT 与视频生成的计算边界 |
| 请求完整生命周期 | 请求生命周期、结果与取消；接纳控制、背压与资源隔离；推理部署：TTFT、ITL、吞吐与 SLO |
| 装载、执行器与异步流水 | 量化部署与 FP8/FP4 Kernel；模型装载、权重分片与显存预算；Executor、Worker 与变长Batch；模型能力、Kernel后端与派发条件；异步调度、占位与完成依赖；推理引擎比较：vLLM / SGLang / TensorRT-LLM |
| 调度、缓存与阶段交接 | Paged KV Cache 与 Prefix Caching；vLLM V1 Scheduler 与 Chunked Prefill；KV不足、抢占与重计算；推测解码、MTP 与候选验证；PD 分离：架构、KV 传输与性能权衡 |
| 编译全景导论 | PyTorch → IR → Triton → PTX/SASS |
| 程序与值的表示 | 张量、Stride 与地址计算；IR、SSA 与使用定义关系 |
| 捕获、特化与动态形状 | 图捕获、Guard 与 Graph Break；符号形状、特化与重新编译 |
| 图分析与合法变换 | 模式重写与图优化；融合合法性、别名与精度 |
| 循环、分块与设备映射 | 算子 Lowering 与循环变换；Triton Tiling、Layout 与资源分配 |
| 内存规划与执行布局 | 活跃区间、内存规划与 Bufferization；线程布局与 Layout Conversion |
| 后端、产物与优化核验 | 代码生成、寄存器分配与 Spill；JIT、AOT、缓存与运行时派发；ONNX、Engine 构建与动态Profile；编译优化的端到端核验 |
| 运行时次序与重放 | CUDA Runtime、Stream 与 CUDA Graph |
| 基础并行与不规则算子 | Reduction、Scan 与跨线程依赖；Gather、Scatter 与重复索引；采样算子：筛选、前缀和与选择 |
| 矩阵计算与重用 | GEMM Shape、算术强度与 Roofline；卷积窗口、Stride、Padding 与 GEMM |
| Attention的存储与计算 | FlashAttention：分块、Online Softmax 与 IO；Paged Attention 的索引与计算 |
| 数值算子与低精度计算 | RMSNorm / RoPE / SwiGLU 与算子融合；分组Scale、反量化与矩阵乘；FP8、FP4 的数值网格与块Scale |
| 配置搜索与性能归因 | 配置搜索、正确性与性能归因；性能归因：Timeline → NCU → 实验 |
| 按需OS与设备资源基础 | 进程、线程、共享状态与同步；虚拟页、Pinned Memory、DMA 与 NUMA；CUDA Context、Runtime 与 Driver；CPU → CUDA Runtime → GPU：同步与数据搬运 |
| 分布式执行与通信 | TP 与 DP：切权重还是切请求；PP、Microbatch 与流水空泡；TP / EP / 网络通信与分布式推理；Collective、拓扑与通信量 |
| 可复现部署与环境 | 部署环境、兼容性与复现清单 |
| 执行层级、驻留与发射 | Grid、CTA、Warp 与执行资源；Warp Scheduler、Scoreboard 与 Pipeline；寄存器、Shared 与驻留上限 |
| 地址、存储层与Bank | GPU 存储：寄存器、Shared、Cache 与 HBM；Shared Memory Bank Conflict 与 Padding |
| 矩阵单元与异步资源协议 | B200 Tensor Core、异步数据搬运与同步 |
| 设备状态与稳定测量 | 预热、时钟、功耗与测量稳定性 |
