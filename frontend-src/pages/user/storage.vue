<template>
  <div class="storage-page">
    <div class="storage-header">
      <button class="back-btn" @click="router.push('/user/center')">← 个人中心</button>
      <h1>我的存储空间</h1>
    </div>

    <div v-if="loading" class="storage-loading">加载中...</div>

    <div v-else class="storage-content">
      <!-- 使用概览卡片 -->
      <div class="storage-card">
        <div class="storage-card-header">
          <span class="storage-card-icon">💾</span>
          <span class="storage-card-title">存储空间使用情况</span>
        </div>
        <div class="storage-large-bar">
          <div class="storage-large-bar-fill" :style="{ width: data.percent + '%' }" :class="{ 'fill-warning': data.percent > 80, 'fill-danger': data.percent > 95 }" />
        </div>
        <div class="storage-usage-text">
          已使用 <strong>{{ data.usedFormatted }}</strong> / {{ data.totalFormatted }}
          <span class="storage-percent">（{{ data.percent }}%）</span>
        </div>
      </div>

      <!-- 会员等级配额表 -->
      <div class="storage-tiers">
        <h2>各等级存储配额</h2>
        <div class="tier-table">
          <div v-for="tier in tiers" :key="tier.label" class="tier-row" :class="{ 'tier-row--current': tier.isCurrent }">
            <div class="tier-icon">{{ tier.icon }}</div>
            <div class="tier-info">
              <span class="tier-name">{{ tier.label }}</span>
              <span class="tier-space">{{ tier.space }}</span>
            </div>
            <div v-if="tier.isCurrent" class="tier-tag">当前</div>
          </div>
        </div>
      </div>

      <!-- 升级提示 -->
      <div v-if="data.tier === 'free'" class="storage-upgrade">
        <p>免费用户只有 100MB 存储空间，升级会员可获得 3GB～100GB 空间</p>
        <router-link to="/user/membership" class="upgrade-link">查看会员方案 →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const data = ref({ used: 0, total: 1e9, usedFormatted: '0 B', totalFormatted: '1 GB', percent: 0, tier: 'free' })
const currentTier = ref('free')

const tiers = [
  { label: '普通用户', icon: '🔓', space: '100 MB', key: 'free' },
  { label: '黄金会员', icon: '⭐', space: '3 GB', key: 'vip' },
  { label: '钻石会员', icon: '💎', space: '5 GB', key: 'Pro' },
  { label: '年度会员', icon: '🌟', space: '10 GB', key: 'vip_year' },
  { label: '至尊会员', icon: '👑', space: '50 GB', key: 'vip_platinum' },
]

onMounted(async () => {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  if (!token) { loading.value = false; return }

  try {
    const res = await fetch('/api/user/storage', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        data.value = json.data
        currentTier.value = json.data.tier
      }
    }
  } catch (e) {
    console.warn('[Storage] load error:', e)
  }
  loading.value = false
})
</script>

<style scoped>
.storage-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  padding: 24px;
}
.storage-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.storage-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}
.back-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
.storage-loading {
  text-align: center;
  padding: 60px;
  color: #94a3b8;
}
.storage-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}
.storage-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.storage-card-icon { font-size: 24px; }
.storage-card-title { font-size: 18px; font-weight: 600; }
.storage-large-bar {
  height: 24px;
  background: rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}
.storage-large-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 12px;
  transition: width 0.5s ease;
}
.storage-large-bar-fill.fill-warning { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.storage-large-bar-fill.fill-danger { background: linear-gradient(90deg, #ef4444, #dc2626); }
.storage-usage-text { font-size: 15px; color: #94a3b8; }
.storage-usage-text strong { color: #e2e8f0; }
.storage-percent { color: #64748b; font-size: 13px; }
.storage-tiers { margin-bottom: 24px; }
.storage-tiers h2 { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
.tier-table { display: flex; flex-direction: column; gap: 8px; }
.tier-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
}
.tier-row--current {
  border-color: rgba(99,102,241,0.4);
  background: rgba(99,102,241,0.06);
}
.tier-icon { font-size: 20px; }
.tier-info { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.tier-name { font-size: 14px; font-weight: 500; }
.tier-space { font-size: 13px; color: #64748b; }
.tier-tag {
  padding: 3px 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}
.storage-upgrade {
  text-align: center;
  padding: 24px;
  background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 12px;
}
.storage-upgrade p { margin: 0 0 12px; color: #94a3b8; font-size: 14px; }
.upgrade-link {
  display: inline-block;
  padding: 8px 24px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
</style>
