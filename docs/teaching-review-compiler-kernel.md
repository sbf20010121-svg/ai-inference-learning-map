# Compiler 与 Kernel 连续教学正文改写记录

日期：2026-11-19。对应文件：`site/js/teaching-compiler-kernel.js`。

## 交付范围与表达决策

本次为 `allCourses` 中 `module === "compiler" || module === "kernel"` 的全部 **28 门课、94 个既有章节**新增连续教学正文。课程 ID、章节 ID 保持不变。每门课均有开篇、可直接阅读的前置解释、逐章正文、收束段落与一手参考来源；主文不依赖旧实验的折叠说明才能成立。

正文按内容使用段落、公式、表格与必要静态图，未给每章强制套用相同问答或交互模板。数学关系用原生 MathML，紧邻解释符号、对象维度、计量单位及推导条件。取舍不是“全部画图”或“全部文字”：地址、依赖、数据身份与实际窗口适合追踪图；在线归一化、归约、算术强度、摊销等关系以公式及推导为主；合法性反例用明确的旧值、新值与可观察输出比较。

阅读器将旧数值实验作为课后的可选扩展。本文件只提供内容，不修改阅读器与样式；集成渲染、移动端截图和全站测试由根任务负责。

## 已写入的课程与知识递进

| 课程 ID | 章数 | 实际改写的核心关系 |
| --- | ---: | --- |
| compiler-lowering | 7 | 源程序入口、图捕获、融合中的值身份、Program、尾部 Mask、TTIR/TTGIR/LLVM/PTX/SASS、布局与目标证据。直接 Triton 与框架捕获入口分开说明。 |
| triton-tiling | 5 | 先确定输出责任，再沿 K 累加，最后讨论线程归属、尾部、资源与调优。向上取整网格公式明确每个量。 |
| runtime-graph | 4 | Stream 顺序、Event 跨流依赖、Graph 重放、缓冲区生命周期与准备成本；重放不自动改变数学工作。 |
| tensor-address | 3 | 逻辑坐标→元素偏移→字节地址；Shape 与 Stride 的分工；转置视图及别名对合法重排的影响。 |
| ir-ssa | 3 | 用 `old=x; x=x+1; return old+x` 说明值身份为什么必要，再到独立分支与 store/load 反例。 |
| graph-capture | 2 | 捕获区域决定优化器看见哪些操作；Guard 决定已有实现在哪些调用上有效。 |
| symbolic-shapes | 3 | 不同尺寸的版本复用、动态范围与固定维度共同约束、编译投入何时被复用收益抵消。 |
| graph-rewrite | 3 | CSE 的输入身份与副作用条件、常量折叠边界、三位十进制教学算术中的浮点重分组反例。 |
| fusion-legality | 3 | 外部使用者、别名读写次序、中间舍入分别决定融合是否保持原接口与数值契约。 |
| loop-lowering | 3 | 一个输出对应完整 K 求和；12 个合法迭代点如何分组；尾段与循环交换的依赖条件。 |
| buffer-liveness | 3 | 最后一次使用决定生命期；复用需要区间及其它约束；张量值如何落实为原地写入或独立缓冲。 |
| gpu-layout | 2 | 保持四个元素身份，逐项列出按行/按列所有者；只有 01、10 跨持有者，不由 Shape 推断指令成本。 |
| target-codegen | 3 | 活跃值竞争有限资源，IR 名字不同于物理寄存器；资源报告、PTX、SASS、计时分别支持哪些判断。 |
| compile-cache | 2 | 缓存键与 Guard 的职责、适用性条件、冷态/热态成本、命中后仍需绑定本次数据并提交。 |
| compiler-evidence | 3 | 优化声称对应什么证据；串行 Amdahl 关系；保留条件、失败用例及可复现实验。 |
| engine-build | 3 | ONNX 交换表示、目标 Engine、运行上下文；min/opt/max 的不同含义；输入更新与执行生命周期。 |
| gemm-tiling | 4 | 点积→输入复用→FLOP/Byte 算术强度→有限存储；理想字节估计与实际显存流量明确分开。 |
| attention-tiling | 5 | 分数、概率、Value 分开；m/l/a 的完整在线状态；新最大值出现时分子分母共同缩放；数学、IO 与验证边界。 |
| profiling | 4 | 提交、Kernel、请求三种完成边界；预测与受控实验；百分比的分母陷阱；条件与证据记录。 |
| fused-norm | 5 | RMSNorm 整行统计与 ε 位置、RoPE 的成对依赖、SwiGLU 分支角色、残差加归一化融合。 |
| reduction-scan | 3 | 总归约与逐位置前缀的输出差异，树形依赖，跨组前缀贡献，sum/max/min 各自单位元。 |
| gather-scatter | 3 | 同一组 MoE Token 贯穿专家分组、Gather、加权 Scatter 和身份恢复；重复写入必须明确合并。 |
| paged-attention-kernel | 3 | 逻辑位置经块表定位物理块；Key/Value 必须保持配对；有效长度与尾槽 Mask 不由容量替代。 |
| quantized-matmul | 3 | 每个码找到所属 Scale；从还原式推导按组点积；分组轴、格式、累加与后端边界。 |
| sampling-kernel | 3 | 每请求沿词表归一；CDF 区间与端点规则；目标分布、固定 RNG 序列与逐位复现的区别。 |
| kernel-tuning | 3 | 相同有效输出的覆盖槽对照；块参数改变输入与累加状态；正确性通过后按条件测量选择。 |
| lowbit-formats | 3 | 固定指数区间内的小数分辨率；E2M1 非均匀值集合；外部 Scale 对范围和间距的共同作用。 |
| convolution-lowering | 3 | 窗口坐标与权重对应、卷积步长与存储步长区别、输出尺寸推导、im2col 的逻辑重复与实际存储。 |

