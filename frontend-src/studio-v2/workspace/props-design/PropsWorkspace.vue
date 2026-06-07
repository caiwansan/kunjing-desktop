<template>
  <div class="props-workspace">
    <!-- 顶部操作栏 -->
    <div class="workspace-toolbar">
      <div class="toolbar-title">道具设定 ({{ filteredProps.length }})</div>
      <div class="toolbar-actions">
        <button
          class="btn-primary"
          :disabled="!hasScript || generating"
          @click="aiExtractProps"
        >
          {{ generating ? '⏳ AI 提取中...' : '🤖 AI 智能提取' }}
        </button>
        <button
          class="btn-create"
          :disabled="generating"
          @click="addNewProp"
        >➕ 新建道具</button>
        <button
          v-if="filteredProps.length > 0"
          class="btn-next"
          @click="goToVideoGen"
        >下一步：视频生成 →</button>
      </div>
    </div>

    <div class="props-layout">
      <!-- 左侧分类筛选 -->
      <div class="props-sidebar">
        <div
          class="category-item"
          :class="{ active: activeCategory === 'all' }"
          @click="activeCategory = 'all'"
        >📦 全部 ({{ props.length }})</div>
        <div
          v-for="cat in categories"
          :key="cat"
          class="category-item"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >{{ categoryIcon(cat) }} {{ cat }} ({{ countByCategory(cat) }})</div>
      </div>

      <!-- 右侧道具列表 -->
      <div class="props-list">
        <div v-if="filteredProps.length === 0" class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-text">
            {{ generating ? '⏳ AI 正在分析剧本提取道具...' : '暂无道具，点击「AI 智能提取」从剧本中自动提取，或手动添加' }}
          </div>
        </div>

        <div
          v-for="(prop, idx) in filteredProps"
          :key="prop._key"
          class="prop-card"
          :class="{ active: editingIdx === realIndex(idx) }"
          @click="editingIdx = realIndex(idx)"
        >
          <!-- 道具预览图 -->
          <div class="prop-thumb" @click.stop>
            <img
              v-if="prop.whiteBgUrl || prop.imageUrl || prop.stageUrl"
              :src="prop.whiteBgUrl || prop.imageUrl || prop.stageUrl"
              class="prop-img"
              @click="previewUrl = prop.whiteBgUrl || prop.imageUrl || prop.stageUrl"
            />
            <div v-else class="prop-placeholder">{{ categoryIcon(prop.category) }}</div>
          </div>

          <div class="prop-info">
            <input
              class="prop-name-input"
              :value="prop.name"
              @input="updateField(realIndex(idx), 'name', $event)"
              placeholder="道具名称"
            />
            <div class="prop-category-tag">{{ categoryIcon(prop.category) }} {{ prop.category }}</div>
            <div class="prop-desc">{{ prop.description?.slice(0, 40) }}{{ (prop.description?.length || 0) > 40 ? '...' : '' }}</div>
            <div class="prop-assoc">
              <!-- 关联角色 -->
              <span v-if="prop.character" class="assoc-tag assoc-character" title="使用者">
                👤 {{ prop.character }}
              </span>
              <!-- 关联场景 -->
              <span v-if="prop.scene" class="assoc-tag assoc-scene" title="出现场景">
                🏙️ {{ prop.scene }}
              </span>
              <!-- 关联段落 -->
              <span v-if="prop.segment" class="assoc-tag assoc-segment" title="关联段落">
                🎞️ {{ prop.segment }}
              </span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="prop-actions">
            <button class="btn-icon" title="AI 优化" @click.stop="optimizeProp(realIndex(idx))">
              ✨
            </button>
            <button class="btn-icon" title="添加到素材库" @click.stop="addToAssetLibrary(realIndex(idx))">
              📦
            </button>
            <button class="btn-icon btn-icon-danger" title="删除" @click.stop="deleteProp(realIndex(idx))">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧详情编辑面板 -->
      <div v-if="editingProp" class="props-detail">
        <!-- 白底图 / 已有图片 -->
        <div v-if="editingProp.whiteBgUrl || editingProp.imageUrl || editingProp.stageUrl" class="detail-preview">
          <img :src="editingProp.whiteBgUrl || editingProp.imageUrl || editingProp.stageUrl" class="detail-img" @click="previewUrl = editingProp.whiteBgUrl || editingProp.imageUrl || editingProp.stageUrl" />
        </div>
        <div v-else class="detail-preview detail-preview-empty">
          <div class="empty-placeholder">🖼️ 暂无道具图片</div>
        </div>

        <!-- ⭐ 参考图上传 -->
        <div class="ref-section">
          <div class="ref-label">📎 参考图</div>
          <div class="ref-row">
            <div v-if="editingProp.referenceUrl" class="ref-thumb-wrap">
              <img :src="editingProp.referenceUrl" class="ref-thumb" @click="previewUrl = editingProp.referenceUrl" />
              <button class="btn-icon btn-icon-small" title="移除参考图" @click="updateField(editingIdx, 'referenceUrl', '')">✕</button>
            </div>
            <button class="btn-upload-ref" :disabled="uploadingRef" @click="openPropUpload(editingIdx)">
              {{ uploadingRef ? '⏳ 上传中...' : '📤 上传参考图' }}
            </button>
          </div>
        </div>
        <input ref="propFileInputRef" type="file" accept="image/*" style="display:none" @change="handlePropFileUpload" />

        <div class="detail-field">
          <label>道具名称</label>
          <input :value="editingProp.name" @input="updateField(editingIdx, 'name', $event)" placeholder="如：青铜古剑" />
        </div>

        <div class="detail-field">
          <label>描述（颜色/材质/样式/用途）</label>
          <textarea
            :value="editingProp.description"
            @input="updateField(editingIdx, 'description', $event)"
            :rows="3"
            placeholder="描述该道具的颜色、材质、样式、尺寸、时代风格、用途等"
          ></textarea>
        </div>

        <div class="detail-section-label">🖼️ 正面提示词（Prompt）</div>
        <div class="detail-field">
          <label>正面提示词</label>
          <textarea
            :value="editingProp.positivePrompt || ''"
            @input="updateField(editingIdx, 'positivePrompt', $event)"
            :rows="4"
            placeholder="描述道具外观的完整正面 prompt，包含款式、材质、颜色、光影、背景、风格等"
          ></textarea>
        </div>

        <div class="detail-field">
          <label>负面提示词</label>
          <textarea
            :value="editingProp.negativePrompt"
            @input="updateField(editingIdx, 'negativePrompt', $event)"
            :rows="2"
            placeholder="负面提示词"
          ></textarea>
        </div>

        <div class="detail-actions">
          <button
            class="btn-action"
            :disabled="optimizing[editingIdx]"
            @click="optimizeProp(editingIdx)"
          >
            {{ optimizing[editingIdx] ? '⏳ 优化中...' : '✨ AI 优化提示词' }}
          </button>
          <button
            class="btn-action"
            :disabled="generatingWhiteBg[editingIdx]"
            @click="generateWhiteBgImage(editingIdx)"
          >
            {{ generatingWhiteBg[editingIdx] ? '⏳ 生成中...' : '🖼️ 生成白底图' }}
          </button>
          <button
            class="btn-action"
            @click="addToAssetLibrary(editingIdx)"
          >
            📦 存入素材库
          </button>
        </div>
      </div>

      <div v-else-if="filteredProps.length > 0" class="props-detail empty-detail">
        <div class="empty-hint">请选择一个道具查看详情</div>
      </div>
    </div>

    <!-- 大图预览弹窗 -->
    <Transition name="fade">
      <div v-if="previewUrl" class="preview-overlay" @click.self="previewUrl = ''">
        <div class="preview-container">
          <button class="preview-close" @click="previewUrl = ''">✕</button>
          <img :src="previewUrl" class="preview-image" @click.stop />
          <div class="preview-actions">
            <button class="preview-select" @click="selectFromPreview">📂 存入素材库</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ====== 音色生成区域（在道具设定页面最下方） ====== -->
    <div class="voice-generation-area">
      <div class="voice-section-title">🎤 音色生成（为每个角色选择音色并生成配音）</div>
      <div v-if="voiceCharacters.length === 0" class="ref-empty">暂无角色数据，请先在角色设定页面创建角色</div>
      <div v-else class="voice-card-grid">
        <div v-for="(char, ci) in voiceCharacters" :key="char.name || ci" class="voice-card">
          <div class="voice-card-header">
            <span class="voice-char-name">{{ char.name || `角色 ${ci + 1}` }}</span>
            <span class="voice-char-desc">{{ char.voiceType || char.voiceDescription || '待选择音色' }}</span>
            <span v-if="voiceDataMap[char.name]?.duration" class="voice-char-duration">时长 {{ voiceDataMap[char.name].duration }}s</span>
          </div>
          <div class="voice-actions">
            <select v-model="selectedVoice[char.name]" class="voice-select">
              <option value="" disabled>— 选择音色 —</option>
              <optgroup label="🎤 通用">
                <option v-for="v in basicVoices" :key="v.id" :value="v.id">{{ v.name }}（{{ v.provider }}）</option>
              </optgroup>
              <optgroup v-if="maleVoices.length" label="👨 男声">
                <option v-for="v in maleVoices" :key="v.id" :value="v.id">{{ v.name }}（{{ v.provider }}）</option>
              </optgroup>
              <optgroup v-if="femaleVoices.length" label="👩 女声">
                <option v-for="v in femaleVoices" :key="v.id" :value="v.id">{{ v.name }}（{{ v.provider }}）</option>
              </optgroup>
            </select>
            <button
              class="btn-generate-voice"
              :disabled="generatingVoice[char.name] || !selectedVoice[char.name]"
              @click="generateVoiceForCharacter(char)"
            >
              {{ generatingVoice[char.name] ? '⏳ 生成中…' : '🎤 生成音色' }}
            </button>
            <div v-if="voiceDataMap[char.name]?.url" class="voice-result">
              <audio :src="voiceDataMap[char.name].url" controls class="voice-player"></audio>
              <button class="btn-voice-delete" title="删除音色" @click="deleteVoice(char.name)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const { state, goToStage } = useStudioStore()

