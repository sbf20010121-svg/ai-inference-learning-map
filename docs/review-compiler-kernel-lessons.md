# 编译与算子课程逐章核对 · 2026-11-19

本次核对 **28 门课、94 章**，包含全部 12 门编译基础课、3 门接口课、6 门算子基础课及 7 门原机制课。以下表格列出全部章节 ID，没有用新增词汇表的数量替代内容审查。原课程 ID、章节 ID、学习记录与同步协议保持不变。

审查以当前问题为中心：图中的对象是否回答这个问题，符号是否有含义，公式/代码/测验是否仍在使用同一个例子，结论是否只覆盖已经展示的条件。已有机制成立的章节保留；发现错配的章节改成对应的对象、推导和反例。

## 本次修正的主要问题

1. **同一课程共用内容造成串章。** 动态范围章原来展开编译成本公式，常量折叠章原来显示 CSE 代码，精度章的测验仍考 CSE。现在使用章级 `evidence` 覆盖，各自展示形状约束、常量折叠或显式舍入反例。Reduction 总和与 Scan 前缀、分页 Attention 地址与归一化、卷积窗口与输出尺寸，也分别配了相应公式。
2. **部分图未展示标题所问的机制。** SSA 首章现在追踪同一源码变量的 `%x0 → %u → %v` 数值身份；依赖章另保留两条独立分支。Bufferization 用旧值仍需读取的反例，Engine 运行章用相同 Shape 的新输入产生新输出，目标代码章用不同证据能回答什么的比较表。
3. **融合讲解混用无关算子。** RMSNorm 融合章改为残差相加与 RMSNorm：`[1,2]+[2,2]=[3,4]`，保留平方均值 `12.5` 和相同输出，显示逻辑 IO 为 `12→8` 元素次；若残差和仍需对外输出则为 `10` 元素次。没有把这些数值称为 DRAM 事务或实测加速。
4. **抽象边界缺少可算反例。** 新增中间舍入被错误删除导致 `0→0.4` 的反例、采样等待计数减少但比例 `40%→80%` 的分母反例、配置遗漏尾部 Mask 导致 8 个越界写的反例。
5. **对象跟踪不完整。** GEMM Tile 图现在高亮整个输入行带/列带，并允许切换到其它输出 Tile；分页尾部明确显示仍有物理内容但本次被 Mask 排除、概率为 0 的位置。地址例子纠正了“槽 5”与“第 6 个元素”的混淆；Layout 来源说明纠正为两 Lane 四元素。
6. **承接文案走错下一章。** 编译导论 `target` 章现在承接实际下一章 `tradeoff` 的融合反例与证据核验，不再预告不存在的缓存章。
7. **截图复核补齐可读、可复算的输入。** 编译缓存图保留冷调用 `100+1+4=105 ms`、有效命中 `1+4=5 ms` 的相同比例，改用六个清晰刻度，并在表中完整列出太短而无法容纳文字的提交/执行阶段。在线 Softmax 分块图补出 `V=[2,4,−1,5]`，使本章的分子 `a` 与输出 `o` 可以就地复算。
8. **默认状态必须回答当前章题。** 20 张桌面/手机截图复核发现分页 Attention 的 `tail` 章问长度 3，初始图却选长度 4。现在默认长度 3，尾槽概率为 0、输出约 1.5148；保留长度 4 的 2.4711 对照。正文改成“当长度为3时”的条件句，避免用户切换后仍读到无条件的三位置结论。

## 全部 94 章的审查记录

同一行中逐一列出章 ID；“保留”表示已核对现有讲解、图及其限定假设，不表示完成生产实现的所有分支。

