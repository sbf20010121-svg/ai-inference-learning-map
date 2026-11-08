import {
  allCourses as depthTopics,
  allCourseById as depthById,
} from "./course-registry.js";
/**
 * 深度知识图谱：主地图之下的二/三级机制与实验，不引入额外服务。
 * DOM 交互、离线小实验、学习记录；深度资料定义于 depth-content.js。
 */
import {
  depthModules,
  depthTopics as legacyDepthTopics,
  depthPaths,
  validateDepthData,
} from "./depth-content.js";
import { coverageHTML, auditState } from "./coverage-ui.js";
import { reasoningHTML, handleReasoning } from "./reasoning.js";
import {
  visualHTML,
  inlineImplementation,
  handleVisualClick,
  validateVisualKnowledge,
} from "./visual-atlas.js";
import {
  handleMechanismStudioClick,
  featuredMechanismIds,
  featuredMechanisms,
} from "./mechanism-studio.js";
import { renderFocusReader, normalizeReaderRecord } from "./focus-reader.js";
import { renderCodeTour } from "./code-tour-view.js";
import { courseStages } from "./course-reader.js";
import {
  chaptersFor,
  chapterById,
  resolveChapter,
} from "./mechanism-curriculum.js";
import { defaultLab, changeLab } from "./mechanism-visuals.js";
validateDepthData();
validateVisualKnowledge(legacyDepthTopics);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const MODCOLORS = {
  model: "#8354b1",
  engine: "#287fa0",
  compiler: "#b47731",
  kernel: "#138b81",
  systems: "#5c769b",
  microarch: "#c37757",
};
const DEPTH_STORE = "ai-inference-depth-progress-v1";
const RESUME_STORE = "ai-inference-last-topic-v1";
const MODE_STORE = "ai-inference-reader-mode-v1";
const LEVELS = ["L2", "L3", "L4"];
const state = {
  topic: "pd-disagg",
  level: "L2",
  stage: 0,
  choice: null,
  query: "",
  route: "deploy",
  progress: load(),
  controlCache: {},
  focusMode: loadMode(),
  readerStep: 0,
  substep: 0,
  variant: 0,
  sourceIndex: 0,
  focusAnswer: null,
  moeToken: 0,
  moeStage: "router",
  chapter: "",
  mechanismLabs: {},
};
function loadMode() {
  return "focus";
} // New chapters supersede the old presentation choice; no learning data is changed.
export function resumeDepthHash() {
  try {
    const id = localStorage.getItem(RESUME_STORE);
    return "depth/" + (id && depthById.has(id) ? id : "pd-disagg") + "/L2";
  } catch {
    return "depth/pd-disagg/L2";
  }
}
function load() {
  try {
    return cleanProgress(JSON.parse(localStorage.getItem(DEPTH_STORE) || "{}"));
  } catch {
    return {};
  }
}
function cleanProgress(obj) {
  const result = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return result;
  for (const t of depthTopics) {
    const v = obj[t.id];
    if (!v || typeof v !== "object") continue;
    result[t.id] = {
      status: ["new", "learning", "known", "review"].includes(v.status)
        ? v.status
        : "new",
      note: typeof v.note === "string" ? v.note.slice(0, 2500) : "",
      completed: LEVELS.filter(
        (l) => Array.isArray(v.completed) && v.completed.includes(l),
      ),
      ...normalizeReaderRecord(v),
    };
  }
  return result;
}
function save() {
  try {
    localStorage.setItem(DEPTH_STORE, JSON.stringify(state.progress));
  } catch {}
  window.dispatchEvent(new Event("atlas:changed"));
}
const topicStatus = (id) => state.progress[id]?.status || "new";
const topicStatusLabel = (id) =>
  ({ new: "未开始", learning: "学习中", known: "已理解", review: "待验证" })[
    topicStatus(id)
  ];
