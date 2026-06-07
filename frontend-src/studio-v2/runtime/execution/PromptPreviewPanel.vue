<template>
  <div class="prompt-preview-panel">
    <div class="panel-header">
      <span class="panel-title">Prompt Runtime — 编译指令</span>
      <div class="header-right">
        <span v-if="runtime?.graphSource?.influenceApplied" class="graph-badge">📊 Graph</span>
        <span v-if="runtime?.compiledAt" class="panel-time">{{ formatTime(runtime.compiledAt) }}</span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!runtime" class="empty-state">
      <div class="empty-icon">⚡</div>
      <div class="empty-text">尚未编译，请点击 Compile</div>
    </div>

    <!-- Graph Influence 条 -->
    <div v-if="runtime?.graphSource?.influenceApplied" class="graph-influence-bar">
      <span class="graph-label">Graph 决策已影响编译:</span>
      <span v-if="graphAvgWeight > 0.6" class="graph-strong">高影响</span>
      <span v-else-if="graphAvgWeight > 0.3" class="graph-mid">中影响</span>
      <span v-else class="graph-low">低影响</span>
    </div>

    <!-- 编译后的 Prompt Table -->
    <div v-else-if="runtime?.frames" class="prompt-table">
      <div class="prompt-header-row">
        <div class="col-t">秒</div>
        <div class="col-visual">Visual Prompt</div>
        <div class="col-camera">Camera</div>
        <div class="col-audio">Audio</div>
        <div class="col-emotion">Emotion</div>
        <div class="col-graph">Graph</div>
      </div>

      <div
        v-for="frame in runtime.frames"
        :key="frame.t"
        class="prompt-row"
        :class="{ empty: !frame.visualPrompt && !frame.cameraPrompt }"
      >
        <div class="col-t">{{ frame.t }}s</div>
        <div class="col-visual">
          <span v-if="frame.visualPrompt" class="prompt-text">{{ frame.visualPrompt }}</span>
          <span v-else class="empty-cell">—</span>
        </div>
        <div class="col-camera">
          <span v-if="frame.cameraPrompt" class="prompt-text">{{ frame.cameraPrompt }}</span>
          <span v-else class="empty-cell">—</span>
        </div>
        <div class="col-audio">
          <span v-if="frame.audioPrompt" class="prompt-text">{{ frame.audioPrompt }}</span>
          <span v-else class="empty-cell">—</span>
        </div>
        <div class="col-emotion">
          <span v-if="frame.emotionTag" class="emotion-tag">{{ frame.emotionTag }}</span>
          <span v-else class="empty-cell">—</span>
        </div>
        <div class="col-graph">
          <div v-if="frame.graphInfluence" class="graph-weight-bars">
            <span class="gw-bar" :style="{ width: (frame.graphInfluence.sceneWeight * 100) + '%' }" title="场景"></span>
            <span class="gw-bar gw-emotion" :style="{ width: (frame.graphInfluence.emotionWeight * 100) + '%' }" title="情绪"></span>
            <span class="gw-bar gw-camera" :style="{ width: (frame.graphInfluence.cameraWeight * 100) + '%' }" title="镜头"></span>
          </div>
          <span v-else class="empty-cell">—</span>
        </div>
      </div>

      <!-- 统计 -->
      <div class="prompt-stats">
        <span>{{ runtime.frames.length }} 帧</span>
        <span>Visual: {{ (stats.visualCoverage * 100).toFixed(0) }}%</span>
        <span>Camera: {{ (stats.cameraCoverage * 100).toFixed(0) }}%</span>
        <span>Audio: {{ (stats.audioCoverage * 100).toFixed(0) }}%</span>
        <span>平均: {{ stats.avgPromptLength }} chars</span>
      </div>
    </div>

    <!-- 兜底：runtime 不为 null 但没有 frames -->
    <div v-else class="prompt-empty">
      <div class="empty-text">编译结果数据异常</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PromptRuntime } from '~/studio-v2/runtime/execution/execution-types'
import { promptRuntimeStore } from '~/studio-v2/runtime/execution/PromptRuntime'

const props = defineProps<{
  runtime: PromptRuntime | null
}>()

const stats = computed(() => {
  if (!props.runtime) {
    return { visualCoverage: 0, cameraCoverage: 0, audioCoverage: 0, frameCount: 0, avgPromptLength: 0 }
  }
  return promptRuntimeStore.getStats(props.runtime)
})

const graphAvgWeight = computed(() => {
  if (!props.runtime?.frames.length) return 0
  const weights = props.runtime.frames
    .filter(f => f.graphInfluence)
    .map(f => (f.graphInfluence!.sceneWeight + f.graphInfluence!.emotionWeight + f.graphInfluence!.cameraWeight) / 3)
  return weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0
})

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.prompt-preview-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a28;
}
.panel-title { font-size: 13px; font-weight: 600; color: #d1d5db; }
.panel-time { font-size: 10px; color: #4b5563; }

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.empty-icon { font-size: 28px; opacity: 0.2; }
.empty-text { font-size: 11px; color: #4b5563; }

.prompt-table {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.prompt-header-row, .prompt-row {
  display: grid;
  grid-template-columns: 40px 1.5fr 1fr 1fr 80px 60px;
  border-bottom: 1px solid #0d0d1a;
}
.prompt-header-row {
  position: sticky;
  top: 0;
  background: #0b0f14;
  z-index: 1;
}
.prompt-header-row > div {
  padding: 8px 10px;
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-right: 1px solid #0d0d1a;
}
.prompt-row > div {
  padding: 6px 10px;
  font-size: 11px;
  color: #d1d5db;
  border-right: 1px solid #0d0d1a;
  line-height: 1.4;
  overflow: hidden;
}
.prompt-row > div:last-child,
.prompt-header-row > div:last-child { border-right: none; }
.prompt-row.empty > div { color: #1a1a28; }
.col-t { color: #6b7280 !important; font-variant-numeric: tabular-nums; }
.prompt-text { color: #9ca3af; }
.empty-cell { color: #1a1a28; }
.emotion-tag {
  background: #1a1a28;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: #9ca3af;
}

.col-graph { min-width: 60px; }
.graph-weight-bars { display: flex; flex-direction: column; gap: 2px; }
.gw-bar { display: block; height: 3px; background: #60a5fa; border-radius: 1px; }
.gw-bar.gw-emotion { background: #a78bfa; }
.gw-bar.gw-camera { background: #34d399; }

.header-right { display: flex; align-items: center; gap: 8px; }
.graph-badge {
  font-size: 9px; padding: 2px 6px;
  background: #0f1a0f; color: #34d399;
  border-radius: 4px;
}

.graph-influence-bar {
  padding: 6px 16px;
  font-size: 10px;
  display: flex;
  gap: 6px;
  align-items: center;
  background: #0a0f0a;
  border-bottom: 1px solid #1a1a28;
}
.graph-label { color: #6b7280; }
.graph-strong { color: #10b981; font-weight: 600; }
.graph-mid { color: #f59e0b; font-weight: 600; }
.graph-low { color: #6b7280; }

.prompt-stats {
  padding: 10px 16px;
  display: flex;
  gap: 14px;
  font-size: 10px;
  color: #4b5563;
  border-top: 1px solid #1a1a28;
}
.prompt-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
