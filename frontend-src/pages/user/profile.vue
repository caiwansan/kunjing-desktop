<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'user', middleware: 'auth' })

const auth = useAuthStore()

// ─── Mock Profile Data ───────────────────────────

interface UserProfile {
  username: string
  email: string
  avatar: string
  bio: string
  phone: string
  createdAt: string
  membership: {
    tier: 'free' | 'premium' | 'vip'
    name: string
    expireAt: string
    storageUsed: number
    storageLimit: number
    storageUnit: string
  }
  stats: {
    projects: number
    videos: number
    images: number
    coins: number
    totalCoinsEarned: number
    totalCoinsSpent: number
  }
}

const mockProfile: UserProfile = {
  username: '火麒麟用户',
  email: 'user@huoqilin.ai',
  avatar: '',
  bio: 'AI 影视创作者，热爱探索视觉叙事的无限可能',
  phone: '138****8888',
  createdAt: '2025-01-15T08:00:00Z',
  membership: {
    tier: 'premium',
    name: '黄金会员',
    expireAt: '2025-12-31T23:59:59Z',
    storageUsed: 2147483648,
    storageLimit: 10737418240,
    storageUnit: 'bytes',
  },
  stats: {
    projects: 6,
    videos: 23,
    images: 156,
    coins: 5880,
    totalCoinsEarned: 12500,
    totalCoinsSpent: 6620,
  },
}

const profile = ref<UserProfile | null>(null)
const loading = ref(true)
const editing = ref(false)
const editForm = ref({ username: '', bio: '', phone: '' })

function loadProfile() {
  loading.value = true
  const getToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
  const token = auth.token || getToken() || ''

  fetch('/api/member/profile', {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        profile.value = {
          username: data.username || '用户',
          email: data.email || '',
          avatar: '',
          bio: '',
          phone: '',
          createdAt: data.createdAt || new Date().toISOString(),
          membership: {
            tier: data.membership?.tier || 'free',
            name: data.membership?.tier === 'gold' ? '黄金会员'
              : data.membership?.tier === 'premium' ? '黄金会员'
              : data.membership?.tier === 'vip' ? 'VIP月卡会员'
              : data.membership?.tier === 'Pro' ? '钻石会员'
              : data.membership?.tier === 'director' ? '年卡会员'
              : data.membership?.tier === 'vip_season' ? 'VIP季卡会员'
              : data.membership?.tier === 'vip_year' ? 'VIP年卡会员'
              : '普通用户',
            expireAt: '',
            storageUsed: Number(data.membership?.storageUsed || 0),
            storageLimit: Number(data.membership?.storageLimit || 104857600),
            storageUnit: 'bytes',
          },
          stats: {
            projects: 0,
            videos: 0,
            images: 0,
            coins: data.coins || 0,
            totalCoinsEarned: data.coins || 0,
            totalCoinsSpent: 0,
          },
        }
        editForm.value = {
          username: data.username || '',
          bio: '',
          phone: '',
        }
      }
      loading.value = false
    })
    .catch(() => {
      loading.value = false
    })
}

function startEdit() {
  editing.value = true
}

function saveEdit() {
  if (!profile.value) return
  profile.value.username = editForm.value.username
  profile.value.bio = editForm.value.bio
  profile.value.phone = editForm.value.phone
  editing.value = false
}

