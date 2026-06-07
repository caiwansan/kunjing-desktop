// Director AI Layer — 类型定义
// AI 建议层数据结构，不涉及任何 AI 调用

import type { TimelineFrame } from '~/studio-v2/types/runtime/index'

// ─── AI 分析结果 ───

export interface AIAnalysisResult {
  segmentId: string
  pacingScore: number           // 0-1 节奏评分
  emotionClarity: number        // 0-1 情绪清晰度
  visualDensity: number         // 0-1 画面密度
  continuityIssues: string[]    // 连续性警告
  suggestions: OptimizationSuggestion[]
}

// ─── 镜头优化建议 ───

export interface CameraPlan {
  second: number
  suggestedCamera: string       // 建议运镜
  reason: string                // 理由
  confidence: number            // 0-1
}

// ─── 情绪优化建议 ───

export interface EmotionPlan {
  second: number
  suggestedEmotion: string
  reason: string
  confidence: number
}

// ─── 节奏调整建议 ───

export interface PacingSuggestion {
  frameChanges: {
    second: number
    action: 'lengthen' | 'shorten' | 'split'
    reason: string
  }[]
}

// ─── 资产绑定建议 ───

export interface AssetBinding {
  second: number
  type: 'character' | 'scene' | 'prop'
  assetId: string
  assetName: string
  confidence: number
}

export interface AssetSuggestion {
  type: 'character' | 'scene' | 'prop' | 'music'
  reason: string
  confidence: number
  matchKey: string
}

// ─── 统一优化建议 ───

export interface OptimizationSuggestion {
  id: string
  type: 'camera' | 'emotion' | 'pacing' | 'asset' | 'visual' | 'continuity'
  second: number
  title: string
  description: string
  currentState: string
  suggestedState: string
  confidence: number
  applied: boolean
}

// ─── 分段优化结果 ───

export interface SegmentOptimization {
  segmentId: string
  cameraPlans: CameraPlan[]
  emotionPlans: EmotionPlan[]
  pacing: PacingSuggestion
  assetBindings: AssetBinding[]
  suggestions: OptimizationSuggestion[]
}

// ─── 人机协作状态 ───

export interface HumanAIMergeState {
  humanVersion: TimelineFrame[]
  aiVersion: TimelineFrame[]
  mergedVersion: TimelineFrame[]
  mergeDecisions: {
    frame: number
    field: string
    source: 'human' | 'ai' | 'merged'
  }[]
}
