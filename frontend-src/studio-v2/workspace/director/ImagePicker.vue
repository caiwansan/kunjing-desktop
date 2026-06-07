<template>
  <div class="image-picker-overlay" @click.self="$emit('close')">
    <div class="image-picker-modal">
      <div class="picker-header">
        <span class="picker-title">{{ title }}</span>
        <button class="picker-close" @click="$emit('close')">✕</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="picker-loading">
        <span>加载素材中…</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="images.length === 0" class="picker-empty">
        <div class="picker-empty-icon">🖼</div>
        <div class="picker-empty-text">{{ props.type === 'all' ? '还没有素材图' : '还没有'+ (type === 'character' ? '角色' : '场景') +'图' }}</div>
        <div class="picker-empty-hint">请先在对应阶段生成图片，或使用"上传参考图"功能</div>
      </div>

      <!-- Tabs（类型切换）+ 图片网格（同时显示） -->
      <template v-else-if="showSceneTab">
        <div class="picker-tabs">
          <span
            v-if="props.type === 'all'"
            class="picker-tab"
            :class="{ active: activeGroup === 'all' }"
            @click="activeGroup = 'all'"
          >📦 全部 ({{ images.length }})</span>
          <span
            class="picker-tab"
            :class="{ active: activeGroup === 'character' }"
            @click="activeGroup = 'character'"
          >👤 角色图 ({{ groupCount('character') }})</span>
          <span
            class="picker-tab"
            :class="{ active: activeGroup === 'scene' }"
            @click="activeGroup = 'scene'"
          >🏙️ 场景图 ({{ groupCount('scene') }})</span>
          <span
            v-if="props.type === 'all'"
            class="picker-tab"
            :class="{ active: activeGroup === 'prop' }"
            @click="activeGroup = 'prop'"
          >🛡️ 道具图 ({{ groupCount('prop') }})</span>
          <span
            v-if="props.type === 'all'"
            class="picker-tab"
            :class="{ active: activeGroup === 'storyboard' }"
            @click="activeGroup = 'storyboard'"
          >🎬 分镜图 ({{ groupCount('storyboard') }})</span>
        </div>
        <!-- 图片网格 -->
        <div class="picker-grid" v-if="filteredImages.length > 0">
          <div
            v-for="(img, idx) in filteredImages"
            :key="(img.id || img._id || '') + '_' + idx"
            class="picker-item"
            :class="{ selected: isSelected(img) }"
            :style="selectionOrderStyle(img)"
            @click="toggleSelect(img)"
          >
            <img :src="img.url || img.imageUrl" :alt="img.name || img.characterName || img.sceneName" class="picker-thumb" />
            <div class="picker-item-label">
              {{ img.characterName || img.sceneName || img.name || '素材' }}
            </div>
            <div v-if="isSelected(img)" class="picker-check">{{ selectedIndex(img) }}</div>
          </div>
        </div>
        <div v-else class="picker-sub-empty">
          <div style="font-size:12px;color:#6b7280;padding:30px;text-align:center;">该分类暂无图片</div>
        </div>
      </template>

      <!-- 图片网格（无 tab 模式：角色/场景专用） -->
      <div v-else class="picker-grid">
        <div
          v-for="(img, idx) in filteredImages"
          :key="(img.id || img._id || '') + '_' + idx"
          class="picker-item"
          :class="{ selected: isSelected(img) }"
          :style="selectionOrderStyle(img)"
          @click="toggleSelect(img)"
        >
          <img :src="img.url || img.imageUrl" :alt="img.name || img.characterName || img.sceneName" class="picker-thumb" />
          <div class="picker-item-label">
            {{ img.characterName || img.sceneName || img.name || '素材' }}
          </div>
          <div v-if="isSelected(img)" class="picker-check">{{ selectedIndex(img) }}</div>
        </div>
      </div>

      <!-- 底部操作：已选预览 + 确认 -->
      <div class="picker-footer">
        <div class="picker-selected-preview" v-if="selectedUrls.length > 0">
          <div class="preview-label">已选 {{ selectedUrls.length }} 张</div>
          <div class="preview-thumbs">
            <img v-for="(url, i) in selectedUrls" :key="url" :src="url" class="preview-thumb" @click="removeUrl(url)" :title="'点击移除'" />
          </div>
        </div>
        <div class="picker-actions">
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button class="btn-confirm" :disabled="selectedUrls.length === 0" @click="confirmSelect">
            确认选择 ({{ selectedUrls.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const props = defineProps<{
  projectId: string
  type: 'character' | 'scene' | 'all'
  initialUrls?: string[]
}>()

const emit = defineEmits<{
  select: [urls: string[]]
  close: []
}>()

const title = computed(() => {
  if (props.type === 'all') return '从素材库选择图片（可多选）'
  return props.type === 'character' ? '选择角色图（可多选）' : '选择场景图（可多选）'
})

const loading = ref(true)
const images = ref<any[]>([])
const selectedUrls = ref<string[]>(props.initialUrls || [])

// ⭐ 从 store 获取道具图（setup 阶段同步获取）
const storeModule = useStudioStore()
const storeState = storeModule.state
const propsFromState = computed(() => storeState.workspace?.narrative?.props || [])

function isSelected(img: any): boolean {
  const url = img.url || img.imageUrl
  return selectedUrls.value.includes(url)
}

function selectedIndex(img: any): number {
  const url = img.url || img.imageUrl
  return selectedUrls.value.indexOf(url) + 1
}

function selectionOrderStyle(img: any): Record<string, string> {
  if (!isSelected(img)) return {}
  return { borderColor: '#10b981' }
}

function toggleSelect(img: any) {
  const url = img.url || img.imageUrl
  const idx = selectedUrls.value.indexOf(url)
  if (idx >= 0) {
    selectedUrls.value.splice(idx, 1)
  } else {
    selectedUrls.value.push(url)
  }
}

function removeUrl(url: string) {
  const idx = selectedUrls.value.indexOf(url)
  if (idx >= 0) selectedUrls.value.splice(idx, 1)
}

function confirmSelect() {
  if (selectedUrls.value.length > 0) {
    emit('select', [...selectedUrls.value])
    emit('close')
  }
}

const showSceneTab = ref(false)
const activeGroup = ref<'character' | 'scene'>('character')

function initActiveGroup() {
  if (props.type === 'all') {
    activeGroup.value = 'all'
    showSceneTab.value = true
  } else {
    activeGroup.value = props.type === 'character' ? 'character' : 'scene'
  }
}
initActiveGroup()

const filteredImages = computed(() => {
  if (activeGroup.value === 'all') return images.value
  return images.value.filter(i => i._pickerGroup === activeGroup.value)
})

function groupCount(group: string): number {
  return images.value.filter(i => i._pickerGroup === group).length
}

async function fetchImages() {
  loading.value = true
  images.value = []
  try {
    const pid = props.projectId
    if (!pid) return
    // 一次性获取全部素材图（含道具图）
    try {
      const res = await fetch(`/api/execution-images/all/${pid}`)
      const json = res.ok ? await res.json() : { data: {} }
      const d = json?.data || {}
      const charItems = (d.characters || []).map((i: any) => ({ ...i, _pickerGroup: 'character' }))
      const sceneItems = (d.scenes || []).map((i: any) => ({ ...i, _pickerGroup: 'scene' }))
      const storyboardItems = (d.storyboards || []).map((i: any) => ({ ...i, _pickerGroup: 'storyboard' }))
      const frameItems = (d.frames || []).map((i: any) => ({ ...i, _pickerGroup: 'storyboard' }))
      // 道具图从 props 数组获取
      const propItems = (d.props || []).map((i: any) => ({ 
        ...i, 
        _pickerGroup: 'prop',
        url: i.imageUrl || '',
        imageUrl: i.imageUrl || '',
        name: i.propName || i.name || '道具',
        propName: i.propName || i.name || '道具',
      }))
      images.value = [...charItems, ...sceneItems, ...propItems, ...storyboardItems, ...frameItems]
    } catch (e) {
      console.warn('[ImagePicker] fetch all failed:', e)
      images.value = []
    }
    
    if (props.type === 'all') {
      showSceneTab.value = true
      activeGroup.value = 'all'
    } else if (props.type === 'character') {
      const otherItems = sceneItems.length > 0
      showSceneTab.value = false // 只显示角色
      // 保留只显示角色
      images.value = charItems
    } else {
      showSceneTab.value = false
      images.value = sceneItems
    }
  } catch (e) {
    console.warn('[ImagePicker] fetch failed:', e)
    images.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchImages)
</script>

<style scoped>
.image-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-picker-modal {
  background: #111122;
  border: 1px solid #2a2a3e;
  border-radius: 12px;
  width: 700px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #1a1a2e;
}
.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: #d1d5db;
}
.picker-close {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}
.picker-close:hover { color: #ef4444; }

.picker-loading, .picker-empty {
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
  font-size: 12px;
}
.picker-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 16px 0;
  border-bottom: 1px solid #1a1a2e;
}
.picker-tab {
  padding: 6px 14px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.15s;
}
.picker-tab:hover { color: #d1d5db; }
.picker-tab.active {
  color: #10b981;
  background: #0a0a14;
  border: 1px solid #1a1a2e;
  border-bottom-color: #0a0a14;
}
.picker-empty-icon { font-size: 32px; opacity: 0.2; margin-bottom: 8px; }
.picker-empty-text { font-size: 13px; color: #9ca3af; }
.picker-empty-hint { font-size: 11px; color: #4b5563; margin-top: 4px; }
.picker-sub-empty { flex:1; display:flex; align-items:center; justify-content:center; }

.picker-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  padding: 16px;
}
.picker-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  background: #0a0a14;
}
.picker-item:hover { border-color: #3b82f6; }
.picker-item.selected {
  border-color: #10b981;
  box-shadow: 0 0 0 1px #10b98144;
}
.picker-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
.picker-item-label {
  padding: 4px 6px;
  font-size: 10px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(0,0,0,0.5);
}
.picker-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #10b981;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
  font-weight: 700;
}

.picker-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #1a1a2e;
}
.picker-selected-preview { display: flex; flex-direction: column; gap: 6px; }
.preview-label { font-size: 10px; color: #6b7280; }
.preview-thumbs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.preview-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #1a1a2e;
  transition: opacity 0.15s;
}
.preview-thumb:hover { opacity: 0.6; }
.picker-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  color: #9ca3af;
  font-size: 11px;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-cancel:hover { background: #222233; }
.btn-confirm {
  background: linear-gradient(135deg, #059669, #10b981);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.btn-confirm:disabled { opacity: 0.4; cursor: default; }
.btn-confirm:hover:not(:disabled) { opacity: 0.85; }
</style>
