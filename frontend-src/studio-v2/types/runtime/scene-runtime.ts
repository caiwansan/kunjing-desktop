// ============================================================
// SceneRuntime — 场景圣经运行时
// ============================================================

export interface SceneRuntime {
  id: string
  name: string
  environment: string
  lighting: string
  weather: string
  timeOfDay: string
  colorTone: string
  cameraCompatibility: string[]
  locked: boolean

  // Phase 7A — 新增字段（原本只通过 as any 访问）
  imagePrompt?: string
  negativePrompt?: string
  imageUrl?: string
  localImagePrompt?: string
}

export function createEmptyScene(seed?: Partial<SceneRuntime>): SceneRuntime {
  return {
    id: `scene_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    environment: '',
    lighting: '',
    weather: '',
    timeOfDay: '',
    colorTone: '',
    cameraCompatibility: [],
    locked: false,
    imagePrompt: '',
    negativePrompt: '',
    imageUrl: '',
    localImagePrompt: '',
    ...seed,
  }
}
