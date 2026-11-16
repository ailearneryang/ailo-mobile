const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createRelay}=require('./server.cjs');const {createBridge,desktopAdapter}=require('../../ailo/apps/desktop/mobile-bridge.cjs');
async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ailo-upload-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));let now=100000;const bootstrap='fixture-bootstrap-'.repeat(4),relay=await createRelay({directory,bootstrap,now:()=>now});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));t.after(()=>relay.close());const url='http://127.0.0.1:'+relay.server.address().port;const api=async(route,key,body)=>{const r=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};const key=(await api('/v1/register',bootstrap,{})).body.desktopToken,code=(await api('/v1/pair-code',key,{})).body.code,phone=(await api('/v1/pair','',{code})).body.phoneToken;return {directory,url,key,phone,api,advance:n=>now+=n};}
const capabilities={protocolVersion:2,attachmentReceiptVersion:1,extensions:[],connections:[]};
const attachment={name:'fixture.txt',base64:Buffer.from('CONFIDENTIAL_FIXTURE_ONLY').toString('base64')};
test('upload is private, retries immutable, desktop receipt deletes relay bytes, and dispatch executes once',async t=>{
 const f=await fixture(t);await f.api('/v1/sync',f.key,{capabilities});const body={version:2,id:'attachment-job-001',text:'fixture',attachments:[attachment],tools:{searchEnabled:false,extensionIds:[]}};
 assert.equal((await f.api('/v1/jobs',f.phone,body)).status,200);const file=path.join(f.directory,'attachments',body.id+'.json');assert.match(await fs.readFile(file,'utf8'),/base64/);assert.doesNotMatch(await fs.readFile(path.join(f.directory,'state.json'),'utf8'),/CONFIDENTIAL_FIXTURE_ONLY|Q09ORklERU5USUFM/);
 assert.doesNotMatch(JSON.stringify((await f.api('/v1/status',f.phone)).body),/base64/);
 assert.equal((await f.api('/v1/jobs',f.phone,{...body,attachments:[{...attachment,base64:Buffer.from('changed').toString('base64')}]})).status,409);
 assert.equal((await f.api('/v1/sync',f.phone,{receivedAttachments:[body.id]})).status,404);await fs.access(file);
 const desktop=path.join(f.directory,'desktop');let calls=0;const bridge=await createBridge({directory:desktop,url:f.url,key:f.key,capabilities:async()=>capabilities,execute:async job=>{calls++;await assert.rejects(fs.access(file));assert.equal(job.attachments[0].base64,attachment.base64);return {status:'completed',result:'fixture complete'};}});await bridge.tick();bridge.stop();assert.equal(calls,1);
 assert.equal((await f.api('/v1/jobs',f.phone,body)).status,200);await bridge.tick();assert.equal(calls,1);await assert.rejects(fs.access(file));
});
test('24-hour expiry deletes files and never dispatches a task with missing attachments',async t=>{
 const f=await fixture(t);await f.api('/v1/sync',f.key,{capabilities});const body={version:2,id:'attachment-expiry-001',text:'fixture',attachments:[attachment]};await f.api('/v1/jobs',f.phone,body);f.advance(86400001);const snapshot=(await f.api('/v1/status',f.phone)).body;assert.equal(snapshot.jobs[0].status,'failed');assert.match(snapshot.jobs[0].detail,/24小时/);await assert.rejects(fs.access(path.join(f.directory,'attachments',body.id+'.json')));assert.equal((await f.api('/v1/sync',f.key,{capabilities})).body.jobs.length,0);
});
test('outdated desktops cannot receive attachments or tools jobs',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/v1/jobs',f.phone,{id:'old-version-001',text:'fixture',attachments:[attachment]})).status,409);await f.api('/v1/sync',f.key,{capabilities});await f.api('/v1/jobs',f.phone,{id:'old-version-001',text:'fixture',attachments:[attachment]});assert.equal((await f.api('/v1/sync',f.key,{})).body.jobs.length,0);
});
test('heartbeats and receipt updates never carry a pending photo; unchanged history is not resent',async t=>{
 const f=await fixture(t),history=[{id:'fixture-conversation',title:'fixture',messages:[]}];const first=(await f.api('/v1/sync',f.key,{capabilities,pullJobs:false,history})).body;assert.equal(first.jobs.length,0);assert.match(first.historyRevision,/^[a-f0-9]{64}$/);
 const request={version:2,id:'single-photo-pull-001',text:'fixture',attachments:[attachment]};await f.api('/v1/jobs',f.phone,request);
 for(let i=0;i<3;i++){const response=(await f.api('/v1/sync',f.key,{capabilities,pullJobs:false})).body;assert.deepEqual(response.jobs,[]);assert.doesNotMatch(JSON.stringify(response),/base64/);}
 const unchanged=(await f.api('/v1/status?historyRevision='+first.historyRevision,f.phone)).body;assert.equal(unchanged.historyUnchanged,true);assert.equal(unchanged.history,undefined);
 const receipt=(await f.api('/v1/jobs/'+request.id,f.phone)).body;assert.equal(receipt.id,request.id);assert.doesNotMatch(JSON.stringify(receipt),/base64|fixture-conversation/);
 const pull=(await f.api('/v1/sync',f.key,{capabilities,pullJobs:true})).body;assert.equal(pull.jobs[0].attachments[0].base64,attachment.base64);
 await f.api('/v1/sync',f.key,{capabilities,pullJobs:false,history:[...history,{id:'updated'}]});const changed=(await f.api('/v1/status?historyRevision='+first.historyRevision,f.phone)).body;assert.equal(changed.history.length,2);assert.notEqual(changed.historyRevision,first.historyRevision);
});
test('heartbeat and receipt updates never download pending photos; unchanged history is omitted and single receipt lookup is small',async t=>{
 const f=await fixture(t);const history=[{id:'fixture',title:'fixture history',messages:[{role:'user',content:'fixture history content'}]}];let sync=await f.api('/v1/sync',f.key,{capabilities,pullJobs:false,history});assert.equal(sync.body.jobs.length,0);const revision=sync.body.historyRevision;assert.equal(typeof revision,'string');
 const body={id:'selective-pull-001',text:'fixture',attachments:[attachment]};await f.api('/v1/jobs',f.phone,body);
 for(let i=0;i<3;i++){sync=await f.api('/v1/sync',f.key,{capabilities,pullJobs:false});assert.equal(sync.body.jobs.length,0);assert.doesNotMatch(JSON.stringify(sync.body),/base64/);}
 const status=(await f.api('/v1/status?historyRevision='+revision,f.phone)).body;assert.equal(status.historyUnchanged,true);assert.equal(status.history,undefined);assert.equal(status.jobs[0].status,'queued');assert.deepEqual((await f.api('/v1/status',f.phone)).body.history,history);
 const receipt=(await f.api('/v1/jobs/'+body.id,f.phone)).body;assert.equal(receipt.id,body.id);assert.equal(receipt.status,'queued');assert.doesNotMatch(JSON.stringify(receipt),/base64|fixture history content/);
 const delivery=(await f.api('/v1/sync',f.key,{capabilities,pullJobs:true})).body;assert.equal(delivery.jobs[0].attachments[0].base64,attachment.base64);
});
