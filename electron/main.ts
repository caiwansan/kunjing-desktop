/**
 * 昆仑镜桌面版 - Electron 主进程
 * 闭源：不推送至 GitHub
 */
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import path from 'path'
import { KeyStore } from './store'
import { BackendProxy } from './backend-proxy'

let mainWindow: BrowserWindow | null = null
const keyStore = new KeyStore()
const backendProxy = new BackendProxy(keyStore)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset', // macOS 融合标题栏
    show: false,
  })

  // 开发模式加载 Nuxt dev server，生产加载打包文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend-src/.output/public/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── IPC 通道（安全桥接） ───

// 初始化：检查是否已配置密钥
ipcMain.handle('app:is-configured', async () => {
  return keyStore.hasApiKeys()
})

// 获取当前配置状态
ipcMain.handle('app:get-config-status', async () => {
  return keyStore.getStatus()
})

// 保存配置（加密存储）
ipcMain.handle('app:save-config', async (_event, config: Record<string, string>) => {
  keyStore.save(config)
  return { success: true }
})

// 代理 API 请求（前端通过此通道转发，避免跨域和密钥泄露）
ipcMain.handle('api:request', async (_event, { method, path: apiPath, body, params }: {
  method: string
  path: string
  body?: any
  params?: Record<string, string>
}) => {
  try {
    const result = await backendProxy.request(method, apiPath, body, params)
    return { success: true, data: result }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// 获取可用视频模型列表
ipcMain.handle('api:get-video-models', async () => {
  return backendProxy.getAvailableVideoModels()
})

// ─── 应用生命周期 ───

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
