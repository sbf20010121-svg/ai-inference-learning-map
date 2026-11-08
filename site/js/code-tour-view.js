/**
 * L3 源码导读的轻量交互界面：伪代码中的每个阶段与可观测状态一一对应。
 * 按需显示、无外部运行时、无需网络。页面中的代码是原创教学伪代码。
 */
import {codeTourById,codeTours,validateCodeTours} from './code-tours.js';
const E=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette={model:'#8d65b7',engine:'#2b89a7',compiler:'#b28142',kernel:'#3b9b85',systems:'#6a86a9',microarch:'#b87962'};
const keywords=/\b(for|while|if|else|return|in|not|await|continue|True|False|None|range|assert)\b|(#.*)$/g;
const stylize=line=>{
  let out='',last=0;
  for(const m of line.matchAll(keywords)){
    out+=E(line.slice(last,m.index));
    out+=`<span class="ct-${m[2]?'comment':'keyword'}">${E(m[0])}</span>`;
    last=m.index+m[0].length;
  }
  return out+E(line.slice(last));
};
function phaseCode(t,active){let num=0;return t.phases.map((phase,i)=>{
 const lines=phase.code.map(line=>`<span class="ct-code-line"><span class="ct-line-no" aria-hidden="true">${String(++num).padStart(2,'0')}</span><span class="ct-line-text">${stylize(line)}</span></span>`).join('');
 return `<div class="ct-code-phase ${active===i?'is-active':''}" data-code-group="${i}"><button type="button" data-code-phase="${i}" aria-pressed="${active===i}" class="ct-code-caption"><span>${String(i+1).padStart(2,'0')}</span>${E(phase.title)}<small>${E(phase.owner)}</small></button><div class="ct-code-lines">${lines}</div></div>`;
 }).join('');}
function refs(t){const all=t.traces||[];return `<details class="ct-refs"><summary>核对真实项目：模块与源码入口（按当前版本检查）</summary><p>上述伪代码是机制导读，不代表下列项目里存在同名函数；不同版本和执行后端可能差异很大。</p><div>${all.map(x=>`<a href="${E(x[3])}" rel="noopener noreferrer" target="_blank"><b>${E(x[0])}</b><span>${E(x[1])}</span><small>${E(x[2])}</small></a>`).join('')}</div></details>`;}
export function renderCodeTour(t,activeIndex=0){const tour=codeTourById.get(t.id);if(!tour)return `<p>本节尚缺有证据的源码导读。</p>`;
 const ix=Math.max(0,Math.min(tour.phases.length-1,Number.isFinite(activeIndex)?activeIndex:0)),p=tour.phases[ix];
 return `<section id="codeTourRoot" class="code-tour" style="--ct-accent:${palette[t.module]||'#287e91'}" aria-label="${E(t.title)} 的源码分层导读">
 <div class="ct-head"><div><span class="ct-eyebrow">L3 · 源码与执行结构 · ${tour.phases.length} 段</span><h3>看一段代码，理解一次状态变化</h3><p>${E(tour.lead)}</p></div><span class="ct-not-runnable">可解释伪代码 · 非可运行源码</span></div>
 <div class="ct-example"><span>贯穿例子</span><p>${E(tour.example)}</p></div>
 <nav class="ct-phases" aria-label="选择源码执行阶段">${tour.phases.map((v,i)=>`<button type="button" data-code-phase="${i}" aria-pressed="${i===ix}" class="ct-phase ${i===ix?'is-active':''}"><small>${String(i+1).padStart(2,'0')} · ${E(v.owner)}</small><strong>${E(v.title)}</strong><span>${E(v.output)}</span></button>`).join('')}</nav>
 <div class="ct-main"><div class="ct-code-shell"><div class="ct-code-header"><strong>机制伪代码</strong><span>选阶段或点代码小节，右侧同步解释</span></div><div class="ct-code-scroller" role="group" aria-label="伪代码步骤">${phaseCode(tour,ix)}</div></div>
 <section class="ct-explain" aria-live="polite"><div class="ct-explain-top"><span>当前第 ${ix+1}/${tour.phases.length} 段</span><strong>${E(p.title)}</strong><small>${E(p.owner)}</small></div>
 <div class="ct-object-map"><div class="ct-object"><small>① 输入对象</small><strong>${E(p.input)}</strong></div><div class="ct-operation"><small>② 执行 / 状态变化</small><strong>${E(p.action)}</strong></div><div class="ct-object ct-output"><small>③ 输出对象</small><strong>${E(p.output)}</strong></div></div>
 <div class="ct-why"><small>为什么必须有这一段？</small><p>${E(p.reason)}</p></div>
 <div class="ct-buttons"><button type="button" data-code-phase="${ix-1}" ${ix===0?'disabled':''}>← 上段</button><button type="button" data-code-phase="${ix+1}" ${ix===tour.phases.length-1?'disabled':''}>下一段 →</button></div></section></div>
 <div class="ct-foot"><div class="ct-terms"><h4>代码符号就地解释</h4><dl>${tour.terms.map(([word,meaning])=>`<div><dt>${E(word)}</dt><dd>${E(meaning)}</dd></div>`).join('')}</dl></div><div class="ct-limit"><h4>抽象与实现的边界</h4><p>${E(tour.caveat)}</p><p>此页不包含公司内网资料，也不声称进行了 B200 实测或固定版本源码逐行审计。</p></div></div>
 ${refs(t)}
 </section>`;
}
export {codeTours,codeTourById,validateCodeTours};