// ─── Token helper ───
function getAuthToken(): string {
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return _gt()
  } catch { return '' }
}

// ─── Types ───

interface PropItem {
  _key: string
  name: string
  category: string
  description: string
  imagePrompt: Record<string, string>
  positivePrompt: string
  negativePrompt: string
  stageUrl: string   // 剧中形象（带场景/角色全身图）
  whiteBgUrl: string // 白底产品图
  imageUrl: string   // 兼容旧字段
  referenceUrl: string // 上传的参考图
  character: string
  scene: string
  segment: string
  scenes: string[]
}

const PROMPT_FIELDS = ['款式描述', '材质', '颜色', '光影', '背景', '负面内容', '画幅', '风格关键词']
const ALL_CATEGORIES = ['武器', '坐骑', '服装', '鞋子', '餐具', '菜肴', '农具', '首饰', '装饰品', '汽车', '飞机', '火车', '轮船', '摩托车', '电动车', '眼镜', '花卉', '绿植', '家电', '厨具', '电器', '其他']

// ─── State ───

const props = ref<PropItem[]>([])
const generating = ref(false)
const editingIdx = ref(-1)
const activeCategory = ref<string>('all')
const generatingStage = ref<Record<number, boolean>>({})
const generatingWhiteBg = ref<Record<number, boolean>>({})
const optimizing = ref<Record<number, boolean>>({})
const previewUrl = ref('')

