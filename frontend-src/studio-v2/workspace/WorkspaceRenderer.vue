<template>
  <main class="workspace-area">
    <!-- Script Analysis -->
    <ScriptAnalysisWorkspace v-if="workspaceId === 'script-analysis'" />

    <!-- Character Design -->
    <CharacterWorkspace v-else-if="workspaceId === 'character-design'" />

    <!-- Scene Design -->
    <SceneWorkspace v-else-if="workspaceId === 'scene-design'" />

    <!-- Props Design -->
    <PropsWorkspace v-else-if="workspaceId === 'props-design'" />

    <!-- Video Generation (AI Director + 视频生成) -->
    <VideoGenerationWorkspace v-else-if="workspaceId === 'video-generation'" />

    <!-- Music Generation (AI 音乐创作) -->
    <MusicGenerationWorkspace v-else-if="workspaceId === 'music-generation'" />

    <!-- Advertisement (广告短视频创作) -->
    <AdvertisementWorkspace v-else-if="workspaceId === 'voice-generation'" />

    <!-- 后续阶段占位 -->
    <div v-else class="placeholder-workspace">
      <div class="placeholder-icon">{{ placeholderIcon }}</div>
      <div class="placeholder-title">{{ stageTitle }}</div>
      <div class="placeholder-desc">{{ stageDescription }}</div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { WorkspaceId } from '~/studio-v2/types/runtime/index'
import ScriptAnalysisWorkspace from '~/studio-v2/workspace/script-analysis/ScriptAnalysisWorkspace.vue'
import CharacterWorkspace from '~/studio-v2/workspace/character-design/CharacterWorkspace.vue'
import SceneWorkspace from '~/studio-v2/workspace/scene-design/SceneWorkspace.vue'
import PropsWorkspace from '~/studio-v2/workspace/props-design/PropsWorkspace.vue'
import VideoGenerationWorkspace from '~/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue'
import MusicGenerationWorkspace from '~/studio-v2/workspace/music-generation/MusicGenerationWorkspace.vue'
import AdvertisementWorkspace from '~/studio-v2/workspace/advertisement/AdvertisementWorkspace.vue'

const props = defineProps<{
  workspaceId: WorkspaceId
}>()

const stageTitles: Record<string, string> = {
  'video-generation': '视频生成',
  'voice-generation': '广告创作',
  'music-generation': '音乐生成',
  'final-render': '合成输出',
}

const stageDescriptions: Record<string, string> = {
  'video-generation': '逐段生成 AI 视频',
  'voice-generation': 'AI 广告短视频创作',
  'music-generation': '生成背景音乐',
  'final-render': '合成最终影片',
}

const stageIcons: Record<string, string> = {
  'video-generation': '🎥',
  'voice-generation': '📺',
  'music-generation': '🎵',
  'final-render': '✨',
}

import { computed } from 'vue'
const stageTitle = computed(() => stageTitles[workspaceIdToStr(props.workspaceId)] || props.workspaceId)
const placeholderIcon = computed(() => stageIcons[workspaceIdToStr(props.workspaceId)] || '🔲')
const stageDescription = computed(() => stageDescriptions[workspaceIdToStr(props.workspaceId)] || '')

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function workspaceIdToStr(id: WorkspaceId): string { return id }
</script>

<style scoped>
.workspace-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}
.placeholder-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.placeholder-icon { font-size: 40px; opacity: 0.15; }
.placeholder-title { font-size: 16px; color: #6b7280; font-weight: 500; }
.placeholder-desc { font-size: 11px; color: #4b5563; max-width: 280px; text-align: center; }
</style>
