export type PairingPayload={type:'ailo-pair';version:1;url:string;code:string;expires:number};
export function parsePairingQR(raw:string,now=Date.now()):PairingPayload{
 if(raw.length>2048)throw Error('二维码内容过长');let p;try{p=JSON.parse(raw);}catch{throw Error('这不是Ailo配对二维码');}
 if(!p||p.type!=='ailo-pair'||p.version!==1||typeof p.url!=='string'||typeof p.code!=='string'||!/^\d{8}$/.test(p.code)||!Number.isFinite(p.expires))throw Error('二维码格式无效');
 const u=new URL(p.url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('手机配对需要HTTPS服务根地址');
 if(p.expires<=now||p.expires>now+10*60*1000)throw Error('二维码已过期或时间不正确，请在电脑重新生成');return {...p,url:u.origin};
}
