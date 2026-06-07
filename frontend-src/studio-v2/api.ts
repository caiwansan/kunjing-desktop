/**
 * 昆仑镜统一 API Client
 * 所有工作台通过此模块调用后端 API，方便统一维护路由路径
 */
import { getToken } from '../utils/token-cache'

const BASE_URL = '/api'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function request(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = `${BASE_URL}${path}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    // 清除 token 并重定向（如果不在登录页）
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    throw new Error('未登录或登录已过期')
  }

  return res.json()
}

// 常用 API 方法
export const api = {
  get: (path: string, params?: Record<string, string>) => request(path, { params }),
  post: (path: string, body?: any) => request(path, { method: 'POST', body }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body }),
  delete: (path: string) => request(path, { method: 'DELETE' }),

  // AI 任务
  tasks: {
    generate: (data: any) => request('/tasks/ai-generate', { method: 'POST', body: data }),
    status: (taskId: string) => request(`/tasks/${taskId}/status`),
  },

  // 脚本
  script: {
    regenerate: (data: any) => request('/script/regenerate', { method: 'POST', body: data }),
    optimize: (data: any) => request('/ai/optimize-shot-script', { method: 'POST', body: data }),
    optimizeVideo: (data: any) => request('/ai/optimize-video-prompt', { method: 'POST', body: data }),
    breakdown: (data: any) => request('/script-breakdown', { method: 'POST', body: data }),
  },

  // 执行图片
  executionImages: {
    getCharacters: (projectId: string) => request(`/execution-images/characters?projectId=${projectId}`),
    saveCharacters: (data: any) => request('/execution-images/characters', { method: 'PUT', body: data }),
    getScenes: (projectId: string) => request(`/execution-images/scenes?projectId=${projectId}`),
    saveScenes: (data: any) => request('/execution-images/scenes', { method: 'PUT', body: data }),
  },

  // 生成
  ad: {
    generateVideo: (data: any) => request('/ai/generate-ad-video', { method: 'POST', body: data }),
    optimizeScript: (data: any) => request('/ai/optimize-ad-script', { method: 'POST', body: data }),
  },
}
