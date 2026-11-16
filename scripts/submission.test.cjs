const {test}=require('node:test'),assert=require('node:assert/strict');const {submission}=require('../submission.ts');
test('selected files are staged only on send, protocol-gated, and immutable for retry',()=>{
 const tools={searchEnabled:true,feishuEnabled:false,amapEnabled:false,extensionIds:['fixture'],mcpConnectionIds:[]},attachments=[{name:'fixture.txt',base64:'aGk='}];
 const args={id:'fixture-id',text:'',attachments,tools,ready:false};assert.throws(()=>submission(args),/更新/);const payload=submission({...args,ready:true});assert.equal(payload.text,'请分析这些附件');attachments[0].base64='changed';tools.extensionIds.push('changed');assert.equal(payload.attachments[0].base64,'aGk=');assert.deepEqual(payload.tools.extensionIds,['fixture']);assert.equal(submission({...args,attachments:[],tools:{...tools,extensionIds:[],mcpConnectionIds:[]},text:'plain'}).version,undefined);
});
