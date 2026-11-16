export type Submission={id:string;text:string;taskId?:string;version?:2;attachments?:{name:string;base64:string}[];tools?:{searchEnabled:boolean;feishuEnabled:boolean;amapEnabled:boolean;extensionIds:string[];mcpConnectionIds:string[]}};
export function submission({text,taskId,attachments,tools,ready,id}:{text:string;taskId?:string;attachments:{name:string;base64:string}[];tools:NonNullable<Submission['tools']>;ready:boolean;id:string}):Submission{
 if((attachments.length||tools.extensionIds.length||tools.mcpConnectionIds.length||tools.feishuEnabled||tools.amapEnabled||!tools.searchEnabled)&&!ready)throw Error('请先更新云端与电脑端，等待附件与工具服务就绪后再发送。');
 return {id,text:text.trim()||(attachments.length?'请分析这些附件':''),...(taskId?{taskId}:{}),...(ready?{version:2,attachments:attachments.map(({name,base64})=>({name,base64})),tools:{...tools,extensionIds:[...tools.extensionIds],mcpConnectionIds:[...tools.mcpConnectionIds]}}:{})};
}
