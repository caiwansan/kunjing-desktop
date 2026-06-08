/**
 * 昆仑镜桌面版 - 主进程 v3
 *
 * Phase 2：本地引擎检测 + Ollama/ComfyUI
 * Phase 3：本地视频剪辑（FFmpeg 导出）
 *   - FFmpeg 路径：extraResources/bin/ffmpeg.exe
 *   - 视频裁剪/拼接/变速/导出
 *   - 实时进度推送
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const { autoUpdater } = require('electron-updater')

// ─── 全局状态 ───
let mainWindow = null
let backendProcess = null
let exportProcess = null // 当前导出进程，用于取消
const isDev = process.argv.includes('--dev')
const isPackaged = app.isPackaged
const APP_NAME = '昆仑镜'

// ─── 用户数据目录（用于本地存储） ───
const userDataPath = app.getPath('userData')
const localDbPath = path.join(userDataPath, 'local.db')
const localConfigPath = path.join(userDataPath, 'config.json')

// ─── FFmpeg 路径 ───
function getFfmpegPath() {
  if (isDev) {
    return path.join(__dirname, 'bin', 'ffmpeg.exe')
  }
  // 生产环境：extraResources 目录
  return path.join(process.resourcesPath, 'bin', 'ffmpeg.exe')
}

function getFfprobePath() {
  if (isDev) {
    return path.join(__dirname, 'bin', 'ffprobe.exe')
  }
  return path.join(process.resourcesPath, 'bin', 'ffprobe.exe')
}

// ─── 窗口配置 ───
const WINDOW_CONFIG = {
  width: 1400,
  height: 900,
  minWidth: 1024,
  minHeight: 700,
  title: `${APP_NAME} - AI 短剧制作平台`,
  icon: path.join(__dirname, 'web', 'logo.png'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: false,
  },
}

// ─── 创建主窗口 ───
async function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG)

  // 加载页面
  if (isDev) {
    await mainWindow.loadURL('http://localhost:3333')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, 'web', 'index.html')
    await mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => { mainWindow = null })
  setupMenu()
  setupIpcHandlers()
}

// ─── 应用菜单 ───
function setupMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: `关于${APP_NAME}`, role: 'about' },
        { type: 'separator' },
        { label: '检查更新', click: () => checkForUpdates() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: '工具',
      submenu: [
        {
          label: '视频剪辑',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('navigate', '/workspace/video-editor'),
        },
        {
          label: '本地视频剪辑（独立版）',
          click: () => openVideoEditor(),
        },
        { type: 'separator' },
        {
          label: '大模型设置',
          click: () => mainWindow?.webContents.send('navigate', '/user/center'),
        },
        { label: '客服支持', click: () => mainWindow?.webContents.send('navigate', '/customer-service') },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: 'Ollama 官网', click: () => shell.openExternal('https://ollama.ai') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── 打开独立视频编辑器页面 ───
function openVideoEditor() {
  if (!mainWindow) return
  const editorPath = path.join(__dirname, 'video-editor', 'index.html')
  if (fs.existsSync(editorPath)) {
    mainWindow.loadFile(editorPath)
  } else {
    dialog.showErrorBox('错误', '视频编辑器页面不存在')
  }
}

// ─── IPC 处理器 ───
function setupIpcHandlers() {
  // ── 基础信息 ──
  ipcMain.handle('get-app-info', () => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    isDev,
    isDesktop: true,
    userDataPath,
  }))

  ipcMain.handle('check-for-updates', () => checkForUpdates())

  // ── 导航 ──
  ipcMain.handle('navigate-home', () => {
    if (!mainWindow) return
    if (isDev) {
      mainWindow.loadURL('http://localhost:3333')
    } else {
      mainWindow.loadFile(path.join(__dirname, 'web', 'index.html'))
    }
  })

  // ── 文件对话框 ──
  ipcMain.handle('dialog:open-video', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择视频/音频/图片文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'] },
        { name: '音频文件', extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'] },
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] },
        { name: '所有支持的文件', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'aac', 'ogg', 'jpg', 'jpeg', 'png', 'webp'] },
      ],
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:save-video', async (_event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出视频',
      defaultPath: defaultName || 'output.mp4',
      filters: [
        { name: 'MP4 视频', extensions: ['mp4'] },
        { name: 'WebM 视频', extensions: ['webm'] },
        { name: 'AVI 视频', extensions: ['avi'] },
      ],
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择输出目录',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── FFprobe：获取视频信息 ──
  ipcMain.handle('ffmpeg:probe', async (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }
      const ffprobe = getFfprobePath()
      const output = execSync(
        `"${ffprobe}" -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        { encoding: 'utf-8', timeout: 15000 }
      )
      const info = JSON.parse(output)
      const videoStream = (info.streams || []).find(s => s.codec_type === 'video')
      const audioStream = (info.streams || []).find(s => s.codec_type === 'audio')
      return {
        success: true,
        fileSize: info.format?.size ? parseInt(info.format.size) : 0,
        duration: info.format?.duration ? parseFloat(info.format.duration) : 0,
        bitrate: info.format?.bit_rate ? parseInt(info.format.bit_rate) : 0,
        format: info.format?.format_name || '',
        video: videoStream ? {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: evalFps(videoStream.r_frame_rate),
          bitrate: videoStream.bit_rate ? parseInt(videoStream.bit_rate) : 0,
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
        } : null,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── FFmpeg 导出 ──
  ipcMain.handle('ffmpeg:export', async (event, config) => {
    // config: { clips, outputPath, resolution, fps, quality, format }
    const ffmpeg = getFfmpegPath()
    if (!fs.existsSync(ffmpeg)) {
      return { success: false, error: 'FFmpeg 未找到' }
    }

    // 生成 FFmpeg 命令
    const cmd = buildExportCommand(ffmpeg, config)
    if (!cmd) {
      return { success: false, error: '无法生成导出命令' }
    }

    return new Promise((resolve) => {
      try {
        const outDir = path.dirname(config.outputPath)
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true })
        }

        exportProcess = spawn(cmd[0], cmd.slice(1), {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderr = ''
        let lastProgress = 0
        const totalDuration = config.totalDuration || 0

        exportProcess.stdout.on('data', (data) => {
          // FFmpeg 进度在 stderr 中
        })

        exportProcess.stderr.on('data', (data) => {
          const text = data.toString()
          stderr += text
          // 解析 FFmpeg 进度
          const timeMatch = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
          if (timeMatch && totalDuration > 0) {
            const hours = parseInt(timeMatch[1])
            const minutes = parseInt(timeMatch[2])
            const seconds = parseInt(timeMatch[3])
            const currentTime = hours * 3600 + minutes * 60 + seconds
            const progress = Math.min(currentTime / totalDuration, 0.99)
            if (progress - lastProgress > 0.01) {
              lastProgress = progress
              mainWindow?.webContents.send('export-progress', {
                progress,
                currentTime,
                totalDuration,
                text: text.substring(0, 200),
              })
            }
          }
        })

        exportProcess.on('error', (err) => {
          exportProcess = null
          resolve({ success: false, error: err.message })
        })

        exportProcess.on('close', (code) => {
          exportProcess = null
          if (code === 0) {
            mainWindow?.webContents.send('export-progress', {
              progress: 1,
              done: true,
              outputPath: config.outputPath,
              fileSize: fs.existsSync(config.outputPath) ? fs.statSync(config.outputPath).size : 0,
            })
            resolve({ success: true, outputPath: config.outputPath })
          } else {
            resolve({ success: false, error: `FFmpeg 退出码 ${code}`, stderr })
          }
        })
      } catch (err) {
        resolve({ success: false, error: err.message })
      }
    })
  })

  // ── 取消导出 ──
  ipcMain.handle('ffmpeg:cancel-export', async () => {
    if (exportProcess) {
      exportProcess.kill('SIGTERM')
      exportProcess = null
      return { success: true }
    }
    return { success: false, error: '没有正在运行的导出任务' }
  })

  // ── 简单剪辑操作 ──
  ipcMain.handle('ffmpeg:trim', async (_event, { inputPath, outputPath, start, duration }) => {
    return runFfmpegSimple(getFfmpegPath(), [
      '-i', inputPath,
      '-ss', String(start),
      '-t', String(duration),
      '-c', 'copy',
      '-y', outputPath,
    ])
  })

  ipcMain.handle('ffmpeg:concat', async (_event, { fileListPath, outputPath }) => {
    // fileListPath: 包含要拼接的文件列表的文本文件路径
    return runFfmpegSimple(getFfmpegPath(), [
      '-f', 'concat',
      '-safe', '0',
      '-i', fileListPath,
      '-c', 'copy',
      '-y', outputPath,
    ])
  })

  ipcMain.handle('ffmpeg:extract-thumbnail', async (_event, { inputPath, outputPath, time }) => {
    return runFfmpegSimple(getFfmpegPath(), [
      '-i', inputPath,
      '-ss', String(time || 0),
      '-vframes', '1',
      '-q:v', '2',
      '-y', outputPath,
    ])
  })

  // ── Ollama 检测 ──
  ipcMain.handle('ollama-check', async () => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ running: true, models: (json.models || []).map((m) => m.name) })
          } catch {
            resolve({ running: false, models: [] })
          }
        })
      })
      req.on('error', () => resolve({ running: false, models: [] }))
      req.on('timeout', () => { req.destroy(); resolve({ running: false, models: [] }) })
    })
  })

  ipcMain.handle('ollama-install-check', async () => engineInstallCheck('ollama'))
  ipcMain.handle('engine-check', async (_event, engine) => engineCheck(engine))
  ipcMain.handle('engine-install', async (_event, engine) => engineInstall(engine))
  ipcMain.handle('engine-browse', async (_event, engine) => {
    const urls = {
      ollama: 'https://ollama.com/download',
      comfyui: 'https://github.com/comfyanonymous/ComfyUI/releases',
      'wan2.1': 'https://github.com/Wan-Video/Wan2.1',
    }
    shell.openExternal(urls[engine] || 'https://github.com')
  })
  ipcMain.handle('open-path', (_event, dirPath) => {
    if (fs.existsSync(dirPath)) shell.openPath(dirPath)
  })
  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url))
}

// ─── FFmpeg 命令构建 ───

/** 根据导出配置构建 FFmpeg 命令 */
function buildExportCommand(ffmpeg, config) {
  const { clips, outputPath, resolution, fps, quality, format } = config
  if (!clips || clips.length === 0) return null

  const outExt = format === 'webm' ? 'webm' : 'mp4'
  if (!outputPath.toLowerCase().endsWith(`.${outExt}`)) {
    config.outputPath = outputPath.replace(/\.[^/.]+$/, '') + '.' + outExt
  }

  // 质量映射
  const crfMap = { high: '18', medium: '23', low: '28' }
  const crf = crfMap[quality] || '23'

  // 分辨率映射
  const scaleMap = { '1080p': '1920:1080', '720p': '1280:720', '480p': '854:480' }
  const scale = scaleMap[resolution] || '1920:1080'

  // 构建滤镜链
  const filterParts = []
  let concatInputs = ''

  if (clips.length === 1) {
    // 单片段：trim + 滤镜
    const c = clips[0]
    const args = ['-i', c.src]
    if (c.trimStart > 0 || c.trimEnd < c.duration) {
      args.push('-ss', String(c.trimStart))
      args.push('-t', String(c.trimEnd - c.trimStart))
    }
    if (c.speed && c.speed !== 1) {
      filterParts.push(`setpts=${1 / c.speed}*PTS`)
    }
    filterParts.push(`scale=${scale},setsar=1:1`)
    args.push('-vf', filterParts.join(','))
    args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'medium')
    if (c.volume !== undefined && c.volume !== 1) {
      args.push('-af', `volume=${c.volume}`)
    }
    args.push('-r', String(fps || 30), '-pix_fmt', 'yuv420p', '-y', outputPath)
    return args
  }

  // 多片段：先各自预处理，再用 concat 拼接
  // 使用 concat demuxer 协议
  const concatFile = path.join(os.tmpdir(), `kunjing-concat-${Date.now()}.txt`)
  const fileLines = clips.map((c, i) => {
    const clipOut = path.join(os.tmpdir(), `kunjing-clip-${Date.now()}-${i}.mp4`)
    // 对每个片段独立处理
    return { input: c.src, tempOutput: clipOut, ...c }
  })

  // 为每个片段生成独立预处理命令（在导出时动态生成）
  // 这里返回主 concat 命令
  const concatLines = fileLines.map(f => `file '${f.tempOutput.replace(/'/g, "'\\''")}'`)
  fs.writeFileSync(concatFile, concatLines.join('\n'), 'utf-8')

  return [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    '-y', outputPath,
  ]
}

