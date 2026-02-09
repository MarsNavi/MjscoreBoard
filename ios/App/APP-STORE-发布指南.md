# MjScoreBoard 上架 App Store 指南

你已有开发者账号，按下面步骤即可打包并提交审核。

---

## 一、发布前检查（在 Xcode 里做一次）

1. **打开项目**  
   用 Xcode 打开 `ios/App/App.xcodeproj`，选中 **TARGETS → App**。

2. **General**
   - **Display Name**：用户在主屏看到的名称，如 `麻将计分板` 或 `MjScoreBoard`。
   - **Bundle Identifier**：保持 `com.mjscoreboard.app`（需与开发者后台已创建的 App ID 一致）。
   - **Version**：对外版本号，如 `1.0`。
   - **Build**：每次上传必须比上次大，如 `1`、`2`、`3`…（只增不减）。

3. **Signing & Capabilities**
   - **Team**：选你的 Apple Developer 账号（付费团队）。
   - **Signing**：选 **Automatically manage signing**，让 Xcode 自动管理证书和描述文件。
   - 若提示 “No signing certificate”或 “No provisioning profile”，在 [Apple Developer](https://developer.apple.com/account) 里确认该 App ID 已创建且未过期。

4. **图标与启动图**
   - **Assets.xcassets → AppIcon**：按规范放齐各尺寸图标（Xcode 会提示缺失尺寸）。
   - 启动图已用 LaunchScreen，一般无需改。

5. **构建 Web 资源（Capacitor 必须）**  
   每次改过网页端后，上传前都要先构建并同步：
   ```bash
   cd 项目根目录
   npm run build
   npx cap sync ios
   ```
   然后再在 Xcode 里 Archive。

---

## 二、打包成 Archive 并上传

1. **选设备**  
   顶部设备选 **Any iOS Device (arm64)**，不要选模拟器。

2. **归档**  
   菜单 **Product → Archive**。  
   若报错，先 **Product → Clean Build Folder**，再 Archive 一次。

3. **上传到 App Store Connect**  
   - 归档完成后会打开 **Organizer** 窗口。
   - 选中刚生成的 Archive，点 **Distribute App**。
   - 选 **App Store Connect** → **Upload** → 下一步。
   - 选项保持默认（如 “Upload your app’s symbols” 可勾选）→ **Upload**。
   - 等上传完成（可能几分钟）。

---

## 三、在 App Store Connect 里提交审核

1. **登录**  
   打开 [App Store Connect](https://appstoreconnect.apple.com)，用开发者账号登录。

2. **创建 App（首次）**  
   - **我的 App** → **+** → **新建 App**。  
   - 平台选 **iOS**，名称、语言、Bundle ID（填 `com.mjscoreboard.app`）、SKU 等按提示填。  
   - Bundle ID 需与 Xcode 里一致，且在 [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) 里已存在该 App ID。

3. **等构建版本出现**  
   上传后约 5～15 分钟，在 App 的 **TestFlight / App Store** 页 **构建版本** 处会出现刚上传的版本（如 1.0 (1)）。若没有，检查邮箱是否有 “Invalid Binary” 等邮件，按提示改。

4. **填写 App 信息（首次或更新时）**  
   - **App 信息**：名称、副标题、分类（如 “娱乐” 或 “工具”）、隐私政策 URL 等。
   - **定价与销售范围**：选免费或价格、国家/地区。
   - **App 隐私**：按实际勾选（你用了蓝牙，需说明用途；若用文件/存储也需说明）。

5. **准备当前版本**  
   - 在 **App Store** 标签下选 **iOS App** 对应的版本（如 1.0）。
   - **构建版本**：点 **+** 选刚上传的构建版本（1.0 (1)）。
   - **版本信息**：版本号、宣传语、描述、关键词、支持 URL、营销 URL（可选）等。
   - **截图**：至少提供 6.5 英寸 iPhone 截图（可再补 iPad 等），按规范尺寸上传。
   - **审核信息**：联系邮箱、电话；若需演示账号或特殊说明（如蓝牙设备测试）在此填写。

6. **提交审核**  
   - 所有必填项填完并保存后，点 **提交以供审核**。  
   - 选择出口合规、广告标识符等选项（按实际情况选）。  
   - 提交后状态变为 “等待审核”，通常 1～3 天内会有结果。

---

## 四、以后每次发新版本

1. 在 Xcode 里把 **Version** 或 **Build** 提高（Build 必须比上次大）。
2. 若有网页改动：`npm run build` → `npx cap sync ios`。
3. **Product → Archive** → **Distribute App** → **App Store Connect** → **Upload**。
4. 在 App Store Connect 里新建一个版本（或选已有版本），选新上传的构建版本，填更新说明，再 **提交以供审核**。

---

## 五、常见问题

| 问题 | 处理 |
|------|------|
| 没有 “Archive” 或灰的 | 设备必须选 **Any iOS Device**，不能选模拟器。 |
| 签名/描述文件报错 | 在 developer.apple.com 检查 App ID、证书、Profiles，Xcode 里 Team 选对。 |
| 上传后构建版本不出现 | 等几分钟；查邮箱 “Invalid Binary” 邮件，按提示改后重新 Archive 上传。 |
| 审核被拒 | 按拒绝理由改（常见：隐私说明、截图、功能说明不清），修改后重新提交。 |

---

**小结**：在 Xcode 里检查版本与签名 → 选 Any iOS Device → Archive → Distribute to App Store Connect → 在 App Store Connect 填信息并提交审核。有开发者账号并按上述做即可完成从打包到上架。
