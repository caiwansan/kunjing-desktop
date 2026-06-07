<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="ms-overlay" @click.self="$emit('close')">
      <div class="ms-modal">
        <!-- Header -->
        <div class="ms-header">
          <h3 class="ms-title">🧩 大模型设置</h3>
          <p class="ms-desc">{{ isDesktop ? '💻 桌面版 — 支持本地在线双模式' : '每类模型可独立选择供应商和模型' }}</p>
          <button class="ms-close" @click="$emit('close')">✕</button>
        </div>

        <!-- Body -->
        <div class="ms-body">
          <!-- ⭐ 钻石VIP / 本地模式入口（仅桌面版显示） -->
          <div v-if="isDesktop" class="ms-mode-bar">
            <div class="ms-mode-label">
              <span class="ms-mode-icon">{{ localMode ? '🖥️' : '☁️' }}</span>
              <span>运行模式：<strong>{{ localMode ? '本地模式（离线）' : '云端在线' }}</strong></span>
            </div>
            <div class="ms-mode-actions">
              <span v-if="!isPro" class="ms-pro-tag" @click="goMembership">👑 开通钻石VIP以解锁本地模型</span>
              <label v-else class="ms-toggle">
                <input type="checkbox" v-model="localMode" @change="onModeToggle" />
                <span class="ms-toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Ollama 状态（本地模式 & 桌面版） -->
          <div v-if="localMode && isDesktop" class="ms-ollama-status" :class="{ 'ms-ollama-status--ok': ollamaRunning, 'ms-ollama-status--err': !ollamaRunning }">
            <div class="ms-ollama-left">
              <span class="ms-ollama-dot"></span>
              <span>{{ ollamaRunning ? `Ollama 运行中 · ${ollamaModels.length} 个本地模型` : 'Ollama 未运行' }}</span>
            </div>
            <button v-if="!ollamaRunning" class="ms-ollama-btn" @click="checkOllama">刷新检测</button>
          </div>

          <!-- 云端模式卡片（原内容） -->
          <template v-if="!localMode">
            <div class="ms-cards">
              <div v-for="(card, idx) in modelCards" :key="card.key" class="ms-card">
                <!-- 卡片头部 -->
                <div class="ms-card-header">
                  <div class="ms-card-title">
                    <span class="ms-card-icon">{{ card.icon }}</span>
                    <span class="ms-card-label">{{ card.label }}</span>
                  </div>
                  <label class="ms-toggle">
                    <input type="checkbox" v-model="card.enabled" @change="onCardToggle(idx)" />
                    <span class="ms-toggle-slider"></span>
                  </label>
                </div>

                <!-- 卡片体 -->
                <div class="ms-card-body" :class="{ 'ms-card-body--disabled': !card.enabled }">
                  <!-- 供应商 -->
                  <div class="ms-row">
                    <label class="ms-sublabel">供应商</label>
                    <template v-if="card.key === 'music'">
                      <select v-model="card.provider" class="ms-select" @change="onProviderChange(idx)">
                        <option value="">-- 选择供应商 --</option>
                        <option v-for="p in musicProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
                      </select>
                    </template>
                    <template v-else>
                      <select v-model="card.provider" class="ms-select" @change="onProviderChange(idx)">
                        <option value="">-- 选择供应商 --</option>
                        <option v-for="p in availableProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
                      </select>
                    </template>
                  </div>

                  <!-- 模型 -->
                  <div class="ms-row">
                    <label class="ms-sublabel">模型</label>
                    <template v-if="card.provider === 'custom'">
                      <input v-model="card.modelName" type="text" class="ms-input" placeholder="输入模型名（如 gpt-4o-mini）" />
                    </template>
                    <template v-else>
                      <select v-model="card.modelName" class="ms-select">
                        <option value="">-- 先选供应商 --</option>
                        <option v-for="m in getModelsForCard(card)" :key="m.name" :value="m.name">{{ m.label || m.name }}</option>
                      </select>
                    </template>
                  </div>

                  <!-- API Key -->
                  <div v-if="card.provider !== 'custom'" class="ms-row">
                    <label class="ms-sublabel">API Key</label>
                    <div class="ms-key-wrap">
                      <div v-if="card.keyConfigured && !card.editingKey" class="ms-key-configured-inline">
                        <span class="ms-key-dot">●</span>
                        <span class="ms-key-masked">••••••••</span>
                        <button class="ms-key-sm-btn" @click="card.editingKey = true; card.apiKeyInput = ''">更换</button>
                      </div>
                      <div v-else class="ms-key-edit-inline">
                        <input v-model="card.apiKeyInput" :type="card.showKey ? 'text' : 'password'" class="ms-input ms-input--key" placeholder="API Key" />
                        <button class="ms-key-eye" @click="card.showKey = !card.showKey">{{ card.showKey ? '🙈' : '👁️' }}</button>
                      </div>
                    </div>
                  </div>

                  <!-- 自定义端点（BYO — 每类独立配置） -->
                  <div v-if="card.provider === 'custom'" class="ms-row">
                    <label class="ms-sublabel">API 地址（自定义端点）</label>
                    <input v-model="card.baseUrlInput" type="text" class="ms-input" placeholder="https://api.openai.com/v1" />
                    <div class="ms-row-hint">自定义 OpenAI 兼容 API 端点。如：https://api.deepseek.com、http://localhost:11434/v1</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 本地模式卡片 -->
          <template v-else>
            <div class="ms-cards ms-cards--local">
              <div v-for="card in localCards" :key="card.key" class="ms-card">
                <div class="ms-card-header">
                  <div class="ms-card-title">
                    <span class="ms-card-icon">{{ card.icon }}</span>
                    <span class="ms-card-label">{{ card.label }}</span>
                  </div>
                  <label class="ms-toggle">
                    <input type="checkbox" v-model="card.enabled" @change="saveLocalConfig" />
                    <span class="ms-toggle-slider"></span>
                  </label>
                </div>

                <div class="ms-card-body" :class="{ 'ms-card-body--disabled': !card.enabled }">
                  <!-- 本地模型下拉（从 Ollama 获取） -->
                  <div class="ms-row">
                    <label class="ms-sublabel">本地模型</label>
                    <select v-model="card.modelName" class="ms-select" @change="saveLocalConfig">
                      <option value="">-- 选择本地模型 --</option>
                      <option v-for="m in ollamaModels" :key="m.name" :value="m.name">{{ m.name }}</option>
                    </select>
                  </div>
                  <!-- Ollama 端点是固定的 localhost:11434，隐藏 baseUrl -->
                  <div class="ms-row ms-hint">
                    <span class="ms-hint-text">🔗 自动连接本地 Ollama (http://127.0.0.1:11434)</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 保存按钮 -->
          <div class="ms-save-bar">
            <div v-if="statusMsg" class="ms-status" :class="{ 'ms-status--err': statusIsErr }">{{ statusMsg }}</div>
            <button class="ms-btn ms-btn-save" :disabled="saving" @click="handleSaveAll">
              {{ saving ? '⏳ 保存全部...' : '💾 保存全部配置' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue"

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const saving = ref(false)
const statusMsg = ref("")
const statusIsErr = ref(false)
const providerList = ref<any[]>([])

// ========== 桌面版 / 会员检测 ==========
const isDesktop = ref(typeof window !== 'undefined' && !!(window as any).electronAPI)
const isPro = ref(false)
const localMode = ref(false)
const ollamaRunning = ref(false)
const ollamaModels = ref<any[]>([])

async function checkMemberTier() {
  try {
    const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
    if (!token) return false
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return false
    const data = await res.json()
    const tier = data.user?.memberTier || ''
    isPro.value = tier === 'Pro' || tier === 'director'
    return isPro.value
  } catch { return false }
}

async function checkOllama() {
  try {
    const res = await fetch('/api/desktop/ollama/check')
    const data = await res.json()
    ollamaRunning.value = data.running
    ollamaModels.value = data.models || []
  } catch {
    ollamaRunning.value = false
    ollamaModels.value = []
  }
}

function goMembership() {
  window.location.href = '/user/membership'
}

function onModeToggle() {
  if (localMode.value) {
    checkOllama()
  }
}

// ========== 本地模式卡片 ==========
interface LocalCard {
  key: string
  icon: string
  label: string
  enabled: boolean
  modelName: string
}

const localCards = reactive<LocalCard[]>([
  { key: 'llm', icon: '🧠', label: '语言模型 (LLM)', enabled: true, modelName: '' },
  { key: 'image', icon: '🎨', label: '图片模型 (SD/ComfyUI)', enabled: false, modelName: '' },
  { key: 'video', icon: '🎬', label: '视频模型', enabled: false, modelName: '' },
  { key: 'tts', icon: '🔊', label: '语音模型 (TTS)', enabled: false, modelName: '' },
])

function saveLocalConfig() {
  // 本地模式配置存 localStorage
  const config: Record<string, any> = {}
  for (const card of localCards) {
    config[card.key] = { enabled: card.enabled, model: card.modelName }
  }
  localStorage.setItem('local_mode_config', JSON.stringify(config))
  statusMsg.value = '✅ 本地配置已保存'
  statusIsErr.value = false
  setTimeout(() => { statusMsg.value = '' }, 2000)
}

function loadLocalConfig() {
  try {
    const raw = localStorage.getItem('local_mode_config')
    if (!raw) return
    const config = JSON.parse(raw)
    for (const card of localCards) {
      const c = config[card.key]
      if (c) {
        card.enabled = c.enabled
        card.modelName = c.model || ''
      }
    }
  } catch {}
}

// ========== 云端模式卡片 ==========
interface ModelCard {
  key: string
  icon: string
  label: string
  enabled: boolean
  provider: string
  modelName: string
  enabledField: string
  modelField: string
  apiKeyInput: string
  keyConfigured: boolean
  editingKey: boolean
  showKey: boolean
  baseUrlInput: string
}

const modelCards = reactive<ModelCard[]>([
  { key:"llm", icon:"🧠", label:"语言模型 (LLM)", enabled:true, provider:"", modelName:"",
    enabledField:"llmEnabled", modelField:"llmModel",
    apiKeyInput:"", keyConfigured:false, editingKey:true, showKey:false, baseUrlInput:"" },
  { key:"image", icon:"🎨", label:"图片模型 (文生图 / 图生图)", enabled:true, provider:"", modelName:"",
    enabledField:"imageEnabled", modelField:"imageModel",
    apiKeyInput:"", keyConfigured:false, editingKey:true, showKey:false, baseUrlInput:"" },
  { key:"video", icon:"🎬", label:"视频模型", enabled:true, provider:"", modelName:"",
    enabledField:"videoEnabled", modelField:"videoModel",
    apiKeyInput:"", keyConfigured:false, editingKey:true, showKey:false, baseUrlInput:"" },
  { key:"tts", icon:"🔊", label:"语音模型 (TTS)", enabled:true, provider:"", modelName:"",
    enabledField:"ttsEnabled", modelField:"ttsModel",
    apiKeyInput:"", keyConfigured:false, editingKey:true, showKey:false, baseUrlInput:"" },
  { key:"music", icon:"🎵", label:"音乐模型（生成配乐）", enabled:false, provider:"", modelName:"",
    enabledField:"musicEnabled", modelField:"musicModel",
    apiKeyInput:"", keyConfigured:false, editingKey:true, showKey:false, baseUrlInput:"" },
])

// 音乐模型可选供应商
const musicProviders = [
  { id: 'suno', name: 'Suno AI' },
  { id: 'tiangong', name: '天工音乐（昆仑万维）' },
  { id: 'mureka', name: 'Mureka' },
]

const availableProviders = computed(() => {
  return providerList.value.map((p: any) => ({ id: p.provider, name: p.providerName }))
})

async function loadUnifiedConfig() {
  try {
    const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
    if (!token) return
    const res = await fetch("/api/v2/user/model-config/unified", {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    if (!json.success || !json.data) return
    const data = json.data
    for (const card of modelCards) {
      const k = card.key
      const provField = k + "Provider"
      if (data[provField]) card.provider = data[provField]
      if (data[card.modelField]) card.modelName = data[card.modelField]
      if (data[card.enabledField] !== undefined) card.enabled = data[card.enabledField]
      const hasKeyField = "has" + k.charAt(0).toUpperCase() + k.slice(1) + "ApiKey"
      card.keyConfigured = data[hasKeyField] || false
      if (card.keyConfigured) card.editingKey = false
      if (card.provider === "custom" && data.baseUrl) card.baseUrlInput = data.baseUrl
      // ⭐ BYO: per-capability baseUrl
      const perCapBaseUrlKey = card.key + "BaseUrl"
      if (card.provider === "custom" && data[perCapBaseUrlKey]) {
        card.baseUrlInput = data[perCapBaseUrlKey]
      }
    }
  } catch (e) {
    console.warn("[ModelSettings] loadUnifiedConfig error:", e)
  }
}

function getModelsForCard(card: ModelCard): any[] {
  // 音乐卡：使用硬编码的模型列表
  if (card.key === 'music') {
    const musicModelMap: Record<string, any[]> = {
      suno: [
        { name: 'suno-v4', label: 'Suno v4（推荐）' },
        { name: 'suno-v3.5', label: 'Suno v3.5' },
        { name: 'suno-chirp', label: 'Suno Chirp' },
      ],
      tiangong: [
        { name: 'tiangong-v2', label: '天工音乐 v2' },
        { name: 'tiangong-v1', label: '天工音乐 v1' },
      ],
      mureka: [
        { name: 'mureka-v8', label: 'Mureka v8' },
        { name: 'mureka-v7', label: 'Mureka v7' },
        { name: 'mureka-o1', label: 'Mureka O1' },
      ],
    }
    return musicModelMap[card.provider] || []
  }

  const prov = providerList.value.find((p: any) => p.provider === card.provider)
  if (!prov?.models) return []
  return prov.models
    .filter((m: any) => m.type === card.key)
    .map((m: any) => ({ name: m.id, label: m.name || m.id }))
}

async function loadProviders() {
  try {
    const res = await fetch("/api/public/global-models")
    const json = await res.json()
    if (json.success && Array.isArray(json.providers)) {
      providerList.value = json.providers
    }
  } catch (e) {
    console.warn("[ModelSettings] loadProviders error:", e)
  }
}

async function onProviderChange(idx: number) {
  const card = modelCards[idx]
  card.modelName = ""
  card.apiKeyInput = ""
  card.keyConfigured = false
  card.editingKey = true
  card.baseUrlInput = ""
  await saveUnified()
  await loadUnifiedConfig()
}

function onCardToggle(idx: number) {
  const card = modelCards[idx]
  if (card.key === 'music') {
    // 音乐卡 toggle 立即保存
    saveUnified()
  }
  if (card.enabled) loadUnifiedConfig()
}

async function saveUnified() {
  const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
  if (!token) return
  const providerMap: Record<string, string> = {}
  const modelMap: Record<string, string> = {}
  const apiKeys: Record<string, string> = {}
  const enabledMap: Record<string, boolean> = {}
  for (const card of modelCards) {
    const provVal = card.provider
    if (provVal) providerMap[card.key] = provVal
    else if (card.key === "llm") providerMap[card.key] = ""
    else if (card.key === "music") providerMap[card.key] = ""  // 音乐模型不设默认 provider
    else providerMap[card.key] = "volcengine"
    if (card.modelName) modelMap[card.key] = card.modelName
    if (card.apiKeyInput) apiKeys[card.key] = card.apiKeyInput
    enabledMap[card.key] = card.enabled
  }
  // ⭐ BYO: 构造 per-capability baseUrl map
  const baseUrlMap: Record<string, string> = {}
  for (const card of modelCards) {
    if (card.provider === 'custom' && card.baseUrlInput) {
      baseUrlMap[card.key] = card.baseUrlInput
    }
  }
  return fetch("/api/v2/user/model-config/unified", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ providerMap, modelMap, apiKeys, enabledMap, baseUrlMap }),
  })
}

async function handleSaveAll() {
  saving.value = true
  statusMsg.value = ""
  statusIsErr.value = false
  const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
  if (!token) {
    statusMsg.value = "请先登录"
    statusIsErr.value = true
    saving.value = false
    return
  }
  try {
    const res = await saveUnified()
    if (!res) return
    const json = await res.json()
    if (!json.success) {
      statusMsg.value = `❌ 保存失败: ${json.error || ""}`
      statusIsErr.value = true
    } else {
      const data = json.data
      for (const card of modelCards) {
        const k = card.key
        const hasKeyField = "has" + k.charAt(0).toUpperCase() + k.slice(1) + "ApiKey"
        if (data[hasKeyField]) {
          card.keyConfigured = true
          card.editingKey = false
        }
      }
      statusMsg.value = "✅ 全部配置已保存！"
      statusIsErr.value = false
    }
  } catch (e: any) {
    statusMsg.value = `❌ 保存失败: ${e.message}`
    statusIsErr.value = true
  }
  saving.value = false
}

onMounted(() => {
  loadProviders()
  setTimeout(() => loadUnifiedConfig(), 300)
  loadLocalConfig()

  // 检测是否为桌面环境
  isDesktop.value = typeof window !== 'undefined' && !!(window as any).electronAPI

  // 检测会员等级
  checkMemberTier()
})

watch(() => props.visible, (val) => {
  if (val) {
    statusMsg.value = ""
    statusIsErr.value = false
    modelCards.forEach(c => { c.editingKey = true; c.showKey = false; c.apiKeyInput = "" })
    nextTick(() => {
      loadProviders()
      setTimeout(() => loadUnifiedConfig(), 300)
      loadLocalConfig()
      checkMemberTier()
      if (localMode.value) checkOllama()
    })
  }
})
</script>

<style scoped>
/* ======= 覆盖层 ======= */
.ms-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.ms-modal {
  background: #0f1525;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  width: 680px;
  max-width: 94vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

/* ======= Header ======= */
.ms-header {
  position: relative;
  padding: 22px 28px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ms-title {
  font-size: 1rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0;
}
.ms-desc {
  font-size: 0.7rem;
  color: #71717a;
  margin: 4px 0 0;
}
.ms-close {
  position: absolute;
  top: 14px; right: 14px;
  width: 28px; height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  color: #71717a;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.ms-close:hover { color: #e4e4e7; background: rgba(255,255,255,0.06); }

/* ======= Body ======= */
.ms-body {
  padding: 18px 24px;
  overflow-y: auto;
  flex: 1;
}

/* ======= 模式切换栏 ======= */
.ms-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.ms-mode-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #e4e4e7;
}
.ms-mode-icon { font-size: 1rem; }
.ms-mode-actions { display: flex; align-items: center; gap: 10px; }
.ms-pro-tag {
  display: inline-block;
  font-size: 0.68rem;
  color: #f59e0b;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.15);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.ms-pro-tag:hover {
  background: rgba(245,158,11,0.12);
  border-color: rgba(245,158,11,0.25);
}

/* ======= Ollama 状态 ======= */
.ms-ollama-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 0.75rem;
}
.ms-ollama-status--ok {
  background: rgba(34,197,94,0.06);
  border: 1px solid rgba(34,197,94,0.12);
  color: #22c55e;
}
.ms-ollama-status--err {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.12);
  color: #ef4444;
}
.ms-ollama-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-ollama-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.ms-ollama-status--ok .ms-ollama-dot { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
.ms-ollama-status--err .ms-ollama-dot { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.4); }
.ms-ollama-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.68rem;
  color: #a1a1aa;
  cursor: pointer;
}
.ms-ollama-btn:hover { border-color: #52525b; color: #e4e4e7; }

/* ======= 四类卡片 ======= */
.ms-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ms-cards--local .ms-card {
  opacity: 0.9;
}
.ms-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow: hidden;
}

.ms-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ms-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-card-icon { font-size: 1.1rem; }
.ms-card-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #e4e4e7;
}

