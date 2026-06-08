/**
 * 昆仑镜 - 本地模式主页
 * 在线版不可用时的本地工具台
 */

const api = window.electronAPI || {}

// ─── 导航 ───
function openEditor() {
  // 切换到独立视频编辑器
  window.location.href = 'index.html'
}

function tryOnline() {
  if (api.switchToOnline) {
    api.switchToOnline()
  } else {
    // fallback: 让 Electron 主进程处理
    window.location.href = '../web/index.html'
    // 短暂等待后重试
    setTimeout(() => {
      // 如果还没跳转，显示提示
    }, 2000)
  }
}

function openVideoInfo() {
  openModal('infoModal')
}

function openConverter() {
  openModal('convertModal')
}

function openThumbnail() {
  if (api.openVideoFiles) {
    api.openVideoFiles().then(async (files) => {
      if (!files || files.length === 0) return
      const inputPath = files[0]
      const outputPath = await api.saveVideoExport('thumbnail.jpg')
      if (!outputPath) return
      const result = await api.extractThumbnail(inputPath, outputPath, 1)
      if (result?.success) {
        alert(`✅ 缩略图已保存: ${outputPath}`)
      } else {
        alert(`❌ 提取失败: ${result?.error || '未知错误'}`)
      }
    })
  } else {
    alert('此功能需要 Electron 桌面环境')
  }
}

// ─── 模态框 ───
function openModal(id) {
  document.getElementById(id).style.display = 'flex'
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none'
}

// ─── 视频信息 ───
async function selectAndShowInfo() {
  if (!api.openVideoFiles || !api.getVideoInfo) {
    document.getElementById('videoInfoResult').innerHTML = '此功能需要 Electron 桌面环境'
    return
  }
  const files = await api.openVideoFiles()
  if (!files || files.length === 0) return

  const filePath = files[0]
  const result = document.getElementById('videoInfoResult')
  result.innerHTML = '正在分析...'

  const info = await api.getVideoInfo(filePath)
  if (!info || !info.success) {
    result.innerHTML = `❌ 无法分析文件: ${info?.error || '未知错误'}`
    return
  }

  const name = filePath.split('\\').pop().split('/').pop()
  result.innerHTML = `
    <div><span class="key">文件名</span> <span class="val">${escapeHtml(name)}</span></div>
    <div><span class="key">格式</span> <span class="val">${info.format || '-'}</span></div>
    <div><span class="key">时长</span> <span class="val">${formatDuration(info.duration)}</span></div>
    <div><span class="key">文件大小</span> <span class="val">${formatBytes(info.fileSize)}</span></div>
    ${info.video ? `
    <hr style="border-color:var(--border);margin:6px 0">
    <div><span class="key">视频编码</span> <span class="val">${info.video.codec || '-'}</span></div>
    <div><span class="key">分辨率</span> <span class="val">${info.video.width}×${info.video.height}</span></div>
    <div><span class="key">帧率</span> <span class="val">${info.video.fps} FPS</span></div>
    <div><span class="key">视频码率</span> <span class="val">${formatBits(info.video.bitrate)}</span></div>
    ` : ''}
    ${info.audio ? `
    <hr style="border-color:var(--border);margin:6px 0">
    <div><span class="key">音频编码</span> <span class="val">${info.audio.codec || '-'}</span></div>
    <div><span class="key">采样率</span> <span class="val">${info.audio.sampleRate || '-'} Hz</span></div>
    <div><span class="key">声道</span> <span class="val">${info.audio.channels || '-'}</span></div>
    ` : ''}
  `
}

// ─── 格式转换 ───
let convertSourcePath = null

async function selectConvertSource() {
  if (!api.openVideoFiles) { alert('需要 Electron 桌面环境'); return }
  const files = await api.openVideoFiles()
  if (!files || files.length === 0) return
  convertSourcePath = files[0]
  document.getElementById('convertSource').textContent = files[0].split('\\').pop().split('/').pop()
  document.getElementById('convertBtn').disabled = false
}

