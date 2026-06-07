<template>
  <div class="post-detail-page">
    <!-- 导航栏 -->
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
    <div class="page-content">
      <NuxtLink to="/community" class="back-link">← 返回社区</NuxtLink>

      <div v-if="loading" class="loading-state">
        <div class="spinner" />
        <p>加载中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <NuxtLink to="/community" class="back-link">返回社区</NuxtLink>
      </div>

      <template v-else-if="post">
        <!-- 帖子主体 -->
        <article class="post-main">
          <div class="post-header">
            <div class="post-badges">
              <span v-if="post.isPinned" class="badge badge-pin">📌 置顶</span>
              <span v-if="post.isEssence" class="badge badge-essence">⭐ 精华</span>
              <span class="badge badge-category">{{ post.category }}</span>
            </div>
            <h1 class="post-title">{{ post.title }}</h1>
            <div class="post-meta">
              <span class="meta-author">👤 {{ post.user?.username || '匿名' }}</span>
              <span>👁️ {{ post.viewCount }}</span>
              <span>👍 {{ post.likeCount }}</span>
              <span>💬 {{ post.commentCount }}</span>
              <span class="meta-time">{{ formatTime(post.createdAt) }}</span>
            </div>
          </div>

          <div class="post-content" v-html="renderContent(post.content)" />

          <!-- 附件媒体 -->
          <div v-if="postMedia.length > 0" class="post-media">
            <div v-for="(m, i) in postMedia" :key="i" class="post-media-item">
              <img v-if="m.type === 'image'" :src="m.url" class="post-media-img" @click="previewImage(m.url)" />
              <video v-else :src="m.url" class="post-media-video" controls />
            </div>
          </div>
        </article>

        <!-- 评论区 -->
        <section class="comments-section">
          <h2 class="section-title">评论 ({{ post.commentCount }})</h2>

          <!-- 评论输入 -->
          <div class="comment-form">
            <textarea
              v-model="commentContent"
              placeholder="写下你的评论..."
              rows="3"
              class="comment-input"
            />
            <button
              class="btn btn-primary"
              :disabled="!commentContent.trim() || submitting"
              @click="submitComment"
            >
              {{ submitting ? '提交中...' : '发表评论' }}
            </button>
          </div>

          <!-- 评论列表 -->
          <div v-if="post.comments && post.comments.length > 0" class="comments-list">
            <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
              <div class="comment-header">
                <span class="comment-author">👤 {{ comment.user?.username || '匿名' }}</span>
                <span class="comment-time">{{ formatTime(comment.createdAt) }}</span>
              </div>
              <div class="comment-content">{{ comment.content }}</div>
              <div class="comment-actions">
                <button class="action-btn" @click="toggleReply(comment.id)">
                  💬 回复 ({{ comment.replies?.length || 0 }})
                </button>
              </div>

              <!-- 回复表单 -->
              <div v-if="replyToId === comment.id" class="reply-form">
                <textarea
                  v-model="replyContent"
                  placeholder="回复..."
                  rows="2"
                  class="comment-input"
                />
                <button
                  class="btn btn-sm"
                  :disabled="!replyContent.trim() || submitting"
                  @click="submitReply(comment.id)"
                >
                  回复
                </button>
              </div>

              <!-- 子回复 -->
              <div v-if="comment.replies && comment.replies.length > 0" class="replies-list">
                <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                  <div class="comment-header">
                    <span class="comment-author">👤 {{ reply.user?.username || '匿名' }}</span>
                    <span class="comment-time">{{ formatTime(reply.createdAt) }}</span>
                  </div>
                  <div class="comment-content">{{ reply.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-comments">
            <p>暂无评论，来抢沙发吧！</p>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)
const post = ref<any>(null)
const loading = ref(true)
const error = ref('')
const commentContent = ref('')
const replyContent = ref('')
const replyToId = ref<string | null>(null)
const submitting = ref(false)

// 解析媒体附件
const postMedia = computed(() => {
  if (!post.value?.mediaJson) return []
  try {
    const parsed = typeof post.value.mediaJson === 'string'
      ? JSON.parse(post.value.mediaJson)
      : post.value.mediaJson
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
})

function previewImage(url: string) {
  window.open(url, '_blank')
}

/**
 * 安全的 HTML 净化 — 使用 DOMPurify CDN 方案
 * 在浏览器端动态加载 DOMPurify 脚本（无需 npm 安装），
 * 如果 DOMPurify 不可用，则回退到安全的纯文本模式。
 *
 * DOMPurify 是目前业界最成熟的 HTML 净化库，被 Mozilla、GitHub 等广泛使用，
 * 能防御包括但不限于：
 * - 各种 XSS payload（script、事件处理器、javascript: 等）
 * - SVG/namespace 污染攻击
 * - mXSS（突变 XSS）绕过
 * - HTML 实体编码混淆攻击
 *
 * Sanitizer API 兼容提醒：Chrome 105+ 支持原生 Sanitizer API，
 * 但考虑到兼容性和成熟度，此处优先使用 DOMPurify。
 */
const DOMPURIFY_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js'

function sanitizeHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') return html

  // 检测 DOMPurify 是否已加载
  const purify = (window as any).DOMPurify
  if (purify?.sanitize) {
    return purify.sanitize(html, {
      ALLOWED_TAGS: ['a', 'img', 'video', 'source', 'br', 'p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: ['href', 'src', 'target', 'rel', 'class', 'controls', 'alt', 'title', 'width', 'height'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['style', 'form', 'input', 'textarea', 'select', 'button', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'math', 'noscript'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange'],
    })
  }

  // 回退方案 — 纯文本模式（不渲染任何 HTML）
  const div = document.createElement('div')
  div.textContent = html
  return div.innerHTML
}

/**
 * 异步加载 DOMPurify（非阻塞），只加载一次
 */
let dompurifyLoading = false
function ensureDompurify(): void {
  if (typeof window === 'undefined') return
  if ((window as any).DOMPurify || dompurifyLoading) return
  dompurifyLoading = true
  const script = document.createElement('script')
  script.src = DOMPURIFY_CDN
  script.async = true
  script.onload = () => { dompurifyLoading = false }
  script.onerror = () => { dompurifyLoading = false; console.warn('[Sanitize] DOMPurify 加载失败，使用纯文本回退') }
  document.head.appendChild(script)
}

function renderContent(text: string): string {
  if (!text) return ''
  // 转义 HTML — 先完全转义，再安全地替换自定义标记
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // 图片标记 [img:URL]
  html = html.replace(/\[img:([^\]]+)\]/g, (_match, url) => {
    return `<div class="inline-media"><a href="${url}" target="_blank" rel="noopener" class="post-link"><img src="${url}" class="inline-img" loading="lazy" /></a></div>`
  })
  // 视频标记 [video:URL]
  html = html.replace(/\[video:([^\]]+)\]/g, (_match, url) => {
    return `<div class="inline-media"><video src="${url}" class="inline-video" controls preload="none"></video></div>`
  })
  // 超链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${linkText}</a>`
  })
  // 纯 URL 自动转链接
  html = html.replace(/(https?:\/\/[^\s<]+)/g, (_match, url) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${url}</a>`
  })
  // 换行转 <br>
  html = html.replace(/\n/g, '<br />')
  // 最终安全净化
  html = sanitizeHtml(html)
  return html
}

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
function goToStudio() { router.push('/studio/v2') }
function goMemberCenter() { router.push('/user/center') }

async function fetchPost() {
  loading.value = true
  try {
    const res = await fetch(`/api/community/posts/${route.params.id}`)
    if (!res.ok) {
      throw new Error('帖子不存在或已被删除')
    }
    const data = await res.json()
    post.value = data.post
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function toggleReply(commentId: string) {
  replyToId.value = replyToId.value === commentId ? null : commentId
  replyContent.value = ''
}

async function submitComment() {
  if (!commentContent.value.trim()) return
  submitting.value = true
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        postId: route.params.id,
        content: commentContent.value.trim(),
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '提交失败')
    }
    commentContent.value = ''
    fetchPost()
  } catch (err: any) {
    alert(err.message)
  } finally {
    submitting.value = false
  }
}

async function submitReply(parentId: string) {
  if (!replyContent.value.trim()) return
  submitting.value = true
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        postId: route.params.id,
        content: replyContent.value.trim(),
        parentId,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '提交失败')
    }
    replyContent.value = ''
    replyToId.value = null
    fetchPost()
  } catch (err: any) {
    alert(err.message)
  } finally {
    submitting.value = false
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  isLoggedIn.value = !!token
  try {
    const authUserRaw = window.localStorage?.getItem("auth_user")
    if (authUserRaw) {
      try { authUser.value = JSON.parse(authUserRaw) } catch {}
    }
  } catch {}
  // 异步加载 DOMPurify（非阻塞），确保渲染帖子内容时安全工具已就绪
  ensureDompurify()
  fetchPost()
})
</script>

<style scoped>
.post-detail-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* === 导航栏 === */
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
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline:hover {
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}

@media (max-width: 768px) {
  .nav-links { display: none; }
}

.page-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 24px 60px;
}
.back-link {
  display: inline-block;
  color: rgba(249,115,22,0.6);
  text-decoration: none;
  font-size: 0.85rem;
  margin-bottom: 20px;
  transition: color 0.2s;
}
.back-link:hover {
  color: #f97316;
}

/* Loading & Error */
.loading-state, .error-state {
  text-align: center;
  padding: 60px 0;
  color: rgba(255,255,255,0.3);
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
@keyframes spin { to { transform: rotate(360deg); } }

/* Post */
.post-main {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 32px;
}
.post-header { margin-bottom: 24px; }
.post-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.badge {
  font-size: 0.65rem;
  padding: 2px 10px;
  border-radius: 6px;
  font-weight: 600;
}
.badge-pin { background: rgba(249,115,22,0.1); color: #f97316; }
.badge-essence { background: rgba(250,204,21,0.1); color: #eab308; }
.badge-category { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); }
.post-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px;
  line-height: 1.3;
}
.post-meta {
  display: flex;
  gap: 16px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.25);
  flex-wrap: wrap;
}
.meta-author { color: rgba(249,115,22,0.6); }
.meta-time { margin-left: auto; }
.post-content {
  font-size: 0.95rem;
  line-height: 1.8;
  color: rgba(255,255,255,0.7);
  white-space: normal;
}
.post-link {
  color: #60a5fa;
  text-decoration: underline;
  transition: color 0.2s;
}
.post-link:hover { color: #93c5fd; }

/* 附件媒体 */
.post-media {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.post-media-item {
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.04);
}
.post-media-img {
  width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s;
}
.post-media-img:hover { opacity: 0.9; }
.post-media-video {
  width: 100%;
  display: block;
  max-height: 400px;
}

/* 内联媒体（图文混排） */
.inline-media {
  margin: 12px 0;
  max-width: 500px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.04);
}
.inline-img {
  width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s;
}
.inline-img:hover { opacity: 0.9; }
.inline-video {
  width: 100%;
  display: block;
  max-height: 400px;
}

/* Comments */
.comments-section { margin-top: 24px; }
.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 20px;
}

.comment-form {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}
.comment-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 12px;
}
.comment-input:focus {
  border-color: rgba(249,115,22,0.4);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.comment-item {
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 16px 20px;
}
.comment-header {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.25);
  margin-bottom: 8px;
}
.comment-author { color: rgba(249,115,22,0.5); }
.comment-content {
  font-size: 0.88rem;
  line-height: 1.6;
  color: rgba(255,255,255,0.65);
  margin-bottom: 8px;
}
.comment-actions {
  display: flex;
  gap: 12px;
}
.action-btn {
  font-size: 0.75rem;
  cursor: pointer;
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  padding: 4px 0;
  transition: color 0.2s;
}
.action-btn:hover { color: rgba(249,115,22,0.6); }

.reply-form {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid rgba(249,115,22,0.15);
}
.replies-list {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 1px solid rgba(255,255,255,0.04);
}
.reply-item {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.02);
}
.reply-item:last-child { border-bottom: none; }

.no-comments {
  text-align: center;
  padding: 40px;
  color: rgba(255,255,255,0.3);
}

.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm {
  padding: 6px 14px;
  font-size: 0.75rem;
  background: rgba(249,115,22,0.1);
  color: #f97316;
  border: 1px solid rgba(249,115,22,0.2);
}
.btn-sm:hover { background: rgba(249,115,22,0.15); }
</style>
