// ============================================================
// Runtime Object Model — AI Film Production OS v2
// 核心数据结构，所有模块共享的类型定义
// — Re-exports from atomic type files
// ============================================================

export * from './character-runtime'
export * from './scene-runtime'
export * from './segment-runtime'
export * from './asset-runtime'
export * from './snapshot-runtime'
import type { VideoSegment, BreakdownDialogue, BreakdownAction } from '../script-breakdown'

// ─── Pipeline ───
//
// ⚠️ 未来应统一从 shared/pipeline-definition 导入 PipelineStageId
// 当前保留本地定义以避免全量重构。
// 新增 stage 时必须在 shared/pipeline-definition.ts 和此处同时添加。

export type PipelineStageId =
  | 'script-analysis'
  | 'character-design'
  | 'scene-design'
  | 'props-design'
  | 'video-generation'
  | 'dubbing-render'
  | 'voice-generation'
  | 'music-generation'
  | 'video-editor'

export type StageStatus = 'idle' | 'running' | 'completed' | 'error'

export interface PipelineStage {
  id: PipelineStageId
  title: string
  icon: string
  status: StageStatus
  progress: number
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface PipelineRuntime {
  stages: PipelineStage[]
  activeStageId: PipelineStageId
}

// ─── Narrative Runtime (Script Analysis) ───

export interface NarrativeBeat {
  id: string
  label: string
  startSecond: number
  endSecond: number
  emotion: string
  intensity: number
  summary: string
  cinematicAdaptation?: string  // 镜头语言改编版
}

export interface EmotionPoint {
  second: number
  emotion: string
  intensity: number
}

export interface CharacterRef {
  id: string
  name: string
  role: string
  description: string
}

export interface SceneRef {
  id: string
  name: string
  environment: string
  mood: string
  timeOfDay: string
}

export interface PropRef {
  id: string
  name: string
  category: string
  description: string
  imageUrl?: string
}

export interface VoiceRef {
  id: string
  characterName: string
  voiceType: string
  pitch: number
  speed: number
  description: string
}

export interface EffectSpec {
  effectName: string
  effectType?: string
  description?: string
  notes?: string
  duration?: number
  intensity?: string | number
  colorPalette?: string
  triggerScene?: string
  triggerEvent?: string
}

export interface EmotionSpec {
  segmentIndex?: number
  segmentName?: string
  emotion: string
  intensity?: string
  expression?: string
  microExpression?: string
  description?: string
}

export interface NarrativeRuntime {
  script: string
  title: string
  projectName: string
  projectDesc: string
  characters: CharacterRef[]
  scenes: SceneRef[]
  emotionCurve: EmotionPoint[]
  beats: NarrativeBeat[]
  props: PropRef[]
  voices: VoiceRef[]
  videoStyle: string    // 视频风格预设: realistic | anime | 3d | clay | pixel | ink
  visualStyle: string   // 视觉风格: 电影写实 / 动画 / 水墨 / 赛博朋克 / 国潮 / 油画 / 漫画 / 游戏CG
  aspectRatio: string   // 画面比例: 16:9 | 9:16 | 1:1 | 4:3
  styleLocked?: boolean // 风格锁定开关：true 后所有卡片风格跟随全局
  // ── Narrative Compiler v2 fields ──
  videoSegments?: VideoSegment[]
  dialogues?: BreakdownDialogue[]
  actions?: BreakdownAction[]
  effects?: EffectSpec[]          // 特效音效规范
  emotionSpecs?: EmotionSpec[]     // 情绪/微表情规范
}

// ─── Workspace ───

export type WorkspaceId = PipelineStageId

export interface StoryboardImage {
  id: string
  segmentId: string
  imageUrl: string
  prompt?: string
  negativePrompt?: string
  createdAt?: string
}

export interface WorkspaceRuntime {
  activeWorkspaceId: WorkspaceId
  narrative: NarrativeRuntime
  characters: CharacterRuntime[]
  scenes: SceneRuntime[]
  segments: SegmentRuntime[]
  storyboardImages: StoryboardImage[]
}
