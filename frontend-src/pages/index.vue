<template>
  <div class="landing-page">
    <!-- 背景：网格 + 光晕 -->
    <div class="bg-grid" />
    <div class="bg-glow top-left" />
    <div class="bg-glow bottom-right" />

    <!-- NAV -->
    <nav class="nav-bar" :class="{ 'nav-scrolled': scrolled }">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <a href="#features" class="nav-link">功能</a>
          <a href="#pipeline" class="nav-link">流程</a>
          <a href="#contact" class="nav-link">联系</a>
          <a href="/community" class="nav-link">社区</a>
        </div>
        <div class="nav-actions">
          <button v-if="!isLoggedIn" class="btn btn-outline btn-sm" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="btn btn-primary btn-sm" @click="showLogin = true; isRegisterMode = true">免费注册</button>
          <template v-else>
            <button class="btn btn-primary btn-sm" @click="goToStudio">进入工作台 →</button>
            <div class="nav-user-wrap" @click.stop="userDropdownOpen = !userDropdownOpen">
              <div class="nav-user-badge" title="账号">
                <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
                  {{ avatarChar }}
                </div>
                <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
                  {{ tierLabel }}
                </span>
              </div>
              <div v-if="userDropdownOpen" class="nav-user-dropdown">
                <div class="dropdown-item" @click="goMemberCenter">个人中心</div>
                <div class="dropdown-item dropdown-danger" @click="doLogout">退出账号</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot" />
          昆仑镜 · AI 短剧制作平台
        </div>
        <div class="hero-pipeline">
          <div v-for="(step, i) in steps" :key="i" class="hp-step">
            <div class="hp-step-top">
              <span class="hp-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="hp-icon">{{ step.icon }}</span>
            </div>
            <div class="hp-name">{{ step.name }}</div>
            <div class="hp-desc">{{ step.desc }}</div>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" @click="goToStudio">
            {{ isLoggedIn ? '开始创作' : '免费开始创作' }}
            <span class="btn-arrow">→</span>
          </button>
          <button class="btn btn-secondary btn-lg" @click="scrollTo('features')">
            了解详情
          </button>
        </div>
      </div>
    </section>

    <!-- 功能特性 -->
    <section id="features" class="section features-section">
      <div class="section-label">核心功能</div>
      <h2 class="section-title">AI 全流程赋能</h2>
      <div class="features-grid">
        <div class="feature-card" v-for="(feat, i) in features" :key="i">
          <div class="feature-icon">{{ feat.icon }}</div>
          <h3 class="feature-title">{{ feat.title }}</h3>
          <p class="feature-desc">{{ feat.desc }}</p>
          <div class="feature-tags">
            <span v-for="(tag, j) in feat.tags" :key="j" class="feature-tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section id="contact" class="section cta-section">
      <div class="cta-inner">
        <h2 class="cta-title">准备好创作你的第一部 AI 好剧了吗？</h2>
        <p class="cta-desc">无需专业影视知识，AI 导演帮你搞定一切</p>
        <button class="btn btn-primary btn-lg" @click="goToStudio">
          免费开始 <span class="btn-arrow">→</span>
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-row">
        <div class="footer-brand">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="footer-links">
          <a href="https://__API_HOST__" target="_blank">__API_HOST__</a>
        </div>
      </div>
      <div class="footer-divider" />
      <div class="footer-legal">
        <span>豫ICP备2025152782号-2 ｜ 增值电信业务经营许可证：豫B2-20260120</span>
      </div>
    </footer>

    <!-- ==================== 登录/注册 Modal ==================== -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-card">
        <button class="modal-close" @click="showLogin = false">✕</button>
        <div class="modal-header">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
          <h2>{{ isRegisterMode ? '创建账号' : '登录昆仑镜' }}</h2>
          <p>{{ isRegisterMode ? '开启 AI 影视制作之旅' : '回到你的工作空间' }}</p>
        </div>
        <div class="modal-tabs" v-if="!showResetPwd">
          <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">登录</button>
          <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">注册</button>
        </div>
        <form v-if="showResetPwd" @submit.prevent="doResetPwd" class="modal-form">
          <div class="modal-header" style="padding:0 0 12px">
            <h2 style="font-size:1.1rem">找回密码</h2>
            <p style="font-size:0.78rem">输入手机号，通过验证码重置密码</p>
          </div>
          <div class="form-group">
            <label>手机号</label><input v-model="resetPwdPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
          </div>
          <div class="form-group">
            <label>验证码</label>
            <div class="sms-code-row">
              <input v-model="resetPwdCode" type="text" placeholder="6 位验证码" class="form-input sms-code-input" maxlength="6" />
              <button type="button" class="btn btn-outline btn-sm-code" :disabled="resetPwdCountdown > 0 || resetPwdSending" @click="sendResetPwdCode">{{ resetPwdCountdown > 0 ? `${resetPwdCountdown}s` : '获取验证码' }}</button>
            </div>
            <p style="font-size:0.7rem; color:#999; margin:4px 0 0">每日仅能收 5 次短信验证码，请确认手机号正确后再获取</p>
          </div>
          <div class="form-group">
            <label>新密码</label><input v-model="resetPwdPassword" type="password" placeholder="至少 6 位" class="form-input" />
          </div>
          <div class="form-group">
            <label>确认新密码</label><input v-model="resetPwdConfirm" type="password" placeholder="再次输入新密码" class="form-input" />
          </div>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
          <button type="submit" class="btn btn-primary btn-full" :disabled="resetPwdLoading">{{ resetPwdLoading ? '处理中...' : '确认重置' }}</button>
          <button type="button" class="btn btn-ghost btn-full" style="margin-top:8px" @click="cancelResetPwd">返回登录</button>
        </form>
        <form v-else @submit.prevent="doAuth" class="modal-form">
          <div v-if="isRegisterMode" class="form-group">
            <label>用户名</label><input v-model="authName" type="text" placeholder="输入用户名" class="form-input" />
          </div>
          <div v-if="isRegisterMode" class="form-group">
            <label>手机号</label><input v-model="smsPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
          </div>
          <div v-if="!isRegisterMode" class="form-group">
            <label>账号/手机号</label><input v-model="smsPhone" type="text" placeholder="输入手机号或账号" class="form-input" />
          </div>
          <div class="form-group">
            <label>密码</label><input v-model="authPassword" type="password" placeholder="至少 6 位" class="form-input" />
          </div>
          <div v-if="needSmsCode" class="form-group">
            <label>验证码</label>
            <div class="sms-code-row">
              <input v-model="smsCode" type="text" placeholder="输入 6 位验证码" class="form-input sms-code-input" maxlength="6" />
              <button type="button" class="btn btn-outline btn-sm-code" :disabled="smsCountdown > 0 || smsLoading" @click="sendSmsCode">{{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}</button>
            </div>
            <p style="font-size:0.7rem; color:#999; margin:4px 0 0">每日仅能收 5 次短信验证码，请确认手机号正确后再获取</p>
          </div>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
          <button type="submit" class="btn btn-primary btn-full" :disabled="authLoading">{{ authLoading ? '处理中...' : (isRegisterMode ? '注册并进入' : '登录') }}</button>
          <div v-if="!isRegisterMode" class="reset-pwd-link" @click="openResetPwd">忘记密码？</div>
        </form>
        <template v-if="!showResetPwd">
          <div class="wechat-divider">
            <span class="divider-line"></span>
            <span class="divider-text">其他</span>
            <span class="divider-line"></span>
          </div>
          <div class="social-login-row">
            <button type="button" class="btn btn-outline btn-full" @click="wechatLogin" :disabled="wechatLoading">
              <span class="social-icon">💬</span>
              <span>{{ wechatLoading ? '跳转中...' : (wechatStatus.enabled ? '微信登录' : '微信暂未开放') }}</span>
            </button>
            <button type="button" class="btn btn-outline btn-full" @click="qqLogin" :disabled="qqLoading">
              <span class="social-icon">🐧</span>
              <span>{{ qqLoading ? '跳转中...' : (qqStatus.enabled ? 'QQ登录' : 'QQ暂未开放') }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showLogin = ref(false)
const userDropdownOpen = ref(false)
const isRegisterMode = ref(false)
const isLoggedIn = ref(false)
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const authSuccess = ref('')

// 短信登录状态
const smsPhone = ref('')
const smsCode = ref('')
const smsCountdown = ref(0)
const smsLoading = ref(false)

// 找回密码
const showResetPwd = ref(false)
const resetPwdPhone = ref('')
const resetPwdCode = ref('')
const resetPwdPassword = ref('')
const resetPwdConfirm = ref('')
const resetPwdCountdown = ref(0)
const resetPwdSending = ref(false)
const resetPwdLoading = ref(false)
let smsTimer: ReturnType<typeof setInterval> | null = null

const needSmsCode = computed(() => {
  // 注册始终需要验证码，登录不需要
  return isRegisterMode.value
})

function sendSmsCode() {
  const phone = smsPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) {
    authError.value = '手机号格式不正确'
    return
  }
  authError.value = ''
  authSuccess.value = ''
  smsLoading.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        authError.value = data.error
        return
      }
      authSuccess.value = '验证码已发送'
      // 腾讯云短信日限降级 → 显式展示调试码
      const mock = data.data?.mock || data.mock
      const debugCode = data.data?.debugCode || data.debugCode
      if (mock && debugCode) {
        authSuccess.value = `⚠️ 短信配额已满，验证码: ${debugCode}（仅本次有效）`
      } else if (debugCode) {
        authSuccess.value += `（调试码: ${debugCode}）`
        console.log(`[SMS Debug] 验证码: ${debugCode} 用于 ${phone}`)
      }
      smsCountdown.value = 60
      if (smsTimer) clearInterval(smsTimer)
      smsTimer = setInterval(() => {
        if (smsCountdown.value > 0) smsCountdown.value--
        else if (smsTimer) { clearInterval(smsTimer); smsTimer = null }
      }, 1000)
    })
    .catch(() => { authError.value = '发送失败，请重试' })
    .finally(() => { smsLoading.value = false })
}

