import { courseNotes } from "./course-notes.js";
import { courseModel } from "./course-models.js";
import { renderCodeTour } from "./code-tour-view.js";
import { curatedRelations } from "./semantic-graph.js";
import { depthById } from "./depth-content.js";
import { featuredMechanisms, mechanismFigure } from "./mechanism-studio.js";
import {
  hasDerivation,
  renderWorkedDerivation,
} from "./mechanism-derivations.js";
const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (v) =>
  typeof v === "number"
    ? Number.isInteger(v)
      ? String(v)
      : Math.abs(v) < 1e-4 && v !== 0
        ? v.toExponential(2)
        : v.toLocaleString("zh-CN", { maximumFractionDigits: 4 })
    : String(v);
const changes = {
  "llm-block": ["Prefill：4个位置", "Decode：1个新位置，历史6"],
  "kv-cache": ["长度5", "长度9"],
  "vllm-scheduler": ["预算8", "预算4"],
  "moe-route": ["追踪Token 0", "追踪Token 3"],
  "pd-disagg": ["上下文2048", "上下文8192"],
  "serving-slo": ["服务2ms", "服务3ms"],
  "compiler-lowering": ["BLOCK=8", "BLOCK=4"],
  "triton-tiling": ["BM=2", "BM=4"],
  "runtime-graph": ["普通Launch", "Graph Replay"],
  "gemm-tiling": ["M=8", "M=1"],
  "attention-tiling": ["观察第一Tile", "观察第二Tile"],
  profiling: ["热点4ms", "热点2ms"],
  "host-runtime": ["串行", "理想双缓冲"],
  "multi-gpu": ["Rank0=[1,2]", "Rank0=[10,20]"],
  "warp-issue": ["只有W0", "加入3条独立Warp"],
  "memory-route": ["stride=1", "stride=8"],
  "tensorcore-b200": ["单缓冲", "双缓冲"],
  "spec-decode": ["草稿接近目标", "草稿偏离目标"],
  "quant-pipeline": ["Scale=0.25", "Scale=0.5"],
  "fused-norm": ["输入[3,4]", "输入[0,0]"],
  "mla-kv": ["Query=[1,2,0]", "Query=[0,1,2]"],
  "linear-state": ["β=0.5", "β=1"],
  "vla-policy": ["推理4节拍", "推理6节拍"],
  "world-model": ["2帧", "4帧"],
  frameworks: ["A无长尾", "A出现长尾"],
};
export function courseStages(id) {
  return courseModel(id).map(({ title }) => ({ title }));
}
const terms = (n) =>
  `<dl class="course-terms" aria-label="变量与专业词汇">${n.terms.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>`;
const scope = (n) =>
  `<p class="course-boundary"><strong>模型边界：</strong>${esc(n.limit)}</p>`;
const toggles = (id, changed) =>
  `<div class="course-conditions" role="group" aria-label="改变实验条件">${changes[id].map((s, i) => `<button type="button" data-course-scenario="${i}" aria-pressed="${Number(changed) === i}">${esc(s)}</button>`).join("")}</div>`;
