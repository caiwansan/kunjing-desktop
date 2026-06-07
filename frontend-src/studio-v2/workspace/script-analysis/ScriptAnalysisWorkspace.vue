<template>
  <div class="script-workspace">
    <!-- 顶部操作栏 -->
    <div class="workspace-toolbar">
      <div class="toolbar-left">
        <button class="btn-action" @click="toggleProjectDropdown" title="切换项目">
          📁 项目记录 <span class="dropdown-arrow">▾</span>
        </button>
      </div>
      <div class="toolbar-actions">
        <button class="btn-action" :disabled="!currScript" @click="focusTextarea">📋 粘贴</button>
        <button class="btn-action" :disabled="!currScript.trim() || submittingTask" @click="submitBreakdownTask">
          {{ submittingTask ? '⏳ 提交中...' : '📦 提交拆解' }}
        </button>
        <button class="btn-next" :disabled="!currScript.trim() || submittingTask || !hasAnalysisResult" @click="goToNextStage">
          ✅ 下一步：角色设定 →
        </button>
      </div>
    </div>

    <!-- 项目下拉列表 -->
    <Transition name="dropdown">
      <div v-if="showProjectDropdown" class="project-dropdown">
        <div class="dropdown-header">
          <span>已有项目</span>
        </div>
        <div v-if="loadingProjects" class="dropdown-loading">加载中...</div>
        <div v-else-if="projects.length === 0" class="dropdown-empty">暂无项目记录</div>
        <div
          v-for="p in projects"
          :key="p.id"
          class="dropdown-item"
          :class="{ 'dropdown-item-active': store.projectId === p.id }"
          @click="selectProject(p)"
        >
          <div class="dropdown-item-info">
            <span class="dropdown-item-name">{{ p.name }}</span>
            <span class="dropdown-item-date">{{ formatDate(p.updatedAt) }}</span>
          </div>
          <div class="dropdown-item-actions">
            <span v-if="p.script" class="dropdown-item-badge" title="已有剧本">📝</span>
            <button
              class="dropdown-delete-btn"
              title="删除项目记录"
              @click.stop="confirmDeleteProject(p)"
            >🗑️</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认弹窗 -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
        <div class="modal-panel modal-panel--small">
          <div class="modal-header">
            <h3>确认删除</h3>
            <button class="modal-close" @click="showDeleteConfirm = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="confirm-text">确定要删除「{{ deletingProject?.name }}」项目记录吗？</p>
            <p class="confirm-hint">项目记录将被彻底删除，但已生成的图片/视频会保留在 COS 存储桶中不会丢失。</p>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn--cancel" @click="showDeleteConfirm = false">取消</button>
            <button class="modal-btn modal-btn--danger" :disabled="deleting" @click="doDeleteProject">
              {{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="script-body">
      <!-- 上层：剧本输入 -->
      <div class="upper-section">
        <!-- ⭐ 表格化输入面板 -->
        <div class="meta-table">
          <div class="meta-row">
            <div class="meta-label">项目名称</div>
            <div class="meta-value">
              <input v-model="projectNameInput" class="meta-input" placeholder="给你的项目起个名字..." @input="onProjectNameInput" />
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-label">剧本标题</div>
            <div class="meta-value">
              <input v-model="scriptTitle" class="meta-input" placeholder="如：暗夜追凶 / 仙剑奇缘..." />
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-label">视频总时长</div>
            <div class="meta-value">
              <div class="duration-input-wrap">
                <input v-model.number="videoDuration" type="number" class="meta-input duration-input" min="1" max="600" placeholder="0" />
                <span class="duration-unit">秒</span>
              </div>
            </div>
          </div>
        </div>
        <textarea
          class="script-textarea"
          v-model="scriptContent"
          placeholder="在此粘贴或输入剧本内容…"
        ></textarea>
        <div class="script-stats">
          <span>{{ n?.script?.length ?? 0 }} 字符</span>
          <span v-if="store.projectId" class="stat-project-id">📁 {{ currentProjectName }}</span>
        </div>
      </div>

      <!-- 分割线 → 下半部分：六维度卡片 -->
      <div class="section-divider"></div>
      <div class="dim-cards-section">
        <div class="dim-cards-grid">
          <!-- 角色卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">👤 角色</div>
            <div class="dim-cards-body">
              <div v-if="n?.characters?.length" class="dim-list scrollable">
                <div v-for="(c, i) in n.characters" :key="c.name + '_' + i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ c.name }}</strong></span>
                  <span class="dim-row-tags">{{ c.gender || '-' }} · {{ c.age || '-' }} · {{ c.role || '-' }}</span>
                  <span class="dim-row-desc">{{ c.description || c.clothing || '-' }}</span>
                  <span class="dim-row-extra" v-if="c.voiceType || c.voice">🎙️ {{ c.voiceType || c.voice }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

          <!-- 场景卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">🌄 场景</div>
            <div class="dim-cards-body">
              <div v-if="n?.scenes?.length" class="dim-list scrollable">
                <div v-for="(s, i) in n.scenes" :key="s.name + '_' + i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ s.name }}</strong></span>
                  <span class="dim-row-tags">{{ s.environment || '-' }}</span>
                  <span class="dim-row-desc">{{ s.description || s.mood || '' }} {{ s.lighting ? '💡'+s.lighting : '' }} {{ s.colorTone ? '🎨'+s.colorTone : '' }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

          <!-- 特效画面卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">🎬 特效画面</div>
            <div class="dim-cards-body">
              <div v-if="n?.emotionCurve?.length" class="dim-list scrollable">
                <div v-for="(e, i) in n.emotionCurve" :key="i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ e.effectName || e.emotion }}</strong></span>
                  <span class="dim-row-tags">{{ e.effectType || '' }}</span>
                  <span class="dim-row-desc">{{ (e.notes || e.description || e.visualDescription || '').substring(0,60) }}{{ (e.notes || e.description || '').length > 60 ? '…' : '' }}</span>
                  <span v-if="e.colorPalette" class="dim-row-extra">🎨 {{ e.colorPalette.substring(0,30) }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

          <!-- 情绪曲线卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">📈 情绪曲线</div>
            <div class="dim-cards-body">
              <div v-if="n?.emotionSpecs?.length" class="dim-list scrollable">
                <div v-for="(em, i) in n.emotionSpecs" :key="i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ em.emotion || em.segmentName || '段落 ' + (i+1) }}</strong></span>
                  <span class="dim-row-tags">{{ em.intensity || '-' }}</span>
                  <span class="dim-row-desc">{{ (em.expression || em.description || '-').substring(0,60) }}</span>
                  <span v-if="em.microExpression" class="dim-row-extra">👁️ {{ em.microExpression }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

          <!-- 道具卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">🛠️ 道具</div>
            <div class="dim-cards-body">
              <div v-if="n?.props?.length" class="dim-list scrollable">
                <div v-for="(p, i) in n.props" :key="p.name + '_' + i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ p.name }}</strong></span>
                  <span class="dim-row-tags">{{ p.category || '-' }}</span>
                  <span class="dim-row-desc">{{ p.description || '-' }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

          <!-- 配音卡片 -->
          <div class="dim-cards-item">
            <div class="dim-cards-header">🎙️ 配音</div>
            <div class="dim-cards-body">
              <div v-if="n?.voices?.length" class="dim-list scrollable">
                <div v-for="(v, i) in n.voices" :key="v.characterName + '_' + i" class="dim-row">
                  <span class="dim-row-index">{{ i + 1 }}</span>
                  <span class="dim-row-main"><strong>{{ v.characterName }}</strong></span>
                  <span class="dim-row-tags">{{ v.voiceType || '-' }}</span>
                  <span class="dim-row-desc">音高 {{ v.pitch || '-' }} · 语速 {{ v.speed || '-' }}</span>
                  <span class="dim-row-extra" v-if="v.description">{{ v.description }}</span>
                </div>
              </div>
              <div v-else class="dim-cards-empty">暂无数据，请提交拆解</div>
            </div>
          </div>

        </div>

        <div v-if="analyzing" class="dim-cards-loading">
          ⏳ AI 拆解中... <span class="dim-cards-loading-sub">结果将自动填入各卡片</span>
        </div>

        <div v-if="hasAnalysisResult" class="dim-cards-footer">
          剧本拆解完成，点击顶部「✅ 下一步：角色设定」进入角色设定页面
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNarrativeRuntime } from './useNarrativeRuntime'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const store = useStudioStore()
const { videoStyle, aspectRatio } = store
const storeState = store.state
const { updateNarrative, setNarrative, setCharacters, setScenes, saveToServer, loadFromServer, fetchProjectList, deleteProject, goToStage } = store
const analyzing = ref(false)
const submittingTask = ref(false)

// ─── Token helper ───
function getAuthToken(): string {
  try {
    const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return _gt()
  } catch { return '' }
}

// ⭐ HTTP 错误消息映射
function httpErrorMessage(status: number, defaultMsg: string): string {
  const map: Record<number, string> = {
    400: '请求参数有误，请检查输入',
    401: '登录已过期，请刷新页面重新登录',
    403: '无权限访问',
    404: '请求的资源不存在',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误，请联系管理员',
    502: '网关异常，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
  }
  return map[status] || defaultMsg
}

// ⭐ 剧本拆解表格表单
const scriptTitle = ref('')
const videoDuration = ref<number | null>(null)

// ⭐ beats 表格计算属性
const totalBeats = computed(() => {
  return (n.value?.videoSegments ?? []).reduce((sum, seg) => sum + (seg.beats?.length ?? 0), 0)
})
const totalDuration = computed(() => {
  return (n.value?.videoSegments ?? []).reduce((sum, seg) => sum + (seg.duration ?? 0), 0)
})

// ⭐ 深度分析：生成后跳转到"制作规格书"页面
const deepAnalyzing = ref(false)

async function runDeepAnalyze() {
  if (deepAnalyzing.value) return
  const data = currNarrative()
  if (!data.script?.trim()) {
    alert('请先完成剧本分析')
    return
  }
  deepAnalyzing.value = true
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const durationToSend = videoDuration.value || 0
    console.log('[Deep-Analyze] ⏱ 发送时长=', durationToSend, '(videoDuration=', videoDuration.value, ')')
    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: data.script.trim(),
        section: 'storyboard',
        projectId: storeState.projectId,
      }),
    })
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '生成失败')

    // 生成成功后跳转到角色设定
    goToStage('character-design')
  } catch (err: any) {
    alert('生成失败: ' + err.message)
  } finally {
    deepAnalyzing.value = false
  }
}

