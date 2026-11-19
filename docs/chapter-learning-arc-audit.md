# Chapter learning-arc audit · 2026-11-19

## Acceptance rule

Every chapter and each major concept inside it should form a closed learning arc:

**Question / motivation → prerequisite context → first-use term definitions → mechanism and worked example → evidence / boundary → explicit answer → next-step bridge.**

This is a semantic rule, not a fixed six-section layout. Choose the representation that explains the knowledge: architecture map, data trace, tensor example, derivation, source walkthrough, timeline, resource model, or experiment.

## Implemented in this change

- Added site/js/chapter-arc.js with 42 authored chapter arcs for the first high-priority set.
- The focused reader renders each arc's opening context and first-use terms before the mechanism figure, then renders the takeaway and bridge after the mechanism and before the evidence disclosure.
- Added tests that validate every authored arc maps to a real chapter, includes opening/terms/takeaway/bridge, and appears in the correct reading order.
- Existing course IDs, chapter IDs, progress data and private learning sync are not changed by the arc metadata.

## First-priority topics

| Topic | Chapters with explicit arcs |
|---|---:|
| Gated DeltaNet / linear state | 9 |
| Triton compiler lowering | 7 |
| MoE routing / EP | 6 |
| Attention patterns | 3 |
| Tokenizer / Embedding / output head | 3 |
| Transformer layer | 3 |
| Generation state | 2 |
| Sampling distribution | 3 |
| Request lifecycle | 3 |
| State families | 3 |
| **Total** | **42** |

## Not yet complete

The remaining independent courses and all other mechanism chapters still need the same semantic audit. Do not infer completeness from the 42 priority arcs or from the presence of terms, formulas, quizzes, diagrams or source links.

For the next audit pass, inspect all chapters in course-registry.js, mechanism-curriculum.js and the seven foundation-*.js files. For each chapter, record the question it answers and why it appears here; prerequisites needed before this point; every first-use term, symbol and acronym and where it is explained; whether the mechanism and worked example actually answer the question; assumptions and limits; explicit conclusion; and the reason the next chapter follows or the return path to the global system spine.

Report missing links rather than filling them with generic prose. Prefer fixing prerequisite order or adding a short bridge over adding another disconnected glossary or FAQ.
