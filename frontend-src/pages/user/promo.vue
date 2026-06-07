<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'user', middleware: 'auth' })

const auth = useAuthStore()
const balance = ref(0)
const logs = ref<Array<{ amount: number; type: string; remark: string; createdAt: string }>>([])
const showLogs = ref(false)

onMounted(async () => {
  if (auth.user?.coins !== undefined) {
    balance.value = auth.user.coins
  }
  try {
    const res = await fetch('/api/member/coin-logs', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      logs.value = data.logs || data || []
    }
  } catch {}
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-xl font-bold text-white mb-1">积分中心</h1>
    <p class="text-sm text-gray-400 mb-6">当前积分余额及消费记录</p>

    <!-- Balance Card -->
    <div class="bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] rounded-xl p-6 mb-6 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-40 h-40 bg-[#FFD700]/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-32 h-32 bg-[#00D4FF]/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      <div class="relative">
        <p class="text-sm text-gray-400 mb-1">当前积分余额</p>
        <div class="flex items-baseline gap-2 mb-4">
          <span class="text-4xl font-bold text-[#FFD700]">{{ balance.toLocaleString() }}</span>
          <span class="text-lg text-gray-500">⏣</span>
        </div>
        <button @click="showLogs = !showLogs"
          class="px-4 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-gray-400 hover:text-white transition-all border-none cursor-pointer">
          {{ showLogs ? '收起明细' : '📋 积分明细' }}
        </button>
      </div>
    </div>

    <!-- Notice: Free credit channels closed -->
    <div class="bg-[#1a1010] border border-[#3a2020] rounded-xl p-5 mb-6">
      <div class="flex items-start gap-3">
        <span class="text-lg text-red-400">⚠️</span>
        <div>
          <h3 class="text-white text-sm font-semibold mb-1">免费积分途径已关闭</h3>
          <p class="text-xs text-gray-500 leading-relaxed">
            新用户注册赠送 <strong class="text-[#FFD700]">10 积分</strong>（仅限注册时一次性赠送）。<br>
            推荐奖励、每日签到、分享任务等所有免费获取积分途径均已关闭。<br>
            如需更多积分，请联系客服购买积分套餐。
          </p>
        </div>
      </div>
    </div>

    <!-- Coin Logs -->
    <div v-if="showLogs" class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5 max-h-96 overflow-y-auto">
      <h3 class="text-white text-sm font-semibold mb-3">积分流水</h3>
      <div v-if="logs.length === 0" class="text-center py-6 text-gray-500 text-sm">暂无记录</div>
      <div v-else class="space-y-1.5">
        <div v-for="(log, i) in logs" :key="i"
          class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24]">
          <div class="flex items-center gap-3">
            <span class="text-sm">{{ log.amount > 0 ? '📥' : '📤' }}</span>
            <div>
              <p class="text-sm text-gray-300">{{ log.remark }}</p>
              <p class="text-[10px] text-gray-600">{{ new Date(log.createdAt).toLocaleString('zh-CN') }}</p>
            </div>
          </div>
          <span :class="log.amount > 0 ? 'text-emerald-400' : 'text-red-400'" class="text-sm font-medium">
            {{ log.amount > 0 ? `+${log.amount}` : log.amount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
