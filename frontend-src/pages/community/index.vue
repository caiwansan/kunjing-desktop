<template>
  <div class="community-page">
    <!-- 导航栏（与首页同步） -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <a href="/" class="nav-link">首页</a>
          <a href="/community" class="nav-link nav-link-active">社区</a>
        </div>
        <div class="nav-actions">
          <button v-if="!isLoggedIn" class="btn btn-outline" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="btn btn-primary" @click="showLogin = true; isRegisterMode = true">免费注册</button>
          <template v-else>
            <button class="btn btn-primary" @click="goToStudio">进入工作台 →</button>
            <div class="nav-user-badge" @click="goMemberCenter" title="会员中心">
              <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
                {{ avatarChar }}
              </div>
              <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
                {{ tierLabel }}
              </span>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <CommunityHero />

    <div class="page-content">
      <!-- 分类 Tabs -->
      <div class="category-tabs">
        <button
          :class="['tab-btn', !activeCategory && 'tab-active']"
          @click="activeCategory = ''"
        >
          全部
        </button>
        <button
          v-for="cat in categories"
          :key="cat.slug"
          :class="['tab-btn', activeCategory === cat.slug && 'tab-active']"
          @click="activeCategory = cat.slug"
        >
          {{ cat.icon || '#' }} {{ cat.name }}
        </button>
        <NuxtLink to="/community/new" class="btn btn-primary btn-sm" style="margin-left:auto;">✏️ 发帖</NuxtLink>
      </div>

      <div class="content-layout">
        <!-- 左侧：帖子列表 -->
        <div class="posts-section">
          <div v-if="loading" class="loading-state">
            <div class="spinner" />
            <p>加载中...</p>
          </div>

          <div v-else-if="posts.length === 0" class="empty-state">
            <p class="empty-icon">📭</p>
            <p>暂无帖子，来发布第一条吧！</p>
            <NuxtLink to="/community/new" class="btn btn-primary">发布帖子</NuxtLink>
          </div>

          <div v-else class="posts-list">
            <CommunityPostCard v-for="post in posts" :key="post.id" :post="post" />
          </div>

          <!-- 分页 -->
          <div v-if="pagination && pagination.totalPages > 1" class="pagination">
            <button
              :disabled="pagination.page <= 1"
              class="page-btn"
              @click="changePage(pagination.page - 1)"
            >
              上一页
            </button>
            <span class="page-info">{{ pagination.page }} / {{ pagination.totalPages }}</span>
            <button
              :disabled="pagination.page >= pagination.totalPages"
              class="page-btn"
              @click="changePage(pagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </div>

        <!-- 右侧：侧边栏 -->
        <aside class="sidebar">
          <!-- 置顶帖 -->
          <div v-if="sidebar.pinned.length > 0" class="sidebar-card">
            <div class="sidebar-card-title">📌 置顶</div>
            <NuxtLink
              v-for="p in sidebar.pinned"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.commentCount }} 💬</span>
            </NuxtLink>
          </div>

          <!-- 精华帖 -->
          <div v-if="sidebar.essence.length > 0" class="sidebar-card">
            <div class="sidebar-card-title">⭐ 精华</div>
            <NuxtLink
              v-for="p in sidebar.essence"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.commentCount }} 💬</span>
            </NuxtLink>
          </div>

          <!-- 热门帖 -->
          <div v-if="sidebar.hot.length > 0" class="sidebar-card">
            <div class="sidebar-card-title">🔥 热门</div>
            <NuxtLink
              v-for="p in sidebar.hot"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.viewCount }} 👁️</span>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </div>
  </div>

  <!-- 登录/注册弹窗 -->
  <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
    <div class="modal-card">
      <button class="modal-close" @click="showLogin = false">✕</button>
      
      <div class="modal-header">
        <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
        <h2>{{ isRegisterMode ? '创建账号' : '登录昆仑镜' }}</h2>
        <p>{{ isRegisterMode ? '开启 AI 影视制作之旅' : '回到你的工作空间' }}</p>
      </div>

      <!-- 登录/注册 Tab -->
      <div class="modal-tabs">
        <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">登录</button>
        <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">注册</button>
      </div>

      <form @submit.prevent="doAuth" class="modal-form">
        <div v-if="isRegisterMode" class="form-group">
          <label>用户名</label>
          <input v-model="authName" type="text" placeholder="输入用户名" class="form-input" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="authEmail" type="email" placeholder="your@email.com" class="form-input" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="authPassword" type="password" placeholder="至少 6 位" class="form-input" />
        </div>

        <p v-if="authError" class="form-error">{{ authError }}</p>
        <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>

        <button type="submit" class="btn btn-primary btn-full" :disabled="authLoading">
          {{ authLoading ? '处理中...' : (isRegisterMode ? '注册并进入' : '登录') }}
        </button>
      </form>

      <!-- 微信登录分隔线 -->
      <div class="wechat-divider">
        <span class="divider-line"></span>
        <span class="divider-text">其他登录方式</span>
        <span class="divider-line"></span>
      </div>
      <button type="button" class="btn-wechat" @click="wechatLogin" :disabled="wechatLoading">
        <span class="wechat-icon">💬</span>
        <span>{{ wechatLoading ? '跳转中...' : (wechatStatus.enabled ? '微信扫码登录' : '微信登录暂未开放') }}</span>
      </button>
      <button type="button" class="btn-qq" @click="qqLogin" :disabled="qqLoading">
        <span class="wechat-icon">🐧</span>
        <span>{{ qqLoading ? '跳转中...' : (qqStatus.enabled ? 'QQ扫码登录' : 'QQ登录暂未开放') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  postCount: number
}

interface Post {
  id: string
  title: string
  content: string
  tags: string
  category: string
  viewCount: number
  likeCount: number
  commentCount: number
  isPinned: boolean
  isEssence: boolean
  createdAt: string
  user?: { id: string; username: string }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const categories = ref<Category[]>([])
const posts = ref<Post[]>([])
const pagination = ref<Pagination | null>(null)
const sidebar = ref<{ pinned: any[]; essence: any[]; hot: any[] }>({ pinned: [], essence: [], hot: [] })
const activeCategory = ref('')
const loading = ref(true)
const currentPage = ref(1)

// --- 登录状态（与首页同步） ---
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)

const tierClass = computed(() => {
  const coins = authUser.value?.coins ?? 0
  if (coins >= 10000) return 'ultra'
  if (coins >= 5000) return 'flagship'
  if (coins >= 1000) return 'premium'
  if (coins >= 500) return 'standard'
  return 'basic'
})
const tierLabel = computed(() => {
  const map: Record<string, string> = { ultra: '至尊', flagship: '旗舰', premium: '高级', standard: '标准', basic: '基础' }
  return map[tierClass.value] || '基础'
})
const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goToStudio() {
  router.push('/studio/v2')
}
function goMemberCenter() {
  router.push('/user/center')
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/community/categories')
    const data = await res.json()
    categories.value = data.categories || []
  } catch (err) {
    console.error('Failed to fetch categories:', err)
  }
}

