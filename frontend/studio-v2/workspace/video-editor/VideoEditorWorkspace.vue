<template>
  <div class="video-editor">
    <!-- 顶栏 -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <button class="topbar-btn" @click="$emit('back')">← 返回</button>
        <span class="topbar-title">✂️ 视频剪辑</span>
      </div>
      <div class="topbar-center">
        <button class="topbar-btn" @click="onSaveSnapshot">💾 保存</button>
        <button class="topbar-btn" @click="undo" :disabled="undoLevel === 0">↩ 撤销</button>
        <button class="topbar-btn" @click="redo" :disabled="redoLevel === 0">↪ 重做</button>
        <span class="topbar-hint">双击片段分割</span>
        <button v-if="isDesktop" class="topbar-btn export-btn" @click="exportVideo">📀 导出</button>
      </div>
      <div class="topbar-right">
        <button class="topbar-btn" @click="addTrack('video')">+ 视频轨</button>
        <button class="topbar-btn" @click="addTrack('overlay')">+ 画中画</button>
        <button class="topbar-btn" @click="addTrack('audio')">+ 音频轨</button>
        <button class="topbar-btn" @click="addTrack('text')">+ 字幕轨</button>
      </div>
    </div>

    <!-- 主体 -->
    <div class="editor-body">
      <!-- 左栏：素材面板 -->
      <div class="panel-left">
        <div class="panel-header">
          <span>📦 素材</span>
          <button class="panel-btn" @click="triggerUpload">➕ 上传</button>
        </div>
        <div class="asset-grid">
          <div
            v-for="item in uploadedAssets"
            :key="item.id"
            class="asset-card"
            draggable="true"
            @dragstart="onDragAsset(item, $event)"
          >
            <div class="asset-preview">
              <img v-if="item.thumbnail" :src="item.thumbnail" class="asset-thumb" />
              <span v-else class="asset-icon">{{ item.icon }}</span>
            </div>
            <div class="asset-info">
              <span class="asset-name">{{ item.label }}</span>
              <span class="asset-duration">{{ item.duration.toFixed(1) }}s</span>
            </div>
            <button class="asset-add-btn" @click.stop="addAsset(item)">＋轨道</button>
          </div>
          <div v-if="uploadedAssets.length === 0" class="asset-empty">
            点击 ➕ 上传视频/音频/图片<br/>拖拽到时间轴
          </div>
        </div>
      </div>

      <!-- 中栏：预览 + 时间轴 -->
      <div class="panel-center">
        <!-- 预览区域 -->
        <div class="center-preview-area">
          <PreviewPanel
            :is-playing="state.timeline.isPlaying"
            :current-time="state.timeline.currentTime"
            :duration="state.timeline.duration"
            :main-clip="currentPreviewClip"
            @toggle-play="togglePlay"
            @seek="onSeek"
          />
        </div>

        <!-- 时间轴区域 -->
        <div class="center-timeline-area">
          <TimelineRuler
            :duration="state.timeline.duration"
            :zoom="state.timeline.zoom"
            :current-time="state.timeline.currentTime"
            @seek="onSeek"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @zoom-fit="zoomToFit"
          />

          <div class="timeline-tracks" ref="tracksScrollRef" @scroll="onScroll">
            <TrackRow
              v-for="track in sortedTracks"
              :key="track.id"
              :track="track"
              :zoom="state.timeline.zoom"
              :selected-clip-ids="state.selectedClipIds"
              :current-time="state.timeline.currentTime"
              @select-clip="onSelectClip"
              @move-clip="onMoveClip"
              @trim-clip="onTrimClip"
              @split-clip="onSplitClip"
              @add-clip="onAddClip"
              @remove-track="onRemoveTrack"
              @toggle-mute="onToggleMute"
              @toggle-lock="onToggleLock"
              @open-transition="onOpenTransition"
            />

            <div v-if="state.tracks.length === 0" class="empty-timeline">
              🎬 添加轨道或拖拽视频到时间轴开始剪辑
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useVideoEditor } from './useVideoEditor'
import type { Clip, Track, ClipType } from './video-editor-types'
import PreviewPanel from './PreviewPanel.vue'
import TimelineRuler from './TimelineRuler.vue'
import TrackRow from './TrackRow.vue'

const emit = defineEmits<{ back: [] }>()

