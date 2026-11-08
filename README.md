## 第二批研究型课程（2026-11-08 · 分批重构中）

在原有六大领域、课程节点和进度记录不变的前提下，新增四节[以机制状态为核心的研究课](site/research-expansion.html)：[vLLM Scheduler](site/research-expansion.html?topic=scheduler)、[MoE / EP](site/research-expansion.html?topic=moe)、[FlashAttention](site/research-expansion.html?topic=flash)、[VLA 异步推理](site/research-expansion.html?topic=vla)。

四节均具有可重放对象/数据图、就地术语解释、公式、伪代码与“条件改变后判断”的练习。与第一批 [Gated DeltaNet / Triton](site/research-labs.html) 形成六条研究型链路。其余课程仍需按相同标准逐个深化，不能把导航、伪代码概览计入研究完成。详细假设、核对来源和边界在 [docs/research-expansion.md](docs/research-expansion.md)。

**此处的数值/时间线为教学模型，未声称有 vLLM 生产 Trace、B200 实测或真实机器人控制实验；个人学习笔记继续只存私有仓库。**

---

## 研究型课程样板（2026-11-08，先验证质量再扩展）

新页面：[线性注意力 Gated DeltaNet](site/research-labs.html?topic=linear) / [Triton 编译与 IR](site/research-labs.html?topic=compiler)。已直接从旧课程 `linear-state` 与 `compiler-lowering` 进入；**六大模块、原课程 ID 和进度不变**。

本次从论文/官方源码研究、建立数学模型开始，再实现能看到真实对象和中间状态的图：
- Gated DeltaNet：逐 Token 预测/残差/写入状态矩阵；对比直接累加；验证两个 Token 的仿射 Chunk 组合；对应 FLA 实现。
- Triton：N=10 的 Program/Mask、TTIR/TTGIR/LLVM IR/PTX 的不同信息、算子融合对中间数据写回的改变；真实源码和 IR 必须按固定版本核对。

**质量说明：** 数学不变量和本地 Chromium 桌面/手机交互已检查，非 GPU 实测；页面中的 IR 字句为结构性示意，非目标 GPU 的真实汇编。新内容需继续采用 `skills/research-lesson/SKILL.md` 的 source-first 质量标准。研究依据与边界见 `docs/research-course-notes.md`。

---


## V1.9：用可操作的状态图理解机制 + 就地解释变量

「知识网络」中的 **机制实验** 下拉菜单现在可以选择 10 个场景：原有的 Paged KV 内存映射、Online Softmax，以及新增的 vLLM Token Budget、PD KV 交接、算子融合、Warp 依赖时间线、Warp 合并访存、MoE Top-2 Dispatch、VLA Flow Matching、世界模型时空 Token。

每个新图都有：**变化中的对象/数值 → 当前步骤中文解释 → 变量和单位字典 → 自己预测与反馈 → 教学边界/官方资料**。变量解释直接在页面内，不需要到外链里查；所有图都能跳回对应的深度课程和知识关系节点。移动端采用重新排布或局部滚动，避免将宽图压缩为不可读的小字。

这些图仅是说明机制的可检查教学模型，不是 vLLM 完整调度器、GPU 真实内存事务、B200 周期模型，也不是实际训练好的 VLA/世界模型推理结果。**不要将教学输出解释为真实性能数据。**

更新核心文件：`site/js/mechanism-gallery.js`（纯计算 + 术语 + 渲染）、`site/mechanism-gallery.css`、`tests/mechanism-gallery.test.mjs`。维护时先阅读 `skills/semantic-visualization/SKILL.md`。

# AI 推理技术地图 · V1.4（覆盖审计 + 机制实训）

## V1.8：真正可生长的知识网络与机制图样板

