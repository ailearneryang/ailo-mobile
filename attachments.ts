import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {Platform} from 'react-native';
export type Attachment={id:string;name:string;size:number;base64:string;image:boolean;uri:string};
const MAX=2*1024*1024;
async function read(uri:string,file?:globalThis.File){
 if(Platform.OS!=='web')return new File(uri).base64();
 if(!file)throw Error('无法读取这个网页附件');
 return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('附件读取失败'));reader.readAsDataURL(file);});
}
export async function pickAttachments(kind:'camera'|'photos'|'files'):Promise<Attachment[]>{
 if(kind==='files'){
  const r=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true,type:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/markdown','text/csv','application/json','image/png','image/jpeg','image/webp','image/gif']});
  if(r.canceled)return [];
  if(r.assets.length>3)throw Error('一次最多选择3个附件');
  return Promise.all(r.assets.map(async a=>{const size=a.size??(Platform.OS==='web'?a.file?.size: new File(a.uri).size)??MAX+1;if(size>MAX)throw Error(a.name+' 超过2MB，请压缩后再选');return {id:Math.random().toString(36),name:a.name,size,base64:await read(a.uri,a.file),image:!!a.mimeType?.startsWith('image/'),uri:a.uri};}));
 }
 if(kind==='camera'&&!(await ImagePicker.requestCameraPermissionsAsync()).granted)throw Error('拍照需要相机权限，可在iPhone设置中为Ailo开启。');
 const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:.65,base64:true,allowsMultipleSelection:kind==='photos',selectionLimit:3};
 const r=kind==='camera'?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
 if(r.canceled)return [];
 return Promise.all(r.assets.map(async (a,i)=>{const base64=a.base64;if(!base64)throw Error('照片转换失败，请重新选择或改用文件入口');const size=Math.floor(base64.length*3/4);if(size>MAX)throw Error('照片超过2MB，请缩小尺寸后再选择');const suffix='jpg';return {id:Math.random().toString(36),name:(a.fileName?a.fileName.replace(/\.[^.]+$/,''):'照片-'+Date.now()+'-'+i)+'.'+suffix,size,base64,image:true,uri:a.uri};}));
}
