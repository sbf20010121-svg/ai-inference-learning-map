import test from "node:test";
import assert from "node:assert/strict";
import { ssaAssignments, fusionRounding, engineInvocation, residualRmsFusion } from "../site/js/compiler-kernel-models.js";
import { pagedRead } from "../site/js/foundation-numerics.js";
import { allCourseById } from "../site/js/course-registry.js";
import { renderFocusReader } from "../site/js/focus-reader.js";
import { renderMechanism, defaultLab, changeLab } from "../site/js/mechanism-visuals.js";
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);
const page = (id, chapter) => renderFocusReader(allCourseById.get(id), {}, { chapter });
const mathPanel = (html) => html.match(/<details class="mechanism-math"[\s\S]*?<\/details>/)?.[0] || "";

test("SSA value versions retain the overwritten source variable's dependency", () => {
  const first = ssaAssignments(2), next = ssaAssignments(4);
  assert.deepEqual(first.map(v=>v.value), [2,4,5]);
  assert.deepEqual(next.map(v=>v.value), [4,8,9]);
  assert.equal(new Set(first.map(v=>v.name)).size, 3);
  assert.deepEqual(first.map(v=>v.value), [2,4,5], "later calls cannot mutate prior definitions");
  const view = renderMechanism("foundation/ir-ssa/values", defaultLab());
  assert.match(view, /%x0/);
  assert.match(view, /%u/);
  assert.match(view, /%v/);
  assert.doesNotMatch(view, /w=3/);
});

test("removing an explicitly required intermediate rounding changes fusion semantics", () => {
  const legal = fusionRounding(true), changed = fusionRounding(false);
  assert.equal(legal.storedIntermediate, 1000);
  assert.equal(legal.output, 0);
  assert.equal(changed.storedIntermediate, 1000.4);
  near(changed.output, 4/10);
  assert.notEqual(legal.output, changed.output);
});

test("a reusable engine interface still computes each new runtime input", () => {
  for (const B of [1,6,8]) {
    const a = engineInvocation(B), b = engineInvocation(B,10);
    assert.deepEqual(a.inputShape, b.inputShape);
    assert.deepEqual(a.outputShape, [B,2]);
    for (let r=0;r<B;r++) {
      assert.deepEqual(a.outputs[r], [r+2,4]);
      assert.deepEqual(b.outputs[r], [r+12,4]);
    }
  }
  assert.throws(()=>engineInvocation(16), RangeError);
});

test("residual RMS fusion conserves numerics and keeps an externally visible residual sum", () => {
  const split = residualRmsFusion(false), fused = residualRmsFusion(true), visible = residualRmsFusion(true,true);
  const denominator = Math.sqrt(Math.hypot(3,4)**2/2 + 1e-5);
  for (const d of [split,fused,visible]) {
    assert.deepEqual(d.sum,[3,4]);
    near(d.output[0], 3/denominator);
    near(d.output[1], 4/denominator);
  }
  assert.equal(split.reads+split.writes,12);
  assert.equal(fused.reads+fused.writes,8);
  assert.equal(visible.reads+visible.writes,10);
  assert.equal(fused.materializeSum,false);
  assert.equal(visible.materializeSum,true);
});

test("paged attention derivations match an independent scalar weighted sum", () => {
  const K=[1,0,2,3], V=[2,4,1,3];
  for (const L of [3,4]) {
    const denom = K.slice(0,L).reduce((s,k)=>s+Math.exp(k),0);
    const expected = K.slice(0,L).reduce((s,k,i)=>s+Math.exp(k)*V[i],0)/denom;
    for (const layout of [false,true]) near(pagedRead(L,layout).out, expected);
  }
  const tail = renderMechanism("foundation/paged-attention-kernel/tail", {...defaultLab(),case:1});
  assert.match(tail,/Mask排除，概率为0/);
});

test("chapter formulas and assessments follow the active mechanism instead of a course-wide fallback", () => {
  const constraint=mathPanel(page("symbolic-shapes","constraint"));
  assert.match(constraint, /<mi>B<\/mi>/);
  assert.doesNotMatch(constraint, /<mi>C<\/mi>/);
  assert.match(page("symbolic-shapes","amortize"), /compile_ms/);
  assert.match(mathPanel(page("reduction-scan","tree")), /<mi>total<\/mi>/);
  assert.match(mathPanel(page("reduction-scan","prefix")), /<mi>prefix<\/mi>/);
  assert.match(mathPanel(page("paged-attention-kernel","compute")), /2\.471149/);
  assert.match(mathPanel(page("paged-attention-kernel","tail")), /1\.514820/);
  assert.match(mathPanel(page("convolution-lowering","window")), /<mi>Y<\/mi>/);
  assert.match(mathPanel(page("convolution-lowering","stride")), /<mi>out<\/mi>/);
  const norm=page("fused-norm","fusion");
  assert.match(norm, /data-mechanism="norm-fusion"/);
  assert.match(norm, /10，6次读与4次写/);
  assert.doesNotMatch(norm, /y=max\(v,0\)/);
});

test("GEMM Tile tracing reaches different row and column tiles, not only the first tile", () => {
  const s=changeLab(defaultLab(),"cell","10");
  assert.equal(s.cell,10);
  const rendered=renderMechanism("gemm-tiles",s);
  assert.match(rendered,/C\[2,2\]/);
  assert.match(rendered,/该Tile复用的行带/);
  assert.notEqual(rendered,renderMechanism("gemm-tiles",defaultLab()));
});

test("a rising sampled stall fraction is not presented as measured slowdown", () => {
  const html=renderMechanism("profile-evidence",defaultLab());
  assert.match(html,/40%/);
  assert.match(html,/80%/);
  assert.match(html,/绝对耗时/);
  assert.match(html,/未给出/);
  assert.match(html,/合成反例/);
});
