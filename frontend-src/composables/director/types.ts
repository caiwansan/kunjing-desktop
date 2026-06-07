// ════════════════════════════════════════════════════════════════════
// Director Types — AI Director Layer v2 类型定义
// ════════════════════════════════════════════════════════════════════

export interface SegmentScore {
  emotion: number
  camera: number
  continuity: number
  pacing: number
  overall: number
}

export interface DirectorSuggestion {
  type: 'camera' | 'emotion' | 'continuity' | 'pacing'
  level: 'info' | 'warning' | 'critical'
  ruleId: string
  confidence: number
  message: string
  segmentId: string
  frameRange?: [number, number]
  /** 应用此建议到 store 和 seg */
  apply: (store: any, segIndex: number) => void
}

export interface FrameHint {
  frameRange: [number, number]
  message: string
  severity: 'info' | 'warning' | 'critical'
  sourceRule: string
}

export interface DirectorSegmentInput {
  scene: string
  characters: string[]
  emotion: Record<string, number>
  cameraMove: string
  shotSize: string
  shake: number
  lighting: string
  dialogue: string
}

export interface DirectorRule {
  id: string
  type: 'camera' | 'emotion' | 'continuity' | 'pacing'
  level: 'info' | 'warning' | 'critical'
  name: string
  description: string
  evaluate(input: DirectorSegmentInput): SegmentScore
  generate(input: DirectorSegmentInput, segmentId: string): DirectorSuggestion[]
}
