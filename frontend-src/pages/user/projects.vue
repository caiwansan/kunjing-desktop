<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { projectKernel } from '~/core/identity/projectKernel'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'user', middleware: 'auth' })

const auth = useAuthStore()
const router = useRouter()

const projects = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'updatedAt' | 'createdAt' | 'name'>('updatedAt')
const viewProject = ref<any>(null)

const filteredProjects = computed(() => {
  let list = projects.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  }
  list = [...list].sort((a, b) => {
    if (sortBy.value === 'name') return (a.name || '').localeCompare(b.name || '')
    return new Date(b[sortBy.value] || 0).getTime() - new Date(a[sortBy.value] || 0).getTime()
  })
  return list
})

const totalAssets = computed(() => {
  let img = 0, vid = 0
  projects.value.forEach(p => {
    const r = p.executionResults || p.execution_results
    if (r?.images) img += Array.isArray(r.images) ? r.images.length : 0
    if (r?.videos) vid += Array.isArray(r.videos) ? r.videos.length : 0
  })
  return { images: img, videos: vid }
})

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-white/5 text-white/40',
    active: 'bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/15',
    completed: 'bg-blue-500/10 text-blue-400/70 border border-blue-500/15',
    archived: 'bg-white/5 text-white/30',
  }
  return map[status] || 'bg-white/5 text-white/40'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    active: '制作中',
    completed: '已完成',
    archived: '已归档',
  }
  return map[status] || status
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await fetch('/api/projects', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      projects.value = data?.projects || data?.data || data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openProject(id: string) {
  projectKernel.setProject(id)
  router.push(`/studio/v2?projectId=${id}`)
}

function getProjectThumbnail(project: any): string {
  const r = project.executionResults || project.execution_results || {}
  if (r.images && r.images.length > 0) return r.images[0]?.url || r.images[0]
  if (r.videos && r.videos.length > 0) return r.videos[0]?.thumbnail || r.videos[0]?.url || ''
  return ''
}

onMounted(loadProjects)
</script>

<template>
  <div class="space-y-5">
    <!-- 头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold text-white/80">📂 我的项目</h2>
        <p class="text-[10px] text-white/30 mt-0.5">共 {{ projects.length }} 个项目 · 累计生成 {{ totalAssets.images }} 张图片 / {{ totalAssets.videos }} 个视频</p>
      </div>
      <router-link to="/studio/v2"
        class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white/90 cursor-pointer border-none hover:from-orange-500 hover:to-rose-500 transition-all no-underline">
        + 新建项目
      </router-link>
    </div>

    <!-- 搜索 & 排序 -->
    <div class="flex items-center gap-3">
      <div class="flex-1 relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/20">🔍</span>
        <input v-model="searchQuery" type="text" placeholder="搜索项目名称或描述..."
          class="w-full box-border bg-white/[0.02] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-xs text-white/60 outline-none focus:border-orange-500/30 transition-colors" />
      </div>
      <select v-model="sortBy"
        class="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/50 outline-none focus:border-orange-500/30 cursor-pointer">
        <option value="updatedAt">最近更新</option>
        <option value="createdAt">最近创建</option>
        <option value="name">按名称</option>
      </select>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="text-center py-16">
      <p class="text-xs text-white/30 animate-pulse">加载中...</p>
    </div>

    <div v-else-if="filteredProjects.length === 0" class="text-center py-16">
      <p class="text-3xl mb-3">📂</p>
      <p class="text-xs text-white/30 mb-4">{{ searchQuery ? '没有匹配的项目' : '还没有创建任何项目' }}</p>
      <router-link v-if="!searchQuery" to="/studio/v2"
        class="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white/90 no-underline hover:from-orange-500 hover:to-rose-500 transition-all">
        去创建第一个项目 →
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="project in filteredProjects" :key="project.id"
        @click="openProject(project.id)"
        class="bg-[#0f0f13] border border-white/[0.05] rounded-xl overflow-hidden cursor-pointer hover:border-orange-500/20 hover:bg-[#15151a] transition-all group">
        <!-- 缩略图 -->
        <div class="h-32 bg-gradient-to-br from-[#1a1a24] to-[#0f0f15] flex items-center justify-center relative overflow-hidden">
          <img v-if="getProjectThumbnail(project)" :src="getProjectThumbnail(project)"
            class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
          <div v-else class="text-center">
            <span class="text-2xl opacity-30">🎬</span>
          </div>
          <div class="absolute top-2 right-2">
            <span class="text-[9px] px-2 py-0.5 rounded-full" :class="statusBadge(project.status)">
              {{ statusLabel(project.status) }}
            </span>
          </div>
        </div>
        <!-- 信息 -->
        <div class="p-3.5">
          <h3 class="text-xs font-medium text-white/70 truncate group-hover:text-white/90 transition-colors">{{ project.name }}</h3>
          <p v-if="project.description" class="text-[10px] text-white/30 mt-1 line-clamp-2">{{ project.description }}</p>
          <div class="flex items-center gap-3 mt-2.5 text-[9px] text-white/25">
            <span>更新 {{ formatDate(project.updatedAt || project.createdAt) }}</span>
            <span v-if="project.version">v{{ project.version }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 查看详情弹窗 -->
    <div v-if="viewProject" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="viewProject=null">
      <div class="bg-[#0f0f13] border border-white/[0.06] rounded-xl w-full max-w-lg mx-4 p-5 max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white/80">{{ viewProject.name }}</h3>
          <button @click="viewProject=null" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div class="space-y-2.5 text-[11px] text-white/50">
          <p><span class="text-white/30">状态：</span>{{ statusLabel(viewProject.status) }}</p>
          <p><span class="text-white/30">描述：</span>{{ viewProject.description || '无' }}</p>
          <p><span class="text-white/30">创建：</span>{{ formatDate(viewProject.createdAt) }}</p>
          <p><span class="text-white/30">更新：</span>{{ formatDate(viewProject.updatedAt) }}</p>
          <p><span class="text-white/30">版本：</span>v{{ viewProject.version || 1 }}</p>
        </div>
        <div class="mt-4 flex gap-2">
          <button @click="openProject(viewProject.id); viewProject=null"
            class="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white/90 border-none cursor-pointer hover:from-orange-500 hover:to-rose-500 transition-all">
            进入项目
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
