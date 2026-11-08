# AI assistant working rules

## V4 precedence — mechanism chapters (2026-11-08)

用户已明确要求整体重构，禁止把所有专题强制塞入相同五步/七页/四阶段。本节替代下文历史版本中与之冲突的页面数量和独立研究页要求。

- 默认阅读器按`mechanism-curriculum.js`的专题专属章节组织；当前问题内直接呈现对象图、必要术语、公式/实现与可核查证据。章节数量由机制依赖决定。
- 图由`mechanism-visuals.js`驱动`mechanism-models.js`的计算。颜色、格子、连线、长度须有对象或量纲含义；不靠更多文字框伪装机制。
- 六个研究实验已并入原课程；旧`research-*.html`保留兼容跳转，禁止恢复平行课程入口。
- `ai-inference-depth-progress-v1`和版本1备份协议不变。可选`mechanismReading:{version:1,last,seen}`只记录新版章节浏览；旧reader字段、completed、自评、笔记及个人图谱继续保留，不把旧浏览算成新版已读。
- 新浏览器审计是`scripts/audit-chapters.cjs`及`scripts/audit-gateways.cjs`。前者用独立浏览器合成记录核对全部章节、交互、移动端及备份；禁止加载真实私有学习快照做破坏性测试。
- 阅读`docs/mechanism-chapters-v4.md`了解实际范围；工程通过不代表完成人类学习效果验证、完整GPU实现或所有源码分支审计。

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

## V2.0 机制与公式质量门槛
- 改动深度课程时阅读 `skills/derivation-teaching/SKILL.md`。不能只追加概念、术语列表或箭头图。
- 至少一个可追踪的数据对象/状态图，以及与该对象一致的 **MathML 排版公式、变量释义、数值推导和适用边界**。
- 已完成推导的课程定义于 `site/js/mechanism-derivations.js`；保留原课程 ID 和进度存储，其他课程不得无审计被标为“完成深入教学”。
- 禁止通过未核验的数值、产品版本或虚构的真实 GPU 指令来制造深入感。所有有量纲的值需要声明单位与假设。

## Optional private learning sync

Read `skills/cloud-sync-security/SKILL.md` and `docs/cloud-sync-setup.md` before touching cloud sync. A cloud API is **not** live until user has deployed Worker, created a Private GitHub repo, and configured OAuth/secrets. The public website must remain usable offline; never expose a GitHub PAT in static assets.

## V2.2 深度源码导读验收
- 按 `skills/code-tour-authoring/SKILL.md` 维护。所有深度专题的 L3 都必须有本页可读的执行骨架、阶段代码、真实输入输出和变量定义；原六大模块和稳定 ID 不可更改。
- 用 `validateCodeTours(depthTopics.map(t=>t.id))` 核对所有专题覆盖。伪代码必须声明为教学抽象，不得将自造函数名当作源码 API 或微架构 RTL。
- 外部资料用于版本核查，不能替代页面内的解释；电脑与手机都必须能点击阶段并正确联动。验证 `npm test`，保留私人云同步与原进度。


## Research-first prototype policy (2026-11-08)
Before expanding other lessons, read `skills/research-lesson/SKILL.md` and `docs/research-course-notes.md`. Do not turn a conceptual node into a generic template and call it deep. Preserve the two prototypes in `site/research-labs.html`, verify every calculation against `site/js/research-models.js`, and keep IR snippets explicitly marked as illustrations unless built from a real captured dump. Browser progress and private cloud synchronization must remain unchanged by entering/leaving the research pages.


## V3 全站机制课程维护

默认阅读器使用 `course-notes.js`、`course-models.js`、`course-assessments.js`、`course-reader.js`。先阅读 `docs/course-refactor-audit.md`，保留逐节点未覆盖范围。每个模型必须有可观察的双条件差异和数学/状态不变量；不可仅靠字段数量验收。原专用研究页、旧资料模式和全部学习存储继续保留。新模型不得写localStorage、调用同步服务或将自评升级为课程质量认证。浏览器脚本使用独立上下文及合成笔记；不得拿真实用户学习数据做破坏性测试。
