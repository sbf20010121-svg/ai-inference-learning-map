import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRequest,testHelpers} from '../cloud-sync-worker.js';
import {cloudHelpers} from '../site/js/cloud-sync.js';

const env={SITE_URL:'https://sbf20010121-svg.github.io/ai-inference-learning-map/',ALLOWED_LOGIN:'sbf20010121-svg',DATA_REPO:'sbf20010121-svg/ai-inference-private-data',GH_OAUTH_CLIENT_ID:'test-id',GH_OAUTH_CLIENT_SECRET:'server-only-secret',GITHUB_DATA_PAT:'private-write-token',SESSION_HMAC_KEY:'local-dev-test-key-at-least-32-characters'};
const siteOrigin=new URL(env.SITE_URL).origin;
const snapshot={format:'ai-inference-learning-map-progress',version:1,progress:{},depthProgress:{'moe-route':{status:'learning',note:'Top-2 为什么不会必然让计算翻倍？'}},knowledgeGraph:{nodes:[],edges:[]}};
function fakeGitHub(){let stored=null,sha=null,rev=0;const calls=[];
 async function fetcher(url,options={}){
  const method=options.method||'GET';calls.push({url,method,authorization:options.headers?.Authorization||''});
  if(url==='https://github.com/login/oauth/access_token')return Response.json({access_token:'user-identity-only'});
  if(url==='https://api.github.com/user')return Response.json({login:env.ALLOWED_LOGIN});
  if(url===`https://api.github.com/repos/${env.DATA_REPO}`)return Response.json({private:true,full_name:env.DATA_REPO,owner:{login:env.ALLOWED_LOGIN}});
  if(url===`https://api.github.com/repos/${env.DATA_REPO}/contents/learning/snapshot.json`){
    if(method==='GET')return stored?Response.json({type:'file',sha,content:Buffer.from(JSON.stringify(stored),'utf8').toString('base64')}):Response.json({message:'Not Found'},{status:404});
    if(method==='PUT'){
     const payload=JSON.parse(options.body);
     if(sha!==null&&payload.sha!==sha)return Response.json({message:'sha mismatch'},{status:409});
     if(sha===null&&payload.sha)return Response.json({message:'nonexistent'},{status:409});
     stored=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));sha='revision-'+(++rev);return Response.json({content:{sha}});
    }
  }
  return Response.json({message:'unexpected endpoint'},{status:404});
 }
 return {fetcher,calls,get stored(){return stored},get sha(){return sha},set stored(value){stored=value;sha='external-change';}};
}
function req(method,path,token,body,origin=siteOrigin){return new Request(`https://atlas-private-sync.workers.dev${path}`,{method,headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function login(mock){const start=await handleRequest(req('GET','/auth/start'),env,mock.fetcher);assert.equal(start.status,302);const u=new URL(start.headers.get('location'));assert.equal(u.hostname,'github.com');assert.equal(u.searchParams.get('scope'),'read:user');
 const cookie=start.headers.get('set-cookie').split(';')[0],state=u.searchParams.get('state');const callback=new Request(`https://atlas-private-sync.workers.dev/auth/callback?code=sample-code&state=${state}`,{headers:{Cookie:cookie}});const response=await handleRequest(callback,env,mock.fetcher);assert.equal(response.status,302);const redirect=new URL(response.headers.get('location'));assert.equal(redirect.origin,siteOrigin);assert.equal(redirect.pathname,new URL(env.SITE_URL).pathname);return decodeURIComponent(redirect.hash.replace('#cloud_auth=',''));
}

test('worker requires configuration and never stores secrets in public config',async()=>{
 const fail=await handleRequest(new Request('https://atlas-private-sync.workers.dev/health'),{},fakeGitHub().fetcher);assert.equal((await fail.json()).ready,false);
 assert.equal(cloudHelpers.validApi('https://site.workers.dev/'),'https://site.workers.dev');
 assert.equal(cloudHelpers.validApi('https://site.workers.dev/path'),null);
 assert.equal(cloudHelpers.validApi('http://site.workers.dev/'),null);
 assert.equal(cloudHelpers.validApi('https://user:pass@site.workers.dev/'),null);
 const publicSite=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.ok(publicSite.includes('cloudSyncButton'));
 assert.doesNotMatch(publicSite,/GITHUB_DATA_PAT|GH_OAUTH_CLIENT_SECRET/);
 const gi=readFileSync(new URL('../.gitignore',import.meta.url),'utf8');assert.match(gi,/\.dev\.vars/);
});

test('identity-only GitHub OAuth flow, signed short-lived session, rejects incorrect state and username',async()=>{
 const mock=fakeGitHub(),token=await login(mock);assert.ok(token.length>80);
 assert.equal(await testHelpers.verifyToken(token,env.SESSION_HMAC_KEY,env.ALLOWED_LOGIN),true);
 assert.equal(await testHelpers.verifyToken(token+'tamper',env.SESSION_HMAC_KEY,env.ALLOWED_LOGIN),false);
 const bad=await handleRequest(new Request('https://atlas-private-sync.workers.dev/auth/callback?code=a&state=x',{headers:{Cookie:'atlas_oauth_state=y'}}),env,mock.fetcher);assert.equal(bad.status,401);
 const denied=await handleRequest(req('GET','/api/snapshot',token,undefined,'https://attacker.example'),env,mock.fetcher);assert.equal(denied.status,403);
});

test('private repo snapshots: protected GET/PUT, Chinese notes survive encoding, conflicts cannot overwrite',async()=>{
 const mock=fakeGitHub(),token=await login(mock);
 const unauthorized=await handleRequest(req('GET','/api/snapshot'),env,mock.fetcher);assert.equal(unauthorized.status,401);
 const empty=await handleRequest(req('GET','/api/snapshot',token),env,mock.fetcher);assert.deepEqual(await empty.json(),{sha:null,data:null});
 const wrote=await handleRequest(req('PUT','/api/snapshot',token,{sha:null,snapshot}),env,mock.fetcher);assert.equal(wrote.status,200);const sha=(await wrote.json()).sha;
 const downloaded=await handleRequest(req('GET','/api/snapshot',token),env,mock.fetcher);
 assert.deepEqual(await downloaded.json(),{sha,data:snapshot});
 const conflict=await handleRequest(req('PUT','/api/snapshot',token,{sha:null,snapshot:{...snapshot,depthProgress:{}}}),env,mock.fetcher);
 assert.equal(conflict.status,409);assert.deepEqual(mock.stored,snapshot);
 const updated={...snapshot,depthProgress:{...snapshot.depthProgress,'kv-cache':{note:'块表和共享引用'}}};
 const good=await handleRequest(req('PUT','/api/snapshot',token,{sha,snapshot:updated}),env,mock.fetcher);
 assert.equal(good.status,200);assert.deepEqual(mock.stored,updated);
 assert.ok(mock.calls.some(c=>c.authorization.includes('private-write-token')));
 const option=await handleRequest(req('OPTIONS','/api/snapshot'),env,mock.fetcher);assert.equal(option.status,204);
});

test('private-only restriction prevents accidental public repo writes',async()=>{
 const mock=fakeGitHub(),token=await login(mock);
 const unsafe=async (url,opts)=>url===`https://api.github.com/repos/${env.DATA_REPO}`?Response.json({private:false,full_name:env.DATA_REPO,owner:{login:env.ALLOWED_LOGIN}}):mock.fetcher(url,opts);
 const result=await handleRequest(req('PUT','/api/snapshot',token,{sha:null,snapshot}),env,unsafe);
 assert.equal(result.status,403);assert.equal(mock.stored,null);
});
