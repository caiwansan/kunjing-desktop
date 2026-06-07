// Script Analysis 内部类型
// 维护性辅助类型，核心类型在 runtime/index.ts

import type { NarrativeRuntime } from '~/studio-v2/types/runtime/index'

// 创建空的 NarrativeRuntime
export function createEmptyNarrative(): NarrativeRuntime {
  return {
    script: '',
    title: '',
    projectName: '',
    projectDesc: '',
    characters: [],
    scenes: [],
    emotionCurve: [],
    beats: [],
    props: [],
    voices: [],
    videoSegments: [],
    dialogues: [],
    actions: [],
    effects: [],
    emotionSpecs: [],
    videoStyle: 'realistic',
    visualStyle: '',
    aspectRatio: '9:16',
    styleLocked: false,
  }
}
