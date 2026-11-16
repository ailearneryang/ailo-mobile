const {test}=require('node:test'),assert=require('node:assert/strict');
const {guard,before,after}=require('./speech-native-guard.cjs');
test('on-device option is never silently downgraded when recognizer reports unsupported',()=>{
 const source='native prefix\n'+before+'\nnative suffix';const next=guard(source);
 assert.ok(next.includes(after));assert.ok(!next.includes('if recognizer.supportsOnDeviceRecognition'));
 assert.equal(guard(next),next);assert.throws(()=>guard('changed native implementation'),/重新核对/);
});
