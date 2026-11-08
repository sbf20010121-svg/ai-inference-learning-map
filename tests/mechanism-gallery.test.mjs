import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {galleryCases,studioOptions,validateGallery,renderGalleryCase,renderTermIndex,originalTerms,
 schedulerBudget,coalescingSegments,moeCounts,fusionTrace,flowAt,videoTokens} from '../site/js/mechanism-gallery.js';
import {depthTopics} from '../site/js/depth-content.js';

test('8 new observable mechanism diagrams connect to existing knowledge with explicit Chinese vocabulary',()=>{
 assert.equal(validateGallery(),true);assert.equal(galleryCases.length,8);assert.equal(studioOptions.length,10);
 const known=new Set(depthTopics.map(x=>x.id));
 for(const c of galleryCases){
  assert.ok(known.has(c.topic),c.id+' orphan topic');
  assert.ok(c.terms.length>=4,c.id+' missing symbol guide');
  for(const t of c.terms){assert.ok(t.name&&t.meaning.length>8, c.id+' undefined term '+t.name)}
  for(let i=0;i<c.names.length;i++){
   const html=renderGalleryCase(c.id,i);
   assert.match(html,/<nav class="mg-steps"/);assert.match(html,/<div class="mg-figure"/);
   assert.match(html,/这一步发生了什么/);assert.match(html,/图里的符号是什么意思/);
   assert.match(html,/本图|机制|计算/);
  }
 }
 for(const t of Object.values(originalTerms))assert.ok(t.length>=6&&renderTermIndex(t).includes('图里的符号是什么意思'));
});

test('vLLM illustrative token budget never overbooks, prefills C in two rounds',()=>{
 const budgets=[0,8,5,3];
 for(let i=0;i<4;i++){
  const b=schedulerBudget(i);assert.equal(b.used,budgets[i]);assert.equal(b.used+b.free,b.capacity);
 }
 assert.equal(schedulerBudget(1).rows[2].remain,3);
 assert.equal(schedulerBudget(2).rows[2].remain,0);
});

test('32 lanes × 4B: contiguous addresses cover 4 sectors, 8-float stride covers 32',()=>{
 const a=coalescingSegments(1),b=coalescingSegments(8);
 assert.deepEqual(a.addrs.slice(0,4),[0,4,8,12]);assert.deepEqual(b.addrs.slice(0,4),[0,32,64,96]);
 assert.equal(a.segments,4);assert.equal(b.segments,32);
 assert.equal(a.used,128);assert.equal(b.used,128);
 assert.equal(a.covered,128);assert.equal(b.covered,1024);
});

test('fusion, MoE expert assignments, VLA actions, world-model token expansion remain self-consistent',()=>{
 assert.deepEqual(fusionTrace().y,[0,0,3,5]);
 assert.deepEqual(moeCounts(),[2,3,3]);assert.equal(moeCounts().reduce((a,b)=>a+b,0),8);
 assert.deepEqual(flowAt(0),[0.1,0.2]);assert.deepEqual(flowAt(4),[0.9,0.8]);
 assert.deepEqual(videoTokens(1),{frames:1,perFrame:4,total:4,pairs:16});
 assert.deepEqual(videoTokens(3),{frames:3,perFrame:4,total:12,pairs:144});
});

test('network and focus reader expose diagrams and preserve existing modules/routes',()=>{
 const net=readFileSync(new URL('../site/js/knowledge-network-ui.js',import.meta.url),'utf8');
 const focus=readFileSync(new URL('../site/js/focus-reader.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../site/js/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(net,/netStudioSelect/);assert.match(net,/renderGalleryCase/);
 assert.match(focus,/renderMechanism/);assert.match(app,/network\/studio/);
 assert.match(html,/mechanism-gallery\.css/);
});
