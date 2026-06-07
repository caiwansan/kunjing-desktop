<template>
  <div class="director-workspace">
    <div class="workspace-toolbar">
      <div class="toolbar-title">AI 导演工作区</div>
      <div class="toolbar-actions">
        <button v-if="!editing && segments.length > 0" class="btn-primary" @click="analyzeDirector">
          🤖 Analyze AI Director
        </button>
        <button v-if="!editing && segments.length > 0" class="btn-compile" @click="compileAll">
          ⚙ 编译 Segment
        </button>
        <button v-if="!editing && segments.length > 0" class="btn-bridge" @click="sendToEditor">
          🎬 发送到编辑器
        </button>
        <button v-if="!editing" class="btn-add" @click="addSegment">+ 新建片段</button>
      </div>
    </div>

    <div class="director-body">
      <!-- 非编辑态：卡片网格 + Prompt 预览 -->
      <div v-if="!editing" class="card-list-mode">
        <div class="split-layout">
          <div class="split-left">
            <SegmentCardGrid
              :segments="segments"
              :active-index="activeIndex"
              @select="startEditing"
              @add="addSegment"
              @remove="removeSegment"
            />
          </div>
          <div class="split-right">
            <PromptPreviewPanel :runtime="currentPrompt" />
          </div>
        </div>
      </div>

      <!-- 编辑态 -->
      <div v-else class="editor-mode">
        <SegmentEditor
          :segment="activeSegment"
          @back="stopEditing"
          @compile="compileAndShow"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SegmentCardGrid from './SegmentCardGrid.vue'
import SegmentEditor from './SegmentEditor.vue'
import PromptPreviewPanel from '~/studio-v2/runtime/execution/PromptPreviewPanel.vue'
import { useSegmentRuntime } from './useSegmentRuntime'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import { executionEngine } from '~/studio-v2/runtime/execution/ExecutionEngine'
import { promptRuntimeStore } from '~/studio-v2/runtime/execution/PromptRuntime'
import { directorAgent } from '~/studio-v2/runtime/director-ai/DirectorAgent'
import { useVideoEditor } from '~/studio-v2/workspace/video-editor/useVideoEditor'
import { createEditorStateFromSegments } from '~/studio-v2/workspace/video-editor/director-bridge'
import type { SegmentBridgeInput } from '~/studio-v2/workspace/video-editor/director-bridge'

const { segments, count, activeIndex, activeSegment, addSegment, removeSegment } = useSegmentRuntime()
const { state, setActiveSegment, compiledPromptSegments, setCompiledPromptSegments } = useStudioStore()

const editing = computed(() => activeIndex.value >= 0)

// 当前选中的 PromptRuntime
const currentPrompt = computed(() => {
  const activeIdx = activeIndex.value
  const segs = segments.value
  if (activeIdx < 0 || activeIdx >= segs.length) return null
  const seg = segs[activeIdx]
  if (!seg || !seg.id) return null
  return promptRuntimeStore.get(seg.id) || null
})

function startEditing(idx: number) {
  setActiveSegment(idx)
}

function stopEditing() {
  setActiveSegment(-1)
}

function compileAll() {
  // Phase 5: 编译时传入 GraphHints
  const runtimes = segments.value.map(seg => {
    const hints = directorAgent.getGraphHints(
      seg, segments.value, state.workspace.scenes
    )
    return executionEngine.compile(seg, { graphHints: hints })
  })
  setCompiledPromptSegments(runtimes)
}

function compileAndShow() {
  if (activeSegment.value) {
    const hints = directorAgent.getGraphHints(
      activeSegment.value, segments.value, state.workspace.scenes
    )
    executionEngine.recompile(activeSegment.value, { graphHints: hints })
  }
}

async function analyzeDirector() {
  const segs = segments.value
  for (const seg of segs) {
    const hints = directorAgent.getGraphHints(
      seg, segs, state.workspace.scenes
    )
    executionEngine.compile(seg, { graphHints: hints })
  }
  compileAll()
}

/** 发送当前所有 Segment 到视频编辑器 */
function sendToEditor() {
  const segs = segments.value
  if (segs.length === 0) return

  // 转换为桥接输入
  const bridgeInputs: SegmentBridgeInput[] = segs.map(seg => ({
    id: seg.id,
    title: seg.title || '未命名片段',
    duration: seg.duration || 10,
    timeline: seg.timeline || [],
    characters: seg.characters || [],
    scenes: seg.scenes || [],
    transitionHint: '',
    subtitles: seg.timeline?.filter(f => f.visual).map((f, i) => ({
      time: f.second,
      text: f.visual,
      duration: 2,
    })) || [],
  }))

  // 映射到编辑器轨道
  const result = createEditorStateFromSegments(bridgeInputs)
  const editor = useVideoEditor()

  // 清空现有轨道 + 覆盖
  editor.reset()
  result.tracks.forEach((track, i) => {
    editor.addTrack(track.type, track.label)
    const lastTrack = editor.state.tracks[editor.state.tracks.length - 1]
    lastTrack.transitions = track.transitions
    lastTrack.subtitles = track.subtitles
    lastTrack.bookmarks = track.bookmarks
    // 复制 clips
    lastTrack.clips.splice(0, lastTrack.clips.length, ...track.clips)
  })

  editor.state.timeline.duration = result.duration
  editor.state.bookmarks = []

  // 打印日志
  console.group('🎬 AI → 编辑器映射日志')
  result.log.forEach(l => console.log(l))
  console.groupEnd()

  // 切换 UI 到编辑器模式
  // 通过全局事件通知父布局打开编辑器
  window.dispatchEvent(new CustomEvent('open-video-editor', {}))
}
</script>

<style scoped>
.director-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a28;
}
.toolbar-title { font-size: 13px; font-weight: 600; color: #d1d5db; }
.toolbar-actions { display: flex; gap: 8px; }
.btn-add {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  color: #9ca3af;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-add:hover { background: #222233; }
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:disabled { opacity: 0.4; cursor: default; }
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-compile {
  background: #0f3a3a;
  border: 1px solid #1a4a4a;
  color: #10b981;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-compile:hover { background: #144a4a; }
.btn-bridge {
  background: linear-gradient(135deg, #7c3aed, #ec4899);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-bridge:hover { opacity: 0.85; }

.director-body {
  flex: 1;
  overflow: hidden;
}
.card-list-mode, .editor-mode {
  height: 100%;
}
.editor-mode { overflow: hidden; }

.split-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  height: 100%;
  overflow: hidden;
}
.split-left {
  overflow-y: auto;
  border-right: 1px solid #1a1a28;
}
.split-right {
  overflow-y: auto;
  background: #0a0a10;
}
</style>
