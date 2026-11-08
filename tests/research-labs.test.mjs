import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOKENS,recurrence,chunkEquivalence,affineToken,compose,applyAffine,compilerLayout,zeros} from '../site/js/research-models.js';
const approx=(a,b)=>Math.abs(a-b)<1e-12;
const closeMat=(A,B)=>A.every((row,i)=>row.every((v,j)=>approx(v,B[i][j])));

test('Delta 对同 Key 新值可更新旧记忆，而不是盲目累加',()=>{
 const delta=recurrence(1,1,'delta');
 const additive=recurrence(1,1,'additive');
 assert.deepEqual(delta[1].S,[[2,1],[0,0]]);
 assert.deepEqual(delta[3].S,[[4,0],[0,3]]);
 assert.deepEqual(additive[3].S,[[6,1],[0,3]]);
});
test('门控/β 四个组合的状态与两 Token 仿射组合严格一致',()=>{
 for(const gamma of [1,.8])for(const beta of [.5,1]){
  const seq=recurrence(beta,gamma);const chunk=chunkEquivalence(beta,gamma);
  assert.ok(closeMat(seq[2].S,chunk.byChunk));
  assert.ok(chunk.maxError<1e-12);
  const step1=affineToken(TOKENS[0],beta,gamma),step2=affineToken(TOKENS[1],beta,gamma);
  assert.ok(closeMat(applyAffine(compose(step2,step1),zeros()),seq[2].S));
 }
});
test('循环状态行为有可核对数值',()=>{
 const s=recurrence(.5,1);
 assert.ok(closeMat(s[3].S,[[2.5,.25],[0,1.5]]));
 const gated=recurrence(.5,.8);
 assert.ok(closeMat(gated[3].S,[[2.32,.16],[0,1.2]]));
 assert.deepEqual(s[3].pred,[1,.5]);
});
test('Triton Program grid 与尾块 Mask 不允许越界，全部输出正确',()=>{
 const a=compilerLayout(8),b=compilerLayout(4);
 assert.equal(a.count,2);assert.equal(b.count,3);
 assert.deepEqual(a.programs[1].masks,[true,true,false,false,false,false,false,false]);
 assert.deepEqual(b.programs[2].masks,[true,true,false,false]);
 assert.equal(a.active,10);assert.equal(b.active,10);
 assert.equal(a.masked,6);assert.equal(b.masked,2);
 assert.deepEqual(a.output,Array(10).fill(11));
 assert.deepEqual(b.output,a.output);
 assert.ok(a.programs.every(p=>p.offsets.every((offset,j)=>p.masks[j]===(offset<10))));
});
test('网页两条研究样板与源码证据入口已就位',()=>{
 const html=readFileSync(new URL('../site/research-labs.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../site/js/research-labs.js',import.meta.url),'utf8');
 for(const k of ['linear:process','linear:derive','linear:source','linear:diagnose','compiler:process','compiler:derive','compiler:source','compiler:diagnose'])assert.ok(html.includes(k),k);
 assert.match(html,/math display="block"/);
 assert.match(html,/fla\/ops\/gated_delta_rule\/fused_recurrent\.py/);
 assert.match(html,/python\/tutorials\/01-vector-add\.py/);
 assert.match(js,/data-linear-stage/);
 assert.match(js,/data-ir/);
 assert.match(html,/不是.*GPU.*实测|没有.*B200/s);
});
