/**
 * StorageGateway — 唯一的 localStorage 读取入口
 * 
 * 铁律：
 * 1. 所有组件禁止直接调用 localStorage.getItem/setItem
 * 2. 所有读写必须经过此 Gateway
 * 3. 业务 Key 在此注册，不准散落
 * 
 * 设计原则：
 * - get/set 带默认值、try/catch、JSON 自动解析
 * - 支持 future: schema 校验、migration、版本化
 * 
 * ⚠️ Token/User 类 Key 请使用 token-cache.ts 统一管理（内存 + localStorage 双写）
 */

// ============ 注册表 ============
// 所有 localStorage Key 必须在此声明用途

const STORAGE_KEYS = {
  // 会话层（token/user 改用 token-cache.ts 管理，此处仅作 key 引用）
  AUTH_TOKEN: 'auth_token',
  AUTH_USER: 'auth_user',
  ADMIN_USER: 'admin-aigc-user',

  // 状态层（应迁移到 DB，当前用此 gateway 治理）
  MODEL_CARD_PROVIDER_MAP: 'modelCardProviderMap',

  // 临时/UI 层（允许存 localStorage）
  CURRENT_PROJECT_ID: 'current_project_id',
  CURRENT_STORY_TEXT: 'current_story_text',
  STORY_INPUT_RAW: 'story_input_raw',
  EXEC_FRAME_IMAGES: 'exec_frame_images',
  EXEC_VIDEO_RESULTS: 'exec_video_results',
  DIRECTOR_USER: 'director-user',
  CHARACTER_STORAGE: 'studio-characters',
  STUDIO_SHOTS: 'studio_shots',
  NARRATIVE_RUNTIME: 'narrative_runtime',
  CURRENT_PROJECT_NAME: 'currentProjectName',
} as const

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

import { getToken, setToken, clearAuth } from './token-cache'

// ============ 核心访问 API ============

export function get<T = string>(key: StorageKey, defaultValue?: T): T | undefined {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    // 尝试 JSON 解析，失败则返回原字符串
    try {
      return JSON.parse(raw) as T
    } catch {
      // 若是普通字符串，JSON.parse 会失败，返回原字符串
      return raw as unknown as T
    }
  } catch (e) {
    console.warn(`[StorageGateway] get('${key}') failed:`, e)
    return defaultValue
  }
}

export function set(key: StorageKey, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, raw)
  } catch (e) {
    console.error(`[StorageGateway] set('${key}') failed:`, e)
  }
}

export function remove(key: StorageKey): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`[StorageGateway] remove('${key}') failed:`, e)
  }
}

// ============ 业务级方法（带迁移提示） ============

/** 获取 auth token — 通过 token-cache（内存优先） */
export function getAuthToken(): string {
  // Lazy import to avoid circular dependency; runtime call
  return getToken()
}

/** 设置 auth token — 通过 token-cache（内存 + localStorage 双写） */
export function setAuthToken(token: string): void {
  setToken(token)
}

/** 获取模型提供商映射（⚠️ 应迁移到 DB） */
export function getProviderMap(): Record<string, string> {
  return get<Record<string, string>>(STORAGE_KEYS.MODEL_CARD_PROVIDER_MAP, {}) ?? {}
}

/** 设置模型提供商映射（⚠️ 应迁移到 DB） */
export function setProviderMap(map: Record<string, string>): void {
  set(STORAGE_KEYS.MODEL_CARD_PROVIDER_MAP, map)
}

/** 获取当前项目 ID（⚠️ 应迁移到 DB） */
// ❌ REMOVED in Phase 2 — use projectKernel.projectId

/** 设置当前项目 ID（⚠️ 应迁移到 DB） */
// ❌ REMOVED in Phase 2 — use projectKernel.setProject()

// ============ 诊断 ============

/** 返回所有受监管的 localStorage key 及其类目 */
export function storageDiagnostics(): Record<string, { category: string; exists: boolean }> {
  const categories: Record<string, string> = {
    auth_token: '会话',
    auth_user: '会话',
    'admin-aigc-user': '会话',
    modelCardProviderMap: '⚠️ 应迁移',
    current_project_id: '⚠️ 应迁移',
    current_story_text: '⚠️ 应迁移',
    story_input_raw: '⚠️ 应迁移',
    exec_frame_images: '⚠️ 应迁移',
    exec_video_results: '⚠️ 应迁移',
    'director-user': '⚠️ 应迁移',
    'studio-characters': '⚠️ 应迁移',
    studio_shots: '⚠️ 应迁移',
    narrative_runtime: '⚠️ 应迁移',
    currentProjectName: '⚠️ 应迁移',
  }

  const result: Record<string, { category: string; exists: boolean }> = {}
  for (const [key, category] of Object.entries(categories)) {
    try {
      result[key] = { category, exists: localStorage.getItem(key) !== null }
    } catch {
      result[key] = { category, exists: false }
    }
  }
  return result
}

export { STORAGE_KEYS }
export default { get, set, remove }
