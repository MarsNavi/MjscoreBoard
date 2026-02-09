#!/bin/bash
# 当无法直连 GitHub 时，将 Package.swift 中的 capacitor-swift-pm 改为通过镜像拉取
# 使用后若执行过 npx cap sync ios，需重新运行本脚本

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_SWIFT="$SCRIPT_DIR/Package.swift"

# 可选镜像（若某个不可用可改成别的）：
# https://mirror.ghproxy.com/https://github.com/...
# https://ghproxy.net/https://github.com/...
MIRROR_PREFIX="https://mirror.ghproxy.com/https://github.com"

if grep -q "$MIRROR_PREFIX" "$PACKAGE_SWIFT" 2>/dev/null; then
  echo "当前已是镜像地址，正在恢复为 GitHub 直连..."
  sed -i '' "s|url: \"${MIRROR_PREFIX}/ionic-team/capacitor-swift-pm.git\"|url: \"https://github.com/ionic-team/capacitor-swift-pm.git\"|g" "$PACKAGE_SWIFT"
  echo "已恢复为: https://github.com/ionic-team/capacitor-swift-pm.git"
else
  echo "正在将 capacitor-swift-pm 改为镜像地址..."
  sed -i '' "s|url: \"https://github.com/ionic-team/capacitor-swift-pm.git\"|url: \"${MIRROR_PREFIX}/ionic-team/capacitor-swift-pm.git\"|g" "$PACKAGE_SWIFT"
  echo "已改为: ${MIRROR_PREFIX}/ionic-team/capacitor-swift-pm.git"
fi
echo "请到 Xcode 中执行: File → Packages → Reset Package Caches，再 Resolve Package Versions"
