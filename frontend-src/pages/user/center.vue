<template>
  <div class="member-center-page">
    <!-- 背景 -->
    <div class="bg-grid" />
    <div class="bg-glow top-left" />
    <div class="bg-glow bottom-right" />
    
    <!-- 顶部导航栏 -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">会员中心</span>
        </div>
        <div class="nav-links">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link to="/studio/v2" class="nav-link">工作台</router-link>
        </div>
        <div class="nav-actions">
          <div v-if="userInfo" class="nav-user-badge" @click="router.push('/user/center')">
            <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
              {{ avatarChar }}
            </div>
            <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
              {{ tierInfo.label }}
            </span>
          </div>
          <button v-else class="btn btn-outline" @click="goHome">登录</button>
        </div>
      </div>
    </nav>

    <!-- 主内容 -->
    <div class="center-content">
      <!-- 会员信息卡片（大号） -->
      <div class="member-hero-card" :class="`member-hero-card--${tierClass}`">
        <div class="member-hero-glow" />
        <div class="member-hero-inner">
          <div class="member-hero-avatar-area">
            <div class="member-hero-avatar" :class="`member-hero-avatar--${tierClass}`">
              <span class="member-hero-avatar-text">{{ avatarChar }}</span>
            </div>
            <div class="member-tier-badge" :class="`member-tier-badge--${tierClass}`">
              <span class="member-tier-icon">{{ tierInfo.icon }}</span>
              <span class="member-tier-label">{{ tierInfo.label }}</span>
            </div>
          </div>
          <div class="member-hero-info">
            <h2 class="member-hero-name">
              {{ userInfo?.username || userInfo?.email?.split('@')[0] || '用户' }}
              <span v-if="userInfo?.agentStatus === 'active'" class="agent-badge" :class="'agent-badge--' + (userInfo?.agentLevel || 'senior')">
                {{ userInfo?.agentLevel === 'premium' ? '👑 顶级代理' : '⭐ 高级代理' }}
              </span>
            </h2>
            <p class="member-hero-email">{{ userInfo?.email || '' }}</p>
            <div class="member-hero-stats">
              <div class="member-hero-stat">
                <span class="member-hero-stat-icon">⭐</span>
                <div class="member-hero-stat-text">
                  <span class="member-hero-stat-value">{{ coins }}</span>
                  <span class="member-hero-stat-label">积分</span>
                </div>
              </div>
              <div class="member-hero-stat" v-if="userInfo?.memberExpiresAt">
                <span class="member-hero-stat-icon">📅</span>
                <div class="member-hero-stat-text">
                  <span class="member-hero-stat-value">{{ formattedExpiry }}</span>
                  <span class="member-hero-stat-label">到期时间</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="tierClass !== 'vip_platinum'" class="member-hero-upgrade">
            <a href="/user/membership" class="upgrade-main-btn" style="text-decoration:none;display:inline-block;">
              {{ tierClass === 'free' ? '升级VIP →' : '续费/升级 →' }}
            </a>
          </div>
          <div v-else style="margin-top:16px;">
            <a href="/user/membership" class="upgrade-main-btn" style="text-decoration:none;display:inline-block;background:linear-gradient(135deg,#9333ea,#7c3aed);">
              会员中心 →
            </a>
          </div>
        </div>
      </div>

      <!-- 代理商管理面板（仅已开通代理时显示） -->
      <div v-if="userInfo?.agentStatus === 'active'" class="agent-panel">
        <div class="agent-panel-header">
          <div class="agent-panel-header-left">
            <span class="agent-panel-icon">{{ userInfo?.agentLevel === 'premium' ? '👑' : '⭐' }}</span>
            <div>
              <h3 class="agent-panel-title">代理商管理</h3>
              <p class="agent-panel-desc">推广昆仑镜，赚取佣金收益</p>
            </div>
          </div>
          <router-link to="/user/agent" class="agent-panel-btn">进入管理中心 →</router-link>
        </div>
        <div class="agent-panel-stats" v-if="agentStats">
          <div class="agent-stat-card">
            <p class="agent-stat-value">{{ agentStats.clientCount || 0 }}</p>
            <p class="agent-stat-label">旗下客户</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value" style="color:#60a5fa">¥{{ (agentStats.totalCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">累计佣金</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value" style="color:#fbbf24">¥{{ (agentStats.pendingCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">待结算</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value" style="color:#34d399">¥{{ (agentStats.settledCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">已结算</p>
          </div>
        </div>
        <div v-else class="agent-panel-loading">
          <span class="text-gray-500 text-xs">正在加载代理商数据...</span>
        </div>
      </div>

      <!-- 四大功能模块 -->
      <div class="member-modules">
        <router-link to="/studio/v2" class="member-module">
          <div class="module-icon-area" style="background: rgba(59,130,246,0.1);">
            <span class="module-icon">🎬</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的作品</h3>
            <p class="module-desc">查看和管理你的创作项目</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/gallery" class="member-module">
          <div class="module-icon-area" style="background: rgba(139,92,246,0.1);">
            <span class="module-icon">🖼️</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的图库</h3>
            <p class="module-desc">管理你的生成图片和素材</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/storage" class="member-module">
          <div class="module-icon-area" style="background: rgba(16,185,129,0.1);">
            <span class="module-icon">💾</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的存储空间</h3>
            <p class="module-desc">
              已使用 <strong>{{ storageUsed }}</strong> / {{ storageTotal }}
            </p>
            <div class="storage-bar">
              <div class="storage-bar-fill" :style="{ width: storagePercent + '%' }" />
            </div>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/referral" class="member-module">
          <div class="module-icon-area" style="background: rgba(245,158,11,0.1);">
            <span class="module-icon">📣</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">推荐有奖</h3>
            <p class="module-desc">分享链接给好友，好友开通VIP你可得5%佣金</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/agent" class="member-module">
          <div class="module-icon-area" :style="{ background: userInfo?.agentStatus === 'active' ? 'rgba(251,191,36,0.15)' : 'rgba(107,114,128,0.1)' }">
            <span class="module-icon">{{ userInfo?.agentStatus === 'active' ? '🤝' : '📋' }}</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">代理商{{ userInfo?.agentStatus === 'active' ? '中心' : '申请' }}</h3>
            <p class="module-desc">{{ userInfo?.agentStatus === 'active' ? '管理推广、佣金和客户' : '成为代理商，赚取佣金收益' }}</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface UserInfo {
  memberTier?: string
  email?: string
  username?: string
  coins?: number
  memberExpiresAt?: string
  [key: string]: any
}

