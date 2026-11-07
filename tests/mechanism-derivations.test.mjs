import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {derivationIds,getDerivation,hasDerivation,renderInContext,renderWorkedDerivation} from '../site/js/mechanism-derivations.js';
import {depthTopics} from '../site/js/depth-content.js';
import {renderFocusReader} from '../site/js/focus-reader.js';
import {flashStats} from '../site/js/mechanism-studio.js';

const ids=new Set(depthTopics.map(t=>t.id));
test('11 curated mechanisms directly present explanation, stateful diagram, MathML and worked example',()=>{
 assert.equal(derivationIds.length,11);
 for(const id of derivationIds){
  assert.ok(ids.has(id),`${id} not mapped to existing course`);
  const d=getDerivation(id);
  assert.ok(d.premise.length>=40 && d.why.length>=65,`${id}: weak causal explanation`);
  assert.ok(d.worked.length>=3 && d.vars.length>=3,`${id}: not a worked numerical example`);
  assert.ok(d.limit.length>=24 && d.source.startsWith('https://'),`${id}: missing limitations / verification reference`);
  const diagram=renderInContext(id),derivation=renderWorkedDerivation(id);
  assert.ok(diagram.includes('<figure') && diagram.includes('theory-cause'),`${id}: not a real diagram plus explanation`);
  assert.match(derivation,/<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML" display="block"/);
  assert.match(derivation,/class="theory-vars"/);
  assert.match(derivation,/class="theory-derivation-steps"/);
  assert.doesNotMatch(derivation,/<script[^>]+src=/);
 }
 assert.equal(hasDerivation('host-runtime'),false);
});

test('focused reader displays mechanism without navigation to external sources',()=>{
 for(const id of derivationIds){
  const topic=depthTopics.find(t=>t.id===id);
  const base={readerStep:0,seenSteps:[],seenSubsteps:[],status:'learning'};
  const settings={records:{}};
  const intro=renderFocusReader(topic,base,{...settings,readerStep:0});
  assert.match(intro,/theory-embedded/);
  assert.match(intro,/theory-figure/);
  const ex=renderFocusReader(topic,base,{...settings,readerStep:2});
  assert.match(ex,/theory-math/);
  assert.match(ex,/theory-derivation-steps/);
 }
});

test('FlashAttention cumulative statistics and example are mathematically consistent',()=>{
 const stats=flashStats(3);
 // Expected output for scores [1,2,3,0], values [1,2,3,4].
 const scores=[1,2,3,0],values=[1,2,3,4];
 const w=scores.map(x=>Math.exp(x-3));
 const direct=w.reduce((v,x,i)=>v+x*values[i],0)/w.reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(stats.second.out-direct)<1e-10);
 assert.ok(Math.abs(direct-2.6208871477061098)<1e-10);
 const worked=renderWorkedDerivation('attention-tiling');
 assert.match(worked,/2\.621/);
 assert.match(worked,/指数重缩放/);
});

test('native MathML stylesheet is bundled and no external runtime is required',()=>{
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/mechanism-derivations.css',import.meta.url),'utf8');
 assert.match(html,/mechanism-derivations\.css/);
 assert.match(css,/theory-math math/);
 assert.match(css,/@media\(max-width:750px\)/);
});
