const {test}=require('node:test'),assert=require('node:assert/strict');
const {photoSteps,photoTarget,fitPhoto,base64Bytes,MAX_FILE_BYTES,MAX_TOTAL_BYTES}=require('../photo-policy.ts');
test('48MP iPhone portrait and landscape preserve aspect, small photos never upscale',()=>{
 for(const [w,h] of [[8064,6048],[6048,8064],[1200,800]])for(const s of photoSteps(w,h)){assert.ok(s.width<=w&&s.height<=h);assert.ok(Math.max(s.width,s.height)<=2560);assert.ok(Math.abs(s.width/s.height-w/h)<.002);}
 assert.equal(photoSteps(400,300)[0].width,400);assert.throws(()=>photoSteps(0,300));
});
test('three images and mixed existing files receive a budget that remains compatible with the current relay',()=>{
 assert.equal(photoTarget(MAX_TOTAL_BYTES,1),MAX_FILE_BYTES);assert.equal(photoTarget(MAX_TOTAL_BYTES,3),1024*1024);assert.equal(photoTarget(MAX_TOTAL_BYTES-2*1024*1024,2),512*1024);assert.throws(()=>photoTarget(100*1024,1));assert.equal(base64Bytes('aA=='),1);assert.equal(base64Bytes('aGk='),2);
});
test('a large photo is adapted through bounded attempts; rejected cache copies are removed, source never edited',async()=>{
 const source='file:///original.heic',removed=[],encoded=[];const image=await fitPhoto(8064,6048,1024*1024,async step=>{encoded.push(step);return {uri:'cache-'+encoded.length,base64:Buffer.alloc(encoded.length===1?2500000:600000).toString('base64')};},async x=>removed.push(x.uri));assert.equal(image.size,600000);assert.equal(encoded.length,2);assert.deepEqual(removed,['cache-1']);assert.ok(!removed.includes(source));assert.equal(image.uri,'cache-2');
});
test('failed optimization remains an explicit failure; no oversized photo becomes a sendable attachment',async()=>{
 let calls=0,deleted=0;await assert.rejects(fitPhoto(8064,6048,400000,async()=>({uri:'cache-'+(++calls),base64:Buffer.alloc(500000).toString('base64')}),async()=>{deleted++;}),/分批发送/);assert.equal(calls,7);assert.equal(deleted,7);
});
test('three optimized photos pass the existing server payload validator without changing server limits',async()=>{
 const {normalize}=require('../relay/payload.cjs'),target=photoTarget(MAX_TOTAL_BYTES,3),photos=[];
 for(let i=0;i<3;i++){const p=await fitPhoto(8064,6048,target,async()=>({uri:'cache-'+i,base64:Buffer.alloc(900000).toString('base64')}),async()=>{});photos.push({name:'photo-'+i+'.jpg',base64:p.base64});}
 assert.equal(normalize({version:2,attachments:photos}).attachments.length,3);
});
