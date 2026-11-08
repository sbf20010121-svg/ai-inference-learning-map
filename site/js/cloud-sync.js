/** Private GitHub sync client. Does not receive, store, or display GitHub API tokens. */
const URL_KEY='atlas-cloud-api-url-v1';
const TOKEN_KEY='atlas-cloud-session-v1';
const DIRTY_KEY='atlas-cloud-dirty-v1';
const REVISION_KEY='atlas-cloud-revision-v1';
const PAIRED_KEY='atlas-cloud-paired-v1';
const RETURN_HASH_KEY='atlas-cloud-return-hash-v1';
const $=id=>document.getElementById(id);
const escape=(s='')=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const store=()=>{try{return localStorage}catch{return null}};
const session=()=>{try{return sessionStorage}catch{return null}};
const load=(storage,k)=>{try{return storage?.getItem(k)||''}catch{return ''}};
const save=(storage,k,value)=>{try{if(value===null)storage?.removeItem(k);else storage?.setItem(k,value)}catch{}};
const validApi=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'?u.origin:null}catch{return null}};
function parsedTokenExpiry(token){try{const base=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const p=JSON.parse(atob(base));return Number(p.exp)||0}catch{return 0}}
const containsUserInfo=data=>Object.keys(data?.progress||{}).length>0||Object.keys(data?.depthProgress||{}).length>0||Boolean(data?.knowledgeGraph?.nodes?.length||data?.knowledgeGraph?.edges?.length);
export function createCloudSync({readLocal,applyRemote}){
 let api=validApi(load(store(),URL_KEY))||'', token=load(session(),TOKEN_KEY), remoteSha=load(store(),REVISION_KEY)||null, busy=false, changedCounter=0, timer=null, awaitingChoice=null, info='', status='local', suppress=false, connected=false;
 const button=$('cloudSyncButton'), badge=$('cloudSyncStatus'), panel=$('cloudSyncPanel');
 const isAuthed=()=>!!token&&parsedTokenExpiry(token)>Date.now()/1000+10;
 const dirty=()=>load(store(),DIRTY_KEY)==='yes';
 const setDirty=v=>save(store(),DIRTY_KEY,v?'yes':'no');
 function render(){if(!button||!panel||!badge)return;
  const states={local:'仅本地',unconfigured:'未配置云同步',connecting:'正在连接',synced:'已同步',pending:'等待同步',conflict:'需处理冲突',error:'同步失败',signedout:'需要登录'};
  badge.textContent=states[status]||'仅本地';badge.dataset.state=status;
  const notes=connected?'已授权访问你指定的私有 GitHub 仓库。':'网站不会自动把本地数据上传到公开仓库。';
  let decision='';
  if(awaitingChoice){decision=`<section class="cloud-conflict"><strong>检测到本机和云端均有学习记录</strong><p>为避免覆盖，先选择如何处理。两种覆盖方式都可能替换另一端较新的记录。建议先导出本机备份。</p><div class="cloud-choice"><button type="button" data-cloud="use-remote">使用云端记录（覆盖本机）</button><button type="button" data-cloud="use-local">上传本机记录（覆盖云端）</button></div><small>遇到并发修改时不会自动覆盖；可先从页面顶部导出本机 JSON。</small></section>`}
  panel.innerHTML=`<div class="cloud-panel-head"><strong>私人学习数据同步</strong><button type="button" data-cloud="close" aria-label="关闭">×</button></div><p>${notes} 笔记、学习疑问、进度和个人知识节点保留在私有仓库中。只有你主动在 ChatGPT 中要求读取时，助手才会访问最新版本。</p><label>同步服务地址（Cloudflare Worker 的 HTTPS 地址）<input id="cloudApiInput" type="url" value="${escape(api)}" placeholder="https://你的-worker.workers.dev/" spellcheck="false" autocomplete="off" /></label><div class="cloud-panel-actions"><button type="button" data-cloud="configure">保存服务地址</button>${api?`<button type="button" data-cloud="login">${isAuthed()?'重新登录':'用 GitHub 连接'}</button>`:''}${isAuthed()?'<button type="button" data-cloud="refresh">读取云端</button><button type="button" data-cloud="sync">立即同步</button><button type="button" data-cloud="logout">退出本机登录</button>':''}</div><small class="cloud-info">${escape(info||'尚未配置：当前仍在浏览器本地保存，旧数据不会丢失。')}</small>${decision}<p class="cloud-safety">绝不在网页填写 GitHub PAT 或 OAuth Client Secret；它们只能配置在服务端 Secret 中。不同设备若同时编辑同一份数据，会提示冲突。</p>`;
 }
 function report(next,message){status=next;info=message||'';render()}
 function showPanel(force=true){if(!panel)return;panel.hidden=!force;render()}
 function markChanged(){if(suppress)return;changedCounter++;setDirty(true);if(!api){report('unconfigured','本地保存成功；连接云端后才会同步。');return}if(!isAuthed()){report('signedout','本地已保存；登录后再同步。');return}if(awaitingChoice){report('conflict','本地有未同步内容，请处理版本冲突。');return}report('pending','本地已保存，将自动写入私有仓库。');schedule()}
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>void upload(),3600)}
 async function fetchRemote(){const res=await fetch(api+'/api/snapshot',{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'});const body=await res.json().catch(()=>({}));if(res.status===401){save(session(),TOKEN_KEY,null);token='';throw new Error('会话已过期，需要重新用 GitHub 登录')}if(!res.ok)throw new Error(body.error||'云端读取失败');return body}
 async function update(remote){suppress=true;try{await applyRemote(remote)}finally{suppress=false}remoteSha=awaitingChoice?.sha??remoteSha;save(store(),REVISION_KEY,remoteSha||'');save(store(),PAIRED_KEY,'yes');setDirty(false);connected=true;report('synced','已从私有仓库同步到此设备。')}
 async function authenticate(){if(!api)return report('unconfigured','请先保存同步服务地址。');if(!isAuthed())return report('signedout','点击“用 GitHub 连接”完成身份验证。');report('connecting','正在读取你的私有仓库……');try{const remote=await fetchRemote();const local=readLocal();const hasLocal=containsUserInfo(local),hasRemote=containsUserInfo(remote.data);
   if(!remote.data){remoteSha=null;connected=true;save(store(),PAIRED_KEY,'yes');if(hasLocal){setDirty(true);await upload()}else{setDirty(false);report('synced','云端没有旧记录；此设备已连接。')}return}
   const paired=load(store(),PAIRED_KEY)==='yes',known=load(store(),REVISION_KEY)||null;
   if(dirty()||(hasLocal&&!paired)){awaitingChoice={sha:remote.sha,data:remote.data};report('conflict','检测到本地记录与云端记录，需要你选择保留哪一份。');showPanel(true);return}
   remoteSha=remote.sha;save(store(),REVISION_KEY,remoteSha);await update(remote.data);
 }catch(e){report('error',String(e.message||e));showPanel(true)}}
 async function upload(force=false){if(busy||!isAuthed()||!api||awaitingChoice)return;if(!dirty()&&!force)return;busy=true;const generation=changedCounter;report('connecting','正在写入 GitHub 私有仓库……');try{
   const snapshot=readLocal();const res=await fetch(api+'/api/snapshot',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sha:remoteSha,snapshot})});const body=await res.json().catch(()=>({}));
   if(res.status===401){save(session(),TOKEN_KEY,null);token='';throw new Error('登录会话已失效，请重新连接')}
   if(res.status===409){awaitingChoice={sha:body.sha??null,data:null};report('conflict','检测到另一设备的写入；为防止覆盖，本机修改已保留。');showPanel(true);return}
   if(!res.ok)throw new Error(body.error||'写入失败');remoteSha=body.sha;save(store(),REVISION_KEY,remoteSha||'');save(store(),PAIRED_KEY,'yes');connected=true;
   if(generation===changedCounter){setDirty(false);report('synced','已写入私有 GitHub 仓库，最近同步：'+new Date().toLocaleString('zh-CN'))}else{setDirty(true);report('pending','写入时又有新的修改，将继续同步。');schedule()}
 }catch(e){report('error',String(e.message||e)+'；本地记录已保留。')}finally{busy=false}}
 async function resolve(kind){if(!awaitingChoice)return;const data=awaitingChoice;awaitingChoice=null;try{
   if(kind==='use-remote'){
     const remote=data.data?data:await fetchRemote();remoteSha=remote.sha;await update(remote.data);showPanel(false);return;
   }
   if(kind==='use-local'){remoteSha=data.sha||null;setDirty(true);changedCounter++;await upload();if(status==='synced')showPanel(false)}
 }catch(e){awaitingChoice=data;report('error',String(e.message||e));showPanel(true)}}
 function consumeAuthHash(){const hash=window.location.hash;
  if(!hash.startsWith('#cloud_auth='))return;
  try{const t=decodeURIComponent(hash.slice('#cloud_auth='.length));if(parsedTokenExpiry(t)>Date.now()/1000){token=t;save(session(),TOKEN_KEY,t)}else{token='';save(session(),TOKEN_KEY,null)}}catch{token=''}
  const prev=load(session(),RETURN_HASH_KEY)||'#map';save(session(),RETURN_HASH_KEY,null);
  history.replaceState(null,'',window.location.pathname+window.location.search+prev);
 }
 async function start(){consumeAuthHash();if(!api){try{const res=await fetch('./cloud-config.json',{cache:'no-store'});if(res.ok){const cfg=await res.json();api=validApi(cfg.apiBase)||''}}catch{}}
  if(!api){report('unconfigured','网页已经具备同步功能，尚未指定私有同步服务；继续使用本地保存。');return}
  if(isAuthed())await authenticate();else report('signedout',dirty()?'本地有尚未同步的学习记录。':'当前仅保存在本机；点击按钮连接云端。');
 }
 button?.addEventListener('click',()=>showPanel(panel.hidden));
 panel?.addEventListener('click',async e=>{const action=e.target.closest('[data-cloud]')?.dataset.cloud;if(!action)return;
  if(action==='close')return showPanel(false);
  if(action==='configure'){const next=validApi($('cloudApiInput').value.trim());if(!next){report('error','请填写有效的 HTTPS Worker 根地址，不包含路径或 Token。');return}api=next;save(store(),URL_KEY,next);save(session(),TOKEN_KEY,null);token='';remoteSha=null;save(store(),PAIRED_KEY,null);save(store(),REVISION_KEY,null);report('signedout','服务地址已保存。点击“用 GitHub 连接”。');return}
  if(action==='login'){save(session(),RETURN_HASH_KEY,window.location.hash.startsWith('#cloud_auth=')?'#map':window.location.hash||'#map');window.location.assign(api+'/auth/start');return}
  if(action==='logout'){token='';save(session(),TOKEN_KEY,null);report('signedout','已退出此设备的云端会话；本地笔记仍然保留。');return}
  if(action==='refresh'){await authenticate();return}
  if(action==='sync'){setDirty(true);await upload();return}
  if(action==='use-remote'||action==='use-local'){await resolve(action);return}
 });
 window.addEventListener('atlas:changed',markChanged);
 window.addEventListener('online',()=>{if(dirty()&&isAuthed()&&!awaitingChoice)schedule()});
 return {start,markChanged,getStatus:()=>status,exportForTest:()=>({api,connected,remoteSha,dirty:dirty(),status,conflict:!!awaitingChoice})};
}
export const cloudHelpers={validApi,containsUserInfo,parsedTokenExpiry};
