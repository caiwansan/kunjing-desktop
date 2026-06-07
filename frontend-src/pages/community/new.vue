<template>
  <div class="new-post-page">
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
              <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">{{ avatarChar }}</div>
              <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">{{ tierLabel }}</span>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <div class="page-content">
      <NuxtLink to="/community" class="back-link">← 返回社区</NuxtLink>

      <div class="form-card">
        <h1 class="form-title">发布新帖子</h1>
        <p class="form-desc">分享你的 AI 创作、技巧或疑问</p>

        <form @submit.prevent="submitPost" class="post-form">
          <div class="form-group">
            <label>标题</label>
            <input v-model="title" type="text" placeholder="给你的帖子起个标题" class="form-input" maxlength="100" />
          </div>

          <div class="form-group">
            <label>分类</label>
            <select v-model="category" class="form-select">
              <option value="">选择分类...</option>
              <option v-for="cat in categories" :key="cat.slug" :value="cat.slug">{{ cat.icon || '#' }} {{ cat.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>内容</label>
            <div class="content-editor-area">
              <textarea
                ref="contentTextarea"
                v-model="content"
                placeholder="写下你的内容...&#10;&#10;点击下方按钮插入图片或视频，标记会出现在光标位置或末尾"
                rows="10"
                class="form-textarea"
              />
              <div class="content-toolbar">
                <button class="btn btn-tool" @click.prevent="$refs.imageInput.click()">
                  📷 插入图片
                </button>
                <button class="btn btn-tool" @click.prevent="$refs.videoInput.click()">
                  🎥 插入视频
                </button>
                <span v-if="uploadingText" class="upload-status">{{ uploadingText }}</span>
                <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="onFileChange($event, 'image')" />
                <input ref="videoInput" type="file" accept="video/*" style="display:none" @change="onFileChange($event, 'video')" />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>标签（可选，逗号分隔）</label>
            <input v-model="tags" type="text" placeholder="如: AI, 短剧, 角色设计" class="form-input" />
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <div class="form-actions">
            <NuxtLink to="/community" class="btn btn-ghost">取消</NuxtLink>
            <button type="submit" class="btn btn-primary" :disabled="!title.trim() || !content.trim() || submitting">
              {{ submitting ? '发布中...' : '发布帖子' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 登录 Modal（简化版） -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-card">
        <button class="modal-close" @click="showLogin = false">✕</button>
        <div class="modal-header">
          <img src="/logo.png" alt="" class="modal-logo" />
          <h2>{{ isRegisterMode ? '创建账号' : '登录' }}</h2>
        </div>
        <div class="modal-body">
          <div class="input-group"><input v-model="authEmail" type="email" placeholder="邮箱" class="modal-input" /></div>
          <div v-if="isRegisterMode" class="input-group"><input v-model="authName" type="text" placeholder="用户名" class="modal-input" /></div>
          <div class="input-group"><input v-model="authPassword" type="password" placeholder="密码" class="modal-input" /></div>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
          <button class="modal-btn" :disabled="authLoading" @click="doAuth">{{ authLoading ? '处理中...' : (isRegisterMode ? '注册' : '登录') }}</button>
          <p class="modal-switch" @click="isRegisterMode = !isRegisterMode">{{ isRegisterMode ? '已有账号？去登录' : '没有账号？去注册' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)
const authEmail = ref('')
const authName = ref('')
const authPassword = ref('')
const authError = ref('')
const authLoading = ref(false)

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

const title = ref('')
const content = ref('')
const category = ref('')
const tags = ref('')
const error = ref('')
const submitting = ref(false)
const categories = ref<Array<{ slug: string; name: string; icon?: string }>>([])

// 内容编辑区 ref
const contentTextarea = ref<HTMLTextAreaElement | null>(null)
const uploadingText = ref('')

function goToStudio() { router.push('/studio/v2') }
function goMemberCenter() { router.push('/user/center') }

async function doAuth() {
  authError.value = ''
  if (!authEmail.value || !authPassword.value) { authError.value = '请输入邮箱和密码'; return }
  if (isRegisterMode.value && !authName.value.trim()) { authError.value = '请输入用户名'; return }
  authLoading.value = true
  try {
    const url = isRegisterMode.value ? '/api/auth/register' : '/api/auth/login'
    const body: any = isRegisterMode.value
      ? { username: authName.value, email: authEmail.value, password: authPassword.value, code: '' }
      : { email: authEmail.value, password: authPassword.value }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '操作失败')
    const token = data.accessToken || data.token
    if (token) {
      const { setToken, setUser } = await import('~/utils/token-cache')
      setToken(token)
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      if (data.user) setUser(data.user)
      isLoggedIn.value = true
      authUser.value = data.user
      showLogin.value = false
    }
  } catch (err: any) { authError.value = err.message }
  finally { authLoading.value = false }
}

async function onFileChange(event: Event, type: 'image' | 'video') {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  const formData = new FormData()
  formData.append('file', file)

  uploadingText.value = `正在上传 ${file.name}...`
  try {
    const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '上传失败')

    // 在 content 末尾插入标记
    const tag = type === 'image' ? `[img:${data.url}]` : `[video:${data.url}]`
    content.value = (content.value || '') + '\n' + tag + '\n'

    // 滚动到输入框底部
    await nextTick()
    if (contentTextarea.value) {
      contentTextarea.value.scrollTop = contentTextarea.value.scrollHeight
    }
  } catch (err: any) {
    error.value = `上传失败: ${err.message}`
  }

  uploadingText.value = ''
  input.value = '' // reset
}

onMounted(async () => {
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) { try { authUser.value = JSON.parse(authUserRaw) } catch {} }
  try {
    const res = await fetch('/api/community/categories')
    const data = await res.json()
    categories.value = data.categories || []
  } catch {}
})

async function submitPost() {
  if (!title.value.trim() || !content.value.trim()) { error.value = '标题和内容不能为空'; return }
  submitting.value = true; error.value = ''

  try {
    const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
    if (!token) { error.value = '请先登录'; return }

    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.value.trim(),
        content: content.value.trim(),
        category: category.value,
        tags: tags.value.trim(),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发布失败')
    router.push(`/community/post/${data.post.id}`)
  } catch (err: any) { error.value = err.message || '发布失败，请重试' }
  finally { submitting.value = false }
}
</script>

<style scoped>
.new-post-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 导航栏 */
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
.logo-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
.nav-logo-img { width: 28px; height: 28px; border-radius: 6px; }
.logo-text { font-size: 1rem; font-weight: 600; color: #fff; }
.nav-links { display: flex; gap: 24px; flex: 1; }
.nav-link { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
.nav-link:hover, .nav-link-active { color: rgba(255,255,255,0.8); }
.nav-actions { display: flex; align-items: center; gap: 10px; }
.nav-user-badge { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background 0.2s; }
.nav-user-badge:hover { background: rgba(255,255,255,0.04); }
.nav-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 600; color: #fff;
}
.nav-user-avatar--basic { background: #6b7280; }
.nav-user-avatar--standard { background: #3b82f6; }
.nav-user-avatar--premium { background: #8b5cf6; }
.nav-user-avatar--flagship { background: #f59e0b; }
.nav-user-avatar--ultra { background: linear-gradient(135deg, #f97316, #ef4444); }
.nav-tier-tag {
  font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 500;
}
.nav-tier-tag--basic { background: rgba(107,114,128,0.15); color: #9ca3af; }
.nav-tier-tag--standard { background: rgba(59,130,246,0.15); color: #60a5fa; }
.nav-tier-tag--premium { background: rgba(139,92,246,0.15); color: #a78bfa; }
.nav-tier-tag--flagship { background: rgba(245,158,11,0.15); color: #fbbf24; }
.nav-tier-tag--ultra { background: rgba(249,115,22,0.15); color: #fb923c; }

@media (max-width: 768px) { .nav-links { display: none; } }

.page-content {
  max-width: 700px;
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
.back-link:hover { color: #f97316; }

.form-card {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 32px;
}
.form-title { font-size: 1.4rem; font-weight: 700; color: #fff; margin: 0 0 6px; }
.form-desc { font-size: 0.85rem; color: rgba(255,255,255,0.35); margin: 0 0 28px; }

.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 0.78rem;
  color: rgba(255,255,255,0.4); margin-bottom: 6px; font-weight: 500;
}
.form-input, .form-select, .form-textarea {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: rgba(249,115,22,0.4); }
.form-select { cursor: pointer; appearance: auto; }
.form-textarea { resize: vertical; min-height: 200px; line-height: 1.6; }

/* 媒体上传 */
/* 内容编辑区 */
.content-editor-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.content-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.upload-status {
  font-size: 0.78rem;
  color: rgba(249,115,22,0.6);
  margin: 0;
}
  width: 20px; height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.7);
  color: #fff;
  font-size: 0.65rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
.upload-status { font-size: 0.78rem; color: rgba(249,115,22,0.6); margin: 0; }

.form-error { color: #ef4444; font-size: 0.8rem; margin-bottom: 16px; text-align: center; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }

.btn {
  padding: 10px 24px; border-radius: 10px; font-size: 0.85rem; font-weight: 500;
  cursor: pointer; border: none; transition: all 0.2s;
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
}
.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c); color: #fff;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(249,115,22,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  background: transparent; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.06);
}
.btn-ghost:hover { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.1); }
.btn-tool {
  background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.06); font-size: 0.78rem;
  padding: 6px 14px; border-radius: 8px;
}
.btn-tool:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
.btn-outline {
  background: transparent; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); padding: 8px 18px;
  border-radius: 10px; font-size: 0.85rem; font-weight: 500; cursor: pointer;
}
.btn-outline:hover { border-color: rgba(255,255,255,0.2); color: #fff; }

/* 登录 Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}
.modal-card {
  width: 88%; max-width: 340px;
  background: #0d0d12; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px; padding: 28px 24px; position: relative;
}
.modal-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 1.2rem; cursor: pointer; }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-logo { width: 36px; height: 36px; border-radius: 8px; margin-bottom: 8px; }
.modal-header h2 { font-size: 1.1rem; font-weight: 600; color: #fff; margin: 0; }
.modal-body { display: flex; flex-direction: column; gap: 12px; }
.input-group { margin: 0; }
.modal-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 12px 14px; font-size: 0.85rem; color: rgba(255,255,255,0.7); outline: none; font-family: inherit;
}
.modal-input:focus { border-color: rgba(249,115,22,0.4); }
.auth-error { color: #ef4444; font-size: 0.78rem; text-align: center; margin: 0; }
.modal-btn {
  width: 100%; padding: 12px; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; border: none; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; transition: all 0.2s;
}
.modal-btn:disabled { opacity: 0.5; }
.modal-switch { text-align: center; font-size: 0.78rem; color: rgba(249,115,22,0.5); cursor: pointer; margin: 4px 0 0; }
</style>
