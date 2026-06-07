<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'user', middleware: 'auth' })

const auth = useAuthStore()
const activeTab = ref<'logs' | 'recharge'>('recharge')
const logs = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const msg = ref('')

const payMethods = ref<any[]>([])
const selectedMethod = ref('')
const selectedAmount = ref(10)
const currentOrder = ref<any>(null)
const showQr = ref(false)

const rechargeOptions = [
  { amount: 10, coins: 1000, popular: false },
  { amount: 30, coins: 3000, popular: true },
  { amount: 50, coins: 5000, popular: false },
  { amount: 100, coins: 11000, popular: false },
  { amount: 200, coins: 22000, popular: false },
  { amount: 500, coins: 60000, popular: false },
]

async function loadLogs() {
  loading.value = true
  try {
    const res = await fetch('/api/user/credits/logs', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      logs.value = data.logs || []
      total.value = data.total || 0
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadPayMethods() {
  try {
    const res = await fetch('/api/payment/methods')
    if (res.ok) {
      const data = await res.json()
      payMethods.value = data
      if (data.length > 0) selectedMethod.value = data[0].method
    }
  } catch (e) {
    console.error(e)
  }
}

async function createRecharge() {
  if (!selectedMethod.value) {
    msg.value = '请选择支付方式'
    return
  }
  msg.value = ''
  currentOrder.value = null
  showQr.value = false

  const res = await fetch('/api/payment/recharge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({
      amount: selectedAmount.value,
      method: selectedMethod.value,
    }),
  })

  if (res.ok) {
    currentOrder.value = await res.json()
    showQr.value = true
    msg.value = '请使用手机扫码支付'
  } else {
    const err = await res.json()
    msg.value = err.error || '创建订单失败'
  }
}

function formatType(type: string): string {
  const map: Record<string, string> = { recharge: '充值', consume: '消耗', reward: '奖励', transfer_in: '转入', transfer_out: '转出', storage_upgrade: '扩容', agent_upgrade: '代理升级' }
  return map[type] || type
}

function formatAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`
}

const methodText = (m: string) => m === 'wechat' ? '微信' : '支付宝'

onMounted(() => {
  loadLogs()
  loadPayMethods()
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold text-white/80 mb-6">⏣ 积分中心</h1>

    <!-- Balance Hero -->
    <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] p-6 mb-5">
      <div class="absolute top-0 right-0 w-40 h-40 rounded-full bg-yellow-400/5" style="transform: translate(20%, -30%)"></div>
      <div class="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-blue-400/5" style="transform: translate(-20%, 20%)"></div>

      <div class="relative text-center">
        <p class="text-[10px] text-white/30 mb-2 tracking-wider">当前积分余额</p>
        <div class="flex items-baseline justify-center gap-2 mb-1">
          <span class="text-5xl font-bold bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">{{ auth.credits?.toLocaleString() || 0 }}</span>
          <span class="text-lg text-yellow-400/40">⏣</span>
        </div>
        <p class="text-[10px] text-white/20">可用积分 · 消耗后不可退还</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex mb-5 bg-[#09090c] rounded-xl p-1 border border-[#1a1a24]">
      <button @click="activeTab = 'recharge'"
        :class="['flex-1 py-2.5 text-xs font-medium rounded-lg border-none cursor-pointer transition-all',
          activeTab === 'recharge' ? 'bg-gradient-to-r from-orange-500/15 to-rose-500/15 text-orange-400 border border-orange-500/20 shadow-sm' : 'bg-transparent text-white/30 hover:text-white/50']">
        💰 充值积分
      </button>
      <button @click="activeTab = 'logs'"
        :class="['flex-1 py-2.5 text-xs font-medium rounded-lg border-none cursor-pointer transition-all',
          activeTab === 'logs' ? 'bg-gradient-to-r from-orange-500/15 to-rose-500/15 text-orange-400 border border-orange-500/20 shadow-sm' : 'bg-transparent text-white/30 hover:text-white/50']">
        📋 积分流水
      </button>
    </div>

    <!-- Recharge Tab -->
    <div v-if="activeTab === 'recharge'">
      <!-- Quick Select -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <button v-for="opt in rechargeOptions" :key="opt.amount"
          @click="selectedAmount = opt.amount; showQr = false; currentOrder = null"
          :class="[
            'relative py-3.5 rounded-xl text-xs font-medium border cursor-pointer transition-all',
            selectedAmount === opt.amount
              ? 'bg-gradient-to-br from-orange-500/15 to-rose-500/15 border-orange-500/30 text-orange-400 shadow-sm'
              : 'bg-[#09090c] border-[#1a1a24] text-white/40 hover:border-white/20 hover:text-white/60'
          ]">
          <span class="block text-sm font-bold">¥{{ opt.amount }}</span>
          <span class="block text-[9px] text-white/30 mt-1">+{{ opt.coins.toLocaleString() }} 积分</span>
          <span v-if="opt.popular"
            class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[7px] font-bold tracking-wide shadow-lg">
            推荐
          </span>
        </button>
      </div>

      <!-- Payment Method -->
      <div class="rounded-xl bg-[#09090c] border border-[#1a1a24] p-4 mb-4">
        <p class="text-[10px] text-white/30 mb-3 tracking-wider">选择支付方式</p>
        <div class="flex gap-3">
          <button v-for="pm in payMethods" :key="pm.method"
            @click="selectedMethod = pm.method; showQr = false; currentOrder = null"
            :class="[
              'flex-1 py-3 rounded-lg text-xs font-medium border cursor-pointer transition-all flex items-center justify-center gap-2',
              selectedMethod === pm.method
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-[#0B1020] border-[#1a1a24] text-white/40 hover:text-white/60'
            ]">
            <span class="text-base">{{ pm.method === 'wechat' ? '💚' : '💙' }}</span>
            {{ pm.name }}
          </button>
        </div>
      </div>

      <!-- Confirm -->
      <button @click="createRecharge"
        class="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-semibold border-none cursor-pointer hover:from-orange-400 hover:to-rose-400 transition-all shadow-lg shadow-orange-500/20 tracking-wide">
        扫码支付 · ¥{{ selectedAmount }}
      </button>

      <!-- QR -->
      <div v-if="showQr && currentOrder"
        class="mt-4 p-5 rounded-xl bg-[#09090c] border border-[#1a1a24] text-center">
        <p class="text-xs text-white/50 mb-3">
          💳 {{ methodText(currentOrder.method) }} · 订单: {{ currentOrder.orderNo?.slice(0, 12) }}...
        </p>
        <div v-if="currentOrder.qrCodeUrl" class="mb-3">
          <img :src="currentOrder.qrCodeUrl"
            class="w-48 h-48 mx-auto rounded-xl border border-white/[0.08] shadow-lg" />
        </div>
        <div v-else class="mb-3 p-4 bg-[#0B1020] rounded-xl border border-dashed border-yellow-500/30">
          <p class="text-xs text-white/60 mb-1">🏦 收款账号</p>
          <p class="text-sm text-white/90 font-mono select-all break-all">{{ currentOrder.account || '请联系管理员获取收款信息' }}</p>
          <p v-if="currentOrder.payeeName" class="text-[10px] text-white/30 mt-1">收款人: {{ currentOrder.payeeName }}</p>
        </div>
        <p class="text-xs text-emerald-400/70 mb-2">扫码或转账后联系管理员确认到账</p>
        <div class="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
          <span class="w-2 h-2 rounded-full bg-yellow-400/40 animate-pulse"></span>
          等待支付确认中...
        </div>
      </div>

      <div v-if="msg && !showQr" class="mt-3 p-2.5 rounded-lg"
        :class="msg.includes('成功') || msg.includes('✅') ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-red-500/5 border border-red-500/10'">
        <p class="text-[10px] text-center m-0"
          :class="msg.includes('成功') || msg.includes('✅') ? 'text-emerald-400/70' : 'text-red-400/70'">{{ msg }}</p>
      </div>
    </div>

    <!-- Logs Tab -->
    <div v-if="activeTab === 'logs'">
      <div v-if="loading" class="flex flex-col items-center py-12">
        <div class="w-6 h-6 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin mb-2"></div>
        <span class="text-xs text-white/30">加载中...</span>
      </div>
      <div v-else-if="logs.length === 0" class="text-center py-12 text-white/20">
        <span class="text-4xl block mb-3">📭</span>
        <p class="text-xs">暂无积分流水</p>
      </div>
      <div v-else class="space-y-1.5">
        <div v-for="log in logs" :key="log.id"
          class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#09090c] border border-[#1a1a24] hover:border-white/10 transition-all">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="text-lg shrink-0">{{ log.amount > 0 ? '📥' : '📤' }}</span>
            <div>
              <p class="text-xs text-white/60 truncate">{{ log.remark || formatType(log.type) }}</p>
              <p class="text-[10px] text-white/20 mt-0.5">{{ new Date(log.createdAt).toLocaleString('zh-CN') }}</p>
            </div>
          </div>
          <span :class="log.amount > 0 ? 'text-emerald-400' : 'text-red-400'" class="text-sm font-mono ml-3 font-bold">
            {{ formatAmount(log.amount) }}
          </span>
        </div>
      </div>
      <p v-if="total > logs.length" class="text-[10px] text-white/20 text-center mt-4">
        共 {{ total }} 条记录 · 只显示最近 {{ logs.length }} 条
      </p>
    </div>
  </div>
</template>