// ─── 下一步：将六维数据应用到角色/场景/道具/分镜设定页，跳转到角色设定 ───
async function goToNextStage() {
  const narr = n.value
  if (!narr) return

  // 先保存到 store
  const charSpecs: any[] = []
  const sceneSpecs: any[] = []
  const videoSegments: any[] = []

  // 角色数据映射 → CharacterRuntime
  if (narr.characters?.length) {
    const chars = narr.characters.map((c: any, i: number) => {
      const spec = {
        characterName: c.name || '',
        gender: c.gender || '',
        age: c.age || '',
        role: c.role || '',
        physicalDescription: c.description || '',
        clothing: c.clothing || '',
        personality: c.personality || '',
        voiceType: c.voiceType || '',
        imagePrompt: '',
        negativePrompt: '',
      }
      charSpecs.push(spec)
      return {
        id: c.id || `char_ai_${i}`,
        name: c.name || '',
        description: c.description || '',
        gender: c.gender || '',
        age: c.age || '',
        role: c.role || '',
        voiceType: c.voiceType || '',
        clothing: c.clothing || '',
        personality: c.personality || '',
        imageUrl: '',
      }
    })
    setCharacters(chars)
  }

  // 场景数据映射 → SceneRuntime
  if (narr.scenes?.length) {
    const scenes = narr.scenes.map((s: any, i: number) => {
      const spec = {
        sceneId: s.id || `scene_ai_${i}`,
        sceneName: s.name || '',
        description: s.description || s.environment || '',
        imagePrompt: '',
        negativePrompt: '',
        aspectRatio: '9:16',
      }
      sceneSpecs.push(spec)
      return {
        id: s.id || `scene_ai_${i}`,
        name: s.name || '',
        description: s.description || '',
        environment: s.environment || '',
        timeOfDay: s.timeOfDay || '',
        lighting: s.lighting || '',
        mood: s.mood || '',
        colorTone: s.colorTone || '',
        imageUrl: '',
      }
    })
    setScenes(scenes)
  }

  // 道具数据写入 narrative.props
  if (narr.props?.length) {
    updateNarrative({ props: narr.props.map((p: any, i: number) => ({
      id: p.id || `prop_ai_${i}`,
      name: p.name || '',
      category: p.category || '',
      description: p.description || '',
      imageUrl: '',
    })) })
  }
  // ⭐ v2: 优先从 narr.videoSegments 读取（v2 流程 beats=[]，videoSegments 直接有值）
  if (narr.videoSegments?.length) {
    for (let i = 0; i < narr.videoSegments.length; i++) {
      const seg = narr.videoSegments[i]
      // 按段落构建：每个 videoSegment 作为一个分镜卡片
      const segId = seg.id || seg.segmentId || `seg_${i}`
      videoSegments.push({
        segmentId: segId,
        title: seg.title || seg.name || `段落 ${i + 1}`,
        associatedScenes: seg.scenes || seg.associatedScenes || [],
        duration: seg.duration || 10,
        narrativePurpose: seg.description || seg.narrativePurpose || seg.visual || seg.fullText || '',
        fullText: seg.fullText || '',
        shotPattern: seg.shotPattern || '',
        emotionArc: seg.emotion || seg.emotionArc || '',
        backgroundMusic: '',
        imagePrompt: '',
        negativePrompt: '',
      })
    }
  }
  // v1 fallback: 分镜 beats → 转为 videoSegments
  else if (narr.beats?.length) {
    const beats = narr.beats.map((b: any, i: number) => ({
      id: b.id || `beat_ai_${i}`,
      label: b.label || '',
      startSecond: b.startSecond || 0,
      endSecond: b.endSecond || 0,
      camera: b.camera || '',
      visual: b.visual || '',
      dialogue: b.dialogue || '',
      sound: b.sound || '',
      emotion: b.emotion || '',
    }))
    updateNarrative({ beats })
    // 转为 VideoSegment 格式
    narr.beats.forEach((b: any, i: number) => {
      videoSegments.push({
        segmentId: b.id || `seg_${i}`,
        title: b.label || `分镜 ${i + 1}`,
        associatedScenes: [],
        duration: (b.endSecond || 5) - (b.startSecond || 0),
        narrativePurpose: b.visual || '',
        shotPattern: b.camera || '',
        emotionArc: b.emotion || '',
        backgroundMusic: '',
        imagePrompt: '',
        negativePrompt: '',
      })
    })
  }

  // ⭐ 持久化到数据库（aigc-spec）
  try {
    const token = getAuthToken()
    const pid = (window as any).__PROJECT_ID__ || storeState.projectId
    if (pid) {
      // 收集道具数据
      const propSpecs = (narr.props || []).map((p: any, i: number) => ({
        propName: p.name || '',
        category: p.category || '',
        description: p.description || '',
        character: p.character || p.characterName || '',
        scene: p.scene || p.sceneName || '',
        segment: p.segment || '',
      }))
      const saveRes = await fetch(`/api/aigc-spec/${pid}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          characterSpecs: charSpecs,
          sceneSpecs: sceneSpecs,
          videoSegments: videoSegments,
          propSpecs: propSpecs,
        }),
      })
      if (saveRes.ok) console.log('[Analysis] aigc-spec 保存成功（含道具）')
      else console.warn('[Analysis] aigc-spec 保存失败:', saveRes.status)
    }

    // ⭐ 将 videoSegments 写入 store 的 narrative，后续视频生成页面自动读取
    updateNarrative({ videoSegments })
  } catch (e) {
    console.warn('[Analysis] aigc-spec 保存异常:', e)
  }

  goToStage('character-design')
}
// Format date helper
function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const hour = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return month + '-' + day + ' ' + hour + ':' + min
  } catch {
    return dateStr
  }
}

async function submitBreakdownTask() {
  const data = currNarrative()
  if (!data.script?.trim()) {
    alert('请先输入剧本内容')
    return
  }
  if (submittingTask.value) return
  submittingTask.value = true

  try {
    // ⭐ 第一步：确保项目存在（保存剧本 → 获取 projectId）
    const pid = await saveToServer()
    if (!pid) {
      throw new Error('保存项目失败，无法获取项目ID')
    }

    // ⭐ 第二步：清除六维组件缓存
    updateNarrative({
      videoSegments: [],
      characters: [],
      scenes: [],
      dialogues: [],
      actions: [],
      voices: [],
      beats: [],
      props: [],
      emotionCurve: [],
      effects: [],
      emotionSpecs: [],
    })

    // ⭐ 清除旧 segments（防止分镜页展示旧版本数据）
    storeState.workspace.segments = []

    // ⭐ 第三步：全流程 AI 分析（剧情总指挥 + 全部 7 个专业 Agent）
    // 后端 /api/script/submit 已扩展：传 projectId 后自动持久化 executionResults + artifact sync
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = 'Bearer ' + token

    console.log('[submitBreakdownTask] 🔄 调用全流程 AI 分析...')
    const submitRes = await fetch('/api/script/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: data.script.trim(),
        title: data.projectName || undefined,
        projectId: pid,
        videoStyle: videoStyle.value || '3d',
        aspectRatio: aspectRatio.value || '9:16',
      }),
    })
    const submitJson = await submitRes.json()
    if (!submitJson.success || !submitJson.data) {
      throw new Error(submitJson.error || 'AI 全量分析失败')
    }

    console.log('[submitBreakdownTask] ✅ AI 全量分析 + 持久化完成')

    // ⭐ 第四步：重载项目获取完整六维数据（从 artifact 独立表读取）
    console.log('[submitBreakdownTask] 重载项目获取完整六维数据...')
    const loaded = await loadFromServer(pid)
    if (loaded) {
      console.log('[submitBreakdownTask] ✅ 项目重载成功，六维数据已就绪')
    } else {
      console.warn('[submitBreakdownTask] ⚠️ 重载后六维数据仍为空')
    }

    alert('✅ 拆解任务已完成，结果已应用')
  } catch (err) {
    alert('❌ 拆解失败: ' + (err.message || err))
  } finally {
    submittingTask.value = false
  }
}

const n = computed(() => storeState.workspace?.narrative || emptyNarrative())

// AI 拆解是否已完成（用于控制"下一步"按钮显示）
const hasAnalysisResult = computed(() => {
  // 只要拆解任务完成且至少有一个维度有数据即可
  const narr = n.value
  const hasData = !!(narr?.beats?.length || narr?.characters?.length || narr?.scenes?.length)
  return hasData && !analyzing.value
})

// ─── 项目记录 ───
const showProjectDropdown = ref(false)
const loadingProjects = ref(false)
const projects = ref<any[]>([])

const showDeleteConfirm = ref(false)
const deletingProject = ref<any>(null)
const deleting = ref(false)

const projectNameInput = ref('')

const currentProjectName = computed(() => {
  if (store.projectId) {
    const p = projects.value.find(p => p.id === store.projectId)
    return p?.name || '项目中'
  }
  return ''
})

// ─── 生命周期 ───
onMounted(() => {
  // 尝试从 URL 参数恢复项目
  const params = new URLSearchParams(window.location.search)
  const projectId = params.get('projectId')
  if (projectId) {
    store.setProjectId(projectId)
    loadFromServer(projectId).then(() => {
      projectNameInput.value = n.value?.projectName || ''
    })
  }
  // 加载项目列表
  loadProjectList()
})

// ─── 项目名称输入 ───
function onProjectNameInput() {
  updateNarrative({ projectName: projectNameInput.value })
}

// ─── 项目下拉 ───
async function toggleProjectDropdown() {
  if (!showProjectDropdown.value) {
    await loadProjectList()
  }
  showProjectDropdown.value = !showProjectDropdown.value
}

async function loadProjectList() {
  loadingProjects.value = true
  try {
    projects.value = await fetchProjectList()
  } finally {
    loadingProjects.value = false
  }
}

async function selectProject(p: any) {
  showProjectDropdown.value = false
  if (store.projectId === p.id) return

  // 保存当前修改
  if (n.value?.script?.trim()) {
    await saveToServer()
  }

  // 加载新项目
  const ok = await loadFromServer(p.id)
  if (ok) {
    projectNameInput.value = p.name || ''
  } else {
    alert('加载项目失败')
  }
}

function confirmDeleteProject(p: any) {
  deletingProject.value = p
  showDeleteConfirm.value = true
}

async function doDeleteProject() {
  if (!deletingProject.value) return
  deleting.value = true
  try {
    await deleteProject(deletingProject.value.id)
    await loadProjectList()
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
    deletingProject.value = null
  }
}

// ─── 剧本操作 ───
function focusTextarea() {
  // 只聚焦 textarea，让用户可以直接 Ctrl+V
}

function currNarrative() {
  return n.value || { script: '', title: '', projectName: '', projectDesc: '', characters: [], scenes: [], emotionCurve: [], beats: [], props: [], voices: [] }
}

const currScript = computed(() => n.value?.script?.trim() || '')

// v-model 双向绑定到 store
const scriptContent = computed({
  get: () => n.value?.script ?? '',
  set: (val: string) => updateNarrative({ script: val }),
})

/* analyzeScript 已移除，使用 submitBreakdownTask + goToNextStage */



// ─── 自动道具拆解（Analyze 流程中非阻塞调用，返回 propRef[]） ───
async function analyzeProps(pid: string, script: string): Promise<any[]> {
  if (!pid || !script) return []
  try {
    const token = getAuthToken()
    const hds: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) hds['Authorization'] = 'Bearer ' + token

    // 收集已有角色/场景 context
    const existingSpec: any = {}
    const chars = (n.value?.characters || []).map((c: any) => ({
      characterName: c.name || c.characterName,
    })).filter((c: any) => c.characterName)
    const scenes = (n.value?.scenes || []).map((s: any) => ({
      sceneName: s.name || s.sceneName,
    })).filter((s: any) => s.sceneName)
    if (chars.length) existingSpec.characterSpecs = chars
    if (scenes.length) existingSpec.sceneSpecs = scenes

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: hds,
      body: JSON.stringify({
        text: script,
        section: 'props',
        existingSpec,
        projectId: pid,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `道具拆解失败: ${res.status}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '道具拆解无返回')
    const propList = json.data?.propSpecs || json.data?.props || []
    console.log('[analyze] ✅ 道具拆解完成, props:', propList.length)
    // 转换为 PropRef 格式
    return propList.map((p: any, i: number) => ({
      id: `pr_${i}_${Date.now()}`,
      name: p.propName || p.name || `道具 ${i + 1}`,
      category: p.category || '通用',
      description: p.description || '',
    }))
  } catch (err: any) {
    console.warn('[analyze] 道具拆解失败（不影响主流程）:', err.message)
    return []
  }
}

// ─── 自动音色拆解（Analyze 流程中非阻塞调用，返回 VoiceRef[]） ───
async function analyzeVoices(pid: string, script: string): Promise<any[]> {
  if (!pid || !script) return []
  try {
    const token = getAuthToken()
    const hds: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) hds['Authorization'] = 'Bearer ' + token

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: hds,
      body: JSON.stringify({
        text: script,
        section: 'voice',
        projectId: pid,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `音色拆解失败: ${res.status}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '音色拆解无返回')
    const voiceList = json.data?.voiceConfigs || []
    console.log('[analyze] ✅ 音色拆解完成, voices:', voiceList.length)
    // 转换为 VoiceRef 格式
    return voiceList.map((v: any, i: number) => ({
      id: `vc_${i}_${Date.now()}`,
      characterName: v.characterName || v.character || `角色 ${i + 1}`,
      voiceType: v.voiceType || '默认',
      pitch: v.pitch || 1.0,
      speed: v.speed || 1.0,
      description: v.description || '',
    }))
  } catch (err: any) {
    console.warn('[analyze] 音色拆解失败（不影响主流程）:', err.message)
    return []
  }
}

// ─── 自动场景补充（Analyze 流程中非阻塞调用，调用场景设计师 agent） ───
async function analyzeScenes(pid: string, script: string): Promise<any[]> {
  if (!pid || !script) return []
  try {
    const token = getAuthToken()
    const hds: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) hds['Authorization'] = 'Bearer ' + token

    const res = await fetch('/api/script/regenerate', {
      method: 'POST',
      headers: hds,
      body: JSON.stringify({
        text: script,
        section: 'scene',
        projectId: pid,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `场景补充失败: ${res.status}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '场景补充无返回')
    const sceneList = json.data?.sceneSpecs || []
    console.log('[analyze] ✅ 场景补充完成, scenes:', sceneList.length)
    // 转换为 SceneRef 格式
    return sceneList.map((sc: any, i: number) => ({
      id: sc.sceneId || `sc_sup_${i}`,
      name: sc.sceneName || sc.name || `场景 ${i + 1}`,
      environment: sc.environment || sc.sceneName || '',
      description: sc.description || '',
      lighting: sc.lighting || '',
      colorTone: sc.colorTone || '',
      timeOfDay: sc.timeOfDay || '',
      weather: sc.weather || '',
    }))
  } catch (err: any) {
    console.warn('[analyze] 场景补充失败（不影响主流程）:', err.message)
    return []
  }
}
</script>

<style scoped>
.script-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #07070f;
  position: relative;
}

