import {TOKENS,recurrence,chunkEquivalence,compilerLayout,VECTOR_X,VECTOR_Y} from './research-models.js';
const $=(q)=>document.querySelector(q);
const $$=(q)=>[...document.querySelectorAll(q)];
const state={topic:'linear',tab:{linear:'process',compiler:'process'},rule:'delta',beta:0.5,gamma:1,token:0,linearStage:0,block:8,pid:0,ir:0,route:'torch',fusion:'eager'};
const fmt=(x)=>Number(Math.abs(x)<1e-10?0:x).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const arr=(a)=>'['+a.map(fmt).join(', ')+']';
const snap=()=>recurrence(state.beta,state.gamma,state.rule)[state.token];
function matHTML(M,label){
 const lo=Math.min(0,...M.flat()),hi=Math.max(1,...M.flat());
 return `<figure class="state-matrix"><p class="panel-title">${esc(label)}</p><div class="matrix" role="img" aria-label="${esc(label)}：${esc(M.map(row=>arr(row)).join('；'))}">${M.flat().map((v,i)=>{const ratio=(v-lo)/(hi-lo||1);return `<div class="matrix-cell" style="background:hsl(${180-ratio*18} 38% ${95-ratio*18}%);"><small>${Math.floor(i/2)},${i%2}</small>${fmt(v)}</div>`}).join('')}</div><figcaption class="matrix-label">行 = Key 维 · 列 = Value 维</figcaption></figure>`;
}
function matrixTable(M){return '['+M.map(r=>arr(r)).join(', ')+']';}
function renderLinear(){
 const rs=recurrence(state.beta,state.gamma,state.rule),s=rs[state.token],t=s.token;
 $('#linear-step-label').textContent=state.token===0?'初始 S₀':`${t.name} 已写入 · 第 ${state.token}/3 个 Token`;
 const active=state.token;
 const input=t?`k=${arr(t.k)}, v=${arr(t.v)}, q=${arr(t.q)}`:'尚未读入任何 Token';
 const prep=active===0?'空状态':'先保留 γ 倍旧状态';
 $('#linear-sim').innerHTML=`<div class="sim-topline"><strong>当前状态：${esc(s.title)}</strong><span class="chip">${state.rule==='delta'?'纠错写入':'直接累加'} · β=${fmt(state.beta)} · γ=${fmt(state.gamma)}</span></div><div class="state-flow"><div><small>① 新 Token</small><strong>${esc(input)}</strong></div><div><small>② 遗忘</small><strong>${esc(prep)}</strong></div><div><small>③ 预测与残差</small><strong>${active===0?'—':esc(arr(s.pred))+' → '+esc(arr(s.residual))}</strong></div><div class="accent"><small>④ 最终 S</small><strong>${active===0?'初始零矩阵':'按 Key 方向写入'}</strong></div></div><div class="columns"><div>${matHTML(s.S,`S${state.token} · 当前状态矩阵`)}<div class="mini-note">颜色只帮助识别数值变化。${active===0?'先按“处理下一个 Token”观察第 1 次更新。':`当前 Query 读取结果 qᵀS = ${arr(s.out)}。`}</div></div><div><h3 class="panel-title">为什么这样更新？</h3><div class="data-row"><b>衰减后 M</b><code>${matrixTable(s.before)}</code></div><div class="data-row"><b>旧预测 kᵀM</b><code>${arr(s.pred)}</code></div><div class="data-row"><b>${state.rule==='delta'?'残差 δ = v−预测':'直接写入 v'}</b><code>${arr(s.residual)}</code></div><div class="data-row"><b>写入 ΔS</b><code>${matrixTable(s.write)}</code></div><div class="data-row"><b>新 S</b><code>${matrixTable(s.S)}</code></div><p class="mini-note">${state.rule==='delta'?'Delta 规则先问“旧状态在这个 Key 方向已记住什么”，只纠正差值；β 决定纠正多少。':'直接累加不考虑旧状态的预测，新值可能与旧值持续叠加。它是对比基线，不等于 Gated DeltaNet。'}</p></div></div><div class="program-list">${TOKENS.map((v,i)=>`<button type="button" data-linear-token="${i+1}" class="${active===i+1?'active':''}">${esc(v.name)}：k=${arr(v.k)}</button>`).join('')}</div>`;
 $('[data-linear-prev]').disabled=state.token===0;$('[data-linear-next]').disabled=state.token===3;
}
function renderChunk(){
 const d=chunkEquivalence(state.beta,state.gamma);
 $('#linear-chunk').innerHTML=`<div class="sim-topline"><strong>两步合成的可检验等式</strong><span class="chip">β=${fmt(state.beta)} · γ=${fmt(state.gamma)}</span></div><div class="value-callout"><div><span>逐 Token 递推 S₂</span><b>${esc(matrixTable(d.byRecurrence))}</b></div><div><span>仿射组合 S₂</span><b>${esc(matrixTable(d.byChunk))}</b></div><div><span>逐元素最大绝对误差</span><b>${fmt(d.maxError)}</b></div></div><div class="columns"><div>${matHTML(d.compound.A,'组合变换 A₂A₁')}</div><div>${matHTML(d.compound.B,'组合写入 A₂B₁+B₂')}</div></div><div class="mini-note">组合顺序是第二步作用于第一步：不能交换 A₁ 与 A₂。这个恒等式只验证简化 GDN 状态递推；真实 Chunk Kernel 会采用更高效的矩阵组织，不直接等同于两矩阵朴素相乘。</div>`;
}
const linearPhases=[
 {title:'① 层级输入和执行模式',owner:'fla/layers/gated_deltanet.py',input:'hidden_states: [B,T,H]',action:'投影 Q、K、V、门控；短序列推理可走 fused_recurrent，较长序列走 chunk',output:'Q/K/V、β、g、上一轮状态',why:'模型层准备参数与状态，不等于在模型 Python 循环里逐 Token 运行所有计算。',code:`q = q_proj(hidden_states)  # [B,T,heads,K]\nk = k_proj(hidden_states)\nv = v_proj(hidden_states)  # [B,T,heads,V]\nbeta = b_proj(hidden_states)\nmode = choose_chunk_or_recurrent(q_len, training)`},
 {title:'② 单步递推的 GPU 状态',owner:'fla/ops/gated_delta_rule/fused_recurrent.py',input:'每头 S[K,V]、k[K]、v[V]、q[K]、g、β',action:'先门控衰减，再预测旧值，计算 delta 后更新 S、算输出',output:'新的 S[K,V] 和 o[V]',why:'这是 Delta 和 Gate 的实质计算。真实 Kernel 用 BK/BV 分块，可能使用 V-first 状态布局。',code:`for t in range(T):\n    S *= exp(g[t])              # γ 衰减\n    old_value = k[t] @ S        # [V]\n    delta = beta[t] * (v[t] - old_value)\n    S += outer(k[t], delta)     # [K,V]\n    out[t] = q[t] @ S           # [V]`},
 {title:'③ Prefill 的 Chunk 组织',owner:'fla/ops/gated_delta_rule/chunk.py',input:'较长序列 [B,T,H,K/V] 和初始状态',action:'对门控做块内前缀累积，准备 WY/局部项，再在 Chunk 间传递状态',output:'Chunk 输出、最终状态，供下一次 Decode',why:'多个 Token 的递推有关联，必须把先前状态对后续状态的影响编码出来。Chunk 并行不是简单改成一个大 for 循环。',code:`g_cum = gate_chunk_cumsum(g)\nlocal = compute_chunk_local_terms(k, v, beta, g_cum)\nchunk_states = propagate_state_across_chunks(local, h0)\nout = apply_chunk_states_to_queries(q, local, chunk_states)`},
 {title:'④ 设备资源与证据',owner:'Kernel Launch / Nsight',input:'目标 GPU、序列长度、K/V 维、dtype 与 Kernel 参数',action:'核对 program grid、BK/BV、状态布局与实际指令；分开测量 Prefill 和 Decode',output:'可重现实测的 Kernel 时间与状态访存证据',why:'固定形状状态不自动意味着延迟低。小 Batch 时 Launch、状态更新串行依赖与寄存器压力仍可能突出。',code:`record(shape, dtype, device, kernel_version)\ncheck_numerical_parity(chunk, recurrent)\nprofile(prefill_and_decode_separately)\ninspect(registers, local_spill, memory_bytes, launch_gap)\n# 不凭 toy model 预测 B200 周期/吞吐`}];
