// One private relay instance per desktop owner. Put HTTPS in front for internet use.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const token=()=>crypto.randomBytes(32).toString('hex');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function createRelay({directory,bootstrap,now=Date.now}={}){
 if(typeof bootstrap!=='string'||bootstrap.length<32)throw Error('Set a random AILO_RELAY_BOOTSTRAP (at least 32 characters)');
 await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'state.json');let state;
 try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={version:1,jobs:[],phones:[],history:[]};}
 // A relay restart cannot reuse a previous process heartbeat as live presence.
 state.heartbeat=0;
 let queue=Promise.resolve();const save=async()=>{await fs.writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});await fs.rename(file+'.tmp',file);};
 const server=http.createServer((req,res)=>{queue=queue.then(async()=>{
 const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});res.end(JSON.stringify(value));};
 if(req.method==='OPTIONS')return respond(204,{});
 const url=new URL(req.url,'http://relay'),route=url.pathname,auth=(req.headers.authorization||'').replace(/^Bearer /,'');
 let body={};if(req.method==='POST'){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024)return respond(413,{error:'请求过大'});parts.push(chunk);}try{body=JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{return respond(400,{error:'无效JSON'});}}
 const desktop=state.desktopHash&&hash(auth)===state.desktopHash,phone=state.phones.includes(hash(auth));
 if(route==='/v1/register'&&req.method==='POST'){
 if(hash(auth)!==hash(bootstrap))return respond(401,{error:'配置密钥无效'});
 if(state.desktopHash)return respond(409,{error:'电脑已经注册，请使用原凭据；重新绑定需先停用并清理专用服务数据'});
 const key=token();state.desktopHash=hash(key);await save();return respond(200,{desktopToken:key});}
 if(route==='/v1/pair'&&req.method==='POST'){
 const address=req.socket.remoteAddress;attempts.set(address,(attempts.get(address)||[]).filter(t=>now()-t<600000));const a=attempts.get(address);if(a.length>=10)return respond(429,{error:'配对尝试过多，请稍后重试'});a.push(now());
 if(!state.pair||state.pair.expires<now()||hash(String(body.code))!==state.pair.hash)return respond(403,{error:'配对码无效或已过期'});
 const key=token();state.phones.push(hash(key));delete state.pair;await save();return respond(200,{phoneToken:key});}
 if(!desktop&&!phone)return respond(401,{error:'请先配对设备'});
 if(route==='/v1/pair-code'&&desktop&&req.method==='POST'){const code=String(crypto.randomInt(10000000,100000000));state.pair={hash:hash(code),expires:now()+300000};await save();return respond(200,{code,expires:state.pair.expires});}
 if(route==='/v1/revoke'&&desktop&&req.method==='POST'){state.phones=[];delete state.pair;await save();return respond(200,{ok:true});}
 if(route==='/v1/sync'&&desktop&&req.method==='POST'){
 state.heartbeat=now();state.device=String(body.device||'Ailo 电脑').slice(0,100);
 if(Array.isArray(body.history))state.history=body.history.slice(0,200);
 if(body.update){const j=state.jobs.find(j=>j.id===body.update.id);if(!j)return respond(404,{error:'任务不存在'});const statuses=['accepted','running','needs_attention','completed','limited','incomplete','failed','unknown'];if(!statuses.includes(body.update.status))return respond(400,{error:'状态无效'});if(['completed','limited','incomplete','failed','unknown'].includes(j.status)&&['accepted','running'].includes(body.update.status))return respond(200,{jobs:state.jobs.filter(j=>['queued','accepted'].includes(j.status))});Object.assign(j,{status:body.update.status,detail:String(body.update.detail||'').slice(0,8000),taskId:body.update.taskId,result:body.update.result,artifacts:body.update.artifacts,updatedAt:now()});}
 await save();return respond(200,{jobs:state.jobs.filter(j=>['queued','accepted'].includes(j.status)).slice(0,10)});}
 if(route==='/v1/status'&&phone&&req.method==='GET')return respond(200,{version:1,device:state.device||'Ailo 电脑',online:!!state.heartbeat&&now()>=state.heartbeat&&now()-state.heartbeat<15000,onlineForMs:state.heartbeat&&now()>=state.heartbeat?Math.max(0,15000-(now()-state.heartbeat)):0,lastSeen:state.heartbeat||null,jobs:state.jobs.slice(-100).reverse(),history:state.history});
 if(route==='/v1/jobs'&&phone&&req.method==='POST'){
 if(typeof body.id!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.id)||typeof body.text!=='string'||!body.text.trim()||body.text.length>20000)return respond(400,{error:'任务内容或ID无效'});
 const old=state.jobs.find(j=>j.id===body.id);if(old){if(old.text!==body.text||old.requestedTaskId!==body.taskId)return respond(409,{error:'同一ID不能提交不同任务'});return respond(200,old);}
 if(state.jobs.filter(j=>['queued','accepted'].includes(j.status)).length>=100)return respond(429,{error:'待执行队列已满'});
 const j={id:body.id,text:body.text,requestedTaskId:body.taskId,taskId:typeof body.taskId==='string'?body.taskId:undefined,status:'queued',createdAt:now(),updatedAt:now()};state.jobs.push(j);await save();return respond(200,j);}
 respond(404,{error:'接口不存在'});
 }).catch(()=>{if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务处理失败，未确认的请求请使用原ID重试'}));}else res.end();});});
 const attempts=new Map();server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,close:()=>new Promise(r=>server.close(r))};
}
if(require.main===module)createRelay({directory:process.env.AILO_RELAY_DATA||path.join(__dirname,'..','.local','relay'),bootstrap:process.env.AILO_RELAY_BOOTSTRAP}).then(({server})=>server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Ailo relay listening; use HTTPS reverse proxy for remote access.'))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={createRelay};
