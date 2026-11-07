/**
 * V1.6 核心机制解剖台：教学所需知识直接在页面内呈现。
 * 所有图均为原创教学示意（不是官方逐周期模型或真实硬件测量）。
 * 参考资料：vLLM V1 architecture/disagg docs、PyTorch Dynamo docs、Dao-AILab/FlashAttention、NVIDIA Nsight Compute。
 */

const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STUDIO_IDS = ['pd-disagg','vllm-scheduler','compiler-lowering','attention-tiling','warp-issue'];
export const featuredMechanismIds = Object.freeze(STUDIO_IDS);
const progress=new Map();
const getProgress=id=>{if(!progress.has(id))progress.set(id,{step:0,variant:0,answer:null});return progress.get(id)};

export const featuredMechanisms={
 'pd-disagg':{
  label:'PD 分离',definition:'把同一个模型的 Prefill 和 Decode 放到不同的推理实例运行：P 端完成输入计算并生成历史 KV；D 端等待所需 KV 就绪后继续逐 Token 生成。',
  boundary:'输入：Prompt、生成参数与路由信息。中间产物：各层历史 KV Cache。输出：D 端生成的 Token 流。',
  terms:[['Prefill','一次处理输入上下文，形成后续注意力可用的 K/V'],['Decode','利用已有历史 KV，逐步生成新的 Token'],['KV Connector','协调跨实例 KV 的定位、转运或加载；具体传输方式依后端而异']],
  steps:[
   {title:'确定 P/D 实例',in:'Prompt 与请求参数',out:'P 端请求 + D 端续接计划',do:'Router/控制面协调两端：哪里做 Prefill、哪里接着 Decode。',why:'两种负载可以独立配置 GPU 资源；路由不等于模型执行。',trap:'不是把 Transformer 前半层放 P、后半层放 D。'},
   {title:'P 端执行 Prefill',in:'整段输入 Token + 模型权重',out:'每层历史 K/V + 必要续接元数据',do:'P 端计算输入上下文，注意力层产生对该历史上下文有效的 KV Cache。',why:'D 端必须知道之前的上下文状态，否则无法正确继续自回归生成。',trap:'需要迁移的不是整个模型权重；模型通常在两端各自已加载。'},
   {title:'跨实例交接 KV',in:'P 端 KV 块及其位置/就绪信息',out:'D 端可访问并匹配的历史 KV',do:'Scheduler Connector 协调；Worker Connector 按具体后端传输或加载，并确认所需 KV 就绪。',why:'D 不能只拿一条“Prefill 完成”消息就开始算，必须有正确的历史缓存。',trap:'KV 可能按层、分块、异步搬运；不能假定整份 KV 总是串行复制完成。'},
   {title:'D 端接续 Decode',in:'历史 KV + 当前生成状态',out:'新 Token 和新增 KV',do:'D 端在历史 KV 上运行增量注意力、抽样并不断追加新状态。',why:'把对 ITL 敏感的生成阶段与长 Prefill 的资源竞争部分隔离。',trap:'解码侧并不是不执行 Transformer；它仍运行模型，只是 Token 形状不同。'},
   {title:'比较系统收益',in:'相同总 GPU 预算与请求分布',out:'TTFT / ITL / Goodput / 网络成本',do:'比较混部和分离：量测尾延迟、负载倾斜、KV 传输等待和队列。',why:'是否分离取决于 SLO，而不取决于单个理论传输时间。',trap:'分离后 P/D 比例固定可能浪费资源，吞吐不一定升高。'}
  ],
  variants:['控制/数据总览','混部与分离对照'],
  check:{q:'D 端已经收到“P 端 Prefill 完成”的通知，但还没拿到历史 KV。下一步应该？',options:['直接执行 Decode；权重已经在 D 端','等待所需 KV 匹配且就绪，再开始接续','在 D 端只做 Tokenize 就能恢复所有 KV'],correct:1,why:'生成下一个 Token 的注意力需要先前上下文的历史 K/V；控制面通知不能替代数据本身。'},
  recall:['分离的是两个推理阶段所用的实例，不是按模型层拆分。','控制面负责协调，数据面必须把匹配的历史 KV 交给 D。','是否有收益取决于 ITL/TTFT/SLO 与 KV 传输、排队和资源切分。'],
  sources:[['vLLM PD 分离官方机制','https://docs.vllm.ai/en/stable/features/disagg_prefill/'],['vLLM 架构概述','https://docs.vllm.ai/en/latest/design/arch_overview/']]
 },
 'vllm-scheduler':{
  label:'vLLM V1 调度',definition:'V1 Scheduler 每轮按可用 Token Budget 和 KV 资源选择请求及本轮计算 Token 数；同一个逻辑可以调度 Decode 的少量 Token、长 Prefill 的分块和其他新 Token。',
  boundary:'输入：Running/Waiting 中的请求、已计算/待计算 Token 数、KV 资源。输出：本轮每条请求分配的 Token 数与执行元数据。',
  terms:[['Token Budget','一轮最多安排多少计算 Token，并非一个固定请求数'],['Chunked Prefill','一个长 Prompt 可以跨多个调度轮次计算'],['Model Runner','按照本轮调度结果准备张量并调用模型设备计算']],
  steps:[
   {title:'读取当前请求状态',in:'Running A / Waiting B,C',out:'可调度请求集',do:'每条请求维护已计算 Token 数和需要推进的目标，不能只看队列里有几条请求。',why:'A 可能只缺 1 个新 Token，B 可能还有 10 个 Prefill Token 等待。',trap:'V1 不是严格“先完整 Prefill 一批，再统一 Decode 一批”。'},
   {title:'填第一轮预算',in:'Budget=8；A 缺1，B 缺10，C 缺4',out:'A=1，B=7，C=0',do:'在本教学场景里，先给 Running A 的 1 Token，再将余下 7 个给较早等待的 B。',why:'B 的 Prompt 可以分块推进，但 C 这一轮需要继续等待。',trap:'此演示假设 KV 充足和先 Running 后 Waiting；真实调度还要检查更多条件。'},
   {title:'填第二轮预算',in:'A 下一轮又缺1；B 余3，C 余4',out:'A=1，B=3，C=4',do:'同样 8 个 Token：A 继续 Decode，B 完成剩余 Prompt，C 的 4 个 Prompt Token 也能进入。',why:'调度在改变 GPU 实际输入形状，而非仅影响 CPU 等待时间。',trap:'本例忽略 Output Token 停止条件与真实请求到达抖动。'},
   {title:'交给 Model Runner',in:'每轮每请求的 scheduled_tokens 和 KV 映射',out:'本轮输入张量与设备 Kernel',do:'Runner 汇总本轮输入、位置等元信息并触发算子；后续 Token/状态更新进入下一轮。',why:'Scheduler 决定算哪些 Token；Runner/后端决定如何在 GPU 上算。',trap:'一次调度轮次不是单一 GPU Kernel，也不一定对应一个固定形状的 Batch。'}
  ],
  variants:['逐轮 Token 预算','请求状态的变化'],
  check:{q:'同一轮 Budget=8，A 正在 Decode 需 1 Token，B 等待 Prefill 10 Token。教学场景中 B 第一轮可拿多少？',options:['10：Prefill 必须一次完成','7：A 用掉1，剩余7可做 B 的 Chunked Prefill','0：Decode 存在时不能做 Prefill'],correct:1,why:'V1 的 Token Budget 可以混合安排请求的不同 Token 数；本例假定没有 KV 资源不足或特殊优先级。'},
  recall:['调度的单位主要是本轮“要计算的 Token 数”，不只是请求数量。','Chunked Prefill 改变计算如何分轮，不等于 PD 分离。','调度决定 Shape 与执行机会，KV 资源与输出反馈决定下一轮。'],
  sources:[['vLLM V1 架构与 Scheduler','https://docs.vllm.ai/en/latest/design/arch_overview/'],['V1 Scheduler 源码','https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/sched/scheduler.py']]
 },
 'compiler-lowering':{
  label:'PyTorch 编译执行',definition:'编译器在可捕获的计算区域里分析算子图，选择融合、布局和生成设备代码的方式；运行时负责把库 Kernel 或生成的 Kernel 按依赖提交到 GPU。',
  boundary:'输入：例如 y=ReLU(x×scale+bias)；输出：等价的计算结果。中间：FX Graph、优化后的图、Triton/其他后端代码、PTX/设备代码。',
  terms:[['FX Graph','捕获到的张量操作关系图，不等于完整的 Python 源码'],['Lowering','从高层算子逐步降低成更接近硬件的布局/指令'],['Runtime','运行已准备的设备任务并管理 Stream/同步，不是编译器本身']],
  steps:[
   {title:'写出高层计算',in:'x[N]、scale、bias',out:'Mul → Add → ReLU 三个数学操作',do:'在 eager 下，简单 out-of-place 写法可能产生多次 Kernel 调用和两个完整中间 Tensor。',why:'先分清数学语义与具体物理执行。',trap:'一条 PyTorch 表达式不一定对应一个 Kernel。'},
   {title:'捕获可以编译的图',in:'PyTorch 调用与动态 Python 逻辑',out:'可编译区域的 FX 图与 Guard',do:'Dynamo 捕获可支持的张量操作；不支持的控制流可能触发 Graph Break 或不同后端。',why:'编译器要先拿到可分析的算子依赖图，才能跨操作优化。',trap:'不是所有 PyTorch 代码都无条件进入 TorchInductor。'},
   {title:'融合与生成设备代码',in:'FX/Inductor IR、Shape 与 dtype',out:'一个融合 Kernel（可能）/ 或多个库调用',do:'若没有阻止融合的数据依赖和资源约束，可让同一线程加载 x，连续 Mul/Add/ReLU，再写回 y。',why:'少掉两份中间结果的 HBM 写读，以及部分 Kernel Launch。',trap:'Fusion 不是免费：复杂表达式可能提高寄存器压力并降低整体性能。'},
   {title:'从程序到硬件指令',in:'Triton/其他设备程序',out:'PTX/设备机器码与 Launch 参数',do:'具体路径可含 Triton IR、LLVM/NVPTX、PTX 和 ptxas；库 Kernel 则可能预先编译。',why:'数学等价不意味着执行布局、寄存器和指令序列一样。',trap:'PTX 是虚拟 ISA，不等于 B200 实际执行的 SASS 指令。'},
   {title:'执行并验证结果',in:'编译产物 + 输入 Tensor',out:'GPU 写回的 y 和性能计时',do:'CUDA Runtime/Driver 按 Stream/Graph 依赖提交设备工作。用真实 Shape、精度和 Profiler 验证。',why:'编译与运行分别产生不同开销，要区分首次编译和稳态调用。',trap:'融合减少 Kernel 数不保证端到端总耗时一定更低。'}
  ],
  variants:['Eager 与融合对照','编译期和运行期'],
  check:{q:'三次逐元素 Kernel 被融合为一次后，哪项结论最合理？',options:['数学运算必然减少为零','通常可减少中间全量读写与 Launch，但仍需检查寄存器/性能','CUDA Runtime 不再参与 Kernel 启动'],correct:1,why:'融合消除部分中间数据流量与 CPU 提交次数，但并不消除原有数学操作或运行时；收益还受 Shape 和资源使用影响。'},
  recall:['先区分数学算子、计算图、设备代码和运行时。','Fusion 的收益常来自少中间 Tensor 和少 Launch，代价可能是资源压力。','PTX 不等于 SASS；实际执行路径必须对照编译产物和 Trace。'],
  sources:[['PyTorch Dynamo Overview','https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler_dynamo_overview.html'],['Triton 官方教程','https://triton-lang.org/main/getting-started/tutorials/index.html']]
 },
 'attention-tiling':{
  label:'FlashAttention 在线 Softmax',definition:'沿 Key/Value 维度分块处理注意力，在片上维护每行 Softmax 的最大值、归一化和加权累积；避免把完整的注意力分数矩阵存入 HBM。',
  boundary:'输入：Q[S_q,d]、K[S_k,d]、V[S_k,d_v]。输出：O[S_q,d_v]。核心临时状态：逐行 m（最大值）、l（归一化和）、a（未归一化输出累积）。',
  terms:[['Tile','一次处理的一小块 Q/K/V 数据'],['在线 Softmax','边扫描分数边更新稳定的归一化统计量'],['IO-aware','设计时显式考虑 HBM↔片上存储搬运成本']],
  steps:[
   {title:'固定一个 Q Tile',in:'一个 Query，4 个 K/V（教学简化为标量）',out:'待扫描的两个 K/V Tile',do:'将 K/V 拆成两组，每组两个。真实 Kernel 会同时处理多个 Q 行和特征维。',why:'能在片上容纳小分数块，不用生成整张 N×N 中间矩阵。',trap:'这只是单 Query 的数值演示，不是完整 GPU Kernel 的线程布局。'},
   {title:'处理第一个 K/V Tile',in:'Scores=[1,2]，V=[1,2]',out:'m=2，l≈1.368，a≈2.368',do:'以局部最大分数缩放指数：l=exp(-1)+1；a=exp(-1)×1+1×2。',why:'先积累可以稳定合并的归一化统计量，而不提前保存全部概率。',trap:'m/l/a 在这里按一个 Query 行维护；并不是全局唯一三个标量。'},
   {title:'合并第二个 Tile',in:'Scores=[3,0]，V=[3,4]，旧 m/l/a',out:'新 m=3；旧统计重缩放后与新 Tile 合并',do:'最大值从2变成3，要把旧 l、a 乘 exp(2−3)，再加新分数相对于3的指数项。',why:'跨 Tile 的 Softmax 分母必须统一尺度，否则结果不是全序列的 Softmax。',trap:'不能把两个 Tile 分别 Softmax 后的输出直接平均。'},
   {title:'归一化并写输出',in:'处理完全部 K/V 的 m、l、a',out:'O=a/l（与整段 Softmax 对应）',do:'用最终归一化和计算一行输出；只有最终 O 需要写回，不需要落地全部注意力矩阵。',why:'主要优势是减少中间 IO，不是把稠密 Attention 的乘法量从平方降成线性。',trap:'分块计算的浮点求和顺序不同，通常只保证容差内接近，而非逐位完全相同。'}
  ],
  variants:['逐 Tile 在线更新','显式分数矩阵对照'],
  check:{q:'先计算 Tile1 的 Softmax，再计算 Tile2 的 Softmax，把两次输出简单平均，是否等于全局 Attention？',options:['是，Softmax 分别归一化就够了','否，需要合并两个 Tile 的最大值、归一化和及加权累积','是，只要 Q 不变'],correct:1,why:'两段的 Softmax 分母与最大值不同；只有统一尺度地合并 m、l、a，才能得到对全部 Key 的归一化结果。'},
  recall:['仍需计算注意力分数，主要节约的是完整分数矩阵的 HBM IO。','跨 Tile 必须在线更新 m、l、a，统一 Softmax 的数值尺度。','不同输入形状与后端需要实测，别把 FA 等同于某一种固定 CUDA 指令。'],
  sources:[['FlashAttention 官方代码','https://github.com/Dao-AILab/flash-attention'],['Triton Fused Attention 教程','https://triton-lang.org/main/getting-started/tutorials/06-fused-attention.html']]
 },
 'warp-issue':{
  label:'Warp / Scoreboard / 发射',definition:'驻留在 SM 的 Warp 并不总能发射下一条指令：Scoreboard/依赖条件决定它是否 Eligible，调度器从可发射 Warp 中选择指令交给具备相应资源的执行管线。',
  boundary:'输入：若干 Warp 的下一条指令、操作数依赖、执行资源状态。输出：被发射的指令与被占用的 Issue Slot。',
  terms:[['Active Warp','已驻留在 SM 的 Warp，不保证当前能发射'],['Eligible Warp','当前下一条指令依赖与条件满足、具备发射资格的 Warp'],['Issued Warp','调度器本周期选中并发射了指令的 Warp']],
  steps:[
   {title:'三个 Warp 驻留',in:'W0、W1、W2 的指令队列',out:'各自独立的待执行指令',do:'W0 先发 Load，W1/W2 有可运行的 ALU 指令。',why:'独立 Warp 的工作可交错执行，隐藏单个 Warp 的依赖等待。',trap:'Active/Occupancy 高只代表有驻留 Warp，不代表它们都有可发射指令。'},
   {title:'W0 等 Load，其他 Warp 发射',in:'W0 的 Load 结果未就绪',out:'W1/W2 在 c1/c2 获得发射机会',do:'Scoreboard 阻止 W0 的依赖消费者；Scheduler 可以选 W1/W2 的就绪指令。',why:'只要还有其他 Eligible Warp，就不必让 Issue Slot 随 W0 一起等待。',trap:'Not Selected 的 Warp 仍然可能 Eligible，它不是数据依赖阻塞。'},
   {title:'W0 依赖解除',in:'W0 的 Load 结果就绪',out:'W0 在 c4 发射 ADD',do:'Warp 状态从等待依赖变为具备发射资格，再由调度器选择。',why:'独立工作和合适的发射时机可以隐藏部分访问延迟。',trap:'这里的 c0~c7 是人为构造的教学时钟，不是 B200 的真实性能数据。'},
   {title:'所有 Warp 一起等待',in:'c6 三个 Warp 都没有可发射的下一条指令',out:'本教学模型出现 1 个空发射周期',do:'即使三个 Warp 仍 Active，Eligible 可能为 0，从而产生 Issue 空泡。',why:'相比只看 Occupancy，应结合 Eligible/Issued、流水线繁忙度与 Stall 原因分析。',trap:'不能把 Long Scoreboard 的采样比例直接当作可优化耗时比例。'},
   {title:'区分根因与资源上限',in:'c7 W1 的消费者指令重新就绪',out:'Issue 恢复，但性能是否改善仍需测量',do:'判断是依赖导致无 Eligible，还是有 Eligible 但执行端口/管线吞吐已满。',why:'针对延迟受限和吞吐受限要采用不同优化手段。',trap:'增加 Warp 不必然加速：它可能进一步增加寄存器/SMEM 或缓存竞争。'}
  ],
  variants:['逐周期发射示意','依赖与指标关系'],
  check:{q:'Nsight 显示 Active Warp 较多、Eligible Warp 经常接近零，此时第一步更应？',options:['只提高理论 Occupancy，不检查其他指标','定位依赖/同步等待及消费者指令，再设计受控实验','把采样中的 Stall 比例直接当作可减少的总耗时'],correct:1,why:'高 Active 但低 Eligible 说明驻留不等于可发射；要结合 Pipeline、源代码和受控实验定位阻塞链。'},
  recall:['Active、Eligible、Issued 是三个不同概念。','Scoreboard 让依赖未满足的 Warp 等待；其他 Warp 可能填补发射槽。','若没有 Eligible 要看依赖/同步；若有 Eligible 仍发不出去，还要看管线资源。'],
  sources:[['Nsight Compute Compute Triage','https://docs.nvidia.com/nsight-compute/ComputeTriage/'],['Nsight Compute Profiling Guide','https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html']]
 }
};

