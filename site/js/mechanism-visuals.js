import {
  deltaTrace,
  deltaChunkSolve,
  onlineTrace,
  scheduleTrace,
  expertTrace,
  fusionTrace,
  tileTrace,
  queueTrace,
  rotor,
  quantize,
  flowTrace,
  flowSample,
  rssmStep,
  speculative,
  robotQueue,
  warpTrace,
  sum,
  sm,
} from "./mechanism-models.js";
import { compilerLayout } from "./research-models.js";
import { kvScenes, physicalBlocks, getMapping } from "./kv-studio.js";
import { irStages } from "./mechanism-source.js";
import { courseModel } from "./course-models.js";
import { frameFigure } from "./course-reader.js";
export const esc = (x = "") =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const f = (x) =>
  !Number.isFinite(x)
    ? "—"
    : Math.abs(x) > 0 && Math.abs(x) < 0.0001
      ? x.toExponential(2)
      : Number(x.toFixed(3)).toString();
const vec = (a) => "[" + a.map(f).join(", ") + "]";
export const defaultLab = () => ({
  token: 1,
  beta: 0.5,
  gamma: 1,
  rule: "delta",
  keys: "orthogonal",
  budget: 8,
  capacity: 16,
  round: 0,
  k: 2,
  selectedToken: 0,
  block: 8,
  pid: 0,
  ir: 0,
  fusion: 1,
  external: 0,
  bm: 2,
  kStep: 1,
  cell: 0,
  high: 3,
  tile: 1,
  latency: 4,
  trigger: 4,
  mode: "async",
  tick: 8,
  kvStep: 0,
  kvSelect: "A:1",
  service: 2,
  scenario: 0,
  warps: 1,
  stride: 1,
  stages: 2,
  angle: 90,
  scale: 0.25,
  qmode: "close",
  frames: 2,
  path: 0,
  observation: 0,
  hkv: 2,
  transfer: 1,
  format: "integer",
  source: 0,
});
const choices = {
  token: [0, 1, 2, 3],
  beta: [0.5, 1],
  gamma: [0.8, 1],
  rule: ["delta", "additive"],
  keys: ["orthogonal", "mixed"],
  budget: [4, 8],
  capacity: [2, 16],
  round: [0, 1, 2],
  k: [1, 2],
  selectedToken: [0, 1, 2, 3],
  block: [4, 8],
  pid: [0, 1, 2],
  ir: [0, 1, 2, 3, 4, 5],
  fusion: [0, 1],
  external: [0, 1],
  bm: [2, 4],
  kStep: [1, 2],
  cell: [0, 1, 4, 5],
  high: [3, 6],
  tile: [0, 1, 2],
  latency: [4, 6],
  trigger: [1, 4],
  mode: ["sync", "async"],
  tick: Array.from({ length: 18 }, (_, i) => i),
  kvStep: [0, 1, 2, 3, 4],
  kvSelect: ["A:0", "A:1", "B:0", "B:1", "C:0"],
  service: [2, 3],
  scenario: [0, 1],
  warps: [1, 4],
  stride: [1, 8],
  stages: [1, 2],
  angle: [0, 45, 90, 180],
  scale: [0.25, 0.5],
  qmode: ["close", "far"],
  frames: [2, 4],
  path: [0, 1],
  observation: [0, 1],
  hkv: [1, 2],
  transfer: [0, 1, 2],
  format: ["integer", "float"],
  source: [0, 1, 2, 3],
};
export function changeLab(lab, key, value) {
  if (!choices[key]) return lab;
  const val = choices[key].find((x) => String(x) === String(value));
  return val === undefined ? lab : { ...lab, [key]: val };
}
function control(label, key, items, s) {
  return `<fieldset class="mech-control"><legend>${esc(label)}</legend>${items.map(([v, l]) => `<button type="button" data-mech-key="${key}" data-mech-value="${esc(v)}" aria-pressed="${String(s[key]) === String(v)}">${esc(l)}</button>`).join("")}</fieldset>`;
}
const text = (x, y, t, cls = "") =>
  `<text x="${x}" y="${y}" class="${cls}">${esc(t)}</text>`;
const line = (x, y, a, b, cls = "") =>
  `<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" class="${cls}"/>`;
