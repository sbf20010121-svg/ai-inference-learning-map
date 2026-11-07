/**
 * V2.0: concept-to-mechanism explanations for the focused reader.
 * Each published topic teaches a real state/data transformation, a rendered MathML
 * invariant, a worked numeric case and explicit applicability limits.
 * All visual and numerical examples are pedagogical, not hardware measurements.
 */
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mi=s=>`<mi>${E(s)}</mi>`, mn=n=>`<mn>${n}</mn>`, mo=s=>`<mo>${E(s)}</mo>`, txt=s=>`<mtext>${E(s)}</mtext>`;
const sub=(a,b)=>`<msub>${mi(a)}${mi(b)}</msub>`;
const sup=(a,b)=>`<msup>${mi(a)}${mi(b)}</msup>`;
const expRescale=`<msup>${mi('e')}<mrow>${sub('m','old')}${mo('−')}${sub('m','new')}</mrow></msup>`;
const frac=(a,b)=>`<mfrac>${a}${b}</mfrac>`;
const math=(body,label)=>`<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${E(label)}"><mrow>${body}</mrow></math>`;
const prod=(...vals)=>vals.join(mo('×'));
const cells=(xs,cls='')=>`<div class="theory-cells ${cls}">${xs.map(v=>`<span class="${E(v.k||'')}" title="${E(v.title||v.t||v)}">${E(v.t||v)}</span>`).join('')}</div>`;
const block=(title,body,cls='')=>`<div class="theory-block ${cls}"><strong>${E(title)}</strong>${body}</div>`;
const note=s=>`<p class="theory-figure-note">${E(s)}</p>`;
const labelRow=(label,arr)=>`<div class="theory-labeled-row"><b>${E(label)}</b>${cells(arr)}</div>`;

