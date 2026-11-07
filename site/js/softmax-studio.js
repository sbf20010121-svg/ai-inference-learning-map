/** Illustrates the online Softmax invariant for ONE query row (not a full FA kernel). */
export const SCORES=[2,1,3,0.5];
export const VALUES=[5,9,2,11];
export function directSoftmax(scores=SCORES,values=VALUES){const m=Math.max(...scores),w=scores.map(s=>Math.exp(s-m)),z=w.reduce((a,b)=>a+b,0);return w.reduce((acc,v,i)=>acc+v*values[i],0)/z;}
export function onlineSoftmax(chunks=2,scores=SCORES,values=VALUES){
 if(scores.length!==values.length||scores.length%2)throw new Error('scores / value shapes invalid');
 let m=-Infinity,l=0,a=0; const snapshots=[{count:0,m,l,a,y:null,scale:null,read:[]}];
 for(let j=0;j<Math.min(chunks,scores.length/2);j++){
  const k=j*2,sm=Math.max(...scores.slice(k,k+2)),newM=Math.max(m,sm),scale=m===-Infinity?0:Math.exp(m-newM);
  const w=scores.slice(k,k+2).map(s=>Math.exp(s-newM));
  l=l*scale+w[0]+w[1];a=a*scale+w[0]*values[k]+w[1]*values[k+1];m=newM;
  snapshots.push({count:j+1,m,l,a,y:a/l,scale,read:scores.slice(0,(j+1)*2)});
 }
 return snapshots;
}
export function validateOnlineSoftmax(){const last=onlineSoftmax(2).at(-1),reference=directSoftmax();return Math.abs(last.y-reference)<1e-10;}
const nice=n=>n===null?'待计算':!Number.isFinite(n)?'—':n.toFixed(3);
export function renderSoftmaxStudio(step){const snapshot=onlineSoftmax(2)[Math.min(2,Math.max(0,step))];const completed=step>=2;
 const tiles=SCORES.map((s,i)=>`<div class="os-score ${i<snapshot.count*2?'read':''} ${(snapshot.count===1&&i<2)||(snapshot.count===2&&i>=2)?'just-read':''}"><span>列 K${i}</span><strong>${s}</strong><small>V=${VALUES[i]}</small></div>`).join('');
 return `<section class="os-explain"><div class="os-header"><div><span>一行 Query · 两组 K/V Tile</span><h3>在线 Softmax 为什么能逐块算出相同答案？</h3></div><p>每读入两个 score，不保存完整概率矩阵，而是更新该 Query 行的最大值 m、归一化分母 l 和加权和 a。</p></div><div class="os-tiles"><div class="os-query">Q₀</div>${tiles}</div><div class="os-tile-marker">${step===0?'等待读取第一个 K/V Tile':step===1?'正在读 K₀、K₁：先得到局部统计量':'正在读 K₂、K₃：发现新的更大分数，重缩放旧统计量'}</div><div class="os-registers"><div><small>m · 目前见过的最大分数</small><strong>${snapshot.count?nice(snapshot.m):'−∞'}</strong></div><div><small>l · 归一化权重之和</small><strong>${nice(snapshot.l)}</strong></div><div><small>a · 加权 V 之和</small><strong>${nice(snapshot.a)}</strong></div><div class="os-output"><small>输出 o = a / l</small><strong>${nice(snapshot.y)}</strong></div></div><div class="os-math">${step===0?'初始化 m = −∞、l = 0、a = 0；没有读任何 K/V。':step===1?'读入 [2, 1] 后，m=2，l=1+e⁻¹，a=5+9e⁻¹。':'新 Tile 的分数 [3, 0.5] 使 m 从 2 变 3。旧 l 和 a 都乘 e⁽²⁻³⁾，再加入新 Tile 的贡献。'}</div><div class="os-bottom"><div><span>直接对四个 score 做 Softmax 的参考答案</span><strong>${nice(directSoftmax())}</strong></div><div><span>在线算法结果</span><strong>${completed?nice(snapshot.y):'完成两块后可核对'}</strong></div></div>${completed?'<p class="os-match">✓ 两种方法数值一致（这里使用双精度 JavaScript 做教学计算）。这并不表示完整 FlashAttention 内核没有其它计算或 IO。</p>':'<p class="os-note">注意 m 改变时必须重缩放旧统计量；直接把两个 Tile 的局部 Softmax 输出平均是错误的。</p>'}<div class="os-controls"><button type="button" data-osstep="0" class="${step===0?'active':''}">初始化</button><button type="button" data-osstep="1" class="${step===1?'active':''}">处理 Tile 1</button><button type="button" data-osstep="2" class="${step===2?'active':''}">处理 Tile 2 并核对</button></div><small class="os-disclaimer">教学边界：只演示单行在线归一化与输出累加，不模拟完整 Q/K/V 分块 Kernel 的线程分配、共享内存和性能。</small></section>`;
}