const rect = (x, y, w, h, cls = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="${cls}"/>`;
const circle = (x, y, r, cls = "") =>
  `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
function svg(content, label, height = 280, width = 620) {
  return `<div class="mech-scroll"><svg class="mech-svg" viewBox="0 0 ${width} ${height}" style="--figure-width:${width}px" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${content}</svg></div>`;
}
function figure(body, caption) {
  return `<figure class="mech-figure">${body}<figcaption>${esc(caption)}</figcaption></figure>`;
}
export function matrixView(M, label, accent = "") {
  return `<figure class="mech-matrix ${accent}"><figcaption>${esc(label)}</figcaption><div class="mech-grid" style="--n:${Math.max(...M.map((r) => r.length))}">${M.map((r, i) => r.map((x, j) => `<span class="${Math.abs(Number(x)) < 1e-10 ? "zero" : ""}" aria-label="${esc(label)} 第${i}行第${j}列 ${esc(x)}"><small>${i},${j}</small>${typeof x === "number" ? f(x) : esc(x)}</span>`).join("")).join("")}</div></figure>`;
}
function metrics(rows) {
  return `<dl class="mech-metrics">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}
function blocks(values, label, cls = "") {
  return `<div class="mech-array"><strong>${esc(label)}</strong><div>${values.map((x, i) => `<span class="${cls}"><small>${i}</small>${typeof x === "number" ? f(x) : esc(x)}</span>`).join("")}</div></div>`;
}
function timelines(rows, max, unit = "教学节拍") {
  const ticks = Array.from(
    { length: Math.min(max + 1, 21) },
    (_, i) => (i * max) / Math.min(max, 20),
  );
  return `<div class="mech-scroll"><div class="mech-timeline"><div class="mech-time-axis"><span>${esc(unit)}</span><div>${ticks.map((t) => `<small style="left:${(t / max) * 100}%">${f(t)}</small>`).join("")}</div></div>${rows.map(([name, segments]) => `<div class="mech-time-row"><strong>${esc(name)}</strong><div>${segments.map((seg) => `<span class="${seg.cls || ""}" style="left:${(seg.start / max) * 100}%;width:${((seg.end - seg.start) / max) * 100}%" aria-label="${esc(seg.label)}：${f(seg.start)}至${f(seg.end)}${esc(unit)}">${esc(seg.label)}</span>`).join("")}</div></div>`).join("")}</div></div>`;
}
function linear(fig, s) {
  if (fig === "delta-triangle") {
    const d = deltaChunkSolve(s.beta, s.keys),
      expected = deltaTrace({ beta: s.beta, keys: s.keys, gamma: 1 }).trace[3]
        .S;
    return (
      control(
        "Key方向",
        "keys",
        [
          ["orthogonal", "正交Key"],
          ["mixed", "非正交Key"],
        ],
        s,
      ) +
      control(
        "β（本章γ固定为1）",
        "beta",
        [
          [0.5, ".5"],
          [1, "1"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-matrix-row">${matrixView(d.K, "K：Token行 × Key列")}${matrixView(d.L, "Lᵢⱼ=β kᵢᵀkⱼ，仅j<i")}</div><p class="mech-equation">(I + L) D = βV； S₃ = KᵀD</p><div class="mech-matrix-row">${matrixView(d.rhs, "βV：每Token目标")}${matrixView(d.D, "前代求解后的D")}${matrixView(d.S, "合并写入 KᵀD")}</div>${metrics(
          [
            [
              "与逐Token递推最大差",
              f(
                Math.max(
                  ...d.S.flat().map((x, i) => Math.abs(x - expected.flat()[i])),
                ),
              ),
            ],
            ["因果边界", "第i行只减去j<i的写入；输出仍需前缀Mask"],
          ],
        )}`,
        "I是单位矩阵，L无对角项，D行是已乘β的残差；本图不含遗忘门。Gated DeltaNet还需门控累计比例和高效分块实现，不能原样照搬此小矩阵求解。",
      )
    );
  }
  const d = deltaTrace({
      ...s,
      rule: fig === "delta-update" ? s.rule : "delta",
    }),
    v = d.trace[s.token],
    controls = control(
      "观察Token",
      "token",
      [
        [0, "初始"],
        [1, "t₁"],
        [2, "t₂"],
        [3, "t₃ 重复Key"],
      ],
      s,
    );
  let body = "";
  if (fig === "delta-chunk")
    return (
      control(
        "第2Token的Key方向",
        "keys",
        [
          ["orthogonal", "正交Key"],
          ["mixed", "非正交Key"],
        ],
        s,
      ) +
      control(
        "旧状态保留 γ",
        "gamma",
        [
          [1, "1"],
          [0.8, ".8"],
        ],
        s,
      ) +
      control(
        "写入强度 β",
        "beta",
        [
          [0.5, ".5"],
          [1, "1"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-matrix-row">${matrixView(d.a.A, "A₁")}${matrixView(d.b.A, "A₂")}${matrixView(d.combined.A, "时间顺序 A₂A₁")}</div><p class="mech-equation">S₂ = A₂A₁S₀ + A₂B₁ + B₂</p><div class="mech-matrix-row">${matrixView(d.trace[2].S, "逐Token递推")}${matrixView(d.chunk, "按Chunk合成")}${matrixView(d.reversed, "交换次序后的结果", "counter")}</div>${metrics(
          [
            [
              "递推与组合最大差",
              f(
                Math.max(
                  ...d.chunk
                    .flat()
                    .map((x, i) => Math.abs(x - d.trace[2].S.flat()[i])),
                ),
              ),
            ],
            [
              "顺序是否影响结果",
              JSON.stringify(d.chunk) === JSON.stringify(d.reversed)
                ? "此正交特例相同；改非正交观察"
                : "不同：不能交换Token顺序",
            ],
          ],
        )}`,
        "行=Key维、列=Value维；结合性允许括号重组，真实高效Chunk不需要朴素构造这些小矩阵。",
      )
    );
  if (fig === "state-tiles" || fig === "state-cost")
    return stateTiles(s, fig === "state-cost");
  if (fig === "delta-read")
    body =
      matrixView(v.S, `S${s.token}：Key行 × Value列`) +
      metrics([
        ["当前q", v.t ? vec(v.t.q) : "尚无查询"],
        ["读取 qᵀS", vec(v.out)],
      ]) +
      blocks(
        v.S.map((row) => row[0]),
        "第一Value列：沿Key维组合",
      );
  else if (fig === "delta-write")
    body = `<div class="mech-matrix-row">${matrixView(v.t ? [v.t.k] : [[0, 0]], "kᵀ（显示为一行）")}${matrixView([v.residual], "δᵀ 残差")}${matrixView(v.write, "β k δᵀ：逐行外积")}</div>${metrics(
      [
        ["Key方向", v.t ? vec(v.t.k) : "—"],
        ["写入矩阵的形状", "2个Key维 × 2个Value维"],
      ],
    )}`;
  else
    body = `${v.t ? blocks([...v.t.k, ...v.t.v], "输入：前2项k，后2项v") : ""}<div class="mech-matrix-row">${matrixView(v.old, "① 旧S")}${matrixView(v.decayed, "② γS")}${matrixView(v.write, "④ 写入量")}${matrixView(v.S, "⑤ 新S")}</div>${metrics(
      [
        ["③ 旧预测 kᵀ(γS)", vec(v.pred)],
        [
          fig === "delta-update" && s.rule === "additive"
            ? "③ 对照：不减预测，直接用v"
            : "③ 残差 v−预测",
          vec(v.residual),
        ],
        ["查询输出 qᵀS", vec(v.out)],
      ],
    )}`;
  return (
    controls +
    control(
      "Key方向",
      "keys",
      [
        ["orthogonal", "正交"],
        ["mixed", "混合方向"],
      ],
      s,
    ) +
    (fig !== "state-cost"
      ? control(
          "旧状态保留 γ",
          "gamma",
          [
            [1, "1：不衰减"],
            [0.8, ".8：保留80%"],
          ],
          s,
        )
      : "") +
    (fig === "delta-update"
      ? control(
          "写入规则",
          "rule",
          [
            ["delta", "先减旧预测"],
            ["additive", "直接累加对照"],
          ],
          s,
        )
      : "") +
    control(
      "写入强度 β",
      "beta",
      [
        [0.5, ".5"],
        [1, "1"],
      ],
      s,
    ) +
    figure(
      body,
      "同色矩阵格保持相同Key/Value坐标；数值是2×2教学状态，不是历史Token列表。",
    )
  );
}
function stateTiles(s, cost) {
  const K = 4,
    V = s.scenario ? 8 : 4,
    bytes = 2 * K * V * 2;
  let z = text(22, 24, "一头状态 S[K,V]；每个格子是状态元素");
  for (let i = 0; i < K; i++)
    for (let j = 0; j < V; j++)
      z +=
        rect(
          32 + j * 40,
          48 + i * 38,
          34,
          30,
          j < 4 ? "series-a" : "series-b",
        ) + text(38 + j * 40, 68 + i * 38, `${i},${j}`, "tiny");
  z +=
    text(390, 75, "Decode：读取旧S") +
    text(390, 115, "完成依赖计算") +
    text(390, 155, "写回新S");
  return (
    control(
      "Value维长度",
      "scenario",
      [
        [0, "V=4"],
        [1, "V=8"],
      ],
      s,
    ) +
    figure(
      svg(z, "状态Tile与读改写对象", 235),
      cost
        ? `假设每元素2Byte，一次全读全写逻辑流量=${bytes}Byte；寄存器驻留、缓存和状态布局会改变真实流量。`
        : "图中分块是教学示意。实际BK/BV、STATE_V_FIRST和资源需核对固定实现。",
    ) +
    metrics([
      ["状态元素", K * V],
      ["全读全写逻辑Byte", bytes],
    ])
  );
}
function compiler(fig, s) {
  if (fig === "compiler-mask") {
    const d = compilerLayout(s.block),
      p = d.programs[Math.min(s.pid, d.count - 1)];
    return (
      control(
        "BLOCK",
        "block",
        [
          [4, "4"],
          [8, "8"],
        ],
        s,
      ) +
      control(
        "当前Program",
        "pid",
        d.programs.map((p) => [p.pid, `P${p.pid}`]),
        s,
      ) +
      figure(
        `${blocks(
          Array.from({ length: 10 }, (_, i) => i),
          "全局合法位置0…9",
        )}<div class="mech-mask">${p.offsets.map((o, i) => `<div class="${p.masks[i] ? "live" : "masked"}"><small>逻辑槽${i}</small><strong>${o}</strong><span>${p.masks[i] ? "读写有效" : "Mask=false"}</span></div>`).join("")}</div>${blocks(
          p.values.map((x) => (x === null ? "不访问" : x)),
          "当前Program的输出",
        )}`,
        `Grid=${d.count}，有效元素${d.active}，屏蔽槽${d.masked}。Mask阻止越界访问，不是实际Lane映射。`,
      )
    );
  }
  if (fig === "fusion-buffers") {
    const d = fusionTrace(!!s.fusion, !!s.external);
    return (
      control(
        "执行方式",
        "fusion",
        [
          [0, "三个Kernel"],
          [1, "融合Kernel"],
        ],
        s,
      ) +
      control(
        "u是否被外部读取",
        "external",
        [
          [0, "只供本链使用"],
          [1, "还需对外保留u"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-buffers">${[
          ["x", d.x, "输入"],
          ["u=2x", d.u, s.fusion && !s.external ? "仅内核中间值" : "全局物化"],
          ["v=u+1", d.v, s.fusion ? "仅内核中间值" : "全局物化"],
          ["y=max(v,0)", d.y, "输出"],
        ]
          .map(
            ([label, data, kind], i) =>
              `<section class="${kind === "仅内核中间值" ? "onchip" : "materialized"}">${blocks(data, label)}<small>${kind}</small></section>`,
          )
          .join("")}</div>${metrics([
          ["逻辑读取（元素次）", d.reads],
          ["逻辑写入（元素次）", d.writes],
          ["Kernel数", d.kernels],
        ])}`,
        "虚线表示可留在内核内部的中间值，实线表示需在边界保存的数组；不等同实测HBM事务。",
      )
    );
  }
  if (fig === "compiler-ir") {
    const i = s.ir || 0,
      p = irStages[i];
    return (
      control(
        "同一向量加法的表示层",
        "ir",
        irStages.map((p, i) => [i, p.name]),
        s,
      ) +
      figure(
        `<div class="mech-ir-scale">${irStages.map((p, i) => `<span class="${i === s.ir ? "current" : ""}">${esc(p.name)}</span>`).join("")}</div><h3>${esc(p.tag)}</h3><p>${esc(p.intro)}</p><pre class="mech-code"><code>${esc(p.code)}</code></pre><p class="mech-result">${esc(p.why)}</p>`,
        "片段为原研究课的结构示意，已完整接入此章；不是本机捕获的IR或SASS。",
      )
    );
  }
  if (fig === "layout-ownership") {
    let z = text(25, 25, "同一逻辑Tile：颜色表示元素由哪个示例线程持有");
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const owner = s.scenario ? j % 4 : i % 4;
        z +=
          rect(40 + j * 48, 50 + i * 42, 42, 35, `owner-${owner}`) +
          text(44 + j * 48, 73 + i * 42, `${i},${j}`);
      }
    for (let i = 0; i < 4; i++)
      z +=
        circle(350 + i * 65, 100, 23, `owner-${i}`) +
        text(337 + i * 65, 105, `T${i}`);
    for (let owner = 0; owner < 4; owner++)
      for (let n = 0; n < 4; n++)
        z += text(
          337 + owner * 65,
          155 + n * 23,
          s.scenario ? `${n},${owner}` : `${owner},${n}`,
        );
    return (
      control(
        "示例元素归属",
        "scenario",
        [
          [0, "按行持有"],
          [1, "按列持有"],
        ],
        s,
      ) +
      figure(
        svg(z, "四线程示例布局与元素坐标", 245),
        "这是手工四线程所有权模型，不是Triton真实布局编码。切换归属会改变哪些值需要跨线程交换。",
      )
    );
  }
  const torch = s.scenario === 0;
  let z = "";
  const ops = torch
    ? [
        ["x", 70, 125],
        ["×2", 205, 125],
        ["+1", 340, 125],
        ["max0", 475, 125],
      ]
    : [
        ["x", 70, 125],
        ["load", 205, 125],
        ["add", 340, 125],
        ["store", 475, 125],
      ];
  ops.forEach(([label, x, y], i) => {
    if (i) z += line(ops[i - 1][1] + 26, y, x - 26, y, "data-edge");
    z +=
      circle(x, y, 28, i ? "operation" : "input") + text(x - 18, y + 5, label);
  });
  z += text(
    30,
    45,
    torch ? "张量表达式的真实数据依赖" : "直接Triton程序：从逻辑偏移读写",
  );
  z += text(
    30,
    210,
    torch
      ? "Guard：shape / dtype等条件满足时才复用编译结果"
      : "直接内核不必先经Dynamo；目标代码仍需编译与加载",
  );
  return (
    control(
      "程序入口",
      "scenario",
      [
        [0, "PyTorch张量程序"],
        [1, "直接Triton内核"],
      ],
      s,
    ) +
    figure(
      svg(z, "入口不同，捕获和执行边界不同", 245),
      "圆代表具体数据/算术操作，线代表值依赖；不是所有算子必经同一条框架流水线。",
    )
  );
}
function scheduler(fig, s) {
  const rr = scheduleTrace(s.budget, s.capacity),
    r = rr[s.round];
  let body = "";
  if (fig === "scheduler-requests" || fig === "scheduler-rounds")
    body = rr
      .map(
        (x) =>
          `<div class="mech-budget-line"><strong>第${x.round}轮</strong><div class="mech-budget">${x.chosen.flatMap((t) => Array.from({ length: t.n }, () => `<span class="request-${t.id}">${t.id}</span>`)).join("")}${Array.from({ length: x.left }, () => '<span class="unused">空</span>').join("")}</div><small>B/C待输入 ${x.requests[1].pending}/${x.requests[2].pending}</small></div>`,
      )
      .join("");
  else
    body = `<div class="mech-budget">${r.chosen.flatMap((t) => Array.from({ length: t.n }, () => `<span class="request-${t.id}">${t.id}</span>`)).join("")}${Array.from({ length: r.left }, () => '<span class="unused">空</span>').join("")}</div><div class="mech-request-state">${r.requests.map((t) => `<div class="request-${t.id}"><strong>${t.id}</strong><span>computed=${t.computed}</span><span>KV块=${t.blocks}</span><span>输入还缺=${t.pending}</span></div>`).join("")}</div>${r.rejected.length ? `<p class="mech-result">${r.rejected.map((t) => `${t.id}申请新增${t.extra}块，空闲仅${t.free}块，暂缓`).join("；")}</p>` : '<p class="mech-result">本轮所有被选中请求的KV申请都满足。</p>'}`;
  return (
    control(
      "Token预算",
      "budget",
      [
        [4, "4位置"],
        [8, "8位置"],
      ],
      s,
    ) +
    control(
      "KV块总容量",
      "capacity",
      [
        [16, "16块"],
        [2, "2块：资源紧张"],
      ],
      s,
    ) +
    control(
      "观察轮次",
      "round",
      [
        [0, "第1轮"],
        [1, "第2轮"],
        [2, "第3轮"],
      ],
      s,
    ) +
    figure(
      body,
      `本轮使用${r.used}/${r.budget}计算位置，剩余${r.left}；空闲KV块${r.free}。块大小4为教学假设，暂缓不模拟真实抢占。`,
    )
  );
}
function moe(fig, s) {
  const d = expertTrace(s.k),
    r = d.routes[s.selectedToken];
  const controls =
    control(
      "追踪Token",
      "selectedToken",
      [
        [0, "T0"],
        [1, "T1"],
        [2, "T2"],
        [3, "T3"],
      ],
      s,
    ) +
    control(
      "Top-k",
      "k",
      [
        [1, "1个专家"],
        [2, "2个专家"],
      ],
      s,
    );
  let body = "";
  if (fig === "moe-scores")
    body =
      blocks(r.scores, "该Token的Router Logit（E0/E1/E2）") +
      blocks(
        r.ids.map((e, i) => `E${e}：${f(r.weights[i])}`),
        "被选中的专家与归一化权重",
      );
  else if (fig === "moe-combine") {
    const records = d.records.filter((x) => x.t === s.selectedToken);
    body = `<div class="mech-matrix-row">${records.map((x) => matrixView([[x.output, x.w, x.output * x.w]], `E${x.e}：输出 / 权重 / 贡献`)).join("")}</div>${metrics(
      [
        ["恢复到原Token", `T${s.selectedToken}`],
        ["加权合并输出坐标", f(d.combined[s.selectedToken])],
      ],
    )}`;
  } else if (fig === "expert-matrices")
    body = `<div class="mech-experts">${d.buckets
      .map(
        (b) =>
          `<section><h3>E${b.e} / GPU${b.gpu}</h3>${matrixView(
            b.records.map((x) => [x.t + 1, x.t + 2]),
            `X_e：M=${b.records.length}，H=2`,
          )}<p class="mech-equation">X_e[M,H] · W_e[H,D]</p><small>每个专家权重不同；图中仅展示输入身份。</small></section>`,
      )
      .join("")}</div>`;
  else {
    let z =
      text(28, 25, "Token身份 / 所在GPU") + text(410, 25, "专家权重 / 所在GPU");
    for (let t = 0; t < 4; t++) {
      z +=
        circle(95, 67 + t * 58, 21, `token-${t}`) +
        text(80, 72 + t * 58, `T${t}`) +
        text(25, 99 + t * 58, `GPU${tokenGPUValue(t)}`, "tiny");
    }
    for (let e = 0; e < 3; e++) {
      z +=
        rect(425, 55 + e * 78, 150, 58, "expert") +
        text(435, 77 + e * 78, `E${e} / GPU${e === 2 ? 1 : 0}`);
      d.buckets[e].records.forEach((v, i) => {
        z += rect(435 + i * 30, 87 + e * 78, 24, 17, `token-${v.t}`);
      });
    }
    d.records.forEach((x) => {
      z += `<path d="M116 ${67 + x.t * 58} C250 ${67 + x.t * 58},300 ${80 + x.e * 78},423 ${80 + x.e * 78}" class="route token-stroke-${x.t} ${x.t === s.selectedToken ? "chosen" : ""} ${x.src !== x.dst ? "remote" : ""}"/>`;
    });
    body =
      svg(z, "Token到专家的派发映射；虚线为跨GPU", 310) +
      metrics([
        ["token-expert记录", d.records.length],
        ["单向远端记录", d.remote.length],
        ["各专家的M", d.buckets.map((b) => b.records.length).join(" / ")],
      ]);
  }
  return (
    controls +
    figure(
      body,
      "Token的身份颜色跨分桶和合并保持一致；虚线表示跨GPU数据传输。Grouped GEMM是专家计算组织，不是通信本身。",
    )
  );
}
const tokenGPUValue = (t) => (t < 2 ? 0 : 1);
function kv(fig, s) {
  let step = s.kvStep;
  step = Math.min(step, 4);
  const sc = kvScenes[step],
    all = physicalBlocks(sc);
  const valid = [];
  sc.requests.forEach((r) =>
    r.table.forEach((p, i) => valid.push([`${r.id}:${i}`, `${r.id}[${i}]`])),
  );
  const sel = valid.some(([x]) => x === s.kvSelect) ? s.kvSelect : valid[0][0];
  const [request, index] = sel.split(":"),
    mapping = getMapping(sc, request, Number(index));
  return (
    control(
      "请求生命周期",
      "kvStep",
      kvScenes.map((sc, i) => [i, sc.name]),
      { ...s, kvStep: step },
    ) +
    control("追踪逻辑块", "kvSelect", valid, { ...s, kvSelect: sel }) +
    figure(
      `<div class="mech-kv-map"><section><h3>请求的逻辑顺序</h3>${sc.requests.map((r) => `<div class="mech-kv-logical"><b>${r.id}</b>${r.table.map((p, i) => `<button type="button" data-mech-key="kvSelect" data-mech-value="${r.id}:${i}" class="${sel === `${r.id}:${i}` ? "chosen" : ""}">L${i}<small>→P${p}</small></button>`).join("")}</div>`).join("")}</section><section><h3>物理槽池</h3><div class="mech-kv-pool">${all.map((p) => `<div class="${p.id === mapping.physical ? "chosen" : ""} ${p.refs > 1 ? "shared" : ""}"><strong>P${p.id} <small>引用${p.refs}</small></strong><div>${Array.from({ length: 4 }, (_, i) => `<span class="${i < p.tokens.length ? "filled" : ""}">${i < p.tokens.length ? i : "·"}</span>`).join("")}</div><small>${p.owners.join("+") || "空闲"}</small></div>`).join("")}</div></section></div>${metrics(
        [
          [
            "选中映射",
            `${mapping.request}[${mapping.logical}] → P${mapping.physical}`,
          ],
          ["相同物理块的引用", mapping.owners.join(" + ")],
          ["块内已使用槽", `${mapping.slots}/4`],
        ],
      )}`,
      sc.note + " 槽中数字是位置索引；实际存储是K/V张量。",
    )
  );
}
function attention(fig, s) {
  const d = onlineTrace(s.high),
    v = d.trace[s.tile],
    rows = [];
  if (fig === "attention-storage") {
    const N = s.frames * 4;
    let z = text(20, 25, "显式物化N×N分数矩阵");
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        z += rect(30 + j * 13, 45 + i * 13, 11, 11, "series-a");
    z += text(355, 25, "分块：只保留一块和行统计");
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        z += rect(365 + j * 32, 50 + i * 32, 27, 27, "series-b");
    z += text(357, 215, "m / l / a 接续下一Tile");
    return (
      control(
        "位置规模",
        "frames",
        [
          [2, "N=8"],
          [4, "N=16"],
        ],
        s,
      ) +
      figure(
        svg(z, "完整分数矩阵与片上分块对象", 270),
        `显式矩阵${N * N}元素；分块不等于减少所有点积计算，真实工作集还含Q/K/V。`,
      )
    );
  }
  const scores = blocks(d.scores, "同一Query对4个Key的Score"),
    values = blocks(d.values, "4个Value（含负数）");
  if (fig === "attention-weights")
    return (
      control(
        "第二Tile的最大分数",
        "high",
        [
          [3, "3"],
          [6, "6"],
        ],
        s,
      ) +
      figure(
        scores +
          blocks(d.weights.map(f), "完整Softmax概率") +
          values +
          metrics([["完整加权输出", f(d.direct)]]),
        "概率按全行归一；Value是被聚合对象，不是分数本身。",
      )
    );
  return (
    control(
      "读取进度",
      "tile",
      [
        [0, "未读"],
        [1, "Tile1"],
        [2, "Tile2"],
      ],
      s,
    ) +
    control(
      "第二块最大分数",
      "high",
      [
        [3, "3"],
        [6, "6"],
      ],
      s,
    ) +
    figure(
      `${scores}<div class="mech-softmax-read">${Array.from({ length: 4 }, (_, i) => `<span class="${i < s.tile * 2 ? "read" : ""}">K${i} / V${i}</span>`).join("")}</div>${
        s.tile === 2
          ? `<div class="mech-contribution"><div><strong>旧贡献 × α=${f(v.alpha)}</strong>${metrics(
              [
                ["旧l缩放后", f(v.old.l * v.alpha)],
                ["旧a缩放后", f(v.old.a * v.alpha)],
              ],
            )}</div><div><strong>新Tile加入</strong>${blocks(v.weights.map(f), "相对新m的指数权重")}</div></div>`
          : ""
      }${metrics([
        ["m 最大分数", s.tile ? f(v.m) : "−∞"],
        ["l 指数和", f(v.l)],
        ["a 加权和", f(v.a)],
        ["o=a/l", v.out === null ? "尚无结果" : f(v.out)],
      ])}${
        s.tile === 2
          ? metrics([
              ["完整Softmax参考", f(d.direct)],
              ["两路差值", f(v.out - d.direct)],
            ])
          : ""
      }`,
      "本图重用原研究课的m/l/a数值模型；同一行跨Tile接续，分子分母同时重缩放。",
    )
  );
}
function gemm(fig, s) {
  const d = tileTrace(s.bm, s.kStep),
    row = Math.floor(s.cell / 4),
    col = s.cell % 4;
  const highlight = (M, label, axis) =>
    `<figure class="mech-matrix"><figcaption>${label}</figcaption><div class="mech-grid" style="--n:4">${M.map((r, i) => r.map((x, j) => `<span class="${(axis === "row" && i === row) || (axis === "col" && j === col) ? "selected" : ""}">${x}</span>`).join("")).join("")}</div></figure>`;
  if (fig === "tile-boundary" || fig === "roofline")
    return (
      control(
        "改变规模条件",
        "scenario",
        [
          [0, fig === "roofline" ? "M=8" : "BM=2"],
          [1, fig === "roofline" ? "M=1" : "BM=4"],
        ],
        s,
      ) +
      frameFigure(
        courseModel(
          fig === "roofline" ? "gemm-tiling" : "triton-tiling",
          !!s.scenario,
        )[fig === "roofline" ? 3 : 1],
      )
    );
  return (
    control(
      "当前输出元素",
      "cell",
      [
        [0, "C[0,0]"],
        [1, "C[0,1]"],
        [4, "C[1,0]"],
        [5, "C[1,1]"],
      ],
      s,
    ) +
    control(
      "已经归约的K范围",
      "kStep",
      [
        [1, "K=0,1"],
        [2, "K=0…3"],
      ],
      s,
    ) +
    control(
      "输出Tile高度",
      "bm",
      [
        [2, "BM=2"],
        [4, "BM=4"],
      ],
      s,
    ) +
    figure(
      `<div class="mech-matrix-row">${highlight(d.A, "A：高亮当前输出的输入行", "row")}${highlight(d.B, "B：高亮当前输出的输入列", "col")}${matrixView(d.C, `C：已累计${d.K}个K位置`)}</div><p class="mech-equation">C[${row},${col}] = ${d.A[
        row
      ]
        .slice(0, d.K)
        .map((x, k) => `${x}×${d.B[k][col]}`)
        .join(
          " + ",
        )} = ${d.C[row][col]}</p><div class="mech-tile-grid">${Array.from({ length: 16 }, (_, i) => `<span class="owner-${(Math.floor(Math.floor(i / 4) / s.bm) * 2 + Math.floor((i % 4) / 2)) % 4}">${Math.floor(i / 4)},${i % 4}</span>`).join("")}</div>`,
      "矩阵中的数值可逐项核对；下方颜色表示输出Tile归属，非实际线程编号。K范围改变时累加器继续累计。",
    )
  );
}
function runtime(fig, s) {
  const overlap = !!s.scenario;
  if (fig === "graph-replay")
    return (
      control(
        "CPU提交方式",
        "scenario",
        [
          [0, "逐次Launch"],
          [1, "Graph Replay"],
        ],
        s,
      ) +
      figure(
        timelines(
          [
            [
              "CPU提交",
              overlap
                ? [{ start: 0, end: 4, label: "一次Replay" }]
                : [0, 1, 2].map((i) => ({
                    start: i * 4,
                    end: i * 4 + 4,
                    label: `提交${i + 1}`,
                  })),
            ],
            [
              "设备任务",
              [0, 1, 2].map((i) => ({
                start: (overlap ? 4 : 12) + i * 10,
                end: (overlap ? 14 : 22) + i * 10,
                label: `K${i + 1}`,
                cls: "compute",
              })),
            ],
          ],
          42,
          "μs（串行教学）",
        ) +
          metrics([
            ["CPU提交次数", overlap ? 1 : 3],
            ["设备Kernel数量", 3],
            ["不重叠假设总量 μs", overlap ? 34 : 42],
          ]),
        "人为设定每次提交4μs、每个Kernel10μs，且提交结束才开始设备工作；Replay只改变提交成本。实际CPU/GPU可流水重叠，需另行测量。",
      )
    );
  if (fig === "copy-overlap")
    return (
      control(
        "两批输入是否重叠",
        "scenario",
        [
          [0, "串行"],
          [1, "理想双缓冲"],
        ],
        s,
      ) +
      figure(
        timelines(
          [
            [
              "H2D",
              overlap
                ? [
                    { start: 0, end: 3, label: "B0" },
                    { start: 3, end: 6, label: "B1" },
                  ]
                : [
                    { start: 0, end: 3, label: "B0" },
                    { start: 8, end: 11, label: "B1" },
                  ],
            ],
            [
              "计算",
              overlap
                ? [
                    { start: 3, end: 8, label: "B0", cls: "compute" },
                    { start: 8, end: 13, label: "B1", cls: "compute" },
                  ]
                : [
                    { start: 3, end: 8, label: "B0", cls: "compute" },
                    { start: 11, end: 16, label: "B1", cls: "compute" },
                  ],
            ],
          ],
          16,
          "ms（假设）",
        ),
        "同色保持批次身份；重叠需要独立槽、Pinned内存、Stream和设备能力，首批仍串行8ms。",
      )
    );
  if (fig === "buffer-ownership")
    return (
      control(
        "观察时刻",
        "tick",
        [
          [1, "提交后"],
          [4, "拷贝完成"],
          [8, "计算完成"],
        ],
        s,
      ) +
      figure(
        timelines(
          [
            [
              "Host槽0",
              [
                { start: 0, end: 3, label: "DMA仍读取", cls: "waiting" },
                { start: 3, end: 8, label: "可复用输入", cls: "compute" },
              ],
            ],
            [
              "Device槽0",
              [
                { start: 0, end: 3, label: "写入中" },
                { start: 3, end: 8, label: "Kernel使用", cls: "compute" },
              ],
            ],
          ],
          8,
          "ms（假设）",
        ) +
          metrics([
            ["当前时刻", s.tick],
            [
              "Host输入是否可改",
              s.tick < 3 ? "不能：DMA还未读完" : "可以：拷贝已完成",
            ],
            [
              "设备输出是否可读",
              s.tick < 8 ? "不能：计算尚未结束" : "计算完成后再按回传依赖读取",
            ],
          ]),
        "输入与输出有不同完成条件；异步返回没有转移所有权。",
      )
    );
  const invalid = !!s.scenario;
  return (
    control(
      "跨Stream依赖",
      "scenario",
      [
        [0, "等待Event E"],
        [1, "去掉等待：错误对照"],
      ],
      s,
    ) +
    figure(
      timelines(
        [
          ["S0生产者", [{ start: 0, end: 4, label: "写A", cls: "compute" }]],
          [
            "S1消费者",
            [
              {
                start: invalid ? 1 : 4,
                end: invalid ? 4 : 7,
                label: invalid ? "提前读A！" : "E后读A",
                cls: invalid ? "bad" : "compute",
              },
            ],
          ],
        ],
        8,
        "人工时间",
      ) +
        metrics([
          ["数据可读时刻", "t=4"],
          ["消费者开始", invalid ? "t=1，存在竞争" : "t=4，依赖满足"],
        ]),
      "不同Stream不自动排序。Event依赖是正确性要求，不是装饰连线。",
    )
  );
}
function robot(fig, s) {
  if (fig === "flow-training") {
    const { noise, target, tau, current, velocity } = flowSample(
      s.source / 3,
      s.observation ? [0.5, -1] : [1, 1],
    );
    const X = (x) => 230 + x * 130,
      Y = (y) => 190 - y * 85;
    let z = line(55, 190, 570, 190, "axis") + line(230, 35, 230, 285, "axis");
    z += line(
      X(noise[0]),
      Y(noise[1]),
      X(target[0]),
      Y(target[1]),
      "reference",
    );
    for (let i = 0; i < 4; i++) {
      const t = i / 3,
        p = target.map((x, j) => t * x + (1 - t) * noise[j]);
      z +=
        circle(X(p[0]), Y(p[1]), i === s.source ? 9 : 4, "series-a") +
        text(X(p[0]) + 8, Y(p[1]) - 12, `τ=${f(t)}`);
    }
    z += text(
      25,
      325,
      `ε=${vec(noise)}；A=${vec(target)}；目标速度 A−ε=${vec(velocity)}`,
    );
    return (
      control(
        "训练动作样本",
        "observation",
        [
          [0, "样本A"],
          [1, "样本B"],
        ],
        s,
      ) +
      control(
        "插值时间τ",
        "source",
        [
          [0, "0 噪声"],
          [1, "1/3"],
          [2, "2/3"],
          [3, "1 动作"],
        ],
        s,
      ) +
      figure(
        svg(z, "二维动作样本的Flow训练插值与监督方向", 350) +
          metrics([
            ["当前带噪动作 A(τ)", vec(current)],
            ["监督损失", "‖vθ(A(τ),观测,τ)−(A−ε)‖²"],
            ["推理时可用对象", "噪声、观测、τ、已训练vθ；没有真实A"],
          ]),
        "坐标轴是动作向量的两个示意分量，连线是训练配对的插值轨迹。模型学习条件平均速度场；推理轨迹不保证沿本条已知终点直线。",
      )
    );
  }
  if (fig === "flow-field") {
    const d = flowTrace(s.kStep === 1 ? 2 : 4);
    let z =
      line(35, 210, 580, 210) +
      line(35, 30, 35, 210) +
      text(38, 25, "动作变量a") +
      text(520, 240, "生成时间τ");
    for (let i = 0; i < d.trace.length; i++) {
      const x = 40 + (i / (d.trace.length - 1)) * 520,
        y = 210 - (d.trace[i] + 1) * 75;
      if (i)
        z += line(
          40 + ((i - 1) / (d.trace.length - 1)) * 520,
          210 - (d.trace[i - 1] + 1) * 75,
          x,
          y,
          "data-edge",
        );
      z += circle(x, y, 5, "series-a") + text(x - 12, y - 12, f(d.trace[i]));
    }
    z += line(35, 60, 580, 60, "reference") + text(390, 48, "目标a=1");
    return (
      control(
        "Euler迭代步数",
        "kStep",
        [
          [1, "2步"],
          [2, "4步"],
        ],
        s,
      ) +
      figure(
        svg(z, "手工向量场下动作变量的数值积分", 265),
        "da/dτ=1−a，初始a=−1；τ是生成时间，不是控制时间。此向量场为教学自设，不能作为VLA实际生成质量。",
      )
    );
  }
  if (fig === "action-chunk")
    return figure(
      blocks(["a₀", "a₁", "a₂", "a₃", "a₄", "a₅"], "一次模型预测的6步动作") +
        timelines(
          [
            [
              "控制执行",
              Array.from({ length: 6 }, (_, i) => ({
                start: i,
                end: i + 1,
                label: `a${i}`,
                cls: "compute",
              })),
            ],
          ],
          6,
        ),
      "每个a_i是多维动作向量的身份标签；一次预测不等于一次电机控制。",
    );
  const mode = fig === "robot-sync" ? "sync" : s.mode,
    r = robotQueue(mode, s.latency, s.trigger);
  const spans = (arr) =>
    arr.map((label, i) => ({
      start: i,
      end: i + 1,
      label:
        label === "infer"
          ? "算"
          : label === "act"
            ? "动"
            : label === "wait"
              ? "停"
              : "",
      cls: label === "act" ? "compute" : label === "wait" ? "waiting" : "",
    }));
  return (
    (fig === "robot-sync"
      ? ""
      : control(
          "执行方式",
          "mode",
          [
            ["sync", "同步"],
            ["async", "异步"],
          ],
          s,
        )) +
    control(
      "推理耗时",
      "latency",
      [
        [4, "4节拍"],
        [6, "6节拍"],
      ],
      s,
    ) +
    control(
      "提前请求的剩余动作阈值",
      "trigger",
      [
        [1, "剩1步"],
        [4, "剩4步"],
      ],
      s,
    ) +
    control(
      "追踪控制时刻",
      "tick",
      [
        [3, "t=3"],
        [8, "t=8"],
        [13, "t=13"],
      ],
      s,
    ) +
    figure(
      timelines(
        [
          ["模型推理", spans(r.inference)],
          ["控制执行", spans(r.execution)],
        ],
        18,
      ) +
        blocks(r.sizes, "每拍结束后的动作队列长度") +
        metrics([
          ["当前拍队列", r.sizes[s.tick]],
          ["18拍内执行步", r.consumed],
          ["18拍内等待步", r.waits],
        ]),
      "图中每格为一个人工控制节拍。首次等待、剩余动作耗尽都保留；实际返回动作还需时间戳对齐与融合。",
    )
  );
}
function norm(fig, s) {
  if (fig === "rope-rotation") {
    const r = rotor(s.angle);
    let z =
      line(100, 145, 420, 145) +
      line(260, 20, 260, 270) +
      circle(260, 145, 100, "unit-circle") +
      line(260, 145, 360, 145, "old-vector") +
      line(260, 145, 260 + r.x * 100, 145 - r.y * 100, "new-vector") +
      circle(260 + r.x * 100, 145 - r.y * 100, 5, "series-b") +
      text(385, 165, "x₀") +
      text(270, 25, "x₁") +
      text(32, 45, `θ=${s.angle}°`) +
      text(32, 75, `输入(1,0)`) +
      text(32, 102, `输出(${f(r.x)},${f(r.y)})`);
    return (
      control(
        "位置角 θ",
        "angle",
        [
          [0, "0°"],
          [45, "45°"],
          [90, "90°"],
          [180, "180°"],
        ],
        s,
      ) +
      figure(
        svg(z, "特征对在平面中旋转，长度保持1", 290, 480),
        "旋转矩阵作用于特征对；不同位置选择不同角度。真实RoPE按维度频率配对，不是整行归一化。",
      )
    );
  }
  if (fig === "swiglu") {
    const g = s.scenario ? [-2, 2] : [-1, 1],
      u = [2, 3],
      activated = g.map((x) => x / (1 + Math.exp(-x))),
      out = activated.map((x, i) => x * u[i]);
    return (
      control(
        "Gate输入",
        "scenario",
        [
          [0, "[−1,1]"],
          [1, "[−2,2]"],
        ],
        s,
      ) +
      figure(
        blocks(g, "Gate分支 g") +
          blocks(activated, "silu(g)=g·sigmoid(g)") +
          blocks(u, "Up分支 u") +
          blocks(out, "门控后 silu(g)⊙u"),
        "⊙表示同位置相乘；输出通常再经下投影。负Gate不一定变成零，不能当成ReLU。",
      )
    );
  }
  const x = s.scenario ? [0, 0] : [3, 4],
    squares = x.map((x) => x * x),
    mean = sum(squares) / 2,
    den = Math.sqrt(mean + 1e-5),
    y = x.map((x) => x / den);
  let z = "";
  [0, 1].forEach((i) => {
    z +=
      circle(65, 65 + i * 110, 26, "input") +
      text(54, 70 + i * 110, f(x[i])) +
      line(92, 65 + i * 110, 190, 65 + i * 110, "data-edge") +
      rect(190, 42 + i * 110, 70, 46, "series-a") +
      text(203, 71 + i * 110, f(squares[i])) +
      line(260, 65 + i * 110, 345, 120, "data-edge");
  });
  z +=
    circle(365, 120, 33, "operation") +
    text(351, 125, "Σ/H") +
    line(398, 120, 480, 120, "data-edge") +
    text(438, 90, "+ε，开方") +
    circle(530, 120, 32, "series-b") +
    text(507, 125, f(den));
  return (
    control(
      "输入行",
      "scenario",
      [
        [0, "[3,4]"],
        [1, "[0,0]"],
      ],
      s,
    ) +
    figure(
      svg(z, "平方归约后产生共同分母", 250) +
        blocks(y, "广播同一分母后的输出，γ=[1,1]"),
      "共同分母sqrt(mean(x²)+ε)，ε=10⁻⁵；箭头承载具体数值依赖，不是步骤标题。",
    )
  );
}
function quant(fig, s) {
  if (fig === "quant-format")
    return (
      control(
        "数值表示",
        "format",
        [
          ["integer", "均匀整数网格"],
          ["float", "浮点结构示意"],
        ],
        s,
      ) +
      figure(
        s.format === "integer"
          ? blocks(
              Array.from({ length: 8 }, (_, i) => i - 4),
              "固定Scale下等间距量化码",
            )
          : `<div class="mech-bit-fields"><span>符号</span><span>指数</span><span>尾数</span></div><p class="mech-equation">值 ≈ 符号 × 2^(指数−偏置) × 有效尾数</p>`,
        "浮点字段是概念结构，不代表具体FP8/FP4位数、特殊值或块Scale标准；位宽相同也可能有不同格式。",
      )
    );
  const d = quantize(s.scale, !!s.scenario),
    map = (x) => 310 + x * 75;
  let z = line(25, 160, 595, 160) + text(25, 25, "空心圆=原值，实心圆=还原值");
  for (let i = -7; i <= 7; i++) {
    const x = map(i * s.scale);
    if (x >= 25 && x <= 595)
      z += line(x, 153, x, 168) + text(x - 10, 190, f(i * s.scale), "tiny");
  }
  d.x.forEach((x, i) => {
    const y = 50 + i * 25;
    z +=
      circle(map(x), y, 6, "source-dot") +
      circle(map(d.restored[i]), y, 5, `token-${i}`) +
      line(map(x), y, map(d.restored[i]), y, "error-edge") +
      text(25, y + 5, `x${i}`);
  });
  return (
    control(
      "输入范围",
      "scenario",
      [
        [0, "原始样本"],
        [1, "加入异常值3"],
      ],
      s,
    ) +
    control(
      "量化步长Scale",
      "scale",
      [
        [0.25, ".25"],
        [0.5, ".5"],
      ],
      s,
    ) +
    figure(
      svg(z, "原值向有限网格舍入的几何距离", 225) +
        blocks(d.q, "量化整数码 q") +
        blocks(d.error, "绝对还原误差"),
      `整数码范围[−7,7]，可还原区间[${-7 * s.scale},${7 * s.scale}]；线段长度是数值误差，不是性能开销。异常值3在Scale=.25时被截断，增大Scale可覆盖它但网格更粗。`,
    )
  );
}
function speculativeFigure(fig, s) {
  const d = speculative(s.qmode);
  let z = text(25, 25, "每列是同一个词；高度表示概率质量");
  const series =
    fig === "spec-residual"
      ? [
          ["p", d.p],
          ["已接受", d.accepted],
          ["拒绝后归一残差", d.residual],
          ["重新合成", d.reconstructed],
        ]
      : fig === "spec-accept"
        ? [
            ["p", d.p],
            ["q", d.q],
            ["min(p,q)", d.accepted],
          ]
        : [
            ["目标p", d.p],
            ["草稿q", d.q],
          ];
  series.forEach(([label, a], row) => {
    z += text(20, 70 + row * 68, label);
    a.forEach((val, i) => {
      z +=
        rect(220 + i * 125, 43 + row * 68, 100 * val, 20, `token-${i}`) +
        text(220 + i * 125, 85 + row * 68, `词${i}: ${f(val)}`, "tiny");
    });
  });
  return (
    control(
      "草稿分布",
      "qmode",
      [
        ["close", "接近目标"],
        ["far", "偏向低目标概率词"],
      ],
      s,
    ) +
    figure(
      svg(z, "目标、草稿与残差的概率质量", series.length * 68 + 45) +
        metrics([["平均接受概率", f(d.accept)]]),
      "接受规则min(1,p(x)/q(x))；拒绝后分布由max(p−q,0)归一，接受和拒绝两支合成后恢复p。",
    )
  );
}
function collective(fig, s) {
  const a = s.scenario ? [10, 20] : [1, 2],
    b = [3, 4],
    out = a.map((x, i) => x + b[i]);
  const rows =
    fig === "collective-gather"
      ? [
          ["R0/R1输入", [...a, ...b]],
          ["AllGather（每Rank）", [...a, ...b]],
          ["ReduceScatter R0", [out[0]]],
          ["ReduceScatter R1", [out[1]]],
        ]
      : [
          ["Rank0局部", a],
          ["Rank1局部", b],
          ["Rank0归约后", out],
          ["Rank1归约后", out],
        ];
  return (
    control(
      "Rank0的局部贡献",
      "scenario",
      [
        [0, "[1,2]"],
        [1, "[10,20]"],
      ],
      s,
    ) +
    figure(
      fig === "collective-gather"
        ? svg(
            text(20, 25, "AllGather：不同分片 → 每卡完整拼接") +
              [0, 1]
                .map((rank) =>
                  [...a, ...b]
                    .map(
                      (v, i) =>
                        rect(
                          335 + i * 57,
                          50 + rank * 54,
                          50,
                          34,
                          `owner-${Math.floor(i / 2)}`,
                        ) + text(351 + i * 57, 72 + rank * 54, v),
                    )
                    .join(""),
                )
                .join("") +
              [a, b]
                .map(
                  (arr, r) =>
                    arr
                      .map(
                        (v, i) =>
                          rect(25 + i * 57, 50 + r * 54, 50, 34, `owner-${r}`) +
                          text(41 + i * 57, 72 + r * 54, v),
                      )
                      .join("") +
                    text(150, 72 + r * 54, `Rank${r}`) +
                    [0, 1]
                      .map((dst) =>
                        line(
                          220,
                          66 + r * 54,
                          325,
                          66 + dst * 54,
                          `owner-line-${r}`,
                        ),
                      )
                      .join(""),
                )
                .join("") +
              text(20, 185, "ReduceScatter：先逐坐标求和 → 各卡只留一片") +
              text(25, 225, `${vec(a)} + ${vec(b)} = ${vec(out)}`) +
              out
                .map(
                  (v, i) =>
                    rect(370 + i * 100, 205, 80, 38, `owner-${i}`) +
                    text(392 + i * 100, 230, v) +
                    text(375 + i * 100, 265, `Rank${i}`),
                )
                .join(""),
            "AllGather的拼接身份与ReduceScatter的归约分片",
            290,
          )
        : svg(
            text(25, 25, "同一输出坐标的局部贡献") +
              text(350, 25, "AllReduce：每Rank都有全结果") +
              [a, b]
                .map(
                  (arr, r) =>
                    arr
                      .map(
                        (v, i) =>
                          rect(25 + i * 70, 65 + r * 90, 60, 38, `owner-${i}`) +
                          text(45 + i * 70, 90 + r * 90, v),
                      )
                      .join("") + text(175, 90 + r * 90, `Rank${r}`),
                )
                .join("") +
              [0, 1]
                .map(
                  (r) =>
                    out
                      .map(
                        (v, i) =>
                          rect(
                            355 + i * 70,
                            65 + r * 90,
                            60,
                            38,
                            `owner-${i}`,
                          ) + text(375 + i * 70, 90 + r * 90, v),
                      )
                      .join("") + text(510, 90 + r * 90, `Rank${r}`),
                )
                .join("") +
              [0, 1]
                .flatMap((src) =>
                  [0, 1].map((dst) =>
                    line(245, 84 + src * 90, 345, 84 + dst * 90, "dependence"),
                  ),
                )
                .join("") +
              text(
                40,
                255,
                `坐标0：${a[0]}+${b[0]}=${out[0]}；坐标1：${a[1]}+${b[1]}=${out[1]}`,
              ),
            "同坐标求和后复制给所有Rank",
            285,
          ),
      "每个小格保留输出坐标身份；AllReduce逐坐标求和，AllGather拼接，ReduceScatter归约后各保留一片。",
    )
  );
}
function world(fig, s) {
  if (fig === "world-rssm") {
    const { h, prior, posterior, probs } = rssmStep(
      !!s.scenario,
      s.observation,
    );
    return (
      control(
        "更新模式",
        "scenario",
        [
          [0, "收到观测"],
          [1, "无观测想象"],
        ],
        s,
      ) +
      control(
        "观测倾向",
        "observation",
        [
          [0, "类别0"],
          [1, "类别1"],
        ],
        s,
      ) +
      figure(
        `<p class="mech-equation">hₜ=f(hₜ₋₁,zₜ₋₁,aₜ₋₁)；sₜ=(hₜ,zₜ)</p>${blocks([0.2, 1, 0, 0.1], "已知旧状态与动作：[h旧,z旧的两个分量,a旧]")}${metrics(
          [
            ["递推后的h", f(h)],
            ["本教学递推", "tanh(0.5h旧+0.2z旧[0]+a旧)"],
          ],
        )}<div class="mech-matrix-row">${matrixView([prior], "先验 p(z|h)")}${matrixView([posterior], s.scenario ? "后验不可用：没有本时刻x" : "后验 q(z|h,x)")}</div><div class="mech-probability">${probs.map((p, i) => `<div><strong>新z类别${i}</strong><span style="width:${p * 100}%">${f(p)}</span></div>`).join("")}</div>${metrics(
          [
            [
              "本轮使用的分布",
              s.scenario ? "先验p；不读取右侧后验" : "后验q；使用本次观测",
            ],
            ["状态边界", "h是记忆；z需从类别分布采样，不是把h当z"],
          ],
        )}`,
        "数值网络为手工标量示例，非Dreamer参数；先验logits=[h,−h]，后验示例另加观测倾向±1。想象模式下右侧数值只作不可用的反事实对照；不参与当前分布。真实RSSM使用高维网络与多组离散变量。",
      )
    );
  }
  if (fig === "world-belief") {
    const prior = [0.6, 0.4],
      likelihood = s.observation ? [0.2, 0.8] : [0.8, 0.2],
      unnorm = prior.map((p, i) => p * likelihood[i]),
      post = unnorm.map((p) => p / sum(unnorm));
    return (
      control(
        "新观测偏向哪个状态",
        "observation",
        [
          [0, "偏向状态0"],
          [1, "偏向状态1"],
        ],
        s,
      ) +
      figure(
        blocks(prior, "动态预测的先验概率") +
          blocks(likelihood, "观测似然：各状态下看到观测的可能性") +
          blocks(unnorm, "逐项相乘：尚未归一") +
          blocks(post, "观测更新后的后验概率"),
        "两状态Bayes教学例，不是Dreamer网络参数。先验来自预测，后验还依赖新观测。",
      )
    );
  }
  if (fig === "world-patches" || fig === "world-attention") {
    const F = s.frames,
      P = 4,
      N = F * P;
    return (
      control(
        "视频帧数",
        "frames",
        [
          [2, "2帧"],
          [4, "4帧"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-video-frames">${Array.from({ length: F }, (_, i) => `<section><strong>帧${i}</strong><div>${Array.from({ length: 4 }, (_, j) => `<span class="owner-${i}">${i}:${j}</span>`).join("")}</div></section>`).join("")}</div>${
          fig === "world-attention"
            ? matrixView(
                Array.from({ length: N }, (_, i) =>
                  Array.from({ length: N }, (_, j) =>
                    Math.floor(i / P) === Math.floor(j / P) ? "内" : "跨",
                  ),
                ),
                "行Query / 列Key：同帧与跨帧配对",
              )
            : ""
        }${metrics([
          ["Token数 F×P", N],
          ["全局配对 N²", N * N],
          ["仅帧内 F×P²", F * P * P],
        ])}`,
        "每帧4个Patch Token；“内/跨”是连接身份，不是注意力权重。省掉跨帧连接会改变模型功能。",
      )
    );
  }
  const actions = s.path
    ? [
        [1, 0],
        [0, 1],
        [1, 0],
      ]
    : [
        [1, 0],
        [1, 0],
        [0, 1],
      ];
  let x = 0,
    y = 0,
    points = [[x, y]];
  actions.forEach(([dx, dy]) => {
    x += dx;
    y += dy;
    points.push([x, y]);
  });
  let z = "";
  for (let i = 0; i < 5; i++)
    z +=
      line(70 + i * 80, 35, 70 + i * 80, 275, "grid") +
      line(70, 35 + i * 60, 390, 35 + i * 60, "grid");
  points.forEach(([x, y], i) => {
    const X = 70 + x * 80,
      Y = 275 - y * 60;
    if (i)
      z += line(
        70 + points[i - 1][0] * 80,
        275 - points[i - 1][1] * 60,
        X,
        Y,
        "new-vector",
      );
    z += circle(X, Y, 7, `token-${i}`) + text(X + 10, Y - 8, `s${i}`);
  });
  z +=
    text(410, 70, "策略：选择动作") +
    text(410, 115, "模型：预测未来状态") +
    text(410, 160, "规划：比较候选轨迹");
  return (
    control(
      "候选动作序列",
      "path",
      [
        [0, "右、右、上"],
        [1, "右、上、右"],
      ],
      s,
    ) +
    figure(
      svg(z, "候选动作与预测轨迹的状态平面", 310),
      "s′=s+a是手工确定性动态模型；真实世界模型从数据学习，预测误差可随滚动累积。",
    )
  );
}
function address(s, shared = false) {
  const stride = s.stride,
    addr = Array.from({ length: 8 }, (_, i) => i * stride * 4),
    segment = addr.map((x) => Math.floor(x / 32));
  let z = text(25, 25, "上方：Lane；下方：字节地址所属32B段");
  for (let i = 0; i < 8; i++) {
    const x = 45 + i * 70;
    z +=
      circle(x, 70, 18, `owner-${i % 4}`) +
      text(x - 10, 75, `L${i}`) +
      line(x, 89, x, 135, "data-edge") +
      rect(x - 27, 135, 54, 52, `owner-${segment[i] % 4}`) +
      text(x - 20, 157, `${addr[i]}B`) +
      text(x - 17, 178, `段${segment[i]}`, "tiny");
  }
  if (shared)
    z += text(35, 240, "Shared：程序显式搬入同一Tile，同步后多个消费者复用");
  return (
    control(
      "相邻Lane的元素间隔",
      "stride",
      [
        [1, "连续stride=1"],
        [8, "跨步stride=8"],
      ],
      s,
    ) +
    figure(
      svg(z, "线程地址与内存段的映射", shared ? 275 : 220) +
        metrics([
          ["有效负载", `${8 * 4}Byte`],
          ["覆盖段数", new Set(segment).size],
          ["覆盖字节", `${new Set(segment).size * 32}Byte`],
        ]),
      "颜色只辅助分组，地址与段编号才是身份。图不模拟完整Warp事务、缓存命中或真实DRAM流量。",
    )
  );
}
function warp(fig, s) {
  const trace = warpTrace(s.warps);
  return (
    control(
      "可用的独立Warp",
      "warps",
      [
        [1, "仅W0"],
        [4, "W0加三条独立Warp"],
      ],
      s,
    ) +
    figure(
      `<div class="mech-warp-grid"><div><strong>人工周期</strong>${trace.map((t) => `<span>${t.cycle}</span>`).join("")}</div><div><strong>发射槽</strong>${trace.map((t) => `<span class="${t.issued === "空槽" ? "unused" : "issued"}">${t.issued}</span>`).join("")}</div><div><strong>W0等结果</strong>${trace.map((t) => `<span>${t.wait || "—"}</span>`).join("")}</div></div>${fig === "warp-sets" ? `<div class="mech-set-figure"><div>Active 驻留 ${s.warps}<div>Eligible 就绪（随周期变化）<div>Issued 被选中（最多1槽）</div></div></div></div>` : ""}`,
      "load周期0发出，结果假设周期4可用。额外Warp填补空槽，未缩短W0自身依赖延迟；不是B200周期模型。",
    )
  );
}
function pipeline(fig, s) {
  if (fig.startsWith("tensor-")) {
    const d = tileTrace(2, 2),
      phase = s.source;
    let z = text(20, 25, "TMEM最小分配示意：32列 × 128个32-bit位置 = 16KiB");
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 32; col++)
        z += rect(25 + col * 12, 48 + row * 22, 10, 18, "series-a");
    z +=
      text(25, 160, "每行聚合32个TMEM lane；不是32条CUDA线程") +
      text(425, 70, "显式分配 / 释放") +
      text(425, 110, "与Shared分属空间");
    return (
      control(
        "追踪同一次操作",
        "source",
        [
          [0, "搬运未完成"],
          [1, "SMEM就绪"],
          [2, "MMA已提交"],
          [3, "完成已确认"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-matrix-row">${matrixView(phase ? d.A : d.A.map((row) => row.map(() => "?")), "SMEM：A逻辑Tile")}${matrixView(phase ? d.B : d.B.map((row) => row.map(() => "?")), "SMEM：B逻辑Tile")}${matrixView(phase === 3 ? d.C : d.C.map((row) => row.map(() => "?")), "TMEM：D=A×B，初值0")}</div>${metrics(
          [
            [
              "搬运完成条件",
              phase ? "对应TMA完成屏障已满足" : "不能让MMA读取未就绪的SMEM",
            ],
            [
              "MMA完成条件",
              phase === 3
                ? "commit追踪的完成已确认；仍按协议读取"
                : "提交或输入就绪，都不代表TMEM结果可读",
            ],
            [
              "下一步",
              phase === 3
                ? "按tcgen05.ld及同步规则取结果"
                : phase === 2
                  ? "等待对应mbarrier并处理跨线程fence"
                  : phase === 1
                    ? "可以按合法描述符提交MMA"
                    : "等待搬运完成",
            ],
          ],
        )}${svg(z, "Tensor Memory列分配资源和逻辑累加器状态", 185)}`,
        "依据PTX ISA 8.8 sm_100a/f：B在SMEM，A可在SMEM或TMEM，D在TMEM。上方4×4只是可手算的逻辑裁片，不是合法MMA形状或物理布局；下方才说明分配单位。TMA完成与tcgen05完成是不同事件，mbarrier的phase还需按实际代码管理。",
      )
    );
  }
  const double = s.stages === 2;
  return (
    control(
      "缓冲槽数",
      "stages",
      [
        [1, "1槽：串行复用"],
        [2, "2槽：可交叠"],
      ],
      s,
    ) +
    figure(
      `<div class="mech-ring"><div class="series-a"><strong>slot0</strong><span>Tile0</span><small>消费者未完成前不可覆盖</small></div>${double ? '<div class="series-b"><strong>slot1</strong><span>Tile1</span><small>生产者可准备下一块</small></div>' : ""}</div>${timelines(
        [
          [
            "搬运",
            double
              ? [
                  { start: 0, end: 1, label: "Tile0" },
                  { start: 1, end: 2, label: "Tile1" },
                ]
              : [
                  { start: 0, end: 1, label: "Tile0" },
                  { start: 2, end: 3, label: "Tile1" },
                ],
          ],
          [
            "计算",
            double
              ? [
                  { start: 1, end: 2, label: "Tile0", cls: "compute" },
                  { start: 2, end: 3, label: "Tile1", cls: "compute" },
                ]
              : [
                  { start: 1, end: 2, label: "Tile0", cls: "compute" },
                  { start: 3, end: 4, label: "Tile1", cls: "compute" },
                ],
          ],
        ],
        4,
        "人工阶段",
      )}${metrics([
        ["每槽容量（假设）", "16KiB"],
        ["总缓冲容量", `${s.stages * 16}KiB`],
      ])}`,
      "顺序：槽可写→搬运完成可见→计算完成→槽可复用。具体TMA/tcgen05协议另核对ISA，图不伪造真实指令时序。",
    )
  );
}
function requestQueue(fig, s) {
  const q = queueTrace(s.service);
  if (fig === "slo-points") {
    let z =
      line(60, 220, 580, 220) +
      line(60, 30, 60, 220) +
      line(60, 120, 580, 120, "reference") +
      text(400, 109, "5ms阈值");
    q.forEach((r, i) => {
      z +=
        circle(
          130 + i * 120,
          220 - r.response * 20,
          8,
          r.response <= 5 ? "series-a" : "bad",
        ) +
        text(115 + i * 120, 250, `R${i}`) +
        text(116 + i * 120, 200 - r.response * 20, `${r.response}ms`);
    });
    return (
      control(
        "每条服务时间",
        "service",
        [
          [2, "2ms"],
          [3, "3ms"],
        ],
        s,
      ) +
      figure(
        svg(z, "响应时延与SLO阈值", 280),
        `满足5ms阈值 ${q.filter((x) => x.response <= 5).length}/4；四个样本不能估计可靠P99。`,
      )
    );
  }
  return (
    control(
      "每条服务时间",
      "service",
      [
        [2, "2ms"],
        [3, "3ms"],
      ],
      s,
    ) +
    figure(
      timelines(
        q.map((r) => [
          `R${r.id}`,
          [
            { start: r.arrival, end: r.start, label: "等待", cls: "waiting" },
            { start: r.start, end: r.end, label: "服务", cls: "compute" },
          ].filter((x) => x.end > x.start),
        ]),
        12,
        "ms（假设）",
      ) +
        blocks(
          q.map((r) => r.response),
          "完成时刻减到达时刻＝响应时间",
        ),
      "每条请求的到达时刻0/1/2/3ms；等待与服务在同一尺度上，延迟由队列累积。",
    )
  );
}
function mla(s) {
  const c = [2, 1],
    U = [
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    q = s.scenario ? [0, 1, 2] : [1, 2, 0],
    k = U.map((r) => sum(r.map((x, i) => x * c[i]))),
    q2 = [0, 1].map((i) => sum(U.map((r, j) => r[i] * q[j])));
  return (
    control(
      "Query",
      "scenario",
      [
        [0, "[1,2,0]"],
        [1, "[0,1,2]"],
      ],
      s,
    ) +
    figure(
      `<div class="mech-matrix-row">${matrixView([c], "缓存c（2维）")}${matrixView(U, "U（3×2）")}${matrixView([k], "显式k=Uc（3维）")}</div><div class="mech-matrix-row">${matrixView([q], "当前q（3维）")}${matrixView([q2], "Query侧 Uᵀq（2维）")}</div>${metrics(
        [
          ["显式 qᵀ(Uc)", f(sum(q.map((x, i) => x * k[i])))],
          ["吸收 (Uᵀq)ᵀc", f(sum(q2.map((x, i) => x * c[i])))],
          ["本例历史侧存储维度", "展开3 → 潜向量2"],
        ],
      )}`,
      "只核对内容Key支路的结合律；Value、多头与解耦位置分量需另外处理。",
    )
  );
}
function profile(fig, s) {
  const hot = s.scenario ? 2 : 4;
  return (
    control(
      "热点优化",
      "scenario",
      [
        [0, "4ms基线"],
        [1, "2ms对照"],
      ],
      s,
    ) +
    figure(
      timelines(
        [
          [
            "请求关键路径",
            [
              { start: 0, end: 2, label: "排队", cls: "waiting" },
              { start: 2, end: 4, label: "CPU" },
              { start: 4, end: 4 + hot, label: "热点", cls: "compute" },
              { start: 4 + hot, end: 6 + hot, label: "其他" },
            ],
          ],
        ],
        10,
        "ms（串行假设）",
      ) +
        metrics([
          ["当前总量", `${6 + hot}ms`],
          ["热点局部加速", `${4 / hot}倍`],
          ["端到端加速", `${f(10 / (6 + hot))}倍`],
        ]),
      "这是一份可证伪的串行账本。若实测不满足预测，应检查重叠、测量边界与其它阶段，不改指标掩盖反例。",
    )
  );
}
export const figureKinds = new Set([
  "tensor-memory",
  "tensor-completion",
  "flow-training",
  "world-rssm",
  "delta-triangle",
  "delta-read",
  "delta-write",
  "delta-update",
  "delta-decay",
  "delta-chunk",
  "state-tiles",
  "state-cost",
  "compiler-route",
  "fusion-buffers",
  "compiler-mask",
  "compiler-ir",
  "layout-ownership",
  "scheduler-requests",
  "scheduler-budget",
  "scheduler-kv",
  "scheduler-rounds",
  "scheduler-batch",
  "moe-scores",
  "moe-buckets",
  "moe-network",
  "expert-matrices",
  "moe-combine",
  "kv-map",
  "kv-share",
  "kv-append",
  "kv-release",
  "kv-capacity",
  "attention-weights",
  "softmax-tiles",
  "softmax-rescale",
  "attention-storage",
  "gemm-tiles",
  "gemm-reduction",
  "tile-boundary",
  "roofline",
  "stream-events",
  "graph-replay",
  "buffer-ownership",
  "copy-overlap",
  "action-chunk",
  "flow-field",
  "robot-queue",
  "robot-sync",
  "robot-async",
  "norm-reduction",
  "rope-rotation",
  "swiglu",
  "quant-numberline",
  "quant-format",
  "spec-distributions",
  "spec-accept",
  "spec-residual",
  "collective-partials",
  "collective-reduce",
  "collective-gather",
  "communication-scale",
  "world-rollout",
  "world-belief",
  "world-patches",
  "world-attention",
  "address-sectors",
  "shared-reuse",
  "warp-scoreboard",
  "warp-sets",
  "warp-timeline",
  "pipeline-slots",
  "pipeline-overlap",
  "request-queue",
  "slo-points",
  "mla-expand",
  "mla-absorb",
  "profile-critical",
  "profile-amdahl",
  "projection-tiles",
  "causal-matrix",
  "gqa-heads",
  "kv-volume",
  "transfer-bytes",
  "kv-handoff",
  "pd-timeline",
  "framework-evidence",
  "framework-latency",
]);
export function renderMechanism(fig, s = defaultLab()) {
  if (!figureKinds.has(fig)) throw Error(`Unknown mechanism figure: ${fig}`);
  if (fig.startsWith("delta-") || fig === "state-tiles" || fig === "state-cost")
    return linear(fig, s);
  if (
    [
      "compiler-route",
      "fusion-buffers",
      "compiler-mask",
      "compiler-ir",
      "layout-ownership",
    ].includes(fig)
  )
    return compiler(fig, s);
  if (fig.startsWith("scheduler-")) return scheduler(fig, s);
  if (fig.startsWith("moe-") || fig === "expert-matrices") return moe(fig, s);
  if (["kv-map", "kv-share", "kv-append", "kv-release"].includes(fig))
    return kv(fig, s);
  if (fig.startsWith("attention-") || fig.startsWith("softmax-"))
    return attention(fig, s);
  if (
    fig.startsWith("gemm-") ||
    fig === "tile-boundary" ||
    fig === "roofline" ||
    fig === "projection-tiles"
  )
    return gemm(fig, s);
  if (
    [
      "stream-events",
      "graph-replay",
      "buffer-ownership",
      "copy-overlap",
    ].includes(fig)
  )
    return runtime(fig, s);
  if (
    fig.startsWith("robot-") ||
    fig.startsWith("flow-") ||
    fig === "action-chunk"
  )
    return robot(fig, s);
  if (["norm-reduction", "rope-rotation", "swiglu"].includes(fig))
    return norm(fig, s);
  if (fig.startsWith("quant-")) return quant(fig, s);
  if (fig.startsWith("spec-")) return speculativeFigure(fig, s);
  if (fig.startsWith("collective-")) return collective(fig, s);
  if (fig.startsWith("world-")) return world(fig, s);
  if (fig === "address-sectors" || fig === "shared-reuse")
    return address(s, fig === "shared-reuse");
  if (fig.startsWith("warp-")) return warp(fig, s);
  if (fig.startsWith("pipeline-") || fig.startsWith("tensor-"))
    return pipeline(fig, s);
  if (fig === "request-queue" || fig === "slo-points")
    return requestQueue(fig, s);
  if (fig.startsWith("mla-")) return mla(s);
  if (fig.startsWith("profile-")) return profile(fig, s);
  if (fig === "causal-matrix")
    return (
      control(
        "本轮查询模式",
        "scenario",
        [
          [0, "Prefill"],
          [1, "Decode"],
        ],
        s,
      ) + frameFigure(courseModel("llm-block", !!s.scenario)[1])
    );
  if (fig === "kv-volume" || fig === "kv-capacity")
    return (
      control(
        "上下文规模",
        "scenario",
        [
          [0, "较短"],
          [1, "较长"],
        ],
        s,
      ) +
      frameFigure(
        courseModel(
          fig === "kv-volume" ? "llm-block" : "kv-cache",
          !!s.scenario,
        )[3],
      )
    );
  if (fig === "gqa-heads") {
    let z =
      text(30, 25, "Query头（每个头保留自己的查询）") +
      text(365, 25, "共享的KV头");
    for (let i = 0; i < 4; i++) {
      z +=
        circle(90, 65 + i * 52, 20, `owner-${i}`) +
        text(77, 70 + i * 52, `Q${i}`);
      const e = Math.floor(i / (4 / s.hkv));
      z += line(112, 65 + i * 52, 407, 95 + e * 100, "data-edge");
    }
    for (let i = 0; i < s.hkv; i++)
      z +=
        rect(410, 68 + i * 100, 130, 55, "expert") +
        text(425, 101 + i * 100, `K${i} / V${i}`);
    return (
      control(
        "KV头数",
        "hkv",
        [
          [1, "MQA：1头"],
          [2, "GQA：2头"],
        ],
        s,
      ) +
      figure(
        svg(z, "Query头到共享KV头的归属", 290),
        "线表示Query头读取哪一组历史KV，不表示Query输出被合并。",
      )
    );
  }
  if (fig === "kv-handoff") {
    return (
      control(
        "交付状态",
        "transfer",
        [
          [0, "尚未传输"],
          [1, "部分到达"],
          [2, "全部就绪"],
        ],
        s,
      ) +
      figure(
        `<div class="mech-handoff"><section><h3>P端：已生成</h3>${blocks([0, 1, 2, 3], "KV片段身份")}</section><section><h3>D端：本地目标槽</h3><div class="mech-budget">${[0, 1, 2, 3].map((i) => `<span class="${i < (s.transfer === 2 ? 4 : s.transfer === 1 ? 2 : 0) ? "request-A" : "unused"}">${i < (s.transfer === 2 ? 4 : s.transfer === 1 ? 2 : 0) ? `KV${i}` : "未到"}</span>`).join("")}</div></section></div>${metrics([["Decode读历史", s.transfer === 2 ? "允许：还需满足布局与依赖" : "不能读取尚未到达的片段"]])}`,
        "片段显示为聚合对象，非真实块尺寸。控制元数据就绪不等于KV数据全部可读。",
      )
    );
  }
  if (fig === "transfer-bytes" || fig === "pd-timeline")
    return (
      control(
        "上下文长度",
        "scenario",
        [
          [0, "2048"],
          [1, "8192"],
        ],
        s,
      ) +
      frameFigure(
        courseModel("pd-disagg", !!s.scenario)[
          fig === "transfer-bytes" ? 0 : 2
        ],
      )
    );
  if (fig === "communication-scale")
    return (
      control(
        "载荷大小",
        "scenario",
        [
          [0, "8 MB"],
          [1, "16 MB"],
        ],
        s,
      ) +
      figure(
        svg(
          Array.from({ length: 6 }, (_, i) => {
            const size = 2 ** i,
              time = size / 25;
            return (
              rect(70, 40 + i * 35, time * 280, 22, "series-a") +
              text(10, 56 + i * 35, `${size}MB`) +
              text(80 + time * 280, 56 + i * 35, `${f(time)}ms`)
            );
          }).join("") + line(70, 30, 70, 255, "axis"),
          "固定25GB/s有效带宽时的载荷传输下界",
          275,
        ) +
          metrics([
            ["消息大小（假设）", s.scenario ? "16MB" : "8MB"],
            ["有效带宽（假设）", "25GB/s"],
            ["仅载荷传输下界", s.scenario ? "0.64ms" : "0.32ms"],
          ]),
        "横向长度表示时间：T=M/BW。载荷之外还需启动、同步和排队；有效带宽假设不代表真实NCCL基准或链路规格。",
      )
    );
  if (fig === "framework-evidence")
    return (
      control(
        "比较条件",
        "scenario",
        [
          [0, "同预算固定负载"],
          [1, "出现长尾对照"],
        ],
        s,
      ) +
      frameFigure(courseModel("frameworks", !!s.scenario)[s.scenario ? 2 : 0])
    );
  if (fig === "framework-latency")
    return (
      control(
        "A的响应分布",
        "scenario",
        [
          [0, "无长尾"],
          [1, "有长尾"],
        ],
        s,
      ) + frameFigure(courseModel("frameworks", !!s.scenario)[2])
    );
  throw Error(`No renderer for ${fig}`);
}
