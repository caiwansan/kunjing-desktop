<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'user', middleware: 'auth' })

const versions = ref<any>(null)
const loading = ref(true)
const activeVersion = ref('')

const platforms = [
  { key: 'windows', label: 'Windows', icon: '🪟', desc: '支持 Win 10 以上' },
  { key: 'macos', label: 'macOS', icon: '🍎', desc: 'Apple Silicon / Intel' },
  { key: 'linux', label: 'Linux', icon: '🐧', desc: 'Ubuntu 20.04+ / CentOS 8+' },
]
const downloading = ref<string | null>(null)

const sysReqs: Record<string, string[]> = {
  windows: ['Windows 10 或更高版本（64位）', 'Intel Core i5 或同等处理器', '8GB 内存（推荐 16GB）', '支持 DirectX 12 的显卡', '500MB 可用磁盘空间'],
  macos: ['macOS 12 Monterey 或更高版本', 'Apple Silicon 或 Intel 处理器', '8GB 内存（推荐 16GB）', '500MB 可用磁盘空间'],
  linux: ['Ubuntu 20.04+ / CentOS 8+', 'Intel Core i5 或同等处理器', '8GB 内存（推荐 16GB）', '支持 Vulkan 的显卡', '500MB 可用磁盘空间'],
}

const activePlatform = ref('windows')

async function loadVersions() {
  loading.value = true
  try {
    const res = await fetch('/api/user/client/versions')
    if (res.ok) {
      versions.value = await res.json()
      activeVersion.value = versions.value.currentVersion
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function download(platform: string) {
  downloading.value = platform
  try {
    const res = await fetch(`/api/user/client/download/${platform}`)
    if (res.ok) {
      await res.json()
      setTimeout(() => {
        alert(`下载已开始！请查看浏览器下载目录。`)
        downloading.value = null
      }, 500)
    }
  } catch (e: any) {
    alert('下载失败：' + e.message)
    downloading.value = null
  }
}

onMounted(loadVersions)
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold text-white/80 mb-6">📥 客户端下载</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center py-16">
      <div class="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mb-3"></div>
      <p class="text-xs text-white/30">加载中...</p>
    </div>

    <template v-if="versions">
      <!-- Version Hero -->
      <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#09090c] to-[#0c0c14] border border-[#1a1a24] p-6 mb-5 text-center">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-blue-500/5 blur-2xl"></div>
        <div class="relative">
          <span class="text-5xl block mb-3">🔥</span>
          <p class="text-[10px] text-white/30 mb-2 tracking-wider">最新版本</p>
          <p class="text-4xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent mb-1">
            v{{ versions.currentVersion }}
          </p>
          <p class="text-xs text-white/30">火麒麟AI导演控制台 桌面客户端</p>
        </div>
      </div>

      <!-- Download Cards -->
      <div class="grid grid-cols-3 gap-4 mb-5">
        <button v-for="p in platforms" :key="p.key"
          @click="download(p.key)"
          :disabled="downloading === p.key"
          class="relative py-6 rounded-xl border border-[#1a1a24] bg-[#09090c] text-center cursor-pointer transition-all hover:border-blue-400/30 hover:bg-blue-500/5 active:scale-[0.98] disabled:opacity-50 group">
          <span class="block text-3xl mb-2 group-hover:scale-110 transition-transform">{{ p.icon }}</span>
          <span class="block text-xs text-white/70 font-medium">{{ p.label }}</span>
          <span class="block text-[9px] text-white/20 mt-1">{{ p.desc }}</span>
          <div class="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-400/70 group-hover:bg-blue-500/20 transition-all">
            <span v-if="downloading === p.key" class="animate-pulse">⏳ 准备中...</span>
            <span v-else>⬇ 立即下载</span>
          </div>
        </button>
      </div>

      <!-- System Requirements -->
      <div class="rounded-xl bg-[#09090c] border border-[#1a1a24] overflow-hidden mb-5">
        <div class="flex border-b border-[#1a1a24]">
          <button v-for="p in platforms" :key="p.key"
            @click="activePlatform = p.key"
            :class="[
              'flex-1 py-2.5 text-[10px] font-medium border-b-2 transition-all bg-transparent border-none cursor-pointer',
              activePlatform === p.key
                ? 'border-blue-400 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-white/30 hover:text-white/50'
            ]">{{ p.icon }} {{ p.label }}</button>
        </div>
        <div class="p-5">
          <p class="text-[10px] text-white/30 mb-3 tracking-wider">系统要求 · {{ platforms.find(p => p.key === activePlatform)?.label }}</p>
          <div class="space-y-2">
            <div v-for="(req, i) in sysReqs[activePlatform]" :key="i"
              class="flex items-center gap-2.5 text-xs text-white/40">
              <span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400/60 flex items-center justify-center text-[9px] shrink-0">{{ i + 1 }}</span>
              {{ req }}
            </div>
          </div>
        </div>
      </div>

      <!-- Changelog -->
      <div class="rounded-xl bg-[#09090c] border border-[#1a1a24] p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-sm">📝</span>
            <p class="text-xs text-white/40 font-medium">更新日志</p>
          </div>
          <div class="flex gap-1.5">
            <button v-for="v in versions.versions" :key="v.version"
              @click="activeVersion = v.version"
              :class="[
                'px-2.5 py-1 rounded text-[9px] border cursor-pointer transition-all',
                activeVersion === v.version
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-transparent border-[#1a1a24] text-white/20 hover:text-white/40'
              ]">v{{ v.version }}</button>
          </div>
        </div>
        <div v-for="v in versions.versions" :key="v.version">
          <div v-if="activeVersion === v.version" class="animate-fadeIn">
            <div class="flex items-center gap-2 mb-3">
              <span class="px-2 py-0.5 rounded bg-blue-500/10 text-[9px] text-blue-400">v{{ v.version }}</span>
              <span class="text-[10px] text-white/20">{{ v.releasedAt }}</span>
            </div>
            <pre class="text-xs text-white/40 font-sans whitespace-pre-wrap m-0 leading-relaxed">{{ v.changelog }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
