<template>
  <div class="sb-workspace">
    <!-- 头部 -->
    <div class="sb-header">
      <div class="sb-title-row">
        <span class="sb-title">🎨 分镜图生成</span>
        <span class="sb-subtitle">{{ segments.length }} 个段落 · 每段一张分镜图</span>
      </div>
      <div class="sb-actions">
        <button
          class="sb-btn sb-btn-next"
          @click="goToVideoGen"
        >
          下一步：视频生成 →
        </button>
        <button
          class="sb-btn sb-btn-gen"
          :disabled="generatingAll"
          @click="generateAllImages"
        >
          {{ generatingAll ? '⏳ 批量生成中…' : '🚀 生成全部分镜图' }}
        </button>
      </div>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="sb-loading">
      <span class="sb-loading-spinner">⏳</span>
      <span>加载导演脚本数据…</span>
    </div>

    <!-- 空态 -->
    <div v-else-if="segments.length === 0" class="sb-empty">
      <div class="sb-empty-icon">📋</div>
      <div class="sb-empty-text">暂无段落数据，请先完成导演脚本</div>
    </div>

    <!-- 三列卡片网格 -->
    <div v-else class="sb-grid">
      <div
        v-for="(seg, segIdx) in segments"
        :key="seg.id || seg.segmentId || segIdx"
        class="sb-card"
      >
        <!-- 卡片右上角生成按钮 -->
        <button
          class="sb-card-gen-btn"
          :disabled="isGenerating(segIdx)"
          @click="generateSingleImage(segIdx)"
          :title="isGenerating(segIdx) ? '生成中…' : '生成分镜图'"
        >
          {{ isGenerating(segIdx) ? '⏳' : '🎨' }}
        </button>

        <!-- 1. 段落名称 -->
        <div class="sb-card-title">{{ seg.title || `段落 ${segIdx + 1}` }}</div>

        <!-- 2. 画面描述（折叠式） -->
        <div class="sb-card-text">
          <details class="sb-details">
            <summary class="sb-details-summary">🎬 画面描述</summary>
            <p class="sb-full-text sb-visual-desc">{{ seg.fullText || '暂无详细画面描述' }}</p>
          </details>
        </div>

        <!-- 3. 参考素材区（角色图、场景图、道具图） -->
        <div class="sb-card-refs">
          <div class="sb-section-label">🖼️ 参考素材（点击选中）</div>

          <!-- 角色图 -->
          <div v-if="matchedCharacters(seg).length > 0" class="sb-ref-group">
            <span class="sb-ref-group-label">👤 角色图</span>
            <div class="sb-ref-grid">
              <div
                v-for="ch in matchedCharacters(seg)"
                :key="ch.characterName || ch.id"
                class="sb-ref-item"
                :class="{ selected: isRefSelected(segIdx, 'character', ch) }"
                @click="toggleRef(segIdx, 'character', seg, ch)"
              >
                <img
                  v-if="ch.referenceImageUrl || ch.imageUrl"
                  :src="ch.referenceImageUrl || ch.imageUrl"
                  :alt="ch.characterName"
                  class="sb-ref-thumb"
                />
                <div v-else class="sb-ref-placeholder">👤</div>
                <span class="sb-ref-name">{{ ch.characterName }}</span>
              </div>
            </div>
          </div>
          <div class="sb-asset-row">
            <button class="sb-asset-btn" @click="openAssetPicker(segIdx, 'character')">📂 从素材库选角色图</button>
            <button class="sb-asset-btn" @click="openAssetPicker(segIdx, 'scene')">📂 从素材库选场景图</button>
            <button class="sb-asset-btn" @click="openAssetPicker(segIdx, 'prop')">📂 从素材库选道具图</button>
          </div>

          <!-- 场景图 -->
          <div v-if="matchedScenes(seg).length > 0" class="sb-ref-group">
            <span class="sb-ref-group-label">🏙️ 场景图</span>
            <div class="sb-ref-grid">
              <div
                v-for="sc in matchedScenes(seg)"
                :key="sc.title || sc.id"
                class="sb-ref-item"
                :class="{ selected: isRefSelected(segIdx, 'scene', sc) }"
                @click="toggleRef(segIdx, 'scene', seg, sc)"
              >
                <img
                  v-if="sc.referenceImageUrl || sc.imageUrl"
                  :src="sc.referenceImageUrl || sc.imageUrl"
                  :alt="sc.title"
                  class="sb-ref-thumb"
                />
                <div v-else class="sb-ref-placeholder">🏙️</div>
                <span class="sb-ref-name">{{ sc.title }}</span>
              </div>
            </div>
          </div>

          <!-- 道具图（全局匹配） -->
          <div v-if="matchedProps(seg).length > 0" class="sb-ref-group">
            <span class="sb-ref-group-label">🛡️ 道具图</span>
            <div class="sb-ref-grid">
              <div
                v-for="pr in matchedProps(seg)"
                :key="pr.propName || pr.id"
                class="sb-ref-item"
                :class="{ selected: isRefSelected(segIdx, 'prop', pr) }"
                @click="toggleRef(segIdx, 'prop', seg, pr)"
              >
                <img
                  v-if="pr.imageUrl || pr.referenceImageUrl"
                  :src="pr.imageUrl || pr.referenceImageUrl"
                  :alt="pr.propName"
                  class="sb-ref-thumb"
                />
                <div v-else class="sb-ref-placeholder">🛡️</div>
                <span class="sb-ref-name">{{ pr.propName }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="matchedCharacters(seg).length === 0 && matchedScenes(seg).length === 0 && matchedProps(seg).length === 0"
            class="sb-ref-none"
          >
            暂无关联素材
          </div>
        </div>

        <!-- 已选参考图预览（素材库选择） -->
        <div v-if="selectedRefs[segIdx]" class="sb-selected-refs">
          <div v-if="getRefCount(segIdx) > 0" class="sb-section-label">✅ 已选参考图（{{ getRefCount(segIdx) }}张）</div>
          <div v-if="getRefCount(segIdx) > 0" class="sb-selected-grid">
            <div v-for="(url, ci) in getRefs(segIdx, 'character')" :key="'ch-'+ci" class="sb-selected-item">
              <img :src="url" class="sb-selected-thumb" />
              <span class="sb-selected-tag">👤 角色</span>
              <button class="sb-selected-remove" @click="removeSelectedRef(segIdx, 'character', ci)">✕</button>
            </div>
            <div v-for="(url, si) in getRefs(segIdx, 'scene')" :key="'sc-'+si" class="sb-selected-item">
              <img :src="url" class="sb-selected-thumb" />
              <span class="sb-selected-tag">🏙️ 场景</span>
              <button class="sb-selected-remove" @click="removeSelectedRef(segIdx, 'scene', si)">✕</button>
            </div>
            <div v-for="(url, pi) in getRefs(segIdx, 'prop')" :key="'pr-'+pi" class="sb-selected-item">
              <img :src="url" class="sb-selected-thumb" />
              <span class="sb-selected-tag">🛡️ 道具</span>
              <button class="sb-selected-remove" @click="removeSelectedRef(segIdx, 'prop', pi)">✕</button>
            </div>
          </div>
        </div>

        <!-- 4. 正向提示词 -->
        <div class="sb-card-prompt">
          <div class="sb-section-label">👍 正向提示词</div>
          <textarea
            v-model="prompts[segIdx]"
            class="sb-prompt-input"
            rows="3"
            placeholder="描述画面内容，可包含角色、场景、动作、光影…"
          />
        </div>

        <!-- 5. 负向提示词 -->
        <div class="sb-card-prompt">
          <div class="sb-section-label">👎 负向提示词</div>
          <textarea
            v-model="negativePrompts[segIdx]"
            class="sb-prompt-input sb-negative"
            rows="2"
            placeholder="模糊、变形、多余手臂、画质差…"
          />
        </div>

        <!-- 6. 生成结果 -->
        <div v-if="results[segIdx] && results[segIdx].url" class="sb-card-result">
          <button class="sb-result-close" @click="clearResult(segIdx)">✕</button>
          <img :src="results[segIdx].url" class="sb-result-img" alt="生成的分镜图" @click="previewUrl = results[segIdx].url" />
        </div>

        <!-- 生成失败错误信息 -->
        <div v-if="errors[segIdx]" class="sb-card-error">
          <span>⚠️ {{ errors[segIdx] }}</span>
          <button class="sb-error-close" @click="clearError(segIdx)">✕</button>
        </div>

        <!-- 操作按钮区 -->
        <div class="sb-card-actions">
          <button
            class="sb-action-btn sb-action-optimize"
            :disabled="aiOptimizing[segIdx]"
            @click="optimizePrompt(segIdx)"
            :title="'AI 优化提示词'"
          >
            {{ aiOptimizing[segIdx] ? '⏳ 优化中…' : '🤖 AI 优化提示词' }}
          </button>
          <button
            class="sb-action-btn sb-action-gen"
            :disabled="isGenerating(segIdx)"
            @click="generateSingleImage(segIdx)"
            :title="isGenerating(segIdx) ? '生成中…' : '生成分镜图'"
          >
            {{ isGenerating(segIdx) ? '⏳ 生成中…' : '🎨 生成图片' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 图片预览 -->
    <Teleport to="body">
      <div v-if="previewUrl" class="sb-preview-overlay" @click.self="previewUrl = ''">
        <img :src="previewUrl" class="sb-preview-img" @click.stop />
        <button class="sb-preview-close" @click="previewUrl = ''">✕</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const { state, projectId: storeProjectId, goToStage } = useStudioStore()

// ─── Segments from store (with fallback) ───
const loading = ref(true)
const useStoreData = computed(() => !!state.projectId && state.workspace.segments.length > 0)

// 从 store 获取段落数据
const storeSegments = computed(() => state.workspace.segments || [])

// 本地 fallback segments（当 store 无数据时使用）
const localSegments = ref<any[]>([])

// 最终使用的 segments：优先 store
const segments = computed(() => {
  if (useStoreData.value) return storeSegments.value
  return localSegments.value
})

// 从 store 获取 characters/scenes
const characterSpecs = computed(() => {
  // 将 store 中的 characters 转换为 StoryboardWorkspace 需要的格式
  return (state.workspace.characters || []).map(ch => ({
    characterName: ch.name || ch.id,
    imageUrl: ch.imageUrl || '',
    // ⭐ 正脸裁剪图作为帧图参考（比三视合成图更适合图生图）
    referenceImageUrl: ch.faceRefImageUrl || ch.imageUrl || '',
    physicalDescription: ch.physicalDescription || ch.description || '',
    clothing: ch.clothing || '',
    imagePrompt: ch.imagePrompt || '',
  }))
})

const sceneSpecs = computed(() => {
  // 从 narrative.scenes 获取场景引用信息
  const narrativeScenes = state.workspace.narrative.scenes || []
  const wsScenes = state.workspace.scenes || []
  const sceneMap = new Map(wsScenes.map(s => [s.name, s]))
  return narrativeScenes.map(sc => ({
    title: sc.name || sc.id,
    id: sc.id,
    description: sc.description || '',
    imageUrl: sceneMap.get(sc.name)?.imageUrl || '',
    referenceImageUrl: sceneMap.get(sc.name)?.imageUrl || '',
    imagePrompt: sc.imagePrompt || '',
  }))
})

const propImages = computed(() => {
  // 从 store 的 assets 获取道具图
  return (state.assets.assets || []).filter(a => a.type === 'prop').map(a => ({
    id: a.id,
    propName: a.name,
    imageUrl: a.url,
    referenceImageUrl: a.url,
  }))
})

// 已存在的分镜图结果
const storyboardImages = computed(() => state.workspace.storyboardImages || [])

const previewUrl = ref('')
const generatingAll = ref(false)
const generatingState = ref<Record<number, boolean>>({})

// 每张卡片的提示词
const prompts = ref<Record<number, string>>({})
const negativePrompts = ref<Record<number, string>>({})

// 生成结果
interface ResultItem { url: string; error?: string }
const results = ref<Record<number, ResultItem>>({})
const errors = ref<Record<number, string>>({})

// 选中的参考图
interface SelectedRefs { character: string[]; scene: string[]; prop: string[] }
const selectedRefs = reactive<Record<number, SelectedRefs>>({})

// 确保 selectedRefs[segIdx] 的数据结构存在
function ensureRefArray(segIdx: number): Required<SelectedRefs> {
  if (!selectedRefs[segIdx]) {
    selectedRefs[segIdx] = { character: [], scene: [], prop: [] }
  }
  const r = selectedRefs[segIdx]
  if (!Array.isArray(r.character)) r.character = []
  if (!Array.isArray(r.scene)) r.scene = []
  if (!Array.isArray(r.prop)) r.prop = []
  return r as Required<SelectedRefs>
}

// AI 优化状态
const aiOptimizing = ref<Record<number, boolean>>({})

// ─── Helpers ───
function getToken(): string {
  try {
    const getCachedToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return getCachedToken()
  } catch { return '' }
}
}

function isGenerating(idx: number): boolean {
  return !!generatingState.value[idx]
}

function clearResult(idx: number) {
  delete results.value[idx]
}

function clearError(idx: number) {
  delete errors.value[idx]
}

// ─── 角色匹配：通过段落全文中的人物名匹配 characterSpecs ───
function matchedCharacters(seg: any): any[] {
  if (!seg) return []
  const specs = characterSpecs.value
  if (!specs.length) return []
  const text = (seg.narrativePurpose || seg.fullText || seg.title || '').toLowerCase()
  return specs.filter((ch) => {
    const name = (ch.characterName || '').toLowerCase()
    if (!name) return false
    return text.includes(name)
  })
}

// ─── 场景匹配 ───
function matchedScenes(seg: any): any[] {
  if (!seg) return []
  const specs = sceneSpecs.value
  if (!specs.length) return []
  const text = (seg.narrativePurpose || seg.fullText || seg.title || '').toLowerCase()
  // 先检查 seg 关联的场景 ID
  const segScenes: string[] = seg.scenes || []
  if (segScenes.length > 0) {
    return specs.filter(sc => segScenes.includes(sc.title) || segScenes.includes(sc.id))
  }
  // 否则用文本匹配
  return specs.filter((sc) => {
    const name = (sc.title || '').toLowerCase()
    if (!name) return false
    return text.includes(name)
  })
}

// ─── 道具匹配 ───
function matchedProps(seg: any): any[] {
  if (!propImages.value.length) return []
  const text = (seg.narrativePurpose || seg.fullText || seg.title || '').toLowerCase()
  return propImages.value.filter((pr) => {
    const name = (pr.propName || '').toLowerCase()
    if (!name) return false
    return text.includes(name)
  })
}

// ─── 切换参考图选择（从自动匹配列表多选） ───
function toggleRef(segIdx: number, type: 'character' | 'scene' | 'prop', seg: any, item: any) {
  const url = item.referenceImageUrl || item.imageUrl || ''
  if (!url) return
  const arr = ensureRefArray(segIdx)
  const idx = arr[type].indexOf(url)
  if (idx >= 0) {
    arr[type].splice(idx, 1)
  } else {
    arr[type].push(url)
  }
  selectedRefs[segIdx] = { ...arr } // 强制触发
}

// ─── 从素材库选取图片（追加到对应类型数组） ───
function openAssetPicker(segIdx: number, type: 'character' | 'scene' | 'prop') {
  const store2 = useStudioStore()
  store2.setAssetCategory(type === 'character' ? 'character' : type === 'scene' ? 'scene' : 'prop')
  store2.toggleAssetSidebar()
  window.__onAssetPickCallback = (asset: any) => {
    if (asset) {
      const url = asset.url || asset.thumbnail || ''
      if (url) {
        const arr = ensureRefArray(segIdx)
        if (!arr[type].includes(url)) {
          arr[type].push(url)
          selectedRefs[segIdx] = { ...arr } // 强制触发
        }
      }
    }
    window.__onAssetPickCallback = undefined
  }
}

// ─── 移除指定索引的已选参考图 ───
function removeSelectedRef(segIdx: number, type: 'character' | 'scene' | 'prop', index: number) {
  const arr = ensureRefArray(segIdx)
  if (index >= 0 && index < arr[type].length) {
    arr[type].splice(index, 1)
    selectedRefs[segIdx] = { ...arr } // 强制触发
  }
}

function isRefSelected(segIdx: number, type: 'character' | 'scene' | 'prop', item: any): boolean {
  const url = item.referenceImageUrl || item.imageUrl || ''
  if (!url) return false
  const refs = selectedRefs[segIdx]
  if (!refs) return false
  const arr = refs[type]
  return Array.isArray(arr) && arr.includes(url)
}

function getAllRefUrls(segIdx: number): string[] {
  const refs = selectedRefs[segIdx]
  if (!refs) return []
  const arr = refs.character || refs.scene || refs.prop
  // 兼容老数据：单字符串
  const ch = typeof refs.character === 'string' ? [refs.character] : (Array.isArray(refs.character) ? refs.character : [])
  const sc = typeof refs.scene === 'string' ? [refs.scene] : (Array.isArray(refs.scene) ? refs.scene : [])
  const pr = typeof refs.prop === 'string' ? [refs.prop] : (Array.isArray(refs.prop) ? refs.prop : [])
  return [...ch, ...sc, ...pr].filter(Boolean)
}

function getMainRefUrl(segIdx: number): string | undefined {
  const refs = selectedRefs[segIdx]
  if (!refs) return undefined
  const arr = getAllRefUrls(segIdx)
  return arr[0] || undefined
}

// ─── 多选辅助函数（模板用） ───
function getRefs(segIdx: number, type: 'character' | 'scene' | 'prop'): string[] {
  const refs = selectedRefs[segIdx]
  if (!refs) return []
  const val = refs[type]
  return Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : [])
}

function getRefCount(segIdx: number): number {
  return getRefs(segIdx, 'character').length + getRefs(segIdx, 'scene').length + getRefs(segIdx, 'prop').length
}

// ─── 数据加载：优先从 store 读取，fallback 到独立 fetch ───
async function loadSpecData() {
  // ✅ 优先从 store 读取（loadFromServer 已填充好所有数据）
  if (useStoreData.value) {
    // 从 store 的 segments 初始化提示词
    initPrompts()
    // 从 store 的 storyboardImages 恢复已生成的结果
    await loadExistingResultsFromStore()
    loading.value = false
    return
  }

  // ⭐ Fallback：store 无数据，才独立 fetch
  let projectId = state.projectId
  if (!projectId) {
    try {
      const token = getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const sbRes = await fetch(`/api/execution-images/storyboards/all`, { headers })
      if (sbRes.ok) {
        const sbJson = await sbRes.json()
        for (const sb of (sbJson.data || [])) {
          if (sb.projectId) { projectId = sb.projectId; break }
        }
      }
    } catch (e) {
      console.warn('[Storyboard] 自动查找 projectId 失败:', e)
    }
    if (!projectId) {
      loading.value = false
      return
    }
  }
  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/aigc-spec/${projectId}/load`, { headers })
    if (!res.ok) {
      console.warn('[Storyboard] load spec failed:', res.status)
      await loadFromStoryboardOnly(projectId)
      return
    }
    const json = await res.json()
    const data = json.data || json
    if (data.videoSegments) {
      localSegments.value = data.videoSegments
      // 初始化提示词
      for (let i = 0; i < data.videoSegments.length; i++) {
        const seg = data.videoSegments[i]
        prompts.value[i] = seg.imagePrompt || ''
        negativePrompts.value[i] = seg.negativePrompt || ''
      }
    } else {
      await loadFromStoryboardOnly(projectId)
      return
    }
  } catch (e) {
    console.error('[Storyboard] load spec error:', e)
  } finally {
    loading.value = false
  }
}

/** 从 store 的 storyboardImages 恢复已有生成结果 */
function loadExistingResultsFromStore() {
  if (!storyboardImages.value.length) return
  const images = storyboardImages.value
  if (segments.value.length) {
    for (const img of images) {
      const idx = segments.value.findIndex(
        (s) => s.id === img.segmentId || s.segmentId === img.segmentId || s.title === img.segmentId
      )
      if (idx >= 0) {
        results.value[idx] = { url: img.imageUrl }
      }
    }
  }
}

/** 初始化提示词（从 store segments 中已有的 imagePrompt/negativePrompt） */
function initPrompts() {
  for (let i = 0; i < segments.value.length; i++) {
    const seg = segments.value[i]
    if (prompts.value[i] === undefined) {
      prompts.value[i] = (seg as any).imagePrompt || ''
    }
    if (negativePrompts.value[i] === undefined) {
      negativePrompts.value[i] = (seg as any).negativePrompt || ''
    }
    // 初始化每张卡片的已选参考图
    if (!selectedRefs[i]) {
      selectedRefs[i] = { character: [], scene: [], prop: [] }
    }
  }
}

// ⭐ 兜底：没有 aigc-spec segmentation 时，直接从 storyboard_images 构建虚拟 segment
async function loadFromStoryboardOnly(projectId: string) {
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/execution-images/storyboards/${projectId}`, { headers })
    if (!res.ok) return
    const json = await res.json()
    if (json.success && json.data?.length) {
      // 按 sortOrder 分组构建 segments
      const seen = new Set<string>()
      segments.value = (json.data as any[])
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .filter((img: any) => {
          if (seen.has(img.segmentId)) return false
          seen.add(img.segmentId)
          return true
        })
        .map((img: any, idx: number) => ({
          segmentId: img.segmentId || `seg_${idx}`,
          title: `分镜 ${img.segmentId || idx + 1}`,
          imagePrompt: img.description || '',
          fullText: img.description || '',
          narrativePurpose: img.description || '',
          sortOrder: img.sortOrder || idx,
        }))
      // 也有图片结果
      for (const img of json.data) {
        const segIdx = segments.value.findIndex((s: any) => 
          s.segmentId === img.segmentId || s.title === img.segmentId
        )
        if (segIdx >= 0) {
          results.value[segIdx] = { url: img.imageUrl }
        }
      }
    }
  } catch (e) {
    console.warn('[Storyboard] loadFromStoryboardOnly error:', e)
  }
}

