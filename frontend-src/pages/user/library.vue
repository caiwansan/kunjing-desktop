<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'user', middleware: 'auth' })

const auth = useAuthStore()
const assets = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const viewDetail = ref<any>(null)
const filterType = ref<'all' | 'image' | 'video'>('all')
const searchQuery = ref('')

const showUploadForm = ref(false)
const uploadForm = ref({ title: '', type: 'image', url: '', thumbnail: '', prompt: '' })
const uploadSaving = ref(false)
const uploadError = ref('')
const uploadSuccess = ref('')
const localUploading = ref(false)
const localUploadError = ref('')
const videoCovers = ref<Record<string, string>>({})

const filteredAssets = computed(() => {
  let list = assets.value
  if (filterType.value !== 'all') {
    list = list.filter(a => a.type === filterType.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(a => (a.title || '').toLowerCase().includes(q) || (a.prompt || '').toLowerCase().includes(q))
  }
  return list
})

async function loadLibrary() {
  loading.value = true
  try {
    const res = await fetch('/api/user/library', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      assets.value = data.assets || []
      total.value = data.total || 0
      // 先调用后端生成缩略图
      await refreshThumbnails()
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function refreshThumbnails() {
  // 调用后端为没有缩略图的视频生成首帧缩略图
  try {
    await fetch('/api/user/regenerate-thumbnails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    // 重新加载以确保缩略图已更新
    const res = await fetch('/api/user/library', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      assets.value = data.assets || []
      total.value = data.total || 0
    }
  } catch {}
}

async function deleteAsset(id: string) {
  if (!confirm('确定删除该作品？')) return
  try {
    const res = await fetch(`/api/user/library/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      assets.value = assets.value.filter(a => a.id !== id)
      total.value--
      if (viewDetail.value?.id === id) viewDetail.value = null
    } else {
      const err = await res.json()
      alert(err.error || '删除失败')
    }
  } catch (e: any) {
    alert(e.message || '删除失败')
  }
}

async function showDetail(id: string) {
  try {
    const res = await fetch(`/api/user/library/${id}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const data = await res.json()
      viewDetail.value = data.asset || data
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleUpload() {
  if (!uploadForm.value.title || !uploadForm.value.url) {
    uploadError.value = '请填写标题和资源链接'
    return
  }
  uploadError.value = ''
  uploadSuccess.value = ''
  uploadSaving.value = true
  try {
    const res = await fetch('/api/v1/upload/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(uploadForm.value),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '上传失败')
    }
    uploadSuccess.value = `上传成功！资产 ID: ${data.id}`
    uploadForm.value = { title: '', type: 'image', url: '', thumbnail: '', prompt: '' }
    showUploadForm.value = false
    loadLibrary()
  } catch (e: any) {
    uploadError.value = e.message
  } finally {
    uploadSaving.value = false
  }
}

async function handleLocalUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  localUploading.value = true
  localUploadError.value = ''
  try {
    const formData = new FormData()
    formData.append('file', input.files[0])
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '上传失败')
    }
    uploadSuccess.value = `本地文件上传成功！`
    loadLibrary()
  } catch (e: any) {
    localUploadError.value = e.message
  } finally {
    localUploading.value = false
    input.value = ''
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

function getAssetThumbnail(asset: any): string {
  if (asset.thumbnail) return asset.thumbnail
  if (asset.type === 'image' && asset.url) return asset.url
  if (asset.type === 'video' && videoCovers.value[asset.id]) return videoCovers.value[asset.id]
  return ''
}

onMounted(loadLibrary)
</script>

<template>
  <div class="px-[10%] py-8">
    <div class="max-w-6xl mx-auto">
      <!-- 头部 -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <router-link to="/studio/v2" class="no-underline flex items-center gap-2">
            <img src="/logo.png?v=2" alt="火麒麟" class="w-7 h-7 rounded-lg object-cover">
          </router-link>
          <h1 class="text-lg font-semibold text-white/80">素材库</h1>
          <span class="text-[10px] text-white/20">共 {{ total }} 项</span>
        </div>
        <button @click="showUploadForm = !showUploadForm"
          class="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all cursor-pointer">
          {{ showUploadForm ? '取消' : '📤 添加素材' }}
        </button>
      </div>

      <!-- 搜索 + 筛选 -->
      <div class="flex items-center gap-3 mb-5">
        <div class="flex-1 relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">🔍</span>
          <input v-model="searchQuery" placeholder="搜索素材名称或描述..."
            class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/60 placeholder:text-white/20 outline-none focus:border-blue-500/30 transition-colors" />
        </div>
        <div class="flex gap-1">
          <button v-for="opt in [{ label: '全部', value: 'all' }, { label: '🖼 图片', value: 'image' }, { label: '🎬 视频', value: 'video' }]"
            :key="opt.value"
            @click="filterType = opt.value as any"
            class="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border-none"
            :class="filterType === opt.value
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'">
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Upload Form -->
      <div v-if="showUploadForm" class="mb-6 p-4 rounded-xl border border-[#1a1a24] bg-[#09090c]">
        <h3 class="text-xs font-semibold text-white/60 mb-3">上传外部资源</h3>
        <div class="mb-4 p-3 rounded-lg border border-dashed border-blue-500/20 bg-blue-500/5">
          <p class="text-[10px] text-blue-400/60 mb-2">从本地上传图片</p>
          <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] cursor-pointer hover:bg-blue-500/20 transition-all">
            {{ localUploading ? '上传中...' : '📁 选择本地图片' }}
            <input type="file" accept="image/*" class="hidden" @change="handleLocalUpload" :disabled="localUploading">
          </label>
          <p v-if="localUploadError" class="mt-2 text-[10px] text-red-400">{{ localUploadError }}</p>
          <p class="mt-1 text-[9px] text-white/20">支持 JPG / PNG / GIF / WebP，单文件最大 50MB</p>
        </div>
        <div class="relative mb-3">
          <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-white/[0.06]"></div></div>
          <div class="relative flex justify-center"><span class="px-2 text-[9px] text-white/20 bg-[#09090c]">或者通过链接导入</span></div>
        </div>
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input v-model="uploadForm.title" placeholder="资源标题"
              class="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors" />
            <select v-model="uploadForm.type"
              class="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 outline-none focus:border-blue-500/40 transition-colors">
              <option value="image">图片</option>
              <option value="video">视频</option>
            </select>
          </div>
          <input v-model="uploadForm.url" placeholder="资源 URL"
            class="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors" />
          <input v-model="uploadForm.thumbnail" placeholder="缩略图 URL（可选）"
            class="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors" />
          <input v-model="uploadForm.prompt" placeholder="提示词/描述（可选）"
            class="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors" />
          <div v-if="uploadError" class="text-[10px] text-red-400">{{ uploadError }}</div>
          <div v-if="uploadSuccess" class="text-[10px] text-green-400">{{ uploadSuccess }}</div>
          <button @click="handleUpload" :disabled="uploadSaving"
            class="w-full py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border-none"
            :class="uploadSaving ? 'bg-blue-500/30 text-blue-400/50 cursor-wait' : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30'">
            {{ uploadSaving ? '上传中...' : '📤 提交外部资源' }}
          </button>
          <p class="text-[9px] text-white/20 text-center">外部资源不生成 DNA 指纹，不进入交易体系，仅在本账号下可见</p>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-white/30 animate-pulse text-center py-8">加载中...</div>

      <div v-else-if="filteredAssets.length === 0" class="text-xs text-white/20 text-center py-12">
        <p class="text-4xl mb-3">🎬</p>
        <p>{{ searchQuery || filterType !== 'all' ? '没有找到匹配的素材' : '还没有素材，去创作第一个吧！' }}</p>
        <router-link v-if="!searchQuery && filterType === 'all'" to="/studio/v2" class="inline-block mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white/90 no-underline">
          进入工作室 →
        </router-link>
      </div>

      <template v-else>
        <!-- Detail Modal -->
        <div v-if="viewDetail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="viewDetail = null">
          <div class="w-full max-w-lg mx-4 rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-white/70">{{ viewDetail.title }}</h3>
              <button @click="viewDetail = null" class="text-white/20 hover:text-white/40 text-sm border-none bg-transparent cursor-pointer">✕</button>
            </div>
            <div v-if="viewDetail.url" class="mb-3 rounded-lg overflow-hidden bg-white/[0.02]">
              <img v-if="viewDetail.type === 'image'" :src="viewDetail.url" class="w-full h-auto max-h-64 object-contain" />
              <video v-else :src="viewDetail.url" controls class="w-full max-h-64" poster="">
              </video>
            </div>
            <div class="space-y-1 text-xs">
              <p class="text-white/40"><span class="text-white/20">类型：</span>{{ viewDetail.type }}</p>
              <p class="text-white/40"><span class="text-white/20">创建时间：</span>{{ formatDate(viewDetail.createdAt) }}</p>
              <p v-if="viewDetail.prompt" class="text-white/40"><span class="text-white/20">描述：</span>{{ viewDetail.prompt }}</p>
            </div>
            <button @click="deleteAsset(viewDetail.id)"
              class="mt-4 w-full py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400/70 cursor-pointer hover:bg-red-500/20 transition-all">
              删除作品
            </button>
          </div>
        </div>

        <!-- Asset Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div v-for="asset in filteredAssets" :key="asset.id"
            class="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group cursor-pointer hover:border-orange-500/20 hover:bg-white/[0.04] transition-all relative"
            @click="showDetail(asset.id)">
            <!-- Thumbnail -->
            <div class="aspect-video bg-white/[0.02] flex items-center justify-center overflow-hidden">
              <!-- 图片或带封面的视频 -->
              <img v-if="getAssetThumbnail(asset)"
                :src="getAssetThumbnail(asset)"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy" />
              <!-- 无封面的视频 -->
              <div v-else class="flex flex-col items-center gap-1 text-white/10">
                <span class="text-3xl">🎬</span>
                <span class="text-[9px]">视频</span>
              </div>
              <!-- 视频角标 -->
              <span v-if="asset.type === 'video'"
                class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/70 flex items-center gap-1">
                ▶ 视频
              </span>
            </div>
            <!-- Info -->
            <div class="p-2.5">
              <p class="text-xs text-white/60 truncate mb-1">{{ asset.title || '未命名作品' }}</p>
              <div class="flex items-center justify-between">
                <span class="text-[9px] text-white/20">{{ formatDate(asset.createdAt) }}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 uppercase">{{ asset.type }}</span>
              </div>
            </div>
            <!-- Delete -->
            <button @click.stop="deleteAsset(asset.id)"
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white/30 text-[10px] border-none cursor-pointer opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all flex items-center justify-center">
              ✕
            </button>
          </div>
        </div>

        <p v-if="total > filteredAssets.length" class="text-[10px] text-white/20 text-center mt-4">共 {{ total }} 个素材，当前显示 {{ filteredAssets.length }}</p>
      </template>
    </div>
  </div>
</template>
