import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {fitPhoto,photoTarget,MAX_FILE_BYTES,MAX_TOTAL_BYTES} from './photo-policy';
import {Platform} from 'react-native';
export type Attachment={id:string;name:string;size:number;base64:string;image:boolean;uri:string;optimized?:boolean};
const MAX=MAX_FILE_BYTES;
async function read(uri:string,file?:globalThis.File){
 if(Platform.OS!=='web')return new File(uri).base64();
 if(!file)throw Error('无法读取这个网页附件');
 return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('附件读取失败'));reader.readAsDataURL(file);});
}
export async function pickAttachments(kind:'camera'|'photos'|'files',remainingBytes=MAX_TOTAL_BYTES,maxCount=3):Promise<Attachment[]>{
 if(maxCount<1)throw Error('一次最多3个附件，请移除部分附件后再选择。');
 if(kind==='files'){
  const r=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true,type:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/markdown','text/csv','application/json','image/png','image/jpeg','image/webp','image/gif']});
  if(r.canceled)return [];
  if(r.assets.length>maxCount)throw Error('当前还可添加'+maxCount+'个附件，请减少选择。');
  return Promise.all(r.assets.map(async a=>{const size=a.size??(Platform.OS==='web'?a.file?.size: new File(a.uri).size)??MAX+1;if(size>MAX)throw Error(a.name+' 超过2MB，请压缩后再选');return {id:Math.random().toString(36),name:a.name,size,base64:await read(a.uri,a.file),image:!!a.mimeType?.startsWith('image/'),uri:a.uri};}));
 }
 if(kind==='camera'&&!(await ImagePicker.requestCameraPermissionsAsync()).granted)throw Error('拍照需要相机权限，可在iPhone设置中为Ailo开启。');
 const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:1,base64:false,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,allowsMultipleSelection:kind==='photos',selectionLimit:maxCount};
 const r=kind==='camera'?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
 if(r.canceled)return [];
 if(r.assets.length>maxCount)throw Error('当前还可添加'+maxCount+'个附件，请减少选择。');
 const target=photoTarget(remainingBytes,r.assets.length),files:Attachment[]=[];
 // Process one photo at a time to avoid decoding several 48MP images at once.
 for(const [i,a] of r.assets.entries()){
  const image=await fitPhoto(a.width,a.height,target,async step=>{
   const context=ImageManipulator.manipulate(a.uri);let rendered;
   try{context.resize({width:step.width,height:step.height});rendered=await context.renderAsync();return await rendered.saveAsync({format:SaveFormat.JPEG,compress:step.quality,base64:true});}
   finally{rendered?.release();context.release();}
  },async image=>{if(Platform.OS!=='web')try{new File(image.uri).delete();}catch{}});
  files.push({id:Math.random().toString(36),name:(a.fileName?a.fileName.replace(/\.[^.]+$/,''):'照片-'+Date.now()+'-'+i)+'.jpg',size:image.size,base64:image.base64,image:true,uri:image.uri,optimized:true});
 }
 return files;
}