const box=(label,detail,active=false,kind='normal')=>`<div class="m16-box ${active?'m16-active':''} m16-${kind}"><strong>${esc(label)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</div>`;
const arrow=(label='')=>`<span class="m16-arrow" aria-hidden="true"><span>→</span>${label?`<small>${esc(label)}</small>`:''}</span>`;
const row=(...xs)=>`<div class="m16-flow-row">${xs.join('')}</div>`;
const sub=(title,content,tag='')=>`<div class="m16-sub"><div class="m16-sub-head"><strong>${esc(title)}</strong>${tag?`<span>${esc(tag)}</span>`:''}</div>${content}</div>`;
const lanes=(rows)=>`<div class="m16-lanes">${rows.map(([label,cells])=>`<div class="m16-lane"><div class="m16-lane-label">${esc(label)}</div>${cells.map(([name,detail,highlight])=>box(name,detail,highlight)).join(arrow())}</div>`).join('')}</div>`;

function renderPD(s,variant){
 const nodes=variant===0?[
 ['请求控制', [['客户端','请求',s===0],['Router','选择 P/D',s===0],['P 端调度','执行上下文',s===1],['Connector','通知就绪',s===2],['D 端调度','续接生成',s===3||s===4]]],
 ['数据流', [['Prompt IDs','输入',s===0],['P：权重+算子','产生各层 K/V',s===1],['KV Blocks','元数据+数据',s===2],['传输/加载','依后端实现',s===2],['D：KV+新 Query','新 Token',s>=3]]]
 ]:[
 ['混部 · 共享执行资源',[['GPU 1','长 Prefill',s===1],['同一 GPU','Decode 等待',s===3],['GPU 1','下一批请求',s===4]]],
 ['分离 · 额外转运',[['P GPU','长 Prefill',s===1],['KV Transfer','附加成本',s===2],['D GPU','独立 Decode',s===3],['SLO 对比','综合评估',s===4]]]
 ];
 const kv=sub('真实中间对象：历史 KV 不只是“完成通知”',row(box('P 端 KV','每层 K/V块',s===1,'data'),arrow('映射、传输、就绪'),box('D 端 KV','可供 Attention 读取',s===2||s===3,'data'))+'<div class="m16-chipline"><span>示例：24 层 · 8 KV Head · HeadDim 128 · Prompt 1024 · BF16</span><b>KV 约 96 MiB</b><span>仅理想体积，未算元数据、网络协议和重叠</span></div>','示意计算');
 return lanes(nodes)+kv+`<p class="m16-figure-caption">${variant===0?'上排是控制面，下排是数据面；颜色表示当前讲解的阶段。':'相同模型不意味着相同部署资源预算；比较必须固定 GPU 总数与请求分布。'}</p>`;
}
export function slotCells(round){const items=round===1?[...Array(1).fill('A'),...Array(7).fill('B')]:[...Array(1).fill('A'),...Array(3).fill('B'),...Array(4).fill('C')];return `<div class="m16-slot-wrap">${items.map((x,i)=>`<div class="m16-slot m16-${x.toLowerCase()}" title="槽 ${i+1}：请求 ${x}">${x}<small>${i+1}</small></div>`).join('')}</div>`;}
function renderScheduler(s,variant){
 const currentRound=s>=2?2:1;
 const r1=`<div class="m16-round ${currentRound===1?'m16-emphasis':''}"><strong>第 1 轮</strong>${slotCells(1)}<small>A Decode 1 + B Prefill 7 = 8</small></div>`;
 const r2=`<div class="m16-round ${currentRound===2?'m16-emphasis':''}"><strong>第 2 轮</strong>${slotCells(2)}<small>A Decode 1 + B Prefill 3 + C Prefill 4 = 8</small></div>`;
 const states=`<div class="m16-table-wrap"><table class="m16-table"><thead><tr><th>请求</th><th>原任务</th><th>第1轮后</th><th>第2轮后</th></tr></thead><tbody><tr><td>A / Running</td><td>每轮需 1 个新 Token</td><td>已执行本轮 1</td><td>下一轮再执行 1</td></tr><tr><td>B / Waiting</td><td>Prefill 10 个</td><td>已计算 7 / 10</td><td>10 / 10</td></tr><tr><td>C / Waiting</td><td>Prefill 4 个</td><td>已计算 0 / 4</td><td>4 / 4</td></tr></tbody></table></div>`;
 const top=row(box('Running A','本轮 Decode 缺 1',s===0,'data'),arrow(),box('Scheduler','Token Budget = 8',s===1||s===2,'ctrl'),arrow(),box('Model Runner','安排 GPU 前向',s===3,'device'));
 return top+sub(variant===0?'用 8 个可视 Token 槽理解调度':'已计算 Token 数如何变化',variant===0?`<div class="m16-rounds">${r1}${r2}</div>`:states,'固定教学场景')+
 (variant===0?`<div class="m16-legends"><span class="m16-a">● A：已有 Decode</span><span class="m16-b">● B：长 Prefill</span><span class="m16-c">● C：短 Prefill</span></div>`:'')+
 `<p class="m16-figure-caption">假设 KV 空间足够、无抢占/额外优先级、可使用 Chunked Prefill；真实 V1 仍需按对应版本的 Scheduler 代码核对。</p>`;
}
function renderCompiler(s,variant){
 const eager=lanes([['Eager：3 次逐元素计算',[['Mul','t1=x×scale',s===0],['Add','t2=t1+bias',s===0],['ReLU','y=max(t2,0)',s===4]]],['编译融合（可能）',[['Dynamo','捕获可编译图',s===1],['Inductor','分析并融合',s===2],['设备代码','Triton/库等',s===3],['GPU','一次融合 Kernel',s===4]]]]);
 const compare=sub('同一数学表达式，两种可能的数据流',`<div class="m16-compare"><div class="m16-data-card"><span>未融合 · 示例</span><code>x → [Mul] → t1 写/读 HBM → [Add] → t2 写/读 HBM → [ReLU] → y</code><small>例：3 次 Kernel Launch，2 个临时全量 Tensor（取决于实际 eager 实现）</small></div><div class="m16-data-card m16-highlight"><span>可融合 · 示例</span><code>x → [Load] → mul → add → relu → [Store y]</code><small>可能减少中间数据与 Launch；仍需看寄存器和后端</small></div></div>`);
 const pipe=sub('编译期不是每次运行都重复一次',row(box('第一次 / Guard 变化','图捕获与编译',s===1||s===2),arrow(),box('PTX / 设备代码','准备可运行程序',s===3,'data'),arrow(),box('后续模型运行','Runtime 提交 Kernel',s===4,'device'))+'<p class="m16-small">库 Kernel 可能已预编译；torch.compile 可能发生 Graph Break、重编译，某些算子会保持外部库调用。</p>');
 return eager+(variant===0?compare:pipe);
}
export function flashStats(stage){const e=Math.exp;
 const l1=e(-1)+1, a1=e(-1)*1+2;
 const l2=e(-1)*l1+1+e(-3),a2=e(-1)*a1+3+e(-3)*4;
 const out=a2/l2;
 const numerator=[1,2,3,0].reduce((n,v,i)=>n+e(v)*[1,2,3,4][i],0);
 const denominator=[1,2,3,0].reduce((sum,v)=>sum+e(v),0);
 return {first:{m:2,l:l1,a:a1},second:{m:3,l:l2,a:a2,out},ref:numerator/denominator};
}
function renderFlash(s,variant){
 const a=flashStats(s),d=(s>=2?a.second:a.first),terms=`<div class="m16-stat-row"><div><small>当前最大值 m</small><strong>${s===0?'—':d.m.toFixed(0)}</strong></div><div><small>归一化和 l</small><strong>${s===0?'—':d.l.toFixed(3)}</strong></div><div><small>加权累积 a</small><strong>${s===0?'—':d.a.toFixed(3)}</strong></div><div><small>最终输出 a/l</small><strong>${s===3?a.second.out.toFixed(3):'待计算'}</strong></div></div>`;
 const data=`<div class="m16-tileviz"><div class="m16-tile-head"><span>Q：一个 Query（仅用标量演示）</span><span>K/V：拆成 2 个 Tile</span></div><div class="m16-k-grid">${[1,2,3,0].map((v,i)=>`<div class="m16-k ${s===1&&i<2||s===2&&i>=2?'m16-current':''}"><small>Key ${i+1}</small><b>score ${v}</b><span>V=${i+1}</span></div>`).join('')}</div><div class="m16-pair-row"><span class="m16-pair one">Tile ①：s=[1,2]</span><span class="m16-pair two">Tile ②：s=[3,0]</span></div></div>`;
 const notes=s===0?'首先只读一小块 Q，K/V 按两组进入片上；以下 score 已假设完成 QKᵀ / √d。':s===1?'以 m=2 计算：l=exp(−1)+1；a=exp(−1)×1+1×2。':s===2?'m 从 2 变为 3，旧 l 和 a 必须乘 exp(2−3)，再加第二块的贡献。':'最终 O=a/l。参考一次全局 Softmax 的相同标量结果也约为 '+a.ref.toFixed(3)+'；浮点分块顺序不同可能引入微小误差。';
 const memory=sub('显式中间矩阵与片上分块的区别',row(box('显式 Attention','可能将完整 [S,S] 分数写 HBM',variant===1),arrow('中间结果'),box('FlashAttention','片上 m/l/a + 输出 O',variant===0,'device'))+'<p class="m16-small">不改变稠密 Attention 的两两分数计算量级；主要减少中间数据在 HBM 的落地与读取。</p>');
 return data+sub('在线更新的统计量（每个 Query 行各维护一组）',terms+`<p class="m16-formula-explained">${esc(notes)}</p>`,'教学数值例子')+memory;
}
export const pedagogicalWarpCycles=[
 {c:0,instr:'W0：Load',kind:'w0',why:'W0 发出加载；它的消费者需要等待数据回来。',states:['发射 Load','就绪但未选择','就绪但未选择']},
 {c:1,instr:'W1：ALU',kind:'w1',why:'W0 等 Scoreboard；W1 的 ALU 指令独立、可以发射。',states:['等待 Load','发射 ALU','未选择']},
 {c:2,instr:'W2：ALU',kind:'w2',why:'W0 仍在等，调度器选择 W2 来利用发射槽。',states:['等待 Load','就绪但未选择','发射 ALU']},
 {c:3,instr:'W1：Load',kind:'w1',why:'W1 又发了新的 Load，下一条消费者需要等待。',states:['等待 Load','发射 Load','下一条待就绪']},
 {c:4,instr:'W0：ADD',kind:'w0',why:'W0 的 Load 结果就绪后，其 ADD 能被选中发射。',states:['发射 ADD','等待 Load','下一条待就绪']},
 {c:5,instr:'W2：Load',kind:'w2',why:'W2 新发 Load；假设它此后也需等待。',states:['等待下一条','等待 Load','发射 Load']},
 {c:6,instr:'— 空泡 —',kind:'idle',why:'三个 Warp 的下一条指令此刻都未就绪，因此没有 Eligible Warp，发射槽空着。',states:['等待依赖','等待 Load','等待 Load']},
 {c:7,instr:'W1：ADD',kind:'w1',why:'W1 的依赖解除后重新变为 Eligible，于是恢复发射。',states:['等待依赖','发射 ADD','等待 Load']}
];
function renderWarp(s,variant){
 const focus=[0,1,4,6,7][s]||0;
 const gantt=`<div class="m16-cycle-scroller"><div class="m16-gantt"><div class="m16-gantt-heading">${pedagogicalWarpCycles.map(x=>`<span>周期 ${x.c}</span>`).join('')}</div><div class="m16-gantt-row">${pedagogicalWarpCycles.map(x=>`<div class="m16-cycle ${x.kind} ${x.c===focus?'m16-cycle-current':''}" title="${esc(x.why)}"><b>${x.instr}</b></div>`).join('')}</div></div></div>`;
 const descriptions=sub('第 '+focus+' 周期：'+pedagogicalWarpCycles[focus].instr,`<p class="m16-explain">${esc(pedagogicalWarpCycles[focus].why)}</p><div class="m16-warp-state">${pedagogicalWarpCycles[focus].states.map((v,i)=>`<div><b>Warp ${i}</b><span>${esc(v)}</span></div>`).join('')}</div>`,'单发射槽示意');
 const diff=sub('读懂三个计数器，而不是只看 Occupancy',`<div class="m16-funnel"><div><b>Active</b><span>驻留 Warp</span></div><i>其中依赖就绪</i><div><b>Eligible</b><span>可以发射</span></div><i>其中被选中</i><div><b>Issued</b><span>已经发射</span></div></div><p class="m16-small">Not Selected 是有资格却未被选择，不应直接归为数据依赖 Stall。若 Eligible 多而 Issue 低，要进一步看发射/执行资源是否饱和。</p>`);
 return (variant===0?sub('一个 Issue Slot、三条 Warp 指令流（非真实 B200 周期）',gantt,'点击上方步骤定位周期'):diff)+descriptions;
}
const diagrams={'pd-disagg':renderPD,'vllm-scheduler':renderScheduler,'compiler-lowering':renderCompiler,'attention-tiling':renderFlash,'warp-issue':renderWarp};
export function validateMechanismStudio(){
 for(const id of STUDIO_IDS){const d=featuredMechanisms[id];if(!d||!d.definition||!d.boundary||d.steps.length<4)throw Error(`机制场景缺失 ${id}`);if(d.variants.length!==2||d.recall.length!==3||d.sources.length<1||!diagrams[id])throw Error(`机制内容不完整 ${id}`);for(const st of d.steps)for(const k of ['title','in','out','do','why','trap'])if(!st[k])throw Error(`${id}: ${k} missing`);}
 return true;
}
const stepsHTML=(d,s)=>`<div class="m16-steps" role="group" aria-label="分步学习机制">${d.steps.map((x,i)=>`<button type="button" data-m16-step="${i}" class="m16-step ${s.step===i?'m16-selected':''}" aria-pressed="${s.step===i}"><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(x.title)}</strong></button>`).join('')}</div>`;
const details=(step)=>`<div class="m16-detail"><div><span>当前环节的输入</span><p>${esc(step.in)}</p></div><div><span>如何执行 → 输出什么</span><p><b>${esc(step.do)}</b> 最终交给下一环节：${esc(step.out)}</p></div><div><span>为什么要这样做</span><p>${esc(step.why)}</p></div><div class="m16-caution"><span>容易误解</span><p>${esc(step.trap)}</p></div></div>`;
export function mechanismStudioHTML(topic){const d=featuredMechanisms[topic.id];if(!d)return '';const st=getProgress(topic.id),x=d.steps[st.step];return `<section class="m16-studio" data-m16-id="${esc(topic.id)}" aria-label="${esc(d.label)}的机制可视化讲解"><header class="m16-header"><span>V1.6 · 机制先行 / 图解精读</span><h3>先弄懂它<span>怎样运作</span>，再谈为什么优化</h3><p class="m16-definition">${esc(d.definition)}</p><div class="m16-boundary"><b>从哪里开始，到哪里结束？</b><p>${esc(d.boundary)}</p></div></header><div class="m16-glossary">${d.terms.map(([word,plain])=>`<div><strong>${esc(word)}</strong><span>${esc(plain)}</span></div>`).join('')}</div><div class="m16-section-heading"><span>01 / 机制演示</span><strong>点击每一步：看数据怎样变、谁控制、谁执行</strong></div>${stepsHTML(d,st)}<div class="m16-display"><div class="m16-view-switch" role="group" aria-label="切换机制视角">${d.variants.map((v,i)=>`<button type="button" class="${st.variant===i?'m16-current':''}" data-m16-variant="${i}" aria-pressed="${st.variant===i}">${esc(v)}</button>`).join('')}</div><div class="m16-diagram" aria-live="polite">${diagrams[topic.id](st.step,st.variant)}</div></div>${details(x)}<div class="m16-section-heading"><span>02 / 理解检查</span><strong>判断一个真实机制问题（不是背缩写）</strong></div><div class="m16-check"><h4>${esc(d.check.q)}</h4><div class="m16-options">${d.check.options.map((label,i)=>`<button type="button" data-m16-answer="${i}" class="${st.answer===i?'m16-answer-picked':''}">${String.fromCharCode(65+i)}. ${esc(label)}</button>`).join('')}</div>${st.answer!==null?`<p class="m16-feedback ${st.answer===d.check.correct?'m16-right':'m16-wrong'}"><b>${st.answer===d.check.correct?'判断正确':'还可以再推敲'}</b> ${esc(d.check.why)}</p>`:''}</div><div class="m16-section-heading"><span>03 / 离开前复述</span><strong>这页只记住三件事</strong></div><ol class="m16-remember">${d.recall.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><details class="m16-sources"><summary>核对官方机制与源码资料（可选）</summary><div>${d.sources.map(([name,url])=>`<a href="${esc(url)}" rel="noopener noreferrer" target="_blank">${esc(name)} ↗</a>`).join('')}</div></details><p class="m16-footnote">图形、数字与逐周期轨迹用于理解机制；未模拟实际 vLLM 全部调度条件、FlashAttention GPU Kernel 布局或 Blackwell 真实周期。具体版本与性能请参考官方资料并进行实测。</p></section>`;}
export function handleMechanismStudioClick(target,root,topic){const el=target?.closest?.('[data-m16-step],[data-m16-variant],[data-m16-answer]');if(!el||!root.contains(el)||!featuredMechanisms[topic.id])return false;
 const st=getProgress(topic.id),d=featuredMechanisms[topic.id];
 if(el.hasAttribute('data-m16-step')){const v=Number(el.dataset.m16Step);if(!Number.isInteger(v)||v<0||v>=d.steps.length)return false;st.step=v;}
 if(el.hasAttribute('data-m16-variant')){const v=Number(el.dataset.m16Variant);if(!Number.isInteger(v)||v<0||v>=2)return false;st.variant=v;}
 if(el.hasAttribute('data-m16-answer')){const v=Number(el.dataset.m16Answer);if(!Number.isInteger(v)||v<0||v>=d.check.options.length)return false;st.answer=v;}
 const section=root.querySelector(`.m16-studio[data-m16-id="${topic.id}"]`);if(!section)return false;
 const oldScroll=window.scrollY,focus=el.hasAttribute('data-m16-step')?`[data-m16-step="${st.step}"]`:el.hasAttribute('data-m16-variant')?`[data-m16-variant="${st.variant}"]`:`[data-m16-answer="${st.answer}"]`;
 section.outerHTML=mechanismStudioHTML(topic);
 const next=root.querySelector(`.m16-studio[data-m16-id="${topic.id}"] ${focus}`);if(next)next.focus({preventScroll:true});
 if(Math.abs(window.scrollY-oldScroll)>20)window.scrollTo({top:oldScroll,behavior:'instant'});
 return true;
}
