const fs=require('node:fs/promises'),path=require('node:path');
async function main(){
 const url=process.argv[2]||'https://175.24.135.20',out=process.argv[3]||'/root/ailo-cloud-desktop.json';const u=new URL(url);if(u.protocol!=='https:'||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw Error('需要HTTPS服务根地址');
 const env=await fs.readFile('/etc/ailo-relay/relay.env','utf8'),bootstrap=env.match(/^AILO_RELAY_BOOTSTRAP=(.+)$/m)?.[1]?.trim();if(!bootstrap)throw Error('服务器缺少注册配置');
 const api=async(route,key)=>{const r=await fetch('http://127.0.0.1:8787'+route,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 let config;try{config=JSON.parse(await fs.readFile(out,'utf8'));if(config.url!==u.origin)throw Error('已有配置地址不同，保留原文件，请先检查');}catch(e){if(e.code!=='ENOENT')throw e;const d=await api('/v1/register',bootstrap);config={url:u.origin,desktopToken:d.desktopToken,shareHistory:process.argv.includes('--share-history')};await fs.writeFile(out,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});}
 const pair=await api('/v1/pair-code',config.desktopToken);console.log('电脑连接配置已保存：'+out+'\n请通过腾讯云文件管理下载到自己的电脑，不要发送到聊天或提交仓库。\n云端地址：'+u.origin+'\n手机配对码：'+pair.code+'（5分钟有效；过期可重新运行本脚本获取，不重新注册）');
}
if(require.main===module)main().catch(e=>{console.error('配置失败：'+e.message+'。不要清空服务数据或重复注册来绕过错误。');process.exitCode=1;});
