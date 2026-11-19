/** Research-first pure numerical models. Synthetic examples; not production framework simulations. */
import { schedulerScenario, scheduleTrace } from "./scheduler-model.js";
export const schedRequests = schedulerScenario.requests.map((request) => ({
  id: request.id,
  arrival: 0,
  promptPending: Math.max(0, request.prompt - request.computed),
  kind: request.prompt > request.computed ? "Prefill" : "Decode",
}));
export function schedulerRounds(budget = 8, count = 3) {
  if (!Number.isInteger(budget) || budget < 3) throw Error("budget");
  // This older budget-only view assumes sufficient KV; the chapter model exposes that constraint.
  return scheduleTrace(budget, Infinity, count).map((round) => ({
    round: round.round,
    chosen: round.chosen.map(({ id, kind, n }) => ({ id, kind: kind === "prefill" ? "Prefill" : "Decode", n })),
    remaining: Object.fromEntries(round.requests.filter((request) => request.id !== "A").map((request) => [request.id, request.promptPending])),
    used: round.used,
    free: round.left,
    budget: round.budget,
  }));
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
