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
  return `<div class="course-orientation"><button type="button" data-course-home="${t.module}">课程体系</button><span> / ${e(module.name)} / ${e(unit.title)}</span><small>本单元第${unit.courses.indexOf(t.id) + 1}/${unit.courses.length}门课 · ${e(roles[t.id] ? "导论" : "独立机制课程")}</small></div>`;
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
            return `<li><button type="button" data-dtopic="${id}"><span><strong>${e(courseLabel(c))}</strong><small>${e(c.summary)}</small></span><em>${chaptersFor(id).length}个课内问题 · ${r.status === "known" ? "自评已掌握" : r.status === "review" ? "待验证" : seen ? "新版浏览" + seen : "未浏览新版"}</em></button></li>`;
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
  root.innerHTML = `<section class="curriculum-home"><header><p class="eyebrow accent-text">课程体系 · 领域 / 单元 / 独立课 / 课内问题</p><h1>把机制放回完整的系统</h1><p>模型 → 推理系统 → 编译与Runtime → GPU执行。系统基础按需接入，GPU微架构作为并行关联支线；视觉、机器人和世界模型在模型领域内展开。</p><div class="curriculum-actions"><button type="button" data-dtopic="${e(allCourseById.has(resumeId) ? resumeId : "pd-disagg")}">继续上次课程 →</button><button type="button" data-dmap>查看知识关系图</button></div></header><nav class="curriculum-domains" aria-label="六大学习领域">${depthModules.map((m) => `<button type="button" data-course-home="${m.id}" aria-current="${m.id === activeDomain}">${e(m.name)}</button>`).join("")}</nav><section class="curriculum-domain-heading"><div><h2>${e(m.name)}</h2><p>${units.length}个单元 · ${count}门独立课。课内问题数不代表领域完整度；导论的掌握不会自动标记整个单元。</p></div><label>查找课程<input id="curriculumSearch" type="search" placeholder="搜索全部领域的主题与机制" aria-label="查找全部课程" /></label></section><div id="curriculumUnits">${body()}</div><aside class="curriculum-scope"><strong>本版范围</strong><p>覆盖为理解AI推理执行所需的主流基础与关键专项。课程解释、数学核对、固定版本源码审计、真实实验是不同证据层级；每课保留具体边界。旧25门课的ID与私人记录保留，新课独立记录。</p><p>${allCourses.length}门课程已放入${courseUnits.length}个单元。传统语言前端、完整训练算法、机器人机械设计、3D感知专项等按需扩展。</p></aside>${coverageHTML()}</section>`;
  root.querySelector("#curriculumSearch").addEventListener("input", (event) => {
    query = event.target.value.trim();
    root.querySelector("#curriculumUnits").innerHTML = body();
  });
}
