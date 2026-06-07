// ════════════════════════════════════════════════════════════════════
// Director Rules — 可扩展导演评估规则集
// 每条 Rule 独立计算 + 独立生成建议
// 新增规则 → 在 rules 数组注册即可
// ════════════════════════════════════════════════════════════════════

import type { DirectorRule, DirectorSegmentInput, SegmentScore, DirectorSuggestion } from './types'

// ── 工具函数 ──
function emotionVariance(emotion: Record<string, number>): number {
  const vals = Object.values(emotion)
  if (vals.length === 0) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
}

// ────────────────────────────────────────────────────────────────────
// Rule 1: Static Camera — 纯静态镜头缺乏动感
// ────────────────────────────────────────────────────────────────────
const StaticCameraRule: DirectorRule = {
  id: 'camera-static-001',
  type: 'camera',
  level: 'info',
  name: 'Static Camera Detector',
  description: '检测纯静态镜头——无移动无抖动',
  evaluate(input) {
    const score = input.cameraMove !== 'static' || input.shake > 5 ? 80 : 30
    return { emotion: 0, camera: score, continuity: 0, pacing: 0, overall: score }
  },
  generate(input, segmentId): DirectorSuggestion[] {
    if (input.cameraMove !== 'static' && input.shake > 5) return []
    if (input.cameraMove === 'static' && input.shake === 0) {
      return [{
        type: 'camera', level: 'info', ruleId: this.id, confidence: 0.75,
        message: '当前为纯静态镜头，建议在情绪上升段加入推镜或手持抖动',
        segmentId,
        apply: (store, segIndex) => {
          const seg = (store as any).segments?.[segIndex]?.editable
          if (seg) { seg.cameraMove = 'push'; seg.shake = 20 }
          patchRuntimeFrames(store, (f: any) => { if (f.camera) { f.camera.cameraMove = 'push'; f.camera.shake = 20 } })
        },
      }]
    }
    return []
  },
}

// ────────────────────────────────────────────────────────────────────
// Rule 2: High Shake — 抖动值过高
// ────────────────────────────────────────────────────────────────────
const HighShakeRule: DirectorRule = {
  id: 'camera-shake-001',
  type: 'camera',
  level: 'warning',
  name: 'Excessive Shake Detector',
  description: '检测过高手持抖动值（>70）',
  evaluate(input) {
    const score = input.shake <= 70 ? 80 : Math.max(10, 100 - input.shake)
    return { emotion: 0, camera: score, continuity: 0, pacing: 0, overall: score }
  },
  generate(input, segmentId): DirectorSuggestion[] {
    if (input.shake <= 70) return []
    return [{
      type: 'camera', level: 'warning', ruleId: this.id, confidence: 0.85,
      message: `抖动值(${input.shake})过高(>70)，建议降低至 20–40`,
      segmentId,
      apply: (store, segIndex) => {
        const seg = (store as any).segments?.[segIndex]?.editable
        if (seg) seg.shake = 30
        patchRuntimeFrames(store, (f: any) => { if (f.camera) f.camera.shake = 30 })
      },
    }]
  },
}

// ────────────────────────────────────────────────────────────────────
// Rule 3: Emotion Flat — 情绪曲线平坦
// ────────────────────────────────────────────────────────────────────
const EmotionFlatRule: DirectorRule = {
  id: 'emotion-flat-001',
  type: 'emotion',
  level: 'info',
  name: 'Emotion Flatness Detector',
  description: '检测情绪曲线方差过低（< 20）',
  evaluate(input) {
    const v = emotionVariance(input.emotion)
    const score = v < 20 ? 30 : v > 200 ? 90 : 60 + Math.min(30, v / 10)
    return { emotion: Math.round(score), camera: 0, continuity: 0, pacing: 0, overall: Math.round(score) }
  },
  generate(input, segmentId): DirectorSuggestion[] {
    const max = Math.max(...Object.values(input.emotion))
    const min = Math.min(...Object.values(input.emotion))
    if (max - min >= 20) return []
    return [{
      type: 'emotion', level: 'info', ruleId: this.id, confidence: 0.7,
      message: `情绪曲线过于平坦(range=${max - min})，建议增加极端差值增强戏剧效果`,
      segmentId,
      apply: (store, segIndex) => {
        const seg = (store as any).segments?.[segIndex]?.editable
        if (seg) { seg.emotion.stress = Math.min(100, seg.emotion.stress + 25); seg.emotion.confidence = Math.max(0, seg.emotion.confidence - 20) }
        patchRuntimeFrames(store, () => {})
      },
    }]
  },
}

// ────────────────────────────────────────────────────────────────────
// Rule 4: Continuity Mismatch — 跨段连续性警告
// ────────────────────────────────────────────────────────────────────
const ContinuityMismatchRule: DirectorRule = {
  id: 'continuity-crossover-001',
  type: 'continuity',
  level: 'warning',
  name: 'Continuity Cross-Segment Mismatch',
  description: '检测相邻段之间的镜头/光照突然切换',
  evaluate(_input) {
    // 跨段检测在 generate 中处理
    return { emotion: 0, camera: 0, continuity: 80, pacing: 0, overall: 80 }
  },
  generate(input, segmentId): DirectorSuggestion[] {
    // 跨段检测需要上下文，这里返回空，在 engine 层补充
    return []
  },
}

// ────────────────────────────────────────────────────────────────────
// Rule 5: Pacing Void — 节奏空洞
// ────────────────────────────────────────────────────────────────────
const PacingVoidRule: DirectorRule = {
  id: 'pacing-void-001',
  type: 'pacing',
  level: 'info',
  name: 'Pacing Void Detector',
  description: '检测低情绪 + 静态镜头 = 节奏空洞',
  evaluate(input) {
    const lowEnergy = input.emotion.stress < 20 && input.emotion.anger < 20
    const isStatic = input.cameraMove === 'static'
    const score = lowEnergy && isStatic ? 25 : 75
    return { emotion: 0, camera: 0, continuity: 0, pacing: score, overall: score }
  },
  generate(input, segmentId): DirectorSuggestion[] {
    if (!(input.emotion.stress < 20 && input.emotion.anger < 20 && input.cameraMove === 'static')) return []
    return [{
      type: 'pacing', level: 'info', ruleId: this.id, confidence: 0.65,
      message: '当前段缺乏节奏变化（低情绪+静态），建议缩短时长或增加运镜',
      segmentId,
      apply: () => { /* pacing 涉及时长调整需手动操作 */ },
    }]
  },
}

// ────────────────────────────────────────────────────────────────────
// 规则注册表（新增规则在此注册即可）
// ────────────────────────────────────────────────────────────────────
export const DIRECTOR_RULES: DirectorRule[] = [
  StaticCameraRule,
  HighShakeRule,
  EmotionFlatRule,
  ContinuityMismatchRule,
  PacingVoidRule,
]

// ── Patch RuntimeFrameState 工具 ──
function patchRuntimeFrames(store: any, fn: (frame: any) => void) {
  if (!store?.state?.runtimeFrames) return
  for (const f of store.state.runtimeFrames) {
    try { fn(f) } catch {}
  }
  // 触发持久化（如果有 persist）
  if (typeof store.persist === 'function') store.persist()
}
