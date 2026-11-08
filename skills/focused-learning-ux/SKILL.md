---
name: focused-learning-ux
description: Design and maintain the Chinese one-question-at-a-time AI inference learning reader. Use whenever editing lesson navigation, progress, diagrams or per-topic reading experience.
---

# 专注学习界面设计规范（V1.7）

## 学习体验硬规则
1. 保持六大领域、原课程 ID 和 GitHub Pages 静态架构。**禁止靠更长的首页、更多跳转或更密集的概念图来解决“看不懂”。**
2. 进入深度专题必须直接到当前阅读位置。默认只显示当前一个问题、图解、解释、下一步；其他章节、源码/长资料和覆盖清单应按需打开。
3. **机制决定章节**：从确定的数据对象、输入输出与状态开始，按技术依赖组织问题，不固定五步、七页或四阶段。公式、源码和判断放在相关章节内按需展开，不做另一套通用关卡。
4. 每张图必须说明箭头及组件代表什么。**首选当前阶段专用小图**，复杂完整图在同页可展开，不能用无意义的流程箭头替代机制。
5. 中文优先，缩写保留英文时必须能在本页理解；段落和图的字体必须适合移动端。
6. 防止阅读进度与掌握状态混淆：旧`seenSteps/seenSubsteps`原样保留兼容；新版独立记录`mechanismReading`的章节ID和浏览集合，按该专题章节计算浏览数。标为`known`只能用户手动自评，答对一题不能自动宣告掌握。
7. 用户退出并返回后恢复最后专题、阅读步骤和机制子步骤。沿用 `ai-inference-depth-progress-v1`，历史进度 JSON 必须仍可导入。
8. 主流知识覆盖清单作为审计视图保存，但**不要在每节阅读正文前强制展示**。
9. `L3` 必须说明实现边界/张量/可能的后端，外链只为核对。`L4` 不可伪称合成情景为真实生产环境 Benchmark。
10. 全文与图形可在无外网、无 JS 包依赖的 GitHub Pages 静态页运行；绝不引入公司内网自研芯片资料。

## 新机制或课程评审
- 用 390px 和 1365px 视口检查：初始一屏有题目、核心结论和图解，不应先出现长列表；整页不得横向溢出；复杂图只能在其容器内横向滚动。
- 对机制主步骤和子步骤执行点击、返回、专题切换、进度导出/导入、暗色模式与键盘 Tab 检查。
- 不允许只用拖动参数滑块制造“实训”的感觉。练习必须要求解释一个真实机制选择或因果判断。
- 新增机制图维护`site/js/mechanism-visuals.js`与纯计算模型，章节在`mechanism-curriculum.js`逐专题编写。可复用矩阵/时间轴等绘图元件，不可复用整套通用教学步骤。
- 检查 `tests/focus-reader.test.mjs`，`node --test tests/*.test.mjs` 和浏览器中的模块切换。
