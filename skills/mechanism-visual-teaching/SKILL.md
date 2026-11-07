---
name: mechanism-visual-teaching
description: Maintain mechanism-first, diagram-rich Chinese learning experiences for PD disaggregation, vLLM scheduling, compiler lowering, FlashAttention and GPU warp scheduling.
---

# 机制图解课程维护规则

## 目标与顺序

1. 先写 **是什么（对象、输入、输出、状态）**，再给内部机制与分步图。不能只写价值、优化动机。
2. 每一步必须呈现：输入 `in`、执行 `do`、输出 `out`、必要性 `why`、易错点 `trap`。
3. 每个重点专题至少两种有教学意义的视角，不重复复制同一流程：可分别是数据/控制、显式/融合、预算/状态、在线统计/完整矩阵、发射槽/依赖链。
4. 图上的箭头代表真实的数据或控制依赖，标明教学简化的边界，不能暗示所有阶段严格串行。
5. 技术词第一次出现需解释中文含义；核心解释必须在网页可见，源码链接作为核实材料。
6. 把抽象机制落地为一个可计算、可追踪的例子；答案反馈要解释**为什么**，而不是显示“正确/错误”两个字。
7. 不因“多配图”而塞入与课题无关的图片；优先原创 HTML/CSS/SVG 图，使用第三方开源图时先检查许可证、来源和适用版本，并写清图中读者需关注的位置。

## 关键正确性检查

- **PD**：P/D 是分不同实例的阶段，不是按模型层切分；不同 KV Connector 可以重叠传输，需区分控制面/数据面。
- **Scheduler**：教学轮次保持 Token Budget 守恒，注明“资源充足/未考虑抢占”等前提；调度器和 Model Runner 不是一回事。
- **Compiler**：Dynamo/FX→Inductor/Triton 是可能路径，允许 Graph Break 与库调用；编译期不等于运行期；PTX 不等于 SASS。
- **FlashAttention**：维护每个 Query 行的 m/l/a，跨块最大值变更时 rescale；和参考 Softmax 数值比对；不得声称稠密 Attention 复杂度降成 O(S)。
- **Warp**：区分 Active、Eligible、Issued 与 Not Selected；人工周期不是 B200 硬件模拟；不能直接把 Stall 率当作时间占比。

## 维护流程

1. 修改 `site/js/mechanism-studio.js` 中对应的对象、图和阶段。
2. 与 `site/js/visual-atlas.js` 的概览图衔接，并检查 `site/js/depth.js` 的交互入口。
3. `npm test`：尤其 `tests/mechanism-studio.test.mjs` 的 FlashAttention 数值和调度预算测试。
4. 在 Chromium 检查所有按钮（步骤/视角/答案）和中文可读性；桌面与 390px 手机视口都要检查整页溢出。
5. 若现场浏览器导航受限，明确记录这种局限，不能把组件测试说成完整线上回归。
6. 公开仓库绝不上传公司内网设计、参数、日志、性能数据。


## 新图质量门槛（V1.9）

旧版只是“描述某环节为什么有价值”的图，不应当简单复制。新增机制图必须给出变量字典、数值或状态变化、可推理的问题、教学假设与原课程回链。内容写入 `site/js/mechanism-gallery.js`，通过 `tests/mechanism-gallery.test.mjs` 校验。
