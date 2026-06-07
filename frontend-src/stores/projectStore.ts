// ─── Project Store — 火麒麟 AI Production Studio ───
// 统一管理：当前项目、项目类型、项目状态、角色数据、剧情数据、工作流状态、渲染状态、Agent状态

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Project Types ──────────────────────────────────────
export type ProjectType = 'drama' | 'portrait' | 'anime' | 'cinematic' | 'ad' | 'shopping'
export type ProjectStatus = 'idle' | 'planning' | 'generating' | 'rendering' | 'compositing' | 'exporting' | 'completed' | 'failed'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  drama: '短剧',
  portrait: 'AI写真',
  anime: '动漫',
  cinematic: '电影镜头',
  ad: '广告片',
  shopping: '带货视频',
}

export const PROJECT_TYPE_ICONS: Record<ProjectType, string> = {
  drama: '🎬',
  portrait: '📸',
  anime: '🎨',
  cinematic: '🎥',
  ad: '📢',
  shopping: '🛍️',
}

export interface ProjectCharacter {
  id: string
  name: string
  avatar?: string
  gender: 'male' | 'female' | 'other'
  dna: Record<string, any> // 角色DNA
  memory: CharacterMemory[]
  costumeIds: string[]
}

export interface CharacterMemory {
  id: string
  episodeId: string
  sceneId: string
  content: string
  emotion: string
  timestamp: string
}

export interface EpisodeData {
  id: string
  index: number
  title: string
  scenes: SceneData[]
}

export interface SceneData {
  id: string
  episodeId: string
  index: number
  title: string
  location: string
  shots: ShotData[]
}

export interface ShotData {
  id: string
  sceneId: string
  index: number
  duration: number
  shotType: string
  description: string
  status: 'pending' | 'generating' | 'rendered' | 'completed' | 'error'
}

export interface CostumeConfig {
  id: string
  characterId: string
  name: string
  styleTag: string
  imageUrl?: string
  continuityAnchored: boolean
  sceneBindings: string[]
}

export interface DirectorDecision {
  cameraLanguage: string
  cameraMovementRules: string[]
  pacingRules: string
  emotionProfile: string
  styleInfluence: string
}

export interface WorkflowState {
  currentStep: string
  steps: WorkflowStep[]
  progress: number
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
}

export interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
}

export interface AgentState {
  directorAgent: { status: string; active: boolean }
  writerAgent: { status: string; active: boolean }
  cameraAgent: { status: string; active: boolean }
}

export interface ProjectInfo {
  id: string
  name: string
  description: string
  type: ProjectType
  status: ProjectStatus
  style: string
  targetPlatform: string
  aspectRatio: string
  duration: number
  outputQuality: string
  mode: 'auto' | 'semi-auto' | 'professional'
  models: {
    image: string
    video: string
    llm: string
  }
  coverImage?: string
  videoCount: number
  aiScore: number
  isFavorite: boolean
  progress: number
  createdAt: string
  updatedAt: string
}

