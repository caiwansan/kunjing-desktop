// Scene 内部类型 & 工厂函数

import type { SceneRuntime } from '~/studio-v2/types/runtime/index'

export function createEmptyScene(overrides?: Partial<SceneRuntime>): SceneRuntime {
  return {
    id: '',
    name: '',
    environment: '',
    lighting: '',
    weather: '',
    timeOfDay: '',
    colorTone: '',
    cameraCompatibility: [],
    locked: false,
    ...overrides,
  }
}
