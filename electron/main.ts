/**
 * 昆仑镜桌面版 - Electron 主进程（最终版）
 * 闭源
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { KeyStore } from './store'

let mainWindow: BrowserWindow | null = null
const keyStore = new KeyStore()

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

  if (keyStore.hasApiKeys()) {
    loadMainApp()
  } else {
    loadSetupWizard()
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

function loadMainApp() {
  if (!mainWindow) return
  const apiHost = keyStore.get('apiHost') || 'https://aigc.fushtn.com'
  mainWindow.loadURL(apiHost)
}

function loadSetupWizard() {
  if (!mainWindow) return
  mainWindow.loadFile(path.join(__dirname, '../frontend-src/setup/index.html'))
}

// IPC
ipcMain.handle('app:is-configured', async () => keyStore.hasApiKeys())
ipcMain.handle('app:get-config-status', async () => keyStore.getStatus())
ipcMain.handle('app:save-config', async (_e, config: Record<string, string>) => {
  keyStore.save(config)
  return { success: true }
})
ipcMain.handle('app:finish-setup', async () => {
  loadMainApp()
  return { success: true }
})

// 应用生命周期
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
