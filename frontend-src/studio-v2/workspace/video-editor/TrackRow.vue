<template>
  <div
    class="track-row"
    :class="{ 'track-muted': track.muted, 'track-locked': track.locked }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 轨道标签 -->
    <div class="track-label">
      <div class="track-type-icon">{{ trackIcons[track.type] }}</div>
      <div class="track-name" :title="track.label">{{ track.label }}</div>
      <div class="track-actions">
        <button
          class="track-btn"
          :class="{ active: track.muted }"
          @click="$emit('toggle-mute', track.id)"
          :title="track.muted ? '取消静音' : '静音'"
        >🔇</button>
        <button
          class="track-btn"
          :class="{ active: track.locked }"
          @click="$emit('toggle-lock', track.id)"
          :title="track.locked ? '解锁' : '锁定'"
        >🔒</button>
        <button class="track-btn" @click="$emit('remove-track', track.id)" title="删除轨道">✕</button>
      </div>
    </div>

    <!-- 轨道片段区域 -->
    <div class="track-clips" ref="clipsAreaRef">
      <!-- 转场标记 -->
      <div
        v-for="t in track.transitions"
        :key="t.id"
        class="transition-marker"
        :style="transitionStyle(t)"
        :title="t.type"
      ></div>

      <!-- 片段 -->
      <div
        v-for="clip in track.clips"
        :key="clip.id"
        class="clip-block"
        :class="{ 'clip-selected': isSelected(clip.id) }"
        :style="clipStyle(clip)"
        draggable="true"
        @dragstart="onClipDragStart(clip.id, $event)"
        @click.stop="onClipClick(clip.id)"
        @dblclick="onClipDblClick(clip)"
      >
        <!-- 裁剪左边手柄 -->
        <div class="trim-handle trim-left" @mousedown.stop.prevent="onTrimStart(clip.id, 'left', $event)"></div>

        <div class="clip-content">
          <div class="clip-thumb" v-if="clip.thumbnail">
            <img :src="clip.thumbnail" class="clip-thumb-img" />
          </div>
          <div class="clip-info">
            <span class="clip-label">{{ clip.label }}</span>
            <span class="clip-time">{{ clip.duration.toFixed(1) }}s</span>
          </div>
        </div>

        <!-- 裁剪右边手柄 -->
        <div class="trim-handle trim-right" @mousedown.stop.prevent="onTrimStart(clip.id, 'right', $event)"></div>
      </div>

      <!-- 空状态 -->
      <div v-if="track.clips.length === 0" class="track-empty">
        拖拽素材到此处
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Track, TrackType, Clip } from './video-editor-types'

const props = defineProps<{
  track: Track
  zoom: number
  selectedClipIds: string[]
  currentTime: number
}>()

const emit = defineEmits<{
  'select-clip': [clipId: string, addToSelection: boolean]
  'move-clip': [clipId: string, newStart: number, destTrackId?: string]
  'trim-clip': [clipId: string, newStart: number, newDuration: number]
  'split-clip': [clipId: string, splitTime: number]
  'add-clip': [trackId: string, asset?: any, startTime?: number]
  'remove-track': [trackId: string]
  'toggle-mute': [trackId: string]
  'toggle-lock': [trackId: string]
  'open-transition': [trackId: string, transitionId: string]
}>()

const trackIcons: Record<TrackType, string> = {
  video: '🎬', audio: '🎵', text: '📝', overlay: '🖼',
}

const clipsAreaRef = ref<HTMLElement | null>(null)

// ─── 片段样式 ───

function clipStyle(clip: Clip) {
  return {
    left: (clip.start * props.zoom) + 'px',
    width: (clip.duration * props.zoom) + 'px',
  }
}

function transitionStyle(t: Track['transitions'][number]) {
  const fromClip = props.track.clips.find(c => c.id === t.fromClipId)
  if (!fromClip) return { display: 'none' }
  return {
    left: (fromClip.start + fromClip.duration - t.duration / 2) * props.zoom + 'px',
    width: t.duration * props.zoom + 'px',
  }
}

function isSelected(clipId: string) {
  return props.selectedClipIds.includes(clipId)
}

// ─── 片段点击 ───

function onClipClick(clipId: string) {
  emit('select-clip', clipId, false)
}

function onClipDblClick(clip: Clip) {
  // 双击分割
  const splitTime = props.currentTime
  if (splitTime > clip.start && splitTime < clip.start + clip.duration) {
    emit('split-clip', clip.id, splitTime)
  }
}

// ─── 拖拽 ───

let dragClipId = ''

