# 模型、具身与世界模型逐章复核

日期：2026-11-19。范围：21 门课、83 个稳定章节。此次逐章检查问题、输入输出、图示对象、数值、公式/骨架、自测和衔接；保留能够回答问题的已有内容，修复错配与遗漏。表中的“核对”不表示重新实现了生产模型，更不表示完成真人学习效果研究。

## 实际修正

- 输出头现在显式接收**模型层之后的给定隐藏状态**，避免“查Embedding后直接输出”跳过整个模型的错觉。
- 完整层改成可逐阶段复算的 Pre-Norm 小层：两次 RMSNorm、缩放因果 Attention、ReLU FFN、两次残差。旧 `llm-block/layer` 也使用该图，不再套用标量 `max(2x+1,0)` 的融合案例。轴对照只改 Token0，保留 Token1 输入，直接观察行间 Attention 与逐行 FFN 的区别。
- 生成图将“前向完成”和“采样”拆为不同事件；达到 EOS/长度上限后不再给最后一个 Token 多做下一轮前向。已选中序列、已计算位置和新增长度三个口径分别展示。
- 采样补齐 Top-k 交互，并明确温度→Top-k→归一化→Top-p→归一化的教学顺序。`k=2,p=.7` 是关键反例：当前质量 `12/17` 已越过阈值，只保留词0；若错用最初的 `.6` 作分母会错误保留两项。温度页不再额外叠加 Top-p 截断。
- 滑窗图补两层可达范围及 2×2 Tile 占用；15/21 条连接与 20/24 个整块槽位分别计数。配对数不冒充 GPU 时间。
- Patch 投影加入实际 4→2 点积；改一个像素就改变投影结果。MoE 专家图加入 X/W/Y，产生的单坐标与 Combine 相同。MLA 位置图固定内容分数4，只改变位置项，显示删除该支路会漏掉的分数。
- Delta 明确单位 Key 条件、衰减后的旧预测、已乘 β 的块内残差。普通固定状态、关联累加、Delta 和 SSM 不混用一套公式。
- 具身课程修复“图未画到达时刻却声称画了”、生成步数3/4错配、质量章误放融合代码等问题；相对轨迹增加错当逐步增量的 `[10,11,13]` 反例。
- Dreamer KL 例明确区分原始 KL 的 stop-gradient 路径与完整 `max(1,KL)` 损失。本例约 `.1927 nat` 低于1 nat，下界裁剪后该 KL 项梯度为0，不能由“开放梯度路径”声称一定更新参数。
- 去掉基础层/注意力连接/动作表示/闭环/策略家族指向后续高级实现课的反向强先修；修正跨章“下一步”文案与实际顺序不符之处。

## 逐章记录

“修改”表示本次改变内容或可观察交互；“核对”表示逐项确认现有案例在所列假设下与问题一致。所有图中权重、像素、概率、时间和位置数值都是本项目教学构造。

