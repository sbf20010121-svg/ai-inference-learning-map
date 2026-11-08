import { define, page, math } from "./foundation-lessons.js";
export const modelCourses = [
  define({
    id: "token-embedding",
    module: "model",
    unit: "model-contract",
    title: "分词、Embedding 与输出词表",
    goal: "把文本、Token ID、隐藏向量和词表分数区分为四种对象。",
    why: "模型真正接收数值张量；Tokenizer规则和Embedding权重必须与模型匹配。",
    prereqs: [],
    source: "https://huggingface.co/docs/tokenizers/pipeline",
    section:
      "Tokenizer pipeline：normalization、pre-tokenization、model与post-processing；ID表为教学自设。",
    terms:
      "Token|词表中的一个离散单位，不必等于一个汉字或单词;ID|Token在词表中的整数索引;Embedding|按ID读取的可学习向量;logits|输出头产生的未归一化词表分数;V/H|词表大小/隐藏维度",
    chapters: [
      page(
        "tokens",
        "文本怎样变成ID",
        "同一句话为什么可能不是逐字一个Token？",
        "本例词表含“推理”“系统”和单字备用项。切换合并规则，比较Token边界与ID数量；这不是某个真实模型的分词结果。",
      ),
      page(
        "lookup",
        "查表不是对ID做乘法",
        "ID=2怎样得到隐藏向量？",
        "Embedding矩阵每行对应一个ID。选择ID即读取整行，不是把整数2直接当语义大小；不同ID之间没有由编号决定的距离。",
        { code: true },
      ),
      page(
        "head",
        "隐藏向量回到词表",
        "H维状态怎样变成V个候选词分数？",
        "输出头把隐藏向量投影到词表轴，之后还需要采样或选择。输入Embedding与输出头可能绑权重，也可能不绑，必须查模型配置。",
        { formula: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>X</mi><mo>=</mo><mi>E</mi><mo>[</mo><mi>ids</mi><mo>]</mo><mo>,</mo><mi>logits</mi><mo>=</mo><mi>h</mi><msup><mi>W</mi><mi>T</mi></msup></mrow>",
    ),
    derive: [
      "教学Embedding有4行、每行2维；输入ID=[2,0]。",
      "查行得到2×2隐藏矩阵；编号2本身不是一个两倍大的向量。",
      "输出头W为4×2，单个隐藏向量h为2维，hWᵀ得到4个词表分数。",
    ],
    code: "E=[[1,0],[0,1],[1,1],[-1,0]]\nids=[2,0]\nX=[E[i][:] for i in ids]\nassert X==[[1,1],[1,0]]",
    quiz: [
      "Embedding矩阵[4,2]、ID序列长度3，输出Shape是什么？",
      ["[3,2]", "[4,3]", "[3,4,2]"],
      0,
      "每个ID读取一行2维向量，共3行；不复制整张词表。",
    ],
    limit:
      "自设词表与权重不代表真实语言模型；特殊Token、模板和分词规范需按Tokenizer配置核对。",
  }),
  define({
    id: "transformer-layer",
    module: "model",
    unit: "model-contract",
    title: "完整 Transformer 层与残差路径",
    goal: "沿同一隐藏状态走完归一化、注意力、残差与前馈，理解层不等于单个Attention。",
    why: "只理解QK计算会漏掉投影、MLP和残差的计算与访存；不同架构的归一化位置也不同。",
    prereqs: [
      ["token-embedding", "输入层将离散ID转为可计算的隐藏向量。"],
      ["fused-norm", "先理解归一化的跨元素依赖与门控计算。"],
    ],
    source: "https://arxiv.org/abs/1706.03762",
    section:
      "Transformer原论文的Attention、FFN和残差；本课采用明确标注的Pre-Norm教学变体，非原论文Post-Norm结构。",
    terms:
      "residual|保留输入并与子层输出相加的路径;Pre-Norm|子层前进行归一化;FFN/MLP|逐Token的前馈网络;hidden axis|每个Token内部的特征轴;sequence axis|不同Token位置组成的轴",
    chapters: [
      page(
        "residual",
        "同一输入走了哪两条路",
        "残差相加为什么不能替换成只输出子层结果？",
        "图中保留输入x的身份和子层贡献。x=[1,2]、子层输出=[0.5,−0.5]时，残差得到[1.5,1.5]；删除旁路会改变信息与数值。",
      ),
      page(
        "axes",
        "Attention与FFN各混合哪条轴",
        "为何FFN不直接把不同Token的行相加？",
        "Attention通过合法Key位置混合序列信息；FFN对各行共享权重，主要在特征轴内变换。图对照同一2×2矩阵的行间配对与行内扩维。",
        { formula: true },
      ),
      page(
        "expand",
        "扩维与下投影",
        "隐藏维2扩为3再投回2，中间张量是什么？",
        "逐行计算Up、非线性、Down，然后再接残差。小例选择ReLU FFN，SwiGLU另见门控课；不能据此假设所有模型都有相同FFN。",
        { code: true, quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>u</mi><mo>=</mo><mi>x</mi><mo>+</mo><mi>Attn</mi><mo>(</mo><mi>Norm</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>)</mo><mo>,</mo><mi>y</mi><mo>=</mo><mi>u</mi><mo>+</mo><mi>FFN</mi><mo>(</mo><mi>Norm</mi><mo>(</mo><mi>u</mi><mo>)</mo><mo>)</mo></mrow>",
    ),
    derive: [
      "残差输入[1,2]，Attention子层贡献[0.5,−0.5]，相加得[1.5,1.5]。",
      "独立FFN小例用x=[1,−2]、Up列[1,0]、[0,1]、[1,1]，得到[1,−2,−1]。",
      "ReLU后[1,0,0]，Down取前两列得[1,0]；这一步的数值例专门隔离FFN，不冒充整层实算。",
    ],
    code: "x=[1,-2]\nup=[x[0],x[1],x[0]+x[1]]\nact=[max(0,v) for v in up]\ndown=[act[0]+act[2],act[1]+act[2]]\nassert down==[1,0]",
    quiz: [
      "单独执行共享权重FFN，会不会自动让Token0读取Token1的内容？",
      [
        "会，因为矩阵乘都混合所有轴",
        "不会，它逐Token变换特征，序列混合由其它机制承担",
        "只要扩维就会",
      ],
      1,
      "必须看矩阵的轴。FFN权重作用于隐藏维，不是序列位置轴。",
    ],
    limit:
      "Pre-Norm结构及独立子算例；未声称加载某个完整模型，残差、Norm位置、门控和权重绑定均可能因架构不同。",
  }),
  define({
    id: "generation-state",
    module: "model",
    unit: "generation",
    title: "自回归生成的状态与停止",
    goal: "连续追踪输入位置、已计算位置、待采样Token和停止条件，避免把一次前向当整次生成。",
    why: "Prefill得到下一Token分布，后续每步将选中的Token接回上下文；引擎还要管理请求状态。",
    prereqs: [
      ["token-embedding", "输出头给出候选分数，还未完成离散Token选择。"],
      ["llm-block", "历史KV与新位置的形状在生成中连续变化。"],
    ],
    source: "generation",
    section:
      "Generation：max_new_tokens、eos_token_id、stopping_criteria与返回序列。",
    terms:
      "prefix|当前已确定的上下文;next-token distribution|给定当前前缀的下一Token概率;EOS|配置为结束标记的Token;max_new_tokens|本次允许新增的Token数量",
    chapters: [
      page(
        "positions",
        "采样与计算不是同一状态",
        "Token刚采样出来时，它的KV是否必然已经计算？",
        "前缀前向给出新Token；该Token通常要在后续前向中进入模型，才产生其对应KV。图分别数“已选中”和“已计算”，不让两个计数混为一谈。",
      ),
      page(
        "stop",
        "停止之后释放什么",
        "EOS或长度上限出现时，为什么不应继续无限安排？",
        "根据请求策略结束输出，撤销不再需要的计算与缓存引用，并保留返回结果。EOS是否生效受配置影响，不是所有字符串相同就自动结束。",
        { quiz: true, code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>P</mi><mo>(</mo><msub><mi>x</mi><mn>1:T</mn></msub><mo>)</mo><mo>=</mo><mo>∏</mo><mi>P</mi><mo>(</mo><msub><mi>x</mi><mi>t</mi></msub><mo>|</mo><msub><mi>x</mi><mi>&lt;t</mi></msub><mo>)</mo></mrow>",
    ),
    derive: [
      "已有2个Prompt位置并完成前向，输出第1个新Token候选。",
      "选中后序列长度3，已计算位置仍可能是2。",
      "下一步计算该Token后已计算位置变3，再选择后续Token；长度或EOS策略决定是否继续。",
    ],
    code: "generated=[]\nfor step in range(max_new_tokens):\n    token=sample(next_logits)\n    generated.append(token)\n    if token in eos_ids: break\n    next_logits=model_step(token,kv) # 生成循环骨架",
    quiz: [
      "Prompt已计算2位置，刚选出第一个新Token，序列长3。KV是否一定已有3位置？",
      ["一定", "不一定，新Token可能还没经过后续前向", "KV只能有1位置"],
      1,
      "离散选择和模型计算是两个事件；实际引擎可能有流水或推测，需查看对应计数定义。",
    ],
    limit:
      "普通自回归请求示例；推测解码、Beam Search、多模态位置和流水实现需要分别扩展。",
  }),
  define({
    id: "sampling-distribution",
    module: "model",
    unit: "generation",
    title: "温度、Top-k 与 Top-p 采样",
    goal: "从Logits算出实际采样集合与归一化分布，区分概率、排序和随机选择。",
    why: "推理输出不是只有argmax；截断与温度改变采样语义，比较优化必须保持相同配置。",
    prereqs: [
      [
        "token-embedding",
        "输出头给出未归一分数，温度、筛选和采样需要把它转成明确概率。",
      ],
    ],
    source: "generation",
    section:
      "GenerationConfig：temperature、top_k、top_p；本例分别展示规则，组合顺序需看后端。",
    terms:
      "temperature|对Logits缩放的正数;Top-k|只保留评分最高的k项;Top-p|按概率从大到小保留累计至少p的最小集合;CDF|排序后概率的累计和;renormalize|对保留部分重新归一",
    chapters: [
      page(
        "temperature",
        "温度改变什么",
        "把温度从1变2，排序和概率各怎样变化？",
        "Softmax使用logit/T。正温度保持分数排序，但放大或缩小差距；更高温度通常使分布更平，不是把每个概率直接乘2。",
        { formula: true },
      ),
      page(
        "nucleus",
        "沿累计质量确定集合",
        "概率[0.6,0.25,0.1,0.05]，Top-p=0.8保留几项？",
        "累计依次0.6、0.85、0.95、1，最小满足集合有两项。归一后概率为0.6/0.85和0.25/0.85；这不是选一个最接近0.8的词。",
        { code: true },
      ),
      page(
        "draw",
        "一个随机数怎样选词",
        "CDF区间和随机数0.75如何对应一个Token？",
        "在固定Token顺序下用概率区间覆盖[0,1)。随机数落在哪段就选谁；相同分布并不要求两次抽样输出相同Token。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>p</mi><mi>i</mi></msub><mo>=</mo><mfrac><msup><mi>e</mi><mrow><msub><mi>z</mi><mi>i</mi></msub><mo>/</mo><mi>T</mi></mrow></msup><mrow><mo>∑</mo><msup><mi>e</mi><mrow><msub><mi>z</mi><mi>j</mi></msub><mo>/</mo><mi>T</mi></mrow></msup></mrow></mfrac></mrow>",
    ),
    derive: [
      "给定已排序概率[0.6,0.25,0.1,0.05]。",
      "Top-p=0.8保留前两项，总质量0.85。",
      "重新归一为[12/17,5/17,0,0]，总和1；随机数0.75落入第二项区间。",
    ],
    code: "p=[.6,.25,.1,.05]; total=0; keep=[]\nfor i,v in enumerate(p):\n keep.append(i); total+=v\n if total>=.8: break\nout=[p[i]/total if i in keep else 0 for i in range(4)]",
    quiz: [
      "Top-p=0.8在上述分布中会保留多少原始概率质量？",
      ["恰好0.8", "0.85，因为必须保留跨过阈值的那一项", "只保留0.6"],
      1,
      "离散Token的概率不能任意切掉一部分；最小集合累计达到或超过阈值。",
    ],
    limit:
      "无同分边界的四词示例；组合处理顺序、惩罚项、RNG与数值精度应按实际后端核对。",
  }),
  define({
    id: "attention-patterns",
    module: "model",
    unit: "attention-family",
    title: "因果、滑窗、稀疏与混合注意力",
    goal: "在Query×Key矩阵上区分可见关系、计算实现和长期状态。",
    why: "改变连接结构可能改变模型功能；FlashAttention优化精确计算组织，不等同于改成滑窗。",
    prereqs: [
      [
        "attention-tiling",
        "精确分块保持原注意力语义，滑窗则改变可见关系，两者必须分别解释。",
      ],
    ],
    source: "https://arxiv.org/abs/2310.06825",
    section:
      "Mistral 7B：Sliding Window Attention；连接矩阵是自设小例，混合结构另需模型配置。",
    terms:
      "causal mask|屏蔽未来位置的约束;window|单层能直接读取的最近位置范围;sparse pattern|只保留部分Query-Key连接;hybrid|不同层或分支组合不同计算机制",
    chapters: [
      page(
        "mask",
        "哪些格子允许参与",
        "长度6、窗口3时，第5行可以看哪些Key？",
        "窗口包括当前位置，因此Query5能直接看3/4/5。图将全因果与窗口连接逐格对照；屏蔽不是把被屏蔽分数当0参与Softmax。",
        { formula: true },
      ),
      page(
        "layers",
        "单层窗口与多层传播",
        "一层看不到远处，是否说明任何深层都收不到远处信息？",
        "信息可通过中间位置逐层传播，但这不等于单层恢复全局Attention。根据两层窗口依赖追踪一个早期位置，说明感受野与直接连接不同。",
        { quiz: true },
      ),
      page(
        "implementation",
        "稀疏模式怎样落到算子",
        "减少逻辑连接以后，是否已保证GPU更快？",
        "不规则索引、块粒度、数据布局和有效Tile利用率会影响实现。固定同一模式比较实现；改变模式时还要核对模型质量。",
        { code: true },
      ),
    ],
    formula: math(
      "<mrow><mi>visible</mi><mo>(</mo><mi>i</mi><mo>,</mo><mi>j</mi><mo>)</mo><mo>⇔</mo><mi>max</mi><mo>(</mo><mn>0</mn><mo>,</mo><mi>i</mi><mo>−</mo><mi>w</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>≤</mo><mi>j</mi><mo>≤</mo><mi>i</mi></mrow>",
    ),
    derive: [
      "长度6的全因果配对数1+2+3+4+5+6=21。",
      "窗口3时每行连接数1/2/3/3/3/3，共15。",
      "Query5直接看3/4/5；两层中可通过Query3依赖更早位置，但不是增加单层直接边。",
    ],
    code: "def visible(i,j,w): return max(0,i-w+1)<=j<=i\nassert [j for j in range(6) if visible(5,j,3)]==[3,4,5]",
    quiz: [
      "滑窗减少了连接，能否用它证明FlashAttention改变了同样的模型语义？",
      [
        "能，两者完全一样",
        "不能，精确分块与改变连接模式不同",
        "只要配对数少就是同一算法",
      ],
      1,
      "需分别说明计算组织是否等价，以及模型本身的可见关系是否改变。",
    ],
    limit:
      "单层局部窗口与两层传播示例；不复现所有Sparse/Hybrid模型，也不把连接数当真实耗时。",
  }),
  define({
    id: "vision-patches",
    module: "model",
    unit: "multimodal",
    title: "视觉编码：Patch、位置与Token",
    goal: "从图像坐标推到Patch向量及序列，说明分辨率怎样改变视觉计算。",
    why: "VLA/VLM里的图像不是一个抽象框；裁剪、Patch大小和视觉Token数会改变实际张量。",
    prereqs: [
      [
        "token-embedding",
        "图像Token与离散文本ID的产生方式不同，但都需对齐隐藏向量接口。",
      ],
    ],
    source: "vit",
    section: "ViT：图像Patch展平、线性投影及位置表示；数字为教学图像。",
    terms:
      "Patch|图像中固定大小的局部区域;flatten|按约定次序把区域元素排成向量;projection|把Patch特征映射到隐藏维;position embedding|向Token补充空间位置信息",
    chapters: [
      page(
        "patches",
        "网格怎样变序列",
        "4×4单通道图像、2×2Patch会产生几个Token？",
        "图中同色像素属于同一个Patch，按行优先得到4个Patch，每个展平为4个数。RGB时每个Patch还需包含3个通道。",
        { formula: true },
      ),
      page(
        "projection",
        "Patch投影不是查词表",
        "同一位置换像素，向量为什么会变化？",
        "视觉投影使用Patch里的实际像素特征；文本Embedding按离散ID取行。两者输出都可以是H维，但输入与算子不同。",
        { code: true },
      ),
      page(
        "resolution",
        "分辨率改变后的成本",
        "边长从4翻到8、Patch不变，Token数为何变4倍？",
        "空间两条轴同时扩大，网格从2×2变4×4。全局注意力配对从16变256；这只是该计算部分的规模关系，不是整模型时延16倍。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><mi>N</mi><mo>=</mo><mfrac><mi>W</mi><mi>P</mi></mfrac><mfrac><mi>H</mi><mi>P</mi></mfrac></mrow>",
    ),
    derive: [
      "4×4图像、P=2，得到2×2=4个Patch。",
      "每个单通道Patch有4个元素；投影矩阵可将4维变成所需隐藏维。",
      "8×8同样P=2得到16个Token；全局配对4²→16²，增加16倍。",
    ],
    code: "image=[[4*r+c for c in range(4)] for r in range(4)]\npatches=[[image[r+i][c+j] for i in range(2) for j in range(2)]\n for r in [0,2] for c in [0,2]]\nassert patches[0]==[0,1,4,5]",
    quiz: [
      "RGB图像采用2×2Patch，展平输入有多少个数？",
      ["4", "12", "由文本词表大小决定"],
      1,
      "空间4个像素，每个3通道，共12；输出隐藏维由投影决定。",
    ],
    limit:
      "可整除的方形图像；实际模型可能裁剪、动态分辨率、卷积编码或额外特殊Token。",
  }),
  define({
    id: "multimodal-bridge",
    module: "model",
    unit: "multimodal",
    title: "跨模态投影、拼接与交叉注意力",
    goal: "比较视觉特征接入语言模型的两种接口，并核对轴、掩码和位置。",
    why: "“视觉加语言”没有唯一实现；直接拼接与Cross-Attention会产生不同的Q/K/V与缓存路径。",
    prereqs: [
      ["vision-patches", "先明确图像编码器真正输出的视觉Token。"],
      ["llm-block", "拼接或交叉读取都需满足Attention张量接口。"],
    ],
    source: "vlm",
    section:
      "LLaVA的视觉投影接入；Cross-Attention在此作为结构对照，不声称LLaVA采用该路径。",
    terms:
      "projector|把视觉特征映射到语言隐藏接口的模块;concatenate|沿序列轴合并Token;cross-attention|Query来自一组序列、K/V来自另一组;mask|规定哪类Token允许读取哪类内容",
    chapters: [
      page(
        "width",
        "隐藏维先对齐",
        "视觉宽度3、语言宽度2，能直接沿序列轴拼接吗？",
        "两条序列的非拼接轴必须匹配。视觉特征先经3→2投影，再可与2维文本行拼接；不对齐就不是一个合法矩阵。",
        { formula: true, code: true },
      ),
      page(
        "interfaces",
        "两种接口的配对矩阵",
        "拼接自注意力与交叉注意力分别有多大的Q×K区域？",
        "4个视觉、2个文本Token拼接后有6个序列位置，合法连接还受Mask约束。若文本Query交叉读视觉，则配对域是2×4，不是把两个计算都当6×6。",
        { quiz: true },
      ),
      page(
        "cache",
        "什么内容能复用",
        "视觉不变时，哪些编码结果可能复用？",
        "编码、投影和Attention K/V分别有自己的有效条件。相同图像编码不自动保证所有跨模态缓存都能跨请求复用，还要核对位置、上下文和模型接口。",
      ),
    ],
    formula: math(
      "<mrow><mi>V</mi><mo>∈</mo><msup><mi>R</mi><mrow><mn>4</mn><mo>×</mo><mn>3</mn></mrow></msup><mo>,</mo><mi>W</mi><mo>∈</mo><msup><mi>R</mi><mrow><mn>3</mn><mo>×</mo><mn>2</mn></mrow></msup><mo>⇒</mo><mi>VW</mi><mo>∈</mo><msup><mi>R</mi><mrow><mn>4</mn><mo>×</mo><mn>2</mn></mrow></msup></mrow>",
    ),
    derive: [
      "视觉V为4×3，投影W为3×2，结果4×2。",
      "文本T为2×2，沿序列拼接后6×2。",
      "交叉读取时若Q来自文本、KV来自视觉，配对域为2×4；Mask和实际头维另行处理。",
    ],
    code: "V=[[1,0,1],[0,1,1],[1,1,0],[2,0,1]]\nW=[[1,0],[0,1],[1,1]]\nprojected=[[sum(row[k]*W[k][j] for k in range(3)) for j in range(2)] for row in V]",
    quiz: [
      "4×3视觉矩阵与2×2文本矩阵能否直接按行拼接？",
      [
        "能，只要都是Token",
        "不能，隐藏宽度不一致，需先处理接口",
        "把Token数相乘就可以",
      ],
      1,
      "沿序列轴合并要求另一轴一致；不同模型也可能采用Cross-Attention等其它接口。",
    ],
    limit:
      "两类接口比较，不宣称所有VLM或VLA相同；实际特殊Token、位置编码与Mask必须按模型核对。",
  }),
  define({
    id: "state-families",
    module: "model",
    unit: "attention-family",
    title: "线性注意力、Delta Rule 与 SSM 的边界",
    goal: "由状态更新式区分累加关联、纠错写入和状态空间递推，避免用一个公式概括全部模型。",
    why: "它们都可能固定大小递推，但状态的意义、门控与并行化方式并不相同。",
    prereqs: [
      [
        "linear-state",
        "先从一个明确的Gated Delta实例理解状态，再比较不同更新语义。",
      ],
    ],
    source: "mamba",
    section: "Mamba的选择性状态空间模型；Delta分支另参见Gated DeltaNet原论文。",
    terms:
      "state|递推保存的内部变量，不必等于历史KV;SSM|状态空间模型;Delta Rule|按目标与旧预测的差修正关联;selectivity|更新参数随输入变化的机制",
    chapters: [
      page(
        "updates",
        "相同输入，不同状态语义",
        "关联累加与残差纠错在重复Key时为何不同？",
        "沿相同Key写目标2再写4：累加得到6；β=1的Delta纠错第二次先减旧预测2，再加残差2，得到4。固定大小状态不是共同的精确公式。",
        { code: true },
      ),
      page(
        "ssm",
        "状态空间递推另在表达什么",
        "h′=ah+bx与Key-Value外积更新能直接互换吗？",
        "标量线性状态例子用a控制记忆保留、b引入输入，输出还可通过c读取。选择性模型让部分参数依输入变化；不能把此标量例子当完整Mamba。",
        { formula: true },
      ),
      page(
        "compare",
        "实现要按哪一种依赖组织",
        "都能递推，是否可以共用未经修改的Chunk Kernel？",
        "先核对状态轴、更新结构、门和数值算法，再讨论Scan或Chunk。相似接口不证明数学、布局和Kernel可以直接替换。",
        { quiz: true },
      ),
    ],
    formula: math(
      "<mrow><msub><mi>h</mi><mi>t</mi></msub><mo>=</mo><msub><mi>a</mi><mi>t</mi></msub><msub><mi>h</mi><mrow><mi>t</mi><mo>−</mo><mn>1</mn></mrow></msub><mo>+</mo><msub><mi>b</mi><mi>t</mi></msub><msub><mi>x</mi><mi>t</mi></msub></mrow>",
    ),
    derive: [
      "固定关联Key，目标2、4：累加2+4=6。",
      "Delta β=1：旧预测2，残差4−2=2，更新到4。",
      "SSM例a=0.5、b=1、x=[2,4]、h0=0：h1=2，h2=5；不同机制不能混算。",
    ],
    code: "h=0\nfor x in [2,4]: h=.5*h+x\nassert h==5\ns=0\nfor target in [2,4]: s += target-s\nassert s==4",
    quiz: [
      "看到固定形状State，能否认定采用Delta Rule？",
      ["能", "不能，需检查更新式及状态含义", "只看State元素数是否一样"],
      1,
      "固定内存增长性质只是一个特征；不同算法的状态语义与计算结构不同。",
    ],
    limit:
      "三种更新的极小对照；完整核化注意力的归一状态、Mamba离散化/卷积/门与不同Delta变体需按具体模型展开。",
  }),
];
