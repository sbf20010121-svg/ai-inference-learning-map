/** Labelled dependencies; coordinates describe topology, never elapsed time. */
const e = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function box(id, x, y, title, sub, selected, width = 200) {
  return `<a href="#spine/${id}" class="spine-node ${id === selected ? "active" : ""}" aria-label="${e(title)}：${e(sub)}" ${id === selected ? 'aria-current="step"' : ""}><rect x="${x}" y="${y}" width="${width}" height="70" rx="9"/><text x="${x + 14}" y="${y + 28}" class="node-title">${e(title)}</text><text x="${x + 14}" y="${y + 51}" class="node-sub">${e(sub)}</text></a>`;
}
function edge(d, label, x, y, control = false) {
  return `<path d="${d}" class="${control ? "control" : "flow"}" marker-end="url(#spine-arrow)"/><text x="${x}" y="${y}" class="edge-label">${e(label)}</text>`;
}
function svg(body, title, description, height) {
  return `<div class="spine-map"><p class="spine-map-hint">关系图可左右滑动；点击环节查看详情。</p><div class="spine-map-scroll" tabindex="0" role="region" aria-label="系统关系图，可横向滚动"><svg class="spine-map-svg" viewBox="0 0 1000 ${height}" style="--map-height:${height}" role="img" aria-labelledby="spine-map-title spine-map-desc"><title id="spine-map-title">${e(title)}</title><desc id="spine-map-desc">${e(description)}</desc><defs><marker id="spine-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>${body}</svg></div></div>`;
}

export function runtimeDiagram(selected) {
  let b = edge("M220 60 H260", "身份", 224, 46)
    + edge("M460 60 H500", "ID", 468, 46)
    + edge("M700 60 H750", "分数", 708, 46)
    + edge("M850 95 V190", "新 Token", 862, 143)
    + edge("M750 225 H700", "继续", 710, 210)
    + edge("M600 190 V140 H785 V95", "下一位置的分数", 610, 130)
    + edge("M850 260 V345", "停止：EOS / 上限", 862, 310)
    + edge("M430 190 V163 H850 V190", "取消 / 故障可异步到达", 450, 177, true)
    + edge("M450 307 H545 V260", "逐轮预算 / KV / 完成依赖", 455, 326, true);
  b += box("request", 20, 25, "接纳与排队", "R7：身份、输入、生成配置", selected)
    + box("prepare", 260, 25, "准备模型输入", "Token ID、位置、模态边界", selected)
    + box("prefill", 500, 25, "Prefill", "输入各位置 → KV 与分数", selected)
    + box("sample", 750, 25, "输出分布与采样", "分数 → 概率 → 新 Token", selected)
    + box("decode", 500, 190, "Decode 前向", "读历史 KV，计算当前输入", selected)
    + box("stop", 750, 190, "是否继续？", "长度 / EOS / 取消 / 错误", selected)
    + box("return", 750, 345, "交付完成与安全回收", "终态 + 无在途使用 + 引用", selected);
  b += `<rect x="20" y="190" width="430" height="182" rx="10" class="control-box"/><text x="40" y="220" class="node-title">控制面每轮都在参与</text><text x="40" y="248">Scheduler：决定这轮处理谁、多少位置</text><text x="40" y="275">KV 管理：分配、共享、保留、回收</text><text x="40" y="302">完成事件：何时可读结果、复用缓冲</text><text x="40" y="345" class="node-sub">虚线表示控制依赖，不是 Token 数据流</text><text x="20" y="415" class="edge-label">实线表示对象进入下一环节；输出可逐 Token 流式交付，图末端表示请求收尾。</text>`;
  return svg(b, "请求运行路径：采样、停止判定与 Decode 回环", "接纳到输入准备、Prefill、采样。采样后判定停止；继续时进入Decode并返回采样。控制面每轮检查预算、KV和完成依赖。取消或故障可在在途阶段直接进入终态。", 450);
}

export function compileDiagram(selected) {
  let b = edge("M225 55 H270", "捕获", 230, 42)
    + edge("M470 55 H515", "图", 480, 42)
    + edge("M615 90 V120 H370 V155", "选择编译实现", 440, 113)
    + edge("M225 190 H270", "源码", 230, 177)
    + edge("M470 190 H515", "降低", 475, 177)
    + edge("M615 225 V285", "可加载产物", 625, 262)
    + edge("M715 320 H760", "可用", 718, 305)
    + edge("M860 90 V285", "按调用条件选择", 745, 150, true)
    + edge("M125 355 V397 H745 V338 H760", "已预编译的库：直接提供实现", 235, 387)
    + edge("M860 355 V420", "Launch + 依赖", 870, 397);
  b += box("compile-source", 25, 20, "PyTorch 程序", "示例：torch.compile 路径", selected)
    + box("compile-capture", 270, 20, "捕获与复用条件", "FX Graph / Guard / Shape", selected)
    + box("compile-optimize", 515, 20, "图改写与融合", "保持可观察语义", selected)
    + box("compile-source", 25, 155, "直接 Triton 程序", "从 Kernel 源码开始", selected)
    + box("compile-lower", 270, 155, "Tile 与 GPU Layout", "逻辑元素 → 线程归属", selected)
    + box("compile-codegen", 515, 155, "目标代码生成", "LLVM → PTX → 设备二进制", selected)
    + box("compile-cache", 515, 285, "缓存与加载", "复用产物 / 加载设备代码", selected)
    + box("dispatch", 760, 285, "Backend Dispatch", "为当前算子选择可用实现", selected)
    + box("kernel-execution", 760, 420, "GPU 执行", "指令、访存、同步与资源", selected)
    + `<rect x="25" y="285" width="200" height="70" rx="9" class="library-box"/><text x="39" y="313" class="node-title">预编译库 Kernel</text><text x="39" y="336" class="node-sub">无需再次经过图捕获</text><rect x="760" y="20" width="200" height="70" rx="9" class="control-box"/><text x="774" y="48" class="node-title">请求中的算子</text><text x="774" y="71" class="node-sub">Prefill / Decode 反复调用</text><text x="25" y="455" class="edge-label">NVIDIA 路径示意；手写 CUDA 使用自己的工具链。箭头不代表每次请求都重新编译。</text>`;
  return svg(b, "编译与构建路径在运行时派发处汇合", "PyTorch捕获、优化与直接Triton均可进入设备编译；预编译库跳过这些阶段。请求中的算子按条件选择实现后提交GPU。", 510);
}
