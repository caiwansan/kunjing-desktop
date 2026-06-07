/**
 * token-cache.ts — 内存级 Token 缓存
 * 
 * 原则：
 * 1. 写入时：同时写入内存 + localStorage（双写）
 * 2. 读取时：优先读内存 → fallback localStorage
 * 3. 清除时：同时清除内存 + localStorage
 * 
 * 内存层防御 XSS 窃取：注入脚本可读 localStorage 但无法读 JS 内存闭包。
 * 
 * 兼容旧 key：auth_token, accessToken, token
 */

// 内存缓存（模块闭包，XSS 无法访问）
let _memoryToken = ''
let _memoryUser: Record<string, any> | null = null

// 尝试读取 localStorage
function safeLsGet(key: string): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

function safeLsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, val) } catch { /* quota exceeded */ }
}

function safeLsRemove(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// 优先读取的 key 列表
const TOKEN_KEYS = ['auth_token', 'accessToken', 'token']
const USER_KEY = 'auth_user'

/** 获取 token：内存 → fallback localStorage（按优先级） */
export function getToken(): string {
  if (_memoryToken) return _memoryToken
  for (const key of TOKEN_KEYS) {
    const val = safeLsGet(key)
    if (val) {
      _memoryToken = val
      return val
    }
  }
  return ''
}

/** 写入 token：内存 + localStorage（同时写入所有关键 key） */
export function setToken(token: string): void {
  _memoryToken = token
  for (const key of TOKEN_KEYS) {
    safeLsSet(key, token)
  }
}

/** 获取用户信息缓存：内存 → fallback localStorage */
export function getUser<T = Record<string, any>>(): T | null {
  if (_memoryUser) return _memoryUser as T
  const raw = safeLsGet(USER_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as T
      _memoryUser = parsed as Record<string, any>
      return parsed
    } catch {
      return null
    }
  }
  return null
}

/** 写入用户信息缓存：内存 + localStorage */
export function setUser(user: Record<string, any> | null): void {
  _memoryUser = user
  if (user) {
    safeLsSet(USER_KEY, JSON.stringify(user))
  } else {
    safeLsRemove(USER_KEY)
  }
}

/** 清除所有 token 和用户信息（内存 + localStorage） */
export function clearAuth(): void {
  _memoryToken = ''
  _memoryUser = null
  for (const key of TOKEN_KEYS) {
    safeLsRemove(key)
  }
  safeLsRemove(USER_KEY)
  // 也清除 cookies
  if (typeof document !== 'undefined') {
    document.cookie = 'auth_token=; path=/; max-age=0'
    document.cookie = 'auth_user=; path=/; max-age=0'
  }
}

/** 检查是否已登录（有 token 即认为已登录） */
export function isAuthenticated(): boolean {
  return !!getToken()
}

export default { getToken, setToken, getUser, setUser, clearAuth, isAuthenticated }
