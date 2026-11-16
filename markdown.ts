import MarkdownIt from 'markdown-it';
const parser=new MarkdownIt({html:false,linkify:true,breaks:true});
export type MarkdownNode={type:string;tag:string;content:string;info:string;attrs:Record<string,string>;children:MarkdownNode[]};
export function markdownTree(source:string):MarkdownNode[]{
 const convert=(tokens:ReturnType<typeof parser.parse>)=>{
  const root:MarkdownNode[]=[],stack=[root];
  for(const t of tokens){
   if(t.nesting===-1){if(stack.length>1)stack.pop();continue;}
   const node:MarkdownNode={type:t.type,tag:t.tag,content:t.content,info:t.info,attrs:Object.fromEntries((t.attrs||[]).map(([key,value])=>[key,String(value)])),children:t.children?convert(t.children):[]};
   stack[stack.length-1].push(node);if(t.nesting===1)stack.push(node.children);
  }
  return root;
 };
 return convert(parser.parse(source,{}));
}
export function webLink(value:string){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
