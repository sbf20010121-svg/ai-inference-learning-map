/** Executable teaching models, not GPU measurements or production simulators. */
import {
  recurrence,
  compilerLayout,
  chunkEquivalence,
} from "./research-models.js";
import {
  schedulerRounds,
  moeRoutes,
  combineExample,
  flashSteps,
  robotTimeline,
  directAttention,
} from "./research-expansion-model.js";
const sum = (a) => a.reduce((s, x) => s + x, 0);
export const softmax = (a) => {
  const m = Math.max(...a),
    e = a.map((x) => Math.exp(x - m));
  return e.map((x) => x / sum(e));
};
const frame = (title, kind, rows, detail) => ({ title, kind, rows, detail });
const bars = (title, rows, detail) => frame(title, "bars", rows, detail);
const metrics = (title, rows, detail) => frame(title, "metrics", rows, detail);
const cells = (title, rows, detail) => frame(title, "cells", rows, detail);
const matrix = (title, rows, detail) => frame(title, "matrix", rows, detail);
const timeline = (title, rows, detail) =>
  frame(title, "timeline", rows, detail);
export function courseModel(id, changed = false) {
  const v = changed ? 1 : 0;
  switch (id) {
    case "llm-block": {
      const S = v ? 1 : 4,
        H = 8,
        hq = 4,
        hkv = 2,
        d = 2,
        L = 6;
      return [
        cells(
          "输入与投影",
          [
            ["X", [S, H]],
            ["Q", [S, hq, d]],
            ["K / V（各）", [S, hkv, d]],
          ],
          "单请求、单层、无 Batch 维；GQA 中多个 Query Head 共用一个 KV Head。",
        ),
        matrix(
          "因果可见性",
          Array.from({ length: S }, (_, i) =>
            Array.from({ length: v ? L + 1 : S }, (_, j) =>
              j <= (v ? L : i) ? 1 : 0,
            ),
          ),
          "1 表示允许读取；Decode 当前行仍要访问全部合法历史位置。",
        ),
        bars(
          "投影的乘加量",
          [
            ["QKV FLOPs", 2 * S * H * (hq + 2 * hkv) * d],
            ["输出投影 FLOPs", 2 * S * hq * d * H],
          ],
          "乘法和加法各计一次；只统计投影，不含 Attention、Norm、MLP。",
        ),
        bars(
          "本轮 KV 读写对象",
          [
            ["新写入元素", 2 * S * hkv * d],
            ["可见 KV 元素", 2 * (v ? L + 1 : S) * hkv * d],
          ],
          "Prefill 与 Decode 的计算形状不同。这里的元素计数不是 HBM 实际流量。",
        ),
      ];
    }
    case "kv-cache": {
      const block = 4,
        len = v ? 9 : 5,
        table = [3, 1, 4].slice(0, Math.ceil(len / block));
      return [
        cells(
          "逻辑 Token 位置",
          [["位置", Array.from({ length: len }, (_, i) => i)]],
          "数字只是 K/V 状态的索引，物理块中存的是张量，不是 Token 字符串。",
        ),
        cells(
          "Block Table",
          [["逻辑块", table.map((p, i) => `L${i}→P${p}`)]],
          "逻辑块顺序连续，物理块编号可以不连续。",
        ),
        cells(
          "物理槽映射",
          [
            [
              "地址",
              Array.from(
                { length: len },
                (_, i) => `P${table[Math.floor(i / block)]}:${i % block}`,
              ),
            ],
          ],
          "物理块号由表查出；块内偏移由 Token 位置除以块大小的余数得到。",
        ),
        bars(
          "分配与尾块浪费",
          [
            ["已使用槽", len],
            ["已分配槽", table.length * block],
            ["未使用槽", table.length * block - len],
          ],
          "块大小 4 为教学假设；共享前缀还需匹配完整前缀身份、满块与引用计数。",
        ),
      ];
    }
    case "vllm-scheduler": {
      const B = v ? 4 : 8,
        r = schedulerRounds(B, 3);
      return [
        bars(
          "待计算量",
          [
            ["A Decode", 1],
            ["B Prefill", 6],
            ["C Prefill", 4],
          ],
          "FCFS 教学顺序；不是当前 vLLM 的全部策略。",
        ),
        ...r.map((x) =>
          bars(
            `第 ${x.round} 轮 · 预算 ${B}`,
            x.chosen.map((t) => [`${t.id} ${t.kind}`, t.n]),
            `使用 ${x.used}，剩余 ${x.free}；B/C 未完成输入 ${x.remaining.B}/${x.remaining.C}。KV 分配另行约束，本图未模拟抢占。`,
          ),
        ),
      ];
    }
    case "moe-route": {
      const m = moeRoutes(),
        t = v ? 3 : 0,
        c = combineExample(t);
      return [
        bars(
          `T${t} 的 Router 评分`,
          c.scores.map((s, e) => [`E${e}`, s]),
          "评分来自隐藏向量与路由权重；教学例对选中项做 Softmax。",
        ),
        cells(
          "Top-2 与归一权重",
          [
            [
              "选中",
              c.experts.map((e, i) => `E${e}: ${c.weights[i].toFixed(3)}`),
            ],
          ],
          "两个副本进入两个专家；不是把所有专家权重搬到 Token 所在卡。",
        ),
        cells(
          "专家分桶 / EP",
          [
            ...m.buckets.map((b) => [
              `GPU${b.owner} / E${b.e}`,
              b.tokens.map((t) => `T${t}`),
            ]),
          ],
          `8 条 token-expert 分配中 ${m.transfers.length} 条跨 GPU；Grouped GEMM 的各组 M 为 2/3/3。`,
        ),
        bars(
          "专家输出加权",
          [
            ...c.expertScalars.map((s, i) => [
              `E${c.experts[i]} 加权贡献`,
              s * c.weights[i],
            ]),
            ["合并结果", c.sum],
          ],
          "只展示输出向量的一个坐标；合并是按原 Token 身份还原并加权。",
        ),
      ];
    }
    case "pd-disagg": {
      const tokens = v ? 8192 : 2048,
        bytes = 2 * 32 * 8 * 128 * tokens * 2,
        ms = (bytes / 25e9) * 1000;
      return [
        cells(
          "P 产生的历史状态",
          [
            [
              "KV 维度",
              ["K/V=2", "层=32", "KV头=8", "维度=128", `长度=${tokens}`],
            ],
          ],
          "假设 BF16 每元素 2 字节；P 和 D 是完整推理角色，不是模型前后半层。",
        ),
        bars(
          "转运体积",
          [["KV MB", bytes / 1e6]],
          "接收端需要自己的地址映射；不能直接复用远端 GPU 指针。",
        ),
        bars(
          "不可重叠的串行阶段 ms",
          [
            ["Prefill", 12],
            ["KV 传输", ms],
            ["Decode 首步", 2],
          ],
          "横条表示阶段耗时，单位ms；12与2是教学假设，传输为25GB/s理想下界。实际是否重叠需Trace。",
        ),
        bars(
          "额外链路代价",
          [
            ["理想转运 ms", ms],
            ["假设节省排队 ms", 20],
          ],
          "仅当减轻干扰和排队的收益足以补偿新增开销时才有价值；不能据此推断真实 TTFT。",
        ),
      ];
    }
    case "serving-slo": {
      const arrival = [0, 1, 2, 3],
        service = v ? 3 : 2;
      let end = 0;
      const latency = arrival.map((a) => {
        end = Math.max(a, end) + service;
        return end - a;
      });
      return [
        cells(
          "请求到达",
          [["到达时间 ms", arrival]],
          "单服务台、确定性服务时间的排队例子；不是完整在线推理。",
        ),
        timeline(
          "排队后完成时间",
          [["每条响应 ms", latency]],
          "后到请求即使执行时间相同，也会因为前面的请求而增加等待。",
        ),
        bars(
          "满足 5 ms SLO",
          [
            ["满足条数", latency.filter((x) => x <= 5).length],
            ["超时条数", latency.filter((x) => x > 5).length],
          ],
          "SLO 是服务目标；本例约束响应时延，不是 GPU 利用率。",
        ),
        bars(
          "吞吐与体验分别核算",
          [
            ["末条完成 ms", end],
            ["最大响应 ms", Math.max(...latency)],
          ],
          "4 个请求不足以估计 P99；这里只展示队列增长如何造成违约。",
        ),
      ];
    }
    case "compiler-lowering": {
      const layout = compilerLayout(v ? 4 : 8);
      return [
        cells(
          "捕获与依赖",
          [["算子", ["x→乘2", "u→加1", "v→ReLU"]]],
          "Dynamo 捕获受 Guard 保护的张量图；图中断将编译区域分开。",
        ),
        bars(
          "消除物化中间量",
          [
            ["拆分逻辑读写", 60],
            ["融合逻辑读写", 20],
          ],
          "N=10，假设三个算子均全量读写全局中间量；6N 对 2N。不是 HBM 事务或 3 倍提速。",
        ),
        cells(
          "尾块 Mask",
          layout.programs.map((p) => [
            `Program ${p.pid}`,
            p.offsets.map((n, i) => (p.masks[i] ? `${n}✓` : `${n}×`)),
          ]),
          "TTIR 描述张量操作，TTGIR 加入布局；此处偏移不是实际 Lane 绑定。",
        ),
        cells(
          "代码生成核查对象",
          [["层次", ["TTIR", "TTGIR", "LLVM IR", "PTX", "SASS"]]],
          "这只是层次标签；真实变换需保存指定版本 kernel.asm 和 cubin，并对照生成产物。",
        ),
      ];
    }
    case "triton-tiling": {
      const M = 5,
        N = 6,
        K = 4,
        bm = v ? 4 : 2,
        bn = 3;
      return [
        matrix(
          "输出 Tile 归属",
          Array.from({ length: M }, (_, i) =>
            Array.from(
              { length: N },
              (_, j) => `${Math.floor(i / bm)},${Math.floor(j / bn)}`,
            ),
          ),
          "每个格子是 C 的一个元素，标签为 Program 的二维 Tile 编号。",
        ),
        metrics(
          "Program 与有效工作",
          [
            ["Program 数", Math.ceil(M / bm) * Math.ceil(N / bn)],
            ["计算槽位", Math.ceil(M / bm) * Math.ceil(N / bn) * bm * bn],
            ["有效输出", M * N],
          ],
          "增大 Tile 减少 Program 数，但边界 Mask 和资源成本可能增加。",
        ),
        cells(
          "单次 K 分块输入",
          [
            ["A Tile", [bm, K]],
            ["B Tile", [K, bn]],
            ["累加器", [bm, bn]],
          ],
          "Layout 决定这些元素由哪些线程持有、如何交换，不等于二维 shape。",
        ),
        bars(
          "每 Program 累加器元素",
          [["输出驻留需求", bm * bn]],
          "只是逻辑元素数量，不是编译器实际寄存器数；需检查 Spill 和并发驻留。",
        ),
      ];
    }
    case "runtime-graph": {
      const launches = v ? 1 : 3;
      return [
        cells(
          "有依赖的设备任务",
          [
            ["Stream S0", ["写 A", "K1(A)", "记录 E"]],
            ["Stream S1", ["等待 E", "K2(A)"]],
          ],
          "Event E 表示生产者完成的依赖；不同 Stream 不自动存在先后保证。",
        ),
        bars(
          "CPU 提交次数",
          [
            ["普通 Launch", 3],
            ["当前模式", launches],
          ],
          "条件改变后演示 Graph Replay；Graph 不会把三个 Kernel 自动融合成一个。",
        ),
        timeline(
          "Kernel 数保持不变",
          [["GPU", ["K1", "K2", "K3"]]],
          "有向无环图记录工作依赖；Replay 减少重复提交，但仍须满足捕获约束与地址生命周期。",
        ),
        bars(
          "假设串行开销 μs",
          [
            ["CPU 提交", launches * 4],
            ["设备工作", 30],
          ],
          "4 μs 和 30 μs 是教学假设；并发运行中不能直接相加判断性能。",
        ),
      ];
    }
    case "gemm-tiling": {
      const M = v ? 1 : 8,
        N = 8,
        K = 8,
        b = 2,
        flops = 2 * M * N * K,
        bytes = (M * K + K * N + M * N) * b;
      return [
        cells(
          "矩阵相乘的维度",
          [
            ["A", [M, K]],
            ["B", [K, N]],
            ["C", [M, N]],
          ],
          "M 是输出行，N 是输出列，K 是归约轴；C 每格累积 K 个乘积。",
        ),
        matrix(
          "固定 A/B 的局部乘积",
          [
            [1 * 5 + 2 * 7, 1 * 6 + 2 * 8],
            [3 * 5 + 4 * 7, 3 * 6 + 4 * 8],
          ],
          "独立 2×2 手算例：A=[[1,2],[3,4]]，B=[[5,6],[7,8]]；输出 19/22/43/50。",
        ),
        metrics(
          "理想成本",
          [
            ["FLOPs", flops],
            ["最少字节", bytes],
          ],
          "每输入只读一次、输出写一次、不读旧 C；真实分块可能多次搬运。",
        ),
        bars(
          "Roofline 算术强度",
          [["FLOPs/Byte", flops / bytes]],
          "低 M 降低权重摊销；Roofline 给上界，不能定位所有延迟与指令依赖。",
        ),
      ];
    }
    case "attention-tiling": {
      const ss = flashSteps(),
        z = ss[v ? 2 : 1];
      return [
        cells(
          "分块输入",
          [
            ["Score", [1, 2, 3, 0]],
            ["Value", [2, 4, -1, 5]],
          ],
          "一行 Query，两个 KV Tile，Value 为标量；省略多头、Mask 和低精度误差。",
        ),
        metrics(
          "第一块统计量",
          [
            ["m", ss[1].m],
            ["l", ss[1].l],
            ["a", ss[1].a],
          ],
          "m 是最大分数，l 是以 m 为基准的指数和，a 是指数加权的 Value 和。",
        ),
        metrics(
          `处理 ${z.tile} 块后的状态`,
          [
            ["m", z.m],
            ["l", z.l],
            ["a", z.a],
          ],
          `重缩放系数 α=${z.alpha.toFixed(4)}；基准上升时旧 l/a 必须同时缩放。`,
        ),
        bars(
          "最终输出核对",
          [
            ["online", ss[2].out],
            ["direct", directAttention()],
          ],
          "改变条件可停在不同 Tile；最终归一结果相同不意味着采用近似注意力。",
        ),
      ];
    }
    case "profiling": {
      const hot = v ? 2 : 4,
        base = 10;
      return [
        timeline(
          "合成端到端账本",
          [
            ["排队", [2]],
            ["CPU", [2]],
            ["热点", [hot]],
            ["其他", [2]],
          ],
          "各段假设串行、不重叠，单位 ms；条件改变仅将热点 4 ms 改为 2 ms。",
        ),
        bars(
          "局部与整体",
          [
            ["原总 ms", base],
            ["当前总 ms", 6 + hot],
          ],
          "热点加速 2 倍，端到端仅从 10 变为 8 ms。",
        ),
        bars(
          "反事实预测",
          [
            ["预测总加速", base / (6 + hot)],
            ["局部加速", 4 / hot],
          ],
          "先记录预测；如果实测总时间没下降，检查重叠、测量同步和工作负载是否改变。",
        ),
        cells(
          "证据层次",
          [
            [
              "先后",
              [
                "NSYS找关键路径",
                "NCU看热点资源",
                "受控改一项",
                "复测输出与尾延迟",
              ],
            ],
          ],
          "Stall 比例不能单独证明瓶颈；Profiling 可能插入回放改变运行条件。",
        ),
      ];
    }
    case "host-runtime": {
      const async = v === 1;
      return [
        cells(
          "CPU 缓冲区生命周期",
          [["所有权", ["CPU填充", "提交H2D", "DMA读缓冲区", "完成后复用"]]],
          "DMA 是设备直接搬运；提交返回不代表设备已读完缓冲区。",
        ),
        timeline(
          "两批任务的阶段",
          [
            ["Batch 0", ["拷贝", "计算"]],
            [
              "Batch 1",
              async ? ["准备", "拷贝与计算重叠"] : ["等待", "拷贝", "计算"],
            ],
          ],
          "真正重叠依赖 pinned 内存、Stream、独立数据和设备能力。",
        ),
        bars(
          "假设理想流水线 ms",
          [
            ["首批", 3 + 5],
            ["后续每批", async ? Math.max(3, 5) : 3 + 5],
          ],
          "拷贝 3 ms、计算 5 ms；理想稳态可接近 max，首批仍要先搬再算。",
        ),
        cells(
          "回收条件",
          [["必须等待", ["H2D完成再改输入", "Kernel完成再读输出"]]],
          "只补需要的依赖；全设备同步可能破坏并行，但去掉所有同步可能得到错误结果。",
        ),
      ];
    }
    case "multi-gpu": {
      const a = v ? [10, 20] : [1, 2],
        b = [3, 4],
        out = a.map((x, i) => x + b[i]);
      return [
        matrix(
          "两个 Rank 的局部贡献",
          [a, b],
          "Rank 是通信参与者。本例为同一个输出的部分和，适合演示行并行线性层归约。",
        ),
        matrix(
          "AllReduce 后每卡结果",
          [out, out],
          "逐坐标求和并分发到各卡；不是简单拼接两个向量。",
        ),
        cells(
          "与其它集合通信比较",
          [
            ["AllGather", [...a, ...b]],
            ["ReduceScatter", [`R0:${out[0]}`, `R1:${out[1]}`]],
          ],
          "AllGather 拼接，ReduceScatter 归约后分片；算子语义不可互换。",
        ),
        metrics(
          "通信下界示意",
          [
            ["假设负载 MB", 8],
            ["25 GB/s 理想 ms", (8e6 / 25e9) * 1000],
          ],
          "不含启动延迟、拓扑、分块、协议或重叠；EP 的 Token 派发另见 MoE。",
        ),
      ];
    }
    case "warp-issue": {
      const ready = v ? [0, 1, 2, 3] : [0];
      const issued = Array.from({ length: 8 }, (_, c) =>
        ready.includes(c) ? `W${ready.indexOf(c)}` : c === 4 ? "W0" : "空",
      );
      return [
        cells(
          "指令依赖",
          [["W0", ["load r1", "等待r1", "add r2=r1+1"]]],
          "Scoreboard 跟踪未满足依赖；Active（驻留）不代表 Eligible（可发射）。",
        ),
        timeline(
          "单发射槽的人工周期",
          [
            ["周期", Array.from({ length: 8 }, (_, i) => i)],
            ["发射", issued],
          ],
          "load 在周期 0 发射、结果假设在周期 4 可用；其他 Warp 各有一条独立指令。",
        ),
        metrics(
          "不同状态不可混淆",
          [
            ["驻留 Warp", ready.length],
            ["填充发射槽", issued.filter((x) => x !== "空").length],
            ["空槽", issued.filter((x) => x === "空").length],
          ],
          "不模拟多发射、真实流水线延迟与 Warp 资源分配。",
        ),
        cells(
          "验证与代价",
          [
            [
              "观察",
              ["Eligible/Issue", "寄存器限制", "Spill流量", "端到端时间"],
            ],
          ],
          "增加驻留 Warp 可能增加寄存器压力；只有关键路径等待可被隐藏时才改善。",
        ),
      ];
    }
    case "memory-route": {
      const stride = v ? 8 : 1,
        addr = Array.from({ length: 8 }, (_, i) => i * stride * 4),
        segs = addr.map((a) => Math.floor(a / 32));
      return [
        cells(
          "线程元素地址",
          [["Lane 0–7 字节地址", addr]],
          "每线程取一个 4 字节元素。这里仅画 8 线程教学子集，真实 Warp 通常需看完整访问。",
        ),
        cells(
          "对齐 32B 段编号",
          [["段", segs]],
          "地址除以 32 向下取整；相同段用相同编号表示。",
        ),
        metrics(
          "覆盖与有效负载",
          [
            ["覆盖段数", new Set(segs).size],
            ["有效字节", 32],
            ["覆盖字节", new Set(segs).size * 32],
          ],
          "覆盖段估算不等于真实 DRAM 事务；缓存、合并规则、访问指令都会影响。",
        ),
        cells(
          "存储空间不是串行梯子",
          [
            ["软件管理", ["寄存器私有", "Shared显式协作"]],
            ["缓存/外存", ["L1/L2硬件路径", "HBM物理外存"]],
          ],
          "Shared 不是全局读取必经的自动缓存；必须由程序搬运和同步。",
        ),
      ];
    }
    case "tensorcore-b200": {
      const stages = v ? 2 : 1;
      return [
        cells(
          "两个 Tile 的缓冲身份",
          [
            [
              "Shared",
              ["slot0:A0/B0", stages === 2 ? "slot1:A1/B1" : "复用slot0"],
            ],
          ],
          "双缓冲让生产者写下一槽、消费者读当前槽；不是允许覆盖未完成的数据。",
        ),
        timeline(
          "人工阶段序列",
          [
            [
              "搬运",
              stages === 2
                ? ["Tile0", "Tile1", "空"]
                : ["Tile0", "空", "Tile1"],
            ],
            [
              "计算",
              stages === 2
                ? ["空", "Tile0", "Tile1"]
                : ["空", "Tile0", "空", "Tile1"],
            ],
          ],
          "每格一个教学阶段，非 B200 周期；提交异步指令后仍需完成协议。",
        ),
        bars(
          "假设缓冲容量 KiB",
          [
            ["单槽", 16],
            ["总槽", stages * 16],
          ],
          "更深流水线消耗 Shared 等资源；Blackwell tcgen05 的累加器 Tensor Memory 与普通寄存器不能混为一谈。",
        ),
        cells(
          "同步所有权",
          [
            [
              "协议",
              [
                "生产者完成搬入",
                "消费者等待可见",
                "矩阵操作完成",
                "确认后复用槽",
              ],
            ],
          ],
          "tcgen05、TMA、mbarrier 各有特定语义；本例只讲生产消费依赖，不伪造指令序列。",
        ),
      ];
    }
    case "spec-decode": {
      const p = [0.6, 0.3, 0.1],
        q = v ? [0.1, 0.1, 0.8] : [0.5, 0.4, 0.1],
        accept = sum(p.map((x, i) => Math.min(x, q[i]))),
        res = p.map((x, i) => Math.max(0, x - q[i]));
      return [
        bars(
          "目标分布 p",
          p.map((x, i) => [`词${i}`, x]),
          "三个词的教学分布；目标模型和 Draft 的分布都必须对齐同一历史前缀。",
        ),
        bars(
          "草稿分布 q",
          q.map((x, i) => [`词${i}`, x]),
          "条件改变让草稿偏向目标概率很低的词；仍需支付草稿计算成本。",
        ),
        bars(
          "每个草稿的接受概率",
          p.map((x, i) => [`词${i}`, Math.min(1, x / q[i])]),
        ),
        bars(
          "拒绝后残差分布",
          res.map((x, i) => [`词${i}`, x / sum(res)]),
          `单步平均接受率 Σmin(p,q)=${accept.toFixed(2)}；拒绝时从归一化 max(p−q,0) 采样以保持目标分布。多步验证还涉及额外 Token 与缓存回退。`,
        ),
      ];
    }
    case "quant-pipeline": {
      const x = [-1, -0.2, 0.3, 1],
        scale = v ? 0.5 : 0.25,
        q = x.map((a) => Math.max(-7, Math.min(7, Math.round(a / scale)))),
        y = q.map((a) => a * scale);
      return [
        bars(
          "原值 x",
          x.map((a, i) => [`x${i}`, a]),
          "对称有符号整数量化教学例；不是 FP8/FP4 数值格式。",
        ),
        bars(
          "量化整数 q",
          q.map((a, i) => [`q${i}`, a]),
          `scale=${scale}，先除以 scale，再舍入并截断到 [−7,7]。`,
        ),
        bars(
          "还原值 x̂",
          y.map((a, i) => [`x̂${i}`, a]),
          "矩阵计算后端可能融合反量化，也可能使用硬件低精度路径；依格式而定。",
        ),
        bars(
          "逐元素绝对误差",
          x.map((a, i) => [`误差${i}`, Math.abs(a - y[i])]),
          "更粗 Scale 增大舍入误差但扩大覆盖范围；还需记录 Scale 存储、异常值与任务质量。",
        ),
      ];
    }
    case "fused-norm": {
      const x = v ? [0, 0] : [3, 4],
        eps = 1e-5,
        rms = Math.sqrt(sum(x.map((a) => a * a)) / x.length + eps),
        y = x.map((a) => a / rms);
      return [
        bars(
          "一行输入 x",
          x.map((a, i) => [`x${i}`, a]),
          "RMSNorm 沿归一化维归约；本例 γ=[1,1]，不是按元素独立缩放。",
        ),
        bars(
          "平方后归约",
          [
            ["平方均值", sum(x.map((a) => a * a)) / 2],
            ["ε", eps],
          ],
          "平方、求均值、加 ε 后开方；不能把求均值替换成每个元素自己的平方。",
        ),
        bars(
          "归一化输出",
          y.map((a, i) => [`y${i}`, a]),
          `分母 rms=${rms.toFixed(5)}。全零输入时 ε 保证不出现 0/0。`,
        ),
        cells(
          "与 RoPE / SwiGLU 的依赖差异",
          [
            ["RMSNorm", ["整行归约"]],
            ["RoPE", ["成对旋转与位置"]],
            ["SwiGLU", ["silu(gate)×up"]],
          ],
          "融合减少中间写回，但不能消除 Norm 的整行依赖；RoPE 配对约定必须匹配模型。",
        ),
      ];
    }
    case "mla-kv": {
      const c = [2, 1],
        U = [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        q = v ? [0, 1, 2] : [1, 2, 0],
        k = U.map((r) => sum(r.map((x, i) => x * c[i]))),
        absorbed = c.map((_, i) => sum(U.map((r, j) => r[i] * q[j])));
      return [
        matrix(
          "潜向量与上投影",
          [c, ...U],
          "c=[2,1]；下方三行为 U 的 3×2 矩阵。只研究内容 Key 的投影，不是完整 MLA。",
        ),
        bars(
          "显式展开 Key",
          k.map((a, i) => [`k${i}`, a]),
          "k=Uc；缓存 c 可避免保存展开后的每个 Key 头，但还存在位置分量。",
        ),
        bars(
          "吸收到 Query 侧",
          absorbed.map((a, i) => [`Uᵀq${i}`, a]),
          "把 qᵀ(Uc) 改写成 (Uᵀq)ᵀc；依赖矩阵结合律，不是省掉全部投影。",
        ),
        bars(
          "两种打分核对",
          [
            ["显式 qᵀk", sum(q.map((x, i) => x * k[i]))],
            ["吸收后", sum(absorbed.map((x, i) => x * c[i]))],
          ],
          "RoPE 分量必须单独处理；Value 侧投影与实际 Kernel 成本不在这个小模型中。",
        ),
      ];
    }
    case "linear-state": {
      const r = recurrence(v ? 1 : 0.5, 1);
      return r.map((s, i) => ({
        ...frame(
          [
            "初始 S₀",
            "写入第一 Token",
            "写入第二 Token",
            "相同 Key 的纠错重写",
          ][i],
          "delta",
          s.S,
          i === 0
            ? "行是 Key 维，列是 Value 维；每格记录关联，不是历史 KV 列表。"
            : `β=${v ? 1 : 0.5}，γ=1；先衰减旧状态，再预测、扣除旧值，沿Key方向写入残差。两步Chunk合成误差=${chunkEquivalence(v ? 1 : 0.5, 1).maxError}。`,
        ),
        state: s,
      }));
    }
    case "vla-policy": {
      const r = robotTimeline(true, v ? 6 : 4, 6, 4, 18);
      return [
        cells(
          "动作生成与控制的边界",
          [
            ["输入", ["图像", "语言", "本体状态"]],
            ["输出", ["6步动作Chunk"]],
          ],
          "本例只研究输出队列；Flow 去噪步、动作步与控制周期是三种不同索引。",
        ),
        timeline(
          "推理工作",
          [["节拍", r.inference]],
          "infer 表示推理中；idle 表示暂无推理。一次推理产生一个动作块。",
        ),
        timeline(
          "控制与队列",
          [
            ["执行", r.execution],
            ["剩余动作", r.sizes],
          ],
          "act 消耗一个动作，wait 表示队列空；提前请求只隐藏被剩余动作覆盖的延迟。",
        ),
        bars(
          "固定 18 节拍结果",
          [
            ["执行步", r.consumed],
            ["等待步", r.waits],
          ],
          "所有时间为合成节拍；异步还需要旧动作裁剪、对齐和观测新鲜度，不自动保证任务成功。",
        ),
      ];
    }
    case "world-model": {
      const F = v ? 4 : 2,
        P = 4,
        N = F * P;
      return [
        cells(
          "观测帧与 Patch",
          [
            ...Array.from({ length: F }, (_, f) => [
              `帧${f}`,
              Array.from({ length: P }, (_, p) => `f${f}p${p}`),
            ]),
          ],
          "Patch 是图像块；本例为视频式建模的 Token 预算，不能代表所有世界模型。",
        ),
        matrix(
          "全局注意力配对",
          Array.from({ length: N }, (_, i) =>
            Array.from({ length: N }, (_, j) =>
              Math.floor(i / P) === Math.floor(j / P) ? 1 : 2,
            ),
          ),
          "1 为同帧配对，2 为跨帧配对；只是配对身份，不是 Attention 权重。",
        ),
        bars(
          "配对数量比较",
          [
            ["全局 N²", N * N],
            ["仅帧内 F·P²", F * P * P],
          ],
          "仅帧内注意力缺少跨帧信息，不能无代价替代全局注意力；还需时间混合。",
        ),
        cells(
          "预测不等于策略",
          [
            ["世界模型", ["状态/观测+动作→未来"]],
            ["策略", ["观测→动作"]],
            ["规划", ["候选动作→预测→评价"]],
          ],
          "Dreamer 的隐状态动态模型与视频扩散实现不同；不要求机器人每一步都跑视频生成。",
        ),
      ];
    }
    case "frameworks": {
      const a = v ? [20, 22, 80, 90] : [20, 22, 24, 26],
        b = [30, 31, 32, 33];
      return [
        bars(
          "同负载四条请求 A 的延迟 ms",
          a.map((x, i) => [`请求${i}`, x]),
          "合成对照数据，A/B 不是实际框架排名。模型、精度、设备、到达分布必须相同。",
        ),
        bars(
          "同负载 B 的延迟 ms",
          b.map((x, i) => [`请求${i}`, x]),
          "B 稳定但单条可能较慢；离线吞吐不能直接回答在线 SLO。",
        ),
        bars(
          "40 ms 以内请求数",
          [
            ["A", a.filter((x) => x <= 40).length],
            ["B", b.filter((x) => x <= 40).length],
          ],
          "样本只有四条，不报告 P99；改变条件后 A 的长尾导致目标满足率下降。",
        ),
        cells(
          "公平对照还需固定",
          [
            [
              "配置",
              [
                "模型revision",
                "dtype/量化",
                "TP/EP",
                "输入输出长度",
                "预热与编译",
              ],
            ],
            ["检查", ["实际后端", "错误率", "输出质量", "总GPU预算"]],
          ],
          "vLLM/SGLang/TensorRT-LLM 的支持矩阵随版本变动；不存在脱离条件的永远最快框架。",
        ),
      ];
    }
    default:
      throw Error(`No model for ${id}`);
  }
}
