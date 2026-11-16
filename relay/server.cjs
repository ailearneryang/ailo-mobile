// One private relay instance per desktop owner. Put HTTPS in front for internet use.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const token=()=>crypto.randomBytes(32).toString('hex');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function createRelay({directory,bootstrap,now=Date.now}={}){
 if(typeof bootstrap!=='string'||bootstrap.length<32)throw Error('Set a random AILO_RELAY_BOOTSTRAP (at least 32 characters)');
 await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'state.json');let state;
 try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={version:1,jobs:[],phones:[],history:[]};}
 // A relay restart cannot reuse a previous process heartbeat as live presence.
 state.heartbeat=0;state.historyRevision=hash(JSON.stringify(state.history||[]));
 const blobDirectory=path.join(directory,'attachments');await fs.mkdir(blobDirectory,{recursive:true,mode:0o700});
 const blob=id=>path.join(blobDirectory,id+'.json');
 const publicJob=j=>{const {payloadHash,...v}=j;return {...v,attachments:j.attachmentMeta||[]};};
 const fingerprint=(text,taskId,payload)=>hash(JSON.stringify({text,taskId:taskId||null,attachments:payload.attachments,tools:payload.tools||{}}));
 let queue=Promise.resolve();const save=async()=>{await fs.writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});await fs.rename(file+'.tmp',file);};
 const expire=async()=>{let changed=false;for(const j of state.jobs){if(j.attachmentsReceivedAt&&!j.attachmentsDeletedAt){await fs.rm(blob(j.id),{force:true});j.attachmentsDeletedAt=now();changed=true;}if(j.attachmentsExpireAt&&!j.attachmentsReceivedAt&&now()>=j.attachmentsExpireAt){await fs.rm(blob(j.id),{force:true});if(['queued','accepted'].includes(j.status)){j.status='failed';j.detail='附件超过24小时未被电脑接收，云端副本已删除。请重新选择附件并发送新任务。';j.updatedAt=now();}delete j.attachmentsExpireAt;j.attachmentsDeletedAt=now();changed=true;}}if(changed)await save();};
 const delivery=async supported=>{const result=[];for(const j of state.jobs.filter(j=>['queued','accepted'].includes(j.status))){if(!supported&&(j.attachmentMeta?.length||j.tools))continue;let attachments=[];if(j.attachmentMeta?.length&&!j.attachmentsReceivedAt){try{attachments=JSON.parse(await fs.readFile(blob(j.id),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;j.status='failed';j.detail='云端附件缺失，未派发执行。请重新发送附件。';await save();continue;}}result.push({...publicJob(j),attachments,attachmentsAvailable:!j.attachmentMeta?.length||attachments.length>0});if(result.length>=1)break;}return result;};
 await expire();
 const referenced=new Set(state.jobs.filter(j=>j.attachmentsExpireAt&&!j.attachmentsReceivedAt).map(j=>j.id+'.json'));for(const name of await fs.readdir(blobDirectory))if(!referenced.has(name))await fs.rm(path.join(blobDirectory,name),{force:true});
 const server=http.createServer((req,res)=>{queue=queue.then(async()=>{
 const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});res.end(JSON.stringify(value));};
 await expire();
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
 if(body.capabilities?.protocolVersion===2)state.capabilities={protocolVersion:2,attachmentReceiptVersion:body.capabilities.attachmentReceiptVersion===1?1:0,extensions:(Array.isArray(body.capabilities.extensions)?body.capabilities.extensions:[]).slice(0,100).filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&['skill','expert'].includes(e.kind)).map(e=>({id:e.id.slice(0,100),name:e.name.slice(0,60),kind:e.kind,description:String(e.description||'').slice(0,300)})),connections:(Array.isArray(body.capabilities.connections)?body.capabilities.connections:[]).slice(0,20).filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string').map(c=>({id:c.id.slice(0,100),name:c.name.slice(0,60),connected:c.connected===true}))};
 if(Array.isArray(body.receivedAttachments))for(const id of body.receivedAttachments.slice(0,10)){const j=state.jobs.find(j=>j.id===id);if(j?.attachmentMeta?.length&&!j.attachmentsReceivedAt){j.attachmentsReceivedAt=now();delete j.attachmentsExpireAt;await save();await fs.rm(blob(id),{force:true});j.attachmentsDeletedAt=now();}}
 if(Array.isArray(body.history)){state.history=body.history.slice(0,200);state.historyRevision=hash(JSON.stringify(state.history));}
 if(body.update){const j=state.jobs.find(j=>j.id===body.update.id);if(!j)return respond(404,{error:'任务不存在'});const statuses=['accepted','running','needs_attention','completed','limited','incomplete','failed','unknown'];if(!statuses.includes(body.update.status))return respond(400,{error:'状态无效'});if(['completed','limited','incomplete','failed','unknown'].includes(j.status)&&['accepted','running'].includes(body.update.status))return respond(200,{historyRevision:state.historyRevision,jobs:body.pullJobs===false?[]:await delivery(body.capabilities?.protocolVersion===2&&body.capabilities?.attachmentReceiptVersion===1)});Object.assign(j,{status:body.update.status,detail:String(body.update.detail||'').slice(0,8000),taskId:body.update.taskId,result:body.update.result,artifacts:body.update.artifacts,updatedAt:now()});}
 await save();return respond(200,{historyRevision:state.historyRevision,jobs:body.pullJobs===false?[]:await delivery(body.capabilities?.protocolVersion===2&&body.capabilities?.attachmentReceiptVersion===1)});}
 if(route==='/v1/status'&&phone&&req.method==='GET')return respond(200,{version:1,protocolVersion:2,capabilities:state.capabilities,attachmentPolicy:{maxFiles:3,maxFileBytes:2097152,maxTotalBytes:3145728,expiresAfterMs:86400000,deleteAfterDesktopReceipt:true},device:state.device||'Ailo 电脑',online:!!state.heartbeat&&now()>=state.heartbeat&&now()-state.heartbeat<15000,onlineForMs:state.heartbeat&&now()>=state.heartbeat?Math.max(0,15000-(now()-state.heartbeat)):0,lastSeen:state.heartbeat||null,jobs:state.jobs.slice(-100).reverse().map(publicJob),historyRevision:state.historyRevision,...(url.searchParams.get('historyRevision')===state.historyRevision?{historyUnchanged:true}:{history:state.history})});
 if(route.startsWith('/v1/jobs/')&&phone&&req.method==='GET'){const job=state.jobs.find(j=>j.id===decodeURIComponent(route.slice('/v1/jobs/'.length)));return job?respond(200,publicJob(job)):respond(404,{error:'未找到原提交回执'});}
 if(route==='/v1/jobs'&&phone&&req.method==='POST'){
 if(typeof body.id!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.id)||typeof body.text!=='string'||!body.text.trim()||body.text.length>20000)return respond(400,{error:'任务内容或ID无效'});
 let payload;try{payload=require('./payload.cjs').normalize(body);}catch(e){return respond(400,{error:e.message});}
 if((payload.attachments.length||payload.tools)&&state.capabilities?.protocolVersion!==2||payload.attachments.length&&state.capabilities?.attachmentReceiptVersion!==1)return respond(409,{error:'请先更新电脑端并等待其同步附件和工具能力'});
 const payloadHash=fingerprint(body.text,body.taskId,payload);
 const old=state.jobs.find(j=>j.id===body.id);if(old){if(old.text!==body.text||old.requestedTaskId!==body.taskId||(old.payloadHash||fingerprint(old.text,old.requestedTaskId,{attachments:[],tools:undefined}))!==payloadHash)return respond(409,{error:'同一ID不能提交不同任务'});return respond(200,publicJob(old));}
 if(state.jobs.filter(j=>['queued','accepted'].includes(j.status)).length>=100)return respond(429,{error:'待执行队列已满'});
 if(payload.attachments.length&&state.jobs.filter(j=>j.attachmentsExpireAt&&!j.attachmentsReceivedAt).reduce((n,j)=>n+(j.attachmentMeta||[]).reduce((s,a)=>s+a.size,0),0)+payload.attachments.reduce((n,a)=>n+Buffer.byteLength(a.base64,'base64'),0)>64*1024*1024)return respond(429,{error:'云端待接收附件已达到64MB，请等待电脑接收后再发送'});
 const attachmentMeta=payload.attachments.map(a=>({name:a.name,size:Buffer.byteLength(a.base64,'base64'),sha256:hash(Buffer.from(a.base64,'base64'))}));
 if(attachmentMeta.length){await fs.writeFile(blob(body.id)+'.tmp',JSON.stringify(payload.attachments),{mode:0o600});await fs.rename(blob(body.id)+'.tmp',blob(body.id));}
 const j={version:2,payloadHash,attachmentMeta,...(payload.tools?{tools:payload.tools}:{}),...(attachmentMeta.length?{attachmentsExpireAt:now()+86400000}:{}),id:body.id,text:body.text,requestedTaskId:body.taskId,taskId:typeof body.taskId==='string'?body.taskId:undefined,status:'queued',createdAt:now(),updatedAt:now()};state.jobs.push(j);try{await save();}catch(e){state.jobs.pop();await fs.rm(blob(body.id),{force:true});throw e;}return respond(200,publicJob(j));}
 respond(404,{error:'接口不存在'});
 }).catch(()=>{if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务处理失败，未确认的请求请使用原ID重试'}));}else res.end();});});
 const attempts=new Map();server.requestTimeout=15000;server.headersTimeout=10000;
 const sweep=setInterval(()=>{queue=queue.then(expire).catch(()=>{});},60000);sweep.unref?.();
 return {server,close:async()=>{clearInterval(sweep);await new Promise(r=>server.close(r));await queue;}};
}
if(require.main===module)createRelay({directory:process.env.AILO_RELAY_DATA||path.join(__dirname,'..','.local','relay'),bootstrap:process.env.AILO_RELAY_BOOTSTRAP}).then(({server})=>server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Ailo relay listening; use HTTPS reverse proxy for remote access.'))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={createRelay};
