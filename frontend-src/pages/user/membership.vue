<template>
  <div class="vip-page">
    <!-- 顶部 -->
    <div class="vip-header">
      <div class="vip-header-bg"></div>
      <div class="vip-header-content">
        <h1 class="vip-title">选择你的会员方案</h1>
        <p class="vip-subtitle">解锁更多 AI 创作能力，按自己的节奏升级</p>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="vip-loading">加载中...</div>

    <!-- 错误 -->
    <div v-else-if="error" class="vip-error">{{ error }}</div>

    <!-- 套餐列表 -->
    <div v-else class="vip-plans">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="vip-card"
        :class="{ 'vip-card--current': plan.level === currentTier }"
      >
        <!-- 当前标识 -->
        <div v-if="plan.level === currentTier" class="vip-card-badge">当前方案</div>

        <!-- 套餐头 -->
        <div class="vip-card-header">
          <span class="vip-card-icon">{{ plan.icon || '🎬' }}</span>
          <h3 class="vip-card-name">{{ plan.name || plan.level }}</h3>
        </div>

        <!-- 价格 -->
        <div class="vip-card-price">
          <span class="vip-price-num">¥{{ plan.price }}</span>
          <span class="vip-price-period">/ {{ plan.months >= 365 ? (plan.months / 365).toFixed(0) + '年' : plan.months >= 30 ? (plan.months / 30).toFixed(0) + '个月' : plan.months + '天' }}</span>
        </div>

        <!-- 权限列表 -->
        <div class="vip-card-features">
          <div class="vip-feature">
            <span class="vip-feature-icon">✅</span>
            <span class="vip-feature-text">无限 AI 生成</span>
          </div>
          <div v-if="plan.storageLimit" class="vip-feature">
            <span class="vip-feature-icon">🎁</span>
            <span class="vip-feature-text">赠送储存空间 {{ plan.storageLimit >= 1024 ? (plan.storageLimit/1024).toFixed(0) + 'GB' : plan.storageLimit + 'MB' }}</span>
          </div>
          <div v-if="plan.onlineApiEnabled" class="vip-feature">
            <span class="vip-feature-icon">✅</span>
            <span class="vip-feature-text">接入独立在线大模型 API</span>
          </div>
          <div v-if="plan.localModelEnabled" class="vip-feature">
            <span class="vip-feature-icon">✅</span>
            <span class="vip-feature-text">接入本地大模型</span>
          </div>
        </div>

        <!-- 按钮 -->
        <button
          class="vip-card-btn"
          :class="plan.level === currentTier ? 'vip-card-btn--current' : 'vip-card-btn--buy'"
          :disabled="plan.level === currentTier || upgrading"
          @click="upgradePlan(plan)"
        >
          {{ plan.level === currentTier ? '当前方案' : upgrading ? '处理中...' : '立即开通' }}
        </button>
      </div>
    </div>

    <!-- 支付弹窗：选择支付方式 -->
    <Transition name="modal-fade">
      <div v-if="showPay && !showAlipayQr" class="pay-overlay" @click.self="cancelPay">
        <div class="pay-dialog">
          <h3 class="pay-title">选择支付方式</h3>
          <div class="pay-body">
            <div class="pay-plan-name">{{ payInfo.planName }}</div>
            <div class="pay-amount">¥{{ payInfo.amount }}</div>

            <div class="pay-method-list">
              <div
                v-for="m in payInfo.methods"
                :key="m.id"
                class="pay-method-item"
                @click="selectPaymentMethod(m)"
              >
                <span class="pay-method-icon">{{ m.channel === 'alipay' ? '💳' : '💚' }}</span>
                <span class="pay-method-name">{{ m.name }}</span>
                <span class="pay-method-arrow">›</span>
              </div>
            </div>
          </div>
          <div class="pay-actions">
            <button class="pay-btn pay-btn--cancel" @click="cancelPay">取消</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 支付弹窗：付款二维码（支付宝/微信） -->
    <Transition name="modal-fade">
      <div v-if="showAlipayQr" class="pay-overlay" @click.self="closeAlipayQr">
        <div class="pay-dialog pay-dialog--qr">
          <h3 class="pay-title">{{ payInfo.paymentType === 'wxpay_qr' ? '微信扫码付款' : '支付宝扫码付款' }}</h3>
          <div class="pay-body">
            <div class="pay-plan-name">{{ payInfo.planName }}</div>
            <div class="pay-amount">¥{{ payInfo.amount }}</div>

            <!-- 付款二维码 -->
            <div class="pay-alipay-qr-area">
              <div v-if="alipayQrCode" class="pay-alipay-qr-wrapper">
                <img v-if="alipayQrBase64" :src="alipayQrBase64" class="pay-alipay-qr-img" :alt="payInfo.paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
                <img v-else :src="`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(alipayQrCode)}`" class="pay-alipay-qr-img" :alt="payInfo.paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
              </div>
              <div v-else class="pay-alipay-loading">正在生成付款码...</div>
            </div>

            <div class="pay-tip">{{ payInfo.paymentType === 'wxpay_qr' ? '请使用微信扫码完成支付' : '请使用支付宝扫码完成支付' }}</div>

            <!-- 支付状态 -->
            <div v-if="alipayStatus === 'pending'" class="pay-status pay-status--pending">
              ⏳ 等待用户扫码支付...
            </div>
            <div v-if="alipayStatus === 'paid'" class="pay-status pay-status--paid">
              ✅ 支付成功！正在开通VIP...
            </div>
            <div v-if="alipayStatus === 'failed'" class="pay-status pay-status--failed">
              ❌ {{ alipayError }}
            </div>
          </div>
          <div class="pay-actions">
            <button class="pay-btn pay-btn--cancel" @click="closeAlipayQr" :disabled="alipayPolling">取消</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 支付弹窗：收款码确认模式（无支付宝密钥时用） -->
    <Transition name="modal-fade">
      <div v-if="showQrConfirm" class="pay-overlay" @click.self="closeQrConfirm">
        <div class="pay-dialog">
          <h3 class="pay-title">{{ selectedMethodName }}</h3>
          <div class="pay-body">
            <div class="pay-plan-name">{{ payInfo.planName }}</div>
            <div class="pay-amount">¥{{ payInfo.amount }}</div>

            <!-- 收款码图片 -->
            <div v-if="selectedMethodQrUrl" class="pay-qr-area">
              <img :src="selectedMethodQrUrl" class="pay-qr-img" alt="收款二维码" />
              <div v-if="selectedMethodAccount" class="pay-qr-account">{{ selectedMethodAccount }}</div>
            </div>

            <div class="pay-tip">请使用支付宝/微信扫码付款，付款后点击下方按钮确认</div>
          </div>
          <div class="pay-actions">
            <button class="pay-btn pay-btn--cancel" @click="closeQrConfirm">取消</button>
            <button class="pay-btn pay-btn--confirm" :disabled="submitting" @click="confirmAndActivate">
              {{ submitting ? '处理中...' : '我已付款，直接开通' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 提示 -->
    <div v-if="upgradeMsg" class="vip-toast" :class="upgradeMsg.includes('❌') ? 'vip-toast--err' : 'vip-toast--ok'">
      {{ upgradeMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

definePageMeta({ layout: 'vip', middleware: 'auth' })
const router = useRouter()

const plans = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const upgradeMsg = ref('')
const upgrading = ref(false)
const currentTier = ref('free')

// 支付方式选择弹窗
const showPay = ref(false)
const payInfo = reactive({
  orderId: '',
  orderNo: '',
  amount: 0,
  planName: '',
  methods: [] as any[],
  paymentType: '',
})
const selectedPlan = ref<any>(null)

// 支付宝密钥模式（动态二维码 + 轮询）
const showAlipayQr = ref(false)
const alipayQrCode = ref('')
const alipayQrBase64 = ref('')
const alipayStatus = ref<'pending' | 'paid' | 'failed'>('pending')
const alipayError = ref('')
const alipayPolling = ref(false)
let alipayPollTimer: any = null

// 收款码确认模式
const showQrConfirm = ref(false)
const selectedMethodName = ref('')
const selectedMethodQrUrl = ref('')
const selectedMethodAccount = ref('')
const selectedMethodId = ref('')
const submitting = ref(false)

function getToken(): string | null {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const fromLs = _gt()
  if (fromLs) return fromLs
  // Fallback to cookie
  const match = document.cookie.match(new RegExp(`(^| )auth_token=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const meRes = await fetch('/api/auth/me', { headers })

    if (meRes.ok) {
      const me = await meRes.json()
      currentTier.value = me.user?.memberTier || 'free'
    } else if (meRes.status === 401) {
      error.value = '登录已过期，请重新登录'
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
      return
    }

    // 套餐列表走无需认证的公共接口
    const rawPlansRes = await fetch('/api/member/plans')
    if (rawPlansRes.ok) {
      const data = await rawPlansRes.json()
      const raw = Array.isArray(data) ? data : (data?.data || data)
      plans.value = Array.isArray(raw) ? raw.filter((p: any) => p.enabled !== false) : []
    } else {
      throw new Error('获取套餐失败')
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
  loading.value = false
}

async function upgradePlan(plan: any) {
  if (plan.level === currentTier.value) return
  upgrading.value = true
  upgradeMsg.value = ''

  try {
    const token = getToken()
    if (!token) {
      upgradeMsg.value = '❌ 请先登录'
      upgrading.value = false
      return
    }

    const res = await fetch('/api/member/upgrade-vip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planLevel: plan.level }),
    })
    const data = await res.json()

    if (!res.ok) {
      if (res.status === 401) {
        upgradeMsg.value = `❌ 登录已过期，请重新登录后重试`
      } else {
        upgradeMsg.value = `❌ ${data.error || '请求失败'}`
      }
      upgrading.value = false
      setTimeout(() => { upgradeMsg.value = '' }, 5000)
      return
    }

    if (data.needPay) {
      selectedPlan.value = plan
      payInfo.orderId = data.orderId
      payInfo.orderNo = data.orderNo || ''
      payInfo.amount = data.amount
      payInfo.planName = data.planName
      payInfo.methods = data.methods || []
      payInfo.paymentType = data.paymentType || ''

      // 电脑网站支付模式（跳转支付宝页面）
      if (data.paymentType === 'alipay_page' && data.payUrl) {
        // 直接跳转到支付宝收银台
        window.location.href = data.payUrl
        return
      }

      // 支付宝当面付二维码模式（降级兼容）
      if (data.paymentType === 'alipay_qr' && data.qrCode) {
        alipayQrCode.value = data.qrCode
        alipayStatus.value = 'pending'
        alipayError.value = ''
        showPay.value = false
        showAlipayQr.value = true
        // 开始轮询支付状态
        startAlipayPolling(data.orderId)
      } else {
        // 展示支付方式选择弹窗
        showPay.value = true
      }
    } else {
      upgradeMsg.value = `✅ 已成功升级为「${plan.name}」！`
      currentTier.value = plan.level
    }
  } catch (e: any) {
    upgradeMsg.value = `❌ 网络错误: ${e.message}`
  }
  upgrading.value = false
  setTimeout(() => { upgradeMsg.value = '' }, 5000)
}

// 用户选择支付方式
function selectPaymentMethod(m: any) {
  if (m.isSecret && (m.channel === 'alipay' || m.channel === 'wechat')) {
    // 支付宝/微信密钥模式 → 生成支付凭据
    generatePayment(m.channel)
  } else if (m.qrCodeUrl) {
    // 收款码模式
    showPay.value = false
    selectedMethodId.value = m.id
    selectedMethodName.value = m.name
    selectedMethodQrUrl.value = m.qrCodeUrl
    selectedMethodAccount.value = m.account || ''
    showQrConfirm.value = true
  } else {
    upgradeMsg.value = '❌ 该支付方式暂不可用'
    setTimeout(() => { upgradeMsg.value = '' }, 3000)
  }
}

// 支付宝密钥模式：生成付款二维码
async function generateAlipayQr() {
  generatePayment('alipay')
}

// 通用支付函数：调 create-payment 获取支付凭据并处理返回
async function generatePayment(channel: string) {
  showAlipayQr.value = true
  showPay.value = false
  alipayStatus.value = 'pending'
  alipayError.value = ''
  alipayQrCode.value = ''
  alipayQrBase64.value = ''

  // 确保已有订单ID
  if (!payInfo.orderId) {
    // 先调 upgrade-vip 获取订单
    try {
      const token = getToken()
      const res = await fetch('/api/member/upgrade-vip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planLevel: selectedPlan.value.level }),
      })
      const data = await res.json()
      if (!res.ok) {
        alipayStatus.value = 'failed'
        alipayError.value = data.error || '创建订单失败'
        return
      }
      payInfo.orderId = data.orderId
      payInfo.orderNo = data.orderNo || ''
    } catch (e: any) {
      alipayStatus.value = 'failed'
      alipayError.value = '创建订单失败'
      return
    }
  }

  // 调 create-payment 获取支付凭据
  try {
    const token = getToken()
    const res = await fetch('/api/member/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId: payInfo.orderId, channel }),
    })
    const data = await res.json()
    payInfo.paymentType = data.paymentType || ''

    if (data.qrCode) {
      // 支付宝当面付：直接显示二维码字符串
      alipayQrCode.value = data.qrCode
      startAlipayPolling(payInfo.orderId)
    } else if (data.codeUrl) {
      // 微信 NATIVE：显示支付二维码
      alipayQrCode.value = data.codeUrl
      startAlipayPolling(payInfo.orderId)
    } else if (data.payUrl) {
      // 支付宝：将支付链接转为二维码（统一扫码体验）
      try {
        const QRCode = (await import('qrcode')).default
        alipayQrCode.value = data.payUrl
        // 用 canvas 生成二维码并设置为 base64 图片
        const qrDataUrl = await QRCode.toDataURL(data.payUrl, { width: 280, margin: 2 })
        alipayQrBase64.value = qrDataUrl
      } catch {
        // qrcode 库加载失败时仍显示为链接
        alipayQrCode.value = data.payUrl
      }
      startAlipayPolling(payInfo.orderId)
    } else {
      alipayStatus.value = 'failed'
      alipayError.value = data.error || '生成付款凭据失败'
    }
  } catch (e: any) {
    alipayStatus.value = 'failed'
    alipayError.value = '网络错误，请重试'
  }
}

// 轮询支付宝支付状态
function startAlipayPolling(orderId: string) {
  alipayPolling.value = true
  let pollCount = 0

  const poll = async () => {
    if (pollCount >= 120) { // 最多轮询 10 分钟（5秒一次）
      alipayPolling.value = false
      alipayStatus.value = 'failed'
      alipayError.value = '支付超时，请重新下单'
      return
    }
    pollCount++

    try {
      const token = getToken()
      const res = await fetch(`/api/payment/alipay/status/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()

      if (data.status === 'paid') {
        alipayPolling.value = false
        alipayStatus.value = 'paid'
        // 延迟 1 秒后跳转到个人中心
        setTimeout(() => {
          closeAlipayQr()
          upgradeMsg.value = '✅ VIP 开通成功！'
          setTimeout(() => router.push('/user/center'), 1500)
        }, 1000)
        return
      }
    } catch {
      // 忽略轮询错误，继续
    }

    if (alipayPolling.value) {
      alipayPollTimer = setTimeout(poll, 5000)
    }
  }

  // 开始轮询
  alipayPollTimer = setTimeout(poll, 5000)
}

function closeAlipayQr() {
  showAlipayQr.value = false
  if (alipayPollTimer) {
    clearTimeout(alipayPollTimer)
    alipayPollTimer = null
  }
  alipayPolling.value = false
}

// 收款码模式：用户确认已付款，直接开通VIP（不经过审批）
async function confirmAndActivate() {
  submitting.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/member/pay-confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId: payInfo.orderId }),
    })
    const data = await res.json()

    showQrConfirm.value = false

    if (data.success) {
      upgradeMsg.value = '✅ VIP 已开通成功！'
      currentTier.value = selectedPlan.value?.level || currentTier.value
      setTimeout(() => router.push('/user/center'), 1500)
    } else {
      upgradeMsg.value = `❌ ${data.error || '开通失败'}`
    }
  } catch (e: any) {
    upgradeMsg.value = `❌ ${e.message}`
  }
  submitting.value = false
  setTimeout(() => { upgradeMsg.value = '' }, 5000)
}