async function fetchPosts() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', '20')
    if (activeCategory.value) {
      params.set('categorySlug', activeCategory.value)
    }
    const res = await fetch(`/api/community/posts?${params.toString()}`)
    const data = await res.json()
    posts.value = data.posts || []
    pagination.value = data.pagination || null
  } catch (err) {
    console.error('Failed to fetch posts:', err)
    posts.value = []
  } finally {
    loading.value = false
  }
}

async function fetchSidebar() {
  try {
    const res = await fetch('/api/community/sidebar')
    const data = await res.json()
    sidebar.value = { pinned: data.pinned || [], essence: data.essence || [], hot: data.hot || [] }
  } catch (err) {
    console.error('Failed to fetch sidebar:', err)
  }
}

function changePage(page: number) {
  currentPage.value = page
  fetchPosts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(activeCategory, () => {
  currentPage.value = 1
  fetchPosts()
})

onMounted(() => {
  // 登录态检查
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) {
    try { authUser.value = JSON.parse(authUserRaw) } catch {}
  }

  fetchCategories()
  fetchPosts()
  fetchSidebar()
})

// ─── 登录相关 ───
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const authSuccess = ref('')
const wechatLoading = ref(false)
const wechatStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
const qqStatus = ref({ enabled: false, appId: '' })

