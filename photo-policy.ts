export const MAX_FILE_BYTES=2*1024*1024;
export const MAX_TOTAL_BYTES=3*1024*1024;
export function base64Bytes(value:string){return Math.max(0,value.length*3/4-(value.endsWith('==')?2:value.endsWith('=')?1:0));}
export function photoTarget(remainingBytes:number,count:number){
 if(!Number.isFinite(remainingBytes)||!Number.isInteger(count)||count<1||count>3)throw Error('照片数量或附件额度无效');
 const target=Math.min(MAX_FILE_BYTES,Math.floor(remainingBytes/count));
 if(target<200*1024)throw Error('剩余附件空间不足以保留清晰照片，请移除部分附件或分批发送。');
 return target;
}
export function photoSteps(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('无法读取照片尺寸，请重新选择。');
 return [[2560,.86],[2560,.72],[2048,.78],[2048,.60],[1600,.68],[1280,.60],[1024,.55]].map(([edge,quality])=>{
  const scale=Math.min(1,edge/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality};
 });
}
export async function fitPhoto<T extends {base64?:string;uri:string}>(width:number,height:number,target:number,encode:(step:{width:number;height:number;quality:number})=>Promise<T>,discard:(image:T)=>Promise<void>){
 for(const step of photoSteps(width,height)){
  const image=await encode(step),size=image.base64?base64Bytes(image.base64):0;
  if(size>0&&size<=Math.min(target,MAX_FILE_BYTES))return {...image,base64:image.base64!,size,width:step.width,height:step.height};
  await discard(image);
 }
 throw Error('照片优化后仍超出剩余附件空间，请分批发送，或先裁剪需要分析的区域。');
}
