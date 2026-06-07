<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const bindToken = ref('')
const qqNick = ref('QQ用户')
const phone = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  bindToken.value = route.query.qq_bind_token as string || ''
  qqNick.value = route.query.qq_nick as string || 'QQ用户'
  if (!bindToken.value) {
    router.replace('/')
  }
})

async function sendCode() {
  error.value = ''
  if (!phone.value) { error.value = '请输入手机号'; return }
  if (!/^1\d{10}$/.test(phone.value)) { error.value = '手机号格式不正确'; return }
  if (countdown.value > 0) return

  loading.value = true
  try {
    const res = await fetch('/api/auth/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发送失败')
    // 调试码显示
    const debugCode = data.data?.debugCode || data.debugCode
    const mock = data.data?.mock || data.mock
    if (mock && debugCode) {
      error.value = ''
      success.value = `⚠️ 短信配额已满，验证码: ${debugCode}（仅本次有效）`
    } else if (debugCode) {
      success.value = `验证码已发送（调试码: ${debugCode}）`
    } else {
      success.value = '验证码已发送'
    }
    startCountdown()
  } catch (e: any) {
    error.value = e?.message || '发送失败，请重试'
  } finally {
    loading.value = false
  }
}

function startCountdown() {
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function doBind() {
  error.value = ''
  if (!phone.value) { error.value = '请输入手机号'; return }
  if (!/^1\d{10}$/.test(phone.value)) { error.value = '手机号格式不正确'; return }
  if (!code.value) { error.value = '请输入验证码'; return }

  loading.value = true
  try {
    const res = await fetch('/api/auth/qq/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone.value,
        code: code.value,
        bindToken: bindToken.value,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '绑定失败')
    const token = data.accessToken || data.token
    if (!token) throw new Error('服务器未返回 token')

    auth.token = token
    auth.user = data.user || null
    document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
    // 使用 token-cache 统一写入（内存 + localStorage）
    const { setToken, setUser } = await import('~/utils/token-cache')
    setToken(token)
    if (auth.user) {
      setUser(auth.user as Record<string, any>)
      document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(auth.user))}; path=/; max-age=86400; samesite=lax`
    }

    success.value = '绑定成功！跳转中...'
    setTimeout(() => router.push('/studio/v2'), 1000)
  } catch (e: any) {
    error.value = e?.message || '绑定失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0b0b0d] text-white font-sans flex items-center justify-center">
    <div class="w-[360px] px-4">
      <div class="text-center mb-8">
        <h1 class="text-lg font-semibold text-white/80">昆仑镜</h1>
        <p class="text-xs mt-1 text-white/30">QQ 首次登录</p>
      </div>

      <div class="rounded-xl border border-white/[0.06] p-5">
        <div class="text-center mb-5">
          <div class="text-base mb-1">🐧</div>
          <p class="text-xs text-white/50">
            QQ用户 <span class="text-orange-400">{{ qqNick }}</span>
          </p>
          <p class="text-[10px] text-white/30 mt-1">绑定已有账号，或完成注册</p>
          <p class="text-[10px] text-white/20 mt-0.5">
            还没账号？先去 <a href="/" class="text-orange-400/70 no-underline">首页注册</a>
          </p>
        </div>

        <div class="mb-3.5">
          <label class="text-[10px] text-white/30 block mb-1.5">手机号</label>
          <input v-model="phone" type="tel" placeholder="输入手机号" maxlength="11"
            class="w-full box-border bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/60 outline-none focus:border-orange-500/40 transition-colors" />
        </div>

        <div class="mb-3.5">
          <label class="text-[10px] text-white/30 block mb-1.5">短信验证码</label>
          <div class="flex gap-2">
            <input v-model="code" type="text" placeholder="输入验证码" maxlength="6"
              class="flex-1 box-border bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/60 outline-none focus:border-orange-500/40 transition-colors" />
            <button @click="sendCode"
              :disabled="loading || countdown > 0 || !phone"
              class="shrink-0 px-3 py-2 rounded-lg border-none text-[10px] font-medium cursor-pointer transition-all whitespace-nowrap"
              :class="countdown > 0 ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-rose-600 text-white/90 hover:from-orange-500 hover:to-rose-500'">
              <span v-if="countdown > 0">{{ countdown }}s</span>
              <span v-else-if="loading">发送中...</span>
              <span v-else>获取验证码</span>
            </button>
          </div>
          <p style="font-size:10px; color:rgba(255,255,255,0.3); margin:2px 0 0">每日仅能收 5 次短信验证码，请确认手机号正确后再获取</p>
        </div>

        <button @click="doBind"
          :disabled="loading || !phone || !code"
          class="w-full py-2 rounded-lg border-none text-xs font-medium cursor-pointer transition-all"
          :class="loading ? 'bg-white/10 text-white/30' : 'bg-gradient-to-r from-orange-600 to-rose-600 text-white/90 hover:from-orange-500 hover:to-rose-500'">
          <span v-if="loading" class="inline-block animate-pulse">绑定中...</span>
          <span v-else>绑定并登录</span>
        </button>

        <div v-if="error" class="mt-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
          <p class="text-[10px] text-red-400/70 text-center m-0">{{ error }}</p>
        </div>
        <div v-if="success" class="mt-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <p class="text-[10px] text-emerald-400/70 text-center m-0">{{ success }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