// ─── 简单 FFmpeg 执行器 ───
function runFfmpegSimple(ffmpeg, args) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('error', (err) => resolve({ success: false, error: err.message }))
      proc.on('close', (code) => {
        resolve(code === 0 ? { success: true } : { success: false, error: `退出码 ${code}`, stderr })
      })
    } catch (err) {
      resolve({ success: false, error: err.message })
    }
  })
}

// ─── FPS 解析 ───
function evalFps(rFrameRate) {
  if (!rFrameRate) return 0
  const parts = rFrameRate.split('/')
  if (parts.length === 2) {
    const num = parseInt(parts[0])
    const den = parseInt(parts[1])
    return den > 0 ? Math.round(num / den * 100) / 100 : 0
  }
  return parseInt(rFrameRate) || 0
}

// ─── 三引擎检测 & 安装工具 ───

function binaryExists(name) {
  try {
    if (process.platform === 'win32') {
      return !!execSync(`where ${name} 2>nul`, { encoding: 'utf-8', timeout: 3000 }).trim()
    } else {
      return !!execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim()
    }
  } catch { return false }
}

function isComfyRunning() {
  try {
    const result = execSync(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 http://127.0.0.1:8188/queue`, { timeout: 5000, encoding: 'utf-8', stdio: 'pipe' })
    return result.trim() === '200'
  } catch { return false }
}

function comfyuiInstallCheck() {
  const home = require('os').homedir()
  const commonPaths = process.platform === 'win32'
    ? ['C:\\ComfyUI', 'C:\\Users\\' + require('os').userInfo().username + '\\ComfyUI']
    : [require('path').join(home, 'ComfyUI'), '/opt/ComfyUI']
  for (const p of commonPaths) {
    if (fs.existsSync(require('path').join(p, 'main.py'))) return { installed: true, path: p }
    if (fs.existsSync(require('path').join(p, 'comfyui.py'))) return { installed: true, path: p }
  }
  return { installed: false }
}

function wanInstallCheck() {
  const home = require('os').homedir()
  const commonPaths = [
    require('path').join(home, 'Wan2.1'),
    '/opt/Wan2.1',
    require('path').join(home, 'Wan-Video', 'Wan2.1'),
  ]
  for (const p of commonPaths) {
    if (fs.existsSync(require('path').join(p, 'infer.py')) || fs.existsSync(require('path').join(p, 'inference.py'))) {
      return { installed: true, path: p }
    }
  }
  return { installed: false }
}

function engineInstallCheck(engine) {
  switch (engine) {
    case 'ollama': return { installed: binaryExists('ollama') }
    case 'comfyui': return comfyuiInstallCheck()
    case 'wan2.1': return wanInstallCheck()
    default: return { installed: false }
  }
}

function engineCheck(engine) {
  const install = engineInstallCheck(engine)
  let running = false
  let info = {}
  switch (engine) {
    case 'ollama':
      running = false
      try {
        const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, () => {})
        req.on('response', (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try { info.models = (JSON.parse(data).models || []).map(m => m.name) } catch {}
          })
        })
        req.on('error', () => {})
        req.end()
        running = true
      } catch {}
      break
    case 'comfyui':
      running = isComfyRunning()
      if (install.installed) {
        const modelDir = require('path').join(install.path, 'models', 'checkpoints')
        if (fs.existsSync(modelDir)) {
          try { info.models = fs.readdirSync(modelDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt')) } catch {}
        }
      }
      break
    case 'wan2.1':
      if (install.installed) info.scriptExists = true
      break
  }
  return { ...install, running, info }
}

