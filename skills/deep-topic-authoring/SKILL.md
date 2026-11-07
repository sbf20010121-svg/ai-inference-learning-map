---
name: deep-topic-authoring
description: Add or extend L2-L4 Chinese interactive AI inference deep-dive lessons while preserving the existing six-module AI learning map. Use for architecture/source/performance topics.
---

# Deep topic authoring

## Keep the original map
- **Never alter top-level six modules** or old lesson IDs to make room for deep topics.
- Add L2–L4 into `site/js/depth-content.js`; link each deep topic to a real L1 parent ID.
- If a topic crosses modules, add a `related` edge with a reason. Put it in a path only if this makes the learning chain clearer.
- Preserve progress versioning. The existing L1 localStorage key remains unchanged.

## L2 — visual mechanisms
- Ask one observable mechanism question, not just “What is X?”.
- Use 4 interactive steps, each with data in/out, the control/compute mechanism, what to measure, and a plausible misconception.
- Be explicit about boundary conditions and non-universal behavior; architecture drawings are conceptual unless specifically sourced.
- Prefer Chinese explanations and explain acronyms at first use.

## L3 — verifiable implementation
- Link original documentation/source to architecture or code paths, indicating when path is an illustrative entry point rather than pinned exact implementation.
- Distinguish Scheduler, Worker, Model Runner, CUDA Runtime, compiler/lowering and hardware pipelines.
- Describe actual tensor shape, execution boundaries and data movement. Do not invent specific function names, line numbers or benchmark figures.
- User is not a vLLM beginner; focus on deeper tradeoffs rather than repeating L1.

## L4 — real reasoning and reproducibility
- Every proposed performance experiment names the target, controlled variables, metrics and validity constraints.
- Slider models in `site/js/depth.js` must state assumptions, units, non-overlap or reuse caveats as applicable, and expose testable calculations (not performance claims).
- Validate formula with deterministic Node tests and compare with one independent calculation.
- Include a mechanism-based 3-choice question with a defensible answer and explanation.
- Do not equate numerical correctness with model or robot task quality: assess output parity, stability, P99 and task-level success when relevant.

## Security and QA
- No confidential internal GPU specs, software, company-internal model logs or inferred private benchmark numbers in the public repository.
- Verify public claims against official CUDA/PyTorch/vLLM/NVIDIA/HuggingFace documentation at the time of change. Avoid unversioned path claims without caveat.
- Run `npm test`, exercise L1→L2 navigation, L2 stepper, L3 links, L4 calculator, dark mode, mobile overflow, progress export/import.
- Maintain `AGENTS.md`, this skill, README and the roadmap whenever expanding depth coverage or schema.