async function startConvert() {
  if (!convertSourcePath || !api.saveVideoExport || !api.exportVideo) {
    alert('需要 Electron 桌面环境'); return
  }

  const format = document.getElementById('convertFormat').value
  const quality = document.getElementById('convertQuality').value
  const scale = document.getElementById('convertScale').value

  const defaultName = `output.${format}`
  const outputPath = await api.saveVideoExport(defaultName)
  if (!outputPath) return

  const progressEl = document.getElementById('convertProgress')
  const fillEl = document.getElementById('convertProgressFill')
  const textEl = document.getElementById('convertProgressText')
  const resultEl = document.getElementById('convertResult')
  const btn = document.getElementById('convertBtn')

  progressEl.style.display = 'flex'
  btn.disabled = true
  btn.textContent = '转换中...'
  resultEl.textContent = ''

  api.onExportProgress && api.onExportProgress((p) => {
    fillEl.style.width = (p.progress * 100) + '%'
    textEl.textContent = Math.round(p.progress * 100) + '%'
    if (p.done) {
      fillEl.style.width = '100%'
      textEl.textContent = '完成!'
      resultEl.innerHTML = `✅ 转换完成: ${p.outputPath}`
      btn.textContent = '完成'
    }
  })

  const result = await api.exportVideo({
    clips: [{ src: convertSourcePath, start: 0, duration: 9999, trimStart: 0, trimEnd: 9999, speed: 1, volume: 1, type: 'video' }],
    outputPath,
    totalDuration: 9999,
    resolution: scale === 'original' ? '720p' : scale,
    fps: 30,
    quality,
    format,
  })

  if (result?.error) {
    resultEl.innerHTML = `❌ 转换失败: ${result.error}`
    btn.textContent = '重试'
    btn.disabled = false
  }
}

// ─── 系统初始化 ───
async function init() {
  // 检测 FFmpeg
  const ffmpegEl = document.getElementById('ffmpegStatus')
  try {
    // 通过探测一个不存在的文件来检测 FFmpeg 是否可用
    const testResult = await api.getVideoInfo?.('')
    ffmpegEl.textContent = api.getVideoInfo ? '✅ 可用' : '⚠️ 不可用（可能损坏）'
  } catch {
    ffmpegEl.textContent = '⚠️ 不可用'
  }

  // 平台信息
  document.getElementById('platformInfo').textContent = api.platformName || (navigator.platform || '')

  // 最近文件（从 localStorage 读取）
  try {
    const recent = JSON.parse(localStorage.getItem('kunjingRecentFiles') || '[]')
    if (recent.length > 0) {
      document.getElementById('recentSection').style.display = 'block'
      const list = document.getElementById('recentList')
      list.innerHTML = recent.slice(0, 10).map(f => `
        <div class="recent-item" onclick="reopenFile('${escapeAttr(f.path)}')">
          <span>🎬</span>
          <span class="name">${escapeHtml(f.name)}</span>
          <span class="time">${f.time || ''}</span>
        </div>
      `).join('')
    }
  } catch {}
}

function reopenFile(path) {
  // 记录到最近文件列表
  addRecentFile(path)
  // 打开编辑器并传入文件路径
  sessionStorage.setItem('kunjingOpenFile', path)
  openEditor()
}

function addRecentFile(path) {
  try {
    const name = path.split('\\').pop().split('/').pop()
    const recent = JSON.parse(localStorage.getItem('kunjingRecentFiles') || '[]')
    const filtered = recent.filter(f => f.path !== path)
    filtered.unshift({ path, name, time: new Date().toLocaleString() })
    localStorage.setItem('kunjingRecentFiles', JSON.stringify(filtered.slice(0, 20)))
  } catch {}
}

// ─── 工具函数 ───
function formatDuration(s) {
  if (!s) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
    : `${m}:${sec.toString().padStart(2,'0')}`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

function formatBits(bits) {
  if (!bits) return '-'
  return formatBytes(bits / 8) + '/s'
}

function escapeHtml(str) {
  if (!str) return ''
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML
}

function escapeAttr(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\\/g, '\\\\')
}

init()