// ─── 音色生成状态 ───
const generatingVoice = reactive<Record<string, boolean>>({})
// 每个角色选择的音色 ID
const selectedVoice = reactive<Record<string, string>>({})
// 音色数据（持久化，从后端加载）
const voiceDataMap = reactive<Record<string, { url: string; duration: number }>>({})

// ─── 音色预设列表（与后端 /api/tts/voices 同步） ───
interface VoicePreset { id: string; name: string; gender: string; provider: string }
const allVoices = ref<VoicePreset[]>([])

// 按性别和类型分类
const basicVoices = computed(() => allVoices.value.filter(v => v.provider === 'siliconflow' || v.provider === 'aliyun'))
const maleVoices = computed(() => allVoices.value.filter(v => v.gender === 'male' && !['siliconflow','aliyun'].includes(v.provider)))
const femaleVoices = computed(() => allVoices.value.filter(v => v.gender === 'female' && !['siliconflow','aliyun'].includes(v.provider)))

/** 加载音色预设列表 */
async function loadVoicePresets() {
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/tts/voices', { headers })
    if (!res.ok) return
    const json = await res.json()
    if (json.success && json.voices?.length) {
      allVoices.value = json.voices
    }
  } catch {}
}

// ─── Derived ───

const hasScript = computed(() => !!(state.workspace?.narrative?.script || '').trim())

const characterNames = computed(() => {
  return (state.workspace?.characters || []).map((c: any) => c.name || c.characterName || '').filter(Boolean)
})

const sceneNames = computed(() => {
  return (state.workspace?.scenes || []).map((s: any) => s.name || s.sceneName || '').filter(Boolean)
})

const categories = computed(() => {
  const set = new Set(props.value.map(p => p.category).filter(Boolean))
  return [...set].sort()
})

const filteredProps = computed(() => {
  if (activeCategory.value === 'all') return props.value
  return props.value.filter(p => p.category === activeCategory.value)
})

const editingProp = computed(() => {
  if (editingIdx.value < 0 || editingIdx.value >= props.value.length) return null
  return props.value[editingIdx.value]
})

// ─── 音色：所有角色列表（来自 store，去重，合并拆解 agent 音色资料） ───
const voiceCharacters = computed(() => {
  // 从 narrative.voices 建立角色名→音色信息的映射
  const voiceMap: Record<string, any> = {}
  const voices = state.workspace?.narrative?.voices || []
  for (const v of voices) {
    const key = v.characterName || ''
    if (key) voiceMap[key] = v
  }
  // 从 narrative.characters 也有 voiceType，一并建立
  const narrChars = state.workspace?.narrative?.characters || []
  for (const nc of narrChars) {
    const key = nc.name || ''
    if (key && nc.voiceType) {
      if (!voiceMap[key]) voiceMap[key] = {}
      voiceMap[key].voiceType = nc.voiceType
    }
  }
  const seen = new Set<string>()
  return (state.workspace?.characters || []).map((c: any) => {
    const key = c.name || c.characterName || ''
    if (!key) return null
    if (seen.has(key)) return null
    seen.add(key)
    // 合并音色资料到角色对象
    const voiceInfo = voiceMap[key]
    if (voiceInfo) {
      c.ttsPrompt = c.ttsPrompt || voiceInfo.ttsPrompt || voiceInfo.description || ''
      c.voiceType = c.voiceType || voiceInfo.voiceType || ''
      c.voiceDescription = c.voiceDescription || [
        voiceInfo.speakingStyle || '',
        voiceInfo.pitch ? `音高${voiceInfo.pitch}` : '',
        voiceInfo.speed ? `语速${voiceInfo.speed}` : '',
      ].filter(Boolean).join(' · ') || ''
    }
    return c
  }).filter(Boolean)
})

const allCategories = ALL_CATEGORIES

// ─── Helpers ───

function realIndex(listIdx: number): number {
  if (activeCategory.value === 'all') return listIdx
  return props.value.indexOf(filteredProps.value[listIdx])
}

function countByCategory(cat: string): number {
  return props.value.filter(p => p.category === cat).length
}

