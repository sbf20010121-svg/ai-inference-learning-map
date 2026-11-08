/** MoE teaching: stable token identities across routing, EP dispatch, grouped GEMM and combine.
 * Numbers are expressly illustrative, not inference results from a pretrained model.
 */
export const moeExample = Object.freeze({
  hidden:4, intermediate:8, k:2,
  experts:[{id:0,gpu:0},{id:1,gpu:0},{id:2,gpu:1}],
  tokens:[
    {id:0,gpu:0,logits:[2,1,0]},
    {id:1,gpu:0,logits:[0.1,1.6,1.0]},
    {id:2,gpu:1,logits:[2,0,1.5]},
    {id:3,gpu:1,logits:[0,1.4,1.5]}
  ],
  // One component of each expert's output; illustrative scalar values, not learned weights.
  demoExpertComponent:[4,10,6]
});
export function softmax(values){const m=Math.max(...values),exp=values.map(v=>Math.exp(v-m)),sum=exp.reduce((a,b)=>a+b,0);return exp.map(v=>v/sum)}
export function routeToken(token){
 const probabilities=softmax(token.logits);
 const selected=probabilities.map((score,expert)=>({expert,score})).sort((a,b)=>b.score-a.score||a.expert-b.expert).slice(0,moeExample.k);
 const selectedSum=selected.reduce((s,v)=>s+v.score,0);
 return {probabilities,selected:selected.map(v=>({...v,weight:v.score/selectedSum}))};
}
export function moeTrace(){
 const assignments=[],buckets=moeExample.experts.map(e=>({...e,tokens:[]}));
 const gpuTransfers=[[0,0],[0,0]];
 for(const t of moeExample.tokens){
  const routed=routeToken(t);
  for(const s of routed.selected){
    const e=moeExample.experts[s.expert];
    const a={token:t.id,origin:t.gpu,expert:e.id,target:e.gpu,score:s.score,weight:s.weight,remote:t.gpu!==e.gpu};
    assignments.push(a);buckets[e.id].tokens.push(a);
    gpuTransfers[t.gpu][e.gpu]++;
  }
 }
 return {assignments,buckets,gpuTransfers};
}
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,places=3)=>Number(n).toFixed(places);
const tokenLabel=t=>`T${t}`;
const color=id=>['#1a7d9b','#b47b29','#8f69b4','#27876e'][id]||'#6e8294';
function badge(t,chosen=false){return `<span class="moe-token ${chosen?'selected':''}" style="--token-color:${color(t)}">T${t}</span>`}
const nav=(token,stage)=>`<div class="moe-guide"><div><strong>① 选一个 Token，保持它的身份追踪到底</strong><div class="moe-choices">${moeExample.tokens.map(t=>`<button type="button" data-moe-token="${t.id}" class="${t.id===token?'active':''}" aria-pressed="${t.id===token}">T${t.id}<small>起点 GPU ${t.gpu}</small></button>`).join('')}</div></div><div><strong>② 切换机制：看对象怎样变化</strong><div class="moe-choices">${[['router','Router 打分'],['dispatch','EP / All-to-All'],['compute','Grouped GEMM'],['combine','输出合并']].map(([id,label])=>`<button type="button" data-moe-stage="${id}" class="${stage===id?'active':''}" aria-pressed="${stage===id}">${esc(label)}</button>`).join('')}</div></div></div>`;
function routerScene(t){const selected=routeToken(t);const weights=new Map(selected.selected.map(x=>[x.expert,x.weight]));
 return `<div class="moe-subtitle">T${t.id} 的隐藏向量 h（形状 [1,4]）经过 Router 投影 Wᵣ（形状 [4,3]），得到三个专家的 Logit。下表是<strong>人工构造</strong>的 Logit 与分数。</div><div class="moe-scores">${selected.probabilities.map((p,e)=>`<div class="moe-score-row ${weights.has(e)?'picked':''}"><span>E${e}（GPU ${moeExample.experts[e].gpu}）</span><div class="moe-score-track"><i style="width:${(p*100).toFixed(2)}%"></i></div><b>${num(p)}</b><small>${weights.has(e)?`✓ 选中，合并权重 ${num(weights.get(e))}`:'未选中'}</small></div>`).join('')}</div><div class="moe-mechanism-note">选择规则：<code>z = h Wᵣ</code>，按 <code>softmax(z)</code> 排序选 Top-2；本例把两个选中分数再归一化为合并权重。<strong>它不是比较 Expert FFN 参数的大小。</strong></div><math display="block" aria-label="路由计算公式"><mrow><msub><mi>g</mi><mrow><mi>t</mi><mo>,</mo><mi>e</mi></mrow></msub><mo>=</mo><mfrac><msup><mi>e</mi><msub><mi>z</mi><mrow><mi>t</mi><mo>,</mo><mi>e</mi></mrow></msub></msup><mrow><munder><mo>∑</mo><mi>j∈TopK</mi></munder><msup><mi>e</mi><msub><mi>z</mi><mrow><mi>t</mi><mo>,</mo><mi>j</mi></mrow></msub></msup></mrow></mfrac><mo>,</mo><mi>e∈TopK</mi></mrow></math><p class="moe-limit">此公式针对“Softmax 后选 Top-k，再对选中集合重新归一化”的教学约定。真实模型还可能使用 Sigmoid、专家组限制、负载均衡 Bias、路由缩放；选择分数与最终合并权重未必相同。</p>`;
}
function dispatchScene(t,trace){const rows=trace.gpuTransfers;return `<div class="moe-subtitle">EP 按 Expert 分配 GPU：GPU 0 保存 E0、E1；GPU 1 保存 E2。Router 选中以后，需要搬运<strong>Token 隐藏向量</strong>，而不是把模型的专家权重来回搬动。</div><div class="moe-gpu-layout">${[0,1].map(g=>`<section><h4>GPU ${g}（存放 ${moeExample.experts.filter(e=>e.gpu===g).map(e=>'E'+e.id).join('、')}）</h4>${trace.buckets.filter(x=>x.gpu===g).map(b=>`<div class="moe-bucket"><b>Expert E${b.id} · ${b.tokens.length} 个 Token 副本</b><div>${b.tokens.map(a=>badge(a.token,a.token===t.id)+(a.remote?'<small class="moe-remote">跨卡</small>':'')).join('')}</div></div>`).join('')}</section>`).join('')}</div><div class="moe-matrix"><strong>All-to-All：本例需要发送的 Token 副本数</strong><table><thead><tr><th>来自＼送往</th><th>GPU 0</th><th>GPU 1</th></tr></thead><tbody>${rows.map((row,i)=>`<tr><th>GPU ${i}</th>${row.map((x,j)=>`<td class="${i!==j?'moe-cross':''}">${x}${i===j?'（本地）':'（跨卡）'}</td>`).join('')}</tr>`).join('')}</tbody></table><p>本例 GPU0 → GPU1 为 ${rows[0][1]} 份；GPU1 → GPU0 为 ${rows[1][0]} 份。通信代价取决于数据量、网络、拓扑和实现。</p></div><div class="moe-mechanism-note">All-to-All 是集体通信操作：每张卡可向其他卡发送<strong>不同的部分数据</strong>，不是把所有 Token 广播给所有卡。实际 MoE 还可以用 DeepEP 等不同 Dispatch 后端。</div>`;}
function expertScene(t,trace){return `<div class="moe-subtitle">同一个 Expert 接收的 Token 数 <code>Mₑ</code> 各不相同；专家各有自己的 <code>Wₑ</code>。Grouped GEMM 把这些<strong>相互独立</strong>的小矩阵乘法作为一组调度，并不是把权重合并为一份。</div><div class="moe-gemm-layout">${trace.buckets.map(b=>`<div class="moe-gemm-group ${b.tokens.some(a=>a.token===t.id)?'active':''}"><strong>E${b.id} / GPU ${b.gpu} · Mₑ = ${b.tokens.length}</strong><div>${b.tokens.map(a=>badge(a.token,a.token===t.id)).join('')}</div><code>Xₑ [${b.tokens.length},4] × Wᵍₐₜₑ,ₑ [4,8]</code><code>Xₑ [${b.tokens.length},4] × Wᵤₚ,ₑ [4,8]</code><code>SiLU(Gate) ⊙ Up → [${b.tokens.length},8]</code><code>× W𝒹ₒwₙ,ₑ [8,4] → [${b.tokens.length},4]</code></div>`).join('')}</div><div class="moe-mechanism-note">FFN 不是只有“乘权重 + 加偏置”：在 SwiGLU 例子中有两个上投影、SiLU 激活、逐元素乘、下投影。Bias 取决于模型结构。Grouped GEMM 仍计算各 Expert 的独立权重，只是共享 Kernel 调度及资源。</div>`;}
function combineScene(t,trace){const selected=trace.assignments.filter(a=>a.token===t.id);const vals=moeExample.demoExpertComponent;const terms=selected.map(a=>`${num(a.weight)} × ${vals[a.expert]}`);const y=selected.reduce((s,a)=>s+a.weight*vals[a.expert],0);
 return `<div class="moe-subtitle">专家算完以后，对同一个 Token 的两个输出按路由权重加权。跨 GPU 的输出需要回到负责合并的位置，并恢复原 Token 顺序。</div><div class="moe-combine-equation"><b>当前 ${tokenLabel(t.id)} 的一个输出分量（教学数值）</b><div>${selected.map(a=>`${badge(t.id,true)} <span>E${a.expert}：g=${num(a.weight)}、示例输出分量=${vals[a.expert]}</span>`).join('')}</div><p>${terms.join(' + ')} = <strong>${num(y)}</strong></p><small>真实 Expert 输出是 [H] 向量，本例只用单一分量示范求和，数值不是模型实测。</small></div><div class="moe-mechanism-note">结果写回原始 Token T${t.id} 对应的位置。若有 Shared Expert，它的输出可能另外参与；并不是每个 Token 在所有 Routed Expert 都执行一遍 FFN。</div>`;}
