const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestTimeout,relayRequest,submitWithReceipt,matchesReceipt}=require('../relay-client.ts');
const request={id:'immutable-fixture-001',text:'fixture',attachments:[{name:'photo.jpg',base64:'aGk='}]};
test('photo uploads have an independent timeout; status polling remains bounded',()=>{assert.equal(requestTimeout('/v1/jobs',request),90000);assert.equal(requestTimeout('/v1/jobs',{id:'plain'}),12000);assert.equal(requestTimeout('/v1/status'),30000);});
test('canceled request followed by confirmed receipt restores original job without a second POST',async()=>{
 const calls=[],job={id:request.id,text:request.text,status:'completed',result:'fixture done'};
 const received=await submitWithReceipt(request,async(route,body)=>{calls.push({route,body});if(body)throw Error('fetch request has been canceled');return {jobs:[job]};});
 assert.equal(received,job);assert.equal(calls.filter(c=>c.body).length,1);assert.equal(calls[0].body,request);
});
test('unconfirmed upload remains unknown, original payload is retained and no automatic upload retry occurs',async()=>{
 let posts=0;await assert.rejects(submitWithReceipt(request,async(route,body)=>{if(body){posts++;throw Error('canceled');}return {jobs:[]};}),e=>e.code==='SUBMISSION_RESULT_UNKNOWN');assert.equal(posts,1);assert.equal(request.attachments[0].base64,'aGk=');
 assert.equal(matchesReceipt(request,{id:request.id,text:'other'}),false);assert.equal(matchesReceipt({...request,taskId:'original'},{id:request.id,text:request.text,requestedTaskId:'other'}),false);
});
test('explicit HTTP rejections are preserved rather than reported as accepted',async()=>{
 let calls=0;await assert.rejects(submitWithReceipt(request,async()=>{calls++;throw Object.assign(Error('too large'),{status:413});}),{status:413});assert.equal(calls,1);
});
test('native cancellation and timeout produce a readable typed error; timers and signals are cleaned up',async()=>{
 await assert.rejects(relayRequest('https://example.test','fixture','/v1/jobs',request,{timeoutMs:5,fetchImpl:async(_,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('fetch request has been canceled'))))}),e=>e.code==='RELAY_TIMEOUT'&&!e.message.includes('fetch request'));
 const controller=new AbortController();controller.abort('RECEIPT_CONFIRMED');await assert.rejects(relayRequest('https://example.test','fixture','/v1/jobs',request,{signal:controller.signal,fetchImpl:async()=>{throw Error('aborted');}}),{code:'RECEIPT_CONFIRMED'});
});
