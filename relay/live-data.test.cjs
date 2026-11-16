const {test}=require('node:test'),assert=require('node:assert/strict');
const {matchingHistory,desktopTasks,filteredJobs}=require('../live-data.ts');
test('connected task list includes shared desktop tasks, deduplicates linked jobs, and keeps incomplete separate',()=>{
 const data={online:true,lastSeen:1,device:'fixture',jobs:[{id:'j',taskId:'linked',text:'手机任务',status:'running'}],history:[{id:'linked',title:'同步任务',status:'running',messages:[]},{id:'desktop',title:'电脑日报',status:'completed',messages:[]},{id:'limited',title:'待核查',status:'limited',messages:[]},{id:'chat',title:'空会话',status:'conversation',messages:[]}]};
 assert.deepEqual(desktopTasks(data,'全部').map(c=>c.id),['desktop','limited','chat']);assert.equal(filteredJobs(data,'进行中').length,1);assert.deepEqual(desktopTasks(data,'已完成').map(c=>c.id),['desktop']);assert.deepEqual(desktopTasks(data,'待处理').map(c=>c.id),['limited']);assert.equal(matchingHistory(data,'日报')[0].id,'desktop');assert.deepEqual(matchingHistory(null,''),[]);
});
const {currentChat}=require('../live-data.ts');
const {parsePairingQR}=require('../pairing.ts');
test('sent chat survives receipt/history delay, deduplicates by identity and never merges another conversation',()=>{
 const j={id:'j',text:'same',taskId:'t',status:'completed',result:'reply'};
 assert.deepEqual(currentChat(null,null,j).messages.map(m=>m.content),['same','reply']);
 const d={history:[{id:'t',title:'t',messages:[{id:'older',role:'user',content:'same'},{id:'mobile-input-j',role:'user',content:'same'},{id:'mobile-input-j-assistant',role:'assistant',content:'reply'}]}]};
 assert.equal(currentChat(d,'t',j).messages.length,3);
 assert.equal(currentChat(d,'other',j).messages.length,0);
});
test('scanner accepts short lived HTTPS payload; rejects expired, malformed and insecure codes',()=>{
 const p={type:'ailo-pair',version:1,url:'https://example.com',code:'12345678',expires:2000};
 assert.equal(parsePairingQR(JSON.stringify(p),1000).url,p.url);
 for(const bad of [null,{}, {...p,code:12345678},{...p,expires:999},{...p,url:'http://example.com'},{...p,url:'https://user:pass@example.com'},{...p,url:'https://example.com/path'},{...p,version:2}])assert.throws(()=>parsePairingQR(JSON.stringify(bad),1000));
});
const {desktopConnection}=require('../live-data.ts');
test('cached online presence expires, cloud failures are unknown and server leases are not extended',()=>{
 const online={online:true,onlineForMs:4000};
 assert.equal(desktopConnection(online,1000,2000,false),'online');
 assert.equal(desktopConnection(online,1000,5000,false),'unknown');
 assert.equal(desktopConnection(online,1000,2000,true),'unknown');
 assert.equal(desktopConnection(online,0,2000,false),'unknown');
 assert.equal(desktopConnection({online:false},1000,2000,false),'offline');
 assert.equal(desktopConnection({online:true},1000,16000,false),'unknown');
});
