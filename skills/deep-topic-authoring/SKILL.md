---
name: deep-topic-authoring
description: Add or extend L2-L4 Chinese interactive AI inference deep-dive lessons while preserving the existing six-module AI learning map. Use for architecture/source/performance topics.
---

# Deep topic authoring

## Keep the original map
- **Never alter top-level six modules** or old lesson IDs to make room for deep topics.
- Add L2–L4 into `site/js/depth-content.js`; link each deep topic to a real L1 parent ID.
- If a topic crosses modules, add a `related` edge with a reason. Put it in a path only if this makes the learning chain clearer.
- Preserve progress versioning. The existing L1 localStorage key remains unchanged.

## L2 — visual mechanisms
- Ask one observable mechanism question, not just “What is X?”.
- Use 4 interactive steps, each with data in/out, the control/compute mechanism, what to measure, and a plausible misconception.
- Be explicit about boundary conditions and non-universal behavior; architecture drawings are conceptual unless specifically sourced.
- Prefer Chinese explanations and explain acronyms at first use.

## L3 — verifiable implementation
- Link original documentation/source to architecture or code paths, indicating when path is an illustrative entry point rather than pinned exact implementation.
- Distinguish Scheduler, Worker, Model Runner, CUDA Runtime, compiler/lowering and hardware pipelines.
- Describe actual tensor shape, execution boundaries and data movement. Do not invent specific function names, line numbers or benchmark figures.
- User is not a vLLM beginner; focus on deeper tradeoffs rather than repeating L1.

## L4 — real reasoning and reproducibility
- Every proposed performance experiment names the target, controlled variables, metrics and validity constraints.
- Slider models in `site/js/depth.js` must state assumptions, units, non-overlap or reuse caveats as applicable, and expose testable calculations (not performance claims).
- Validate formula with deterministic Node tests and compare with one independent calculation.
- Include a mechanism-based 3-choice question with a defensible answer and explanation.
- Do not equate numerical correctness with model or robot task quality: assess output parity, stability, P99 and task-level success when relevant.

## Security and QA
- No confidential internal GPU specs, software, company-internal model logs or inferred private benchmark numbers in the public repository.
- Verify public claims against official CUDA/PyTorch/vLLM/NVIDIA/HuggingFace documentation at the time of change. Avoid unversioned path claims without caveat.
- Run `npm test`, exercise L1→L2 navigation, L2 stepper, L3 links, L4 calculator, dark mode, mobile overflow, progress export/import.
- Maintain `AGENTS.md`, this skill, README and the roadmap whenever expanding depth coverage or schema.

## V1.4 expansion pattern
- For a new subject, first find its entry in `site/js/coverage.js`, then choose whether it deserves its own L2-L4 topic (`site/js/depth-extra.js`) or an explicit partial-coverage label (`~topic-id`). Do not label an unbuilt lesson as covered.
- Every `depth-extra.js` topic must include `parent`, `module`, `stage`, `insights`, `traces`, `experiment`, `quiz`, `refs`, `related`; links and related IDs must be valid. Include `depth-extra.js` in the test schema and preserve legacy IDs.
- An L3 documentation pointer is only an *investigation entry point*, not a claim to have verified current code paths/Kernel mappings. Pinned-version source paths, data shapes and real execution evidence must be added separately before claiming source-level completeness.
- For interactive work, prefer `site/js/reasoning.js` replayable evidence cases (decision → observable process → counterfactual → controlled experiment) over numerical sliders. Label all constructed traces and time units as teaching assumptions.


## V1.5 必须在页面内完成教学（不靠外链）

- 先审阅 `site/js/visual-knowledge.js` 中该专题的核心结论、5 步数据链、具体 Shape/运行例子、两种方案的收益/代价、三条记忆点。
- 若主题有不同的控制与数据路径，在 `site/js/visual-lanes.js` 编写真实且可解释的双泳道图；不要将 Shared Memory 表述为自动缓存链路，也不要将 PD 分离表述为按层切分模型。
- 图是为了揭示机制与数据依赖，不是为了装饰。核对图中每条箭头的语义以及例子涉及的假设。
- L3 使用 `inlineImplementation` 将模块职责、输入输出与性能观察在页面里讲完；源码/官方链接作为可展开的核验材料，不可取代讲解。
- L4 不得把数学玩具模型的数值称为 GPU 实测。保留受控实验和数值正确性验证。
- 每次运行 `npm test` 并用桌面/移动端验证：架构图节点可点、能键盘激活、整页不横向溢出、改变专题不丢失旧进度。