function categoryIcon(cat: string): string {
  const icons: Record<string, string> = {
    '武器': '⚔️', '坐骑': '🐎', '服装': '👘', '鞋子': '👢',
    '餐具': '🍴', '菜肴': '🍲', '农具': '🔧', '首饰': '💎',
    '装饰品': '🏺', '汽车': '🚗', '飞机': '✈️', '火车': '🚂',
    '轮船': '🚢', '摩托车': '🏍️', '电动车': '🛵', '眼镜': '👓',
    '花卉': '🌸', '绿植': '🌿', '家电': '📺', '厨具': '🔪',
    '电器': '💻', '其他': '📦',
  }
  return icons[cat] || '📦'
}

function genKey(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ─── Methods ───

function addNewProp() {
  const item: PropItem = {
    _key: genKey(),
    name: '',
    category: '',
    description: '',
    imagePrompt: {},
    positivePrompt: '',
    negativePrompt: '',
    stageUrl: '',
    whiteBgUrl: '',
    imageUrl: '',
    referenceUrl: '',
    character: '',
    scene: '',
    segment: '',
    scenes: [],
  }
  props.value.push(item)
  editingIdx.value = props.value.length - 1
  activeCategory.value = 'all'
}

function deleteProp(idx: number) {
  props.value.splice(idx, 1)
  if (editingIdx.value === idx) editingIdx.value = -1
  else if (editingIdx.value > idx) editingIdx.value--
}

function updateField(idx: number, field: string, val: any) {
  if (idx < 0 || idx >= props.value.length) return
  ;(props.value[idx] as any)[field] = val?.target?.value ?? val
  // trigger reactivity
  props.value = [...props.value]
}

function updatePromptField(idx: number, key: string, e: any) {
  if (idx < 0 || idx >= props.value.length) return
  const p = props.value[idx]
  if (!p.imagePrompt) p.imagePrompt = {}
  p.imagePrompt[key] = e.target.value
  props.value = [...props.value]
}

// ⭐ 上传参考图
const propFileInputRef = ref<HTMLInputElement | null>(null)
const uploadingRef = ref(false)
const uploadPropIdx = ref(-1)

function openPropUpload(idx: number) {
  uploadPropIdx.value = idx
  propFileInputRef.value?.click()
}

async function handlePropFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file || uploadPropIdx.value < 0) return

  uploadingRef.value = true
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('type', 'prop')
  formData.append('name', props.value[uploadPropIdx.value]?.name || '')

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = 'Bearer ' + token

    const res = await fetch('/api/v2/workbench/upload-reference', {
      method: 'POST',
      headers,
      body: formData,
    })
    const json = await res.json()
    if (json.success && json.data?.url) {
      updateField(uploadPropIdx.value, 'referenceUrl', json.data.url)
    } else {
      alert('上传失败: ' + (json.error || '未知错误'))
    }
  } catch (err: any) {
    alert('上传出错: ' + err.message)
  } finally {
    uploadingRef.value = false
    // 清空 input 以便重复选择同一文件
    if (input) input.value = ''
  }
}

// ⭐ AI 从剧本提取道具
async function aiExtractProps() {
  if (generating.value) return
  generating.value = true
  try {
    const script = state.workspace?.narrative?.script || ''
    const token = getAuthToken()

    // 收集已有角色/场景作为 context
    const existingSpec: any = {}
    const chars = (state.workspace?.characters || []).map((c: any) => ({
      characterName: c.name || c.characterName,
    })).filter((c: any) => c.characterName)
    const scenes = (state.workspace?.scenes || []).map((s: any) => ({
      sceneName: s.name || s.sceneName,
    })).filter((s: any) => s.sceneName)
    if (chars.length) existingSpec.characterSpecs = chars
    if (scenes.length) existingSpec.sceneSpecs = scenes

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: script,
        section: 'props',
        existingSpec,
      }),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'AI 提取失败')

    const rawList = json.data?.propSpecs || json.data?.props || []
    if (rawList.length === 0) throw new Error('未提取到道具')

    props.value = rawList.map((r: any) => ({
      _key: genKey(),
      name: r.name || r.propName || '',
      category: r.category || '',
      description: r.description || '',
      imagePrompt: r.imagePrompt || {},
      positivePrompt: r.positivePrompt || '',
      negativePrompt: r.negativePrompt || '',
      stageUrl: r.stageUrl || '',
      whiteBgUrl: r.whiteBgUrl || r.imageUrl || '',
      imageUrl: r.imageUrl || '',
      character: r.character || r.characterName || '',
      scene: r.scene || r.sceneName || (r.scenes?.[0]) || '',
      segment: r.segment || '',
      scenes: r.scenes || [],
    }))
    editingIdx.value = 0
    activeCategory.value = 'all'
  } catch (err: any) {
    alert('AI 提取失败: ' + err.message)
  } finally {
    generating.value = false
  }
}

