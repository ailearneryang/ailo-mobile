export type Job={id:string;text:string;taskId?:string;status:string;detail?:string;result?:string;artifacts?:{name:string;text:string}[]};
export type Conversation={id:string;title:string;messages:{id?:string;role:string;content:string}[];status?:string;detail?:string;steps?:{id:string;title:string;status:string}[];updatedAt?:string;summary?:string};
export type Snapshot={online:boolean;onlineForMs?:number;lastSeen:number|null;device:string;jobs:Job[];history:Conversation[]};
export function matchingHistory(data:Snapshot|null,query:string){return (data?.history||[]).filter(c=>c.title.toLowerCase().includes(query.trim().toLowerCase()));}
export function matches(status:string,filter:string){return filter==='全部'||filter==='进行中'&&['running','queued','accepted'].includes(status)||filter==='已完成'&&status==='completed'||filter==='待处理'&&['unknown','needs_attention','incomplete','failed','limited'].includes(status);}
export function desktopTasks(data:Snapshot|null,filter:string){const linked=new Set((data?.jobs||[]).map(j=>j.taskId).filter(Boolean));return (data?.history||[]).filter(c=>!linked.has(c.id)&&c.status&&matches(c.status,filter));}
export function filteredJobs(data:Snapshot|null,filter:string){return (data?.jobs||[]).filter(j=>matches(j.status,filter));}
export function currentChat(data:Snapshot|null,selected:string|null,job:Job|null){
 if(selected&&job?.taskId!==selected)job=null;
 const taskId=selected||job?.taskId;
 const conversation=data?.history.find(c=>c.id===taskId);
 const messages=[...(conversation?.messages||[])];
 if(job&&!messages.some(m=>m.id==='mobile-input-'+job.id))messages.push({id:'mobile-input-'+job.id,role:'user',content:job.text});
 if(job?.result&&!messages.some(m=>m.id==='mobile-input-'+job.id+'-assistant'))messages.push({id:'mobile-input-'+job.id+'-assistant',role:'assistant',content:job.result});
 return {conversation,messages,status:job?.status||conversation?.status||'conversation',title:conversation?.title||job?.text||'会话详情',detail:job?.detail||conversation?.detail};
}
export function desktopConnection(data:Snapshot|null,receivedAt:number,now:number,failed:boolean){
 if(failed||!data||!receivedAt||now<receivedAt||now-receivedAt>=15000)return 'unknown';
 if(!data.online)return 'offline';
 const lease=typeof data.onlineForMs==='number'?Math.min(15000,Math.max(0,data.onlineForMs)):15000;
 return now-receivedAt<lease?'online':'unknown';
}