function openResetPwd() {
  authError.value = ''
  authSuccess.value = ''
  showResetPwd.value = true
  resetPwdPhone.value = ''
  resetPwdCode.value = ''
  resetPwdPassword.value = ''
  resetPwdConfirm.value = ''
  resetPwdCountdown.value = 0
}

function cancelResetPwd() {
  showResetPwd.value = false
  authError.value = ''
  authSuccess.value = ''
}

function sendResetPwdCode() {
  const phone = resetPwdPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) {
    authError.value = '手机号格式不正确'
    return
  }
  authError.value = ''
  authSuccess.value = ''
  resetPwdSending.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
      resetPwdCountdown.value = 60
      const t = setInterval(() => {
        if (resetPwdCountdown.value > 0) resetPwdCountdown.value--
        else clearInterval(t)
      }, 1000)
    })
    .catch(() => { authError.value = '发送失败，请重试' })
    .finally(() => { resetPwdSending.value = false })
}

async function doResetPwd() {
  authError.value = ''
  authSuccess.value = ''
  const phone = resetPwdPhone.value.trim()
  const code = resetPwdCode.value.trim()
  const pwd = resetPwdPassword.value
  const confirm = resetPwdConfirm.value
  if (!/^1\d{10}$/.test(phone)) { authError.value = '请输入正确的手机号'; return }
  if (!code) { authError.value = '请输入验证码'; return }
  if (pwd.length < 6) { authError.value = '密码至少 6 位'; return }
  if (pwd !== confirm) { authError.value = '两次密码输入不一致'; return }
  resetPwdLoading.value = true
  try {
    const res = await fetch('/api/auth/sms/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, password: pwd, confirmPassword: confirm }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '重置失败')
    authSuccess.value = '密码重置成功！请登录'
    setTimeout(() => {
      showResetPwd.value = false
      authError.value = ''
      authSuccess.value = ''
    }, 2000)
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    resetPwdLoading.value = false
  }
}

interface AuthUser {
  memberTier?: string
  email?: string
  username?: string
  coins?: number
  memberExpiresAt?: string
  [key: string]: any
}

const authUser = ref<AuthUser | null>(null)
const wechatLoading = ref(false)
const wechatStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
const qqStatus = ref({ enabled: false, appId: '' })

// ─── OAuth 弹窗通用逻辑 ───
let oauthListener: ((e: MessageEvent) => void) | null = null

function startOAuth(authUrl: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  // 打开弹窗
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) {
    // 弹窗被拦截：无法使用弹窗模式，fallback 到直接跳转
    window.location.href = authUrl
    return
  }

  // 设置一次性 message 监听
  if (oauthListener) {
    window.removeEventListener('message', oauthListener)
  }
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') {
      onSuccess(e.data.token, e.data.user)
      window.removeEventListener('message', oauthListener!)
      oauthListener = null
    } else if (e.data?.type === 'OAUTH_BIND') {
      // 新用户：跳转到绑定手机号页面
      window.removeEventListener('message', oauthListener!)
      oauthListener = null
      qqLoading.value = false
      wechatLoading.value = false
      window.location.href = e.data.url
    } else if (e.data?.type === 'OAUTH_ERROR') {
      onError(e.data.error)
      window.removeEventListener('message', oauthListener!)
      oauthListener = null
    }
  }
  window.addEventListener('message', oauthListener)

  // 轮询检测弹窗是否被关闭（用户取消登录）
  const pollClose = setInterval(() => {
    if (w.closed) {
      clearInterval(pollClose)
      if (oauthListener) {
        window.removeEventListener('message', oauthListener)
        oauthListener = null
        qqLoading.value = false
        wechatLoading.value = false
      }
    }
  }, 1000)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true
  authError.value = ''
  fetch('/api/auth/qq/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl,
          (token, user) => {
            const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
            setToken(token)
            setUser(user)
            isLoggedIn.value = true
            showLogin.value = false
            qqLoading.value = false
            // 刷新用户信息
            const raw = localStorage.getItem('auth_user')
            if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
          },
          (err) => {
            authError.value = err
            qqLoading.value = false
          }
        )
        qqLoading.value = false
      } else {
        authError.value = data.error || 'QQ登录启动失败'
        qqLoading.value = false
      }
    })
    .catch(() => { authError.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

function wechatLogin() {
  if (!wechatStatus.value.enabled) return
  wechatLoading.value = true
  authError.value = ''
  fetch('/api/auth/wechat/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl,
          (token, user) => {
            const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
            setToken(token)
            setUser(user)
            isLoggedIn.value = true
            showLogin.value = false
            wechatLoading.value = false
            // 刷新用户信息
            const raw = localStorage.getItem('auth_user')
            if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
          },
          (err) => {
            authError.value = err
            wechatLoading.value = false
          }
        )
        wechatLoading.value = false
      } else {
        authError.value = data.error || '微信登录启动失败'
        wechatLoading.value = false
      }
    })
    .catch(() => {
      authError.value = '微信登录暂时不可用'
      wechatLoading.value = false
    })
}

