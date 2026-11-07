import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthTopics} from '../site/js/depth-content.js';
import {renderFocusReader,normalizeReaderRecord,getReaderCounts,FOCUS_PAGES} from '../site/js/focus-reader.js';
import {focusScene} from '../site/js/focus-scenes.js';
import {featuredMechanismIds} from '../site/js/mechanism-studio.js';
const html=(id='pd-disagg',pg=0,sub=0)=>renderFocusReader(depthTopics.find(x=>x.id===id),{status:'learning',readerStep:pg,seenSteps:[0],seenSubsteps:[0]}, {readerStep:pg,substep:sub,records:{}});

test('核心学习为五个短步骤，源码和实测独立为可选进阶',()=>{
 assert.deepEqual(FOCUS_PAGES.map(x=>x.label),['先看懂','运行机制','具体例子','自己判断','记住重点','源码追踪','性能验证']);
 for(let n=0;n<7;n++){
  const v=html('pd-disagg',n);
  assert.equal((v.match(/class="focus-panel"/g)||[]).length,1);
  assert.match(v,/<button type="button" data-f-next>/);
  assert.doesNotMatch(v,/m16-studio/); // full old lesson is opt-in, not upfront
 }
 assert.match(html('pd-disagg',0),/D：Decode 实例/);
 assert.match(html('pd-disagg',1),/data-f-sub="0"/);
 assert.match(html('pd-disagg',4),/浏览和做题不会自动标为/);
 assert.match(html('pd-disagg',5),/可选：官方源码或技术资料/);
});

test('所有深度专题都能直接进入短步骤，而不是只有首页能用',()=>{
 for(const t of depthTopics){
  for(const page of [0,1,2,3,4,5,6]){
   const rendered=html(t.id,page);
   assert.ok(rendered.includes(t.title),t.id);
   assert.ok(rendered.includes('focus-panel'),`${t.id}/${page}`);
   assert.ok(rendered.includes('数据')||rendered.includes('判断')||rendered.includes('记住')||rendered.includes('研究')||rendered.includes('运行'),`${t.id}/${page}`);
  }
 }
});

test('已浏览和已掌握不混淆；机制必须看完全部子步骤才算读过',()=>{
 const p=normalizeReaderRecord({readerStep:3,readerSubstep:2,seenSteps:[0,1,2,2,4,99],seenSubsteps:[0,2]});
 assert.deepEqual(p.seenSteps,[0,1,2,4]);
 assert.deepEqual(p.seenSubsteps,[0,2]);
 assert.equal(getReaderCounts(p,5).core,3); // mechanism incomplete
 assert.equal(getReaderCounts({...p,seenSubsteps:[0,1,2,3,4]},5).core,4);
 assert.equal(normalizeReaderRecord({readerStep:300}).readerStep,6);
});

test('五个优先机制都有逐步专用图，并提供完整机制图可选入口',()=>{
 for(const id of featuredMechanismIds){
  const t=depthTopics.find(t=>t.id===id);
  assert.ok(t,id);
  for(let i=0;i<t.stage.length;i++){
   const diagram=focusScene(id,i);
   assert.match(diagram,/focus-scene/);
   assert.match(diagram,/figcaption/);
   assert.ok(diagram.length>160,`${id}/${i}`);
  }
  const v=html(id,1,0);
  assert.match(v,/展开完整机制图与另一种视角/);
 }
});

test('沿用旧进度存储、支持完整参考模式及新阅读器的路由恢复',()=>{
 const src=readFileSync(new URL('../site/js/depth.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../site/js/app.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(src,/ai-inference-depth-progress-v1/);
 assert.match(src,/normalizeReaderRecord/);
 assert.match(src,/resumeDepthHash/);
 assert.match(src,/readerSubstep/);
 assert.match(src,/data-f-reference/);
 assert.match(src,/renderFocusReader/);
 assert.match(app,/resumeDepthHash\(\)/);
 assert.match(page,/focus\.css/);
});
