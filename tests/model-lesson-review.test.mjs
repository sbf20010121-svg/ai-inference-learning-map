import test from "node:test";
import assert from "node:assert/strict";
import { sampling, transformerBlockExample, generationTrace, attentionPattern, total, noiseState, klState, actionEncoding } from "../site/js/foundation-numerics.js";
import { expertTrace } from "../site/js/mechanism-models.js";
import { affineToken, applyAffine, rowvec } from "../site/js/research-models.js";
import { renderMechanism, defaultLab } from "../site/js/mechanism-visuals.js";
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);

test("complete Pre-Norm teaching block keeps both residuals and matches an independent scalar reference", () => {
  const d = transformerBlockExample();
  // Independently evaluated per-query dot products and scalar RMS denominators,
  // without the renderer's matrix helpers (documented in the model review).
  const expected = [[2.264910890110867,-3.2649108110852145],[6.292925348629948,3.627722806612905]];
  d.output.forEach((row,i)=>row.forEach((v,j)=>near(v,expected[i][j])));
  near(d.normalized[0][0], 1/Math.sqrt(2.5+1e-6));
  assert.deepEqual(d.weights[0],[1,0]);
  d.weights.forEach(row=>near(total(row),1));
  for (let i=0;i<2;i++) for(let j=0;j<2;j++) {
    near(d.residual[i][j],d.X[i][j]+d.attention[i][j]);
    near(d.output[i][j],d.residual[i][j]+d.down[i][j]);
  }
  const changed = transformerBlockExample(true);
  assert.deepEqual(changed.X[1],d.X[1]);
  assert.notDeepEqual(changed.attention[1],d.attention[1]);
  assert.notDeepEqual(changed.output,d.output);
});

test("sampling uses the post-Top-k denominator for Top-p and keeps CDF mass", () => {
  assert.deepEqual(sampling(1,.7,4).keep,[0,1]);
  const combined = sampling(1,.7,2);
  near(combined.afterTopK[0],12/17);
  assert.deepEqual(combined.keep,[0]);
  assert.deepEqual(combined.filtered,[1,0,0,0]);
  for (const k of [1,2,4]) for (const p of [.7,.8,.95,1]) {
    const d = sampling(1,p,k);
    near(total(d.filtered),1);
    near(d.cdf.at(-1),1);
    assert.ok(d.keep.length<=k);
    assert.ok(d.nucleusMass>=p-1e-12);
    assert.ok(d.keep.length===1 || total(d.keep.slice(0,-1).map(i=>d.afterTopK[i]))<p);
  }
  assert.deepEqual(sampling(1,1,4).keep,[0,1,2,3]);
});

test("temperature-only comparison is the normalized square root distribution at T=2", () => {
  const original = [.6,.25,.1,.05], roots=original.map(Math.sqrt), denominator=total(roots),
    d = sampling(2,1,4);
  d.probabilities.forEach((p,i)=>near(p,roots[i]/denominator));
  assert.deepEqual(d.keep,[0,1,2,3]);
  assert.equal(d.order[0],0);
  assert.ok(d.probabilities[0]<original[0]);
  assert.ok(d.probabilities[3]>original[3]);
});

test("sampling and forwarding are distinct events; EOS or length limit does not compute the final token", () => {
  for (const [limit,eos] of [[2,2],[2,null],[5,1],[1,null]]) {
    const trace = generationTrace(limit,eos);
    for(let i=1;i<trace.length;i++) {
      const a=trace[i-1],b=trace[i];
      if(b.event==="sample") {
        assert.equal(b.tokens.length,a.tokens.length+1);
        assert.equal(b.computed,a.computed);
      }
      if(b.event==="decode") {
        assert.deepEqual(b.tokens,a.tokens);
        assert.equal(b.computed,b.tokens.length);
      }
    }
    const last=trace.at(-1);
    assert.equal(last.event,"stop");
    assert.equal(last.terminal,true);
    assert.equal(last.computed,last.tokens.length-1);
    assert.ok(last.generated<=limit);
  }
  assert.ok(generationTrace(0,null).every(e=>e.computed===0));
  assert.equal(generationTrace(5,1).at(-1).generated,1);
});

test("window reachability differs from direct edges and occupied dense tiles", () => {
  const window=attentionPattern(3,2),full=attentionPattern(6);
  assert.deepEqual(window.reachable[5],[0,1,1,1,1,1]);
  assert.deepEqual(window.direct[5],[0,0,0,1,1,1]);
  const nonemptyTiles = matrix => {
    const occupied = new Set();
    matrix.forEach((row,i)=>row.forEach((visible,j)=>{if(visible)occupied.add(`${Math.floor(i/2)},${Math.floor(j/2)}`);}));
    return occupied.size;
  };
  assert.equal(window.pairs,15);
  assert.equal(full.pairs,21);
  assert.equal(nonemptyTiles(window.direct)*4,20);
  assert.equal(nonemptyTiles(full.direct)*4,24);
});

test("MoE group matrices and restored token outputs use the same projection coordinate", () => {
  for(const k of [1,2]) {
    const d=expertTrace(k);
    for(const r of d.records) {
      const activation=[r.t+1,r.t+2],weight=[r.e+2,0];
      near(r.output,activation[0]*weight[0]+activation[1]*weight[1]);
    }
    for(let t=0;t<4;t++) {
      const records=d.records.filter(r=>r.t===t), totalWeight=records.reduce((s,r)=>s+r.w,0);
      near(totalWeight,1);
      near(d.combined[t],records.reduce((s,r)=>s+r.w*(t+1)*(r.e+2),0));
    }
  }
});

test("one-step Delta correction requires the unit-key condition even at beta=1", () => {
  const S=[[1,0],[0,1]],v=[4,0];
  const unit=applyAffine(affineToken({k:[1,0],v},1,1),S);
  assert.deepEqual(rowvec([1,0],unit),v);
  assert.deepEqual(unit[1],S[1]);
  const nonunit=applyAffine(affineToken({k:[2,0],v},1,1),S);
  assert.deepEqual(rowvec([2,0],nonunit),[10,0]);
  assert.notDeepEqual(rowvec([2,0],nonunit),v);
});

test("model figures expose their actual counterfactuals without claiming measured performance", () => {
  const lab=defaultLab();
  for(const [fig,key,values] of [
    ["decoder-layer","step",[0,1,2,3,4,5]],
    ["mla-position","angle",[0,90,180]],
    ["foundation/vision-patches/projection","case",[0,1]],
    ["foundation/action-representation/anchor","case",[0,1]],
    ["world-attention","scenario",[0,1]],
  ]) {
    const outputs=values.map(value=>renderMechanism(fig,{...lab,[key]:value}));
    assert.equal(new Set(outputs).size,values.length);
    outputs.forEach(html=>assert.doesNotMatch(html,/NaN|undefined|-Infinity/));
  }
  const encoded=actionEncoding();
  assert.deepEqual(encoded.restored,encoded.absolute);
  assert.deepEqual(actionEncoding(true).restored,[11,12,13]);
  const kl=klState().kl;
  near(kl,.8*Math.log(1.6)+.2*Math.log(.4));
  assert.equal(Math.max(1,kl),1);
  const noisy=noiseState(.25);
  near(noisy.zt[0],1-Math.sqrt(.75));
  near(noisy.restored[0],2);
});