// VIP 等级配置
const tierConfig: Record<string, { label: string }> = {
  free: { label: '普通' },
  gold: { label: '黄金会员' },
  premium: { label: '黄金会员' },
  Pro: { label: '钻石会员' },
  vip_year: { label: '钻石会员' },
  vip_platinum: { label: '至尊会员' },
  director: { label: '年卡会员' },
  vip: { label: '黄金会员' },
}

const tierClass = computed(() => {
  const tier = authUser.value?.memberTier || 'free'
  return tierConfig[tier] ? tier : 'free'
})

const tierLabel = computed(() => tierConfig[tierClass.value]?.label || '普通')

const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goMemberCenter() {
  userDropdownOpen.value = false
  router.push('/user/center')
}

function doLogout() {
  userDropdownOpen.value = false
  // 使用 token-cache 统一清除（内存 + localStorage + cookie）
  const { clearAuth } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
  clearAuth()
  isLoggedIn.value = false
  showLogin.value = false
  // 刷新页面确保状态干净
  window.location.reload()
}

// 点击页面其他地方关闭用户下拉菜单
function handleDocClickForDropdown(e: MouseEvent) {
  const wrap = document.querySelector('.nav-user-wrap')
  if (wrap && !wrap.contains(e.target as Node)) {
    userDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocClickForDropdown)
  // 手机端自动跳转手机版
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent)
  if (isMobile) {
    router.replace('/mobile')
    return
  }

  // ⭐ URL 参数控制弹窗（手机版调用统一登录页）
  const urlParams = new URLSearchParams(window.location.search)
  const showLoginParam = urlParams.get('showLogin')
  const registerParam = urlParams.get('register')
  if (showLoginParam === '1') {
    showLogin.value = true
    if (registerParam === '1') {
      isRegisterMode.value = true
    }
    // 清除 URL 参数（防止 F5 重复弹窗）
    const cleanUrl = window.location.pathname + (registerParam === '1' ? '' : '')
    window.history.replaceState({}, '', cleanUrl)
  }

  // 检测 OAuth 回调（弹窗模式：postMessage 到 opener 后关闭自己）
  const wechatToken = urlParams.get('wechat_token')
  const wechatUser = urlParams.get('wechat_user') || ''
  const wechatError = urlParams.get('error')
  const qqToken = urlParams.get('qq_token')
  const qqUser = urlParams.get('qq_user') || ''
  const qqError = urlParams.get('error')

  if (wechatToken || qqToken) {
    const token = wechatToken || qqToken
    const username = wechatUser || qqUser
    const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
    setToken(token!)
    if (username) {
      setUser({ username })
    }

    // 如果当前是弹窗（有 opener），postMessage 给父窗口并关闭自己
    if (window.opener) {
      window.opener.postMessage({
        type: 'OAUTH_LOGIN',
        token: token,
        user: { username: username || '用户' }
      }, window.location.origin)

      // 保存 session 后自动关闭弹窗
      window.close()
      return
    }

    // 非弹窗模式（直接访问首页）：原逻辑
    isLoggedIn.value = true
    showLogin.value = false
    window.history.replaceState({}, '', '/')
    return
  }

  if (wechatError || qqError) {
    authError.value = wechatError || qqError || ''
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_ERROR', error: authError.value }, window.location.origin)
      window.close()
      return
    }
    showLogin.value = true
  }

  // 检查是否已登录
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token

  // 读取用户信息
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) {
    try {
      const parsed = JSON.parse(authUserRaw)
      authUser.value = parsed
    } catch {}
  }

  // 尝试刷新用户信息
  if (token) {
    const refreshProfile = async () => {
      try {
        // 先试 /api/user/profile（首页专用）
        let res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const profile = data.data || data
          if (profile?.id) {
            authUser.value = profile
            localStorage.setItem('auth_user', JSON.stringify(profile))
            return
          }
        }
        // 后备：/api/auth/me
        res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const user = data.data?.user || data.user
          if (user) {
            authUser.value = user
            localStorage.setItem('auth_user', JSON.stringify(user))
          }
        }
      } catch {}
    }
    refreshProfile()
  }

  // 检查第三方登录配置状态
  fetch('/api/auth/qq/status')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
  fetch('/api/auth/wechat/status')
    .then(r => r.json())
    .then(d => { if (d.data) wechatStatus.value = d.data })
    .catch(() => {})
  
  // 监听 OAuth 弹窗的 localStorage 写入事件（替代 postMessage）
  function handleOAuthStorage(e: StorageEvent) {
    if (e.key === 'oauth_login_at' && e.newValue) {
      // 登录成功：读取 auth_token
      const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        const userRaw = localStorage.getItem('auth_user')
        if (userRaw) { try { setUser(JSON.parse(userRaw)) } catch {} }
        isLoggedIn.value = true
        showLogin.value = false
        window.removeEventListener('storage', handleOAuthStorage)
        // 清理标志
        localStorage.removeItem('oauth_login_at')
      }
    } else if (e.key === 'oauth_bind_at' && e.newValue) {
      // 新用户需要绑定手机号
      const bindToken = localStorage.getItem('qq_bind_token')
      const bindNick = localStorage.getItem('qq_bind_nick')
      localStorage.removeItem('qq_bind_token')
      localStorage.removeItem('qq_bind_nick')
      localStorage.removeItem('oauth_bind_at')
      window.removeEventListener('storage', handleOAuthStorage)
      if (bindToken) {
        window.location.href = '/user/bind-phone?qq_bind_token=' + bindToken + '&qq_nick=' + (bindNick || 'QQ用户')
      }
    } else if (e.key === 'oauth_error_at' && e.newValue) {
      // OAuth 错误
      const errMsg = decodeURIComponent(localStorage.getItem('oauth_error') || '未知错误')
      localStorage.removeItem('oauth_error')
      localStorage.removeItem('oauth_error_at')
      window.removeEventListener('storage', handleOAuthStorage)
      authError.value = errMsg
    }
  }
  window.addEventListener('storage', handleOAuthStorage)
})

