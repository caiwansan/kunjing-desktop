<template>
  <div class="character-workspace">
    <div class="workspace-toolbar">
      <div class="toolbar-title">角色圣经 ({{ count }})</div>
      <div class="toolbar-actions">
        <button class="btn-action" :disabled="characters.length === 0 || optimizingAll" @click="optimizeAll">
          ✨ {{ optimizingAll ? '优化中...' : '全部 AI 优化' }}
        </button>
        <label class="triple-view-toggle" title="启用三视图生成（正面+侧面+背面，自动合并为三视定妆图）">
          <input type="checkbox" v-model="tripleViewMode" /> 📐 三视定妆
        </label>
        <button class="btn-primary" :disabled="characters.length === 0 || generating" @click="generateAllChars">
          {{ generating ? '⏳ 生成中...' : '🎨 全部生成角色图' }}
        </button>
        <button v-if="characters.length > 0" class="btn-next" @click="goToSceneDesign">
          下一步：场景设定 →
        </button>
        <button class="btn-create" @click="createNewChar">➕ 新建角色</button>
      </div>
    </div>

    <div class="character-layout">
      <!-- 左侧角色列表 -->
      <div class="character-list">
        <div v-if="characters.length === 0" class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-text">暂无角色，请先完成剧本分析或点击"新建角色"</div>
        </div>
        <div
          v-for="ch in characters"
          :key="ch.id"
          class="character-card"
          :class="{ active: selectedId === ch.id }"
          @click="selectedId = ch.id"
        >
          <div class="card-avatar-wrap">
            <div class="card-avatar" v-if="!charImages[ch.id] && !ch.imageUrl" :style="avatarStyle(ch)">{{ ch.name[0] || '?' }}</div>
            <img v-else class="card-avatar-img" :src="charImages[ch.id] || ch.imageUrl" />
            <!-- 参考图缩略图（如果有且与生成图片不同） -->
            <div v-if="refImageUrls[ch.id] && refImageUrls[ch.id] !== (charImages[ch.id] || ch.imageUrl)" class="card-ref-thumb">
              <img :src="refImageUrls[ch.id]" title="参考图" />
            </div>
          </div>
          <div class="card-info">
            <div class="card-name">{{ ch.name }}</div>
            <div class="card-role">{{ ch.personality || '未设定' }}</div>
          </div>
          <div v-if="ch.locked" class="card-lock">🔒</div>
          <div v-if="charImages[ch.id] || ch.imageUrl" class="card-img-badge">🖼</div>
        </div>
      </div>

      <!-- 右侧详情面板 -->
      <div v-if="selectedChar" class="character-detail">
        <div class="detail-field">
          <label>角色名</label>
          <input :value="selectedChar.name" @input="updateField('name', $event)" />
        </div>
        <div class="detail-field">
          <label>描述</label>
          <textarea :value="selectedChar.description" @input="updateField('description', $event)" :rows="3"></textarea>
        </div>
        <div class="detail-field">
          <label>服装</label>
          <input :value="selectedChar.costume" @input="updateField('costume', $event)" />
        </div>

        <!-- 图片生成相关字段 -->
        <div class="detail-field">
          <label>图片生成 Prompt</label>
          <textarea v-model="localImagePrompt" :rows="6" class="prompt-textarea monospace" placeholder="角色图片 prompt..." />
        </div>
        <div class="detail-field">
          <label>Negative Prompt</label>
          <textarea v-model="localNegativePrompt" :rows="2" class="prompt-textarea" placeholder="负面提示词..." />
        </div>
        <div class="detail-field">
          <label>表情集</label>
          <div class="tag-list">
            <span v-for="exp in selectedChar.expressionSet" :key="exp" class="tag">{{ exp }}</span>
          </div>
        </div>

        <!-- 参考图区：图生图模式选择 -->
        <div class="detail-section">
          <label class="section-label">📎 参考图（图生图）</label>
          <div class="ref-mode-row">
            <div class="ref-preview" v-if="refImageUrl">
              <img :src="refImageUrl" class="ref-thumb" />
              <span class="ref-clear" @click="clearRefImage">✕</span>
            </div>
            <div v-else class="ref-preview ref-empty">
              <span>未选择参考图</span>
            </div>
          </div>
          <div class="ref-buttons">
            <button class="btn-tiny" @click="openUpload(selectedId)">📤 上传图片</button>
            <button class="btn-tiny" @click="openAssetPickerForRef">📂 从素材库选择</button>
          </div>
        </div>

        <!-- 生成结果 -->
        <div v-if="charImages[selectedId] || selectedChar.imageUrl" class="char-result">
          <img :src="charImages[selectedId] || selectedChar.imageUrl" class="char-img" @click="previewUrl = charImages[selectedId] || selectedChar.imageUrl" />
        </div>
        <div v-else-if="charLoading[selectedId]" class="char-loading">
          <div class="spinner"></div>
          <span>生成角色图...</span>
        </div>

        <div class="detail-actions">
          <button class="btn-action" :disabled="optimizing[selectedId] || false" @click="optimizeChar(selectedId)">
            ✨ {{ optimizing[selectedId] ? '优化中...' : 'AI 优化 Prompt' }}
          </button>
          <button class="btn-action" :disabled="charLoading[selectedId]" :title="refImageUrl ? '使用参考图图生图' : '文生图'"
            @click="generateCharImage(selectedId)">
            🎨 {{ refImageUrl ? '🖼️ 图生图' : '生成角色图' }}
          </button>
          <button class="btn-action" @click="regenerateChar(selectedId)">♻️ 换装建议</button>
          <!-- AI 音色设计 -->
          <div class="voice-design-row">
            <button class="btn-action voice-btn" :disabled="voiceDesigning" @click="toggleVoicePrompt">
              🎤 {{ voicePromptExpanded ? '收起音色设计' : 'AI 音色' }}
            </button>
            <template v-if="voicePromptExpanded">
              <textarea v-model="voicePrompt" :rows="2" placeholder="描述角色声音特质，如「温柔知性的女声，略带磁性，语速平缓」" class="voice-prompt-input" />
              <button class="btn-action voice-btn" :disabled="voiceDesigning || !voicePrompt || voicePrompt.length < 5" @click="designVoice(selectedId)">
                {{ voiceDesigning ? '⏳ 设计中...' : '✨ 生成音色' }}
              </button>
              <span v-if="voiceResult[selectedId]" class="voice-result-tag">🎵 音色已生成</span>
            </template>
          </div>
        </div>
        <!-- 隐藏 file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handleFileUpload"
        />

        <div class="detail-field check-field">
          <label>锁定</label>
          <input type="checkbox" :checked="selectedChar.locked" @change="toggleLock" />
        </div>
      </div>

      <div v-else-if="characters.length > 0" class="character-detail empty-detail">
        <div class="empty-hint">请选择一个角色查看详情</div>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="preview-overlay" @click="previewUrl = null">
      <img :src="previewUrl" class="preview-img" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useCharacterRuntime } from './useCharacterRuntime'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import { useStyleLock } from '~/studio-v2/composables/useStyleLock'

