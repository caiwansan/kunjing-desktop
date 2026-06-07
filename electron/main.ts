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
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  // 检查是否已配置，未配置则加载配置页
  if (keyStore.hasApiKeys()) {
    loadMainApp()
  } else {
    loadSetupWizard()
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function loadMainApp() {
  if (!mainWindow) return
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend-src/.output/public/index.html'))
  }
}

function loadSetupWizard() {
  if (!mainWindow) return
  mainWindow.loadFile(path.join(__dirname, '../frontend-src/setup/index.html'))
}

// ─── IPC 通道（安全桥接） ───

ipcMain.handle('app:is-configured', async () => {
  return keyStore.hasApiKeys()
})

ipcMain.handle('app:get-config-status', async () => {
  return keyStore.getStatus()
})

// 保存配置（加密存储）
ipcMain.handle('app:save-config', async (_event, config: Record<string, string>) => {
  keyStore.save(config)
  return { success: true }
})

// 测试 API 连通性
ipcMain.handle('app:test-connection', async (_event, config: Record<string, string>) => {
  try {
    const testProxy = new BackendProxy(new KeyStore())
    // 临时注入配置
    const result = await testProxy.testConnection(config.apiHost || '', config.volcengineApiKey || '')
    return result
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// 配置完成后重载主应用
ipcMain.handle('app:finish-setup', async () => {
  loadMainApp()
  return { success: true }
})

// 代理 API 请求
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
