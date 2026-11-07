import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthTopics,depthModules} from '../site/js/depth-content.js';
import {visualFor,validateVisualKnowledge,visualHTML,inlineImplementation} from '../site/js/visual-atlas.js';
import {lanes,validateLanes} from '../site/js/visual-lanes.js';
import {illustrated} from '../site/js/visual-knowledge.js';

test('六大模块不变，25个主流专题都具备直接可读的图解、例子和记忆卡',()=>{
 assert.deepEqual(depthModules.map(x=>x.id),['model','engine','compiler','kernel','systems','microarch']);
 assert.ok(depthTopics.length>=25);
 assert.equal(Object.keys(illustrated).length,depthTopics.length);
 assert.ok(validateVisualKnowledge(depthTopics));
 for(const t of depthTopics){
  const d=visualFor(t);
  assert.ok(d.key.length>=30,`${t.id}: no central explanation`);
  assert.ok(d.chain.length>=3&&d.chain.every(x=>x[1].length>=14));
  assert.equal(d.remember.length,3);
  assert.equal(d.compare.length,2);
  const html=visualHTML(t);
  for(const marker of ['系统位置','核心架构图','真实计算线索','设计取舍图','知识记忆卡'])assert.ok(html.includes(marker),`${t.id}: missing ${marker}`);
  assert.ok(html.includes('data-vpick="0"'));
  assert.ok(html.includes('可核对')||html.includes('教学示意'));
  assert.ok(inlineImplementation(t).includes('输入 / 输出'));
 }
});

test('跨模块的控制流/数据流泳道不虚构系统或内部微架构',()=>{
 assert.ok(validateLanes(depthTopics));
 assert.ok(Object.keys(lanes).length>=15);
 for(const [id,v] of Object.entries(lanes)){
  assert.equal(v.rows.length,2,id);
  assert.ok(v.note.length>=30,id);
  const text=v.rows.map(x=>x.join(' / ')).join(' ');
  assert.ok(!text.includes('100%加速'),id);
 }
 assert.match(lanes['pd-disagg'].rows[0].join(' '),/路由|Prefill|Decode/);
 assert.match(lanes['compiler-lowering'].rows[0].join(' '),/FX|Dynamo|Inductor/);
});

test('L3 解释要先出现在页面，资料链接只辅助核对；不破坏原有深度进度',()=>{
 const js=readFileSync(new URL('../site/js/depth.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(js,/visualHTML\(t\)/);
 assert.match(js,/inlineImplementation\(t\)/);
 assert.match(js,/handleVisualClick/);
 assert.match(js,/deep-reference-details/);
 assert.match(js,/ai-inference-depth-progress-v1/);
 assert.match(html,/\.\/visual\.css/);
 assert.match(html,/V1\.(6|7|8|9)/);
});