// clean up on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleDocClickForDropdown)
})

const steps = [
  { icon: '📝', name: '输入剧本', desc: '输入你的故事，可长可短' },
  { icon: '👤', name: '角色设计', desc: 'AI 为每个角色生成形象描述' },
  { icon: '🏠', name: '场景生成', desc: '自动匹配场景视觉风格' },
  { icon: '🎞️', name: '分镜设计', desc: 'AI 导演规划镜头语言' },
  { icon: '🖼️', name: '图片生成', desc: '角色图/场景图/分镜图' },
  { icon: '🎤', name: 'TTS 配音', desc: 'AI 语音为角色配音' },
  { icon: '🎥', name: '视频合成', desc: '图生视频 + 音频合成成片' },
]

const features = [
  { icon: '🧠', title: 'AI 导演级分析', desc: '每个环节 AI 以专业导演身份深度阅读剧本后再创作，确保画面与故事一致', tags: ['影视导演', '剧本理解'] },
  { icon: '🎨', title: '智能角色设计', desc: '从剧本中提炼角色特征，生成个性鲜明的形象描述和文生图提示词', tags: ['角色定妆', '动作捕捉服'] },
  { icon: '🏞️', title: '场景自动匹配', desc: 'AI 理解场景氛围，生成匹配的光线、色调和视觉元素', tags: ['环境设计', '光线氛围'] },
  { icon: '🎬', title: '专业分镜创作', desc: 'AI 导演规划镜头手法、情感弧线和运镜方式', tags: ['镜头语言', '特效描写'] },
  { icon: '🔄', title: '多模型适配', desc: '支持阿里百炼、火山引擎等多种 AI 厂商，支持 BYO API Key', tags: ['灵活切换', '私有密钥'] },
  { icon: '🔒', title: '数据隔离', desc: '用户模型配置加密存储，互不干扰', tags: ['安全', '隐私'] },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function goToStudio() {
  router.push('/studio/v2')
}

async function doAuth() {
  authError.value = ''
  authSuccess.value = ''

  // 校验
  if (isRegisterMode.value) {
    if (!smsPhone.value.trim()) {
      authError.value = '请输入手机号'
      return
    }
    if (!authPassword.value || authPassword.value.length < 6) {
      authError.value = '密码至少 6 位'
      return
    }
    if (!/^1\d{10}$/.test(smsPhone.value.trim())) {
      authError.value = '手机号格式不正确'
      return
    }
    if (!smsCode.value) {
      authError.value = '请先获取短信验证码'
      return
    }
  } else {
    if (!smsPhone.value.trim()) {
      authError.value = '请输入手机号或账号'
      return
    }
    if (!authPassword.value) {
      authError.value = '请输入密码'
      return
    }
  }

  authLoading.value = true
  try {
    if (isRegisterMode.value) {
      const body: any = {
        username: authName.value.trim() || undefined,
        password: authPassword.value,
        phone: smsPhone.value.trim(),
        code: smsCode.value,
        email: smsPhone.value.trim() + '@phone.local',
        refCode: selectedAgent.value?.id || undefined,
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) {
          setUser(data.user)
        }
        authSuccess.value = '注册成功！'
        isLoggedIn.value = true
        showLogin.value = false
        setTimeout(() => router.push('/'), 200)
      }
    } else {
      // 登录
      let url = '/api/auth/login'
      let body: any = { password: authPassword.value }
      body.account = smsPhone.value.trim()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) {
          setUser(data.user)
        }
        authSuccess.value = '登录成功！'
        isLoggedIn.value = true
        showLogin.value = false
        setTimeout(() => router.push('/'), 200)
      }
    }
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    authLoading.value = false
  }
}
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  overflow: hidden;
}

