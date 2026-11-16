import type {Submission} from './submission';
import type {Job,Snapshot} from './live-data';
type ClientError=Error&{code?:string;status?:number};
export function requestTimeout(route:string,body?:unknown){return route==='/v1/jobs'&&!!(body as Submission|undefined)?.attachments?.length?90000:route.startsWith('/v1/status')?30000:12000;}
export async function relayRequest(base:string,key:string,route:string,body?:unknown,options:{fetchImpl?:typeof fetch;timeoutMs?:number;signal?:AbortSignal}={}){
 const controller=new AbortController(),external=()=>controller.abort(options.signal?.reason);
 if(options.signal?.aborted)external();else options.signal?.addEventListener('abort',external,{once:true});
 const timer=setTimeout(()=>controller.abort(new Error('RELAY_TIMEOUT')),options.timeoutMs??requestTimeout(route,body));
 try{
  const r=await (options.fetchImpl||fetch)(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
  let value;try{value=await r.json();}catch{if(controller.signal.aborted)throw Error('aborted');throw Object.assign(Error('云端返回了无法读取的回执（HTTP '+r.status+'），提交结果仍需核对。'),{code:'RELAY_INVALID_RESPONSE',...(r.ok?{}:{status:r.status})});}
  if(!r.ok)throw Object.assign(Error(value?.error||'云端请求失败（HTTP '+r.status+'）'),{status:r.status});return value;
 }catch(e){
  const error=e as ClientError;if(error.status||error.code==='RELAY_INVALID_RESPONSE')throw error;
  if(options.signal?.reason==='RECEIPT_CONFIRMED')throw Object.assign(Error('原提交已确认接收'),{code:'RECEIPT_CONFIRMED'});
  throw Object.assign(Error(controller.signal.aborted?'与云端的请求等待超时或已中断。':'手机与云端连接中断，请检查网络。'),{code:controller.signal.aborted?'RELAY_TIMEOUT':'RELAY_NETWORK'});
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',external);}
}
export function matchesReceipt(request:Submission,job:Job&{requestedTaskId?:string}){return job.id===request.id&&job.text===request.text&&job.requestedTaskId===request.taskId;}
export async function submitWithReceipt(request:Submission,api:(route:string,body?:unknown)=>Promise<any>):Promise<Job>{
 try{const receipt=await api('/v1/jobs',request);if(!matchesReceipt(request,receipt))throw Error('回执与原提交不一致');return receipt;}
 catch(e){
  const error=e as ClientError;if(error.code==='RECEIPT_CONFIRMED'||error.status&&error.status<500)throw error;
  try{const receipt=await api('/v1/jobs/'+encodeURIComponent(request.id));if(matchesReceipt(request,receipt))return receipt;}catch{}
  try{const snapshot=await api('/v1/status') as Snapshot;const receipt=snapshot.jobs.find(j=>matchesReceipt(request,j));if(receipt)return receipt;}catch{}
  throw Object.assign(Error('手机与云端传输中断，尚未确认是否接收。已保留原提交ID，将自动核对；点击重试也不会创建重复任务。'),{code:'SUBMISSION_RESULT_UNKNOWN'});
 }
}
