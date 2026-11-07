# V1.8 图形来源与许可

- `site/js/kv-studio.js`：**原创 SVG/HTML**，依据 vLLM 原理设计，不直接复制官方图片。概念证据：<https://vllm.ai/blog/2023-06-20-vllm> 及 <https://docs.vllm.ai/en/latest/design/paged_attention/>。
- `site/js/softmax-studio.js`：**原创 HTML + 数值计算**，展示在线归一化递推，并由单元测试核对参考 Softmax。并不声称是 FlashAttention 的完整 GPU Kernel 实现。
- `site/js/knowledge-network-ui.js`：**原创 SVG/HTML**，结构/交互方式参考 Transformer Explainer 和 React Flow 的层级探索原则，但未复用源图/源码。
- 外部视觉设计 Skill、论文/技术图仅作研究参考，未将第三方未经许可的图片作为资产放入仓库。