/* ─── 顶部操作栏 ─── */
.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid #1a1a28;
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 10px; }
.toolbar-title { font-size: 13px; font-weight: 600; color: #d1d5db; }
.project-name-input {
  width: 180px;
  background: #111122;
  border: 1px solid #1e1e30;
  border-radius: 6px;
  padding: 6px 12px;
  color: #d1d5db;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.project-name-input:focus { border-color: #3b82f6; }
.project-name-input::placeholder { color: #4b5563; }
.toolbar-actions { display: flex; gap: 8px; }
.dropdown-arrow { font-size: 8px; margin-left: 4px; }
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
.btn-action:hover { background: #252540; }
.btn-action:disabled { opacity: 0.4; cursor: default; }
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
.btn-submit-task {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-submit-task:disabled { opacity: 0.4; cursor: default; }
.btn-submit-task:hover:not(:disabled) { opacity: 0.85; }


/* ─── 项目下拉框 ─── */
.project-dropdown {
  position: absolute;
  top: 44px;
  left: 20px;
  width: 340px;
  max-height: 320px;
  background: #0f0f1f;
  border: 1px solid #1e1e30;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  z-index: 50;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #1a1a28;
  font-size: 12px;
  color: #9ca3af;
}
.dropdown-loading, .dropdown-empty {
  padding: 20px;
  text-align: center;
  font-size: 11px;
  color: #4b5563;
}
.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid #141420;
  cursor: pointer;
  transition: background 0.12s;
}
.dropdown-item:hover { background: #1a1a2e; }
.dropdown-item-active { background: #1e2040; }
.dropdown-item-info { flex: 1; min-width: 0; }
.dropdown-item-name {
  display: block;
  font-size: 12px;
  color: #d1d5db;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-item-date {
  font-size: 10px;
  color: #4b5563;
}
.dropdown-item-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}
.dropdown-item-badge {
  font-size: 12px;
  opacity: 0.6;
}
.dropdown-delete-btn {
  background: transparent;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0.5;
  transition: opacity 0.12s;
}
.dropdown-delete-btn:hover { opacity: 1; }

/* ─── Modal ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}
.modal-panel {
  width: 440px;
  max-width: 90vw;
  background: #0f0f1f;
  border: 1px solid #1e1e30;
  border-radius: 10px;
  overflow: hidden;
}
.modal-panel--small { width: 360px; }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #1a1a28;
}
.modal-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #d1d5db;
}
.modal-close {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.modal-close:hover { color: #d1d5db; background: #1a1a28; }
.modal-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-input {
  background: #111122;
  border: 1px solid #1e1e30;
  border-radius: 6px;
  padding: 8px 12px;
  color: #d1d5db;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.field-input:focus { border-color: #3b82f6; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid #1a1a28;
}
.modal-btn {
  padding: 7px 18px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: none;
}
.modal-btn--cancel { background: #1a1a28; color: #9ca3af; }
.modal-btn--cancel:hover { background: #252540; color: #d1d5db; }
.modal-btn--primary { background: linear-gradient(135deg, #2563eb, #3b82f6); color: #fff; }
.modal-btn--primary:disabled { opacity: 0.4; cursor: default; }
.modal-btn--danger { background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; }
.modal-btn--danger:disabled { opacity: 0.4; cursor: default; }
.confirm-text { font-size: 13px; color: #d1d5db; margin: 0 0 6px; }
.confirm-hint { font-size: 11px; color: #6b7280; margin: 0; }

/* ─── 主体 ─── */
.script-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.upper-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  border-bottom: 1px solid #1a1a28;
}
.script-textarea {
  flex: 1;
  background: transparent;
  border: none;
  resize: none;
  padding: 14px 20px;
  font-size: 13px;
  line-height: 1.7;
  color: #d1d5db;
  font-family: inherit;
}
.script-textarea:focus { outline: none; }
.script-textarea::placeholder { color: #4b5563; }
.script-stats {
  padding: 6px 20px;
  display: flex;
  gap: 16px;
  font-size: 10px;
  color: #4b5563;
  border-top: 1px solid #1a1a28;
  flex-shrink: 0;
}
.stat-project-id {
  color: #6366f1;
  margin-left: auto;
  font-weight: 500;
}
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #3730a3, transparent);
  margin: 6px 20px;
  flex-shrink: 0;
}
.dim-cards-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 6px 12px;
  overflow-y: auto;
  min-height: 0;
}
.dim-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.dim-cards-item {
  background: #0d0d18;
  border: 1px solid #2a2a3a;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 120px;
}
.dim-cards-header {
  font-size: 12px;
  font-weight: 600;
  color: #a5b4fc;
  padding: 8px 12px;
  border-bottom: 1px solid #2a2a3a;
  flex-shrink: 0;
  background: #111126;
}
.dim-cards-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dim-list.scrollable {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}
.dim-row {
  padding: 5px 6px;
  border-bottom: 1px solid #1a1a28;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.dim-row:last-child { border-bottom: none; }
.dim-row-index { color: #4b5563; font-size: 10px; }
.dim-row-main { color: #e5e7eb; }
.dim-row-tags { color: #6b7280; font-size: 10px; }
.dim-row-desc { color: #9ca3af; font-size: 10px; line-height: 1.4; }
.dim-row-extra { color: #6366f1; font-size: 10px; }
.dim-cards-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  font-size: 11px;
  padding: 24px;
}
.dim-cards-loading {
  text-align: center;
  padding: 10px;
  color: #818cf8;
  font-size: 11px;
}
.dim-cards-loading-sub { display: block; font-size: 10px; color: #6b7280; margin-top: 3px; }
.dim-cards-footer {
  text-align: center;
  padding: 6px;
  font-size: 10px;
  color: #4b5563;
}

/* ─── ⭐ 表格化输入表单 ─── */
.meta-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 16px;
  background: #1a1a28;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #2a2a3a;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.meta-label {
  flex-shrink: 0;
  width: 72px;
  font-size: 12px;
  color: #9ca3af;
  text-align: right;
}
.meta-value {
  flex: 1;
}
.meta-input {
  width: 100%;
  padding: 6px 10px;
  background: #13131f;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.meta-input:focus { border-color: #6366f1; }
.meta-tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.meta-tag {
  padding: 3px 10px;
  background: #13131f;
  border: 1px solid #2a2a3a;
  border-radius: 14px;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.meta-tag:hover { border-color: #4b5563; color: #d1d5db; }
.meta-tag.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }

/* ⭐ 深度分析入口 */
.deep-analyze-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin-top: 4px;
  background: linear-gradient(135deg, #1e1b4b, #13131f);
  border: 1px solid #3730a3;
  border-radius: 8px;
}
.btn-deep-analyze {
  padding: 8px 18px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-deep-analyze:hover { filter: brightness(1.15); }
.btn-deep-analyze:disabled { opacity: 0.5; cursor: not-allowed; }
.deep-analyze-hint { font-size: 11px; color: #818cf8; }

/* 弹窗宽模式 */
.modal-panel--wide { max-width: 900px; width: 92vw; }
.deep-result-body { max-height: 65vh; overflow-y: auto; padding: 12px 16px; }

/* ⭐ 制作规格书 Tab 栏 */
.deep-tab-bar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin: 0 12px;
}
.deep-tab {
  padding: 5px 12px;
  background: transparent;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.deep-tab:hover { border-color: #6366f1; color: #d1d5db; }
.deep-tab.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }

/* ⭐ 规格书表格 */
.deep-table-wrap { overflow-x: auto; }
.deep-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.deep-table th {
  background: #1a1a28;
  color: #9ca3af;
  font-weight: 600;
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #2a2a3a;
  white-space: nowrap;
  font-size: 11px;
  position: sticky;
  top: 0;
}
.deep-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #1a1a28;
  color: #d1d5db;
  vertical-align: top;
}
.deep-table tr:hover td { background: #1a1a28; }
.deep-table .deep-desc { max-width: 280px; white-space: pre-wrap; font-size: 11px; color: #9ca3af; }
.deep-empty { text-align: center; color: #4b5563; padding: 32px; font-size: 13px; }

.deep-result-content {
  background: #0a0a10;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 16px;
  font-size: 12px;
  line-height: 1.6;
  color: #d1d5db;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}




/* ─── 动画 ─── */
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px); }
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ─── 视频总时长输入 ─── */
.duration-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}
.duration-input {
  width: 80px !important;
  text-align: center;
}
.duration-input::-webkit-inner-spin-button {
  opacity: 1;
}
.duration-unit {
  color: #888;
  font-size: 13px;
  margin-right: 8px;
}
.duration-auto {
  color: #666;
  font-size: 12px;
}
</style>
