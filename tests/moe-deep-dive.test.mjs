import test from 'node:test';
import assert from 'node:assert/strict';
import {moeExample,routeToken,moeTrace,moeDeepDiveHTML,validateMoeExample} from '../site/js/moe-deep-dive.js';
test('MoE example: top-2 selection, normalized combine, expert loads and GPU transfers',()=>{
 assert.equal(validateMoeExample(),true);
 const t=moeExample.tokens[0],r=routeToken(t);
 assert.deepEqual(r.selected.map(x=>x.expert),[0,1]);
 assert.ok(Math.abs(r.selected[0].weight-0.73105858)<1e-6);
 const tr=moeTrace();assert.equal(tr.assignments.length,8);
 assert.deepEqual(tr.buckets.map(b=>b.tokens.length),[2,3,3]);
 assert.deepEqual(tr.gpuTransfers,[[3,1],[2,2]]);
});
test('MoE visual: explain router logits, All-to-All, grouped SwiGLU and combine',()=>{
 for(const stage of ['router','dispatch','compute','combine']){
  const html=moeDeepDiveHTML(2,stage);
  assert.match(html,/data-moe-token="2"/);
  assert.match(html,/图|MoE|专家/);
  assert.match(html,/data-moe-stage="compute"/);
  assert.match(html,/Megatron/);
 }
 assert.match(moeDeepDiveHTML(0,'router'),/0\.731/);
 assert.match(moeDeepDiveHTML(1,'dispatch'),/All-to-All/);
 assert.match(moeDeepDiveHTML(1,'compute'),/SiLU/);
 assert.match(moeDeepDiveHTML(1,'combine'),/示例输出分量/);
});
