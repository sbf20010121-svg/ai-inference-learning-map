import test from "node:test";
import assert from "node:assert/strict";
import { requestTrace } from "../site/js/system-trace.js";

test("sampling and computing a generated input have distinct positions", () => {
  const events = requestTrace("length");
  const first = events.find(e => e.generated.length === 1);
  assert.equal(first.computed, 3);
  assert.equal(first.reserved, 3);
  const second = events.find(e => e.generated.length === 2);
  assert.equal(second.computed, 4);
  const last = events.at(-1);
  assert.equal(last.computed, last.prompt.length + last.generated.length - 1);
  assert.equal(last.reason, "长度上限");
});

test("EOS stops without scheduling a forward for the EOS input", () => {
  const events = requestTrace("eos");
  assert.ok(events.every(e => e.computed <= 3 && !e.inFlight));
  assert.deepEqual(events.at(-1).generated, [2]);
  assert.equal(events.at(-1).reason, "EOS");
  assert.equal(events.filter(e => e.stage === "decode").length, 0);
});

test("cancellation prevents future output but keeps in-flight buffers alive", () => {
  const events = requestTrace("cancel");
  const cancelling = events.findIndex(e => e.terminal);
  assert.ok(events[cancelling].inFlight);
  assert.equal(events[cancelling].reserved, 4);
  assert.equal(events[cancelling].released, false);
  assert.deepEqual(events.slice(cancelling).map(e => e.generated), [[41], [41], [41]]);
  assert.ok(events[cancelling + 1].computed === 4 && !events[cancelling + 1].inFlight);
  assert.equal(events.at(-1).reserved, 0);
});

test("release requires a terminal request and all work complete, for every branch", () => {
  for (const scenario of ["length", "eos", "cancel"]) {
    const events = requestTrace(scenario);
    for (const e of events) {
      assert.ok(e.computed <= e.prompt.length + e.generated.length);
      if (e.released) assert.ok(e.terminal && !e.inFlight && e.reserved === 0);
      else assert.ok(e.computed <= e.reserved);
    }
    assert.equal(events.at(-1).released, true);
  }
});