// ⭐ AI 优化单个道具 prompt（参考场景优化模式）
async function optimizeProp(idx: number) {
  if (idx < 0 || idx >= props.value.length) return
  optimizing.value[idx] = true
  // ⭐清除旧优化结果（保留用户输入的 description）
  const p = props.value[idx]
  if (p) {
    p.imagePrompt = {}
    p.positivePrompt = ''
    p.negativePrompt = ''
  }
  try {
    const p = props.value[idx]
    const token = getAuthToken()
    const pid = state.projectId
    const storyText = localStorage.getItem('studio_v2_script') || state.workspace?.narrative?.script || ''
    // 把现有道具列表传进去
    const existingPropSpecs = props.value.map(sp => ({
      name: sp.name,
      category: sp.category,
      description: sp.description,
      imagePrompt: typeof sp.imagePrompt === 'object' ? sp.imagePrompt : {},
    }))
    // 收集已有的角色/场景作为上下文
    const existingSpec: any = { propSpecs: existingPropSpecs }
    const chars = (state.workspace?.characters || []).map((c: any) => ({
      characterName: c.name || c.characterName,
    })).filter((c: any) => c.characterName)
    const scenes = (state.workspace?.scenes || []).map((s: any) => ({
      sceneName: s.name || s.sceneName,
    })).filter((s: any) => s.sceneName)
    if (chars.length) existingSpec.characterSpecs = chars
    if (scenes.length) existingSpec.sceneSpecs = scenes

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: storyText,
        section: 'props',
        projectId: pid,
        existingSpec,
      }),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '优化失败')

    const list = json.data?.propSpecs || json.data?.props || []
    if (list.length > 0) {
      // 找名字匹配的
      const match = list.find((x: any) => x.name === p.name) || list[0]
      if (match.imagePrompt) {
        p.imagePrompt = match.imagePrompt
        if (typeof match.imagePrompt === 'object') {
          const parts = Object.entries(match.imagePrompt as Record<string, string>)
            .filter(([_, v]) => v)
            .map(([k, v]) => `[${k}]: ${v}`)
          if (parts.length > 0) p.positivePrompt = parts.join('\n')
        }
      }
      if (match.positivePrompt) p.positivePrompt = match.positivePrompt
      if (match.negativePrompt) p.negativePrompt = match.negativePrompt
      if (match.description) p.description = match.description
      props.value = [...props.value]
    }
  } catch (err: any) {
    alert('AI 优化失败: ' + err.message)
  } finally {
    optimizing.value[idx] = false
  }
}

// ⭐ 构建 prompt 文本（通用）
function buildPromptText(p: PropItem): string {
  let promptText = p.positivePrompt?.trim()
  if (!promptText) {
    if (p.imagePrompt && Object.keys(p.imagePrompt).length > 0) {
      promptText = Object.entries(p.imagePrompt)
        .map(([k, v]) => `[${k}]: ${v}`)
        .join('\n')
    } else {
      promptText = `[商品]: ${p.name}\n[描述]: ${p.description}\n[风格]: 电商白底图，产品摄影，4K高清`
    }
  }
  return promptText
}

// ⭐ [已移除] 生成剧中形象（带场景/角色的全身图）— 功能已去除
async function generateStageImage(_idx: number) {/* 已移除 */}

// ⭐ 生成白底道具图
async function generateWhiteBgImage(idx: number) {
  if (idx < 0 || idx >= props.value.length) return
  generatingWhiteBg.value[idx] = true
  try {
    const p = props.value[idx]
    const token = getAuthToken()

    const promptText = buildPromptText(p)

    const res = await fetch('/api/v1/aigc-spec/generate-prop-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt: promptText,
        isStageImage: false,
        negativePrompt: p.negativePrompt || '人物, 模特, 手, 人体部位, 文字以外文字, 水印, 任何人, 阴影',
        projectId: state.projectId,
        propKey: p._key,
      }),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '生成失败')

    if (json.data?.imageUrl) {
      p.whiteBgUrl = json.data.imageUrl
      p.imageUrl = json.data.imageUrl
      props.value = [...props.value]
      savePropImageToProject({ ...p, imageUrl: p.whiteBgUrl })
    }
  } catch (err: any) {
    alert('生成白底图失败: ' + err.message)
  } finally {
    generatingWhiteBg.value[idx] = false
  }
}

