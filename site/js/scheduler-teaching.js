/** Shared presentation of the main three-request example, with explicit state boundaries. */
import { schedulerScenario } from "./scheduler-model.js";
const e = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const phase = (kind) => kind === "prefill" ? "Prefill · 处理输入" : "Decode · 继续生成";

export function schedulerScenarioHTML() {
  const [a, b, c] = schedulerScenario.requests;
  return `<p class="scheduler-scenario"><strong>同一组请求，从这里开始：</strong>A 已算完${a.computed}个位置，正在生成；B 的${b.prompt}个输入位置、C 的${c.prompt}个输入位置都还没算。A/B/C 是请求编号。下面每轮按 A → B → C 查看，每轮重新给足计算预算。</p>`;
}

export function schedulerSummaryHTML(round) {
  return `<div class="scheduler-summary" data-scheduler-summary data-used="${round.used}" data-left="${round.left}" data-free="${round.free}"><strong>第${round.round}轮：选中${round.used} / ${round.budget}位置</strong><span>本轮未用预算 ${round.left}位置</span><span>轮后空闲KV ${round.free}块</span></div>`;
}

export function schedulerBudgetHTML(round) {
  const slots = round.chosen.flatMap((request) => Array.from({ length: request.n }, (_, i) =>
    `<span class="request-${request.id}" title="请求${request.id}的第${request.before + i}号位置"><b>${request.id}</b><small>p${request.before + i}</small></span>`));
  slots.push(...Array.from({ length: round.left }, () => '<span class="unused"><b>空</b><small>未用</small></span>'));
  return `<div class="scheduler-budget"><p>一格 = 本轮一个计算位置；p 是从0起的位置编号。</p><div class="mech-budget">${slots.join("")}</div></div>`;
}

export function schedulerStatesHTML(round) {
  return `<div class="scheduler-states">${round.beforeRequests.map((before, index) => {
    const after = round.requests[index], decision = round.decisions[index];
    const positions = Array.from({ length: before.computed + before.nextInput }, (_, position) => {
      const state = position < before.computed ? "computed" : position < before.computed + decision.scheduled ? "selected" : "waiting";
      return `<span class="scheduler-position is-${state} request-${before.id}" title="${position}号位置：${state === "computed" ? "轮前已算" : state === "selected" ? "本轮选中" : "仍待计算"}">${position}</span>`;
    }).join("");
    const update = !decision.scheduled ? "没有执行，状态保持。" : after.promptPending ? "输入尚未算完，本轮不产生新输出。" : "本轮可采样1个新输出；它是下一轮待算的输入。";
    return `<section class="scheduler-request"><h3><span class="scheduler-id request-${before.id}">请求${before.id}</span>${phase(before.kind)}</h3>
      <div data-scheduler-request="${before.id}" data-phase="before" data-computed="${before.computed}" data-prompt-pending="${before.promptPending}" data-blocks="${before.blocks}"><strong>轮前</strong><p>已算${before.computed}位置；Prompt剩${before.promptPending}位置。<br>这轮可继续算${before.nextInput}位置。</p></div>
      <div class="scheduler-positions" aria-label="请求${before.id}的输入位置">${positions}</div>
      <p class="scheduler-grant">本轮选中 <strong>${decision.scheduled}</strong>位置${decision.reason === "kv" ? " · KV不足，暂缓" : decision.reason === "budget" ? " · 预算已用完" : ""}</p>
      <div data-scheduler-request="${before.id}" data-phase="after" data-computed="${after.computed}" data-prompt-pending="${after.promptPending}" data-blocks="${after.blocks}"><strong>轮后 · 执行完成</strong><p>已算${before.computed} + ${decision.scheduled} = ${after.computed}位置；Prompt剩${after.promptPending}位置。</p><p>${update}</p></div></section>`;
  }).join("")}</div><p class="scheduler-legend"><span>浅色实线：轮前已算</span><span>粗框：本轮选中</span><span>虚线：仍待计算</span></p>`;
}

export function schedulerDecisionsHTML(round, kv = false) {
  return `<div class="scheduler-decisions"><h3>按 A → B → C，逐条核算</h3>${round.decisions.map((decision) => {
    let result;
    if (decision.reason === "budget") result = "预算已用完，本轮选0位置；KV没有新增申请。";
    else if (decision.reason === "kv") result = `需要新增${decision.extra}块，但轮到它时只剩${decision.freeBefore}块；本轮选0位置，预算不扣除。`;
    else result = `KV新增${decision.extra}块可满足，本轮选${decision.scheduled}位置；预算余${decision.budgetAfter}。`;
    const blockMath = kv && decision.candidate ? `<p>原有${decision.blocksBefore}块；算到${decision.before + decision.candidate}个位置需${Math.ceil((decision.before + decision.candidate) / schedulerScenario.blockSize)}块，所以新增${decision.extra}块。此时空闲${decision.freeBefore}块。</p>` : "";
    return `<div class="scheduler-decision" data-scheduler-decision="${decision.id}" data-granted="${decision.scheduled}"><strong class="scheduler-id request-${decision.id}">请求${decision.id}</strong><div><p>可算${decision.requested}位置，轮到它时预算剩${decision.budgetBefore}；两者取小，候选${decision.candidate}位置。</p>${blockMath}<p class="scheduler-decision-result">${e(result)}</p></div></div>`;
  }).join("")}</div>`;
}

export function schedulerBlocksHTML(round) {
  const blocks = round.requests.flatMap((request, index) => Array.from({ length: request.blocks }, (_, block) => {
    const used = Math.max(0, Math.min(schedulerScenario.blockSize, request.computed - block * schedulerScenario.blockSize));
    return `<div class="request-${request.id}${block >= round.beforeRequests[index].blocks ? " is-new" : ""}"><strong>${request.id} · 块${block}</strong><div>${Array.from({ length: schedulerScenario.blockSize }, (_, slot) => `<span class="${slot < used ? "is-filled" : "is-empty"}" title="${slot < used ? "已有KV" : "已预留但未写入KV"}">${slot < used ? "●" : "○"}</span>`).join("")}</div><small>${used}/${schedulerScenario.blockSize}位置已有KV</small></div>`;
  }));
  blocks.push(...Array.from({ length: round.free }, () => '<div class="is-free"><strong>空闲块</strong><span>未分配</span></div>'));
  return `<div class="scheduler-kv-pool"><h3>轮后KV占用 · 共${round.capacity}块，每块容纳${schedulerScenario.blockSize}位置</h3><p>开始时A已占2块；本轮新分配的块用粗框。○ 是请求已预留的空槽，不能当成全局空闲块。</p><div class="scheduler-blocks">${blocks.join("")}</div></div>`;
}

export function schedulerRoundExplanation(round) {
  if (round.rejected.length) return "仍有计算预算，也可能因为没有空闲KV块而暂缓；此例不抢占、不释放已有块。";
  if (round.left && round.decisions.every((decision) => decision.scheduled === decision.requested)) return "三条请求本轮可算的位置都已处理。新采样输出要等下一轮再输入，所以余下预算不强行填满。";
  if (round.decisions.some((decision) => decision.scheduled < decision.requested)) return "预算用完时，未算完的输入留到下一轮；下一轮重置预算，继续这些位置。";
  return "本轮预算恰好用满。输入算完的请求可采样首个输出，下一轮只需计算这一个新位置。";
}
