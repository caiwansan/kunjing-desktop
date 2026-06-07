<template>
  <div class="scene-workspace">
    <div class="workspace-toolbar">
      <div class="toolbar-title">场景圣经 ({{ count }})</div>
      <div class="toolbar-actions">
        <button class="btn-primary" :disabled="scenes.length === 0 || generating" @click="generateAllScenes">
          {{ generating ? '⏳ 生成中...' : '🌆 生成场景图' }}
        </button>
        <button v-if="scenes.length > 0" class="btn-next" @click="goToAIDirector">
          下一步：道具设定 →
        </button>
        <button class="btn-create" @click="createNewScene">➕ 新建场景</button>
      </div>
    </div>

    <div class="scene-layout">
      <!-- 左侧场景列表 -->
      <div class="scene-list">
        <div v-if="scenes.length === 0" class="empty-state">
          <div class="empty-icon">🏙️</div>
          <div class="empty-text">暂无场景，请先完成剧本分析或点击"新建场景"</div>
        </div>
        <div
          v-for="sc in scenes"
          :key="sc.id"
          class="scene-card"
          :class="{ active: selectedId === sc.id }"
          @click="selectedId = sc.id"
        >
          <div class="card-icon-wrap">
            <div v-if="!sc.imageUrl" class="card-icon">{{ iconFor(sc.environment) }}</div>
            <img v-else class="card-thumb" :src="sc.imageUrl" />
            <!-- 参考图缩略图（如果有且与场景图不同） -->
            <div v-if="sceneRefUrls[sc.id] && sceneRefUrls[sc.id] !== sc.imageUrl" class="card-ref-thumb">
              <img :src="sceneRefUrls[sc.id]" title="参考图" />
            </div>
          </div>
          <div class="card-info">
            <div class="card-name">{{ sc.name }}</div>
            <div class="card-env">{{ sc.environment }}</div>
          </div>
          <div v-if="sc.locked" class="card-lock">🔒</div>
        </div>
      </div>

      <!-- 右侧详情面板 -->
      <div v-if="selectedScene" class="scene-detail">
        <!-- 场景图预览 -->
        <div v-if="selectedScene.imageUrl" class="scene-preview">
          <div class="scene-img-wrapper">
            <img :src="selectedScene.imageUrl" class="scene-img" @click="previewUrl = selectedScene.imageUrl" />
            <div class="scene-img-label">{{ selectedScene.name || '未命名场景' }}</div>
          </div>
        </div>
        <div class="detail-field">
          <label>场景名</label>
          <input :value="selectedScene.name" @input="updateField('name', $event)" />
        </div>

        <!-- ⭐ 合并后的场景描述框：渲染 description + 环境/光影/天气/时间/色调 -->
        <div class="detail-field">
          <label>场景描述</label>
          <textarea
            class="scene-desc-textarea"
            :value="mergedSceneDescription"
            @input="updateSceneDescription($event)"
            :rows="5"
            placeholder="场景的完整描述，包含环境、光影、天气、时间、色调等信息..."
          ></textarea>
        </div>

        <!-- ⭐ 图片 Prompt 编辑区（保留，用于精细化控制） -->
        <div class="detail-field">
          <label>imagePrompt（场景图提示词）</label>
          <textarea
            class="prompt-textarea"
            :value="sceneImagePrompt"
            @input="updateImagePrompt($event)"
            :rows="4"
            placeholder="如为空，系统会自动根据场景描述构建..."
          ></textarea>
        </div>

        <div class="detail-field">
          <label>兼容运镜</label>
          <div class="tag-list">
            <span v-for="cam in selectedScene.cameraCompatibility" :key="cam" class="tag">{{ cam }}</span>
          </div>
        </div>
        <div class="detail-field check-field">
          <label>锁定</label>
          <input type="checkbox" :checked="selectedScene.locked" @change="toggleLock" />
        </div>

        <div class="detail-actions" v-if="selectedScene">
          <button class="btn-action" :disabled="!!optimizingScene[selectedId]" @click="localOptimizeScenePrompt(selectedId)">
            {{ optimizingScene[selectedId] ? '⏳ 优化中...' : '✨ AI 优化提示词' }}
          </button>
          <button class="btn-action" :disabled="!!generatingScene[selectedId]" @click="generateSingleScene(selectedId)">
            {{ generatingScene[selectedId] ? '⏳ 生成中...' : (sceneRefUrls[selectedId] ? '🖼️ 图生图' : '♻️ 重新生成场景图') }}
          </button>
        </div>
        <!-- 参考图区域 -->
        <div class="ref-section" v-if="selectedScene">
          <label class="section-label">📎 参考图（图生图）</label>
          <div class="ref-preview" v-if="sceneRefUrls[selectedId]">
            <img :src="sceneRefUrls[selectedId]" class="ref-thumb" />
            <span class="ref-clear" @click="clearSceneRef(selectedId)">✕</span>
          </div>
          <div v-else class="ref-preview ref-empty">
            <span>未选择参考图</span>
          </div>
          <div class="ref-buttons">
            <button class="btn-tiny" @click="openSceneUpload(selectedId)">📤 上传图片</button>
            <button class="btn-tiny" @click="openSceneAssetPicker(selectedId)">📂 从素材库选择</button>
          </div>
        </div>
        <!-- 隐藏 file input -->
        <input
          ref="sceneFileInputRef"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handleSceneFileUpload"
        />
      </div>

      <div v-else-if="scenes.length > 0" class="scene-detail empty-detail">
        <div class="empty-hint">请选择一个场景查看详情</div>
      </div>
    </div>

    <!-- 大图预览弹窗 -->
    <div v-if="previewUrl" class="preview-overlay" @click.self="previewUrl = null">
      <img :src="previewUrl" class="preview-image" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useSceneRuntime } from './useSceneRuntime'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import { useStyleLock } from '~/studio-v2/composables/useStyleLock'

