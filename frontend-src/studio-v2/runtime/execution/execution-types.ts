// Execution Layer — 核心类型定义 (v2 Graph-Aware)
// 不依赖任何 AI/模型/API

import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'
import type { GraphHints } from '~/studio-v2/runtime/director-ai/graph-types'

// ─── PromptRuntime — 编译产出的可执行指令集 ───

export interface PromptFrame {
  t: number               // 时间（秒）
  visualPrompt: string    // 画面描述（编译后）
  cameraPrompt: string    // 运镜指令（编译后）
  audioPrompt: string     // 音效描述（编译后）
  emotionTag: string      // 情绪标签
  // Phase 5: Graph 影响权重
  graphInfluence?: {
    sceneWeight: number
    emotionWeight: number
    cameraWeight: number
  }
}

export interface PromptRuntime {
  segmentId: string
  frames: PromptFrame[]
  compiledAt: string       // ISO 时间戳
  sourceSegmentVersion: number  // 防脏写
  // Phase 5: Graph 来源元数据
  graphSource?: {
    graphHintsVersion: number
    influenceApplied: boolean
  }
}

// ─── ExecutionEngine 接口 ───

export interface ExecutionEngine {
  compile(segment: SegmentRuntime, options?: CompileOptions): PromptRuntime
}

export interface CompileOptions {
  styleHint?: string
  tone?: string
  graphHints?: GraphHints  // Phase 5: Graph 决策输入
}

// ─── 编译结果统计 ───

export interface CompileStat {
  segmentId: string
  frameCount: number
  visualCoverage: number   // 0-1, 画面描述覆盖率
  cameraCoverage: number
  audioCoverage: number
  avgPromptLength: number
}