// ⭐ 保存道具图片到项目
async function savePropImageToProject(p: any, imageType?: string) {
  if (!state.projectId || !p.imageUrl) return
  try {
    const token = getAuthToken()
    // 通过 save-image 接口保存到 COS（prop 类型）
    const cosRes = await fetch(`/api/v2/workbench/project/${state.projectId}/save-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        sourceUrl: p.imageUrl,
        propName: p.name,
        category: p.category,
        description: p.description,
        imagePrompt: p.imagePrompt,
      }),
    })
    if (cosRes.ok) {
      const cosJson = await cosRes.json()
      if (cosJson.data?.cosUrl) {
        p.imageUrl = cosJson.data.cosUrl
        props.value = [...props.value]
      }
    }
    // 存到素材库
    addPropToAssetLibrary(p)
  } catch (err: any) {
    console.warn('[Props] 保存道具图到项目失败:', err.message)
    // 即使保存失败，本地素材库照存
    addPropToAssetLibrary(p)
  }
}

// ⭐ 存入素材库（道具专用）
function addPropToAssetLibrary(p: any) {
  // 使用白底图作为素材库预览
  const thumbnailUrl = p.whiteBgUrl || p.imageUrl || p.stageUrl || ''
  // 去重：更新已有 asset 或新增
  const existingIdx = state.assets.assets.findIndex(a => a.id === p._key || (a.tags.includes('prop') && a.name === p.name))
  const asset = {
    id: p._key,
    type: 'prop' as const,
    name: p.name || '未命名道具',
    thumbnail: thumbnailUrl,
    url: thumbnailUrl,
    prompt: p.description || undefined,
    tags: ['prop', p.category, p.character, p.scene].filter(Boolean) as string[],
    version: 1,
    createdAt: new Date().toISOString(),
    metadata: {
      category: p.category,
      character: p.character,
      scene: p.scene,
      imagePrompt: p.imagePrompt,
    },
  }
  if (existingIdx >= 0) {
    // 更新已有 asset
    state.assets.assets[existingIdx] = { ...state.assets.assets[existingIdx], ...asset }
  } else {
    state.assets.assets.push(asset)
  }
  alert(`✅ 道具「${p.name}」已存入素材库`)
}

// ⭐ 存入素材库（手动调用）
function addToAssetLibrary(idx: number) {
  if (idx < 0 || idx >= props.value.length) return
  const p = props.value[idx]
  if (p.imageUrl) {
    savePropImageToProject(p)
  } else {
    addPropToAssetLibrary(p)
  }
}

function selectFromPreview() {
  if (!previewUrl.value) return
  // 找到当前编辑的道具，存入素材库
  if (editingIdx.value >= 0 && editingIdx.value < props.value.length) {
    addToAssetLibrary(editingIdx.value)
  }
  previewUrl.value = ''
}

function goToVideoGen() {
  goToStage('video-generation')
}

// ⭐ 从 store 读取道具数据（computed，类似 Storyboard 的改造方式）
const storeProps = computed(() => {
  return (state.workspace?.narrative?.props || []).map((p: any) => ({
    _key: p.id || genKey(),
    name: p.name || '',
    category: p.category || '',
    description: p.description || '',
    imagePrompt: p.imagePrompt || {},
    positivePrompt: p.positivePrompt || '',
    negativePrompt: p.negativePrompt || '',
    stageUrl: p.stageUrl || '',
    whiteBgUrl: p.imageUrl || '',
    imageUrl: p.imageUrl || '',
    referenceUrl: p.referenceUrl || '',
    character: p.character || p.characterName || '',
    scene: p.scene || p.sceneName || (p.scenes?.[0]) || '',
    segment: p.segment || '',
    scenes: p.scenes || [],
  }))
})

// ─── 加载已有道具数据（优先从 store，fallback 到 API） ───

async function loadExistingProps() {
  // ✅ 优先从 store 的 narrative.props 读取
  if (state.workspace?.narrative?.props?.length > 0) {
    props.value = storeProps.value
    return
  }

  // ⭐ 第二优先级：从 aigc-spec/load API 读取（持久化的 propImages）
  if (state.projectId) {
    try {
      const token = getAuthToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/aigc-spec/${state.projectId}/load`, { headers })
      if (res.ok) {
        const json = await res.json()
        const propImages = json.propImages || []
        const propSpecs = json.propSpecs || []
        // 建立 propName → character 映射
        const charMap = new Map<string, string>()
        for (const ps of propSpecs) {
          const key = ps.name || ''
          if (key) {
            const ch = ps.character || (Array.isArray(ps.character_names) ? ps.character_names.join(', ') : '') || ''
            if (ch) charMap.set(key, ch)
          }
        }
        if (propImages.length > 0) {
          props.value = propImages.map((p: any) => ({
            _key: p.id || genKey(),
            name: p.propName || '',
            category: p.category || '',
            description: p.description || '',
            imagePrompt: p.imagePrompt ? (typeof p.imagePrompt === 'string' ? {} : p.imagePrompt) : {},
            positivePrompt: '',
            negativePrompt: p.negativePrompt || '',
            stageUrl: '',
            whiteBgUrl: p.imageUrl || '',
            imageUrl: p.imageUrl || '',
            referenceUrl: p.referenceUrl || '',
            character: charMap.get(p.propName) || '',
            scene: '',
            segment: '',
            scenes: [],
          }))
          return
        }
      }
    } catch {}
  }

  // ⭐ Fallback：从 API executionResults 读取
  if (!state.projectId) return
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/v2/workbench/project/${state.projectId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return
    const json = await res.json()
    const execData = json.data?.executionResults || json.executionResults
    if (!execData) return
    const existingProps = execData.propSpecs || execData.props
    if (Array.isArray(existingProps) && existingProps.length > 0) {
      props.value = existingProps.map((r: any) => ({
        _key: genKey(),
        name: r.name || r.propName || '',
        category: r.category || '',
        description: r.description || '',
        imagePrompt: r.imagePrompt || {},
        positivePrompt: r.positivePrompt || '',
        negativePrompt: r.negativePrompt || '',
        stageUrl: r.stageUrl || '',
        whiteBgUrl: r.imageUrl || '',
        imageUrl: r.imageUrl || '',
        referenceUrl: r.referenceUrl || '',
        character: r.character || r.characterName || '',
        scene: r.scene || r.sceneName || (r.scenes?.[0]) || '',
        segment: r.segment || '',
        scenes: r.scenes || [],
      }))
    }
  } catch {}
}

onMounted(() => {
  loadExistingProps()
  loadVoicePresets()
  loadVoiceRecords()
})

// ====== 音色持久化相关 ======

