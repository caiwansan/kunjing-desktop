import { defineNuxtRouteMiddleware } from '#app'
import { createError } from 'h3'

export default defineNuxtRouteMiddleware((to) => {
  // 已知所有有效路由列表（由 nuxt-pages 自动生成，这里做安全 fallback）
  const validPaths = [
    '/', '/login', '/mobile', '/projects',
    '/community', '/community/new',
    '/studio', '/studio/export',
    '/user/agent', '/user/center', '/user/credits', '/user/download',
    '/user/gallery', '/user/library', '/user/membership', '/user/messages',
    '/user/profile', '/user/projects', '/user/promo', '/user/referral', '/user/storage',
  ]

  // 动态路径匹配（/community/xxx, /studio/xxx, /user/xxx 的子路径）
  const path = to.path
  const matched = validPaths.includes(path) ||
    path.startsWith('/community/') ||
    path.startsWith('/studio/') ||
    path.startsWith('/user/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/api/')

  if (!matched) {
    // 重定向到 error 页面，Nuxt 会自动使用 error.vue 渲染
    throw createError({ statusCode: 404, statusMessage: 'Page Not Found', fatal: true })
  }
})