.ms-card-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity 0.2s;
}
.ms-card-body--disabled {
  opacity: 0.35;
  pointer-events: none;
}

.ms-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ms-sublabel {
  font-size: 0.62rem;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 600;
}
.ms-hint {
  margin-top: 2px;
}
.ms-hint-text {
  font-size: 0.65rem;
  color: #52525b;
}

/* ======= 表单控件 ======= */
.ms-select, .ms-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  color: #e4e4e7;
  outline: none;
  width: 100%;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.ms-select:focus, .ms-input:focus { border-color: #3b82f6; }
.ms-select option { background: #0f1525; color: #e4e4e7; }
.ms-input::placeholder { color: #71717a; opacity: 0.5; }

/* ======= API Key 行内 ======= */
.ms-key-wrap { display: flex; align-items: center; gap: 6px; }
.ms-key-configured-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(34,197,94,0.05);
  border: 1px solid rgba(34,197,94,0.15);
  border-radius: 8px;
  padding: 6px 12px;
  width: 100%;
}
.ms-key-dot { color: #22c55e; font-size: 0.6rem; }
.ms-key-masked {
  font-family: monospace;
  font-size: 0.8rem;
  color: #22c55e;
  letter-spacing: 1px;
  flex: 1;
}
.ms-key-sm-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px;
  padding: 2px 10px;
  font-size: 0.68rem;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s;
}
.ms-key-sm-btn:hover { border-color: #3b82f6; color: #e4e4e7; }

.ms-key-edit-inline {
  display: flex;
  gap: 6px;
  width: 100%;
}
.ms-input--key { flex: 1; }
.ms-key-eye {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  color: #71717a;
  transition: all 0.2s;
}
.ms-key-eye:hover { background: rgba(255,255,255,0.08); }

/* ======= Toggle ======= */
.ms-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
  display: inline-block;
}
.ms-toggle input { display: none; }
.ms-toggle-slider {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  transition: all 0.3s;
}
.ms-toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: #52525b;
  border-radius: 50%;
  transition: all 0.3s;
}
.ms-toggle input:checked + .ms-toggle-slider { background: rgba(59,130,246,0.4); }
.ms-toggle input:checked + .ms-toggle-slider::before { transform: translateX(16px); background: #3b82f6; }

/* ======= 保存栏 ======= */
.ms-save-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.ms-status {
  font-size: 0.72rem;
  color: #22c55e;
  background: rgba(34,197,94,0.06);
  padding: 5px 12px;
  border-radius: 6px;
}
.ms-status--err { color: #ef4444; background: rgba(239,68,68,0.06); }

.ms-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}
.ms-btn-save {
  background: linear-gradient(135deg,#3b82f6,#2563eb);
  color: #fff;
}
.ms-btn-save:hover:not(:disabled) {
  background: linear-gradient(135deg,#60a5fa,#3b82f6);
  transform: translateY(-1px);
}
.ms-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* ======= 弹窗动画 ======= */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
