/** Mechanism-specific chapters. Course identity and legacy learning records stay stable. */
import { depthTopics, depthModules, depthById } from "./depth-content.js";
import { courseNotes } from "./course-notes.js";
import {
  chaptersFor,
  chapterById,
  resolveChapter,
} from "./mechanism-curriculum.js";
import { renderMechanism, defaultLab, esc } from "./mechanism-visuals.js";
import { renderCodeTour } from "./code-tour-view.js";
import { chapterEvidence, figureTerms } from "./chapter-evidence.js";
import { curatedRelations, RELATION_TYPES } from "./semantic-graph.js";
import {
  normalizeReaderRecord as legacyNormalize,
  getReaderCounts,
  FOCUS_PAGES,
} from "./legacy-focus-reader.js";
// These exports describe archived records only, never the new chapter navigation.
export { getReaderCounts, FOCUS_PAGES };
export function normalizeReaderRecord(raw = {}, size = 7) {
  const old = legacyNormalize(raw, size),
    r = raw.mechanismReading;
  if (
    !r ||
    r.version !== 1 ||
    typeof r.last !== "string" ||
    !Array.isArray(r.seen)
  )
    return old;
  const valid = (x) => typeof x === "string" && /^[a-z0-9-]{1,48}$/.test(x);
  return {
    ...old,
    mechanismReading: {
      version: 1,
      last: valid(r.last) ? r.last : "",
      seen: [...new Set(r.seen.filter(valid))].slice(0, 64),
    },
  };
}
export function chapterProgress(t, rec = {}) {
  const chapters = chaptersFor(t.id),
    seen = rec.mechanismReading?.seen || [];
  return {
    seen: chapters.filter((c) => seen.includes(c.id)).map((c) => c.id),
    total: chapters.length,
  };
}
const status = (r) =>
  r.status === "known"
    ? "自评已掌握"
    : r.status === "review"
      ? "待验证"
      : r.status === "new"
        ? "未开始"
        : "学习中";