- 新入口 **「知识网络」**：以已有 25 个稳定专题为基础，建立明确类型、连接原因和方向的知识关联（避免静态全图毛线团）。
- 可以将自己的新理解作为节点连接到旧知识，记录来源、验证状态，并允许修改/删除。个人记录保存在浏览器本地，纳入原进度导出/导入；**不会自动同步 GitHub**。
- **Paged KV Cache** 可交互内存映射图：逻辑块 → Block Table → 非连续物理块；重放新请求、共享前缀、追加 Token、释放和重用。
- **在线 Softmax** 数值图：逐 Tile 更新 m、l、a，核对最终结果与标准 Softmax 一致。
- 配套原创 Skill、图形来源、技术不变量测试和桌面/移动端浏览器检查。
- 质量范围：目前是 2 个具体机制的样板，并非全部 25 节都达到同等质量；不伪称有真实 GPU Benchmark。

详见 [`docs/diagram-design-standards.md`](docs/diagram-design-standards.md)、[`docs/knowledge-graph-contribution.md`](docs/knowledge-graph-contribution.md)。


一张能够探索、点击与学习的中文 AI 推理技术知识地图：**模型 → 推理系统 → 编译 / Runtime → GPU Kernel → 微架构**，同时保留 **OS / 分布式基础**，以 **机器人 VLA / 世界模型**作为重点拓展领域。

> 目标是“先串起知识，再选择方向深入”，不是从零把 vLLM 和 CUDA 基础重新学一遍。

## V1.3 新增：可直接学习的深度图谱

保持 V1.1/V1.2 的六大模块、10 节 L1 概览课及三个场景不变；在顶部新增 **「深度图谱」** 标签，可直接进入二级、三级机制与源码页面。当前包含：

- **19 个深度专题**：LLM 的 Transformer/MoE、vLLM Scheduler/KV/PD 分离/SLO、PyTorch/Triton/CUDA、GEMM/FlashAttention/Profiling、操作系统与多卡通信、B200 微架构、机器人 VLA、世界模型。
- **4 条跨领域学习路径**：「LLM 到 GPU」「PD 分离与部署」「GPU Kernel 与 B200」「机器人推理与世界模型」。路径中的每一步可点选并深入。
- **L2 / L3 / L4 可选层次**：L2 点击机制图理解控制流/数据流；L3 查官方代码或技术资料并掌握实际执行路径；L4 可调数学模型并学习如何公平设计实验。13 个专题有可调的小实验，其余提供实验设计但不冒充已有实测。
- **知识关系显式解释**：从一个专题跳到关联专题时，会解释它们为何相连。L1 课程也可跳转对应的深度专题，不影响原来的学习进度。
- **数据与显示分离**：深层课程在 `site/js/depth-content.js`，交互组件与计算器在 `site/js/depth.js`，样式在 `site/depth.css`。
- **进度**：L1 和深度专题各自记录学习状态，统一通过页面顶部的 JSON 导出 / 导入备份。进度仍只存本地浏览器。

这些深度专题不是行业所有主题的穷尽。L3 已提供可核查的入口和机制分析，不等于已经完成所有框架版本下的逐函数源码审计；L4 教学计算不是设备实测。建议先由用户实际学习，再补关键专题的源码行级追踪与真实 Benchmark。

## 现在可以做什么

**推荐从首页的「情境导览」开始**：先切换 LLM 推理 / 机器人 VLA / 世界模型，再点击执行环节，直观看到它负责什么、涉及哪些计算、应该观察哪些指标，随后进入对应课程。

- **两级知识关系图**：默认简洁图只显示 6 大模块的核心主线，必要时切换「全部课程」显示 10 节课程；支持缩放、拖动、搜索、关联跳转。
- **三种交互场景**：LLM 推理、机器人 VLA、世界模型。每一步解释“做什么、用哪些技术、看哪些性能指标”，一键跳到知识节点。
- **术语速查**：点击展开中文解释，并能跳到对应课程。
- **以图带学**：每节课程通过可点击的分步执行链路讲解，并明确对应的性能观察指标。
- **理解检验**：每节 1 道机制判断题，附具体解析。
- **可交互的小实验**：局部 Kernel 加速与端到端收益、VLA 迭代耗时、Prefill / Decode 形状比较、Warp 等待与切换。
- **进度 / 笔记**：未开始、学习中、已理解、待验证；自动保存到浏览器 `localStorage`，提供 JSON 导入 / 导出。
- **移动端与深色模式**：小屏展示课程索引，避免把整个复杂 SVG 缩成无法阅读的小图。
- **无需服务器和账号**：纯静态 HTML / CSS / JavaScript，无第三方依赖、无需数据库或常驻云电脑。