// ─── 加载已有的生成结果（从 store 或 API） ───
async function loadExistingResults() {
  if (!segments.value.length) return

  // 优先从 store 的 storyboardImages 恢复
  if (storyboardImages.value.length) {
    loadExistingResultsFromStore()
    return
  }

  const projectId = state.projectId
  if (!projectId) return
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/execution-images/storyboards/${projectId}`, { headers })
    const json = await res.json()
    if (json.success && json.data?.length) {
      for (const img of json.data) {
        const rawSegId = img.segmentId || ''
        const seg = segments.value.find(s => s.segmentId === rawSegId || s.title === rawSegId || s.id === rawSegId)
        if (seg) {
          const idx = segments.value.indexOf(seg)
          results.value[idx] = { url: img.imageUrl }
        }
      }
    }
  } catch (e) {
    console.error('[Storyboard] load existing results error:', e)
  }
}

// ─── 生成单张分镜图 ───
async function generateSingleImage(idx: number) {
  const seg = segments.value[idx]
  if (!seg) return

  const prompt = prompts.value[idx]
  if (!prompt) {
    errors.value[idx] = '请先填写正向提示词'
    return
  }

  generatingState.value[idx] = true
  delete errors.value[idx]

  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const refUrls = getAllRefUrls(idx)
    const mainRef = getMainRefUrl(idx)
    const isImg2Img = !!(mainRef || refUrls.length > 0)

    // ⭐ 智能比例约束：检测是否有特殊构图关键词，有则跳过约束
    const specialKeywords = ['法天象地', '巨人', '巨大', '顶天立地', '近景', '特写', 'close-up', '大特写', '仰视', '俯视', '微距', '全身', '半身', '局部']
    const hasSpecialRatio = specialKeywords.some(kw => prompt.includes(kw))
    const ratioConstraint = hasSpecialRatio
      ? ''
      : '，人物身高约占画面1/3到1/2，场景空间完整可见，比例适中'
    const enhancedPrompt = prompt + ratioConstraint

    const body = {
      projectId: state.projectId,
      taskType: 'image',
      input: {
        prompt: enhancedPrompt,
        negativePrompt: negativePrompts.value[idx] || '',
        source: 'storyboard_execution',
        segmentId: seg.id || seg.segmentId || seg.title || `seg_${idx}`,
      },
    }
    if (mainRef) body.input.imageUrl = mainRef
    if (mainRef) body.input.mode = 'img2img'

    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`生成失败: ${res.status} ${errText}`)
    }
    const json = await res.json()
    const taskId = json?.task?.id
    if (!taskId) {
      throw new Error('未获取到任务 ID')
    }

    // 轮询等待任务完成
    let resultUrl = ''
    for (let poll = 0; poll < 30; poll++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(`/api/tasks/${taskId}/status`, { headers })
      if (!statusRes.ok) continue
      const statusData = await statusRes.json()
      const taskData = statusData?.task || statusData
      if (taskData.status === 'completed') {
        // 从 /result 端点获取最终 URL
        const resultRes = await fetch(`/api/tasks/${taskId}/result`, { headers })
        if (resultRes.ok) {
          const resultData = await resultRes.json()
          resultUrl = resultData?.data?.url || ''
        }
        // fallback: 从 status 的 result 中取
        if (!resultUrl && taskData.result?.url) {
          resultUrl = taskData.result.url
        }
        break
      }
      if (taskData.status === 'failed') {
        throw new Error(`图片生成失败: ${taskData.error || '未知错误'}`)
      }
      // status === 'pending' 或 'processing' 继续轮询
    }

    if (!resultUrl) {
      errors.value[idx] = '图片生成超时，请重试'
      return
    }

    results.value[idx] = { url: resultUrl }

    // 保存到 storyboard images 表
    const rawSegId = seg.id || seg.segmentId || seg.title || `seg_${idx}`
    await fetch('/api/execution-images/storyboards', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        projectId: state.projectId,
        images: [{ segmentId: rawSegId, url: resultUrl }],
      }),
    }).catch(() => {})

    // 同步到 store 的 storyboardImages
    if (state.workspace.storyboardImages !== undefined) {
      const existingIdx = state.workspace.storyboardImages.findIndex((sbi: any) => sbi.segmentId === rawSegId)
      const newImage = {
        id: `sb_${rawSegId}_${Date.now()}`,
        segmentId: rawSegId,
        imageUrl: resultUrl,
        prompt: prompt,
        negativePrompt: negativePrompts.value[idx] || '',
        createdAt: new Date().toISOString(),
      }
      if (existingIdx >= 0) {
        state.workspace.storyboardImages[existingIdx] = newImage
      } else {
        state.workspace.storyboardImages.push(newImage)
      }
    }
  } catch (e: any) {
    errors.value[idx] = e.message || '网络错误，请重试'
  } finally {
    generatingState.value[idx] = false
  }
}

// ─── 跳转到视频生成页面 ───
function goToVideoGen() {
  goToStage('video-generation')
}

// ─── 批量生成 ───
async function generateAllImages() {
  generatingAll.value = true
  for (let i = 0; i < segments.value.length; i++) {
    if (!prompts.value[i]) continue
    await generateSingleImage(i)
  }
  generatingAll.value = false
}

// ─── AI 优化提示词 ───
async function optimizePrompt(idx: number) {
  const seg = segments.value[idx]
  if (!seg) return

  // ⭐清除旧缓存
  delete prompts.value[idx]
  delete negativePrompts.value[idx]

  aiOptimizing.value[idx] = true
  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // 收集上下文：段落 + 现有的正向/负向提示词 + 参考素材信息
    const context: string[] = ['你是一个专业的 AI 分镜图提示词工程师。']
    if (seg.fullText || seg.narrativePurpose) {
      context.push(`画面描述：${seg.fullText || seg.narrativePurpose}`)
    }
    if (seg.title) {
      context.push(`段落标题：${seg.title}`)
    }
    if (prompts.value[idx]) {
      context.push(`当前正向提示词：${prompts.value[idx]}`)
    }
    if (negativePrompts.value[idx]) {
      context.push(`当前负向提示词：${negativePrompts.value[idx]}`)
    }
    // 参考素材信息
    const refUrls = getAllRefUrls(idx)
    if (refUrls.length > 0) {
      context.push(`参考图数量：${refUrls.length} 张，其中主参考图：${refUrls[0]}`)
    }
    context.push('请根据段落描述和已有的提示词，输出优化后的正向提示词和负向提示词。')
    context.push('格式要求：以 "正向：" 开头输出新的正向提示词，以 "负向：" 开头输出新的负向提示词。')
    context.push('提示词要求：中文描述为主，包含画面构图、光影、角色动作、背景细节、艺术风格。不少于60个中文字。')

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: context.join('\n'),
        section: 'storyboard',
        projectId: state.projectId,
      }),
    })
    const json = await res.json()
    const rawList = json.data?.storyboardSpecs || []
    const spec = rawList[0]
    if (!spec?.imagePrompt) {
      errors.value[idx] = 'AI 优化失败，请重试'
      return
    }

    // ⭐ 直接取 imagePrompt / negativePrompt，不再做 regex 解析
    prompts.value[idx] = spec.imagePrompt
    if (spec.negativePrompt) {
      negativePrompts.value[idx] = spec.negativePrompt
    }
  } catch (e: any) {
    errors.value[idx] = e.message || 'AI 优化失败'
  } finally {
    aiOptimizing.value[idx] = false
  }
}

// ─── 初始化 ───
onMounted(async () => {
  // onMounted 只做初始化，不阻塞渲染
  await loadSpecData()
  await loadExistingResults()
})

// 监听 store 数据变化：当 loadFromServer 完成后，重新加载 store 数据
watch(
  () => state.projectId,
  async (newPid, oldPid) => {
    if (newPid && newPid !== oldPid && state.workspace.segments.length > 0) {
      // loadFromServer 已执行，重新加载 store 数据
      initPrompts()
      loadExistingResultsFromStore()
      loading.value = false
    }
  }
)
</script>

<style scoped>
/* ── 全局容器 ── */
.sb-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #08080f;
}

/* ── 头部 ── */
.sb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid #1a1a2e;
  flex-shrink: 0;
}
.sb-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.sb-title {
  font-size: 15px;
  font-weight: 700;
  color: #e5e7eb;
  letter-spacing: 0.3px;
}
.sb-subtitle {
  font-size: 11px;
  color: #6b7280;
}
.sb-actions {
  display: flex;
  gap: 8px;
}
.sb-btn {
  font-size: 11px;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  font-weight: 500;
  transition: all 0.15s;
}
.sb-btn-gen {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
}
.sb-btn-gen:hover:not(:disabled) {
  opacity: 0.85;
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.3);
}
.sb-btn-gen:disabled {
  opacity: 0.4;
  cursor: default;
}
.sb-btn-next {
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff;
}
.sb-btn-next:hover {
  opacity: 0.85;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}
.sb-asset-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.sb-asset-btn {
  font-size: 9px;
  padding: 2px 6px;
  border: 1px solid #1f2937;
  border-radius: 4px;
  background: #0f0f1a;
  color: #9ca3af;
  cursor: pointer;
  white-space: nowrap;
}
.sb-asset-btn:hover {
  background: #1f2937;
  color: #e5e7eb;
}
.sb-selected-refs {
  margin-top: 6px;
  padding: 6px;
  background: #0a0a14;
  border: 1px solid #1f2937;
  border-radius: 6px;
}
.sb-selected-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.sb-selected-item {
  position: relative;
  width: 64px;
  height: 64px;
  border: 1px solid #374151;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sb-selected-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sb-selected-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 8px;
  background: rgba(0,0,0,0.7);
  color: #d1d5db;
  text-align: center;
  line-height: 1.4;
}
.sb-selected-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  background: rgba(0,0,0,0.6);
  color: #ef4444;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
}
.sb-selected-remove:hover {
  background: rgba(239,68,68,0.3);
}

/* ── 加载态 ── */
.sb-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 20px;
  font-size: 13px;
  color: #6b7280;
}
.sb-loading-spinner {
  font-size: 20px;
  animation: sb-spin 1s linear infinite;
}
@keyframes sb-spin {
  to { transform: rotate(360deg); }
}

/* ── 空态 ── */
.sb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  padding: 60px 20px;
}
.sb-empty-icon {
  font-size: 40px;
  opacity: 0.15;
}
.sb-empty-text {
  font-size: 13px;
  color: #4b5563;
}

/* ── 三列网格 ── */
.sb-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 20px 24px;
  align-content: start;
}

/* 响应式：小屏幕降为2列 */
@media (max-width: 1200px) {
  .sb-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 800px) {
  .sb-grid {
    grid-template-columns: 1fr;
  }
}

/* ── 卡片 ── */
.sb-card {
  position: relative;
  background: #0d0d1a;
  border: 1px solid #1a1a2e;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s;
}
.sb-card:hover {
  border-color: #2a2a44;
}

/* ── 卡片右上角生成按钮 ── */
.sb-card-gen-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #2a2a44;
  background: #1a1a2e;
  color: #a78bfa;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 2;
}
.sb-card-gen-btn:hover:not(:disabled) {
  background: #2a1a4e;
  border-color: #7c3aed;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.2);
}
.sb-card-gen-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── 段落名称 ── */
.sb-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
  padding-right: 36px;
  line-height: 1.4;
}

/* ── 段落全文 ── */
.sb-card-text {
  display: block;
  gap: 0;
}
.sb-full-text {
  font-size: 10.5px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
  overflow: visible;
  display: block;
  -webkit-line-clamp: unset;
  -webkit-box-orient: unset;
}
.sb-purpose-note {
  margin-top: 4px;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.5;
}
.sb-purpose-label {
  color: #9ca3af;
  font-weight: 500;
}

/* ── 下拉框样式 ── */
.sb-details {
  border: 1px solid #1f2937;
  border-radius: 6px;
  padding: 4px 8px;
  background: #0f0f1a;
}
.sb-details-summary {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  padding: 2px 0;
  user-select: none;
}
.sb-details[open] .sb-details-summary {
  margin-bottom: 6px;
}

/* ── 通用 section 标签 ── */
.sb-section-label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 4px;
}

/* ── 参考素材区 ── */
.sb-card-refs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sb-ref-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sb-ref-group-label {
  font-size: 10px;
  color: #8b5cf6;
  font-weight: 500;
}
.sb-ref-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sb-ref-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1.5px solid #1a1a2e;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: #0a0a14;
  min-width: 52px;
}
.sb-ref-item:hover {
  border-color: #3b82f6;
}
.sb-ref-item.selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.08);
  box-shadow: 0 0 0 1px #10b98144;
}
.sb-ref-thumb {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  object-fit: cover;
}
.sb-ref-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.sb-ref-name {
  font-size: 8.5px;
  color: #9ca3af;
  text-align: center;
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-ref-none {
  font-size: 10px;
  color: #374151;
  padding: 2px 0;
}

/* ── 提示词输入框 ── */
.sb-card-prompt {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sb-prompt-input {
  background: #0a0a12;
  border: 1px solid #1a1a2e;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 10px;
  color: #d1d5db;
  font-family: inherit;
  resize: vertical;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
}
.sb-prompt-input:focus {
  border-color: #3b82f6;
}
.sb-prompt-input.sb-negative {
  color: #fca5a5;
}
.sb-prompt-input::placeholder {
  color: #4b5563;
}

/* ── 生成结果 ── */
.sb-card-result {
  position: relative;
  margin-top: 2px;
  border: 1px solid #1a1a2e;
  border-radius: 6px;
  overflow: hidden;
  background: #0a0a12;
}
.sb-result-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(0,0,0,0.6);
  border: none;
  border-radius: 50%;
  color: #ef4444;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.15s;
}
.sb-result-close:hover {
  background: rgba(239, 68, 68, 0.6);
  color: #fff;
}
.sb-result-img {
  width: 100%;
  height: auto;
  display: block;
  cursor: pointer;
}

/* ── 错误信息 ── */
.sb-card-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 6px;
  font-size: 10px;
  color: #fca5a5;
}
.sb-error-close {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
}

/* ── 操作按钮区 ── */
.sb-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.sb-action-btn {
  flex: 1;
  font-size: 9.5px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  border: none;
  font-weight: 500;
  transition: all 0.15s;
  text-align: center;
}
.sb-action-optimize {
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.2);
}
.sb-action-optimize:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
}
.sb-action-gen {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}
.sb-action-gen:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}
.sb-action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── 图片预览覆盖层 ── */
.sb-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.sb-preview-img {
  max-width: 90vw;
  max-height: 85vh;
  border-radius: 8px;
  object-fit: contain;
}
.sb-preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.sb-preview-close:hover {
  background: rgba(239, 68, 68, 0.6);
}
</style>
