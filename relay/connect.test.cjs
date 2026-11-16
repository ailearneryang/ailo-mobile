const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {prepare}=require('./connect.cjs');
test('one-command setup creates credentials, pairs and reuses private state without environment variables',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ailo-connect-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));let s=await prepare({directory,port:0});
 const config=JSON.parse(await fs.readFile(s.configFile));assert.equal(config.shareHistory,false);assert.equal((await fs.stat(s.configFile)).mode&0o777,0o600);
 const r=await fetch(s.url+'/v1/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:s.pairing.code})});assert.equal(r.status,200);const phone=(await r.json()).phoneToken;await s.close();
 s=await prepare({directory,port:0});t.after(()=>s.close());const again=JSON.parse(await fs.readFile(s.configFile));assert.equal(again.desktopToken,config.desktopToken);assert.notEqual(s.pairing.code,undefined);
 assert.equal((await fetch(s.url+'/v1/status',{headers:{Authorization:'Bearer '+phone}})).status,200);
});
test('occupied port does not reset credentials or kill the existing service',async t=>{
 const d=await fs.mkdtemp(path.join(os.tmpdir(),'ailo-connect-port-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));const first=await prepare({directory:path.join(d,'one'),port:0});t.after(()=>first.close());const port=new URL(first.url).port;
 await assert.rejects(prepare({directory:path.join(d,'two'),port:Number(port)}),/已被占用/);
 assert.equal((await fetch(first.url+'/v1/status')).status,401);
});