## 本地预览

需要 Python 3（或任何静态文件服务程序）：

```bash
python3 -m http.server 5173 -d site
# 然后访问 http://localhost:5173
```

已经安装 Node.js 的话可以运行：

```bash
npm run dev
npm test
```

请使用 HTTP 服务器预览，不建议直接用 `file://` 打开 ES Module 页面。

## GitHub Pages 部署

仓库提供 `.github/workflows/deploy.yml`：每次推送到 `main` 分支，先运行内容校验，然后将 `site/` 目录部署为 GitHub Pages 网站。

1. 创建 GitHub 仓库（建议 `ai-inference-learning-map`）。
2. 将本项目的文件推送到仓库 `main`。
3. 打开仓库 **Settings → Pages → Build and deployment**，把 **Source** 设置为 **GitHub Actions**。
4. 检查仓库 **Actions** 页面是否部署成功。
5. 网站地址通常为 `https://<GitHub 用户名>.github.io/ai-inference-learning-map/`，但**以 GitHub 实际显示的地址为准**。

注意：GitHub Pages 内容可能公开访问。**不得将公司内网资料、未授权代码、架构参数、指标或账号秘密写入网站或仓库**。

## 仓库结构

```text
site/
  index.html             # UI 布局
  styles.css             # 原有知识地图的视觉设计
  depth.css              # 深度课程和响应式交互
  audit.css              # 知识覆盖审计样式
  reasoning.css          # 机制推理和执行重放样式
  js/
    app.js               # 原有图谱、场景交互、进度与练习
    depth.js             # 深度学习页、参数实验和知识串联
    depth-content.js     # 原有深度专题及相关联知识结构
    depth-extra.js       # 六个新增长链路专题：MTP、量化、融合、MLA、线性注意力、框架对比
    coverage.js          # 77 项主流知识点覆盖审计（不等于完整精通）
    coverage-ui.js       # 覆盖状态和知识缺口筛选
    reasoning.js         # 五类决策与过程重放式学习实训
    journeys.js          # 三种典型场景、中文术语、模块与知识关系
    content.js           # 课程内容与关联关系（主要维护入口）
skills/
  lesson-authoring/      # 新课程：用图而不是堆文字
  deep-topic-authoring/  # 深度专题的技术正确性与参数实验规范
  knowledge-map-maintenance/  # 保留体系、增量更新、图结构校验
  technical-review/      # 证据链 / 技术正确性
  interface-audit/       # 交互与可访问性检查
docs/
  skills-sources.md      # 参考的上游 Skills 及版本维护方式
  roadmap.md             # 下一步开发与课程扩充
.github/workflows/deploy.yml
AGENTS.md                # AI 助手更新此仓库的执行约定
tests/                   # 内容结构和链接检查
```

## 如何新增一节课程

1. 先读 `AGENTS.md` 与 `skills/lesson-authoring/SKILL.md`。
2. 在 `site/js/content.js` 的 `lessons` 数组里新增一个对象，提供目标、类比、步骤、关键判断、测验、官方资料。需要用场景串起新内容时，在 `site/js/journeys.js` 更新对应场景、关系说明或术语。
3. 为新课程设置 `module`、图谱位置 `x,y`，在 `edges` 里增加必要的关联。
4. `npm test` 验证结构；用桌面和手机浏览器手动检查图谱、流程图和进度状态。
5. 写明来源与验证状态。没有运行过的 Benchmark 必须标注为示意而不是实测。

## 数据与隐私

- 学习状态、笔记、测验结果只在当前浏览器 `localStorage` 中；**不会自动同步到 GitHub 或其他设备**。
- 点击“导出进度”可以保存 JSON，其他浏览器通过“导入”恢复。
- 本站没有账号系统、云同步、分析埋点或后端 API。
- “自研芯片微架构”在网站中仅作为学习主题，详细内容由用户在内网独立维护。

