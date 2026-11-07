import test from 'node:test';
import assert from 'node:assert/strict';
import {curatedNodes,curatedRelations,validateCuratedRelations,fullGraph,relatedGraph,cleanUserGraph,addUserInsight,addUserLink,removeInsight,setInsightStatus} from '../site/js/semantic-graph.js';

test('all semantic edges connect real topics and explain specific dependencies',()=>{
 assert.equal(validateCuratedRelations(),true);
 assert.ok(curatedNodes.length>=25);assert.ok(curatedRelations.length>=20);
 for(const e of curatedRelations){assert.ok(e.why.length>=17,`${e.id} needs mechanism explanation`);assert.notEqual(e.from,e.to);}
 assert.equal(relatedGraph(fullGraph({}), 'kv-cache').incoming.length>=1,true);
});
test('personal insight becomes a connected typed graph node, persists and can be removed',()=>{
 const {graph,id}=addUserInsight({nodes:[],edges:[]},{title:'我理解的块映射',summary:'逻辑块表保存物理块 ID，因此逻辑连续与物理连续不等价。',anchor:'kv-cache',relation:'extends',why:'块表中的条目把逻辑块和物理块连接起来。',module:'engine',source:'https://docs.vllm.ai/en/latest/design/paged_attention/'});
 assert.equal(graph.nodes.length,1);assert.equal(graph.edges.length,1);
 assert.equal(graph.edges[0].from,'kv-cache');assert.equal(graph.edges[0].to,id);
 let updated=setInsightStatus(graph,id,'verified');assert.equal(updated.nodes[0].status,'verified');
 updated=addUserLink(updated,{from:id,to:'memory-route',type:'implements',why:'在内存层的实际映射说明逻辑顺序不等于物理顺序。'});
 assert.equal(updated.edges.length,2);
 const roundTrip=cleanUserGraph(JSON.parse(JSON.stringify(updated)));assert.deepEqual(roundTrip,updated);
 const gone=removeInsight(updated,id);assert.equal(gone.nodes.length,0);assert.equal(gone.edges.length,0);
});
test('sanitize malicious/stale input and reject edges that forge curated relations',()=>{
 const v=cleanUserGraph({nodes:[{id:'mine-a',title:'Test',summary:'说明',source:'javascript:alert(1)'}],edges:[{id:'mine-b',from:'kv-cache',to:'pd-disagg',type:'produces',why:'试图替换官方知识连接'}]});
 assert.equal(v.nodes.length,0);assert.equal(v.edges.length,0);
 assert.throws(()=>addUserInsight({}, {title:'test',summary:'x',anchor:'wrong',relation:'extends',why:'test'}));
});