| 课程 | 已逐章核对的章节 | 对象、判断与本轮处理 |
|---|---|---|
| `tensor-address` | `address`、`transpose`、`alias` | 槽号从 0 开始；(1,2) 对应槽 5、第 6 个元素。转置交换 Shape/Stride 仍访问原存储，别名写入可由另一视图观察；保留这两章的身份映射。 |
| `ir-ssa` | `values`、`dependence`、`effect` | 首章改为 2→4→5 的三次定义；依赖章保持 u=2x、w=3y、v=u+w，独立分支必须在 v 前完成；副作用章检查先写后读 7 与错误交换读 0 的差别。 |
| `graph-capture` | `region`、`guard` | 捕获区间与区域外行为分开；Guard 只约束本例 H、dtype、device，没有把 B 的变化一律判为重编译。示意 Guard 不宣称是某版本的完整生成条件。 |
| `symbolic-shapes` | `sequence`、`constraint`、`amortize` | 静态 [2,4,2,8] 有 3 个版本；约束章改为 1≤B≤8 且 H=4 的专属公式；成本章补实际相同账本代码，100 次持平、超过 100 次才净收益。 |
| `graph-rewrite` | `cse`、`fold`、`float` | CSE 保留两条消费边，公式写 u+u，避免暗示另外做了乘 2 的代数改写；常量折叠代码改为 5x；浮点章测验与三位有效十进制反例一致。 |
| `fusion-legality` | `external`、`alias`、`precision` | 外部 u 不能消失；别名章测验检查旧值而非只看最终内存；精度章新图显示保留/错误删除中间舍入，明确并非 IEEE 格式模拟。 |
| `loop-lowering` | `points`、`tiles`、`order` | 2×2×3 共 12 个合法乘积；BK=2 的尾部仍仅 k=2，不能读取 k=3；循环交换保持迭代集合，但浮点与别名另有约束。保留现有对象图。 |
| `buffer-liveness` | `interval`、`reuse`、`bufferize` | a=[0,3] 与 c=[4,6] 可接替同槽；延长 a 到 5 后重叠。Bufferization 新图用 a=[2,5] 与 b=[9,5] 检查旧值 sum(a)=7 是否被错误改成 14，并配对应骨架。 |
| `gpu-layout` | `owners`、`cost` | 两 Lane 四元素按行/列归属转换时 01、10 两个值跨持有者；Shape 与数值不变。修正来源说明的 Lane 数，保留交换机制取决于实际目标的边界。 |
| `target-codegen` | `pressure`、`artifact`、`tradeoff` | 2 槽资源模型不足以容纳 3 个活跃值；产物章替换成虚拟名、资源报告、二进制、实测的证据对照，避免重复压力图；融合后压力图仍只表示可能代价。 |
| `compile-cache` | `keys`、`dispatch` | 按教学键区分源码、目标、dtype 与 Tile；有效命中仍要检查输入与执行。冷 105ms/热 5ms 是声明的串行账本，不是当前框架冷启动结果。 |
| `compiler-evidence` | `ledger`、`counter`、`reproduce` | 未采集的真实产物保持未知；目标原占 20%，局部快 10 倍对应串行整体约 1.22 倍；复现清单固定版本、输入、精度、设备与测量边界。保留此证据组织。 |
| `engine-build` | `export`、`profile`、`runtime` | 交换图与目标 Engine 分开；Profile 允许 [6,4] 而非只允许 opt [4,4]；运行章新图固定 [6,4] 接口，换输入首行后输出 [2,4]→[12,4]，配形状/地址/完成骨架。 |
| `lowbit-formats` | `fp8`、`fp4`、`scale` | 正规区间 [1,2) 的间距 1/8 与 1/4；E2M1 非均匀正值集合；Scale .25/.5 对最大还原值 1.5/3 的影响。FP8 章改用原始 E4M3/E5M2 论文作为专属来源，避免暗示 TensorRT 支持所有比较格式。 |
| `convolution-lowering` | `window`、`stride`、`im2col` | 窗口章改为真实窗口乘加公式，(1,1) 的 [5,6,9,10] 与 [1,0,0,1] 得 15；尺寸公式放到 Stride 章；im2col 骨架现在组织所有窗口行，并说明实际可不物化。 |
| `reduction-scan` | `tree`、`prefix`、`boundary` | 总和章公式对应 (1+2)+(3+4)=10；前缀章才展示 [1,3,6,10] 的 Scan 公式；边界章代码与全负 max 的 0/−∞ 反例一致。保留逐轮快照语义。 |
| `gather-scatter` | `gather`、`scatter`、`inverse` | Gather [2,0,2] 保留重复读取；Scatter-add [1,0,1] 合并两条贡献；有重复/缺失不能构造逆排列。核对输出与原子性边界后保留。 |
| `paged-attention-kernel` | `read`、`compute`、`tail` | 读取章聚焦逻辑→物理→K/V；计算章改为 Softmax 加权式及独立值 2.471149；尾长 3 改用排除式及输出 1.514820，明确物理尾槽仍有值而权重必须为 0。截图复核后让 `tail` 初始状态使用章题指定的长度 3，保留长度 4 切换对照；正文明确长度条件。 |
| `quantized-matmul` | `groups`、`dot`、`backend` | 分组码 [2,−1,3,2] 与 Scale [.5,.25] 得点积 1.75；错误平均 Scale 得 2.25；融合反量化不删除 Scale 的读取和应用。保留无 zero-point 的明确范围。 |
| `sampling-kernel` | `rows`、`cdf`、`parity` | 修正首章“同时展示 CDF”的错误描述，当前只比较各行概率和；CDF 章 [0.6,.85,.95,1] 用 u=.75 选词 1；Greedy 改变分布而非等价加速。 |
| `kernel-tuning` | `coverage`、`resources`、`experiment` | BM 2→4 时 Program 6→4、槽 24→32；每Program累加器不等于每线程寄存器。实验章新表直接展示遗漏 Mask 的 8 个越界写，正确性不通过不得进入计时排名。 |
| `compiler-lowering` | `capture`、`fusion`、`program`、`ir`、`layout`、`target`、`tradeoff` | 捕获与直接 Triton 入口不同；融合例保留数值与外部 u；N=10 尾块屏蔽；TTIR/TTGIR/LLVM/PTX/SASS 的职责不混淆；四线程图为手工所有权。修正 target→tradeoff 承接；不伪造 SASS 或逐Pass实证。 |
| `triton-tiling` | `output`、`reduce`、`layout`、`edge`、`tune` | 输出 Tile 现在可追踪不同区域并高亮整个 A 行带/B 列带；K 累计不覆盖旧和；四线程 Layout 为教学；M5/N6 的 36→48 槽与 6→4 Program 保持独立；Autotune 仍需正确性与测量。 |
| `runtime-graph` | `order`、`replay`、`lifetime`、`measure` | 跨 Stream 消费需满足完成依赖；串行例 42→34μs 的 Graph 重放仍是 3 个 Kernel；生命周期章代码改成缓冲保活、分别等待拷贝与计算、地址更新协议；收益不从提交次数直接推出。 |
| `gemm-tiling` | `dot`、`reuse`、`roofline`、`pressure` | 点积逐 K 累加；Tile 重用图改善同上；I=2MNK/字节的假设清楚；pressure 测验改问当前 Tile 的尾部/资源权衡，不再重复不在该章图内的 Roofline 数值题。 |
| `attention-tiling` | `scores`、`tiles`、`rescale`、`io`、`verify` | 分数、概率、Value 分开；m/l/a 跨块保留；最大值变大时旧分子分母都乘 α；不以分块等同稀疏；负 Value 与直接 Softmax 参考数值一致。保留现有专用图及低精度/Mask/多头未覆盖边界。 |
| `fused-norm` | `row`、`zero`、`rope`、`gate`、`fusion` | 整行平方均值及 ε 顺序保持；RoPE 补二维旋转式与 [1,0]→[0,1]；SwiGLU 补 silu(g)⊙u 的数值；融合章替换无关 ReLU 图，使用残差和、共同分母、外部结果与匹配测验。 |
| `profiling` | `boundary`、`counterfactual`、`evidence`、`experiment` | 明确提交/Kernel/请求完成边界，保留 Amdahl 串行假设；证据章新图展示采样分母反例，不能从 Stall 百分比单独归因；复现章仍要求同任务、绝对时长与无收益对照。 |