## 内容范围与限制

目前包含 10 节概览课、25 个深度专题、4 条跨领域路径和 3 个交互场景，仍不是覆盖所有架构与版本的百科全书。课程中的耗时滑块是**数学示意**而不是某型号 GPU / 机器人模型的实测结果；模型与编译链路图是**抽象框图**，实际执行路径依赖代码版本和配置。

源代码采用 MIT License。参照的第三方 Agent Skills 见 `docs/skills-sources.md`：本仓库仅存放原创、针对项目的 Skill，不直接复制未经核查许可的第三方内容。

## V1.2 的设计原则

先用真实推理场景建立因果链，再看六大知识领域；图谱上的系统基础是贯穿各层的支撑，不是模型请求必须依次经过的第六道工序。课程关联必须写明“为什么关联”，不能只给超链接。界面文本以中文为主，保留准确的专业缩写并在术语速查中解释。

## V1.3 内容维护

现有六大顶层模块不得重排。新技术先判断属于哪个模块，再按 `skills/deep-topic-authoring/SKILL.md` 维护 `site/js/depth-content.js`。保持每个专题的 L2 机制图、L3 公开证据、L4 优化验证三层结构；不能将数学示例标成实测数据。提交前必须运行 `npm test` 并检查桌面/移动端的实际交互。

### V1.4：覆盖审计与证据实训（首批已集成）

在「深度图谱」顶部可以展开主流知识覆盖审计，按优先级/领域/课程建设状态筛选；目录中“有机制课”并不等于已验证或学会。L4 已为 PD 分离、vLLM 调度、Profiling、编译融合、VLA 动作块加入五类决策与执行重放案例。全部为公开知识与合成教学数据，没有公司内部资料，也没有真实 B200 性能数据。旧滑块仅作为可选公式辅助工具。维护规范见 `skills/coverage-and-case-labs/SKILL.md`。


### V1.4 后续补强：六条高频技术链路（已集成）

- `site/js/depth-extra.js` 新增六个 L2–L4 机制专题：**推测解码/MTP、量化部署与 FP8/FP4、RMSNorm/RoPE/SwiGLU 融合、MLA、线性注意力/SSM、推理框架对比**，并接入原六大模块与覆盖审计。
- 77 个核查项中当前 **47 已有机制课、24 部分涉及、6 尚缺独立专题**；已建课程并非已经完成固定版本代码逐行审计或真实 GPU 性能测量。
- 目前未建深度课的方向包括采样/Top-p、3D 点云、TensorRT/ONNX Engine、Gather/Scatter、容器部署及功耗稳定性。虽然列入清单，但在课程建好前保持缺口可见。
- 交互式实训当前是可重放的**机制教学案例**，不是生产版 vLLM 调度器或实际 B200 仿真器。优先在这些案例上继续深入：固定真实版本的源码入口、实测 Trace、可复现性能实验以及推理结果/动作质量正确性。


## V1.5 · 原位图解深读版（2026-11-07）

**学习方式改变，而不是推翻知识地图。** 保留六大领域、已有 L1 课程、25 个 L2–L4 专题、5 种推理式实训和本地学习进度。每个专题现在直接提供：

1. **一句话核心结论**：先明白它解决什么问题及边界。
2. **全系统位置图**：看当前知识在模型→推理引擎→编译/Runtime→Kernel→GPU 中的关系，系统基础是贯穿层。
3. **可点击机制流程图**：图中每个步骤均可展开数据/控制流说明。
4. **分层泳道图**：为 17 个关键专题区分请求控制与数据、编译与运行、计算与搬运等不同路径。
5. **张量/执行例子 + 常见误区**：具体而不是只给英文术语。
6. **实现方案取舍图 + 3 条记忆要点**：每节结束都能回顾。
7. **L3 原位实现导读**：四个实现步骤及输入/输出、性能观察直接写在课程中；源码与官方文档仍可展开用于核对，不再作为理解主体的前置条件。

