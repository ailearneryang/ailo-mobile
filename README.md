# Ailo Mobile

独立的 Ailo 手机客户端工程，使用 Expo + React Native + TypeScript，目标支持 Android 与 iOS。

## 开发

```sh
npm install
npm start
npm run typecheck
```

`npm run android` / `npm run ios` 用于相应平台开发，需要已配置的模拟器或设备环境。

## 当前状态

当前仅初始化官方空白模板，尚未实现会话列表、任务管理、账号、同步服务、推送或电脑配对；未连接真实电脑或用户数据。

## 工程边界

与同级 `ailo` 桌面工程分别维护依赖和构建。后续通过版本化 API 连接同步服务和电脑端，不直接依赖桌面内部模块或本地用户文件。当前没有创建云资源或配置发布账号。
