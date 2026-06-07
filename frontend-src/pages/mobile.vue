<template>
  <div class="mobile-page">
    <!-- 顶部渐变背景 -->
    <div class="header-bg" />

    <!-- 顶部区域 -->
    <div class="top-section">
      <div class="logo-area">
        <img src="/logo.png" alt="昆仑镜" class="logo-img" />
        <span class="logo-text">昆仑镜</span>
      </div>
      <p class="subtitle">AI 短剧制作平台</p>
    </div>

    <!-- 入口卡片 -->
    <div class="cards-area">
      <div class="card card-community" @click="goTo('/community')">
        <div class="card-icon">💬</div>
        <div class="card-info">
          <div class="card-title">社区</div>
          <div class="card-desc">交流创作、分享技巧</div>
        </div>
        <div class="card-arrow">→</div>
      </div>

      <div class="card card-studio" @click="goTo('/studio/v2')">
        <div class="card-icon">🎬</div>
        <div class="card-info">
          <div class="card-title">工作台</div>
          <div class="card-desc">开始你的 AI 短剧创作</div>
        </div>
        <div class="card-arrow">→</div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="bottom-section">
      <div v-if="!isLoggedIn" class="user-status" @click="showLogin = true; isRegisterMode = false">
        <div class="status-icon">👤</div>
        <div class="status-text">登录 / 注册</div>
        <div class="status-arrow">→</div>
      </div>
      <div v-else class="user-status" @click="goTo('/user/center')">
        <div class="status-icon">{{ avatarChar }}</div>
        <div class="status-text">{{ authUser?.username || '已登录' }}</div>
        <div class="status-arrow">→</div>
      </div>
    </div>

    <!-- ==================== 登录/注册 Modal（与电脑版完全一致） ==================== -->
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
            <label>用户名</label><input v-model="authName" type="text" placeholder="输入用户名（选填）" class="form-input" />
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
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const showResetPwd = ref(false)
const authUser = ref<any>(null)
const authName = ref('')
const authPassword = ref('')
const authError = ref('')
const authSuccess = ref('')
const authLoading = ref(false)

// 短信验证码
const smsPhone = ref('')
const smsCode = ref('')
const smsCountdown = ref(0)
const smsLoading = ref(false)

// 找回密码
const resetPwdPhone = ref('')
const resetPwdCode = ref('')
const resetPwdPassword = ref('')
const resetPwdConfirm = ref('')
const resetPwdCountdown = ref(0)
const resetPwdSending = ref(false)
const resetPwdLoading = ref(false)

// OAuth
const wechatLoading = ref(false)
const wechatStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
const qqStatus = ref({ enabled: false, appId: '' })

let smsTimer: ReturnType<typeof setInterval> | null = null

const needSmsCode = computed(() => isRegisterMode.value)

const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goTo(path: string) {
  router.push(path)
}

// ─── 验证码发送 ───
function sendSmsCode() {
  const phone = smsPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) { authError.value = '手机号格式不正确'; return }
  authError.value = ''; authSuccess.value = ''
  smsLoading.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
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

// ─── 找回密码 ───
function openResetPwd() {
  authError.value = ''; authSuccess.value = ''
  showResetPwd.value = true
  resetPwdPhone.value = ''; resetPwdCode.value = ''
  resetPwdPassword.value = ''; resetPwdConfirm.value = ''
  resetPwdCountdown.value = 0
}

function cancelResetPwd() {
  showResetPwd.value = false
  authError.value = ''; authSuccess.value = ''
}

function sendResetPwdCode() {
  const phone = resetPwdPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) { authError.value = '手机号格式不正确'; return }
  authError.value = ''; authSuccess.value = ''
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
  authError.value = ''; authSuccess.value = ''
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
    setTimeout(() => { showResetPwd.value = false; authError.value = ''; authSuccess.value = '' }, 2000)
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    resetPwdLoading.value = false
  }
}

// ─── 注册/登录 ───
async function doAuth() {
  authError.value = ''; authSuccess.value = ''

  if (isRegisterMode.value) {
    if (!smsPhone.value.trim()) { authError.value = '请输入手机号'; return }
    if (!authPassword.value || authPassword.value.length < 6) { authError.value = '密码至少 6 位'; return }
    if (!/^1\d{10}$/.test(smsPhone.value.trim())) { authError.value = '手机号格式不正确'; return }
    if (!smsCode.value) { authError.value = '请先获取短信验证码'; return }
  } else {
    if (!smsPhone.value.trim()) { authError.value = '请输入手机号或账号'; return }
    if (!authPassword.value) { authError.value = '请输入密码'; return }
  }

  authLoading.value = true
  try {
    if (isRegisterMode.value) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authName.value.trim() || undefined,
          password: authPassword.value,
          phone: smsPhone.value.trim(),
          code: smsCode.value,
          email: smsPhone.value.trim() + '@phone.local',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = await import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) setUser(data.user)
        authSuccess.value = '注册成功！'
        isLoggedIn.value = true
        showLogin.value = false
        setTimeout(() => router.push('/'), 200)
      }
    } else {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: smsPhone.value.trim(), password: authPassword.value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = await import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) setUser(data.user)
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