源码分离：`site/js/visual-knowledge.js` 维护课程讲解，`site/js/visual-lanes.js` 维护控制流/数据流，`site/js/visual-atlas.js` 是通用可访问图解组件，`site/visual.css` 负责表现。不依赖额外服务或第三方脚本。

### 正确性与限制

- 架构图是**教学示意**，不代表真实 vLLM、GPU 的完整实现、精确指令时序、真实数据传输拓扑或硬件模拟。
- 理论数量级与 Shape 明确为例子；运行时以具体软件版本、编译配置和真实 Trace 为准。
- 自研芯片内部文档/参数/测试不进入公开仓库。
- 虽然 25 个专题现在都有直观教学内容，**不表示所有主流技术已被源码级、实测级全面覆盖**。完整度清单仍需持续更新。

开发前请先读 `AGENTS.md` 以及 `skills/deep-topic-authoring/SKILL.md` 和 `skills/lesson-authoring/SKILL.md`。新增专题必须把主要知识直接写入页面，不得仅附外部 URL 代替讲解。


## V1.6 · 核心机制的分步图解（2026-11-07）

在原六大领域、25 个深度专题和旧进度结构不变的前提下，增加五个可直接在网页学习的**原创可交互机制解剖台**：

| 专题 | 图解中真正观察什么 |
|---|---|
| PD 分离 | 控制流与 KV 数据流如何交接，混部和分离的差异，为什么 D 必须等待匹配的历史 KV |
| vLLM V1 Scheduler | 两轮 8-Token Budget 的请求分配、Chunked Prefill 和 Model Runner 的边界 |
| PyTorch 编译执行 | Eager 与融合后的中间 Tensor 流量、FX/Dynamo/Inductor/Triton/PTX、编译期与运行期 |
| FlashAttention | Q/K/V 分块与每行在线 Softmax 的 m/l/a 更新，用四个标量评分验证合并结果 |
| Warp / Scoreboard | 3 个 Warp 与 8 个**人为构造**发射周期的依赖等待、其他 Warp 填槽、空泡原因 |

每个解剖台都按 **定义与边界 → 术语 → 分步机制图（两种视角） → 每步数据输入/输出、动机与误区 → 机制判断 → 三点复述** 编排。优先让主要解释出现在页面内；官方资料用于版本与细节核对。

所有动态图是**教学模型而非实测**：不复现 vLLM 的每个 Scheduler 条件，不预测 B200 周期，也不代表固定的 FlashAttention Kernel 线程布局。页面内清晰标注前提。

主要实现：`site/js/mechanism-studio.js` 与 `site/mechanism-studio.css`，其课程内容不依赖外部图片、脚本或网络服务。维护规则见 `skills/mechanism-visual-teaching/SKILL.md`。

验证：`npm test`；`tests/mechanism-studio.test.mjs` 检查数值与映射；隔离式浏览器组件测试检查交互与桌面/移动布局。完整网站浏览器导航在受限运行环境不能保证，GitHub Pages 发布后仍需做一次线上点击回归。


## V1.7 · 专注学习模式（2026-11-07）

根据实际试学反馈，上一版“进入专题先看大量简介、路线、目录，后接很长正文”的体验被替换为 **默认专注阅读器**。保留六大领域、25 个深度专题、全部现有图解/实训和原有完整资料模式，不删课程内容。

- **打开就开始**：深度专题直接进入当前知识点，不再把覆盖清单/多层目录放在正文前。
- **5 步核心学习 + 2 步可选深入**：定义/输入输出 → 机制逐步展示 → 具体案例 → 机制判断 → 三点记忆；源码与性能验证按需展开。
- **默认小图、完整图可选**：PD 分离、vLLM Scheduler、编译器、FlashAttention、Warp 调度拥有当前环节的专用机制图；完整复杂机制图仍在同页可展开，减少移动端认知和滚动负担。
- **浏览与掌握分开**：自动记录阅读阶段和机制子步骤，机制未读完不算浏览完成；`已掌握` 是用户主动自评而不是系统自动判定。
- **下次接着学**：保存最后专题、阅读阶段、机制子步骤和笔记；继续使用既有本地 JSON 进度导入导出格式（新增字段兼容旧进度）。首次加载不需要账号和数据库。
- **完整资料不消失**：点击右上「完整资料」可切回以前的深度讲义、覆盖审计、实验和外部出处。

