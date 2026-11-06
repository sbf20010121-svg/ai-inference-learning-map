---
name: interface-audit
description: Audit the visual teaching website for usable diagrams, responsive interaction, accessibility, visual clarity and no deceptive controls. Use after frontend or content changes.
---

# Interface review for a technical learning atlas

Inspired by Anthropic's frontend-design approach and Vercel's Web Interface Guidelines (links in `docs/skills-sources.md`). This is a project-specific original checklist; refresh upstream before a substantial redesign.

## Mandatory checks
- **Information architecture:** diagram communicates a real dependency, calculation or flow; colors encode domains; no decorative lines masquerading as causal relationships.
- **Desktop:** Chinese scenario buttons and each stage lead to a real lesson; six-module map readable at 1280–1440 widths; overview/detail, zoom, pan, search, click, related nodes and return navigation work.
- **Mobile:** do not shrink the entire graph into illegibility; default only six-module node list, display detailed lessons when requested; usable 360 px viewport.
- **Keyboard:** controls are reachable, focus visible, node selection via Enter / Space, clear button names, state changes conveyed in text.
- **Vision:** sufficient contrast, light/dark modes, `prefers-reduced-motion`, no flashing / automatic transitions conveying crucial content.
- **Content:** concise Chinese, readable typography, consistent button labels, no filler metrics or fake progress.
- **Data:** if persistence is local-only, state that clearly; JSON export and import must survive reload and reject invalid input.
- **Dependencies:** no external scripts, fonts or analytics by default; validate third-party libraries before adding.

Return prioritized findings and re-test every fix.