function renderLinearCode(){
 $('#linear-code-nav').innerHTML=linearPhases.map((p,i)=>`<button type="button" data-linear-stage="${i}" class="${state.linearStage===i?'active':''}">${esc(p.title)}</button>`).join('');
 const p=linearPhases[state.linearStage];
 $('#linear-code').innerHTML=`<h3>${esc(p.title)}</h3><p>${esc(p.action)}</p><div class="io-map"><div><small>输入对象</small><strong>${esc(p.input)}</strong></div><div><small>负责的层</small><strong>${esc(p.owner)}</strong></div><div><small>输出对象</small><strong>${esc(p.output)}</strong></div></div><pre><code>${esc(p.code)}</code></pre><div class="source-note"><b>为什么需要这一环：</b>${esc(p.why)}</div><p class="mini-note">以上代码是经过机制抽象的原创教学伪代码。真实文件与函数版本请通过下方固定提交链接核对。</p>`;
}
const irStages=[
 {name:'Triton 源码',tag:'Program 级算法',intro:'原始语义：每个程序处理 BLOCK 个偏移，Mask 阻止无效元素访问。',code:`pid = tl.program_id(0)\noffs = pid * BLOCK + tl.arange(0, BLOCK)\nmask = offs < N\nx = tl.load(x_ptr + offs, mask=mask, other=0)\ny = tl.load(y_ptr + offs, mask=mask, other=0)\ntl.store(out_ptr + offs, x + y, mask=mask)`,why:'这里还没直接规定某个逻辑元素由哪个 SM 的哪条物理指令执行。'},
 {name:'TTIR',tag:'操作与类型',intro:'保留 tt.load、算术运算、tt.store 和 shape/type 信息。',code:`%offs = arith.addi %base, %range      // 示意\n%mask = arith.cmpi slt, %offs, %N\n%x = tt.load %x_ptrs, %mask\n%y = tt.load %y_ptrs, %mask\n%z = arith.addf %x, %y                // 同一加法\ntt.store %out_ptrs, %z, %mask`,why:'这个层次体现操作依赖和张量类型，下一层需要决定怎样映射到线程/布局。'},
 {name:'TTGIR',tag:'GPU Layout',intro:'TritonGPU Dialect 明确布局编码与线程相关组织。下面只表示 Layout 的作用。',code:`#blocked = #triton_gpu.blocked<...>    // 示意\n%tile : tensor<8xf32, #blocked>\n%z = arith.addf %x, %y : tensor<8xf32, #blocked>\n// layout 属性将逻辑元素组织映射到 GPU 执行结构`,why:'单纯 BLOCK=8 不能反推物理 Lane、Warp 分配；必须看目标后端选定的布局及编译产物。'},
 {name:'LLVM IR',tag:'低层值与代码生成',intro:'更低层显式表示标量值、地址与目标相关操作。真实生成经常含 inline PTX/打包值等。',code:`%a = ...  ; lower load using target-specific ops\n%b = ...\n%z = fadd float %a, %b\n...       ; lower store / predication\n// 结构性示意；不是原样 LLVM dump`,why:'LLVM IR 支撑底层优化与代码生成；并非“LLVM 负责全部高层张量融合”。'},
 {name:'PTX',tag:'NVIDIA 虚拟 ISA',intro:'目标相关的虚拟指令级表示，包含显式数据类型和寄存器操作。',code:`@%p ld.global.f32 %f1, [%rd1];  // 示意\n@%p ld.global.f32 %f2, [%rd2];\nadd.f32 %f3, %f1, %f2;\n@%p st.global.f32 [%rd3], %f3;`,why:'掩码可能对应谓词控制；实际指令序列随版本、目标计算能力、优化和布局改变。'},
 {name:'SASS',tag:'真正设备指令',intro:'SASS 是目标 GPU 实际执行的指令；不能从 PTX 行数直接数出最终指令和时延。',code:`# 本页不伪造 B200 SASS\n# 从真实 cubin 使用 cuobjdump / nvdisasm\n# 对比 NCU 的指令/寄存器/访存指标\n# 并核对编译器版本、架构、优化参数`,why:'要证明某次编译优化，应把同一个 Kernel 的真实设备二进制与实测结合起来，而不是从 TTIR 猜测。'}
];
function renderPipeline(){
 $('#compiler-pipeline').innerHTML=irStages.map((p,i)=>`<button type="button" data-ir="${i}" class="${state.ir===i?'active':''}" aria-pressed="${state.ir===i}"><small>${i+1} / ${esc(p.tag)}</small><strong>${esc(p.name)}</strong></button>`).join('');
 const p=irStages[state.ir];
 $('#compiler-ir').innerHTML=`<h3>${esc(p.name)}：${esc(p.tag)}</h3><p>${esc(p.intro)}</p><pre><code>${esc(p.code)}</code></pre><div class="source-note"><b>这一层新增的信息：</b>${esc(p.why)}</div><p class="mini-note">伪代码或结构性片段不是编译器实际 Dump；正式审计时应固定 Triton 版本、目标 GPU 并抓取该 Kernel 真实的各层 .asm。</p>`;
}
function renderCompilerTiles(){
 const d=compilerLayout(state.block);if(state.pid>=d.count)state.pid=d.count-1;
 const p=d.programs[state.pid];
 $('#programButtons').innerHTML='当前 Program：'+d.programs.map(x=>`<button type="button" data-pid="${x.pid}" class="${state.pid===x.pid?'active':''}">P${x.pid}</button>`).join('');
 $('#compiler-tiles').innerHTML=`<div class="sim-topline"><strong>逻辑输入数据与 Program 的责任范围</strong><span class="chip">N=10 · BLOCK=${d.block} · Grid=${d.count} Programs</span></div><p class="panel-title">全局向量下标（高亮 = 当前 Program 覆盖）</p><div class="vec-grid">${VECTOR_X.map((x,i)=>`<div class="${p.offsets.includes(i)?'current':''}"><small>i=${i}</small><b>x=${x}</b><small>y=${VECTOR_Y[i]}</small></div>`).join('')}</div><p class="panel-title" style="margin-top:16px;">P${p.pid} 的逻辑偏移及 Mask</p><div class="lane-grid">${p.offsets.map((offset,i)=>`<div class="${p.masks[i]?'':'invalid'}"><small>槽${i}</small><b>${offset}</b><small>${p.masks[i]?'有效 ✓':'屏蔽 ×'}</small></div>`).join('')}</div><div class="value-callout"><div><span>Program 个数</span><b>${d.count}</b></div><div><span>有效元素</span><b>${d.active}</b></div><div><span>因越界屏蔽的槽</span><b>${d.masked}</b></div></div><div class="mini-note"><b>当前 P${p.pid} 输出：</b>${p.values.map(x=>x===null?'×':fmt(x)).join('、')}。全部有效下标的正确结果始终是 ${arr(d.output)}；更改 BLOCK 只改变逻辑任务分块，不意味着实际 GPU 更快。</div>`;
}
function renderRoutes(){
 const x=state.route==='torch'?[
 ['Python/Tensor','输入模型操作'],['Dynamo/FX','捕获图、Guard'],['Inductor','融合/调度/生成'],['Triton 或库','设备 Kernel'],['CUDA Runtime','提交已准备的任务'],['GPU','执行设备指令']
 ]:[['@triton.jit','直接写 GPU Kernel'],['TTIR','操作级 IR'],['TTGIR','布局相关 IR'],['LLVM IR / PTX','设备代码生成'],['CUDA Runtime','启动 Kernel'],['GPU','执行设备指令']];
 $('#compiler-routes').innerHTML=`<div class="route-map">${x.map((v,i)=>`<div><b>${esc(v[0])}</b><span>${esc(v[1])}</span></div>`).join('')}</div><p class="mini-note">${state.route==='torch'?'这是 TorchInductor 常见路径之一，不是每个 PyTorch 算子都经历所有步骤。':'这是直接 Triton Kernel 的主要编译路径；它不需要先经过 Dynamo/Inductor。'}</p>`;
}

