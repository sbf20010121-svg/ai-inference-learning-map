/**
 * 可逐项核对的教学数学模型（没有 GPU 依赖）。
 * 递推顺序与 FLA gated_delta_rule/fused_recurrent.py 的标量门控情形一致：
 *   M=gamma*Sprev; residual=v-k^T M; S=M+beta*k*residual^T; o=q^T S.
 * 本模块仅一头 d_k=d_v=2 的小例子，不冒充 GDN 全层实现。
 */
export const TOKENS = Object.freeze([
  {name:'t₁',k:[1,0],v:[2,1],q:[1,0]},
  {name:'t₂',k:[0,1],v:[0,3],q:[0,1]},
  {name:'t₃',k:[1,0],v:[4,0],q:[1,0]},
]);
export const zeros=()=>[[0,0],[0,0]];
export const add=(A,B)=>A.map((row,i)=>row.map((v,j)=>v+B[i][j]));
export const scale=(A,f)=>A.map(row=>row.map(v=>v*f));
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const matvec=(A,v)=>A.map(row=>dot(row,v));
export const rowvec=(v,A)=>[0,1].map(j=>v.reduce((s,x,i)=>s+x*A[i][j],0));
export const outer=(a,b)=>a.map(v=>b.map(x=>v*x));
export const mul=(A,B)=>A.map(row=>[0,1].map(j=>row.reduce((s,a,k)=>s+a*B[k][j],0)));
export const ident=()=>[[1,0],[0,1]];
export function recurrence(beta=0.5,gamma=1,mode='delta'){
  if(![0.5,1].includes(beta)||![0.8,1].includes(gamma)||!['delta','additive'].includes(mode))throw Error('invalid teaching setup');
  let S=zeros();
  return [{index:0,title:'S₀ · 初始空状态',S:zeros(),before:zeros(),pred:[0,0],residual:[0,0],write:zeros(),out:[0,0],token:null},...TOKENS.map((t,i)=>{
    const previous=S;
    const before=scale(previous,gamma);
    const pred=rowvec(t.k,before);
    const residual=mode==='delta'?t.v.map((v,j)=>v-pred[j]):t.v.slice();
    const write=scale(outer(t.k,residual),beta);
    S=add(before,write);
    return {index:i+1,title:t.name,S,before,previous,pred,residual,write,out:rowvec(t.q,S),token:t};
  })];
}
/** 每个 token 是仿射状态映射 S' = A*S + B，两个映射可结合。 */
export function affineToken(t,beta=0.5,gamma=1){
  const A=scale(add(ident(),scale(outer(t.k,t.k),-beta)),gamma);
  const B=scale(outer(t.k,t.v),beta);
  return {A,B};
}
export function compose(second,first){return {A:mul(second.A,first.A),B:add(mul(second.A,first.B),second.B)}};
export function applyAffine(map,S){return add(mul(map.A,S),map.B)};
export function chunkEquivalence(beta=0.5,gamma=1){
  const a=affineToken(TOKENS[0],beta,gamma);
  const b=affineToken(TOKENS[1],beta,gamma);
  const compound=compose(b,a);
  const byChunk=applyAffine(compound,zeros());
  const byRecurrence=recurrence(beta,gamma)[2].S;
  return {a,b,compound,byChunk,byRecurrence,maxError:Math.max(...byChunk.flat().map((v,i)=>Math.abs(v-byRecurrence.flat()[i])))};
}
export const VECTOR_X=Array.from({length:10},(_,i)=>i+1);
export const VECTOR_Y=Array.from({length:10},(_,i)=>10-i);
export function compilerLayout(block=8){
 if(![4,8].includes(block))throw Error('BLOCK must be 4 or 8 for the lesson');
 const n=VECTOR_X.length;
 const count=Math.ceil(n/block);
 const programs=Array.from({length:count},(_,pid)=>({
   pid,offsets:Array.from({length:block},(_,j)=>pid*block+j),
   masks:Array.from({length:block},(_,j)=>pid*block+j<n),
   values:Array.from({length:block},(_,j)=>pid*block+j<n?VECTOR_X[pid*block+j]+VECTOR_Y[pid*block+j]:null)
 }));
 return {n,block,count,programs,output:VECTOR_X.map((x,i)=>x+VECTOR_Y[i]),
   active:programs.reduce((n,p)=>n+p.masks.filter(Boolean).length,0),
   masked:programs.reduce((n,p)=>n+p.masks.filter(x=>!x).length,0)};
}
