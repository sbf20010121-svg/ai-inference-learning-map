import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {modules,lessons,edges,nodeMap} from '../site/js/content.js';

const fixedModules=['model','engine','compiler','kernel','systems','microarch'];

test('Keep the V1.1 six-module taxonomy',()=>{
  assert.deepEqual(modules.map(m=>m.id),fixedModules);
  assert.equal(new Set(modules.map(m=>m.id)).size,6);
});

test('Every lesson is complete, unique and reference-backed',()=>{
  assert.ok(lessons.length>=10);
  assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
  for(const l of lessons){
    assert.ok(fixedModules.includes(l.module),`${l.id}: invalid module`);
    for(const field of ['title','short','brief','analogy','takeaway','level'])assert.ok(typeof l[field]==='string'&&l[field].trim(),`${l.id}: missing ${field}`);
    assert.ok(l.steps.length>=4&&l.steps.length<=7,`${l.id}: steps`);
    for(const s of l.steps)for(const k of ['title','sub','why','see'])assert.ok(s[k],`${l.id}: missing step.${k}`);
    assert.ok(l.goals.length>=2&&l.points.length>=2&&l.related.length>=1,`${l.id}: weak content`);
    assert.ok(l.quiz.opts.length===3&&[0,1,2].includes(l.quiz.correct)&&l.quiz.why,`${l.id}: invalid quiz`);
    assert.ok(l.refs.length>0,`${l.id}: missing sources`);
    for(const [title,url] of l.refs){assert.ok(title&&URL.canParse(url)&&url.startsWith('https://'),`${l.id}: bad reference`)}
    for(const id of l.related)assert.ok(lessons.some(x=>x.id===id),`${l.id}: unknown related ${id}`);
  }
});

test('All graph links point to valid nodes',()=>{
  for(const [a,b] of edges){assert.ok(nodeMap.has(a)&&nodeMap.has(b),`missing edge endpoint: ${a},${b}`);assert.notEqual(a,b)}
  const sig=edges.map(([a,b])=>[a,b].sort().join('/'));
  assert.equal(new Set(sig).size,sig.length,'duplicate undirected graph edge');
});

test('Graph nodes have unique finite positions and a valid module',()=>{
  for(const n of [...modules,...lessons]){
    assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y),`${n.id} has invalid coordinates`);
    assert.ok(n.x>=0&&n.x<=1180&&n.y>=0&&n.y<=760,`${n.id} outside viewBox`);
  }
});

test('Site includes accessible controls and no external scripts',()=>{
  const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(html,/lang="zh-CN"/);
  assert.match(html,/id="knowledgeGraph"/);
  assert.match(html,/id="importFile"/);
  assert.match(html,/id="lessonView"/);
  assert.doesNotMatch(html,/<script[^>]+src="https?:/i);
});

// V1.2: Scenario-based learning and Chinese quick glossary.
import {scenarios,glossary,moduleRoles,reasonBetween} from '../site/js/journeys.js';
test('Three scenario journeys connect to existing lessons and modules',()=>{
  assert.deepEqual(scenarios.map(x=>x.id),['llm','vla','world']);
  for(const scene of scenarios){
    assert.ok(scene.name&&scene.intro&&scene.caveat&&scene.steps.length>=4);
    for(const step of scene.steps){
      assert.ok(fixedModules.includes(step.module),`${scene.id} missing module`);
      assert.ok(lessons.some(l=>l.id===step.lesson),`${scene.id} broken lesson link: ${step.lesson}`);
      for(const field of ['title','question','detail','work','observe'])assert.ok(step[field],`${scene.id} missing ${field}`);
    }
  }
});

test('All modules have a human-readable role and glossary links are valid',()=>{
  for(const id of fixedModules){assert.ok(moduleRoles[id]?.summary&&moduleRoles[id]?.connect&&moduleRoles[id]?.question)}
  assert.ok(glossary.length>=15);
  assert.equal(new Set(glossary.map(x=>x.term)).size,glossary.length);
  for(const term of glossary){
    assert.ok(term.term&&term.plain&&term.plain.length>=10);
    assert.ok(lessons.some(x=>x.id===term.lesson));
  }
  assert.ok(reasonBetween('vla-head','world-model').includes('职责'));
});