let oauthListener: ((e: MessageEvent) => void) | null = null

function startOAuth(authUrl: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) { window.location.href = authUrl; return }
  if (oauthListener) { window.removeEventListener('message', oauthListener) }
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') { onSuccess(e.data.token, e.data.user); window.removeEventListener('message', oauthListener!); oauthListener = null }
    else if (e.data?.type === 'OAUTH_ERROR') { onError(e.data.error); window.removeEventListener('message', oauthListener!); oauthListener = null }
  }
  window.addEventListener('message', oauthListener)
  const pollClose = setInterval(() => {
    if (w.closed) { clearInterval(pollClose); if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null; qqLoading.value = false; wechatLoading.value = false } }
  }, 1000)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true; authError.value = ''
  fetch('/api/auth/qq/authorize').then(r => r.json()).then(data => {
    const authUrl = data.data?.authUrl || data.authUrl
    if (authUrl) {
      startOAuth(authUrl, (token, user) => {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        setUser(user)
        isLoggedIn.value = true; showLogin.value = false; qqLoading.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }, (err) => { authError.value = err; qqLoading.value = false })
      qqLoading.value = false
    } else { authError.value = data.error || 'QQ登录启动失败'; qqLoading.value = false }
  }).catch(() => { authError.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

function wechatLogin() {
  if (!wechatStatus.value.enabled) return
  wechatLoading.value = true; authError.value = ''
  fetch('/api/auth/wechat/authorize').then(r => r.json()).then(data => {
    const authUrl = data.data?.authUrl || data.authUrl
    if (authUrl) {
      startOAuth(authUrl, (token, user) => {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        setUser(user)
        isLoggedIn.value = true; showLogin.value = false; wechatLoading.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }, (err) => { authError.value = err; wechatLoading.value = false })
      wechatLoading.value = false
    } else { authError.value = data.error || '微信登录启动失败'; wechatLoading.value = false }
  }).catch(() => { authError.value = '微信登录暂时不可用'; wechatLoading.value = false })
}

async function doAuth() {
  authError.value = ''; authSuccess.value = ''
  if (!authEmail.value || !authPassword.value) { authError.value = '请输入邮箱和密码'; return }
  if (isRegisterMode.value && !authName.value.trim()) { authError.value = '请输入用户名'; return }
  authLoading.value = true
  try {
    if (isRegisterMode.value) {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authName.value, email: authEmail.value, password: authPassword.value, code: '' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) { setUser(data.user) }
        isLoggedIn.value = true; showLogin.value = false; authSuccess.value = '注册成功！'
      }
    } else {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail.value, password: authPassword.value }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) { setUser(data.user) }
        isLoggedIn.value = true; showLogin.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }
    }
  } catch (e: any) { authError.value = e.message || '网络错误' }
  finally { authLoading.value = false }
}

// 检查第三方登录配置状态
fetch('/api/auth/qq/status').then(r => r.json()).then(d => { if (d.data) qqStatus.value = d.data }).catch(() => {})
fetch('/api/auth/wechat/status').then(r => r.json()).then(d => { if (d.data) wechatStatus.value = d.data }).catch(() => {})
</script>

