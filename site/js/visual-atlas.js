/** V1.5：原位图解、张量例子、权衡与记忆点。HTML 由公开且经过审阅的本地知识数据驱动。 */
import {illustrated} from './visual-knowledge.js';
import {depthModules} from './depth-content.js';
import {lanes,validateLanes} from './visual-lanes.js';
import {mechanismStudioHTML} from './mechanism-studio.js';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color={model:'#8b66bd',engine:'#347fa8',compiler:'#b77938',kernel:'#168b83',systems:'#627ca0',microarch:'#bd755c'};
const keyModules=['model','engine','compiler','kernel','microarch'];
const names={model:'模型与算子',engine:'推理引擎',compiler:'编译 / Runtime',kernel:'Kernel / 分析',microarch:'GPU 微架构',systems:'系统基础'};

export const visualFor=t=>illustrated[t.id]||{
  key:t.summary,
  chain:t.stage.map(s=>[s.title,s.mechanism]),
  sample:['本专题的计算线索',t.stage.map(s=>`${s.title}：${s.data}`).join('；'),'具体实现以模型/框架版本与实际 Trace 为准。'],
  compare:[['主要收益',t.insights[0],'适用条件取决于 Shape 与资源'],['实现代价',t.insights[1]||t.summary,t.stage.at(-1).trap]],
  remember:[t.summary,...t.insights].slice(0,3)
};
export function validateVisualKnowledge(topics){
 validateLanes(topics);
 const ids=new Set(topics.map(t=>t.id));for(const id of Object.keys(illustrated)){if(!ids.has(id))throw new Error(`图解主题不存在: ${id}`)}
 for(const t of topics){const v=visualFor(t);if(v.chain.length<3||v.chain.length>7||v.remember.length!==3||v.compare.length!==2)throw new Error(`图解缺少完整结构: ${t.id}`);
 for(const x of v.chain){if(x.length!==2||x.some(y=>typeof y!=='string'||!y.trim()))throw new Error(`图解流程不完整: ${t.id}`)}
 if(v.sample.length!==3||v.compare.some(x=>x.length!==3))throw new Error(`示例与权衡不完整: ${t.id}`)
 }
 return true;
}
const wrapTitle=s=>{const raw=String(s);const isLatin=/^[\x20-\x7E]+$/.test(raw);let chunks;if(isLatin&&raw.length<=20)chunks=[raw];else if([...raw].length<=11)chunks=[raw];else{const chars=[...raw];chunks=[chars.slice(0,10).join(''),chars.slice(10,20).join('')]}return chunks.filter(Boolean).map((p,i)=>`<tspan x="0" dy="${i?'22':'0'}">${esc(p)}</tspan>`).join('')};
function svgFlow(t,selected=0){const d=visualFor(t),nodes=d.chain,n=nodes.length;
 const gap=1040/n, width=Math.min(186,gap-30),y=142;
 const edges=nodes.slice(0,-1).map((_,i)=>{const x1=54+(i+0.5)*gap+width/2, x2=54+(i+1.5)*gap-width/2;return `<path class="viz-arrow" d="M ${x1} ${y} H ${x2-10}" marker-end="url(#viz-arrowhead)"/>`}).join('');
 const boxes=nodes.map(([label,detail],i)=>{const x=54+(i+.5)*gap;return `<g class="viz-svg-node ${i===selected?'is-selected':''}" role="button" tabindex="0" data-vpick="${i}" aria-label="查看步骤${i+1}：${esc(label)}" aria-pressed="${i===selected}" transform="translate(${x} ${y})"><rect x="${-width/2}" y="-58" width="${width}" height="116" rx="14"/><rect class="viz-accent" x="${-width/2}" y="-58" width="7" height="116" rx="3"/><text class="viz-number" y="-33">${String(i+1).padStart(2,'0')}</text><text class="viz-node-label" y="-2" text-anchor="middle">${wrapTitle(label)}</text><title>${esc(detail)}</title></g>`}).join('');
 return `<div class="viz-flow-scroll" tabindex="0" aria-label="左右滚动查看全流程"><svg class="viz-svg" viewBox="0 0 1140 290" role="group" aria-label="${esc(t.title)}：从左到右的主要数据与执行环节"><defs><marker id="viz-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 L8 5 L1 9" fill="none" stroke="currentColor" stroke-width="1.7"/></marker></defs><text class="viz-svg-caption" x="55" y="35">核心机制主路径 · 点击节点观察具体数据流（示意，可能存在并行或异步）</text>${edges}${boxes}</svg></div>`;
}
function nodeDetail(t,i){const v=visualFor(t),row=v.chain[Math.max(0,Math.min(v.chain.length-1,i))];return `<span class="viz-detail-step">STEP ${String(i+1).padStart(2,'0')} / ${v.chain.length}</span><h4>${esc(row[0])}</h4><p>${esc(row[1])}</p>`}
function moduleContext(t){return `<div class="viz-context" aria-label="本专题在 AI 推理系统中的位置"><div class="viz-context-row">${keyModules.map((id,i)=>`<div class="viz-context-cell ${t.module===id?'is-here':''}" style="--accent:${color[id]}"><span>${i+1}</span><strong>${names[id]}</strong></div>${i<keyModules.length-1?'<span class="viz-context-arrow" aria-hidden="true">→</span>':''}`).join('')}</div><div class="viz-context-support ${t.module==='systems'?'is-here':''}" style="--accent:${color.systems}">系统基础：CPU / OS / Driver / 通信贯穿全链路${t.module==='systems'?'（本课重点）':''}</div></div>`}
function laneHTML(t){const item=lanes[t.id];if(!item)return '';
 return `<div class="viz-location-head viz-lane-head"><span>03 / 分层数据流图</span><strong>${esc(item.title)}</strong></div><div class="viz-lane-scroll" tabindex="0" aria-label="可横向滚动的控制与数据泳道图"><div class="viz-swimlanes">${item.rows.map((row,r)=>`<div class="viz-swimlane-row"><div class="viz-swimlane-title ${r===0?'is-control':'is-data'}">${esc(row[0])}</div>${row.slice(1).map((label,i)=>`<div class="viz-swimlane-ct"><strong>${String(i+1).padStart(2,'0')}</strong><p>${esc(label)}</p></div>${i<3?'<div class="viz-swimlane-arrow">→</div>':''}`).join('')}</div>`).join('')}</div></div><p class="viz-lane-note">${esc(item.note)}</p>`;
}
function comparison(t){const v=visualFor(t);return `<div class="viz-compare-grid">${v.compare.map((o,i)=>`<div class="viz-comparison"><span class="viz-comparison-number">${i===0?'方案 A':'方案 B'}</span><h4>${esc(o[0])}</h4><div><small>有利之处</small><p>${esc(o[1])}</p></div><div><small>需要付出的代价</small><p>${esc(o[2])}</p></div></div>`).join('')}</div>`}
export function visualHTML(t){const v=visualFor(t);return `<section class="viz-lesson" aria-label="${esc(t.title)}的直接图解课程"><div class="viz-head"><span class="viz-eyebrow">第一眼就看懂 · 不需要先跳到外部资料</span><h3>这节的核心结论</h3><p>${esc(v.key)}</p></div><div class="viz-location-head"><span>01 / 系统位置</span><strong>我正在整条推理链路的哪一层？</strong></div>${moduleContext(t)}<div class="viz-location-head"><span>02 / 核心架构图</span><strong>数据与任务如何一步步流动？</strong></div>${svgFlow(t)}<div class="viz-node-detail" id="vizNodeDetail" aria-live="polite">${nodeDetail(t,0)}</div>${mechanismStudioHTML(t)}${laneHTML(t)}<div class="viz-location-head"><span>${lanes[t.id]?'04':'03'} / 真实计算线索</span><strong>用一个张量或执行例子理解它</strong></div><div class="viz-example"><div><strong>${esc(v.sample[0])}</strong><p>${esc(v.sample[1])}</p></div><div class="viz-boundary"><strong>不要这样误解</strong><p>${esc(v.sample[2])}</p></div></div><div class="viz-location-head"><span>05 / 设计取舍图</span><strong>为什么会有两种实现方式？</strong></div>${comparison(t)}<div class="viz-recall"><div class="viz-recall-heading"><span>06 / 知识记忆卡</span><h3>离开这页，先记住三件事</h3></div><ol>${v.remember.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><details><summary>自测：现在合上图，你能解释它的核心机制吗？</summary><p>试着口头回答：这项技术解决什么问题？数据和控制如何流动？真正的代价或适用边界是什么？若需要回看，优先返回本页的机制图。</p></details></div><p class="viz-footnote">注：以上是帮助理解架构的教学示意，不是特定产品的完整线程模型、精确内存路径或实测性能结果。</p></section>`}
export function handleVisualClick(target,t,root){const button=target?.closest?.('[data-vpick]');if(!button||!root.contains(button))return false;const index=Number(button.dataset.vpick);if(!Number.isInteger(index)||index<0||index>=visualFor(t).chain.length)return false;
 for(const node of root.querySelectorAll('.viz-svg-node')){const active=Number(node.dataset.vpick)===index;node.classList.toggle('is-selected',active);node.setAttribute('aria-pressed',String(active));}
 const detail=root.querySelector('#vizNodeDetail');if(detail)detail.innerHTML=nodeDetail(t,index);
 return true;
}
/** L3 原位讲解：正文里直接展示计算/执行，而外部仓库只用于核对。 */
export function inlineImplementation(t){const v=visualFor(t);return `<section class="viz-inline-impl" aria-label="原位源码与执行机制解读"><div class="viz-inline-intro"><span>不用离开网页的实现导读</span><h4>真实代码会怎样组织这条链路？</h4><p>先理解<strong>哪个模块做什么、交给什么张量或设备任务</strong>，再通过下方官方源码入口核对特定版本。</p></div><div class="viz-inline-chain">${t.stage.map((s,i)=>`<div class="viz-implementation-card"><div class="viz-impl-index">${String(i+1).padStart(2,'0')}</div><div><strong>${esc(s.title)}</strong><p>${esc(s.mechanism)}</p><small><b>输入 / 输出：</b>${esc(s.data)}</small><small><b>性能观测：</b>${esc(s.metric)}</small></div></div>`).join('')}</div><div class="viz-implementation-shape"><strong>关键 Shape / 计算示例</strong><p>${esc(v.sample[1])}</p><span>${esc(v.sample[2])}</span></div></section>`}