// ─── OAuth ───
let oauthListener: ((e: MessageEvent) => void) | null = null

function startOAuth(authUrl: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) { window.location.href = authUrl; return }
  if (oauthListener) window.removeEventListener('message', oauthListener)
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') { onSuccess(e.data.token, e.data.user); window.removeEventListener('message', oauthListener); oauthListener = null }
    else if (e.data?.type === 'OAUTH_BIND') { window.removeEventListener('message', oauthListener); oauthListener = null; wechatLoading.value = false; qqLoading.value = false; window.location.href = e.data.url }
    else if (e.data?.type === 'OAUTH_ERROR') { onError(e.data.error); window.removeEventListener('message', oauthListener); oauthListener = null }
  }
  window.addEventListener('message', oauthListener)
  const pollClose = setInterval(() => {
    if (w.closed) {
      clearInterval(pollClose)
      if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null; qqLoading.value = false; wechatLoading.value = false }
    }
  }, 1000)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true; authError.value = ''
  fetch('/api/auth/qq/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl, (token, user) => {
          import('~/utils/token-cache').then(({ setToken, setUser }) => {
            setToken(token); setUser(user); isLoggedIn.value = true; showLogin.value = false; qqLoading.value = false
          })
        }, (err) => { authError.value = err; qqLoading.value = false })
      } else { authError.value = data.error || 'QQ登录启动失败'; qqLoading.value = false }
    })
    .catch(() => { authError.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

function wechatLogin() {
  if (!wechatStatus.value.enabled) return
  wechatLoading.value = true; authError.value = ''
  fetch('/api/auth/wechat/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl, (token, user) => {
          import('~/utils/token-cache').then(({ setToken, setUser }) => {
            setToken(token); setUser(user); isLoggedIn.value = true; showLogin.value = false; wechatLoading.value = false
          })
        }, (err) => { authError.value = err; wechatLoading.value = false })
      } else { authError.value = data.error || '微信登录启动失败'; wechatLoading.value = false }
    })
    .catch(() => { authError.value = '微信登录暂时不可用'; wechatLoading.value = false })
}

// ─── 初始化 ───
onMounted(() => {
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const raw = localStorage.getItem('auth_user')
  if (raw) {
    try { authUser.value = JSON.parse(raw) } catch {}
  }

  // 查询 OAuth 状态
  fetch('/api/auth/qq/status')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
  fetch('/api/auth/wechat/status')
    .then(r => r.json())
    .then(d => { if (d.data) wechatStatus.value = d.data })
    .catch(() => {})
})

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
  if (oauthListener) window.removeEventListener('message', oauthListener)
})
</script>

<style scoped>
.mobile-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  box-sizing: border-box;
}

/* 顶部渐变 */
.header-bg {
  position: fixed;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  height: 320px;
  background: radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* 顶部区域 */
.top-section {
  position: relative;
  z-index: 1;
  padding-top: 60px;
  text-align: center;
  margin-bottom: 40px;
}
.logo-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
}
.logo-img {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}
.logo-text {
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
}
.subtitle {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.3);
  margin: 0;
}

/* 入口卡片 */
.cards-area {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255,255,255,0.04);
}
.card:active {
  transform: scale(0.98);
}
.card-community {
  background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.04));
  border-color: rgba(59,130,246,0.12);
}
.card-studio {
  background: linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.04));
  border-color: rgba(249,115,22,0.12);
}
.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}
.card-community .card-icon { background: rgba(59,130,246,0.1); }
.card-studio .card-icon { background: rgba(249,115,22,0.1); }
.card-info {
  flex: 1;
}
.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}
.card-desc {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.3);
}
.card-arrow {
  font-size: 1.2rem;
  color: rgba(255,255,255,0.15);
}

/* 底部区域 */
.bottom-section {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding: 30px 0 24px;
}
.user-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255,255,255,0.04);
  background: rgba(255,255,255,0.01);
  margin-bottom: 24px;
}
.user-status:active {
  transform: scale(0.98);
}
.status-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}
.status-text {
  flex: 1;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.5);
}
.status-arrow {
  font-size: 1rem;
  color: rgba(255,255,255,0.15);
}

.footer-info {
  text-align: center;
}
.footer-line {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.15);
  margin-bottom: 4px;
  letter-spacing: 0.3px;
}

/* 登录 Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-card {
  width: 88%;
  max-width: 340px;
  background: #0d0d12;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 28px 24px;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 1.2rem;
  cursor: pointer;
}
.modal-header {
  text-align: center;
  margin-bottom: 24px;
}
.modal-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.input-group {
  margin: 0;
}
.modal-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  font-family: inherit;
}
.modal-input:focus {
  border-color: rgba(249,115,22,0.4);
}
.auth-error {
  color: #ef4444;
  font-size: 0.78rem;
  text-align: center;
  margin: 0;
}
.modal-btn {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  transition: all 0.2s;
}
.modal-btn:disabled {
  opacity: 0.5;
}
.modal-switch {
  text-align: center;
  font-size: 0.78rem;
  color: rgba(249,115,22,0.5);
  cursor: pointer;
  margin: 4px 0 0;
}
</style>
