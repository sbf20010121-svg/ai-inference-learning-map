/** 典型部署/编译/芯片的双泳道图，区分控制路径与真实数据路径。公开教学抽象。 */
export const lanes={
 'pd-disagg':{
  title:'两条路径别混淆：请求控制 vs KV 数据移动',
  rows:[['请求控制','Router 选择 P','P 结束 Prefill','通知 D 准备接续','D 持续 Decode'],['KV 数据','P 端写入 KV Block','Connector 定位 Block','KV 传输或加载','D 端消费历史 KV']],
  note:'分离真正新增的是跨实例 KV 的定位、传输、就绪同步，而不是把 Transformer 的前后层拆开。不同 Connector 的细节不同。'
 },
 'vllm-scheduler':{
  title:'调度控制流与 GPU 数据流同时发生',
  rows:[['控制与预算','API 请求进入','EngineCore Scheduler','检查 Token Budget / KV','调度 Worker'],['张量与设备','Token IDs/状态','批次元数据','模型输入及 Block 表','Model Runner → GPU']],
  note:'Scheduler 决定执行哪些请求及本轮 Token 数；Model Runner 负责把这些选择变为模型前向。'
 },
 'kv-cache':{
  title:'逻辑 Token 顺序不等于物理 KV 连续存放',
  rows:[['逻辑视角','请求的历史 Token','切成逻辑 Blocks','Block Table 映射','Attention 依序读取'],['物理视角','GPU 显存预留空间','分配物理 KV Blocks','复用/引用/回收','根据映射 Gather 历史 K/V']],
  note:'前缀缓存是复用可匹配的历史 Block，不是“所有请求自动共享所有 KV”。'
 },
 'compiler-lowering':{
  title:'编译阶段与运行阶段是两条不同链路',
  rows:[['编译路径','PyTorch + Dynamo','FX / 中间 IR','Inductor/Triton Codegen','PTX → 设备代码'],['执行路径','模型被调用','Runtime/库选择','CUDA Stream / Graph','GPU 运行 Kernel']],
  note:'生成设备代码可以提前完成；每次执行时通常直接调用已有 Kernel。库 Kernel、手写 CUDA/Triton 与编译生成路径可以并存。'
 },
 'triton-tiling':{
  title:'数学输出 Tile 与硬件资源分配相联系',
  rows:[['数学结构','A[M,K], B[K,N]','选择 BLOCK_M/N/K','Program 负责 C Tile','沿 K 维累加'],['硬件执行','全局加载数据','寄存器/Shared 布局','Warp/MMA 计算','Epilogue 写回']],
  note:'数学上的 Tile 不等于某种固定硬件指令；最终需核对编译后指令、寄存器和片上存储。'
 },
 'runtime-graph':{
  title:'对照普通提交与 CUDA Graph Replay',
  rows:[['普通提交','CPU 调用 Kernel A','CPU 调用 Kernel B','CPU 调用 Kernel C','GPU 执行依赖'],['图重放','预先 Capture/Instantiate','CPU 发起 Graph Replay','设备执行图节点','同步/获得结果']],
  note:'Graph Replay 减少重复发射成本，但没有保证 A/B/C 被融合成一个 Kernel。'
 },
 'attention-tiling':{
  title:'真正改变的是中间结果的数据路径',
  rows:[['数学计算','Q Tile × K Tileᵀ','局部分数与 Softmax','分块加权 V','得到输出 O Tile'],['存储流量','Q/K/V 分块读取','片上维护 m、l','片上更新累加 O','写最终 O 到 HBM']],
  note:'不把完整 S×S 分数写进 HBM，是减少中间 IO 的关键；数学上的两两 Attention 仍要进行。'
 },
 'gemm-tiling':{
  title:'计算路径和数据复用路径一起决定性能',
  rows:[['计算','决定 M/N/K 与 dtype','划分输出 Tile','K 分块 MMA/累加','输出 C'],['数据','读取 A/B 全局块','Shared/寄存器复用','减少重复访存','写回全局内存']],
  note:'Tiling 的收益来自有效重用，成本是更高的寄存器/Shared Memory 需求。'
 },
 'warp-issue':{
  title:'“等待”与“调度”不是同一件事',
  rows:[['指令控制','驻留多个 Warp','Scoreboard 检查依赖','选一个可发射 Warp','送往执行 Pipe'],['数据就绪','某 Warp 发起 Load','数据未返回而 Stall','别的 Warp 可执行','结果到达解除依赖']],
  note:'即使 Warp 总数很多，若没有就绪工作或 Pipe 已饱和，仍可能出现无法发射的周期。'
 },
 'memory-route':{
  title:'缓存路径和显式 Shared Memory 是不同概念',
  rows:[['全局访存路径','Load Global 地址','L1（视策略而定）','L2 / HBM 访问','数据最终进入寄存器'],['程序显式复用','线程块加载 Tile','写入 Shared Memory','线程块同步/复用','计算后写回全局']],
  note:'Shared Memory 由程序管理，不是“每次 Global Load 自动依次经过 Shared→L1→L2”。'
 },
 'tensorcore-b200':{
  title:'异步搬运与矩阵计算的控制依赖',
  rows:[['搬运/数据','从 GPU 存储取 Tile','适用时 TMA 搬运','片上数据就绪','结果写回'],['计算/同步','设置计算任务','Barrier 等待输入就绪','矩阵指令累加','确认完成并消费结果']],
  note:'具体 Blackwell 功能、指令格式、Tile 与 Barrier 要按 B200 和官方 CUDA 文档核对，图不代表精确周期。'
 },
 'vla-policy':{
  title:'感知特征与动作迭代是两条关联的计算路径',
  rows:[['感知上下文','图像 / 文本输入','视觉编码 / VLM','任务与场景特征','作为动作条件'],['动作生成','机器人状态 + 噪声动作','Action Expert 前向','多次积分更新动作','Action Chunk 输出']],
  note:'VLA 可以直接回归、动作 Token 或迭代生成；图描述 Flow Matching 一类典型方案。'
 },
 'world-model':{
  title:'环境预测不是动作输出的必经环节',
  rows:[['环境表征','视频/状态历史','时空编码','时序条件建模','预测未来潜变量/帧'],['决策使用','可选动作条件','世界模型模拟后果','规划器评价候选','策略选择动作']],
  note:'规划可能循环调用世界模型；有些机器人 Policy 不使用世界模型，也有世界模型只用于训练数据。'
 },
 'moe-route':{
  title:'Token 路由和设备间通信要分开分析',
  rows:[['Token 逻辑','Router 计算 Top-k','按专家分组/重排','每个 Expert 计算','Combine 回原 Token'],['多 GPU EP（可选）','本地或远端专家定位','All-to-All Dispatch','GPU 专家 GEMM','跨卡 Combine']],
  note:'不使用 EP 时不一定存在 All-to-All；Top-k 导致的负载倾斜也会改变 Grouped GEMM 形状。'
 },
 'spec-decode':{
  title:'草稿与目标模型分别扮演不同角色',
  rows:[['草稿工作','Draft 生成候选','候选长度 γ','提交多个猜测','进入下一轮'],['目标验证','Target 处理候选','并行验证相关位置','按采样语义接受前缀','维护正确 KV 状态']],
  note:'“一次 Target 验证多个位置”不意味着完全零成本；实际加速取决于接受长度、Draft 和验证成本。'
 },
 'quant-pipeline':{
  title:'离线数据表示与运行时 Kernel 路径',
  rows:[['表示/保存','选择 W / A / KV 对象','量化/Scale 粒度','Packed Checkpoint','加载量化模型'],['运行计算','读取 Packed 数据','Scale/融合反量化','硬件支持的 MMA/GEMM','验证误差和延迟']],
  note:'必须知道权重、激活、KV 分别用了什么位宽，实际后端是否真的走低精度计算。'
 },
 'serving-slo':{
  title:'一个请求的延迟在服务链上逐项产生',
  rows:[['请求关键路径','请求到达/排队','Prefill','Decode 多轮','客户端收到结果'],['观测指标','Queue Wait','TTFT','ITL / P99','吞吐/GPU、失败率']],
  note:'相同平均吞吐下，排队延迟和尾间隔可能差很多；服务优化必须按 SLO 看。'
 }
};
export function validateLanes(topics){const ids=new Set(topics.map(x=>x.id));for(const [id,item] of Object.entries(lanes)){if(!ids.has(id))throw Error(`不存在的双路径主题: ${id}`);if(item.rows.length!==2||item.rows.some(x=>x.length!==5))throw Error(`泳道格式不正确: ${id}`)}return true}