// ─── Electron API ───
const electronAPI = (window as any).electronAPI
const isDesktop = !!(electronAPI && electronAPI.isDesktop)

// ─── 编辑器核心 ───

const {
  state, sortedTracks, currentPreviewClip, totalClips, totalWidth,
  addTrack, removeTrack, toggleTrackMute, toggleTrackLock,
  addClip, removeClip, updateClip, moveClip, trimClip, splitClip,
  selectClip, clearSelection,
  setCurrentTime, togglePlay, play, pause, zoomIn, zoomOut, zoomToFit,
  saveSnapshot, undo, redo, findNextSlot,
} = useVideoEditor()

// 撤销/重做层级（跟踪按钮 disabled）
const undoLevel = ref(0)
const redoLevel = ref(0)

function onSaveSnapshot() {
  saveSnapshot()
  undoLevel.value++
  redoLevel.value = 0
}

const tracksScrollRef = ref<HTMLElement | null>(null)

const isExporting = ref(false)
const exportProgress = ref(0)

// ─── 上传素材 ───

interface LocalAsset {
  id: string
  url: string           // blob URL
  label: string
  duration: number
  fileType: 'video' | 'audio' | 'image'
  thumbnail?: string
  icon: string
  size: number
}

const uploadedAssets = ref<LocalAsset[]>([])
const MAX_ASSETS = 50
const MAX_SIZE_MB = 500

async function triggerUpload() {
  if (isDesktop && electronAPI.openVideoFiles) {
    const files = await electronAPI.openVideoFiles()
    if (files && files.length > 0) {
      for (const filePath of files) {
        await addLocalFile(filePath)
      }
    }
  } else {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*,audio/*,image/*'
    input.multiple = true
    input.onchange = () => {
      if (input.files) handleFiles(input.files)
    }
    input.click()
  }
}

/** 从本地路径加载文件素材 */
async function addLocalFile(filePath: string) {
  if (!electronAPI || !electronAPI.getVideoInfo) {
    const name = filePath.split('\\').pop()?.split('/').pop() || filePath
    const id = `asset-${Math.random().toString(36).slice(2, 10)}`
    const url = `file://${filePath}`
    const ext = (filePath.split('.').pop() || '').toLowerCase()
    const fileType = ['mp3','wav','aac','ogg','flac'].includes(ext) ? 'audio'
      : ['jpg','jpeg','png','webp'].includes(ext) ? 'image' : 'video'
    uploadedAssets.value.push({ id, url, label: name, duration: 10,
      fileType: fileType as 'video' | 'audio' | 'image', icon: { video: '🎬', audio: '🎵', image: '🖼' }[fileType] || '📄', size: 0 })
    return
  }
  const info = await electronAPI.getVideoInfo(filePath)
  if (!info || !info.success) return
  const name = filePath.split('\\').pop()?.split('/').pop() || filePath
  const id = `asset-${Math.random().toString(36).slice(2, 10)}`
  const url = `file://${filePath}`
  const fileType = info.video ? 'video' : 'audio'
  uploadedAssets.value.push({ id, url, label: name, duration: info.duration || 10,
    fileType, icon: info.video ? '🎬' : '🎵', size: info.fileSize || 0 })
}

async function handleFiles(files: FileList) {
  const remaining = MAX_ASSETS - uploadedAssets.value.length
  if (remaining <= 0) { alert('素材已达上限'); return }

  for (let i = 0; i < files.length && i < remaining; i++) {
    const file = files[i]
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isAudio && !isImage) continue

    const id = `asset-${Math.random().toString(36).slice(2, 10)}`
    const url = URL.createObjectURL(file)
    let icon = '📄'
    let duration = 0
    let thumbnail: string | undefined

    if (isVideo) {
      icon = '🎬'
      duration = await getMediaDuration(url)
      thumbnail = await captureThumbnail(url)
    } else if (isAudio) {
      icon = '🎵'
      duration = await getMediaDuration(url)
    } else {
      icon = '🖼'
      thumbnail = url
    }

    if (!duration || duration <= 0) duration = 5

    uploadedAssets.value.push({
      id, url, label: file.name,
      duration, fileType: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      thumbnail, icon, size: file.size,
    })
  }
}

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.muted = true
    el.preload = 'metadata'
    let done = false
    el.onloadedmetadata = () => { if (!done) { done = true; resolve(el.duration || 0); el.remove() } }
    el.onerror = () => { if (!done) { done = true; resolve(0); el.remove() } }
    setTimeout(() => { if (!done) { done = true; resolve(el.duration || 0); el.remove() } }, 5000)
    el.src = url
    el.load()
  })
}

