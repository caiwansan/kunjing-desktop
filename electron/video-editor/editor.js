/**
 * 昆仑镜 - 本地视频剪辑引擎
 *
 * 核心功能：
 * - 文件打开/拖拽
 * - 时间轴轨道管理
 * - 片段裁剪/分割/移动
 * - FFmpeg 导出
 * - 预览播放
 */

// ─── 全局状态 ───
const state = {
  assets: [],          // 本地文件素材
  tracks: [],          // 时间轴轨道
  selectedClipId: null,
  currentTime: 0,
  isPlaying: false,
  duration: 10,
  zoom: 50,            // px/s
  scrollX: 0,
  scrollY: 0,
  isExporting: false,
  exportConfig: {
    resolution: '720p',
    fps: 30,
    quality: 'medium',
    format: 'mp4',
  },
}

let clipIdCounter = 0
function genId() { return `clip-${++clipIdCounter}-${Date.now().toString(36)}` }

// ─── DOM 引用 ───
const $ = id => document.getElementById(id)
const assetList = $('assetList')
const timelineTracks = $('timelineTracks')
const previewCanvas = $('previewCanvas')
const previewVideo = $('previewVideo')
const seekBar = $('seekBar')
const timeDisplay = $('timeDisplay')
const resolutionBadge = $('resolutionBadge')
const propsContent = $('propsContent')
const totalAssets = $('totalAssets')
const rulerCanvas = $('rulerCanvas')
const playBtn = $('playBtn')

// ─── Electron API 检查 ───
const api = window.electronAPI || {}

// ─── 导航 ───
function navigateHome() {
  if (api.navigateHome) api.navigateHome()
  else history.back()
}

