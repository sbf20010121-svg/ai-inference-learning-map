import { depthModules } from "./depth-content.js";
import {
  allCourseById,
  allCourses,
  courseUnits,
  foundationById,
  unitFor,
} from "./course-registry.js";
import { chaptersFor } from "./mechanism-curriculum.js";
import { coverageHTML } from "./coverage-ui.js";
import { spineStageForCourse } from "./system-spine.js";
import { foundationsGuideHTML } from "./learning-foundations.js";
const e = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const roles = {
  "compiler-lowering": "编译全景导论",
  frameworks: "推理框架比较导论",
  "llm-block": "Transformer计算概览",
  "world-model": "世界模型机制导论",
};
export function courseLabel(c) {
  return roles[c.id] || c.title;
}
export function courseOrientation(t) {
  const unit = unitFor(t.id),
    module = depthModules.find((m) => m.id === t.module);
  return `<div class="course-orientation"><button type="button" data-course-home="${t.module}">课程体系</button><span> / ${e(module.name)} / ${e(unit.title)}</span><small>本单元第${unit.courses.indexOf(t.id) + 1}/${unit.courses.length}门课 · ${e(roles[t.id] ? "导论" : "独立机制课程")}</small><button type="button" data-spine-stage="${spineStageForCourse(t.id)}">在系统主线中定位 ↗</button></div>`;
}
export function unitContinuation(t) {
  const u = unitFor(t.id),
    i = u.courses.indexOf(t.id),
    next = u.courses[i + 1],
    pre = foundationById.get(t.id)?.prereqs || [];
  return `<section class="unit-continuation"><h2>接回课程单元：${e(u.title)}</h2><p>${e(u.goal)}</p>${pre.length ? `<details><summary>本课先修与关联依据</summary>${pre.map(([id, why]) => `<button type="button" data-dtopic="${id}"><strong>${e(courseLabel(allCourseById.get(id)))}</strong><span>${e(why)}</span></button>`).join("")}</details>` : ""}<div>${next ? `<button type="button" data-dtopic="${next}">本单元下一门：${e(courseLabel(allCourseById.get(next)))} →</button>` : `<button type="button" data-course-home="${t.module}">返回本领域，查看其它单元 →</button>`}</div></section>`;
}
let activeDomain = "model",
  records = {},
  query = "";
function body() {
  const filtered = courseUnits.filter(
    (u) =>
      (query || u.module === activeDomain) &&
      u.courses.some(
        (id) =>
          !query ||
          [allCourseById.get(id).title, allCourseById.get(id).summary, u.title]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
  );
  return (
    filtered
      .map((u) => {
        const ids = u.courses.filter(
            (id) =>
              !query ||
              [
                allCourseById.get(id).title,
                allCourseById.get(id).summary,
                u.title,
              ]
                .join(" ")
                .toLowerCase()
                .includes(query.toLowerCase()),
          ),
          known = u.courses.filter(
            (id) => records[id]?.status === "known",
          ).length;
        return `<details class="course-unit" ${query ? "open" : ""}><summary><span><small>${e(depthModules.find((m) => m.id === u.module).name)} · 单元</small><strong>${e(u.title)}</strong></span><span>${u.courses.length}门 · 自评掌握${known}</span></summary><p>${e(u.goal)}</p><ol>${ids
          .map((id) => {
            const c = allCourseById.get(id),
              r = records[id] || {},
              seen = (r.mechanismReading?.seen || []).filter((cid) =>
                chaptersFor(id).some((p) => p.id === cid),
              ).length;
            return `<li><button type="button" data-dtopic="${id}"><span><strong>${e(courseLabel(c))}</strong><small>${e(c.summary)}</small></span><em>${chaptersFor(id).length}节连续讲解 · ${r.status === "known" ? "自评已掌握" : r.status === "review" ? "待验证" : seen ? "已定位或浏览" + seen + "节" : "尚未开始"}</em></button></li>`;
          })
          .join("")}</ol></details>`;
      })
      .join("") ||
    '<p class="course-empty">没有匹配课程。试试“采样”“别名”“动作”或“进程”。</p>'
  );
}
export function renderCurriculum(
  domain = "model",
  progress = {},
  resumeId = "pd-disagg",
) {
  activeDomain = depthModules.some((m) => m.id === domain) ? domain : "model";
  records = progress;
  query = "";
  const root = document.querySelector("#depthContent"),
    units = courseUnits.filter((u) => u.module === activeDomain),
    count = units.reduce((n, u) => n + u.courses.length, 0),
    m = depthModules.find((m) => m.id === activeDomain);
  root.innerHTML = `<section class="curriculum-home"><header><p class="eyebrow accent-text">知识导航 · 连续课程 · 原理与执行</p><h1>把机制放回完整的系统</h1><p>从模型定义的计算，读到推理系统怎样组织请求，再理解编译、运行时和GPU怎样完成它。系统基础按需接入，GPU微架构保持并行关联支线；视觉、机器人和世界模型在模型领域内展开。</p><div class="curriculum-actions"><button type="button" data-spine-stage="request">先看完整系统主线 →</button><button type="button" data-dtopic="${e(allCourseById.has(resumeId) ? resumeId : "pd-disagg")}">继续上次课程</button><button type="button" data-dmap>查看知识关系图</button></div></header><div class="learning-reading-guide"><p>第一次学习可以沿单元顺序建立基础；带着具体问题来时，也可以直接进入相关课程。每门课开篇会补齐必要前置，正文连续展开，公式旁解释符号和推导，图用来呈现需要看清的关系。</p><p>读到结尾，尝试用自己的话重建这段机制：输入怎样变成结果，关键约束为何存在，改变条件后哪里会不同。数值实验和代码核对是可选的深入材料；浏览过的章节不会自动变成“已掌握”。</p></div>${foundationsGuideHTML()}<nav class="curriculum-domains" aria-label="六大学习领域">${depthModules.map((m) => `<button type="button" data-course-home="${m.id}" aria-current="${m.id === activeDomain}">${e(m.name)}</button>`).join("")}</nav><section class="curriculum-domain-heading"><div><h2>${e(m.name)}</h2><p>${units.length}个单元 · ${count}门独立课。先建立单元中的基础关系，再进入专项机制；需要补充时可随时返回。</p></div><label>查找课程<input id="curriculumSearch" type="search" placeholder="搜索全部领域的主题与机制" aria-label="查找全部课程" /></label></section><div id="curriculumUnits">${body()}</div><aside class="curriculum-scope"><strong>这份课程的范围</strong><p>围绕AI推理执行建立模型、引擎、编译、算子、系统与GPU的知识联系。概念理解、公式推导和工程实测需要不同证据，每课保留适用条件与进一步学习的方向。</p><p>当前${allCourses.length}门课程组织为${courseUnits.length}个单元。完整训练算法、传统语言前端、机器人机械设计和3D感知等没有被这份推理课程全部涵盖。</p></aside>${coverageHTML()}</section>`;
  root.querySelector("#curriculumSearch").addEventListener("input", (event) => {
    query = event.target.value.trim();
    root.querySelector("#curriculumUnits").innerHTML = body();
  });
}
