# MjScoreBoard iOS 上架指南

这份指南按当前工程状态写：React/Vite 前端 + Capacitor 8 + Xcode SPM。上架 iOS 主要看签名、Archive、App Store Connect 信息和审核说明。

## 当前工程状态

- App ID / Bundle ID：`com.mjscoreboard.app`
- App 显示名：`国标麻将实时计分板`
- iOS 最低版本：`15.0`
- 当前 iOS 版本号：`1.0 (2)`
- Xcode Team：当前工程里是 `X897J7C9H2`，如果这不是你的 Apple Developer Team，需要在 Xcode 里改成你的团队。
- 原生插件：`BluetoothLe`、`KeepAwake`、`Filesystem`
- 数据形态：当前代码未发现网络上传、广告、统计 SDK；计分数据保存在本机 IndexedDB/localStorage，导出文件写到本机 Documents。

## 每次上传前先跑

在项目根目录执行：

```bash
npm run ios:release-check
```

这条命令会自动完成 Web 构建、Capacitor iOS 同步、Xcode Release 编译检查。它通过后，再打开 Xcode 做签名和上传：

```bash
npm run ios:open
```

如果 Xcode 打开后提示 Swift Package 解析问题，先看 `ios/App/README-XCODE-SPM.md`。

## Xcode 里检查

打开 `ios/App/App.xcodeproj`，选中 `TARGETS -> App`。

1. General
   - `Display Name`：保持 `国标麻将实时计分板`，或改成你最终要在手机桌面显示的名字。
   - `Bundle Identifier`：保持 `com.mjscoreboard.app`，必须和 App Store Connect / Apple Developer 后台一致。
   - `Version`：首次可用 `1.0`。
   - `Build`：当前是 `2`；每次重新上传必须递增，比如 `3`、`4`。

2. Signing & Capabilities
   - 勾选 `Automatically manage signing`。
   - `Team` 选择你的付费 Apple Developer 团队。
   - 如果 Xcode 报证书或描述文件错误，先到 Apple Developer 后台确认这个 Bundle ID 已创建。

3. App Icon / Launch Screen
   - 当前有 `1024x1024` App Store 图标，Xcode Release 构建已通过。
   - 启动页使用 `LaunchScreen.storyboard`，一般不需要单独处理。

## Archive 并上传

1. Xcode 顶部设备选择 `Any iOS Device (arm64)`，不要选模拟器。
2. 菜单选择 `Product -> Archive`。
3. Archive 成功后会打开 Organizer。
4. 选择刚生成的 Archive，点 `Distribute App`。
5. 选择 `App Store Connect -> Upload`。
6. 上传完成后等待 App Store Connect 处理构建版本。

## App Store Connect 填写

首次创建 App：

- 平台：`iOS`
- Bundle ID：`com.mjscoreboard.app`
- SKU：可填 `mjscoreboard-ios`
- 分类建议：`工具` 或 `娱乐`
- 隐私政策 URL：iOS App 需要提供一个可访问的隐私政策页面。

版本页需要准备：

- App 名称、简介、副标题、关键词、描述。
- 支持 URL、隐私政策 URL。
- 截图：按 App Store Connect 当前提示上传；最高分辨率截图通常可以向下复用。
- 构建版本：选择刚从 Xcode 上传的 `1.0 (2)` 或后续新 build。

## App 隐私建议

按当前代码行为，可以这样填，最终以你实际运营方式为准：

- 如果没有服务器、广告、统计 SDK、账号系统：App Privacy 里选择不收集用户数据。
- 计分记录、玩家名、蓝牙设备绑定只存在本机，不上传服务器；Apple 对“只在设备上处理、不传出设备”的数据通常不按 collected data 填。
- 如果未来加了云同步、登录、统计、广告或客服表单，需要重新更新 App Privacy。

## 审核备注建议

因为 App 需要连接自研 BLE 计分显示设备，审核备注里建议写清楚：

```text
本 App 用于国标麻将比赛计分，可通过 Bluetooth LE 连接自研 BLE 计分显示设备。没有外部设备时，App 仍可在手机上完整完成创建比赛、记录分数、查看历史记录等核心流程。蓝牙权限仅用于发现并连接用户自己的计分显示设备。
```

如果审核团队要求演示蓝牙设备，可以补充一段操作路径：

```text
打开 App -> 进入计分页面 -> 点击右上角蓝牙按钮 -> 扫描并连接计分设备。若没有设备，可直接在 App 内完成手动计分流程。
```

## 常见问题

| 问题 | 处理 |
| --- | --- |
| `Archive` 是灰色 | 顶部设备必须选 `Any iOS Device (arm64)`。 |
| Xcode 找不到 `CapApp-SPM` | 先跑 `npm run ios:release-check`；若仍失败，看 `README-XCODE-SPM.md`。 |
| 蓝牙在 iOS 不工作 | 确认 `@capacitor-community/bluetooth-le` 是 8.x，且 `CapApp-SPM/Package.swift` 包含 `CapacitorCommunityBluetoothLe`。 |
| 上传后构建版本不出现 | 等待处理；同时查看 Apple 邮件是否有 `Invalid Binary`。 |
| 审核问蓝牙用途 | 使用上面的审核备注说明自研 BLE 计分显示设备和无设备可用流程。 |