function captureThumbnail(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 90
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(video, 0, 0, 160, 90)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
      video.remove()
    }
    video.onerror = () => { resolve(undefined); video.remove() }
    setTimeout(() => { resolve(undefined); video.remove() }, 3000)
    video.src = url
    video.load()
  })
}

// ─── 素材拖拽 ───

function onDragAsset(item: LocalAsset, event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/asset', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copy'
  }
}

// ─── 按钮添加素材到轨道 ───

function addAsset(item: LocalAsset) {
  saveSnapshot()
  const type = item.fileType === 'audio' ? 'audio' : 'video'
  let track = state.tracks.find(t => t.type === type)
  if (!track) track = addTrack(type, type === 'audio' ? '音频' : '视频')
  const startTime = findNextSlot(track.id)
  addClip(track.id, {
    src: item.url,
    label: item.label || '素材',
    start: startTime,
    duration: item.duration,
    sourceDuration: item.duration,
    trimStart: 0,
    trimEnd: item.duration,
    type: item.fileType === 'image' ? 'image' : item.fileType === 'audio' ? 'audio' : 'video',
    thumbnail: item.thumbnail,
  })
}

// ─── 事件处理 ───

function onSeek(time: number) {
  setCurrentTime(time)
}

function onSelectClip(clipId: string, addToSelection: boolean) {
  selectClip(clipId, addToSelection)
}

function onMoveClip(clipId: string, newStart: number, destTrackId?: string) {
  saveSnapshot()
  moveClip(clipId, newStart, destTrackId)
}

function onTrimClip(clipId: string, newStart: number, newDuration: number) {
  trimClip(clipId, newStart, newDuration)
}

function onSplitClip(clipId: string, splitTime: number) {
  saveSnapshot()
  splitClip(clipId, splitTime)
}

function onAddClip(trackId: string, asset?: any, startTime?: number) {
  saveSnapshot()
  const track = state.tracks.find(t => t.id === trackId)
  if (!track) return

  const src = asset?.url || asset?.cloudUrl || asset?.src || ''
  if (asset && src) {
    const fileType = asset.fileType || 'video'
    addClip(trackId, {
      src,
      label: asset.label || '素材',
      start: startTime ?? findNextSlot(trackId),
      duration: asset.duration || 5,
      sourceDuration: asset.duration || 5,
      trimStart: 0,
      trimEnd: asset.duration || 5,
      type: fileType === 'image' ? 'image' : fileType === 'audio' ? 'audio' : 'video',
      thumbnail: asset.thumbnail || asset.thumbnailUrl,
    })
  } else {
    addClip(trackId, {
      src: '',
      label: '片段',
      start: findNextSlot(trackId),
      duration: 5,
      sourceDuration: 5,
      trimStart: 0,
      trimEnd: 5,
      type: 'video',
    })
  }
}

function onRemoveTrack(trackId: string) {
  saveSnapshot()
  removeTrack(trackId)
}

function onToggleMute(trackId: string) { toggleTrackMute(trackId) }
function onToggleLock(trackId: string) { toggleTrackLock(trackId) }

function onOpenTransition(trackId: string) {
  // 占位：转场面板
}

function onScroll() {
  // 同步滚动位置（用于书签定位等）
}

// ─── 导出视频 ───
async function exportVideo() {
  if (!isDesktop || !electronAPI) {
    alert('导出功能需要昆仑镜桌面版')
    return
  }
  if (state.tracks.length === 0) { alert('时间轴为空'); return }

  const outputPath = await electronAPI.saveVideoExport('昆仑镜-剪辑输出.mp4')
  if (!outputPath) return

  const clips: any[] = []
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      clips.push({
        src: clip.src, start: clip.start, duration: clip.duration,
        trimStart: clip.trimStart, trimEnd: clip.trimEnd,
        speed: clip.speed || 1, volume: clip.volume || 1, type: clip.type,
      })
    }
  }

  isExporting.value = true

  if (electronAPI.onExportProgress) {
    electronAPI.onExportProgress((p: any) => {
      exportProgress.value = p.progress || 0
      if (p.done) {
        isExporting.value = false
        alert(`✅ 导出完成！\n${p.outputPath}`)
      }
    })
  }

  const result = await electronAPI.exportVideo({
    clips, outputPath,
    totalDuration: state.timeline.duration,
    resolution: '720p', fps: 30, quality: 'medium', format: 'mp4',
  })

  if (result?.error) {
    isExporting.value = false
    alert(`导出失败: ${result.error}`)
  }
  if (electronAPI.removeExportProgressListener) {
    electronAPI.removeExportProgressListener()
  }
}