// ─── 打开文件 ───
async function openFiles() {
  if (!api.openVideoFiles) {
    // 回退到原生文件输入
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*,audio/*,image/*'
    input.multiple = true
    input.onchange = () => {
      if (input.files) handleFiles(input.files)
    }
    input.click()
    return
  }
  const files = await api.openVideoFiles()
  if (files && files.length > 0) {
    for (const filePath of files) {
      await addAsset(filePath)
    }
  }
}

// ─── 拖拽文件 ───
document.addEventListener('dragover', (e) => { e.preventDefault() })
document.addEventListener('drop', async (e) => {
  e.preventDefault()
  if (e.dataTransfer.files && api.isDesktop) {
    // 桌面环境：从文件路径获取
    for (const file of e.dataTransfer.files) {
      await addAsset(file.path || file.name)
    }
  } else if (e.dataTransfer.files) {
    // 浏览器回退
    handleFiles(e.dataTransfer.files)
  }
})

async function handleFiles(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const info = await probeMedia(url)
    const type = file.type.startsWith('video') ? 'video'
      : file.type.startsWith('audio') ? 'audio'
      : 'image'
    state.assets.push({
      id: genId(),
      name: file.name,
      path: file.path || url,
      url,
      type,
      duration: info.duration || 5,
      width: info.width || 0,
      height: info.height || 0,
    })
    renderAssets()
  }
}

// ─── 添加本地文件素材 ───
async function addAsset(filePath) {
  const info = await api.getVideoInfo(filePath)
  if (!info || !info.success) {
    // fallback: 尝试作为图片或音频
    const ext = filePath.split('.').pop().toLowerCase()
    const type = ['mp3','wav','aac','ogg','flac'].includes(ext) ? 'audio'
      : ['jpg','jpeg','png','webp','bmp','gif'].includes(ext) ? 'image'
      : 'video'
    state.assets.push({
      id: genId(), name: filePath.split('\\').pop().split('/').pop(),
      path: filePath, url: `file://${filePath}`,
      type, duration: type === 'image' ? 5 : 10, width: 0, height: 0,
    })
  } else {
    const video = info.video
    state.assets.push({
      id: genId(), name: filePath.split('\\').pop().split('/').pop(),
      path: filePath, url: `file://${filePath}`,
      type: info.audio && !info.video ? 'audio' : 'video',
      duration: info.duration || 10,
      width: video?.width || 0,
      height: video?.height || 0,
      fps: video?.fps || 30,
      codec: video?.codec || '',
      format: info.format || '',
    })
  }
  renderAssets()
}

// ─── 探测媒体信息（浏览器回退） ───
function probeMedia(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    let done = false
    video.onloadedmetadata = () => {
      if (!done) { done = true
        resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight })
        video.remove()
      }
    }
    video.onerror = () => { if (!done) { done = true; resolve({}); video.remove() } }
    setTimeout(() => { if (!done) { done = true; resolve({}); video.remove() } }, 3000)
    video.src = url
    video.load()
  })
}

// ─── 渲染素材列表 ───
function renderAssets() {
  if (state.assets.length === 0) {
    assetList.innerHTML = '<div class="asset-empty">点击 📂 打开文件<br/>或拖拽文件到此</div>'
    totalAssets.textContent = '0'
    return
  }
  totalAssets.textContent = state.assets.length
  assetList.innerHTML = state.assets.map(a => `
    <div class="asset-item" draggable="true"
         ondragstart="onAssetDragStart(event, '${a.id}')"
         onclick="addAssetToTimeline('${a.id}')">
      <span class="asset-icon">${a.type === 'video' ? '🎬' : a.type === 'audio' ? '🎵' : '🖼'}</span>
      <span class="asset-label" title="${escapeHtml(a.name)}">${escapeHtml(truncate(a.name, 20))}</span>
      <span class="asset-dur">${formatTime(a.duration)}</span>
    </div>
  `).join('')
}

// ─── 素材拖拽 ───
function onAssetDragStart(e, assetId) {
  e.dataTransfer.setData('text/asset', assetId)
}

function onDragOver(e) { e.preventDefault() }

function onDrop(e) {
  e.preventDefault()
  const assetId = e.dataTransfer.getData('text/asset')
  if (assetId) addAssetToTimeline(assetId)
}

// ─── 添加素材到轨道 ───
function addAssetToTimeline(assetId) {
  const asset = state.assets.find(a => a.id === assetId)
  if (!asset) return

  // 查找或创建对应轨道
  let track = state.tracks.find(t => t.type === asset.type)
  if (!track) {
    track = {
      id: `track-${state.tracks.length}`,
      type: asset.type === 'audio' ? 'audio' : 'video',
      label: asset.type === 'audio' ? '音频' : '视频',
      clips: [],
    }
    state.tracks.push(track)
  }

  // 寻找空闲位置
  const start = track.clips.length === 0
    ? 0
    : Math.max(...track.clips.map(c => c.start + c.duration)) + 0.5

  const clip = {
    id: genId(),
    trackId: track.id,
    assetId: asset.id,
    label: asset.name,
    start,
    duration: Math.min(asset.duration, 30),
    sourceDuration: asset.duration,
    trimStart: 0,
    trimEnd: Math.min(asset.duration, 30),
    speed: 1,
    volume: 1,
    type: asset.type === 'image' ? 'image' : asset.type === 'audio' ? 'audio' : 'video',
    path: asset.path,
  }
  track.clips.push(clip)
  updateDuration()
  renderTimeline()
  renderProps()
  selectClip(clip.id)
}

// ─── 渲染时间轴 ───
function renderTimeline() {
  if (state.tracks.length === 0) {
    timelineTracks.innerHTML = '<div class="empty-timeline">🎬 添加素材到时间轴开始剪辑</div>'
    renderRuler()
    return
  }

  timelineTracks.innerHTML = state.tracks.map(track => {
    const clipsHtml = track.clips.map(clip => {
      const left = clip.start * state.zoom
      const width = clip.duration * state.zoom
      const isSelected = clip.id === state.selectedClipId
      const typeClass = clip.type === 'image' ? 'image' : clip.type === 'audio' ? 'audio' : 'video'
      return `<div class="clip ${typeClass}${isSelected ? ' selected' : ''}"
        style="left:${left}px;width:${Math.max(width, 10)}px"
        onclick="selectClip('${clip.id}')"
        ondblclick="splitClip('${clip.id}')"
        title="${escapeHtml(clip.label)} (${formatTime(clip.start)} - ${formatTime(clip.start + clip.duration)})">
        <span class="clip-label">${escapeHtml(truncate(clip.label, 15))}</span>
      </div>`
    }).join('')

    return `<div class="track ${track.type}">
      <div class="track-header">${track.label}</div>
      <div class="track-body">${clipsHtml}</div>
    </div>`
  }).join('')

  // 更新轨道宽度（支持滚动）
  const trackBodies = timelineTracks.querySelectorAll('.track-body')
  const totalWidth = Math.max(state.duration * state.zoom + 100, 600)
  trackBodies.forEach(el => { el.style.minWidth = totalWidth + 'px' })

  renderRuler()
}

// ─── 渲染标尺 ───
function renderRuler() {
  const canvas = rulerCanvas
  const ctx = canvas.getContext('2d')
  const w = Math.max(state.duration * state.zoom + 100, canvas.parentElement?.clientWidth || 800)
  canvas.width = w * devicePixelRatio
  canvas.height = 24 * devicePixelRatio
  canvas.style.width = w + 'px'
  canvas.style.height = '24px'
  ctx.scale(devicePixelRatio, devicePixelRatio)

  ctx.fillStyle = '#11151c'
  ctx.fillRect(0, 0, w, 24)

  // 刻度：每 1 秒一个小刻度，每 5 秒一个大刻度
  const step = Math.max(1, Math.floor(50 / state.zoom))
  for (let t = 0; t <= state.duration; t += step) {
    const x = t * state.zoom
    const isMajor = t % (step * 5) === 0 || t % 5 === 0
    ctx.strokeStyle = isMajor ? '#6b7280' : '#374151'
    ctx.lineWidth = isMajor ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(x, isMajor ? 14 : 18)
    ctx.lineTo(x, 24)
    ctx.stroke()

    if (isMajor) {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '9px monospace'
      ctx.fillText(formatTime(t), x + 3, 12)
    }
  }

  // 当前时间指针
  const cx = state.currentTime * state.zoom
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, 24)
  ctx.stroke()

  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(cx - 4, 0)
  ctx.lineTo(cx + 4, 0)
  ctx.lineTo(cx, 6)
  ctx.closePath()
  ctx.fill()
}

// ─── 片段选择 ───
function selectClip(clipId) {
  state.selectedClipId = clipId
  renderTimeline()
  renderProps()
}

function removeSelected() {
  if (!state.selectedClipId) return
  for (const track of state.tracks) {
    const idx = track.clips.findIndex(c => c.id === state.selectedClipId)
    if (idx >= 0) {
      track.clips.splice(idx, 1)
      break
    }
  }
  state.selectedClipId = null
  updateDuration()
  renderTimeline()
  renderProps()
}

function clearAll() {
  if (state.tracks.length === 0 && state.assets.length === 0) return
  if (!confirm('确定清空所有素材和轨道？')) return
  state.tracks = []
  state.assets = []
  state.selectedClipId = null
  state.currentTime = 0
  state.duration = 10
  renderAssets()
  renderTimeline()
  renderProps()
}

// ─── 分割片段 ───
function splitClip(clipId) {
  const info = findClip(clipId)
  if (!info) return
  const { track, clip } = info
  const splitTime = state.currentTime
  if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) return

  const splitOffset = splitTime - clip.start
  const newClip = {
    ...clip,
    id: genId(),
    start: splitTime,
    duration: clip.duration - splitOffset,
    trimStart: clip.trimStart + splitOffset,
  }
  clip.duration = splitOffset
  clip.trimEnd = clip.trimStart + splitOffset

  track.clips.push(newClip)
  track.clips.sort((a, b) => a.start - b.start)
  updateDuration()
  renderTimeline()
}

// ─── 查找片段 ───
function findClip(clipId) {
  for (const track of state.tracks) {
    const clip = track.clips.find(c => c.id === clipId)
    if (clip) return { track, clip }
  }
  return null
}

// ─── 更新总时长 ───
function updateDuration() {
  let maxEnd = 0
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      maxEnd = Math.max(maxEnd, clip.start + clip.duration)
    }
  }
  state.duration = Math.max(maxEnd, 10)
  seekBar.max = Math.ceil(state.duration)
}

// ─── 属性面板 ───
function renderProps() {
  if (!state.selectedClipId) {
    propsContent.innerHTML = '<div class="props-empty">选择片段<br/>查看/编辑属性</div>'
    return
  }
  const info = findClip(state.selectedClipId)
  if (!info) { propsContent.innerHTML = '<div class="props-empty">片段未找到</div>'; return }
  const clip = info.clip

  propsContent.innerHTML = `
    <div class="form-group">
      <label>名称</label>
      <input type="text" value="${escapeHtml(clip.label)}" onchange="updateClipProp('${clip.id}','label',this.value)">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>起始 (秒)</label>
        <input type="number" step="0.1" min="0" value="${clip.start.toFixed(1)}" onchange="updateClipProp('${clip.id}','start',parseFloat(this.value)||0)">
      </div>
      <div class="form-group">
        <label>时长 (秒)</label>
        <input type="number" step="0.1" min="0.1" value="${clip.duration.toFixed(1)}" onchange="updateClipProp('${clip.id}','duration',parseFloat(this.value)||0.1)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>裁剪起点</label>
        <input type="number" step="0.1" min="0" max="${clip.sourceDuration}" value="${clip.trimStart.toFixed(1)}" onchange="updateClipProp('${clip.id}','trimStart',parseFloat(this.value)||0)">
      </div>
      <div class="form-group">
        <label>裁剪终点</label>
        <input type="number" step="0.1" min="0" max="${clip.sourceDuration}" value="${clip.trimEnd.toFixed(1)}" onchange="updateClipProp('${clip.id}','trimEnd',parseFloat(this.value)||0)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>速度 (0.1-10x)</label>
        <input type="number" step="0.1" min="0.1" max="10" value="${clip.speed}" onchange="updateClipProp('${clip.id}','speed',parseFloat(this.value)||1)">
      </div>
      <div class="form-group">
        <label>音量 (0-2)</label>
        <input type="number" step="0.1" min="0" max="2" value="${clip.volume}" onchange="updateClipProp('${clip.id}','volume',parseFloat(this.value)||1)">
      </div>
    </div>
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
      <button class="btn btn-sm btn-danger" onclick="removeSelected()">🗑 删除片段</button>
    </div>
  `
}

function updateClipProp(clipId, key, value) {
  const info = findClip(clipId)
  if (!info) return
  info.clip[key] = value
  if (key === 'start' || key === 'duration' || key === 'speed') updateDuration()
  renderTimeline()
  if (key === 'label') renderProps()
}

// ─── 播放控制 ───
function togglePlay() {
  state.isPlaying = !state.isPlaying
  playBtn.textContent = state.isPlaying ? '⏸' : '▶'
  if (state.isPlaying) {
    startPlayLoop()
    // 同步视频播放
    const el = previewVideo
    if (el.src && el.paused) el.play().catch(() => {})
  } else {
    previewVideo.pause()
  }
}

function onSeek(value) {
  state.currentTime = parseFloat(value)
  state.isPlaying = false
  playBtn.textContent = '▶'
  previewVideo.pause()
  updatePreview()
}

function onZoomChange(value) {
  state.zoom = parseInt(value)
  $('zoomLabel').textContent = state.zoom
  renderTimeline()
  renderRuler()
}

function zoomIn() { state.zoom = Math.min(200, state.zoom * 1.3); $('zoomSlider').value = state.zoom; onZoomChange(state.zoom) }
function zoomOut() { state.zoom = Math.max(10, state.zoom / 1.3); $('zoomSlider').value = state.zoom; onZoomChange(state.zoom) }

// ─── 播放循环 ───
let playRAF = null
let lastFrameTime = 0

function startPlayLoop() {
  stopPlayLoop()
  lastFrameTime = performance.now()

  function tick(now) {
    if (!state.isPlaying) {
      playRAF = requestAnimationFrame(tick)
      return
    }
    const dt = (now - lastFrameTime) / 1000
    lastFrameTime = now
    state.currentTime += Math.min(dt, 0.1)

    if (state.currentTime >= state.duration) {
      state.currentTime = 0
      state.isPlaying = false
      playBtn.textContent = '▶'
      previewVideo.pause()
    }
    updatePreview()
    playRAF = requestAnimationFrame(tick)
  }
  playRAF = requestAnimationFrame(tick)
}

function stopPlayLoop() {
  if (playRAF !== null) { cancelAnimationFrame(playRAF); playRAF = null }
}

// ─── 更新预览 ───
let lastPreviewTime = -1

function updatePreview() {
  const t = state.currentTime
  seekBar.value = t
  timeDisplay.textContent = `${formatTime(t)} / ${formatTime(state.duration)}`

  // 找到当前时间的视频片段
  let activeClip = null
  for (const track of state.tracks) {
    if (track.type === 'audio') continue
    for (const clip of track.clips) {
      if (t >= clip.start && t < clip.start + clip.duration) {
        activeClip = clip
        break
      }
    }
    if (activeClip) break
  }

  const canvas = previewCanvas
  const ctx = canvas.getContext('2d')
  const el = previewVideo

  if (activeClip && activeClip.path) {
    const clipTime = (t - activeClip.start) * activeClip.speed + activeClip.trimStart

    if (el.src !== activeClip.path) {
      el.src = activeClip.path
      el.load()
      el.currentTime = clipTime
    } else if (state.isPlaying) {
      // 播放中，由 video 的 timeupdate 驱动
    } else if (Math.abs(el.currentTime - clipTime) > 0.3) {
      el.currentTime = clipTime
    }

    // 设置分辨率
    canvas.width = 320
    canvas.height = 180
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 320, 180)
    if (el.videoWidth > 0) {
      ctx.drawImage(el, 0, 0, 320, 180)
    }

    const asset = state.assets.find(a => a.path === activeClip.path)
    if (asset) {
      resolutionBadge.textContent = `${asset.width || '?'}×${asset.height || '?'}`
    }
  } else {
    canvas.width = 320
    canvas.height = 180
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 320, 180)

    ctx.fillStyle = '#4b5563'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('无视频片段', 160, 95)
    resolutionBadge.textContent = '—'
  }

  // 时间线指针更新
  renderRuler()
}

// ─── 视频时间更新事件 ───
previewVideo.addEventListener('timeupdate', () => {
  if (!state.isPlaying) return
  state.currentTime = previewVideo.currentTime - findActiveClipTimeOffset()
  updatePreview()
})

previewVideo.addEventListener('ended', () => {
  state.isPlaying = false
  playBtn.textContent = '▶'
})

function findActiveClipTimeOffset() {
  for (const track of state.tracks) {
    if (track.type === 'audio') continue
    for (const clip of track.clips) {
      const t = state.currentTime
      if (t >= clip.start && t < clip.start + clip.duration) {
        return clip.start
      }
    }
  }
  return 0
}

// 动画循环渲染
let renderRAF = null
function renderLoop() {
  if (!state.isPlaying) {
    renderRAF = requestAnimationFrame(renderLoop)
    return
  }
  updatePreview()
  renderRAF = requestAnimationFrame(renderLoop)
}

setInterval(() => {
  if (!state.isPlaying) {
    updatePreview()
  }
}, 250)

// ─── 导出 ───
async function exportVideo() {
  if (state.tracks.length === 0 || state.tracks.every(t => t.clips.length === 0)) {
    alert('时间轴为空，请先添加片段')
    return
  }

  if (!api.saveVideoExport) {
    alert('导出功能需要 Electron 桌面环境')
    return
  }

  // 收集导出配置
  state.exportConfig.format = $('exportFormat').value
  state.exportConfig.resolution = $('exportResolution').value
  state.exportConfig.fps = parseInt($('exportFps').value)
  state.exportConfig.quality = $('exportQuality').value

  const outputPath = await api.saveVideoExport('昆仑镜-剪辑输出.mp4')
  if (!outputPath) return

  showExportModal(outputPath)
}

function showExportModal(outputPath) {
  $('exportModal').style.display = 'flex'
  $('exportProgress').style.display = 'none'
  $('exportLog').textContent = ''
  $('exportBtn').disabled = false
  $('exportBtn').textContent = '开始导出'
  state.exportOutputPath = outputPath
}

function closeExportModal() {
  $('exportModal').style.display = 'none'
  if (state.isExporting) {
    api.cancelExport && api.cancelExport()
    state.isExporting = false
  }
  api.removeExportProgressListener && api.removeExportProgressListener()
}

async function startExport() {
  if (state.isExporting) return

  const outputPath = state.exportOutputPath
  if (!outputPath) return

  // 构建导出配置
  const clips = []
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      const asset = state.assets.find(a => a.path === clip.path)
      clips.push({
        src: clip.path,
        start: clip.start,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        speed: clip.speed,
        volume: clip.volume,
        type: clip.type,
      })
    }
  }

  state.isExporting = true
  $('exportBtn').disabled = true
  $('exportBtn').textContent = '导出中...'
  $('exportProgress').style.display = 'flex'
  $('exportLog').textContent = '准备导出...\n'

  // 监听进度
  api.onExportProgress && api.onExportProgress((progress) => {
    $('progressFill').style.width = (progress.progress * 100) + '%'
    $('progressText').textContent = Math.round(progress.progress * 100) + '%'
    if (progress.text) {
      $('exportLog').textContent += progress.text + '\n'
      $('exportLog').scrollTop = $('exportLog').scrollHeight
    }
    if (progress.done) {
      $('progressFill').style.width = '100%'
      $('progressText').textContent = '完成!'
      state.isExporting = false
      $('exportBtn').textContent = '导出完成 ✓'
      $('exportLog').textContent += `\n✅ 导出完成: ${progress.outputPath}\n文件大小: ${formatBytes(progress.fileSize)}`
    }
  })

  const result = await api.exportVideo({
    clips,
    outputPath,
    totalDuration: state.duration,
    resolution: state.exportConfig.resolution,
    fps: state.exportConfig.fps,
    quality: state.exportConfig.quality,
    format: state.exportConfig.format,
  })

  if (result.error) {
    $('exportLog').textContent += `\n❌ 导出失败: ${result.error}`
    $('exportBtn').textContent = '导出失败'
    $('exportBtn').disabled = false
    state.isExporting = false
  }
}

// ─── 工具函数 ───
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

function truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.substring(0, max) + '…' : str
}

function escapeHtml(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// ─── 初始化 ───
updatePreview()
renderAssets()
renderTimeline()