/** 从后端加载已保存的音色记录 */
async function loadVoiceRecords() {
  if (!state.projectId) return
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/voice/records?projectId=${state.projectId}`, { headers })
    if (!res.ok) return
    const json = await res.json()
    if (json.success && json.data?.length) {
      for (const record of json.data) {
        voiceDataMap[record.characterName] = {
          url: (record.audioUrl || '').replace(/^http:\/\//i, 'https://'),
          duration: record.duration || 0,
        }
      }
    }
  } catch (err) {
    console.warn('[loadVoiceRecords] 加载音色记录失败:', err)
  }
}

/** 生成角色音色 */
async function generateVoiceForCharacter(char: any) {
  const charName = char.name || ''
  if (!charName || generatingVoice[charName]) return
  generatingVoice[charName] = true
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // 用用户选择的音色，未选则根据角色性别智能推荐
    const chosenVoice = selectedVoice[charName] || (char.gender === '男' ? 'zh_male_deep' : 'zh_female_warm')

    // 从拆解结果中取该角色的第一段台词作为 TTS 朗读文本
    const dialogues = state.workspace?.narrative?.dialogues || []
    const charDialogue = dialogues.find((d: any) => {
      const dName = d.characterName || ''
      return dName === charName || dName === (char.characterName || '')
    })
    const ttsText = charDialogue?.dialogue || `我是${charName}，让我来介绍一下自己。`
    if (!ttsText || ttsText.length < 3) {
      console.warn('[generateVoice] 台词不足，跳过')
      return
    }

    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: state.projectId,
        taskType: 'tts',
        input: {
          characterName: charName,
          text: ttsText,
          voiceType: char.voiceType || '',
          voiceId: chosenVoice,
          source: 'voice',
        },
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[generateVoice] 音色生成失败:', res.status, errText)
      return
    }
    const json = await res.json()
    if (!json.success) {
      console.warn('[generateVoice] AI generate 失败:', json.error)
      return
    }
    const taskId = json.task?.id || json.data?.taskId
    if (!taskId) return
    // 轮询结果（最多 30 秒）
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const pollRes = await fetch(`/api/tasks/${taskId}/status`, { headers })
      if (!pollRes.ok) continue
      const poll = await pollRes.json()
      if (!poll.success || !poll.task) continue
      if (poll.task.status === 'completed' || poll.task.status === 'success') {
        const result = poll.task.result
        const url = result?.url || result?.audioUrl || ''
        const duration = result?.duration || 0
        if (url) {
          voiceDataMap[charName] = { url: url.replace(/^http:\/\//i, 'https://'), duration }
          // 持久化到后端
          await fetch('/api/voice/records/save', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              projectId: state.projectId,
              characterName: charName,
              audioUrl: url,
              voiceId: char.voiceId || '',
              duration: duration,
            }),
          })
          // 同步到 store.workspace.voices（视频生成页面可从 store 获取音色文件）
          const existingVoices = state.workspace?.voices || []
          const existingIdx = existingVoices.findIndex((v: any) => (v.characterName || '') === charName)
          const voiceEntry = { characterName: charName, url: url.replace(/^http:\/\//i, 'https://'), duration }
          if (existingIdx >= 0) {
            existingVoices[existingIdx] = { ...existingVoices[existingIdx], ...voiceEntry }
          } else {
            existingVoices.push(voiceEntry)
          }
          state.workspace.voices = [...existingVoices]
        }
        break
      }
      if (poll.task.status === 'failed' || poll.task.status === 'error') break
    }
  } catch (err) {
    console.warn('[generateVoice] error:', err)
  } finally {
    generatingVoice[charName] = false
  }
}

/** 删除角色音色 */
async function deleteVoice(charName: string) {
  if (!state.projectId || !voiceDataMap[charName]) return
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    await fetch(`/api/voice/records/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: state.projectId,
        characterName: charName,
        audioUrl: '',
        voiceId: '',
        duration: 0,
      }),
    })
    delete voiceDataMap[charName]
  } catch (err) {
    console.warn('[deleteVoice] error:', err)
  }
}

</script>

<style scoped>
/* ─── Layout ─── */
.props-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #2a2a3e;
  background: #181825;
  gap: 10px;
  flex-shrink: 0;
}
.toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.props-layout {
  display: grid;
  grid-template-columns: 140px 1fr 360px;
  flex: 1;
  overflow: hidden;
}

