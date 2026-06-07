// ============================================================
// SegmentRuntime — 导演片段运行时
// ============================================================

export interface TimelineFrame {
  second: number      // 0-based second index
  visual: string      // 画面描述
  camera?: string     // 运镜指令（特写/中景/远景/推/拉/摇/移/跟）
  dialogue?: string   // 该秒的台词（Narrative Compiler v2 新增）
  audio?: string      // 音效
  emotion?: string    // 情绪
  fx?: string         // 特效
  // 分镜选图——用户从素材库自由选择多张角色图和场景图
  selectedCharImages?: string[]    // 选中多张角色图 URL
  selectedSceneImages?: string[]   // 选中多张场景图 URL
}

export interface SegmentRuntime {
  id: string
  title: string
  masterBeat: string  // 本段情绪核心
  duration: number    // 秒数，默认10
  timeline: TimelineFrame[]
  characters: string[]  // 角色ID引用
  scenes: string[]      // 场景ID引用
  emotionCurve?: any[]
  cameraGraph?: any[]
  createdAt: string
  // Phase 5-6: Graph + Continuity 状态（来自 DirectorAgent）
  graphHints?: any
  aiDecisionState?: {
    source: 'human' | 'ai' | 'merged'
    confidence: number
  }
  continuityState?: {
    violations: string[]
    score: number
    corrected: boolean
  }
  // Phase 7A — 新增字段
  runtimeVersion?: number
  updatedAt?: string
  // Phase 7B — 分镜策划字段（来自 Narrative & Visual Compiler v2）
  narrativePurpose?: string
  shotPattern?: string
  emotionArc?: string
  imagePrompt?: string
  negativePrompt?: string
  fullText?: string
  backgroundMusic?: string  // 背景音乐/音效描述
}

export function createEmptySegment(seed?: Partial<SegmentRuntime>): SegmentRuntime {
  return {
    id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    masterBeat: '',
    duration: 10,
    timeline: [],
    characters: [],
    scenes: [],
    createdAt: new Date().toISOString(),
    runtimeVersion: 1,
    updatedAt: new Date().toISOString(),
    ...seed,
  }
}
