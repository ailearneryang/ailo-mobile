# Ailo Mobile

独立的 Ailo 手机客户端，使用 Expo、React Native 和 TypeScript。电脑端负责执行任务，手机通过自托管中转服务查看共享会话、提交任务和阅读结果。

## 已实现

- 配对码与二维码配对，原生凭据保存在 SecureStore。
- 聊天、历史搜索、工作列表、原会话续接与执行状态同步。
- Markdown 标题、重点、列表、表格、引用及代码块排版。
- 电脑心跳有效期、手机断网与前后台恢复时的状态检查。
- iPhone 本机语音转文字；停止后保留草稿，不自动发送。
- Ailo 图标、陪伴宠物，以及相机/照片/文件的本地选择和预览。

附件与工具、技能选择现已接通版本2协议，需要同时更新手机、中转服务和电脑桥接。仅点击发送后上传所选附件；电脑持久接收并校验后删除云端副本，未接收的附件约24小时后清除。每次最多3个、每个2MB、合计3MB。系统推送、多电脑调度及远程权限确认未接入。

## 开发

```sh
npm ci
npm start
npm run typecheck
```

网页预览：`npm run web`。首次连接需要自己的中转服务地址和电脑生成的配对码；演示数据与真实连接分开。

## iPhone 测试

需要 macOS、完整 Xcode、CocoaPods，以及本人在 Xcode 中配置的 Apple 签名团队。无需将密码、验证码或签名密钥写入本工程。

```sh
npm run ios:check
npm run ios:test
```

选择实体 iPhone。默认构建 Release，安装后不依赖 Metro。首次使用需在手机上信任开发者，并允许实际使用的相机、麦克风等权限。详见 [IOS.md](./IOS.md)。原生 `ios/`、`android/` 目录由 Expo 生成，不纳入版本管理。

## 电脑连接与云端部署

详见 [CONNECTION.md](./CONNECTION.md)。中转代码位于 `relay/`，用于个人专用实例，不是多租户服务。其持久数据包含已共享的会话与结果，应部署在自己的服务器并保护数据目录。

本地联调脚本默认查找同级 `../ailo` 桌面工程；本仓库不包含电脑端实现。仅启动手机界面不需要桌面源码，完整联调需要匹配的桌面版本。

## 验证

```sh
npm run typecheck
npm run test:markdown
npm run test:ios-config
node --test scripts/speech-native-guard.test.cjs
npm run test:connection
```

`test:connection` 包含使用同级桌面工程适配器的隔离集成测试，需要 `../ailo`。测试不会调用真实模型或用户任务。编译、离线回归通过不代表已完成真机交互验收。

语音模块通过 `postinstall` 应用本机识别保护，禁止在不支持本机识别时静默降级为网络识别；升级依赖时须重新核对该保护。

## 私有数据

`.local/`、`.env`、依赖、构建产物和签名文件不提交。勿将云端 bootstrap、电脑/手机令牌、用户历史、证书或真实附件加入仓库。