/* ─── Sidebar ─── */
.props-sidebar {
  border-right: 1px solid #2a2a3e;
  padding: 8px;
  overflow-y: auto;
  background: #1a1a2e;
}
.category-item {
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 2px;
  transition: all 0.15s;
}
.category-item:hover { background: #252540; color: #e2e8f0; }
.category-item.active { background: #2d2d50; color: #f1f5f9; font-weight: 500; }

/* ─── List ─── */
.props-list {
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #16162a;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 40px;
}
.empty-icon { font-size: 40px; opacity: 0.25; }
.empty-text { font-size: 12px; color: #6b7280; text-align: center; max-width: 300px; line-height: 1.5; }

.prop-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1e1e36;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.prop-card:hover { background: #252545; }
.prop-card.active { border-color: #6366f1; background: #2a2a50; }
.prop-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: #2a2a3e;
  display: flex;
  align-items: center;
  justify-content: center;
}
.prop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.prop-placeholder { font-size: 20px; opacity: 0.4; }
.prop-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prop-name-input {
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 500;
  width: 100%;
  outline: none;
}
.prop-name-input:focus { color: #a5b4fc; }
.prop-category-tag {
  font-size: 10px;
  color: #818cf8;
}
.prop-desc {
  font-size: 10px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prop-assoc { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.assoc-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-block;
}
.assoc-character { background: #312e81; color: #c7d2fe; }
.assoc-scene { background: #1e3a5f; color: #93c5fd; }
.assoc-segment { background: #3b1f4e; color: #d8b4fe; }

/* ─── Actions ─── */
.prop-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.btn-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s;
}
.btn-icon:hover { background: #33335a; }
.btn-icon-danger:hover { background: #5c1a1a; }

/* ─── Detail ─── */
.props-detail {
  border-left: 1px solid #2a2a3e;
  padding: 14px;
  overflow-y: auto;
  background: #181825;
}
.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-hint { font-size: 12px; color: #4b5563; }
.detail-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-height: 220px;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e36;
  margin-bottom: 12px;
}
.detail-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}
.regen-img-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0,0,0,0.6);
  border-radius: 6px;
  width: 28px;
  height: 28px;
}
.detail-field {
  margin-bottom: 10px;
}
.detail-field label {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-field input,
.detail-field textarea,
.detail-field select {
  width: 100%;
  background: #1e1e36;
  border: 1px solid #2a2a3e;
  border-radius: 6px;
  padding: 6px 8px;
  color: #e2e8f0;
  font-size: 12px;
  outline: none;
}
.detail-field input:focus,
.detail-field textarea:focus,
.detail-field select:focus { border-color: #6366f1; }
.detail-field textarea { resize: vertical; min-height: 48px; }
.detail-section-label {
  font-size: 11px;
  color: #a5b4fc;
  font-weight: 500;
  margin: 14px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #2a2a3e;
}
.detail-actions {
  display: flex;
  gap: 6px;
  margin-top: 14px;
  flex-wrap: wrap;
}

/* ─── Association Selector ─── */
.assoc-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.assoc-btn {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid #333;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.assoc-btn:hover { border-color: #6366f1; color: #c7d2fe; }
.assoc-btn.selected { background: #312e81; border-color: #6366f1; color: #e0e7ff; }

/* ─── Preview Overlay ─── */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}
.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  border-radius: 8px;
  object-fit: contain;
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
}
.preview-actions {
  position: absolute;
  bottom: -36px;
  left: 50%;
  transform: translateX(-50%);
}
.preview-select {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 12px;
}

/* ─── Common Buttons ─── */
.btn-primary, .btn-create, .btn-next {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-primary { background: #6366f1; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-create { background: #1e3a5f; color: #93c5fd; }
.btn-create:hover { background: #1e40af; }
.btn-next { background: #059669; color: #fff; }
.btn-next:hover { background: #047857; }
.btn-action {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #333;
  background: transparent;
  color: #c7d2fe;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-action:hover:not(:disabled) { background: #2a2a50; border-color: #6366f1; }
.btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ⭐ 参考图上传 */
.ref-section { margin: 8px 0; }
.ref-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
.ref-row { display: flex; align-items: center; gap: 8px; }
.ref-thumb-wrap { position: relative; width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid #333; flex-shrink: 0; }
.ref-thumb { width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
.ref-thumb-wrap .btn-icon-small {
  position: absolute; top: -4px; right: -4px;
  width: 18px; height: 18px; font-size: 10px;
  background: rgba(0,0,0,0.7); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border: none; color: #fff;
}
.btn-upload-ref {
  font-size: 11px; padding: 4px 10px;
  border: 1px dashed #555; border-radius: 6px;
  background: transparent; color: #93c5fd; cursor: pointer;
  transition: all 0.15s;
}
.btn-upload-ref:hover:not(:disabled) { background: #1e3a5f; border-color: #6366f1; }
.btn-upload-ref:disabled { opacity: 0.4; cursor: not-allowed; }

.voice-generation-area {
  padding: 12px 16px;
  border-top: 1px solid #2a2a3e;
  background: #141428;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
}
.voice-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #10b981;
  padding: 4px 0;
  flex-shrink: 0;
}
/* ⭐ 角色音色卡片网格：每排 2 个，超出滚动 */
.voice-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
}
.voice-card {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 10px;
}
.voice-card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}
.voice-char-name {
  font-size: 12px;
  font-weight: 600;
  color: #d1d5db;
}
.voice-char-desc {
  font-size: 10px;
  color: #6b7280;
}
.voice-char-duration {
  font-size: 9px;
  color: #4b5563;
}
.voice-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-generate-voice {
  background: #1a1a3a;
  border: 1px solid #2a2a4a;
  color: #818cf8;
  font-size: 11px;
  padding: 5px 12px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.btn-generate-voice:hover:not(:disabled) { background: #22224a; }
.btn-generate-voice:disabled { opacity: 0.5; cursor: not-allowed; }
.voice-select {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  color: #d1d5db;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
  min-width: 130px;
  cursor: pointer;
  outline: none;
}
.voice-select:focus {
  border-color: #818cf8;
}
.voice-select optgroup {
  color: #9ca3af;
  font-size: 10px;
}
.voice-select option {
  color: #d1d5db;
  background: #1a1a2e;
}
.voice-result {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.voice-player {
  height: 30px;
  width: 100%;
  max-width: 220px;
}
.btn-voice-delete {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
}
.btn-voice-delete:hover { background: #5c1a1a; }

.ref-empty {
  font-size: 11px;
  color: #6b7280;
  padding: 4px 0;
}
</style>
