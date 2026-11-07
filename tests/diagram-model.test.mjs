import test from 'node:test';
import assert from 'node:assert/strict';
import {kvScenes,validateKVScenes,physicalBlocks,getMapping,initialKVState,advanceKV,pickKV,renderKVFigure,renderKVMobile} from '../site/js/kv-studio.js';
import {SCORES,VALUES,onlineSoftmax,directSoftmax,validateOnlineSoftmax,renderSoftmaxStudio} from '../site/js/softmax-studio.js';
test('KV scenes preserve logical-to-physical contents and reference counts',()=>{
 assert.equal(validateKVScenes(),true);
 assert.equal(kvScenes.length,5);
 const s0=physicalBlocks(kvScenes[0]);assert.equal(s0.filter(x=>x.refs).length,2);
 const s1=physicalBlocks(kvScenes[1]);assert.equal(s1[3].refs,2);assert.equal(s1.filter(x=>x.refs).length,3);
 assert.equal(getMapping(kvScenes[1],'B',0).physical,3);
 assert.equal(getMapping(kvScenes[1],'A',0).physical,3);
 const s2=physicalBlocks(kvScenes[2]);assert.equal(s2[7].tokens.length,3);
 const s3=physicalBlocks(kvScenes[3]);assert.equal(s3[7].refs,0);assert.equal(s3[3].refs,1);
 const s4=physicalBlocks(kvScenes[4]);assert.equal(s4[7].owners.join(''), 'C');
});
test('KV scene selection/focus supports stage changes and is rendered as actual tokens/blocks',()=>{
 let state=initialKVState();state=advanceKV(state,1);state=pickKV(state,'B:0');assert.equal(state.selected,'B:0');
 assert.match(renderKVFigure(state),/Block Table/);assert.match(renderKVFigure(state),/P3/);
 assert.match(renderKVMobile(state),/逻辑块 0/);
});
test('streaming online softmax matches direct weighted result; max increases in second tile',()=>{
 assert.equal(validateOnlineSoftmax(),true);
 const s=onlineSoftmax(2);assert.equal(s[1].m,2);assert.equal(s[2].m,3);
 assert.ok(Math.abs(s[2].y-directSoftmax())<1e-12);
 assert.ok(s[2].scale>0&&s[2].scale<1);
 assert.match(renderSoftmaxStudio(2),/数值一致/);
});
