/** Research-first pure numerical models. Synthetic examples; not production framework simulations. */
export const schedRequests=[
  {id:'A',arrival:0,promptPending:0,kind:'Decode'},
  {id:'B',arrival:0,promptPending:6,kind:'Prefill'},
  {id:'C',arrival:0,promptPending:4,kind:'Prefill'}
];
export function schedulerRounds(budget=8, count=3){
  if(!Number.isInteger(budget)||budget<3)throw Error('budget');
  const remaining={B:6,C:4};const rounds=[];
  for(let r=0;r<count;r++){
    const chosen=[];let left=budget;
    // Toy policy: A decode gets one; B, C are FCFS; completed prefill contributes one decode from next round.
    chosen.push({id:'A',kind:'Decode',n:1});left--;
    for(const id of ['B','C']){
      if(!left)break;
      const pending=remaining[id];
      const n=Math.min(pending>0?pending:1,left);
      if(n){chosen.push({id,kind:pending>0?'Prefill':'Decode',n});left-=n;if(pending>0)remaining[id]-=n;}
    }
    rounds.push({round:r+1,chosen,remaining:{...remaining},used:budget-left,free:left,budget});
  }
  return rounds;
}
export const moeScores=[
  [0.2,1.4,0.8],
  [0.9,0.1,1.1],
  [0.3,1.2,0.4],
  [1.3,0.8,0.6]
];
export const tokenGPU=[0,0,1,1];
export const expertGPU=[0,0,1];
export function moeRoutes(){
 const routes=moeScores.map((row,t)=>{
  const ids=[0,1,2].sort((a,b)=>row[b]-row[a]).slice(0,2);
  const z=ids.map(e=>Math.exp(row[e]-Math.max(...ids.map(i=>row[i]))));const d=z.reduce((a,b)=>a+b,0);
  return {t,src:tokenGPU[t],experts:ids,weights:z.map(v=>v/d),scores:row};
 });
 const buckets=[0,1,2].map(e=>({e,owner:expertGPU[e],tokens:routes.filter(r=>r.experts.includes(e)).map(r=>r.t)}));
 const transfers=routes.flatMap(r=>r.experts.filter(e=>expertGPU[e]!==r.src).map(e=>({t:r.t,from:r.src,to:expertGPU[e],e})));
 return {routes,buckets,transfers};
}
export function combineExample(token){
 const routes=moeRoutes().routes;const r=routes[token];if(!r)throw Error('token');
 // Scalar demo only: each expert's high-dimensional output projected to one example coordinate.
 const expertScalars=r.experts.map(e=>(token+1)*(e+2));
 const sum=expertScalars.reduce((a,v,i)=>a+v*r.weights[i],0);
 return {...r,expertScalars,sum};
}
export const flashScores=[1,2,3,0];
export const flashValues=[2,4,-1,5];
export function flashSteps(){
 let m=-Infinity,l=0,a=0;
 const steps=[{tile:0,m,l,a,out:null,scores:[],values:[]}];
 for(let i=0;i<flashScores.length;i+=2){
  const ss=flashScores.slice(i,i+2),vs=flashValues.slice(i,i+2);
  const mn=Math.max(m,...ss),alpha=m===-Infinity?0:Math.exp(m-mn);
  l=alpha*l+ss.reduce((s,x)=>s+Math.exp(x-mn),0);
  a=alpha*a+ss.reduce((s,x,j)=>s+Math.exp(x-mn)*vs[j],0);
  m=mn;
  steps.push({tile:i/2+1,m,l,a,out:a/l,scores:ss,values:vs,alpha});
 }
 return steps;
}
export function directAttention(){const m=Math.max(...flashScores);const e=flashScores.map(x=>Math.exp(x-m));const l=e.reduce((a,b)=>a+b,0);return e.reduce((a,x,i)=>a+x*flashValues[i],0)/l}
export function robotTimeline(asyncMode=true,latency=4,actionsPerChunk=6,trigger=4,horizon=24){
 let time=0,queue=0,inferEnd=latency,requestMade=true,chunksReady=0,consumed=0,waits=0;
 const inference=[],execution=[],sizes=[];
 for(time=0;time<horizon;time++){
  let inferenceActive=(inferEnd!==null&&time<inferEnd);
  if(inferEnd!==null&&time>=inferEnd){queue+=actionsPerChunk;chunksReady++;inferEnd=null;requestMade=false;inferenceActive=false;}
  const consume=queue>0;
  if(consume){queue--;consumed++;execution.push('act');}else{execution.push('wait');waits++;}
  // Trigger a new chunk only after playing enough and when no inference is active.
  if(inferEnd===null && chunksReady<4 && (asyncMode?queue<=trigger:queue===0)){
   inferEnd=time+1+latency;requestMade=true;
  }
  inference.push(inferenceActive?'infer':inferEnd!==null&&time+1<=inferEnd?'infer':'idle');
  sizes.push(queue);
 }
 return {inference,execution,sizes,waits,consumed,latency,actionsPerChunk,trigger,asyncMode};
}
export function validateResearchModels(){
 const rr=schedulerRounds();if(rr[0].used!==8||rr[0].chosen.map(x=>x.n).join(',')!=='1,6,1')throw Error('scheduler1');if(rr.some(x=>x.used>x.budget))throw Error('schedulerBudget');
 const m=moeRoutes();if(m.buckets.map(b=>b.tokens.length).join(',')!=='2,3,3'||m.routes.some(r=>Math.abs(r.weights.reduce((a,b)=>a+b,0)-1)>1e-10))throw Error('moe');
 const f=flashSteps();if(Math.abs(f.at(-1).out-directAttention())>1e-12)throw Error('flash');
 const sync=robotTimeline(false),async=robotTimeline(true);if(!(async.waits<sync.waits))throw Error('robot');
 return true;
}
