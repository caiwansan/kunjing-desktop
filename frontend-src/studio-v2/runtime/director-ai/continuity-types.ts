// Continuity Runtime — 全局一致性类型定义
// 跨 Segment 校验连续性

import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'

// ─── 校验报告 ───

export interface ContinuityReport {
  segmentId: string
  timestamp: string
  overallScore: number
  violations: ContinuityViolation[]
  scores: {
    sceneContinuity: number
    characterConsistency: number
    cameraStyleConsistency: number
    emotionFlowStability: number
  }
}

// ─── 违规类型 ───

export interface ContinuityViolation {
  type: 'scene_jump' | 'character_drift' | 'camera_inconsistency' | 'emotion_break'
  severity: 'minor' | 'major' | 'critical'
  description: string
  second?: number
  involvedSegments?: string[]
  fixSuggestion: string
}

// ─── 修正计划 ───

export interface CorrectionPlan {
  segmentId: string
  corrections: Correction[]
  expectedScoreImprovement: number
}

export interface Correction {
  type: 'scene' | 'character' | 'camera' | 'emotion'
  action: 'fill' | 'replace' | 'merge' | 'propagate'
  targetSecond: number
  currentValue: string
  suggestedValue: string
  confidence: number
}

// ─── Continuity Graph — 跨段结构映射 ───

export interface ContinuityGraph {
  sceneContinuityMap: Map<string, string[]>        // sceneId → connected sceneIds
  characterConsistencyMap: Map<string, string[]>   // charId → segments wearing same outfit
  cameraStyleMap: Map<string, string>              // segmentId → dominant camera style
  emotionFlowMap: Map<string, string>              // segmentId → dominant emotion
}

// ─── Continuity Engine 接口 ───

export interface ContinuityEngine {
  validate(
    segment: SegmentRuntime,
    allSegments: SegmentRuntime[]
  ): ContinuityReport
  fixViolations(report: ContinuityReport, segment: SegmentRuntime): CorrectionPlan
}
