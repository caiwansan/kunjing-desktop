<template>
  <aside class="pipeline-sidebar">
    <a href="/" class="brand-logo" title="返回首页">
      <img src="/kunlun-mirror.svg" class="brand-icon" alt="昆仑镜" />
      <span class="brand-name">昆仑镜</span>
    </a>
    <div class="stages">
      <div
        v-for="stage in stages"
        :key="stage.id"
        class="stage-item"
        :class="{
          active: stage.id === activeStageId,
          completed: stage.status === 'completed',
          running: stage.status === 'running',
          error: stage.status === 'error',
        }"
        @click="$emit('select', stage.id)"
      >
        <div class="stage-icon">{{ stage.icon }}</div>
        <div class="stage-body">
          <div class="stage-title">{{ stage.title }}</div>
          <div class="stage-status-bar">
            <div class="stage-indicator" :class="stage.status"></div>
            <span class="stage-status-text">{{ statusLabel(stage.status) }}</span>
          </div>
          <div v-if="stage.status === 'running'" class="stage-progress-bg">
            <div class="stage-progress-fill" :style="{ width: stage.progress + '%' }"></div>
          </div>
          <div v-if="stage.error" class="stage-error">{{ stage.error }}</div>
        </div>
      </div>
    </div>

    <!-- 独立功能入口 -->
    <div class="extra-tools">
      <div class="extra-tool-item" @click="$emit('open-video-editor')">
        <span class="extra-tool-icon">✂️</span>
        <span class="extra-tool-name">剪辑视频</span>
      </div>
    </div>

    <!-- 底部功能区 -->
    <div class="sidebar-footer">
      <!-- 会员卡片（点击直接跳转：免费用户→会员中心，已付费用户→个人中心） -->
      <div v-if="planInfo" class="vip-card-wrapper" @click="handleCardClick">
        <div class="vip-card" :style="vipCardStyle">
          <div class="vip-card-bg" :style="{ background: vipInfo?.gradient }" />
          <div class="vip-card-glow" :style="{ background: vipInfo?.glowColor }" />
          <div class="vip-card-content">
            <div class="vip-card-left">
              <div class="vip-card-avatar" :style="{ background: vipInfo?.gradient }">{{ avatarChar }}</div>
            </div>
            <div class="vip-card-right">
              <div class="vip-card-top">
                <span class="vip-card-tier-icon">{{ vipInfo?.icon }}</span>
                <span class="vip-card-tier-name" :style="{ color: vipInfo?.color }">{{ vipInfo?.label || planLabel }}</span>
              </div>
              <div class="vip-card-coins">
                <span class="vip-coins-icon">🪙</span>
                <span class="vip-coins-num">{{ credits }}</span>
                <span class="vip-coins-unit">积分</span>
              </div>
              <div class="vip-card-expiry">
                <span class="vip-expiry-label">到期日:</span>
                <span class="vip-expiry-date">{{ formattedExpiry }}</span>
              </div>
              <template v-if="planClass === 'free'">
                <button class="vip-card-upgrade" @click.stop="goUpgrade">升级 VIP</button>
              </template>
              <template v-else>
                <div class="vip-card-entrance" @click.stop="goUserCenter">
                  <span class="vip-entrance-text">进入个人中心 →</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="vip-card-wrapper" @click="goLogin">
        <div class="vip-card guest">
          <div class="vip-card-content">
            <div class="vip-card-left">
              <div class="vip-card-avatar guest-avatar">👤</div>
            </div>
            <div class="vip-card-right">
              <div class="vip-card-top">
                <span class="vip-card-tier-name">未登录</span>
              </div>
              <div class="vip-card-sub">点击登录 / 注册</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 大模型设置 -->
      <div class="model-config-card" @click="openModelSettings">
        <div class="model-config-icon">🤖</div>
        <div class="model-config-text">
          <span class="model-config-title">大模型设置</span>
          <span class="model-config-desc">API Key &amp; 模型偏好</span>
        </div>
        <span class="model-config-arrow">⚙</span>
      </div>

      <!-- 本地模型（桌面版/移动浏览器均可使用） -->
      <div class="model-config-card" @click="showEngineInstaller = true">
        <div class="model-config-icon">🔧</div>
        <div class="model-config-text">
          <span class="model-config-title">本地引擎</span>
          <span class="model-config-desc">Ollama / ComfyUI / 视频</span>
        </div>
        <span class="model-config-arrow">📥</span>
      </div>
    </div>
  </aside>
  <ModelSettingsModal :visible="showModelSettingsModal" @close="showModelSettingsModal = false" />
  <LocalEngineInstaller :visible="showEngineInstaller" @close="showEngineInstaller = false" />
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { PipelineStage, PipelineStageId } from '~/studio-v2/types/runtime/index'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'
import LocalEngineInstaller from '~/components/director/LocalEngineInstaller.vue'

