# 昆仑镜桌面版 (KunJing Desktop)

> AIGC 影视创作桌面工具，基于 Electron + Nuxt 3。

## 架构

```
kunjing-desktop/
├── frontend-src/      ← 开源前端代码（Vue 3 + Nuxt 3）
├── electron/          ← 闭源（Electron 主进程 + 密钥管理 + API 代理）
├── config/            ← 配置文件模板
├── package.json
└── README.md
```

## 工作原理

所有 AI 模型调用通过 Electron 主进程代理转发，用户的 API Key 使用操作系统原生加密存储（macOS Keychain / Windows Credential Manager），**前端渲染进程不接触任何密钥**。

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包为桌面应用
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

## 配置

首次启动会弹出配置向导，需要填入：
- **API 服务器地址**：部署昆仑镜后端 API 的服务器地址
- **API Key**：火山引擎/阿里云/DeepSeek 等 AI 服务的密钥
- **JWT Token**：账户认证令牌（可选）

所有密钥使用操作系统原生加密存储，仅 Electron 主进程可读取。

## 开源许可

前端代码采用 MIT 协议开源。Electron 壳程序（electron/ 目录）和服务器端代码不在此仓库中。
