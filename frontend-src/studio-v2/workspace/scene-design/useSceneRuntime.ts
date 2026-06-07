// Scene Bible Runtime — 场景资产工作区状态管理

import { computed } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

export function useSceneRuntime() {
  const { state } = useStudioStore()

  const scenes = computed(() => state.workspace.scenes)
  const count = computed(() => scenes.value.length)

  function getScene(id: string) {
    return scenes.value.find(s => s.id === id)
  }

  return {
    scenes,
    count,
    getScene,
  }
}