defineProps<{
  stages: PipelineStage[]
  activeStageId: PipelineStageId
}>()

defineEmits<{
  select: [stageId: PipelineStageId]
  'open-video-editor': []
}>()

const showModelSettingsModal = ref(false)
const showEngineInstaller = ref(false)
const planInfo = ref<any>(null)
const userInfo = ref<any>(null)
const credits = ref(0)
const consumedCredits = ref(0)

const planLabel = computed(() => {
  if (!planInfo.value) return '未登录'
  const p = planInfo.value.membership?.tier || planInfo.value.memberTier || 'free'
  const names: Record<string, string> = {
    free: '免费用户', trial: '新人体验卡', gold: '黄金会员', Pro: '钻石会员',
    premium: '黄金会员', vip: '黄金会员', director: '年卡会员',
    vip_year: '钻石会员', vip_platinum: '至尊会员'
  }
  return names[p] || p
})

const planClass = computed(() => {
  if (!planInfo.value) return 'free'
  return (planInfo.value.membership?.tier || planInfo.value.memberTier || 'free').toLowerCase()
})

const formattedExpiry = computed(() => {
  if (!planInfo.value?.expiresAt) return '永久'
  try {
    return new Date(planInfo.value.expiresAt).toLocaleDateString('zh-CN')
  } catch {
    return planInfo.value.expiresAt
  }
})

const avatarChar = computed(() => {
  if (userInfo.value?.name) return userInfo.value.name.charAt(0)
  if (planInfo.value?.email) return planInfo.value.email.charAt(0).toUpperCase()
  return 'U'
})

const vipInfo = computed(() => {
  const MAP: Record<string, { label: string; icon: string; color: string; gradient: string; glowColor: string }> = {
    free: { label: '免费用户', icon: '🆓', color: '#9ca3af', gradient: 'linear-gradient(135deg, #374151, #4b5563)', glowColor: 'rgba(107,114,128,0.15)' },
    trial: { label: '新人体验卡', icon: '🎁', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #fcd34d)', glowColor: 'rgba(245,158,11,0.2)' },
    gold: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    premium: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    vip: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.25)' },
    Pro: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    director: { label: '年卡会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #c084fc)', glowColor: 'rgba(147,51,234,0.2)' },
    vip_year: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    vip_platinum: { label: '至尊会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #f472b6)', glowColor: 'rgba(147,51,234,0.2)' },
  }
  return MAP[planClass.value] || MAP.free
})

const vipCardStyle = computed(() => ({
  borderColor: vipInfo.value?.color ? vipInfo.value.color + '20' : 'transparent',
}))

function handleCardClick() {
  // 免费用户 → 会员中心（付费入口）
  // 已付费用户 → 个人中心
  if (planClass.value === 'free') {
    window.location.href = '/user/membership'
  } else {
    window.location.href = '/user/center'
  }
}

function openModelSettings() {
  showModelSettingsModal.value = true
}

function goUpgrade() {
  window.location.href = '/user/membership'
}

function goUserCenter() {
  window.location.href = '/user/center'
}

function goLogin() {
  window.location.href = '/login'
}

function goLogout() {
  // 清除 token
  try { window.localStorage?.removeItem('auth_token') } catch {}
  window.location.href = '/'
}

async function fetchAll() {
  try {
    const token = (window as any).__NUXT__?.token || (window as any).localStorage?.getItem('auth_token') || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (!token) return

    const [planRes, userRes] = await Promise.all([
      fetch('/api/member/profile', { headers }),
      fetch('/api/user/profile', { headers }).catch(() => null),
    ])
    if (planRes.ok) {
      const data = await planRes.json()
      planInfo.value = data
      // 积分和消费额：可能在不同字段路径
      credits.value = data.membership?.credits ?? data.remainingCredits ?? 0
      consumedCredits.value = data.membership?.creditsUsed ?? data.totalConsumed ?? 0
    }
    if (userRes && userRes.ok) {
      userInfo.value = await userRes.json()
    }
  } catch {}
}

onMounted(fetchAll)

