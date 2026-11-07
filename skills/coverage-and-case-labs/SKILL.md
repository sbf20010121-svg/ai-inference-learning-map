---
name: coverage-and-case-labs
description: Maintain the mainstream AI inference/GPU knowledge coverage audit and decision-based interactive labs. Use for curriculum coverage, simulated traces, and learner decision exercises.
---

# 课程覆盖审计与证据实训

1. 不改六大顶层模块或已有课程 ID。新增知识点先加入 `site/js/coverage.js`：P0 常用必学，P1 高频专项，P2 按需。没有独立机制课的绝不能假称“已覆盖”；相邻课涉及用 `~topicID`，否则留空。
2. 优先做 **可解释的具体问题**：先给现实症状/假设，要求学习者作决策，再展示可重放的流程、真实数学推导、证据和反例。没有认知任务的参数滑块只能算“数量级辅助工具”。
3. 静态模拟必须明确假设、单位、哪些真实机制被省略。特别注意 vLLM 的请求调度、KV、Batch、网络、Cache 与计算时间之间的关系。不要把教学轮次直接叫作 GPU 时间，也不要宣称有真实硬件实测。
4. 设计诊断时，区分“症状”“瓶颈假设”“根因证据”；任何一个 NCU Stall、Occupancy 或 L2 Hit 都不足以单独证明性能瓶颈。
5. 模型优化还要检查输出正确性/任务质量；VLA 不能把推理 Hz 当作控制频率，动作块与异步推理有反应延迟代价。
6. 内容使用中文，标明关键英文技术词、数据流与控制流、先修课程、公开一手资料；更新 `docs/roadmap.md` 和必要的课程关联。
7. 验证方法：`npm test`，检查各状态统计、L1→深度课、情境按钮、结果反馈、深浅色和手机滚动。若浏览器自动化不可用，如实记录，不声明“实测通过”。
