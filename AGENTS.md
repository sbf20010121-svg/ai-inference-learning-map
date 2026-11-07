# AI assistant working rules

Before changing code, read this file and the skill that matches the task in `skills/`.

1. **Keep the V1.1 six-module taxonomy intact.** Never redesign the learning taxonomy without explicit user instruction. Preserve six top-level modules: model, engine, compiler, kernel, systems, microarch. vLLM is already familiar to the learner. Add depth through connections and examples rather than re-teaching basics.
2. **Visual and interactive first.** A knowledge node should teach by workflow diagram, progressive disclosure, real case, then quiz. Do not replace usable diagrams with paragraphs or decoration.
3. **Separate public and internal.** Public Blackwell microarchitecture sources are allowed. **Never** request, transmit, paraphrase, or commit confidential in-house GPU details, proprietary cmodel/amodel specs, internal benchmarks or code; internal cross-comparison stays in the company environment.
4. **Source and uncertainty.** Prefer vendor documentation and original papers/repos. Distinguish hardware facts, architecture-specific implementations, illustrative assumptions, and measured numbers. No invented benchmarks or paths.
5. **Update content before framework.** Course contents live in `site/js/content.js` and scene journeys, human-friendly relation explanations, glossary in `site/js/journeys.js`; preserve stable IDs to keep user progress. Each new link must say why it connects. Extend UI only when it improves learning.
6. **Protect progress compatibility.** localStorage schema is `ai-inference-map-v1-progress`. A breaking schema change needs documented migration and testing. Never automatically overwrite or share private notes.
7. **Quality gate.** `npm test`, review on desktop and mobile viewport, test keyboard navigation, zoom, quiz, dark mode, and JSON import/export. The site must work as static GitHub Pages without app server.
8. **No blind skill installation.** Inspect upstream `SKILL.md`, licenses, scripts, permissions and network behavior before installing or vendoring external skills. Record provenance in `docs/skills-sources.md`.

Task-specific skills:
- New lesson or diagram: `skills/lesson-authoring/SKILL.md`
- Navigation graph, IDs, releases: `skills/knowledge-map-maintenance/SKILL.md`
- Technical review / NCU / model claims: `skills/technical-review/SKILL.md`
- Web UI audit: `skills/interface-audit/SKILL.md`

9. **Chinese-first and scenario-first.** Every important term must have a short Chinese explanation. Start the user with LLM/VLA/world-model scenarios, then the simplified graph, then detailed nodes. Verify mobile defaults to six modules, not a 16-item wall of cards.

10. **V1.3 deep topics:** Keep original L1 IDs, and build L2–L4 as a separate, linked drill-down atlas. Read `skills/deep-topic-authoring/SKILL.md` before changing `site/js/depth-content.js` or interactive calculators. Depth pages must cite primary docs and label all computed examples as educational, not measured. Preserve existing browser progress export/import compatibility.

11. **V1.4 coverage and active reasoning labs:** Read `skills/coverage-and-case-labs/SKILL.md` before touching `site/js/coverage.js`, `site/js/coverage-ui.js` or `site/js/reasoning.js`. A drag slider doing trivial arithmetic is not sufficient as a lesson: ask for a prediction, show observable control/data flow, require a diagnosis or action, then give evidence and counterexamples. Label any synthetic timing and scheduler as a teaching abstraction, never a benchmark. Audit every important new topic against the original six-module map, and report missing/partial/covered separately.


## V1.5 / 原位可学的核心验收标准

- 重要机制的**主要知识必须直接呈现在该专题页面**：一句话、系统位置、步骤/数据流、权衡、实例、反例和自测。不要把“去看链接”当作完整课程。
- 增补课程时同步编辑 `site/js/visual-knowledge.js`；跨控制/数据层的高价值专题同步审阅 `site/js/visual-lanes.js`。禁止为凑图数添加没有真实含义的拓扑。
- 交互图的点击必须改变可读的讲解；移动端允许局部横向滚动，但整页不得产生水平溢出。
- 公开资料链接放到具体实现追踪后的可选区域；仍需保证来源可靠、版本可核实。
- 继续保留本地进度键 `ai-inference-depth-progress-v1`，不得在用户不知情时清空或自动公开笔记。


## V1.6 / 可交互机制图教学规范

- 重点教程必须先说明该机制**是什么、输入、输出和内部状态**，再解释为什么需要与性能代价。只画带箭头的框不能作为机制解释完成的证据。
- 阅读并遵循 `skills/mechanism-visual-teaching/SKILL.md`，五节重点原位图见 `site/js/mechanism-studio.js` 和 `site/mechanism-studio.css`；保留旧 `visualHTML` 与 L1 入口。
- 修改在线 Softmax 演示时验证分块更新结果与直接 Softmax 数值一致；修改 Scheduler 必须核算每轮 Token Budget；修改 Warp 示例必须明确人工周期及 Active/Eligible/Issued 边界。
- 所有按钮要真的切换可读步骤/视图/反馈，不得制造仅装饰的交互；移动端容许内部滚动，不得整页水平溢出。


## V1.7 Reader UX precedence

The previous tall reference page is **opt-in**. The normal learning mode must remain focused: one core question per view, stage-specific small mechanism figure, clear forward/back controls, and reliable “viewed vs understood” progress. Read `skills/focused-learning-ux/SKILL.md` before any UX change. Preserve all old topic IDs and existing progress. Never restore the stack of overview banner + coverage list + route cards + catalogue ahead of the lesson.

## V1.8 Semantic graph and meaningful visual diagrams

- Read `skills/semantic-visualization/SKILL.md`, `docs/diagram-design-standards.md` and `docs/knowledge-graph-contribution.md` before adding diagrams or new graph edges. Avoid generic boxes with arrows.
- Six original modules and all curated topic IDs are immutable. The semantic graph adds typed, explained relationships and user insight nodes without rewriting official course data.
- All personal insight updates remain browser-local unless explicitly exported and reviewed. Never transmit or publish internal-chip information.
- Existing progress export format includes optional `knowledgeGraph`; legacy progress imports must still work.
- Validate KV block contents, refcounts/allocations and online-softmax invariants. Browser screenshots for desktop/mobile; do not present these teaching mechanisms as actual production runtimes.
