// PromptRuntime — 编译结果的运行时管理
// 只做结构的读/写/检索，不做 AI 调用

import type { PromptRuntime, PromptFrame, CompileStat } from './execution-types'

export class PromptRuntimeStore {
  private prompts: Map<string, PromptRuntime> = new Map()

  add(runtime: PromptRuntime): void {
    this.prompts.set(runtime.segmentId, runtime)
  }

  get(segmentId: string): PromptRuntime | undefined {
    return this.prompts.get(segmentId)
  }

  getAll(): PromptRuntime[] {
    return Array.from(this.prompts.values())
  }

  remove(segmentId: string): boolean {
    return this.prompts.delete(segmentId)
  }

  clear(): void {
    this.prompts.clear()
  }

  // 编译统计
  getStats(runtime: PromptRuntime): CompileStat {
    const frames = runtime.frames
    if (frames.length === 0) {
      return {
        segmentId: runtime.segmentId,
        frameCount: 0,
        visualCoverage: 0,
        cameraCoverage: 0,
        audioCoverage: 0,
        avgPromptLength: 0,
      }
    }
    const visualFilled = frames.filter(f => f.visualPrompt.trim().length > 0).length
    const cameraFilled = frames.filter(f => f.cameraPrompt.trim().length > 0).length
    const audioFilled = frames.filter(f => f.audioPrompt.trim().length > 0).length
    const totalLen = frames.reduce((s, f) => s + f.visualPrompt.length + f.cameraPrompt.length, 0)

    return {
      segmentId: runtime.segmentId,
      frameCount: frames.length,
      visualCoverage: visualFilled / frames.length,
      cameraCoverage: cameraFilled / frames.length,
      audioCoverage: audioFilled / frames.length,
      avgPromptLength: Math.round(totalLen / frames.length),
    }
  }
}

// 全局单例
export const promptRuntimeStore = new PromptRuntimeStore()
