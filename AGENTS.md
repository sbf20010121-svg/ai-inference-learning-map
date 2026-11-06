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
