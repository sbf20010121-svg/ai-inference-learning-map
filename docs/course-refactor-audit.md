# 全站课程重构审查 · 2026-11-08

本轮从原仓库 `f4acd9b` 开始。保留六个领域、10个概览课ID、25个深度专题ID、四条路线、个人知识网络与原有研究实验。新讲解进入原专注阅读器，不新建平行课程站点。

## 发现的问题与处理

1. 多数默认机制页只有通用步骤方框：改为可计算的对象案例，按机制选择矩阵、地址映射、专家分桶、Mask、资源计数或人工时间格。共用渲染器不代表共用技术叙述。
2. 六个新研究样板和旧课程并列、跳转过多：核心定义、图、变量、推导、判断、实现边界直接进入原节点；专用实验移为可选深入，既有细节没有删除。
3. 旧练习靠排除明显错误即可答对：25节替换为带条件的计算、状态追踪或证据判断。错误选项对应漏算历史、混淆字节/Token、忽略队列、把拼接当归约、把局部加速当整体等可解释错误。
4. 实验页只列目标和指标：现在先展示两种条件的实际教学模型输出，再解释预测与证据，最后说明设备验证如何衔接。仍不冒充真实Trace。
5. 名词和变量需要外查：核心变量紧邻图与MathML公式，新增索引、量纲和数学符号解释。
6. 旧版本文字可能造成质量误认：课程标明教学计算、实现入口与实测的不同；保留旧浏览记录，但明确旧记录不代表读过新版。
7. 手机课程阅读模式隐藏了导出/导入：恢复备份入口，导出格式不变。
8. 概览步骤栏的最小列宽导致末尾按钮被笔记栏遮挡：限制列和滚动容器宽度，真实点击复测通过。
9. LeRobot异步文档的`en/async`入口已失效：更新为实际存在的`main/async`；保留其移动版本性质，未称固定源码提交。

## 逐节点研究对象与未覆盖范围

表中“模型核对”指本项目可执行小模型，不代表完成该专题所有子机制、固定版本逐函数审计或硬件实测。依据链接、定义、变量、推导和限制在`site/js/course-notes.js`内逐节维护。模型在`course-models.js`，条件判断在`course-assessments.js`。

| 稳定节点 | 本轮具体对象 / 可检查机制 | 仍不能声称完成的工作 |
|---|---|---|
| llm-block | GQA头维、因果可见矩阵、Prefill/Decode投影与KV元素预算 | 完整模型逐算子Trace，MLP/Norm全部实现 |
| moe-route | Top-2权重、8条Token-expert身份、5条跨卡派发、2/3/3的专家组 | 真实EP后端、通信重叠与负载均衡实验 |
| vla-policy | 动作块、异步请求与逐节拍队列、观测/动作边界 | Flow动作网络全层推导、机器人成功率与对齐实测 |
| world-model | 视频Token配对的规模/结构、预测/策略/规划边界 | 已训练世界模型运行、Dreamer隐状态分布推导与视频扩散全实现 |
| vllm-scheduler | 连续轮次预算守恒、Prefill完成后转Decode、KV另约束 | 当前源码所有双预算、抢占、草稿、多模态和异步分支 |
| kv-cache | 除法/余数查Block Table、物理身份、尾块浪费和前缀哈希 | 生产缓存布局、完整分配/抢占；原实验仍可核对引用计数 |
| pd-disagg | KV字节推导、25GB/s理想转移下界、接收端映射 | 真实Connector传输、重叠、故障恢复与线上SLO |
| serving-slo | 开放到达序列、排队累积、完成时刻/响应时延、阈值满足率 | 多轮Decode动态Batch、足量请求P99 |
| compiler-lowering | 融合消除中间物化、Program/Mask与编译层次 | 本机真实TTIR/TTGIR/LLVM/PTX/SASS产物及Pass级优化证据 |
| triton-tiling | 输出Tile归属、尾块Mask、Program数与累加器规模 | 真实线程Layout、寄存器分配、Spill与Autotune实测 |
| runtime-graph | Stream/Event依赖、提交与完成、Replay仍保留Kernel数 | 真实Capture约束矩阵与CPU/GPU重叠Trace |
| gemm-tiling | 手算矩阵乘、FLOPs/最少字节、M改变权重摊销 | 真实分块重读、Cache与Tensor Core效率 |
| attention-tiling | Online Softmax的m/l/a、指数重缩放、完整Softmax对照 | 完整多头Mask、真实布局、低精度与backward实现 |
| profiling | 合成关键路径账本、Amdahl反事实、归因证据层次 | 真实NSYS/NCU采样与统计实验 |
| host-runtime | 在途数据所有权、H2D完成、理想双缓冲 | 特定设备拷贝引擎能力与真实Pinned/Stream对照 |
| multi-gpu | 同输出部分和、AllReduce/AllGather/ReduceScatter | NCCL环/树、链路拓扑与扩展效率 |
| warp-issue | Active/Eligible/Issued、依赖等待与人工发射格 | 特定芯片调度器实现或周期准确模型 |
| memory-route | Lane字节地址、32B段覆盖、有效负载与覆盖量 | 完整Warp指令级事务、真实Cache命中与DRAM流量 |
| tensorcore-b200 | 双槽生产消费、完成后复用、容量/重叠权衡 | tcgen05实际指令、Tensor Memory分配与B200实测 |
| spec-decode | p/q接受概率、正残差归一化、重建目标分布 | 多候选缓存回退、MTP/EAGLE具体网络、生产加速 |
| quant-pipeline | 整数Scale、舍入/截断/还原、误差与格式边界 | FP8/FP4位级格式、真实后端与校准/质量实测 |
| fused-norm | RMSNorm整行归约、ε、零值；对照RoPE/门控依赖 | RoPE配对各实现、SwiGLU及完整融合内核 |
| mla-kv | 内容Key低秩展开与Query侧吸收的数值等价 | 解耦RoPE与Value侧完整执行、实际MLA Kernel |
| linear-state | 2×2状态、预测/残差/外积更新、重复Key纠错、仿射组合 | 生产Chunk的WY/三角实现、非正交长期精度与性能 |
| frameworks | 同预算合成延迟、阈值满足与公平比较条件 | 真实三引擎支持矩阵、完整实测排名 |

