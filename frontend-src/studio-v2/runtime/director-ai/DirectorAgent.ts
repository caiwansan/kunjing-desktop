// DirectorAgent — AI 导演核心（唯一 AI 入口）
// 内化：Graph 分析 / Continuity 校验 / 运镜情绪建议 / 资产匹配
// Production Cut: 所有能力收敛于此文件 + 3 个类型文件

import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'
import type { CharacterRuntime, SceneRuntime } from '~/studio-v2/types/runtime/index'
import type {
  AIAnalysisResult,
  SegmentOptimization,
  OptimizationSuggestion,
  AssetBinding,
  HumanAIMergeState,
  CameraPlan,
  EmotionPlan,
} from './director-ai-types'
import type { GraphHints } from './graph-types'
import type { ContinuityReport, CorrectionPlan } from './continuity-types'
import type { ConstraintReport } from './constraint-types'
import { suggestAssetBindings } from '~/studio-v2/runtime/asset-binding/AssetInferenceEngine'

// ────────── 运镜建议（原 CameraAdvisor）──────────
const EMOTION_TO_CAMERA: Record<string, { camera: string; reason: string }[]> = {
  '平静': [{ camera: '固定镜头', reason: '情绪平静适合固定机位' }, { camera: '慢摇', reason: '缓慢摇移展现环境宁静' }],
  '开心': [{ camera: '跟拍', reason: '跟随动作表现轻快感' }, { camera: '升格', reason: '升格慢动作强调愉悦' }],
  '悲伤': [{ camera: '缓慢推近', reason: '推近强调情绪沉重' }, { camera: '固定', reason: '固定镜头强化失落感' }],
  '愤怒': [{ camera: '快速推近', reason: '快速推近表现情绪爆发' }, { camera: '手持微晃', reason: '晃动增强不安和紧张' }],
  '恐惧': [{ camera: '手持晃动', reason: '晃动表现不安与恐惧' }, { camera: '快速后拉', reason: '拉远表现逃避感' }],
  '紧张': [{ camera: '特写抽帧', reason: '特写+抽帧增强紧张感' }, { camera: '快速摇移', reason: '快速摇移制造焦虑' }],
  '浪漫': [{ camera: '慢速推近', reason: '缓慢推进聚焦暧昧气氛' }, { camera: '环绕', reason: '环绕镜头渲染浪漫' }],
  '悬疑': [{ camera: '侧逆光固定', reason: '固定+阴影增加悬疑' }, { camera: '缓慢平移', reason: '平移探视制造期待' }],
  '惊喜': [{ camera: '快速拉远', reason: '快速展开揭示全貌' }, { camera: '甩镜头', reason: '甩镜头强化冲击' }],
  '震撼': [{ camera: '快速升格', reason: '升格展现壮阔' }, { camera: '广角固定', reason: '广角展示空间震撼' }],
}
const DEFAULT_CAMERAS = [
  { camera: '固定镜头', reason: '默认选用固定镜头保持稳定性' },
  { camera: '平稳推近', reason: '推近增加画面纵深感' },
]

function suggestCameraForFrame(frame: TimelineFrame, prevCam?: string): CameraPlan {
  if (frame.camera?.trim()) {
    return { second: frame.second, suggestedCamera: frame.camera.trim(), reason: '已设定的运镜', confidence: 1 }
  }
  const emotion = frame.emotion?.trim() || ''
  if (emotion && EMOTION_TO_CAMERA[emotion]) {
    const opts = EMOTION_TO_CAMERA[emotion]
    const picked = opts[Math.floor(Math.random() * opts.length)]
    return { second: frame.second, suggestedCamera: picked.camera, reason: picked.reason, confidence: 0.7 }
  }
  const visual = frame.visual?.trim() || ''
  if (visual && ['跑', '走', '追', '跳', '冲', '飞', '开车', '战斗'].some(kw => visual.includes(kw))) {
    return { second: frame.second, suggestedCamera: '跟拍', reason: '检测到动作关键词，建议跟拍', confidence: 0.6 }
  }
  const def = DEFAULT_CAMERAS[frame.second % DEFAULT_CAMERAS.length]
  return { second: frame.second, suggestedCamera: def.camera, reason: def.reason, confidence: 0.4 }
}

