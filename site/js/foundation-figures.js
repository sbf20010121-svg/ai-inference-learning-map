import * as N from "./foundation-numerics.js";
const e = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const f = (x) =>
  typeof x === "number"
    ? Math.abs(x) > 0 && Math.abs(x) < 0.001
      ? x.toExponential(2)
      : Number(x.toFixed(4)).toString()
    : String(x);
const text = (x, y, s, cls = "") =>
  `<text x="${x}" y="${y}" class="${cls}">${e(s)}</text>`;
const rect = (x, y, w, h, cls = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="${cls}"/>`;
const line = (x, y, a, b, cls = "data-edge") =>
  `<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" class="${cls}"/>`;
const dot = (x, y, r = 5, cls = "series-a") =>
  `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
function svg(body, label, height = 290, width = 620) {
  return `<p class="ff-scroll-hint">宽图可左右滑动查看，坐标与字号保持不变。</p><div class="mech-scroll"><svg class="mech-svg ff-svg" viewBox="0 0 ${width} ${height}" style="--figure-width:${width}px" role="img" aria-label="${e(label)}"><title>${e(label)}</title>${body}</svg></div>`;
}
function matrix(A, label, classes = null) {
  return `<figure class="mech-matrix"><figcaption>${e(label)}</figcaption><div class="mech-grid" style="--n:${A[0].length}">${A.map((r, i) => r.map((v, j) => `<span class="${classes ? classes(i, j) : ""}"><small>${i},${j}</small>${e(f(v))}</span>`).join("")).join("")}</div></figure>`;
}
const matrices = (...items) =>
  `<div class="mech-matrix-row">${items.join("")}</div>`;
const array = (a, label, identity = true) =>
  `<div class="mech-array"><strong>${e(label)}</strong><div>${a.map((v, i) => `<span class="${identity ? "owner-" + (i % 4) : ""}"><small>${i}</small>${e(f(v))}</span>`).join("")}</div></div>`;
const metrics = (rows) =>
  `<dl class="mech-metrics">${rows.map(([name, value]) => `<div><dt>${e(name)}</dt><dd>${e(f(value))}</dd></div>`).join("")}</dl>`;
const table = (headers, rows) =>
  `<div class="mech-scroll"><table class="ff-table"><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${e(f(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
function control(label, key, choices, s) {
  return `<fieldset class="mech-control"><legend>${e(label)}</legend>${choices.map(([v, name]) => `<button type="button" data-mech-key="${key}" data-mech-value="${v}" aria-pressed="${s[key] === v}">${e(name)}</button>`).join("")}</fieldset>`;
}
const select = (label, choices, s) =>
  control(label, "case", choices, { ...s, case: s.case % choices.length });
function bars(rows, label, max = null) {
  const bound = max || Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="ff-bars" aria-label="${e(label)}"><strong>${e(label)}</strong>${rows.map(([name, v], i) => `<div><span>${e(name)}</span><div><i class="owner-${i % 4}" style="width:${(Math.max(0, v) / bound) * 100}%"></i></div><b>${e(f(v))}</b></div>`).join("")}</div>`;
}
function probability(rows, label) {
  return bars(rows, label, 1);
}
function timeline(rows, max, label = "教学节拍") {
  const ticks = Array.from(
    { length: Math.min(max + 1, 17) },
    (_, i) => (i * max) / Math.min(max, 16),
  );
  return `<div class="mech-scroll"><div class="mech-timeline"><div class="mech-time-axis"><span>${e(label)}</span><div>${ticks.map((t) => `<small style="left:${(t / max) * 100}%">${f(t)}</small>`).join("")}</div></div>${rows.map(([name, segments]) => `<div class="mech-time-row"><strong>${e(name)}</strong><div>${segments.map((v, i) => `<span class="owner-${v.color ?? i % 4}" style="left:${(v.start / max) * 100}%;width:${((v.end - v.start) / max) * 100}%" aria-label="${e(v.label)}：${v.start}至${v.end}${e(label)}">${e(v.label)}</span>`).join("")}</div></div>`).join("")}</div></div>`;
}
function node(x, y, name, value, cls = "operation") {
  return (
    dot(x, y, 25, cls) +
    `<text x="${x}" y="${y - 2}" text-anchor="middle">${e(name)}</text><text x="${x}" y="${y + 17}" text-anchor="middle">${e(value)}</text>`
  );
}
function curve(series, label, yMax = 5) {
  let z = line(60, 240, 565, 240, "axis") + line(60, 30, 60, 240, "axis");
  const n = Math.max(...series.map((s) => s.values.length));
  for (let t = 0; t < n; t++)
    z += text(55 + (t * 480) / Math.max(1, n - 1), 265, t);
  for (let tick = 0; tick <= 5; tick++)
    z +=
      text(25, 245 - tick * 40, f((tick * yMax) / 5)) +
      line(60, 240 - tick * 40, 565, 240 - tick * 40, "grid");
  series.forEach((s, k) => {
    s.values.forEach((v, i) => {
      const x = 60 + (i * 480) / Math.max(1, n - 1),
        y = 240 - (v * 200) / yMax;
      if (i)
        z += line(
          60 + ((i - 1) * 480) / Math.max(1, n - 1),
          240 - (s.values[i - 1] * 200) / yMax,
          x,
          y,
          `ff-line-${k}`,
        );
      z += dot(x, y, 5, `owner-${k}`);
    });
    z +=
      dot(18 + k * 195, 15, 4, `owner-${k}`) + text(28 + k * 195, 20, s.name);
  });
  return svg(z, label, 290);
}
function frame(body, caption, controls = "") {
  return `${controls}<figure class="mech-figure foundation-figure">${body}<figcaption>${e(caption)}</figcaption></figure>`;
}
const c2 = (s) => s.case % 2;
export function renderFoundationFigure(figure, s) {
  const [, id, view] = figure.split("/"),
    c = c2(s),
    pick = s.pick || 0,
    step = s.step || 0;
  switch (id) {
    case "tensor-address": {
      const trans = view === "transpose" ? !!c : false,
        mutate = view === "alias" && !!c,
        d = N.addressView(trans, mutate),
        chosen = pick % 6;
      let z =
        text(25, 25, `逻辑Shape=[${d.shape}]，Stride=[${d.strides}]`) +
        text(405, 25, "同一底层存储");
      d.addresses.forEach((r, i) =>
        r.forEach((a, j) => {
          const x = 40 + j * 85,
            y = 55 + i * 65;
          z +=
            rect(x, y, 65, 43, `owner-${a % 4}`) +
            text(x + 5, y + 17, `(${i},${j})`) +
            text(x + 24, y + 35, d.storage[a]);
          if (a === chosen) z += line(x + 65, y + 22, 405, 60 + a * 43);
        }),
      );
      d.storage.forEach(
        (v, a) =>
          (z +=
            rect(405, 40 + a * 43, 125, 35, `owner-${a % 4}`) +
            text(414, 63 + a * 43, `槽${a} = ${v}`)),
      );
      return frame(
        svg(z, "逻辑坐标到同一底层槽的映射", 330) +
          metrics([
            ["选中物理槽", chosen],
            ["可读值", d.storage[chosen]],
            ["连续行主序", trans ? "转置视图，不再是原连续顺序" : "原2×3布局"],
          ]),
        "同色与槽号保留数据身份；连线是当前选中槽的地址映射。转置交换Shape/Stride，写视图时共享存储仍可观察到变化。",
        (view === "address"
          ? ""
          : select(
              view === "alias" ? "写共享槽5" : "视图",
              [
                [0, view === "alias" ? "原值" : "原布局"],
                [1, view === "alias" ? "槽5写99" : "转置视图"],
              ],
              s,
            )) +
          control(
            "追踪物理槽",
            "pick",
            [0, 1, 2, 5].map((i) => [i, `槽${i}`]),
            s,
          ),
      );
    }
    case "ir-ssa": {
      if (view === "effect")
        return frame(
          timeline(
            [
              [
                "正确",
                [
                  { start: 0, end: 1, label: "store 7" },
                  { start: 1, end: 2, label: "load→7" },
                ],
              ],
              [
                "错误交换",
                [
                  { start: 0, end: 1, label: "load→0" },
                  { start: 1, end: 2, label: "store 7" },
                ],
              ],
            ],
            2,
          ) +
            metrics([
              ["最终内存", 7],
              ["读取结果是否相同", "7 ≠ 0"],
            ]),
          "每条横条是一次访问；初始内存0。SSA值依赖以外，内存读写也可能限制顺序。",
        );
      const x = c ? 4 : 2,
        y = 1,
        u = 2 * x,
        w = 3 * y;
      const z =
        line(95, 80, 285, 80) +
        line(95, 205, 285, 205) +
        line(310, 80, 500, 145) +
        line(310, 205, 500, 145) +
        node(70, 80, "x", x, "input") +
        node(70, 205, "y", y, "input") +
        node(310, 80, "×2", u) +
        node(310, 205, "×3", w) +
        node(525, 145, "+", u + w);
      return frame(
        svg(z, "算术SSA值与消费者依赖") +
          metrics([
            ["可独立产生的值", `u=${u}，w=${w}`],
            ["必须等两者的值", `v=${u + w}`],
          ]),
        "连线从值的定义指向使用该值的操作。两条独立分支不等于最终加法可以提前使用未产生的值。",
        select(
          "改变输入x",
          [
            [0, "x=2"],
            [1, "x=4"],
          ],
          s,
        ),
      );
    }
    case "graph-capture": {
      if (view === "region")
        return frame(
          timeline(
            [
              [
                "捕获区域",
                [
                  { start: 0, end: 2, label: "u=2x" },
                  { start: 4, end: 6, label: "y=u+1" },
                ],
              ],
              ["区域外执行", [{ start: 2, end: 4, label: "未捕获行为" }]],
            ],
            6,
            "逻辑执行段",
          ),
          "条长仅区分区域，不表示实测时间。Graph Break保留区域外行为，不是删除Python语义。",
        );
      const index = s.case % 3,
        inputs = [
          { B: 2, H: 4, dtype: "f32" },
          { B: 3, H: 4, dtype: "f32" },
          { B: 3, H: 8, dtype: "f16" },
        ],
        v = inputs[index],
        ok = v.H === 4 && v.dtype === "f32";
      return frame(
        table(
          ["条件", "产物要求", "当前输入", "通过"],
          [
            ["Batch", "这组Guard未固定", v.B, "是"],
            ["末维H", 4, v.H, v.H === 4 ? "是" : "否"],
            ["dtype", "f32", v.dtype, v.dtype === "f32" ? "是" : "否"],
          ],
        ) + metrics([["这组Guard能否复用", ok ? "可以" : "不可以"]]),
        "固定教学Guard要求设备相同、H=4、dtype=f32；真实Guard以实际捕获日志为准。",
        select(
          "本次输入",
          [
            [0, "B2,H4,f32"],
            [1, "B3,H4,f32"],
            [2, "B3,H8,f16"],
          ],
          s,
        ),
      );
    }
    case "symbolic-shapes": {
      if (view === "amortize") {
        const n = c ? 200 : 50;
        return frame(
          bars(
            [
              ["未编译执行", 5 * n],
              ["编译后总成本", 100 + 4 * n],
            ],
            "串行成本账本 ms",
          ) +
            metrics([
              ["调用次数", n],
              ["编译一次", 100],
              ["每次执行对照", "5ms / 4ms"],
            ]),
          "所有时间是人为假设；n=100收支平衡，不能只比较热运行单次时长。",
          select(
            "调用次数",
            [
              [0, "50次"],
              [1, "200次"],
            ],
            s,
          ),
        );
      }
      const d = N.shapeCache(!!c);
      return frame(
        table(
          ["输入B", "教学缓存键", "是否命中"],
          d.rows.map((r) => [r.B, r.key, r.hit ? "命中" : "首次建立"]),
        ) +
          metrics([
            ["产物版本数", d.versions],
            ["B=16满足动态范围吗", "否：范围只允许1..8"],
          ]),
        "静态模式只按B完全特化；动态模式明确限定H=4、1≤B≤8。两者都不是实际完整缓存键。",
        select(
          "特化策略",
          [
            [0, "按B静态特化"],
            [1, "约束动态版本"],
          ],
          s,
        ),
      );
    }
    case "graph-rewrite": {
      if (view === "float")
        return frame(
          table(
            ["三位有效十进制模拟", "先算小数之和", "先大数抵消"],
            [
              ["表达式", "1000+(-1000+0.4)", "(1000-1000)+0.4"],
              ["中间舍入", "-999.6→-1000", "1000-1000→0"],
              ["结果", 0, 0.4],
            ],
          ),
          "明确采用三位有效十进制的手算舍入，不是FP16指令仿真。实数结合律不能自动保证浮点逐位相等。",
        );
      const x = c ? 3 : 2,
        v = x + 1;
      if (view === "fold")
        return frame(
          matrices(
            matrix([[2, 3]], "编译期可见常量"),
            matrix([[5, x, 5 * x]], "常量5 / 输入x / 输出"),
          ),
          "常量2+3折叠为5；x仍是运行输入，所以5x不能提前变成固定输出。",
          select(
            "运行输入",
            [
              [0, "x=2"],
              [1, "x=3"],
            ],
            s,
          ),
        );
      let z =
        text(20, 25, "原图：相同操作和输入，各自定义") +
        text(340, 25, "CSE：一次定义，两次消费");
      z +=
        node(60, 135, "x", x, "input") +
        node(190, 80, "+1", v) +
        node(190, 200, "+1", v) +
        node(285, 135, "+", 2 * v) +
        line(85, 135, 165, 80) +
        line(85, 135, 165, 200) +
        line(215, 80, 260, 135) +
        line(215, 200, 260, 135);
      z +=
        node(370, 135, "x", x, "input") +
        node(460, 135, "+1", v) +
        node(575, 135, "+", 2 * v) +
        line(395, 135, 435, 135) +
        line(485, 130, 550, 120) +
        line(485, 140, 550, 150);
      return frame(
        svg(z, "重复表达式被合并但消费次数保留") +
          metrics([
            ["原/新输出", `${2 * v} / ${2 * v}`],
            ["重复生产者数", "2 → 1"],
            ["消费贡献数", "仍然2次"],
          ]),
        "线表示具体值的使用；右图同一个值进入加法两次，不能把u+u误删成u。",
        select(
          "输入",
          [
            [0, "x=2"],
            [1, "x=3"],
          ],
          s,
        ),
      );
    }
    case "fusion-legality": {
      if (view === "alias")
        return frame(
          table(
            ["事件", "正确顺序", "错误交换"],
            [
              ["①", "读取a[0]=2", "写a[0]=9"],
              ["②", "写a[0]=9", "读取a[0]=9"],
              ["保存的旧值", 2, 9],
            ],
          ),
          "单槽的实际数值证明别名读写有依赖，不能从变量名字不同推断独立。",
        );
      const external = !!c;
      return frame(
        matrices(
          matrix([[1, 2, 3]], "x"),
          matrix(
            [[2, 4, 6]],
            external ? "u：链外消费者仍需读取" : "u：仅融合区内使用",
          ),
          matrix([[3, 5, 7]], "v=u+1"),
        ) +
          bars(
            [["必须跨边界保留的u元素", external ? 3 : 0]],
            "外部使用要求",
            3,
          ) +
          metrics([
            [
              "u能否只作为私有中间值",
              external ? "不能据此删除所有对外保存" : "本例可在融合区内部保留",
            ],
          ]),
        "这里只显示合法性条件，不预测寄存器或真实HBM事务；外部可见值和精度仍需保护。",
        select(
          "u是否还有外部消费者",
          [
            [0, "没有"],
            [1, "有"],
          ],
          s,
        ),
      );
    }
    case "loop-lowering": {
      const points = N.loopPoints(c ? 1 : 2, view === "order" && !!c);
      let z = text(25, 25, "每个格子是一项 A[i,k]×B[k,j] 的贡献");
      points.forEach(([i, j, k], n) => {
        const x = 35 + k * 135,
          y = 55 + (i * 2 + j) * 48;
        z +=
          rect(x, y, 115, 36, `owner-${k}`) +
          text(x + 8, y + 23, `(${i},${j},${k}) #${n}`);
      });
      return frame(
        svg(z, "GEMM迭代空间与访问次序", 275) +
          metrics([
            ["合法贡献数", points.length],
            ["K=3时合法索引", "0,1,2"],
            ["BK", c ? 1 : 2],
          ]),
        "坐标三元组是迭代点，#是当前遍历次序；分块不能新增越界k=3。小整数贡献可重排，浮点/别名还需合法性分析。",
        select(
          view === "order" ? "遍历方案" : "K分块",
          [
            [0, "BK2，输出优先"],
            [1, view === "order" ? "BK1，K优先" : "BK1"],
          ],
          s,
        ),
      );
    }
    case "buffer-liveness": {
      const d = N.liveAllocation(!!c);
      return frame(
        timeline(
          d.allocated.map((v, i) => [
            `${v.id} →槽${v.slot}`,
            [
              {
                start: v.start,
                end: v.end + 1,
                label: `${v.id}：最后用${v.end}`,
                color: i,
              },
            ],
          ]),
          7,
          "逻辑边界",
        ) +
          array(d.pressure, "时刻0..6的活跃值数") +
          metrics([
            ["本贪心安排需槽数", d.slots],
            [
              "a/c可否共槽",
              c ? "否，时刻4/5重叠" : "可以，a最后使用3后c从4开始",
            ],
          ]),
        "横条覆盖值从产生到最后使用；图将整数时刻t画为[t,t+1)槽，复用只在旧值使用完成后发生。",
        select(
          "消费者位置",
          [
            [0, "a最后用3"],
            [1, "a延后到5"],
          ],
          s,
        ),
      );
    }
    case "gpu-layout": {
      const before = [0, 0, 1, 1],
        after = c ? [0, 1, 0, 1] : before;
      return frame(
        matrices(
          matrix(
            [
              [0, 1],
              [2, 3],
            ],
            "逻辑元素ID，初始按行持有",
            (i, j) => `owner-${before[i * 2 + j]}`,
          ),
          matrix(
            [
              [0, 1],
              [2, 3],
            ],
            c ? "目标按列持有" : "目标仍按行持有",
            (i, j) => `owner-${after[i * 2 + j]}`,
          ),
        ) +
          table(
            ["元素ID", "旧持有者", "新持有者", "跨Lane"],
            before.map((v, i) => [
              i,
              "Lane" + v,
              "Lane" + after[i],
              v === after[i] ? "否" : "是",
            ]),
          ) +
          metrics([
            ["跨持有者元素数", before.filter((v, i) => v !== after[i]).length],
          ]),
        "颜色代表持有者，数字代表元素身份；所有值和Shape保持。这里没有假定真实Shuffle或Shared指令。",
        select(
          "目标归属",
          [
            [0, "按行"],
            [1, "按列"],
          ],
          s,
        ),
      );
    }
    case "target-codegen": {
      const pressure = c ? [1, 2, 3, 3, 2] : [1, 2, 2, 1, 1];
      return frame(
        bars(
          pressure.map((x, i) => ["时刻" + i, x]),
          "同时活跃值 / 教学寄存器槽",
          4,
        ) +
          array(
            c ? ["a:R0", "b:R1", "c:Spill→Reload"] : ["a:R0", "b:R1"],
            "有限资源安排",
          ) +
          metrics([
            ["资源上限", 2],
            ["固定策略新增溢出读写", c ? "各1次" : "无此溢出"],
          ]),
        view === "artifact"
          ? "此图只证明活跃值与有限槽的关系；虚拟名字数量不是最终物理寄存器数。真实LLVM/PTX/SASS需要实际编译产物。"
          : "所有容量为人为2槽模型；真实分配器可能调度、重算或合并，不能从此预测GPU资源。",
        select(
          "活跃集合",
          [
            [0, "峰值2个值"],
            [1, "融合后峰值3个值"],
          ],
          s,
        ),
      );
    }
    case "compile-cache": {
      const changed = !!c;
      return frame(
        table(
          ["键字段", "已有产物", "本次要求", "相同"],
          [
            ["源码版本", "revA", "revA", "是"],
            ["目标", "gpuX", changed ? "gpuY" : "gpuX", changed ? "否" : "是"],
            ["dtype", "f16", "f16", "是"],
            ["Tile", "tile2", "tile2", "是"],
          ],
        ) +
          timeline(
            [
              [
                "冷调用",
                [
                  { start: 0, end: 100, label: "编译100ms" },
                  { start: 100, end: 101, label: "提交1" },
                  { start: 101, end: 105, label: "执行4" },
                ],
              ],
              [
                "有效命中",
                [
                  { start: 0, end: 1, label: "提交1" },
                  { start: 1, end: 5, label: "执行4" },
                ],
              ],
            ],
            105,
            "ms（教学）",
          ) +
          metrics([
            ["本次教学键命中", changed ? "否" : "是"],
            ["缓存的是什么", "程序产物，不是任意输入的输出"],
          ]),
        "键与时间均为教学设定；命中仍需合法输入和实际执行。AOT把编译移到运行前，不会消除提交与计算。",
        select(
          "目标条件",
          [
            [0, "保持gpuX"],
            [1, "改为gpuY"],
          ],
          s,
        ),
      );
    }
    case "compiler-evidence": {
      if (view === "counter")
        return frame(
          bars(
            [
              ["原总时间", 10],
              ["目标快10倍后", 8.2],
              ["目标无限快的上限", 8],
            ],
            "串行关键路径 ms",
          ) +
            metrics([
              ["不变部分", 8],
              ["目标原占比", "20%"],
              ["10倍局部对应整体", 10 / 8.2],
            ]),
          "时间是明确的合成账本，忽略重叠；改善局部不代表整体同倍数加速。",
        );
      return frame(
        table(
          ["层次", "已有证据", "还不能推出"],
          [
            ["图变换", "两操作被融合", "尚不能推出设备更快"],
            ["逻辑IO", "中间数组省写", "尚不能推出DRAM实际字节"],
            ["真实产物", "未在本机生成", "不能填寄存器/SASS结论"],
            ["设备/系统时间", "未测量", "不能报告加速比"],
          ],
        ) +
          metrics([
            ["本课完成", "推论边界与可复现方法"],
            ["硬件验证", "仍需真实设备与固定版本"],
          ]),
        "未知单元保持未知；表格本身不是实验结果，也不把测试通过等同GPU优化成立。",
      );
    }
    case "engine-build": {
      const index = s.case % 3,
        inputs = [
          [6, 4],
          [16, 4],
          [6, 8],
        ],
        v = inputs[index],
        ok = v[0] >= 1 && v[0] <= 8 && v[1] === 4;
      if (view === "export")
        return frame(
          matrices(
            matrix(
              [
                ["输入X", "[B,4]"],
                ["常量W", "[4,2]"],
                ["MatMul输出", "[B,2]"],
              ],
              "交换图的类型/Shape约定",
            ),
            matrix(
              [
                ["目标设备", "需另选"],
                ["实现/精度", "需后端支持"],
                ["Engine", "构建产物"],
              ],
              "构建阶段仍要决定的条件",
            ),
          ) +
            metrics([
              ["导出图是否就是设备Kernel", "不是"],
              ["本页有真实Engine吗", "没有；只说明接口与条件"],
            ]),
          "表中的图有明确输入、常量和输出接口，但没有冒充真实ONNX文件或TensorRT生成结果。",
        );
      let z = text(25, 25, "Profile：1≤B≤8，H=4；星号是本例优化参考B=4");
      for (let b = 1; b <= 16; b++)
        for (let h = 1; h <= 8; h++)
          z += rect(
            45 + (b - 1) * 31,
            45 + (8 - h) * 24,
            27,
            20,
            b <= 8 && h === 4 ? "series-a" : "ff-empty",
          );
      z +=
        text(45 + (4 - 1) * 31, 45 + (8 - 4) * 24 + 16, "★") +
        dot(
          45 + (v[0] - 1) * 31 + 13,
          45 + (8 - v[1]) * 24 + 10,
          8,
          "owner-3",
        ) +
        text(40, 265, "B → 1..16；纵轴H=1..8") +
        text(540, 148, "H=4");
      return frame(
        svg(z, "动态输入Profile的合法形状集合", 290) +
          metrics([
            ["本次Shape", `[${v}]`],
            ["在本例Profile中", ok ? "合法" : "不合法"],
            ["opt B=4含义", "优化参考，不是唯一允许值"],
          ]),
        "每格是一个(B,H)组合，着色格满足本例所有Shape条件；不是只检查Batch范围。真实Profile和动态输出还受其它约束。",
        select(
          "运行输入",
          [
            [0, "[6,4]"],
            [1, "[16,4]"],
            [2, "[6,8]"],
          ],
          s,
        ),
      );
    }
    default:
      return renderOtherFoundation(id, view, s);
  }
}

