const {test}=require('node:test'),assert=require('node:assert/strict'),{configure}=require('../plugins/with-bundle-output.cjs');
test('Metro ip.txt and Pods dynamic resources get authorized App-only compatibility setting; signing and other targets stay intact',()=>{
 const settings={ENABLE_USER_SCRIPT_SANDBOXING:'YES',DEVELOPMENT_TEAM:'fixture-team'};
 const objects={
  PBXNativeTarget:{A:{name:'Ailo',productType:'"com.apple.product-type.application"',buildConfigurationList:'L'},W:{name:'Widget',productType:'extension',buildConfigurationList:'WL'}},
  XCConfigurationList:{L:{buildConfigurations:[{value:'D'},{value:'R'}]}},
  XCBuildConfiguration:{D:{buildSettings:settings},R:{buildSettings:{ENABLE_USER_SCRIPT_SANDBOXING:'YES'}},W:{buildSettings:{ENABLE_USER_SCRIPT_SANDBOXING:'YES'}}}
 };
 const project={hash:{project:{objects}}};configure(project);configure(project);
 assert.equal(settings.ENABLE_USER_SCRIPT_SANDBOXING,'NO');assert.equal(settings.DEVELOPMENT_TEAM,'fixture-team');assert.equal(objects.XCBuildConfiguration.R.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING,'NO');assert.equal(objects.XCBuildConfiguration.W.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING,'YES');
});
test('missing App target fails explicitly without modifying unrelated targets',()=>{assert.throws(()=>configure({hash:{project:{objects:{}}}}),/找不到主App/);});