function onClipDragStart(clipId: string, event: DragEvent) {
  dragClipId = clipId
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/clip-id', clipId)
    event.dataTransfer.setData('text/source-track', props.track.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(e: DragEvent) {
  e.dataTransfer!.dropEffect = 'copy'
}

function onDragLeave() {
  // 可选：移除拖拽高亮
}

function onDrop(e: DragEvent) {
  if (!e.dataTransfer || props.track.locked) return

  const clipId = e.dataTransfer.getData('text/clip-id')
  const sourceTrack = e.dataTransfer.getData('text/source-track')

  const rect = clipsAreaRef.value?.getBoundingClientRect()
  const x = e.clientX - (rect?.left ?? 0)
  const newStart = Math.max(0, x / props.zoom)

  if (clipId && sourceTrack) {
    // 轨道内片段移动
    if (sourceTrack !== props.track.id) {
      emit('move-clip', clipId, newStart, props.track.id)
    } else {
      emit('move-clip', clipId, newStart)
    }
    return
  }

  // 从素材面板拖入
  const assetData = e.dataTransfer.getData('text/asset')
  if (assetData) {
    try {
      const asset = JSON.parse(assetData)
      emit('add-clip', props.track.id, asset, newStart)
    } catch {}
  }
}

// ─── 裁剪（trim） ───

let trimClipId = ''
let trimSide: 'left' | 'right' = 'left'
let trimStartX = 0
let trimOriginalStart = 0
let trimOriginalDuration = 0

function onTrimStart(clipId: string, side: 'left' | 'right', event: MouseEvent) {
  trimClipId = clipId
  trimSide = side
  trimStartX = event.clientX
  const clip = props.track.clips.find(c => c.id === clipId)
  if (clip) {
    trimOriginalStart = clip.start
    trimOriginalDuration = clip.duration
  }

  document.addEventListener('mousemove', onTrimMove)
  document.addEventListener('mouseup', onTrimEnd)
}

function onTrimMove(event: MouseEvent) {
  const dx = (event.clientX - trimStartX) / props.zoom
  const clip = props.track.clips.find(c => c.id === trimClipId)
  if (!clip) return

  if (trimSide === 'left') {
    const newStart = Math.max(0, trimOriginalStart + dx)
    const newDuration = Math.max(0.1, trimOriginalDuration - (newStart - trimOriginalStart))
    emit('trim-clip', trimClipId, newStart, newDuration)
  } else {
    const newDuration = Math.max(0.1, trimOriginalDuration + dx)
    emit('trim-clip', trimClipId, clip.start, newDuration)
  }
}

function onTrimEnd() {
  document.removeEventListener('mousemove', onTrimMove)
  document.removeEventListener('mouseup', onTrimEnd)
}
</script>

<style scoped>
.track-row {
  display: flex;
  border-bottom: 1px solid #1f2937;
  min-height: 48px;
  position: relative;
}

.track-row:hover { background: #0f131a; }
.track-muted { opacity: 0.5; }
.track-locked .track-clips { pointer-events: none; opacity: 0.6; }

.track-label {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-right: 1px solid #1f2937;
  background: #0d1117;
  gap: 2px;
}

.track-type-icon { font-size: 14px; }
.track-name { font-size: 10px; color: #9ca3af; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }

.track-actions { display: flex; gap: 2px; }
.track-btn {
  background: none;
  border: none;
  color: #4b5563;
  cursor: pointer;
  font-size: 9px;
  padding: 1px 2px;
  border-radius: 2px;
}
.track-btn:hover { color: #d1d5db; background: #1f2937; }
.track-btn.active { color: #f59e0b; }

.track-clips {
  flex: 1;
  position: relative;
  min-height: 48px;
  overflow: visible;
}

.track-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  font-size: 11px;
}

.clip-block {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 4px;
  cursor: grab;
  overflow: hidden;
  border: 1px solid #374151;
  z-index: 2;
}

.clip-block:hover { border-color: #60a5fa; z-index: 3; }
.clip-selected { border-color: #3b82f6 !important; box-shadow: 0 0 0 1px #3b82f6; }

/* 不同类型片段颜色 */
.clip-block:has(.clip-info) {
  background: linear-gradient(135deg, #1a2332 0%, #1a2a3f 100%);
}

/* 裁剪手柄 */
.trim-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 5;
}

.trim-left { left: -1px; }
.trim-right { right: -1px; }
.trim-handle:hover { background: rgba(96, 165, 250, 0.3); }

.clip-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 2px 6px;
  gap: 6px;
  overflow: hidden;
}

.clip-thumb { width: 40px; height: 28px; flex-shrink: 0; border-radius: 2px; overflow: hidden; }
.clip-thumb-img { width: 100%; height: 100%; object-fit: cover; }

.clip-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.clip-label { font-size: 10px; color: #e5e7eb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clip-time { font-size: 9px; color: #6b7280; }

.transition-marker {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(96, 165, 250, 0.2);
  border-left: 2px solid #60a5fa;
  border-right: 2px solid #60a5fa;
  z-index: 4;
  pointer-events: none;
}
</style>
