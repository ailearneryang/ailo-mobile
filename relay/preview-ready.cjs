async function waitForPreview(url,{timeoutMs=60000,intervalMs=500,exited=()=>false}={}){
 const end=Date.now()+timeoutMs;
 while(Date.now()<end){if(exited())throw Error('网页预览进程已退出，请查看终端中的Expo错误');try{const r=await fetch(url,{signal:AbortSignal.timeout(Math.min(2000,Math.max(1,end-Date.now())))});if(r.ok&&(r.headers.get('content-type')||'').includes('text/html')){const text=await r.text();if(/<html/i.test(text))return;}}catch{}await new Promise(r=>setTimeout(r,intervalMs));}
 throw Error('网页预览未在限时内就绪，请查看Expo编译日志；尚不能认为网页已启动成功');
}
module.exports={waitForPreview};