// ─── 播放循环 ───

let playRAF: number | null = null
let lastFrameTime = 0

function startPlayLoop() {
  stopPlayLoop()
  lastFrameTime = performance.now()

  function tick(now: number) {
    if (!state.timeline.isPlaying) {
      playRAF = requestAnimationFrame(tick)
      return
    }
    const dt = (now - lastFrameTime) / 1000
    lastFrameTime = now
    const step = Math.min(dt, 0.1) * state.timeline.playbackRate
    const next = state.timeline.currentTime + step
    if (next >= state.timeline.duration) {
      state.timeline.currentTime = 0
      state.timeline.isPlaying = false
    } else {
      state.timeline.currentTime = next
    }
    playRAF = requestAnimationFrame(tick)
  }
  playRAF = requestAnimationFrame(tick)
}

function stopPlayLoop() {
  if (playRAF !== null) {
    cancelAnimationFrame(playRAF)
    playRAF = null
  }
}

// 监听播放状态
import { watch } from 'vue'
watch(() => state.timeline.isPlaying, (playing) => {
  if (playing) startPlayLoop()
  else stopPlayLoop()
})

onUnmounted(() => stopPlayLoop())
</script>

<style scoped>
.video-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0b0f14;
  color: #e5e7eb;
}

/* ─── 顶栏 ─── */

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #11151c;
  border-bottom: 1px solid #1f2937;
  flex-shrink: 0;
  gap: 8px;
}

.topbar-left, .topbar-center, .topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar-title { font-size: 13px; font-weight: 500; margin-left: 6px; }
.topbar-hint { font-size: 10px; color: #4b5563; margin-left: 8px; }

.topbar-btn {
  background: none;
  border: 1px solid #374151;
  color: #d1d5db;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.topbar-btn:hover { background: #1f2937; }
.topbar-btn:disabled { opacity: 0.3; cursor: default; }
.export-btn { background: #2563eb; border-color: #2563eb; }
.export-btn:hover { background: #1d4ed8; }

/* ─── 主体 ─── */

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ─── 左栏：素材 ─── */

.panel-left {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1f2937;
  background: #0d1117;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #1f2937;
  font-size: 12px;
  font-weight: 500;
}

.panel-btn {
  background: none;
  border: 1px solid #374151;
  color: #d1d5db;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}
.panel-btn:hover { background: #1f2937; }

.asset-grid {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.asset-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: grab;
  background: #11151c;
  border: 1px solid #1f2937;
  position: relative;
}

.asset-card:hover { border-color: #374151; background: #161b24; }

.asset-preview { width: 32px; height: 24px; flex-shrink: 0; border-radius: 2px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; }
.asset-thumb { width: 100%; height: 100%; object-fit: cover; }
.asset-icon { font-size: 14px; opacity: 0.5; }

.asset-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.asset-name { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-duration { font-size: 9px; color: #6b7280; }

.asset-add-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: #2563eb;
  border: none;
  color: #fff;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
}

.asset-card:hover .asset-add-btn { opacity: 1; }
.asset-add-btn:hover { background: #1d4ed8; }

.asset-empty {
  text-align: center;
  font-size: 11px;
  color: #4b5563;
  padding: 20px 10px;
  line-height: 1.6;
}

/* ─── 中栏：预览 + 时间轴 ─── */

.panel-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.center-preview-area {
  flex: 0 0 35%;
  min-height: 180px;
  max-height: 50%;
  background: #0a0d14;
  border-bottom: 1px solid #1f2937;
  overflow: hidden;
}

.center-timeline-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-tracks {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
}

.empty-timeline {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #4b5563;
  font-size: 13px;
  gap: 8px;
}
</style>
