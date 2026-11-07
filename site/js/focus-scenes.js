/** V1.7：小屏优先、逐环节专用图。完整复杂机制图仍可在同页展开。 */
import {flashStats,pedagogicalWarpCycles} from './mechanism-studio.js';
const e=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const box=(title,detail='',focus=false)=>`<div class="fs-box ${focus?'active':''}"><strong>${e(title)}</strong>${detail?`<small>${e(detail)}</small>`:''}</div>`;
const arrow=()=>'<span class="fs-arrow" aria-hidden="true">→</span>';
const line=(...items)=>`<div class="fs-line">${items.join(arrow())}</div>`;
const chips=(arr)=>`<div class="fs-chips">${arr.map((x,i)=>`<span class="${i===0?'active':''}">${e(x)}</span>`).join('')}</div>`;
function pd(i){switch(i){
 case 0:return [line(box('客户端','Prompt / 请求'),box('Router','选择 P / D',true),box('P / D 实例','各自装有模型')),'路由只决定谁做哪一段计算，不是把 Transformer 的前半层放在 P，后半层放在 D。'];
 case 1:return [line(box('输入 Token','一次处理上下文'),box('P GPU','执行模型前向',true),box('各层 K/V','缓存历史上下文')),'Prefill 端产生的历史 KV，才能让 Decode 端正确利用之前的输入。'];
 case 2:return [line(box('P 端 KV 块','历史 K/V'),box('传输 / 就绪确认','按后端实现',true),box('D 端 KV 块','已匹配、可读取')),'收到「Prefill 完成」通知不等于已拿到 KV；两端还要协调块映射与数据就绪。'];
 case 3:return [line(box('历史 KV + 新 Query'),box('D 端 Attention','按步执行',true),box('新 Token + 新 KV')),'Decode 仍会运行模型；它使用历史 KV 并不断追加新的状态。'];
 default:return [`<div class="fs-compare">${box('混部 GPU','Prefill / Decode 竞争资源')}${box('分离 P + D','独立调参，但新增 KV 传输',true)}</div>`,'比较同样 GPU 总预算下的 TTFT / ITL / Goodput 与通信开销。'];
}}
function scheduler(i){if(i===1||i===2){const parts=i===1?['A',...Array(7).fill('B')]:['A',...Array(3).fill('B'),...Array(4).fill('C')];return [`<div class="fs-budget"><b>本轮预算 = 8 Tokens</b><div>${parts.map((x,j)=>`<span class="fs-token fs-${x.toLowerCase()}">${e(x)}</span>`).join('')}</div><small>A：Decode 1 个；B：长 Prompt；C：短 Prompt</small></div>`,i===1?'第 1 轮 A=1、B=7、C=0；B 的 Prefill 还没算完。':'第 2 轮 A=1、B=3、C=4；剩余预算允许 C 进入。本例假设 KV 资源足够。'];}
 if(i===0)return [line(box('Running A'),box('Waiting B / C'),box('Scheduler','读取请求状态',true)),'调度器不只看请求数量，还要看每条请求已计算多少 Token、剩余多少 Token。'];
 return [line(box('本轮分配','A/B/C 各算几个'),box('Model Runner','准备输入元数据',true),box('模型 Kernel','GPU 执行')),'Scheduler 决定算什么，Runner 决定怎样把本轮模型计算交给设备。'];
}
function compiler(i){const flows=[
 [line(box('Mul','写临时 t1'),box('Add','写临时 t2'),box('ReLU','输出 y')),'数学表达式可能对应多个独立 Kernel 和中间 Tensor。'],
 [line(box('Python / PyTorch'),box('Dynamo','捕获 FX Graph',true),box('编译可分析的算子图')),'Guard / Graph Break 决定哪些操作能进入编译区。'],
 [`<div class="fs-compare">${box('Eager','多次全量中间读写')}${box('融合 Kernel','一次 Load → 计算 → Store',true)}</div>`,'融合可能减少 HBM 读写与 Launch；但数学运算仍要执行，也可能增加寄存器压力。'],
 [line(box('Triton / 后端'),box('IR 与 Lowering','布局和指令',true),box('PTX → SASS')),'PTX 是虚拟 ISA，设备实际执行的是 SASS；不同 Kernel 也可能走预编译库。'],
 [line(box('输入与设备代码'),box('CUDA Runtime','Launch / Stream',true),box('GPU 执行结果')),'编译期和稳态执行时间必须区分，才能判断真实优化收益。']
 ];return flows[i]||flows[0]}
function attention(i){const stats=flashStats(i);if(i===0)return [`<div class="fs-chunks">${box('Query','固定 1 行',true)}${box('K/V Tile ①','scores 1,2')}${box('K/V Tile ②','scores 3,0')}</div>`,'不用先把完整 S×S 分数矩阵写入 HBM。'];if(i===1)return [chips(['m = 2','l ≈ 1.368','a ≈ 2.368']),'第一块的 Softmax 统计量按每个 Query 行维护。'];if(i===2)return [chips(['新 m = 3','旧统计 × exp(−1)','累加新 Tile']),'当最大分数从 2 升到 3，旧分母与累积值都要重缩放，不能简单平均两块输出。'];return [line(box('m、l、a','已遍历全部 Tile'),box('a / l',`输出约 ${stats.second.out.toFixed(3)}`,true)),'输出与全局 Softmax 的数学结果对应；稠密注意力的点积计算量级仍在。'];}
function warp(i){const focus=[0,1,4,6,7][i]||0;const cycles=pedagogicalWarpCycles.slice(0,8);return [`<div class="fs-cycles">${cycles.map(s=>`<div class="${s.c===focus?'active':''} ${s.kind==='idle'?'empty':''}"><small>c${s.c}</small><strong>${e(s.instr)}</strong></div>`).join('')}</div>`,i===0?'三个 Warp 都 Active，并不意味着每个周期都 Eligible。':i===1?'W0 等待加载的结果，W1/W2 仍可能占用可发射槽。':i===2?'其他 Warp 先发射，能隐藏部分等待时间。':i===3?'当所有 Warp 都因依赖不可发射时会出现空泡。':'即使 Eligible 很多，仍可能遇到发射/执行资源上限。'];}
const scenes={'pd-disagg':pd,'vllm-scheduler':scheduler,'compiler-lowering':compiler,'attention-tiling':attention,'warp-issue':warp};
export function focusScene(id,step=0){const fn=scenes[id];if(!fn)return '';const [visual,note]=fn(step);return `<figure class="focus-scene"><div class="focus-scene-content">${visual}</div><figcaption>${e(note)} <span>机制教学示意</span></figcaption></figure>`;}
