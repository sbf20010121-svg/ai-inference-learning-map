/**
 * V1.8: semantic, evidence-aware knowledge connections.
 * Curated nodes are always built from existing depthTopics. User insights are local,
 * explicit, exportable additions – never posted to GitHub without review.
 */
import {allCourses as depthTopics,foundationCourses} from './course-registry.js';
import {courseNotes} from './course-notes.js';
export const GRAPH_STORE='ai-inference-semantic-graph-v1';
export const RELATION_TYPES={
  prerequisite:{label:'理解前提',color:'#68799d'},
  produces:{label:'产生 / 管理',color:'#137f89'},
  accesses:{label:'读取 / 访问',color:'#ad7140'},
  implements:{label:'实现 / 映射',color:'#6656a9'},
  explains:{label:'解释 / 归因',color:'#478069'},
  contrasts:{label:'比较 / 替代',color:'#b46d83'},
  extends:{label:'延伸理解',color:'#326f97'},
};
export const curatedRelations=[
  ['llm-block','kv-cache','produces','Transformer 自回归生成会复用历史 Key/Value；模型形状决定缓存读写模式。'],
  ['vllm-scheduler','kv-cache','produces','调度器协调请求的缓存块分配与复用；具体接口随 vLLM 版本变化。'],
  ['kv-cache','memory-route','implements','逻辑 KV 块最终存放于 GPU 可寻址的物理缓存区域，访存模式影响执行。'],
  ['kv-cache','attention-tiling','accesses','Decode Attention 需要按映射读取历史 K/V；物理块顺序可与逻辑顺序不同。'],
  ['kv-cache','pd-disagg','produces','PD 分离要把 Prefill 产生的 KV 状态交付 Decode 实例，才可以继续生成。'],
  ['multi-gpu','pd-disagg','prerequisite','理解设备间数据传输与拓扑，才能判断跨实例 KV 转运成本。'],
  ['pd-disagg','serving-slo','explains','PD 分离试图改善干扰和尾延迟，但要同时考虑 KV 传输成本与 TTFT。'],
  ['vllm-scheduler','serving-slo','explains','排队、预算与批处理策略会影响 TTFT/ITL 的延迟分布。'],
  ['compiler-lowering','triton-tiling','implements','从高层张量计算降到 Tile/Layout，再进一步生成设备代码。并非全部算子都走此路径。'],
  ['triton-tiling','gemm-tiling','implements','矩阵形状和分块决定 Program 网格、访存复用与计算映射。'],
  ['gemm-tiling','tensorcore-b200','implements','适用 dtype/shape 的矩阵块可映射到 B200 矩阵计算资源。'],
  ['attention-tiling','memory-route','explains','FlashAttention 的关键是重组分块与片上存储复用，减少中间矩阵的 HBM 往返。'],
  ['warp-issue','profiling','explains','指令依赖与 Eligible Warp 情况可以用于解释部分发射等待，但必须结合 Trace 与其它指标。'],
  ['memory-route','profiling','explains','理解 Cache/Shared/HBM 的数据访问路径，才能解释带宽、命中与访存延迟。'],
  ['fused-norm','compiler-lowering','implements','算子融合是图优化或手工 Kernel 的实现策略，要区分中间张量消除和额外寄存器成本。'],
  ['mla-kv','kv-cache','contrasts','MLA 改变注意力状态的存储表示与读取方式，不能直接按传统多头 KV 大小估算。'],
  ['linear-state','kv-cache','contrasts','部分线性注意力使用递推状态而非随上下文线性增长的完整 KV 历史。'],
  ['spec-decode','serving-slo','explains','推测解码的收益取决于候选接受率和验证计算，不会对所有负载都提速。'],
  ['quant-pipeline','memory-route','explains','低比特权重减少传输字节，但引入格式解码与精度约束。'],
  ['vla-policy','world-model','contrasts','VLA 通常负责生成动作；世界模型主要预测状态演化，两者可联合但并非等价。'],
  ['vla-policy','triton-tiling','implements','动作专家仍执行具体 GEMM/Attention/Norm 等算子，可沿编译与 GPU 路径追踪。'],
  ['world-model','attention-tiling','accesses','部分基于时空 Transformer 的世界模型会使用 Attention；不是所有世界模型均如此。'],
  ['host-runtime','runtime-graph','prerequisite','CPU/驱动/流同步的基础解释了 Runtime 工作提交和 CUDA Graph Replay 的边界。'],
  ['runtime-graph','profiling','explains','CPU Submit、Launch、Graph Replay 与 GPU 执行时间线必须分开观察。'],
  ['moe-route','multi-gpu','accesses','专家分布在不同 GPU 时会产生 All-to-All 等通信；部署策略改变开销。'],
  ['moe-route','gemm-tiling','implements','每个 Expert 收到不同数量的 Token，Grouped GEMM 把这些不同 M 的独立专家矩阵乘法作为一组调度。'],
  ['moe-route','profiling','explains','MoE 完整热点需要同时检查 Router、Dispatch/All-to-All、各 Expert GEMM 和 Combine，不能只看单个专家算子。'],
  ['frameworks','serving-slo','explains','引擎对比必须固定请求到达与SLO；离线最高吞吐不能替代在线满足率。'],
  ['frameworks','compiler-lowering','accesses','相同模型在不同引擎可能选择不同编译/库后端，应记录实际Kernel而非仅框架名。'],
  ['quant-pipeline','gemm-tiling','implements','量化格式必须由兼容shape与设备的GEMM后端执行；Scale和反量化也改变成本。'],
  ['llm-block','moe-route','extends','稠密前馈层可替换为路由专家计算；它改变Token分桶和通信，不只改变参数量。'],
  ['llm-block','fused-norm','accesses','层内归一化和门控具有不同依赖，决定能否融合与中间量如何保存。'],
  ['linear-state','triton-tiling','implements','递推/Chunk状态更新必须映射到实际Tile和布局；矩阵形状决定资源与数据交换。'],
  ['tensorcore-b200','memory-route','accesses','矩阵流水线需要显式准备Tile与同步；Shared和Tensor Memory的角色不能当成自动Cache层。'],
  ['spec-decode','vllm-scheduler','accesses','候选验证改变本轮位置数与缓存需求；接受后仍需同步请求的已计算状态。']
].map(([from,to,type,why],i)=>({id:`cur-${i+1}`,from,to,type,why,origin:'curated'}));
for(const c of foundationCourses)for(const [i,[from,why]] of c.prereqs.entries())curatedRelations.push({id:`course-pre-${c.id}-${i}`,from,to:c.id,type:'prerequisite',why,origin:'curated'});
export const curatedNodes=depthTopics.map(t=>({id:t.id,title:t.title,summary:courseNotes[t.id]?.definition||t.summary,module:t.module,origin:'curated',status:'source'}));
const CURATED_IDS=new Set(curatedNodes.map(n=>n.id));
const SAFE_ID=/^mine-[a-z0-9-]{1,60}$/;
const safeTxt=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const validLink=url=>!url||(/^https:\/\//i.test(url)&&URL.canParse(url));
const allowedStatus=new Set(['not-verified','learning','verified']);
export function cleanUserGraph(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {version:1,nodes:[],edges:[]};
  const nodes=[],seen=new Set();
  for(const n of (Array.isArray(raw.nodes)?raw.nodes:[]).slice(0,200)){
    if(!n||!SAFE_ID.test(n.id)||seen.has(n.id)||CURATED_IDS.has(n.id))continue;
    const title=safeTxt(n.title,60),summary=safeTxt(n.summary,500),source=safeTxt(n.source,500);
    if(!title||!summary||!validLink(source))continue;
    seen.add(n.id);nodes.push({id:n.id,title,summary,source,module:curatedNodes.some(t=>t.module===n.module)?n.module:'engine',status:allowedStatus.has(n.status)?n.status:'not-verified',origin:'mine'});
  }
  const all=new Set([...CURATED_IDS,...seen]),edges=[],edgeIds=new Set();
  for(const e of (Array.isArray(raw.edges)?raw.edges:[]).slice(0,450)){
    if(!e||!SAFE_ID.test(e.id)||edgeIds.has(e.id)||!all.has(e.from)||!all.has(e.to)||e.from===e.to||!RELATION_TYPES[e.type])continue;
    if(!seen.has(e.from)&&!seen.has(e.to))continue; // user graph cannot silently rewrite curated relations
    const why=safeTxt(e.why,300);if(!why)continue;
    edgeIds.add(e.id);edges.push({id:e.id,from:e.from,to:e.to,type:e.type,why,origin:'mine'});
  }
  return {version:1,nodes,edges};
}
export function loadUserGraph(store){try{return cleanUserGraph(JSON.parse(store.getItem(GRAPH_STORE)||'{}'))}catch{return cleanUserGraph({})}}
export function saveUserGraph(store,graph){const cleaned=cleanUserGraph(graph);store.setItem(GRAPH_STORE,JSON.stringify(cleaned));return cleaned}
export function fullGraph(user){const clean=cleanUserGraph(user);return {nodes:[...curatedNodes,...clean.nodes],edges:[...curatedRelations,...clean.edges]}}
export function relatedGraph(graph,id){const node=graph.nodes.find(n=>n.id===id);if(!node)return null;return {node,incoming:graph.edges.filter(e=>e.to===id),outgoing:graph.edges.filter(e=>e.from===id)}}
let serial=0;
export function makeUserId(){serial=(serial+1)%10000;return `mine-${Date.now().toString(36)}-${serial.toString(36)}`}
export function addUserInsight(graph,{title,summary,module,source,anchor,relation,why}){
  const current=cleanUserGraph(graph),validNodes=new Set([...CURATED_IDS,...current.nodes.map(n=>n.id)]);
  const t=safeTxt(title,60),s=safeTxt(summary,500),p=safeTxt(why,300),url=safeTxt(source,500);
  if(!t||!s||!p||!validNodes.has(anchor)||!RELATION_TYPES[relation]||!validLink(url))throw new Error('请填写名称、自己的理解、关系原因，并选择有效的锚点与关系。');
  if(current.nodes.length>=200)throw new Error('个人节点已达到本地上限，请先整理和导出。');
  let id=makeUserId();while(validNodes.has(id)){id=makeUserId()}
  const node={id,title:t,summary:s,source:url,module:curatedNodes.some(x=>x.module===module)?module:'engine',status:'not-verified',origin:'mine'};
  const edge={id:makeUserId(),from:anchor,to:id,type:relation,why:p,origin:'mine'};
  return {graph:cleanUserGraph({version:1,nodes:[...current.nodes,node],edges:[...current.edges,edge]}),id};
}
export function addUserLink(graph,{from,to,type,why}){
  const current=cleanUserGraph(graph),ids=new Set([...CURATED_IDS,...current.nodes.map(n=>n.id)]);
  const w=safeTxt(why,300);
  if(!w||!RELATION_TYPES[type]||!ids.has(from)||!ids.has(to)||from===to)throw new Error('请选择有效的两个知识节点、关系类型，并解释连接理由。');
  if(!current.nodes.some(n=>n.id===from||n.id===to))throw new Error('新连线至少涉及一项个人知识，公开课程关系由课程维护 Skill 审核。');
  const dupe=[...curatedRelations,...current.edges].some(e=>e.from===from&&e.to===to&&e.type===type);
  if(dupe)throw new Error('此关系已经存在。');
  return cleanUserGraph({version:1,nodes:current.nodes,edges:[...current.edges,{id:makeUserId(),from,to,type,why:w,origin:'mine'}]});
}
export function setInsightStatus(graph,id,status){const g=cleanUserGraph(graph);if(!allowedStatus.has(status))throw new Error('无效状态');const n=g.nodes.find(x=>x.id===id);if(!n)throw new Error('只能标记自己记录的知识');n.status=status;return g}
export function removeInsight(graph,id){const g=cleanUserGraph(graph);return cleanUserGraph({version:1,nodes:g.nodes.filter(n=>n.id!==id),edges:g.edges.filter(e=>e.from!==id&&e.to!==id)})}
export function validateCuratedRelations(){for(const e of curatedRelations){if(!CURATED_IDS.has(e.from)||!CURATED_IDS.has(e.to)||!RELATION_TYPES[e.type]||!e.why)throw new Error(`curated relation broken: ${e.id}`)}return true}

export function editUserInsight(graph,id,patch){const g=cleanUserGraph(graph),n=g.nodes.find(n=>n.id===id);if(!n)throw new Error('只允许修改个人节点');
 const title=safeTxt(patch.title,60),summary=safeTxt(patch.summary,500),source=safeTxt(patch.source,500);
 if(!title||!summary||!validLink(source))throw new Error('标题、正文或来源格式无效');
 n.title=title;n.summary=summary;n.source=source;
 return g;
}
