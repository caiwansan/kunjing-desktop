// Segment → Prompt 编译层 (v2 Graph-Aware)
// 将 TimelineFrame[] (导演表) 转换为 PromptFrame[] (可执行指令)
// 纯函数，零外部依赖，可测试
// Phase 5: 接收 GraphHints 影响编译输出

import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'
import type { PromptFrame, PromptRuntime, CompileOptions } from './execution-types'
import type { GraphHints } from '~/studio-v2/runtime/director-ai/graph-types'

// ─── 编译规则常量 ───

const EMOTION_TO_TONE: Record<string, string> = {
  '平静': '柔和自然光，温暖色调',
  '开心': '明亮饱和度增高，光线柔和',
  '悲伤': '冷色调，暗调，漫射光',
  '愤怒': '高对比度，反差强烈',
  '恐惧': '暗色调，阴影重，晃动光影',
  '紧张': '抽帧感画面，暗角，微晃',
  '浪漫': '柔光暖色调，焦外虚化',
  '悬疑': '蓝绿冷调，侧逆光，阴影多',
  '惊喜': '色彩渐变突然变亮',
  '震撼': '广角感画面，对比强烈',
}

const CAMERA_DESCRIPTIONS: Record<string, string> = {
  '推': '镜头匀速向前推进，聚焦主体',
  '拉': '镜头匀速向后拉开，展示环境全貌',
  '摇': '镜头水平摇移，展现空间关系',
  '移': '镜头平行位移，保持主体在画面中',
  '跟': '镜头跟随主体运动，保持相对距离',
  '升': '镜头匀速升起，俯拍场景',
  '降': '镜头匀速下降，仰拍主体',
  '旋转': '镜头围绕主体旋转，360度展示',
  '特写': '镜头推近至特写，强调细节',
  '远景': '镜头拉开至远景，展示全貌',
}

// ─── 编译核心 ───

export function compileSegment(segment: SegmentRuntime, options?: CompileOptions): PromptRuntime {
  const graphHints = options?.graphHints
  const frames: PromptFrame[] = segment.timeline.map((frame, idx) => {
    return compileFrame(frame, idx, segment.timeline, options)
  })

  const result: PromptRuntime = {
    segmentId: segment.id,
    frames,
    compiledAt: new Date().toISOString(),
    sourceSegmentVersion: 1,
  }

  // Phase 5: Graph 来源元数据
  if (graphHints) {
    result.graphSource = {
      graphHintsVersion: 1,
      influenceApplied: graphHints.sceneFixSuggestions.length > 0 ||
                         graphHints.emotionFixSuggestions.length > 0 ||
                         graphHints.cameraFixSuggestions.length > 0,
    }
  }

  return result
}

function compileFrame(
  frame: TimelineFrame,
  idx: number,
  allFrames: TimelineFrame[],
  options?: CompileOptions
): PromptFrame {
  const graphHints = options?.graphHints

  // 1. Visual Prompt — 画面描述编译
  const visualPrompt = compileVisual(frame, idx, allFrames, graphHints)

  // 2. Camera Prompt — 运镜指令
  const cameraPrompt = compileCamera(frame)

  // 3. Audio Prompt — 音效描述
  const audioPrompt = frame.audio?.trim()
    ? `音效: ${frame.audio}`
    : ''

  // 4. Emotion Tag
  const emotionTag = frame.emotion?.trim() || ''

  // 5. Graph Influence — 注入权重
  const graphInfluence = graphHints ? {
    sceneWeight: graphHints.sceneConsistencyScore,
    emotionWeight: graphHints.emotionContinuityScore,
    cameraWeight: graphHints.cameraFlowScore,
  } : undefined

  return {
    t: frame.second,
    visualPrompt,
    cameraPrompt,
    audioPrompt,
    emotionTag,
    graphInfluence,
  }
}

function compileVisual(
  frame: TimelineFrame,
  idx: number,
  allFrames: TimelineFrame[],
  graphHints?: GraphHints
): string {
  const parts: string[] = []

  // 基础画面描述
  if (frame.visual?.trim()) {
    parts.push(frame.visual.trim())
  }

  // 情绪色调
  if (frame.emotion?.trim()) {
    const tone = EMOTION_TO_TONE[frame.emotion.trim()]
    if (tone) {
      parts.push(`色调: ${tone}`)
    }
  }

  // Phase 5: Graph 场景连续性 → 补充过渡提示
  if (graphHints && idx > 0) {
    const sceneWeight = graphHints.sceneConsistencyScore
    if (sceneWeight < 0.5) {
      parts.push('场景连续性较低，注意视觉衔接')
    }
  }

  // 过渡逻辑 — 与前一帧的连接
  if (idx > 0 && allFrames[idx - 1]?.visual?.trim()) {
    const prevVisual = allFrames[idx - 1].visual
    const currentVisual = frame.visual
    if (prevVisual !== currentVisual) {
      parts.push(`过渡: 场景切换至「${currentVisual || '下一画面'}」`)
    }
  }

  return parts.join(' | ')
}

function compileCamera(frame: TimelineFrame): string {
  const raw = frame.camera?.trim()
  if (!raw) return ''

  if (CAMERA_DESCRIPTIONS[raw]) {
    return CAMERA_DESCRIPTIONS[raw]
  }

  return raw
}

// ─── 批量编译 ───

export function compileSegments(segments: SegmentRuntime[], options?: CompileOptions): PromptRuntime[] {
  return segments.map(seg => compileSegment(seg, options))
}