Compiler 合计 16 门、52 章；Kernel 合计 12 门、42 章。

## 关键例子为什么改变

SSA 不再仅靠顺序计算 2→4→5 解释名称。主例中旧值与新值必须同时使用，误用身份会把正确结果 5 改成 6，读者可以看见表示选择的实际意义。依赖图另用 x=2、y=1、u=2x、w=3y、v=u+w，图注明确节点对应，不把两类例子混为同一条程序。

Attention 不以参数变化代替算法推导。分数 0、ln2 与 Value 2、5 给出可手算的完整过程：首项状态 m=0、l=1、a=2；新最大值使旧贡献乘 1/2，合并后 l=1.5、a=6，输出为 4。直接 Softmax 的权重 1/3、2/3 也得到 4。公式中的分母是标量，分子是 Value 加权向量；在线状态的意义、重缩放原因和最终归一时机均写在主文。

Gather/Scatter 使用同一条 MoE 路由：T0→E0、T1→E1、T2→E0 与 E1。专家分组顺序产生索引 `[0,2,1,2]`；回来时按原 Token 身份汇总加权贡献。这样“取数”“合并”“逆映射”有共同对象。旧图使用不相干数组，本次主文没有引入该图。

融合的数值合法性现在有独立的主文对照：三位有效数字教学算术中，`u=1000+0.4` 若在算子边界先舍入为 1000，后续减 1000 得 0；保留 1000.4 到减法再舍入则得 0.4。此例说明舍入位置，明确不模拟具体 GPU 格式。

## 静态图与状态复核

主文共保留 **14 幅静态图**。每幅均对照 `mechanism-visuals.js` 或 `foundation-figures.js` 的真实渲染分支及 `defaultLab`/章节初值检查，必要时通过 figure block 的 `state` 显式固定条件。

| 章节 | 主文使用状态与核对结果 |
| --- | --- |
| triton-tiling/output、gemm-tiling/reuse | `bm:2,kStep:2,cell:0`；4×4 输入，左上 2×2 输出块，完整 K=4，图注说明颜色为输出块归属。 |
| runtime-graph/order | `scenario:0`；S0 在人工时刻 4 完成写，S1 等事件后开始。长度不是实测。 |
| fused-norm/fusion | `fusion:1,external:0`；z=[3,4] 留在内部，γ=[1,1]、ε=10⁻⁵；逻辑元素读写不同于实际显存流量。 |
| tensor-address/address | `pick:5`；坐标(1,2)与底层元素槽5对应，字节换算单独说明。 |
| ir-ssa/dependence | `case:0`；图中 x=2、y=1、u=4、w=3、v=7，与正文同构，caption 明确映射。 |
| loop-lowering/tiles | `case:0`；M=N=2、K=3、BK=2，12 项合法乘积，k=3 不存在。 |
| buffer-liveness/interval | `case:0`；a 最后用3，c从4开始，可共槽；整数时刻画为单位宽度槽。 |
| gpu-layout/cost | `case:1`；明确行→列，ID 1、2 跨 Lane，计数2。修正旧默认行→行的0次移动。 |
| target-codegen/pressure | `case:1`；峰值3个活跃值、2个教学槽，固定策略中有暂存与重新读取。 |
| reduction-scan/tree | 固定输入1、2、3、4，部分和3、7，根10；图边表达依赖。 |
| paged-attention-kernel/read、tail | `case:0`；块表[3,1]，读图长度4，尾图长度3；P1末槽物理存在但不参加尾图归一。 |
| convolution-lowering/window | `pick:4`；窗口[5,6;9,10]对应输出(1,1)=15。 |

`compiler-lowering/layout` 的旧图为4×4/四线程，正文为2×2/两线程，改用逐元素所有者对照表。`compiler-lowering/program` 的旧图虽然能固定BLOCK=4和尾块，却另外展示向量相加结果，不能接上主文的 `y=max(2x+1,0)`。交叉审读后改为P0/P1/P2的明确责任表，保持原计算身份，尾块只允许访问8、9。静态图说明不要求点击才能读懂。

## 来源与技术边界

课程条目保存直接一手来源 URL；本次读取官方文档或原论文核对，未把搜索摘要当作具体实现证据。来源包括：

