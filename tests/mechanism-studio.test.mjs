import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthTopics} from '../site/js/depth-content.js';
import {featuredMechanisms,featuredMechanismIds,mechanismStudioHTML,validateMechanismStudio,flashStats,pedagogicalWarpCycles,slotCells} from '../site/js/mechanism-studio.js';
import {visualHTML} from '../site/js/visual-atlas.js';

const find=id=>depthTopics.find(t=>t.id===id);
test('五项重点机制覆盖对应原节点，定义先于价值且具备可用的多图交互',()=>{
 assert.deepEqual(featuredMechanismIds,['pd-disagg','vllm-scheduler','compiler-lowering','attention-tiling','warp-issue']);
 assert.equal(validateMechanismStudio(),true);
 for(const id of featuredMechanismIds){
  assert.ok(find(id),`topic ${id} not in existing map`);
  const d=featuredMechanisms[id];
  assert.ok(d.definition.length>50&&d.boundary.length>25);
  assert.ok(d.steps.length>=4&&d.steps.length<=6);
  const html=mechanismStudioHTML(find(id));
  for(const x of ['data-m16-step="0"','data-m16-variant="0"','data-m16-variant="1"','data-m16-answer="1"','当前环节的输入','为什么要这样做','容易误解','离开前复述'])assert.ok(html.includes(x),`${id}: ${x}`);
  assert.ok(visualHTML(find(id)).includes('m16-studio'),`${id}: not integrated into visual atlas`);
 }
});
test('其他专题不被强行添加新的机制示意、进度不迁移',()=>{
 assert.equal(mechanismStudioHTML(find('kv-cache')),'');
 const js=readFileSync(new URL('../site/js/depth.js',import.meta.url),'utf8');
 assert.match(js,/handleMechanismStudioClick/);
 assert.match(js,/ai-inference-depth-progress-v1/);
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(html,/mechanism-studio\.css/);
 assert.match(html,/V1\.(6|7|8|9)|V2\.[01]/);
});
test('FlashAttention 两个 Tile 在线 softmax 数值等于全局 softmax',()=>{
 const s=flashStats();
 assert.ok(Math.abs(s.first.l-(1+Math.exp(-1)))<1e-12);
 assert.ok(Math.abs(s.second.l-(Math.exp(-1)*s.first.l+1+Math.exp(-3)))<1e-12);
 assert.ok(Math.abs(s.second.out-s.ref)<1e-12);
 assert.ok(s.second.out>2&&s.second.out<3);
});
test('Token Budget 教学示例均恰好为八个 Token',()=>{
 const counts=round=>[...slotCells(round).matchAll(/class="m16-slot m16-([abc])"/g)].map(x=>x[1]);
 const r1=counts(1),r2=counts(2);
 assert.deepEqual([r1.length,r1.filter(x=>x==='a').length,r1.filter(x=>x==='b').length,r1.filter(x=>x==='c').length],[8,1,7,0]);
 assert.deepEqual([r2.length,r2.filter(x=>x==='a').length,r2.filter(x=>x==='b').length,r2.filter(x=>x==='c').length],[8,1,3,4]);
});
test('Warp 发射教学轨迹标注了 Issue 空泡和依赖恢复，不能冒充 B200 周期模型',()=>{
 assert.equal(pedagogicalWarpCycles.length,8);
 assert.equal(pedagogicalWarpCycles[6].kind,'idle');
 assert.match(pedagogicalWarpCycles[4].instr,/W0.*ADD/);
 assert.match(mechanismStudioHTML(find('warp-issue')),/不是.*真实|不是.*性能|教学/);
});