function engineInstall(engine) {
  const platform = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux'
  const installInfo = {
    ollama: {
      name: 'Ollama',
      url: platform === 'macOS' ? 'https://ollama.com/download/Ollama-darwin.zip'
        : platform === 'Windows' ? 'https://ollama.com/download/OllamaSetup.exe'
        : 'https://ollama.com/download/ollama-linux-amd64.tgz',
      instructions: platform === 'Windows' ? '下载 OllamaSetup.exe 后双击运行安装' : '',
    },
    comfyui: { name: 'ComfyUI', url: 'https://github.com/comfyanonymous/ComfyUI/releases', instructions: '' },
    'wan2.1': { name: 'Wan2.1', url: 'https://github.com/Wan-Video/Wan2.1', instructions: '' },
  }
  const info = installInfo[engine] || { name: engine, url: '', instructions: '' }
  if (info.url) shell.openExternal(info.url)
  return info
}

// ─── 自动更新 ───
function checkForUpdates() {
  if (isDev) {
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: '检查更新',
      message: '开发模式不检查更新',
    })
    return
  }
  autoUpdater.checkForUpdatesAndNotify()
}

autoUpdater.on('update-available', ({ version }) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: '发现新版本',
    message: `${APP_NAME} ${version} 正在下载中…`,
  })
})

autoUpdater.on('update-downloaded', ({ version }) => {
  dialog.showMessageBox(mainWindow, {
    type: 'question', title: '更新就绪',
    message: `${APP_NAME} ${version} 已下载完成，是否现在安装？`,
    buttons: ['立即重启安装', '稍后'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

// ─── 应用生命周期 ───
app.whenReady().then(async () => {
  console.log(`[desktop] ${APP_NAME} v${app.getVersion()} 启动`)
  console.log(`[desktop] 用户数据目录: ${userDataPath}`)
  console.log(`[desktop] 平台: ${process.platform}`)
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
