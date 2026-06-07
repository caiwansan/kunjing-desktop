<template>
  <div class="timeline-ruler" ref="rulerRef">
    <!-- 缩放到大小按钮 -->
    <div class="ruler-controls">
      <button class="ruler-btn" @click="$emit('zoom-out')" title="缩小">🔍−</button>
      <button class="ruler-btn" @click="$emit('zoom-in')" title="放大">🔍+</button>
      <button class="ruler-btn" @click="$emit('zoom-fit')" title="适应">⊞</button>
    </div>

    <!-- 标尺刻度 -->
    <div class="ruler-track" :style="{ width: totalWidth + 'px' }">
      <div
        v-for="mark in timeMarks"
        :key="mark.time"
        class="ruler-mark"
        :style="{ left: mark.x + 'px' }"
        @click="onSeek(mark.time)"
      >
        <div class="mark-line" :class="{ major: mark.isMajor }"></div>
        <span v-if="mark.isMajor" class="mark-label">{{ formatTime(mark.time) }}</span>
      </div>

      <!-- 播放头 -->
      <div class="playhead" :style="{ left: playheadX + 'px' }">
        <div class="playhead-triangle"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  duration: number
  zoom: number
  currentTime: number
}>()

const emit = defineEmits<{
  seek: [time: number]
  'zoom-in': []
  'zoom-out': []
  'zoom-fit': []
}>()

const totalWidth = computed(() => props.duration * props.zoom)
const playheadX = computed(() => props.currentTime * props.zoom)

// 计算标尺刻度标记
const timeMarks = computed(() => {
  const marks: { time: number; x: number; isMajor: boolean }[] = []
  const step = getMarkStep(props.zoom)
  const count = Math.ceil(props.duration / step)
  for (let i = 0; i <= count; i++) {
    const time = i * step
    if (time <= props.duration) {
      marks.push({ time, x: time * props.zoom, isMajor: i % 5 === 0 })
    }
  }
  return marks
})

function getMarkStep(zoom: number): number {
  if (zoom >= 120) return 0.5
  if (zoom >= 60) return 1
  if (zoom >= 30) return 2
  if (zoom >= 15) return 5
  return 10
}

function onSeek(time: number) {
  emit('seek', time)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.timeline-ruler {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #1f2937;
  background: #11151c;
  flex-shrink: 0;
  height: 28px;
  overflow: hidden;
}

.ruler-controls {
  display: flex;
  gap: 2px;
  padding: 2px 6px;
  align-items: center;
  border-right: 1px solid #1f2937;
  flex-shrink: 0;
}

.ruler-btn {
  background: none;
  border: 1px solid #374151;
  color: #9ca3af;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.ruler-btn:hover { background: #1f2937; color: #d1d5db; }

.ruler-track {
  position: relative;
  min-width: 100%;
  overflow: visible;
}

.ruler-mark {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  cursor: pointer;
}

.mark-line {
  width: 1px;
  height: 8px;
  background: #4b5563;
}

.mark-line.major {
  height: 14px;
  background: #6b7280;
}

.mark-label {
  position: absolute;
  top: 14px;
  left: 3px;
  font-size: 9px;
  color: #6b7280;
  white-space: nowrap;
  font-family: monospace;
  pointer-events: none;
}

.playhead {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.playhead-triangle {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #ef4444;
  margin-left: -5px;
}
</style>
