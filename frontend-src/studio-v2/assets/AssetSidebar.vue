<template>
  <aside class="asset-sidebar" :class="{ collapsed }">
    <div class="asset-header">
      <div class="asset-title">素材库</div>
      <button class="collapse-btn" @click="$emit('toggle')">
        {{ collapsed ? '◀' : '▶' }}
      </button>
    </div>

    <!-- 分类标签 -->
    <div class="asset-categories">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="category-tag"
        :class="{ active: activeCategory === cat.id }"
        @click="$emit('set-category', cat.id)"
      >
        {{ cat.icon }} {{ cat.label }}
      </button>
    </div>

    <!-- ⭐ 视频风格 & 画面比例 & 锁定 -->
    <VideoStylePanel
      :currentStyle="currentStyle"
      :currentRatio="currentRatio"
      :locked="isLocked"
      @update:style="setStyle"
      @update:ratio="setRatio"
      @toggle-lock="onToggleLock"
      @style-loaded="onStyleLoaded"
    />

    <!-- 素材列表 -->
    <div class="asset-list">
      <div v-if="assets.length === 0" class="asset-empty">
        暂无素材
      </div>
      <div v-for="asset in assets" :key="asset.id" class="asset-item" :data-asset-id="asset.id"
        draggable="true"
        @dragstart="onDragStart(asset, $event)"
        @click="previewAsset(asset)">
        <div class="asset-thumb">
          <img v-if="asset.thumbnail" :src="asset.thumbnail" />
          <div v-else class="asset-thumb-placeholder">{{ assetIcon(asset.type) }}</div>
        </div>
        <div class="asset-info">
          <div class="asset-info-prompt">{{ truncate(asset.prompt || asset.id, 30) }}</div>
          <div class="asset-info-meta">
            v{{ asset.version }} · {{ timeAgo(asset.createdAt) }}
          </div>
        </div>
        <button class="asset-delete" @click.stop="$emit('delete-asset', asset)" title="删除">✕</button>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <Transition name="fade">
      <div v-if="previewUrl" class="preview-overlay" @click.self="previewUrl = ''">
        <div class="preview-container">
          <button class="preview-close" @click="previewUrl = ''">✕</button>
          <div class="preview-actions">
            <button class="preview-select" @click="selectAssetFromPreview">📂 选择此素材</button>
          </div>
          <img :src="previewUrl" class="preview-image" @click.stop />
        </div>
      </div>
    </Transition>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AssetEntry, AssetType } from '~/studio-v2/types/runtime/index'
import VideoStylePanel from '~/studio-v2/components/VideoStylePanel.vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

defineProps<{
  assets: AssetEntry[]
  collapsed: boolean
  activeCategory: AssetType | 'all'
}>()

const emit = defineEmits<{
  toggle: []
  'set-category': [category: AssetType | 'all']
  'delete-asset': [asset: AssetEntry]
  'select-asset': [asset: AssetEntry]
}>()

const { videoStyle, aspectRatio, styleLocked, setVideoStyle, setAspectRatio, toggleStyleLock } = useStudioStore()
const currentStyle = computed(() => videoStyle.value)
const currentRatio = computed(() => aspectRatio.value)
const isLocked = computed(() => styleLocked.value)
function setStyle(v: string) { setVideoStyle(v) }
function setRatio(v: string) { setAspectRatio(v) }
function onStyleLoaded(profile: any) {
  // ⭐ 风格加载后，触发全局广播，各 workspace 接收后自动更新 prompt
  window.dispatchEvent(new CustomEvent('style-profile-loaded', { detail: profile }))
}
function onToggleLock() { toggleStyleLock() }

const categories = [
  { id: 'all' as const, icon: '📦', label: '全部' },
  { id: 'character' as const, icon: '👤', label: '角色' },
  { id: 'scene' as const, icon: '🏙️', label: '场景' },
  { id: 'storyboard' as const, icon: '🎨', label: '分镜' },
  { id: 'video' as const, icon: '🎥', label: '视频' },
  { id: 'audio' as const, icon: '🔊', label: '音频' },
  { id: 'fx' as const, icon: '✨', label: '特效' },
  { id: 'music' as const, icon: '🎵', label: '音乐' },
  { id: 'style' as const, icon: '🎭', label: '风格' },
  { id: 'prompt' as const, icon: '💬', label: 'Prompt' },
  { id: 'prop' as const, icon: '🛡️', label: '道具' },
]

const typeIcons: Record<string, string> = {
  character: '👤', scene: '🏙️', storyboard: '🎨',
  video: '🎥', audio: '🔊', fx: '✨', music: '🎵',
  style: '🎭', prompt: '💬', prop: '🛡️',
}

const previewUrl = ref('')
const previewAssetRef = ref<AssetEntry | null>(null)

function previewAsset(asset: AssetEntry) {
  previewUrl.value = asset.url || asset.thumbnail || ''
  previewAssetRef.value = asset
}

function selectAssetFromPreview() {
  if (previewAssetRef.value) {
    emit('select-asset', previewAssetRef.value)
    previewUrl.value = ''
    previewAssetRef.value = null
  }
}

/** 拖拽素材到工作区 */
function onDragStart(asset: AssetEntry, event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/asset', JSON.stringify(asset))
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function assetIcon(type: AssetType): string {
  return typeIcons[type] || '📄'
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + '分钟前'
  const hours = Math.floor(mins / 60)
  return hours + '小时前'
}
</script>

<style scoped>
.asset-sidebar {
  width: 360px;
  min-width: 360px;
  border-left: 1px solid #1a1a28;
  background: #0a0a10;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s;
}
.asset-sidebar.collapsed {
  width: 0;
  min-width: 0;
  border: none;
}
.asset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 16px 12px;
}
.asset-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.collapse-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 6px;
}
.collapse-btn:hover { color: #d1d5db; }
.asset-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 12px 10px;
}
.category-tag {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #1a1a28;
  color: #9ca3af;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.category-tag:hover { background: #2a2a3a; }
.category-tag.active {
  background: #0f2a1a;
  color: #34d399;
  border: 1px solid #1a3a2a;
}
.asset-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 16px;
}
.asset-empty {
  text-align: center;
  color: #6b7280;
  font-size: 11px;
  padding: 40px 0;
}
.asset-item {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 4px;
}
.asset-item:hover { background: #12121c; }
.asset-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1a28;
  flex-shrink: 0;
}
.asset-thumb img { width: 100%; height: 100%; object-fit: cover; }
.asset-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.asset-info { flex: 1; min-width: 0; }
.asset-info-prompt { font-size: 11px; color: #d1d5db; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-info-meta { font-size: 9px; color: #6b7280; margin-top: 2px; }

/* 图片预览弹窗 */
.preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  cursor: default;
}
.preview-close {
  position: absolute;
  top: -32px;
  right: 0;
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  opacity: 0.7;
}
.preview-close:hover { opacity: 1; }
.preview-actions {
  position: absolute;
  top: -32px;
  left: 0;
}
.preview-select {
  background: #1a3a2a;
  color: #34d399;
  border: 1px solid #2a5a3a;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
}
.preview-select:hover { background: #2a5a3a; }
.preview-image {
  display: block;
  max-width: 100%;
  max-height: 85vh;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
