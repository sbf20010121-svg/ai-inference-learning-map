import { teachingFor } from "./teaching-courses.js";
import { renderTeachingBlocks } from "./teaching-blocks.js";
import { foundationExpansion } from "./learning-foundations.js";
import { allCourseById } from "./course-registry.js";
import { esc } from "./mechanism-visuals.js";

export function learningIntroduction(courseId) {
  const course = teachingFor(courseId);
  if (!course) return "";
  return `<div class="learning-introduction learning-prose">${course.intro.map((text) => `<p>${esc(text)}</p>`).join("")}</div><section class="learning-prerequisites" aria-labelledby="prerequisitesTitle"><h2 id="prerequisitesTitle">读这门课需要的基础</h2><dl>${course.prerequisites.map((item, i) => `<div><dt>${esc(item.term)}</dt><dd><p>${esc(item.explain)}</p>${foundationExpansion(item.term, `${courseId}-prerequisite-${i}`)}${item.course && allCourseById.has(item.course) && item.course !== courseId ? `<button type="button" class="learning-prerequisite-link" data-dtopic="${esc(item.course)}">进一步学习：${esc(allCourseById.get(item.course).title)} ↗</button>` : ""}</dd></div>`).join("")}</dl></section>`;
}

export function learningContents(t, chapters, currentId, progress) {
  const course = teachingFor(t.id);
  if (!course) throw new Error(`Missing teaching content: ${t.id}`);
  const nav = `<nav class="mechanism-chapters learning-contents" aria-label="本课目录"><span class="learning-contents-label">本课目录</span><button type="button" data-reading-top>回到开篇与前置知识</button>${chapters.map((ch, i) => `<button type="button" data-mech-chapter="${ch.id}" aria-current="${currentId === ch.id ? "step" : "false"}"><small>${progress.seen.includes(ch.id) ? "✓" : String(i + 1).padStart(2, "0")}</small><span>${esc(course.chapters[ch.id].title)}</span></button>`).join("")}</nav>`;
  const sections = chapters.map((ch, i) => {
    const section = course.chapters[ch.id];
    const current = ch.id === currentId;
    return `<section class="learning-section learning-prose" id="reading-${t.id}-${ch.id}" data-learning-chapter="${ch.id}" aria-labelledby="${current ? "mechanismQuestion" : `reading-heading-${ch.id}`}"><p class="learning-section-number">${String(i + 1).padStart(2, "0")}</p><h2 id="${current ? "mechanismQuestion" : `reading-heading-${ch.id}`}" tabindex="-1">${esc(section.title)}</h2>${renderTeachingBlocks(section.blocks, ch, `${t.id}-${ch.id}`)}<div class="learning-section-tools"><button type="button" data-open-chapter-experiment="${ch.id}">补充：相关计算示例与执行骨架 ↗</button></div>${current ? `<footer class="mechanism-chapter-footer learning-section-navigation"><button type="button" data-mech-prev ${i === 0 ? "disabled" : ""}>${i === 0 ? "已在第一节" : "↑ 定位上一节"}</button><button type="button" data-mech-next ${i === chapters.length - 1 ? "disabled" : ""}>${i === chapters.length - 1 ? "已在最后一节" : "定位下一节 ↓"}</button></footer>` : ""}</section>`;
  }).join("");
  const closing = `<section class="learning-closing learning-prose"><h2>把这些认识连起来</h2>${course.closing.map((text) => `<p>${esc(text)}</p>`).join("")}</section>`;
  const references = course.references?.length ? `<section class="learning-references"><h2>本课依据与延伸阅读</h2><ul>${course.references.map((ref) => `<li><a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.label)} ↗</a></li>`).join("")}</ul></section>` : "";
  return `<div class="mechanism-course-layout learning-course-layout">${nav}<div class="learning-article">${sections}${closing}${references}</div></div>`;
}