function renderOtherFoundation(id, view, s) {
  const c = c2(s),
    step = s.step || 0;
  switch (id) {
    case "token-embedding": {
      const E = [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0],
      ];
      if (view === "tokens")
        return frame(
          array(c ? ["推", "理", "系统"] : ["推理", "系统"], "教学分词边界") +
            array(c ? [2, 3, 1] : [0, 1], "对应自设词表ID") +
            metrics([
              ["Token个数", c ? 3 : 2],
              ["词表约定", "0=推理，1=系统，2=推，3=理"],
            ]),
          "这是自设词表的两种匹配规则，不代表任何已训练模型的真实分词；Token不等于汉字。",
          select(
            "匹配规则",
            [
              [0, "允许合并推理"],
              [1, "拆为推/理"],
            ],
            s,
          ),
        );
      const ids = c ? [1, 3] : [2, 0],
        X = ids.map((i) => E[i]),
        h = X[0],
        logits = E.map((row) => N.dot(h, row));
      return frame(
        matrices(
          matrix(E, "E：4个ID × 2隐藏维", (i) =>
            ids.includes(i) ? "selected" : "",
          ),
          matrix([ids], "输入ID，不是连续值"),
          matrix(X, "查行后的X：2×2"),
        ) +
          (view === "head"
            ? array(logits, "第一行隐藏状态与输出头Eᵀ得到的4个Logit")
            : ""),
        "颜色/边框追踪被读取的整行。此例选用相同矩阵作输出头示范权重绑定；ID2的含义不是向量乘2。",
        select(
          "输入序列",
          [
            [0, "ID [2,0]"],
            [1, "ID [1,3]"],
          ],
          s,
        ),
      );
    }
    case "transformer-layer": {
      if (view === "residual") {
        const x = c ? [2, 1] : [1, 2],
          contribution = [0.5, -0.5],
          y = N.add(x, contribution);
        const z =
          node(70, 150, "x", x.join(","), "input") +
          node(310, 80, "子层", contribution.join(",")) +
          node(480, 150, "+", y.join(",")) +
          line(95, 150, 285, 80) +
          line(335, 80, 455, 150) +
          `<path class="data-edge" d="M95 160 Q 275 295 455 160"/>` +
          text(180, 250, "旁路携带原x，不由子层替代");
        return frame(
          svg(z, "给定子层贡献的残差相加") + array(y, "残差输出"),
          "为了隔离残差，子层贡献固定给定；没有把这个固定向量冒充真实Attention计算。",
          select(
            "残差输入",
            [
              [0, "[1,2]"],
              [1, "[2,1]"],
            ],
            s,
          ),
        );
      }
      const X = [
          [1, -2],
          [2, 1],
        ],
        up = X.map((x) => [x[0], x[1], x[0] + x[1]]),
        act = up.map((row) => row.map((v) => Math.max(0, v))),
        down = act.map((x) => [x[0] + x[2], x[1] + x[2]]),
        scores = N.mm(X, N.transpose(X)),
        weights = scores.map((row) => N.softmax(row)),
        attn = N.mm(weights, X);
      return frame(
        matrices(
          matrix(X, "两个Token × 两隐藏维"),
          matrix(
            c ? attn : down,
            c ? "Attention示例：混合不同Token行" : "FFN示例：各行独立共享权重",
          ),
        ) +
          (view === "expand"
            ? matrices(
                matrix(up, "Up：2→3"),
                matrix(act, "ReLU后"),
                matrix(down, "Down：3→2"),
              )
            : matrix(
                c
                  ? weights
                  : [
                      [1, 0],
                      [0, 1],
                    ],
                c
                  ? "行间Attention权重（未加Mask的独立例）"
                  : "FFN不混合Token轴（行身份）",
              )),
        "这些是隔离子算例：Attention采用Q=K=V=X、不含归一缩放/Mask的明确数学模型；FFN选择ReLU。整层的Norm和残差仍按本章公式另行组合。",
        select(
          "比较子层接口",
          [
            [0, "逐行FFN"],
            [1, "行间Attention"],
          ],
          s,
        ),
      );
    }
    case "generation-state": {
      const stage = Math.min(step, 3),
        selected = [2, 3, 4, 4][stage],
        computed = [0, 2, 3, 3][stage],
        seq = ["P0", "P1", "T0", c ? "T1" : "EOS"];
      return frame(
        array(seq.slice(0, selected), "当前已确定Token身份") +
          array(seq.slice(0, computed), "已完成模型计算的位置") +
          metrics([
            ["序列长度", selected],
            ["已计算位置数", computed],
            [
              "请求状态",
              stage === 3
                ? c
                  ? "长度上限结束"
                  : "EOS结束"
                : stage === 0
                  ? "Prompt待计算"
                  : stage === 1
                    ? "已采样T0，尚未算其KV"
                    : "已采样下一Token，准备停止判断",
            ],
          ]),
        "固定教学轨迹：选择Token和计算该Token的KV是不同事件。停止后保留输出，KV回收还受引用和在途使用约束。",
        control(
          "轨迹事件",
          "step",
          [
            [0, "Prompt输入"],
            [1, "Prefill并采样"],
            [2, "Decode并采样"],
            [3, "停止判断"],
          ],
          { ...s, step: stage },
        ) +
          select(
            "本例终止条件",
            [
              [0, "遇EOS"],
              [1, "新增上限2"],
            ],
            s,
          ),
      );
    }
    case "sampling-distribution": {
      const d = N.sampling(
          view === "temperature" && c ? 2 : 1,
          view === "nucleus" && c ? 0.95 : 0.8,
        ),
        u = c ? 0.3 : 0.75;
      if (view === "draw")
        return frame(
          cdfFigure(d.filtered, u) +
            metrics([
              ["u", u],
              ["选中词", d.cdf.findIndex((x) => u < x)],
            ]),
          "区间使用左闭右开约定，u∈[0,1)。这里对Top-p=0.8后的概率采样，不要求每次产生同一个Token。",
          select(
            "随机数",
            [
              [0, "u=.75"],
              [1, "u=.3"],
            ],
            s,
          ),
        );
      return frame(
        probability(
          d.probabilities.map((p, i) => ["词" + i, p]),
          "Softmax后原分布",
        ) +
          array(N.cumsum(d.probabilities), "按评分排序的累计质量") +
          probability(
            d.filtered.map((p, i) => ["保留词" + i, p]),
            "筛选后重新归一",
          ) +
          metrics([
            ["保留ID", d.keep.join(",")],
            ["原始保留质量", d.mass],
            ["输出概率和", N.total(d.filtered)],
          ]),
        "温度使用Logits/T，不是概率乘T。筛选保留完整Token项，跨过阈值的项必须包括。",
        select(
          view === "temperature" ? "温度" : "Top-p",
          view === "temperature"
            ? [
                [0, "T=1"],
                [1, "T=2"],
              ]
            : [
                [0, "p=.8"],
                [1, "p=.95"],
              ],
          s,
        ),
      );
    }
    case "attention-patterns": {
      const w = c ? 6 : 3,
        d = N.attentionPattern(w, view === "layers" ? 2 : 1);
      return frame(
        matrices(
          matrix(d.direct, "行=Query，列=Key；1可见，0屏蔽", (i, j) =>
            d.direct[i][j] ? "" : "zero",
          ),
          ...(view === "layers"
            ? [
                matrix(
                  d.reachable,
                  "两层后可达关系；不是单层新增直连",
                  (i, j) => (d.reachable[i][j] ? "selected" : "zero"),
                ),
              ]
            : []),
        ) +
          metrics([
            ["单层合法配对数", d.pairs],
            [
              "Query5直接可读Key",
              d.direct[5]
                .map((v, i) => (v ? i : null))
                .filter((v) => v !== null)
                .join(","),
            ],
          ]),
        "窗口包括当前位置。颜色代表连接身份，不是实际注意力权重；连接减少可能改变功能，配对数也不是设备耗时。",
        select(
          "连接模式",
          [
            [0, "窗口3"],
            [1, "全因果（窗口6）"],
          ],
          s,
        ),
      );
    }
    case "vision-patches": {
      const d = N.patchify(c ? 8 : 4, 2),
        p = (s.pick || 0) % d.tokens;
      return frame(
        matrices(
          matrix(
            d.image,
            "像素网格；格中是教学像素ID",
            (i, j) =>
              `owner-${(Math.floor(i / 2) * (c ? 4 : 2) + Math.floor(j / 2)) % 4}`,
          ),
          matrix([d.patches[p]], `Patch${p}按行展平的4元素`),
        ) +
          metrics([
            ["Patch Token数", d.tokens],
            ["假设全局配对数", d.tokens * d.tokens],
            ["单通道Patch宽度", d.flatWidth],
          ]),
        "每Patch2×2，ID保留具体像素身份。RGB还需合并通道维；配对规模只对应指定全局Attention部分。",
        select(
          "图像边长",
          [
            [0, "4×4"],
            [1, "8×8"],
          ],
          s,
        ) +
          control(
            "追踪Patch",
            "pick",
            [
              [0, "0"],
              [1, "1"],
              [2, "2"],
              [3, "3"],
            ],
            s,
          ),
      );
    }
    case "multimodal-bridge": {
      if (view === "cache")
        return frame(
          table(
            ["候选缓存", "请求A条件", "请求B条件", "本例可复用"],
            [
              [
                "视觉编码",
                "图I0/revA/分辨率固定",
                "图I0/revA/分辨率固定",
                "满足这组视觉条件",
              ],
              [
                "联合上下文KV",
                "图I0/文本A/位置0",
                c ? "图I0/文本B/位置0" : "图I0/文本A/位置0",
                c ? "条件不匹配" : "仍需核对其余条件",
              ],
            ],
          ) +
            metrics([
              ["本例变化", c ? "文本上下文改变" : "本表条件保持"],
              ["需要的判断", "按缓存对象核对有效条件，不只按图像相同"],
            ]),
          "这是明确自设的缓存键对照；真实模型是否支持复用、采用何种键和Mask，需要按实现核验。",
          select(
            "第二个请求",
            [
              [0, "同图同文本"],
              [1, "同图不同文本"],
            ],
            s,
          ),
        );
      if (view === "interfaces") {
        const Q = c ? 2 : 6,
          K = c ? 4 : 6;
        return frame(
          matrix(
            Array.from({ length: Q }, () => Array.from({ length: K }, () => 1)),
            c ? "文本Q×视觉K的2×4候选配对域" : "拼接后6×6候选配对域",
          ) +
            metrics([
              ["候选位置对", Q * K],
              ["是否已定义实际Mask", "没有：本图只展示配对轴和范围"],
            ]),
          "1只标记配对域；实际可见性还需Mask，不能把这个全1表冒充任何VLM的真实连接模式。",
          select(
            "接口",
            [
              [0, "拼接后自注意力"],
              [1, "文本交叉读视觉"],
            ],
            s,
          ),
        );
      }
      const V = [
          [1, 0, 1],
          [0, 1, 1],
          [1, 1, 0],
          [2, 0, 1],
        ],
        W = c
          ? [
              [1, 0],
              [0, 1],
              [0, 0],
            ]
          : [
              [1, 0],
              [0, 1],
              [1, 1],
            ],
        out = N.mm(V, W);
      return frame(
        matrices(
          matrix(V, "视觉V：4×3"),
          matrix(W, "投影W：3×2"),
          matrix(out, "视觉接口：4×2"),
        ) +
          metrics([
            ["与2×2文本沿行拼接后", "6×2"],
            ["是否自动允许跨请求复用", "否，还需上下文与位置等条件"],
          ]),
        "投影处理隐藏宽度接口；图中数值权重是自设样例，不是LLaVA权重或所有VLM唯一接法。",
        select(
          "投影参数",
          [
            [0, "混合第三维"],
            [1, "只取前两维"],
          ],
          s,
        ),
      );
    }
    case "state-families": {
      const beta = c ? 0.5 : 1,
        targets = [2, 4],
        additive = [0],
        delta = [0],
        ssm = [0];
      for (const x of targets) {
        additive.push(additive.at(-1) + beta * x);
        delta.push(delta.at(-1) + beta * (x - delta.at(-1)));
        ssm.push(0.5 * ssm.at(-1) + x);
      }
      return frame(
        curve(
          [
            { name: "关联累加", values: additive },
            { name: "Delta纠错", values: delta },
            { name: "标量SSM a=.5", values: ssm },
          ],
          "三种更新语义的状态值",
          6,
        ) +
          metrics([
            ["同样目标输入", "2，然后4"],
            ["Delta β", beta],
            [
              "末态分别",
              `${additive.at(-1)} / ${delta.at(-1)} / ${ssm.at(-1)}`,
            ],
          ]),
        "横轴是更新次数，纵轴是各自定义的标量状态。相似的固定大小内存不代表同一更新式，也不证明可共用Chunk Kernel。",
        select(
          "关联写入强度",
          [
            [0, "β=1"],
            [1, "β=.5"],
          ],
          s,
        ),
      );
    }
    default:
      return renderEngineFoundation(id, view, s);
  }
}
function cdfFigure(p, u) {
  let acc = 0,
    z = text(25, 25, "[0,1)上的概率区间；竖线是随机数u");
  p.forEach((v, i) => {
    if (!v) return;
    const x = 35 + acc * 540;
    z +=
      rect(x, 65, v * 540, 55, `owner-${i}`) +
      text(x + 8, 95, `词${i} ${f(v)}`);
    acc += v;
  });
  z +=
    line(35 + u * 540, 48, 35 + u * 540, 140, "new-vector") +
    text(35, 170, "0") +
    text(565, 170, "1") +
    text(35 + u * 540, 195, `u=${u}`);
  return svg(z, "概率CDF区间与随机数选择", 220);
}
function renderEngineFoundation(id, view, s) {
  const c = c2(s),
    step = Math.min(s.step || 0, 3);
  switch (id) {
    case "request-lifecycle": {
      const cancelled = !!c,
        rows = [
          [
            "请求A",
            [
              { start: 0, end: 1, label: "A排队", color: 0 },
              { start: 1, end: 3, label: "A在途GPU", color: 0 },
              {
                start: 3,
                end: 4,
                label: cancelled ? "丢弃A结果" : "A返回",
                color: cancelled ? 3 : 0,
              },
            ],
          ],
          [
            "请求B",
            [
              { start: 0, end: 1, label: "B排队", color: 1 },
              { start: 1, end: 3, label: "B在途GPU", color: 1 },
              { start: 3, end: 4, label: "B返回", color: 1 },
            ],
          ],
          [
            "控制事件",
            cancelled ? [{ start: 2, end: 3, label: "取消A", color: 3 }] : [],
          ],
        ];
      return frame(
        timeline(rows, 4, "逻辑事件区间") +
          array(["B→row0", "A→row1"], "本轮打包身份映射") +
          array(
            cancelled ? ["row0返回B", "row1忽略"] : ["row0返回B", "row1返回A"],
            "按ID和终止状态处理结果",
          ) +
          metrics([
            ["A缓冲何时可考虑回收", "在途使用确认结束后；共享还需检查引用"],
          ]),
        "图中区间是手工事件顺序，不是GPU计时。取消不撤销已经发生的设备读取，也不把行号永久当请求ID。",
        select(
          "A的控制状态",
          [
            [0, "正常完成"],
            [1, "执行中取消"],
          ],
          s,
        ),
      );
    }
    case "model-loading": {
      if (view === "files") {
        const W = Array.from({ length: 4 }, (_, i) =>
          Array.from({ length: 4 }, (_, j) => i * 4 + j),
        );
        return frame(
          matrix(
            W,
            c ? "TP示例：按输出列分给两卡" : "Checkpoint示例：按行存成两文件",
            (i, j) => `owner-${c ? Math.floor(j / 2) : Math.floor(i / 2)}`,
          ) +
            metrics([
              ["颜色含义", c ? "GPU0/1的列分片" : "文件0/1的行范围"],
              ["同一权重值", "编号0..15始终不变"],
            ]),
          "同一个权重矩阵，存储文件边界和执行分片边界不同；本图不假定具体Checkpoint格式。",
          select(
            "切分规则",
            [
              [0, "文件按行"],
              [1, "TP按列"],
            ],
            s,
          ),
        );
      }
      const workspace = c ? 4 : 2,
        kv = 16 - 8 - workspace - 1,
        cells = Array.from({ length: 16 }, (_, i) =>
          i < 8
            ? "权重"
            : i < 8 + workspace
              ? "工作区"
              : i === 8 + workspace
                ? "保留"
                : "KV",
        );
      return frame(
        array(cells, "虚构16MiB容量；每格1MiB") +
          bars(
            [
              ["驻留权重", 8],
              ["工作区", workspace],
              ["保留", 1],
              ["KV上限", kv],
            ],
            "容量分配 MiB",
            16,
          ) +
          metrics([
            ["可给KV", kv + "MiB"],
            ["加载/格式转换峰值", "未由此驻留账本证明"],
          ]),
        "容量数字为自设，不是实际模型或GPU规格。磁盘大小、驻留大小和加载峰值应分开记录。",
        select(
          "临时工作区",
          [
            [0, "2MiB"],
            [1, "4MiB"],
          ],
          s,
        ),
      );
    }
    case "batch-executor": {
      const d = N.packedBatch(!!c);
      if (view === "workers")
        return frame(
          matrices(
            matrix(
              [
                [1, 2],
                [3, 4],
              ],
              "完整教学权重W",
            ),
            matrix([[1], [3]], "TP示例Rank0的输出列"),
            matrix([[2], [4]], "TP示例Rank1的输出列"),
          ) +
            array(
              d.slots.map((v) => v.id + ":" + v.position),
              "两个Worker协调的同一轮输入身份",
            ) +
            metrics([
              ["职责", "Executor协调；Worker拥有本地分片；Runner准备/执行"],
            ]),
          "数值格是权重元素和本轮位置，不代表进程间可随意直接共享指针。具体张量接口由实际并行方案决定。",
          select(
            "本轮请求打包顺序",
            [
              [0, "A后B"],
              [1, "B后A"],
            ],
            s,
          ),
        );
      return frame(
        array(
          d.slots.map((v) => v.id + ":" + v.position),
          "Packed输入位置",
        ) +
          array(d.offsets, "累计边界offsets") +
          table(["请求", "本轮位置数"], d.requests) +
          metrics([
            ["打包槽", d.slots.length],
            ["若用最长长度填充的槽", d.padded],
          ]),
        "A/B身份及位置在打包后保留。offsets是教学接口，不冒充任一Attention后端完整元数据。",
        select(
          "打包顺序",
          [
            [0, "A3 / B1"],
            [1, "B1 / A3"],
          ],
          s,
        ),
      );
    }
    case "kv-preemption": {
      const cap = c ? 4 : 3,
        frames = c
          ? [
              { A: 2, B: 1, computed: 4, label: "B下一位置需要新增1块" },
              { A: 2, B: 2, computed: 5, label: "容量4：B直接前进，无需抢占" },
              { A: 0, B: 2, computed: 5, label: "A完成后释放其块" },
              { A: 0, B: 2, computed: 6, label: "B继续在已有块内前进" },
            ]
          : [
              { A: 2, B: 1, computed: 4, label: "3块已满，B不能追加" },
              {
                A: 2,
                B: 0,
                computed: 0,
                label: "固定策略抢占B，保留Token，清除其KV",
              },
              {
                A: 0,
                B: 1,
                computed: 4,
                label: "A完成后，B重计算4位置恢复历史",
              },
              { A: 0, B: 2, computed: 5, label: "恢复后追加位置5，分配第二块" },
            ],
        v = frames[step],
        slots = [...Array(v.A).fill("A"), ...Array(v.B).fill("B")];
      while (slots.length < cap) slots.push("空闲");
      return frame(
        array(slots, "物理块容量与当前归属；每块4位置") +
          metrics([
            ["当前事件", v.label],
            ["B已计算位置", v.computed],
            ["B的离散序列", "暂停时仍保留4个历史Token"],
            ["空闲块", cap - v.A - v.B],
          ]),
        "手工状态轨迹固定选择B完全重计算，非vLLM生产策略仿真；共享块需另按引用规则处理。",
        select(
          "容量",
          [
            [0, "3块"],
            [1, "4块"],
          ],
          s,
        ) +
          control(
            "追踪事件",
            "step",
            [
              [0, "资源不足检查"],
              [1, "安排决定"],
              [2, "A完成/恢复"],
              [3, "继续生成"],
            ],
            { ...s, step },
          ),
      );
    }
    case "async-engine": {
      const cpu = [],
        gpu = [];
      for (let n = 0; n < 3; n++) {
        const gs = c ? 2 + n * 4 : 2 + n * 6;
        gpu.push({ start: gs, end: gs + 4, label: `GPU轮${n}`, color: n });
        cpu.push({
          start: c ? (n ? gs - 2 : 0) : n * 6,
          end: c ? (n ? gs : 2) : n * 6 + 2,
          label: `准备${n}`,
          color: n,
        });
      }
      return frame(
        timeline(
          [
            ["CPU独立准备", cpu],
            ["GPU实际执行", gpu],
          ],
          18,
          "教学节拍",
        ) +
          metrics([
            ["3轮完成边界", c ? 14 : 18],
            ["未知输出可否直接读取", "不可以，下一轮使用真实值前仍要等待"],
            ["稳态理论周期", c ? 4 : 6],
          ]),
        "CPU2拍、GPU4拍、忽略绑定和传输成本；重叠模式只把独立元数据准备提前，结果依赖仍在GPU轮边界。",
        select(
          "执行组织",
          [
            [0, "全部串行"],
            [1, "独立准备重叠"],
          ],
          s,
        ),
      );
    }
    case "backend-dispatch": {
      const i = s.case % 3,
        inputs = [
          ["f16", 4, false],
          ["f16", 6, false],
          ["f16", 4, true],
        ],
        v = inputs[i],
        A = v[0] === "f16" && v[1] === 4 && !v[2],
        B = !v[2];
      return frame(
        table(
          ["教学后端", "dtype条件", "d条件", "量化条件", "最终可用"],
          [
            [
              "A",
              v[0] === "f16" ? "通过" : "失败",
              v[1] === 4 ? "通过" : "失败",
              v[2] ? "失败" : "通过",
              A ? "是" : "否",
            ],
            [
              "B",
              "f16/f32均支持",
              "本例任意正d",
              v[2] ? "失败" : "通过",
              B ? "是" : "否",
            ],
          ],
        ) +
          metrics([
            ["当前输入", `${v[0]}, d=${v[1]}, quant=${v[2]}`],
            ["还需核对", "实际日志、Kernel与回退行为"],
          ]),
        "这张支持矩阵完全为教学自设，不对应任何真实后端能力或排名。功能匹配与性能比较必须分开。",
        select(
          "输入组合",
          [
            [0, "f16,d4"],
            [1, "f16,d6"],
            [2, "量化模式"],
          ],
          s,
        ),
      );
    }
    case "admission-backpressure": {
      const d = N.boundedQueue(c ? 1 : 2, 3),
        accepted = d.rows.filter((r) => r.accepted),
        max = Math.max(...accepted.map((r) => r.end));
      return frame(
        timeline(
          accepted.map((r) => [
            "请求" + r.id,
            [
              ...(r.wait
                ? [{ start: r.arrival, end: r.start, label: "等待", color: 3 }]
                : []),
              { start: r.start, end: r.end, label: "服务", color: r.id % 3 },
            ],
          ]),
          max,
          "教学节拍",
        ) +
          array(
            d.rows.map((r) => (r.accepted ? "接纳R" + r.id : "拒绝R" + r.id)),
            "所有到达请求都保留统计",
          ) +
          metrics([
            ["接纳", d.accepted],
            ["拒绝", d.rejected],
            ["等待队列上限", c ? 1 : 2],
          ]),
        "到达0..6每拍1个，单请求服务3拍；满队列明确拒绝。拒绝者不进入服务时间线，但保留在统计数组。",
        select(
          "有界等待队列",
          [
            [0, "最多2个等待"],
            [1, "最多1个等待"],
          ],
          s,
        ),
      );
    }
    default:
      return renderKernelFoundation(id, view, s);
  }
}
function renderKernelFoundation(id, view, s) {
  const c = c2(s),
    step = Math.min(s.step || 0, 2);
  switch (id) {
    case "reduction-scan": {
      if (view === "boundary")
        return frame(
          array(
            c ? [-3, -2, "−∞"] : [-3, -2, 0],
            "有效输入与一个非法尾槽的填充",
          ) +
            metrics([
              ["实际最大值", c ? -2 : 0],
              ["是否符合有效输入", c ? "是" : "否：非法0压过负数"],
            ]),
          "此处专门比较填充值参与max的后果；实际Kernel还需正确Mask。加法单位元0不能普遍用于max。",
          select(
            "max尾槽填充",
            [
              [0, "错误填0"],
              [1, "使用−∞"],
            ],
            s,
          ),
        );
      if (view === "prefix") {
        const rounds = [
            [1, 2, 3, 4],
            [1, 3, 5, 7],
            [1, 3, 6, 10],
          ],
          row = rounds[step];
        return frame(
          array([1, 2, 3, 4], "原始输入") +
            array(
              row,
              step === 0
                ? "初始状态"
                : `使用上一轮快照，跨度${step === 1 ? 1 : 2}相加后的结果`,
            ) +
            metrics([
              ["当前轮", step],
              ["最终是否完整前缀", step === 2 ? "是" : "尚未完成"],
            ]),
          "每轮从上一轮快照读取，不能在同轮错误消费已更新值。最终每个位置i的结果等于原输入0..i之和。",
          control(
            "并行前缀传播",
            "step",
            [
              [0, "初始"],
              [1, "跨度1"],
              [2, "跨度2"],
            ],
            { ...s, step },
          ),
        );
      }
      let z = "";
      const inputs = [1, 2, 3, 4];
      inputs.forEach(
        (v, i) => (z += node(80 + i * 145, 50, String(i), v, "input")),
      );
      [3, 7].forEach((v, i) => {
        const x = 150 + i * 290;
        z +=
          node(x, 150, "+", v) +
          line(80 + i * 290, 75, x, 125) +
          line(225 + i * 290, 75, x, 125);
      });
      z +=
        node(295, 245, "+", 10) +
        line(150, 175, 295, 220) +
        line(440, 175, 295, 220);
      return frame(
        svg(z, "加法归约树，每条边传递具体部分和", 285),
        "4个输入先两两合并成3和7，再得到10。部分和的依赖决定合法同步，图不规定真实GPU周期。",
      );
    }
    case "gather-scatter": {
      if (view === "scatter") {
        const d = N.scatterExample(!c);
        let z =
          text(20, 25, "三条源记录") + text(390, 25, "目的槽，执行Scatter-add");
        d.values.forEach(
          (v, i) =>
            (z +=
              rect(35, 50 + i * 70, 95, 42, `owner-${i}`) +
              text(48, 76 + i * 70, `x${i}=${v}`) +
              line(135, 71 + i * 70, 390, 71 + d.indices[i] * 70)),
        );
        d.out.forEach(
          (v, j) =>
            (z +=
              rect(390, 50 + j * 70, 150, 42, `owner-${j}`) +
              text(405, 76 + j * 70, `槽${j} = ${v}`)),
        );
        return frame(
          svg(z, "索引指向目的槽，重复目的地的贡献相加", 280) +
            array(d.indices, "三条记录的目的索引"),
          "线表示实际写入目标，图中顺序执行Scatter-add；真实并发需要正确原子性或分组归约。",
          select(
            "索引条件",
            [
              [0, "有重复：[1,0,1]"],
              [1, "无重复：[1,0,2]"],
            ],
            s,
          ),
        );
      }
      const src = [10, 20, 30, 40],
        indices =
          view === "inverse"
            ? c
              ? [2, 0, 3, 1]
              : [2, 0, 2, 1]
            : c
              ? [2, 0, 1]
              : [2, 0, 2],
        out = indices.map((i) => src[i]);
      return frame(
        array(src, "源槽0..3") +
          array(indices, "按顺序读取的源索引") +
          array(out, "Gather结果") +
          metrics([
            [
              "是否一一覆盖全部源槽",
              indices.length === src.length &&
              new Set(indices).size === src.length
                ? "是，可构造逆排列"
                : "否，存在重复或缺失",
            ],
          ]),
        "索引保留来源身份，输出顺序由索引顺序决定。重复读取与可逆排列是不同条件。",
        select(
          "索引表",
          [
            [0, "含重复/缺失"],
            [1, "不同索引"],
          ],
          s,
        ),
      );
    }
    case "paged-attention-kernel": {
      const length = view === "tail" && c ? 3 : 4,
        d = N.pagedRead(length, view === "tail" ? true : !c);
      return frame(
        table(
          ["逻辑位置", "物理块:偏移", "K", "V"],
          d.addresses.map(([p, o], t) => [
            t,
            `P${p}:${o}`,
            d.keys[t],
            d.values[t],
          ]),
        ) +
          matrices(
            ...Object.entries(d.physical).map(([p, v]) =>
              matrix([v.K, v.V], `P${p}：第一行K、第二行V`),
            ),
          ) +
          probability(
            d.weights.map((v, i) => ["逻辑位置" + i, v]),
            "q=1后的Softmax权重",
          ) +
          metrics([
            ["分页结果", d.out],
            ["连续独立参考", d.reference],
            ["误差", Math.abs(d.out - d.reference)],
            ["有效长度", length],
          ]),
        "每块2位置、单标量Key/Value。物理换位不改变逻辑数学；尾部不属于本请求的位置不得参与归一化。",
        select(
          view === "tail" ? "合法上下文长度" : "物理分配",
          view === "tail"
            ? [
                [0, "长度4"],
                [1, "长度3"],
              ]
            : [
                [0, "P3/P1"],
                [1, "P0/P2"],
              ],
          s,
        ),
      );
    }
    case "quantized-matmul": {
      const d = N.quantDot(!!c),
        wrong = N.total(d.partial) * ((d.scales[0] + d.scales[1]) / 2);
      return frame(
        array(d.q, "量化码，前2与后2分别一组") +
          array(d.scales, "各组Scale") +
          array(d.weights, "逐元素还原后的权重") +
          matrices(
            matrix([d.partial], "各组整数点积Σxq"),
            matrix([d.contributions], "各组乘对应Scale后的贡献"),
          ) +
          metrics([
            ["正确输出", d.out],
            ["错误统一用平均Scale", wrong],
            ["两路差", Math.abs(d.out - wrong)],
          ]),
        "输入x=[1,1,1,1]，组大小2。Scale相同时可合并因子，不同时不能丢掉分组；此例无zero-point。",
        select(
          "分组Scale",
          [
            [0, "[.5,.25]"],
            [1, "[.5,.5]"],
          ],
          s,
        ),
      );
    }
    case "sampling-kernel": {
      if (view === "rows") {
        const rows = [
            [0.6, 0.25, 0.1, 0.05],
            [0.1, 0.2, 0.3, 0.4],
          ],
          shown = c ? rows.map((r) => r.map((x) => x / 2)) : rows;
        return frame(
          matrices(matrix(shown, "两请求 × 四候选词")) +
            metrics(shown.map((r, i) => ["请求" + i + "的概率和", N.total(r)])),
          "各行属于不同请求。错误地用跨请求总和归一会让每行只剩0.5，不能作为各请求的完整分布。",
          select(
            "归一化范围",
            [
              [0, "各行独立"],
              [1, "错误跨行混合"],
            ],
            s,
          ),
        );
      }
      if (view === "parity") {
        const p = c ? [1, 0, 0, 0] : [0.6, 0.25, 0.1, 0.05];
        return frame(
          probability(
            p.map((x, i) => ["词" + i, x]),
            c ? "改成Greedy后的分布" : "原随机策略的目标分布",
          ) +
            metrics([
              ["同一目标分布吗", c ? "不是" : "是"],
              ["这是抽样实验吗", "不是，显示理论目标概率"],
            ]),
          "逐次抽样不同不等于分布不同；改argmax则改变了目标分布，不能作为等价Kernel优化。",
          select(
            "生成语义",
            [
              [0, "随机采样"],
              [1, "改为argmax"],
            ],
            s,
          ),
        );
      }
      const p = [0.6, 0.25, 0.1, 0.05],
        u = c ? 0.3 : 0.75;
      return frame(
        cdfFigure(p, u) +
          array(N.cumsum(p), "逐候选前缀和") +
          metrics([["选中词", N.cumsum(p).findIndex((x) => u < x)]]),
        "本图使用未截断原概率，u∈[0,1)，第一次满足u<CDF的区间对应被选词。",
        select(
          "随机数",
          [
            [0, ".75"],
            [1, ".3"],
          ],
          s,
        ),
      );
    }
    case "kernel-tuning": {
      const bm = c ? 4 : 2,
        bn = 2,
        grid = Math.ceil(6 / bm) * Math.ceil(4 / bn),
        covered = grid * bm * bn,
        rows = Math.ceil(6 / bm) * bm,
        A = Array.from({ length: rows }, (_, i) =>
          Array.from({ length: 4 }, (_, j) => (i < 6 ? `${i},${j}` : "×")),
        );
      return frame(
        matrix(A, `输出槽；×是超过M=6的无效位置`, (i, j) =>
          i < 6
            ? `owner-${(Math.floor(i / bm) * 2 + Math.floor(j / bn)) % 4}`
            : "zero",
        ) +
          bars(
            [
              ["有效输出元素", 24],
              ["Tile覆盖槽", covered],
              ["无效槽", covered - 24],
            ],
            "同一任务的逻辑计数",
            32,
          ) +
          metrics([
            ["Program数", grid],
            ["每Program逻辑累加器元素", bm * bn],
            ["是否已证明更快", "没有，必须正确性与真实测量"],
          ]),
        "N=4、BN=2，颜色表示逻辑Tile归属，非线程/SM；累加器元素数不等于每线程寄存器数。",
        select(
          "BM",
          [
            [0, "2"],
            [1, "4"],
          ],
          s,
        ),
      );
    }
    case "lowbit-formats": {
      if (view === "fp8") {
        const step = c ? 0.25 : 0.125,
          levels = Array.from(
            { length: Math.round(1 / step) },
            (_, i) => 1 + i * step,
          ),
          x = 1.12,
          rounded = Math.round((x - 1) / step) * step + 1;
        let z =
          line(40, 110, 570, 110, "axis") +
          text(25, 25, `正规数区间[1,2)，步长${step}`);
        levels.forEach(
          (v) =>
            (z +=
              line(40 + (v - 1) * 500, 95, 40 + (v - 1) * 500, 125) +
              text(30 + (v - 1) * 500, 155, f(v))),
        );
        z +=
          dot(40 + (x - 1) * 500, 65, 6, "source-dot") +
          text(40 + (x - 1) * 500, 48, "x=1.12") +
          dot(40 + (rounded - 1) * 500, 110, 7, "owner-1");
        return frame(
          svg(z, "两种FP8尾数精度在同一正规区间的网格", 190) +
            metrics([
              ["最近可表示值", rounded],
              ["绝对误差", Math.abs(x - rounded)],
            ]),
          "只展示[1,2)的正规数精度，未声称整个格式的指数范围或特殊值规则相同。这里使用非中点x避免舍入模式歧义。",
          select(
            "格式",
            [
              [0, "E4M3：3尾数位"],
              [1, "E5M2：2尾数位"],
            ],
            s,
          ),
        );
      }
      const scale = view === "scale" ? (c ? 0.5 : 0.25) : 1,
        levels = [0, 0.5, 1, 1.5, 2, 3, 4, 6].map((v) => v * scale),
        x = view === "scale" ? 2 : c ? 2.6 : 1.2,
        nearest = levels.reduce(
          (best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best),
          levels[0],
        ),
        max = Math.max(6 * scale, 2.1);
      let z =
        line(35, 130, 575, 130, "axis") +
        text(25, 25, "空心=输入，实心=最近可表示还原值");
      levels.forEach(
        (v, i) =>
          (z +=
            line(35 + (v / max) * 520, 120, 35 + (v / max) * 520, 140) +
            text(25 + (v / max) * 520, 165 + (i % 2) * 23, f(v))),
      );
      z +=
        dot(35 + (x / max) * 520, 75, 6, "source-dot") +
        dot(35 + (nearest / max) * 520, 130, 6, "owner-1") +
        line(35 + (x / max) * 520, 75, 35 + (nearest / max) * 520, 130);
      return frame(
        svg(z, "E2M1正值集合与外部Scale", 200) +
          metrics([
            ["Scale", scale],
            ["输入", x],
            ["还原值", nearest],
            ["绝对误差", Math.abs(x - nearest)],
          ]),
        "E2M1正值集合[0,.5,1,1.5,2,3,4,6]，负值按符号镜像；外部Scale改变还原范围，NVFP4/MXFP4还有特定分组与Scale编码。",
        select(
          view === "scale" ? "Scale" : "输入样本",
          view === "scale"
            ? [
                [0, ".25"],
                [1, ".5"],
              ]
            : [
                [0, "1.2"],
                [1, "2.6"],
              ],
          s,
        ),
      );
    }
    case "convolution-lowering": {
      const mode = view === "window" ? 0 : s.case % 3,
        stride = mode === 1 ? 2 : 1,
        padding = mode === 2 ? 1 : 0,
        d = N.convolution(stride, padding),
        { image, kernel, windows, out } = d,
        selected = (s.pick || 0) % windows.length,
        w = windows[selected];
      return frame(
        matrices(
          matrix(image, "输入像素值", (i, j) =>
            i >= w.r && i < w.r + 2 && j >= w.c && j < w.c + 2
              ? "selected"
              : "",
          ),
          matrix(
            [
              [1, 0],
              [0, 1],
            ],
            "Kernel权重",
          ),
          matrix([w.values], "当前窗口按行展平"),
        ) +
          (view === "im2col"
            ? matrix(
                windows.map((v) => v.values),
                "im2col：每行一个输出窗口（数学表示）",
              )
            : matrix(
                Array.from({ length: d.size }, (_, i) =>
                  out.slice(i * d.size, (i + 1) * d.size),
                ),
                "输出网格",
              )) +
          metrics([
            [
              "当前输出坐标",
              `(${Math.floor(selected / d.size)},${selected % d.size})`,
            ],
            ["输入窗口起点", `(${w.r},${w.c})`],
            ["乘积和", N.dot(w.values, kernel)],
            ["Stride / Padding", `${stride} / ${padding}`],
          ]),
        "单通道2×2互相关、dilation1；Padding之外的输入按本例补0。边框跟踪真实输入中的有效窗口部分；im2col不等于实际全部物化。",
        (view === "window"
          ? ""
          : select(
              "窗口规则",
              [
                [0, "Stride1 / Pad0"],
                [1, "Stride2 / Pad0"],
                [2, "Stride1 / Pad1"],
              ],
              s,
            )) +
          control(
            "追踪窗口",
            "pick",
            [0, 1, 4]
              .filter((i) => i < windows.length)
              .map((i) => [i, "窗口" + i]),
            { ...s, pick: selected },
          ),
      );
    }
    default:
      return renderSystemFoundation(id, view, s);
  }
}
function renderSystemFoundation(id, view, s) {
  const c = c2(s),
    step = Math.min(s.step || 0, 2);
  switch (id) {
    case "process-threads": {
      if (view === "states") {
        const wake = c ? 4 : 2;
        return frame(
          timeline(
            [
              [
                "线程T0",
                [
                  { start: 0, end: 1, label: "运行", color: 0 },
                  { start: 1, end: wake, label: "I/O阻塞", color: 3 },
                  { start: wake, end: 5, label: "就绪等待CPU", color: 1 },
                  { start: 5, end: 6, label: "运行", color: 0 },
                ],
              ],
              ["线程T1", [{ start: 1, end: 5, label: "运行", color: 2 }]],
            ],
            6,
            "教学时间",
          ) +
            metrics([
              ["I/O完成事件", wake],
              ["T0何时具备运行条件", "事件完成后转就绪；仍需CPU调度"],
              ["增加核心能否补出I/O结果", "不能"],
            ]),
          "固定教学调度：T1在1..5运行，T0在5再次被调度。不是Linux具体策略或真实时间；阻塞与就绪是不同条件。",
          select(
            "I/O完成时刻",
            [
              [0, "t=2"],
              [1, "t=4"],
            ],
            s,
          ),
        );
      }
      if (view === "spaces")
        return frame(
          matrices(
            matrix(
              [
                ["T0栈", "T1栈"],
                ["共享堆count", "同一地址空间"],
              ],
              c ? "进程A内两个线程" : "进程A的内部对象",
            ),
            ...(c
              ? []
              : [
                  matrix(
                    [
                      ["T0栈", "独立堆"],
                      ["虚拟0x1000", "→物理页P9"],
                    ],
                    "进程B；A的0x1000可映射P2",
                  ),
                ]),
          ) +
            metrics([
              [
                "可否只按地址数字认定同一对象",
                c
                  ? "同进程仍需确认具体引用"
                  : "不同地址空间不能由相同数值确认共享",
              ],
            ]),
          "线程共享进程堆但有各自栈；不同进程可能显式建立共享机制，本图的进程对照未建立共享。",
          select(
            "观察边界",
            [
              [0, "两个独立进程"],
              [1, "同进程两线程"],
            ],
            s,
          ),
        );
      const events = c
        ? [
            ["A读", 0],
            ["A写", 1],
            ["B读", 1],
            ["B写", 2],
          ]
        : [
            ["A读", 0],
            ["B读", 0],
            ["A写", 1],
            ["B写", 1],
          ];
      return frame(
        table(["事件顺序", "该次读到/写入的值"], events) +
          curve(
            [
              {
                name: c ? "完整临界区的更新" : "未保护交错的写回",
                values: c ? [0, 1, 2] : [0, 1, 1],
              },
            ],
            "共享计数的写回结果",
            2,
          ) +
          metrics([
            ["最终count", c ? 2 : 1],
            ["期望两个贡献", 2],
          ]),
        "表中的读和写显式分开。这里证明读改写交错，不模拟某种语言运行时或CPU调度周期。",
        select(
          "同步方式",
          [
            [0, "读改写可交错"],
            [1, "保护完整临界区"],
          ],
          s,
        ),
      );
    }
    case "host-memory-pages": {
      if (view === "pin")
        return frame(
          timeline(
            [
              [
                "DMA读取",
                [{ start: 1, end: 4, label: "从Pinned主机页读取", color: 0 }],
              ],
              [
                "CPU写入",
                [
                  {
                    start: c ? 4 : 2,
                    end: c ? 5 : 3,
                    label: c ? "完成后覆盖" : "过早覆盖",
                    color: c ? 1 : 3,
                  },
                ],
              ],
            ],
            5,
            "逻辑时间",
          ) +
            metrics([
              [
                "数据所有权是否安全",
                c ? "本例写入在读取完成后" : "存在CPU写与DMA读交叠",
              ],
              ["Pinned是否替你同步", "没有"],
            ]),
          "主机页已Pinned，但数据使用仍有生命周期。图仅表示访问区间，不给出真实DMA时延。",
          select(
            "CPU覆盖时机",
            [
              [0, "DMA未完成"],
              [1, "确认完成后"],
            ],
            s,
          ),
        );
      if (view === "numa") {
        const mem = c ? 450 : 140;
        let z =
          rect(30, 40, 240, 200, "ff-region") +
          rect(340, 40, 240, 200, "ff-region") +
          text(45, 65, "NUMA节点0") +
          text(355, 65, "NUMA节点1") +
          node(90, 125, "CPU0", "线程", "input") +
          node(mem, 195, "P2", "数据页", "input") +
          node(295, 285, "GPU", "设备", "input") +
          line(270, 100, 340, 100, "reference");
        z += c
          ? line(115, 125, 425, 195) + line(450, 220, 320, 285)
          : line(110, 145, 125, 170) + line(160, 220, 270, 285);
        return frame(
          svg(z, "主机数据页归属与跨节点路径", 330) +
            metrics([
              ["数据页所在节点", c ? 1 : 0],
              ["能否由图直接算带宽", "不能，链路和争用需实际测量"],
            ]),
          "边表示当前数据页涉及的访问路径，外框是NUMA归属，不是执行阶段。图中距离不等于真实链路延迟。",
          select(
            "页分配位置",
            [
              [0, "CPU0本地"],
              [1, "远端节点1"],
            ],
            s,
          ),
        );
      }
      const map = c ? [5, 7, 2] : [5, 2, 7],
        virtual = 6,
        physical = map[1] * 4 + 2;
      return frame(
        table(
          ["虚拟页", "物理页", "页内槽数"],
          map.map((p, i) => [i, p, 4]),
        ) +
          array(
            Array.from(
              { length: 12 },
              (_, i) => `V${Math.floor(i / 4)}:${i % 4}`,
            ),
            "进程连续虚拟槽",
          ) +
          metrics([
            ["追踪虚拟地址", virtual],
            ["页号/偏移", "1 / 2"],
            ["物理槽", physical],
          ]),
        "页大小4槽为纯教学单位，非真实OS页尺寸；页表解释地址，Pinned/DMA路径另有条件。",
        select(
          "物理页映射",
          [
            [0, "[5,2,7]"],
            [1, "[5,7,2]"],
          ],
          s,
        ),
      );
    }
    case "cuda-context": {
      return frame(
        matrices(
          matrix(
            [
              ["CPU T0", "CPU T1"],
              ["Stream S0", "Stream S1"],
              ["分配R @4096", "分配R @4096"],
            ],
            c ? "进程A：线程使用同一主要Context" : "进程A / ContextA",
          ),
          ...(c
            ? []
            : [
                matrix(
                  [
                    ["CPU T0", "ContextB"],
                    ["Stream S0", "本进程资源"],
                    ["地址4096", "不因此等于A的R"],
                  ],
                  "进程B，尚未建立IPC",
                ),
              ]),
        ) +
          metrics([
            ["同数值地址是否足以访问其它进程资源", "不足够"],
            ["本图涉及", "资源归属和访问关系，不是运行时计时"],
          ]),
        "同进程多线程不天然复制所有主要Context资源；跨进程共享必须通过受支持机制并满足同步/生命周期。",
        select(
          "边界",
          [
            [0, "两个独立Context/进程"],
            [1, "同进程共享主要Context"],
          ],
          s,
        ),
      );
    }
    case "tensor-parallel": {
      const W = [
          [1, 2],
          [3, 4],
        ],
        x = c ? [2, 1] : [1, 2],
        y = N.mm([x], W)[0],
        parts = W.map((r, i) => r.map((v) => v * x[i]));
      if (view === "data")
        return frame(
          matrices(
            matrix(W, "DP Rank0完整权重"),
            matrix(W, "DP Rank1完整权重"),
          ) +
            array([`请求A→[7,10]`, `请求B→[5,8]`], "不同请求分给完整副本") +
            metrics([
              ["权重副本数", 2],
              ["单请求是否按此DP方案逐层归约", "不因DP分请求本身而要求"],
            ]),
          "普通独立请求DP示例；副本内部仍可另用TP。相同权重副本不等于同一请求被拆成部分和。",
        );
      return frame(
        matrices(
          matrix([x], "同一请求x"),
          matrix(W, "W"),
          matrix(
            view === "column" ? [[y[0]], [y[1]]] : parts,
            view === "column"
              ? "两卡各负责不同输出坐标"
              : "两卡对相同输出坐标的局部贡献",
          ),
        ) +
          array(y, view === "column" ? "拼接两卡输出" : "逐坐标归约后的输出") +
          metrics([
            [
              "合并操作",
              view === "column" ? "concat：不同输出坐标" : "sum：同坐标部分和",
            ],
          ]),
        "整数小矩阵可独立手算；图只证明单GEMM分解，不据此给出完整模型通信与性能。",
        select(
          "输入请求",
          [
            [0, "x=[1,2]"],
            [1, "x=[2,1]"],
          ],
          s,
        ),
      );
    }
    case "pipeline-parallel": {
      const d = N.pipeline(2, 3, c ? [1, 2] : [1, 1]);
      return frame(
        timeline(
          [0, 1].map((stage) => [
            "层段" + stage,
            d.trace
              .filter((r) => r.stage === stage)
              .map((r) => ({
                start: r.start,
                end: r.end,
                label: ["A", "B", "C"][r.batch],
                color: r.batch,
              })),
          ]),
          d.total,
          "教学节拍",
        ) +
          metrics([
            ["三批完成边界", d.total],
            ["两段时长", c ? "1 / 2" : "1 / 1"],
            ["跨层段主要对象", "本轮激活；不是PD的历史KV交付"],
          ]),
        "A/B/C身份跨层段保持。没有模拟网络传输、反向或实际GPU；慢段限制稳态周期，启动/排空仍保留。",
        select(
          "层段平衡",
          [
            [0, "每段1拍"],
            [1, "第二段2拍"],
          ],
          s,
        ),
      );
    }
    case "collective-topology": {
      const p = c ? 4 : 2,
        d = N.ringState(p, step);
      let z =
        '<defs><marker id="ffArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="currentColor"/></marker></defs>';
      const pos = Array.from({ length: p }, (_, i) => [
        310 + 100 * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / p),
        135 + 100 * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / p),
      ]);
      pos.forEach(([x, y], i) => {
        const [a, b] = pos[(i + 1) % p];
        z += `<path class="data-edge" marker-end="url(#ffArrow)" d="M${x} ${y} Q${(x + a) / 2 + 35} ${(y + b) / 2 + 20} ${a} ${b}"/>`;
      });
      pos.forEach(
        ([x, y], i) => (z += node(x, y, "Rank" + i, "分片转发", "input")),
      );
      return frame(
        svg(z, "指定逻辑环中的分片转发方向", 280) +
          table(
            ["Rank", "坐标0", "坐标1", "坐标2", "坐标3"],
            d.state.map((row, r) => [
              r,
              ...row.map((v) => (v === null ? "·" : v)),
            ]),
          ) +
          metrics([
            [
              "当前阶段",
              ["各Rank局部输入", "ReduceScatter完成边界", "AllGather完成边界"][
                step
              ],
            ],
            ["每Rank单向发送量", d.sendBytes + "Byte"],
            ["输入N", 16 + "Byte/Rank"],
          ]),
        "表展示阶段边界，不是省略了每轮依赖：每阶段p−1轮、每轮N/p。数据是4个32-bit元素；不把逻辑环等同实际物理拓扑或NCCL固定算法。",
        select(
          "Rank数量",
          [
            [0, "2"],
            [1, "4"],
          ],
          s,
        ) +
          control(
            "阶段边界",
            "step",
            [
              [0, "局部输入"],
              [1, "归约分片完成"],
              [2, "全收集完成"],
            ],
            { ...s, step },
          ),
      );
    }
    case "deployment-compatibility": {
      const mode = s.case % 3,
        conditions = [
          ["Driver能力", mode !== 2],
          ["编译目标架构", mode !== 1],
          ["模型格式", true],
        ];
      return frame(
        table(
          ["要求层", "本例检查结果", "需要依据"],
          conditions.map(([k, ok]) => [
            k,
            ok ? "通过" : "失败",
            k === "Driver能力"
              ? "官方兼容表"
              : k === "编译目标架构"
                ? "实际目标GPU与编译产物"
                : "模型与后端配置",
          ]),
        ) +
          matrices(
            matrix(
              [
                ["应用", "用户态库"],
                ["Runtime依赖", "模型文件"],
              ],
              "容器/应用边界",
            ),
            matrix(
              [
                ["宿主Driver", "实际GPU"],
                ["设备能力", "真实资源"],
              ],
              "宿主与硬件边界",
            ),
          ) +
          metrics([
            [
              "可否仅据此进入运行验证",
              conditions.every((r) => r[1])
                ? "条件初查通过；仍需加载与正确性验证"
                : "存在失败条件，不能确认可运行",
            ],
          ]),
        "通过/失败为自设组合，未虚构任何CUDA版本门槛；实际Minor/Forward compatibility必须符合官方平台与功能条件。",
        select(
          "教学配置",
          [
            [0, "三条件通过"],
            [1, "目标不匹配"],
            [2, "Driver条件失败"],
          ],
          s,
        ),
      );
    }
    default:
      return renderEmbodiedFoundation(id, view, s);
  }
}
function renderEmbodiedFoundation(id, view, s) {
  const c = c2(s);
  switch (id) {
    case "observation-contract": {
      if (view === "time") {
        const camera = c ? 100 : 80,
          position = (t) => 45 + (t - 60) * 6;
        let z = "";
        for (const t of [60, 80, 100, 120, 140])
          z +=
            line(position(t), 35, position(t), 245, "grid") +
            text(position(t) - 10, 275, t + "ms");
        z +=
          dot(position(camera), 65, 7, "owner-0") +
          text(position(camera) + 10, 65, "相机采集") +
          dot(position(100), 140, 7, "owner-1") +
          text(position(100) + 10, 140, "关节采集") +
          dot(position(120), 215, 7, "owner-2") +
          text(position(120) + 10, 215, "组合/推理") +
          line(position(camera), 72, position(120), 208) +
          line(position(100), 147, position(120), 208);
        return frame(
          svg(z, "采集时间与组合时间是不同事件", 300) +
            metrics([
              ["相机/关节采集偏差", 100 - camera + "ms"],
              ["推理时相机观测年龄", 120 - camera + "ms"],
            ]),
          "横轴是手工时间戳，点表示采集或使用事件，连线表示被组合的数据来源；到达时间还可不同。",
          select(
            "相机帧",
            [
              [0, "采集于80ms"],
              [1, "采集于100ms"],
            ],
            s,
          ),
        );
      }
      if (view === "contract")
        return frame(
          table(
            ["接口字段", "训练约定", "本次输入", "相容"],
            [
              ["相机顺序", "前/腕", c ? "腕/前" : "前/腕", c ? "否" : "是"],
              ["位置单位", "m", c ? "mm" : "m", c ? "否" : "是"],
              ["状态Shape", "[2]", "[2]", "相同"],
              ["归一化统计", "固定训练统计", "必须匹配", "待核对"],
            ],
          ) + metrics([["仅Shape能否发现所有差异", "不能"]]),
          "例子特意保持Shape不变；物理单位与字段顺序仍可改变输入含义。",
          select(
            "接口配置",
            [
              [0, "匹配约定"],
              [1, "同Shape但语义错位"],
            ],
            s,
          ),
        );
      const d = N.transformPoint(c ? 0 : 90),
        X = (x) => 330 + x * 65,
        Y = (y) => 255 - y * 65;
      let z =
        text(20, 25, "相机坐标中的同一点P") +
        line(35, 170, 220, 170, "axis") +
        line(65, 225, 65, 55, "axis") +
        dot(130, 170, 7, "owner-0") +
        text(135, 155, "P=(1,0)") +
        text(325, 25, "世界系、相机原点及x轴方向") +
        line(X(0), Y(0), X(3.8), Y(0), "axis") +
        line(X(0), Y(0), X(0), Y(3.3), "axis");
      z +=
        dot(X(1), Y(2), 6, "owner-1") +
        text(X(1) + 6, Y(2) + 20, "相机原点t=(1,2)") +
        line(X(1), Y(2), X(1 + d.R[0][0]), Y(2 + d.R[1][0]), "new-vector") +
        dot(X(d.world[0]), Y(d.world[1]), 8, "owner-0") +
        text(
          X(d.world[0]) + 8,
          Y(d.world[1]) - 8,
          `P=(${d.world.map(f).join(",")})`,
        );
      return frame(
        svg(z, "同一物理点在两参考系中的坐标", 310) +
          matrices(
            matrix(d.R, "旋转R"),
            matrix([d.translation], "平移t"),
            matrix([d.world], "世界坐标P"),
          ),
        "点P的身份不变，坐标解释改变。二维图隔离旋转和平移顺序，不代替三维标定或机器人运动学。",
        select(
          "相机系到世界系旋转",
          [
            [0, "90°"],
            [1, "0°"],
          ],
          s,
        ),
      );
    }
    case "action-representation": {
      const d = N.actionEncoding(!!c);
      return frame(
        array(d.absolute, "训练约定的绝对目标") +
          array(d.relative, "相对固定锚点10的轨迹") +
          array(d.normalized, "μ=1、σ=2标准化后") +
          array(d.restored, `反归一化后加解码锚点${d.restoreAnchor}`) +
          metrics([
            ["锚点是否保持原约定", c ? "否，整体目标平移了1" : "是"],
            ["逐步增量对照", "[0,1,1]，不能混同相对轨迹[0,1,2]"],
          ]),
        "先反归一化，再按相对表示加锚点。μ是训练均值、σ是训练Scale；错误重新锚定作为反例，不是部署建议。",
        select(
          "解码锚点",
          [
            [0, "保留原锚点10"],
            [1, "错误改用最新11"],
          ],
          s,
        ),
      );
    }
    case "policy-families": {
      if (view === "ensemble") {
        const t = c ? 5 : 3,
          old = [0, 1, 2, 3, "·", "·"],
          recent = ["·", "·", 20, 21, 22, 23],
          a = 3,
          b = c ? 23 : 21;
        return frame(
          table(
            ["预测起点", "执行t0", "t1", "t2", "t3", "t4", "t5"],
            [
              ["Chunk0", ...old],
              ["Chunk2", ...recent],
            ],
          ) +
            metrics([
              ["旧块选择", "下标3 → 执行t3 → 值3"],
              [
                "新块选择",
                c ? "错误下标3 → 执行t5 → 值23" : "下标1 → 执行t3 → 值21",
              ],
              ["等权算术结果", (a + b) / 2],
              [
                "是否同一执行时刻",
                c ? "否，不能作为t3的合法融合" : "是，本例t3等权融合为12",
              ],
            ]),
          "表格列是共同执行时间，块内下标相对各自起点。只对齐数组下标可能混合不同未来时刻；等权仅为教学规则。",
          select(
            "对齐方法",
            [
              [0, "按执行t3"],
              [1, "错误按相同下标3"],
            ],
            s,
          ),
        );
      }
      const iterations = c ? 2 : 4;
      return frame(
        timeline(
          [
            [
              "直接Chunk",
              [{ start: 0, end: 1, label: "一次前向给4动作", color: 0 }],
            ],
            [
              "迭代整块",
              Array.from({ length: iterations }, (_, i) => ({
                start: i,
                end: i + 1,
                label: "整块更新" + i,
                color: 1,
              })),
            ],
            [
              "离散自回归",
              Array.from({ length: 4 }, (_, i) => ({
                start: i,
                end: i + 1,
                label: "符号" + i,
                color: 2,
              })),
            ],
          ],
          4,
          "调用次序，非时长",
        ) +
          matrix(
            Array.from({ length: iterations }, (_, i) =>
              Array.from({ length: 4 }, (_, j) => `a${j}@迭代${i}`),
            ),
            "每轮同时存在整块动作变量",
          ) +
          metrics([
            ["本图离散假设", "每动作1个符号，仅用于隔离串行依赖"],
            ["质量是否已比较", "没有"],
          ]),
        "横向单位是网络调用次序，不是各模型等长实测。迭代生成与自回归生成的内部依赖不同，ACT类直接预测也可能有额外模块。",
        select(
          "整块生成迭代次数",
          [
            [0, "4次"],
            [1, "2次"],
          ],
          s,
        ),
      );
    }
    case "robot-data": {
      if (view === "split")
        return frame(
          array([0, 0, 0, 1, 1, 1], "每帧所属Episode") +
            array(
              c
                ? ["训练", "训练", "训练", "评估", "评估", "评估"]
                : ["训练", "评估", "训练", "训练", "评估", "训练"],
              c ? "按Episode隔离" : "同一Episode相邻帧混入两侧",
            ) +
            metrics([
              [
                "是否回答同一种泛化问题",
                "不一定：需明确按轨迹/任务/场景的评价目标",
              ],
            ]),
          "例子说明划分边界和相关性，不声称Episode划分能解决所有数据泄漏。训练统计也应按允许数据计算。",
          select(
            "划分策略",
            [
              [0, "相邻帧混合"],
              [1, "按Episode分开"],
            ],
            s,
          ),
        );
      if (view === "align")
        return frame(
          table(
            ["样本", "输入观测帧", "动作目标起点", "和本例训练约定相符"],
            [
              ["固定训练约定", 1, 1, "是"],
              ["本次运行构造", 1, c ? 2 : 1, c ? "否" : "是"],
            ],
          ) + metrics([["Shape", "两种方案可以完全相同"]]),
          "本例明确训练标签起点是同一帧，换偏移会改变监督；其它系统可采用不同延迟约定，不能一概判错。",
          select(
            "目标偏移",
            [
              [0, "按本例约定0"],
              [1, "未经声明偏移1"],
            ],
            s,
          ),
        );
      const d = N.episodeWindow(c ? 2 : 1);
      return frame(
        array(d.episode, "全局帧0..5的Episode ID") +
          array(d.indices, "拟取的未来全局帧") +
          array(
            d.valid.map((v) => (v ? 1 : 0)),
            "同Episode合法Mask",
          ) +
          metrics([
            ["合法目标个数", d.valid.filter(Boolean).length],
            ["越界/跨Episode部分", "按明确策略截断、Mask或补齐"],
          ]),
        "相同Episode才在本例中具有连续未来关系。显示全局帧号与边界，不能用下一文件的第一帧默默接上。",
        select(
          "起始帧",
          [
            [0, "全局1"],
            [1, "全局2"],
          ],
          s,
        ),
      );
    }
    case "closed-loop": {
      const open = N.closedLoop(false),
        feedback = N.closedLoop(true, !!c);
      return frame(
        curve(
          [
            { name: "目标位置3", values: [3, 3, 3, 3] },
            { name: "预定开环", values: open.trace.map((x) => x.x) },
            {
              name: c ? "晚1拍反馈" : "即时反馈",
              values: feedback.trace.map((x) => x.x),
            },
          ],
          "状态位置随控制步变化",
          5,
        ) +
          table(
            ["步", "反馈方案命令u", "额外干扰d", "执行后x"],
            feedback.trace.slice(1).map((r) => [r.time, r.u, r.d, r.x]),
          ) +
          metrics([
            ["反馈方案最终误差", feedback.error],
            ["开环最终误差", open.error],
          ]),
        "一维手工动态x′=x+u+d，命令限制0..1、第一步干扰+1。实际机器人模型、约束与成功率并未在本图验证。",
        select(
          "观测可用性",
          [
            [0, "当前状态可用"],
            [1, "状态晚1步"],
          ],
          s,
        ),
      );
    }
    case "world-learning": {
      if (view === "imagination") {
        const actions = c ? [1, 0, 1] : [1, 1, 1],
          h = [0.2];
        for (const a of actions) h.push(0.5 * h.at(-1) + 0.1 * a);
        return frame(
          curve(
            [{ name: "预测h（非真实环境）", values: h }],
            "无未来观测的手工状态预测",
            1,
          ) +
            array(actions, "候选动作序列") +
            table(
              ["未来位置", "本次真实观测", "可使用分布"],
              [
                [1, "不可用", "动态先验"],
                [2, "不可用", "动态先验"],
                [3, "不可用", "动态先验"],
              ],
            ) +
            metrics([["预测末态h", h.at(-1)]]),
          "为隔离依赖，图使用手工h′=.5h+.1a，省略RSSM随机状态。没有未来观测时不能偷用后验；未运行真实Dreamer或完成策略训练。",
          select(
            "候选动作",
            [
              [0, "[1,1,1]"],
              [1, "[1,0,1]"],
            ],
            s,
          ),
        );
      }
      if (view === "targets")
        return frame(
          table(
            ["轨迹位置", "观测标签", "奖励标签", "继续标签"],
            [
              [0, "x0", 0, 1],
              [1, "x1", c ? -1 : 0, 1],
              [2, "x2", c ? 0 : 1, 0],
            ],
          ) +
            array(
              ["重建观测", "预测奖励", "预测延续"],
              "同一潜状态连接不同预测目标",
            ) +
            metrics([["这些是学到的模型预测吗", "不是，是监督标签示例"]]),
          "每个预测头对应明确标签与用途，奖励改变不等于输入图像也被同样改变。实际损失和参数共享以模型定义为准。",
          select(
            "任务奖励标签",
            [
              [0, "末步奖励1"],
              [1, "中间惩罚−1"],
            ],
            s,
          ),
        );
      const d = N.klState(false);
      return frame(
        matrices(
          matrix([d.p], c ? "先验p：本分支停止梯度" : "先验p：允许该项更新"),
          matrix([d.q], c ? "后验q：允许该项更新" : "后验q：本分支停止梯度"),
        ) +
          array(d.terms, "各项 qᵢ ln(qᵢ/pᵢ)；单项可为负") +
          metrics([
            ["前向KL / nat", d.kl],
            ["Stop-gradient改变", "参数更新路径，不改变本次前向概率"],
            ["想象未来时可用", "动态先验；没有未来真实观测后验"],
          ]),
        "p=[.5,.5]、q=[.8,.2]固定，只比较梯度流向。未执行训练；完整Dreamer有不同损失权重、free bits及其它细节。",
        select(
          "被固定的分支",
          [
            [0, "固定后验q"],
            [1, "固定先验p"],
          ],
          s,
        ),
      );
    }
    case "diffusion-transformer": {
      if (view === "axes" || view === "quality") {
        const steps = c ? 2 : 4;
        return frame(
          matrix(
            Array.from({ length: steps }, (_, i) =>
              Array.from(
                { length: 4 },
                (_, frame) => `生成步${i}：帧${frame}×4Patch`,
              ),
            ),
            "行=生成步；列=视频物理帧，每格汇总4Token",
          ) +
            metrics([
              ["每次网络输入的Token数", 16],
              ["网络调用次数", steps],
              ["是否逐帧自回归", "不能由此表认定；本例每步处理整段"],
              ["质量与真实时长", "未测量"],
            ]),
          "两条时间轴必须分开。此表表示整段去噪的输入组织，不是具体视频模型的网络图或实测调用时长。",
          select(
            "生成迭代次数",
            [
              [0, "4"],
              [1, "2"],
            ],
            s,
          ),
        );
      }
      const d = N.noiseState(c ? 0.81 : 0.25);
      return frame(
        matrices(
          matrix([d.z0], "干净latent z₀"),
          matrix([d.noise], "噪声ε"),
          matrix([d.zt], "带噪zₜ"),
          matrix([d.restored], "已知真实噪声时反解参考"),
        ) +
          metrics([
            ["信号系数√ᾱ", d.signal],
            ["噪声系数√(1−ᾱ)", d.noiseScale],
            ["实际模型的任务", "预测所需噪声/其它参数化，不能直接读取真实ε"],
          ]),
        "标量分量扩展为2维例，噪声是指定样本。真实推理没有干净目标和真实噪声答案；这里的反解只核对公式。",
        select(
          "ᾱ",
          [
            [0, ".25"],
            [1, ".81"],
          ],
          s,
        ),
      );
    }
    default:
      return renderGpuFoundation(id, view, s);
  }
}
function renderGpuFoundation(id, view, s) {
  const c = c2(s);
  switch (id) {
    case "gpu-execution": {
      const tid = c ? 37 : 5,
        bid = 1,
        global = bid * 64 + tid,
        warp = Math.floor(tid / 32),
        lane = tid % 32;
      if (view === "schedule")
        return frame(
          matrices(
            matrix(
              c
                ? [
                    ["B1", "B3"],
                    ["B0", "B2"],
                  ]
                : [
                    ["B0", "B2"],
                    ["B1", "B3"],
                  ],
              "行=教学SM0/1，列=先后驻留批次",
            ),
          ) +
            metrics([
              ["逻辑CTA责任", "B0..B3不随本安排改变"],
              ["能否由blockIdx推断实际SM", "不能"],
            ]),
          "两种手工调度仅用于区分逻辑任务与物理驻留，未声称真实设备采用此顺序或具有2个SM。",
          select(
            "合法教学安排",
            [
              [0, "方案甲"],
              [1, "方案乙"],
            ],
            s,
          ),
        );
      return frame(
        matrix(
          Array.from({ length: 2 }, (_, w) =>
            Array.from({ length: 32 }, (_, l) => w * 32 + l),
          ),
          `CTA1内64线程；两行分别Warp0/1`,
          (w, l) => (w === warp && l === lane ? "selected" : `owner-${w}`),
        ) +
          matrices(
            matrix([["T0..63", "Shared_A"]], "CTA0的共享范围"),
            matrix([["T0..63", "Shared_B"]], "CTA1的共享范围"),
          ) +
          metrics([
            ["CTA内threadId", tid],
            ["Warp / Lane", `${warp} / ${lane}`],
            ["全局线性ID", global],
          ]),
        "CUDA本课Warp大小32。逻辑线程号含作用域，不能仅由Lane或blockIdx推断SM与共享存储；普通CTA同步不自动跨CTA。",
        select(
          "CTA1内线程",
          [
            [0, "thread5"],
            [1, "thread37"],
          ],
          s,
        ),
      );
    }
    case "shared-bank": {
      const mode = s.case % 4,
        d = N.banks(mode);
      let z =
        text(25, 20, "纵轴=Bank编号，横轴=Lane；同Bank不同Word才是本例冲突") +
        line(50, 245, 575, 245, "axis") +
        line(50, 35, 50, 245, "axis");
      for (const t of [0, 8, 16, 24, 31])
        z += text(45 + t * 16, 268, t) + text(15, 250 - t * 6.5, t);
      d.bank.forEach(
        (b, l) => (z += dot(50 + l * 16, 245 - b * 6.5, 4, `owner-${b % 4}`)),
      );
      return frame(
        svg(z, "Lane到Bank的地址映射", 290) +
          table(
            ["Lane示例", "Word地址", "Byte地址", "Bank"],
            [0, 1, 2, 31].map((i) => [
              i,
              d.words[i],
              d.words[i] * 4,
              d.bank[i],
            ]),
          ) +
          metrics([
            ["单Bank最大不同字数", d.maxConflict],
            ["地址Stride（Word）", d.stride],
            [
              "广播还是不同字",
              mode === 3 ? "所有Lane读取同一个word0" : "按各Lane地址统计不同字",
            ],
          ]),
        "假设32Bank、标量32-bit读；Padding33的列读分散Bank。广播相同字与32个不同字同Bank不是同一情况，未预测GPU周期。",
        select(
          "访问方式",
          [
            [0, "连续Stride1"],
            [1, "列读Stride32"],
            [2, "Padding33"],
            [3, "同字广播"],
          ],
          s,
        ),
      );
    }
    case "occupancy-resources": {
      const d = N.residency(c ? 96 : 32, 8);
      return frame(
        bars(Object.entries(d.limits), "各资源允许的CTA数", 8) +
          array(
            Array.from({ length: 8 }, (_, i) =>
              i < d.warps ? `驻留W${i}` : "空槽",
            ),
            "教学设备8个Warp槽",
          ) +
          metrics([
            ["最终CTA", d.blocks],
            ["驻留Warp", d.warps],
            ["Occupancy", 100 * d.occupancy + "%"],
            ["是否保证Eligible", "不保证，仍需数据/执行资源就绪"],
          ]),
        "完全虚构的资源容量：8Warp、4CTA、16384寄存器字、32KiB Shared；每CTA64线程/8KiB，忽略实际分配粒度。不是任何GPU规格。",
        select(
          "每线程寄存器",
          [
            [0, "32"],
            [1, "96"],
          ],
          s,
        ),
      );
    }
    case "measurement-stability": {
      const d = N.measurement(view === "cold" ? false : !!c);
      return frame(
        curve(
          [
            { name: "方案A / ms", values: d.a },
            {
              name: view === "cold" ? "含冷启动的B / ms" : "方案B / ms",
              values: d.b,
            },
          ],
          "每次运行时长，横轴样本编号",
          30,
        ) +
          table(
            ["统计量", "A", "B"],
            [
              ["均值ms", d.meanA, d.meanB],
              ["中位数ms", d.medianA, d.medianB],
              ["样本数", 5, 5],
            ],
          ) +
          metrics([
            ["能否报告可信生产P99", "不能，样本量和负载条件不足"],
            ["环境条件", "记录时钟、温度、功耗、并发及测量范围"],
          ]),
        "所有时间是合成数字；曲线不证明某种温度/功耗因果。冷启动与稳态应按问题分别报告，不静默删样本。",
        view === "cold"
          ? ""
          : select(
              "B的运行序列",
              [
                [0, "首条冷启动30ms"],
                [1, "8/8/8/14/14ms"],
              ],
              s,
            ),
      );
    }
    default:
      throw Error("Unimplemented foundation object " + id + "/" + view);
  }
}
