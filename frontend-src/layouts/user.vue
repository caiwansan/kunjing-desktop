<script setup lang="ts">
import CustomerService from '~/components/customer/CustomerService.vue'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const navItems = [
  { path: '/user/profile', label: '个人总览', icon: '👤' },
  { path: '/user/projects', label: '我的项目', icon: '📂' },
  { path: '/user/membership', label: '会员中心', icon: '💎' },
  { path: '/user/credits', label: '积分中心', icon: '⏣' },
  { path: '/user/messages', label: '我的消息', icon: '✉️' },
  { path: '/user/library', label: '作品库', icon: '🎬' },
  { path: '/user/promo', label: '推广中心', icon: '📢' },
  { path: '/user/agent', label: '代理中心', icon: '🤝' },
  { path: '/user/download', label: '客户端下载', icon: '📥' },
]

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="min-h-screen bg-[#050508] text-white font-sans flex flex-col">
    <!-- Top Bar -->
    <header class="h-14 flex-shrink-0 bg-[#07070a] border-b border-white/[0.03] flex items-center justify-between px-4 z-20">
      <div class="flex items-center gap-3">
        <router-link to="/studio/v2" class="flex items-center gap-2.5 no-underline group">
          <img src="/logo.png?v=3" alt="火麒麟" class="w-7 h-7 rounded-lg object-cover group-hover:scale-105 transition-transform">
          <span class="text-sm font-semibold text-white/85 tracking-tight group-hover:text-white transition-colors">🔥 火麒麟AI导演控制台</span>
          <span class="text-[10px] text-blue-400/50 group-hover:text-blue-400 transition-colors ml-1">← 返回首页</span>
        </router-link>
        <span class="text-xs text-white/20">|</span>
        <span class="text-xs text-white/30">用户中心</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]">
          <span class="text-[10px] text-orange-400/60">⏣ {{ auth.credits }}</span>
        </div>
        <router-link to="/studio/v2" class="text-[10px] px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.04] text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all border-none cursor-pointer no-underline">← 返回工作室</router-link>
      </div>
    </header>

    <div class="flex flex-1">
      <!-- Sidebar -->
      <aside class="w-52 flex-shrink-0 bg-[#07070a] border-r border-white/[0.03] p-3">
        <!-- User info -->
        <div class="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.04]">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-sm font-bold shadow-sm">
            {{ (auth.userName || 'U')[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-white/70 truncate">{{ auth.userName }}</p>
            <p class="text-[10px] text-white/30 truncate">{{ auth.user?.email || '' }}</p>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="space-y-0.5">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all no-underline"
            :class="isActive(item.path)
              ? 'bg-orange-500/10 text-orange-400/90 border border-orange-500/15'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02] border border-transparent'"
          >
            <span class="text-sm">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <!-- Exit -->
        <div class="mt-6 pt-4 border-t border-white/[0.04]">
          <button
            @click="auth.logout().then(() => window.location.href = '/login')"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-red-400/60 hover:bg-red-500/5 transition-all border-none cursor-pointer"
          >
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 p-6 overflow-auto bg-[#050508] flex justify-center">
        <div class="w-full max-w-4xl">
          <slot />
        </div>
      </main>
    </div>
  </div>
  <!-- 智能客服 -->
  <CustomerService />
</template>
