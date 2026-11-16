# iPhone 开发与测试

当前状态：Release 本机构建已通过；相机、照片、文件选择器和本机语音识别模块已加入。新克隆工程通过 Expo 生成原生目录；签名团队需由开发者本人配置。下面保留环境准备与历史故障记录，早期“尚未安装/未生成”描述仅表示当时状态，当前操作以 README 的运行命令和文末功能说明为准。

# iPhone测试版

工程已准备iOS标识 `com.ailearneryang.ailo.mobile` 与EAS构建配置，尚未创建Expo项目、签名凭据或Apple应用记录。该标识是项目暂定标识，首次注册前需在你的开发者团队确认可用。

## 构建方式

- `preview`：独立内部测试包，iPhone需要登记到开发者账号的设备列表；不依赖Mac上的Metro开发服务器。
- `production`：商店签名构建，可上传App Store Connect进行TestFlight测试，不可作为普通文件直接安装。
- `simulator`：模拟器包，不能安装到真实iPhone。

当前Mac只有Command Line Tools，没有完整Xcode、模拟器或有效签名身份；尚不能本机构建或安装。

## 已有付费Apple开发者账号时

在本工程由本人登录Expo（如需创建账号或接受条款，由本人完成）：

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

按提示本人完成Apple登录/双重验证及设备登记，确认团队、证书和描述文件授权；不把密码、密钥或验证码发到聊天。构建前检查EAS项目归属，工程的 `.easignore` 排除私有连接文件、历史数据及服务端代码。当前尚未上传任何源码或签名资料。

TestFlight路径：

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

上传不是发布成功；仍需本人在App Store Connect完成记录及相应测试配置，必要时经过测试审核。

## 只有普通Apple ID时

可先通过Expo Go验证兼容的开发体验；它不是独立Ailo安装包。或者安装完整Xcode，使用个人团队进行受Apple限制的本机设备测试。不能把未签名IPA当成可直接安装的独立App。

## 真机验收

默认服务地址为 https://175.24.135.20；配对凭据使用系统SecureStore。真机需要测试配对保存、蜂窝网络访问云端、会话与任务同步、键盘遮挡、切后台再回前台恢复。现阶段没有系统推送，不能把后台轮询作为可靠通知。已有网页构建和离线回归不代表真机通过。

## 当前免费真机测试路线

已生成 `ios/Ailo.xcodeproj`，尚未安装CocoaPods、编译或签名。先从Mac App Store安装完整Xcode，打开完成本人条款确认和iOS组件安装。在Xcode → Settings → Accounts登录自己的普通Apple ID。iPhone用USB连接Mac，按设备提示信任电脑，并按需开启开发者模式。

```sh
npm run ios:check
npm run ios:test
```

`ios:test`使用Release配置构建，目标是安装后不依赖Metro预览服务；需要可用签名团队，若签名失败，在原生工程Signing & Capabilities中选择自己的Personal Team，确认标识可用。CocoaPods安装后优先打开 `ios/Ailo.xcworkspace`，不要误开未集成Pods的工程；当前workspace尚未生成。

免费签名和设备测试受Apple限制，无法替代长期TestFlight发行。当前尚无可安装IPA，也未完成真机验证。安装Xcode和Apple登录由本人操作，不需要向助手发送账号密码。

### CocoaPods与模拟器

需要CocoaPods时使用 `brew install cocoapods`，避免依赖系统Ruby 2.6自动安装。`npm run ios:simulator`用于Mac上的iPhone 17模拟器，`npm run ios:test`选择设备时要选择自己的实体手机；列表中的「iPhone 17」可能是模拟器，不表示手机已连接。模拟器构建通过不代表真机签名或安装通过。

### RN与CocoaPods构建脚本兼容（已授权）

真机Debug构建曾因ip.txt和Pods资源临时文件被Xcode脚本沙箱拦截。仅Ailo主App target的Debug/Release配置按Expo官方要求设置 `ENABLE_USER_SCRIPT_SANDBOXING=NO`，不修改系统设置、其他target或Personal Team；此项目级变更已获得用户明确授权。`plugins/with-bundle-output.cjs`保留配置以防prebuild覆盖。此前仅补输出声明的方案未能解决动态rsync文件写入，未作为最终成功方案。

验证：`npm run test:ios-config`及不签名的generic iOS Debug构建通过。此结果不代表已完成实体设备签名、安装或云端任务验收。

### 手机独立启动（内置JS）

Xcode Run默认采用Release；`with-standalone-ios.cjs`在重新生成原生工程时保留此设置。Debug仍可供开发调试使用，但其默认入口依赖Metro，不可当作手机独立测试包。`npm run ios:test`显式使用Release，目标是将main.jsbundle打入App；构建验证需检查实际文件存在且非空，构建成功不等于已完成真机签名与启动。

### 扫码、图标和陪伴宠物

此版本新增原生相机扫码模块，请重新运行 `npm run ios:test`（Release）安装到自己的iPhone，单纯刷新旧App不会增加原生模块或更新图标。
电脑端更新后，在macOS顶部菜单栏选择「Ailo → 手机扫码配对 / 配对码」；手机打开Ailo右上角「＋ → 扫一扫配对电脑」，允许相机、扫描并确认自己的云端地址。二维码5分钟有效，一次性使用。保留手动配对入口。云端中转无需更新。
聊天发送后保留当前会话，等待状态、正文和文本成果在原会话显示。宠物位于首页及聊天输入栏上方，可以摸摸或在＋菜单隐藏。宠物本地动画不调用模型。

