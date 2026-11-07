// 主流 AI 推理系统知识覆盖审计：有课程 ≠ 已掌握。公开资料，禁止提交内网细节。
import {depthTopics,depthModules} from './depth-content.js';
const T=new Set(depthTopics.map(t=>t.id));
const mk=(id,title,module,lines,source)=>({id,title,module,source,items:lines.trim().split('\n').map(line=>{const [name,priority='P1',ref='']=line.split('|');return {name,priority,ref,group:id,module}})});
export const coverage=[
 mk('models','LLM 模型与计算','model',`
Transformer Block / 张量 Shape|P0|llm-block
Prefill / Decode 计算形状|P0|llm-block
GQA/MQA / KV Head 数量|P0|~llm-block
RoPE / RMSNorm / SwiGLU|P0|fused-norm
MoE Router / Expert / Dispatch|P0|moe-route
量化模型与精度误差|P0|~gemm-tiling
MLA / 压缩 KV 与吸收|P1|mla-kv
线性注意力 / SSM / Mamba|P1|linear-state
长上下文 / Sliding Window / 稀疏注意力|P1|~attention-tiling
Logits / 温度 / Top-p / Top-k 采样|P1|
`, 'https://docs.vllm.ai/en/latest/models/supported_models/'),
 mk('physical','视觉、机器人模型与世界模型','model',`
ViT / 视觉 Patch / 编码器|P0|~vla-policy
VLM 跨模态融合与预处理|P0|~vla-policy
VLA Action Expert / Action Chunk|P0|vla-policy
Diffusion / Flow Matching 动作生成|P0|vla-policy
世界模型 / 状态与视频预测|P0|world-model
DiT / 视频时空注意力|P1|~world-model
模仿学习与 RL Policy 前向|P1|~vla-policy
VLA 异步动作推理、延迟与控制|P1|~vla-policy
点云 / 稀疏卷积 / 3D 感知|P2|
`, 'https://huggingface.co/docs/lerobot/main/smolvla'),
 mk('serving','推理引擎与部署','engine',`
vLLM V1 Scheduler / Token Budget|P0|vllm-scheduler
Paged KV Cache / Block 分配|P0|kv-cache
Prefix Caching / Chunked Prefill|P0|vllm-scheduler
Continuous Batching / 抢占|P0|vllm-scheduler
PD 分离 / KV Connector / 通信|P0|pd-disagg
Speculative Decoding / MTP / 接受率|P0|spec-decode
模型量化部署 / KV Quant / 装载|P0|quant-pipeline
TP / PP / EP / DP 并行|P0|multi-gpu
TTFT / ITL / P99 / SLO / Admission|P0|serving-slo
在线请求回放与 Benchmark|P0|serving-slo
数值正确性与输出质量回归|P0|~profiling
vLLM / SGLang / DeepInfer / TensorRT-LLM|P1|frameworks
长上下文 / Prompt 缓存 / 层级缓存|P1|~kv-cache
服务弹性扩缩 / 多模型混部|P1|~serving-slo
异步调度 / 多卡部署拓扑|P1|~multi-gpu
`, 'https://docs.vllm.ai/en/latest/design/arch_overview/'),
 mk('compilation','编译、图优化与 Runtime','compiler',`
PyTorch Eager / 图执行|P0|compiler-lowering
TorchDynamo / FX / Graph Break|P0|compiler-lowering
TorchInductor / 算子融合|P0|compiler-lowering
Triton IR / Layout / Lowering|P0|triton-tiling
PTX / SASS / 编译生成路径|P0|compiler-lowering
CUDA Stream / Event / Graph|P0|runtime-graph
动态 Shape / Autotuning / 缓存|P1|~triton-tiling
TensorRT / ONNX / Engine 构建|P1|
MLIR / LLVM / 编译后端|P1|~compiler-lowering
CUDA Runtime 与 Driver 边界|P0|host-runtime
融合合法性 / 精度语义|P0|~compiler-lowering
`, 'https://docs.pytorch.org/docs/stable/torch.compiler.html'),
 mk('operators','GPU Kernel 与 Profiling','kernel',`
GEMM / GEMV / Tile / Grouped GEMM|P0|gemm-tiling
FlashAttention / Online Softmax|P0|attention-tiling
Paged Attention / GQA / MLA Kernel|P0|~attention-tiling
Norm / RoPE / 激活 / Reduction|P0|fused-norm
FP8/FP4/INT8 量化和反量化|P0|quant-pipeline
MoE Expert Grouped GEMM 与数据重排|P0|~moe-route
CUDA Graph / Kernel Fusion / Launch Gap|P0|runtime-graph
Roofline / 算术强度与访存字节|P0|profiling
Nsight Systems / Compute / SASS|P0|profiling
正确性、基准、统计与归因|P0|profiling
Gather / Scatter / Top-p Sampling|P1|
Conv / ViT / 稀疏操作|P1|~vla-policy
`, 'https://docs.nvidia.com/nsight-compute/ComputeTriage/'),
 mk('platform','操作系统、部署与分布式','systems',`
Linux 进程线程 / 同步 / 调度|P0|host-runtime
虚拟内存 / Pinned / DMA / H2D|P0|host-runtime
GPU Driver / CUDA Context / Runtime|P0|host-runtime
NCCL Collective / AllReduce / All-to-All|P0|multi-gpu
线上观测 / 资源规划 / 背压|P0|serving-slo
NUMA / PCIe / Host Memory|P1|~host-runtime
RDMA / GPUDirect / 网络拓扑|P1|~multi-gpu
容器 / 驱动兼容 / GPU 部署环境|P1|
分布式调度 / 任务隔离 / 自动化部署|P1|~serving-slo
`, 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/'),
 mk('hardware','GPU 微架构与硬件资源','microarch',`
SM / Warp / SMSP / 指令发射|P0|warp-issue
Scoreboard / 数据依赖 / Stall|P0|warp-issue
Tensor Core / MMA / tcgen05|P0|tensorcore-b200
寄存器 / Shared / L1 / L2 / HBM|P0|memory-route
TMA / Barrier / 异步搬运|P0|tensorcore-b200
Coalescing / Bank Conflict / Spill|P0|memory-route
Occupancy / Latency Hiding / 资源竞争|P0|warp-issue
Block Cluster / Warpgroup|P1|~tensorcore-b200
NVLink / NVSwitch / GPU 互连|P1|~multi-gpu
功耗 / 时钟 / 温度与性能稳定性|P1|
自研芯片与公开 B200 机制对照|P1|~warp-issue
`, 'https://docs.nvidia.com/cuda/blackwell-tuning-guide/'),
];
export const coverageItems=coverage.flatMap(g=>g.items);
export const statusOf=i=>!i.ref?'missing':i.ref.startsWith('~')?'partial':T.has(i.ref)?'guided':'missing';
export const statusLabels={guided:'已有机制课',partial:'只在关联课程涉及',missing:'尚缺深度课程'};
export function auditSummary(items=coverageItems){const s={guided:0,partial:0,missing:0};for(const i of items)s[statusOf(i)]++;return s}
export function validateCoverage(){const names=new Set();const mids=new Set(depthModules.map(m=>m.id));for(const i of coverageItems){if(names.has(i.name)||!mids.has(i.module)||!['P0','P1','P2'].includes(i.priority)||i.ref&&!T.has(i.ref.replace(/^~/,'')))throw Error('覆盖索引错误 '+i.name);names.add(i.name)}if(coverageItems.length<70)throw Error('课程覆盖索引不足');return true;}
