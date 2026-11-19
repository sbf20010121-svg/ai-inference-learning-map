import test from "node:test";
import assert from "node:assert/strict";
import { allCourses } from "../site/js/course-registry.js";
import {
  renderSystemSpine,
  spineStageForCourse,
  validateSystemSpine,
  spineLocationsForCourse,
  systemSpineStages,
} from "../site/js/system-spine.js";

test("system spine has unique stages and only links registered courses", () => {
  assert.equal(validateSystemSpine(), true);
  for (const course of allCourses) {
    const stage = spineStageForCourse(course.id);
    assert.ok(systemSpineStages.find(s => s.id === stage)?.courses.includes(course.id), course.id);
    assert.equal(spineLocationsForCourse(course.id)[0].id, stage, course.id);
  }
});

test("spine course links open lessons instead of navigating back to the spine", () => {
  for (const stage of systemSpineStages) {
    const html = renderSystemSpine(stage.id);
    for (const id of stage.courses)
      assert.ok(html.includes(`data-spine-open-course="${id}" href="#depth/${id}/L2"`), `${stage.id}/${id}`);
    assert.doesNotMatch(html, /data-spine-course=/);
  }
});

test("runtime, compile/build and GPU execution are distinct navigation lanes", () => {
  const html = renderSystemSpine();
  assert.match(html, /请求运行路径/);
  assert.match(html, /编译与构建路径/);
  assert.match(html, /GPU 执行与性能证据/);
  assert.match(html, /Backend Dispatch/);
  assert.match(html, /预编译库/);
  assert.match(html, /手写 CUDA/);
  assert.match(html, /直接 Triton 不要求先经 Dynamo/);
});

test("sampled token and its KV production are represented as separate events", () => {
  const html = renderSystemSpine("decode");
  assert.match(html, /下一次 Decode 前向作为输入时才产生自己的 KV/);
  assert.match(html, /采样事件和该 Token 的 KV 计算是两个不同事件/);
  assert.match(html, /Scheduler 每轮重新组织 Running \/ Waiting/);
});

test("cross-cutting lenses include data flow, lifecycle, compilation, movement and evidence", () => {
  const html = renderSystemSpine();
  for (const title of [
    "数据流：同一个值经过了哪些变换？",
    "状态生命周期：什么时候产生、更新和释放？",
    "编译转换：同一个程序在各层多了什么信息？",
    "数据移动：数据到底从哪里搬到哪里？",
    "性能证据：每一层结论需要什么证据？",
  ]) assert.ok(html.includes(title), title);
});

test("existing course IDs map to an explainable spine location", () => {
  for (const id of [
    "request-lifecycle",
    "generation-state",
    "token-embedding",
    "transformer-layer",
    "sampling-distribution",
    "attention-patterns",
    "compiler-lowering",
    "moe-route",
    "linear-state",
    "state-families",
  ]) assert.ok(spineStageForCourse(id), id);
  assert.equal(spineStageForCourse("compiler-lowering"), "compile-source");
  assert.equal(spineStageForCourse("moe-route"), "prefill");
  assert.equal(spineStageForCourse("warp-issue"), "kernel-execution");
});
