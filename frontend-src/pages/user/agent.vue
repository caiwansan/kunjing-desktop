<script setup lang="ts">
// ─── Token helper ───
function getAuthToken(): string {
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return _gt()
  } catch { return '' }
}


import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

definePageMeta({ middleware: 'auth' })

const router = useRouter()

// ─── 状态 ───────────────────────────────────
const loading = ref(true)
const plans = ref<any[]>([])
const dashboard = ref<any>(null)
const agentsCommissions = ref<any[]>([])
const clients = ref<any[]>([])
const withdrawHistory = ref<any[]>([])

const activeSection = ref<'overview' | 'apply' | 'commissions' | 'clients' | 'withdraw'>('overview')

// 申请弹窗
const applyDialog = ref(false)
const selectedPlan = ref('')

// 支付方式选择弹窗
const payDialog = ref(false)
const payOrder = ref<any>(null)
const payMethods = ref<any[]>([])

// 支付二维码弹窗（微信/支付宝通用）
const showPayQr = ref(false)
const payQrCode = ref('')
const payQrBase64 = ref('')
const payQrTitle = ref('扫码支付')
const payQrTip = ref('请使用支付APP扫码完成支付')
const payQrStatus = ref<'pending' | 'paid' | 'failed'>('pending')
const payQrError = ref('')
const payQrPolling = ref(false)
let payQrPollTimer: any = null

// 提现弹窗
const withdrawDialog = ref(false)
const withdrawAmount = ref(0)
const withdrawBankName = ref('')
const withdrawBankAccount = ref('')
const withdrawAccountName = ref('')

// ─── 计算属性 ───────────────────────────────
const isAgent = computed(() => dashboard.value?.agentStatus === 'active')

const planInfo = computed(() => dashboard.value?.plan || null)

// ─── 数据加载 ───────────────────────────────
async function loadAll() {
  loading.value = true
  const token = getAuthToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    const [plansRes, dashRes, commissionRes, clientsRes, withdrawRes] = await Promise.all([
      fetch('/api/agent/plans'),
      fetch('/api/agent/dashboard', { headers }),
      fetch('/api/agent/commission-orders', { headers }),
      fetch('/api/agent/clients', { headers }),
      fetch('/api/agent/withdraw-history', { headers }),
    ])

    if (plansRes.ok) {
      const d = await plansRes.json()
      plans.value = d.data || []
    }

    if (dashRes.ok) {
      const d = await dashRes.json()
      dashboard.value = d.data || null
    } else if (dashRes.status === 403) {
      dashboard.value = { agentStatus: 'none' }
    }

    if (commissionRes.ok) {
      const d = await commissionRes.json()
      agentsCommissions.value = d.data || []
    }

    if (clientsRes.ok) {
      const d = await clientsRes.json()
      clients.value = d.data || []
    }

    if (withdrawRes.ok) {
      const d = await withdrawRes.json()
      withdrawHistory.value = d.data || []
    }
  } catch {}

  loading.value = false
}

// ─── 申请代理 ───────────────────────────────
async function confirmApply() {
  if (!selectedPlan.value) return
  try {
    const token = getAuthToken()
    const res = await fetch('/api/agent/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ planLevel: selectedPlan.value }),
    })
    if (res.ok) {
      const d = await res.json()
      const order = d.data
      // 有支付方式列表时，展示选择弹窗
      if (order.paymentType === 'select' && order.methods?.length > 0) {
        payOrder.value = order
        payMethods.value = order.methods
        payDialog.value = true
        applyDialog.value = false
      } else if (order.payUrl) {
        // 旧兼容：直接跳转
        window.location.href = order.payUrl
      } else {
        router.push(`/user/membership?pay_order=${order.orderNo}&amount=${order.amount}&remark=代理套餐:${order.planName}`)
      }
    } else {
      alert('申请失败，请重试')
    }
  } catch {
    alert('网络错误')
  }
}

