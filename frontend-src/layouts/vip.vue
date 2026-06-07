<template>
  <div class="min-h-screen bg-[#0b0e1a] text-white font-sans flex flex-col">
    <!-- 极简顶栏 -->
    <header class="h-12 flex-shrink-0 bg-[#0b0e1a]/80 backdrop-blur-md border-b border-white/[0.04] flex items-center justify-between px-4 z-20">
      <div class="flex items-center gap-3">
        <router-link to="/studio/v2" class="flex items-center gap-2 no-underline group">
          <span class="text-sm">🎬</span>
          <img src="/logo.png" class="vip-logo" alt=""/>
          <span class="vip-logo-text">昆仑镜</span>
          <span class="text-[10px] text-white/20 ms-1">VIP套餐</span>
        </router-link>
      </div>
      <div class="flex items-center gap-2">
        <router-link to="/" class="text-[11px] px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white hover:border-white/10 transition-all no-underline">
          首页
        </router-link>
        <router-link to="/studio/v2" class="text-[11px] px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-blue-400/50 hover:text-blue-400 hover:border-blue-400/20 transition-all no-underline">
          ← 返回工作台
        </router-link>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.vip-logo {
  height: 22px;
  width: auto;
  display: inline-block;
  vertical-align: middle;
}
.vip-logo-text {
  font-size: 0.85rem;
  font-weight: 700;
  color: #e4e4e7;
  vertical-align: middle;
}
</style>
