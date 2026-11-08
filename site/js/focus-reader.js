/**
 * V1.7 专注阅读：一屏一个问题、明确浏览进度、与深度课程共用知识数据。
 * This module owns presentation only. Progress is controlled by depth.js.
 */
import {featuredMechanisms,mechanismFigure} from './mechanism-studio.js';
import {visualFor} from './visual-atlas.js';
import {depthModules,depthTopics,depthById} from './depth-content.js';
import {focusScene} from './focus-scenes.js';
import {studioOptions} from './mechanism-gallery.js';
import {moeDeepDiveHTML} from './moe-deep-dive.js';
import {hasDerivation,renderInContext,renderWorkedDerivation} from './mechanism-derivations.js';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FOCUS_PAGES=[
 {label:'先看懂',hint:'它是什么'},
 {label:'运行机制',hint:'一步步怎么做'},
 {label:'具体例子',hint:'数据怎样变化'},
 {label:'自己判断',hint:'能否举一反三'},
 {label:'记住重点',hint:'巩固与下一步'},
 {label:'源码追踪',hint:'可选深入'},
 {label:'性能验证',hint:'可选深入'}
];
const has=(id)=>Object.hasOwn(featuredMechanisms,id);
const stages=t=>has(t.id)?featuredMechanisms[t.id].steps:t.stage;
const points=t=>has(t.id)?featuredMechanisms[t.id].recall:visualFor(t).remember;
const pageGroup=n=>n<5?'核心学习':n===5?'实现与源码':'性能与实验';
export function normalizeReaderRecord(raw={},size=7){
 const last=Number.isInteger(raw.readerStep)?raw.readerStep:0;
 const visited=Array.isArray(raw.seenSteps)?raw.seenSteps.filter(n=>Number.isInteger(n)&&n>=0&&n<size):[];
 const visitedSubsteps=Array.isArray(raw.seenSubsteps)?raw.seenSubsteps.filter(n=>Number.isInteger(n)&&n>=0&&n<12):[];
 return {readerStep:Math.max(0,Math.min(size-1,last)),readerSubstep:Math.max(0,Math.min(11,Number.isInteger(raw.readerSubstep)?raw.readerSubstep:0)),seenSteps:[...new Set(visited)],seenSubsteps:[...new Set(visitedSubsteps)]};
}
export const getReaderCounts=(r,stageCount=1)=>({core:(r.seenSteps||[]).filter(n=>n>=0&&n<5&& (n!==1||(r.seenSubsteps||[]).length>=stageCount)).length,advanced:(r.seenSteps||[]).filter(n=>n>=5&&n<7).length});
const crumb=t=>`${depthModules.find(m=>m.id===t.module)?.name||''} / ${t.title}`;
function compactChart(t,idx=0){const stagesArr=stages(t);const i=Math.min(Math.max(idx,0),stagesArr.length-1);
 return `<div class="focus-mini-chart" aria-label="当前机制流程示意">${stagesArr.map((s,k)=>`<div class="focus-mini-step ${k===i?'is-active':''}"><span>${k+1}</span><strong>${esc(s.title)}</strong></div>${k<stagesArr.length-1?'<span class="focus-mini-arrow" aria-hidden="true">→</span>':''}`).join('')}</div>`;
}
function getStage(t,idx=0){const s=stages(t)[Math.min(idx,stages(t).length-1)];return has(t.id)?{title:s.title,data:s.in,mechanism:s.do,metric:s.out,trap:s.trap,why:s.why}:s;}
function scopeDiagram(t){const s=stages(t),first=getStage(t,0),last=getStage(t,s.length-1);
 const start=has(t.id)?first.data:first.data;
 const finish=has(t.id)?(featuredMechanisms[t.id].boundary.split('输出：')[1]||last.metric):last.data;
 return `<div class="focus-boundary-graph" aria-label="输入经过当前机制到输出"><div><small>输入是什么</small><strong>${esc(start)}</strong></div><span aria-hidden="true">→</span><div class="focus-boundary-active"><small>本课机制</small><strong>${esc(has(t.id)?featuredMechanisms[t.id].label:t.title)}</strong></div><span aria-hidden="true">→</span><div><small>得到什么</small><strong>${esc(finish)}</strong></div></div>`;
}
function overview(t){const doc=has(t.id)?featuredMechanisms[t.id]:null;
 return `<div class="focus-content"><div class="focus-question">先回答：这项技术究竟做什么？</div><p class="focus-definition">${esc(doc?.definition||t.summary)}</p>${hasDerivation(t.id)?renderInContext(t.id):`${scopeDiagram(t)}<div class="focus-short-explainer"><div><small>它处理的对象</small><p>${esc(doc?.boundary||t.stage[0].data)}</p></div><div><small>你要带走的认识</small><p>${esc(t.question)}</p></div></div>`}<p class="focus-caution">先记住机制本身。下一步再看每个环节如何运行，不急着背术语或看外链。</p></div>`;
}
function mechanism(t,step=0,variant=0){const s=getStage(t,step),doc=featuredMechanisms[t.id],arr=stages(t);return `<div class="focus-content"><div class="focus-question">${esc(s.title)}：这一步发生了什么？</div><div class="focus-substeps" role="group" aria-label="机制步骤">${arr.map((v,i)=>`<button type="button" data-f-sub="${i}" class="${i===step?'active':''}" aria-pressed="${i===step}">${String(i+1).padStart(2,'0')} ${esc(v.title)}</button>`).join('')}</div>${doc?`${focusScene(t.id,step)}<details id="focusFullDiagram" class="focus-expand focus-full-diagram"><summary>展开完整机制图与另一种视角（可选）</summary><div class="focus-view-toggle">${doc.variants.map((label,i)=>`<button type="button" data-f-variant="${i}" class="${variant===i?'active':''}" aria-pressed="${variant===i}">${esc(label)}</button>`).join('')}</div><div class="focus-figure">${mechanismFigure(t.id,step,variant)}</div></details>`:compactChart(t,step)}<p class="focus-main-explanation">${esc(s.mechanism)}</p><div class="focus-io"><div><small>输入</small><p>${esc(s.data)}</p></div><div><small>输出 / 观测</small><p>${esc(s.metric)}</p></div></div><details class="focus-expand"><summary>为什么这样做？有哪些误区？</summary><p>${esc(s.why||t.insights[0])}</p><p><strong>容易误解：</strong>${esc(s.trap)}</p></details><span class="focus-disclaimer">图为机制教学示意，细节及资源限制取决于具体硬件与软件版本。</span></div>`}
function example(t,moeToken=0,moeStage='router'){
 if(hasDerivation(t.id))return `<div class="focus-content"><div class="focus-question">这个机制的公式从哪来？用真实数值走一遍。</div>${t.id==='moe-route'?moeDeepDiveHTML(moeToken,moeStage):''}${renderWorkedDerivation(t.id)}<p class="focus-quiet">先对照图与公式，用自己的话从输入推到结果；如果不理解变量，返回本页的变量表，不必跳去外链。</p></div>`;
 const data=visualFor(t),ex=data.sample;
 const specific=has(t.id)?focusScene(t.id,Math.min(2,stages(t).length-1)):compactChart(t,Math.min(1,t.stage.length-1));
 return `<div class="focus-content"><div class="focus-question">换成具体数字或张量，会是什么样？</div><div class="focus-case"><span>一个例子 · ${esc(ex[0])}</span><p>${esc(ex[1])}</p></div>${specific}<div class="focus-counterexample"><small>别因此得出错误结论</small><p>${esc(ex[2])}</p></div><p class="focus-quiet">本专题目前只有导览示例，完整公式推导与执行状态图仍需补足；不应将它视为已完成的深度课程。</p></div>`;
}
function checkpoint(t,choice){const q=has(t.id)?featuredMechanisms[t.id].check:{q:t.quiz[0],options:t.quiz[1],correct:t.quiz[2],why:t.quiz[3]};const answered=choice!==null&&choice!==undefined;
 return `<div class="focus-content"><div class="focus-question">如果换个条件，你会怎么判断？</div><h3 class="focus-check-title">${esc(q.q)}</h3><div class="focus-answers">${q.options.map((x,i)=>`<button type="button" data-f-answer="${i}" class="${answered?(i===q.correct?'correct':i===choice?'wrong':''):''}" aria-pressed="${choice===i}"><span>${String.fromCharCode(65+i)}</span>${esc(x)}</button>`).join('')}</div>${answered?`<div class="focus-check-feedback"><strong>${choice===q.correct?'这一步判断正确。':'还需重新理解这个机制。'}</strong><p>${esc(q.why)}</p><button type="button" data-f-retry>重新判断</button></div>`:`<p class="focus-quiet">先自己选择，再看原因。做对一道题不等于已经具备真实工程能力。</p>`}</div>`;
}
function recall(t,rec,counts){return `<div class="focus-content"><div class="focus-question">离开这节课之前，只保留三条主线</div><ol class="focus-recall">${points(t).map((x,i)=>`<li><span>${i+1}</span><p>${esc(x)}</p></li>`).join('')}</ol><div class="focus-mark"><div><strong>你的学习状态：${esc(rec.status==='known'?'自评已掌握':rec.status==='review'?'待复习':'学习中')}</strong><small>已浏览核心 ${counts.core}/5 步。浏览和做题不会自动标为“掌握”。</small></div><div><button type="button" data-f-mark="known" class="${rec.status==='known'?'selected':''}">我能复述，标记已掌握</button><button type="button" data-f-mark="review" class="${rec.status==='review'?'selected':''}">还有疑问，待复习</button></div></div><details class="focus-expand focus-notes"><summary>记录还没弄懂的地方</summary><textarea maxlength="2500" id="focusNote" placeholder="写下一个仍需验证的问题……">${esc(rec.note||'')}</textarea></details><p class="focus-quiet">有余力再进入「源码追踪」和「性能验证」；核心课学完后，不必被迫继续翻很多层页面。</p></div>`}
function sources(t,idx=0){const i=Math.max(0,Math.min(t.traces.length-1,idx)),tr=t.traces[i],s=t.stage[Math.min(i,t.stage.length-1)];return `<div class="focus-content"><div class="focus-question">真正读源码时，先追踪哪一步？</div><div class="focus-source-tabs">${t.traces.map((x,j)=>`<button type="button" data-f-source="${j}" class="${i===j?'active':''}">${String(j+1).padStart(2,'0')} ${esc(x[0])}</button>`).join('')}</div><div class="focus-case"><span>实现位置 / 分层对象</span><h3>${esc(tr[1])}</h3><p>${esc(tr[2])}</p></div><div class="focus-io"><div><small>与机制的联系</small><p>${esc(s.mechanism)}</p></div><div><small>重点观测</small><p>${esc(s.metric)}</p></div></div><details class="focus-expand"><summary>可选：官方源码或技术资料</summary><a href="${esc(tr[3])}" target="_blank" rel="noopener noreferrer">${esc(tr[0])} · 打开核对 ↗</a><p>需要结合实际使用的版本确认路径与函数；这里是学习导读，不是完整源码审计。</p></details></div>`}
function lab(t){const x=t.experiment;return `<div class="focus-content"><div class="focus-question">如果要验证这个瓶颈，你会怎样设计实验？</div><div class="focus-case"><span>研究问题</span><p>${esc(x.goal)}</p></div><div class="focus-io"><div><small>只改变什么</small><p>${esc(x.controls)}</p></div><div><small>观察什么指标</small><p>${esc(x.metrics)}</p></div></div><div class="focus-counterexample"><small>必须排除的误判</small><p>${esc(x.validation)}</p></div><p class="focus-quiet">这是实验设计，不是已经跑出的 Benchmark。真实结论必须来自正确性检查、可重复测量和性能证据。</p></div>`}
function catalogStatus(t,record){const r=record||{},n=getReaderCounts(r,stages(t).length).core;return r.status==='known'?'自评已掌握':n===5?'核心已浏览 5/5':n>0?`已看 ${n}/5`:'未开始'}
function catalog(current,records){return `<details class="focus-catalog" id="focusCatalog"><summary>切换专题 <span>· 六大领域 / ${depthTopics.length} 节</span></summary><div class="focus-catalog-body">${depthModules.map(m=>`<section><strong>${esc(m.name)}</strong><div>${depthTopics.filter(t=>t.module===m.id).map(t=>`<button type="button" data-dtopic="${t.id}" class="${t.id===current?'active':''}">${esc(t.title)}<small>${esc(catalogStatus(t,records[t.id]))}</small></button>`).join('')}</div></section>`).join('')}</div></details>`}
export function renderFocusReader(t,rec,settings){const pg=settings.readerStep??0,sub=settings.substep??0,variant=settings.variant??0,sourceIndex=settings.sourceIndex??0,answer=settings.answer??null,counts=getReaderCounts(rec,stages(t).length);
 const seen=new Set(rec.seenSteps||[]);const isAdvanced=pg>=5;
 const phase=pg===0?overview(t):pg===1?mechanism(t,sub,variant):pg===2?example(t,settings.moeToken,settings.moeStage):pg===3?checkpoint(t,answer):pg===4?recall(t,rec,counts):pg===5?sources(t,sourceIndex):lab(t);
 const num=pg<5?pg+1:pg===5?1:2;
 const mechanismProgress=(rec.seenSubsteps||[]).length;
 return `<div class="focus-reader" id="focusReader"><div class="focus-utility"><button type="button" data-dmap>← 知识地图</button>${catalog(t.id,settings.records||{})}<button type="button" data-f-reference>完整资料 ↗</button></div><header class="focus-header"><div class="focus-header-top"><span>${esc(crumb(t))}</span><span class="focus-status-tag">${esc(rec.status==='known'?'自评已掌握':rec.status==='review'?'待复习':'学习中')}</span></div><h1>${esc(t.title)}</h1><p>本节只聚焦：${esc(t.question)}</p><div class="focus-progress-summary"><span>核心内容已浏览 <b>${counts.core}/5</b>${mechanismProgress?` · 机制 ${Math.min(mechanismProgress,stages(t).length)}/${stages(t).length}`:''}</span><span>当前：${esc(pageGroup(pg))} · ${num}/${pg<5?5:2}</span></div><div class="focus-progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${counts.core}"><div style="width:${counts.core/5*100}%"></div></div></header><nav class="focus-step-nav" aria-label="本节学习步骤">${FOCUS_PAGES.map((p,i)=>`<button type="button" data-f-page="${i}" class="${pg===i?'current':''} ${seen.has(i)?'seen':''}" aria-current="${pg===i?'step':'false'}"><small>${seen.has(i)&&(i!==1||mechanismProgress>=stages(t).length)?'✓':String(i+1).padStart(2,'0')}</small><span>${esc(p.label)}</span></button>`).join('')}</nav><main class="focus-panel" id="focusPanel"><div class="focus-panel-heading"><span>${esc(pageGroup(pg))} · ${String(pg+1).padStart(2,'0')}</span><strong>${esc(FOCUS_PAGES[pg].hint)}</strong></div>${phase}</main><footer class="focus-footer"><button type="button" data-f-prev ${pg===0&&sub===0?'disabled':''}>← 上一步</button><span>${pg<5?'一步一屏，随时可以离开并继续':'进阶部分可跳过'}</span><button type="button" data-f-next>${pg===4?'进入源码（可选）':pg===6?'回到课程核心':pg===1&&sub<stages(t).length-1?'看下一环节 →':'继续 →'}</button></footer><section class="focus-related"><span>还想串联哪些知识？</span>${studioOptions.filter(opt=>opt.topic===t.id).map(opt=>`<button type="button" data-open-studio="${esc(opt.id)}">进入「${esc(opt.title)}」动态图解 →</button>`).join('')}<button type="button" data-knowledge-topic="${esc(t.id)}">在知识网络中查看关系 / 记录我的理解</button>${t.related.slice(0,2).map(id=>`<button type="button" data-dtopic="${id}">${esc(depthById.get(id)?.title||id)} →</button>`).join('')}</section><p class="focus-storage-hint">✓ 表示你已浏览过该部分，不代表已掌握。进度保存在当前浏览器，可从顶部「导出进度」备份。</p></div>`;
}
