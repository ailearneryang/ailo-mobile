const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createRelay}=require('./server.cjs');
const {createBridge,desktopAdapter}=require('../../ailo/apps/desktop/mobile-bridge.cjs');
test('phone pairing -> relay -> desktop adapter -> progress -> result -> history, duplicate delivery is inert',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ailo-relay-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const bootstrap='test-only-bootstrap-'.repeat(3),r=await createRelay({directory,bootstrap});await new Promise(resolve=>r.server.listen(0,'127.0.0.1',resolve));t.after(()=>r.close());const url='http://127.0.0.1:'+r.server.address().port;
 const api=async(route,key,body)=>{const r=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 assert.equal((await api('/v1/status','wrong')).status,401);const key=(await api('/v1/register',bootstrap,{})).body.desktopToken;const code=(await api('/v1/pair-code',key,{})).body.code;
 assert.equal((await api('/v1/pair','',{code:'00000000'})).status,403);const phone=(await api('/v1/pair','',{code})).body.phoneToken;assert.equal((await api('/v1/pair','',{code})).status,403);
 const payload={id:'phone-request-001',text:'生成测试结果'};await api('/v1/jobs',phone,payload);assert.equal((await api('/v1/status',phone)).body.jobs[0].status,'queued');
 const tasks=[];let executions=0;const storage={readWorkspace:async()=>({tasks,defaultModelId:'fixture-company-model'}),patchTask:async(id,fields,append=[])=>{let task=tasks.find(t=>t.id===id);if(!task){task={id,messages:[]};tasks.push(task);}Object.assign(task,fields);task.messages.push(...append);}};
 const chat={sessions:()=>[],complete:async input=>{executions++;assert.equal(input.modelId,'fixture-company-model');input.onStatus('验证中的真实步骤');return {content:'隔离替身返回：成果已生成',agentRun:{status:'completed',artifacts:[]}};}};
 const bridge=await createBridge({directory:path.join(directory,'desktop'),url,key,...desktopAdapter(storage,chat)});await bridge.tick();bridge.stop();
 const result=(await api('/v1/status',phone)).body;assert.equal(result.online,true);assert.equal(result.jobs[0].status,'completed');assert.match(result.jobs[0].result,/隔离替身/);assert.equal(result.history.length,1);
 assert.equal((await api('/v1/jobs',phone,payload)).status,200);assert.equal((await api('/v1/jobs',phone,{...payload,text:'changed'})).status,409);await bridge.tick();assert.equal(executions,1);
 await api('/v1/sync',key,{update:{id:payload.id,status:'running'}});assert.equal((await api('/v1/status',phone)).body.jobs[0].status,'completed');
 await api('/v1/revoke',key,{});assert.equal((await api('/v1/status',phone)).status,401);
});
test('desktop heartbeat expires at 15 seconds and relay restart never restores online from disk',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ailo-presence-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));let time=100000;const bootstrap='presence-fixture-'.repeat(3);let relay;
 async function start(){relay=await createRelay({directory,bootstrap,now:()=>time});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));}
 await start();t.after(()=>relay.close());
 const api=async(route,key,body)=>{const r=await fetch('http://127.0.0.1:'+relay.server.address().port+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return r.json();};
 const key=(await api('/v1/register',bootstrap,{})).desktopToken,code=(await api('/v1/pair-code',key,{})).code,phone=(await api('/v1/pair','',{code})).phoneToken;
 assert.equal((await api('/v1/status',phone)).online,false);
 await api('/v1/sync',key,{});assert.equal((await api('/v1/status',phone)).online,true);
 time+=14000;assert.equal((await api('/v1/status',phone)).onlineForMs,1000);
 time+=1000;assert.equal((await api('/v1/status',phone)).online,false);
 await api('/v1/sync',key,{});await relay.close();await start();assert.equal((await api('/v1/status',phone)).online,false);
 await api('/v1/sync',key,{});assert.equal((await api('/v1/status',phone)).online,true);
 time-=1000;assert.equal((await api('/v1/status',phone)).online,false);
});
