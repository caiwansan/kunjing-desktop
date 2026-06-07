// ExecutionEngine — 核心调度层
// 职责：接收 SegmentRuntime → 编译为 PromptRuntime
// 不执行 AI，只做结构转换

import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'
import type { PromptRuntime, ExecutionEngine as IExecutionEngine, CompileOptions } from './execution-types'
import { compileSegment, compileSegments } from './SegmentToPromptCompiler'
import { promptRuntimeStore } from './PromptRuntime'

export class ExecutionEngineImpl implements IExecutionEngine {
  /**
   * 编译单个 Segment → PromptRuntime
   * 结果自动存入 store
   */
  compile(segment: SegmentRuntime, options?: CompileOptions): PromptRuntime {
    const runtime = compileSegment(segment, options)
    promptRuntimeStore.add(runtime)
    return runtime
  }

  /**
   * 批量编译：多个 Segment → PromptRuntime[]
   */
  compileBatch(segments: SegmentRuntime[], options?: CompileOptions): PromptRuntime[] {
    const runtimes = compileSegments(segments, options)
    for (const r of runtimes) {
      promptRuntimeStore.add(r)
    }
    return runtimes
  }

  /**
   * 重新编译（覆盖旧结果）
   */
  recompile(segment: SegmentRuntime, options?: CompileOptions): PromptRuntime {
    promptRuntimeStore.remove(segment.id)
    return this.compile(segment, options)
  }
}

// 全局单例
export const executionEngine = new ExecutionEngineImpl()
