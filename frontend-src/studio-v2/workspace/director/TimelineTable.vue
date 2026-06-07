<template>
  <div class="timeline-table">
    <!-- 头部：时间轴刻度 -->
    <div class="table-header">
      <div class="row-label"></div>
      <div
        v-for="n in duration"
        :key="n"
        class="header-second"
        :class="{ active: activeSecond === n - 1 }"
      >{{ n }}</div>
    </div>

    <!-- 画面行 (beats 展示) -->
    <div class="table-row">
      <div class="row-label">画面</div>
      <div
        v-for="n in duration"
        :key="n"
        class="row-cell beat-cell"
        :class="{ active: activeSecond === n - 1, merged: isMergedCell(n - 1) }"
        :style="getBeatSpanStyle(n - 1)"
        @click="$emit('select-second', n - 1)"
      >
        <div v-if="isBeatStart(n - 1)" class="beat-content">
          <span class="beat-camera">{{ getBeatAt(n - 1)?.camera }}</span>
          <span class="beat-visual">{{ getBeatAt(n - 1)?.visual }}</span>
        </div>
      </div>
    </div>

    <!-- 台词行 -->
    <div class="table-row">
      <div class="row-label">台词</div>
      <div
        v-for="n in duration"
        :key="'dial-' + n"
        class="row-cell"
        :class="{ active: activeSecond === n - 1, merged: isMergedCell(n - 1) }"
        :style="getBeatSpanStyle(n - 1)"
      >
        <div v-if="isBeatStart(n - 1)" class="beat-content beat-dialogue">
          {{ getBeatAt(n - 1)?.dialogue }}
        </div>
      </div>
    </div>

    <!-- 特效行 -->
    <div class="table-row">
      <div class="row-label">特效</div>
      <div
        v-for="n in duration"
        :key="'fx-' + n"
        class="row-cell"
        :class="{ active: activeSecond === n - 1, merged: isMergedCell(n - 1) }"
        :style="getBeatSpanStyle(n - 1)"
      >
        <div v-if="isBeatStart(n - 1)" class="beat-content beat-fx">
          {{ getBeatAt(n - 1)?.effect }}
        </div>
      </div>
    </div>

    <!-- 音效行 -->
    <div class="table-row">
      <div class="row-label">音效</div>
      <div
        v-for="n in duration"
        :key="'snd-' + n"
        class="row-cell"
        :class="{ active: activeSecond === n - 1, merged: isMergedCell(n - 1) }"
        :style="getBeatSpanStyle(n - 1)"
      >
        <div v-if="isBeatStart(n - 1)" class="beat-content beat-sound">
          {{ getBeatAt(n - 1)?.sound }}
        </div>
      </div>
    </div>

    <!-- 运镜行 -->
    <div class="table-row">
      <div class="row-label">运镜</div>
      <div
        v-for="n in duration"
        :key="'cam-' + n"
        class="row-cell"
        :class="{ active: activeSecond === n - 1, merged: isMergedCell(n - 1) }"
        :style="getBeatSpanStyle(n - 1)"
      >
        <div v-if="isBeatStart(n - 1)" class="beat-content beat-camera">
          {{ getBeatAt(n - 1)?.camera }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineFrame } from '~/studio-v2/types/runtime/segment-runtime'

interface Beat {
  start: number
  end: number
  visual: string
  camera?: string
  dialogue?: string
  effect?: string
  sound?: string
}

const props = defineProps<{
  timeline: TimelineFrame[]
  beats?: Beat[]
  duration: number
  activeSecond: number
  projectId?: string
}>()

const emit = defineEmits<{
  'select-second': [second: number]
  'update': [second: number, field: string, value: string]
}>()

/** 计算当前拍：每个秒属于哪个 beat */
const beatIndex = computed(() => {
  if (!props.beats?.length) return []
  const map: number[] = new Array(props.duration).fill(-1)
  props.beats.forEach((b, i) => {
    for (let s = b.start; s < b.end && s < props.duration; s++) {
      map[s] = i
    }
  })
  return map
})

function isMergedCell(second: number): boolean {
  if (!props.beats?.length) return false
  const idx = beatIndex.value[second]
  if (idx < 0) return false
  const beat = props.beats[idx]
  // 非起始秒就合并
  return second !== beat.start
}

function isBeatStart(second: number): boolean {
  if (!props.beats?.length) return true
  const idx = beatIndex.value[second]
  if (idx < 0) return true
  return props.beats[idx].start === second
}

function getBeatAt(second: number): Beat | undefined {
  if (!props.beats?.length) return undefined
  const idx = beatIndex.value[second]
  if (idx < 0) return undefined
  return props.beats[idx]
}

function getBeatSpanStyle(second: number): Record<string, string> {
  if (!isBeatStart(second)) return {}
  const beat = getBeatAt(second)
  if (!beat) return {}
  const span = beat.end - beat.start
  if (span <= 1) return {}
  return { gridColumn: `${second + 1} / span ${span}` }
}
</script>

<style scoped>
.timeline-table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #0f0f1a;
  border: 1px solid #1a1a28;
  border-radius: 8px;
  overflow-x: auto;
}
.table-header {
  display: grid;
  grid-template-columns: 70px repeat(var(--duration, 1), 1fr);
  background: #111122;
  border-bottom: 1px solid #1a1a28;
  position: sticky;
  top: 0;
  z-index: 1;
}
.header-second {
  text-align: center;
  font-size: 9px;
  color: #4b5563;
  padding: 4px 0;
  border-left: 1px solid #1a1a28;
}
.header-second.active { color: #3b82f6; }
.table-row {
  display: grid;
  grid-template-columns: 70px repeat(var(--duration, 1), 1fr);
  min-height: 32px;
}
.row-label {
  font-size: 10px;
  color: #6b7280;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  background: #0a0a14;
  border-right: 1px solid #1a1a28;
}
.row-cell {
  border-left: 1px solid #1a1a28;
  padding: 2px;
  min-height: 32px;
  position: relative;
}
.row-cell.active { background: #111833; }
.row-cell.merged {
  display: none;
}
.beat-content {
  font-size: 9px;
  line-height: 1.3;
  padding: 2px;
}
.beat-visual { color: #d1d5db; display: block; }
.beat-camera { color: #3b82f6; font-size: 8px; display: block; }
.beat-dialogue { color: #f59e0b; }
.beat-fx { color: #a78bfa; }
.beat-sound { color: #34d399; }
textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: #d1d5db;
  font-size: 9px;
  resize: none;
  outline: none;
  font-family: inherit;
}
textarea:focus { background: #1a1a28; }
</style>