function cancelEdit() {
  if (!profile.value) return
  editForm.value = {
    username: profile.value.username,
    bio: profile.value.bio,
    phone: profile.value.phone,
  }
  editing.value = false
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

const storagePercent = computed(() => {
  if (!profile.value) return 0
  return Math.min(Math.round((profile.value.membership.storageUsed / profile.value.membership.storageLimit) * 100), 100)
})

const tierBadge = computed(() => {
  if (!profile.value) return { label: '免费用户', cls: 'bg-white/5 border-white/10 text-gray-400' }
  const t = profile.value.membership.tier
  if (t === 'premium') return { label: profile.value.membership.name, cls: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400' }
  if (t === 'vip' || t === 'vip_season' || t === 'vip_year') return { label: profile.value.membership.name, cls: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400' }
  return { label: '免费用户', cls: 'bg-white/5 border-white/10 text-gray-400' }
})

onMounted(loadProfile)
</script>

<template>
  <div class="w-full max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-white">用户中心</h1>
        <p class="text-sm text-gray-400 mt-0.5">管理个人信息与账户设置</p>
      </div>
      <a href="/studio/v2"
        class="px-4 py-2 rounded-lg text-sm bg-gray-200 hover:bg-gray-300 text-black border border-gray-300 transition-all no-underline flex items-center gap-1.5 font-medium shadow-sm">
        ← 返回工作台
      </a>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16">
      <div class="inline-block w-8 h-8 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin mb-3"></div>
      <p class="text-gray-500 text-sm">加载中...</p>
    </div>

    <template v-if="profile">
      <!-- Profile Card -->
      <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-6 mb-6">
        <div class="flex items-start gap-5">
          <!-- Avatar -->
          <div class="relative flex-shrink-0">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF3B30] via-[#FFD700] to-[#00D4FF] flex items-center justify-center text-2xl font-bold shadow-lg">
              {{ (profile.username || 'U')[0] }}
            </div>
            <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#141829] flex items-center justify-center text-[10px] text-white">
              ✓
            </div>
          </div>
          <!-- Info -->
          <div class="flex-1">
            <div v-if="!editing">
              <div class="flex items-center gap-3 mb-1">
                <h2 class="text-xl font-bold text-white">{{ profile.username }}</h2>
                <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-medium border', tierBadge.cls]">
                  {{ tierBadge.label }}
                </span>
              </div>
              <p class="text-sm text-gray-400 mb-1">{{ profile.email }}</p>
              <p v-if="profile.bio" class="text-sm text-gray-500 mb-2">{{ profile.bio }}</p>
              <p class="text-xs text-gray-600">注册时间：{{ new Date(profile.createdAt).toLocaleDateString('zh-CN') }}</p>
              <button @click="startEdit"
                class="mt-3 px-4 py-1.5 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-all border-none cursor-pointer">
                ✏️ 编辑资料
              </button>
            </div>
            <!-- Edit Mode -->
            <div v-else class="space-y-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">用户名</label>
                <input v-model="editForm.username" class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-white focus:outline-none focus:border-[#00D4FF]/50" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">个人简介</label>
                <textarea v-model="editForm.bio" rows="2" class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-white focus:outline-none focus:border-[#00D4FF]/50 resize-none"></textarea>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">手机号</label>
                <input v-model="editForm.phone" class="w-full px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-white focus:outline-none focus:border-[#00D4FF]/50" />
              </div>
              <div class="flex gap-2 pt-1">
                <button @click="saveEdit"
                  class="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#00D4FF] to-blue-500 text-xs text-white font-medium hover:from-[#00D4FF]/90 hover:to-blue-500/90 transition-all border-none cursor-pointer">
                  保存
                </button>
                <button @click="cancelEdit"
                  class="px-4 py-1.5 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-gray-400 hover:text-white transition-all border-none cursor-pointer">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 w-full">
        <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5 hover:border-[#1a1a24]/70 transition-all">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">📁</span>
            <span class="text-xs text-gray-500">项目数</span>
          </div>
          <p class="text-2xl font-bold text-white">{{ profile.stats.projects }}</p>
        </div>
        <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5 hover:border-[#1a1a24]/70 transition-all">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">🎬</span>
            <span class="text-xs text-gray-500">视频数</span>
          </div>
          <p class="text-2xl font-bold text-white">{{ profile.stats.videos }}</p>
        </div>
        <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5 hover:border-[#1a1a24]/70 transition-all">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">💾</span>
            <span class="text-xs text-gray-500">存储用量</span>
          </div>
          <p class="text-lg font-bold text-white">{{ formatBytes(profile.membership.storageUsed) }}</p>
        </div>
      </div>

      <!-- Storage & Membership Detail -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Storage Usage -->
        <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
          <h3 class="text-white font-semibold text-sm mb-3">存储空间</h3>
          <div class="flex items-end justify-between mb-2">
            <span class="text-sm text-gray-400">{{ formatBytes(profile.membership.storageUsed) }} / {{ formatBytes(profile.membership.storageLimit) }}</span>
            <span class="text-xs text-gray-500">{{ storagePercent }}%</span>
          </div>
          <div class="h-2 rounded-full bg-[#0B1020] overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-[#00D4FF] to-blue-500 transition-all"
              :style="{ width: storagePercent + '%' }"></div>
          </div>
          <div class="flex items-center gap-2 mt-3 text-xs">
            <span class="text-gray-500">图片：{{ profile.stats.images }} 个</span>
            <span class="text-gray-600">|</span>
            <span class="text-gray-500">视频：{{ profile.stats.videos }} 个</span>
          </div>
          <button class="mt-3 px-3 py-1.5 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-all border-none cursor-pointer">
            升级存储空间 →
          </button>
        </div>

        <!-- Membership -->
        <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
          <h3 class="text-white font-semibold text-sm mb-3">会员等级</h3>
          <div class="flex items-center gap-3 mb-3">
            <span :class="['px-3 py-1 rounded-full text-xs font-medium border', tierBadge.cls]">
              {{ tierBadge.label }}
            </span>
            <span v-if="profile.membership.expireAt" class="text-xs text-gray-500">
              有效期至 {{ new Date(profile.membership.expireAt).toLocaleDateString('zh-CN') }}
            </span>
          </div>
          <!-- Membership benefits -->
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-400">
              <span class="text-emerald-400">✓</span> 10GB 云存储空间
            </div>
            <div class="flex items-center gap-2 text-gray-400">
              <span class="text-emerald-400">✓</span> 4K 视频导出
            </div>
            <div class="flex items-center gap-2 text-gray-400">
              <span class="text-emerald-400">✓</span> 优先渲染队列
            </div>
            <div class="flex items-center gap-2 text-gray-400">
              <span class="text-emerald-400">✓</span> 专属客服支持
            </div>
          </div>
          <router-link to="/user/membership"
            class="inline-block mt-3 px-4 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-xs text-yellow-400 hover:from-yellow-500/30 hover:to-orange-500/30 transition-all no-underline">
            升级会员 →
          </router-link>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-[#09090c] border border-[#1a1a24] rounded-xl p-5">
        <h3 class="text-white font-semibold text-sm mb-4">快捷操作</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <router-link to="/projects"
            class="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-gray-400 hover:text-white hover:border-[#00D4FF]/30 transition-all no-underline">
            <span class="text-lg">📁</span> 项目管理
          </router-link>
          <router-link to="/user/library"
            class="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-gray-400 hover:text-white hover:border-[#00D4FF]/30 transition-all no-underline">
            <span class="text-lg">🖼️</span> 素材库
          </router-link>
          <router-link to="/user/promo"
            class="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-gray-400 hover:text-white hover:border-[#00D4FF]/30 transition-all no-underline">
            <span class="text-lg">🎁</span> 推广码
          </router-link>
          <router-link to="/help"
            class="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-sm text-gray-400 hover:text-white hover:border-[#00D4FF]/30 transition-all no-underline">
            <span class="text-lg">📖</span> 帮助中心
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>