function renderFusion(){
 const split=state.fusion==='eager',x=[-2,-1,1,2],u=x.map(v=>2*v),v=u.map(t=>t+1),y=v.map(t=>Math.max(0,t));
 const rows=[['输入 x',x,'读取'],['乘法中间 u=2x',u,split?'写 HBM':'寄存器中间值'],['加法中间 v=u+1',v,split?'写 HBM':'寄存器中间值'],['输出 y=ReLU(v)',y,'写 HBM']];
 const N=x.length,reads=split?3*N:N,writes=split?3*N:N;
 $('#compiler-fusion').innerHTML=`<div class="sim-topline"><strong>${split?'拆分：每步单独读写中间结果':'融合：一个 Kernel 内完成三种操作'}</strong><span class="chip">y=${arr(y)}</span></div><div class="fusion-flow">${rows.map(([label,data,note],i)=>`<div class="fusion-item"><small>${esc(label)}</small><strong>${arr(data)}</strong><em>${esc(note)}</em></div>`).join('')}</div><div class="value-callout"><div><span>示意全局读取（元素次）</span><b>${reads}</b></div><div><span>示意全局写入（元素次）</span><b>${writes}</b></div><div><span>理想 FP32 传输量</span><b>${(reads+writes)*4} B</b></div></div><p class="mini-note">${split?'三次 Kernel：x→u→v→y。中间 u、v 需要在 Kernel 边界物化。':'单一 Kernel：寄存器中完成 mul/add/relu 后写 y；不是减少数学运算。'} 这里只算逻辑全局读写，不等于真实 HBM 交易字节；缓存、向量化、编译融合合法性、寄存器压力与精度会改变实际表现。</p>`;
}
const answers={linear:{correct:1,why:'5 μs 占 28 μs 的约 18%。先拆清其他 23 μs 和 GPU 空档，再判断是否值得单独优化递推 Kernel；状态公式与系统调度需要分开归因。'},compiler:{correct:1,why:'Program 数与真实执行延迟不是一一对应。Tile 改变布局/占用、尾块、指令和访存；必须固定环境进行正确性验证和实测。'}};
function saveProgress(){try{localStorage.setItem('ai-atlas-research-prototype-v1',JSON.stringify({topic:state.topic,tab:state.tab,token:state.token,block:state.block}))}catch{}}
function setTab(topic,tab){state.tab[topic]=tab;$$('[data-panel]').forEach(e=>e.hidden=e.dataset.panel!==topic+':'+tab);$$('[data-tab]').forEach(b=>{const active=b.dataset.tab===topic+':'+tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});saveProgress()}
function setTopic(topic){state.topic=topic;$$('.topic').forEach(s=>s.hidden=s.id!==topic);$$('[data-topic]').forEach(b=>{const active=b.dataset.topic===topic;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});setTab(topic,state.tab[topic]);try{history.replaceState(null,'','?topic='+topic)}catch{}window.scrollTo({top:0,behavior:'instant'});saveProgress()}
function setChoice(sel,key,val){state[key]=val;$$('['+sel+']').forEach(b=>b.classList.toggle('active',String(b.getAttribute(sel))===String(val)))}
function init(){
 try{const store=JSON.parse(localStorage.getItem('ai-atlas-research-prototype-v1')||'{}');if(store.tab)state.tab={...state.tab,...store.tab};if([0,1,2,3].includes(store.token))state.token=store.token;}catch{}
 renderLinear();renderChunk();renderLinearCode();renderCompilerTiles();renderPipeline();renderRoutes();renderFusion();
 const query=new URL(location.href).searchParams.get('topic');setTopic(['linear','compiler'].includes(query)?query:'linear');
 document.addEventListener('click',event=>{
  const btn=event.target.closest('button');if(!btn)return;
  const d=btn.dataset;
  if(d.topic){setTopic(d.topic);return}
  if(d.tab){const [topic,tab]=d.tab.split(':');setTab(topic,tab);return}
  if(d.rule){setChoice('data-rule','rule',d.rule);renderLinear();return}
  if(d.beta){setChoice('data-beta','beta',Number(d.beta));renderLinear();renderChunk();return}
  if(d.gamma){setChoice('data-gamma','gamma',Number(d.gamma));renderLinear();renderChunk();return}
  if(d.linearToken){state.token=Number(d.linearToken);renderLinear();saveProgress();return}
  if(btn.hasAttribute('data-linear-next')){state.token=Math.min(3,state.token+1);renderLinear();saveProgress();return}
  if(btn.hasAttribute('data-linear-prev')){state.token=Math.max(0,state.token-1);renderLinear();saveProgress();return}
  if(d.linearStage){state.linearStage=Number(d.linearStage);renderLinearCode();return}
  if(d.block){setChoice('data-block','block',Number(d.block));state.pid=0;renderCompilerTiles();saveProgress();return}
  if(d.pid){state.pid=Number(d.pid);renderCompilerTiles();return}
  if(d.ir){state.ir=Number(d.ir);renderPipeline();return}
  if(d.compileRoute){setChoice('data-compile-route','route',d.compileRoute);renderRoutes();return}
  if(d.fusion){setChoice('data-fusion','fusion',d.fusion);renderFusion();return}
  if(d.answer){const [topic,index]=d.answer.split(':');const a=answers[topic],good=Number(index)===a.correct;const box=$('#'+topic+'-answer');box.className='answer '+(good?'ok':'no');box.textContent=(good?'判断正确。':'还需重新判断。')+a.why;return}
 });
}
init();