const moduleName = (id) => depthModules.find((m) => m.id === id)?.name || id;
const current = () => depthById.get(state.topic) || depthTopics[0];
export function exportDepthProgress() {
  return cleanProgress(state.progress);
}
export function importDepthProgress(raw) {
  state.progress = cleanProgress(raw);
  save();
  if ($("#depthContent")) renderDepthAtlas();
  return Object.keys(state.progress).length;
}
export function goDepth(id = "pd-disagg", level = "L2", chapter = "") {
  if (!depthById.has(id)) id = "pd-disagg";
  if (!LEVELS.includes(level)) level = "L2";
  state.topic = id;
  state.level = level;
  state.stage = 0;
  state.choice = null;
  state.query = "";
  state.substep = 0;
  state.variant = 0;
  state.sourceIndex = 0;
  state.focusAnswer = null;
  const match = depthPaths.find((p) => p.ids.includes(id));
  if (match && !depthPaths.find((p) => p.id === state.route)?.ids.includes(id))
    state.route = match.id;
  const rec = state.progress[id] || {
    status: "new",
    completed: [],
    note: "",
    readerStep: 0,
    seenSteps: [],
  };
  state.readerStep =
    level === "L3" ? 5 : level === "L4" ? 6 : (rec.readerStep ?? 0);
  state.substep = state.readerStep === 1 ? (rec.readerSubstep ?? 0) : 0;
  if (rec.status === "new") state.progress[id] = { ...rec, status: "learning" };
  state.chapter = resolveChapter(id, rec, level, chapter);
  if (!state.mechanismLabs[id]) state.mechanismLabs[id] = defaultLab();
  const initial = chapterById(id, state.chapter);
  if (initial?.initial) Object.assign(state.mechanismLabs[id], initial.initial);
  if (initial?.startIR !== undefined)
    state.mechanismLabs[id].ir = initial.startIR;
  if (initial?.startKV !== undefined)
    state.mechanismLabs[id].kvStep = initial.startKV;
  markMechanismSeen();
  try {
    localStorage.setItem(RESUME_STORE, id);
  } catch {}
  renderDepthAtlas();
}
const toHash = (id, level = "L2") => {
  location.hash = "depth/" + id + "/" + level;
};
function recFor(id = state.topic) {
  return (
    state.progress[id] || {
      status: "learning",
      completed: [],
      note: "",
      readerStep: 0,
      seenSteps: [],
    }
  );
}
function markCurrentSeen() {
  const rec = recFor();
  rec.readerStep = state.readerStep;
  rec.readerSubstep = state.substep;
  if (state.readerStep === 1)
    rec.seenSubsteps = [
      ...new Set([...(rec.seenSubsteps || []), state.substep]),
    ].sort((a, b) => a - b);
  rec.seenSteps = [
    ...new Set([...(rec.seenSteps || []), state.readerStep]),
  ].sort((a, b) => a - b);
  state.progress[state.topic] = rec;
  save();
}
function showFocus() {
  renderDepthAtlas();
  const box = $("#focusReader");
  if (box) {
    const top = box.getBoundingClientRect().top + window.scrollY - 86;
    if (window.scrollY > top + 140 || window.scrollY < top - 140)
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }
}
function setFocusPage(n) {
  state.readerStep = Math.max(0, Math.min(6, n));
  state.level =
    state.readerStep === 5 ? "L3" : state.readerStep === 6 ? "L4" : "L2";
  state.focusAnswer = null;
  state.substep = 0;
  state.sourceIndex = 0;
  markCurrentSeen();
  history.replaceState(null, "", "#depth/" + state.topic + "/" + state.level);
  showFocus();
}
function markMechanismSeen() {
  const rec = recFor();
  const old = rec.mechanismReading || { version: 1, last: "", seen: [] };
  rec.mechanismReading = {
    version: 1,
    last: state.chapter,
    seen: [...new Set([...old.seen, state.chapter])],
  };
  state.progress[state.topic] = rec;
  save();
}
function setMechanismChapter(id) {
  if (!chapterById(state.topic, id)) return;
  state.chapter = id;
  state.focusAnswer = null;
  const ch = chapterById(state.topic, id);
  if (ch.initial) Object.assign(state.mechanismLabs[state.topic], ch.initial);
  if (ch.startIR !== undefined)
    state.mechanismLabs[state.topic].ir = ch.startIR;
  if (ch.startKV !== undefined)
    state.mechanismLabs[state.topic].kvStep = ch.startKV;
  markMechanismSeen();
  history.replaceState(null, "", `#depth/${state.topic}/L2/${id}`);
  showFocus();
  document.querySelector("#mechanismQuestion")?.focus({ preventScroll: true });
}
function refreshMechanism() {
  const y = window.scrollY;
  const focused = document.activeElement;
  const identity = focused?.hasAttribute("data-mech-key")
    ? `[data-mech-key="${focused.dataset.mechKey}"][data-mech-value="${focused.dataset.mechValue}"]`
    : focused?.hasAttribute("data-f-answer")
      ? `[data-f-answer="${focused.dataset.fAnswer}"]`
      : focused?.hasAttribute("data-f-retry")
        ? '[data-f-answer="0"]'
        : null;
  const open = [...document.querySelectorAll(".mechanism-reader details[open]")]
    .map((d) => d.className)
    .filter(Boolean);
  renderDepthAtlas();
  for (const cls of open) {
    const el = document.querySelector("." + cls.split(" ").join("."));
    if (el) el.open = true;
  }
  window.scrollTo({ top: y, behavior: "instant" });
  if (identity)
    document.querySelector(identity)?.focus({ preventScroll: true });
}
function handleFocusClick(el) {
  if (el.hasAttribute("data-mech-chapter")) {
    setMechanismChapter(el.dataset.mechChapter);
    return true;
  }
  if (el.hasAttribute("data-mech-next") || el.hasAttribute("data-mech-prev")) {
    const chapters = chaptersFor(state.topic),
      i = chapters.findIndex((c) => c.id === state.chapter),
      next = chapters[i + (el.hasAttribute("data-mech-next") ? 1 : -1)];
    if (next) setMechanismChapter(next.id);
    return true;
  }
  if (el.hasAttribute("data-mech-key")) {
    state.mechanismLabs[state.topic] = changeLab(
      state.mechanismLabs[state.topic] || defaultLab(),
      el.dataset.mechKey,
      el.dataset.mechValue,
    );
    refreshMechanism();
    return true;
  }

  if (el.hasAttribute("data-code-phase")) {
    const n = Number(el.dataset.codePhase);
    state.sourceIndex = Math.max(0, Number.isFinite(n) ? n : 0);
    const active = document.querySelector("#codeTourRoot");
    if (active) active.outerHTML = renderCodeTour(current(), state.sourceIndex);
    else if (state.focusMode === "focus") showFocus();
    else renderDepthAtlas();
    return true;
  }
  if (el.hasAttribute("data-f-reference")) {
    state.focusMode = "reference";
    try {
      localStorage.setItem(MODE_STORE, "reference");
    } catch {}
    renderDepthAtlas();
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  }
  if (el.hasAttribute("data-f-focus")) {
    state.focusMode = "focus";
    try {
      localStorage.setItem(MODE_STORE, "focus");
    } catch {}
    showFocus();
    return true;
  }
  if (state.focusMode !== "focus") return false;
  if (el.hasAttribute("data-course-scenario")) {
    state.variant = Number(el.dataset.courseScenario);
    showFocus();
    return true;
  }
  if (state.topic === "moe-route" && el.hasAttribute("data-moe-token")) {
    state.moeToken = Number(el.dataset.moeToken);
    showFocus();
    return true;
  }
  if (state.topic === "moe-route" && el.hasAttribute("data-moe-stage")) {
    state.moeStage = el.dataset.moeStage;
    showFocus();
    return true;
  }
  if (el.hasAttribute("data-f-page")) {
    setFocusPage(Number(el.dataset.fPage));
    return true;
  }
  if (el.hasAttribute("data-f-next")) {
    if (
      state.readerStep === 1 &&
      state.substep < courseStages(state.topic).length - 1
    ) {
      state.substep++;
      markCurrentSeen();
      showFocus();
    } else {
      setFocusPage(state.readerStep === 6 ? 0 : state.readerStep + 1);
    }
    return true;
  }
  if (el.hasAttribute("data-f-prev")) {
    if (state.readerStep === 1 && state.substep > 0) {
      state.substep--;
      markCurrentSeen();
      showFocus();
    } else if (state.readerStep > 0) {
      setFocusPage(state.readerStep - 1);
    }
    return true;
  }
  if (el.hasAttribute("data-f-sub")) {
    state.substep = Number(el.dataset.fSub);
    markCurrentSeen();
    showFocus();
    return true;
  }
  if (el.hasAttribute("data-f-variant")) {
    state.variant = Number(el.dataset.fVariant);
    showFocus();
    const details = $("#focusFullDiagram");
    if (details) details.open = true;
    return true;
  }
  if (el.hasAttribute("data-f-answer")) {
    state.focusAnswer = Number(el.dataset.fAnswer);
    refreshMechanism();
    return true;
  }
  if (el.hasAttribute("data-f-retry")) {
    state.focusAnswer = null;
    refreshMechanism();
    return true;
  }
  if (el.hasAttribute("data-f-source")) {
    state.sourceIndex = Number(el.dataset.fSource);
    showFocus();
    return true;
  }
  if (el.hasAttribute("data-f-mark")) {
    const rec = recFor();
    rec.status = el.dataset.fMark;
    state.progress[state.topic] = rec;
    save();
    refreshMechanism();
    return true;
  }
  return false;
}

