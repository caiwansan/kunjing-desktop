/**
 * shared/pipeline-definition.ts — 流水线唯一真相源
 *
 * ⚠️ 宪法规定：前端和后端只能从本文件读取流水线定义。
 * - 前端：import { PIPELINE_STAGES } from 'shared/pipeline-definition'
 * - 后端：import { PIPELINE_STAGES } from '../../shared/pipeline-definition'
 *
 * 禁止在两端独立定义 stage 列表。
 * 新增或修改 stage 只能改这个文件。
 */

// ─── Stage 唯一标识 ───
export type PipelineStageId =
  | 'script-analysis'
  | 'character-design'
  | 'scene-design'
  | 'props-design'
  | 'video-generation'
  | 'voice-generation'
  | 'music-generation'
  | 'final-render'

// ─── Stage 状态值（前后端共用） ───
export type PipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'blocked'
  | 'ready'
  | 'idle'

// ─── Stage 定义 ───
export interface PipelineStageDef {
  /** 唯一标识（前后端共用） */
  id: PipelineStageId
  /** UI 显示标题 */
  title: string
  /** UI 图标 */
  icon: string
  /** 顺序（从 1 开始） */
  order: number
  /** 是否允许重试 */
  retryable: boolean
  /** 是否在 UI 中可见 */
  visible: boolean
  /** 依赖项（前置 stage id 列表），为空表示无依赖 */
  dependsOn: PipelineStageId[]
  /** 是否可选（依赖失败不阻塞） */
  optional: boolean
  /** 是否可并行执行 */
  parallelizable: boolean
}

// ─── 唯一真相源 ───
// ⚠️ 所有修改必须在此进行，然后 sync 到两端
export const PIPELINE_STAGES: PipelineStageDef[] = [
  {
    id: 'script-analysis',
    title: '剧本分析',
    icon: '📝',
    order: 1,
    retryable: true,
    visible: true,
    dependsOn: [],
    optional: false,
    parallelizable: false,
  },
  {
    id: 'character-design',
    title: '角色设定',
    icon: '👤',
    order: 2,
    retryable: true,
    visible: true,
    dependsOn: ['script-analysis'],
    optional: false,
    parallelizable: false,
  },
  {
    id: 'scene-design',
    title: '场景设定',
    icon: '🏙️',
    order: 3,
    retryable: true,
    visible: true,
    dependsOn: ['script-analysis'],
    optional: false,
    parallelizable: false,
  },
  {
    id: 'props-design',
    title: '道具设定',
    icon: '🛡️',
    order: 4,
    retryable: true,
    visible: true,
    dependsOn: ['script-analysis'],
    optional: true,
    parallelizable: false,
  },
  {
    id: 'video-generation',
    title: '视频生成',
    icon: '🎥',
    order: 5,
    retryable: true,
    visible: true,
    dependsOn: ['character-design', 'scene-design'],
    optional: false,
    parallelizable: false,
  },
  {
    id: 'voice-generation',
    title: '广告创作',
    icon: '📺',
    order: 6,
    retryable: true,
    visible: true,
    dependsOn: [],
    optional: true,
    parallelizable: true,
  },
  {
    id: 'music-generation',
    title: '音乐生成',
    icon: '🎵',
    order: 7,
    retryable: true,
    visible: true,
    dependsOn: [],
    optional: true,
    parallelizable: true,
  },
  {
    id: 'final-render',
    title: '合成输出',
    icon: '✨',
    order: 8,
    retryable: false,
    visible: true,
    dependsOn: ['video-generation', 'voice-generation', 'music-generation'],
    optional: false,
    parallelizable: false,
  },
]

// ─── 工具函数 ───

/** 按 order 排序的 stage id 列表 */
export const PIPELINE_STAGE_ORDER: PipelineStageId[] = PIPELINE_STAGES
  .sort((a, b) => a.order - b.order)
  .map(s => s.id)

/** 获取给定 stage 的下游依赖者 */
export function getDownstreamStages(stageId: PipelineStageId): PipelineStageId[] {
  return PIPELINE_STAGES
    .filter(s => s.dependsOn.includes(stageId))
    .map(s => s.id as PipelineStageId)
}

/** 计算 DAG 依赖图（后端 DAG runtime 使用） */
export function buildPipelineDAG(): Record<string, { dependsOn: string[]; optional: boolean; parallelizable: boolean }> {
  const dag: Record<string, { dependsOn: string[]; optional: boolean; parallelizable: boolean }> = {}
  for (const s of PIPELINE_STAGES) {
    dag[s.id] = {
      dependsOn: s.dependsOn,
      optional: s.optional,
      parallelizable: s.parallelizable,
    }
  }
  return dag
}
