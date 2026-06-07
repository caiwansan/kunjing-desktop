<template>
  <div class="segment-editor" v-if="segment">
    <!-- 编辑头 -->
    <div class="editor-header">
      <div class="editor-title-area">
        <input
          class="editor-title"
          :value="segment.title"
          @input="onTitleInput"
          placeholder="片段标题…"
        />
        <input
          class="editor-beat"
          :value="segment.masterBeat"
          @input="onBeatInput"
          placeholder="情绪核心（如：紧张对峙）"
        />
      </div>
      <div class="editor-meta">
        <span>{{ segment.characters.length }} 角色</span>
        <span>{{ segment.scenes.length }} 场景</span>
        <button class="btn-compile" @click="handleCompile">▶ Compile</button>
      </div>
    </div>

    <div class="editor-split">
      <!-- 左侧：时间轴编辑 (Human Layer) -->
      <div class="editor-left">
        <div class="editor-mode-bar">
          <span class="mode-label">人类层 — 手动编辑</span>
          <button v-if="mergeState" class="btn-merge" @click="applyMerge">
            应用 AI 合并版本
          </button>
        </div>

        <TimelineHeader
          :duration="segment.duration"
          :active-second="activeSecond"
        />

        <TimelineTable
          :timeline="segment.timeline"
          :active-second="activeSecond"
          :project-id="projectId"
          @update="onFrameUpdate"
        />
      </div>

      <!-- 右侧：AI Director Panel -->
      <div class="editor-right">
        <AIDirectorPanel
          :segment="segment"
          @apply-suggestion="onAiApply"
        />
      </div>
    </div>

    <!-- 底部 -->
    <div class="editor-footer">
      <button class="btn-back" @click="$emit('back')">← 返回片段列表</button>
      <button class="btn-map" @click="mapSegmentToEditor" :disabled="!segment">
        🎬 映射此片段到编辑器
      </button>
    </div>
  </div>

  <div v-else class="editor-empty">
    <div class="empty-hint">请选择一个片段</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import TimelineHeader from './TimelineHeader.vue'
import TimelineTable from './TimelineTable.vue'
import AIDirectorPanel from '~/studio-v2/runtime/director-ai/AIDirectorPanel.vue'
import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'
import type { OptimizationSuggestion, HumanAIMergeState } from '~/studio-v2/runtime/director-ai/director-ai-types'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import { executionEngine } from '~/studio-v2/runtime/execution/ExecutionEngine'
import { directorAgent } from '~/studio-v2/runtime/director-ai/DirectorAgent'
import { useVideoEditor } from '~/studio-v2/workspace/video-editor/useVideoEditor'
import { segmentToTracks } from '~/studio-v2/workspace/video-editor/director-bridge'
import type { SegmentBridgeInput } from '~/studio-v2/workspace/video-editor/director-bridge'

const props = defineProps<{
  segment: SegmentRuntime | null
}>()

const emit = defineEmits<{
  back: []
  compile: []
}>()

const { updateSegment, updateTimelineFrame, projectId } = useStudioStore()

const activeSecond = ref(0)
const mergeState = ref<HumanAIMergeState | null>(null)

// 当 segment 切换时重置
watch(() => props.segment?.id, () => {
  activeSecond.value = 0
  mergeState.value = null
})

function onTitleInput(e: Event) {
  if (!props.segment) return
  updateSegment(props.segment.id, { title: (e.target as HTMLInputElement).value })
}

function onBeatInput(e: Event) {
  if (!props.segment) return
  updateSegment(props.segment.id, { masterBeat: (e.target as HTMLInputElement).value })
}

function onFrameUpdate(second: number, field: keyof TimelineFrame, value: string) {
  if (!props.segment) return
  activeSecond.value = second
  updateTimelineFrame(props.segment.id, second, field, value)
}

function handleCompile() {
  if (!props.segment) return
  executionEngine.recompile(props.segment)
  emit('compile')
}

// AI 建议采纳
function onAiApply(suggestion: OptimizationSuggestion) {
  if (!props.segment) return
  const timeline = [...props.segment.timeline]
  const frame = { ...timeline[suggestion.second] }

  if (suggestion.type === 'camera') {
    frame.camera = suggestion.suggestedState
  } else if (suggestion.type === 'emotion') {
    frame.emotion = suggestion.suggestedState
  } else if (suggestion.type === 'visual') {
    frame.visual = frame.visual || suggestion.suggestedState
  }

  timeline[suggestion.second] = frame
  updateSegment(props.segment.id, { timeline })
}

function applyMerge() {
  if (!mergeState.value || !props.segment) return
  updateSegment(props.segment.id, { timeline: mergeState.value.mergedVersion })
  mergeState.value = null
}

/** 将当前 Segment 映射到视频编辑器 */
function mapSegmentToEditor() {
  if (!props.segment) return
  const seg = props.segment
  const input: SegmentBridgeInput = {
    id: seg.id,
    title: seg.title || '未命名片段',
    duration: seg.duration || 10,
    timeline: seg.timeline || [],
    characters: seg.characters || [],
    scenes: seg.scenes || [],
    subtitles: (seg.timeline || []).filter(f => f.visual).map((f, i) => ({
      time: f.second,
      text: f.visual,
      duration: 2,
    })),
  }

  const result = segmentToTracks(input)
  const editor = useVideoEditor()

  // 清空并加载
  editor.reset()
  result.tracks.forEach((track) => {
    editor.addTrack(track.type, track.label)
    const lastTrack = editor.state.tracks[editor.state.tracks.length - 1]
    lastTrack.transitions = track.transitions
    lastTrack.subtitles = track.subtitles
    lastTrack.clips.splice(0, lastTrack.clips.length, ...track.clips)
  })
  editor.state.timeline.duration = result.duration

  console.group('🎬 Segment 映射日志')
  result.log.forEach(l => console.log(l))
  console.groupEnd()

  // 打开编辑器
  window.dispatchEvent(new CustomEvent('open-video-editor', {}))
}
</script>

<style scoped>
.segment-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a28;
}
.editor-title-area { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.editor-title {
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 600;
  color: #e5e7eb;
  padding: 0;
  outline: none;
  font-family: inherit;
}
.editor-title::placeholder { color: #4b5563; }
.editor-beat {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #9ca3af;
  padding: 0;
  outline: none;
  font-family: inherit;
}
.editor-beat::placeholder { color: #4b5563; }
.editor-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #6b7280;
  white-space: nowrap;
  align-items: center;
}
.btn-compile {
  background: #0f3a3a;
  border: 1px solid #1a4a4a;
  color: #10b981;
  font-size: 10px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-left: 8px;
}
.btn-compile:hover { background: #144a4a; }

.editor-split {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  overflow: hidden;
}
.editor-left {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #1a1a28;
}
.editor-right {
  overflow-y: auto;
  background: #0a0a10;
}

.editor-mode-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: #0a0a10;
  border-bottom: 1px solid #1a1a28;
}
.mode-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
.btn-merge {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  color: #fbbf24;
  font-size: 9px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-merge:hover { background: #222233; }

.editor-footer {
  padding: 12px 20px;
  border-top: 1px solid #1a1a28;
}
.btn-back {
  background: none;
  border: 1px solid #1a1a28;
  color: #9ca3af;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-back:hover { background: #1a1a28; }

.btn-map {
  background: linear-gradient(135deg, #7c3aed, #ec4899);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-map:disabled { opacity: 0.4; cursor: default; }
.btn-map:hover:not(:disabled) { opacity: 0.85; }

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
