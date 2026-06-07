<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="h-screen flex flex-col">
      <!-- Top bar -->
      <header class="h-12 bg-[#0D1328] border-b border-[#1A2240] flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-3">
          <span class="text-base">🎬</span>
          <NuxtLink to="/admin/aigc/overview" class="text-sm font-semibold text-white/80 no-underline hover:text-white">Director OS Admin</NuxtLink>
          <span class="flex items-center gap-1.5"><img src="/logo.png" style="height:16px;width:auto;display:inline-block;vertical-align:middle" alt=""/> 昆仑镜 <span class="text-[10px] text-gray-600">v1.2</span></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-gray-500">系统正常</span>
          <button @click="logout" class="text-[11px] text-gray-500 hover:text-red-400 transition cursor-pointer bg-transparent border-none">退出</button>
        </div>
      </header>

      <!-- Body: left sidebar + right content -->
      <div class="flex flex-1 min-h-0">
        <!-- Sidebar -->
        <aside class="w-48 bg-[#0A0F1E] border-r border-[#1A2240] flex flex-col shrink-0">
          <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            <NuxtLink
              v-for="m in menu" :key="m.id"
              :to="m.to"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer no-underline"
              :class="isActive(m.to) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'"
            >
              <span>{{ m.icon }}</span>
              <span>{{ m.label }}</span>
            </NuxtLink>
          </nav>
        </aside>

        <!-- Content area -->
        <main class="flex-1 overflow-auto p-6">
          <NuxtPage />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'

const route = useRoute()
const router = useRouter()

// 🛡️ Token 过期检测：onMounted 时调用 /api/admin/me 验证 token 是否有效
// 注意：管理员登录使用 /api/admin/login 签发 admin JWT，必须用 /api/admin/me 验证
onMounted(async () => {
  if (!import.meta.client) return
  const token = window.localStorage?.getItem('auth_token')
  if (!token) {
    router.replace('/admin/aigc/login')
    return
  }
  try {
    const res = await fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      window.localStorage?.removeItem('auth_token')
      window.localStorage?.removeItem('auth_user')
      router.replace('/admin/aigc/login')
    }
  } catch {
    // Network error — silently ignore
  }
})

const menu = [
  { id: 'overview', label: '总控制台', icon: '📊', to: '/admin/aigc/overview' },
  { id: 'models', label: '大模型列表', icon: '🤖', to: '/admin/aigc/models' },
  { id: 'members', label: '会员模块', icon: '👥', to: '/admin/aigc/members' },
  { id: 'payment', label: '支付设置', icon: '💳', to: '/admin/aigc/payment' },
  { id: 'vip', label: 'VIP套餐管理', icon: '💎', to: '/admin/aigc/vip' },
  { id: 'admins', label: '管理员设置', icon: '🛡️', to: '/admin/aigc/admins' },
  { id: 'cos', label: 'COS用户存储', icon: '🗄️', to: '/admin/aigc/cos' },
  // { id: 'coins', label: '积分充值', icon: '💰', to: '/admin/aigc/coins' },
  { id: 'community', label: '社区管理', icon: '💬', to: '/admin/aigc/community' },
  { id: 'messages', label: '发私信', icon: '✉️', to: '/admin/aigc/messages' },
  { id: 'customer-service', label: '客服管理', icon: '🎧', to: '/admin/aigc/customer-service' },
  { id: 'sms', label: '短信配置', icon: '📱', to: '/admin/aigc/sms' },
  { id: 'wechat', label: '微信登录配置', icon: '💬', to: '/admin/aigc/wechat' },
  { id: 'qq', label: 'QQ登录配置', icon: '🐧', to: '/admin/aigc/qq' },
  { id: 'agents', label: 'Agent管理', icon: '🤖', to: '/admin/aigc/agents' },
  { id: 'market', label: '市场代理管理', icon: '📈', to: '/admin/aigc/market' },
]

function isActive(path: string) {
  return route.path === path
}

function logout() {
  if (process.client) {
    // 使用 token-cache 统一清除（内存 + localStorage + cookie）
    import('~/utils/token-cache').then(m => { m.clearAuth(); window.location.href = '/admin/aigc/login' })
  }
}
</script>
