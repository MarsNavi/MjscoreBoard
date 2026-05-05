# Xcode / SPM 常见问题说明

## 先做本项目的发布检查

在项目根目录执行：

```bash
npm run ios:release-check
```

这条命令会依次完成：

1. 构建 Web 资源。
2. `npx cap sync ios` 同步 iOS 工程。
3. 用 Xcode 命令行做一次 Release 真机包编译检查。

只要这条命令通过，说明 iOS 工程、SPM 依赖和原生插件编译链路基本正常。真正上传 App Store 时仍需要在 Xcode 里使用你的 Apple Developer Team 做签名和 Archive。

## 蓝牙插件版本

本项目使用 Capacitor 8。`@capacitor-community/bluetooth-le` 必须使用 8.x 版本，否则旧版插件没有 `Package.swift`，Capacitor 8 的 SPM 工程会跳过它，导致 iOS 包里没有原生蓝牙插件。

正常同步日志里应看到：

```text
All plugins have a Package.swift file and will be included in Package.swift
Found 3 Capacitor plugins for ios:
@capacitor-community/bluetooth-le
@capacitor-community/keep-awake
@capacitor/filesystem
```

如果看到 `bluetooth-le does not have a Package.swift`，请重新执行：

```bash
npm install @capacitor-community/bluetooth-le@^8.1.3
npm run ios:release-check
```

## Missing package product 'CapApp-SPM'

### 原因

常见原因是本机无法连接 GitHub（443 端口），Swift 包无法拉取 `capacitor-swift-pm`，解析失败后就会报「Missing package product 'CapApp-SPM'」。

终端执行可看到具体错误：
```bash
cd ios/App/CapApp-SPM && swift package resolve
# 会出现：Failed to connect to github.com port 443 ... Couldn't connect to server
```

---

### 解决方式（任选其一）

#### 方式一：恢复网络访问 GitHub（推荐）

- 使用 **VPN** 或 **代理**，确保能访问 `github.com`。
- 然后：
  1. 打开 Xcode，打开 `ios/App/App.xcodeproj`
  2. **File → Packages → Reset Package Caches**
  3. **File → Packages → Resolve Package Versions**
  4. 等待解析完成后再构建。

#### 方式二：为 Git 配置 HTTP 代理（推荐，无身份冲突）

若本机已开代理（如 127.0.0.1:7890），在终端执行：

```bash
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy https://127.0.0.1:7890
```

把 `7890` 换成你自己的代理端口。然后：
1. **先关掉 Xcode**
2. 删除 Swift 包缓存：`rm -rf ~/Library/Caches/org.swift.swiftpm`
3. 重新打开 Xcode → **File → Packages → Reset Package Caches** → **Resolve Package Versions**

#### 若出现「Conflicting identity for capacitor-swift-pm」

说明之前用过镜像，和当前缓存的包身份冲突。请：

1. 已把 `Package.swift` 改回官方 GitHub 地址（不再用镜像）。
2. **完全退出 Xcode**，在终端执行清缓存：
   ```bash
   rm -rf ~/Library/Caches/org.swift.swiftpm
   ```
3. 重新打开 `ios/App/App.xcodeproj`，再 **File → Packages → Reset Package Caches** → **Resolve Package Versions**。

之后用 **方式一（VPN）** 或 **方式二（Git 代理）** 保证能连上 GitHub，不要再用镜像，避免再次冲突。

---

#### 方式三：使用 GitHub 镜像（可能产生 Conflicting identity，慎用）

在项目根目录执行：

```bash
chmod +x ios/App/CapApp-SPM/use-github-mirror.sh
./ios/App/CapApp-SPM/use-github-mirror.sh
```

脚本会把 `Package.swift` 里的 `capacitor-swift-pm` 改为通过镜像站拉取。  
然后到 Xcode：**File → Packages → Reset Package Caches**，再 **Resolve Package Versions**。

- 若镜像不可用，可编辑 `ios/App/CapApp-SPM/use-github-mirror.sh`，把 `MIRROR_PREFIX` 换成别的镜像（如 `https://ghproxy.net/https://github.com`）。
- **注意**：之后若执行了 `npx cap sync ios`，`Package.swift` 会被覆盖，需要再执行一次 `./ios/App/CapApp-SPM/use-github-mirror.sh`。
- 恢复直连：再执行一次 `use-github-mirror.sh` 会从镜像改回 GitHub 直连。

---

## 小结

| 现象 | 原因 | 处理 |
|------|------|------|
| Missing package product 'CapApp-SPM' | 无法连 GitHub，SPM 拉不到 capacitor-swift-pm | 用 VPN/代理、或 Git 代理、或镜像脚本，再在 Xcode 里 Resolve Package Versions |