| 课程 / 章节 | 核对对象与结果 |
|---|---|
| token-embedding / tokens | 修改：具体文本→片段→ID；两种自设词表规则改变边界，不冒充真实分词结果。 |
| token-embedding / lookup | 修改图注：ID读取整行，X是模型层输入；编号不决定向量大小或距离。 |
| token-embedding / head | 修改：给定最终h与输出W逐词点积 `[1,1,2,−1]`；自测区分logit、概率和已计算Token。 |
| transformer-layer / residual | 重做：2×2隐藏矩阵走完整简化层，明确旁路加回原X/中间U，不是归一化后的值。 |
| transformer-layer / axes | 重做：只改Token0，Token1独立FFN保持 `[5,4]`，因果Attention输出改变。 |
| transformer-layer / expand | 修改：Up/ReLU/Down一致；Down第三行 `[1,1]` 参与两输出，不再误写“取前两列”。 |
| generation-state / positions | 重做：输入、Prefill完成、采样、Decode完成分开；采样增加序列长度但不增加computed。 |
| generation-state / stop | 修改：EOS与长度上限均在下一次前向之前检查；新增章内自测。回收仍依赖引用与在途使用。 |
| sampling-distribution / temperature | 修改：纯温度对照，T=2概率等于归一化的原概率平方根，保持排序。 |
| sampling-distribution / nucleus | 修改：k/p分别可控，显示Top-k后分母与Top-p阈值，覆盖跨阈值整项。 |
| sampling-distribution / draw | 修改章内自测：u=.75落在第二个CDF区间；CDF按选定词序累计，不要求先按概率排序。 |
| attention-patterns / mask | 核对：长度6、窗口含当前位且大小3，Query5直读3/4/5；0是连接标志，不是参与Softmax的零分数。 |
| attention-patterns / layers | 修改：两层后5可能依赖1..5、仍不可达0；可达与保真保留、单层直连区分。 |
| attention-patterns / implementation | 重做：逐Tile有效格与非空块数；规则稀疏性、执行粒度与精确Attention分块分别解释。 |
| vision-patches / patches | 核对：4×4单通道、2×2Patch→4个Token，首Patch `[0,1,4,5]`；RGB另有通道轴。 |
| vision-patches / projection | 重做：4×2权重投影 `[0,1,4,5]→[4,6]`；像素5改9后得到 `[4,10]`。 |
| vision-patches / resolution | 修改自测：边长翻倍→Token四倍→该全局配对十六倍；不推断整个模型时延。 |
| multimodal-bridge / width | 核对：4×3视觉与3×2投影得到4×2，再和2×2文本沿序列轴拼接。 |
| multimodal-bridge / interfaces | 修改自测：拼接候选域6×6与文本交叉读视觉2×4；候选域不是实际Mask。 |
| multimodal-bridge / cache | 核对：图像编码、投影、联合上下文KV分别核对有效条件，不能只按图像相同复用。 |
| state-families / updates | 修改：标量Key=1、初态0、无遗忘条件下，累加6、Delta4；非单位Key不保证β=1一步纠正。 |
| state-families / ssm | 核对：a=.5,b=1,x=[2,4]→h=[2,5]；标量演示不冒充完整Mamba。 |
| state-families / compare | 核对：固定大小仅是存储性质；状态轴、门控、更新式、精度和布局才决定Kernel能否复用。 |
| observation-contract / time | 修改：采集偏差20ms、使用时观测年龄40ms；明确图未模拟传输到达时间。 |
| observation-contract / frame | 核对：相机点 `[1,0]` 先旋转90°再平移 `[1,2]`→世界 `[1,3]`，同一物理点身份不变。 |
| observation-contract / contract | 核对：相机顺序/单位改变而Shape保持不变；训练归一化仍须核对。 |
| action-representation / anchor | 重做：固定锚点偏移与逐步增量分开；错误累加得到 `[10,11,13]`，公式和推导跟随本章。 |
| action-representation / normalize | 核对：先反归一化再加原锚点，μ=1、σ=2与训练约定一致。 |
| action-representation / late | 修改自测：改用11解码会整体平移目标，不能未经约定重新锚定。 |
| policy-families / paths | 核对：调用次序轴不是等长实测时间；一次Chunk、整块迭代、离散自回归的依赖不同。 |
| policy-families / ensemble | 核对并移入对应代码：按绝对t3对齐3与21，等权得12；不按相同数组下标混合t3/t5。 |
| policy-families / quality | 修改：移除与本章无关的融合代码；保留调用次数、总时长、任务质量的验证边界。 |
| robot-data / window | 核对：全局帧1取三未来项时第三项跨Episode，Mask `[1,1,0]`。 |
| robot-data / align | 核对：固定本例训练偏移0，运行偏移1改变标签语义；不宣称所有系统都应偏移0。 |
| robot-data / split | 核对：相邻相关帧跨训练/测试的泄漏风险；按Episode划分也不解决所有泛化问题。 |
| closed-loop / disturb | 修图文表述：开环在+1干扰后终点4，理想及时反馈终点3；表格列命令/干扰/实际状态。 |
| closed-loop / latency | 核对：晚一步观测使用旧状态，不能偷看最新状态，终点又变4。 |
| closed-loop / evaluate | 核对：质量、失败与时延一起报告；手工一维反馈不替代机器人实验。 |
| world-learning / targets | 核对：观测、奖励、延续是不同监督头，标签示例不冒充模型预测。 |
| world-learning / distributions | 修改：KL数值与梯度职责分开；补齐1 nat裁剪在本例产生零KL梯度这一边界。 |
| world-learning / imagination | 核对：未来无真实观测，只能走先验；Actor使用不必每步做显式规划，手工h递推不冒充RSSM。 |
| diffusion-transformer / noise | 核对：z0=2、ε=−1、ᾱ=.25→1−√.75；知道真实噪声才可精确反解，实际模型预测噪声。 |
| diffusion-transformer / axes | 修改问题中的3步为图中4步；每步处理16个视频Token，帧时间不是去噪步骤。 |
| diffusion-transformer / quality | 修改章内自测：调用减半不自动提高质量/规划成功率，也不改变视频物理时长。 |
| llm-block / heads | 核对：四Query头映射到一/两KV头；共享K/V不合并Query输出。 |
| llm-block / causal | 核对：Query行与历史Key列分开；Decode新增一行不等于只读一个历史位置。 |
| llm-block / projection | 核对：M是本轮位置展开行数，Prefill/Decode权重相同但重用不同。 |
| llm-block / history | 核对：新位置与已有历史分开计量；KV头数、头维、位置数共同决定元素量。 |
| llm-block / layer | 重做：显示完整简化层中间值与两次旁路，不再复用无关融合图；显式限制真实Kernel推断。 |
| moe-route / router | 核对并补图注：给定自设logits后选专家，再按本例规则归一化；与词表采样的Top-k用途不同。 |
| moe-route / dispatch | 核对：4 Token×Top2→8记录，分桶保持原Token身份和专家身份。 |
| moe-route / ep | 核对并补边界：专家权重留在所属卡，搬激活/元数据；单向记录数不等于字节数或往返量。 |
| moe-route / grouped | 重做：X_e[M,2]、W_e[2,1]、Y_e[M,1]可手算，输出与合并图一致；仍只模拟一个投影坐标。 |
| moe-route / combine | 核对：按token-expert身份找回输出，乘对应权重后求和，不按当前数组位置乱加。 |
| moe-route / balance | 核对：每专家M、派发/返回、计算都进入证据范围；分组计算不自动均衡Router。 |
| mla-kv / latent | 核对：c=[2,1]经3×2的U展开为 `[2,1,3]`，表示压缩与删除历史区分。 |
| mla-kv / absorb | 核对：qᵀ(Uc)和(Uᵀq)ᵀc在两组q下得4/7，范围仅内容支路。 |
| mla-kv / position | 重做：内容项4不变，位置项1/0/−1使总分5/4/3；局部结合律不能删除位置分支。 |
| mla-kv / tradeoff | 核对：Value、多头、潜维、位置维与真实布局未由内容小例覆盖；压缩字节不直接推出时延。 |
| linear-state / state | 核对：Key行×Value列的关联状态，qᵀS不是恢复历史Token列表。 |
| linear-state / write | 核对外积沿Key分量分配残差；截图展开复核后修正公式朝向：S为K×V，k/v为列向量，δ=v−Mᵀk，写入βkδᵀ。 |
| linear-state / correction | 修改首用说明：β=1完整纠正需要单位Key；补正预测、残差与执行骨架的列向量约定，数值结果未改。 |
| linear-state / gate | 核对：先衰减旧状态，再用衰减后的矩阵预测与纠错；不能只缩小新写入。 |
| linear-state / chunk | 核对：两步组合A₂A₁S+A₂B₁+B₂满足结合但不可任意交换时间顺序。 |
| linear-state / triangle | 修改D定义：第i行为βᵢδᵢᵀ，K/V每行为kᵢᵀ/vᵢᵀ；γ=1、S0=0下三角前代解与逐Token状态一致。 |
| linear-state / kernel | 核对：Recurrent/Chunk的依赖与Tile对象，WY不等于消除依赖，教学仿射矩阵不冒充生产Kernel。 |
| linear-state / cost | 核对：固定K×V仍有状态流量/驻留、投影、提交和依赖成本；无硬件性能结论。 |
| linear-state / diagnosis | 修改不变量：S新=γS旧+写入，避免有门时漏衰减；判断题保留独立复算路径。 |
| vla-policy / contract | 核对：动作块是有表示/维度/有效时刻的动作对象，生成步与实际控制步区分。 |
| vla-policy / training | 核对：π₀约定A(τ)=τA+(1−τ)ε，监督A−ε；推理不能使用未知真实A。 |
| vla-policy / flow | 核对：手工da/dτ=1−a的Euler更新作用于整段动作变量，不冒充训练网络或电机速度。 |
| vla-policy / queue | 核对：Chunk返回要按执行时刻对齐，旧位置需裁剪/融合；人工队列不验证真实控制。 |
| vla-policy / sync | 核对：首次启动无旧动作覆盖；串行推理/执行的等待位置可重放。 |
| vla-policy / async | 核对：推理耗时与剩余动作覆盖窗共同决定断流；持续输出仍需动作有效。 |
| vla-policy / stale | 核对：更早请求可能使用更旧观测；无等待不等于任务质量不变。 |
| vla-policy / decision | 核对：由给定剩余量与完成时刻判断耗尽；不将合成节拍升级为真实加速比。 |
| world-model / roles | 核对：模型预测、策略选动作、规划器评价不同职责；手工轨迹不冒充真实环境。 |
| world-model / rssm | 核对：h确定记忆与z随机状态；有观测后验/无观测先验分叉，想象不消费反事实后验。 |
| world-model / latent | 核对：两状态Bayes例先验×似然再归一，明确不是Dreamer实际编码网络。 |
| world-model / imagine | 核对：固定候选动作的模型预测路径与真实环境路径分开，长滚动误差仍需测量。 |
| world-model / video | 核对：F帧×P Patch的时空身份，全局N²只适用指定连接模型。 |
| world-model / factor | 增加真实切换：跨帧格从“跨”变0，配对数同步更新，明确移除时间连接需要其它机制补足。 |
| world-model / validate | 核对：预测误差、长滚动、任务质量与成本分别验收；没有模型运行和机器人实测认证。 |