export function frameFigure(f) {
  let body = "";
  if (f.kind === "delta") {
    const s = f.state;
    const tiny = (m, label) =>
      `<section><strong>${esc(label)}</strong><div class="course-tiny-matrix">${m
        .flat()
        .map((x) => `<span>${esc(fmt(x))}</span>`)
        .join("")}</div><small>行 Key 0/1 · 列 Value 0/1</small></section>`;
    body = `${s.token ? `<p class="course-data-line">${esc(s.token.name)}：k=[${s.token.k.join(", ")}]，v=[${s.token.v.join(", ")}]，q=[${s.token.q.join(", ")}]</p>` : "<p>尚未读入Token，所有状态元素为0。</p>"}<div class="course-delta-matrices">${tiny(s.before, "① 衰减后的旧状态 M")}${tiny(s.write, "③ 残差外积写入 βkδᵀ")}${tiny(s.S, "④ 新状态 S=M+写入")}</div><div class="course-object-rows"><div><strong>② 预测 → 纠错（Value 维向量）</strong><div class="course-slots"><span>kᵀM=[${s.pred.map(fmt).join(", ")}]</span><span>δ=v−kᵀM=[${s.residual.map(fmt).join(", ")}]</span><span>读取 qᵀS=[${s.out.map(fmt).join(", ")}]</span></div></div></div>`;
  } else if (f.kind === "matrix") {
    body = `<div class="course-scroll"><div class="course-matrix" style="--cols:${Math.max(...f.rows.map((r) => r.length)) + 1}" role="table" aria-label="${esc(f.title)}"><div role="row"><small>行/列</small>${f.rows[0].map((_, i) => `<small>${i}</small>`).join("")}</div>${f.rows.map((r, i) => `<div role="row"><small>${i}</small>${r.map((v, j) => `<span role="cell" aria-label="行${i}列${j}：${esc(fmt(v))}" class="${Number(v) === 0 ? "zero" : ""}">${esc(fmt(v))}</span>`).join("")}</div>`).join("")}</div></div>`;
  } else if (f.kind === "metrics") {
    body = `<dl class="course-metrics">${f.rows.map(([label, val]) => `<div><dt>${esc(label)}</dt><dd>${esc(fmt(val))}</dd></div>`).join("")}</dl>`;
  } else if (f.kind === "bars") {
    const max = Math.max(1, ...f.rows.map((r) => Math.abs(r[1])));
    const signed = f.rows.some((r) => r[1] < 0);
    body = `<div class="course-bars">${f.rows.map(([label, val]) => `<div class="course-bar-row"><span>${esc(label)}</span><div class="course-bar-track ${signed ? "signed" : ""}"><i class="${val < 0 ? "negative" : ""}" style="width:${(Math.abs(val) / max) * (signed ? 50 : 100)}%;${signed ? `position:absolute;${val < 0 ? "right" : "left"}:50%;` : ""}"></i></div><b>${esc(fmt(val))}</b></div>`).join("")}</div>${signed ? "<small>中线为0，向左为负、向右为正；同图按绝对值同比例绘制。</small>" : ""}`;
  } else {
    body = `<div class="course-object-rows ${f.kind === "timeline" ? "course-time" : ""}">${f.rows.map(([label, items]) => `<div><strong>${esc(label)}</strong><div class="course-slots">${items.map((v, i) => `<span class="${["空", "wait", "idle", "0×"].includes(String(v)) ? "inactive" : ""}" aria-label="${esc(label)}，位置${i}：${esc(fmt(v))}"><small>${i}</small>${esc(fmt(v))}</span>`).join("")}</div></div>`).join("")}</div>`;
  }
  return `<figure class="course-figure" data-figure-kind="${f.kind}"><h3>${esc(f.title)}</h3>${body}<figcaption>${esc(f.detail || "数据为本页模型的合成计算，不是硬件实测。")}</figcaption></figure>`;
}
function relations(t) {
  return curatedRelations
    .filter((r) => r.from === t.id || r.to === t.id)
    .slice(0, 3)
    .map((r) => {
      const id = r.from === t.id ? r.to : r.from;
      return `<button type="button" data-dtopic="${id}"><strong>${esc(depthById.get(id)?.title || id)}</strong><span>${esc(r.why)}</span></button>`;
    })
    .join("");
}
const gateways = {
  "full-path": [
    ["vllm-scheduler", 0],
    ["vllm-scheduler", 1],
    ["llm-block", 0],
    ["compiler-lowering", 1],
    ["runtime-graph", 0],
    ["warp-issue", 1],
    ["profiling", 1],
  ],
  "transformer-workload": [
    ["llm-block", 0],
    ["llm-block", 2],
    ["llm-block", 1],
    ["fused-norm", 2],
    ["moe-route", 2],
  ],
  "vllm-route": [
    ["vllm-scheduler", 0],
    ["vllm-scheduler", 1],
    ["kv-cache", 2],
    ["llm-block", 3],
    ["serving-slo", 1],
  ],
  "compiler-chain": [
    ["compiler-lowering", 0],
    ["compiler-lowering", 1],
    ["triton-tiling", 0],
    ["compiler-lowering", 2],
    ["runtime-graph", 2],
  ],
  "gpu-pipeline": [
    ["warp-issue", 0],
    ["warp-issue", 1],
    ["warp-issue", 2],
    ["tensorcore-b200", 1],
    ["warp-issue", 3],
  ],
  "gpu-memory": [
    ["memory-route", 3],
    ["tensorcore-b200", 0],
    ["memory-route", 1],
    ["memory-route", 2],
    ["gemm-tiling", 3],
  ],
  "kernel-analysis": [
    ["profiling", 0],
    ["profiling", 1],
    ["gemm-tiling", 3],
    ["profiling", 2],
    ["profiling", 3],
  ],
  "os-runtime": [
    ["host-runtime", 0],
    ["host-runtime", 1],
    ["runtime-graph", 0],
    ["host-runtime", 2],
    ["host-runtime", 3],
  ],
  "vla-head": [
    ["vla-policy", 0],
    ["llm-block", 0],
    ["vla-policy", 0],
    ["vla-policy", 1],
    ["vla-policy", 2],
  ],
  "world-model": [
    ["world-model", 0],
    ["world-model", 1],
    ["world-model", 2],
    ["world-model", 2],
    ["world-model", 3],
  ],
};
export function renderGatewayCase(id, step = 0) {
  const link = gateways[id]?.[step];
  if (!link) return "";
  const [topic, i] = link;
  const n = courseNotes[topic];
  return `<section class="course-content course-gateway"><p class="course-quality">这一环节的具体对象 · 合成教学案例</p>${frameFigure(courseModel(topic)[i])}<p class="course-reason">${esc(n.definition)}</p><button type="button" class="button outline" data-godepth="${topic}">展开机制、变量与推导 →</button></section>`;
}
function exercise(n, answer) {
  const answered = answer !== null && answer !== undefined;
  return `<h3>${esc(n.question)}</h3><div class="focus-answers">${n.options.map((o, i) => `<button type="button" data-f-answer="${i}" aria-pressed="${answer === i}" class="${answered ? (i === n.correct ? "correct" : answer === i ? "wrong" : "") : ""}"><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</button>`).join("")}</div>${answered ? `<div class="focus-check-feedback" aria-live="polite"><strong>${answer === n.correct ? "判断与机制一致" : "对照证据重新判断"}</strong><p>${esc(n.explain)}</p><button type="button" data-f-retry>重做</button></div>` : '<p class="focus-quiet">先解释因果，再选择；答案出现前可以在机制页重放对象状态。</p>'}`;
}
/** No persistence in this module: all records stay owned by the legacy reader. */
export function renderCoursePhase(t, page, settings = {}) {
  const n = courseNotes[t.id];
  if (!n) return null;
  const changed = settings.variant === 1,
    frames = courseModel(t.id, changed),
    step = Math.min(settings.substep || 0, frames.length - 1),
    choice = settings.answer;
  const base = courseModel(t.id, false),
    other = courseModel(t.id, true);
  const comparisonIndex =
    base
      .map((f, i) => (JSON.stringify(f) !== JSON.stringify(other[i]) ? i : -1))
      .filter((i) => i >= 0)
      .at(-1) ?? 0;
  const label = [
    "定义与对象",
    "追踪机制状态",
    "推导与算例",
    "条件改变后的推理",
    "巩固与学习记录",
    "实现依据",
    "证据与验证",
  ][page];
  let content = "";
  if (page === 0)
    content = `<p class="focus-definition">${esc(n.definition)}</p>${frameFigure(frames[0])}<p class="course-reason">${esc(n.reason)}</p>${terms(n)}`;
  if (page === 1)
    content = `<nav class="focus-substeps" aria-label="机制步骤">${frames.map((f, i) => `<button type="button" data-f-sub="${i}" aria-pressed="${i === step}" class="${i === step ? "active" : ""}">${i + 1}. ${esc(f.title)}</button>`).join("")}</nav>${toggles(t.id, changed)}<div aria-live="polite">${frameFigure(frames[step])}</div>${terms(n)}${scope(n)}`;
  if (page === 2)
    content = `<div class="course-math">${n.formula}</div>${terms(n)}<ol class="course-derivation">${n.derive.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p class="focus-quiet">上方为默认条件的手算。下方切换条件，观察同一机制的另一组状态，不将两组数字混算。</p>${toggles(t.id, changed)}<div aria-live="polite">${frameFigure(frames[comparisonIndex])}</div>${scope(n)}`;
  if (page === 3) content = exercise(n, choice);
  if (page === 5)
    content = `<p class="course-reason">${esc(n.reason)}</p><p class="course-evidence"><strong>已核对的依据：</strong>${esc(n.section)}</p><a href="${esc(n.source)}" target="_blank" rel="noopener">核对一手资料与实现边界 ↗</a><pre class="course-code"><code>${esc(n.code)}</code></pre><p class="focus-quiet">以上为本项目重写的教学执行骨架，不是可运行框架API、真实IR dump或设备指令。${esc(n.limit)}</p><details class="focus-expand"><summary>原有分阶段代码导读与更多入口（保留）</summary>${renderCodeTour(t, settings.sourceIndex || 0)}</details>${terms(n)}`;
  if (page === 6)
    content = `<p class="focus-definition">先用反事实区分机制是否成立，再设计设备实验。</p>${toggles(t.id, changed)}<div aria-live="polite">${frameFigure(frames[comparisonIndex])}</div><details class="focus-expand"><summary>展开两种条件的状态证据</summary><div class="course-comparison">${[0, 1].map((i) => `<section><h3>${esc(changes[t.id][i])}</h3>${frameFigure(courseModel(t.id, !!i)[comparisonIndex])}</section>`).join("")}</div></details><h3>需要检验的因果链</h3><p>${esc(n.explain)}</p><h3>真实验证怎样接上</h3><p>${esc(n.experiment)}</p><p class="course-boundary">页面已计算的是教学状态。没有真实Trace/编译产物/设备测量时，不标记为源码审计或性能验证完成。</p>${scope(n)}`;
  if (page === 1 && featuredMechanisms[t.id])
    content += `<details class="focus-expand"><summary>展开完整机制图与另一种视角（原有实验保留）</summary>${mechanismFigure(t.id, Math.min(step, featuredMechanisms[t.id].steps.length - 1), 0)}</details>`;
  if (page === 2 && hasDerivation(t.id))
    content += `<details class="focus-expand"><summary>原有推导与另一组算例（数据可能不同，请勿混算）</summary>${renderWorkedDerivation(t.id)}</details>`;
  if (page === 4) return null;
  return `<section class="focus-content course-content"><div class="focus-question">${esc(label)}</div><p class="course-quality">机制与计算教学 · ${page === 5 ? "实现入口核对，非完整源码审计" : "合成案例，非性能实测"}</p>${content}${page === 0 ? `<details class="focus-expand"><summary>本节与上下游为何相连</summary><div class="course-relations">${relations(t)}</div></details>` : ""}</section>`;
}