function catalog(t, records) {
  return `<details class="mechanism-catalog"><summary>切换专题</summary><div>${depthModules
    .map(
      (m) =>
        `<section><strong>${esc(m.name)}</strong>${depthTopics
          .filter((t) => t.module === m.id)
          .map(
            (x) =>
              `<button type="button" data-dtopic="${x.id}" aria-current="${x.id === t.id}">${esc(x.title)}<small>${status(records[x.id] || {})}</small></button>`,
          )
          .join("")}</section>`,
    )
    .join("")}</div></details>`;
}
const chapterTerms = {
  "delta-read": ["S", "k / v / q"],
  "delta-write": ["S", "δ", "β"],
  "delta-update": ["δ", "β", "k / v / q"],
  "delta-decay": ["γ", "δ", "S"],
  "delta-chunk": ["S", "Chunk", "β"],
  "compiler-mask": ["Mask", "N / IO"],
  "compiler-ir": ["IR", "TTIR / TTGIR", "PTX", "SASS"],
  "moe-network": ["EP", "All-to-All", "M_e"],
  "moe-buckets": ["Top-k", "M_e"],
  "moe-combine": ["w_te", "E_e(x_t) / y_t"],
  "softmax-rescale": ["m", "l", "a", "α", "o / ′"],
  "softmax-tiles": ["m", "l", "a"],
  "gqa-heads": ["h_q / h_kv", "GQA"],
  "norm-reduction": ["H", "ε", "γ_i"],
  "rope-rotation": ["RoPE"],
  "quant-numberline": ["x / x̂", "s", "q"],
  "robot-async": ["latency", "trigger", "Action Chunk"],
  "warp-sets": ["Active", "Eligible", "Issued"],
};
function vocabulary(n, ch) {
  const keys = ch.terms || chapterTerms[ch.figure];
  const defs =
    figureTerms[ch.figure] ||
    (keys ? n.terms.filter(([k]) => keys.includes(k)) : n.terms.slice(0, 3));
  return `<dl class="mechanism-vocabulary">${defs.map(([term, meaning]) => `<div><dt>${esc(term)}</dt><dd>${esc(meaning)}</dd></div>`).join("")}</dl>`;
}
function testQuestion(n, choice) {
  const done = Number.isInteger(choice);
  return `<section class="mechanism-check"><h3>换一个固定条件，检验能否迁移</h3><p>以下题设独立于图上参数；先按题设计算，再查看解释。</p><p>${esc(n.question)}</p><div class="focus-answers">${n.options.map((o, i) => `<button type="button" data-f-answer="${i}" aria-pressed="${choice === i}" class="${done ? (i === n.correct ? "correct" : i === choice ? "wrong" : "") : ""}"><span>${"ABC"[i]}</span>${esc(o)}</button>`).join("")}</div>${done ? `<div class="focus-check-feedback" aria-live="polite"><strong>${choice === n.correct ? "推理与机制一致" : "回到图中核查这项假设"}</strong><p>${esc(n.explain)}</p><button type="button" data-f-retry>重新判断</button></div>` : ""}</section>`;
}
const chunkFormula = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><msub><mi>S</mi><mn>2</mn></msub><mo>=</mo><msub><mi>A</mi><mn>2</mn></msub><mo>(</mo><msub><mi>A</mi><mn>1</mn></msub><msub><mi>S</mi><mn>0</mn></msub><mo>+</mo><msub><mi>B</mi><mn>1</mn></msub><mo>)</mo><mo>+</mo><msub><mi>B</mi><mn>2</mn></msub></mrow></math>`;
export function renderFocusReader(t, rec = {}, settings = {}) {
  const chapters = chaptersFor(t.id),
    id =
      chapterById(t.id, settings.chapter)?.id ||
      resolveChapter(
        t.id,
        rec,
        settings.readerStep === 5
          ? "L3"
          : settings.readerStep === 6
            ? "L4"
            : "L2",
      ),
    ch = chapterById(t.id, id),
    idx = chapters.indexOf(ch),
    n = courseNotes[t.id],
    progress = chapterProgress(t, rec),
    lab = { ...defaultLab(), ...(settings.lab || {}) };
  const evidence = chapterEvidence[`${t.id}/${ch.id}`] || {};
  const relations = curatedRelations.filter((r) => r.from === t.id || r.to === t.id);
  const code = ch.code
    ? `<details class="mechanism-code"><summary>对照此机制的执行骨架与张量边界</summary><p>下段为原创教学伪代码，保留数学依赖；函数名不是框架API或真实设备指令。</p><pre><code>${esc(evidence.code || n.code)}</code></pre>${t.id === "linear-state" ? "<p>实际FLA还包含投影、状态布局和Chunk内部变换。此处矩阵朝向统一为Key×Value；对照源码需核对STATE_V_FIRST。</p>" : ""}<details><summary>核对原有逐阶段实现导读</summary>${renderCodeTour(t, settings.sourceIndex || 0)}</details></details>`
    : "";
  return `<article class="focus-reader mechanism-reader" id="focusReader"><div class="mechanism-utility"><button type="button" data-dmap>← 知识地图</button>${catalog(t, settings.records || {})}<details class="mechanism-record"><summary>笔记与学习状态</summary><p>你的自评：<strong>${status(rec)}</strong>。浏览、答题与课程证据质量分别记录。</p><div class="mechanism-record-actions"><button type="button" data-f-mark="known">自评已掌握</button><button type="button" data-f-mark="review">仍需验证</button></div><label for="focusNote">本专题笔记与反馈</label><textarea id="focusNote" maxlength="2500" placeholder="记录疑问、推导或验证证据">${esc(rec.note || "")}</textarea><p>旧进度与笔记保留。新版章节浏览另行记录，旧“已掌握”不自动变更。</p></details></div>
 <header class="mechanism-course-heading"><p>${esc(depthModules.find((m) => m.id === t.module)?.name)} / ${esc(t.title)}</p><h1>${esc(t.title)}</h1><p>${esc(n.objective)}</p><span>本次章节浏览 ${progress.seen.length}/${progress.total} · ${status(rec)}</span></header>
 <div class="mechanism-course-layout"><nav class="mechanism-chapters" aria-label="${esc(t.title)}的机制章节">${chapters.map((c, i) => `<button type="button" data-mech-chapter="${c.id}" aria-current="${id === c.id ? "step" : "false"}"><small>${progress.seen.includes(c.id) ? "✓" : String(i + 1).padStart(2, "0")}</small><span>${esc(c.title)}</span></button>`).join("")}</nav>
 <section class="mechanism-chapter" id="focusPanel" aria-labelledby="mechanismQuestion"><p class="mechanism-position">${idx + 1} / ${chapters.length} · ${esc(ch.title)}</p><h2 id="mechanismQuestion" tabindex="-1">${esc(ch.question)}</h2><p class="mechanism-intro">${esc(ch.explain)}</p><div class="mechanism-lab" data-mechanism="${esc(ch.figure)}">${renderMechanism(ch.figure, lab)}</div>${vocabulary(n, ch)}
 ${ch.formula || ch.chunkMath ? `<details class="mechanism-math" ${ch.chunkMath ? "open" : ""}><summary>把图中关系写成公式</summary><div class="course-math">${ch.chunkMath ? chunkFormula : n.formula}</div>${ch.chunkMath ? "<p>A是固定输入后的状态线性变换，B是新写入项；下标1/2是Token时间次序，矩阵相乘不能一般性交换。</p>" : `<ol>${n.derive.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`}</details>` : ""}
 ${code}${ch.quiz ? testQuestion(n, settings.answer) : ""}
 <details class="mechanism-source"><summary>本章的依据、适用边界与尚未验证项</summary><p>${esc(evidence.section || n.section)}</p><a href="${esc(evidence.source || n.source)}" target="_blank" rel="noopener">核对一手资料 ↗</a><p>${esc(n.limit)}</p><p>图中数值为可核对教学模型；没有声称完成真实GPU性能、机器人试验或全部源码分支审计。</p></details>
 <footer class="mechanism-chapter-footer"><button type="button" data-mech-prev ${idx === 0 ? "disabled" : ""}>← ${idx === 0 ? "开篇" : esc(chapters[idx - 1].title)}</button><button type="button" data-mech-next ${idx === chapters.length - 1 ? "disabled" : ""}>${idx === chapters.length - 1 ? "本专题章节结束" : esc(chapters[idx + 1].title) + " →"}</button></footer></section></div>
 <section class="mechanism-connections"><h2>把这项机制接回系统</h2>${relations
   .map((r) => {
     const other = r.from === t.id ? r.to : r.from;
     return `<button type="button" data-dtopic="${other}"><small>${esc(RELATION_TYPES[r.type]?.label || r.type)} · ${r.from===t.id?'从本专题延伸':'关联本专题的机制'}</small><strong>${esc(depthById.get(other)?.title || other)}</strong><span>${esc(r.why)}</span></button>`;
   })
   .join("")}</section></article>`;
}
