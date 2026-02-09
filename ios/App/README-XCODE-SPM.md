# Xcode 报错「Missing package product 'CapApp-SPM'」说明

## 原因

**本机无法连接 GitHub（443 端口）**，Swift 包无法拉取 `capacitor-swift-pm`，解析失败后就会报「Missing package product 'CapApp-SPM'」。

终端执行可看到具体错误：
```bash
cd ios/App/CapApp-SPM && swift package resolve
# 会出现：Failed to connect to github.com port 443 ... Couldn't connect to server
```

---

## 解决方式（任选其一）

### 方式一：恢复网络访问 GitHub（推荐）

- 使用 **VPN** 或 **代理**，确保能访问 `github.com`。
- 然后：
  1. 打开 Xcode，打开 `ios/App/App.xcodeproj`
  2. **File → Packages → Reset Package Caches**
  3. **File → Packages → Resolve Package Versions**
  4. 等待解析完成后再构建。

### 方式二：为 Git 配置 HTTP 代理（推荐，无身份冲突）

若本机已开代理（如 127.0.0.1:7890），在终端执行：

```bash
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy https://127.0.0.1:7890
```

把 `7890` 换成你自己的代理端口。然后：
1. **先关掉 Xcode**
2. 删除 Swift 包缓存：`rm -rf ~/Library/Caches/org.swift.swiftpm`
3. 重新打开 Xcode → **File → Packages → Reset Package Caches** → **Resolve Package Versions**

### 若出现「Conflicting identity for capacitor-swift-pm」

说明之前用过镜像，和当前缓存的包身份冲突。请：

1. 已把 `Package.swift` 改回官方 GitHub 地址（不再用镜像）。
2. **完全退出 Xcode**，在终端执行清缓存：
   ```bash
   rm -rf ~/Library/Caches/org.swift.swiftpm
   ```
3. 重新打开 `ios/App/App.xcodeproj`，再 **File → Packages → Reset Package Caches** → **Resolve Package Versions**。

之后用 **方式一（VPN）** 或 **方式二（Git 代理）** 保证能连上 GitHub，不要再用镜像，避免再次冲突。

---

### 方式三：使用 GitHub 镜像（可能产生 Conflicting identity，慎用）

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
