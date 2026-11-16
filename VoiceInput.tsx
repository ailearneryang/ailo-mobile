import React,{useEffect,useRef,useState} from 'react';
import {View,Pressable,StyleSheet,Platform,AppState} from 'react-native';
import {ExpoSpeechRecognitionModule as speech,useSpeechRecognitionEvent} from 'expo-speech-recognition';
export default function VoiceInput({value,onChange,onActive,onError,disabled}:{value:string;onChange:(text:string)=>void;onActive:(active:boolean)=>void;onError:(text:string)=>void;disabled:boolean}){
 const [active,setActive]=useState(false),[preparing,setPreparing]=useState(false);
 const alive=useRef(true),listening=useRef(false),base=useRef(''),generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const release=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;listening.current=false;if(Platform.OS==='ios')try{speech.setAudioSessionActiveIOS(false,{notifyOthersOnDeactivation:true});}catch{};if(alive.current){setActive(false);setPreparing(false);onActive(false);}};
 const cancel=()=>{generation.current++;try{speech.abort();}catch{}release();};
 useSpeechRecognitionEvent('start',()=>{if(!alive.current){cancel();return;}if(timer.current)clearTimeout(timer.current);listening.current=true;setPreparing(false);setActive(true);onActive(true);timer.current=setTimeout(()=>{try{speech.stop();}catch{cancel();}},60000);});
 useSpeechRecognitionEvent('result',event=>{if(!alive.current||!listening.current)return;const text=event.results[0]?.transcript;if(text!==undefined)onChange(base.current+(base.current?' ':'')+text);});
 useSpeechRecognitionEvent('end',release);
 useSpeechRecognitionEvent('error',event=>{if(alive.current&&event.error!=='aborted')onError(event.error==='no-speech'?'没有识别到语音，请再试一次。':event.error==='not-allowed'?'请在iPhone设置中允许Ailo使用麦克风和语音识别。':'本机语音识别暂不可用，请使用键盘输入或系统键盘听写。');release();});
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',state=>{if(state==='background'||state!=='active'&&listening.current)cancel();});return()=>{alive.current=false;sub.remove();cancel();onActive(false);};},[]);
 useEffect(()=>{if(disabled)cancel();},[disabled]);
 const start=async()=>{
  if(active){try{speech.stop();}catch{cancel();}return;}if(preparing||disabled)return;
  if(Platform.OS!=='ios'){onError('此按钮目前支持iPhone，请使用系统键盘听写输入。');return;}
  const own=++generation.current;setPreparing(true);base.current=value;
  try{const permission=await speech.requestPermissionsAsync();if(!alive.current||own!==generation.current)return;if(!permission.granted)throw Error('请在iPhone设置中允许Ailo使用麦克风和语音识别。');
   timer.current=setTimeout(()=>{if(alive.current)onError('语音识别启动超时，请重试或使用系统键盘听写。');cancel();},10000);
   speech.start({lang:'zh-CN',interimResults:true,continuous:false,requiresOnDeviceRecognition:true,addsPunctuation:true,recordingOptions:{persist:false}});
  }catch(e){if(alive.current&&own===generation.current)onError((e as Error).message);release();}
 };
 return <Pressable accessibilityRole="button" accessibilityLabel={active?'停止语音输入':preparing?'正在准备语音输入':'语音输入'} accessibilityState={{disabled:disabled||preparing,selected:active}} disabled={disabled||preparing} onPress={()=>void start()} style={[s.button,(active||preparing)&&s.selected,disabled&&{opacity:.4}]}>{active?<View style={s.stop}/>:<View style={s.icon}><View style={s.capsule}/><View style={s.arc}/><View style={s.stem}/><View style={s.base}/></View>}</Pressable>;
}
const s=StyleSheet.create({button:{width:36,height:42,alignItems:'center',justifyContent:'center',borderRadius:21,marginLeft:2},selected:{backgroundColor:'#fff0ef'},icon:{width:18,height:23},capsule:{position:'absolute',top:0,left:5,width:8,height:14,borderWidth:1.7,borderColor:'#24262b',borderRadius:5},arc:{position:'absolute',top:7,left:1,width:16,height:12,borderWidth:1.7,borderTopWidth:0,borderColor:'#24262b',borderBottomLeftRadius:9,borderBottomRightRadius:9},stem:{position:'absolute',top:18,left:8,width:1.7,height:4,backgroundColor:'#24262b'},base:{position:'absolute',top:22,left:5,width:8,height:1.7,borderRadius:1,backgroundColor:'#24262b'},stop:{width:12,height:12,borderRadius:3,backgroundColor:'#db493e'}});
