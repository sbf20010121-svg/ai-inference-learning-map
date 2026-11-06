# Skills 参考与维护策略

本项目参考网上成熟的 Agent Skills，并将**针对本站的原创工作流**维护在 `skills/`，方便 ChatGPT、Codex 和其他兼容 Agent 在今后更新页面时复用。并非把网上 Skill 原样全部下载、复制或自动运行。

| 上游来源 | 项目使用方式 | 官方地址 | 
|---|---|---|
| Agent Skills 标准 | 使用独立目录、`SKILL.md`、YAML Frontmatter 的兼容格式 | https://agentskills.io/specification |
| Anthropic `frontend-design` | 借鉴内容驱动设计、明确层级、避免通用模板视觉、键盘和移动端可用性 | https://github.com/anthropics/skills/tree/main/skills/frontend-design |
| Vercel `web-design-guidelines` | 作为交互、响应式和可访问性检查参考；维护 `interface-audit` 审核流程 | https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines |
| OpenAI `skill-creator` | 参考 Skill 触发描述、渐进式加载、验证和资源组织 | https://github.com/openai/skills/tree/main/skills/.system/skill-creator |

## 为什么不直接复制所有外部 Skill？

1. 上游许可、版本、附带的脚本和权限要求可能不同；不应该不经检查就直接加入可执行工作流。
2. 这个学习系统的重点是 GPU、推理和机器人模型；宽泛的前端 Skill 需要适配本项目真正的内容结构。
3. 当需要更新上游规范时，先打开官方 `SKILL.md` 和许可证，记录变动，按需修改我们自己的 Skill。**不执行来源不明的远程脚本**。

## 维护建议

- **每次改网页交互**：运行 `skills/interface-audit/SKILL.md` 的检查。
- **每次添加或重写课程**：执行 `skills/lesson-authoring/SKILL.md`，再做 `skills/technical-review/SKILL.md`。
- **每次修改知识图谱**：执行 `skills/knowledge-map-maintenance/SKILL.md`。
- **每季度或大版本升级时**：审查上述上游链接；若已发生实质变化，把源版本或检查日期写在对应 PR 中。

> 该文件在 2026-11-06 按官方公开资料初始化。第三方文件不在此项目内镜像保存，其许可证与行为应以各项目原始仓库为准。