目前这一版改善的是**阅读组织与进度可靠性**，不是声称 25 个主题都已达到源码逐行核对和真实 B200 Benchmark 水平。课程的技术缺口与证据限制继续在原覆盖清单中管理。

主要实现：`site/js/focus-reader.js`、`site/js/focus-scenes.js`、`site/focus.css`、`tests/focus-reader.test.mjs`；维护参考 `skills/focused-learning-ux/SKILL.md`。

## V2.0 · 从概念清单改为可推导的技术课程（2026-11）

这次按用户反馈，优先解决“讲概念而不讲机制、没有数学公式、缺少能帮助理解的图”。

- 课程**默认的第一步**直接展示具体数据对象和结构图，说明因果机制；不是先跳官方文档。
- **第三步具体例子**使用浏览器原生 **MathML** 排版数学式，显示每个变量的中文含义、单位和逐步数值推导，无需外部数学 JS 服务。
- 已深入改造 **11 个**代表性专题：PD 分离、vLLM 调度、Paged KV、Transformer Prefill/Decode、编译融合、FlashAttention/Online Softmax、Warp 发射、MoE、VLA、世界模型、GEMM Tiling。
- 各专题的结构图不共用流程箭头模板，而是展示逻辑/物理 KV 块、Token 预算、数值数组、分块统计、Warp 时间线、专家路由、动作向量和时空 Patch 等对应真实机制的对象。
- 原有六大领域、25 个深度专题、课程 ID、进度存储/导入导出均保持。**剩余 14 个深度专题仍以导览为主，不可把“有节点”当作“完成源码与机制级教学”。**
- 公式、图形和示例都是明确的教学抽象，不代表真实 B200/vLLM 的完整数值模型或 Benchmark；详情见 `skills/derivation-teaching/SKILL.md`。

本地执行 `npm test` 检查课程数据、公式模型和进度兼容；本地页面为静态资源，不依赖外部 JS。对关键机制的源码及设备性能仍需要按具体版本继续验证。

## V2.1：私人学习数据云同步（待用户授权与部署）

现在内置「云同步」入口和可选 Cloudflare Worker 后端。配置后支持笔记、MoE 疑问、学习进度和个人知识节点保存到独立 GitHub Private 仓库，ChatGPT 可通过已授权的 GitHub 连接按需读取 `learning/snapshot.json`。**截至代码发布时，该后端未部署、私有仓库未创建，因此不代表已经在线同步。**旧有本地保存和 JSON 导入导出全部保留。

具体步骤、安全边界与真实验收见 [私人云同步配置说明](docs/cloud-sync-setup.md)，维护规则见 [Cloud Sync Skill](skills/cloud-sync-security/SKILL.md)。

## V2.2 · 全部 25 个深度专题的源码与执行导读

原先 L3 只有源码入口，现在每个主题都拥有其技术专属的原创伪代码导读（共 25 份、275 行）。点击阶段，可在同一屏对应看到**执行者、输入张量/状态、关键操作、输出对象及原因**，并查看变量表、适用边界与官方源码核对入口。移动端只突出当前阶段，避免长代码墙。六大模块、课程 ID、学习进度和私人云同步格式全部保留。

新增文件：`site/js/code-tours.js`、`site/js/code-tour-view.js`、`site/code-tour.css` 和 `skills/code-tour-authoring/SKILL.md`。可由「深度图谱 → 任一专题 → 源码追踪」进入。代码均标注为**教学伪代码，不是原项目逐行复制、真实 API 或可直接运行的代码**。实际源码的路径和版本仍需逐一核查，尚不等于全面源码审计。
