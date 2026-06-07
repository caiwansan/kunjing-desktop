// ============================================================
// Pipeline Runtime — 生产阶段状态管理
//
// ⚠️ 宪法层：DEFAULT_STAGES 只能来自 shared/pipeline-definition
// 前端不应在此硬编码 stage 列表。
// ============================================================

import type { PipelineRuntime, PipelineStage, PipelineStageId, StageStatus } from '~/studio-v2/types/runtime/index'
import { PIPELINE_STAGES, type PipelineStageId as SharedStageId } from 'shared/pipeline-definition'

/**
 * 从 PipelineDefinition 生成前端 PipelineStage 列表。
 * 所有 id/title/icon 来自唯一真相源。
 */
const DEFAULT_STAGES: PipelineStage[] = PIPELINE_STAGES.map(s => ({
  id: s.id as PipelineStageId,
  title: s.title,
  icon: s.icon,
  status: 'idle' as StageStatus,
  progress: 0,
}))

export function createPipelineRuntime(): PipelineRuntime {
  return {
    stages: DEFAULT_STAGES.map(s => ({ ...s })),
    activeStageId: 'script-analysis',
  }
}

export function setStageStatus(
  pipeline: PipelineRuntime,
  stageId: PipelineStageId,
  status: StageStatus,
  extra?: { progress?: number; error?: string }
): PipelineRuntime {
  const stages = pipeline.stages.map(s => {
    if (s.id !== stageId) return s
    const now = new Date().toISOString()
    return {
      ...s,
      status,
      progress: extra?.progress ?? s.progress,
      error: extra?.error,
      startedAt: status === 'running' ? (s.startedAt || now) : s.startedAt,
      completedAt: status === 'completed' ? now : undefined,
    }
  })
  return { ...pipeline, stages }
}

export function setActiveStage(pipeline: PipelineRuntime, stageId: PipelineStageId): PipelineRuntime {
  return { ...pipeline, activeStageId: stageId }
}
