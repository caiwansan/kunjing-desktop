/**
 * 昆仑镜桌面版 - 预加载脚本 v4
 *
 * Phase 2：Ollama/ComfyUI 引擎检测 API
 * Phase 3：本地视频剪辑 API
 *   - 文件对话框
 *   - FFprobe 探测
 *   - FFmpeg 导出 + 进度
 *   - 简单剪辑（trim/concat/缩略图）
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 平台信息 ──
  isDesktop: true,
  platform: process.platform,
  platformName: process.platform === 'darwin' ? 'macOS'
    : process.platform === 'win32' ? 'Windows'
    : 'Linux',

  // ── 基础 ──
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getVersion: () => ipcRenderer.invoke('get-app-info').then(info => info.version),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  navigateHome: () => ipcRenderer.invoke('navigate-home'),
  switchToOnline: () => ipcRenderer.invoke('switch-to-online'),
  switchToLocal: () => ipcRenderer.invoke('switch-to-local'),

  // ── 文件对话框 ──
  openVideoFiles: () => ipcRenderer.invoke('dialog:open-video'),
  saveVideoExport: (defaultName) => ipcRenderer.invoke('dialog:save-video', defaultName),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

  // ── FFprobe 探测 ──
  getVideoInfo: (filePath) => ipcRenderer.invoke('ffmpeg:probe', filePath),

  // ── FFmpeg 导出 ──
  exportVideo: (config) => ipcRenderer.invoke('ffmpeg:export', config),
  cancelExport: () => ipcRenderer.invoke('ffmpeg:cancel-export'),

  // ── 简单剪辑操作 ──
  trimVideo: (inputPath, outputPath, start, duration) =>
    ipcRenderer.invoke('ffmpeg:trim', { inputPath, outputPath, start, duration }),
  concatVideos: (fileListPath, outputPath) =>
    ipcRenderer.invoke('ffmpeg:concat', { fileListPath, outputPath }),
  extractThumbnail: (inputPath, outputPath, time) =>
    ipcRenderer.invoke('ffmpeg:extract-thumbnail', { inputPath, outputPath, time }),

  // ── 导出进度监听 ──
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (_event, progress) => callback(progress))
  },
  removeExportProgressListener: () => {
    ipcRenderer.removeAllListeners('export-progress')
  },

  // ── 引擎检测 ──
  checkEngine: (engine) => ipcRenderer.invoke('engine-check', engine),
  installEngine: (engine) => ipcRenderer.invoke('engine-install', engine),
  browseEngine: (engine) => ipcRenderer.invoke('engine-browse', engine),
  ollamaCheck: () => ipcRenderer.invoke('ollama-check'),
  ollamaInstallCheck: () => ipcRenderer.invoke('ollama-install-check'),

  // ── 路径工具 ──
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPath: (dirPath) => ipcRenderer.invoke('open-path', dirPath),

  // ── 导航 ──
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path))
  },
})
