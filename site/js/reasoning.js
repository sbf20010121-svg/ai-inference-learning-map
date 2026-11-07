/** 情境式学习：从观测、假设、受控实验到复盘。所有案例均是明确标记的教学示意。 */
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,attrs='',active=false)=>`<button type="button" class="reason-btn ${active?'chosen':''}" ${attrs}>${h(label)}</button>`;
export const caseIds=new Set(['pd-disagg','vllm-scheduler','profiling','compiler-lowering','vla-policy']);
const records={
 'pd-disagg':{scene:'busy',answer:null,show:false},'vllm-scheduler':{policy:'decode',show:false,step:0},
 profiling:{scene:'gap',answer:null,verify:null,show:false},'compiler-lowering':{stage:0,answer:null,show:false},
 'vla-policy':{scene:'fast',answer:null,show:false}
};
export const pdScenarios={
 busy:{name:'高并发、长输入',clue:'长 Prefill 阻塞一部分 Decode 请求，混部出现尾延迟抖动。',mix:[30,40,0,68],split:[10,40,12,22],best:'split',explain:'这一组教学输入中，P/D 拆开后更少的排队和 Decode 干扰覆盖了 KV 传输成本。'},
 quiet:{name:'低并发、短输入',clue:'混部几乎无争抢；分开部署需要额外跨实例搬运 KV。',mix:[2,7,0,12],split:[2,7,12,11],best:'mix',explain:'混部几乎没有干扰，新增 12 ms 假设传输成本导致 TTFT 变差。'}
};
export const pdFirstToken=r=>r[0]+r[1]+r[2];
export function simulateScheduler(policy='decode'){
 const reqs=[['A',0,200,5],['B',1,900,2],['C',2,400,3],['D',4,850,2]].map(([id,arrival,prompt,output])=>({id,arrival,left:prompt,output,done:[],ready:Infinity,finished:false}));
 const rows=[],budget=512;
 for(let time=0;time<30;time++){
  if(reqs.every(r=>r.finished))break;
  let avail=budget;const ops=[];
  const active=reqs.filter(r=>r.arrival<=time&&!r.finished);
  const decode=()=>{for(const r of active.filter(r=>r.left===0&&r.ready<=time&&r.done.length<r.output)){
   if(avail===0)break;avail--;r.done.push(time);ops.push({id:r.id,kind:'D',n:1});if(r.done.length===r.output)r.finished=true;
  }};
  const prefill=()=>{for(const r of active.filter(r=>r.left>0)){
   if(avail===0)break;const n=Math.min(avail,r.left);avail-=n;r.left-=n;ops.push({id:r.id,kind:'P',n});if(!r.left)r.ready=time+1;
  }};
  if(policy==='decode'){decode();prefill()}else{prefill();decode()}
  rows.push({time,ops,used:budget-avail});
 }
 const delays=reqs.map(r=>r.done[0]-r.arrival);
 const gaps=reqs.flatMap(r=>r.done.slice(1).map((t,i)=>t-r.done[i]));
 return {rows,meanFirst:delays.reduce((a,b)=>a+b,0)/delays.length,maxGap:Math.max(...gaps),last:rows.length};
}
export const fusionTraffic=(m=1024,n=1024,bytes=2)=>({eager:5*m*n*bytes,fused:m*n*bytes});
export function simulateAction(infer,chunk,asyncMode=false,n=3){let t=0,wait=0;const blocks=[];for(let i=0;i<n;i++){
 const need=i===0?infer:asyncMode?Math.max(0,infer-chunk):infer;
 if(need){blocks.push(['等待推理',need,'idle']);wait+=need;t+=need}
 blocks.push(['播放动作',chunk,'compute']);t+=chunk;
 }return {total:t,wait,blocks};}
