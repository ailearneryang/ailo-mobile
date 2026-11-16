#!/usr/bin/env node
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createRelay}=require('./server.cjs');
async function readJSON(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return null;}}
async function privateJSON(file,data){await fs.writeFile(file,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});}
async function prepare({directory,port=8788,shareHistory=false}){
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const secretFile=path.join(directory,'secret.json'),configFile=path.join(directory,'desktop.json');
 let secret=await readJSON(secretFile);
 if(!secret){secret={bootstrap:crypto.randomBytes(32).toString('hex')};await privateJSON(secretFile,secret);}
 const relay=await createRelay({directory:path.join(directory,'relay'),bootstrap:secret.bootstrap});
 try{await new Promise((resolve,reject)=>{relay.server.once('error',reject);relay.server.listen(port,'127.0.0.1',resolve);});}catch(e){if(e.code==='EADDRINUSE')throw Error('本地连接端口 '+port+' 已被占用。若已运行本脚本，请使用原窗口；不会自动关闭其他服务。');throw e;}
 const url='http://127.0.0.1:'+relay.server.address().port;
 const api=async(route,key,body)=>{const r=await fetch(url+route,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||'注册失败');return d;};
 try{
 let config=await readJSON(configFile);
 if(!config){const result=await api('/v1/register',secret.bootstrap,{});config={url,desktopToken:result.desktopToken,shareHistory};await privateJSON(configFile,config);}
 else {config.url=url;if(shareHistory)config.shareHistory=true;await fs.writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});}
 const pairing=await api('/v1/pair-code',config.desktopToken,{});
 return {relay,url,configFile,pairing,close:relay.close};
 }catch(e){await relay.close();throw Error('本地配置未能核验：'+e.message+'。已有配置已保留，不会删除或重置任务。');}
}
async function main(){
 const flags=new Set(process.argv.slice(2));for(const f of flags)if(!['--setup-only','--share-history','--help'].includes(f))throw Error('未知参数：'+f);
 if(flags.has('--help')){console.log('npm run connect\n自动启动私有本地连接服务、注册电脑、显示配对码并启动桌面和网页。\n--setup-only：仅启动连接服务与显示配对信息\n--share-history：明确允许同步现有桌面历史\nCtrl+C：停止本脚本启动的服务，不删除凭据或任务。');return;}
 const root=path.resolve(__dirname,'..'),directory=path.join(root,'.local','connect'),desktop=path.resolve(root,'..','ailo');
 if(!flags.has('--setup-only'))await fs.access(path.join(desktop,'package.json'));
 const preferences=await readJSON(path.join(directory,'preferences.json'));
 const session=await prepare({directory,shareHistory:flags.has('--share-history')||preferences?.shareHistory===true});
 console.log('\nAilo 本地连接已就绪\n服务地址：'+session.url+'\n配对码：'+session.pairing.code+'（5分钟有效）\n电脑配置已自动保存；下次运行将复用。\n此入口仅供本机浏览器联调；手机真机需要可达的HTTPS服务。\n');
 const children=[];let closing=false;
 const close=async()=>{if(closing)return;closing=true;for(const child of children){try{if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');else child.kill();}catch{}}await session.close();console.log('\n本次连接服务已停止，配置与任务保留。');};
 process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
 if(flags.has('--setup-only'))return;
 const run=(args,cwd,env,filename)=>{const logfile=path.join(directory,filename);const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,env:{...process.env,...env},detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});children.push(child);const output=[];let writing=Promise.resolve();const log=chunk=>{const text=chunk.toString();if(/仍在运行|完全退出|未替换正在运行|已有 Ailo 实例|本次未切换/.test(text))console.error('桌面端未切换到连接版本：'+text.trim());output.push(text);if(output.length>20)output.shift();writing=writing.then(()=>fs.appendFile(logfile,chunk,{mode:0o600})).catch(()=>{});};child.stdout.on('data',log);child.stderr.on('data',log);child.on('error',e=>{console.error(filename+' 启动失败：'+e.message);});child.on('exit',code=>{if(!closing&&code)console.error(filename+' 退出（'+code+'），查看日志：'+logfile);});return child;};
 // Fixed separate preview port; never reuse an unrelated existing server.
 run(['run','web','--','--localhost','--port','8083','--clear'],root,{CI:''},'web.log');
 console.log('网页预览：http://localhost:8083（已启用实时更新；首次编译需稍候）');
 console.log('如果仍是旧界面，请确认地址为8083，然后强制刷新：Mac ⌘⇧R / Windows Ctrl+Shift+R。');
 console.log('正在按标准流程打包并启动电脑端，日志：'+path.join(directory,'desktop.log'));
 console.log('若旧版 Ailo 仍在运行，请先正常退出旧版，再运行本脚本。');
 console.log('打开网页 → 点击「连接真实电脑」→ 填写上面的地址与配对码。');
 console.log('若等待打包后配对码已过期，在新 Ailo 菜单选择「手机配对码」即可刷新。');
 console.log('保持此窗口打开，按 Ctrl+C 停止本次启动的进程。不会自动下达任务或调用模型。\n');
 run(['start'],desktop,{AILO_MOBILE_CONFIG:session.configFile},'desktop.log');
}
if(require.main===module)main().catch(e=>{console.error('连接启动失败：'+e.message);process.exitCode=1;});
module.exports={prepare};
