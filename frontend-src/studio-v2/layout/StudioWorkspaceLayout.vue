<template>
  <div class="studio-v2-layout">
    <!-- 左栏：Pipeline -->
    <PipelineSidebar
      :stages="state.pipeline.stages"
      :active-stage-id="state.pipeline.activeStageId"
      @select="goToStage"
      @open-video-editor="openVideoEditor"
    />

    <!-- 中栏：Workspace / 视频编辑器 -->
    <VideoEditorWorkspace
      v-if="showVideoEditor"
      @back="closeVideoEditor"
    />
    <WorkspaceRenderer
      v-else
      :workspace-id="state.workspace.activeWorkspaceId"
      :segments="state.workspace.segments"
      class="flex-1"
    />

    <!-- 右栏：Asset OS（仅非编辑器模式显示） -->
    <AssetSidebar
      v-if="!showVideoEditor"
      :assets="filteredAssets"
      :collapsed="state.assets.collapsed"
      :active-category="state.assets.activeCategory"
      @toggle="toggleAssetSidebar"
      @set-category="setAssetCategory"
      @delete-asset="deleteAsset"
      @select-asset="onAssetSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import PipelineSidebar from '~/studio-v2/pipeline/PipelineSidebar.vue'
import WorkspaceRenderer from '~/studio-v2/workspace/WorkspaceRenderer.vue'
import VideoEditorWorkspace from '~/studio-v2/workspace/video-editor/VideoEditorWorkspace.vue'
import AssetSidebar from '~/studio-v2/assets/AssetSidebar.vue'

const showVideoEditor = ref(false)
const { state, goToStage, toggleAssetSidebar, setAssetCategory, filteredAssets, removeAsset } = useStudioStore()

function openVideoEditor() {
  showVideoEditor.value = true
}

function closeVideoEditor() {
  showVideoEditor.value = false
}

function getToken(): string {
  try {
    const getCachedToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return getCachedToken()
  } catch { return '' }
}

function deleteAsset(asset: any) {
  removeAsset(asset.id)
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (asset.dbId && asset.type === 'character') {
    fetch('/api/execution-images/characters/' + asset.dbId, { method: 'DELETE', headers }).catch(() => {})
  } else if (asset.dbId && asset.type === 'scene') {
    fetch('/api/execution-images/scenes/' + asset.dbId, { method: 'DELETE', headers }).catch(() => {})
  }
}

function onAssetSelected(asset: any) {
  if (typeof window.__onAssetPickCallback === 'function') {
    window.__onAssetPickCallback(asset)
  }
}

onMounted(async () => {
  // 监听 AI 导演工作区发来的打开编辑器事件
  window.addEventListener('open-video-editor', () => {
    openVideoEditor()
  })

  const params = new URLSearchParams(window.location.search)
  const projectId = params.get('projectId') || params.get('project')
  if (projectId) {
    const { loadFromServer, setProjectId, goToStage } = useStudioStore()
    setProjectId(projectId)
    loadFromServer(projectId)
    const stage = params.get('stage')
    if (stage) goToStage(stage as any)
  } else {
    try {
      const pid = localStorage.getItem('last_project_id')
      if (pid) {
        const { loadFromServer, setProjectId } = useStudioStore()
        try {
          await loadFromServer(pid)
          setProjectId(pid)
        } catch {
          localStorage.removeItem('last_project_id')
          localStorage.removeItem('pipeline_state')
        }
      }
    } catch { }
  }
})
</script>

<style scoped>
.studio-v2-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
}

.editor-main-area {
  flex: 1;
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.editor-toolbar-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #11151c;
  border-left: 1px solid #1f2937;
  overflow-y: auto;
}

.flex-1 { flex: 1; }
</style>