## 证据与实现范围

2026-11-19 重新核对的一手资料包括：[MLIR LangRef](https://mlir.llvm.org/docs/LangRef/) 的值定义/使用结构、[MLIR Bufferization](https://mlir.llvm.org/docs/Bufferization/) 的旧值读取冲突、[PyTorch Tensor Views](https://docs.pytorch.org/docs/2.15/tensor_view.html) 的共享存储、[Triton 编译阶段](https://pytorch.org/blog/triton-kernel-compilation-stages/) 的产物层次、[Triton GEMM 教程](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html) 的 Program 责任与 K 累计、[TensorRT 动态形状](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dynamic-shapes.html) 的 Profile 和执行上下文、[量化方案](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-schemes.html) 的码值与 Scale、[FP8 原论文](https://arxiv.org/abs/2209.05433v2)、[RMSNorm 定义](https://docs.pytorch.org/docs/2.15/generated/torch.nn.RMSNorm.html)、[FlashAttention 原论文](https://arxiv.org/abs/2205.14135v2) 与 [Nsight Compute Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html) 的采样及复现边界。

这些资料支撑机制和限制；本轮没有声称按固定提交完整审计这些项目，没有生成真实 GPU 编译产物，没有真实 GPU、生产流量或真人学习效果测试。动态文档可能继续更新，页面中来源日期与版本不能等同二进制来源证明。

新模型集中于 `site/js/compiler-kernel-models.js`，无 DOM、存储、网络或设备调用。已有数值模型继续覆盖地址、迭代空间、分页读取、分组 Scale、卷积、矩阵乘法与在线 Softmax。新图按具体机制使用值依赖图、矩阵、数轴、候选比较或证据表，未把统一流程模板复制到 94 章。

## 本组已运行验证

- `node --test tests/compiler-kernel-review.test.mjs`：8 项通过。包含独立 RMSNorm 参考、分页注意力直接指数加权、相同 Engine 接口的新输入、显式舍入反例、章级公式/测验覆盖和可达的其它 GEMM Tile。分页渲染回归同时检查默认选中长度 3、输出 1.5148、尾槽被排除，以及切到长度 4 后输出 2.4711、四槽都有效。
- `node --test tests/curriculum-system.test.mjs tests/mechanism-chapters.test.mjs`：27 项通过。包含所有基础课程渲染及既有数学不变量。
- 本地启动隔离 Chromium 时运行环境返回 `socket() failed: Operation not permitted`；浏览器运行由远端 CI 完成。本组随后实际读取 `audit-2bed8bc/results/` 中 10 个路由各 1365/360 宽度的 20 张截图：`compiler-lowering-ir`、`ir-ssa-values`、`fusion-legality-precision`、`buffer-liveness-bufferize`、`engine-build-runtime`、`fused-norm-fusion`、`paged-attention-kernel-compute`、`paged-attention-kernel-tail`、`profiling-evidence`、`convolution-lowering-window`。发现并修正上面的尾长初始状态问题；这 20 张是修正前证据；修后图形以[PR #6 的最终提交复验](https://github.com/sbf20010121-svg/ai-inference-learning-map/pull/6)截图为准，不沿用为修后截图。
- 本组另已实际检查 `audit-9f0edef/results/` 的编译缓存、在线 Softmax 重缩放及 1365/360 四行 MathML 展开截图。刻度与各阶段时间可读，V 值可见；四行公式的指数、分数及推导段落没有裁切。手机宽表逐项核查可发现性：Paged 的 K/V、权重和输出另有可见矩阵/正文，Profiling 的两组比例和判断在正文完整呈现，精度反例的两个结果在正文可读。

以上证明限定数学对象和本次调用中的渲染回归；不把浏览过页面、自动测试通过或有来源链接当作已证明学习效果。