export function moeDeepDiveHTML(tokenId=0,stage='router'){
 const token=moeExample.tokens.find(t=>t.id===tokenId)||moeExample.tokens[0];const allowed=['router','dispatch','compute','combine'];if(!allowed.includes(stage))stage='router';
 const trace=moeTrace();const page=stage==='router'?routerScene(token):stage==='dispatch'?dispatchScene(token,trace):stage==='compute'?expertScene(token,trace):combineScene(token,trace);
 return `<section class="moe-deep-dive" aria-label="MoE 从路由到专家计算的交互教学"><header><small>MoE · 机制推导实验（合成数据，非真实模型输出）</small><h3>一个 Token 究竟怎样经过 Router、EP 和专家 FFN？</h3><p>固定 4 个 Token、3 个 Expert、2 张 GPU、Top-2。<strong>选择 Token 或步骤</strong>，查看同一对象在分数、路由、矩阵计算和结果合并中的变化。</p></header>${nav(token.id,stage)}<div class="moe-visual-panel" aria-live="polite">${page}</div><details class="moe-terms"><summary>术语与变量表（点击展开）</summary><dl><div><dt>T0～T3</dt><dd>四个 Token 在 MoE 层的隐藏向量，不是 Token ID 数值本身。</dd></div><div><dt>H = 4、D = 8</dt><dd>隐藏宽度与 FFN 中间宽度，均为教学尺寸。</dd></div><div><dt>z、g、Top-k</dt><dd>z 是 Router 原始 Logit，g 是选中专家结果合并时的权重，k 是每个 Token 选择的专家个数。</dd></div><div><dt>Mₑ</dt><dd>被分配给专家 e 的 Token 数；Grouped GEMM 的每组 M 可以不同。</dd></div><div><dt>EP</dt><dd>Expert Parallelism，按 Expert 在 GPU 间分布参数和计算。</dd></div><div><dt>All-to-All</dt><dd>GPU 间按目标专家交换不同 Token 隐藏向量；实际后端实现不唯一。</dd></div></dl></details><p class="moe-footnote">教学边界：省略了容量限制、Router 负载均衡训练、量化、通信重叠和大规模专家冗余。真实实现以模型源码/推理后端为准。<a href="https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/moe.html" target="_blank" rel="noopener noreferrer">NVIDIA Megatron MoE</a> · <a href="https://docs.vllm.ai/en/latest/serving/expert_parallel_deployment/" target="_blank" rel="noopener noreferrer">vLLM EP</a> · <a href="https://github.com/deepseek-ai/DeepSeek-V3/blob/main/inference/model.py" target="_blank" rel="noopener noreferrer">DeepSeek-V3 Expert/Router</a></p></section>`;
}
export function validateMoeExample(){const tr=moeTrace();if(tr.assignments.length!==8)throw Error('expected 8 token-expert assignments');if(tr.buckets.map(x=>x.tokens.length).join(',')!=='2,3,3')throw Error('expert counts');if(tr.gpuTransfers.map(x=>x.join(',')).join(';')!=='3,1;2,2')throw Error('cross-GPU routing');for(const t of moeExample.tokens){const r=routeToken(t);if(Math.abs(r.selected.reduce((s,a)=>s+a.weight,0)-1)>1e-12)throw Error('bad weights');}return true;}
