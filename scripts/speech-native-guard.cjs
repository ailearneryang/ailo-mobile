// Keep requiresOnDeviceRecognition true even for an unsupported locale. The OS
// must reject it rather than silently using a server recognizer (upstream #169).
const fs=require('node:fs'),path=require('node:path');
const before='    if recognizer.supportsOnDeviceRecognition {\n      request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition\n    }';
const after='    // Ailo: never silently downgrade an on-device request to server recognition.\n    request.requiresOnDeviceRecognition = options.requiresOnDeviceRecognition';
function guard(source){if(source.includes(after))return source;if(!source.includes(before))throw Error('语音模块原生实现已变化，需重新核对本机识别保护后才能构建');return source.replace(before,after);}
if(require.main===module){const file=path.join(__dirname,'../node_modules/expo-speech-recognition/ios/ExpoSpeechRecognizer.swift');const source=fs.readFileSync(file,'utf8'),next=guard(source);if(next!==source)fs.writeFileSync(file,next);}
module.exports={guard,before,after};