## 数值与行为验证

新增 `tests/model-lesson-review.test.mjs` 8 项，覆盖完整层独立标量参考、Top-k/Top-p组合分母、T=2解析概率、采样/计算/终止事件、滑窗跨层可达与Tile占用、MoE数值身份、非单位Key反例，以及新图的可观察差异。完整层默认输出独立算得：

```text
[[2.264910890110867, -3.2649108110852145],
 [6.292925348629948,  3.627722806612905]]
```

运行 `node --test tests/model-lesson-review.test.mjs tests/curriculum-system.test.mjs tests/focus-reader.test.mjs tests/mechanism-chapters.test.mjs`，39 项通过、0 失败。全站浏览器、手机布局、数据往返和最终集成结果另由总验收记录给出；此处不把Node测试等同于已看过浏览器截图。

### 展开公式后的复核补正（2026-11-19）

实际查看 `audit-9f0edef` 的桌面及360像素宽度展开截图后，发现旧课程公式把列目标 `v` 与行预测 `kᵀM` 相减，又对残差整体转置，维度不一致。此前折叠截图和数值测试均不足以发现这一表达错误，原“核对”记录不能代替公式展开复核。

现统一为 `S、M: K×V`，`k、q: K×1`，`v、δ: V×1`：

`M_t=γS_{t−1}`；`δ_t=v_t−M_tᵀk_t`；`S_t=M_t+βk_tδ_tᵀ`。