function closeQrConfirm() {
  showQrConfirm.value = false
}

function cancelPay() {
  showPay.value = false
  selectedPlan.value = null
}

onMounted(fetchData)

onUnmounted(() => {
  if (alipayPollTimer) {
    clearTimeout(alipayPollTimer)
  }
})
</script>

<style scoped>
.vip-page {
  min-height: 100vh;
  background: #0b0e1a;
  color: #e4e4e7;
  padding-bottom: 60px;
}

/* 顶部 */
.vip-header {
  position: relative;
  padding: 60px 20px 50px;
  text-align: center;
  overflow: hidden;
}
.vip-header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%);
  pointer-events: none;
}
.vip-header-content {
  position: relative;
  z-index: 1;
}
.vip-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 8px;
  background: linear-gradient(135deg, #60a5fa, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.vip-subtitle {
  font-size: 0.82rem;
  color: #71717a;
  margin: 0;
}

.vip-loading, .vip-error {
  text-align: center;
  padding: 40px 20px;
  font-size: 0.85rem;
  color: #71717a;
}
.vip-error { color: #ef4444; }

.vip-plans {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
}

.vip-card {
  position: relative;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.25s;
}
.vip-card:hover { border-color: rgba(59,130,246,0.2); background: rgba(255,255,255,0.03); }
.vip-card--current { border-color: rgba(59,130,246,0.25); background: rgba(59,130,246,0.04); }

.vip-card-badge {
  position: absolute;
  top: -1px;
  right: 24px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 0 0 8px 8px;
}

.vip-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.vip-card-icon { font-size: 1.3rem; }
.vip-card-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0;
}