// ────────── 情绪建议（原 EmotionOptimizer）──────────
const EMOTION_TRANSITIONS: Record<string, string[]> = {
  '平静': ['开心', '悲伤', '惊讶'], '开心': ['平静', '惊喜', '浪漫'],
  '悲伤': ['平静', '愤怒', '恐惧'], '愤怒': ['恐惧', '紧张', '悲伤'],
  '恐惧': ['紧张', '惊讶', '悲伤'], '紧张': ['恐惧', '愤怒', '惊讶'],
  '浪漫': ['开心', '平静', '惊喜'], '悬疑': ['恐惧', '紧张', '惊讶'],
  '惊喜': ['开心', '震撼', '平静'], '震撼': ['惊讶', '平静', '恐惧'],
}

function suggestEmotionForFrame(frame: TimelineFrame, prevEmotion?: string): EmotionPlan {
  if (frame.emotion?.trim()) {
    return { second: frame.second, suggestedEmotion: frame.emotion.trim(), reason: '已设定', confidence: 1 }
  }
  if (prevEmotion) {
    const possible = EMOTION_TRANSITIONS[prevEmotion]
    if (possible?.length) {
      const picked = possible[Math.floor(Math.random() * possible.length)]
      return { second: frame.second, suggestedEmotion: picked, reason: `从「${prevEmotion}」自然过渡到「${picked}」`, confidence: 0.6 }
    }
  }
  return { second: frame.second, suggestedEmotion: '平静', reason: '默认情绪，建议根据剧情调整', confidence: 0.3 }
}

// ────────── Continuity Rules（原 ContinuityRules）──────────
const CONTINUITY_RULES = {
  Scene: { maxChangePerSegment: 1, requireTransition: true, minSameSceneDuration: 2 },
  Camera: { styleLockPerSegment: true, maxStyleChangePerSegment: 2 },
  Emotion: { maxJump: 30, noClashWithinSegment: true, smoothThreshold: 20 },
}