// ─── 支付方式选择 ───────────────────────────
async function handlePayByChannel(channel: string) {
  if (!payOrder.value) return
  payDialog.value = false

  if (channel === 'wechat') {
    // 微信 NATIVE 扫码支付
    try {
      const token = getAuthToken()
      const res = await fetch('/api/member/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId: payOrder.value.orderId, channel }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.paymentType === 'wxpay_qr' && data.codeUrl) {
          payQrTitle.value = '微信扫码支付'
          payQrTip.value = '请使用微信扫一扫完成支付'
          payQrCode.value = data.codeUrl
          payQrBase64.value = ''
          payQrStatus.value = 'pending'
          payQrError.value = ''
          showPayQr.value = true
          startPayQrPolling(payOrder.value.orderId)
        }
      } else {
        alert('微信支付创建失败')
      }
    } catch {
      alert('网络错误')
    }
  } else if (channel === 'alipay') {
    // 支付宝跳转收银台
    try {
      const token = getAuthToken()
      const res = await fetch('/api/member/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
          body: JSON.stringify({ orderId: payOrder.value.orderId, channel }),
        })
        if (res.ok) {
          const data = await res.json()
          const payLink = data.qrCode || data.codeUrl || data.payUrl
          if (payLink) {
            payQrTitle.value = '支付宝扫码支付'
            payQrTip.value = '请使用支付宝扫一扫完成支付（扫码后自动跳转至支付宝）'
            payQrCode.value = payLink
            payQrBase64.value = ''
            payQrStatus.value = 'pending'
            payQrError.value = ''
            showPayQr.value = true
            startPayQrPolling(payOrder.value.orderId)

            // 用 qrcode 库生成本地二维码（避免外部 API 依赖）
            try {
              const QRCode = (await import('qrcode')).default
              payQrBase64.value = await QRCode.toDataURL(payLink, { width: 280, margin: 2 })
            } catch { /* 保持外部 API 备用 */ }
          } else {
            alert('支付宝支付创建失败：' + (data.error || '未知错误'))
          }
        } else {
          const errData = await res.json().catch(() => null)
          alert('支付宝支付创建失败：' + (errData?.error || '请求失败'))
        }
      } catch (e: any) {
        alert('网络错误：' + e.message)
      }
    }
  }