const searchMatches = (t) =>
  !state.query ||
  [t.title, t.summary, t.question, t.module, t.id, moduleName(t.module)]
    .join(" ")
    .toLowerCase()
    .includes(state.query.toLowerCase());
function pathBar() {
  return `<div class="deep-paths" role="group" aria-label="选择跨模块学习路径">${depthPaths.map((route) => `<button type="button" class="deep-route ${route.id === state.route ? "active" : ""}" data-dpath="${route.id}" aria-pressed="${route.id === state.route}"><strong>${esc(route.name)}</strong><span>${esc(route.subtitle)}</span><small>${route.ids.length} 站 · 点击切换</small></button>`).join("")}</div>`;
}
function tree() {
  const total = depthTopics.length,
    done = depthTopics.filter((t) => topicStatus(t.id) === "known").length;
  return `<aside class="deep-catalog" aria-label="深度图谱目录"><div class="deep-catalog-head"><div><span class="eyebrow">六大领域 · 二级专题</span><h2>往下钻的目录</h2></div><span class="deep-count">${done}/${total} 已理解</span></div><label class="deep-search"><span aria-hidden="true">⌕</span><input id="deepSearch" value="${esc(state.query)}" placeholder="搜索：PD、MLA、编译、VLA…" aria-label="搜索深度专题"/></label>${depthModules
    .map((m) => {
      const topics = depthTopics.filter(
        (t) => t.module === m.id && searchMatches(t),
      );
      if (!topics.length) return "";
      const active = topics.some((t) => t.id === state.topic);
      return `<details class="deep-group" ${active || state.query ? "open" : ""}><summary><span class="deep-mod-dot" style="--dm:${MODCOLORS[m.id]}"></span><strong>${esc(m.name)}</strong><span>${topics.length} 节</span></summary><p class="deep-group-intro">${esc(m.question)}</p>${topics.map((t) => `<button type="button" class="deep-tree-item ${t.id === state.topic ? "active" : ""}" data-dtopic="${t.id}" aria-current="${t.id === state.topic ? "true" : "false"}"><span>${esc(t.title)}</span><small>${esc(t.depth)} · ${esc(topicStatusLabel(t.id))}</small></button>`).join("")}</details>`;
    })
    .join(
      "",
    )}<div class="deep-safety">公开知识用于理解 B200；自研芯片的内部文档、参数和性能数据仅在公司内网学习。</div></aside>`;
}
const moduleQuestion = (t) =>
  depthModules.find((m) => m.id === t.module)?.question || "";