## 资料核对边界

2026-11-08查阅：vLLM V1 Scheduler API、Prefix Caching、Disaggregated Prefilling、量化和在线基准文档；Triton官方矩阵乘教程；PyTorch的Triton编译阶段说明和RMSNorm定义；CUDA Best Practices、Blackwell指南、PTX ISA；NCCL集合通信；Nsight Compute Profiling Guide；Megatron Core MoE；LeRobot异步；GQA、FlashAttention、推测采样、DeepSeek-V2、Gated DeltaNet、Dreamer原论文。链接在课程中可核对。

其中FLA保留既有固定提交`98193113ecb7835143252a786e06933e371b67cc`，不是本轮验证了整个仓库；其余`latest/main`类文档按核查日期标识，不能假装固定版本。未复制外部大段源码或第三方图。

## 进度与隐私兼容

- 未更改`ai-inference-map-v1-progress`、`ai-inference-depth-progress-v1`及个人知识网络键、同步协议、JSON格式版本、导出字段或私有仓库。
- 未读取、复制或公开实际私人笔记；浏览器测试使用独立临时上下文和合成中文测试记录。
- 旧课程ID、自评状态、笔记、已完成层级、浏览步骤与个人节点继续由原模块保存。新模型没有存储或网络写入能力。
- 机制新案例采用四个可重放观察点；旧浏览子步骤原样保留，显示时限制到现有观察点，不清空历史。页面明确旧浏览不代表新内容已读。
- 个人掌握与课程质量分开：用户仍手动自评；课程标注的研究边界不受“已掌握”影响。

## 验证

- Node测试含独立数学参考：缓存地址/尾块、调度预算、MoE分配、在线Softmax、Delta更新/Chunk、推测采样接受与拒绝重建目标分布、PD字节、Tile槽位、RMS零输入、MLA吸收和排队时间。
- 浏览器检查脚本：`scripts/audit-browser.cjs`。用已安装Playwright与本机Chrome，独立浏览器上下文；1365/390宽度，25节×7页、每节4个机制步骤及双条件切换；检查公式、反馈、溢出、笔记/自评/个人图谱导出导入及刷新。
- 工程测试不评价学习成效；仍需要用户试学反馈验证是否能独立复述、迁移与诊断真实问题。

这份审查将“25节核心讲解已重写”和“25节全部达到源码审计/实测深度”明确区分。后者尚未实现，不应因测试通过或界面覆盖而自动升级。


### 本轮实际检查结果

- `npm test`：82项通过、0失败，含新增独立数值不变量与原同步安全测试。
- 深度阅读器：618个页面/状态检查，1250次操作；1365px与390px；无脚本错误、无整页水平溢出；16张明暗截图。
- 概览入口补充检查：104个步骤点击；1365px与360px；8张公式截图及键盘节点操作；无脚本错误。
- 中文测试笔记、自评`known`、个人知识节点，经过旧格式导入、刷新、导出、再次导入后保留；无效JSON被拒绝且保留现有记录。
- 截图与原始检查结果留在本地忽略目录`test-results/`。未使用实际私人笔记作为测试夹具。
