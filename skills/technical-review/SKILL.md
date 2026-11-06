---
name: technical-review
description: Review GPU, runtime, compiler, LLM, VLA and world-model lessons for technically accurate boundaries, assumptions, evidence and performance conclusions. Use before publishing new or edited technical explanations.
---

# Review technical correctness

1. List every **factual claim** that can change by version (vLLM classes, CUDA architecture, PyTorch compiler behavior, model components). Verify against current primary documentation or the exact source-code commit; cite source links in `refs`.
2. Check boundaries: PTX != SASS; compiler != runtime; HBM != CPU DDR; FEOL != packaging; kernel time != end-to-end time; low occupancy != guaranteed bottleneck.
3. For Profiling, require Shape/dtype/device/version, measurement method, kernel concurrency, repetitions and correctness. Stall metrics alone are insufficient to establish causality.
4. For robot models, distinguish action representation, model inference, RL or imitation **training**, control loop and world-model simulation. Do not assume every VLA is Flow Matching or every world model performs control.
5. Inspect illustrative timing widgets: units, equations and labels must say assumptions and omit false precision. Never present example sliders as model benchmarks.
6. Add counterexamples and next-step experiments. Keep uncertainty visible.
7. No confidential internal hardware parameters, code, reports or derived proprietary details in public content.

Report review issues by **location**, **claim**, **evidence**, **proposed correction**. Do not certify an untested optimization.
