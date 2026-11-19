const math = (body) => `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${body}</math>`;
/** Evidence is scoped to the selected question, never borrowed from an unrelated chapter. */
export const engineSystemEvidence = {
  "vllm-scheduler/runner": {
    terms: [["computed", "轮前已完成模型计算的位置数；computed=6表示p0…p5已算"], ["p6", "从0编号的第6号位置，即该请求第7个位置；不是Token ID=6"], ["Packed区间 [a,b)", "本轮打包数组从a到b−1的行，长度为b−a；不是请求内位置编号"]],
  },
  "vllm-scheduler/diagnose": {
    question: "固定首轮：A已算6个位置、占2块；B/C各有6/4个输入待算。每块4位置、总容量2块、预算8，无抢占。为什么只安排A1，仍剩7个计算名额？",
    options: ["剩余7个名额应该强行填给B/C", "A能用已有尾块；B/C拿不到新块，增加Token预算也解决不了", "B/C没得到预算，就说明它们已经结束"],
    correct: 1,
    explain: "A从6算到7位置仍只需ceil(7/4)=2块。B和C都要新块，但总共2块已归A；它们被暂缓且不扣计算预算。把容量改为16才能解除此例的缓存约束，单改Token预算无效。",
  },
  "serving-slo/load": {
    code: "# 相同服务3ms，对比不同客户端到达机制\nfinish=0\nfor i in range(4):\n arrival=finish if closed_loop else i\n start=max(arrival,finish)\n finish=start+3\n record(arrival,start,finish,finish-arrival)\n# 保留两种到达轨迹，不能只比四个响应数",
  },
  "memory-route/shared": {
    terms: [["G / S", "全局内存中的Tile / 显式搬入Shared的副本"], ["消费者C0/C1", "读取同一组4元素并计算不同结果的任务"], ["逻辑读取", "代码语义上的读取次数，不是DRAM实际传输次数"]],
  },
  "pd-disagg/bytes": {
    formula: math("<mrow><msub><mi>M</mi><mi>KV</mi></msub><mo>=</mo><mn>2</mn><mi>L</mi><msub><mi>h</mi><mi>kv</mi></msub><mi>d</mi><mi>T</mi><mi>b</mi></mrow>"),
    derive: ["L=32层，h_kv=8头，d=128元素，T=2048位置，b=2Byte/元素。", "先算K/V两份×层×头×维度×长度，共134217728个元素；再乘2Byte得268435456Byte，即256MiB。", "长度8192时四倍为1073741824Byte。此式假设每层相同标准KV头布局，不直接适用于MLA潜向量或所有混合层。"],
    terms: [["M_KV", "指定布局下需要交接的KV字节数"], ["2 / L / h_kv", "K和V两份 / 层数 / 每层KV头数"], ["d / T / b", "头维元素数 / 位置数 / 每元素Byte"]],
  },
  "pd-disagg/critical": {
    question: "P在12ms已交付首Token，KV转运再用10ms、D首步2ms；忽略其它开销，转运直接落入哪个边界？",
    options: ["首Token已经交付，所以此处可能扩大随后ITL到12ms", "TTFT必须为24ms", "所有延迟都必须除以GPU数"], correct: 0,
    explain: "本例TTFT在P端12ms已经结束；下一个Token到24ms，相邻间隔为12ms。若选择等D才首发，TTFT边界会不同。实际结果需记录真实交付时间。",
    terms: [["TTFT", "请求到达至用户收到首Token的间隔"], ["ITL", "用户看到相邻Token交付的间隔"], ["交付策略", "首次向用户输出的时点，可能与KV数据转移完成时点不同"]],
  },
  "serving-slo/metrics": {
    formula: math("<mrow><mi>TTFT</mi><mo>=</mo><msub><mi>t</mi><mn>1</mn></msub><mo>−</mo><msub><mi>t</mi><mi>arrival</mi></msub></mrow>") + math("<mrow><msub><mi>ITL</mi><mi>i</mi></msub><mo>=</mo><msub><mi>t</mi><mrow><mi>i</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>−</mo><msub><mi>t</mi><mi>i</mi></msub></mrow>"),
    derive: ["请求t=0到达，t=1开始，三个Token在t=[3,5,9]ms交付。", "TTFT=3−0=3ms；ITL分别5−3=2ms和9−5=4ms。整条完成时延9ms。", "只额外等待3ms，交付变[6,8,12]：TTFT变6、总时延变12，ITL仍为[2,4]。这解释了为什么首Token与生成节拍须分开量。"],
    terms: [["t_arrival", "用户请求到达时刻；本图0ms"], ["t_i", "第i个输出Token的交付时刻，i从1开始"], ["ITL_i", "第i与第i+1个交付之间的毫秒间隔"]],
    limit: "人工三Token时间戳只核对计量边界，未模拟真实动态Batch、网络缓冲或足量样本的分位数。",
  },
  "host-runtime/dependency": {
    code: "# 教学职责骨架，不是CUDA可直接调用的函数名\nsubmit_producer_write(A, stream0)\neventE = record_after_producer(stream0)\nwait_for_event(stream1, eventE)\nsubmit_consumer_read(A, stream1)\n# 只有依赖A的消费者等待E；无关任务可继续",
    source: "https://docs.nvidia.com/cuda/cuda-runtime-api/api-sync-behavior.html",
    section: "CUDA异步提交与完成是不同边界；具体Stream/Event依赖另按API契约核查。",
  },
  "warp-issue/resources": {
    code: "# 教学核验顺序，不填写未测的数字\nfor variant in same_workload_variants:\n verify_output(variant)\n record_compiler_registers_and_spills(variant)\n record_active_eligible_issued(variant)\n record_elapsed_time_and_conditions(variant)\n# 驻留提高，不自动推出Eligible或端到端性能提高",
    terms: [["Occupancy", "驻留Warp数量占设备允许上限的比例"], ["Spill", "寄存器放不下的值改存到其它存储，可能增加访存"], ["Eligible", "下一指令的依赖与执行资源已满足的Warp"]],
  },
  "quant-pipeline/backend": {
    code: "q=[2,-4,1,0]; scale=0.5; x=[1,2,-1,3]\nexpanded=[v*scale for v in q]\ny1=sum(a*b for a,b in zip(x,expanded))\ny2=scale*sum(a*b for a,b in zip(x,q))\nassert y1==y2==-3.5\n# 单一Scale的精确实数恒等式；实际低精度累加和融合舍入须另核对",
    question: "教学例先展开比消费时解码多一份16Byte权重缓冲，是否已证明后者快3倍？",
    options: ["是，24/8=3就是性能比", "否，还需解码、算术指令、资源与真实时长；同时检查精度", "是，所有输入输出也都会缩小3倍"], correct: 1,
    explain: "本账本只量化码、Scale和临时展开副本，不是所有字节，更不是时延。两路径数学输出相同也不能保证有限精度Kernel或任务质量完全相同。",
    terms: [["q / Scale", "整数权重码 / 本例共用的0.5缩放"], ["x / w", "输入向量 / 解码后权重向量"], ["全量展开", "显式保留一份浮点权重副本；与局部按需解码区分"]],
  },
  "multi-gpu/gather": {
    code: "rank0=[1,2]; rank1=[3,4]\nallgather=rank0+rank1 # 两卡各得[1,2,3,4]\nreduced=[a+b for a,b in zip(rank0,rank1)]\nreduce_scatter=[reduced[:1],reduced[1:]]\nassert reduce_scatter==[[4],[6]]\n# 实际Collective需所有Rank匹配组、count、dtype及调用次序",
  },
  "frameworks/backend": {
    code: "# 固定同一个请求及数值要求；这是核验骨架\nrequested = freeze(model_revision, shape, dtype, quantization)\nselected = resolve_supported_backend(requested)\nrecord_selection_and_fallback(selected)\nrun_and_check_output(requested, selected)\nrecord_actual_kernel_and_graph_path()\n# 配置名称和设备实际路径必须同时留证",
    terms: [["支持条件", "dtype、shape、量化及模式必须共同满足"], ["派发", "按有效条件选择具体执行实现"], ["回退", "首选不可用时按策略改走其它合法实现"]],
  },
};

export const engineSystemFigureTerms = {
  "scheduler-packed-input": engineSystemEvidence["vllm-scheduler/runner"].terms,
  "shared-consumers": engineSystemEvidence["memory-route/shared"].terms,
  "arrival-modes": [["开放到达", "请求按预定时刻到达，不等前一个完成"], ["闭环到达", "客户端等上一个完成后才发下一个"], ["响应时延", "本请求的完成时刻减到达时刻"]],
  "streaming-metrics": engineSystemEvidence["serving-slo/metrics"].terms,
  "warp-resources": engineSystemEvidence["warp-issue/resources"].terms,
  "framework-backends": engineSystemEvidence["frameworks/backend"].terms,
  "quant-execution": engineSystemEvidence["quant-pipeline/backend"].terms,
  "pd-delivery-metrics": engineSystemEvidence["pd-disagg/critical"].terms,
};