function flowHTML(t) {
  return `<div class="deep-flow" role="group" aria-label="交互式机制流程图">${t.stage.map((s, i) => `<div class="deep-flow-cell"><button type="button" data-dstage="${i}" class="deep-flow-node ${state.stage === i ? "selected" : ""}" aria-pressed="${state.stage === i}"><span>0${i + 1}</span><strong>${esc(s.title)}</strong><small>${esc(s.data)}</small></button>${i < t.stage.length - 1 ? '<div class="deep-flow-arrow" aria-hidden="true">→</div>' : ""}</div>`).join("")}</div>`;
}
function stageDetail(t) {
  const s = t.stage[state.stage];
  return `<div class="deep-stage-detail"><div class="deep-stage-heading"><span>第 ${state.stage + 1}/${t.stage.length} 站 · 点击上方节点可切换</span><div><button type="button" data-dprev ${state.stage === 0 ? "disabled" : ""}>← 上一步</button><button type="button" data-dnext ${state.stage === t.stage.length - 1 ? "disabled" : ""}>下一步 →</button></div></div><h3>${esc(s.title)}</h3><div class="deep-inspection-grid"><div class="deep-inspection"><small>数据从哪来到哪去</small><p>${esc(s.data)}</p></div><div class="deep-inspection"><small>这一环节如何工作</small><p>${esc(s.mechanism)}</p></div><div class="deep-inspection"><small>性能要看什么</small><p>${esc(s.metric)}</p></div><div class="deep-inspection warning"><small>容易误判的地方</small><p>${esc(s.trap)}</p></div></div></div>`;
}
function mechanismPage(t) {
  return `<section class="deep-teach"><div class="deep-section-top"><span>L2 · 工作机制</span><h3>${esc(t.question)}</h3><p>${esc(t.analogy)}</p></div>${flowHTML(t)}${stageDetail(t)}<div class="deep-full-mechanism"><h4>完整机制速览：四步都在本页</h4><div class="deep-full-grid">${t.stage.map((s, i) => `<div><small>${String(i + 1).padStart(2, "0")} / ${esc(s.title)}</small><p>${esc(s.mechanism)}</p></div>`).join("")}</div></div><div class="deep-points">${t.insights.map((v, i) => `<div><span>机制 ${String(i + 1).padStart(2, "0")}</span><p>${esc(v)}</p></div>`).join("")}</div><p class="deep-caption">上方是教学抽象；真实模型和框架可能包含更多分支、并行及重叠行为。</p></section>`;
}
function implementationPage(t) {
  return `<section class="deep-teach"><div class="deep-section-top"><span>L3 · 源码与实际执行</span><h3>从逻辑走到代码：每段操作改变什么？</h3><p>这是原创教学伪代码，不是对外部仓库的逐行复刻。点代码阶段查看张量、状态与代价；下方有可核对的实际源码入口。</p></div>${renderCodeTour(t, state.sourceIndex)}<details class="deep-reference-details"><summary>可选：传统实现模块归纳</summary>${inlineImplementation(t)}</details></section>`;
}
export const depthLabDefinitions = {
  pd: {
    title: "KV 传输理论下界",
    intro:
      "把 KV 当作不压缩、无重叠的理想传输。调整上下文和带宽，理解为什么长上下文会带来新的转运成本。",
    controls: [
      ["seq", "输入 Token 数", 512, 8192, 512, 4096, "tokens"],
      ["layers", "层数", 8, 80, 8, 32, "层"],
      ["heads", "KV Head 数", 1, 32, 1, 8, "个"],
      ["bw", "有效传输带宽", 10, 400, 10, 100, "GB/s"],
    ],
  },
  kv: {
    title: "KV Cache 体积估算",
    intro:
      "以每元素 2 字节、HeadDim=128、K/V 各一份为教学假设，比较上下文/Heads 对显存的影响。",
    controls: [
      ["seq", "历史 Token 数", 512, 16384, 512, 4096, "tokens"],
      ["layers", "层数", 8, 80, 8, 32, "层"],
      ["heads", "KV Head 数", 1, 32, 1, 8, "个"],
      ["qheads", "Query Head 数", 32, 64, 8, 32, "个"],
    ],
  },
  tokens: {
    title: "单轮 Token Budget 简化模型",
    intro:
      "教学模型：假定已有 Decode 请求各申请 1 Token，剩余预算可给长 Prompt。真实 vLLM 调度还考虑状态、Cache、优先级等。",
    controls: [
      ["budget", "每轮 Token Budget", 256, 8192, 256, 2048, "tokens"],
      ["active", "现有 Decode 请求", 0, 512, 32, 64, "条"],
      ["prompt", "新请求 Prompt 长度", 512, 16384, 512, 4096, "tokens"],
    ],
  },
  tiling: {
    title: "Triton GEMM 的 Program 网格",
    intro:
      "仅计算 2D 输出 Tile 个数和理论算术量；不预测真实 Occupancy、缓存命中或 Kernel 耗时。",
    controls: [
      ["m", "M", 256, 8192, 256, 4096, ""],
      ["n", "N", 256, 8192, 256, 4096, ""],
      ["bm", "BLOCK_M", 16, 256, 16, 64, ""],
      ["bn", "BLOCK_N", 16, 256, 16, 128, ""],
    ],
  },
  vla: {
    title: "动作网络迭代与响应周期",
    intro:
      "示意总延迟 = 视觉和系统固定耗时 + Action Expert 多次前向；真实系统可能缓存或重叠。",
    controls: [
      ["steps", "动作生成迭代", 1, 16, 1, 8, "次"],
      ["cost", "每次动作头前向", 2, 40, 2, 16, "ms"],
      ["vision", "视觉 / 其它开销", 5, 120, 5, 30, "ms"],
      ["budget", "动作更新预算", 20, 300, 20, 160, "ms"],
    ],
  },
  world: {
    title: "时空 Token 与全局 Attention 规模",
    intro:
      "假设每帧 P 个 Token，F 帧展开为 N=F×P；全局注意力的 token 对数量约为 N²。",
    controls: [
      ["frames", "帧数 F", 1, 32, 1, 8, "帧"],
      ["patch", "每帧 Patch 数 P", 16, 576, 4, 196, "个"],
    ],
  },
  amdahl: {
    title: "热点 Kernel 优化的系统加速上限",
    intro:
      "Amdahl 简化模型：非热点时间不变、热点串行加速。现实系统的并行与重叠可能使估计不适用。",
    controls: [
      ["pct", "热点原先时间占比", 5, 95, 5, 40, "%"],
      ["speed", "热点提升倍数", 1, 10, 0.5, 3, "×"],
      ["base", "原始端到端时间", 2, 50, 2, 10, "ms"],
    ],
  },
  warp: {
    title: "Warp 等待与空泡的极简演示",
    intro:
      "假设 1 个发射槽、每个 Warp 有一条独立可发射指令。用它解释“更多就绪 Warp 可能掩盖等待”，不是 B200 模拟器。",
    controls: [
      ["wait", "等待窗口", 4, 32, 2, 16, "周期"],
      ["warps", "可就绪的其他 Warp", 0, 32, 2, 8, "个"],
    ],
  },
  bandwidth: {
    title: "理想搬运下界 vs 实际开销",
    intro:
      "仅计算数据体积/有效带宽的理论时间；实际还受事务、cache、排队、依赖和指令吞吐限制。",
    controls: [
      ["mb", "需传输的数据量", 64, 2048, 64, 512, "MB"],
      ["bw", "理想带宽", 20, 500, 20, 200, "GB/s"],
      ["eff", "实际带宽效率", 10, 100, 5, 60, "%"],
    ],
  },
};
function defaultVals(type) {
  return Object.fromEntries(
    (depthLabDefinitions[type]?.controls || []).map((x) => [x[0], x[5]]),
  );
}
function readVals(t) {
  if (!state.controlCache[t.id]) state.controlCache[t.id] = defaultVals(t.lab);
  return state.controlCache[t.id];
}
const fm = (n, d = 1) =>
  Number(n).toLocaleString("zh-CN", { maximumFractionDigits: d });
