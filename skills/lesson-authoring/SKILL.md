---
name: lesson-authoring
description: Create or revise graph-first, interactive Chinese lessons on AI inference, GPU execution, robotics VLA and world models within this repository. Use when a topic is added or teaching content is updated.
---

> V5维护先读AGENTS.md的V5优先规则及docs/curriculum-system-v5.md；新独立课使用统一course-registry与foundation模块，历史25门专用字段检查只适用于旧课。

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

## V1.3 complementary skills

The original `lessons` entries remain stable L1 gateways. Add deeper work into `site/js/depth-content.js` and follow `skills/deep-topic-authoring/SKILL.md`. Never turn the L1 SVG into a crowded 19+ topic spiderweb. Every deeper item needs one clear question, an actual mechanism, a verifiable public source, and an experiment that separates assumptions from measurements. Existing L1 progress must not be reset.


### V1.5 追加：图解与记忆优先

现有 L1 概览仍然保留，但用户进入核心 L2/L3 节点后必须能在本页看到完整的关键讲解：系统位置图、机制分步图、比较取舍图、张量/执行例子和三点总结。不得让用户必须跳转外部文档才能得到基本机制。外部资料仍用于核实细节。交互必须揭示数据流、控制流或不同配置下的因果差异，而不是只有倍数变化。
