---
name: code-tour-authoring
description: Author and audit in-page source-oriented pseudocode walkthroughs linked to real AI inference, compiler, kernel, system and GPU microarchitecture mechanisms. Use for all deep-topic L3 changes.
---

# 源码导读：在页面里把机制讲清楚

- 保留原六大领域及原 `depthTopics` ID。只把与学习有关的实现骨干放进 L3，不能以大量代码遮住 L1/L2 图解。
- 选 3–5 个该主题专属的计算/状态阶段。每段必须有：**执行者/模块、输入对象、执行改变、输出对象、为什么存在、2–5 行可读的伪代码**。不能复制粘贴同一段通用模板。
- 代码中的每个关键缩写就地解释，明确张量 shape、类型、数据流、控制流、内存空间；示例给出量纲。必要时加公式/内存 Tile/时间线，而不是装饰箭头。
- **显式标注“原创教学伪代码”，函数名不是实际项目 API**。固定版本真实源码的链接单独列出；未经核验不得声称某个类/函数/Kernel 一定存在。
- 原来简洁的「先看懂/运行机制/具体例子」不挪动。源码页面用阶段选择联动代码与输入输出，移动端仅显示当前阶段，其余内容不自动展开。
- 注意架构差异：MLIR ≠ LLVM IR；PTX ≠ SASS；EP ≠ TP；All-to-All 不一定是每个 MoE 后端显式独立调用；世界模型与动作控制不同；微架构不可伪称内部 RTL。
- 来源优先真实开源文档/代码，避免照搬第三方长代码；正确性来源还包括原始论文及厂商指导。
- 任何新增/删除主题必须更新 `codeTours`，`validateCodeTours(depthTopics.map(t=>t.id))` 为硬门槛。运行 `npm test`，核对桌面和手机交互、键盘焦点、进度恢复和个人笔记同步兼容性。
- 公开仓库不得出现内网芯片文档、个人学习笔记或任何 Secret。