- [MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/)、[Bufferization](https://mlir.llvm.org/docs/Bufferization/)、[Pattern Rewriter](https://mlir.llvm.org/docs/PatternRewriter/)、[Linalg](https://mlir.llvm.org/docs/Dialects/Linalg/)：值身份、区域、内存与结构化操作。
- [LLVM Code Generator](https://llvm.org/docs/CodeGenerator.html)、[LLVM Language Reference](https://llvm.org/docs/LangRef.html)：目标生成、资源与浮点/内存语义。
- [Triton 矩阵乘教程](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html)、[Triton Kernel 编译阶段](https://pytorch.org/blog/triton-kernel-compilation-stages/)：Program、分块与表示层次。
- [PyTorch Tensor Views](https://docs.pytorch.org/docs/stable/tensor_view.html)、Dynamo 与动态形状官方文档：视图、捕获、受约束复用。具体缓存键和 Guard 全集没有冒充成版本无关规则。
- [CUDA 13.0 编程指南](https://docs.nvidia.com/cuda/archive/13.0.0/cuda-c-programming-guide/index.html)、[CUDA Best Practices](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/)、[Nsight Compute Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html)、[Nsight Systems Guide](https://docs.nvidia.com/nsight-systems/UserGuide/index.html)：执行次序、资源与测量。
- [FlashAttention](https://arxiv.org/abs/2205.14135)、[Online Normalizer](https://arxiv.org/abs/1805.02867)：分块在线归一化和数据搬运思路。正文推导是目标数学关系，不声称覆盖各代实现全部流水细节。
- [RMSNorm](https://arxiv.org/abs/1910.07467)、[RoFormer](https://arxiv.org/abs/2104.09864)、[GLU Variants](https://arxiv.org/abs/2002.05202)：三种不同依赖模式的数学定义。
- [vLLM Paged Attention](https://docs.vllm.ai/en/latest/design/paged_attention/)：逻辑块到物理块的读取关系。本课标量例是原创缩小模型，不是完整后端实现。
- [TensorRT Quantized Types](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-quantized-types.html)、[Quantization Schemes](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-schemes.html)、[FP8 Formats](https://arxiv.org/abs/2209.05433)：整数分组量化与低比特浮点格式分别说明。E2M1有限值集合不替代全部编码与舍入规则。
- [TensorRT Dynamic Shapes](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dynamic-shapes.html)、[TensorRT Architecture](https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/architecture-overview.html)、[ONNX IR](https://onnx.ai/onnx/repo-docs/IR.html)：交换表示、目标产物与执行上下文。
- PyTorch 的 [gather](https://docs.pytorch.org/docs/stable/generated/torch.gather.html)、[scatter_add_](https://docs.pytorch.org/docs/stable/generated/torch.Tensor.scatter_add_.html)、[cumsum](https://docs.pytorch.org/docs/stable/generated/torch.cumsum.html)、[Conv2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html) 与 [Transformers 生成文档](https://huggingface.co/docs/transformers/main_classes/text_generation)：索引、前缀、卷积与采样语义。

没有采集真实 GPU 运行、真实 TTIR/TTGIR/LLVM Dump、PTX/SASS 或性能计数器，因此没有填入伪造的寄存器数、带宽、Kernel 耗时或加速比。两 Lane/两寄存器槽、编译100ms、采样等待40/100等值均明确为教学条件。公式成立条件包括：量化点积先限定无零点的对称分组；卷积尺寸公式先限定膨胀系数1；Roofline 的 Q 对应明确存储边界；Amdahl 与编译摊销先限定串行且其它成本不变。

课程覆盖当前图谱所选机制，并非所有编译与 GPU 知识已经穷尽。SSA 控制流合流、支配关系、目标布局编码、实际寄存器分配器及具体后端实现仍需要结合真实产物继续学习，正文的收束与边界说明保留这一点。

## 已完成的内容验收

1. `node --check site/js/teaching-compiler-kernel.js` 与 ESM 导入通过。已修正公式 HTML 属性引号导致的 JavaScript 字符串冲突。
2. 对照注册表及 `chaptersFor()` 校验：28 门课程、94 章完全覆盖，无多余或缺失 ID；全部前置课程链接 ID 存在；每课开篇、前置、收束和来源完整；表格每行列数一致。
3. 28 个 MathML 块通过 XML 解析及 `mfrac`、`msub`、`msup`、`msubsup`、`munder`、`mover`、`munderover` 的子节点数检查。每块有变量说明和公式解释。Attention 的分数、概率、输出关系分成三行，便于顺序理解与移动端呈现。
4. 独立重算关键例子：在线 Attention=4；分页长度4输出2.471148648，长度3输出1.514820191；RMSNorm约[0.848528137,1.131370850]；分组量化点积1.75、错误平均Scale结果2.25；卷积窗口输出15；Amdahl例约1.219512倍。
5. 上述14幅图完成源码与状态一致性复核，新增状态覆盖不会改变旧实验本身的默认配置。交叉审读另指出Program旧图的算子身份断点，已以保持原表达式的表格替换。

这些检查验证内容结构、数学示例及图文条件；它们不能证明读者已经学会，也不等于已做真人教学效果实验。浏览器实际排版、公式呈现和跨模块阅读体验属于根任务的集成验收，本文不代替或提前声称该结果。
