// ─── Stage Flow (DAG) — defines stage dependencies and auto-trigger chains ───
// ⭐ Single Source of Truth for production flow topology

import type { RuntimeStage } from '@/runtime/execution/types'

export const STAGE_FLOW_DAG: Record<RuntimeStage, RuntimeStage[]> = {
  story:              ['character'],
  character:          ['scene'],           // 角色设定图直接作为定妆照，跳过 character_makeup
  scene:              ['storyboard'],
  storyboard:         ['voice', 'frame'],
  voice:              ['director'],
  frame:              ['director'],
  director:           ['composite'],
  composite:          ['export'],
  export:             [],
}

/** All stages in execution order (topological sort) */
export const STAGE_ORDER: RuntimeStage[] = [
  'story', 'character', 'scene', 'storyboard',
  'voice', 'frame', 'director', 'composite', 'export',
]

/** Human-readable labels */
export const STAGE_LABELS: Record<RuntimeStage, string> = {
  story:              '剧本图谱',
  character:          '角色设定',
  scene:              '场景生成',
  storyboard:         '分镜设计',
  voice:              '语音合成',
  frame:              '画面生成',
  director:           '导演合成',
  composite:          '视频合成',
  export:             '导出发布',
}

/** Backend API endpoint for each stage (used by workers)
 *
 * SEEL: 所有 AI 生成任务收敛到 /api/tasks/ai-generate
 * voice 阶段由 VoiceGeneration.vue 直接调用 submitAiTask()
 */
export const STAGE_API_MAP: Record<RuntimeStage, string> = {
  story:              '/api/v1/narrative/analyze',
  character:          '/api/characters/spawn',
  scene:              '/api/projects/${projectId}/scenes',
  storyboard:         '/api/projects/${projectId}/storyboards/generate',
  /** SEEL: voice 不走直接路由，由 VoiceGeneration.vue → submitAiTask → queue */
  voice:              '',
  frame:              '/api/execution-images/generate',
  director:           '/api/v1/director/generate-plan',
  composite:          '/api/video/compose',
  export:             '/api/export/create',
}
