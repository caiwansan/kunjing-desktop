// Narrative Runtime — 剧本分析工作区状态管理
// 数据来自 useStudioStore，不做 AI 调用

import { computed } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

function emptyNarrative() {
  return { script: '', title: '', projectName: '', projectDesc: '', characters: [], scenes: [], emotionCurve: [], beats: [], props: [], voices: [], videoSegments: [], dialogues: [], actions: [], effects: [], emotionSpecs: [] }
}

export function useNarrativeRuntime() {
  const { state } = useStudioStore()

  const narrative = computed(() => state.workspace?.narrative || emptyNarrative())
  const hasScript = computed(() => (narrative.value?.script || '').trim().length > 0)
  const characterCount = computed(() => (narrative.value?.characters || []).length)
  const sceneCount = computed(() => (narrative.value?.scenes || []).length)
  const beatCount = computed(() => (narrative.value?.beats || []).length)

  return {
    narrative,
    hasScript,
    characterCount,
    sceneCount,
    beatCount,
  }
}
