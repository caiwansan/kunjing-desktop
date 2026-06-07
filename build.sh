#!/bin/bash
# 昆仑镜桌面版构建脚本
# 用于将 __API_HOST__ 占位符替换为实际服务器地址
set -e

echo "========== 昆仑镜桌面版构建 =========="

# 1. 替换占位符
if [ -z "$API_HOST" ]; then
  echo "⚠️  未设置 API_HOST，使用默认占位符"
  echo "   构建后需手动修改 nuxt.config.ts 中的 __API_HOST__"
else
  echo ">>> 替换 API_HOST: $API_HOST"
  find frontend-src -name "*.ts" -o -name "*.vue" -o -name "*.json" | xargs sed -i "s|__API_HOST__|$API_HOST|g" 2>/dev/null || true
fi

# 2. 构建前端
echo ">>> 构建前端..."
cd frontend-src
npm install
npx nuxi generate
cd ..

# 3. 编译 Electron 主进程
echo ">>> 编译 Electron..."
npx tsc --project tsconfig.electron.json

# 4. 打包桌面应用
if [ "$1" == "package" ]; then
  echo ">>> 打包..."
  npx electron-builder --${2:-mac}
  echo "✅ 打包完成，产物在 release/ 目录"
else
  echo "✅ 构建完成，Electron 可直接运行"
fi
