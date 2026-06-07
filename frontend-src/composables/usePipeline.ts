/**
 * Pipeline composable
 *
 * 数据库表驱动的组件流程管理。
 * DAG v1: 提供 graph 状态计算，UI 只做观察者。
 */

import { ref, computed } from 'vue'
import { apiKernel } from '~/core/runtime'
import { projectKernel } from '~/core/runtime'

export interface GraphNode {
  key: string
  status: string
  dependsOn: string[]
  blockedBy: string[]
  blockReason: string | null
  ready: boolean
  optional: boolean
  label: string
  error?: string | null
  outputData?: any
  referenceUrls?: any
}

export function usePipeline() {
  const projectId = computed(() => process.client ? (projectKernel.projectId || '') : '')

  /** 获取 DAG 全图状态 */
  async function getGraph(): Promise<GraphNode[]> {
    if (!projectId) return []
    try {
      const result = await apiKernel.execute({ url: `/api/pipeline/graph/${projectId}`, method: 'GET' })
      return result.data || []
    } catch {
      return []
    }
  }

  /** 获取项目所有 stage 状态（兼容旧版） */
  async function getStages() {
    if (!projectId) return []
    try {
      const result = await apiKernel.execute({ url: `/api/pipeline/stages/${projectId}`, method: 'GET' })
      return result.data || []
    } catch {
      return []
    }
  }

  /** 获取单个 stage */
  async function getStage(stageKey: string) {
    if (!projectId) return null
    try {
      const result = await apiKernel.execute({ url: `/api/pipeline/stage/${projectId}/${stageKey}`, method: 'GET' })
      return result.data || null
    } catch {
      return null
    }
  }

  /** 更新 stage（包括状态、输入、输出） */
  async function updateStage(stageKey: string, data: {
    status?: string
    inputData?: any
    outputData?: any
    referenceUrls?: any
    error?: string
  }) {
    if (!projectId) return
    try {
      await apiKernel.execute({ url: `/api/pipeline/stage/${projectId}/${stageKey}`, method: 'PUT', body: data })
    } catch (e) {
      console.error(`[Pipeline] updateStage ${stageKey} failed`, e)
    }
  }

  /** 手动触发重算阻塞信息 */
  async function recalcGraph() {
    if (!projectId) return
    try {
      await apiKernel.execute({ url: '/api/pipeline/graph/recalc', method: 'POST', body: { projectId } })
    } catch (e) {
      console.error('[Pipeline] recalcGraph failed', e)
    }
  }

  /** 检查前置依赖是否满足（基于 DAG） */
  async function checkPrerequisites(stageKey: string): Promise<{
    ready: boolean
    missing: string[]
    blockReason?: string | null
    graphStatus?: string
  }> {
    if (!projectId) return { ready: false, missing: ['未指定项目'] }
    try {
      const result = await apiKernel.execute({ url: `/api/pipeline/prerequisites/${projectId}/${stageKey}`, method: 'GET' })
      return result.data || { ready: false, missing: [] }
    } catch {
      return { ready: false, missing: ['网络错误'] }
    }
  }

  /** 获取参考图 */
  async function getReferenceImages(type: 'character_image' | 'scene_image' | 'storyboard_image' | 'frame_image') {
    if (!projectId) return []
    try {
      const result = await apiKernel.execute({ url: `/api/pipeline/references/${projectId}/${type}`, method: 'GET' })
      return result.data || []
    } catch {
      return []
    }
  }

  return {
    getGraph,
    getStages,
    getStage,
    updateStage,
    recalcGraph,
    checkPrerequisites,
    getReferenceImages,
    projectId,
  }
}
