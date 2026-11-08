/**
 * 全站 25 个专题的中文源码导读。所有片段都是原创、可教学的伪代码，
 * 不是从第三方仓库复制的可直接运行源码，亦不声称是特定版本的函数实现。
 * 真实源码核对入口在每个主题的 traces 中；一段伪代码只表达其核心机制。
 */
const P=(title,owner,input,action,output,reason,code)=>({title,owner,input,action,output,reason,code});
const D=(id,lead,example,terms,phases,caveat)=>({id,lead,example,terms,phases,caveat});

export const codeTours=[
D('llm-block','追踪一个 Transformer Block：先改变张量形状，再改变数据的交互方式。','示意：B=2、S=4、隐藏维 H=128；Prefill 的 Q 有 8 行，单 Token Decode 每个请求只新增 1 行。',
 [['B','请求 Batch 数'],['S','本轮输入 Token 数'],['H','隐藏维度'],['KV','历史 Key / Value 张量']], [
 P('得到 Q/K/V','模型前向 · GPU GEMM','hidden: [B,S,H]','投影并把 Head 维分开','Q、K、V: [B,heads,S,d]','GEMM 的 M 通常为 B×S；Decode 时 S 小，形状会改变。', ['q = linear(hidden, Wq)', 'k = linear(hidden, Wk)', 'v = linear(hidden, Wv)']),
 P('更新注意力上下文','Attention Kernel','Q + 当前/历史 K,V','按因果掩码计算可见位置的权重','context: [B,S,H]','有 KV Cache 时不必重新计算所有历史 Token 的投影。',['kv_cache.append(k, v)', 'scores = masked_dot(q, kv_cache.keys) / sqrt(d)', 'context = softmax(scores) @ kv_cache.values']),
 P('非线性与残差','模型层 · GPU Kernel','context + hidden','Attention 输出投影、归一化及 MLP','next_hidden: [B,S,H]','Norm 和逐元素操作可能被编译器融合，但不等于省略计算。',['hidden = hidden + output_projection(context)', 'z = norm(hidden)', 'hidden = hidden + mlp(z)']),
 P('生成下一步输入','推理 Engine','Block 输出 / Logits','按模型输出取样，生成位置再进入下一轮','新 Token ID / 新一轮状态','不是每个 Block 都直接返回 Token；需通过最终 LM Head 和采样。',['logits = lm_head(final_norm(hidden))', 'next_token = sample(logits[:, -1])', 'next_step_input = next_token'])],
 '示例为概念性自回归 Transformer；Post-Norm、Pre-Norm、GQA、MoE 和多模态模型有不同实现。'),
D('moe-route','看清 Router 选择、Token 复制/重排、专家计算、合并是五个不同阶段。','教学例：4 个 Token、3 个 Expert、Top-2；共有 4×2=8 个 Token-Expert 分配。',
 [['T','本轮 Token 数'],['E','路由专家总数'],['k','每 Token 选中的专家数'],['W_router','用于学习路由得分的投影参数'],['w[t,e]','Token t 对专家 e 的合并权重']], [
 P('Router 给出分数','模型层 · 通常 GEMM','X: [T,H]','对每个 Token 产生 E 个分数，再选 Top-k','idx / w: [T,k]','Top-k 比较的是路由得分，不是专家模型的参数大小。',['scores = X @ W_router                # [T,E]', 'idx = topk(scores, k).indices      # [T,k]', 'w = normalize(selected_scores(scores, idx))']),
 P('按专家收集 Token','Dispatch · Gather / Pack','X、idx、原 Token 编号','复制被选中 Token 的向量，按 Expert 分桶','expert_input[e]: [M_e,H]','M_e 是收到的 token-expert 分配数量；不同 Expert 可不相等。',['for token in range(T):', '  for expert in idx[token]:', '    bucket[expert].append((token, X[token]))']),
 P('需要时跨 GPU 交换','EP · 通信层','各 GPU 的 Expert 分桶','发送给保存该专家权重的 GPU','目标 GPU 本地的 Expert 输入','All-to-All 交换的是选中的激活/元信息，不是每轮广播所有专家权重。',['if expert_owner(expert) != local_gpu:', '  send_to_owner(expert, hidden, token_id)', 'local_buckets = all_to_all_dispatch(buckets)']),
 P('各专家执行 FFN','Grouped GEMM · GPU','每个 Expert 的 X_e: [M_e,H]','以不同权重执行 Gate / Up / Down，按组调度','expert_output[e]: [M_e,H]','Grouped GEMM 是一组不同 M_e、不同权重的 GEMM，不是一个共享 W。',['for expert in local_experts:      # 可合并为 grouped kernel', '  gate = silu(X_e @ W_gate[e])', '  up = X_e @ W_up[e]', '  Y_e = (gate * up) @ W_down[e]']),
 P('返回并合并','Combine · Scatter / Reduce','Y_e、原 Token ID、w','把每个 Expert 的输出放回 Token 并加权求和','Y: [T,H]','TP/EP 不同部署下 Combine 可能需要反向通信。',['received = all_to_all_combine(local_outputs)', 'Y = zeros([T,H])', 'for (token, expert, y) in received:', '  Y[token] += w[token, expert] * y'])],
 '此处不模拟专家容量限制、共享专家、路由 Bias、不同模型的归一化策略及通信后端细节。'),
D('vla-policy','把“生成动作的网络迭代”与“机器人真的运动了几步”清晰分开。','示意：一条 Action Chunk 的尺寸是 [B=1, H=16, A=7]；数值积分 4 步与 16 个动作时刻不是一回事。',
 [['c','视觉、语言和本体状态条件'],['a','正在生成的连续动作变量'],['Δτ','生成算法的积分步长'],['H','一个动作块的时间长度'],['A','单次动作向量维度']], [
 P('准备条件','视觉 / 语言 / 状态编码器','images、text、robot_state','提取特征并投影到策略所需维度','c: 多模态条件特征','可能缓存一部分条件特征；实际是否复用由模型决定。',['visual = vision_encoder(images)', 'language = text_encoder(text)', 'c = condition_fusion(visual, language, state_proj(robot_state))']),
 P('构造动作初始表示','Action Expert 输入','c + 动作块尺寸','创建随机或可学习的动作起点及采样时间','a_0: [B,H,A]','不能把生成初始噪声当作机械臂已经执行的动作。',['a = sample_initial_action([B,H,A])', 'tau = 0.0']),
 P('迭代生成动作','Flow Matching / 迭代网络','a、tau、c','网络给出更新方向，积分改变动作表示','a_final: [B,H,A]','每一次迭代都可能重新执行 Action Expert；步数与精度需一起验证。',['for step in range(num_integration_steps):', '  v = action_expert(a, tau, c)', '  a = a + delta_tau * v', '  tau = tau + delta_tau']),
 P('交给控制端执行','策略服务 → 控制器','最终 Action Chunk','按真实控制时钟消费并在需要时更新预测','关节/夹爪目标序列','控制 Hz 不等于模型采样 Hz；动作块可能异步播放。',['actions = denormalize(a)', 'for action in select_execution_window(actions):', '  controller.submit(action)'])],
 '部分 VLA 是离散动作 Token、自回归或直接回归策略，不应默认都走 Flow Matching。'),
D('world-model','理解世界模型为何出现时空 Token 和反复预测；它并不直接等于控制器。','示意：3 帧×每帧 4 个 Patch，变成 12 个时空 Token；全局 Attention 位置对可达 12²=144。',
 [['F','输入视频帧数'],['P','每帧空间 Patch 数'],['N','展平的时空 Token 数，F×P'],['z','潜空间状态 / 视频特征']], [
 P('编码历史观测','视频 / 状态编码器','video: [B,F,C,H,W] + 可选动作','拆成 Patch 或潜变量，并加入空间和时间位置信息','z: [B,N,D]','像素空间与潜空间的 N 可能差异很大。',['z = encode_frames(video)', 'z = add_space_time_positions(z)', 'N = num_frames * patches_per_frame']),
 P('关联时间与空间','时空模型 · GPU','z 和可选 action 条件','Attention / Conv / SSM 按模型结构交换信息','context: [B,N,D]','不是所有世界模型都做稠密全局 N² Attention。',['context = temporal_spatial_backbone(z, action_condition)', 'state = summarize_history(context)']),
 P('预测未来','预测头 / 生成网络','历史 state + 备选动作','直接预测潜状态，或多步更新生成未来表示','next_z 或 future_frames','预测误差可能随 Rollout 累积；多次生成也带来推理延迟。',['future_state = predict(state, candidate_action)', 'if generative_mode:', '  future_state = iterative_refinement(future_state)']),
 P('交给规划/训练','下游规划器或数据生成','多个备选未来','评价后选择动作，或离线生成数据','选定动作 / 训练样本','世界模型不一定处于机器人的实时控制环中。',['if planning:', '  action = select_by_score(future_states)', 'else:', '  dataset.add(future_states)'])],
 '仅示意一种条件预测流程；视频扩散、Dreamer 潜状态、基于动力学的模型等差异很大。'),
D('vllm-scheduler','用请求状态与 Token Budget 理解一次调度，而不是记住函数名单。','示意 B=8：A Decode 申请 1，长 Prompt B 本轮获 7，短 Prompt C 等待；下一轮再考虑剩余 Token。',
 [['B','本轮 Token 计算预算；不是 Byte'],['req','一个等待或运行中的请求'],['n_new','本轮计划计算的 Token 个数'],['KV','本轮须占用或重用的 KV Block']], [
 P('计算待处理量','EngineCore / Scheduler','Running、Waiting 请求 + num_computed','按每个请求已算与目标位置求差','每请求还需计算多少 Token','V1 不必硬分成两个完全独立的 Prefill/Decode 调度循环。',['budget = max_scheduled_tokens', 'for req in running_or_admissible_waiting:', '  pending = req.target_tokens - req.num_computed_tokens']),
 P('决定本轮 Token','Scheduler','pending、budget、策略/优先级','在预算内截断长输入；决定本轮取多少','n_new[req]','这里仅代表核心思想；真实调度还考虑输入类型与推测位置。',['n = min(pending, budget)', 'if n == 0: continue', 'budget -= n']),
 P('检查 KV 资源','KVCacheManager','请求、当前缓存布局、n','分配 KV Block，必要时让请求等待或抢占','有效分配或调度失败','只有 Token Budget 足够还不够；显存块资源也必须就绪。',['blocks = kv_cache.allocate_slots(req, n)', 'if blocks is None:', '  postpone_or_preempt(req)    # 教学分支', '  continue']),
 P('提交模型前向','Executor / Model Runner','请求、n_new、KV Block 映射','准备张量与元数据，让 GPU 执行该轮计算','输出 Token / Cache 状态','Scheduler 分配工作，并非直接在 CPU 上做矩阵乘法。',['schedule = build_schedule(accepted_requests)', 'outputs = model_runner.execute(schedule)', 'scheduler.update_from_outputs(outputs)'])],
 'vLLM V1 源码持续演进；真实策略还含 prefix cache、异步 KV、preemption、multimodal、speculative decoding。'),
D('kv-cache','Block Table 是映射，物理 KV Block 是数据；一个请求的块可非连续。','示意 block_size=4、序列长 9：逻辑上需要 ceil(9/4)=3 块；A[0] 和 B[0] 可在前缀命中时映射同一物理块。',
 [['S','缓存中的 Token 位置数'],['block_size','一个逻辑 KV 块的 Token 容量'],['table[r][i]','请求 r 的逻辑第 i 块映射的物理块编号'],['refcount','用于说明共享/持有关系的引用概念']], [
 P('得到逻辑块范围','Scheduler / 缓存管理器','请求 r、历史长度 S','按块容量计算本轮需要多少逻辑块','逻辑块索引 0...ceil(S/size)-1','逻辑连续不代表物理显存地址连续。',['num_blocks = ceil_div(S, block_size)', 'logical_ids = range(num_blocks)']),
 P('查找和分配物理块','Block Manager','已有映射与可复用缓存','优先复用符合条件的完整前缀块，否则领取空闲块','Block Table 条目','共享块须满足内容/位置等缓存键匹配，不是任意相同字符串都自动复用。',['for i in logical_ids:', '  phys = prefix_lookup(req, i) or allocate_free_block()', '  table[req][i] = phys']),
 P('按映射写入与读取','Paged Attention Kernel','Token 位置 t、请求的 Block Table','先找到物理块，再找到块内偏移','物理 KV 地址与 K/V','Block Table 查询与实际 K/V 搬运是不同工作。',['logical = t // block_size', 'offset = t % block_size', 'physical = table[req][logical]', 'kv_store[physical, offset] = new_kv']),
 P('结束或继续','Cache Manager','请求完成 / 缓存引用','释放不再持有的块；被其他请求引用时保留','空闲块集合与更新后的表','真实实现的缓存生命周期比单一引用计数更复杂。',['on_request_finished(req):', '  release_request_blocks(req)', '  keep_blocks_still_referenced_by_others()'])],
 '示例是逻辑块映射教学：生产实现包括 Hash、LRU/缓存队列、滑窗、混合 KV 规格等。'),
D('pd-disagg','观察 P 端如何生成 KV、如何交接，D 端如何接续；不是把 Transformer 前后层拆开。','示意：P 实例处理 1024 输入 Token，KV 传输完成并确认 D 端可读取后，D 实例继续生成。',
 [['P','Prefill 实例：处理输入上下文'],['D','Decode 实例：逐步生成新 Token'],['KV','每层历史 Key / Value 缓存'],['connector','KV 交接协议/实现后端']], [
 P('选择计算实例','服务 Router','Prompt + 请求元数据','安排 P/D 角色与请求标识','可匹配的 P/D 请求记录','路由和数据搬运可能在不同组件完成。',['req_id = allocate_request_id()', 'p, d = choose_prefill_and_decode_instances(req_id)']),
 P('P 端处理 Prompt','Prefill Worker','Prompt Tensor + 模型权重','计算完整输入上下文并缓存每层 KV','KV 缓存块及必要元数据','P 和 D 一般各有模型所需权重副本；并非按层切分。',['prefill_result = p.run_prefill(prompt)', 'kv_meta = p.export_kv_metadata(req_id)']),
 P('KV 传输与就绪','KV Connector / Network','P 端物理 KV 和映射元数据','传输/加载并确认 D 端的有效映射','D 端 KV ready','“P 已结束”不等于“D 可立刻读取全部 KV”。',['transfer_kv(source=p, target=d, info=kv_meta)', 'await d.confirm_kv_ready(req_id)']),
 P('D 端继续生成','Decode Worker','新 Query + 历史 KV','执行后续模型计算并追加自己的新 KV','Token 流 / 更新后的 KV','是否改善 TTFT/ITL 取决于传输、排队和资源分配。',['while not finished(req_id):', '  token = d.decode_one_step(req_id)', '  stream_to_client(token)'])],
 '某些 PD 后端采用异步加载、不同 KV Connector 与非同质拓扑；这里不是固定的 vLLM API。'),
D('serving-slo','真正的优化目标是 SLO 下服务了多少合格请求，而不只是离线 tokens/s。','场景：输入请求不同长度且随机到达；短请求与长 Prefill 可能在同一实例互相干扰。',
 [['TTFT','Time To First Token：首次输出等待'],['ITL','Inter-Token Latency：连续输出间隔'],['SLO','服务级目标，如 P99 ITL≤阈值'],['Goodput','满足质量和时延约束的有效吞吐']], [
 P('接收请求与打点','网关 / Serving API','到达时刻、Prompt、租户限制','记录入队并确定最大并发/配额','带 request_id 的请求','若只记录 GPU 开始时间，会漏掉排队造成的 TTFT。',['req = receive(prompt)', 'req.arrival = clock.now()', 'queue.put(req)']),
 P('按约束调度','Scheduler / Admission','Queue、SLO、GPU/显存预算','选择请求组合并限制过载','已分配的 Batch','调高离线吞吐可能牺牲排队时延和尾延迟。',['candidates = rank_requests(queue)', 'batch = admit_under_memory_and_slo(candidates)']),
 P('执行并流式返回','Model Runner / Stream','批次输入/缓存','执行 Prefill 与反复 Decode','每请求 Token timestamp','Prefill、Decode、网络发送各有独立耗时。',['for step in execute_and_sample(batch):', '  record_token_time(req_id, step.time)', '  stream(step.token)']),
 P('评估目标是否达标','Metrics / Autoscaling','到达分布、TTFT、ITL、失败率','对照 SLO 统计 Goodput 和 P99','可比较的服务报告','相同模型/GPU/请求分布/精度才便于比较。',['p99_itl = percentile(itl_samples, 99)', 'goodput = count(success_and_slo_ok) / duration', 'report(ttft, p99_itl, goodput, gpu_cost)'])],
 'P99 和 Goodput 需固定统计窗口、分组及负载，不可仅由合成滑块得出生产性能。'),
D('compiler-lowering','同一个数学表达，在图级 IR、GPU Kernel IR、LLVM IR 和 PTX 中逐渐补上执行细节。','例子：y=ReLU(2x+1)；融合前可能写 u/v 两份临时 Tensor，融合后只需最终写回 y。',
 [['FX','PyTorch 捕获的计算图表示'],['IR','中间表示；不同阶段抽象等级不同'],['MLIR','可扩展的多方言中间表示基础设施'],['LLVM IR','LLVM 的低层中间表示'],['PTX','NVIDIA GPU 的虚拟指令集'],['SASS','目标 GPU 实际执行的指令']], [
 P('捕获算子图','TorchDynamo / FX','Python 前向 + Tensor 操作','截取可编译区域和依赖','FX Graph: mul→add→relu','Guard 与 Graph Break 会限定可编译范围。',['graph = capture_tensor_region(forward)', 'graph = graph_with_guards(graph, input_shapes)']),
 P('图级优化','TorchInductor · 图 IR','FX Graph + Shape/Stride','寻找可合法融合的子图及内存依赖','fused pointwise computation','减少中间读写，但不等于乘加和激活消失。',['fused = fuse_compatible_ops(graph)', 'plan = choose_scheduling_and_layout(fused)']),
 P('Lowering 与后端','Triton / MLIR / LLVM','高层 Tile 语义','明确线程布局、地址、谓词与设备级指令','TTIR→TTGIR→LLVM IR→PTX（典型 NVIDIA 路径）','MLIR 是多层 IR 体系，LLVM 提供低层优化；不能把二者当一条独立于 Triton 的固定额外步骤。',['ttir = lower_ops_to_triton_ir(plan)', 'ttgir = choose_gpu_layout_and_threads(ttir)', 'llir = lower_to_llvm_ir(ttgir)', 'ptx = generate_target_ptx(llir)']),
 P('装载与发射','CUDA Runtime / Driver','PTX / Cubin + 输入 Tensor','装载目标代码并按 Stream/Graph 启动','GPU 上的 Kernel 执行','PTX 不是 SASS；可经 ptxas 或 Driver JIT 完成最终映射。',['binary = assemble_or_load_cubin(ptx)', 'launch(binary, grid, stream, args)', 'observe_kernel_and_sass()'])],
 '这是一条典型的 PyTorch/Triton NVIDIA 路径，不代表所有推理算子都经过 TorchDynamo 或 Triton；有库 Kernel 和其他后端。'),
D('triton-tiling','Triton 程序的“每个 Program 处理一个 Tile”必须和 Mask、Stride、并行网格一起看。','例如 M=N=128，BLOCK_M=64、BLOCK_N=64，则输出分为 2×2=4 个 Program Tile。',
 [['M,N,K','GEMM 的行、列、归约维度'],['BLOCK_M/N/K','每次 Tile 的形状'],['pid','当前 Program 的网格编号'],['mask','边界超出张量时的保护条件']], [
 P('映射输出 Tile','Triton Program Grid','M,N 和 BLOCK_M/N','由 Program ID 决定自己计算哪块输出','row/col offsets','Program 并不必然一一对应一个 SM。',['pid_m, pid_n = program_ids()', 'rows = pid_m * BLOCK_M + arange(BLOCK_M)', 'cols = pid_n * BLOCK_N + arange(BLOCK_N)']),
 P('取局部 A/B','访存与布局','A[M,K]、B[K,N] + Stride','沿 K 分块并通过 Mask 读取边界','A_tile、B_tile','合并访问由数据布局和实际地址集合决定。',['for k0 in range(0,K,BLOCK_K):', '  a = masked_load(A[rows, k0:k0+BLOCK_K])', '  b = masked_load(B[k0:k0+BLOCK_K, cols])']),
 P('计算并累积','Triton dot / Matrix Pipeline','A_tile、B_tile','对输出 Tile 累积矩阵点积','acc: [BLOCK_M,BLOCK_N]','Tile 增大可能改善复用，也可能增加寄存器与 SMEM 压力。',['acc = zeros([BLOCK_M,BLOCK_N], accumulator_dtype)', 'for each k_tile:', '  acc += dot(a_tile, b_tile)']),
 P('写回与查机器码','GPU Kernel + Profiling','acc 和输出边界 Mask','转换 dtype，写回 C，并检查实际 Codegen','C[rows,cols]','必须对照 Mask 正确性、寄存器和 PTX/SASS 后才能判定优化有效。',['masked_store(C[rows,cols], cast(acc))', 'inspect(ttir, ttgir, llir, ptx, sass)', 'benchmark_and_check_correctness()'])],
 '伪代码省略真实 Triton 的指针广播、tl.constexpr、NumWarps、pipeline stages 和目标硬件限制。'),
D('runtime-graph','CUDA Graph 重放的是已捕获的工作及依赖；这不同于把多个 Kernel 融成一个。','示意：相同 Shape 连续执行 100 轮，小 Kernel Launch 频繁，考虑录制/复用 GPU 工作图。',
 [['Stream','有序提交 GPU 工作的 CUDA 队列'],['Event','设备任务完成及同步原语'],['Graph','设备任务及其依赖组成的可重放图'],['Replay','复用图执行，不代表重新编译 Kernel']], [
 P('普通逐步提交','Host / CUDA Runtime','每轮相同计算的 Tensor','CPU 按 Stream 发射多个 Kernel','GPU Task 依赖序列','Host Launch Gap 可能成为大量短 Kernel 的开销。',['for request_step in steps:', '  launch(norm_kernel)', '  launch(attention_kernel)', '  launch(mlp_kernel)']),
 P('捕获可重用工作','CUDA Graph Capture','稳定 Shape 和合法的地址/执行拓扑','录制节点与依赖，不立即把逻辑跨节点融合','Graph definition','动态 Shape、分支和地址生命周期可能限制捕获。',['begin_capture(stream)', 'run_same_gpu_operations_once()', 'graph = end_capture(stream)']),
 P('实例化与重放','CUDA Graph Exec','Graph + 有效输入输出 Buffer','准备资源后按实例提交整张工作图','设备任务逐节点执行','Graph 并不保证某个 Kernel 的设备时间缩短。',['graph_exec = instantiate(graph)', 'for step in decode_steps:', '  update_input_buffers(step)', '  launch_graph(graph_exec, stream)']),
 P('核对收益','Nsight Systems / Benchmark','普通路径与 Graph 路径时间线','比较 CPU 提交/设备空档和稳态延迟','Launch Gap 和 E2E 对比','不能把 Capture/编译成本混入稳态，正确性也必须一致。',['compare(cpu_submit_gap, gpu_idle_gap)', 'assert_same_outputs()', 'measure_steady_state_latency()'])],
 '捕获限制、更新能力和 Graph Memory 节点以具体 CUDA 版本与执行库为准。'),
D('gemm-tiling','从 C 的一个输出 Tile 向后追：其每个元素都需要 K 维乘加和 A/B 重用。','例：A[128,64]×B[64,128]，每个输出 Tile 64×64，共四个 Tile。',
 [['M','A 行数和 C 行数'],['N','B 列数和 C 列数'],['K','归约维度'],['SMEM','程序管理的 GPU Shared Memory']], [
 P('选输出位置','Block/Program 调度','M,N, tile_m,tile_n','计算 CTA/Program 负责的 C 行列','C_tile[BM,BN]','增大 Tile 并非单纯增加每 SM 并行度。',['pid_m, pid_n = tile_grid_position()', 'out_rows, out_cols = tile_offsets(pid_m,pid_n)']),
 P('分块搬运','Memory → 片上暂存','A 子矩阵、B 子矩阵','沿 K 加载并在 Tile 内多次复用','A_sub[BM,BK]、B_sub[BK,BN]','复用多少、是否异步搬运取决于实现与目标架构。',['for k0 in range(0,K,BK):', '  a_sub = load_A(rows,k0)', '  b_sub = load_B(k0,cols)']),
 P('执行矩阵乘加','Tensor Core / SIMT','已就绪的 A/B 子块','acc += A_sub @ B_sub','C_tile: [BM,BN]','是否使用 Tensor Core 依赖 dtype、布局和编译生成。',['acc += mma_or_dot(a_sub, b_sub)', 'wait_if_operand_not_ready()']),
 P('写回与对照','Store / Benchmark','累积 Tile 和边界条件','转换输出精度、写回与测误差','C[M,N]','吞吐受计算、片上容量、HBM 和管线重叠共同决定。',['store_output_tile(acc)', 'compare_to_reference()', 'measure_time_and_memory_transactions()'])],
 '不是精确 Blackwell tcgen05 的指令级模型，具体矩阵单元数据布局须按目标设备验证。'),
D('attention-tiling','Online Softmax 的核心是跨 K/V Tile 维持同一归一化基准。','一条 Query 的得分按两个 Tile 给出 [1,2] 与 [3,0]；第二块最大值更高，因此旧累计量需乘 exp(2−3)。',
 [['m','已经看过的最大 Logit'],['l','按最大值 m 重缩放后的指数权重之和'],['a','带 Value 权重的未归一化累积向量'],['tile','当前 K/V 子块']], [
 P('准备一块 Query','FlashAttention Kernel','Q_tile 与 K/V Tile 序列','初始化当前 Query 行的统计量','m=-∞、l=0、a=0','统计量针对 Query 行/Tile，示例省略多行和多头布局。',['m = -infinity; l = 0; a = zeros(Dv)', 'q = load_query_tile()']),
 P('处理当前 K/V Tile','GPU GEMM + Softmax','Q、K_tile、V_tile','计算本块 Scores、行最大值','scores, m_tile','不必把整张 Attention Score 矩阵存回 HBM。',['scores = dot(q, transpose(k_tile)) * scale', 'm_tile = row_max(scores)']),
 P('在线合并旧/新统计','片上统计量','m_old,l_old,a_old 和本块 scores','将旧值重缩放后叠加新块贡献','m_new,l_new,a_new','不能分别 Softmax 两块后再简单平均输出。',['m_new = max(m, m_tile)', 'alpha = exp(m - m_new)', 'p = exp(scores - m_new)', 'l = alpha*l + sum(p)', 'a = alpha*a + p @ v_tile; m = m_new']),
 P('归一化并写回','Output Store','全部块合并后的 a,l','最后只除一次归一化分母','o = a/l','分块主导降低 IO；点积的理论计算量并未直接变为线性。',['for kv_tile in all_tiles: update_online_stats()', 'out = a / l', 'store(out)'])],
 '真实 FlashAttention 有因果 Mask、padding、dropout、数值精度和流水线等细节。'),
D('profiling','性能归因从“发生在哪里”到“为什么发生”，最后才决定“改什么”。','示意：端到端 3ms，某 Kernel 10μs；即使把它缩短一半，总收益也有限，先找关键路径。',
 [['E2E','端到端真实延迟'],['NCU','Nsight Compute，GPU Kernel 计数器'],['Nsys','Nsight Systems，CPU/GPU 时间线'],['stall','Warp 无法发射的采样原因，不是耗时拆账比例']], [
 P('固定基线与正确性','Benchmark Harness','Shape、dtype、设备与软件版本','预热、同步边界、重复测量','稳定的 E2E 与 Kernel 基线','不能拿首次编译时间和稳态 GPU 时间直接比较。',['assert_numerical_correctness()', 'warmup_same_inputs()', 'baseline = repeat_measurement(n=30)']),
 P('检查系统关键路径','Nsight Systems','CPU API、GPU Kernel/ memcpy 时间线','定位空档、同步、Kernel 占比','最值得分析的执行段','GPU Idle 不等于 GPU Kernel 算得慢。',['timeline = capture_host_device_trace()', 'hotspots = find_critical_path(timeline)']),
 P('深入一个 Kernel','Nsight Compute / SASS','热点 Kernel 的 Shape、指令与 Memory 计数','区分吞吐受限、依赖等待、资源竞争','基于证据的瓶颈假设','Long Scoreboard 比例不能直接当成可消除的时间占比。',['metrics = profile_kernel(hotspot)', 'hypothesis = explain_with(metrics, sass, resources)']),
 P('单因素实验','对照组 / 实验组','相同输入与单一实现变化','验证耗时和指标同时改变的合理因果','复测结论或否定假设','只优化 Kernel 不一定改善端到端；需复测 E2E。',['candidate = change_one_factor(hypothesis)', 'assert_numerical_correctness(candidate)', 'compare_with_baseline(candidate, end_to_end=True)'])],
 '此处流程是研究方法，不是 Nsight 工具内部源代码。'),
D('host-runtime','看清 Host 的数据准备、GPU 任务提交和同步边界；CPU 函数返回不代表 GPU 已完成。','示意：CPU 产生 1MB 输入，把数据拷到 GPU 后异步执行 Kernel，再把结果带回 Host。',
 [['H2D','Host-to-Device，CPU 内存到 GPU 显存'],['Pinned','页锁定 Host 内存'],['Stream','CUDA 设备执行队列'],['Event','用于记录完成、依赖或测量的设备事件']], [
 P('准备主机输入','进程 / CPU','Python 数据结构与 Pageable 内存','整理 Shape、申请合法 Host/Device Buffer','Host Buffer / GPU Buffer','页面锁定内存有成本，不能假定所有场景都更快。',['host = prepare_numpy_batch()', 'gpu = allocate_device_buffer(shape,dtype)', 'pinned = maybe_pin_host_memory(host)']),
 P('异步搬运','DMA / Copy Engine','Pinned Host Buffer','将字节传到 GPU，并由 Stream 保持依赖顺序','GPU 输入可用','MemcpyAsync 的实际异步性受内存类型、设备和同步边界影响。',['copy_async(gpu, pinned, stream)', 'record_event(data_ready, stream)']),
 P('提交 Kernel','CUDA Runtime / Driver','GPU Buffer、Grid、Stream','将工作排队；提交后 CPU 可能继续执行','GPU 完成中的待执行任务','Host API 返回不是设备计算结束。',['stream.wait_event(data_ready)', 'launch_kernel(gpu, stream)', 'record_event(compute_done, stream)']),
 P('同步并读取结果','Host + GPU','GPU 输出与完成事件','在真正需要数据时等待，并校验结果','CPU 可用输出与端到端时间','过早 synchronize 可能消除拷贝与计算重叠。',['wait_event(compute_done)', 'copy_back_if_needed()', 'check_output_and_measure()'])],
 '此处的 copy_async/launch_kernel 为解释 CUDA 运行语义的伪 API；实际用 cudaMemcpyAsync、cudaLaunchKernel 等接口核对。'),
D('multi-gpu','把张量切分（TP）和专家分布（EP）分开，再追踪不同类型的 Collective。','示意 2 张 GPU：TP 分割线性层参数；EP 把 E0/E1 与 E2/E3 放在不同 GPU。',
 [['TP','Tensor Parallel：对层的张量/权重分片'],['EP','Expert Parallel：专家分布到不同设备'],['All-Reduce','把多卡的局部结果做归约并向参与者提供'],['All-to-All','参与设备之间交换不同的数据块']], [
 P('定义分布策略','Model Partition / Placement','模型参数与 GPU 拓扑','选择 TP、EP、DP 等组合，并映射参数','每卡本地持有的权重','EP 不代表整个层不需要其他通信。',['layout = plan_parallelism(model, devices)', 'place_weight_shards(layout)']),
 P('执行本地分片','各 GPU Kernel','GPU 本地 X 与本地参数','执行分片 GEMM 或本地 Expert FFN','每卡局部 Output','GPU 数变多会让每卡矩阵变小，可能损失计算效率。',['partial = run_local_weight_shard(x_local)', 'expert_out = run_local_selected_experts()']),
 P('交换/归约','NCCL / 通信后端','局部中间结果或 Token 分桶','TP 按算子需求归约；EP 按专家位置交换激活','一致的下游输入或 Token 输出','不是所有层都 All-Reduce，也不是所有 EP 都走框架发起的相同 A2A。',['tp_output = all_reduce_if_required(partial)', 'ep_tokens = all_to_all_if_remote_experts(tokens)']),
 P('恢复输出并分析','模型输出 + Profiling','通信完成的结果','按原请求位置合并并统计链路开销','完整层输出与分布式时间线','P99 往往受最慢 GPU、网络拥塞与负载倾斜影响。',['y = restore_original_token_order(ep_tokens)', 'measure_compute_communication_overlap()', 'check_results_against_reference()'])],
 '多卡拓扑、collective 选择、序列并行、DeepEP 后端各不相同，此处只讲 TP/EP 典型机制。'),
D('warp-issue','Warp 发射先满足数据依赖，再受可用发射槽和执行管线约束。','教学 3 Warp：W0 的 Load 等待时，W1/W2 可以先发射；全部不可就绪时出现 Issue 空泡。',
 [['Active Warp','已驻留 SM/SMSP 上的 Warp'],['Eligible Warp','本周期具备发射条件的 Warp'],['Issued Warp','本周期实际发射了指令的 Warp'],['Scoreboard','用于跟踪部分操作数/指令依赖的机制']], [
 P('确定驻留资源','SM / SMSP','CTA、寄存器、SMEM、线程数','计算可驻留的 Warp 集合','Active Warps','Occupancy 仅描述驻留程度，不等于发射效率。',['active = admit_warps(blocks, registers, shared_mem)', 'ready_queue = active']),
 P('检查指令依赖','Scoreboard','每 Warp 下一条指令及其操作数','过滤尚未就绪的 Warp','Eligible Warps','等待不意味着 SM 每个执行单元都完全空闲。',['eligible = []', 'for warp in active:', '  if operands_ready(warp.next_instr): eligible.append(warp)']),
 P('选择并发射','Warp Scheduler / Port','Eligible 集合、发射槽和管线状态','按硬件策略安排可发射指令','本周期 Issued 指令','Eligible 高但 Issued 低，可能是发射资源受限。',['for slot in available_issue_slots:', '  warp = select_eligible_warp(eligible, pipeline_capacity)', '  if warp: issue(warp.next_instr)']),
 P('等待结果并继续','执行单元 / Cache / Memory','Load、MMA 等未完成依赖','结果就绪后更新指令可发射状态','下一周期的 Eligible 集合','周期示意不能当作 Blackwell 实际 Warp Scheduler RTL。',['when result_ready:', '  update_dependency_state()', 'next_cycle()'])],
 '伪代码只描述通用指令就绪/发射抽象，不声称公开 NVIDIA 内部的具体选择策略与物理管线。'),
D('memory-route','同样读取 128 Byte 有用数据，地址合并情况不同，底层覆盖的内存段可能差很多。','32 个 Lane 各读 4 Byte：连续取值通常覆盖 4 个 32B 段；Stride=8 可覆盖 32 段（仅示意地址）。',
 [['Lane','Warp 内一条线程的索引'],['Stride','相邻 Lane 地址的元素间隔'],['Segment','图中按 32B 对齐的地址区间'],['L1/L2','GPU 缓存层次，不等同 Shared Memory']], [
 P('生成地址集合','Kernel 的线程索引','base、lane、stride、element_bytes','计算每个 Lane 的真实字节地址','addr[0..31]','有用数据字节数一样，不保证底层读取字节数一样。',['for lane in range(32):', '  addr[lane] = base + lane*stride*element_bytes']),
 P('分析访问覆盖','Load/Store 管线','Warp 的 32 个地址','映射到对齐的内存段并检查重复','covered_segments','这仅是段覆盖教学模型，不是所有真实事务统计。',['segments = set(floor(a/32) for a in addr)', 'coverage = len(segments) * 32']),
 P('走缓存/显存路径','L1/L2 / HBM','Cache Line 与地址','根据命中、队列、并发访问获得数据','Load 返回值与等待延迟','Shared Memory 是软件显式管理的空间，不会自动作为普通 Load 必经层。',['if cache_hit(address): read_from_cache()', 'else: fetch_from_next_level()']),
 P('用指标验证','Nsight Compute','访存事务、Hit、Stall、Kernel Time','结合指令与数据依赖判断瓶颈','经核验的访存归因','L2 Hit 上升不能直接等于 Kernel 一定更快。',['inspect(memory_transactions, hit_rate, warp_stall)', 'run_controlled_stride_experiment()'])],
 '32B Sector 覆盖是教学抽象；真实 Cache、合并和重放行为随 GPU 架构与数据布局改变。'),
D('tensorcore-b200','Blackwell GEMM 的挑战不只是矩阵乘法，而是让 Tile 正确按时抵达计算单元。','示意双缓冲：Producer 把 Tile i+1 装进 Buffer B，Consumer 用 Buffer A 计算 Tile i。',
 [['TMA','Tensor Memory Accelerator：异步搬运相关硬件能力'],['MMA','Matrix Multiply-Accumulate'],['Barrier','生产者/消费者之间的同步与可见性约束'],['SMEM','Shared Memory，软件管理的片上共享存储']], [
 P('安排 Tile 生产/消费','Kernel Pipeline 规划','矩阵 A/B、Tile Shape','为多阶段分配 SMEM/工作缓冲与 Barrier','buffer0 / buffer1 / barrier','阶段数过多会增加片上资源压力，可能限制并发。',['buffers = allocate_pipeline_buffers(stages=2)', 'barriers = initialize_barriers()']),
 P('异步搬运下一块','Producer 路径','HBM 中的 Tile i+1','在满足地址/布局前提下发起数据搬运','下一块在 SMEM 待就绪','并非每个 Kernel 或所有 Load 都自动使用 TMA。',['launch_async_tile_copy(tile_next, buffer_free)', 'signal_when_bytes_arrived()']),
 P('等待并计算当前块','Consumer / Tensor Core','已经到齐的 Tile i','同步等待数据就绪，提交矩阵指令并累积','Accumulator / 可重用缓冲','Barrier/Fence 错误会造成数据竞争和数值错误。',['wait_for_tile_ready(buffer_current)', 'acc = mma(acc, a_tile, b_tile)', 'release_buffer_after_use()']),
 P('切换阶段和检查','Kernel Schedule / Profiling','Tile i 完成、Tile i+1 就绪','交换缓冲角色，完成后写出结果','输出矩阵与 pipeline 时间线','观察是否真正重叠 Load/MMA，不要用峰值 FLOPs 猜结论。',['swap(producer_buffer, consumer_buffer)', 'store_accumulator(acc)', 'verify_barriers_and_profile()'])],
 '这里只表达 Blackwell 异步数据流基本约束；不声称某版 B200 上的具体 tcgen05 指令格式或周期数据。'),
D('spec-decode','草稿模型先猜多个 Token，目标模型批量验证；只接受满足算法规则的连续前缀。','例：Draft 提出 [A,B,C]，Target 验证后只接受前两个，后面的候选不能直接盲用。',
 [['Draft','成本较低的候选生成网络或预测头'],['Target','需要维持输出分布正确性的主模型'],['k','一次提出的候选 Token 数'],['accept','按验证规则接受的候选前缀长度']], [
 P('提出候选','Draft / MTP','前缀上下文和隐藏状态','生成或预测后续多个候选位置','draft_tokens[0:k]','MTP 候选结构不一定是独立小模型。',['candidates = draft.propose(prefix,k)', 'draft_probs = draft.probabilities(candidates)']),
 P('一次验证多个位置','Target Forward','prefix + candidates','在支持的路径中一起评估候选位置的概率','target_probs / verify_data','目标模型并不是完全不需要计算被验证位置。',['target_probs = target.forward_and_score(prefix,candidates)', 'verify_data = inspect_candidate_positions(target_probs)']),
 P('按规则接受前缀','Speculative Sampling','目标与草稿概率、随机数','依算法拒绝/接受，保持所需目标分布','accepted_prefix / 修正 Token','精确随机采样与贪心匹配的接受规则不同，不能任意改写。',['accepted, correction = verify_under_algorithm_rule(', '  candidates, draft_probs, target_probs)', 'output.extend(accepted)', 'if correction is not None: output.append(correction)']),
 P('更新缓存与继续','Engine / Cache','已接受的 Token 与候选状态','丢弃无效候选位置，更新 KV 和请求状态','继续生成的新前缀','接受率低时 Draft 和验证额外工作可能抵消收益。',['cache.commit_accepted_positions(accepted)', 'cache.rollback_rejected_candidates()', 'continue_decode_with_updated_prefix()'])],
 '展示通用思路：不同采样方式与 EAGLE/MTP 实现的验证、缓存和并行策略需以算法和源码为准。'),
D('quant-pipeline','低比特不是把 FP16 数字“改个名字”；需要缩放、打包、计算与误差控制。','例：每组 32 个权重用共享 Scale 做 4-bit 表示，运行时可能融合反量化与 GEMM。',
 [['q','量化整数/低精度编码'],['s','量化 Scale，代表存储值与真实值的比例'],['group','共享 Scale 的一组元素'],['dtype','FP8、FP4、INT8 等格式及计算类型']], [
 P('确定量化方案','离线转换 / Calibrate','原始浮点权重 W','选择格式、分组、Scale 与校准方法','q,scale,metadata','FP4/FP8 格式与缩放规则多样，不能套一个整数公式。',['for group in W.groups:', '  scale = calibrate_scale(group)', '  q = encode_low_precision(group, scale)']),
 P('打包/加载权重','存储与 Kernel Load','q、Scale、元数据','按硬件/Kernel 需要组织位布局和片上数据','可计算的低比特 Tile','打包可减少 HBM 字节，但增加解码与布局处理。',['packed = pack(q, target_layout)', 'q_tile, s_tile = load_packed(packed, scale)']),
 P('执行矩阵计算','GPU Tensor Core / Dequant','激活 X 与量化权重','直接低精度计算，或融合解码后矩阵乘法','Y 的累加结果','累加 dtype、舍入和混合精度会影响结果。',['weight_tile = decode_or_scale(q_tile, s_tile)', 'Y += matmul(X_tile, weight_tile, accumulate_dtype)']),
 P('核对模型质量','Accuracy + Performance','原精度与低精度输出','比较层级误差、任务质量和端到端性能','误差范围及系统收益','低精度 Kernel 更快不代表整模型准确性和端到端都更好。',['compare_numerical_error(reference, quantized)', 'evaluate_model_quality()', 'profile_memory_and_compute()'])],
 '伪代码示意共享 Scale 类方案，FP4 块缩放、NVFP4/MXFP 等须核对具体格式与版本。'),
D('fused-norm','RMSNorm、RoPE 和 SwiGLU 是不同计算；它们的融合收益来自数据流而非更改数学定义。','例：一条宽度 H=128 的 Token 向量先 RMSNorm，再 Linear；Norm 的每行归约可以融合后续计算的一部分。',
 [['eps','数值稳定用的小正数'],['H','每个 Token 的隐藏通道数'],['RoPE','对 Q/K 相邻维对做位置相关旋转'],['SwiGLU','门控分支激活后与 Up 分支逐元素相乘']], [
 P('归一化向量','RMSNorm Kernel','x: [T,H]','按 H 维算平方均值后按比例缩放','x_norm: [T,H]','RMSNorm 不减均值；这与 LayerNorm 不同。',['rms = sqrt(mean(x*x, axis=H) + eps)', 'x_norm = (x/rms) * gamma']),
 P('按位置旋转 Q/K','RoPE Kernel','Q/K、位置索引、sin/cos','按维对旋转，将位置编码到向量','q_rot,k_rot','RoPE 不直接改 V；具体交错/维度布局有实现差异。',['q_rot = rotate_pairs(q, sin(pos), cos(pos))', 'k_rot = rotate_pairs(k, sin(pos), cos(pos))']),
 P('门控前馈','Expert 或 Dense MLP','归一化隐藏向量','分别做 Gate/Up，激活后逐元素相乘，再 Down','mlp_out: [T,H]','不只是单个 Linear + Bias。',['gate = silu(x_norm @ W_gate)', 'up = x_norm @ W_up', 'mlp_out = (gate * up) @ W_down']),
 P('选择融合边界','编译器 / Fused Kernel','相邻算子的读写依赖','避免临时 Tensor 落到 HBM，权衡 Reg/SMEM','更少中间读写但数学等价','跨归约维度的融合可增加寄存器、同步与正确性复杂度。',['fuse_when_legal(shape, dtype, dependencies)', 'validate_fused_output_and_resource_usage()'])],
 '分别解释三个算子；它们并不必然被合成“一个”实际 Kernel。'),
D('mla-kv','MLA 缓存的是可用于恢复 K/V 的低秩潜表示，关键是矩阵吸收而非简单删除 K/V。','示意：KV 潜向量维度 r 低于完整多头 K/V 宽度；RoPE 相关分量需单独处理。',
 [['c_KV','KV 低秩压缩后的潜表示'],['r','KV 压缩维数'],['W_DKV','KV 下投影权重'],['W_UK/W_UV','从潜表示恢复 Key/Value 的投影参数']], [
 P('压缩当前 KV 表示','MLA Down Projection','hidden: [T,H]','把隐藏状态投影到较小的 KV 潜空间','c_KV: [T,r]','压缩带来缓存空间节省，但算子仍需维持注意力语义。',['c_kv = hidden @ W_DKV', 'k_rope = rope_component(hidden, position)']),
 P('写入历史缓存','KV Cache Manager','c_KV + RoPE 分量','缓存潜向量而非全部展开的每头 K/V','history_c_kv + history_k_rope','RoPE 部分与低秩内容的处理方式随架构而异。',['cache.append(c_kv, k_rope)', 'history = cache.get_compressed_history()']),
 P('选择恢复/吸收路径','Attention 后端','Query + c_KV + 投影矩阵','可显式恢复 K/V，也可通过矩阵吸收改变乘法次序','注意力得分与输出权重','矩阵吸收要仔细核对 Head、RoPE 和缓存布局，不能当随意删掉投影。',['if explicit_path:', '  k = history_c_kv @ W_UK', '  v = history_c_kv @ W_UV', 'else:', '  q_absorbed = absorb_key_projection(query, W_UK)']),
 P('完成注意力输出','MLA Attention Kernel','分数、潜变量或恢复的 Value','按注意力权重聚合输出并投影','context: [T,H]','实际 Kernel 性能依赖 Cache 字节、GEMM 形状和融合策略。',['context = ml_attention(query, cache, projection_mode)', 'validate_same_attention_result()'])],
 '本节是 MLA 压缩思路和吸收路径抽象，并非完整 DeepSeek 架构或 FlashMLA 逐函数实现。'),
D('linear-state','用一类线性注意力的显式状态递推，解释为何 Decode 不必回看全部历史 KV。','示意特征映射 φ≥0；状态 S 维护历史 Key 的外积累积，每到一个 Token 更新一次。',
 [['φ','选定的非负特征映射，某些线性 Attention 用它近似核'],['S','历史 Key-Value 累加矩阵'],['z','历史 Key 特征累加向量'],['q,k,v','当前 Query、Key、Value']], [
 P('变换 Q/K','线性注意力模块','q_t,k_t,v_t','经特征映射构造可递推的相似度','φ(q_t),φ(k_t)','不是所有线性注意力/SSM 都使用同一个 φ。',['qf = feature_map(q_t)', 'kf = feature_map(k_t)']),
 P('更新历史状态','State Update Kernel','S_{t-1},z_{t-1},kf,v_t','把新 Token 的外积和特征加到状态','S_t,z_t','历史信息被编码进固定形状状态，但精确表达能力与 softmax 注意力不同。',['S = S + outer(kf, v_t)', 'z = z + kf']),
 P('读取当前输出','State Readout','qf,S,z','用当前 Query 查询状态，做归一化','o_t','分母需要稳定性保护，归一化定义依模型而定。',['numerator = qf @ S', 'denominator = qf @ z + eps', 'o_t = numerator / denominator']),
 P('考虑并行化','Prefill/Decode Kernel','连续状态递推与序列输入','Prefill 可并行 Scan/Chunk，Decode 常用 State 更新','有效算法和执行计划','递推数据依赖、数值稳定、Tensor Core 使用需结合具体模型测试。',['prefill = parallel_scan_or_chunk(tokens)', 'decode = recurrent_step(state, new_token)'])],
 '这是核化线性 Attention 的一个教学公式，不代表 DeltaNet、Mamba、Gated Delta 等结构完全相同。'),
D('frameworks','比较 vLLM、SGLang、TensorRT-LLM 时，先对齐模型/负载/后端，再解释结果。','假设两个引擎都能运行同一模型，但一个有更好调度、另一个有更高效特定 GEMM。谁更快取决于请求分布。',
 [['Engine','组织模型执行的推理引擎'],['Kernel Backend','实际运行 GEMM/Attention 等 Kernel 的实现'],['SLO','线上时延/质量约束'],['TTFT/ITL','首 Token 等待和 Token 间延迟']], [
 P('对齐功能范围','Serving API / Config','模型版本、精度、硬件和请求协议','确认兼容功能、并行度及实现路径','可比较的实验条件','不要在不同模型/量化/Batch 下直接比 tokens/s。',['config = fix(model, dtype, gpu_budget, request_mix)', 'assert_both_engines_support(config)']),
 P('观察调度与缓存','Engine / Scheduler','到达的请求和 Cache 策略','决定可并发的请求与每轮计算','不同的 Batch Shape','Prefix Cache、Chunked Prefill、PD 选择会改变实际工作负载。',['batch = engine.scheduler.admit(requests)', 'cache = engine.prepare_kv(batch)']),
 P('确认具体 GPU Kernel','Model Runner / Compiler','Batch 输入和模型权重','查看实际选用的算子库/编译 Kernel','GPU Timeline','不能把框架性能差异全部归结为 Scheduler。',['kernels = inspect_model_runner_backend(engine)', 'trace = capture_kernels(kernels)']),
 P('评估同一组 SLO','Benchmark / Report','相同到达轨迹、输出质量','测吞吐、TTFT/ITL、P99、GPU 成本','有效服务量而非单点峰值','离线峰值、线上 P99 与维护成本可能产生不同排名。',['metrics = replay_equal_arrival_trace(config)', 'compare(goodput, p99_itl, ttft, gpu_cost)', 'verify_numerical_or_output_quality()'])],
 '各框架版本快速演进，示意接口非其真实公共 API；以当前官方文档核对调度与后端功能。')
];

export const codeTourById=new Map(codeTours.map(t=>[t.id,t]));
export function validateCodeTours(ids){
 const known=new Set(ids);const seen=new Set();
 for(const t of codeTours){
  if(seen.has(t.id)||!known.has(t.id))throw new Error('未知/重复代码导读：'+t.id);
  seen.add(t.id);
  if(!t.lead||!t.example||!t.caveat||t.phases.length<3||t.terms.length<3)throw new Error('课程内容缺失：'+t.id);
  for(const p of t.phases)if(!p.title||!p.owner||!p.input||!p.action||!p.output||!p.reason||p.code.length<2||p.code.some(line=>typeof line!=='string'||!line.trim()))throw new Error('阶段不完整：'+t.id);
 }
 if(seen.size!==known.size)throw new Error('存在尚未编写代码导读的深度专题：'+[...known].filter(x=>!seen.has(x)).join(','));
 return true;
}
