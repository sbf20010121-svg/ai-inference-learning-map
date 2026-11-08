/**
 * GitHub-backed, single-user, private learning-data sync API.
 * Deploy separately to Cloudflare Workers. Never commit any secret values.
 * GitHub OAuth only proves identity; a fine-grained GitHub PAT remains server-side.
 */
const API_VERSION='2022-11-28';
const SESSION_AUDIENCE='ai-inference-map-sync-v1';
const encoder=new TextEncoder();
const decoder=new TextDecoder();

function toBase64(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)}
function fromBase64(s){const decoded=atob(s.replace(/\s/g,''));return decoder.decode(Uint8Array.from(decoded,c=>c.charCodeAt(0)))}
function b64u(s){return toBase64(encoder.encode(s)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){return fromBase64(s.replace(/-/g,'+').replace(/_/g,'/'))}
function securityHeaders(){return {'cache-control':'no-store, max-age=0','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"}}
function asJson(obj,code=200,extra={}){return new Response(JSON.stringify(obj),{status:code,headers:{...securityHeaders(),'content-type':'application/json; charset=utf-8',...extra}})}
function siteOrigin(env){try{return new URL(env.SITE_URL).origin}catch{return ''}}
function cors(env,request){const expected=siteOrigin(env);return request.headers.get('Origin')===expected?{'Access-Control-Allow-Origin':expected,'Vary':'Origin','Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}:null}
const githubHeaders=token=>({'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':API_VERSION,'User-Agent':'ai-inference-map-private-sync'});
async function githubJson(url,token,method='GET',body,fetcher=fetch){const res=await fetcher(url,{method,headers:{...githubHeaders(token),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let value={};try{value=await res.json()}catch{}return {status:res.status,ok:res.ok,value};}
function validateConfig(env){const needed=['SITE_URL','ALLOWED_LOGIN','DATA_REPO','GITHUB_DATA_PAT','GH_OAUTH_CLIENT_ID','GH_OAUTH_CLIENT_SECRET','SESSION_HMAC_KEY'];return needed.filter(key=>!env[key]||(key==='SESSION_HMAC_KEY'&&String(env[key]).length<32));}
function validatePrivateRepo(value,env){const owner=String(env.DATA_REPO||'').split('/')[0];return value.private===true && value.full_name?.toLowerCase()===String(env.DATA_REPO).toLowerCase()&&value.owner?.login?.toLowerCase()===owner.toLowerCase()&&owner.toLowerCase()===String(env.ALLOWED_LOGIN).toLowerCase();}
async function getRepoSafe(env,fetcher){const r=await githubJson(`https://api.github.com/repos/${env.DATA_REPO}`,env.GITHUB_DATA_PAT,'GET',null,fetcher);if(!r.ok)return {ok:false,status:502};if(!validatePrivateRepo(r.value,env))return {ok:false,status:403};return {ok:true};}
const fileUrl=env=>`https://api.github.com/repos/${env.DATA_REPO}/contents/learning/snapshot.json`;
async function readSnapshot(env,fetcher){const r=await githubJson(fileUrl(env),env.GITHUB_DATA_PAT,'GET',null,fetcher);
 if(r.status===404)return {sha:null,data:null};
 if(!r.ok)throw new Error('GitHub 读取失败');
 if(r.value.type!=='file'||typeof r.value.content!=='string'||typeof r.value.sha!=='string')throw new Error('远程文件格式无效');
 const data=JSON.parse(fromBase64(r.value.content));
 if(data.format!=='ai-inference-learning-map-progress'||data.version!==1)throw new Error('远程数据格式不匹配');
 return {sha:r.value.sha,data};
}
async function signToken(value,key){const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);const body=b64u(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+b64u(JSON.stringify(value));const sig=new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(body)));return body+'.'+toBase64(sig).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function verifyToken(token,key,expectedLogin){if(typeof token!=='string'||token.length>3000)return false;const parts=token.split('.');if(parts.length!==3)return false;try{const [header,payload]=parts.slice(0,2).map(x=>JSON.parse(unb64u(x)));if(header.alg!=='HS256'||payload.aud!==SESSION_AUDIENCE||payload.sub?.toLowerCase()!==expectedLogin.toLowerCase()||!Number.isFinite(payload.exp)||Date.now()/1000>=payload.exp)return false;const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);const sig=Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));return await crypto.subtle.verify('HMAC',k,sig,encoder.encode(parts[0]+'.'+parts[1]));}catch{return false}}
function requestedCookie(header,key){return header?.split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||''}
function randomState(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return toBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function redirect(url,extra={}){return new Response(null,{status:302,headers:{...securityHeaders(),location:url,...extra}})}
export async function handleRequest(request,env,fetcher=fetch){
 const url=new URL(request.url);
 if(url.pathname==='/health')return asJson({service:'ai-learning-cloud-sync',ready:validateConfig(env).length===0});
 if(validateConfig(env).length)return asJson({error:'服务端尚未配置完成，请联系网站维护者'},503);
 if(url.pathname==='/auth/start'&&request.method==='GET'){
   const state=randomState();const auth=new URL('https://github.com/login/oauth/authorize');
   auth.searchParams.set('client_id',env.GH_OAUTH_CLIENT_ID);auth.searchParams.set('redirect_uri',url.origin+'/auth/callback');auth.searchParams.set('scope','read:user');auth.searchParams.set('state',state);
   return redirect(auth.toString(),{'Set-Cookie':`atlas_oauth_state=${state}; Max-Age=600; Path=/auth; Secure; HttpOnly; SameSite=Lax`});
 }
 if(url.pathname==='/auth/callback'&&request.method==='GET'){
   const state=requestedCookie(request.headers.get('Cookie'),'atlas_oauth_state');
   const code=url.searchParams.get('code'),returned=url.searchParams.get('state');
   const cleared={'Set-Cookie':'atlas_oauth_state=; Max-Age=0; Path=/auth; Secure; HttpOnly; SameSite=Lax'};
   if(!code||!state||state!==returned||code.length>1000)return asJson({error:'GitHub 登录状态验证失败，请重新连接'},401,cleared);
   const exchange=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GH_OAUTH_CLIENT_ID,client_secret:env.GH_OAUTH_CLIENT_SECRET,code,redirect_uri:url.origin+'/auth/callback'}).toString()});
   if(!exchange.ok)return asJson({error:'登录授权交换失败'},502,cleared);
   let tokenData={};try{tokenData=await exchange.json()}catch{}
   if(typeof tokenData.access_token!=='string')return asJson({error:'GitHub 未返回授权结果'},401,cleared);
   const user=await githubJson('https://api.github.com/user',tokenData.access_token,'GET',null,fetcher);
   if(!user.ok||user.value.login?.toLowerCase()!==env.ALLOWED_LOGIN.toLowerCase())return asJson({error:'此同步服务仅允许指定 GitHub 用户访问'},403,cleared);
   const now=Math.floor(Date.now()/1000);
   const session=await signToken({sub:user.value.login,aud:SESSION_AUDIENCE,iat:now,exp:now+6*3600},env.SESSION_HMAC_KEY);
   return redirect(new URL(env.SITE_URL).toString()+'#cloud_auth='+encodeURIComponent(session),cleared);
 }
 if(url.pathname==='/api/snapshot'){
   const allow=cors(env,request);
   if(request.method==='OPTIONS')return allow?new Response(null,{status:204,headers:{...securityHeaders(),...allow}}):asJson({error:'Origin 不允许'},403);
   if(!allow)return asJson({error:'跨站请求已拒绝'},403);
   if(!['GET','PUT'].includes(request.method))return asJson({error:'方法不支持'},405,allow);
   const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
   if(!await verifyToken(token,env.SESSION_HMAC_KEY,env.ALLOWED_LOGIN))return asJson({error:'登录会话已失效，请重新连接'},401,allow);
   const rp=await getRepoSafe(env,fetcher);if(!rp.ok)return asJson({error:'无法访问指定私有数据仓库；请检查仓库是否私有及密钥权限'},rp.status,allow);
   if(request.method==='GET'){
      try{return asJson(await readSnapshot(env,fetcher),200,allow)}catch{return asJson({error:'云端数据读取失败，请检查文件格式或访问权限'},502,allow)}
   }
   if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return asJson({error:'仅接受 JSON'},415,allow);
   const bodyText=await request.text();if(encoder.encode(bodyText).length>850_000)return asJson({error:'数据包超过 850 KB 限制'},413,allow);
   let body;try{body=JSON.parse(bodyText)}catch{return asJson({error:'JSON 无效'},400,allow)}
   if(!body||!Object.hasOwn(body,'sha')||typeof body.sha!=='string'&&body.sha!==null||!body.snapshot||body.snapshot.format!=='ai-inference-learning-map-progress'||body.snapshot.version!==1)return asJson({error:'同步数据格式无效'},400,allow);
   let latest;try{latest=await readSnapshot(env,fetcher)}catch{return asJson({error:'远程版本检查失败'},502,allow)}
   if(latest.sha!==body.sha)return asJson({error:'版本冲突：另一设备已写入修改',sha:latest.sha,conflict:true},409,allow);
   const content=toBase64(encoder.encode(JSON.stringify(body.snapshot)));
   const put=await githubJson(fileUrl(env),env.GITHUB_DATA_PAT,'PUT',{message:'sync: update private learning notes',content,...(latest.sha?{sha:latest.sha}:{})},fetcher);
   if(put.status===409||put.status===422)return asJson({error:'GitHub 写入竞争，请先刷新云端记录',conflict:true},409,allow);
   if(!put.ok)return asJson({error:'GitHub 保存失败'},502,allow);
   return asJson({ok:true,sha:put.value.content?.sha||null,savedAt:new Date().toISOString()},200,allow);
 }
 return asJson({error:'接口不存在'},404);
}
export default {fetch:handleRequest};
export const testHelpers={signToken,verifyToken,validatePrivateRepo,readSnapshot,validateConfig};
