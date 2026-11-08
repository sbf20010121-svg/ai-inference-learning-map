import {
  coverage,
  coverageItems,
  statusOf,
  statusLabels,
  auditSummary,
} from "./coverage.js";
const h = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const auditState = {
  open: false,
  prio: "P0",
  state: "all",
  group: "all",
};
export function coverageHTML() {
  const s = auditSummary();
  const visible = coverageItems.filter(
    (i) =>
      (auditState.prio === "all" || i.priority === auditState.prio) &&
      (auditState.state === "all" || statusOf(i) === auditState.state) &&
      (auditState.group === "all" || i.group === auditState.group),
  );
  return `<section class="audit" id="knowledgeAudit"><header class="audit-header"><div><span class="eyebrow accent-text">知识体系审计 · 不把目录当成果</span><h2>主流知识是否覆盖？哪些还没学透？</h2><p>对照主流模型、推理、编译、GPU 和系统基础逐项盘点。<b>有一节机制课 ≠ 能读懂真实代码或独立做性能优化。</b></p></div><button class="button outline small" data-audittoggle aria-expanded="${auditState.open}">${auditState.open ? "收起清单" : "展开覆盖清单 →"}</button></header><div class="audit-stats"><span><b>${s.guided}</b> 限定机制课已建设</span><span><b>${s.partial}</b> 专项仍缺</span><span><b>${s.missing}</b> 待补</span></div>${
    auditState.open
      ? `<div class="audit-body"><p class="audit-caveat">状态仅评估本站课程建设情况，不评价你的掌握程度。范围限定为 AI 推理系统；完整训练算法、机器人本体机械设计、操作系统内核开发不作为当前必学项。新增主流技术时还需要继续增补本清单。</p><div class="audit-filters"><label>学习优先级<select data-auditfilter="prio">${[
          ["P0", "P0 · 优先必学"],
          ["P1", "P1 · 高频专项"],
          ["P2", "P2 · 按需深入"],
          ["all", "全部"],
        ]
          .map(
            ([v, n]) =>
              `<option value="${v}" ${auditState.prio === v ? "selected" : ""}>${n}</option>`,
          )
          .join(
            "",
          )}</select></label><label>覆盖状态<select data-auditfilter="state">${[
          ["all", "全部"],
          ["guided", "限定机制课已建设"],
          ["partial", "部分涉及"],
          ["missing", "尚缺深度课"],
        ]
          .map(
            ([v, n]) =>
              `<option value="${v}" ${auditState.state === v ? "selected" : ""}>${n}</option>`,
          )
          .join(
            "",
          )}</select></label><label>知识领域<select data-auditfilter="group"><option value="all">全部</option>${coverage.map((g) => `<option value="${g.id}" ${auditState.group === g.id ? "selected" : ""}>${h(g.title)}</option>`).join("")}</select></label><span class="audit-total">${visible.length} / ${coverageItems.length} 项</span></div>${
          coverage
            .map((g) => {
              const items = visible.filter((i) => i.group === g.id);
              return items.length
                ? `<div class="audit-group"><h3>${h(g.title)} <small>${items.length} 项</small></h3><div class="audit-cards">${items
                    .map((i) => {
                      const s = statusOf(i),
                        ref = i.ref.replace(/^~/, "");
                      return `<article class="audit-card"><div><span class="audit-prio">${i.priority}</span><span class="audit-status ${s}">${statusLabels[s]}</span></div><h4>${h(i.name)}</h4><p>${s === "guided" ? "限定教学目标已有机制、对象与解释；不代表整个领域或真实实现已验证。" : s === "partial" ? "目前相关基础已讲，列明的专项机制仍需建设。" : "已纳入主流清单，深度课程尚未建设。"}</p><p>${h(i.evidence?.boundary || i.boundary || "按需扩展")}</p><footer>${ref ? `<button data-audittopic="${h(ref)}">${s === "guided" ? "打开课程" : "看相关内容"} →</button>` : "<span>待开发</span>"}<a href="${h(i.source || g.source)}" target="_blank" rel="noopener noreferrer">${i.source ? "官方/原始资料" : "课程审查记录"} ↗</a></footer></article>`;
                    })
                    .join("")}</div></div>`
                : "";
            })
            .join("") || "<p>当前条件没有匹配知识点。</p>"
        }<p class="audit-foot">课程状态明确区分：限定机制课已建设 / 部分提及 / 尚缺。不能根据数量声称已覆盖全部未来新技术。</p></div>`
      : ""
  }</section>`;
}
