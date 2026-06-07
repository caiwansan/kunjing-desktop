<template>
  <div class="segment-grid">
    <div v-if="segments.length === 0" class="empty-state">
      <div class="empty-icon">🎬</div>
      <div class="empty-text">还没有片段，请先完成剧本分析</div>
      <button class="btn-empty" @click="$emit('add')">+ 添加第一个片段</button>
    </div>
    <div
      v-for="(seg, idx) in segments"
      :key="seg?.id || idx"
      v-if="seg"
      class="segment-card"
      :class="{ active: activeIndex === idx }"
      @click="$emit('select', idx)"
    >
      <div class="card-header">
        <span class="card-title">{{ seg.title || '片段 ' + String(idx + 1).padStart(2, '0') }}</span>
        <span class="card-duration">{{ seg.duration }}s</span>
      </div>
      <div class="card-beat">{{ seg.masterBeat || '未设定' }}</div>
      <div class="card-meta">
        <span>{{ seg.timeline.length }}/{{ seg.duration }} 拍</span>
        <span>{{ seg.characters.length }} 角色</span>
        <span>{{ seg.scenes.length }} 场景</span>
      </div>
      <!-- Narrative Compiler v2: beat 时间轴预览 -->
      <div class="card-beats-preview">
        <div
          v-for="(frame, fi) in seg.timeline"
          :key="fi"
          class="beat-bar"
          :style="{ width: ((frame.second || 1) / seg.duration * 100) + '%' }"
          :class="{ filled: !!frame.visual }"
          :title="(frame.camera || '镜头') + ' ' + (frame.visual || '').slice(0, 30)"
        ></div>
      </div>
      <!-- 转场标记 -->
      <div v-if="seg.transition" class="card-transition">{{ seg.transition }}</div>
      <button class="btn-remove" @click.stop="$emit('remove', seg.id)">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'

defineProps<{
  segments: SegmentRuntime[]
  activeIndex: number
}>()

defineEmits<{
  select: [index: number]
  add: []
  remove: [id: string]
}>()
</script>

<style scoped>
.segment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  padding: 16px 20px;
}
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 0;
}
.empty-icon { font-size: 32px; opacity: 0.2; }
.empty-text { font-size: 12px; color: #4b5563; }
.btn-empty {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  color: #9ca3af;
  font-size: 11px;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-empty:hover { background: #222233; }

.segment-card {
  background: #0d0d18;
  border: 1px solid #1a1a28;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
.segment-card:hover { border-color: #2a2a3a; background: #111122; }
.segment-card.active { border-color: #3b82f6; background: #111833; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.card-title { font-size: 13px; font-weight: 500; color: #d1d5db; }
.card-duration { font-size: 10px; color: #6b7280; background: #1a1a28; padding: 2px 6px; border-radius: 4px; }
.card-beat { font-size: 11px; color: #9ca3af; line-height: 1.4; margin-bottom: 8px; }
.card-meta { display: flex; gap: 10px; font-size: 10px; color: #6b7280; margin-bottom: 8px; }
.card-beats-preview {
  display: flex;
  gap: 2px;
  margin-bottom: 6px;
  overflow: hidden;
}
.beat-bar {
  height: 6px;
  border-radius: 2px;
  background: #1a1a28;
  min-width: 4px;
  transition: background 0.15s;
}
.beat-bar.filled { background: #3b82f6; }
.card-transition {
  font-size: 10px;
  color: #6b7280;
  background: #1a1a28;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}
.btn-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  background: none;
  border: none;
  color: #4b5563;
  font-size: 10px;
  cursor: pointer;
  width: 20px; height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.segment-card:hover .btn-remove { opacity: 1; }
.btn-remove:hover { color: #ef4444; background: #1a1a28; }
</style>
