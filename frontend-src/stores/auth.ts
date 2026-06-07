import { defineStore } from 'pinia'
import { getToken as getCachedToken, setToken, clearAuth, setUser as setCachedUser, getUser as getCachedUser } from '~/utils/token-cache'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    user: null as null | { id: string; username: string; email: string; credits?: number; memberTier?: string },
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    userName: (state) => state.user?.username || state.user?.email?.split('@')[0] || '用户',
    credits: (state) => 0,
    memberTier: (state) => state.user?.memberTier || 'free',
  },
  actions: {
    /**
     * 获取 token — 优先返回内存变量（Pinia state），再 fallback token-cache（内存→localStorage）。
     * 内存层防御 XSS 窃取：注入脚本可读 localStorage 但无法读 JS 内存闭包。
     */
    getToken(): string {
      return this.token || (process.client ? getCachedToken() : '')
    },

    /**
     * 将 token 同时写入 Pinia state + token-cache（内存 + localStorage 双写）
     */
    setTokenToStore(token: string): void {
      this.token = token
      setToken(token)
    },

    async login(email: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || err.message || '登录失败')
      }
      const data = await res.json()
      const token = data.accessToken || data.token
      if (!token) throw new Error('服务器未返回 token')

      this.token = token
      this.user = data.user || null

      // Persist to cookie + token-cache（内存 + localStorage）
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      setToken(token)
      if (this.user) {
        setCachedUser(this.user as Record<string, any>)
        document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
      }
    },
    async loginByPhone(phone: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || err.message || '登录失败')
      }
      const data = await res.json()
      const token = data.accessToken || data.token
      if (!token) throw new Error('服务器未返回 token')

      this.token = token
      this.user = data.user || null

      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      setToken(token)
      if (this.user) {
        setCachedUser(this.user as Record<string, any>)
        document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
      }
    },
    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` } })
      } catch { /* ignore */ }
      this.token = ''
      this.user = null
      // 统一清除：token-cache（内存 + localStorage + cookie）
      clearAuth()
    },
    async fetchMe(forceRefresh?: boolean) {
      if (!this.token) return
      // 如果强制刷新或 user 为空，从 API 重新拉取
      if (!forceRefresh && this.user) return
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` },
        })
        if (!res.ok) throw new Error('Session expired')
        const data = await res.json()
        if (data.user) {
          this.user = data.user
          // 同步更新 token-cache（内存 + localStorage）
          setCachedUser(this.user as Record<string, any>)
          document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
        }
      } catch {
        this.token = ''
        this.user = null
        clearAuth()
      }
    },
    async restoreSession() {
      // Use token-cache for reading (memory → localStorage fallback)
      const cachedToken = getCachedToken()
      const stored = cachedToken || this._getCookie('auth_token')
      if (stored) {
        // Sync token cache with any found token
        if (!cachedToken && stored) setToken(stored)
        this.token = stored
        // 先尝试从 API 获取最新数据
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${stored}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.user) {
              this.user = data.user
              setCachedUser(this.user as Record<string, any>)
              document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
              return
            }
          }
        } catch { /* fallback to cache */ }

        // API 失败时 fallback 到 token-cache 缓存
        const cachedUser = getCachedUser()
        if (cachedUser) {
          this.user = cachedUser as any
        } else {
          const userStr = this._getCookie('auth_user')
          if (userStr) {
            try { this.user = JSON.parse(decodeURIComponent(userStr)) } catch { /* ignore */ }
          }
        }
      }
    },
    _getCookie(name: string): string {
      const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
      return match ? decodeURIComponent(match[2]) : ''
    },
  },
})
