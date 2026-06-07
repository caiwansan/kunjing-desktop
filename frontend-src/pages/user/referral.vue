<template>
  <div class="referral-page">
    <div class="referral-header">
      <button class="back-btn" @click="router.push('/user/center')">← 个人中心</button>
      <h1>我要推荐</h1>
    </div>

    <div v-if="loading" class="referral-loading">加载中...</div>

    <div v-else class="referral-content">
      <!-- 推荐链接卡片 -->
      <div class="referral-card">
        <div class="referral-card-icon">📣</div>
        <h2>分享给朋友</h2>
        <p class="referral-desc">推荐昆仑镜 AI 短剧工具给朋友，他们注册后你获得奖励积分</p>
        <div class="referral-link-box">
          <input ref="linkInput" :value="referralUrl" class="referral-link-input" readonly @focus="$event.target.select()" />
          <button class="copy-btn" @click="copyLink">复制链接</button>
        </div>
      </div>

      <!-- 邀请码 -->
      <div class="referral-code-card">
        <span class="referral-code-label">我的邀请码</span>
        <span class="referral-code-value">{{ referralCode }}</span>
        <button class="copy-small-btn" @click="copyCode">复制</button>
      </div>

      <!-- 奖励统计 -->
      <div class="referral-stats">
        <div class="stat-card">
          <span class="stat-value">{{ totalRewardCoins }}</span>
          <span class="stat-label">累计奖励积分</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ childrenCount }}</span>
          <span class="stat-label">邀请好友数</span>
        </div>
      </div>

      <!-- 奖励规则 -->
      <div class="referral-rules">
        <h3>奖励规则</h3>
        <ul>
          <li>朋友通过你的链接注册，你获得 50 积分奖励</li>
          <li>朋友首次生成作品，你额外获得 20 积分</li>
          <li>朋友升级 VIP，你获得其充值金额 10% 的积分返还</li>
          <li>积分可用于生成图片、视频等创作</li>
        </ul>
      </div>

      <!-- 已邀请好友 -->
      <div v-if="children.length > 0" class="referral-friends">
        <h3>已邀请好友（{{ children.length }}）</h3>
        <div v-for="child in children" :key="child.user.id" class="friend-row">
          <span class="friend-avatar">{{ (child.user.username || child.user.email || 'U').charAt(0).toUpperCase() }}</span>
          <span class="friend-name">{{ child.user.username || child.user.email?.split('@')[0] || '好友' }}</span>
          <span class="friend-time">{{ formatTime(child.user.createdAt) }}</span>
        </div>
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
const referralCode = ref('')
const referralUrl = ref('')
const totalRewardCoins = ref(0)
const children = ref<any[]>([])
const childrenCount = ref(0)

function formatTime(t: string): string {
  if (!t) return ''
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch { return t }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(referralUrl.value)
    alert('推荐链接已复制')
  } catch {
    prompt('复制链接:', referralUrl.value)
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(referralCode.value)
    alert('邀请码已复制')
  } catch {
    prompt('邀请码:', referralCode.value)
  }
}

onMounted(async () => {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  if (!token) { loading.value = false; return }

  try {
    const res = await fetch('/api/user/promo', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const json = await res.json()
      referralUrl.value = json.referralUrl || ''
      referralCode.value = json.referralCode || ''
      totalRewardCoins.value = json.totalRewardCoins || 0
      children.value = json.children || []
      childrenCount.value = children.value.length
    }
  } catch (e) {
    console.warn('[Referral] load error:', e)
    // fallback: 尝试从 referral-code 接口获取
    try {
      const res2 = await fetch('/api/user/referral-code', { headers: { Authorization: `Bearer ${token}` } })
      if (res2.ok) {
        const json2 = await res2.json()
        referralUrl.value = json2.referralUrl || ''
        referralCode.value = json2.referralCode || ''
      }
    } catch {}
  }
  loading.value = false
})
</script>

<style scoped>
.referral-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  padding: 24px;
}
.referral-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.referral-header h1 {
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
.referral-loading { text-align: center; padding: 60px; color: #94a3b8; }
.referral-content { max-width: 600px; margin: 0 auto; }
.referral-card {
  text-align: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 32px 24px;
  margin-bottom: 16px;
}
.referral-card-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.referral-card h2 { margin: 0 0 8px; font-size: 20px; }
.referral-desc { color: #94a3b8; font-size: 14px; margin: 0 0 20px; }
.referral-link-box {
  display: flex;
  gap: 8px;
  max-width: 450px;
  margin: 0 auto;
}
.referral-link-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.3);
  color: #e2e8f0;
  font-size: 13px;
  font-family: monospace;
}
.copy-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}
.referral-code-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  margin-bottom: 16px;
}
.referral-code-label { font-size: 14px; color: #94a3b8; }
.referral-code-value {
  flex: 1;
  font-family: monospace;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #a5b4fc;
}
.copy-small-btn {
  padding: 6px 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.referral-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
  padding: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
}
.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.stat-label { font-size: 13px; color: #64748b; margin-top: 4px; display: block; }
.referral-rules {
  padding: 20px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  margin-bottom: 16px;
}
.referral-rules h3 { margin: 0 0 12px; font-size: 16px; }
.referral-rules ul { margin: 0; padding-left: 20px; }
.referral-rules li { color: #94a3b8; font-size: 13px; margin-bottom: 8px; line-height: 1.5; }
.referral-friends { margin-bottom: 24px; }
.referral-friends h3 { font-size: 16px; margin: 0 0 12px; }
.friend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  margin-bottom: 6px;
}
.friend-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.friend-name { flex: 1; font-size: 14px; }
.friend-time { font-size: 12px; color: #64748b; }
</style>
