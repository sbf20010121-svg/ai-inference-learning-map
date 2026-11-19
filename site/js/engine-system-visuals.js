/** Chapter-specific execution views; all numbers are declared teaching inputs. */
import { streamingMetrics, quantizedExecution, arrivalModes } from "./engine-system-models.js";
import { residency } from "./foundation-numerics.js";
import { scheduleTrace } from "./mechanism-models.js";
const e = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const table = (headers, rows) => `<div class="mech-scroll"><table class="ff-table"><thead><tr>${headers.map((v) => `<th>${e(v)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${e(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
// Both layouts use the same fields and rows; mobile keeps each object's full record visible.
export function engineSystemRecordTable(headers, rows) {
  return `<div class="es-record-set"><div class="es-record-table">${table(headers, rows)}</div><div class="es-record-list" role="list" aria-label="按${e(headers[0])}逐条查看">${rows.map((row) => `<dl class="es-record" role="listitem">${headers.map((header, i) => `<div${i === 0 ? ' class="es-record-identity"' : ""}><dt>${e(header)}</dt><dd>${e(row[i])}</dd></div>`).join("")}</dl>`).join("")}</div></div>`;
}
export function engineSystemWideFigure(body, label, hint) {
  return `<div class="es-wide-figure"><p class="es-scroll-hint">${e(hint)}</p><div class="es-wide-scroll" tabindex="0" role="region" aria-label="${e(label)}">${body}</div></div>`;
}
const metrics = (rows) => `<dl class="mech-metrics">${rows.map(([k,v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl>`;
const control = (name, key, options, s) => `<fieldset class="mech-control"><legend>${e(name)}</legend>${options.map(([v,label]) => `<button type="button" data-mech-key="${key}" data-mech-value="${v}" aria-pressed="${s[key] === v}">${e(label)}</button>`).join("")}</fieldset>`;
const figure = (body, caption) => `<figure class="mech-figure">${body}<figcaption>${e(caption)}</figcaption></figure>`;
const array = (items, title) => `<div class="mech-array"><strong>${e(title)}</strong><div>${items.map((v, i) => `<span class="owner-${i % 4}"><small>${i}</small>${e(v)}</span>`).join("")}</div></div>`;
export const engineSystemFigureKinds = new Set(["streaming-metrics", "warp-resources", "framework-backends", "quant-execution", "pd-delivery-metrics", "scheduler-packed-input", "shared-consumers", "arrival-modes"]);

export function renderEngineSystemFigure(id, s) {
  if (id === "scheduler-packed-input") {
    const r = scheduleTrace(s.budget, s.capacity)[s.round];
    const offsets = [0], slots = [];
    const rows = r.chosen.map((request) => {
      const start = slots.length;
      for (let i = 0; i < request.n; i++) slots.push(`${request.id}@p${request.before + i}`);
      offsets.push(slots.length);
      return [request.id, request.kind, `${request.before}…${request.before + request.n - 1}`, `[${start}, ${slots.length})`];
    });
    return control("本轮计算预算", "budget", [[4,"4位置"],[8,"8位置"]],s) +
      control("轮次", "round", [[0,"1"],[1,"2"],[2,"3"]],s) +
      control("KV容量", "capacity", [[16,"16块"],[2,"2块"]],s) + figure(
        array(slots.length ? slots : ["本轮没有可提交位置"], "Runner要准备的请求内位置；不是实际词ID") +
          engineSystemRecordTable(["请求", "位置类型", "请求内位置", "Packed半开区间"], rows) +
          array(offsets, "按本轮所选请求生成的累计边界") +
          metrics([["所选位置总数", slots.length],["控制侧提供", "请求ID、待算数量、位置与可用KV映射"],["执行侧继续准备", "真实Token ID、position、缓存表和后端元数据"]]),
        "位置标签A@p6只说明请求A的第6号位置。Scheduler决定算谁；Runner依据同一身份组装设备张量。此处没有冒充任一vLLM版本完整元数据或所有Attention后端格式。",
      );
  }
  if (id === "shared-consumers") {
    const explicit = !!s.scenario;
    return control("同一Tile供两个消费者使用", "scenario", [[0,"各自从全局读取"],[1,"显式放入Shared后重用"]],s) + figure(
      array([1,2,3,4], "全局对象G的同一4元素Tile") +
        (explicit ? array([1,2,3,4], "生产者搬入的Shared副本S；完成并同步后才能读") : "") +
        engineSystemRecordTable(["消费者", "读取来源", "计算", "输出"], [["C0",explicit ? "S[0…3]" : "G[0…3]","求和",10],["C1",explicit ? "S[0…3]" : "G[0…3]","平方后求和",30]]) +
        metrics([["本例逻辑全局读取元素", explicit ? 4 : 8],["额外Shared容量",explicit ? "4元素" : "0"],["实际DRAM读取", "尚未测量；Cache可能使两次全局读取命中同一缓存"]]),
      "这里只证明显式重用的数据依赖与逻辑访问数。Shared路径需要程序分配、搬运和同步；全局访问不必先经过Shared。L1/L2缓存命中、Bank冲突、资源驻留与实际时间需另查。",
    );
  }
  if (id === "arrival-modes") {
    const rows = arrivalModes(!!s.scenario);
    return control("客户端如何发请求", "scenario", [[0,"每1ms开放到达"],[1,"等上一条完成再发"]],s) + figure(
      table(["请求", "到达ms", "开始ms", "完成ms", "等待ms", "响应ms"], rows.map((r)=>[r.id,r.arrival,r.start,r.finish,r.wait,r.response])) +
        array(rows.map((r)=>r.arrival), "保留真实到达轨迹") +
        metrics([["单条服务时间", "两种情况均3ms"],["最后完成时刻", "两种情况均12ms"],["相邻提交间隔",s.scenario ? "3ms：前一条完成才提交" : "1ms：不等待完成"]]),
      "闭环四条响应都是3ms，因为客户端降低了提交压力；开放到达响应是3/5/7/9ms。服务能力没有变。这个四请求单服务台模型不能代替真实连续Batch，但能解释为什么两种负载的延迟不能直接排名。",
    );
  }
  if (id === "streaming-metrics") {
    const d = streamingMetrics(s.scenario ? 3 : 0);
    const x = (t) => 45 + t * 40;
    const svg = `<svg class="mech-svg ff-svg" viewBox="0 0 600 205" style="--figure-width:600px" role="img" aria-label="请求到达、开始与三次Token交付的时间戳"><title>每个点对应同一请求的一个事件，横轴为人工毫秒</title><line class="axis" x1="45" y1="115" x2="545" y2="115"/>${Array.from({length:13},(_,i)=>`<text x="${x(i)}" y="145" text-anchor="middle">${i}</text>`).join("")}<text x="500" y="175">教学 ms</text><rect class="owner-3" x="${x(0)}" y="82" width="${d.wait*40}" height="17"/><text x="${x(d.wait/2)}" y="70" text-anchor="middle">排队 ${d.wait}</text>${d.emitted.map((t,i)=>`<circle class="owner-${i}" cx="${x(t)}" cy="115" r="6"/><text x="${x(t)}" y="${i%2 ? 35:52}" text-anchor="middle">Token${i+1}@${t}</text>`).join("")}<text x="45" y="175">到达 0</text></svg>`;
    return control("仅改变排队等待", "scenario", [[0,"等待1ms"],[1,"等待4ms"]],s) + figure(
      engineSystemWideFigure(svg, "Token交付时间线，可左右滚动", "左右滑动查看完整时间线；相邻刻度相差1ms，字号和时间比例保持不变。下方逐项列出全部计算结果。") + engineSystemRecordTable(["指标", "取哪两个时刻", "本例 ms"], [
        ["TTFT", `首Token ${d.emitted[0]} − 到达 ${d.arrival}`, d.ttft],
        ["ITL1", `${d.emitted[1]} − ${d.emitted[0]}`, d.itl[0]],
        ["ITL2", `${d.emitted[2]} − ${d.emitted[1]}`, d.itl[1]],
        ["整条完成时延", `${d.emitted[2]} − ${d.arrival}`, d.completion],
      ]),
      "三个Token、时间戳均为合成。只增加前置等待会增加TTFT和整条完成时延，不改变此例的两个ITL；不能把Kernel执行时间或相邻输出间隔代替全部响应时间。",
    );
  }
  if (id === "warp-resources") {
    const regs = s.scenario ? 32 : 96, d = residency(regs, 8);
    const spill = s.scenario ? "可能新增：必须查生成代码" : "未知：仍需检查";
    return control("寄存器方案（虚构容量）", "scenario", [[0,"96字/线程"],[1,"压到32字/线程"]],s) + figure(
      engineSystemRecordTable(["资源约束", "允许驻留CTA数"], Object.entries(d.limits)) +
        array(Array.from({length:8},(_,i) => i < d.warps ? `W${i}驻留` : "空槽"), "资源账本的8个Warp槽") +
        metrics([["最终驻留",`${d.blocks}CTA / ${d.warps}Warp`],["Occupancy",`${100*d.occupancy}%`],["Spill",spill],["该方案有多少Eligible", "仅由驻留数无法推出"]]),
      "设备容量为教学自设：16384寄存器字、32KiB Shared、8Warp、4CTA；每CTA64线程、8KiB。强压寄存器可能换来Spill，图没有编造其字节或时长。下一步核对实际寄存器、Spill、Eligible与相同工作量的运行时间。",
    );
  }
  if (id === "framework-backends") {
    const incompatible = !!s.scenario;
    return control("模型输入条件", "scenario", [[0,"f16 / head dim4"],[1,"f16 / head dim6"]],s) + figure(
      table(["检查对象", "教学路径A", "教学路径B"], [
        ["同一上层请求API", "请求R、输入I", "请求R、输入I"],
        ["Attention能力", "只接受head dim4", "接受dim4或dim6"],
        ["本输入是否可用", incompatible ? "否" : "是", "是"],
        ["实际派发", incompatible ? "报错或显式回退；取决于策略" : "执行A实现", "执行B实现"],
        ["必须留的证据", "选择日志、Kernel名、编译/Graph状态", "选择日志、Kernel名、编译/Graph状态"],
      ]) + metrics([["性能结论", "支持表没有提供性能排名"],["正确性前提", "先确认同任务、同数值要求和真实路径"]]),
      "A/B完全为教学后端，不对应vLLM、SGLang或TensorRT-LLM的支持矩阵。同一个API只约定接口，不能证明调度、缓存、Attention与量化Kernel相同。",
    );
  }
  if (id === "quant-execution") {
    const d = quantizedExecution(!!s.scenario);
    return control("执行中怎样解码", "scenario", [[0,"消费时解码"],[1,"先展开FP32缓冲"]],s) + figure(
      array(d.codes, "整数权重码 q，Scale=0.5") +
        array(d.weights, "对应权重 w=Scale×q") +
        table(["坐标", "输入x", "权重w", "贡献x×w"],d.input.map((x,i)=>[i,x,d.weights[i],d.partials[i]])) +
        metrics([["归约输出",d.output],["权重相关同时存活Byte",d.concurrentWeightBytes],["全量展开临时Byte",d.temporaryBytes]]),
      "算出的值应相同：1−4−0.5+0=−3.5。假定4个int8码和1个FP32 Scale；显式展开再占16Byte，消费时解码不保留这份全量缓冲。该账本不含输入、输出和局部寄存器，也不证明任何实际低精度Kernel更快。",
    );
  }
  if (id === "pd-delivery-metrics") {
    const tokens = s.scenario ? 8192 : 2048;
    const bytes = 2*32*8*128*tokens*2, transfer = bytes/25e9*1000, next = 12+transfer+2;
    const prefillDelivers = !s.path;
    return control("上下文长度", "scenario", [[0,"2048位置"],[1,"8192位置"]],s) +
      control("首Token交付边界", "path", [[0,"P算完即交付"],[1,"等D首次输出才交付"]],s) + figure(
        table(["串行事件（忽略排队）", "人工完成时刻 ms"], [["P完成并可采样",12],["KV交付完成",(12+transfer).toFixed(3)],["D首步输出",next.toFixed(3)]]) +
          metrics([["KV传输下界 ms",transfer.toFixed(3)],["本交付策略的TTFT ms",prefillDelivers ? 12 : next.toFixed(3)],["P首发到D下次输出间隔 ms",prefillDelivers ? (transfer+2).toFixed(3) : "本策略尚无P端交付"]]),
        "P计算12ms、D首步2ms、有效带宽25GB/s均为教学假设；无重叠、无协议开销。转运是否落入TTFT，取决于首Token在哪里交付；P已首发时它可能扩大随后ITL。这里比较观测边界，不声称具体Connector采用某种交付方式。",
      );
  }
  throw Error(`Unknown execution teaching figure: ${id}`);
}
