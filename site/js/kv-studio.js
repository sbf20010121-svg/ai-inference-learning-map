/**
 * Paged KV Cache: an explorable *block mapping model*, not a profiler or precise
 * vLLM runtime. No external assets; all diagrams are derived from checked states.
 * Shared prefix assumes eligible identical fully filled blocks.
 */
export const KV_BLOCK_SIZE=4;
const PREFIX=['t0','t1','t2','t3'];
const A0=[...PREFIX,'a4','a5'],A1=[...A0,'a6'],B=[...PREFIX,'b4','b5'],C=['c0','c1','c2','c3'];
export const kvScenes=[
 {name:'A 开始生成',note:'A 的 6 个位置需要两个逻辑块；第 2 块只用了 2/4 个位置。物理块不必连续。',active:'A',block:1,requests:[{id:'A',tokens:A0,table:[3,7]}]},
 {name:'B 复用相同前缀',note:'B 与 A 的首个完整块相同（假设命中缓存的全部条件）；它的逻辑块 0 指向同一物理块 P3，新的后缀使用 P1。',active:'B',block:0,requests:[{id:'A',tokens:A0,table:[3,7]},{id:'B',tokens:B,table:[3,1]}]},
 {name:'A 再追加一个位置',note:'A 的末尾物理块 P7 尚未填满，因此下一个位置写入 P7；不必重新分配整个 KV Cache。',active:'A',block:1,requests:[{id:'A',tokens:A1,table:[3,7]},{id:'B',tokens:B,table:[3,1]}]},
 {name:'A 结束并释放',note:'P7 的引用消失，变为空闲；P3 仍然被 B 引用，不会因为 A 结束而立即回收。',active:'B',block:0,requests:[{id:'B',tokens:B,table:[3,1]}]},
 {name:'C 复用空闲的 P7',note:'新请求 C 的第一个逻辑块可以被分配到已回收的 P7。这里没有假设逻辑块与物理地址连续。',active:'C',block:0,requests:[{id:'B',tokens:B,table:[3,1]},{id:'C',tokens:C,table:[7]}]},
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reqColor={A:'#2277a5',B:'#c07c38',C:'#8662b4'};
export function physicalBlocks(scene){
 const physical=Array.from({length:8},(_,id)=>({id,tokens:[],owners:[],refs:0}));
 for(const r of scene.requests){for(let i=0;i<r.table.length;i++){
  const id=r.table[i],tokens=r.tokens.slice(i*KV_BLOCK_SIZE,(i+1)*KV_BLOCK_SIZE),p=physical[id];
  if(p.refs && JSON.stringify(p.tokens)!==JSON.stringify(tokens))throw new Error(`P${id} 内容冲突`);
  p.tokens=tokens;p.owners.push(r.id);p.refs++;
 }}
 return physical;
}
export function validateKVScenes(){
 for(const scene of kvScenes){const ids=new Set();for(const r of scene.requests){
  if(ids.has(r.id)||r.table.length!==Math.ceil(r.tokens.length/KV_BLOCK_SIZE))throw new Error('逻辑块数量不一致');ids.add(r.id);
  for(const id of r.table)if(!Number.isInteger(id)||id<0||id>7)throw new Error('物理块越界');
 }physicalBlocks(scene);if(!ids.has(scene.active))throw new Error('选中请求不存在');}
 return true;
}
const blockSymbols=(values)=>Array.from({length:KV_BLOCK_SIZE},(_,i)=>values[i]??'—');
export function getMapping(scene,reqId,index){
 const r=scene.requests.find(x=>x.id===reqId);if(!r||index<0||index>=r.table.length)return null;
 const physical=physicalBlocks(scene),p=physical[r.table[index]];
 return {request:r.id,logical:index,physical:p.id,tokens:r.tokens.slice(index*KV_BLOCK_SIZE,(index+1)*KV_BLOCK_SIZE),owners:p.owners,refs:p.refs,slots:p.tokens.length};
}
export const initialKVState=()=>({step:0,selected:'A:1',prediction:null});
export function advanceKV(state,delta){const step=Math.max(0,Math.min(kvScenes.length-1,state.step+delta)),scene=kvScenes[step];return {...state,step,selected:`${scene.active}:${scene.block}`}}
export function pickKV(state,ref){const [name,idx]=String(ref).split(':');const mapping=getMapping(kvScenes[state.step],name,Number(idx));return mapping?{...state,selected:ref}:state}
function texts(ids,sc){return ids.map(x=>`<text font-size="12" fill="${sc}" x="0">${esc(x)}</text>`).join('')}
function visualBlock(r,i,state,rowIndex){const x=34+i*164,y=rowIndex===0?148:326;
 const selected=state.selected===`${r.id}:${i}`;const pid=r.table[i],chunk=blockSymbols(r.tokens.slice(i*4,(i+1)*4));const stroke=selected?'#102d41':'#cdd9e0';
 return `<g data-kvselect="${r.id}:${i}" role="button" tabindex="0" aria-label="选择请求${r.id}的逻辑块${i}，映射P${pid}" class="kv-graphic-click" transform="translate(${x} ${y})">
 <rect width="150" height="76" rx="10" fill="${selected?'#dceff5':'#ffffff'}" stroke="${stroke}" stroke-width="${selected?2.5:1.2}"/>
 <text x="10" y="17" font-size="12" font-weight="700" fill="#35485b">${r.id} · 逻辑块 ${i}</text>
 ${chunk.map((s,j)=>`<rect x="${10+j*33}" y="26" width="29" height="28" rx="5" fill="${s==='—'?'#f0f2f4':reqColor[r.id]+'25'}" stroke="${s==='—'?'#d7e2e6':reqColor[r.id]}" opacity=".95"/><text x="${24.5+j*33}" y="44" text-anchor="middle" font-size="11" fill="#244153">${s}</text>`).join('')}
 <text x="75" y="68" font-size="10" fill="#546675" text-anchor="middle">${chunk.filter(x=>x!=='—').length}/4 槽位</text></g>`;
}
function tableRows(r,state,rowIndex){const y=rowIndex===0?135:313;return r.table.map((pid,i)=>{
 const sel=state.selected===`${r.id}:${i}`;return `<g data-kvselect="${r.id}:${i}" role="button" tabindex="0" class="kv-graphic-click" transform="translate(400 ${y+i*46})"><rect width="186" height="39" rx="7" fill="${sel?'#dceff5':'#fff'}" stroke="${sel?'#0a7387':'#d4dfe5'}" stroke-width="${sel?2:1}"/><text x="12" y="25" font-size="12" fill="#40556a">${r.id}[${i}]</text><text x="112" y="25" font-size="14" fill="#0c516a" font-weight="800">P${pid}</text><path d="M 76 19 H 102" stroke="#467d96" stroke-width="1.5" stroke-dasharray="4 3"/></g>`}).join('')}
function poolTile(block,state,map){const col=block.id%4,row=Math.floor(block.id/4),x=683+col*122,y=128+row*192;
 const selected=map?.physical===block.id,shared=block.refs>1,used=block.refs>0;
 const fill=shared?'#e4f1df':used?'#e8f2f6':'#f1f4f6';const stroke=selected?'#0e657c':shared?'#69a275':'#d5dfe4';
 return `<g transform="translate(${x} ${y})" class="kv-pool-block ${selected?'kv-pool-chosen':''}"><rect width="110" height="128" rx="11" fill="${fill}" stroke="${stroke}" stroke-width="${selected?3:1.2}"/><text x="10" y="20" fill="#2d4551" font-weight="800" font-size="14">P${block.id}</text><text x="101" y="19" fill="${shared?'#22764e':'#607689'}" font-size="11" text-anchor="end">${used?`×${block.refs}`:'空闲'}</text><line x1="8" y1="28" x2="102" y2="28" stroke="#ccd9dd"/>${blockSymbols(block.tokens).map((token,i)=>`<rect x="${8+i*24}" y="41" width="21" height="29" rx="4" fill="${token==='—'?'#fff':shared?'#cae6cd':'#c7dce7'}" stroke="#b9c9d1"/><text x="${18.5+i*24}" y="60" font-size="10.5" text-anchor="middle" fill="#29465a">${token}</text>`).join('')}<text x="8" y="91" font-size="10.5" fill="#536978">引用方 ${block.owners.join('+')||'—'}</text><text x="8" y="111" font-size="10.5" fill="#667b85">${block.tokens.length}/${KV_BLOCK_SIZE} 已使用</text></g>`;
}
export function renderKVFigure(state){validateKVScenes();const scene=kvScenes[state.step],blocks=physicalBlocks(scene),[selectedReq,selectedIdx]=state.selected.split(':'),map=getMapping(scene,selectedReq,Number(selectedIdx));
 const reqRow=scene.requests.findIndex(r=>r.id===selectedReq),mapY=reqRow>=0?(reqRow===0?135:313)+Number(selectedIdx)*46+19:155;
 const col=map?.physical%4??0,row=Math.floor((map?.physical??0)/4),endX=683+col*122,endY=128+row*192+61;
 const guideY=row===0?105:291;
 const targetX=endX+55,targetY=row===0?123:315;
 const connector=map?`<path d="M 591 ${mapY} H 647 V ${guideY} H ${targetX} V ${targetY}" stroke="#0e7790" stroke-width="3.1" fill="none" stroke-linejoin="round" marker-end="url(#kvArrow)"/><circle cx="591" cy="${mapY}" r="4" fill="#0e7790"/>`:'';
 return `<div class="kv-svg-scroll" tabindex="0" aria-label="可以横向滚动的逻辑块到物理块映射图"><svg viewBox="0 0 1200 555" role="img" aria-label="请求逻辑块经过块表映射到 GPU 物理块。当前高亮 ${esc(state.selected)}"><defs><marker id="kvArrow" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="8" refY="5" orient="auto"><path d="M 1 1 L 9 5 L 1 9" stroke="#0e7790" stroke-width="1.6" fill="none"/></marker></defs>
 <text x="34" y="56" font-size="19" font-weight="800" fill="#14384d">① 连续的逻辑 Token 位置</text><text x="399" y="56" font-size="19" font-weight="800" fill="#14384d">② Block Table</text><text x="685" y="56" font-size="19" font-weight="800" fill="#14384d">③ GPU 中分散的物理块</text>
 <text x="34" y="83" font-size="12" fill="#5a7583">按每 4 个位置组成一个逻辑块</text><text x="400" y="83" font-size="12" fill="#5a7583">逻辑编号 → 物理编号</text><text x="684" y="83" font-size="12" fill="#5a7583">物理块顺序不必与逻辑顺序一致</text>
 ${scene.requests.map((r,row)=>`<g><text x="34" y="${row===0?131:309}" font-size="13" fill="${reqColor[r.id]}" font-weight="800">请求 ${r.id}（${r.tokens.length} 个位置）</text>${r.table.map((_,i)=>visualBlock(r,i,state,row)).join('')}${tableRows(r,state,row)}</g>`).join('')}
 <line x1="622" y1="98" x2="622" y2="498" stroke="#d4e4e9" stroke-dasharray="6 5"/>
 ${blocks.map(b=>poolTile(b,state,map)).join('')}${connector}
 <text x="33" y="520" font-size="12" fill="#657a84">注：token 名称是位置标签，方框代表该位置对应的 KV 状态；实务中 KV 按层/头等维度组织，此处聚合显示。</text></svg></div>`;
}
function miniBlock(b,active){return `<div class="kv-mini-page ${active?'active':''} ${b.refs>1?'shared':''}"><strong>P${b.id}</strong><small>${b.refs?`引用 ${b.owners.join('+')}`:'空闲'}</small><div class="kv-mini-slots">${blockSymbols(b.tokens).map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`}
export function renderKVMobile(state){const scene=kvScenes[state.step],p=physicalBlocks(scene),[req,i]=state.selected.split(':'),mapping=getMapping(scene,req,Number(i));return `<div class="kv-mobile-figure"><div class="kv-mobile-req">${scene.requests.map(r=>`<div><b>请求 ${r.id}</b><div class="kv-mobile-blocks">${r.table.map((pid,i)=>`<button type="button" data-kvselect="${r.id}:${i}" class="${state.selected===`${r.id}:${i}`?'active':''}">逻辑块 ${i}<span>→ P${pid}</span></button>`).join('')}</div></div>`).join('')}</div><div class="kv-mobile-selected">当前映射：<b>${mapping?`${mapping.request}[${mapping.logical}] → P${mapping.physical}`:'—'}</b><span>引用 ${mapping?.owners.join('、')||'—'}</span></div><div class="kv-mobile-pool">${p.map(b=>miniBlock(b,mapping?.physical===b.id)).join('')}</div></div>`}
export function kvInspect(state){const scene=kvScenes[state.step],parts=state.selected.split(':'),m=getMapping(scene,parts[0],Number(parts[1]));if(!m)return null;return {step:state.step,name:scene.name,note:scene.note,...m};}
export function renderKVControls(state){const scene=kvScenes[state.step],d=kvInspect(state),p=physicalBlocks(scene);const used=p.filter(b=>b.refs>0).length,shared=p.filter(b=>b.refs>1).length;
 return `<div class="kv-story"><div class="kv-story-head"><span>实际映射变化 · ${state.step+1}/${kvScenes.length}</span><h3>${esc(scene.name)}</h3><p>${esc(scene.note)}</p></div><div class="kv-scene-tabs" role="group" aria-label="切换 KV 状态">${kvScenes.map((s,i)=>`<button type="button" data-kvstep="${i}" aria-pressed="${i===state.step}" class="${i===state.step?'active':''}">${i+1}<span>${esc(s.name)}</span></button>`).join('')}</div><div class="kv-stats"><div><small>物理块已使用</small><strong>${used} / 8</strong></div><div><small>被多请求引用的块</small><strong>${shared} 块</strong></div><div><small>正在观察的映射</small><strong>${d?`${d.request}[${d.logical}] → P${d.physical}`:'—'}</strong></div></div><div class="kv-control-buttons"><button type="button" data-kvprev ${state.step===0?'disabled':''}>上一步</button><button type="button" class="primary" data-kvnext ${state.step===kvScenes.length-1?'disabled':''}>${state.step===kvScenes.length-1?'已经看到最后':'观察下一次变化'}</button><button type="button" data-kvreset>从头重放</button></div></div>`;
}
export function renderKVInspect(state){const d=kvInspect(state);if(!d)return '';
 return `<div class="kv-inspect"><span>你选中的映射</span><strong>请求 ${d.request} · 逻辑块 ${d.logical} → 物理块 P${d.physical}</strong><p>本块记录 ${d.tokens.length}/${KV_BLOCK_SIZE} 个位置；物理块目前被 <b>${d.owners.join('、')}</b> 引用（引用数 ${d.refs}）。${d.refs>1?'这次是共享的完整前缀块，两个请求不需要各存一份。':'该块目前由单个请求持有。'}</p><small>点击左侧逻辑块或 Block Table 行，观察映射如何变化。不要把“逻辑编号”误解为物理内存地址。</small></div>`;
}
