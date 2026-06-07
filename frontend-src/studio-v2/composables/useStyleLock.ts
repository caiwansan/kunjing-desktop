/**
 * useStyleLock.ts — 全局风格锁定 composable
 *
 * 当用户点击视频风格按钮时：
 * 1. 从后端加载 style_profiles 配置（无硬编码）
 * 2. 存储当前风格名称到 store
 * 3. 返回风格参数供各环节使用
 *
 * 使用：
 *   const { styleProfile, styleTokens, negativeTokens, buildPrompt, buildNegative, getModelRoute } = useStyleLock()
 *   const prompt = await buildPrompt('video', '一个女孩在跳舞')
 *   const videoModel = getModelRoute('video')
 */

import { ref, computed, readonly } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

export interface StyleProfileData {
  name: string
  displayName: string
  icon: string
  description: string
  styleTokens: string
  negativeTokens: string
  promptOverrides: Record<string, string>
  modelRoutes: {
    image?: { provider: string; model: string; params?: Record<string, any> }
    video?: { provider: string; model: string; params?: Record<string, any> }
    llm?: { provider: string; model: string; params?: Record<string, any> }
  }
  referenceImageUrl?: string
  parameters: Record<string, any>
}

// 全局缓存（避免重复请求）
let cachedProfiles: StyleProfileData[] | null = null
let cachedDefault: StyleProfileData | null = null

export function useStyleLock() {
  const store = useStudioStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const profiles = ref<StyleProfileData[]>([])
  const activeProfile = ref<StyleProfileData | null>(null)

  // 从 store 获取当前风格名
  const currentStyleName = computed(() => store.videoStyle.value || '3d')

  // 加载所有风格档案
  async function loadProfiles(): Promise<StyleProfileData[]> {
    if (cachedProfiles) {
      profiles.value = cachedProfiles
      return cachedProfiles
    }
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/v1/style-profiles')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        cachedProfiles = json.data as StyleProfileData[]
        cachedDefault = json.data.find((p: any) => p.isDefault) || json.data[0] || null
        profiles.value = cachedProfiles
        // 同步激活当前风格
        activeProfile.value = json.data.find((p: any) => p.name === currentStyleName.value) || cachedDefault
        return cachedProfiles
      }
      return []
    } catch (e: any) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  // 设置风格（同时更新 store）
  function setStyle(name: string) {
    store.setVideoStyle(name)
    const found = profiles.value.find(p => p.name === name) || cachedDefault
    activeProfile.value = found
    // ⭐ 标记风格已锁定
    if (found) {
      // styleLocked 由 store toggle 控制
    }
  }

  // 获取某个风格的 profile
  function getProfile(name?: string): StyleProfileData | null {
    if (!name || name === currentStyleName.value) return activeProfile.value
    return profiles.value.find(p => p.name === name) || cachedDefault
  }

  // 构建某环节的完整 prompt
  function buildPrompt(stage: string, userPrompt: string, styleName?: string): string {
    const profile = getProfile(styleName)
    if (!profile) return userPrompt

    // 优先使用环节覆盖模板
    const override = profile.promptOverrides?.[stage]
    if (override) {
      return override.replace(/\{\{prompt\}\}/g, userPrompt)
    }

    // 默认: 追加 styleTokens
    const tokens = (profile.styleTokens || '').trim()
    if (!tokens) return userPrompt
    if (stage === 'video' || stage === 'storyboard') {
      return `${userPrompt}，${tokens}`
    }
    return `${userPrompt}。${tokens}`
  }

  // 构建 negative prompt
  function buildNegative(userNegative: string, styleName?: string): string {
    const profile = getProfile(styleName)
    if (!profile) return userNegative

    const tokens = (profile.negativeTokens || '').trim()
    if (!tokens) return userNegative
    return userNegative ? `${userNegative}，${tokens}` : tokens
  }

  // 获取模型路由
  function getModelRoute(type: 'image' | 'video' | 'llm', styleName?: string): { provider: string; model: string; params?: Record<string, any> } | null {
    const profile = getProfile(styleName)
    if (!profile?.modelRoutes?.[type]) return null
    return profile.modelRoutes[type]!
  }

  // 获取画风参考图
  function getReferenceImage(styleName?: string): string | undefined {
    const profile = getProfile(styleName)
    return profile?.referenceImageUrl || undefined
  }

  // 获取额外参数
  function getParameters(styleName?: string): Record<string, any> {
    const profile = getProfile(styleName)
    return profile?.parameters || {}
  }

  // 刷新缓存
  function refresh() {
    cachedProfiles = null
    cachedDefault = null
    return loadProfiles()
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    profiles: readonly(profiles),
    activeProfile: readonly(activeProfile),
    currentStyleName,
    loadProfiles,
    setStyle,
    getProfile,
    buildPrompt,
    buildNegative,
    getModelRoute,
    getReferenceImage,
    getParameters,
    refresh,
  }
}
