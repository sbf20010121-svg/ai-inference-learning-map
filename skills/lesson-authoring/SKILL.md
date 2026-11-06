---
name: lesson-authoring
description: Create or revise graph-first, interactive Chinese lessons on AI inference, GPU execution, robotics VLA and world models within this repository. Use when a topic is added or teaching content is updated.
---

# Graph-first lesson authoring

## Goal
Turn one technical question into a reliable, intuitive, interactive lesson connected to the wider inference architecture. Do not produce a dense article.

## Procedure
1. Define **one observable ability** the learner should gain. Start with what the learner knows (vLLM, Triton, Kernel Profiling) and what is unfamiliar.
2. If relevant, connect the lesson to an example scenario and a Chinese glossary entry in `site/js/journeys.js`. Place the lesson in one of six existing modules (`model`, `engine`, `compiler`, `kernel`, `systems`, `microarch`). Select 2–4 related lessons as links.
3. Prepare a concise analogy **and its limitation**. In the first screen show the system boundary and what the topic does in real execution.
4. Author a 4–6 stage technical flow. For every stage document: `title`, `sub`, **why it exists** (`why`), and **how to observe or test it** (`see`). Stage captions must correspond to real execution concepts rather than decoration.
5. Add two evidence-aware key judgments (`points`). Cover common confusion, architecture-specific differences or bottleneck counterexamples.
6. Add a mechanism-based, nontrivial quiz: 3 plausible choices, 1 defensible best answer, explanatory feedback. No trivia-only questions.
7. Link primary docs and repos (`refs`); do not invent citations, measurements, GPU specs or function names. Mark assumed example numbers explicitly as **教学假设 / 示意**.
8. Add to `lessons` and `edges` in `site/js/content.js`, choose positions avoiding node overlap, run tests and browser checks.

## Style
- Chinese explanations, precise technical terms retained in English when useful.
- Put formulas, tensors, graphs and user-adjustable variables into working interactions when they clarify a mechanism.
- Separate **model math**, **compiler/lowering**, **runtime scheduling**, **GPU hardware**; identify data flow vs control flow.
- Distinguish VLA action token, Action Chunk, iterative Flow Matching, RL training, world-model prediction. They are not interchangeable.
- Avoid requiring full ROS / control courses for inference-focused study.

## Output checklist
`goals`, `steps`, `analogy`, `takeaway`, `quiz`, `points`, `related`, `refs` are meaningful and accurate; an existing lesson ID has not changed; mobile interaction is still usable.


## V1.3 深度课程扩展规则（重要）

现有 4–6 阶段流程仅是 **L1 入口**，不代表完整技术课程。给核心节点扩展纵深时遵守：
1. **不能只增加术语/流程节点**：每节深度课先回答一个具体机制问题，标明必要前置与对应 L1 节点。
2. **L2 机制**：拆成组件、状态、数据结构和交互；明确控制流 vs 数据流；有公式时解释物理含义与假设条件。至少一种可以逐步展开的图。
3. **L3 实现**：选择可以公开访问的仓库/固定版本；给可核实的路径、类或函数定位及关键 Shape，标注属于哪个版本；从模型/框架一路追踪到库 Kernel、自定义 CUDA/Triton 或编译路径，不能假定只有一条实现。
4. **L4 验证**：至少一个可以重复的性能实验计划，含硬件、软件版本、Shape、dtype、warmup、同步方法、对照组、正确性和时间指标；无法执行时不能编造 Benchmark 结果。
5. **设计交互**：参数滑块、分步数据流、时间线或状态机必须展示所用假设；用户可以返回父节点、对比机制选项、跳转相关模块。
6. **掌握程度**：考的是具体推理能力，例如根据运行轨迹定位瓶颈，而非只考缩写。保留“暂时跳过 / 以后再学”。
7. **分层授权**：普通用户只看 L1/L2；想深入时展开 L3/L4；保留原六大领域和现有 lesson ID，避免课程和进度失效。
8. **版本和安全**：vLLM、PyTorch、CUDA 等演进迅速，按版本引用一手资料；绝不纳入任何私有自研芯片资料。
9. **优先纵深路径**：模型算子、vLLM 高级调度及 PD 分离、编译器路径、GPU Kernel 与微架构、机器人 VLA、世界模型。详细计划见 `docs/roadmap.md`。