const userInfo = ref<UserInfo | null>(null)
const agentStats = ref<any>(null)

// VIP 等级配置
const tierConfig: Record<string, { label: string; icon: string; color: string }> = {
  free: { label: '普通用户', icon: '🔓', color: '#6b7280' },
  trial: { label: '新人体验卡', icon: '🎁', color: '#F59E0B' },
  gold: { label: '黄金会员', icon: '⭐', color: '#D4AF37' },
  premium: { label: '黄金会员', icon: '⭐', color: '#D4AF37' },
  vip: { label: '黄金会员', icon: '⭐', color: '#EAB308' },
  Pro: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  director: { label: '年卡会员', icon: '👑', color: '#9333EA' },
  vip_year: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  vip_season: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  vip_platinum: { label: '至尊会员', icon: '👑', color: '#9333EA' },
}

const tierClass = computed(() => {
  const tier = userInfo.value?.memberTier || 'free'
  return tierConfig[tier] ? tier : 'free'
})

const tierInfo = computed(() => tierConfig[tierClass.value] || tierConfig.free)

const avatarChar = computed(() => {
  return (userInfo.value?.username || userInfo.value?.email || 'U').charAt(0).toUpperCase()
})

const coins = computed(() => userInfo.value?.coins ?? 0)

const formattedExpiry = computed(() => {
  if (!userInfo.value?.memberExpiresAt) return '—'
  try {
    const d = new Date(userInfo.value.memberExpiresAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return '—'
  }
})

// 存储数据 —— 从 API 获取
const storageUsed = ref('0 MB')
const storageTotal = ref('1 GB')
const storagePercent = computed(() => {
  const used = parseFloat(storageUsed.value)
  const total = parseFloat(storageTotal.value)
  return Math.min(Math.round((used / total) * 100), 100)
})

function goHome() {
  router.push('/')
}

function handlePlaceholder(msg: string) {
  alert(msg)
}

onMounted(async () => {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()

  // 先调 storage API 获取真实 tier（更快，不需要 auth/me）
  if (token) {
    try {
      const storageRes = await fetch('/api/user/storage', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (storageRes.ok) {
        const storageJson = await storageRes.json()
        if (storageJson.success && storageJson.data) {
          storageUsed.value = storageJson.data.usedFormatted
          storageTotal.value = storageJson.data.totalFormatted

          // 用 storage API 返回的 tier 覆盖 localStorage 缓存的旧数据
          if (storageJson.data.tier) {
            const cached = JSON.parse(localStorage.getItem('auth_user') || '{}')
            cached.memberTier = storageJson.data.tier
            // 只更新 tier，不覆盖整个 userInfo（避免丢失 agentStatus 等字段）
            if (userInfo.value) {
              userInfo.value.memberTier = storageJson.data.tier
            } else {
              userInfo.value = { ...cached }
            }
            localStorage.setItem('auth_user', JSON.stringify(cached))
          }
        }
      }
    } catch (e) {
      console.warn('[MemberCenter] failed to fetch storage', e)
    }
  }

  // 尝试从 API 刷新用户信息（覆盖缓存）
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const profile = data.data?.user || data.data || data
        if (profile) {
          userInfo.value = profile
          localStorage.setItem('auth_user', JSON.stringify(profile))
        }

        // 尝试加载代理数据（即使 profile 没有 agentStatus，也直接调 API 确认）
        try {
          const dashRes = await fetch('/api/agent/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (dashRes.ok) {
            const dashData = await dashRes.json()
            if (dashData.data) {
              // 后端返回了数据说明确实是代理商
              if (dashData.data.agentStatus === 'active') {
                // 更新 userInfo 的 agentStatus
                if (!userInfo.value?.agentStatus || userInfo.value.agentStatus !== 'active') {
                  userInfo.value = { ...(userInfo.value || {}), agentStatus: 'active', agentLevel: dashData.data.agentLevel } as any
                }
                agentStats.value = dashData.data.stats || null
              }
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[MemberCenter] failed to fetch profile', e)
    }
  }

  // 从 localStorage 读取兜底
  if (!userInfo.value) {
    try {
      const authUserRaw = window.localStorage?.getItem("auth_user")
      if (authUserRaw) {
        const parsed = JSON.parse(authUserRaw)
        userInfo.value = parsed
      }
    } catch {}
  }
})
</script>

<style scoped>
.member-center-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* 背景 */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}

.bg-glow {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.08;
  pointer-events: none;
  z-index: 0;
}

.bg-glow.top-left { top: -100px; left: -100px; background: #f97316; }
.bg-glow.bottom-right { bottom: -100px; right: -100px; background: #6366f1; }

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(11, 19, 32, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo { display: flex; align-items: center; gap: 8px; }

.logo-icon { display: flex; align-items: center; }
.nav-logo-img { width: 26px; height: 26px; }
.logo-text { font-size: 1rem; font-weight: 600; color: #fff; }

.nav-links { display: flex; gap: 24px; }

.nav-link {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}

.nav-link:hover { color: rgba(255, 255, 255, 0.8); }

.nav-actions { display: flex; gap: 10px; align-items: center; }

.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s;
}

.nav-user-badge:hover {
  background: rgba(255, 255, 255, 0.06);
}

.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
}

.nav-user-avatar--free { background: linear-gradient(135deg, #4b5563, #6b7280); }
.nav-user-avatar--premium { background: linear-gradient(135deg, #D4AF37, #fbbf24); }
.nav-user-avatar--vip_year { background: linear-gradient(135deg, #E53E3E, #fc8181); }
.nav-user-avatar--vip_platinum { background: linear-gradient(135deg, #9333EA, #c084fc); }

.nav-tier-tag {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.nav-tier-tag--free { color: #9ca3af; }
.nav-tier-tag--premium { color: #fbbf24; }
.nav-tier-tag--vip_year { color: #fc8181; }
.nav-tier-tag--vip_platinum { color: #c084fc; }

.btn {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.btn-outline:hover { border-color: rgba(255, 255, 255, 0.2); color: #fff; }

/* 主内容区 */
.center-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 90px 24px 60px;
}

/* 大号会员卡片 */
.member-hero-card {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(16px);
  margin-bottom: 32px;
  transition: all 0.3s;
}

.member-hero-card:hover {
  transform: translateY(-3px);
}

.member-hero-card--free {
  border: 1px solid rgba(107, 114, 128, 0.2);
}
.member-hero-card--free:hover {
  box-shadow: 0 12px 40px rgba(107, 114, 128, 0.08);
}

.member-hero-card--premium {
  border: 1px solid rgba(212, 175, 55, 0.25);
}
.member-hero-card--premium:hover {
  box-shadow: 0 12px 40px rgba(212, 175, 55, 0.12);
}

.member-hero-card--vip_year {
  border: 1px solid rgba(229, 62, 62, 0.25);
}
.member-hero-card--vip_year:hover {
  box-shadow: 0 12px 40px rgba(229, 62, 62, 0.12);
}

.member-hero-card--vip_platinum {
  border: 1px solid rgba(147, 51, 234, 0.25);
}
.member-hero-card--vip_platinum:hover {
  box-shadow: 0 12px 40px rgba(147, 51, 234, 0.12);
}

.member-hero-glow {
  position: absolute;
  top: -30%;
  right: -20%;
  width: 60%;
  height: 80%;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.15;
}

.member-hero-card--free .member-hero-glow {
  background: radial-gradient(circle, rgba(107,114,128,0.08) 0%, transparent 70%);
}
.member-hero-card--premium .member-hero-glow {
  background: radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%);
}
.member-hero-card--vip_year .member-hero-glow {
  background: radial-gradient(circle, rgba(229,62,62,0.15) 0%, transparent 70%);
}
.member-hero-card--vip_platinum .member-hero-glow {
  background: radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%);
}

.member-hero-inner {
  position: relative;
  z-index: 1;
  padding: 36px 32px;
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.member-hero-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.member-hero-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  position: relative;
}

.member-hero-avatar::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.member-hero-avatar--free { background: linear-gradient(135deg, #4b5563, #6b7280); }
.member-hero-avatar--premium {
  background: linear-gradient(135deg, #D4AF37, #fbbf24);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
}
.member-hero-avatar--vip_year {
  background: linear-gradient(135deg, #E53E3E, #fc8181);
  box-shadow: 0 0 20px rgba(229, 62, 62, 0.3);
}
.member-hero-avatar--vip_platinum {
  background: linear-gradient(135deg, #9333EA, #c084fc);
  box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
}

.member-tier-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

.member-tier-badge--free {
  background: rgba(107, 114, 128, 0.12);
  color: #9ca3af;
}
.member-tier-badge--premium {
  background: rgba(212, 175, 55, 0.12);
  color: #fbbf24;
}
.member-tier-badge--vip_year {
  background: rgba(229, 62, 62, 0.12);
  color: #fc8181;
}
.member-tier-badge--vip_platinum {
  background: rgba(147, 51, 234, 0.12);
  color: #c084fc;
}

.member-hero-info {
  flex: 1;
  min-width: 180px;
}

.member-hero-name {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
}

.member-hero-email {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 16px;
}

.member-hero-stats {
  display: flex;
  gap: 24px;
}

.member-hero-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-hero-stat-icon {
  font-size: 1.2rem;
}

.member-hero-stat-text {
  display: flex;
  flex-direction: column;
}

.member-hero-stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
}

.member-hero-stat-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.member-hero-upgrade {
  flex-shrink: 0;
}

.upgrade-main-btn {
  padding: 12px 28px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;
}

.upgrade-main-btn:hover {
  background: linear-gradient(135deg, #fb923c, #f97316);
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(249, 115, 22, 0.3);
}

/* 四大功能模块 */
.member-modules {
  display: grid;
  gap: 14px;
}

.member-module {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.25s;
}

.member-module:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
}

.module-icon-area {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-icon {
  font-size: 1.4rem;
}

.module-text {
  flex: 1;
  min-width: 0;
}

.module-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 4px;
}

.module-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
}

.module-arrow {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.15);
  transition: transform 0.2s;
}

.member-module:hover .module-arrow {
  transform: translateX(4px);
  color: rgba(255, 255, 255, 0.3);
}

/* 存储进度条 */
.storage-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 6px;
}

.storage-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 3px;
  transition: width 0.5s ease;
}

@media (max-width: 640px) {
  .member-hero-inner {
    flex-direction: column;
    text-align: center;
    padding: 28px 20px;
  }

  .member-hero-stats {
    justify-content: center;
  }

  .nav-links {
    display: none;
  }
}
/* agent badge */
.agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 999px;
  margin-left: 8px;
  vertical-align: middle;
}
.agent-badge--senior {
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
}
.agent-badge--premium {
  background: rgba(251,191,36,0.12);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.2);
}

/* 代理商管理面板 */
.agent-panel {
  background: linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(251,191,36,0.01) 100%);
  border: 1px solid rgba(251,191,36,0.12);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 28px;
  backdrop-filter: blur(8px);
}
.agent-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.agent-panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-panel-icon {
  font-size: 22px;
}
.agent-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin: 0;
}
.agent-panel-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin: 2px 0 0;
}
.agent-panel-btn {
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(251,191,36,0.1);
  color: #fbbf24;
  text-decoration: none;
  border: 1px solid rgba(251,191,36,0.2);
  transition: all 0.2s;
  white-space: nowrap;
}
.agent-panel-btn:hover {
  background: rgba(251,191,36,0.18);
}
.agent-panel-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.agent-stat-card {
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 14px 12px;
  text-align: center;
}
.agent-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  margin: 0 0 4px;
}
.agent-stat-label {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  margin: 0;
}
.agent-panel-loading {
  padding: 16px 0;
  text-align: center;
}
</style>
