# 昆仑镜桌面版 (KunJing Desktop)

> AIGC 影视创作桌面工具 | 基于 Electron + Nuxt 3 + AI 视频生成

**[⬇️ 下载最新版本](https://github.com/caiwansan/kunjing-desktop/releases)** · **[📖 使用教程](#-使用教程)**

---

## 概述

昆仑镜是一款 AI 驱动的影视创作工具，支持：
- **广告视频生成** — 脚本分析 → 分镜规划 → AI 视频生成
- **角色设计** — 多视图角色设定与制服搭配
- **场景设计** — 场景氛围图生成
- **故事板** — 分镜管理与时间轴编辑
- **视频编辑** — 多轨道视频剪辑
- **音乐生成** — AI 配乐

桌面版使用 Electron 封装，密钥加密存储于操作系统（macOS Keychain / Windows Credential Manager）。

---

## 🚀 使用教程

### 第一步：下载安装包

| 系统 | 下载链接 |
|------|---------|
| **macOS (Intel)** | [昆仑镜-x64.dmg](https://github.com/caiwansan/kunjing-desktop/releases/latest) |
| **macOS (Apple Silicon)** | [昆仑镜-arm64.dmg](https://github.com/caiwansan/kunjing-desktop/releases/latest) |
| **Windows** | [昆仑镜-Setup.exe](https://github.com/caiwansan/kunjing-desktop/releases/latest) |
| **Linux** | [昆仑镜.AppImage](https://github.com/caiwansan/kunjing-desktop/releases/latest) |

> **注意**：打包构建需要在自己的电脑上运行，详见「自行打包」章节。

### 第二步：首次启动配置

首次打开昆仑镜，会弹出 **配置向导**，需要填入以下信息：

#### 1. API 服务器地址（必填）
```
https://aigc.fushtn.com
```
这是昆仑镜后端服务的地址，所有 AI 请求通过此地址转发。

#### 2. API Key（至少选择一个平台）
| 服务商 | 用途 | 获取地址 |
|-------|------|---------|
| 🐬 **火山引擎** | 视频生成（Seedance 系列模型） | [火山引擎控制台](https://console.volcengine.com/ark) |
| ☁️ **阿里云** | 视频生成（通义万相 Wan 系列） | [阿里云通义万相](https://wanx.aliyun.com) |
| 🤖 **DeepSeek** | 脚本优化、文案生成 | [DeepSeek 开放平台](https://platform.deepseek.com) |

#### 3. JWT Token（可选）
如果你已经有昆仑镜后端注册的账号，可以填入登录令牌。

### 第三步：开始创作

配置完成后，即可进入主界面：

1. **创建项目** → 输入剧本/广告文案
2. **脚本分析** → AI 自动分析并生成分镜
3. **角色/场景设计** → 设定角色和场景视觉风格
4. **故事板编排** → 调整分镜顺序和时长
5. **视频生成** → 选择模型，一键生成视频

---

## 🏗 自行打包

如果你有打包需求，可以拉取本仓库在本地构建：

### 前置条件

- **Node.js 18+**
- **npm 9+**
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools

### 克隆与构建

```bash
# 1. 克隆仓库
git clone https://github.com/caiwansan/kunjing-desktop.git
cd kunjing-desktop

# 2. 替换 API 服务器地址
# 编辑 electron/backend-proxy.ts，将 __API_HOST__ 替换为实际服务器地址
# 编辑 frontend-src/nuxt.config.ts，将 __API_HOST__ 替换为实际服务器地址

# 3. 安装依赖
npm install

# 4. 构建前端
cd frontend-src
npm install
npx nuxi generate
cd ..

# 5. 编译 Electron
npx tsc --project tsconfig.electron.json

# 6. 打包桌面应用
npx electron-builder --mac     # macOS DMG
npx electron-builder --win     # Windows NSIS
npx electron-builder --linux   # Linux AppImage
```

### 一键构建脚本

```bash
# 设置 API 地址后一键构建
API_HOST=https://aigc.fushtn.com ./build.sh
```

### 打包产物

构建完成后，安装包在 `release/` 目录中。

---

## 🔒 安全架构

```
┌─────────────────────────────────────────────────┐
│  Electron 主进程（electron/）                     │
│  ┌─────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ store.ts│  │ preload.ts │  │backend-proxy │ │
│  │ 加密存储 │◄─┤ 安全桥接   │──┤ .ts          │ │
│  │ (Keychain)│ │            │  │ API 请求代理  │ │
│  └─────────┘  └─────┬──────┘  └──────┬───────┘ │
│                      │ IPC            │ fetch   │
└──────────────────────┼───────────────┼─────────┘
                       │               │
                 ┌─────▼────┐   ┌──────▼────────┐
                 │渲染进程    │   │ 外部 API 服务   │
                 │前端 UI    │   │ 昆仑镜后端      │
                 │零密钥接触  │   │ 火山/阿里云/... │
                 └──────────┘   └───────────────┘
```

- API Key 使用 `Electron safeStorage` 加密后存入磁盘
- 渲染进程通过 `preload.ts` 暴露的 IPC 通道发送请求
- 所有外部请求由 `BackendProxy` 统一转发，密钥不离开主进程

---

## 📦 项目结构

```
kunjing-desktop/
├── frontend-src/          # 前端代码（Vue 3 + Nuxt 3）
│   ├── studio-v2/         # 创作工作台（10个面板）
│   ├── core/              # 核心运行时
│   ├── kernel/            # 引擎内核
│   ├── pages/             # 路由页面
│   └── nuxt.config.ts     # 构建配置（__API_HOST__占位）
├── electron/              # Electron 桌面封装
│   ├── main.ts            # 主进程（窗口管理 + IPC）
│   ├── preload.ts         # 安全桥接
│   ├── store.ts           # 加密密钥存储
│   └── backend-proxy.ts   # API 请求代理（__API_HOST__占位）
├── config/                # 配置模板
├── build.sh               # 一键构建脚本
└── package.json           # 依赖管理
```

---

## 🔗 相关链接

- **后端 API 服务**：`https://aigc.fushtn.com`（需要自行部署后端）
- **火山引擎控制台**：https://console.volcengine.com/ark
- **阿里云通义万相**：https://wanx.aliyun.com
- **DeepSeek 开放平台**：https://platform.deepseek.com

---

## 开源许可

前端代码和 Electron 壳程序采用 MIT 协议开源。后端服务器代码不在此仓库中。

昆仑镜 — 让 AI 成为你的影视创作伙伴 🎬
