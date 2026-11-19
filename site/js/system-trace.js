/** A deterministic request ledger, not a tokenizer, model or GPU simulator. */
export const traceScenarios = [
  ["length", "生成 2 个 Token 后停止"],
  ["eos", "首个 Token 就是 EOS"],
  ["cancel", "Decode 在途时取消"],
];

export function requestTrace(scenario = "length") {
  if (!traceScenarios.some(([id]) => id === scenario)) scenario = "length";
  const prompt = [31, 12, 6];
  const states = [];
  let state = { prompt, generated: [], computed: 0, reserved: 0, inFlight: false, terminal: false, released: false, reason: "", stage: "request" };
  const event = (title, explanation, patch = {}) => {
    state = { ...state, ...patch };
    states.push({ ...state, generated: [...state.generated], title, explanation });
  };
  event("R7 已接纳，还没有设备计算", "请求身份是 R7。排队只改变控制状态，此刻还没有任何输入位置的 KV。");
  event("输入准备完成：3 个 Token ID", "用 [31, 12, 6] 代表已经分词的三个输入位置。这些是任意教学 ID，不对应某个真实词表。", { stage: "prepare" });
  event("Prefill 完成：3 个位置有 KV", "模型已经处理输入位置 0、1、2。最后位置的隐藏向量经输出投影产生分数；此刻尚未采样新 Token。", { stage: "prefill", computed: 3, reserved: 3 });
  event(scenario === "eos" ? "从分数采样出 EOS（ID 2）" : "从分数采样出 ID 41", "新增 Token 已经属于生成结果，但还没作为模型输入计算，所以没有自己的 KV。可在此交付可见输出；EOS 是否显示由接口决定。", { stage: "sample", generated: [scenario === "eos" ? 2 : 41] });
  if (scenario === "eos") {
    event("命中 EOS，不再提交下一轮", "停止规则只需检查生成的 ID。没有必要为了结束请求，再把 EOS 送进模型。这里采用遇 EOS 立即结束的普通生成循环。", { stage: "stop", terminal: true, reason: "EOS" });
  } else {
    event("尚未达到长度上限，允许继续", "已生成 1 个 Token，上限是 2。调度器下一轮仍需检查请求状态、Token 预算和 KV 容量。", { stage: "stop" });
    event("提交 Decode，位置 3 的槽位在途", "ID 41 作为输入提交。系统为位置 3 保留 KV 槽，但提交不等于完成；Host 此时不能把在途结果当成可用数据。", { stage: "decode", reserved: 4, inFlight: true });
    if (scenario === "cancel") {
      event("收到取消：停止未来工作，保留在途槽", "R7 已成为终态；这不会自动撤回已提交 Kernel。位置 3 的缓冲区还在被访问，不能立刻归还分配器。", { stage: "stop", terminal: true, reason: "取消" });
      event("在途 Decode 完成，输出被丢弃", "完成依赖满足后才允许释放这些资源。取消后不会采样、交付新的 Token，也不会安排下一次前向。", { stage: "decode", computed: 4, inFlight: false });
    } else {
      event("Decode 完成：ID 41 现在有 KV", "位置 3 的 Q/K/V 计算完成，Attention 读过历史 KV；模型产生下一位置的分数。生成结果仍只有 ID 41。", { stage: "decode", computed: 4, inFlight: false });
      event("第二次采样：新增 ID 57", "同样的差别再次出现：ID 41 已计算，ID 57 刚采样。此时是 4 个已计算位置、2 个新增 Token。", { stage: "sample", generated: [41, 57] });
      event("命中生成长度 2，不计算 ID 57", "新增 Token 数达到上限便停止。最后一个返回的 Token 可以始终没有自己的 KV，这不影响它作为生成结果返回。", { stage: "stop", terminal: true, reason: "长度上限" });
    }
  }
  event(scenario === "cancel" ? "取消收尾完成：确认终止并回收独占槽" : "收尾完成：交付结果并回收独占槽", "本例没有共享前缀，也没有其它在途使用者，因此终态且完成依赖满足后，独占 KV 可以回收。真实共享块还需等引用归零。", { stage: "return", reserved: 0, released: true });
  return states;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function renderRequestTrace({ scenario = "length", step = 3 } = {}) {
  const states = requestTrace(scenario);
  const index = Math.max(0, Math.min(states.length - 1, Number.isFinite(step) ? Math.trunc(step) : 3));
  const current = states[index];
  const ids = [...current.prompt, ...current.generated];
  return `<section class="spine-trace" id="spineTrace" aria-labelledby="traceHeading">
    <header><span class="eyebrow">追踪同一个请求 R7</span><h2 id="traceHeading">采样出来的 Token，何时才有 KV？</h2><p>先预测：最后一个输出 Token 一定有 KV 吗？再逐步观察同一位置的状态。</p></header>
    <div class="spine-trace-cases" aria-label="选择请求结局">${traceScenarios.map(([id, label]) => `<button type="button" data-spine-trace-case="${id}" aria-pressed="${scenario === id}">${esc(label)}</button>`).join("")}</div>
    <div class="spine-trace-event"><strong>${index + 1} / ${states.length} · ${esc(current.title)}</strong><p>${esc(current.explanation)}</p></div>
    <div class="spine-token-rack" aria-label="每个位置的输入身份与 KV 状态">${ids.map((id, position) => {
      const kv = current.released ? (position < current.computed ? "KV 已回收" : "未计算，无需回收") : position < current.computed ? "KV 已计算" : position < current.reserved ? "槽位预留 · 计算在途" : "尚无 KV";
      return `<div class="spine-token ${position < current.computed && !current.released ? "computed" : "pending"}"><small>位置 ${position} · ${position < 3 ? "Prompt" : "新增"}</small><strong>ID ${id}${id === 2 ? " / EOS" : ""}</strong><span>${kv}</span></div>`;
    }).join("")}</div>
    <p class="spine-trace-ledger">已计算位置 ${current.computed} · 新增 Token ${current.generated.length} · 持有槽位 ${current.reserved} · ${current.inFlight ? "GPU 工作在途" : "无在途工作"}${current.reason ? ` · 终止原因：${esc(current.reason)}` : ""}</p>
    <nav class="spine-trace-controls" aria-label="重放请求事件"><button type="button" data-spine-trace-step="${index - 1}" ${index === 0 ? "disabled" : ""}>← 上一步</button><a href="#spine/${current.stage}">在主线中看此环节</a><button type="button" data-spine-trace-step="${index + 1}" ${index === states.length - 1 ? "disabled" : ""}>下一步 →</button></nav>
    <p class="spine-trace-boundary">教学约定：普通自回归、单请求、无推测解码；图示一个 Attention 层的 KV，真实模型按层保存。只核对事件依赖，不模拟设备耗时、真实词表或模型权重。</p>
  </section>`;
}