const { scenes, count } = useSceneRuntime()
const { updateScene, addScene, projectId, addAsset, goToStage, videoStyle, aspectRatio } = useStudioStore()
const { buildPrompt, getProfile } = useStyleLock()
const generating = ref(false)
// ─── Token helper ───
function getAuthToken(): string {
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return _gt()
  } catch { return '' }
}

const optimizingScene = reactive<Record<string, boolean>>({})
const generatingScene = reactive<Record<string, boolean>>({})
const sceneRefUrls = reactive<Record<string, string>>({})
const selectedId = ref<string>('')

// ⭐ 自动同步：选中场景时，如果 localImagePrompt 为空则用 imagePrompt 填充
watch(selectedId, (newId) => {
  if (!newId) return
  const sc = scenes.value.find(s => s.id === newId)
  if (sc && !sc.localImagePrompt && sc.imagePrompt) {
    updateScene(newId, { localImagePrompt: sc.imagePrompt })
  }
})

function clearSceneRef(scId: string) {
  delete sceneRefUrls[scId]
}

function openSceneAssetPicker(scId: string) {
  const store2 = useStudioStore()
  store2.setAssetCategory('scene')
  store2.toggleAssetSidebar()
  window.__onAssetPickCallback = (asset: any) => {
    if (asset) {
      sceneRefUrls[scId] = asset.url || asset.thumbnail || ''
    }
    window.__onAssetPickCallback = undefined
  }
}
const sceneImagePrompt = computed({
  get: () => {
    if (!selectedId.value) return ''
    const sc = scenes.value.find(s => s.id === selectedId.value)
    return sc?.localImagePrompt || sc?.imagePrompt || ''
  },
  set: (val: string) => {
    if (!selectedId.value) return
    updateScene(selectedId.value, { localImagePrompt: val })
  },
})
function updateImagePrompt(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value
  sceneImagePrompt.value = val
}

