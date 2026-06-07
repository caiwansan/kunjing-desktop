// Character Bible Runtime — 角色资产工作区状态管理

import { computed } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

export function useCharacterRuntime() {
  const { state } = useStudioStore()

  // ⭐ 全局去重：角色名唯一，同名只保留第一个
  const characters = computed(() => {
    const raw = state.workspace.characters || []
    const seen = new Set<string>()
    const result: typeof raw = []
    for (const ch of raw) {
      const name = (ch.name || '').trim().toLowerCase()
      if (!name || seen.has(name)) continue
      seen.add(name)
      result.push(ch)
    }
    return result
  })

  const count = computed(() => characters.value.length)

  function getCharacter(id: string) {
    return characters.value.find(c => c.id === id)
  }

  return {
    characters,
    count,
    getCharacter,
  }
}
