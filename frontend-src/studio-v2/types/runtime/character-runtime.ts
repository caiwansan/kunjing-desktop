// ============================================================
// CharacterRuntime — 角色圣经运行时
// ============================================================

export interface CharacterRuntime {
  id: string
  name: string
  description: string
  personality: string
  costume: string
  expressionSet: string[]
  visualRef: string
  locked: boolean
  voiceRef: string
  relationships: { targetId: string; relation: string }[]

  // Phase 7A — 新增字段（原本只通过 as any 访问）
  gender?: string
  age?: string
  imagePrompt?: string
  negativePrompt?: string
  imageUrl?: string
  physicalDescription?: string
  clothing?: string

  // Phase 7B — 角色图标准维度
  faceFeatures?: string    // 面部五官
  expressionEyes?: string  // 表情眼神
  bodyPosture?: string     // 身体姿态
  bodyShape?: string       // 体型轮廓
  lighting?: string        // 光影光线
  background?: string      // 背景环境
  eraStyle?: string        // 时代风格
  styleKeywords?: string   // 风格关键词
  props?: string           // 手持道具
}

export function createEmptyCharacter(seed?: Partial<CharacterRuntime>): CharacterRuntime {
  return {
    id: `char_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    description: '',
    personality: '',
    costume: '',
    expressionSet: [],
    visualRef: '',
    locked: false,
    voiceRef: '',
    relationships: [],
    gender: '',
    age: '',
    imagePrompt: '',
    negativePrompt: '',
    imageUrl: '',
    ...seed,
  }
}
