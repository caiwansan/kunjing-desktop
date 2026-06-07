/**
 * plugins/build-meta-fallback.client.ts
 *
 * 修复：构建后浏览器缓存的旧 HTML 引用旧的 buildId，
 * 请求 /_nuxt/builds/meta/{旧buildId}.json 时 Nitro 返回 500，
 * 导致 "Error fetching app manifest" 页面崩溃。
 *
 * 检测到此类错误后自动硬刷新到最新版本。
 */
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // 监听 Nuxt 应用初始化错误
  nuxtApp.hook('app:error', (err: any) => {
    // 检测是否为 build manifest 404/500 错误
    const msg = err?.message || err?.toString?.() || ''
    if (msg.includes('builds/meta') || msg.includes('app manifest') || msg.includes('FetchError')) {
      console.warn('[BuildMeta] 检测到构建版本不一致，自动刷新...')

      // 尝试通过获取最新版本来检测是否已部署新版本
      fetch('/_nuxt/builds/latest.json', { cache: 'no-store' })
        .then(r => r.json())
        .then((latest: { id?: string }) => {
          if (latest.id) {
            // 清理当前页面 localStorage 中缓存的旧构建信息
            try {
              localStorage.removeItem('nuxt:buildId')
            } catch {}
            // 硬刷新到当前路径，获取最新的 HTML（包含新 buildId）
            window.location.reload()
          }
        })
        .catch(() => {
          // 如果也获取不到最新版本，10s 后重试刷新
          setTimeout(() => window.location.reload(), 10000)
        })
    }
  })

  // 也捕获全局未处理的 promise 错误
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason?.message || event.reason?.toString?.() || ''
      if (msg.includes('builds/meta') || msg.includes('FetchError')) {
        console.warn('[BuildMeta] 捕获到构建版本不一致，准备刷新...')
        event.preventDefault()
        setTimeout(() => window.location.reload(), 2000)
      }
    })
  }
})