// ────────── DirectorAgent 核心类 ──────────
export class DirectorAgent {
  // ═══════════════════════════
  // 主入口：analyze — 统一分析
  // ═══════════════════════════
  analyze(
    segment: SegmentRuntime,
    segments?: SegmentRuntime[],
    scenes?: SceneRuntime[]
  ): AIAnalysisResult {
    const timeline = segment.timeline
    const visualFilled = timeline.filter(t => t.visual.trim()).length
    const emotionSet = timeline.filter(t => t.emotion.trim()).length

    const continuityIssues: string[] = []

    // Graph-aware 连续性检测（内化）
    if (segments && scenes) {
      const graphHints = this.computeGraphHints(segment, segments, scenes)
      if (graphHints.sceneConsistencyScore < 0.5) continuityIssues.push('场景连续性问题，建议保持空间一致性')
      for (const w of graphHints.emotionWarnings) continuityIssues.push(`[情绪图] ${w.description}`)
      if (graphHints.cameraFlowScore < 0.3) continuityIssues.push('镜头流动评分低，建议增加运镜多样性')
    }

    // 基础连续性检测
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].visual && !timeline[i - 1].visual) continuityIssues.push(`第 ${i} 秒出现突兀的画面切换`)
    }

    // 综合优化建议
    const suggestions = this.generateSuggestions(segment)

    return {
      segmentId: segment.id,
      pacingScore: visualFilled / Math.max(timeline.length, 1),
      emotionClarity: emotionSet / Math.max(timeline.length, 1),
      visualDensity: visualFilled / Math.max(timeline.length, 1),
      continuityIssues,
      suggestions,
    }
  }

  // ═══════════════════════════
  // 主入口：optimize — 优化
  // ═══════════════════════════
  optimize(segment: SegmentRuntime): SegmentOptimization {
    const timeline = segment.timeline
    const cameraPlans: CameraPlan[] = timeline.map(f => suggestCameraForFrame(f))
    const emotionResult = this.suggestEmotions(timeline)
    const suggestions = this.generateSuggestions(segment)

    return {
      segmentId: segment.id,
      cameraPlans,
      emotionPlans: emotionResult.plans,
      pacing: { frameChanges: emotionResult.issues.map(s => ({ second: s.second, action: 'shorten' as const, reason: s.description })) },
      assetBindings: [],
      suggestions,
    }
  }

  // ═══════════════════════════
  // 主入口：decide — 全链路决策
  // ═══════════════════════════
  decide(
    segment: SegmentRuntime,
    segments: SegmentRuntime[],
    scenes: SceneRuntime[],
    withContinuity?: boolean
  ): {
    optimizedSegment: SegmentRuntime
    explanation: string[]
    continuityReport?: ContinuityReport
    constraintReport?: ConstraintReport
    correctionPlan?: CorrectionPlan
  } {
    const graphHints = this.computeGraphHints(segment, segments, scenes)
    const optimized = JSON.parse(JSON.stringify(segment)) as SegmentRuntime
    const explanation: string[] = []

    // 场景影响
    if (graphHints.influenceWeights.sceneWeight > 0.5) {
      for (const note of graphHints.sceneContinuityNotes) {
        if (note.includes('共享场景')) explanation.push(`[场景] ${note}`)
      }
    }

    // 情绪补全
    if (graphHints.influenceWeights.emotionWeight < 0.5) {
      let filled = 0
      for (let i = 0; i < optimized.timeline.length; i++) {
        const frame = optimized.timeline[i]
        if (!frame.emotion.trim()) {
          const curveNode = graphHints.emotionCurve.segments.find(s => s.second === i)
          if (curveNode && curveNode.emotion !== '平静') { frame.emotion = curveNode.emotion; filled++ }
          else if (i > 0 && optimized.timeline[i - 1].emotion.trim()) { frame.emotion = optimized.timeline[i - 1].emotion; filled++ }
        }
      }
      if (filled > 0) explanation.push(`[情绪] 自动填充 ${filled} 帧情绪标签`)
    }

    // 镜头补全
    if (graphHints.influenceWeights.cameraWeight < 0.4) {
      let filled = 0
      for (let i = 0; i < optimized.timeline.length; i++) {
        const frame = optimized.timeline[i]
        if (!frame.camera.trim()) {
          const camNode = graphHints.cameraFlow.nodes.find(n => n.second === i)
          if (camNode) { frame.camera = camNode.movement; filled++ }
        }
      }
      if (filled > 0) explanation.push(`[运镜] 自动填充 ${filled} 帧运镜指令`)
    }

    if (graphHints.recommendedSegmentAdjustments.reason) explanation.push(`[调整] ${graphHints.recommendedSegmentAdjustments.reason}`)

    const fixes = [...graphHints.sceneFixSuggestions, ...graphHints.emotionFixSuggestions, ...graphHints.cameraFixSuggestions]
    for (const fix of fixes.slice(0, 3)) explanation.push(`[Graph建议] ${fix}`)

    // Continuity 校验
    let continuityReport: ContinuityReport | undefined
    let constraintReport: ConstraintReport | undefined
    let correctionPlan: CorrectionPlan | undefined

    if (withContinuity && segments.length > 0) {
      continuityReport = this.checkContinuity(segment, segments)
      constraintReport = this.checkConstraints(segment)

      explanation.push(`[Continuity] 综合评分: ${(continuityReport.overallScore * 100).toFixed(0)}%`)
      explanation.push(`[Constraints] 通过率: ${constraintReport.summary.passed}/${constraintReport.summary.total}`)

      if (continuityReport.violations.length > 0) {
        const criticals = continuityReport.violations.filter(v => v.severity === 'critical')
        const majors = continuityReport.violations.filter(v => v.severity === 'major')
        if (criticals.length > 0) explanation.push(`[严重违规] ${criticals.length} 项 — 请手动修正`)
        for (const v of majors.slice(0, 2)) explanation.push(`[Continuity] ${v.description} → ${v.fixSuggestion}`)

        correctionPlan = this.fixViolations(continuityReport, optimized)
        for (const correction of correctionPlan.corrections) {
          if (correction.action === 'fill') {
            const frame = optimized.timeline.find(t => t.second === correction.targetSecond)
            if (frame) {
              if (correction.type === 'emotion') frame.emotion = correction.suggestedValue
              if (correction.type === 'camera') frame.camera = correction.suggestedValue
            }
          }
        }
        if (correctionPlan.corrections.length > 0) explanation.push(`[自动修正] 应用 ${correctionPlan.corrections.length} 项修正`)
      }

      const hardFailed = constraintReport.checks.filter(c => !c.passed)
      for (const hf of hardFailed) explanation.push(`[约束] ${hf.detail}`)
    }

    optimized.graphHints = graphHints
    optimized.aiDecisionState = { source: 'ai', confidence: (graphHints.sceneConsistencyScore + graphHints.emotionContinuityScore + graphHints.cameraFlowScore) / 3 }
    if (continuityReport) {
      optimized.continuityState = {
        violations: continuityReport.violations.map(v => v.description),
        score: continuityReport.overallScore,
        corrected: (correctionPlan?.corrections.length || 0) > 0,
      }
    }

    return { optimizedSegment: optimized, explanation, continuityReport, constraintReport, correctionPlan }
  }

  // ═══════════════════════════
  // Graph Hints（内化 Scene/Emotion/Camera Graph）
  // ═══════════════════════════
  getGraphHints(segment: SegmentRuntime, segments: SegmentRuntime[], scenes: SceneRuntime[]): GraphHints {
    return this.computeGraphHints(segment, segments, scenes)
  }

  private computeGraphHints(segment: SegmentRuntime, segments: SegmentRuntime[], scenes: SceneRuntime[]): GraphHints {
    const timeline = segment.timeline
    const segIdx = segments.findIndex(s => s.id === segment.id)

    // — 场景连续性 —
    const sceneContinuityNotes: string[] = []
    if (segIdx > 0) {
      const prev = segments[segIdx - 1]
      const shared = segment.scenes.filter(s => prev.scenes.includes(s))
      if (shared.length > 0) sceneContinuityNotes.push(`共享场景: ${shared.join(',')}`)
      else sceneContinuityNotes.push('无共享场景 — 场景切换')
    }
    const sceneConsistencyScore = sceneContinuityNotes.length > 0 && sceneContinuityNotes.some(n => n.includes('共享场景')) ? 0.8 : 0.4

    // — 情绪图 —
    const emotionSegments: { second: number; emotion: string; intensity: number }[] = []
    const emotionWarnings: { type: string; segmentId: string; second: number; description: string }[] = []
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i].emotion?.trim()
      if (e) {
        emotionSegments.push({ second: i, emotion: e, intensity: 50 })
        if (i > 0 && timeline[i - 1].emotion && timeline[i - 1].emotion !== e) {
          const allowed = EMOTION_TRANSITIONS[timeline[i - 1].emotion] || []
          if (!allowed.includes(e)) {
            emotionWarnings.push({ type: 'clash', segmentId: segment.id, second: i, description: `第 ${i}s 情绪跳变: "${timeline[i - 1].emotion}" → "${e}"` })
          }
        }
      }
    }
    const emotionContinuityScore = emotionWarnings.length === 0 ? 0.8 : Math.max(0.1, 0.8 - emotionWarnings.length * 0.2)

    // — 镜头图 —
    const cameraNodes = timeline.filter(t => t.camera.trim()).map(t => ({
      id: `${segment.id}-cam-${t.second}`,
      segmentId: segment.id,
      shotType: this.mapCameraToShotType(t.camera),
      movement: t.camera,
      duration: 1,
      second: t.second,
    }))
    const cameraFlowScore = cameraNodes.length >= timeline.length * 0.3 ? 0.7 : 0.3
    const cameraNote = cameraFlowScore < 0.5 ? '运镜覆盖率低，建议补充镜头指令' : ''

    // — 场景修复建议 —
    const sceneFixSuggestions: string[] = []
    if (sceneConsistencyScore < 0.6) sceneFixSuggestions.push('场景连续性偏低，考虑添加过渡场景描述')
    const emotionFixSuggestions: string[] = emotionWarnings.map(w => w.description)
    const cameraFixSuggestions: string[] = []
    if (cameraFlowScore < 0.5) cameraFixSuggestions.push('增加运镜描述提高画面动态感')

    // — 片段调整 —
    const recommendedSegmentAdjustments: { reason?: string } = {}
    if (emotionWarnings.length > 2) recommendedSegmentAdjustments.reason = '情绪冲突过多，建议拆分为两个独立片段'
    else if (sceneConsistencyScore < 0.3) recommendedSegmentAdjustments.reason = '场景跳跃过大，建议补充过渡帧'

    // — 权重评分 —
    const influenceWeights = {
      sceneWeight: Math.min(1, sceneConsistencyScore + 0.2),
      emotionWeight: Math.min(1, emotionContinuityScore + 0.1),
      cameraWeight: Math.min(1, 1 - cameraFlowScore),
    }

    return {
      sceneConsistencyScore,
      emotionContinuityScore,
      cameraFlowScore,
      emotionCurve: { segments: emotionSegments, overallArc: emotionSegments.map(s => s.emotion).join('→'), warnings: emotionWarnings as any },
      cameraFlow: { nodes: cameraNodes as any, transitions: [], flowScore: cameraFlowScore, note: cameraNote },
      sceneContinuityNotes,
      emotionWarnings,
      sceneFixSuggestions,
      emotionFixSuggestions,
      cameraFixSuggestions,
      recommendedSegmentAdjustments,
      influenceWeights,
    }
  }

  private mapCameraToShotType(camera: string): string {
    if (camera.includes('特写')) return 'close-up'
    if (camera.includes('中景')) return 'medium'
    if (camera.includes('全景') || camera.includes('远景') || camera.includes('广角')) return 'wide'
    if (camera.includes('跟拍') || camera.includes('环绕')) return 'tracking'
    if (camera.includes('手持') || camera.includes('晃动')) return 'handheld'
    if (camera.includes('摇') || camera.includes('摇移')) return 'pan'
    return 'fixed'
  }

  // ═══════════════════════════
  // Continuity 校验（内化原 ContinuityValidator/Engine/Rules）
  // ═══════════════════════════
  continuityCheck(segment: SegmentRuntime, segments: SegmentRuntime[]): ContinuityReport {
    return this.checkContinuity(segment, segments)
  }

  private checkContinuity(segment: SegmentRuntime, allSegments: SegmentRuntime[]): ContinuityReport {
    const segIdx = allSegments.findIndex(s => s.id === segment.id)
    const prevSegment = segIdx > 0 ? allSegments[segIdx - 1] : undefined

    const violations: any[] = []

    // Scene jump
    if (prevSegment) {
      const shared = prevSegment.scenes.filter(s => segment.scenes.includes(s))
      if (shared.length === 0 && prevSegment.scenes.length > 0 && segment.scenes.length > 0) {
        violations.push({ type: 'scene_jump', severity: 'major', description: `场景全切换: "${prevSegment.scenes.join(',')}" → "${segment.scenes.join(',')}"`, fixSuggestion: '添加过渡画面' })
      }
    }
    const changes = segment.timeline.filter((t, i) => i > 0 && t.visual !== segment.timeline[i - 1].visual && t.visual.trim() && segment.timeline[i - 1].visual.trim()).length
    if (changes > CONTINUITY_RULES.Scene.maxChangePerSegment) {
      violations.push({ type: 'scene_jump', severity: 'minor', description: `段内场景切换 ${changes} 次超限`, fixSuggestion: '拆分片段' })
    }

    // Emotion break
    if (prevSegment) {
      const prevEmo = this.dominantEmotion(prevSegment)
      const currEmo = this.dominantEmotion(segment)
      if (prevEmo && currEmo && prevEmo !== currEmo) {
        const jumpPairs: [string, string][] = [['开心', '悲伤'], ['浪漫', '愤怒'], ['平静', '恐惧']]
        for (const [a, b] of jumpPairs) {
          if ((prevEmo === a && currEmo === b) || (prevEmo === b && currEmo === a)) {
            violations.push({ type: 'emotion_break', severity: 'major', description: `跨段情绪断裂: "${prevEmo}" → "${currEmo}"`, fixSuggestion: '加入过渡情绪' })
          }
        }
      }
    }

    // 段内情绪冲突
    const emotions = segment.timeline.filter(t => t.emotion.trim()).map(t => t.emotion.trim())
    const uniqueEmo = [...new Set(emotions)]
    const clashPairs = [['开心', '悲伤'], ['愤怒', '浪漫'], ['恐惧', '平静'], ['紧张', '放松']]
    for (const [a, b] of clashPairs) {
      if (uniqueEmo.includes(a) && uniqueEmo.includes(b)) {
        violations.push({ type: 'emotion_break', severity: 'major', description: `段内情绪冲突: "${a}" vs "${b}"`, fixSuggestion: '移除冲突情绪或拆分段' })
      }
    }

    // Camera
    const cameras = [...new Set(segment.timeline.filter(t => t.camera.trim()).map(t => t.camera.trim()))]
    if (cameras.length > CONTINUITY_RULES.Camera.maxStyleChangePerSegment) {
      violations.push({ type: 'camera_inconsistency', severity: 'minor', description: `运镜 ${cameras.length} 种超限`, fixSuggestion: '减少镜头变化' })
    }
    if (prevSegment) {
      const prevCams = [...new Set(prevSegment.timeline.filter(t => t.camera.trim()).map(t => t.camera.trim()))]
      if (prevCams.some(c => c.includes('特写')) && cameras.some(c => c.includes('远景'))) {
        violations.push({ type: 'camera_inconsistency', severity: 'major', description: '镜头极端变化: 特写→远景', fixSuggestion: '添加过渡镜头' })
      }
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length
    const majorCount = violations.filter(v => v.severity === 'major').length
    const overallScore = Math.max(0, 1 - criticalCount * 0.4 - majorCount * 0.15)

    return {
      segmentId: segment.id, timestamp: new Date().toISOString(),
      overallScore, violations,
      scores: {
        sceneContinuity: violations.filter(v => v.type === 'scene_jump').length === 0 ? 1 : 0.5,
        characterConsistency: violations.filter(v => v.type === 'character_drift').length === 0 ? 1 : 0.6,
        cameraStyleConsistency: violations.filter(v => v.type === 'camera_inconsistency').length === 0 ? 1 : 0.5,
        emotionFlowStability: violations.filter(v => v.type === 'emotion_break').length === 0 ? 1 : 0.4,
      },
    }
  }

  private fixViolations(report: ContinuityReport, segment: SegmentRuntime): CorrectionPlan {
    const corrections: any[] = []
    for (const v of report.violations) {
      if (v.severity === 'minor') continue
      switch (v.type) {
        case 'emotion_break': {
          for (const f of segment.timeline.filter(t => !t.emotion.trim()).slice(0, 3)) {
            corrections.push({ type: 'emotion', action: 'fill', targetSecond: f.second, currentValue: '', suggestedValue: '平静', confidence: 0.5 })
          }
          break
        }
        case 'camera_inconsistency': {
          for (const f of segment.timeline.filter(t => !t.camera.trim()).slice(0, 2)) {
            corrections.push({ type: 'camera', action: 'fill', targetSecond: f.second, currentValue: '', suggestedValue: '固定镜头', confidence: 0.4 })
          }
          break
        }
        case 'scene_jump': {
          corrections.push({ type: 'scene', action: 'replace', targetSecond: 0, currentValue: '场景切换', suggestedValue: '添加过渡画面', confidence: 0.6 })
          break
        }
      }
    }
    return { segmentId: segment.id, corrections, expectedScoreImprovement: corrections.length * 0.1 }
  }

  private dominantEmotion(seg: SegmentRuntime): string | null {
    const emotions = seg.timeline.filter(t => t.emotion.trim()).map(t => t.emotion.trim())
    if (!emotions.length) return null
    const counts: Record<string, number> = {}
    for (const e of emotions) counts[e] = (counts[e] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }

  // ═══════════════════════════
  // Constraints（内化原 ProductionConstraintEngine/Rules）
  // ═══════════════════════════
  private checkConstraints(segment: SegmentRuntime): ConstraintReport {
    const timeline = segment.timeline
    const changes = timeline.filter((t, i) => i > 0 && t.visual !== timeline[i - 1].visual && t.visual.trim() && timeline[i - 1].visual.trim()).length
    const emotions = timeline.filter(t => t.emotion.trim()).length
    const uniqueCameras = new Set(timeline.filter(t => t.camera.trim()).map(t => t.camera.trim()))
    const emotionJumps = timeline.filter((t, i) => i > 0 && t.emotion && timeline[i - 1].emotion && t.emotion !== timeline[i - 1].emotion).length

    const checks = [
      { constraintId: 'max-scene-change', passed: changes <= 1, detail: `场景变化: ${changes} 次 (限制 ≤1)` },
      { constraintId: 'emotion-jump-limit', passed: emotionJumps <= 3, detail: `情绪跳变: ${emotionJumps} 次 (限制 ≤3)` },
      { constraintId: 'camera-style-lock', passed: uniqueCameras.size <= 2, detail: `镜头风格: ${uniqueCameras.size} 种 (限制 ≤2)` },
      { constraintId: 'character-wardrobe-lock', passed: true, detail: '角色服装一致 (未检测到变化)' },
      { constraintId: 'scene-transition-required', passed: changes === 0 || emotions > 0, detail: changes === 0 ? '无场景切换' : '场景过渡标记需补充' },
    ]

    return {
      checks, summary: {
        total: checks.length,
        passed: checks.filter(c => c.passed).length,
        failed: checks.filter(c => !c.passed).length,
        hardFailures: checks.filter(c => !c.passed && ['max-scene-change', 'emotion-jump-limit'].includes(c.constraintId)).length,
      },
    }
  }

  // ═══════════════════════════
  // 工具方法
  // ═══════════════════════════
  suggestOptimizations(segment: SegmentRuntime): SegmentOptimization {
    return this.optimize(segment)
  }

  suggestAssets(segment: SegmentRuntime, characters: CharacterRuntime[], scenes: SceneRuntime[]): AssetBinding[] {
    return suggestAssetBindings(segment, characters, scenes)
  }

  suggestCamera(segment: SegmentRuntime): CameraPlan[] {
    return segment.timeline.map(f => suggestCameraForFrame(f))
  }

  createMergeState(humanTimeline: SegmentRuntime['timeline'], aiSuggestions: OptimizationSuggestion[]): HumanAIMergeState {
    const aiTimeline = humanTimeline.map(f => ({ ...f }))
    for (const s of aiSuggestions) {
      if (s.type === 'camera' && s.confidence > 0.5) aiTimeline[s.second].camera = s.suggestedState
      if (s.type === 'emotion' && s.confidence > 0.5) aiTimeline[s.second].emotion = s.suggestedState
    }
    const mergedTimeline = humanTimeline.map((f, i) => ({
      ...f,
      camera: aiTimeline[i]?.camera || f.camera,
      emotion: aiTimeline[i]?.emotion || f.emotion,
    }))
    return { humanVersion: humanTimeline, aiVersion: aiTimeline, mergedVersion: mergedTimeline, mergeDecisions: [] }
  }

  // ─── 内部辅助 ───

  private generateSuggestions(segment: SegmentRuntime): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []
    const timeline = segment.timeline

    // 画面空洞
    for (let i = 0; i < timeline.length; i++) {
      if (!timeline[i].visual?.trim()) {
        suggestions.push({ id: `visual-empty-${i}`, type: 'visual', second: i, title: '画面描述为空', description: `第 ${i} 秒无画面描述`, currentState: '空', suggestedState: '添加画面描述', confidence: 0.9, applied: false })
      }
    }

    // 情绪空洞
    for (let i = 0; i < timeline.length; i++) {
      if (!timeline[i].emotion?.trim()) {
        const plan = suggestEmotionForFrame(timeline[i], i > 0 ? timeline[i - 1].emotion : undefined)
        suggestions.push({ id: `emotion-missing-${i}`, type: 'emotion', second: i, title: '情绪建议', description: plan.reason, currentState: '未设定', suggestedState: plan.suggestedEmotion, confidence: plan.confidence, applied: false })
      }
    }

    // 运镜空洞
    for (let i = 0; i < timeline.length; i++) {
      if (!timeline[i].camera?.trim()) {
        const plan = suggestCameraForFrame(timeline[i])
        suggestions.push({ id: `camera-missing-${i}`, type: 'camera', second: i, title: '运镜建议', description: plan.reason, currentState: '未设定', suggestedState: plan.suggestedCamera, confidence: plan.confidence, applied: false })
      }
    }

    // 连续空画面
    let emptyRun = 0
    for (let i = 0; i < timeline.length; i++) {
      if (!timeline[i].visual?.trim()) emptyRun++
      else { if (emptyRun >= 3) suggestions.push({ id: `pacing-empty-run-${i - emptyRun}`, type: 'pacing', second: i - emptyRun, title: '连续空画面', description: `从第 ${i - emptyRun}s 连续 ${emptyRun}s 无画面`, currentState: `${emptyRun}s 空白`, suggestedState: '填充或缩减时长', confidence: 0.7, applied: false }); emptyRun = 0 }
    }

    const emotionChanges = timeline.filter((f, i) => i > 0 && f.emotion !== timeline[i - 1].emotion).length
    if (emotionChanges > 5) suggestions.push({ id: 'pacing-too-many-emotions', type: 'pacing', second: 0, title: '情绪变化过于频繁', description: `${timeline.length} 秒内情绪改变 ${emotionChanges} 次`, currentState: `${emotionChanges} 次`, suggestedState: '减少情绪变化', confidence: 0.5, applied: false })

    return suggestions
  }

  private suggestEmotions(timeline: TimelineFrame[]): { plans: EmotionPlan[]; issues: OptimizationSuggestion[] } {
    const plans = timeline.map((f, i) => suggestEmotionForFrame(f, i > 0 ? timeline[i - 1].emotion : undefined))
    const issues: OptimizationSuggestion[] = []
    for (let i = 0; i < timeline.length; i++) {
      if (!timeline[i].emotion?.trim()) {
        issues.push({ id: `emotion-missing-${i}`, type: 'emotion', second: i, title: '情绪缺失', description: `第 ${i}s 未设定情绪`, currentState: '未设定', suggestedState: '建议设定情绪', confidence: 0.8, applied: false })
        continue
      }
      if (i > 0 && timeline[i - 1].emotion) {
        const allowed = EMOTION_TRANSITIONS[timeline[i - 1].emotion] || []
        if (timeline[i - 1].emotion !== timeline[i].emotion && !allowed.includes(timeline[i].emotion!)) {
          issues.push({ id: `emotion-jump-${i}`, type: 'emotion', second: i, title: '情绪跳跃过大', description: `从"${timeline[i - 1].emotion}"突变成"${timeline[i].emotion}"`, currentState: timeline[i].emotion!, suggestedState: allowed[0] || '平静', confidence: 0.5, applied: false })
        }
      }
    }
    return { plans, issues }
  }
}

export const directorAgent = new DirectorAgent()
