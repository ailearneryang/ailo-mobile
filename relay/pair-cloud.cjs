const fs=require('node:fs/promises'),path=require('node:path');
const {validateConfig}=require('./connect-cloud.cjs');
async function getPairCode(config,{fetchImpl=fetch}={}){const url=validateConfig(config);const r=await fetchImpl(url+'/v1/pair-code',{method:'POST',headers:{Authorization:'Bearer '+config.desktopToken,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||'获取配对码失败');if(!/^\d{8}$/.test(String(d.code)))throw Error('服务返回的配对码格式无效');return {url,code:d.code};}
async function main(){if(!process.argv[2])throw Error('用法：npm run pair:cloud -- /配置文件路径');const config=JSON.parse(await fs.readFile(path.resolve(process.argv[2]),'utf8'));const p=await getPairCode(config);console.log('服务地址：'+p.url+'\n配对码：'+p.code+'（5分钟有效，仅限自己的设备使用）\n只刷新配对码，不重新注册、不重启Ailo。');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={getPairCode};
