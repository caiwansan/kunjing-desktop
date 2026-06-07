/**
 * 昆仑镜桌面版 - 安全桥接（preload）
 * 闭源：不推送至 GitHub
 * 仅暴露受限制的 IPC 通道，不暴露 node 能力
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('kunjing', {
  // 配置
  isConfigured: () => ipcRenderer.invoke('app:is-configured'),
  getConfigStatus: () => ipcRenderer.invoke('app:get-config-status'),
  saveConfig: (config: Record<string, string>) => ipcRenderer.invoke('app:save-config', config),
  testConnection: (config: Record<string, string>) => ipcRenderer.invoke('app:test-connection', config),
  finishSetup: () => ipcRenderer.invoke('app:finish-setup'),

  // API 代理
  api: {
    request: (method: string, path: string, body?: any, params?: Record<string, string>) =>
      ipcRenderer.invoke('api:request', { method, path, body, params }),
    getVideoModels: () => ipcRenderer.invoke('api:get-video-models'),
  },
})
