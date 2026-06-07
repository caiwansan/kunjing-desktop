<template>
  <div class="gallery-page">
    <div class="gallery-header">
      <button class="back-btn" @click="router.push('/user/center')">← 个人中心</button>
      <h1>我的图库</h1>
    </div>

    <!-- 分类切换 -->
    <div class="gallery-tabs">
      <button
        v-for="tab in tabs" :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key; loadGallery()"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="gallery-loading">
      <div class="spinner" />
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="items.length === 0" class="gallery-empty">
      <span class="empty-icon">{{ emptyIcon }}</span>
      <p>{{ emptyText }}</p>
      <router-link to="/studio/v2" class="empty-action">去创作 →</router-link>
    </div>

    <!-- 图片网格 -->
    <div v-else class="gallery-grid">
      <div v-for="item in items" :key="item.id" class="gallery-card" @click="previewItem(item)">
        <div class="gallery-card-img-wrap">
          <img :src="item.url" :alt="item.name" class="gallery-card-img" @error="onImgError($event)" loading="lazy" />
          <span class="gallery-card-badge" :class="`badge--${item.type}`">{{ typeLabel(item.type) }}</span>
          <button class="gallery-card-del" @click.stop="confirmDelete(item)" title="删除">✕</button>
        </div>
        <div class="gallery-card-info">
          <p class="gallery-card-name">{{ item.name }}</p>
          <p v-if="item.projectTitle" class="gallery-card-project">{{ item.projectTitle }}</p>
          <p class="gallery-card-time">{{ formatTime(item.createdAt) }}</p>
        </div>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore && !loading" class="gallery-more">
      <button class="more-btn" @click="loadMore">加载更多</button>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="preview" class="preview-overlay" @click.self="preview = null">
      <div class="preview-modal">
        <button class="preview-close" @click="preview = null">✕</button>
        <div class="preview-img-wrap" @click="toggleZoom">
          <img :src="preview.url" :alt="preview.name" class="preview-img" :class="{ zoomed: zoomed }" @error="onImgError($event)" />
        </div>
        <div class="preview-info">
          <h3>{{ preview.name }}</h3>
          <p v-if="preview.projectTitle">项目：{{ preview.projectTitle }}</p>
          <p>类型：{{ typeLabel(preview.type) }}</p>
          <p>创建时间：{{ formatTime(preview.createdAt) }}</p>
          <div class="preview-actions">
            <button class="preview-btn preview-btn--copy" @click="copyUrl(preview.url)">复制链接</button>
            <button class="preview-btn preview-btn--del" @click="confirmDelete(preview)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteTarget" class="preview-overlay" @click.self="deleteTarget = null">
      <div class="confirm-dialog">
        <h3>确认删除</h3>
        <p>确定要删除「{{ deleteTarget.name }}」吗？此操作不可撤销。</p>
        <div class="confirm-actions">
          <button class="preview-btn preview-btn--copy" @click="deleteTarget = null">取消</button>
          <button class="preview-btn preview-btn--del" :disabled="deleting" @click="doDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'scene', label: '场景图' },
  { key: 'character', label: '角色图' },
  { key: 'storyboard', label: '分镜图' },
  { key: 'frame', label: '成品帧' },
  { key: 'prop', label: '道具图' },
  { key: 'asset', label: '作品图' },
]
const activeTab = ref('all')
const items = ref<any[]>([])
const loading = ref(true)
const preview = ref<any>(null)
const zoomed = ref(false)
const deleteTarget = ref<any>(null)
const deleting = ref(false)
const limit = 50
const offset = ref(0)
const total = ref(0)
const hasMore = computed(() => offset.value + limit < total.value)

function previewItem(item: any) {
  preview.value = item
  zoomed.value = false
}

function toggleZoom() {
  zoomed.value = !zoomed.value
}

