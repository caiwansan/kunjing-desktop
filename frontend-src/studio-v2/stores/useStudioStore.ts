// ============================================================
// Studio v2 — 全局状态管理（Phase 2: Workspace Runtime）
// Store → Runtime → UI 单向数据流
// Phase 7A: 使用原子类型 factory 函数，消灭 as any
// ============================================================

import { reactive, computed, readonly } from 'vue'
import type {
  PipelineRuntime, PipelineStageId, WorkspaceRuntime, SegmentRuntime, TimelineFrame,
  AssetRuntime, AssetType, AssetEntry,
  NarrativeRuntime, CharacterRuntime, SceneRuntime,
} from '~/studio-v2/types/runtime/index'
import { createEmptyCharacter } from '~/studio-v2/types/runtime/character-runtime'
import { createEmptyScene } from '~/studio-v2/types/runtime/scene-runtime'
import type { PromptRuntime } from '~/studio-v2/runtime/execution/execution-types'
import { createPipelineRuntime, setStageStatus, setActiveStage } from '~/studio-v2/pipeline/studio-pipeline'
import { createEmptyNarrative } from '~/studio-v2/workspace/script-analysis/narrative-types'

// ─── Token helpers ───
function getAuthToken(): string {
  try {
    return (window as any).__NUXT__?.token || (window as any).localStorage?.getItem('auth_token') || ''
  } catch { return '' }
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken()
  return t ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` } : { 'Content-Type': 'application/json' }
}

/** HTTP 错误码 → 用户友好消息 */
function httpErrorMessage(status: number, defaultMsg: string): string {
  const map: Record<number, string> = {
    400: '请求参数有误，请检查输入',
    401: '登录已过期，请重新登录',
    403: '权限不足',
    404: '请求的资源不存在',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误',
    502: '网关异常',
    503: '服务暂时不可用',
  }
  return map[status] || defaultMsg
}

// ─── State ───

const state = reactive<{
  pipeline: PipelineRuntime
  workspace: WorkspaceRuntime
  assets: AssetRuntime
  activeSegmentIndex: number
  projectId: string
  execution: {
    compiledPrompts: PromptRuntime[]
  }
}>({
  pipeline: createPipelineRuntime(),
  workspace: {
    activeWorkspaceId: 'script-analysis',
    narrative: createEmptyNarrative(),
    characters: [],
    scenes: [],
    segments: [],
  },
  assets: {
    assets: [],
    activeCategory: 'all',
    collapsed: false,
  },
  activeSegmentIndex: -1,
  projectId: '',
  execution: {
    compiledPrompts: [],
  },
})
console.log("[PHASE2] store state.workspace:", state.workspace?.activeWorkspaceId, "narrative:", state.workspace?.narrative?.projectName)

console.log("[PHASE2] store init check: state.workspace?", !!state.workspace, "narrative?", !!state.workspace?.narrative, "projectName:", state.workspace?.narrative?.projectName)
// ─── Getters ───

const activeStage = computed(() =>
  state.pipeline.stages.find(s => s.id === state.pipeline.activeStageId)
)

const activeWorkspace = computed(() => state.workspace.activeWorkspaceId)

// 🟢 PHASE2: verify store init immediately after reactive
console.log("[PHASE2] store state.workspace:", state.workspace)
console.log("[PHASE2] store projectName:", state.workspace?.narrative?.projectName)

// ─── (keep existing getter)
const filteredAssets = computed

export function useStudioStore() {
  // Pipeline
  function goToStage(stageId: PipelineStageId) {
    state.pipeline = setActiveStage(state.pipeline, stageId)
    state.workspace.activeWorkspaceId = stageId
  }

  function updateStageStatus(
    stageId: PipelineStageId,
    status: 'idle' | 'running' | 'completed' | 'error',
    extra?: { progress?: number; error?: string }
  ) {
    state.pipeline = setStageStatus(state.pipeline, stageId, status, extra)

    // ⚠️ 同步到后端 pipeline_stages 表
    // 不阻塞前端，fire-and-forget
    if (state.projectId) {
      const token = getAuthToken()
      if (token) {
        fetch(`/api/pipeline/stage/${state.projectId}/${stageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            status: status === 'completed' ? 'done' :
                    status === 'error' ? 'error' :
                    status === 'running' ? 'running' :
                    status === 'idle' ? 'pending' : status,
            ...(extra?.error ? { error: extra.error } : {}),
          }),
        }).catch(e => console.warn(`[StageSync] ${stageId}: ${e.message}`))
      }
    }
  }

  // Narrative
  function updateNarrative(patch: Partial<NarrativeRuntime>) {
    Object.assign(state.workspace.narrative, patch)
  }

  function setNarrative(narrative: NarrativeRuntime) {
    state.workspace.narrative = narrative
  }

  // 视频风格 & 画面比例
  const videoStyle = computed(() => state.workspace.narrative.videoStyle || '3d')
  const aspectRatio = computed(() => state.workspace.narrative.aspectRatio || '9:16')
  const styleLocked = computed(() => state.workspace.narrative.styleLocked === true)

  function setVideoStyle(style: string) {
    state.workspace.narrative.videoStyle = style
  }
  function setAspectRatio(ratio: string) {
    state.workspace.narrative.aspectRatio = ratio
  }
  function toggleStyleLock() {
    state.workspace.narrative.styleLocked = !state.workspace.narrative.styleLocked
  }

  // Characters
  function setCharacters(characters: CharacterRuntime[]) {
    state.workspace.characters = characters
  }

  function addCharacter(seed?: Partial<CharacterRuntime>) {
    const ch = createEmptyCharacter(seed)
    state.workspace.characters.push(ch)
    return ch.id
  }

  function updateCharacter(id: string, patch: Partial<CharacterRuntime>) {
    const idx = state.workspace.characters.findIndex(c => c.id === id)
    if (idx >= 0) {
      state.workspace.characters[idx] = { ...state.workspace.characters[idx], ...patch }
    }
  }

  // Scenes
  function setScenes(scenes: SceneRuntime[]) {
    state.workspace.scenes = scenes
  }

  function addScene(seed?: Partial<SceneRuntime>) {
    const sc = createEmptyScene(seed)
    state.workspace.scenes.push(sc)
    return sc.id
  }

  function updateScene(id: string, patch: Partial<SceneRuntime>) {
    const idx = state.workspace.scenes.findIndex(s => s.id === id)
    if (idx >= 0) {
      state.workspace.scenes[idx] = { ...state.workspace.scenes[idx], ...patch }
    }
  }

  // Segments
  function setActiveSegment(index: number) {
    state.activeSegmentIndex = index
  }

  function setSegments(segments: SegmentRuntime[]) {
    state.workspace.segments = segments
  }

  function updateSegment(segmentId: string, patch: Partial<SegmentRuntime>) {
    const idx = state.workspace.segments.findIndex(s => s.id === segmentId)
    if (idx >= 0) {
      state.workspace.segments[idx] = { ...state.workspace.segments[idx], ...patch }
    }
  }

  function updateTimelineFrame(segmentId: string, second: number, field: keyof TimelineFrame, value: any) {
    const seg = state.workspace.segments.find(s => s.id === segmentId)
    if (!seg) return
    const frame = seg.timeline.find(t => t.second === second)
    if (frame) {
      ;(frame as any)[field] = value
    }
  }

  // Assets
  function setAssets(assets: AssetEntry[]) {
    state.assets.assets = assets
  }

  function addAsset(asset: AssetEntry) {
    state.assets.assets.push(asset)
  }

  function removeAsset(assetId: string) {
    state.assets.assets = state.assets.assets.filter(a => a.id !== assetId)
  }

  function setAssetCategory(category: AssetType | 'all') {
    state.assets.activeCategory = category
  }

  function toggleAssetSidebar() {
    state.assets.collapsed = !state.assets.collapsed
  }

  // Execution
  function setCompiledPromptSegments(prompts: PromptRuntime[]) {
    state.execution.compiledPrompts = prompts
  }

  function addCompiledPrompt(prompt: PromptRuntime) {
    const idx = state.execution.compiledPrompts.findIndex(p => p.segmentId === prompt.segmentId)
    if (idx >= 0) {
      state.execution.compiledPrompts[idx] = prompt
    } else {
      state.execution.compiledPrompts.push(prompt)
    }
  }

  // Project
  function setProjectId(id: string) {
    state.projectId = id
  }

  // ─── Server Persistence ───

  /** 保存当前项目到服务器（新建或更新） */
  async function saveToServer(): Promise<string | null> {
    const narr = state.workspace.narrative
    if (!narr.projectName?.trim() && !narr.script?.trim()) {
      console.warn('[saveToServer] 项目名称和剧本都为空，跳过')
      return null
    }

    try {
      if (state.projectId) {
        // 更新已有项目
        const res = await fetch(`/api/v2/workbench/project/${state.projectId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            projectName: narr.projectName,
            projectDesc: narr.projectDesc,
            script: narr.script,
          }),
        })
        if (!res.ok) throw new Error(`更新项目失败: ${res.status}`)
        const json = await res.json()
        return json.data?.id || state.projectId
      } else {
        // 新建项目
        const res = await fetch('/api/v2/workbench/project', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            projectName: narr.projectName || '未命名项目',
            projectDesc: narr.projectDesc || '',
            script: narr.script || '',
          }),
        })
        if (!res.ok) throw new Error(`创建项目失败: ${res.status}`)
        const json = await res.json()
        if (json.data?.id) {
          state.projectId = json.data.id
        }
        return state.projectId
      }
    } catch (err: any) {
      console.error('[saveToServer]', err.message)
      return null
    }
  }

  /** 从服务器全量加载项目 */
  async function loadFromServer(projectId: string): Promise<boolean> {
    try {
      // ⭐ 在清空前保存用户设置的视频风格和画幅比例
      const prevVS = state.workspace.narrative.videoStyle || '3d'
      const prevAR = state.workspace.narrative.aspectRatio || '9:16'
      const prevLocked = state.workspace.narrative.styleLocked === true
      // ⭐ 清空旧 workspace，防止跨项目数据污染
      state.workspace.narrative = createEmptyNarrative()
      // ⭐ 立即恢复保存的风格，防止后面被 'realistic'/'16:9' 覆盖
      state.workspace.narrative.videoStyle = prevVS
      state.workspace.narrative.aspectRatio = prevAR
      state.workspace.narrative.styleLocked = prevLocked
      state.workspace.characters = []
      state.workspace.scenes = []
      state.workspace.segments = []

      const res = await fetch(`/api/v2/workbench/project/${projectId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`加载项目失败: ${res.status}`)
      const json = await res.json()
      if (!json.success || !json.data) throw new Error('加载数据为空')

      const p = json.data
      state.projectId = p.id

      // 回填剧本
      const rawScript = p.script || p.executionResults?.rawScript || ''

      // ─── 从 aiCharacterSpecs 恢复角色引用信息 ───
      const charRefs: any[] = []
      if (p.aiCharacterSpecs?.length) {
        for (const spec of p.aiCharacterSpecs) {
          charRefs.push({
            id: spec.characterName,
            name: spec.characterName,
            description: spec.physicalDescription || '',
            imagePrompt: spec.imagePrompt || '',
            appearance: spec.physicalDescription || '',
            clothing: spec.clothing || '',
            gender: spec.gender || '',
            age: spec.age || '',
            // role 和 voiceType 不在 ai_character_specs 表里，尝试从 executionResults 补
            role: p.executionResults?.analyzeV2Data?.normalized?.characters?.find((c: any) => c.name === spec.characterName)?.role || '',
            voiceType: p.executionResults?.analyzeV2Data?.normalized?.characters?.find((c: any) => c.name === spec.characterName)?.voiceType || '',
          })
        }
      }

      // ─── 从 aiSceneSpecs 恢复场景引用信息 ───
      const sceneRefs: any[] = []
      if (p.aiSceneSpecs?.length) {
        // ⭐ 从 analyzeV2Data.normalized 获取场景的补充字段（environment/lighting/colorTone/mood/timeOfDay）
        const v2SceneMap = new Map<string, any>()
        const v2Scenes = p.executionResults?.analyzeV2Data?.normalized?.scenes || []
        for (const s of v2Scenes) {
          if (s.name) v2SceneMap.set(s.name, s)
        }
        for (const spec of p.aiSceneSpecs) {
          const v2 = v2SceneMap.get(spec.sceneName)
          sceneRefs.push({
            id: spec.sceneId || spec.sceneName,
            name: spec.sceneName || '',
            description: spec.description || '',
            imagePrompt: spec.imagePrompt || '',
            localImagePrompt: spec.imagePrompt || spec.description || '',
            environment: v2?.environment || spec.environment || '',
            lighting: v2?.lighting || spec.lighting || '',
            colorTone: v2?.colorTone || spec.colorTone || '',
            mood: v2?.mood || spec.mood || '',
            timeOfDay: v2?.timeOfDay || spec.timeOfDay || '',
          })
        }
      }

      // ─── 从 aiVideoSegments 恢复 beats（分镜段落） ───
      const beats: any[] = []
      if (p.aiVideoSegments?.length) {
        for (const seg of p.aiVideoSegments) {
          let scenes: string[] = []
          try {
            if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes)
          } catch {}
          beats.push({
            id: seg.segmentId,
            index: seg.sortOrder,
            title: seg.title || `段落 ${seg.sortOrder + 1}`,
            subject: '',
            action: '',
            emotion: seg.emotionArc || 'calm',
            intensity: 0.5,
            summary: seg.title || '',
            duration: seg.duration || 10,
            scenes,
            masterBeat: seg.emotionArc || '',
            narrativePurpose: seg.narrativePurpose || '',
            fullText: seg.fullText || '',
          })
        }
      }
      // ⭐ fallback: aiVideoSegments 为空时从 plotBlueprint.segments 恢复
      if (beats.length === 0 && p.executionResults?.plotBlueprint?.segments?.length) {
        for (const seg of p.executionResults.plotBlueprint.segments) {
          let scenes: string[] = []
          try {
            if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes)
          } catch {}
          beats.push({
            id: seg.segmentId,
            index: seg.sortOrder || beats.length,
            title: seg.title || `段落 ${beats.length + 1}`,
            subject: '',
            action: '',
            emotion: seg.emotionArc || 'calm',
            intensity: 0.5,
            summary: seg.title || '',
            duration: seg.duration || 10,
            scenes,
            masterBeat: seg.emotionArc || '',
            narrativePurpose: seg.narrativePurpose || '',
            fullText: seg.script || seg.visualContent || seg.fullText || '',
          })
        }
      }

      // ─── 恢复 narrative（保留已有 videoStyle / aspectRatio）───
      state.workspace.narrative = {
        script: rawScript,
        title: p.name || '',
        projectName: p.name || '',
        projectDesc: p.description || '',
        characters: charRefs,
        scenes: sceneRefs,
        emotionCurve: beats.map((b: any, i: number) => ({
          timeIndex: i,
          emotion: b.emotion || 'calm',
          intensity: b.intensity || 0.5,
        })),
        beats,
        // ⭐ 从 executionResults 恢复道具/音色/特效/情绪/对白数据
        props: (function mergeProps() {
          // 优先用 propImages（有 imageUrl）
          const pImgs: any[] = p.propImages || []
          // 从 executionResults.propSpecs 获取 character/characterName 信息
          const propSpecs: any[] = (p.executionResults && p.executionResults.propSpecs) || []
          const specMap = new Map<string, any>()
          for (const ps of propSpecs) {
            const key = ps.propName || ps.name || ''
            if (key) specMap.set(key, ps)
          }
          if (pImgs.length > 0) {
            return pImgs.map(function(pi: any, i: number) {
              const spec = specMap.get(pi.propName) || {}
              return {
                id: 'prop_load_' + i,
                name: pi.propName || '道具 ' + (i + 1),
                category: pi.category || '通用',
                description: pi.description || spec.description || '',
                imageUrl: pi.imageUrl || '',
                imagePrompt: spec.imagePrompt || {},
                character: spec.character || (Array.isArray(spec.character_names) ? spec.character_names.join(', ') : '') || (Array.isArray(pi.character_names) ? pi.character_names.join(', ') : '') || '',
                characterName: spec.characterName || spec.character || (Array.isArray(spec.character_names) ? spec.character_names.join(', ') : '') || '',
              }
            })
          }
          // Fallback: 从 propSpecs 恢复（无 imageUrl）
          return propSpecs.map(function(pr: any, i: number) {
            return {
              id: 'pr_load_' + i,
              name: pr.propName || pr.name || '道具 ' + (i + 1),
              category: pr.category || '通用',
              description: pr.description || '',
              imageUrl: '',
              character: pr.character || (Array.isArray(pr.character_names) ? pr.character_names.join(', ') : '') || '',
              characterName: pr.characterName || pr.character || '',
            }
          })
        })(),
        voices: (p.executionResults?.voiceConfigs || []).map((vc: any, i: number) => ({
          id: `vc_load_${i}`,
          characterName: vc.characterName || vc.character || `角色 ${i + 1}`,
          voiceType: vc.voiceType || '默认',
          pitch: vc.pitch || 1.0,
          speed: vc.speed || 1.0,
          description: vc.description || '',
        })),
        effects: (p.executionResults?.effectSpecs || []).map((ef: any, i: number) => ({
          id: `ef_load_${i}`,
          name: ef.effectName || ef.name || `特效 ${i + 1}`,
          type: ef.type || 'visual',
          description: ef.description || '',
          intensity: ef.intensity || 0.5,
          timing: ef.timing || '',
        })),
        emotionSpecs: ((() => { const er_es = p.executionResults?.emotionSpecs || []; if (er_es.length) return er_es; const pb_segs = p.executionResults?.plotBlueprint?.segments || []; return pb_segs.flatMap((s: any) => (s.emotionSpecs || []).map((es: any, ei: number) => ({ segmentIndex: ei, segmentName: s.title, ...es }))); })()).map((es: any, i: number) => ({
          id: `es_load_${i}`,
          characterName: es.characterName || `角色 ${i + 1}`,
          emotion: es.emotion || 'calm',
          intensity: es.intensity || 0.5,
          duration: es.duration || 0,
          transition: es.transition || 'fade',
        })),
        dialogues: ((() => { const d = p.executionResults?.dialogues || p.executionResults?.dialogueSpecs || []; if (d.length) return d; const pb = p.executionResults?.plotBlueprint?.segments || []; return pb.flatMap((s: any) => (s.dialogues || []).map((dl: any, di: number) => ({ ...dl, segmentId: dl.segmentId || s.segmentId }))); })()).map((dl: any, i: number) => ({
          id: `dl_load_${i}`,
          segmentId: dl.segmentId || '',
          lineIndex: dl.lineIndex || i,
          speaker: dl.speaker || '',
          text: dl.text || '',
          tone: dl.tone || 'normal',
          timing: dl.timing || 0,
        })),
        // ⭐ 从 aiVideoSegments 表恢复 videoSegments（分镜维度的渲染数据）
        videoSegments: p.aiVideoSegments?.length
          ? p.aiVideoSegments.map((seg: any, i: number) => ({
              segmentId: seg.segmentId,
              title: seg.title || `段落 ${i + 1}`,
              duration: seg.duration || 8,
              narrativePurpose: seg.narrativePurpose || '',
              fullText: seg.fullText || '',
              shotPattern: seg.shotPattern || '',
              emotionArc: seg.emotionArc || '',
              backgroundMusic: seg.backgroundMusic || '',
              sortOrder: seg.sortOrder || i,
            }))
          : [],
      }

      // ─── 回填角色图片（带 spec 信息） ───
      const charMap = new Map(p.aiCharacterSpecs?.map((s: any) => [s.characterName, s]) || [])
      if (p.characterImages?.length) {
        state.workspace.characters = p.characterImages.map((ci: any) => {
          const spec = charMap.get(ci.characterName)
          // 方案B: 若URL是火山直链，替换为本地代理路径
          const imgUrl = ci.imageUrl?.includes('volces.com') ? '/api/proxy/image?url=' + encodeURIComponent(ci.imageUrl) : ci.imageUrl
          return {
            id: `char_cos_${ci.characterName}_${ci.id}`,
            name: ci.characterName,
            description: spec?.physicalDescription || '',
            personality: '',
            clothing: spec?.clothing || '',
            props: '',
            appearance: spec?.physicalDescription || '',
            physicalDescription: spec?.physicalDescription || '',
            gender: spec?.gender || '',
            age: spec?.age || '',
            expressionSet: [],
            locked: false,
            voiceRef: '',
            relationships: [],
            imageUrl: imgUrl,
            imagePrompt: spec?.imagePrompt || '',
          }
        })
      } else {
        state.workspace.characters = charRefs.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          personality: '',
          clothing: r.clothing || '',
          props: '',
          appearance: r.description || '',
          physicalDescription: r.description || '',
          expressionSet: [],
          locked: false,
          voiceRef: '',
          relationships: [],
          imageUrl: '',
          imagePrompt: r.imagePrompt || '',
          localImagePrompt: r.imagePrompt || '',
        }))
      }

      // ─── 回填场景图片（带 spec 信息） ───
      const sceneMap = new Map(p.aiSceneSpecs?.map((s: any) => [s.sceneName, s]) || [])
      if (p.sceneImages?.length) {
        state.workspace.scenes = p.sceneImages.map((si: any) => {
          const spec = sceneMap.get(si.sceneName)
          const imgUrl = si.imageUrl?.includes('volces.com') ? '/api/proxy/image?url=' + encodeURIComponent(si.imageUrl) : si.imageUrl
          return {
            id: `scene_cos_${si.sceneName}_${si.id}`,
            name: si.sceneName || '',
            environment: spec?.description || '',
            atmosphere: '',
            timeOfDay: '',
            description: spec?.description || '',
            locked: false,
            imageUrl: imgUrl,
            imagePrompt: spec?.imagePrompt || '',
            localImagePrompt: spec?.imagePrompt || spec?.description || '',
            lighting: '',
            type: '',
          }
        })
      } else {
        state.workspace.scenes = sceneRefs.map((r: any) => ({
          id: r.id,
          name: r.name,
          environment: r.description || '',
          atmosphere: '',
          timeOfDay: '',
          description: r.description || '',
          locked: false,
          imageUrl: '',
          imagePrompt: r.imagePrompt || '',
          localImagePrompt: r.imagePrompt || r.description || '',
          lighting: '',
          type: '',
        }))
      }

      // ─── 回填 segments（优先用 aiVideoSegments，没有则从 executionResults.videoSegments 读取） ───
      const rawSegments = (p.aiVideoSegments?.length ? p.aiVideoSegments : p.executionResults?.videoSegments) || []
      if (rawSegments.length) {
        // ⭐ 从 aiFrameDesigns 提取 firstFramePrompt（如果有）
        const framePrompt = p.aiFrameDesigns?.[0]?.firstFramePrompt || ''
        state.workspace.segments = rawSegments.map((seg: any, idx: number) => {
          let scenes: string[] = []
          try { if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes) } catch {}
          return {
            id: seg.segmentId,
            title: seg.title || `段落 ${seg.sortOrder + 1}`,
            masterBeat: seg.emotionArc || '',
            duration: seg.duration || 10,
            timeline: [],
            characters: [],
            scenes,
            narrativePurpose: seg.fullText || seg.narrativePurpose || seg.description || '',
            fullText: seg.fullText || '',  // ⭐ 保留完整文本
            shotPattern: seg.shotPattern || '',
            emotionArc: seg.emotionArc || '',
            // ⭐ 回填 imagePrompt（优先使用 seg 自带的，否则用 frameDesign 的 firstFramePrompt 填到第一个 segment）
            imagePrompt: seg.imagePrompt || (idx === 0 ? framePrompt : ''),
            negativePrompt: seg.negativePrompt || '',
          }
        })
      }

      // ⭐ 恢复 storyboardImages（用于分镜页面恢复生成结果）
      if (p.storyboardImages?.length) {
        state.workspace.storyboardImages = p.storyboardImages.map((sbi: any) => ({
          id: sbi.id,
          segmentId: sbi.segmentId,
          imageUrl: sbi.imageUrl,
          prompt: sbi.prompt || '',
          negativePrompt: sbi.negativePrompt || '',
          createdAt: sbi.createdAt || new Date().toISOString(),
        }))
      }

      // ─── 回填素材库（角色图 + 场景图 + 分镜图） ───
      const assets: AssetEntry[] = []
      if (p.characterImages?.length) {
        for (const ci of p.characterImages) {
          assets.push({
            id: `asset_char_${ci.id}`,
            type: 'character',
            name: ci.characterName || '角色图',
            url: ci.imageUrl,
            thumbnail: ci.imageUrl,
            prompt: ci.characterName ? `角色：${ci.characterName}` : '角色图',
            tags: ['角色', ci.characterName || ''],
            version: 1,
            createdAt: ci.createdAt || new Date().toISOString(),
          })
        }
      }
      if (p.sceneImages?.length) {
        for (const si of p.sceneImages) {
          assets.push({
            id: `asset_scene_${si.id}`,
            type: 'scene',
            name: si.sceneName || '场景图',
            url: si.imageUrl,
            thumbnail: si.imageUrl,
            prompt: si.sceneName ? `场景：${si.sceneName}` : '场景图',
            tags: ['场景', si.sceneName || ''],
            version: 1,
            createdAt: si.createdAt || new Date().toISOString(),
          })
        }
      }
      if (p.storyboardImages?.length) {
        for (const sbi of p.storyboardImages) {
          assets.push({
            id: `asset_sb_${sbi.id}`,
            type: 'storyboard',
            name: sbi.segmentId || '分镜图',
            url: sbi.imageUrl,
            thumbnail: sbi.imageUrl,
            prompt: sbi.segmentId || '分镜图',
            tags: ['分镜', sbi.segmentId || ''],
            version: 1,
            createdAt: sbi.createdAt || new Date().toISOString(),
          })
        }
      }
      // ─── 回填道具图到素材库 ───
      if (p.propImages?.length) {
        for (const pi of p.propImages) {
          assets.push({
            id: `asset_prop_${pi.id}`,
            type: 'prop',
            name: pi.propName || '道具图',
            url: pi.imageUrl,
            thumbnail: pi.imageUrl,
            prompt: pi.description || pi.propName || '道具图',
            tags: ['道具', pi.category || '', pi.propName || ''].filter(Boolean),
            version: 1,
            createdAt: pi.createdAt || new Date().toISOString(),
          })
        }
      }
      if (assets.length > 0) {
        state.assets.assets = assets
      }

      // ─── 从 Asset 表加载视频素材 ───
      try {
        const assetRes = await fetch(`/api/projects/${projectId}/assets`, {
          headers: authHeaders(),
        })
        if (assetRes.ok) {
          const assetJson = await assetRes.json()
          if (assetJson.success && assetJson.assets?.length) {
            for (const a of assetJson.assets) {
              // 去重：避免和上面的 assets 重复
              const exists = state.assets.assets.some(e => e.dbId === a.id || e.url === a.filePath)
              if (!exists) {
                state.assets.assets.push({
                  id: `asset_db_video_${a.id}`,
                  dbId: a.id,
                  type: 'video',
                  name: a.fileName || '生成视频',
                  url: a.filePath,
                  thumbnail: a.thumbnailPath || '',
                  prompt: `视频片段 ${a.taskId || ''}`,
                  tags: ['视频'],
                  version: 1,
                  createdAt: a.createdAt || new Date().toISOString(),
                })
              }
            }
          }
        }
      } catch (e) {
        console.warn('[loadFromServer] ⚠️ 加载视频素材失败:', e)
      }

      return true
    } catch (err: any) {
      console.error('[loadFromServer]', err.message)
      return false
    }
  }

  /** 保存图片到 COS */
  async function saveImageToCos(params: {
    sourceUrl: string
    characterName?: string
    sceneName?: string
    segmentId?: string
  }): Promise<string | null> {
    if (!state.projectId) return null
    try {
      const res = await fetch(`/api/v2/workbench/project/${state.projectId}/save-image`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error(`保存图片到 COS 失败: ${res.status}`)
      const json = await res.json()
      return json.data?.cosUrl || null
    } catch (err: any) {
      console.error('[saveImageToCos]', err.message)
      return null
    }
  }

  /** 保存视频到 COS */
  async function saveVideoToCos(params: {
    sourceUrl: string
    segmentId: string
  }): Promise<string | null> {
    if (!state.projectId) return null
    try {
      const res = await fetch(`/api/v2/workbench/project/${state.projectId}/save-video`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error(`保存视频到 COS 失败: ${res.status}`)
      const json = await res.json()
      return json.data?.cosUrl || null
    } catch (err: any) {
      console.error('[saveVideoToCos]', err.message)
      return null
    }
  }

  /** 获取用户项目列表 */
  async function fetchProjectList(): Promise<any[]> {
    try {
      const res = await fetch('/api/v2/workbench/projects', {
        headers: authHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    } catch {
      return []
    }
  }

  /** 删除项目（清空剧本数据，保留已生成文件） */
  async function deleteProject(projectId: string): Promise<boolean> {
    try {
      const token = getAuthToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      // DELETE 不传 Content-Type（避免 Fastify 空 JSON body 拒绝）
      const res = await fetch(`/api/v2/workbench/project/${projectId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error(`删除项目失败: ${res.status}`)
      if (state.projectId === projectId) {
        state.projectId = ''
        state.workspace.narrative = createEmptyNarrative()
        state.workspace.characters = []
        state.workspace.scenes = []
      }
      return true
    } catch (err: any) {
      console.error('[deleteProject]', err.message)
      return false
    }
  }

  return {
    state,
    activeStage,
    activeWorkspace,
    filteredAssets: computed(() => {
      const ac = state.assets.activeCategory
      if (ac === 'all') return state.assets.assets
      return state.assets.assets.filter(a => a.type === ac)
    }),
    activeSegmentIndex: computed(() => state.activeSegmentIndex),
    compiledPromptSegments: computed(() => state.execution.compiledPrompts),
    projectId: computed(() => state.projectId),
    goToStage,
    updateStageStatus,
    updateNarrative,
    setNarrative,
    videoStyle,
    aspectRatio,
    styleLocked,
    setVideoStyle,
    setAspectRatio,
    toggleStyleLock,
    setCharacters,
    addCharacter,
    updateCharacter,
    setScenes,
    addScene,
    updateScene,
    setActiveSegment,
    setSegments,
    updateSegment,
    updateTimelineFrame,
    setAssets,
    addAsset,
    removeAsset,
    setAssetCategory,
    toggleAssetSidebar,
    setCompiledPromptSegments,
    addCompiledPrompt,
    setProjectId,
    // Server persistence
    saveToServer,
    loadFromServer,
    saveImageToCos,
    saveVideoToCos,
    fetchProjectList,
    deleteProject,
  }
}
