<template>
  <div class="preview-panel">
    <!-- 播放控制栏 -->
    <div class="preview-toolbar">
      <button class="ctrl-btn" @click="$emit('seek', 0)" title="开头">⏮</button>
      <button class="ctrl-btn play-btn" @click="$emit('toggle-play')" title="播放/暂停">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="ctrl-btn" @click="$emit('seek', duration)" title="结尾">⏭</button>
      <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>

    <!-- 视频画布 -->
    <div class="preview-canvas-wrapper" ref="canvasRef">
      <canvas
        ref="canvasEl"
        class="preview-canvas"
      ></canvas>
      <!-- 视频源：隐藏的 video 元素，纯作为解码器 -->
      <video
        ref="videoEl"
        class="hidden-video"
        muted
        playsinline
        preload="auto"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @ended="onEnded"
      ></video>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import type { Clip } from './video-editor-types'

const props = defineProps<{
  isPlaying: boolean
  currentTime: number
  duration: number
  mainClip: Clip | null
}>()

const emit = defineEmits<{
  'toggle-play': []
  seek: [time: number]
}>()

// ─── 模板引用 ───

const canvasRef = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

// ─── 画布自适应 ───

const canvasWidth = ref(320)
const canvasHeight = ref(180)
/** 当前视频的实际宽高比（默认 16:9） */
let videoAspect = 16 / 9

function resizeCanvas() {
  const container = canvasRef.value
  if (!container) return
  const w = container.clientWidth - 16
  const h = container.clientHeight - 16
  if (w <= 0 || h <= 0) return
  let cw = w
  let ch = w / videoAspect
  if (ch > h) {
    ch = h
    cw = h * videoAspect
  }
  canvasWidth.value = Math.floor(cw)
  canvasHeight.value = Math.floor(ch)
  const canvas = canvasEl.value
  if (canvas) {
    canvas.width = canvasWidth.value
    canvas.height = canvasHeight.value
    canvas.style.width = canvasWidth.value + 'px'
    canvas.style.height = canvasHeight.value + 'px'
  }
}

let resizeObs: ResizeObserver | null = null

onMounted(() => {
  resizeCanvas()
  if (canvasRef.value) {
    resizeObs = new ResizeObserver(() => resizeCanvas())
    resizeObs.observe(canvasRef.value)
  }
})

onUnmounted(() => {
  resizeObs?.disconnect()
  resizeObs = null
})

// ─── 视频源切换 ───

/** 当前应该播放的 src */
const currentSrc = computed(() => props.mainClip?.src || '')

const video = () => videoEl.value

// 当 src 改变或 mainClip 改变时，重新加载视频
watch(currentSrc, (src) => {
  const el = video()
  if (!el) return
  if (!src) { el.removeAttribute('src'); return }
  el.src = src
  el.load()
})

// 当播放/暂停切换
watch(() => props.isPlaying, (playing) => {
  const el = video()
  if (!el || !el.src) return
  if (playing) {
    el.play().catch(() => {})  // muted + playsinline，应该成功
  } else {
    el.pause()
  }
})

// 用户拖拽时间轴时 seek（仅在非播放状态）
watch(() => props.currentTime, (t) => {
  const el = video()
  if (!el || !el.src) return
  // 播放中不强制 seek，由 timeupdate 驱动
  if (props.isPlaying) return
  if (Math.abs(el.currentTime - t) > 0.2) {
    el.currentTime = t
  }
})

// ─── 事件处理 ───

function onLoadedMetadata() {
  const el = video()
  if (!el) return
  const vw = el.videoWidth
  const vh = el.videoHeight
  if (vw > 0 && vh > 0) {
    videoAspect = vw / vh
    resizeCanvas()
  }
  // 同步当前时间
  el.currentTime = props.currentTime
  if (props.isPlaying) {
    el.play().catch(() => {})
  }
}

function onTimeUpdate() {
  const el = video()
  if (!el || !el.src) return
  // 只在播放中回写，且差异足够大时才 emit
  if (!props.isPlaying) return
  const diff = Math.abs(el.currentTime - props.currentTime)
  if (diff > 0.08) {
    emit('seek', el.currentTime)
  }
}

function onEnded() {
  emit('seek', 0)
  emit('toggle-play')
}

// ─── 渲染帧到 canvas ───

let rafId: number | null = null

function renderFrame() {
  const canvas = canvasEl.value
  const video = videoEl.value
  if (canvas && video && video.src && !video.paused) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
  }
  rafId = requestAnimationFrame(renderFrame)
}

onMounted(() => {
  rafId = requestAnimationFrame(renderFrame)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// ─── 工具 ───

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.preview-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #11151c;
  overflow: hidden;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #1f2937;
  flex-shrink: 0;
}

.ctrl-btn {
  background: none;
  border: 1px solid #374151;
  color: #d1d5db;
  width: 30px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctrl-btn:hover { background: #1f2937; }
.play-btn { width: 36px; }

.time-display {
  font-size: 11px;
  color: #9ca3af;
  font-family: monospace;
  margin-left: auto;
}

.preview-canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0d14;
  overflow: hidden;
  padding: 8px;
}

.preview-canvas {
  background: #000;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.hidden-video {
  display: none;  /* 纯解码器，画布渲染 */
}
</style>
