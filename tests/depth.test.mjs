import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depthModules,depthTopics,depthPaths,depthById,validateDepthData} from '../site/js/depth-content.js';
import {computeLab,depthLabDefinitions} from '../site/js/depth.js';
import {modules,lessons} from '../site/js/content.js';

test('Depth map preserves the original six module IDs and lesson references',()=>{
 assert.deepEqual(depthModules.map(m=>m.id),modules.map(m=>m.id));
 assert.equal(validateDepthData(),true);
 assert.equal(depthTopics.length,19);
 const lessonIds=new Set(lessons.map(l=>l.id));
 assert.ok(depthTopics.every(t=>lessonIds.has(t.parent)));
 assert.ok(depthModules.every(m=>depthTopics.filter(t=>t.module===m.id).length>=2));
});

test('Each deep topic supports L2 flow, L3 evidence, a meaningful L4 experiment design and reasoning quiz',()=>{
 for(const t of depthTopics){
  assert.equal(t.stage.length,4,`${t.id}: expected four visual stages`);
  assert.ok(t.stage.every(s=>s.data&&s.mechanism&&s.metric&&s.trap),t.id);
  assert.ok(t.insights.length>=2,t.id);
  assert.ok(t.traces.every(x=>x.length>=4&&x[3].startsWith('https://')),t.id);
  assert.ok(t.related.length>=2,t.id);
  assert.ok(t.experiment.goal&&t.experiment.controls&&t.experiment.metrics&&t.experiment.validation,t.id);
  assert.equal(t.quiz[1].length,3);
  assert.ok(t.quiz[2]>=0&&t.quiz[2]<3);
  assert.ok(t.quiz[3].length>15);
 }
});

test('Four multi-module paths include real cross-links and no orphan nodes',()=>{
 assert.equal(depthPaths.length,4);
 const allPathIds=new Set(depthPaths.flatMap(p=>p.ids));
 assert.ok([...allPathIds].every(x=>depthById.has(x)));
 assert.ok(depthPaths.every(p=>new Set(p.ids.map(id=>depthById.get(id).module)).size>=3));
 for(const topic of depthTopics)assert.ok(topic.related.every(id=>depthById.has(id)));
});

test('Interactive formulas are arithmetic demonstrations and react to parameters',()=>{
 assert.ok(Object.keys(depthLabDefinitions).length>=8);
 assert.ok(depthTopics.filter(x=>x.lab).length>=12);
 for(const [type,lab] of Object.entries(depthLabDefinitions)){
  const vals=Object.fromEntries(lab.controls.map(x=>[x[0],x[5]]));
  const result=computeLab(type,vals);
  assert.ok(result.length>=3,type);
  assert.ok(result.every(r=>r[0]&&r[1]&&!/NaN|Infinity/.test(r[1])),type);
 }
 const pd=computeLab('pd',{seq:4096,layers:32,heads:8,bw:100});
 assert.match(pd[0][1],/536\.9/);
 const twice=computeLab('pd',{seq:8192,layers:32,heads:8,bw:100});
 assert.match(twice[0][1],/1,073\.7/);
 const kv=computeLab('kv',{seq:4096,layers:32,heads:8,qheads:32});
 assert.match(kv[2][1],/25%/);
 assert.match(computeLab('tokens',{budget:2048,active:64,prompt:4096})[1][1],/3 轮/);
 assert.match(computeLab('amdahl',{pct:40,speed:3,base:10})[1][1],/1\.36/);
});

test('HTML exposes deep navigation and legacy routes plus versioned CSS and module file',()=>{
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../site/js/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/depth.css',import.meta.url),'utf8');
 assert.match(html,/id="topDepth"/);
 assert.match(html,/id="depthView"/);
 assert.match(html,/depth\.css/);
 assert.match(app,/exportDepthProgress/);
 assert.match(app,/importDepthProgress/);
 assert.match(app,/data-godepth/);
 assert.match(css,/@media\(max-width:760px\)/);
});