function confirmDelete(item: any) {
  deleteTarget.value = item
  preview.value = null
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  try {
    const res = await fetch(`/api/user/gallery/${deleteTarget.value.type}/${deleteTarget.value.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const idx = items.value.findIndex((i: any) => i.id === deleteTarget.value.id)
      if (idx !== -1) items.value.splice(idx, 1)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || '删除失败')
    }
  } catch (e: any) {
    alert('网络错误，删除失败')
  }
  deleting.value = false
  deleteTarget.value = null
}

const emptyIcon = computed(() => {
  const map: Record<string, string> = { all: '🖼️', scene: '🏞️', character: '👤', storyboard: '🎬', frame: '🎥', prop: '🧩', asset: '🎨' }
  return map[activeTab.value] || '🖼️'
})
const emptyText = computed(() => {
  const map: Record<string, string> = { all: '还没有任何图片，快去创作吧！', scene: '还没有场景图', character: '还没有角色图', storyboard: '还没有分镜图', frame: '还没有成品帧', prop: '还没有道具图', asset: '还没有作品图' }
  return map[activeTab.value] || '暂无数据'
})

function typeLabel(type: string): string {
  const map: Record<string, string> = { scene: '场景', character: '角色', storyboard: '分镜', frame: '帧', prop: '道具', asset: '作品' }
  return map[type] || type
}

function formatTime(t: string): string {
  if (!t) return ''
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return t }
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="40">🖼️</text></svg>'
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    alert('链接已复制')
  } catch {
    prompt('复制链接:', url)
  }
}

async function loadGallery() {
  loading.value = true
  offset.value = 0
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  if (!token) { loading.value = false; return }

  try {
    const typeParam = activeTab.value === 'all' ? '' : `&type=${activeTab.value}`
    const res = await fetch(`/api/user/gallery?limit=${limit}&offset=0${typeParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        const list = json.data?.data || json.data || []
        items.value = Array.isArray(list) ? list : []
        total.value = json.data?.total || json.total || 0
      }
    }
  } catch (e) {
    console.warn('[Gallery] load error:', e)
  }
  loading.value = false
}

async function loadMore() {
  offset.value += limit
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  if (!token) return

  try {
    const typeParam = activeTab.value === 'all' ? '' : `&type=${activeTab.value}`
    const res = await fetch(`/api/user/gallery?limit=${limit}&offset=${offset.value}${typeParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        const list = json.data?.data || json.data || []
        items.value = [...items.value, ...(Array.isArray(list) ? list : [])]
      }
    }
  } catch (e) {
    console.warn('[Gallery] loadMore error:', e)
  }
}

onMounted(() => loadGallery())
</script>

<style scoped>
.gallery-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  padding: 24px;
}
.gallery-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.gallery-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}
.back-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.back-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #e2e8f0;
}
.gallery-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.tab-btn {
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.tab-btn.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-color: transparent;
}
.tab-btn:hover:not(.active) {
  background: rgba(255,255,255,0.08);
}
.gallery-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #94a3b8;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(99,102,241,0.3);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg) } }
.gallery-empty {
  text-align: center;
  padding: 80px 20px;
  color: #64748b;
}
.empty-icon { font-size: 64px; display: block; margin-bottom: 16px; }
.empty-action {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.gallery-card {
  position: relative;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}
.gallery-card:hover {
  border-color: rgba(99,102,241,0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99,102,241,0.15);
}
.gallery-card-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #1e293b;
}
.gallery-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gallery-card-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}
.badge--scene { background: rgba(59,130,246,0.8); }
.badge--character { background: rgba(139,92,246,0.8); }
.badge--storyboard { background: rgba(16,185,129,0.8); }
.badge--asset { background: rgba(245,158,11,0.8); }
.gallery-card-info {
  padding: 12px;
}
.gallery-card-name {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gallery-card-project {
  margin: 0 0 4px;
  font-size: 12px;
  color: #64748b;
}
.gallery-card-time {
  margin: 0;
  font-size: 11px;
  color: #475569;
}
.gallery-more {
  text-align: center;
  padding: 32px;
}
.more-btn {
  padding: 10px 32px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.more-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #e2e8f0;
}
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.preview-modal {
  background: #1e293b;
  border-radius: 16px;
  overflow: hidden;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  z-index: 10;
}
.preview-img {
  max-width: 80vw;
  max-height: 60vh;
  object-fit: contain;
  cursor: zoom-in;
  transition: transform 0.2s;
}
.preview-img.zoomed {
  transform: scale(2);
  cursor: zoom-out;
}
.preview-img-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  cursor: zoom-in;
}
.preview-info {
  padding: 16px;
  color: #e2e8f0;
}
.preview-info h3 { margin: 0 0 8px; font-size: 16px; }
.preview-info p { margin: 0 0 4px; font-size: 13px; color: #94a3b8; }
.preview-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.preview-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.15s;
}
.preview-btn:hover { opacity: 0.85; }
.preview-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.preview-btn--copy {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.preview-btn--del {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.3);
}

/* 删除确认弹窗 */
.confirm-dialog {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90vw;
  text-align: center;
}
.confirm-dialog h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #e2e8f0;
}
.confirm-dialog p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
}
.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

/* 卡片删除按钮 */
.gallery-card-del {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.5);
  color: rgba(255,255,255,0.7);
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  z-index: 5;
}
.gallery-card:hover .gallery-card-del {
  opacity: 1;
}
.gallery-card-del:hover {
  background: rgba(239,68,68,0.8);
  color: #fff;
}
</style>