// ⭐ 合并场景描述：将 description + 环境/光影/天气/时间/色调 合并为一个文本
const mergedSceneDescription = computed(() => {
  if (!selectedScene.value) return ''
  const sc = selectedScene.value
  const parts: string[] = []
  if (sc.description) parts.push(sc.description)
  const envParts: string[] = []
  if (sc.environment) envParts.push('环境：' + sc.environment)
  if (sc.lighting) envParts.push('光影：' + sc.lighting)
  if (sc.weather) envParts.push('天气：' + sc.weather)
  if (sc.timeOfDay) envParts.push('时间：' + sc.timeOfDay)
  if (sc.colorTone) envParts.push('色调：' + sc.colorTone)
  if (envParts.length) parts.push(envParts.join('，'))
  return parts.join('\n\n')
})

// ⭐ 当用户编辑场景描述时，尝试解析回各字段
function updateSceneDescription(e: Event) {
  if (!selectedId.value) return
  const val = (e.target as HTMLTextAreaElement).value
  // 按双换行拆分：第一部分是 description，后续是标签字段
  const sections = val.split(/\n\n+/)
  const description = sections[0]?.trim() || ''
  updateScene(selectedId.value, { description })
  
  // 从剩余文本中尝试解析环境/光影/天气/时间/色调
  const rest = sections.slice(1).join('\n\n')
  const envMatch = rest.match(/环境[：:]\s*(.+?)(?:[,，，\n]|$)/)
  const lightMatch = rest.match(/光影[：:]\s*(.+?)(?:[,，，\n]|$)/)
  const weatherMatch = rest.match(/天气[：:]\s*(.+?)(?:[,，，\n]|$)/)
  const timeMatch = rest.match(/时间[：:]\s*(.+?)(?:[,，，\n]|$)/)
  const toneMatch = rest.match(/色调[：:]\s*(.+?)(?:[,，，\n]|$)/)
  
  const updates: Record<string, any> = {}
  if (envMatch) updates.environment = envMatch[1].trim()
  if (lightMatch) updates.lighting = lightMatch[1].trim()
  if (weatherMatch) updates.weather = weatherMatch[1].trim()
  if (timeMatch) updates.timeOfDay = timeMatch[1].trim()
  if (toneMatch) updates.colorTone = toneMatch[1].trim()
  if (Object.keys(updates).length) updateScene(selectedId.value, updates)
}
function goToAIDirector() {
  goToStage('props-design')
}