const profileCases={
 gap:{name:'Host 提交空档',clue:'端到端 12ms，最大 GPU Kernel 仅 3ms。GPU Timeline 中间有 5.1ms 空白，CPU 持续处理请求。',segments:[['Host 预处理',2.4,'idle'],['GPU 空档',5.1,'idle'],['H2D',.8,'transfer'],['Kernel',3,'compute'],['同步',.7,'other']],options:['先重写 GEMM','先检查 CPU 提交/同步','直接增大 Occupancy'],tests:['只比较 GEMM 耗时','固定输入后对照 Graph Replay / Host Timeline','只看 L2 Hit Rate'],answer:1,test:1,explain:'先用 Nsight Systems 确认 CPU API、数据准备、同步与 GPU 空洞的相对时间。Graph Replay 只在合适执行条件下有可能改善提交开销。'},
 gather:{name:'Gather 指令依赖',clue:'Gather Kernel 耗时 120µs；NCU 示例显示 Long Scoreboard 高、Eligible Warp 低，DRAM 带宽没有接近峰值。',segments:[['Kernel 120µs',120,'compute']],options:['只提高理论 HBM 带宽','把 Stall 45% 当成可直接削减的时间','假设依赖链或访问局部性影响发射'],tests:['只用一次 L2 Hit Rate 证明','固定总访问量，控制索引局部性/独立请求数后重复测量','把 GEMM Tile M 调大'],answer:2,test:1,explain:'Stall 是采样状态，不是时长占比；要结合数据依赖、内存事务、Eligible Warp 和可重复的对照实验做归因。'}
};
function bar(parts){return `<div class="reason-bar">${parts.filter(x=>x[1]>0).map(([label,n,color])=>`<div class="reason-barpart ${color}" style="flex:${n}" title="${h(label)}：${n}"><span>${h(label)} ${n}</span></div>`).join('')}</div>`}
function pd(s){const v=pdScenarios[s.scene];const pair=r=>`<div><p>TTFT = ${pdFirstToken(r)} ms（教学假设） · 假设 P99 ITL = ${r[3]} ms</p>${bar([['排队',r[0],'idle'],['Prefill',r[1],'prefill'],['KV',r[2],'transfer']])}</div>`;
return `<p class="reason-question">给定同一工作负载，你会选择混部还是 PD 分离？先判断，再看关键路径。</p><div class="reason-options">${Object.entries(pdScenarios).map(([k,x])=>btn(x.name,`data-casescene="${k}"`,s.scene===k)).join('')}</div><p class="reason-evidence">已知：${v.clue}</p><div class="reason-options">${btn('同实例混部','data-caseanswer="mix"',s.answer==='mix')}${btn('P/D 分开部署','data-caseanswer="split"',s.answer==='split')}${btn('揭示完整对照','data-casereveal')}</div>${s.show?`<div class="reason-output"><h4>同卡混部</h4>${pair(v.mix)}<h4>PD 分离</h4>${pair(v.split)}<p><b>${s.answer===v.best?'判断与这组证据相符。':'这组假设中，还需要调整判断。'}</b>${v.explain} 比较真实方案时还必须固定设备预算和到达分布，检查 P99、吞吐、KV 网络与失败率。</p></div>`:''}`}
function sched(s){const a=simulateScheduler('decode'),b=simulateScheduler('prefill');const x=s.policy==='decode'?a:b;const row=x.rows[s.step]||x.rows[0];return `<p class="reason-question">给 A(200输入/5输出)、B(900/2)、C(400/3)、D(850/2) 四条请求排程。第 0/1/2/4 轮依次到达，每轮 Token Budget=512。</p><p class="reason-evidence">任务：预测长 Prefill 插入时已有 Decode 的间隔会怎样变化；选择策略后逐轮观察实际 token 分配。</p><div class="reason-options">${btn('先保证已有 Decode','data-casepolicy="decode"',s.policy==='decode')}${btn('新 Prefill 优先（教学对照）','data-casepolicy="prefill"',s.policy==='prefill')}${btn('运行并重放','data-caserun')}</div><p class="reason-note">这是<b>逻辑轮次模拟，不是 vLLM 周期级模型</b>；默认 vLLM V1 在统一 Token Budget 中倾向先处理运行请求，对照策略不是实际同名配置。各轮并不等长，不能直接将轮次当作毫秒。</p>${s.show?`<div class="reason-output"><div class="reason-compare"><div><b>已有 Decode 优先</b><p>首输出平均延后 ${a.meanFirst.toFixed(2)} 轮，最大相邻 Token 间隔 ${a.maxGap} 轮</p></div><div><b>新 Prefill 优先</b><p>首输出平均延后 ${b.meanFirst.toFixed(2)} 轮，最大相邻 Token 间隔 ${b.maxGap} 轮</p></div></div><h4>点击轮次查看分配 · ${s.policy==='decode'?'Decode 优先':'Prefill 优先'}</h4><div class="reason-options">${x.rows.map((r,i)=>btn(''+(i+1),`data-casestep="${i}"`,i===s.step)).join('')}</div><div class="reason-event"><b>第 ${row.time+1} 轮 · 使用 ${row.used}/512 token</b><div>${row.ops.map(o=>`<span class="reason-tag ${o.kind==='D'?'decode':'prefill'}">${o.kind==='D'?'Decode':'Prefill'} ${o.id} · ${o.n}</span>`).join('')}</div></div><p>结论：优化 Token Budget 并不等于无代价地提高整体速度；还应采集请求排队、KV Block、实际 GPU 时间、TTFT/ITL。</p></div>`:''}`}
function profile(s){const v=profileCases[s.scene];return `<p class="reason-question">从系统证据提出诊断假设，并设计能否证的实验，而不是只看单个计数器。</p><div class="reason-options">${Object.entries(profileCases).map(([k,x])=>btn(x.name,`data-casescene="${k}"`,s.scene===k)).join('')}</div><div class="reason-evidence"><p>${v.clue}</p>${bar(v.segments)}<p>本案例数据是专为教学构造的，不可将 Nsight Stall 采样直接推算为某段真实时间。</p></div><h4>步骤 1：先调查什么？</h4><div class="reason-options">${v.options.map((x,i)=>btn(x,`data-caseanswer="${i}"`,s.answer===i)).join('')}</div><h4>步骤 2：怎样设计受控验证？</h4><div class="reason-options">${v.tests.map((x,i)=>btn(x,`data-casetest="${i}"`,s.verify===i)).join('')}${btn('提交诊断','data-casereveal')}</div>${s.show?`<div class="reason-output"><b>${s.answer===v.answer&&s.verify===v.test?'诊断与验证方案合理。':'先不要宣称找到了根因。'}</b><p>${v.explain}</p></div>`:''}`}
const stages=[['PyTorch','y = relu(x @ w + bias)','高层语义只说明计算，不保证每个操作对应单独 Kernel。'],['FX Graph','mm = matmul(x,w)\nadd = mm + bias\ny = relu(add)','TorchDynamo 尝试捕获 FX 图，Graph Break 和动态 Shape 会改变可融合范围。'],['Inductor / Triton','acc = matmul_tile(x,w)\nout = relu(acc + bias_tile)','教学伪代码：编译器可以将逐元素 Epilogue 融到 Matmul 写回，实际是否发生必须看编译输出。'],['PTX → SASS','load → MMA → bias → max → store','PTX 不是最终硬件机器码；要看实际 SASS 及 Profile 数据。']];
function compiler(s){const [title,code,desc]=stages[s.stage],t=fusionTraffic();return `<p class="reason-question">同一个 PyTorch 表达式如何从计算图走到设备？选择每一层，观察语义和临时数据。</p><div class="reason-options">${stages.map(([n],i)=>btn(`${i+1} ${n}`,`data-casestep="${i}"`,s.stage===i)).join('')}</div><div class="reason-evidence"><h4>${title}</h4><pre><code>${h(code)}</code></pre><p>${desc}</p></div><p class="reason-question">教学假设：M=N=1024、BF16 结果。Eager 的 Matmul、Bias、ReLU 产生 3 写 2 读；融合 Epilogue 只写最终结果。你能直接推断加速比吗？</p><div class="reason-options">${btn('理论流量降 5 倍，所以速度必然提升 5 倍','data-caseanswer="0"',s.answer===0)}${btn('理论中间流量下降，但性能仍需实测','data-caseanswer="1"',s.answer===1)}${btn('融合后 GEMM FLOPs 归零','data-caseanswer="2"',s.answer===2)}${btn('查看字节计算','data-casereveal')}</div>${s.show?`<div class="reason-output"><div class="reason-compare"><div><b>拆开的中间读写</b><p>${(t.eager/2**20).toFixed(1)} MiB</p></div><div><b>融合的中间写回</b><p>${(t.fused/2**20).toFixed(1)} MiB</p></div></div><p>${s.answer===1?'判断正确。':'不能将理论字节量倍数当作性能倍数。'} 这个计算忽略 A/B 矩阵加载、Cache、寄存器与额外指令；下一步要看实际 FX/Inductor 输出、Kernel Timeline 和正确性。</p></div>`:''}`}
const vlaCases={fast:{name:'推理快于动作播放',infer:3,chunk:6,why:'第一块等待后，推理可以和动作播放重叠；动作块过长仍可能降低环境变化响应速度。'},slow:{name:'推理慢于动作播放',infer:7,chunk:4,why:'后续动作块即使提前预测，动作缓冲区也会耗尽并出现等待；异步并非免费加速。'}};
function vla(s){const v=vlaCases[s.scene],a=simulateAction(v.infer,v.chunk,false),b=simulateAction(v.infer,v.chunk,true);return `<p class="reason-question">Policy 输出 Action Chunk：推理与执行能否重叠？先选择案例和你希望采用的执行策略。</p><div class="reason-options">${Object.entries(vlaCases).map(([k,x])=>btn(x.name,`data-casescene="${k}"`,s.scene===k)).join('')}</div><p class="reason-evidence">一次预测用 ${v.infer} tick，每块动作可播放 ${v.chunk} tick；需要连续播放三块。Tick 为相同时间单位的教学假设，不是真实机器人控制频率。</p><div class="reason-options">${btn('同步：推理完再播放','data-caseanswer="sync"',s.answer==='sync')}${btn('异步：播放时预取下一块','data-caseanswer="async"',s.answer==='async')}${btn('重放两条时间线','data-casereveal')}</div>${s.show?`<div class="reason-output"><h4>同步：总 ${a.total} tick · 空等 ${a.wait} tick</h4>${bar(a.blocks)}<h4>异步：总 ${b.total} tick · 空等 ${b.wait} tick</h4>${bar(b.blocks)}<p>${v.why} 还必须验证动作质量、观测陈旧程度、P99 与控制安全性。</p></div>`:''}`}
export function reasoningHTML(id){if(!caseIds.has(id))return '';const s=records[id];return `<section class="reason-lab" id="reasonLab"><header><span class="eyebrow accent-text">情境实训 · 决策与证据</span><h3>观察现象 → 提出假设 → 选择验证 → 复盘</h3><p>这里不是“拉滑块改倍数”。每个任务都要做判断、观察具体执行过程，并能解释可能的反例。<b>数据明确为教学假设，不能冒充真实基准。</b></p></header>${id==='pd-disagg'?pd(s):id==='vllm-scheduler'?sched(s):id==='profiling'?profile(s):id==='compiler-lowering'?compiler(s):vla(s)}</section>`;}
export function handleReasoning(el,id){if(!caseIds.has(id))return false;const s=records[id];
 if(el.dataset.casescene){s.scene=el.dataset.casescene;s.answer=null;s.verify=null;s.show=false}
 else if(el.dataset.caseanswer!==undefined){const raw=el.dataset.caseanswer;s.answer=/^\d+$/.test(raw)?Number(raw):raw;s.show=false}
 else if(el.dataset.casetest!==undefined){s.verify=Number(el.dataset.casetest);s.show=false}
 else if(el.dataset.casepolicy){s.policy=el.dataset.casepolicy;s.step=0;s.show=false}
 else if(el.dataset.casestep!==undefined){s.step=Number(el.dataset.casestep);s.stage=s.step}
 else if(el.hasAttribute('data-caserun')){s.show=true;s.step=0}
 else if(el.hasAttribute('data-casereveal'))s.show=true;
 else return false;
 const node=typeof document!=='undefined'?document.getElementById('reasonLab'):null;if(node)node.outerHTML=reasoningHTML(id);return true;
}