/* 背景 */
.bg-grid {
  display: none;
}
.bg-glow {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.12;
  pointer-events: none;
  z-index: 0;
}
.bg-glow.top-left { top: -100px; left: -100px; background: #f97316; }
.bg-glow.bottom-right { bottom: -100px; right: -100px; background: #6366f1; }

/* Nav */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(5,5,8,0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { display: flex; align-items: center; }
.nav-logo-img { width: 28px; height: 28px; }
.logo-text { font-size: 1rem; font-weight: 600; color: #fff; }
.nav-links { display: flex; gap: 24px; }
.nav-link { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
.nav-link:hover { color: rgba(255,255,255,0.8); }
.nav-actions { display: flex; gap: 10px; }

/* Buttons */
.btn {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
}
.btn-outline:hover { border-color: rgba(255,255,255,0.2); color: #fff; }

/* 导航栏用户徽标 */
.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 3px 8px 3px 3px;
  border-radius: 18px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  transition: all 0.2s;
}
.nav-user-badge:hover {
  background: rgba(255,255,255,0.06);
}
.nav-user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
}
.nav-user-avatar--free { background: linear-gradient(135deg, #4b5563, #6b7280); }
.nav-user-avatar--premium { background: linear-gradient(135deg, #D4AF37, #fbbf24); }
.nav-user-avatar--vip_year { background: linear-gradient(135deg, #E53E3E, #fc8181); }
.nav-user-avatar--vip_platinum { background: linear-gradient(135deg, #9333EA, #c084fc); }
.nav-tier-tag {
  font-size: 0.6rem;
  font-weight: 600;
}
.nav-tier-tag--free { color: #9ca3af; }
.nav-tier-tag--premium { color: #fbbf24; }
.nav-tier-tag--vip_year { color: #fc8181; }
.nav-tier-tag--vip_platinum { color: #c084fc; }
/* 用户头像包裹+下拉菜单 */
.nav-user-wrap {
  position: relative;
  cursor: pointer;
}
.nav-user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: #1a1a2e;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  min-width: 140px;
  padding: 4px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.dropdown-item {
  padding: 8px 14px;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
  transition: all 0.15s;
  cursor: pointer;
}
.dropdown-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
.dropdown-danger { color: #ef4444; }
.dropdown-danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(249,115,22,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-ghost { background: transparent; color: rgba(255,255,255,0.5); }
.btn-ghost:hover { color: rgba(255,255,255,0.8); }
/* 找回密码链接 */
.reset-pwd-link {
  text-align: center;
  margin-top: 12px;
  font-size: 0.78rem;
  color: rgba(96,165,250,0.6);
  cursor: pointer;
  transition: color 0.2s;
}
.reset-pwd-link:hover { color: #60a5fa; }
.btn-lg { padding: 12px 28px; font-size: 0.95rem; }
.btn-full { width: 100%; justify-content: center; padding: 11px; }

/* Hero */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  padding: 80px 24px 60px;
}
.hero-content { text-align: center; max-width: 1000px; }
.hero-badge {
  display: inline-block;
  padding: 10px 28px;
  border-radius: 24px;
  font-size: 1.25rem;
  font-weight: 600;
  background: rgba(249,115,22,0.1);
  color: #f97316;
  border: 1px solid rgba(249,115,22,0.2);
  margin-bottom: 48px;
}
/* Hero 区七步流程 */
.hero-pipeline {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 48px;
}
.hp-step {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  padding: 20px 14px;
  width: 110px;
  text-align: center;
  transition: all 0.3s;
}
.hp-step:hover { border-color: rgba(249,115,22,0.3); background: rgba(249,115,22,0.03); }
.hp-step-top { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
.hp-num { font-size: 0.65rem; color: rgba(255,255,255,0.2); font-weight: 600; }
.hp-icon { font-size: 1.5rem; }
.hp-name { font-size: 0.8rem; font-weight: 600; color: #fff; margin-bottom: 4px; }
.hp-desc { font-size: 0.68rem; color: rgba(255,255,255,0.3); }
@media (max-width: 768px) {
  .hp-step { width: 90px; padding: 14px 10px; }
  .hero-pipeline { gap: 10px; }
}
.hero-title { font-size: 3.2rem; font-weight: 700; line-height: 1.2; color: #fff; margin: 0 0 20px; }
.gradient-text {
  background: linear-gradient(135deg, #f97316, #a855f7, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-desc { font-size: 1.05rem; color: rgba(255,255,255,0.45); line-height: 1.7; margin-bottom: 36px; }
.hide-mobile { display: inline; }
.hero-actions { display: flex; gap: 12px; justify-content: center; margin-bottom: 56px; }

.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
}
.stat-item { display: flex; flex-direction: column; gap: 4px; }
.stat-number { font-size: 1.6rem; font-weight: 700; color: #fff; }
.stat-label { font-size: 0.78rem; color: rgba(255,255,255,0.35); }
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.06); }

/* Sections */
.section {
  padding: 100px 24px;
  position: relative;
  z-index: 1;
  max-width: 1100px;
  margin: 0 auto;
}
.section-label {
  text-align: center;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(249,115,22,0.7);
  margin-bottom: 12px;
}
.section-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px;
}
.section-desc {
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: 0.9rem;
  margin-bottom: 56px;
}

/* Pipeline Flow */
.pipeline-flow {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.pipeline-step {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  padding: 20px 16px;
  text-align: center;
  width: 120px;
  position: relative;
  transition: all 0.3s;
}
.pipeline-step:hover { border-color: rgba(249,115,22,0.3); background: rgba(249,115,22,0.03); }
.step-number {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.2);
  margin-bottom: 4px;
}
.step-icon { font-size: 1.6rem; margin-bottom: 8px; }
.step-name { font-size: 0.8rem; font-weight: 600; color: #fff; margin-bottom: 4px; }
.step-desc { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
.step-arrow {
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255,255,255,0.1);
  font-size: 1.2rem;
}

/* Features */
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.feature-card {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 16px;
  padding: 28px 24px;
  transition: all 0.3s;
}
.feature-card:hover { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
.feature-icon { font-size: 2rem; margin-bottom: 16px; }
.feature-title { font-size: 1rem; font-weight: 600; color: #fff; margin: 0 0 8px; }
.feature-desc { font-size: 0.82rem; color: rgba(255,255,255,0.4); line-height: 1.6; margin-bottom: 16px; }
.feature-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.feature-tag {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.68rem;
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.35);
}

/* CTA */
.cta-section { padding: 60px 24px 100px; }
.cta-card {
  background: linear-gradient(135deg, rgba(249,115,22,0.06), rgba(99,102,241,0.06));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 60px 40px;
  text-align: center;
}
.cta-title { font-size: 1.8rem; font-weight: 700; color: #fff; margin: 0 0 12px; }
.cta-desc { color: rgba(255,255,255,0.4); font-size: 0.95rem; margin-bottom: 28px; }

/* Footer */
.footer {
  border-top: 1px solid rgba(255,255,255,0.04);
  padding: 24px;
  position: relative;
  z-index: 1;
}
.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.footer-brand { display: flex; align-items: center; gap: 8px; }
.footer-links a { color: rgba(255,255,255,0.3); text-decoration: none; font-size: 0.8rem; }
.footer-legal {
  text-align: center;
  color: rgba(255,255,255,0.2);
  font-size: 0.75rem;
  letter-spacing: 0.5px;
}
.footer-icp { text-align: center; color: rgba(255,255,255,0.2); font-size: 0.75rem; margin-top: 12px; letter-spacing: 0.5px; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-card {
  background: #0d0d12;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  width: 380px;
  padding: 40px 32px 32px;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 1rem;
  cursor: pointer;
}
.modal-close:hover { color: #fff; }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header .logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.modal-logo-img { width: 48px; height: 48px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 600; color: #fff; margin: 0 0 6px; }
.modal-header p { font-size: 0.8rem; color: rgba(255,255,255,0.35); margin: 0; }

.modal-tabs {
  display: flex;
  background: rgba(255,255,255,0.02);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 24px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  background: transparent;
  color: rgba(255,255,255,0.3);
  transition: all 0.2s;
}
.tab-active {
  background: rgba(249,115,22,0.15);
  color: #f97316;
}

/* 登录方式子标签 */
.login-mode-tabs {
  display: flex;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  padding: 2px;
  margin-bottom: 16px;
}
.tab-sm {
  flex: 1;
  padding: 6px 4px;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  background: transparent;
  color: rgba(255,255,255,0.3);
  transition: all 0.2s;
}
.tab-sm-active {
  background: rgba(59,130,246,0.15);
  color: #60a5fa;
}
/* 短信验证码输入行 */
.sms-code-row {
  display: flex;
  gap: 8px;
}
.sms-code-input {
  flex: 1;
}
.btn-sm-code {
  white-space: nowrap;
  min-width: 100px;
  height: 40px;
  font-size: 0.78rem;
}

.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
.form-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus { border-color: rgba(249,115,22,0.4); }

.form-error { color: #ef4444; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.form-success { color: #22c55e; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }

@media (max-width: 768px) {
  .hero-title { font-size: 2.2rem; }
  .hide-mobile { display: none; }
  .nav-links { display: none; }
  .features-grid { grid-template-columns: 1fr; }
  .pipeline-step { width: 100px; }
  .step-arrow { display: none; }
  .modal-card { width: 90%; margin: 0 16px; }
}
.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 12px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.08);
}
.divider-text {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
}
.btn-wechat {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(7, 193, 96, 0.3);
  background: rgba(7, 193, 96, 0.08);
  color: #07c160;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-wechat:hover:not(:disabled) {
  background: rgba(7, 193, 96, 0.15);
  border-color: rgba(7, 193, 96, 0.5);
}
.btn-wechat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wechat-icon {
  font-size: 18px;
}
.btn-qq {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(81, 149, 255, 0.3);
  background: rgba(81, 149, 255, 0.08);
  color: #5195ff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}
.btn-qq:hover:not(:disabled) {
  background: rgba(81, 149, 255, 0.15);
  border-color: rgba(81, 149, 255, 0.5);
}
.btn-qq:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