### 键盘遮挡回归（2026-11-15）

故障复现：iPhone竖屏，已配对，打开含长回复的会话，点输入框并使用中文九宫格或全键盘输入；旧版键盘遮住输入框下半部分及发送按钮。原因是KeyboardAvoidingView处于SafeAreaView内部，却以零窗口偏移计算键盘位置。
修复：真实连接页面只保留一个位于全屏最外层的键盘避让容器，安全区和聊天布局位于其内部；聊天滚动区可缩小，输入栏不参与压缩。
真机验收：长回复中输入一行、五行及超过输入框最大高度的文本；开启中文候选栏；收起/重开键盘；切换横竖屏；确认光标、当前输入行及发送按钮始终在键盘上方，已输入内容保留。拖动聊天区可以交互式收起键盘。此操作不自动发送消息或调用模型。

### Markdown 阅读排版（2026-11-16）

聊天中的Ailo回复、工作页结果、.md成果采用原生Markdown排版：标题、加粗、列表、引用、分隔线、可点击网页链接；代码和宽表格横向滚动，代码按原文保留，可长按选择复制。用户输入及非Markdown成果继续显示原文。HTML不执行，图片不自动加载，链接只允许HTTP/HTTPS。
复现验收：打开含 `##`、`**重点**`、围栏bash代码及表格的历史回复，核对标题重点层级、命令空格换行、长代码/多列表格横向滚动、长按选择文字、键盘弹出与长文滚动。原文及云端协议不变，更新手机即可，无需重新生成历史回复或更新电脑/云端。检查命令：`npm run typecheck`、`npm run test:markdown`、`npm run test:connection`。

### 输入框语音转文字（2026-11-16）

文本右侧新增18×23的细线麦克风，36×42触控区域，发送按钮独立保留。点击开始中文本机识别，再点结束；识别文字保留在输入框供修改，不自动发任务。首次使用请求麦克风与系统语音识别权限，录音不持久化；要求本机识别，不支持时显示原因，不能静默改用网络识别。
`expo-speech-recognition`上游存在在本机语言不支持时忽略requiresOnDeviceRecognition的分支（GitHub jamsch/expo-speech-recognition #169）。`scripts/speech-native-guard.cjs`在安装与ios:test前保留该请求标志，无匹配源码时显式停止构建。变更有对应回归，升级依赖必须重新核对。
退出聊天、打开附件面板、切后台、错误与录音结束时清理录音并释放音频会话，最长60秒。仅iPhone接入此按钮，其他平台使用系统键盘听写。
真机验收：已有草稿后口述中文；中途点停止并编辑；拒绝权限；切后台和打开相机；确认原输入不丢失、不自动发送，麦克风指示结束，相机和系统听写可正常使用。仅编译通过不代表真机识别准确率已验证。此功能只更新手机端，无需云端和电脑升级。

### 附件真机验收

手机选择照片/拍照/选文件后确认预览，可移除；只在点击发送后上传。验证附件单独发送、搭配文字、技能工具选择、离线排队、超限和重试。超过24小时仍未接收时应明确失败。用户资料不可用于自动回归，隔离测试使用临时文本和假模型；真机相机与原生选择器仍需本人安装后验收。

### 大尺寸 iPhone 照片适配

相机和相册照片不再因原始文件大于2MB直接拒绝：先按最长边最多2560像素等比例生成JPEG副本，再有界调整尺寸与质量，适配当前剩余的3MB合计额度与单个2MB上限。多张照片顺序处理，避免同时解码多个48MP图像；尺寸不会放大。失败时保留原草稿并明确提示分批或裁剪，不发送超限图像。相册原图不修改，文件入口仍按原文件2MB限制处理。输入栏展示处理进度、已优化标记与实际大小。
此次仅需更新手机App（新增expo-image-manipulator原生模块），电脑与云端协议和限制不变。
离线回归：`npm run test:photos`，覆盖48MP横竖图、三张图与混合附件额度、精确base64字节数、失败清理和当前中转校验兼容；编码器采用隔离替身，不能代替真实设备照片测试。真机验收需选择一张大于2MB的照片、三张高像素照片、已有2MB文件后再加照片，确认缩放方向正确、原相册未变化、最终附件额度内并可发送。

### 照片请求取消与回执恢复

修复“fetch request has been canceled”：附件提交采用独立90秒请求窗口，状态查询最多30秒，心跳有效期从本次请求开始保守计时。请求中断不等于未送达；先读取云端已有状态，以同一提交ID、正文与原会话目标核对回执。后台轮询也能确认原提交；确认后恢复该任务并停止等待旧HTTP请求。未确认时保留原ID、附件和选择，不自动重新POST，手动重试仍沿用原ID。明确400/413/429拒绝允许修正草稿。
手机断线后的回执核查兼容旧接口；完整修复还包括电脑仅同步变化的回执、仅显式领取时取照片、云端跳过未变化的历史，需更新三端。回归覆盖取消后已接收、结果未知、明确拒绝、状态对不上与原始ID保持；未重放真实用户任务。