function statusLabel(status: string): string {
  switch (status) {
    case 'idle': return '未开始'
    case 'running': return '生成中'
    case 'completed': return '已完成'
    case 'error': return '有错误'
    default: return status
  }
}
</script>

<style scoped>
.pipeline-sidebar {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid #1a1a28;
  background: #0a0a10;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 14px;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.brand-logo:hover { opacity: 0.8; }
.brand-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.stages {
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stage-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}
.stage-item:hover {
  background: #12121c;
}
.stage-item.active {
  background: #0f1a1a;
  border-color: #1a3a3a;
}
.stage-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
  margin-top: 1px;
}
.stage-body {
  flex: 1;
  min-width: 0;
}
.stage-title {
  font-size: 12px;
  color: #d1d5db;
  font-weight: 500;
}
.stage-status-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
}
.stage-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.stage-indicator.idle { background: #374151; }
.stage-indicator.running { background: #10b981; animation: pulse 1.5s infinite; }
.stage-indicator.completed { background: #059669; }
.stage-indicator.error { background: #ef4444; }
.stage-status-text {
  font-size: 10px;
  color: #6b7280;
}
.stage-progress-bg {
  height: 2px;
  background: #1a1a28;
  border-radius: 2px;
  margin-top: 5px;
  overflow: hidden;
}
.stage-progress-fill {
  height: 100%;
  background: #10b981;
  border-radius: 2px;
  transition: width 0.3s;
}
.stage-error {
  font-size: 9px;
  color: #ef4444;
  margin-top: 3px;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 额外工具 */
.extra-tools {
  padding: 4px 8px;
  border-top: 1px solid #1f2937;
  margin-bottom: 4px;
}
.extra-tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: #9ca3af;
  font-size: 12px;
}
.extra-tool-item:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #fff;
}
.extra-tool-icon { font-size: 16px; }
.extra-tool-name { font-weight: 500; }

/* 底部功能区 */
.sidebar-footer {
  margin-top: auto;
  padding: 4px 0;
}
/* ── 会员卡片 ── */
.vip-card-wrapper {
  padding: 0 4px 2px;
  cursor: pointer;
}
.vip-card {
  position: relative;
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.vip-card:hover { transform: translateY(-1px); }
.vip-card.guest { background: rgba(255,255,255,0.03); border-color: #1a1a28; }
.vip-card-bg {
  position: absolute;
  inset: 0;
  opacity: 0.12;
}
.vip-card-glow {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.15;
}
.vip-card-content {
  position: relative;
  display: flex;
  gap: 10px;
}
.vip-card-left { flex-shrink: 0; }
.vip-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.guest-avatar {
  background: #1a1a28;
  font-size: 18px;
}
.vip-card-right { flex: 1; min-width: 0; }
.vip-card-top {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.vip-card-tier-icon { font-size: 12px; }
.vip-card-tier-name {
  font-size: 12px;
  font-weight: 600;
}
.vip-card-sub {
  font-size: 11px;
  color: #6b7280;
  margin-top: 6px;
}
.vip-card-coins {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
}
.vip-coins-icon { font-size: 11px; }
.vip-coins-num {
  font-size: 13px;
  font-weight: 700;
  color: #fbbf24;
}
.vip-coins-unit {
  font-size: 10px;
  color: #6b7280;
  margin-left: 1px;
}
.vip-card-expiry {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.vip-expiry-label { font-size: 10px; color: #6b7280; }
.vip-expiry-date { font-size: 10px; color: #9ca3af; }
.vip-card-upgrade {
  display: block;
  width: 100%;
  padding: 4px 0;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, #D4AF37, #fbbf24);
  color: #000;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.vip-card-upgrade:hover { opacity: 0.85; }

/* ── 会员卡片入口文字（已付费用户） ── */
.vip-card-entrance {
  margin-top: 4px;
  cursor: pointer;
  text-align: center;
}
.vip-entrance-text {
  font-size: 11px;
  color: #60a5fa;
  opacity: 0.8;
  transition: opacity 0.15s;
}
.vip-card-entrance:hover .vip-entrance-text {
  opacity: 1;
}

/* ── 大模型设置 ── */
.model-config-card {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}
.model-config-card:hover { background: #12121c; }
.model-config-icon { font-size: 16px; }
.model-config-text { flex: 1; min-width: 0; }
.model-config-title {
  display: block;
  font-size: 12px;
  color: #d1d5db;
}
.model-config-desc {
  display: block;
  font-size: 10px;
  color: #6b7280;
}
.model-config-arrow { font-size: 14px; color: #6b7280; }
</style>
