import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // Skip auth check for login page
  if (to.path === '/login') {
    return
  }

  // 🛡️ Admin routes: check token existence in localStorage (no API call)
  if (to.path.startsWith('/admin/')) {
    // Skip the login page itself to avoid redirect loop
    if (to.path === '/admin/aigc/login') {
      return
    }
    const hasToken = import.meta.client
      ? !!window.localStorage?.getItem('auth_token')
      : false
    if (!hasToken && !auth.token) {
      return navigateTo('/admin/aigc/login')
    }
    return
  }

  // Protected routes: /studio/*, /dashboard/*, /user/*
  const isProtected = to.path.startsWith('/studio') || to.path.startsWith('/dashboard/') || to.path.startsWith('/user/')
  if (isProtected && !auth.isAuthenticated && !auth.token) {
    // Try to restore from cookie/localStorage before redirecting
    await auth.restoreSession()
    if (!auth.isAuthenticated) {
      return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath))
    }
  } else if (isProtected && auth.isAuthenticated) {
    // 已登录用户，从 API 刷新用户数据（确保会员级别同步）
    await auth.restoreSession()
  }
})