// 支付通用轮询（支持支付宝/微信）
function startPayQrPolling(orderId: string) {
  payQrPolling.value = true
  let pollCount = 0

  const poll = async () => {
    if (pollCount >= 120) {
      payQrPolling.value = false
      payQrStatus.value = 'failed'
      payQrError.value = '支付超时，请重新下单'
      return
    }
    pollCount++

    try {
      const token = getAuthToken()
      const res = await fetch(`/api/payment/alipay/status/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()

      if (data.status === 'paid') {
        payQrPolling.value = false
        payQrStatus.value = 'paid'
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_cache')
        setTimeout(() => {
          showPayQr.value = false
          router.push('/user/center')
        }, 1500)
        return
      }
    } catch {
      // 忽略
    }

    // 也查微信支付状态
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/payment/wxpay/status/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.status === 'paid') {
        payQrPolling.value = false
        payQrStatus.value = 'paid'
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_cache')
        setTimeout(() => {
          showPayQr.value = false
          router.push('/user/center')
        }, 1500)
        return
      }
    } catch {
      // 忽略
    }

    if (payQrPolling.value) {
      payQrPollTimer = setTimeout(poll, 5000)
    }
  }

  payQrPollTimer = setTimeout(poll, 5000)
}

function closePayQr() {
  showPayQr.value = false
  if (payQrPollTimer) {
    clearTimeout(payQrPollTimer)
    payQrPollTimer = null
  }
  payQrPolling.value = false
}

// ─── 提现 ───────────────────────────────────
async function submitWithdraw() {
  if (withdrawAmount.value < 1) return
  try {
    const token = getAuthToken()
    const res = await fetch('/api/agent/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        amount: withdrawAmount.value,
        bankName: withdrawBankName.value,
        bankAccount: withdrawBankAccount.value,
        accountName: withdrawAccountName.value,
      }),
    })
    if (res.ok) {
      withdrawDialog.value = false
      withdrawAmount.value = 0
      await loadAll()
    } else {
      alert('提现申请失败')
    }
  } catch {}
}

// ─── 工具函数 ───────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function tierLabel(tier: string | null | undefined): string {
  const map: Record<string, string> = {
    free: '未开通', gold: '黄金', Pro: '钻石', director: '至尊',
  }
  if (!tier || tier === 'free') return '未开通'
  return map[tier] || tier
}

onMounted(loadAll)
</script>

<template>
  <div class="min-h-screen bg-[#050508]">
    <!-- 顶栏 -->
    <header class="h-14 bg-[#07070a] border-b border-white/[0.03] flex items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <router-link to="/studio/v2" class="flex items-center gap-2.5 no-underline">
          <span class="text-sm font-semibold text-white/85">昆仑镜</span>
        </router-link>
        <span class="text-xs text-white/20">|</span>
        <span class="text-xs text-white/30">代理商中心</span>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/user/center" class="text-[10px] px-2.5 py-1 rounded-md bg-white/[0.03] text-blue-400/60 hover:text-blue-400 border-none cursor-pointer no-underline">← 返回会员中心</router-link>
      </div>
    </header>

    <!-- 主内容 -->
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-xl font-bold text-white mb-1">代理商中心</h1>
      <p class="text-sm text-gray-400 mb-6">推广昆仑镜，赚取佣金收益</p>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="inline-block w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
        <p class="text-gray-500 text-sm">加载中...</p>
      </div>

      <template v-else-if="isAgent">
        <!-- 代理商头部 -->
        <div class="bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] rounded-xl p-6 mb-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <h2 class="text-white text-lg font-bold">{{ planInfo?.name || '代理商' }}</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium">已开通</span>
                <span v-if="planInfo" class="text-[10px] text-blue-400">佣金 {{ planInfo.commissionRate }}%</span>
              </div>
              <p class="text-xs text-gray-500">
                {{ dashboard?.agentExpiresAt ? '有效期至: ' + formatDate(dashboard.agentExpiresAt) : '' }}
                · 推广码: <code class="text-blue-400 bg-blue-500/10 px-1 rounded">{{ dashboard?.username || '' }}</code>
              </p>
            </div>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-4">
            <p class="text-[10px] text-gray-500 mb-1">旗下客户</p>
            <p class="text-2xl font-bold text-white">{{ dashboard?.stats?.clientCount || 0 }}</p>
          </div>
          <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-4">
            <p class="text-[10px] text-gray-500 mb-1">累计佣金</p>
            <p class="text-2xl font-bold text-blue-400">¥{{ (dashboard?.stats?.totalCommission || 0).toFixed(2) }}</p>
          </div>
          <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-4">
            <p class="text-[10px] text-gray-500 mb-1">待结算</p>
            <p class="text-2xl font-bold text-yellow-400">¥{{ (dashboard?.stats?.pendingCommission || 0).toFixed(2) }}</p>
          </div>
          <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-4">
            <p class="text-[10px] text-gray-500 mb-1">已结算</p>
            <p class="text-2xl font-bold text-emerald-400">¥{{ (dashboard?.stats?.settledCommission || 0).toFixed(2) }}</p>
            <button @click="withdrawDialog = true"
              class="mt-1 px-2 py-0.5 rounded bg-emerald-500/10 text-[10px] text-emerald-400 hover:bg-emerald-500/20 border-none cursor-pointer transition-colors">
              提现 →
            </button>
          </div>
        </div>

        <!-- 功能导航 -->
        <div class="flex gap-2 mb-5 border-b border-[#1a1a24] pb-0">
          <button v-for="s in [{id:'overview',label:'📊 概览'},{id:'commissions',label:'💵 佣金明细'},{id:'clients',label:'👥 客户列表'},{id:'withdraw',label:'💰 提现记录'}]"
            :key="s.id"
            @click="activeSection = s.id"
            class="px-4 py-2 text-xs border-b-2 transition cursor-pointer border-none bg-transparent"
            :class="activeSection === s.id ? 'text-blue-400 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
            {{ s.label }}
          </button>
        </div>

        <!-- 佣金明细 -->
        <div v-if="activeSection === 'commissions'" class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
          <h3 class="text-white text-sm font-semibold mb-3">佣金明细</h3>
          <div v-if="agentsCommissions.length === 0" class="text-center py-8 text-gray-500 text-sm">暂无佣金记录</div>
          <div v-else class="space-y-2">
            <div v-for="c in agentsCommissions" :key="c.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24]">
              <div>
                <p class="text-xs text-white/70">¥{{ c.commissionAmount.toFixed(2) }} <span class="text-gray-500 text-[10px]">(比例 {{ c.commissionRate }}%)</span></p>
                <p class="text-[10px] text-gray-600">{{ c.remark || '佣金收入' }} · {{ formatDateTime(c.createdAt) }}</p>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full" :class="c.status === 'settled' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'">
                {{ c.status === 'settled' ? '已结算' : '待结算' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 客户列表 -->
        <div v-if="activeSection === 'clients'" class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
          <h3 class="text-white text-sm font-semibold mb-3">客户列表</h3>
          <div v-if="clients.length === 0" class="text-center py-8 text-gray-500 text-sm">暂无客户</div>
          <div v-else class="space-y-2">
            <div v-for="c in clients" :key="c.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24]">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 font-medium uppercase">
                  {{ (c.username || c.email || '?').charAt(0) }}
                </div>
                <div>
                  <p class="text-sm text-white/80">{{ c.username || '用户' }}</p>
                  <p class="text-[10px] text-gray-600">{{ c.email || '' }}</p>
                </div>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full" :class="(c.memberTier && c.memberTier !== 'free') ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'">
                {{ tierLabel(c.memberTier) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 提现记录 -->
        <div v-if="activeSection === 'withdraw'" class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
          <h3 class="text-white text-sm font-semibold mb-3">提现记录</h3>
          <div v-if="withdrawHistory.length === 0" class="text-center py-8 text-gray-500 text-sm">暂无提现记录</div>
          <div v-else class="space-y-2">
            <div v-for="w in withdrawHistory" :key="w.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24]">
              <div>
                <p class="text-sm text-gray-300">¥{{ w.amount.toFixed(2) }}</p>
                <p class="text-[10px] text-gray-600">{{ formatDate(w.createdAt) }}</p>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full" :class="{
                'bg-yellow-500/10 text-yellow-400': w.status === 'pending',
                'bg-green-500/10 text-green-400': w.status === 'approved',
                'bg-red-500/10 text-red-400': w.status === 'rejected',
              }">
                {{ w.status === 'pending' ? '处理中' : w.status === 'approved' ? '已到账' : '已拒绝' }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- 非代理商：展示套餐+申请 -->
      <template v-else>
        <div class="bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] rounded-xl p-6 mb-6">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-2xl">🤝</span>
            <div>
              <h2 class="text-white text-lg font-bold">成为代理商</h2>
              <p class="text-xs text-gray-500">选择一个套餐，立即成为昆仑镜代理商，推广赚取佣金</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div v-for="p in plans" :key="p.id"
            class="relative bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] rounded-xl p-6 overflow-hidden transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 group">
            <div class="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity"
              :style="{ background: p.color }" />
            <div class="relative">
              <div class="flex items-center justify-between mb-3">
                <span class="text-2xl">{{ p.icon }}</span>
                <div class="text-right">
                  <span class="text-xl font-bold text-blue-400">¥{{ p.price }}</span>
                  <span class="text-[10px] text-gray-500">/{{ p.months }}个月</span>
                </div>
              </div>
              <h3 class="text-white text-base font-semibold mb-1">{{ p.name }}</h3>
              <p class="text-xs text-blue-400 mb-3">佣金比例 {{ p.commissionRate }}%</p>
              <div class="space-y-1 mb-4">
                <div v-for="b in (() => { try { return JSON.parse(p.benefits) } catch { return [] } })()" :key="b"
                  class="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span class="text-emerald-400">✓</span> {{ b }}
                </div>
              </div>
              <button @click="selectedPlan = p.level; applyDialog = true"
                class="w-full py-2 rounded-lg text-xs font-medium transition-all border-none cursor-pointer text-white"
                :style="{ background: p.color }">
                立即申请
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 申请弹窗 -->
      <Teleport to="body">
        <div v-if="applyDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="applyDialog = false">
          <div class="w-full max-w-sm mx-4 bg-[#09090c] border border-[#1a1a24] rounded-xl p-6 shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-white font-semibold">确认申请</h3>
              <button @click="applyDialog = false" class="text-gray-500 hover:text-white text-lg border-none bg-transparent cursor-pointer">✕</button>
            </div>
            <p class="text-sm text-gray-400 mb-4">确定购买 <strong class="text-white">{{ plans.find(p => p.level === selectedPlan)?.name }}</strong> 吗？</p>
            <p class="text-xs text-gray-500 mb-5">支付 ¥{{ plans.find(p => p.level === selectedPlan)?.price }} 后即开通代理商资格</p>
            <div class="flex gap-2">
              <button @click="confirmApply"
                class="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 border-none cursor-pointer transition-colors">
                确认并支付
              </button>
              <button @click="applyDialog = false"
                class="px-4 py-2.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10 border-none cursor-pointer transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 支付方式选择弹窗 -->
      <Teleport to="body">
        <div v-if="payDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="payDialog = false">
          <div class="w-full max-w-xs mx-4 bg-[#09090c] border border-[#1a1a24] rounded-xl p-6 shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-white font-semibold text-sm">选择支付方式</h3>
              <button @click="payDialog = false" class="text-gray-500 hover:text-white text-lg border-none bg-transparent cursor-pointer">✕</button>
            </div>
            <p class="text-xs text-gray-500 mb-4">支付 <span class="text-yellow-400 font-medium">¥{{ payOrder?.amount }}</span> 购买代理套餐</p>
            <div class="space-y-2">
              <button v-for="m in payMethods" :key="m.id"
                @click="handlePayByChannel(m.channel)"
                class="w-full py-3 px-4 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-white text-sm flex items-center gap-3 hover:border-blue-500/50 transition-colors cursor-pointer"
              >
                <span>{{ m.icon }}</span>
                <span>{{ m.name }}</span>
              </button>
            </div>
            <button @click="payDialog = false"
              class="w-full mt-4 py-2.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10 border-none cursor-pointer transition-colors">
              取消
            </button>
          </div>
        </div>
      </Teleport>

      <!-- 支付二维码弹窗（微信/支付宝通用） -->
      <Teleport to="body">
        <div v-if="showPayQr" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="closePayQr">
          <div class="w-full max-w-xs mx-4 bg-[#09090c] border border-[#1a1a24] rounded-xl p-6 shadow-2xl text-center">
            <h3 class="text-white font-semibold text-sm mb-4">{{ payQrTitle }}</h3>
            <div class="bg-white rounded-lg p-4 inline-block mb-3">
              <img v-if="payQrBase64" :src="payQrBase64" class="w-[200px] h-[200px]" :alt="payQrTitle" />
              <img v-else :src="`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payQrCode)}`" class="w-[200px] h-[200px]" :alt="payQrTitle" />
            </div>
            <p class="text-xs text-gray-400 mb-3">{{ payQrTip }}</p>
            <div v-if="payQrStatus === 'pending'" class="text-xs text-yellow-400 mb-3">⏳ 等待支付...</div>
            <div v-if="payQrStatus === 'paid'" class="text-xs text-green-400 mb-3">✅ 支付成功！正在跳转...</div>
            <div v-if="payQrStatus === 'failed'" class="text-xs text-red-400 mb-3">❌ {{ payQrError }}</div>
            <button @click="closePayQr"
              class="w-full py-2.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer bg-white/5 text-gray-400 hover:bg-white/10">
              取消支付
            </button>
          </div>
        </div>
      </Teleport>

      <!-- 提现弹窗 -->
      <Teleport to="body">
        <div v-if="withdrawDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="withdrawDialog = false">
          <div class="w-full max-w-sm mx-4 bg-[#09090c] border border-[#1a1a24] rounded-xl p-6 shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-white font-semibold">提现申请</h3>
              <button @click="withdrawDialog = false" class="text-gray-500 hover:text-white text-lg border-none bg-transparent cursor-pointer">✕</button>
            </div>
            <div class="space-y-3 mb-4">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">提现金额 (元)</label>
                <input v-model.number="withdrawAmount" type="number" min="1" step="0.01"
                  class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">开户行</label>
                <input v-model="withdrawBankName" type="text" placeholder="如：中国银行"
                  class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">银行账号</label>
                <input v-model="withdrawBankAccount" type="text" placeholder="银行卡号"
                  class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">户名</label>
                <input v-model="withdrawAccountName" type="text" placeholder="持卡人姓名"
                  class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50" />
              </div>
            </div>
            <button @click="submitWithdraw" :disabled="!withdrawAmount || withdrawAmount < 1"
              class="w-full py-2.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer"
              :class="withdrawAmount >= 1 ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-600/20 text-gray-500 cursor-not-allowed'">
              提交提现申请
            </button>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