.vip-card-price { margin-bottom: 16px; }
.vip-price-num { font-size: 1.6rem; font-weight: 800; color: #f4f4f5; }
.vip-price-period { font-size: 0.75rem; color: #71717a; font-weight: 400; }

.vip-card-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.vip-feature {
  display: flex;
  align-items: center;
  gap: 8px;
}
.vip-feature-icon { font-size: 0.75rem; flex-shrink: 0; }
.vip-feature-text { font-size: 0.78rem; color: #a1a1aa; }

.vip-card-btn {
  width: 100%;
  padding: 11px 0;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.vip-card-btn--current {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: #71717a;
}
.vip-card-btn--buy {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}
.vip-card-btn--buy:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(59,130,246,0.25);
}
.vip-card-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 支付弹窗 */
.pay-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.pay-dialog {
  background: #12142a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  width: 380px;
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.pay-dialog--qr {
  width: 420px;
}
.pay-title {
  padding: 20px 24px 0;
  font-size: 1rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 16px;
}
.pay-body {
  padding: 0 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.pay-plan-name { font-size: 0.82rem; color: #a1a1aa; }
.pay-amount { font-size: 2rem; font-weight: 800; color: #f4f4f5; }

/* 支付方式选择列表 */
.pay-method-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.pay-method-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.pay-method-item:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(59,130,246,0.3);
}
.pay-method-icon { font-size: 1.3rem; }
.pay-method-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #e4e4e7; }
.pay-method-arrow { font-size: 1.2rem; color: #52525b; }

/* 支付宝付款码区域 */
.pay-alipay-qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 12px 0;
}
.pay-alipay-qr-wrapper {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.pay-alipay-qr-img {
  width: 220px;
  height: 220px;
  display: block;
}
.pay-alipay-loading {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #71717a;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
}

/* 支付状态 */
.pay-status {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  text-align: center;
}
.pay-status--pending {
  background: rgba(234,179,8,0.08);
  color: #eab308;
  border: 1px solid rgba(234,179,8,0.15);
}
.pay-status--paid {
  background: rgba(34,197,94,0.08);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,0.15);
}
.pay-status--failed {
  background: rgba(239,68,68,0.08);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.15);
}

/* 静态收款码模式 */
.pay-qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}
.pay-qr-img {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  object-fit: contain;
}
.pay-qr-account {
  font-size: 0.72rem;
  color: #71717a;
}

.pay-tip {
  font-size: 0.72rem;
  color: #ef4444;
  text-align: center;
  margin-top: 4px;
  max-width: 300px;
  line-height: 1.4;
}

.pay-actions {
  padding: 14px 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.pay-btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.pay-btn--cancel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #a1a1aa; }
.pay-btn--cancel:hover { background: rgba(255,255,255,0.08); }
.pay-btn--confirm { background: linear-gradient(135deg,#3b82f6,#2563eb); color: #fff; }
.pay-btn--confirm:hover:not(:disabled) { opacity: 0.9; }
.pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toast */
.vip-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  z-index: 300;
  animation: fadeUp 0.3s ease;
}
.vip-toast--ok { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.vip-toast--err { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