<style scoped>
.community-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* === 导航栏（与首页同步） === */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(5,5,8,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-logo-img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
.logo-text {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}
.nav-links {
  display: flex;
  gap: 24px;
  flex: 1;
}
.nav-link {
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}
.nav-link:hover, .nav-link-active {
  color: rgba(255,255,255,0.8);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.nav-user-badge:hover {
  background: rgba(255,255,255,0.04);
}
.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
}
.nav-user-avatar--basic { background: #6b7280; }
.nav-user-avatar--standard { background: #3b82f6; }
.nav-user-avatar--premium { background: #8b5cf6; }
.nav-user-avatar--flagship { background: #f59e0b; }
.nav-user-avatar--ultra { background: linear-gradient(135deg, #f97316, #ef4444); }
.nav-tier-tag {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.nav-tier-tag--basic { background: rgba(107,114,128,0.15); color: #9ca3af; }
.nav-tier-tag--standard { background: rgba(59,130,246,0.15); color: #60a5fa; }
.nav-tier-tag--premium { background: rgba(139,92,246,0.15); color: #a78bfa; }
.nav-tier-tag--flagship { background: rgba(245,158,11,0.15); color: #fbbf24; }
.nav-tier-tag--ultra { background: rgba(249,115,22,0.15); color: #fb923c; }

.page-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px 60px;
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 24px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tab-btn {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.06);
  background: transparent;
  color: rgba(255,255,255,0.4);
  transition: all 0.2s;
}
.tab-btn:hover {
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.tab-active {
  background: rgba(249,115,22,0.1);
  border-color: rgba(249,115,22,0.3);
  color: #f97316;
}

/* Posts */
.posts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Loading & Empty */
.loading-state, .empty-state {
  text-align: center;
  padding: 60px 0;
  color: rgba(255,255,255,0.3);
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255,255,255,0.05);
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
}
.page-btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  color: rgba(255,255,255,0.5);
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: rgba(249,115,22,0.3);
  color: #f97316;
}
.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.page-info {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.3);
}

.btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}
.btn-sm {
  padding: 6px 14px;
  font-size: 0.78rem;
}
.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(249,115,22,0.3);
}
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.btn-outline:hover {
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}

/* 左右布局 */
.content-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.posts-section {
  flex: 3;
  min-width: 0;
}

/* 侧边栏 */
.sidebar {
  flex: 1;
  min-width: 220px;
  max-width: 300px;
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sidebar-card {
  background: rgba(255,255,255,0.012);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 14px;
}
.sidebar-card-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  margin-bottom: 10px;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  text-decoration: none;
  border-bottom: 1px solid rgba(255,255,255,0.02);
}
.sidebar-link:last-child { border-bottom: none; }
.sidebar-link-text {
  flex: 1;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}
.sidebar-link:hover .sidebar-link-text { color: rgba(249,115,22,0.7); }
.sidebar-link-meta {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.2);
  flex-shrink: 0;
}

@media (max-width: 768px) {
.nav-links { display: none; }
  .content-layout { flex-direction: column; }
  .sidebar { width: 100%; position: static; }
}

/* ─── 登录弹窗 ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-card {
  background: #0D1328;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 32px 28px 28px;
  width: 400px;
  max-width: 92vw;
  position: relative;
  animation: modalIn 0.2s ease;
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.modal-close {
  position: absolute;
  top: 14px; right: 16px;
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.modal-close:hover { color: #fff; }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header .logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.modal-logo-img { width: 48px; height: 48px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 600; color: #fff; margin: 0 0 6px; }
.modal-header p { font-size: 0.8rem; color: rgba(255,255,255,0.35); margin: 0; }
.modal-tabs {
  display: flex;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 24px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.tab-active {
  background: rgba(81,149,255,0.12);
  color: #5195ff;
  font-weight: 500;
}
.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
.modal-form .form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.modal-form .form-input:focus { border-color: rgba(81,149,255,0.4); }
.form-error { color: #f87171; font-size: 0.78rem; margin: 0 0 12px; }
.form-success { color: #34d399; font-size: 0.78rem; margin: 0 0 12px; }
.btn-full { width: 100%; padding: 10px; font-size: 0.9rem; border-radius: 10px; margin-top: 8px; }
@media (max-width: 480px) {
  .modal-card { width: 90%; margin: 0 16px; }
}
.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 14px;
}
.divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
.divider-text { font-size: 0.72rem; color: rgba(255,255,255,0.25); white-space: nowrap; }
.btn-wechat, .btn-qq {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.7);
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
}
.btn-wechat:hover:not(:disabled), .btn-qq:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
  border-color: rgba(81,149,255,0.3);
}
.btn-wechat:disabled, .btn-qq:disabled { opacity: 0.4; cursor: not-allowed; }
.wechat-icon { font-size: 1.1rem; }
</style>
