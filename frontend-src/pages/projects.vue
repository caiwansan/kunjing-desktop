<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjectStore } from '~/stores/project'

definePageMeta({ middleware: 'auth' })

const projectStore = useProjectStore()
const router = useRouter()

const showNewDialog = ref(false)
const newTitle = ref('')
const newDesc = ref('')
const showDeleteConfirm = ref<string | null>(null)

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  draft: { label: '草稿', cls: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
  completed: { label: '已完成', cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
}

function getStatusBadge(status: string) {
  return statusBadge[status] || { label: status, cls: 'bg-white/5 border-white/10 text-white/40' }
}

function enterProject(id: string) {
  router.push(`/studio/v2?project=${id}`)
}

function confirmDelete(id: string) {
  showDeleteConfirm.value = id
}

function doDelete() {
  if (showDeleteConfirm.value) {
    projectStore.deleteProject(showDeleteConfirm.value)
    showDeleteConfirm.value = null
  }
}

function createProject() {
  if (!newTitle.value.trim()) return
  projectStore.createProject(newTitle.value.trim(), newDesc.value.trim())
  newTitle.value = ''
  newDesc.value = ''
  showNewDialog.value = false
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getThumbnailEmoji(project: any) {
  if (project.title.includes('火麒麟') || project.title.includes('传说')) return '🐉'
  if (project.title.includes('夜') || project.title.includes('都市')) return '🌃'
  if (project.title.includes('山海') || project.title.includes('镜')) return '🏔️'
  if (project.title.includes('星河') || project.title.includes('征途')) return '🚀'
  if (project.title.includes('古墓') || project.title.includes('迷踪')) return '🏛️'
  if (project.title.includes('青春') || project.title.includes('物语')) return '🌸'
  return '🎬'
}

onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<template>
  <div class="min-h-screen bg-[#0B1020] text-white">
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <a href="/studio/v2" class="text-xs text-gray-500 hover:text-gray-300 mb-2 inline-block transition-colors">← 返回工作台</a>
          <h1 class="text-2xl font-bold text-white mt-1">项目管理</h1>
          <p class="text-sm text-gray-400 mt-1">管理你的所有影视创作项目</p>
        </div>
        <button @click="showNewDialog = true"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
          <span class="text-lg">＋</span>
          <span>新建项目</span>
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="bg-[#141829] border border-[#1e2a4a] rounded-xl p-4 mb-6">
        <div class="flex flex-wrap items-center gap-4">
          <!-- Search -->
          <div class="flex-1 min-w-[200px]">
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input v-model="projectStore.searchQuery"
                placeholder="搜索项目名称或描述..."
                class="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50 transition-colors" />
            </div>
          </div>
          <!-- Status Filter -->
          <select v-model="projectStore.statusFilter"
            class="px-3 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-gray-300 focus:outline-none focus:border-[#00D4FF]/50 transition-colors">
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="draft">草稿</option>
            <option value="completed">已完成</option>
          </select>
          <!-- Sort -->
          <select v-model="projectStore.sortField"
            class="px-3 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-gray-300 focus:outline-none focus:border-[#00D4FF]/50 transition-colors">
            <option value="updatedAt">按更新时间</option>
            <option value="createdAt">按创建时间</option>
            <option value="title">按名称</option>
          </select>
          <button @click="projectStore.sortDir = projectStore.sortDir === 'asc' ? 'desc' : 'asc'"
            class="px-3 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-gray-400 hover:text-white transition-colors">
            {{ projectStore.sortDir === 'asc' ? '↑ 升序' : '↓ 降序' }}
          </button>
        </div>
      </div>

      <!-- Project Grid -->
      <div v-if="projectStore.filteredProjects.length === 0" class="text-center py-20">
        <div class="text-5xl mb-4">📂</div>
        <p class="text-gray-400 text-lg mb-2">暂无项目</p>
        <p class="text-gray-500 text-sm mb-6">创建一个新项目开始你的创作之旅</p>
        <button @click="showNewDialog = true"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:from-blue-500 hover:to-cyan-400 transition-all">
          ＋ 新建项目
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="project in projectStore.filteredProjects" :key="project.id"
          class="bg-[#141829] border border-[#1e2a4a] rounded-xl overflow-hidden group cursor-pointer hover:border-[#00D4FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#00D4FF]/5"
          @click="enterProject(project.id)">
          <!-- Thumbnail Area -->
          <div class="h-40 bg-gradient-to-br from-[#1a1f3a] to-[#0B1020] flex items-center justify-center relative overflow-hidden">
            <div class="text-6xl opacity-30 group-hover:opacity-50 transition-opacity duration-300">{{ getThumbnailEmoji(project) }}</div>
            <div class="absolute inset-0 bg-gradient-to-t from-[#141829]/80 to-transparent"></div>
            <!-- Status badge on thumbnail -->
            <span :class="['absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-sm',
              getStatusBadge(project.status).cls]">
              {{ getStatusBadge(project.status).label }}
            </span>
            <!-- Favorite button -->
            <button @click.stop="projectStore.toggleFavorite(project.id)"
              class="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
              :class="project.isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'">
              {{ project.isFavorite ? '★' : '☆' }}
            </button>
          </div>
          <!-- Info -->
          <div class="p-4">
            <h3 class="text-white font-semibold text-base mb-1 truncate">{{ project.title }}</h3>
            <p class="text-gray-400 text-xs mb-3 line-clamp-2">{{ project.description }}</p>
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">{{ formatDate(project.updatedAt) }}</span>
              <span class="text-blue-400/70">{{ project.shotCount }} 镜头</span>
            </div>
          </div>
          <!-- Hover actions -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span class="text-white text-sm font-medium bg-blue-600/80 px-4 py-2 rounded-lg pointer-events-auto">进入工作台 →</span>
          </div>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="mt-8 flex items-center gap-6 text-sm text-gray-500 border-t border-[#1e2a4a] pt-4">
        <span>共 <strong class="text-white">{{ projectStore.projects.length }}</strong> 个项目</span>
        <span>进行中 <strong class="text-emerald-400">{{ projectStore.activeProjects.length }}</strong></span>
        <span>草稿 <strong class="text-yellow-400">{{ projectStore.projects.filter(p => p.status === 'draft').length }}</strong></span>
        <span>已完成 <strong class="text-blue-400">{{ projectStore.projects.filter(p => p.status === 'completed').length }}</strong></span>
      </div>

      <!-- New Project Dialog -->
      <Teleport to="body">
        <div v-if="showNewDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="showNewDialog = false">
          <div class="w-full max-w-md mx-4 bg-[#141829] border border-[#1e2a4a] rounded-xl p-6 shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-white font-semibold text-lg">新建项目</h3>
              <button @click="showNewDialog = false" class="text-gray-500 hover:text-white text-xl border-none bg-transparent cursor-pointer transition-colors">✕</button>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">项目名称</label>
                <input v-model="newTitle" placeholder="输入项目名称..."
                  class="w-full px-4 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                  @keyup.enter="createProject" />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">项目描述</label>
                <textarea v-model="newDesc" placeholder="简短的描述你的项目..."
                  rows="3"
                  class="w-full px-4 py-2.5 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50 transition-colors resize-none"></textarea>
              </div>
              <button @click="createProject"
                class="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:from-blue-500 hover:to-cyan-400 transition-all">
                创建项目
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Delete Confirm Dialog -->
      <Teleport to="body">
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="showDeleteConfirm = null">
          <div class="w-full max-w-sm mx-4 bg-[#141829] border border-[#1e2a4a] rounded-xl p-6 shadow-2xl">
            <h3 class="text-white font-semibold text-lg mb-2">确认删除</h3>
            <p class="text-gray-400 text-sm mb-5">删除后不可恢复，确定要删除该项目吗？</p>
            <div class="flex gap-3">
              <button @click="showDeleteConfirm = null"
                class="flex-1 py-2 rounded-lg bg-[#0B1020] border border-[#1e2a4a] text-sm text-gray-400 hover:text-white transition-colors">
                取消
              </button>
              <button @click="doDelete"
                class="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 transition-colors">
                删除
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