export const useProjectStore = defineStore('projectNew', () => {
  // ─── State ─────────────────────────────────
  const currentProject = ref<ProjectInfo | null>(null)
  const projects = ref<ProjectInfo[]>([])
  const characters = ref<ProjectCharacter[]>([])
  const episodes = ref<EpisodeData[]>([])
  const costumes = ref<CostumeConfig[]>([])
  const directorDecision = ref<DirectorDecision | null>(null)
  const workflow = ref<WorkflowState>({
    currentStep: '',
    steps: [],
    progress: 0,
    status: 'idle',
  })
  const agentState = ref<AgentState>({
    directorAgent: { status: 'idle', active: false },
    writerAgent: { status: 'idle', active: false },
    cameraAgent: { status: 'idle', active: false },
  })
  const renderState = ref<{
    status: string
    queue: any[]
    activeJobs: number
    completedJobs: number
    failedJobs: number
  }>({
    status: 'idle',
    queue: [],
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  })

  const searchQuery = ref('')
  const typeFilter = ref<string>('')
  const statusFilter = ref<string>('')

  // ─── Getters ───────────────────────────────
  const filteredProjects = computed(() => {
    let list = [...projects.value]
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    if (typeFilter.value) {
      list = list.filter(p => p.type === typeFilter.value)
    }
    if (statusFilter.value) {
      list = list.filter(p => p.status === statusFilter.value)
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  const favoriteProjects = computed(() => projects.value.filter(p => p.isFavorite))
  const activeProjectCount = computed(() => projects.value.filter(p => p.status !== 'completed' && p.status !== 'failed').length)

  // ─── Actions ───────────────────────────────
  function setCurrentProject(p: ProjectInfo | null) {
    currentProject.value = p
  }

  function setProjects(list: ProjectInfo[]) {
    projects.value = list
  }

  function addProject(info: Omit<ProjectInfo, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'videoCount' | 'aiScore'>): ProjectInfo {
    const newProject: ProjectInfo = {
      ...info,
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      progress: 0,
      videoCount: 0,
      aiScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    projects.value.unshift(newProject)
    currentProject.value = newProject
    return newProject
  }

  function updateProject(id: string, patch: Partial<ProjectInfo>) {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx >= 0) {
      projects.value[idx] = { ...projects.value[idx], ...patch, updatedAt: new Date().toISOString() }
      if (currentProject.value?.id === id) {
        currentProject.value = projects.value[idx]
      }
    }
  }

  function toggleFavorite(id: string) {
    const p = projects.value.find(p => p.id === id)
    if (p) p.isFavorite = !p.isFavorite
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
    }
  }

  function cloneProject(id: string): ProjectInfo | null {
    const original = projects.value.find(p => p.id === id)
    if (!original) return null
    const clone: ProjectInfo = {
      ...original,
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${original.name} (副本)`,
      status: 'idle',
      progress: 0,
      videoCount: 0,
      aiScore: 0,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    projects.value.unshift(clone)
    return clone
  }

  function updateProgress(id: string, progress: number) {
    const p = projects.value.find(p => p.id === id)
    if (p) {
      p.progress = Math.max(0, Math.min(100, progress))
    }
  }

  function updateStatus(id: string, status: ProjectStatus) {
    const p = projects.value.find(p => p.id === id)
    if (p) p.status = status
  }

  // ─── Character Actions ─────────────────────
  function addCharacter(char: ProjectCharacter) {
    characters.value.push(char)
  }

  function updateCharacter(id: string, patch: Partial<ProjectCharacter>) {
    const idx = characters.value.findIndex(c => c.id === id)
    if (idx >= 0) {
      characters.value[idx] = { ...characters.value[idx], ...patch }
    }
  }

  function removeCharacter(id: string) {
    characters.value = characters.value.filter(c => c.id !== id)
  }

  // ─── Episode/Scene/Shot Actions ────────────
  function addEpisode(ep: EpisodeData) {
    episodes.value.push(ep)
  }

  function addScene(episodeId: string, scene: SceneData) {
    const ep = episodes.value.find(e => e.id === episodeId)
    if (ep) {
      ep.scenes.push(scene)
    }
  }

  function addShot(sceneId: string, shot: ShotData) {
    for (const ep of episodes.value) {
      const sc = ep.scenes.find(s => s.id === sceneId)
      if (sc) {
        sc.shots.push(shot)
        return
      }
    }
  }

  // ─── Workflow Actions ──────────────────────
  function initWorkflow(steps: string[]) {
    workflow.value = {
      currentStep: steps[0] || '',
      steps: steps.map((s, i) => ({
        id: `step-${i}`,
        name: s,
        status: 'pending' as const,
        progress: 0,
      })),
      progress: 0,
      status: 'idle',
    }
  }

  function setWorkflowStep(stepId: string, status: 'pending' | 'running' | 'completed' | 'error') {
    const step = workflow.value.steps.find(s => s.id === stepId)
    if (step) {
      step.status = status
      step.progress = status === 'completed' ? 100 : status === 'running' ? 50 : 0
    }
  }

  function updateWorkflowProgress(progress: number) {
    workflow.value.progress = Math.max(0, Math.min(100, progress))
  }

  // ─── Agent Actions ─────────────────────────
  function setAgentStatus(agent: keyof AgentState, status: string, active: boolean) {
    if (agentState.value[agent]) {
      agentState.value[agent] = { status, active }
    }
  }

  // ─── Costume Actions ───────────────────────
  function addCostume(costume: CostumeConfig) {
    costumes.value.push(costume)
  }

  function updateCostume(id: string, patch: Partial<CostumeConfig>) {
    const idx = costumes.value.findIndex(c => c.id === id)
    if (idx >= 0) {
      costumes.value[idx] = { ...costumes.value[idx], ...patch }
    }
  }

  // ─── Director Decision ─────────────────────
  function setDirectorDecision(dd: DirectorDecision) {
    directorDecision.value = dd
  }

  // ─── Reset ─────────────────────────────────
  function resetProject() {
    currentProject.value = null
    characters.value = []
    episodes.value = []
    costumes.value = []
    directorDecision.value = null
    workflow.value = { currentStep: '', steps: [], progress: 0, status: 'idle' }
    agentState.value = {
      directorAgent: { status: 'idle', active: false },
      writerAgent: { status: 'idle', active: false },
      cameraAgent: { status: 'idle', active: false },
    }
    renderState.value = { status: 'idle', queue: [], activeJobs: 0, completedJobs: 0, failedJobs: 0 }
  }

  return {
    // State
    currentProject, projects, characters, episodes, costumes,
    directorDecision, workflow, agentState, renderState,
    searchQuery, typeFilter, statusFilter,
    // Getters
    filteredProjects, favoriteProjects, activeProjectCount,
    // Actions
    setCurrentProject, setProjects, addProject, updateProject,
    toggleFavorite, deleteProject, cloneProject,
    updateProgress, updateStatus,
    addCharacter, updateCharacter, removeCharacter,
    addEpisode, addScene, addShot,
    initWorkflow, setWorkflowStep, updateWorkflowProgress,
    setAgentStatus, addCostume, updateCostume,
    setDirectorDecision, resetProject,
  }
})