等价行残差为 `δᵀ=vᵀ−kᵀM`，列输出为 `o=Sᵀq`，原图的 `qᵀS` 明确表示行输出 `oᵀ`。块内矩阵把每个列向量转置后堆成行，`D[i,:]=βᵢδᵢᵀ`，所以 `(I+L)D=βV` 与 `S=KᵀD` 的维度继续成立。

修正覆盖当前 `course-notes.js` 的MathML、变量定义和伪代码，`chapter-arc.js` 的首用术语，`mechanism-source.js` / `chapter-evidence.js` 的复用骨架，以及当前和旧阅读器的预测/残差标签。检索发现旧研究页及研究说明仍保留同一错误，已同步更正其公式与标签；`research-models.js` 只改文件头说明，所有数值函数、数据和结果均未修改。一维数组保存的是向量分量，`rowvec(k,M)` 与列预测 `Mᵀk` 的分量相同，无须改变数值实现。

运行现有 `research-labs`、`research-links`、`course-models`、`mechanism-chapters`、`focus-reader`、`chapter-arc`、`model-lesson-review` 七组测试，共39项通过、0失败。旧错误残差表达已检索清除。新三行MathML的最终截图及复核结果以[PR #6 的最终提交复验](https://github.com/sbf20010121-svg/ai-inference-learning-map/pull/6)为准，不把修改前截图当作修改后证据。

## 依据与范围

此次核对使用一手来源。动态页面按2026-11-19访问记录，未宣称固定版本源码审计；权重和小例为原创教学构造，没有复制第三方图片或正文。

- [Hugging Face Tokenizer pipeline](https://huggingface.co/docs/tokenizers/pipeline)；[Generation](https://huggingface.co/docs/transformers/main_classes/text_generation)及[Logits processors](https://huggingface.co/docs/transformers/main/internal/generation_utils)：分词、温度、Top-k、Top-p与终止配置。
- [Transformer](https://arxiv.org/abs/1706.03762)、[GQA](https://arxiv.org/abs/2305.13245)、[ViT](https://arxiv.org/abs/2010.11929)、[Mistral](https://arxiv.org/abs/2310.06825)：注意力/FFN、头归属、Patch投影与滑窗。完整层图明确采用Pre-Norm/RMSNorm教学变体，不冒充Transformer原论文的Post-Norm。
- [Megatron Core MoE](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/moe.html)：EP、Token dispatcher、GroupedGEMM的职责区分。页内未承诺生产后端、负载均衡或通信重叠收益。
- [DeepSeek-V2 v5 §2.1](https://arxiv.org/html/2405.04434v5)：内容投影吸收与解耦RoPE；位置分数反例仅证明支路不能任意删除，不是完整MLA执行器。
- [Gated DeltaNet v3](https://arxiv.org/html/2412.06464v3)与[FLA固定提交 recurrent kernel](https://github.com/fla-org/flash-linear-attention/blob/98193113ecb7835143252a786e06933e371b67cc/fla/ops/gated_delta_rule/fused_recurrent.py)、[Mamba](https://arxiv.org/abs/2312.00752)：更新语义与块内依赖。单位Key的纠错条件由本页公式直接推导；未验证生产Chunk精度/性能。
- [LeRobot动作表示](https://huggingface.co/docs/lerobot/main/action_representations)、[ACT](https://arxiv.org/abs/2304.13705)、[π₀](https://www.physicalintelligence.company/download/pi0.pdf)：参考状态、相对/增量、归一化顺序、时间对齐和Flow训练/推理边界。没有执行真实机器人控制。
- [DreamerV3 v2 Eq.(1–4)](https://arxiv.org/html/2301.04104v2)：先验/后验、世界模型监督、stop-gradient、1 nat下界及Actor使用；[DiT](https://arxiv.org/abs/2212.09748)与[DDPM](https://arxiv.org/abs/2006.11239)：潜空间Patch网络与加噪公式。没有训练/加载模型、视频生成质量或策略成功率实测。
