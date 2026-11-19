import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthTopics} from '../site/js/depth-content.js';
import {featuredMechanisms,featuredMechanismIds,mechanismStudioHTML,mechanismFigure,validateMechanismStudio,flashStats,pedagogicalWarpCycles,slotCells} from '../site/js/mechanism-studio.js';
import {visualHTML} from '../site/js/visual-atlas.js';
import {focusScene} from '../site/js/focus-scenes.js';

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
 assert.match(html,/V1\.(6|7|8|9)|V2\.[01]|V[3456]/);
});
test('FlashAttention 两个 Tile 在线 softmax 数值等于全局 softmax',()=>{
 const s=flashStats();
 assert.ok(Math.abs(s.first.l-(1+Math.exp(-1)))<1e-12);
 assert.ok(Math.abs(s.second.l-(Math.exp(-1)*s.first.l+1+Math.exp(-3)))<1e-12);
 assert.ok(Math.abs(s.second.out-s.ref)<1e-12);
 assert.ok(s.second.out>2&&s.second.out<3);
});
test('主课程同一示例按 1/6/1、1/1/3、1/1/1 推进，空余预算可见',()=>{
 const counts=round=>[...slotCells(round).matchAll(/class="m16-slot m16-([abc])"/g)].map(x=>x[1]);
 for(const [round,expected,free] of [[0,[0,0,0],8],[1,[1,6,1],0],[2,[1,1,3],3],[3,[1,1,1],5]]){
  const items=counts(round);
  assert.deepEqual(['a','b','c'].map(id=>items.filter(x=>x===id).length),expected);
  assert.equal([...slotCells(round).matchAll(/class="m16-slot m16-free"/g)].length,free);
  assert.equal(items.length+free,8);
 }
});
test('直接进入任一步时先交代请求身份，轮前与轮后不混用',()=>{
 for(let step=0;step<5;step++){
  const html=mechanismFigure('vllm-scheduler',step);
  assert.ok(html.indexOf('A/B/C 是请求编号')<html.indexOf('m16-slot-wrap'));
  assert.match(html,/已有 6 个位置的 KV/);
  assert.match(html,/分别有 6\/4 个位置待算/);
  assert.match(html,/每轮预算重置为 8/);
 }
 const before=mechanismFigure('vllm-scheduler',0,1);
 const after=mechanismFigure('vllm-scheduler',2,1);
 assert.match(before,/第 1 轮分配前/);
 assert.match(before,/<td>请求 B<\/td><td>尚未分配<\/td><td>0<\/td><td>6 个输入位置/);
 assert.match(after,/第 2 轮执行完成后/);
 assert.match(after,/<td>请求 B<\/td><td>Decode 1<\/td><td>7<\/td><td>0 个输入位置/);
 assert.equal(featuredMechanisms['vllm-scheduler'].check.correct,1);
 assert.match(featuredMechanisms['vllm-scheduler'].check.why,/min\(6,7\)=6/);
});
test('旧版紧凑图与完整机制图使用相同分配，没有遗留 B10 场景',()=>{
 const expected=[[1,6,1],[1,1,3],[1,1,1]];
 for(let round=1;round<=3;round++){
  const html=focusScene('vllm-scheduler',round);
  assert.ok(html.indexOf('A/B/C 是请求编号')<html.indexOf('class="fs-budget"'));
  assert.deepEqual(['a','b','c'].map(id=>[...html.matchAll(new RegExp(`class="fs-token fs-${id}"`,'g'))].length),expected[round-1]);
 }
 assert.match(focusScene('vllm-scheduler',4),/A@p8、B@p7、C@p4/);
});
test('Warp 发射教学轨迹标注了 Issue 空泡和依赖恢复，不能冒充 B200 周期模型',()=>{
 assert.equal(pedagogicalWarpCycles.length,8);
 assert.equal(pedagogicalWarpCycles[6].kind,'idle');
 assert.match(pedagogicalWarpCycles[4].instr,/W0.*ADD/);
 assert.match(mechanismStudioHTML(find('warp-issue')),/不是.*真实|不是.*性能|教学/);
});
