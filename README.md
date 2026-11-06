# AI 推理技术地图 · V1.2（中文交互优化）

一张能够探索、点击与学习的中文 AI 推理技术知识地图：**模型 → 推理系统 → 编译 / Runtime → GPU Kernel → 微架构**，同时保留 **OS / 分布式基础**，以 **机器人 VLA / 世界模型**作为重点拓展领域。

> 目标是“先串起知识，再选择方向深入”，不是从零把 vLLM 和 CUDA 基础重新学一遍。

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
  styles.css             # 视觉设计 / 响应式 / 深浅色
  js/
    app.js               # 知识图谱、场景交互、进度与练习
    journeys.js          # 三种典型场景、中文术语、模块与知识关系
    content.js           # 课程内容与关联关系（主要维护入口）
skills/
  lesson-authoring/      # 新课程：用图而不是堆文字
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

目前为 10 节示范性可学习课程、3 个交互学习场景和术语速查，尚不是完整教材。课程中的耗时滑块是**数学示意**而不是某型号 GPU / 机器人模型的实测结果；模型与编译链路图是**抽象框图**，实际执行路径依赖代码版本和配置。

源代码采用 MIT License。参照的第三方 Agent Skills 见 `docs/skills-sources.md`：本仓库仅存放原创、针对项目的 Skill，不直接复制未经核查许可的第三方内容。

## V1.2 的设计原则

先用真实推理场景建立因果链，再看六大知识领域；图谱上的系统基础是贯穿各层的支撑，不是模型请求必须依次经过的第六道工序。课程关联必须写明“为什么关联”，不能只给超链接。界面文本以中文为主，保留准确的专业缩写并在术语速查中解释。
