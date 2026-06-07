// Graph Runtime — 电影结构建模
// Scene / Emotion / Camera 三层 Graph
// GraphHints 是导演决策系统的核心输入

import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'

// ─── Scene Graph ───

export interface SceneNode {
  id: string
  name: string
  type: 'location' | 'interior' | 'exterior'
  environment: string
  lightSetup: string
  weather: string
  connectedSegments: string[]   // segment ids
}

export interface SceneEdge {
  fromId: string
  toId: string
  type: 'continuation' | 'cut' | 'transition'
}

export interface SceneGraph {
  nodes: SceneNode[]
  edges: SceneEdge[]
  findNode(segmentId: string): SceneNode | null
  getContinuityScore(segmentId: string): number
}

// ─── Emotion Graph ───

export interface EmotionNode {
  id: string
  segmentId: string
  emotion: string
  intensity: number         // 0-100
  startSecond: number
  duration: number
}

export interface EmotionEdge {
  fromId: string
  toId: string
  transitionType: 'smooth' | 'jump' | 'clash'
  confidence: number
}

export interface EmotionWarning {
  type: 'jump_too_large' | 'flat_line' | 'clash'
  segmentId: string
  second: number
  description: string
}

export interface EmotionCurve {
  segments: { second: number; emotion: string; intensity: number }[]
  overallArc: string              // 情绪弧线描述
  warnings: EmotionWarning[]
}

export interface EmotionGraph {
  nodes: EmotionNode[]
  edges: EmotionEdge[]
  detectJumps(): EmotionWarning[]
  smoothCurve(): EmotionCurve
  getContinuityScore(): number
}

// ─── Camera Graph ───

export interface CameraNode {
  id: string
  segmentId: string
  shotType: 'close-up' | 'medium' | 'wide' | 'tracking' | 'handheld' | 'pan' | 'fixed'
  movement: string
  duration: number
  second: number
}

export interface CameraTransition {
  fromId: string
  toId: string
  transitionType: 'cut' | 'fade' | 'dissolve' | 'whip'
  confidence: number
}

export interface CameraFlow {
  nodes: CameraNode[]
  transitions: CameraTransition[]
  flowScore: number
  note: string
}

export interface CameraGraph {
  nodes: CameraNode[]
  generateFlow(): CameraFlow
  optimizeTransitions(): CameraTransition[]
  getFlowScore(): number
}

// ─── 统合 Graph Hints — 导演决策核心输入 ───

export interface GraphHints {
  sceneConsistencyScore: number
  emotionContinuityScore: number
  cameraFlowScore: number
  emotionCurve: EmotionCurve
  cameraFlow: CameraFlow
  sceneContinuityNotes: string[]
  emotionWarnings: EmotionWarning[]
  // Phase 5: 决策级增强
  sceneFixSuggestions: string[]
  emotionFixSuggestions: string[]
  cameraFixSuggestions: string[]
  recommendedSegmentAdjustments: {
    insertFrame?: boolean
    mergeFrame?: boolean
    splitFrame?: boolean
    reason?: string
  }
  // 权重评分（影响 Prompt 编译）
  influenceWeights: {
    sceneWeight: number    // 场景对画面影响权重 0-1
    emotionWeight: number  // 情绪对 pacing 影响权重 0-1
    cameraWeight: number   // 镜头对 Prompt 影响权重 0-1
  }
}

// ─── Graph 分析器接口 ───

export interface GraphAnalyzer {
  buildSceneGraph(): SceneGraph
  buildEmotionGraph(): EmotionGraph
  buildCameraGraph(): CameraGraph
  analyzeSegment(segment: SegmentRuntime): GraphHints
}
