/**
 * plugins/token-bridge.client.ts — 全局 Token 桥接
 * 
 * 将 token-cache 的核心方法挂载到 window.__token_cache 上，
 * 解决 Nuxt 3 SPA 模式下 browser 端 require 报错的问题。
 * 
 * 用法：window.__token_cache.getToken()
 */
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    // 动态导入 token-cache 并挂载到 window 上
    import('~/utils/token-cache').then(mod => {
      ;(window as any).__token_cache = {
        getToken: mod.getToken,
        setToken: mod.setToken,
        getUser: mod.getUser,
        setUser: mod.setUser,
        clearAuth: mod.clearAuth,
        isAuthenticated: mod.isAuthenticated,
      }
    })
  }
})