export function computeLab(type, v) {
  const mb = (x) => x / 1e6,
    ms = (bytes, gb) => (bytes / (gb * 1e9)) * 1000;
  switch (type) {
    case "pd": {
      const bytes = 2 * v.layers * v.heads * 128 * v.seq * 2;
      return [
        ["KV 体积（假设 BF16，HeadDim=128）", fm(mb(bytes)) + " MB"],
        ["理想传输下界", fm(ms(bytes, v.bw), 3) + " ms"],
        ["如果实际带宽仅一半", fm(ms(bytes, v.bw / 2), 3) + " ms"],
      ];
    }
    case "kv": {
      const b = 2 * v.layers * v.heads * 128 * v.seq * 2;
      const m = 2 * v.layers * v.qheads * 128 * v.seq * 2;
      return [
        ["KV Cache 总量（单条序列）", fm(mb(b)) + " MB"],
        ["如果使用同样 HeadDim 的 MHA", fm(mb(m)) + " MB"],
        ["相对 MHA 的 KV 体积", fm((b / m) * 100) + "%"],
      ];
    }
    case "tokens": {
      const remain = Math.max(0, v.budget - v.active),
        runs = remain ? Math.ceil(v.prompt / remain) : Infinity;
      return [
        ["留给新 Prefill 的预算", fm(remain, 0) + " tokens"],
        [
          "理论最少 Prefill 轮数",
          Number.isFinite(runs) ? fm(runs, 0) + " 轮" : "当前无剩余预算",
        ],
        [
          "每轮 Decode 占用比例",
          fm(Math.min(1, v.active / v.budget) * 100) + "%",
        ],
      ];
    }
    case "tiling": {
      const blocks = Math.ceil(v.m / v.bm) * Math.ceil(v.n / v.bn);
      const flops = 2 * v.m * v.n * 4096;
      return [
        ["输出网格 Program 数", fm(blocks, 0)],
        ["单 Program 输出元素", fm(v.bm * v.bn, 0)],
        ["假设 K=4096，理论 GEMM 运算量", fm(flops / 1e9) + " GFLOPs"],
      ];
    }
    case "vla": {
      const total = v.vision + v.steps * v.cost;
      return [
        ["估计一次动作生成总耗时", fm(total) + " ms"],
        [
          "相对于更新预算",
          total <= v.budget ? "理论上满足预算" : "理论上超出预算",
        ],
        ["动作头占总时间", fm(((v.steps * v.cost) / total) * 100) + "%"],
      ];
    }
    case "world": {
      const n = v.frames * v.patch;
      return [
        ["时空 Token 总数 N", fm(n, 0)],
        ["全局 Attention Token 对（N²）", fm(n * n, 0)],
        ["如果帧数翻倍，理论 Token 对倍率", "约 4×"],
      ];
    }
    case "amdahl": {
      const f = v.pct / 100,
        after = v.base * (1 - f + f / v.speed);
      return [
        ["优化后的总时间", fm(after, 2) + " ms"],
        ["系统级加速比", fm(v.base / after, 2) + "×"],
        ["总时间减少", fm(v.base - after, 2) + " ms"],
      ];
    }
    case "warp": {
      const used = Math.min(v.wait, v.warps);
      return [
        ["其它 Warp 可填补的发射槽", fm(used, 0) + " / " + fm(v.wait, 0)],
        ["此玩具模型仍有空泡", fm(Math.max(0, v.wait - used), 0) + " 周期"],
        ["主要机制", "等待 Warp ≠ 无 Warp 可发射"],
      ];
    }
    case "bandwidth": {
      const bytes = v.mb * 1e6;
      return [
        ["理想传输下界", fm(ms(bytes, v.bw), 2) + " ms"],
        [
          "按设定效率得到的搬运时间",
          fm(ms(bytes, (v.bw * v.eff) / 100), 2) + " ms",
        ],
        ["与理想下界相比", fm(100 / v.eff, 2) + "×"],
      ];
    }
    default:
      return [];
  }
}
function labHTML(t) {
  if (!t.lab)
    return `<div class="deep-no-lab"><strong>这一节目前还没有可信的参数小实验。</strong><p>先用下面的实验设计和真实源码建立证据，不用伪造的互动结果替代实测。</p></div>`;
  const conf = depthLabDefinitions[t.lab],
    v = readVals(t),
    outputs = computeLab(t.lab, v);
  return `<details class="reason-formula"><summary>可选：公式与数量级推导（不代替上面的证据实训）</summary><div class="deep-lab"><div class="deep-lab-head"><span>公式辅助工具 · 非实训、非实测</span><h4>${esc(conf.title)}</h4><p>${esc(conf.intro)}</p></div><div class="deep-slider-grid">${conf.controls.map(([id, label, min, max, step, def, unit]) => `<label class="deep-slider"><span>${esc(label)}</span><strong id="dval-${id}">${fm(v[id])} ${esc(unit)}</strong><input type="range" data-dslider="${id}" min="${min}" max="${max}" step="${step}" value="${v[id]}" /></label>`).join("")}</div><div class="deep-lab-results" id="deepLabResults">${outputs.map(([label, val]) => `<div><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`).join("")}</div><p class="deep-lab-foot">数字仅帮助理解量纲与理论关系，不代表真实性能或可靠部署判断。</p></div></details>`;
}
function refreshLab() {
  const t = current();
  if (!t.lab) return;
  const conf = depthLabDefinitions[t.lab],
    vals = readVals(t);
  for (const [id, , , , , unit] of conf.controls) {
    const out = $("#dval-" + id);
    if (out) out.textContent = fm(vals[id]) + " " + unit;
  }
  const el = $("#deepLabResults");
  if (el)
    el.innerHTML = computeLab(t.lab, vals)
      .map(
        ([label, val]) =>
          `<div><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`,
      )
      .join("");
}
function experimentPage(t) {
  const ex = t.experiment;
  return `<section class="deep-teach"><div class="deep-section-top"><span>L4 · 优化与验证</span><h3>先建立性能假设，再用实验推翻或验证</h3><p>${esc(ex.goal)}</p></div>${reasoningHTML(t.id)}${labHTML(t)}<div class="deep-experiment-grid"><div><small>控制变量</small><p>${esc(ex.controls)}</p></div><div><small>必须记录的指标</small><p>${esc(ex.metrics)}</p></div><div><small>正确性与公平性</small><p>${esc(ex.validation)}</p></div></div><div class="deep-experiment-template"><strong>实测记录模板（复制后在真实环境填写）</strong><button class="deep-copy" type="button" data-dcopy="experiment">复制实验模板</button><p>模型/Kernel 版本 · 硬件与驱动 · 输入 Shape/dtype · Warmup · 同步方式 · 对照组 · 正确性 · P50/P99 · NCU/NSYS 证据 · 结论/反证</p></div></section>`;
}
function quiz(t) {
  const [q, choices, correct, why] = t.quiz;
  return `<div class="deep-quiz"><div class="deep-section-top"><span>理解检验</span><h3>${esc(q)}</h3></div><div class="deep-choices">${choices.map((ch, i) => `<button class="deep-choice ${state.choice !== null ? (i === correct ? "correct" : i === state.choice ? "wrong" : "") : ""}" data-dchoice="${i}" aria-pressed="${state.choice === i}">${String.fromCharCode(65 + i)} · ${esc(ch)}</button>`).join("")}</div>${state.choice !== null ? `<div class="deep-quiz-answer"><strong>${state.choice === correct ? "判断正确。" : "这个判断不够准确。"}</strong><p>${esc(why)}</p></div>` : ""}</div>`;
}
function relationReason(src, dst) {
  const target = depthById.get(dst);
  if (!target) return "";
  const map = {
    "pd-disagg|kv-cache":
      "PD 传输的是请求计算出的历史 KV；先理解缓存组织才能理解传输成本。",
    "pd-disagg|vllm-scheduler":
      "P/D 各自仍需要调度 Token 和管理 KV，两套机制不是一回事。",
    "pd-disagg|multi-gpu": "跨实例 KV 搬运依赖设备间通信与带宽。",
    "compiler-lowering|triton-tiling":
      "编译链决定 Tile/布局怎样被映射为最终设备指令。",
    "vla-policy|world-model":
      "前者通常输出动作，后者预测环境演化；两者可以合作但职责不同。",
    "profiling|warp-issue": "用 NCU 中的发射/等待证据解释热点的硬件行为。",
    "memory-route|kv-cache":
      "GPU KV Cache 的逻辑组织最终必须落实到真实的 GPU 访存。",
  };
  return (
    map[src + "|" + dst] ||
    map[dst + "|" + src] ||
    `从“${current().title}”继续延伸到“${target.title}”，对照模型负载、系统调度与硬件执行。`
  );
}
function contentHTML(t) {
  const mod = depthModules.find((m) => m.id === t.module);
  return `<article class="deep-article"><div class="deep-breadcrumb"><button type="button" data-dmap>知识地图</button><span>›</span><span>${esc(mod.name)}</span><span>›</span><strong>${esc(t.title)}</strong></div><div class="deep-article-head"><span class="deep-topic-tag" style="--dm:${MODCOLORS[t.module]}">${esc(mod.name)} · ${esc(t.depth)} 深度</span><h2>${esc(t.title)}</h2><p>${esc(t.summary)}</p><div class="deep-relation-inline"><span>与原地图的关系</span><button type="button" data-dparent="${esc(t.parent)}">返回对应的 L1 概览课 ↗</button></div></div>${visualHTML(t)}<div class="deep-levels" role="tablist" aria-label="选择学习深度">${LEVELS.map((lv, i) => `<button type="button" role="tab" data-dlevel="${lv}" aria-selected="${state.level === lv}" class="${state.level === lv ? "active" : ""}"><span>${lv}</span><strong>${["工作机制", "源码与执行", "实验与优化"][i]}</strong></button>`).join("")}</div><div id="deepTeachArea">${state.level === "L2" ? mechanismPage(t) : state.level === "L3" ? implementationPage(t) : experimentPage(t)}</div>${quiz(t)}<div class="deep-bridge"><div><small>跨模块继续学习 · 解释知识为什么相连</small><h3>从这个机制继续往哪看？</h3></div><div class="deep-bridge-links">${t.related
    .map((id) => {
      const r = depthById.get(id);
      return `<button type="button" data-dtopic="${id}"><span>${esc(moduleName(r.module))}</span><strong>${esc(r.title)} ↗</strong><small>${esc(relationReason(t.id, id))}</small></button>`;
    })
    .join(
      "",
    )}</div></div><div class="deep-sources"><h4>可核查的公开资料</h4>${t.refs.map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`).join("")}</div><div class="deep-study-state"><div><h4>学习进度与笔记</h4><p>标记自己的掌握情况，不自动判断你已具备真实工程能力。</p><div class="deep-progress-buttons">${[
    ["learning", "学习中"],
    ["known", "已理解"],
    ["review", "待验证"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-dstatus="${id}" class="${topicStatus(t.id) === id ? "active" : ""}">${label}</button>`,
    )
    .join(
      "",
    )}</div></div><label>我的问题与验证计划<textarea id="deepNote" maxlength="2500" placeholder="例如：我还不理解 KV Connector 何时释放 P 端的 Block……">${esc(state.progress[t.id]?.note || "")}</textarea></label></div></article>`;
}
function routeMini() {
  const route = depthPaths.find((x) => x.id === state.route) || depthPaths[0];
  return `<div class="deep-path-flow"><span class="deep-path-label">当前串联路径 · ${esc(route.name)}</span><div class="deep-path-stations">${route.ids.map((id, i) => `<button type="button" data-dtopic="${id}" class="${state.topic === id ? "active" : ""}"><em>${i + 1}</em><span>${esc(depthById.get(id).title)}</span></button>`).join('<span class="deep-path-arrow">→</span>')}</div></div>`;
}

const spotlight = [
  ["pd-disagg", "PD 分离", "看清请求路由、KV 交接与 D 端续接"],
  ["vllm-scheduler", "vLLM 调度", "重放两轮 Token Budget 和队列状态"],
  ["compiler-lowering", "编译执行", "沿 FX / Fusion / PTX / Runtime 路径追踪"],
  ["attention-tiling", "FlashAttention", "跟随两个 Tile 更新 Softmax 的 m/l/a"],
  ["warp-issue", "Warp 发射", "观察 Load 依赖、Eligible 和发射空泡"],
];
function mechanismIndexHTML() {
  return `<section class="m16-home-index"><span class="eyebrow accent-text">V1.6 / 核心机制图解</span><h2>先学明白它怎么运行，再看性能收益</h2><p>五组分步图和具体执行例子，点击直接在网页里学习；不需要先去读外部文章。</p><div class="m16-home-list">${spotlight.map(([id, name, desc], i) => `<button type="button" data-dtopic="${id}"><span>${String(i + 1).padStart(2, "0")} / 机制图解</span><strong>${esc(name)}</strong><small>${esc(desc)}</small></button>`).join("")}</div></section>`;
}

export function renderDepthAtlas() {
  const root = $("#depthContent");
  if (!root) return;
  const t = current();
  if (state.focusMode === "focus") {
    root.innerHTML = renderFocusReader(t, recFor(), {
      chapter: state.chapter,
      lab: state.mechanismLabs[state.topic],
      readerStep: state.readerStep,
      substep: state.substep,
      variant: state.variant,
      sourceIndex: state.sourceIndex,
      answer: state.focusAnswer,
      records: state.progress,
      moeToken: state.moeToken,
      moeStage: state.moeStage,
    });
    const nav = root.querySelector(".mechanism-chapters"),
      active = nav?.querySelector('[aria-current="step"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth)
      nav.scrollLeft = active.offsetLeft - nav.offsetLeft - 12;
    return;
  }
  root.innerHTML = `<button type="button" class="focus-return-button" data-f-focus>← 返回专注学习（推荐）</button><div class="deep-intro"><span class="eyebrow accent-text">V1.6 · 机制解剖与深读</span><h1>不止知道“是什么”，还要知道“为什么这样运行”<span class="headline-dot">.</span></h1><p>六大模块保持不变。先在本页看懂<strong>系统位置、架构图、数据流、设计权衡与张量例子</strong>，再深入源码和实训。你已经学过的概念可以跳过；微架构与机器人模型继续并行。</p><div class="deep-hero-numbers"><span><b>6</b> 个领域</span><span><b>${depthTopics.length}</b> 个深度专题</span><span><b>${depthPaths.length}</b> 条跨领域路径</span><span>全部中文 · 不上传内网信息</span></div></div>${mechanismIndexHTML()}${pathBar()}${routeMini()}<div class="deep-layout">${tree()}${contentHTML(t)}</div>${coverageHTML()}`;
}
export function bindDepthAtlas() {
  const root = $("#depthView");
  if (!root) return;
  root.addEventListener("click", async (e) => {
    if (handleMechanismStudioClick(e.target, root, current())) return;
    if (handleVisualClick(e.target, current(), root)) return;
    const el = e.target.closest("button");
    if (!el) return;
    if (handleFocusClick(el)) return;
    if (el.hasAttribute("data-audittoggle")) {
      auditState.open = !auditState.open;
      $("#knowledgeAudit").outerHTML = coverageHTML();
      return;
    }
    if (el.hasAttribute("data-audittopic")) {
      toHash(el.dataset.audittopic, "L2");
      return;
    }
    if (handleReasoning(el, state.topic)) return;
    if (el.hasAttribute("data-dtopic")) {
      toHash(el.dataset.dtopic, "L2");
      return;
    }
    if (el.hasAttribute("data-dpath")) {
      const route = depthPaths.find((r) => r.id === el.dataset.dpath);
      if (route) {
        state.route = route.id;
        toHash(route.ids[0], "L2");
        if (location.hash === "#depth/" + route.ids[0] + "/L2")
          renderDepthAtlas();
      }
      return;
    }
    if (el.hasAttribute("data-dlevel")) {
      toHash(state.topic, el.dataset.dlevel);
      return;
    }
    if (el.hasAttribute("data-dstage")) {
      state.stage = Number(el.dataset.dstage);
      const t = current();
      const section = $("#deepTeachArea");
      section.innerHTML = mechanismPage(t);
      return;
    }
    if (el.hasAttribute("data-dnext") || el.hasAttribute("data-dprev")) {
      state.stage = Math.min(
        current().stage.length - 1,
        Math.max(0, state.stage + (el.hasAttribute("data-dnext") ? 1 : -1)),
      );
      $("#deepTeachArea").innerHTML = mechanismPage(current());
      return;
    }
    if (el.hasAttribute("data-dchoice")) {
      state.choice = Number(el.dataset.dchoice);
      $(".deep-quiz", root).outerHTML = quiz(current());
      return;
    }
    if (el.hasAttribute("data-dparent")) {
      location.hash = "lesson/" + el.dataset.dparent;
      return;
    }
    if (el.hasAttribute("data-dmap")) {
      location.hash = "map";
      return;
    }
    if (el.hasAttribute("data-dstatus")) {
      const record = state.progress[state.topic] || {
        status: "new",
        note: "",
        completed: [],
      };
      record.status = el.dataset.dstatus;
      record.completed = record.completed || [];
      if (record.status === "known" && !record.completed.includes(state.level))
        record.completed.push(state.level);
      state.progress[state.topic] = record;
      save();
      renderDepthAtlas();
      return;
    }
    if (el.hasAttribute("data-dcopy")) {
      const t = current(),
        ex = t.experiment;
      const str = `【${t.title}】\n目标：${ex.goal}\n控制变量：${ex.controls}\n指标：${ex.metrics}\n正确性：${ex.validation}\n环境：<填写版本/设备/驱动>\n输入：<填写shape/dtype>\n预热：<填写>\n对照组：<填写>\n实测结果：<填写/不得编造>\n分析与反证：<填写>`;
      try {
        await navigator.clipboard.writeText(str);
        el.textContent = "已复制";
      } catch {
        el.textContent = "复制失败，请检查浏览器权限";
      }
      return;
    }
  });
  root.addEventListener("keydown", (e) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.matches("[data-vpick]")
    ) {
      e.preventDefault();
      handleVisualClick(e.target, current(), root);
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-auditfilter]")) {
      auditState[e.target.dataset.auditfilter] = e.target.value;
      $("#knowledgeAudit").outerHTML = coverageHTML();
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "deepSearch") {
      state.query = e.target.value;
      const old = e.target.selectionStart;
      const container = $(".deep-catalog", root);
      container.outerHTML = tree();
      const input = $("#deepSearch");
      input.focus();
      input.setSelectionRange(old, old);
      return;
    }
    if (e.target.dataset.dslider) {
      const v = readVals(current());
      v[e.target.dataset.dslider] = Number(e.target.value);
      refreshLab();
      return;
    }
    if (e.target.id === "focusNote") {
      const record = recFor();
      record.note = e.target.value.slice(0, 2500);
      state.progress[state.topic] = record;
      save();
      return;
    }
    if (e.target.id === "deepNote") {
      const record = state.progress[state.topic] || {
        status: "learning",
        completed: [],
        note: "",
      };
      record.note = e.target.value.slice(0, 2500);
      state.progress[state.topic] = record;
      save();
      return;
    }
  });
}