const { characters, count } = useCharacterRuntime()
const { updateCharacter, addCharacter, addAsset, projectId, goToStage, videoStyle, aspectRatio } = useStudioStore()
const { buildPrompt, buildNegative, getProfile } = useStyleLock()
const generating = ref(false)
const optimizingAll = ref(false)
const tripleViewMode = ref(true)  // ⭐ 三视图模式切换（默认开启）

// 所有角色是否都已生成图片
const allCharsHaveImage = computed(() => {
  return characters.value.length > 0 && characters.value.every((ch: any) => !!charImages[ch.id])
})

function goToSceneDesign() {
  goToStage('scene-design')
}

function createNewChar() {
  const id = addCharacter()
  selectedId.value = id
  // 滚动到新卡片
  requestAnimationFrame(() => {
    const el = document.querySelector(`.character-card[style*="active"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

const selectedId = ref<string>('')
const selectedChar = computed(() => characters.value.find(c => c.id === selectedId.value))

// 图像 Prompt（独立于 store，因为 store 里没有 imagePrompt 字段）
const localImagePrompt = ref('')
const localNegativePrompt = ref('')
const charImages = reactive<Record<string, string>>({})
const charLoading = reactive<Record<string, boolean>>({})
const optimizing = reactive<Record<string, boolean>>({})
const previewUrl = ref<string | null>(null)
// ⭐ 音色设计
const voicePromptExpanded = ref(false)
const voicePrompt = ref('')
const voiceDesigning = ref(false)
const voiceResult = reactive<Record<string, string>>({})

// 当选中角色变化时，填充 imagePrompt
watch(selectedChar, (ch) => {
  if (ch) {
    // 按标准维度组装 imagePrompt
    localImagePrompt.value = ch.imagePrompt || buildStandardPrompt(ch)
    // ⭐ 负面词从 StyleProfile 动态读取（禁止硬编码）
    const vs = videoStyle.value || '3d'
    const profile = getProfile(vs)
    const antiStyleWords = profile?.negativeTokens ? profile.negativeTokens.split('，').slice(0, 3).join(', ') : '动漫风格, 卡通风格'
    localNegativePrompt.value = ch.negativePrompt || `模糊, 变形, 多余肢体, 多出的手臂, 多出的腿, 畸形手, 六指, 画面崩坏, 文字, 水印, ${antiStyleWords}`
  }
})

/**
 * 按标准维度组装角色图 prompt（不再拆分字段，直接返回 prompt textarea 内容）
 */
function buildStandardPrompt(ch: any): string {
  const lines: string[] = []
  lines.push(`构图类型: 居中构图，全身正面，全身定妆照`)
  if (ch.name) lines.push(`角色名: ${ch.name}`)
  if (ch.description) lines.push(`角色描述: ${ch.description}`)
  if (ch.costume) lines.push(`服装: ${ch.costume}`)
  // ⭐ 风格关键词从 StyleProfile 动态读取
  const vs = videoStyle.value || '3d'
  const profile = getProfile(vs)
  const styleKw = profile?.styleTokens || '影视级质感'
  lines.push(`风格关键词: 角色定妆照，全身人设图，${styleKw}`)
  // 背景根据风格决定
  if (vs === 'realistic') {
    lines.push(`背景环境: 纯白色，无多余背景`)
  } else {
    lines.push(`背景环境: 简洁背景，符合 ${profile?.displayName || vs} 视觉风格，无遮挡，无杂物`)
  }
  return lines.join('\n')
}

// 当 characters 从 store 同步更新时，自动填充 charImages 中的已有 imageUrl
watch(() => characters.value, (chars) => {
  if (chars?.length) {
    for (const ch of chars) {
      const imgUrl = ch.imageUrl || ch.visualRef || ''
      if (imgUrl) charImages[ch.id] = imgUrl
    }
  }
}, { deep: true, immediate: true })

function avatarStyle(ch: any) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f97316','#3b82f6']
  return { background: colors[ch.name?.length % colors.length] || '#6366f1' }
}

function updateField(field: string, e: Event) {
  if (!selectedId.value) return
  const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value
  updateCharacter(selectedId.value, { [field]: val })
}

function toggleLock() {
  if (!selectedId.value) return
  const ch = selectedChar.value
  if (ch) updateCharacter(selectedId.value, { locked: !ch.locked })
}

function getToken(): string {
  try {
    const getCachedToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return getCachedToken()
  } catch { return '' }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

// AI 优化 Prompt
async function optimizeChar(chId: string) {
  // ⭐清除旧缓存
  localImagePrompt.value = ''
  localNegativePrompt.value = ''

  const ch = characters.value.find(c => c.id === chId)
  if (!ch) return
  optimizing[chId] = true
  try {
    const storyText = localStorage.getItem('studio_v2_script') || ''
    const existingCharacters = characters.value.map(c => ({
      name: c.name,
      description: c.description || '',
      personality: c.personality || '',
      costume: c.costume || '',
    }))
    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text: storyText,
        section: 'makeup',
        projectId: projectId.value,
        existingSpec: { characterSpecs: existingCharacters },
      }),
    })
    const result = await res.json()
    // makeup 角色定妆师返回 characterMakeupSpecs（含 makeupPrompt）
    const makeupSpecs = result?.data?.characterMakeupSpecs
    if (result?.success && makeupSpecs?.length) {
      const spec = makeupSpecs.find((s: any) => s.characterName === ch.name)
      if (spec?.makeupPrompt) {
        localImagePrompt.value = spec.makeupPrompt
      }
      if (spec?.negativePrompt) {
        localNegativePrompt.value = spec.negativePrompt
      }
      if (spec?.eraStyle) {
        updateCharacter(chId, { eraStyle: spec.eraStyle })
      }
      // 保存到 store
      updateCharacter(chId, { imagePrompt: localImagePrompt.value, negativePrompt: localNegativePrompt.value })
      alert(`✅ ${ch.name} 定妆提示词已优化`)
    } else if (result?.error) {
      alert(`❌ ${ch.name} 优化失败: ${result.error}`)
    } else {
      alert(`⚠️ ${ch.name} 优化无返回`)
    }
  } catch (err: any) {
    alert(`${ch.name} 优化失败: ` + (err.message || '未知错误'))
  } finally {
    optimizing[chId] = false
  }
}

async function optimizeAll() {
  optimizingAll.value = true
  for (const ch of characters.value) {
    await optimizeChar(ch.id)
  }
  optimizingAll.value = false
  alert('✅ 全部角色 prompt 已优化')
}

// 生成角色图 — 用纯定妆 prompt（移除动作描述，保留外貌/服装/气质）
async function generateCharImage(chId: string) {
  const ch = characters.value.find(c => c.id === chId)
  if (!ch) return
  charLoading[chId] = true
  try {
    // 如果用户手动编辑过 prompt，直接使用（不重新处理）
    // buildPortraitPrompt 只在首次构建时使用
    const hasEditedPrompt = localImagePrompt.value && localImagePrompt.value.length > 30
    let portraitPrompt: string
    if (tripleViewMode.value) {
      // ⭐ 三视图模式：永远使用通用角色描述，不含视角约束（后端自动按前/侧/背追加视角修饰词）
      portraitPrompt = buildTripleViewPrompt(ch)
    } else if (hasEditedPrompt) {
      portraitPrompt = localImagePrompt.value
    } else {
      portraitPrompt = buildPortraitPrompt(ch, localImagePrompt.value)
    }
    const refUrl = refImageUrls[chId] || ''
    const body: any = {
      projectId: projectId.value,
      characterId: chId,
      character: {
        ...ch,
        imagePrompt: portraitPrompt,
        negativePrompt: localNegativePrompt.value + ', 多余的肢体, 多出的胳膊, 多出的腿, 多出的手指, 六指, 畸形肢体, 扭曲姿势, 畸形手, 缺失肢体, 半身, 上半身, 近景, 特写, 胸部以上, 动作, 运动, 动态模糊, 扭曲, 变形, 多人, 多个角色, group of people, multiple persons, 2 persons, crowd',
      },
      storyText: localStorage.getItem('studio_v2_script') || '',
      videoStyle: videoStyle.value || '3d',
    }
    // ⭐ 三视图模式
    if (tripleViewMode.value) {
      body.tripleView = true
      // 如果有预设的三视图 prompt，一并传递
      const tripleViewPrompts = ch.tripleViewPrompts
      if (tripleViewPrompts) {
        body.character.tripleViewPrompts = tripleViewPrompts
      }
    }
    // 有参考图时传图生图参数
    if (refUrl) {
      body.referenceImage = refUrl
      body.mode = 'img2img'
    }
    const res = await fetch('/api/execution-images/characters', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `生成失败: ${res.status}`)
    }
    const data = await res.json()
    const imageUrl = data.imageUrl || data.url || ''
    if (imageUrl) {
      charImages[chId] = imageUrl
      updateCharacter(chId, { imageUrl, visualRef: imageUrl })
      // ⭐ 如果返回了 faceCropUrl（正脸裁剪图），存一份供帧图参考用
      if (data.faceCropUrl) {
        updateCharacter(chId, { faceRefImageUrl: data.faceCropUrl })
      }
      // 添加到素材库（带 dbId 用于删除）
      addAsset({
        id: 'char_img_' + Date.now(),
        dbId: data.id || '',
        type: 'character',
        name: ch.name + '角色图',
        thumbnail: imageUrl,
        url: imageUrl,
        prompt: localImagePrompt.value,
        tags: ['角色', ch.name],
        version: 1,
        createdAt: new Date().toISOString(),
      })
    } else {
      throw new Error('服务器未返回图片 URL')
    }
  } catch (err: any) {
    alert(ch.name + ' 生成失败: ' + (err.message || '未知错误'))
  } finally {
    charLoading[chId] = false
  }
}

// 从角色数据和用户填写的 prompt 构建一个干净的定妆 prompt
// 保留：面部五官、表情、服装、光影、背景、时代风格、体型轮廓
// 过滤：动作/姿势描述（变成静态站姿）

// ⭐ 三视图模式的角色描述构建（不含视角约束和"三视图"关键词，后端按前/侧/背分别追加视角）
function buildTripleViewPrompt(ch: any): string {
  const parts: string[] = []
  if (ch.name) parts.push(`角色名「${ch.name}」`)
  // 面部五官
  let faceDesc = ''
  if (ch.faceDetail) faceDesc += ch.faceDetail
  else if (ch.description) faceDesc += ch.description
  if (faceDesc) parts.push(faceDesc)
  // 发型与服饰
  let attireDesc = ''
  if (ch.dressDetail) attireDesc += ch.dressDetail
  else if (ch.costume || ch.clothing) attireDesc += ('穿着' + (ch.costume || ch.clothing))
  if (ch.bodyType) attireDesc += ('，' + ch.bodyType)
  if (attireDesc) parts.push(attireDesc)
  // 气质
  if (ch.aura) parts.push(ch.aura)
  // 时代风格
  if (ch.eraStyle) parts.push(ch.eraStyle)
  // 风格
  const vs = videoStyle.value || '3d'
  const profile = getProfile(vs)
  const styleTokens = profile?.styleTokens || '影视级质感'
  // ⭐ 不写"三视图"关键词（会误导模型自行画grid），只用纯角色+服装+风格
  parts.push('纯色背景，无杂物')
  parts.push(styleTokens + '，角色设定，4K高分辨率')
  return [...new Set(parts)].join('，')
}

function buildPortraitPrompt(ch: any, rawPrompt: string): string {
  // 过滤掉动作相关和道具描述（角色定妆照不需要）
  const cleaned = rawPrompt
    // 移除手持道具整行
    .replace(/手持道具[:：][^\n]*/g, '')
    // 身体姿态改为静态站姿
    .replace(/身体姿态[:：][^\n]*/g, '身体姿态: 静态站姿，身体放松，双手自然下垂')
    // 去掉表情眼神中的急切/抓取等动作
    .replace(/急切|抓取|伸手|前抓|争抢|前倾|僵硬|挥舞|比划|捏指/g, '')
    // 去除多余空行
    .replace(/\n{3,}/g, '\n')
    .trim()

  const lines = cleaned.split('\n').filter(l => l.trim())
  if (lines.length > 2) {
    // 确保有"风格关键词"行，且末尾加上定妆约束
    const hasStyleKw = lines.some(l => l.includes('风格关键词'))
    if (!hasStyleKw) {
      const vs = videoStyle.value || '3d'
      const profile = getProfile(vs)
      const styleKw = profile?.styleTokens || '影视级质感'
      lines.push(`风格关键词: 角色定妆照，全身人设图，${styleKw}，静态定妆，无动作，无道具`)
    }
    return lines.join('\n')
  }

  // fallback — 用角色数据构建高质量定妆 prompt
  const parts: string[] = []
  if (ch.name) parts.push(`角色名「${ch.name}」`)
  
  // 面部五官
  let faceDesc = ''
  if (ch.faceDetail) faceDesc += ch.faceDetail
  else if (ch.description) faceDesc += ch.description
  if (faceDesc) parts.push(faceDesc)
  
  // 发型与服饰
  let attireDesc = ''
  if (ch.dressDetail) attireDesc += ch.dressDetail
  else if (ch.costume || ch.clothing) attireDesc += ('穿着' + (ch.costume || ch.clothing))
  if (ch.bodyType) attireDesc += ('，' + ch.bodyType)
  if (attireDesc) parts.push(attireDesc)
  
  // 气质
  if (ch.aura) parts.push(ch.aura)
  
  // 时代风格
  if (ch.eraStyle) parts.push(ch.eraStyle)
  
  // ⭐ 定妆照约束 — 从 StyleProfile 动态读取
  const vs = videoStyle.value || '3d'
  const profile = getProfile(vs)
  const styleTokens = profile?.styleTokens || '影视级质感'
  // 基本姿态 + 背景（通用规则，不受风格影响）
  parts.push('全身正面站姿，居中构图')
  parts.push(vs === 'realistic' ? '纯白色背景，无任何杂物' : '简洁背景，符合风格设定，无杂物')
  parts.push(styleTokens + '，角色定妆照，全身人设图，4K高分辨率，单人')
  
  return [...new Set(parts)].join('，')
}

async function generateAllChars() {
  generating.value = true
  for (const ch of characters.value) {
    if (!charImages[ch.id]) {
      await generateCharImage(ch.id)
    }
  }
  generating.value = false
}

// 换装建议（重新生成）
async function regenerateChar(chId: string) {
  delete charImages[chId]
  await generateCharImage(chId)
}

// ─── AI 音色设计 ───

function toggleVoicePrompt() {
  voicePromptExpanded.value = !voicePromptExpanded.value
  if (voicePromptExpanded.value && !voicePrompt.value && selectedChar.value) {
    // 用角色描述或名字作为默认音色提示
    voicePrompt.value = selectedChar.value.description
      ? `角色「${selectedChar.value.name}」，${selectedChar.value.description}`
      : ''
  }
}

async function designVoice(chId: string) {
  const ch = characters.value.find(c => c.id === chId)
  if (!ch || !voicePrompt.value || voicePrompt.value.length < 5) return

  voiceDesigning.value = true
  try {
    const token = (typeof window !== 'undefined') ? window.localStorage?.getItem('auth_token') || '' : ''
    const res = await fetch('/api/voice/ai-design', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        projectId: projectId.value,
        characterName: ch.name,
        ttsPrompt: voicePrompt.value,
        provider: 'volcengine',
      }),
    })
    const data = await res.json()
    if (data.success) {
      voiceResult[chId] = data.data.voiceId
      voiceDesigning.value = false
      const { $toast } = useNuxtApp()
      if ($toast) $toast.success(`音色「${data.data.voiceName}」已生成！`)
    } else {
      const { $toast } = useNuxtApp()
      if ($toast) $toast.error(data.error || '音色设计失败')
      console.error('[VoiceDesign] error:', data.error)
    }
  } catch (e: any) {
    console.error('[VoiceDesign] error:', e)
    const { $toast } = useNuxtApp()
    if ($toast) $toast.error(e?.data?.error || e?.message || '音色设计失败')
  } finally {
    voiceDesigning.value = false
  }
}

// ─── 上传参考图 ───
const uploadTargetId = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingRef = ref(false)
// 参考图模式：存储当前角色的参考图 URL
const refImageUrls = reactive<Record<string, string>>({})
const refImageUrl = computed(() => refImageUrls[selectedId.value] || '')

function clearRefImage() {
  delete refImageUrls[selectedId.value]
}

function openAssetPickerForRef() {
  // 调用 store toggleAssetSidebar 打开素材库
  const store = useStudioStore()
  store.setAssetCategory('character')
  store.toggleAssetSidebar()
  // 设置回调 — 选中资产后设置 refImageUrl
  window.__onAssetPickCallback = (asset: any) => {
    if (asset) {
      refImageUrls[selectedId.value] = asset.url || asset.thumbnail || ''
    }
    window.__onAssetPickCallback = undefined
  }
}

function openUpload(chId: string) {
  uploadTargetId.value = chId
  fileInputRef.value?.click()
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file || !uploadTargetId.value) return

  uploadingRef.value = true
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('type', 'character')
  const ch = characters.value.find(c => c.id === uploadTargetId.value)
  formData.append('name', ch?.name || '')

  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = 'Bearer ' + token
    // 不要手动设置 Content-Type，fetch 会自动设置 multipart/form-data 且带 boundary

    console.log('[CharacterWorkspace] uploading file:', file.name, file.size)
    const res = await fetch('/api/v2/workbench/upload-reference', {
      method: 'POST',
      headers,
      body: formData,
    })
    const json = await res.json()
    console.log('[CharacterWorkspace] upload response:', json)
    if (json.success && json.data?.url) {
      charImages[uploadTargetId.value] = json.data.url
      updateCharacter(uploadTargetId.value, { imageUrl: json.data.url })
      addAsset({
        id: `upload_char_${Date.now()}`,
        type: 'character',
        url: json.data.url,
        name: ch?.name || '参考图',
        thumbnail: json.data.url,
        prompt: ch?.name || '',
        tags: ['角色', ch?.name || ''],
        version: 1,
        createdAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[CharacterWorkspace] upload error:', err)
  } finally {
    uploadingRef.value = false
    input.value = '' // 清空，允许重新上传同一文件
  }
}

</script>

<style scoped>
.character-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a28;
}
.toolbar-title { font-size: 13px; font-weight: 600; color: #d1d5db; }
.toolbar-actions { display: flex; gap: 8px; }
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:disabled { opacity: 0.4; cursor: default; }
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.triple-view-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 6px; font-size: 12px;
  cursor: pointer; user-select: none; background: #f0f0f0; border: 1px solid #ddd;
  transition: all 0.2s;
}
.triple-view-toggle:has(input:checked) {
  background: #e8f4ff; border-color: #1890ff; color: #1890ff;
}
.triple-view-toggle input { margin: 0; }
.btn-next {
  background: linear-gradient(135deg, #059669, #10b981);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-next:hover { opacity: 0.85; }
.btn-action {
  background: #1a1a28;
  border: none;
  color: #9ca3af;
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-action:hover:not(:disabled) { background: #2a2a3a; }
.btn-action:disabled { opacity: 0.4; cursor: default; }
.btn-create {
  background: #0f3a0f;
  border: 1px solid #1a5a1a;
  color: #4ade80;
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-create:hover { background: #144a14; }

.character-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
}
.character-list {
  overflow-y: auto;
  border-right: 1px solid #1a1a28;
  padding: 12px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 8px;
}
.empty-icon { font-size: 28px; opacity: 0.2; }
.empty-text { font-size: 11px; color: #4b5563; }

.character-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
}
.character-card:hover { background: #111122; }
.character-card.active { background: #1a1a28; border: 1px solid #2a2a3a; }
.card-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}
.card-avatar-img {
  width: 32px; height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.card-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.card-ref-thumb {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  overflow: hidden;
  border: 1.5px solid #1a1a28;
  background: #0a0a10;
}
.card-ref-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-info { flex: 1; min-width: 0; }
.card-name { font-size: 13px; color: #d1d5db; font-weight: 500; }
.card-role { font-size: 10px; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-lock { font-size: 12px; opacity: 0.5; }
.card-img-badge { font-size: 11px; opacity: 0.6; }

.character-detail {
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.empty-detail {
  align-items: center;
  justify-content: center;
  display: flex;
}
.detail-field { display: flex; flex-direction: column; gap: 4px; }
.detail-field label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-field input[type="text"],
.detail-field input:not([type]) {
  background: #0d0d18;
  border: 1px solid #1a1a28;
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
}
.detail-field textarea {
  background: #0d0d18;
  border: 1px solid #1a1a28;
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
}
.prompt-textarea {
  background: rgba(99,102,241,0.05);
  border: 1px solid rgba(99,102,241,0.15);
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
}
.prompt-textarea:focus {
  border-color: rgba(99,102,241,0.5);
  outline: none;
}
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  background: #1a1a28;
  color: #9ca3af;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
}
.check-field { flex-direction: row; align-items: center; gap: 8px; }
.detail-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.aigc-divider {
  text-align: center;
  padding: 8px 0;
  font-size: 10px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 2px;
  border-top: 1px solid rgba(255,255,255,0.05);
  margin: 4px 0;
}
.voice-design-row {
  width: 100%;
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.voice-design-row .voice-btn {
  font-size: 12px;
  padding: 4px 8px;
}
.voice-prompt-input {
  width: 100%;
  background: #1e1e2a;
  border: 1px solid #2a2a3a;
  border-radius: 4px;
  color: #ccc;
  padding: 6px 8px;
  font-size: 12px;
  resize: vertical;
}
.voice-prompt-input:focus {
  border-color: #4a6cf7;
  outline: none;
}
.voice-result-tag {
  color: #4ade80;
  font-size: 12px;
}
.char-result { text-align: center; }
.char-img {
  max-width: 240px;
  max-height: 300px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  background: #fff;
}
.char-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: rgba(255,255,255,0.6);
  font-size: 12px;
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}
.preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
}
.upload-btn {
  background: linear-gradient(135deg, #1a4a6e, #1a6e4a);
  border: 1px solid rgba(26,110,74,0.3);
}
.upload-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #225a7e, #227e5a);
}
/* 参考图样式 */
.ref-section {
  padding: 8px 0;
  border-top: 1px solid #1a1a28;
  margin-top: 8px;
  width: 100%;
}
.ref-mode-row, .ref-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.ref-preview {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  background: #1a1a28;
  flex-shrink: 0;
}
.ref-preview.ref-empty {
  width: auto;
  height: auto;
  background: none;
  padding: 4px 0;
}
.ref-preview.ref-empty span {
  font-size: 10px;
  color: #6b7280;
}
.ref-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ref-clear {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  cursor: pointer;
  z-index: 1;
}
.ref-clear:hover { background: rgba(200,0,0,0.7); }
.ref-label {
  font-size: 9px;
  color: #6b7280;
}
.ref-buttons {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.btn-tiny {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  color: #9ca3af;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-tiny:hover { background: #2a2a3a; color: #d1d5db; }
</style>
