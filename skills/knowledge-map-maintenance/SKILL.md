---
name: knowledge-map-maintenance
description: Maintain the six-module AI inference knowledge graph, lesson links, learner progress compatibility, and safe incremental versioning. Use when editing nodes, edges, navigation or learning plans.
---

> V5维护先读AGENTS.md的V5优先规则及docs/curriculum-system-v5.md；新独立课使用统一course-registry与foundation模块，历史25门专用字段检查只适用于旧课。

# Maintain the knowledge map

## Invariants
- Top-level map: `model`, `engine`, `compiler`, `kernel`, `systems`, `microarch`.
- GPU microarchitecture is a **parallel depth line**, not a replacement for inference-system learning.
- Robot VLA and world models are model-layer expansion, not an isolated prerequisite to operating systems.
- Treat vLLM as partially known: avoid forcing beginner lessons through a gate.
- Cross-module links explain why two concepts relate; adding nodes does not itself improve teaching.

## Routine
1. Open `site/js/content.js` and `site/js/journeys.js`; inspect existing IDs, scene steps, `related` fields, explanatory relations, and `edges`.
2. Write down the concept's home module, prerequisites, and direct performance/inference relation.
3. Reuse stable IDs whenever editing existing content; preserve browser progress keys.
4. Update `edges`, `moduleRoles`, `lessonRelations` and placement where necessary; explain **why** a link exists. Review the default six-module overview and detailed map separately.
5. Update references and `docs/roadmap.md` only when implementation warrants it.
6. Run `npm test`; smoke-test map click, search, mobile fallback, lesson jump, back navigation and status/notes persistence.
7. Summarize changes with what was added, what remains speculative, and any data migration.

## Security boundary
Do not merge company-internal architecture content into this public-facing repository. Keep in-house chip comparison in a separate internal resource and use only public, generic terms in this map.
