// Expo/RN compatibility: only the main application's build scripts.
const {withXcodeProject}=require('expo/config-plugins');
function configure(project,name='Ailo'){
 const objects=project.hash.project.objects;let found=false;
 for(const target of Object.values(objects.PBXNativeTarget||{})){
  if(!target||typeof target!=='object'||String(target.name).replaceAll('"','')!==name||String(target.productType).replaceAll('"','')!=='com.apple.product-type.application')continue;
  const list=objects.XCConfigurationList[target.buildConfigurationList];if(!list)throw Error('找不到App构建配置');
  for(const ref of list.buildConfigurations){const config=objects.XCBuildConfiguration[ref.value];if(!config)throw Error('App构建配置缺失');config.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING='NO';}found=true;
 }
 if(!found)throw Error('找不到主App target，未修改其他设置');return project;
}
module.exports=config=>withXcodeProject(config,c=>{configure(c.modResults,c.modRequest.projectName||'Ailo');return c;});
module.exports.configure=configure;
