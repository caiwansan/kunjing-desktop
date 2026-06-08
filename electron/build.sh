#!/bin/bash
# ========================================
# 昆仑镜桌面版 - 构建脚本
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
DESKTOP_DIR="$SCRIPT_DIR"
BUILD_TIME=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "  昆仑镜桌面版构建 v1.0.0"
echo "  构建时间: $BUILD_TIME"
echo "========================================"

# Step 1: 构建前端 SPA
echo ""
echo "[1/3] 构建前端 SPA..."
cd "$FRONTEND_DIR"
npx nuxi build 2>&1 | tail -5
echo "  ✅ 前端构建完成"

# Step 2: 复制到桌面 web 目录
echo ""
echo "[2/3] 复制前端静态文件..."
mkdir -p "$DESKTOP_DIR/web"
rm -rf "$DESKTOP_DIR/web/*"
cp -r "$FRONTEND_DIR/.output/public/"* "$DESKTOP_DIR/web/"
echo "  ✅ 文件复制完成 ($(du -sh "$DESKTOP_DIR/web" | cut -f1))"

# Step 3: 打包桌面应用
echo ""
echo "[3/3] 打包桌面应用..."

# 解析参数
PLATFORM="${1:-all}"

cd "$DESKTOP_DIR"
case "$PLATFORM" in
  win)
    npx electron-builder --win --x64
    echo "  ✅ Windows 版打包完成"
    ;;
  mac)
    npx electron-builder --mac --x64
    echo "  ✅ macOS 版打包完成"
    ;;
  linux)
    npx electron-builder --linux --x64
    echo "  ✅ Linux 版打包完成"
    ;;
  all)
    npx electron-builder --win --mac --linux --x64 2>&1 | tail -5
    echo "  ✅ 三端打包完成"
    ;;
  *)
    echo "  ⚠️ 未知平台: $PLATFORM，可用: win/mac/linux/all"
    exit 1
    ;;
esac

echo ""
echo "========================================"
echo "  构建完成！"
echo "  输出目录: $DESKTOP_DIR/dist/"
echo "========================================"
