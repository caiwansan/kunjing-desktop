// ════════════════════════════════════════════════════════════════════
// Director Engine — 聚合评分 + 建议生成 + 跨段检测
// ════════════════════════════════════════════════════════════════════

import { DIRECTOR_RULES } from './rules'
import type {
  DirectorRule, DirectorSegmentInput, SegmentScore,
  DirectorSuggestion, FrameHint,
} from './types'

export interface SegmentWithContext {
  segIndex: number
  segmentId: string
  input: DirectorSegmentInput
}

// ── 计算单个 Segment 的评分（按规则聚合） ──
export function computeSegmentScore(input: DirectorSegmentInput, charCount: number): SegmentScore {
  let emotion = 0, camera = 0, continuity = 0, pacing = 0
  let emotionN = 0, cameraN = 0, continuityN = 0, pacingN = 0

  for (const rule of DIRECTOR_RULES) {
    const s = rule.evaluate(input)
    if (rule.type === 'emotion') { emotion += s.emotion; emotionN++ }
    if (rule.type === 'camera') { camera += s.camera; cameraN++ }
    if (rule.type === 'continuity') { continuity += s.continuity; continuityN++ }
    if (rule.type === 'pacing') { pacing += s.pacing; pacingN++ }
  }

  // 基础分 + 规则聚合 + charCount 修正
  emotion = Math.round(Math.max(20, (emotionN > 0 ? (emotion / emotionN) * 0.7 : 50)))
  camera = Math.round(Math.max(20, (cameraN > 0 ? (camera / cameraN) : 50)))
  continuity = Math.round(Math.max(20, (continuityN > 0 ? (continuity / continuityN) : 70) - (charCount > 4 ? 15 : 0) + (charCount <= 2 ? 10 : 0)))
  pacing = Math.round(Math.max(20, (pacingN > 0 ? (pacing / pacingN) : 50)))

  const overall = Math.round((emotion + camera + continuity + pacing) / 4)
  return { emotion, camera, continuity, pacing, overall }
}

// ── 生成建议（按规则 + 跨段检测） ──
export function generateSuggestions(
  segments: SegmentWithContext[],
  charCount: number,
): DirectorSuggestion[] {
  const all: DirectorSuggestion[] = []

  for (const seg of segments) {
    for (const rule of DIRECTOR_RULES) {
      // ContinuityMismatchRule 需要跨段上下文
      if (rule.id === 'continuity-crossover-001') {
        if (seg.segIndex <= 0 || charCount <= 1) continue
        const prev = segments[seg.segIndex - 1]
        if (!prev) continue
        const prevInput = prev.input
        const currentInput = seg.input
        const mismatches: string[] = []
        if (currentInput.shotSize !== prevInput.shotSize) {
          mismatches.push(`镜头从"${prevInput.shotSize}"切换为"${currentInput.shotSize}"`)
        }
        if (currentInput.lighting !== prevInput.lighting) {
          mismatches.push(`光照从"${prevInput.lighting}"改为"${currentInput.lighting}"`)
        }
        if (mismatches.length > 0) {
          all.push({
            type: 'continuity',
            level: mismatches.length >= 2 ? 'warning' : 'info',
            ruleId: 'continuity-crossover-001',
            confidence: 0.7 + mismatches.length * 0.1,
            message: mismatches.join('，') + '，注意视觉断层',
            segmentId: seg.segmentId,
            apply: (store, segIndex) => {
              const s = (store as any).segments?.[segIndex]?.editable
              const p = (store as any).segments?.[segIndex - 1]?.editable
              if (s && p) { s.shotSize = p.shotSize; s.lighting = p.lighting }
              const frames = (store as any)?.state?.runtimeFrames
              if (frames) {
                // 简单同步：统一为 prev 的 shotSize 和 lighting
                for (const f of frames) {
                  if (f.camera) f.camera.shotSize = p.shotSize
                  if (f.lighting) f.lighting.keyLight = p.lighting
                }
                if (typeof (store as any).persist === 'function') (store as any).persist()
              }
            },
          })
        }
        continue
      }

      // 普通规则
      const suggestions = rule.generate(seg.input, seg.segmentId)
      all.push(...suggestions)
    }
  }

  return all
}

// ── Score 级别颜色辅助 ──
export function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

export function scoreBgColor(score: number): string {
  if (score >= 70) return 'bg-emerald-700/60'
  if (score >= 50) return 'bg-amber-700/60'
  return 'bg-red-800/60'
}

// ── Suggestion 级别颜色 ──
export function suggestionColor(level: string): string {
  switch (level) {
    case 'critical': return 'text-red-500 border-red-900/30'
    case 'warning': return 'text-amber-400 border-amber-900/30'
    default: return 'text-cyan-400 border-cyan-900/20'
  }
}