function diagPD(){return `<figure class="theory-figure" aria-label="Prefill 和 Decode 的不同实例与历史 KV 交接"><div class="theory-lanes"><div class="theory-lane"><div class="theory-lane-title">P：Prefill 实例</div>${block('输入 4 个 Token',cells(['t₀','t₁','t₂','t₃'].map(t=>({t,k:'t-a'}))))}${block('执行全部模型层','<p>为历史位置计算 K 与 V</p>', 'theory-processing')}${block('生成历史 KV',cells(['K₀/V₀','K₁/V₁','K₂/V₂','K₃/V₃'].map(t=>({t,k:'t-a'}))))}</div><div class="theory-transfer"><span>交接历史 KV 数据</span><b>→</b><small>还要协调块映射、就绪状态</small></div><div class="theory-lane"><div class="theory-lane-title">D：Decode 实例</div>${block('接收历史 KV',cells(['K₀/V₀','K₁/V₁','K₂/V₂','K₃/V₃'].map(t=>({t,k:'t-b'}))))}${block('新的 Query + 历史 KV','<p>逐步运行模型并追加本轮 K/V</p>', 'theory-processing')}${block('输出下一个 Token',cells([{t:'t₄',k:'t-b'}]))}</div></div>${note('这是“先 Prefill 再交接”的简化情形。P/D 两端分别承担推理阶段，不表示把 Transformer 的前后层拆开。')}</figure>`;}
function schedulerDiagram(){const cell=(x,k)=>({t:x,k});const first=[cell('A','t-a'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b')];const second=[cell('A','t-a'),cell('B','t-b'),cell('B','t-b'),cell('B','t-b'),cell('C','t-c'),cell('C','t-c'),cell('C','t-c'),cell('C','t-c')];return `<figure class="theory-figure" aria-label="两轮 Token Budget 分配示例"><div class="theory-schedule"><div><strong>轮次 1 · 8 个计算 Token 槽</strong>${cells(first,'budget')}${note('A：Decode 1；B：长输入 Prefill 7；C：还在等待')}</div><div><strong>轮次 2 · 8 个计算 Token 槽</strong>${cells(second,'budget')}${note('A：Decode 1；B：剩余 Prefill 3；C：新 Prefill 4')}</div></div><div class="theory-legend"><span><i class="t-a"></i>A 已在生成</span><span><i class="t-b"></i>B 长输入</span><span><i class="t-c"></i>C 新输入</span></div>${note('教学设定：无缓存不足、抢占、特殊优先级或其他预算约束；这是 Token 分配示例，不代表任何版本的全部调度细节。')}</figure>`;}
function diagKV(){return `<figure class="theory-figure" aria-label="两条请求的逻辑 KV 块共享同一个物理块"><div class="theory-kv-grid"><div><strong>请求 A 的逻辑块</strong>${cells([{t:'A[0]',k:'t-a'},{t:'A[1]',k:'t-b'}])}<small>Block Table：A[0]→P3，A[1]→P7</small></div><div><strong>请求 B 的逻辑块</strong>${cells([{t:'B[0]',k:'t-a'},{t:'B[1]',k:'t-c'}])}<small>共享前缀：B[0]→P3，B[1]→P8</small></div><div class="theory-wide"><strong>GPU 物理 KV 块</strong>${cells([{t:'P3 · 引用 2',k:'t-a'},{t:'P7 · 引用 1',k:'t-b'},{t:'P8 · 引用 1',k:'t-c'}])}</div></div>${note('两条请求引用同一前缀的 P3；释放 A 时，P3 因 B 仍引用而不能释放。此图表示 KV 块，不是把文本 Token 字符直接存入显存。')}</figure>`;}
function diagPrefillDecode(){
 const rows=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>`<span class="${j<=i?'can-see':'masked'}" title="Query 位置 ${i}，Key 位置 ${j}">${j<=i?'●':'×'}</span>`).join('')).join('');
 return `<figure class="theory-figure" aria-label="Prefill 的 4 乘 4 因果注意力矩阵与 Decode 的 1 乘 5 注意力行对比"><div class="theory-attn-shapes"><div><strong>Prefill · 4 个输入 Token</strong><div class="theory-attn-grid">${rows}</div><small>Q：4 行，K：4 行 → 分数矩阵 4×4；因果 Mask 后 10 个可见位置对</small></div><div><strong>Decode · 生成第 5 个 Token</strong><div class="theory-attn-grid decode">${Array.from({length:5},(_,i)=>`<span class="can-see">K${i}</span>`).join('')}</div><small>Q：1 行，K：5 行 → 本轮分数 1×5；历史 K/V 可从缓存读取</small></div></div>${note('用单 Head、无 Batch 的简化形状来理解 Prefill/Decode；真实模型还有头维、矩阵指令、MLP 和调度。不是说 Prefill 的时间一定等于 Decode 的 16/5 倍。')}</figure>`;
}
function diagCompiler(){const data=[['x（输入）','−2','−1','1','2'],['u=2x','−4','−2','2','4'],['v=u+1','−3','−1','3','5'],['y=ReLU(v)','0','0','3','5']];return `<figure class="theory-figure" aria-label="融合前后中间张量的数值和全局读写对比"><table class="theory-table"><caption>同一计算的真实中间数值</caption><tbody>${data.map((r,i)=>`<tr><th>${E(r[0])}</th>${r.slice(1).map(x=>`<td class="${i===3?'result':''}">${E(x)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="theory-compare"><div><strong>3 个独立 Kernel</strong><span>读 x → 写 u → 读 u → 写 v → 读 v → 写 y</span><b>约 6N 次元素读写</b></div><div class="theory-good"><strong>1 个融合 Kernel（假定可融合）</strong><span>读 x → 在寄存器计算 u/v → 写 y</span><b>约 2N 次元素读写</b></div></div>${note('N 是张量元素数量；仅比较全量逐元素读写，不计 Cache 命中、代码生成、寄存器溢出和 Kernel 启动。6N→2N 不代表总耗时提升 3 倍。')}</figure>`;}
function diagSoftmax(){return `<figure class="theory-figure" aria-label="两个 K/V Tile 在线更新归一化统计量"><div class="theory-softmax"><div><strong>Tile 1</strong>${cells([{t:'score 1',k:'t-a'},{t:'score 2',k:'t-a'}])}<span>V = [1, 2]</span><p>m₁=2，l₁≈1.368，a₁≈2.368</p></div><div><strong>Tile 2</strong>${cells([{t:'score 3',k:'t-b'},{t:'score 0',k:'t-b'}])}<span>V = [3, 4]</span><p>m₂=3，旧统计量乘 e⁻¹</p></div></div><div class="theory-result-row"><span>最后 l≈1.553</span><span>a≈4.070</span><strong>O = a/l ≈ 2.621</strong></div>${note('这里只对 1 个 Query 行、标量 V 演示在线 Softmax；真实 FlashAttention 还需对 Q/K/V 分块、线程布局与片上缓存进行实现。')}</figure>`;}
function diagWarp(){const rows=[['周期','c0','c1','c2','c3','c4','c5'],['发射','W0: Load','W1: ALU','W2: ALU','W0: ADD','W1: ALU','空泡'],['W0 状态','发 Load','等待数据','等待数据','可发射','其他工作','无就绪指令']];return `<figure class="theory-figure theory-scroll" aria-label="Warp 依赖等待和其他 Warp 交错发射的周期表"><table class="theory-table theory-timeline"><tbody>${rows.map((r,i)=>`<tr><th>${E(r[0])}</th>${r.slice(1).map((x,j)=>`<td class="${i===1&&j===5?'stalled':i===1?'issued':''}">${E(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>${note('c0～c5 是人为设定的单发射槽教学周期，不是 B200 的真实时序。Active 不等于 Eligible；有其他就绪 Warp 才能填补等待空档。')}</figure>`;}
function diagMoE(){const map=[['T0','E0','E1'],['T1','E1','E2'],['T2','E0','E2'],['T3','E1','E2']];return `<figure class="theory-figure" aria-label="四个 Token 的 Top2 路由及三个专家输入分组"><table class="theory-table"><thead><tr><th>输入 Token</th><th>专家 1</th><th>专家 2</th></tr></thead><tbody>${map.map((r)=>`<tr>${r.map((x,i)=>`<td class="${i===0?'':'expert'}">${E(x)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="theory-compare"><div><strong>E0 收到</strong><span>T0、T2</span></div><div><strong>E1 收到</strong><span>T0、T1、T3</span></div><div><strong>E2 收到</strong><span>T1、T2、T3</span></div></div>${note('Expert 按 Token 分组执行网络，输出再按路由权重组合到各自原 Token 位置。示例忽略容量限制、All-to-All 和具体权重。')}</figure>`;}
function diagVLA(){const pts=Array.from({length:5},(_,i)=>({x:0.1+0.2*i,y:0.2+0.15*i})),coord=p=>`${58+p.x*315},${262-p.y*212}`;return `<figure class="theory-figure" aria-label="动作向量经过 4 次 Euler 更新的轨迹图"><svg class="theory-vector" viewBox="0 0 420 330" role="img" aria-label="水平轴是第一个动作维度，垂直轴是第二个动作维度，依次为 a0 到 a4"><path d="M58 34 V262 H390" fill="none" stroke="currentColor" opacity="0.5" stroke-width="2"/><text x="365" y="290" fill="currentColor" font-size="13">a[0] 维</text><text x="12" y="22" fill="currentColor" font-size="13">a[1] 维</text><polyline points="${pts.map(coord).join(' ')}" fill="none" stroke="#2e91af" stroke-width="3" stroke-dasharray="6 4"/>${pts.map((p,i)=>`<circle cx="${58+p.x*315}" cy="${262-p.y*212}" r="${i===4?9:6}" fill="${i===4?'#cf8535':'#2e91af'}"/><text x="${65+p.x*315}" y="${245-p.y*212}" fill="currentColor" font-size="13">a${i}</text>`).join('')}</svg><div class="theory-result-row"><span>a₀=(0.1,0.2)</span><span>每步 Δa=(0.2,0.15)</span><strong>a₄=(0.9,0.8)</strong></div>${note('这是动作表示在推理内部迭代的数值轨迹，不是机械臂真实的运动轨迹；速度场这里人为取常数。')}</figure>`;}
function diagWorld(){return `<figure class="theory-figure" aria-label="两帧各4个空间 Patch 展开为8个时空 Token"><div class="theory-frames">${[0,1].map(f=>`<div><strong>第 ${f+1} 帧 · 2×2 Patch</strong><div class="theory-patches">${Array.from({length:4},(_,p)=>`<span class="${f===0?'t-a':'t-b'}">T${4*f+p}</span>`).join('')}</div></div>`).join('')}</div><div class="theory-result-row"><span>F=2 帧</span><span>P=4 Patch/帧</span><strong>N=8 Token</strong><strong>位置对 N²=64</strong></div>${note('如果把所有帧的 Patch 扁平化并采用稠密全局 Attention，会有 8×8 个 Q-K 位置对；窗口/稀疏注意力或潜空间压缩不满足这个直接计数。')}</figure>`;}
function diagGEMM(){const m=[['c₀₀','c₀₁','c₀₂','c₀₃'],['c₁₀','c₁₁','c₁₂','c₁₃'],['c₂₀','c₂₁','c₂₂','c₂₃'],['c₃₀','c₃₁','c₃₂','c₃₃']];return `<figure class="theory-figure" aria-label="4乘4输出矩阵以2乘2 Tile 切分"><div class="theory-gemm-grid">${m.flatMap((row,i)=>row.map((x,j)=>`<span class="${i<2&&j<2?'selected':''}">${E(x)}</span>`)).join('')}</div><div class="theory-result-row"><span>输出 C：4×4</span><span>Tile：2×2</span><strong>2×2=4 个输出 Tile</strong></div>${note('高亮的 2×2 Tile 需要沿整个 K 维累加 A、B 的对应片段。分块改变复用和访存，不改变 C=A×B 的数学结果。')}</figure>`;}
const visual={"pd-disagg":diagPD,"vllm-scheduler":schedulerDiagram,"kv-cache":diagKV,"llm-block":diagPrefillDecode,"compiler-lowering":diagCompiler,"attention-tiling":diagSoftmax,"warp-issue":diagWarp,"moe-route":diagMoE,"vla-policy":diagVLA,"world-model":diagWorld,"gemm-tiling":diagGEMM};

const lessons={
 'pd-disagg':{
  premise:'Decode 不能凭空接续一个 Prompt：它必须读取该请求历史位置对应的 Key/Value（KV）状态。',
  why:'P 端处理上下文并写出每层的历史 KV；D 端仍运行模型，但使用已准备好的 KV 来继续生成。拆开计算资源可能减少相互干扰，不过 KV 必须可用，传输、排队和块映射都会产生成本。',
  formula:math(`${sub('T','transfer')}${mo('≥')}${frac(sub('M','KV'),sub('B','effective'))}`,'传输时间下界等于 KV 字节数除以有效传输带宽'),
  copy:'T_transfer ≥ M_KV / B_effective',
  vars:[['T_transfer','理想纯传输时间下界','s 或 ms'],['M_KV','需要跨实例搬运的 KV 数据量','Byte'],['B_effective','实际有效传输带宽','Byte/s']],
  worked:['例如某请求历史 KV 约 96 MiB；若有效传输带宽为 12 GiB/s，理想纯搬运约 7.8 ms。','这 7.8 ms 不包含调度、内存注册、同步和队列等待；有异步重叠时也不能直接与 TTFT 相加。','所以 PD 分离有没有收益，必须比较同样 GPU 预算下的 TTFT、ITL/P99 和 Goodput。'],
  limit:'只推导 KV 搬运的带宽下界，非完整生产部署时延模型。',
  source:'https://docs.vllm.ai/en/stable/features/disagg_prefill/'
 },
 'vllm-scheduler':{
  premise:'Scheduler 本轮最重要的输出不是一个请求名单，而是“每条请求本轮要处理多少 Token”。',
  why:'当计算预算只有 8 个 Token 时，正在 Decode 的请求和还没处理完输入的请求必须共享预算。长 Prefill 可以分轮继续，下一轮再从已计算的位置往后处理。',
  formula:math(`${msum()}${mo('≤')}${mi('B')}`,'本轮所有请求分配的 Token 数之和不超过预算 B'),
  copy:'Σ_r n_r ≤ B',
  vars:[['nᵣ','请求 r 本轮被安排处理的 Token 数','Token'],['B','本轮计算 Token Budget','Token'],['r','参与本轮调度的一条请求编号','请求']],
  worked:['设本轮预算 B=8。第 1 轮 A 的 Decode 得 1，B 的长 Prefill 得 7，C 得 0。','下一轮 A 再得 1，B 还剩 3 个输入 Token，C 可获得剩余 4 个预算。','真正的 vLLM 还要考虑 KV 块、请求状态、优先级、推测解码等；这不是完整调度器模拟。'],
  limit:'固定优先顺序的预算教学模型；不同版本的调度实现和约束应以源码为准。',
  source:'https://docs.vllm.ai/en/latest/api/vllm/v1/core/sched/interface/'
 },
 'kv-cache':{
  premise:'Paged KV 的逻辑连续和物理连续是两回事；Block Table 才是请求逻辑位置到显存块的映射。',
  why:'请求 A 和 B 的前缀相同时，可以在符合缓存匹配条件下引用同一批物理 KV 块。后续写入不同的部分再分配各自的块，释放也必须考虑引用情况。',
  formula:math(`${sub('N','blocks')}${mo('=')}${mo('⌈')}${frac(mi('S'),sub('B','block'))}${mo('⌉')}`,'逻辑 KV 块数量等于序列长度除以每块 Token 数后向上取整'),
  copy:'N_blocks = ceil(S / B_block)',
  vars:[['S','需要放入缓存的 Token 位置数','Token'],['B_block','一个逻辑块容纳的 Token 位置数','Token/块'],['N_blocks','所需逻辑块数','块']],
  worked:['假设每块容纳 4 个 Token，序列长 9，则逻辑上需要 ⌈9/4⌉=3 块。','A、B 的前 4 个 Token 相同并命中同一物理 KV 块 P3，则 A[0] 和 B[0] 都映射到 P3。','A 释放时，P3 仍被 B 引用，不能因 A 退出就释放；真正的前缀缓存还可能涉及哈希和可复用块的生命周期。'],
  limit:'图里画的是逻辑块和物理 KV 块，不是 GPU L1/L2 Cache，也不保证每个前缀都可以共享。',
  source:'https://docs.vllm.ai/en/stable/design/paged_attention/'
 },
 'llm-block':{
  premise:'Prefill 和 Decode 都在执行 Transformer，但它们每轮产生的 Query 数量不同，所以 Attention 的矩阵形状不同。',
  why:'设 Prompt 有 S 个 Token。Prefill 一轮对多行 Query 计算上下文注意力；Decode 每次为新位置构造 1 行 Query，读取历史缓存中的 K/V 并算下一 Token。由此产生的 GEMM/Attention Shape、数据复用和瓶颈都可能不同。',
  formula:math(`${mi('O')}${mo('=')}${txt('softmax')}${mo('(')}${frac(`${mi('Q')}${msup('K','T')}`,`<msqrt>${mi('d')}</msqrt>`)}${mo(')')}${mi('V')}`,'Attention 输出等于 Q 乘 K 转置除以每头维度平方根后 Softmax 再乘 V'),
  copy:'Attention(Q,K,V)=softmax(QKᵀ/√d) V',
  vars:[['Q','Query：当前要读取上下文的查询向量（可能多行）','矩阵'],['K、V','Key/Value：提供匹配信息与被加权的数据','矩阵'],['d','每个 Head 内 Q/K 的维度','元素/Head'],['S','输入 Prompt 的 Token 数量','Token']],
  worked:['设 Prompt 有 S=4 个 Token。Prefill 的 Q、K 各有 4 行，所以分数矩阵 QKᵀ 的形状是 4×4；因果 Mask 后只有下三角 10 个可见位置对。','下一次 Decode 生成第 5 个位置时，Q 只有 1 行，K/V 共包含 5 个位置，因此该轮 Attention 的分数形状是 1×5。','这只是单 Head Attention 的形状比较。每一轮仍需做投影、MLP 等操作，实际推理瓶颈还与 Batch、GQA/MLA、权重搬运和 GPU 执行有关。'],
  limit:'位置对数量不是整个模型 FLOPs 或延迟；本图忽略多头、批次、量化与不同 Attention 后端。',
  source:'https://arxiv.org/abs/1706.03762'
 },
 'compiler-lowering':{
  premise:'“编译器把三个操作融合起来”不是少算两步，而是让中间结果不用在不同 Kernel 之间反复写回、再读出。',
  why:'对逐元素计算 y=ReLU(2x+1)，独立实现可能有 3 次 Kernel 启动和中间张量 u、v 的全局读写；融合后仍做乘、加、ReLU，但临时值可以保存在寄存器中。',
  formula:math(`${msub('y','i')}${mo('=')}${txt('max')}${mo('(')}${mn(0)}${mo(',')}${mn(2)}${msub('x','i')}${mo('+')}${mn(1)}${mo(')')}`,'y下标i等于0与2乘x下标i加1中的较大值'),
  copy:'y_i = max(0, 2 x_i + 1)',
  vars:[['xᵢ','输入张量第 i 个元素','与 x 相同'],['u、v','中间计算结果（未融合时可能被物化）','与 x 相同'],['N','张量总元素数量','元素']],
  worked:['输入 x=[−2,−1,1,2]，乘法得 u=[−4,−2,2,4]，加法得 v=[−3,−1,3,5]。','执行 ReLU 后 y=[0,0,3,5]；不管融合与否数学结果相同（浮点误差另计）。','理想全量中间读写按元素计：独立 3 Kernel 为 6N 次，融合后为 2N 次；这是流量模型，不是实际加速比。'],
  limit:'PyTorch 可能直接调用库内核或 eager 路径；LLVM/MLIR/Triton 所在编译层次各不相同，不能认为所有调用都经过同一路径。',
  source:'https://pytorch.org/blog/triton-kernel-compilation-stages/'
 },
 'attention-tiling':{
  premise:'Online Softmax 的关键不是把整段 Softmax“分两次算完”，而是跨 Tile 合并时把旧统计量重缩放到同一最大值基准。',
  why:'分块处理 K/V 时，当前最大分数 m 会随着读入新的 Tile 改变。旧分母 l、旧加权和 a 必须乘 exp(m_old−m_new)，才能与新 Tile 的贡献直接相加。',
  formula:math(`${msub('m','new')}${mo('=')}${txt('max')}${mo('(')}${msub('m','old')}${mo(',')}${msub('m','tile')}${mo(')')}`,'新的最大分数等于旧最大分数与当前块最大分数中的较大者')+math(`${msub('l','new')}${mo('=')}${msub('l','old')}${expRescale}${mo('+')}${mund('∑','i∈tile')}<msup>${mi('e')}<mrow>${msub('s','i')}${mo('−')}${msub('m','new')}</mrow></msup>`,'新归一化分母等于旧分母乘指数重缩放因子再加上新 Tile 分数的指数和')+math(`${msub('a','new')}${mo('=')}${msub('a','old')}${expRescale}${mo('+')}${mund('∑','i∈tile')}<msup>${mi('e')}<mrow>${msub('s','i')}${mo('−')}${msub('m','new')}</mrow></msup>${msub('V','i')}`,'新加权和等于旧加权和重缩放后加上新 Tile 的指数加权 Value 和'),
  copy:'m_new = max(m_old,m_tile); l_new = l_old e^(m_old - m_new) + Σ_i e^(score_i - m_new)',
  vars:[['m','已处理 Key 分数的最大值','无量纲 Logit'],['l','以当前最大值为基准的指数之和','无量纲'],['a','按同一基准累计的加权 Value 和','Value 向量量纲'],['O=a/l','归一化后的输出','Value 向量量纲'],['sᵢ','第 i 个 Key 与当前 Query 的注意力分数','无量纲'],['Vᵢ','第 i 个 Key 对应的 Value','标量或向量']],
  worked:['第一块 score=[1,2]、V=[1,2]：m₁=2；l₁=e⁻¹+1≈1.368；a₁=e⁻¹×1+1×2≈2.368。','第二块 score=[3,0]、V=[3,4]：m₂=3；旧 l₁、a₁ 都要乘 e^(2−3)=e⁻¹，再加入新块的贡献。','最终 l₂≈1.553，a₂≈4.070，O≈2.621；这与对全部四个 score 直接 Softmax 的结果一致（数值容差内）。'],
  limit:'此处只推导单行、标量 Value 的归一化；完整 FlashAttention 还需要 Q/K/V Tiling、片上缓冲、线程映射和异步同步。',
  source:'https://arxiv.org/abs/2205.14135'
 },
 'warp-issue':{
  premise:'SM 里有很多 Active Warp，并不代表每个周期都有可发射指令；真正决定填满发射槽的是依赖是否满足、执行资源是否可用。',
  why:'W0 发起 Load 之后，依赖其结果的 ADD 不能立刻执行。但 W1、W2 的独立指令可以先发射。只有当所有候选 Warp 都没有就绪指令，才会出现这类发射空泡。',
  formula:math(`${sub('N','issued')}${mo('≤')}${txt('min')}${mo('(')}${sub('N','eligible')}${mo(',')}${sub('N','slots')}${mo(')')}`,'本周期发射条数受可发射指令数量与发射槽数量共同限制'),
  copy:'N_issued ≤ min(N_eligible, N_slots)',
  vars:[['N_issued','本教学周期实际发射的指令数','条'],['N_eligible','依赖/资源满足、进入候选集合的可发射指令数','条'],['N_slots','本教学模型可用的发射槽数','槽/周期']],
  worked:['c0：W0 发出 Load，c1、c2 因依赖未就绪而无法发出自己的 ADD。','c1/c2 时，W1/W2 的独立 ALU 指令仍可被选中；c3 时 W0 的依赖数据才就绪。','如果 c5 所有 Warp 都没有 Eligible 指令，即使它们仍 Active，也出现一个发射空泡。'],
  limit:'这里的周期与槽数完全是假设；不能根据本图推导 B200 的真实 Warp Scheduler、Load 延迟或多发射器拓扑。',
  source:'https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html'
 },
 'moe-route':{
  premise:'MoE 不是所有 Token 都运行所有专家；路由器先选专家，Dispatch 把 Token 按专家重新分组，最后 Combine 恢复每个 Token 的输出。',
  why:'同一 Batch 中，不同 Token 会选择不同 Expert。因而每个 Expert 的输入数量不同，计算可以形成不规则的 Grouped GEMM；跨 GPU 还可能有 All-to-All。',
  formula:math(`${msub('y','t')}${mo('=')}${mund('∑','e∈TopK(t)')}${msub('g','t,e')}${msub('E','e')}${mo('(')}${msub('x','t')}${mo(')')}`,'Token t 的输出是被选中专家的结果按路由权重求和'),
  copy:'y_t = Σ_{e in TopK(t)} g_{t,e} Expert_e(x_t)',
  vars:[['xₜ','输入第 t 个 Token 的隐藏向量','向量'],['TopK(t)','Token t 被选中的专家集合','专家编号'],['gₜ,ₑ','Token t 对专家 e 的路由权重','无量纲'],['Eₑ','第 e 个 Expert 网络','函数']],
  worked:['例如 T0→E0/E1；T1→E1/E2；T2→E0/E2；T3→E1/E2。','重排后 E0 得 2 个 Token，E1、E2 各得 3 个；执行完后按原 Token 索引和权重 Combine。','所以 MoE 的热点不仅是 Expert GEMM，还可能是路由、Gather/Scatter、Padding 和多卡通信。'],
  limit:'不含容量限制、实际路由权重、负载均衡损失和跨设备分片策略。',
  source:'https://arxiv.org/abs/1701.06538'
 },
 'vla-policy':{
  premise:'Flow Matching 的迭代发生在动作生成模型内部，不是机器人执行了那么多次控制动作。',
  why:'模型用视觉、语言、机器人状态构造条件 c。动作专家从初始动作表示 a₀ 出发，重复预测更新方向 vθ，并通过数值积分得到最终动作块。',
  formula:math(`${msub('a','k+1')}${mo('=')}${msub('a','k')}${mo('+')}${mi('Δt')}${msub('v','θ')}${mo('(')}${msub('a','k')}${mo(',')}${msub('t','k')}${mo(',')}${mi('c')}${mo(')')}`,'下一步动作表示等于当前动作表示加上数值步长乘网络预测的更新方向'),
  copy:'a_(k+1) = a_k + Δt × v_θ(a_k,t_k,c)',
  vars:[['aₖ','第 k 次内部迭代的动作表示','动作维度'],['vθ','动作专家预测的更新方向（速度场）','动作维度/模型时间'],['Δt','数值积分步长','模型时间'],['c','视觉、语言与机器人状态条件','特征']],
  worked:['给定 a₀=(0.1,0.2)，并人为设 v=(0.8,0.6)、Δt=0.25。','每次更新 Δa=(0.2,0.15)，四步后得到 a₄=(0.9,0.8)。','这四次网络前向是一次动作生成内部的四步积分；输出的 Action Chunk 之后才由机器人控制系统执行。'],
  limit:'示意采用二维恒定速度；真实 VLA 的预测随 aₖ、时间和 c 变化，且存在其他动作建模方法。',
  source:'https://github.com/Physical-Intelligence/openpi'
 },
 'world-model':{
  premise:'视频世界模型需要同时处理空间和时间信息。若直接把每帧 Patch 全部展开，序列长度会随帧数增长。',
  why:'例如每帧图像拆成 P 个 Patch，输入 F 帧就有 N=F×P 个 Token。若使用稠密全局 Attention，则 Query-Key 位置对数与 N² 成正比；这说明为什么视频时空建模对算力和显存敏感。',
  formula:math(`${mi('N')}${mo('=')}${mi('F')}${mo('×')}${mi('P')}${mo('，')}${sub('N','pairs')}${mo('=')}${msup('N','2')}`,'时空 Token 数为帧数乘每帧 Patch 数，稠密全局注意力位置对数为 N 的平方'),
  copy:'N = F×P, Attention position pairs = N²',
  vars:[['F','输入视频帧数量','帧'],['P','每帧图像切出的 Patch 数','Patch/帧'],['N','展开后的时空 Token 总数','Token'],['N_pairs','稠密全局注意力需要比较的 Q-K 位置对数','对']],
  worked:['2 帧，每帧 2×2=4 个 Patch，得到 N=2×4=8 个时空 Token。','如果做稠密全局 Attention，位置对数是 8²=64；增加到 3 帧后得到 N=12，位置对数 144。','但许多实际模型使用潜变量压缩、窗口/稀疏 Attention 或不同的预测目标，不能从 N²直接推导真实延迟。'],
  limit:'只适用于“所有 Patch 展开 + 稠密全局 Attention”的假设，不代表所有世界模型。',
  source:'https://arxiv.org/abs/2401.10229'
 },
 'gemm-tiling':{
  premise:'矩阵乘法不一定按整个矩阵一次完成。分块（Tiling）让每个线程块/Program 计算输出 C 的一小块，并沿 K 维累加。',
  why:'同一个输入片段会被多个乘加重复使用。把 A/B 的局部子块暂存在片上，可以减少从较慢存储层次重复读取数据的次数，但增加片上存储、寄存器和同步开销。',
  formula:math(`${msub('C','m,n')}${mo('=')}<munderover>${mo('∑')}<mrow>${mi('k')}${mo('=')}${mn(0)}</mrow><mrow>${mi('K')}${mo('−')}${mn(1)}</mrow></munderover>${msub('A','m,k')}${msub('B','k,n')}`,'输出矩阵 C 的第 m 行第 n 列等于沿 K 维的 A 乘 B 乘积和'),
  copy:'C_(m,n) = Σ_(k=0)^(K−1) A_(m,k) B_(k,n)',
  vars:[['M、N','输出矩阵 C 的行数与列数','元素'],['K','矩阵乘法的归约维度','元素'],['Tile','一个线程块或 Program 负责的输出子区域','元素块']],
  worked:['输出矩阵 C 是 4×4，每个 Tile 是 2×2，因此输出网格共有 2×2=4 个 Tile。','每个输出 Tile 仍需要遍历 K 维；例如 K=4，就要累计 4 轮乘加贡献（如何拆 K Tile 可以不同）。','最佳 Tile 不能只看 Program 数量，还取决于片上复用、Tensor Core 指令形状、Occupancy 和尾块浪费。'],
  limit:'4×4 是教学数字；实际 Triton GEMM 使用更大 Tile、多个 Warp、数据布局/流水线和可变 K 分块。',
  source:'https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html'
 }
};
function msum(){return `<munder>${mo('∑')}${mi('r')}</munder>${msub('n','r')}`;}
function msub(a,b){return `<msub>${mi(a)}${mi(b)}</msub>`;}
function msup(a,b){return `<msup>${mi(a)}${mi(b)}</msup>`;}
function mund(symbol,under){return `<munder>${mo(symbol)}${txt(under)}</munder>`;}
export const derivationIds=Object.keys(lessons);
export function hasDerivation(id){return Object.hasOwn(lessons,id);}
export function getDerivation(id){return lessons[id]||null;}
export function renderUnderstandingDiagram(id){const maker=visual[id];return maker?maker():'';}
export function renderInContext(id){const d=getDerivation(id);if(!d)return '';
 return `<section class="theory-embedded" aria-label="可追踪的机制图解"><div class="theory-eyebrow">机制解释 · 数据和状态，而不是概念箭头</div><h3>这项技术的关键对象是什么？</h3><p class="theory-thesis">${E(d.premise)}</p>${renderUnderstandingDiagram(id)}<p class="theory-cause"><strong>为什么是这种运行方式？</strong>${E(d.why)}</p></section>`;
}
export function renderWorkedDerivation(id){const d=getDerivation(id);if(!d)return '';
 return `<section class="theory-worked" aria-label="数学公式和逐步推导"><header><span class="theory-eyebrow">把机制变成可核对的计算</span><h3>用公式和一组实际数字推导</h3></header><div class="theory-formula"><div class="theory-math">${d.formula}</div><div class="theory-formula-code"><small>可复制的表达式</small><code>${E(d.copy)}</code></div></div><div class="theory-vars"><strong>变量与单位（不用先查资料）</strong><dl>${d.vars.map(([symbol,meaning,unit])=>`<div><dt>${E(symbol)}</dt><dd>${E(meaning)}</dd><small>${E(unit)}</small></div>`).join('')}</dl></div><ol class="theory-derivation-steps">${d.worked.map((s,i)=>`<li><span>${i+1}</span><p>${E(s)}</p></li>`).join('')}</ol><div class="theory-assumption"><strong>这个推导没有证明什么？</strong><p>${E(d.limit)}</p></div><details class="theory-source"><summary>技术原始资料（用于进一步核对）</summary><a href="${E(d.source)}" rel="noopener noreferrer" target="_blank">查看官方文档或原论文</a></details></section>`;
}