function createNewScene() {
  const id = addScene()
  selectedId.value = id
  requestAnimationFrame(() => {
    const el = document.querySelector(`.scene-card[style*="active"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
async function localOptimizeScenePrompt(scId: string) {
  const sc = scenes.value.find(s => s.id === scId)
  if (!sc) {
    console.warn(`[Scene] ❌ 场景未找到: ${scId}`)
    return
  }
  console.log(`[Scene] 🔄 开始优化: ${sc.name} (${scId})`)
  optimizingScene[scId] = true
  // ⭐清除旧优化结果
  updateScene(scId, { localImagePrompt: '' })
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  try {
    const currentPrompt = sceneImagePrompt.value || sc.environment || sc.description || sc.name
    // ⭐ 优先从场景描述框（mergedSceneDescription）取内容
    const mergedDesc = mergedSceneDescription.value
    const promptForOptimization = mergedDesc || currentPrompt
    const existingScenes = scenes.value.map(s => ({
      name: s.name,
      description: s.environment || s.description || '',
      imagePrompt: s.localImagePrompt || '',
    }))
    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: localStorage.getItem('studio_v2_script') || '',
        section: 'scene',
        projectId: projectId.value || '',
        sceneDescription: promptForOptimization,  // ⭐ 传入场景描述框内容
        instruction: '请以场景图概念设计为目标，优化场景视觉提示词。输出纯视觉场景图描述，不包含人物、角色。重点：环境、光线、构图、色调、氛围。',
        existingSpec: { scenes: existingScenes },
      }),
    })
    const result = await res.json()
    if (result?.success && result?.data?.sceneSpecs?.length) {
      // ⭐ section mode 只返回当前优化场景的 1 条 spec，直接取第一条
      // 用 sceneName 模糊匹配或场景描述匹配作为保底
      const primarySpec = result.data.sceneSpecs[0]
      const nameMatched = result.data.sceneSpecs.find((s: any) => s.sceneName?.includes(sc.name) || sc.name?.includes(s.sceneName))
      const spec = primarySpec || nameMatched || null
      if (spec?.imagePrompt) {
        updateScene(scId, { localImagePrompt: spec.imagePrompt })
        console.log(`[Scene] ✅ 优化成功: ${sc.name}, imagePrompt length=${spec.imagePrompt.length}`)
      } else {
        console.warn(`[Scene] ⚠️ 优化返回但无 imagePrompt: sceneSpecs=${result.data.sceneSpecs.length}条, firstName=${result.data.sceneSpecs[0]?.sceneName||'-'}`)
      }
    } else {
      console.warn(`[Scene] ⚠️ 优化失败或无数据: success=${result?.success}, sceneSpecs=${result?.data?.sceneSpecs?.length || 0}`)
    }
  } catch (err: any) {
    console.warn('[Scene] 优化失败:', err)
  } finally {
    optimizingScene[scId] = false
  }
}

const selectedScene = computed(() => {
  const found = scenes.value.find(s => s.id === selectedId.value)
  if (!found && selectedId.value) {
    console.warn(`[Scene] ❌ selectedId ${selectedId.value} not found in ${scenes.value.length} scenes (ids: ${scenes.value.map(s=>s.id).join(',')})`)
  }
  return found || null
})
const previewUrl = ref<string | null>(null)

function updateField(field: string, e: Event) {
  if (!selectedId.value) return
  const val = (e.target as HTMLInputElement).value
  updateScene(selectedId.value, { [field]: val })
}

function toggleLock() {
  if (!selectedId.value) return
  const sc = selectedScene.value
  if (sc) updateScene(selectedId.value, { locked: !sc.locked })
}

async function generateSingleScene(scId: string) {
  const sc = scenes.value.find(s => s.id === scId)
  if (!sc) return
  generatingScene[scId] = true
  // ⭐ 先清除旧图，让用户看到加载中的变化
  updateScene(scId, { imageUrl: '', visualRef: '' })
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    // 优先用用户编辑的 localImagePrompt（如果有）
    const userPrompt = sc.localImagePrompt || ''
    const scenePrompt = userPrompt || buildScenePrompt(sc)
    // ⭐ 自动优化 prompt（如为空或较短时调用 LLM 优化）
    let finalPrompt = scenePrompt
    let finalNegative = '人物, 角色, 人影, 人物剪影, 人物轮廓, 任何人物, 任何人影, 角色特写, 动作, 运动, 模糊, 人, 人体, 人类, 路人, 人物描写, people, person, human, character, figure, silhouette, multiple persons, crowd, group of people, man, woman, girl, boy, child'
    if (!userPrompt && scenePrompt.length < 60) {
      try {
        const existingScenes = scenes.value.map(s => ({
          name: s.name,
          description: s.environment || s.description || '',
          imagePrompt: s.localImagePrompt || '',
        }))
        const optimRes = await fetch('/api/script/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            text: localStorage.getItem('studio_v2_script') || '',
            section: 'scene',
            projectId: projectId.value || '',
            existingSpec: { scenes: existingScenes },
          }),
        })
        const optimResult = await optimRes.json()
        if (optimResult?.success && optimResult?.data?.sceneSpecs?.length) {
          const primarySpec = optimResult.data.sceneSpecs[0]
          const nameMatched = optimResult.data.sceneSpecs.find((s: any) => s.sceneName?.includes(sc.name) || sc.name?.includes(s.sceneName))
          const spec = primarySpec || nameMatched || null
          if (spec?.imagePrompt) {
            finalPrompt = spec.imagePrompt
          }
          if (spec?.negativePrompt) finalNegative += ', ' + spec.negativePrompt
        }
      } catch {}
    }
    const res = await fetch('/api/execution-images/scenes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: projectId.value,
        sceneId: scId,
        scene: { ...sc, imagePrompt: finalPrompt, negativePrompt: finalNegative },
        storyText: localStorage.getItem('studio_v2_script') || '',
        videoStyle: videoStyle.value || '3d',
        // 参考图（图生图）
        referenceImage: sceneRefUrls[scId] || '',
        mode: sceneRefUrls[scId] ? 'img2img' : undefined,
      }),
    })
    if (!res.ok) throw new Error(`生成失败: ${res.status}`)
    const data = await res.json()
    if (data.imageUrl) {
      updateScene(scId, { imageUrl: data.imageUrl, visualRef: data.imageUrl })
      // ⭐ 同步到素材库
      addAsset({
        id: 'scene_' + scId + '_' + Date.now(),
        type: 'scene',
        name: sc.name + '场景图',
        thumbnail: data.imageUrl,
        url: data.imageUrl,
        prompt: sc.name + '场景图',
        tags: ['场景', sc.name],
        version: 1,
        createdAt: new Date().toISOString(),
      })
    }
  } catch (err: any) {
    alert(sc.name + ' 生成失败: ' + (err.message || '未知错误'))
  } finally {
    generatingScene[scId] = false
  }
}

// 构建纯净的场景图 prompt（移除动作/角色特写，保留环境/光线/氛围/建筑）
function buildScenePrompt(sc: any): string {
  const parts: string[] = []

  // 如果 AI 返回了 imagePrompt，优先使用
  if (sc.imagePrompt && sc.imagePrompt.length > 30) {
    const cleaned = sc.imagePrompt
      .replace(/角色|人物|主角|配角|主演|演员|人设|人形|人影|人物剪影|角色剪影|他的|她的|他 |她 |她们|他们|少年|少女|老人|女子|男子|男人|女人|老者/g, '')
    parts.push(cleaned.trim())
  }

  // 场景基础
  if (sc.name && !parts.some(p => p.includes(sc.name))) parts.push(sc.name)
  if (sc.environment && !parts.some(p => p.includes(sc.environment))) parts.push(sc.environment)

  // 从 description（新版 prompt 已改为纯视觉场景描绘）提取
  if (sc.description) {
    const lines = sc.description.split(/[，,。\n]/).map(s => s.trim()).filter(Boolean)
    for (const line of lines) {
      if (!line) continue
      // 过滤残留的动作/角色描述
      if (/动作|打斗|奔跑|走路|伸手|抓取|对视|对话|拥抱|亲吻|攻击|防御|抬手|握拳|转身/.test(line)) continue
      if (/角色|人物|主角|配角|主演|演员|人设|人形|人影|人物剪影|角色剪影|他的|她的|他 |她 |她们|他们|少年|少女|老人|女子|男子|男人|女人|老者|公子|小姐|将军|道士|和尚|妖精|妖孽|女妖/.test(line)) continue
      if (line.length >= 6) parts.push(line)  // 只取有信息量的句子（>=6字）
    }
  }

  // 光影
  if (sc.lighting || sc.light) parts.push('光线：' + (sc.lighting || sc.light))

  // 色调
  if (sc.colorTone) parts.push('色调：' + sc.colorTone)

  // 氛围
  if (sc.atmosphere || sc.ambient || sc.mood) parts.push('氛围：' + (sc.atmosphere || sc.ambient || sc.mood || ''))

  // 天气
  if (sc.weather) parts.push(sc.weather)

  // 时间
  if (sc.timeOfDay) parts.push(sc.timeOfDay)

  // 固定场景图风格
  // ⭐ 风格关键词从 StyleProfile 动态读取
  const vs = videoStyle.value || '3d'
  const profile = getProfile(vs)
  const styleTokens = profile?.styleTokens || '影视级画质'
  parts.push('纯场景概念图，无人物', '建筑与环境细节', styleTokens)
  // ⭐ 隐形空间标签指令：在场景图中为每个物体添加不可见的语义标签，
  // 让 AI 理解物体的类别、位置和结构关系，辅助后续视频模型理解场景布局
  parts.push(
    '【重要：隐式空间语义标注】',
    '画面中每个物体必须有清晰的结构和位置关系描述',
    '物体之间应有明确的遮挡关系和空间层次',
    '每个物体的形状、比例和朝向必须明确可辨',
    '不建议在画面中叠加任何可见的文字标记'
  )
  return [...new Set(parts)].filter(Boolean).join('，')
}

async function generateAllScenes() {
  generating.value = true
  // 清除所有旧图
  for (const sc of scenes.value) {
    updateScene(sc.id, { imageUrl: '', visualRef: '' })
  }
  for (const sc of scenes.value) {
    await generateSingleScene(sc.id)
  }
  generating.value = false
}

// ─── 上传场景参考图 ───
const sceneFileInputRef = ref<HTMLInputElement | null>(null)
const uploadingScene = reactive<Record<string, boolean>>({})

function openSceneUpload(scId: string) {
  sceneFileInputRef.value?.click()
}

async function handleSceneFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file || !selectedId.value) return

  uploadingScene[selectedId.value] = true
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'scene')
  const sc = scenes.value.find(s => s.id === selectedId.value)
  formData.append('name', sc?.name || '')

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
      updateScene(selectedId.value, { imageUrl: json.data.url })
      addAsset({
        id: `upload_scene_${Date.now()}`,
        type: 'scene',
        url: json.data.url,
        name: sc?.name || '参考图',
        thumbnail: json.data.url,
        prompt: sc?.name || '',
        tags: ['场景', sc?.name || ''],
        version: 1,
        createdAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[SceneWorkspace] upload error:', err)
  } finally {
    uploadingScene[selectedId.value] = false
    input.value = ''
  }
}

async function regenerateScene(scId: string) {
  await generateSingleScene(scId)
}

function iconFor(env: string): string {
  const map: Record<string, string> = {
    '室内': '🏠', '室外': '🌳', '城市': '🏙️', '自然': '🌲',
    '海滩': '🏖️', '夜晚': '🌃', '古代': '🏯', '科幻': '🚀',
  }
  return map[env] || '🏙️'
}
</script>

<style scoped>
.scene-workspace {
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
.hint { font-size: 10px; color: #4b5563; }
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

.scene-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
}
.scene-list {
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

.scene-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
}
.scene-card:hover { background: #111122; }
.scene-card.active { background: #1a1a28; border: 1px solid #2a2a3a; }
.card-icon-wrap { position: relative; flex-shrink: 0; }
.card-icon { font-size: 18px; }
.card-info { flex: 1; }
.card-name { font-size: 13px; color: #d1d5db; font-weight: 500; }
.card-env { font-size: 10px; color: #4b5563; }
.card-lock { font-size: 12px; opacity: 0.5; }

.scene-detail {
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
.color-display { display: flex; align-items: center; gap: 8px; }
.color-swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid #1a1a28; }
.color-input { flex: 1; }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  background: #1a1a28;
  color: #9ca3af;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
}
.check-field { flex-direction: row; align-items: center; gap: 8px; }
.detail-actions { display: flex; gap: 6px; margin-top: 8px; }
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
.btn-action:hover { background: #2a2a3a; }
.empty-hint { font-size: 11px; color: #4b5563; text-align: center; }

.scene-preview { padding: 8px 16px; }
.scene-img-wrapper { position: relative; display: inline-block; width: 100%; }
.scene-img { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; cursor: pointer; display: block; }
.scene-img-label {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 6px 10px;
  background: linear-gradient(transparent, rgba(0,0,0,0.75));
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  border-radius: 0 0 8px 8px;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.card-thumb { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
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
.preview-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.85); display: flex;
  align-items: center; justify-content: center; cursor: zoom-out;
}
.preview-image { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
.prompt-textarea {
  background: rgba(99,102,241,0.05);
  border: 1px solid rgba(99,102,241,0.15);
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.prompt-textarea:focus {
  border-color: rgba(99,102,241,0.5);
  outline: none;
}
.scene-desc-textarea {
  background: rgba(16,185,129,0.04);
  border: 1px solid rgba(16,185,129,0.15);
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.6;
}
.scene-desc-textarea:focus {
  border-color: rgba(16,185,129,0.5);
  outline: none;
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: wait;
}
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
  margin-bottom: 4px;
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
.detail-section { padding: 8px 0; border-top: 1px solid #1a1a28; margin-top: 8px; }
.section-label { display: block; font-size: 10px; font-weight: 600; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
</style>
