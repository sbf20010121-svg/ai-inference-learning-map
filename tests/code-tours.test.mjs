import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthTopics,depthModules} from '../site/js/depth-content.js';
import {codeTours,codeTourById,validateCodeTours,renderCodeTour} from '../site/js/code-tour-view.js';
import {renderFocusReader} from '../site/js/focus-reader.js';

test('25 个 L3 导读覆盖六大领域，不是空链接页',()=>{
 assert.equal(depthTopics.length,25);
 assert.equal(codeTours.length,depthTopics.length);
 assert.equal(validateCodeTours(depthTopics.map(t=>t.id)),true);
 assert.deepEqual(new Set(depthTopics.map(t=>t.module)),new Set(depthModules.map(m=>m.id)));
 assert.ok(codeTours.reduce((n,t)=>n+t.phases.flatMap(p=>p.code).length,0)>250);
 for(const t of depthTopics){
   const page=renderCodeTour(t,0);
   assert.match(page,/code-tour/);
   assert.match(page,/可解释伪代码 · 非可运行源码/);
   assert.match(page,/代码符号就地解释/);
   assert.match(page,/核对真实项目/);
   assert.match(page,/data-code-phase="1"/);
 }
});

test('每节教程都展示真实对象和状态变化而非只列出术语或外链',()=>{
 for(const tour of codeTours){
   assert.ok(tour.phases.length>=3 && tour.phases.length<=5,tour.id);
   for(const phase of tour.phases){
     assert.ok(phase.code.length>=2 && phase.code.length<=6,tour.id+' '+phase.title);
     assert.ok(phase.input.length>2 && phase.output.length>1,tour.id+' '+phase.title);
     assert.ok(phase.action.length>6 && phase.reason.length>8,tour.id+' '+phase.title);
   }
   const source=depthTopics.find(t=>t.id===tour.id);
   for(let i=0;i<tour.phases.length;i++){
      const rendered=renderCodeTour(source,i);
      assert.match(rendered,new RegExp('当前第 '+(i+1)+'/'+tour.phases.length+' 段'));
      assert.ok(rendered.includes(tour.phases[i].owner));
      assert.ok(rendered.includes(tour.phases[i].output));
   }
 }
});

test('代码节点能与专注阅读的源码页链接，且 L3 不重写学习进度',()=>{
 for(const t of depthTopics){
   const html=renderFocusReader(t,{status:'learning',readerStep:5,seenSteps:[0,1],seenSubsteps:[0]},
       {readerStep:5,sourceIndex:0,records:{}});
   assert.match(html,/id="codeTourRoot"/);
   assert.match(html,/class="ct-code-shell"/);
   assert.ok(html.includes(t.title));
 }
 const depth=readFileSync(new URL('../site/js/depth.js',import.meta.url),'utf8');
 assert.match(depth,/data-code-phase/);
 assert.match(depth,/renderCodeTour/);
 assert.match(depth,/ai-inference-depth-progress-v1/);
 const index=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(index,/code-tour\.css/);
});

test('关键领域内容区别明显：EP、Codegen、Scoreboard、KV Mapping、Action Chunk',()=>{
 assert.match(codeTourById.get('moe-route').phases.map(p=>p.code.join(' ')).join(' '),/topk/);
 assert.match(codeTourById.get('moe-route').phases.map(p=>p.code.join(' ')).join(' '),/all_to_all/);
 assert.match(codeTourById.get('compiler-lowering').phases.map(p=>p.code.join(' ')).join(' '),/llvm_ir/);
 assert.match(codeTourById.get('kv-cache').phases.map(p=>p.code.join(' ')).join(' '),/table\[req\]/);
 assert.match(codeTourById.get('warp-issue').phases.map(p=>p.code.join(' ')).join(' '),/eligible/);
 assert.match(codeTourById.get('vla-policy').phases.map(p=>p.code.join(' ')).join(' '),/action_expert/);
 assert.match(codeTourById.get('attention-tiling').phases.map(p=>p.code.join(' ')).join(' '),/alpha/);
});

test('所有用户可见动态内容转义，避免注入 HTML 或伪造源码入口',()=>{
 const t=depthTopics.find(t=>t.id==='moe-route');
 const html=renderCodeTour({...t,title:'<img src=x onerror=alert(1)>'},0);
 assert.doesNotMatch(html,/<img src=x onerror/);
 assert.match(html,/&lt;img/);
 assert.match(html,/原创|伪代码/);
});
