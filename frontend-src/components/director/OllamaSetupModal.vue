<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="ol-overlay" @click.self="$emit('close')">
      <div class="ol-modal">
        <!-- Header -->
        <div class="ol-header">
          <h3 class="ol-title">🦙 本地大模型设置</h3>
          <p class="ol-desc">接入本地 Ollama 服务，离线使用大模型</p>
          <button class="ol-close" @click="$emit('close')">✕</button>
        </div>

        <div class="ol-body">
          <!-- 安装检测状态 -->
          <div class="ol-section">
            <div class="ol-section-title">① 检测环境</div>
            <div class="ol-status-cards">
              <div class="ol-status-card" :class="ollamaInstalled ? 'ol-status--ok' : 'ol-status--err'">
                <span class="ol-status-icon">{{ ollamaInstalled ? '✅' : '❌' }}</span>
                <div class="ol-status-info">
                  <div class="ol-status-label">Ollama 已安装</div>
                  <div class="ol-status-desc">{{ ollamaInstalled ? '在系统中找到 Ollama' : '未检测到 Ollama' }}</div>
                </div>
                <button v-if="!ollamaInstalled" class="ol-action-btn" @click="downloadOllama">
                  {{ osName === 'mac' ? '下载 macOS 版' : osName === 'win' ? '下载 Windows 版' : '下载 Linux 版' }}
                </button>
              </div>

              <div class="ol-status-card" :class="ollamaRunning ? 'ol-status--ok' : 'ol-status--warn'">
                <span class="ol-status-icon">{{ ollamaRunning ? '✅' : '⏸️' }}</span>
                <div class="ol-status-info">
                  <div class="ol-status-label">Ollama 服务运行中</div>
                  <div class="ol-status-desc">{{ ollamaRunning ? `已检测到 ${ollamaModels.length} 个模型` : '需要启动 ollama serve' }}</div>
                </div>
                <button v-if="!ollamaRunning && ollamaInstalled" class="ol-action-btn" @click="startOllama">
                  启动服务
                </button>
              </div>
            </div>
          </div>

          <!-- 模型管理 -->
          <div class="ol-section">
            <div class="ol-section-title">② 管理本地模型</div>

            <!-- 已安装模型 -->
            <div v-if="ollamaModels.length > 0" class="ol-model-list">
              <div v-for="m in ollamaModels" :key="m.name" class="ol-model-item">
                <span class="ol-model-name">{{ m.name }}</span>
                <span class="ol-model-size">{{ formatSize(m.size) }}</span>
                <button class="ol-model-del" @click="deleteModel(m.name)">删除</button>
              </div>
            </div>
            <div v-else class="ol-empty-hint">
              <p v-if="ollamaRunning">暂无已安装的模型，从下方拉取一个</p>
              <p v-else>启动 Ollama 服务后显示本地模型</p>
            </div>

            <!-- 拉取新模型 -->
            <div class="ol-pull-row" v-if="ollamaRunning">
              <select v-model="selectedPullModel" class="ol-select">
                <option value="">-- 选择推荐模型 --</option>
                <option v-for="m in recommendModels" :key="m.name" :value="m.name">
                  {{ m.label }} ({{ m.size }})
                </option>
              </select>
              <input
                v-model="customPullModel"
                class="ol-input"
                placeholder="或输入自定义模型名"
              />
              <button class="ol-btn ol-btn--primary" :disabled="pulling" @click="pullModel">
                {{ pulling ? '⏳ 拉取中...' : '📥 拉取模型' }}
              </button>
            </div>
            <div v-if="pullProgress" class="ol-pull-progress">{{ pullProgress }}</div>
          </div>

          <!-- 本地模型设置 -->
          <div class="ol-section">
            <div class="ol-section-title">③ 设置本地模型</div>
            <div class="ol-local-config">
              <div v-for="card in localModelCards" :key="card.key" class="ol-config-row">
                <div class="ol-config-label">
                  <span>{{ card.icon }}</span>
                  <span>{{ card.label }}</span>
                </div>
                <select v-model="card.modelName" class="ol-select ol-select--sm">
                  <option value="">-- 选择模型 --</option>
                  <option v-for="m in ollamaModels" :key="m.name" :value="m.name">{{ m.name }}</option>
                </select>
                <label class="ms-toggle">
                  <input type="checkbox" v-model="card.enabled" />
                  <span class="ms-toggle-slider"></span>
                </label>
              </div>
            </div>
            <button class="ol-btn ol-btn--primary ol-btn--full" @click="saveLocalConfig">
              💾 保存本地模型配置
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

// 环境检测
const ollamaInstalled = ref(false)
const ollamaRunning = ref(false)
const ollamaModels = ref<any[]>([])
const osName = ref('linux')
const pulling = ref(false)
const pullProgress = ref('')
const selectedPullModel = ref('')
const customPullModel = ref('')

// 推荐模型
const recommendModels = [
  { name: 'qwen2.5:7b', label: 'Qwen2.5 7B (推荐·中文好)', size: '4.7GB' },
  { name: 'qwen2.5:3b', label: 'Qwen2.5 3B (轻量·速度快)', size: '1.9GB' },
  { name: 'deepseek-r1:7b', label: 'DeepSeek R1 7B (编程强)', size: '4.7GB' },
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B (英语好)', size: '2.0GB' },
  { name: 'qwen2.5:14b', label: 'Qwen2.5 14B (更强·需大内存)', size: '8.9GB' },
]

// 本地模型配置
const localModelCards = reactive([
  { key: 'llm', icon: '🧠', label: '语言模型', enabled: true, modelName: '' },
  { key: 'tts', icon: '🔊', label: '语音模型（Edge TTS）', enabled: true, modelName: '' },
  { key: 'image', icon: '🎨', label: '图片模型（ComfyUI）', enabled: false, modelName: '' },
])

// 检测 Ollama 状态
async function checkOllama() {
  try {
    if ((window as any).electronAPI) {
      const installResult = await (window as any).electronAPI.ollamaInstallCheck()
      ollamaInstalled.value = installResult.installed
    }

    const res = await fetch('/api/desktop/ollama/check')
    const data = await res.json()
    ollamaRunning.value = data.running
    ollamaModels.value = data.models || []
  } catch {
    ollamaRunning.value = false
  }
}

// 下载 Ollama
function downloadOllama() {
  const urls: Record<string, string> = {
    mac: 'https://ollama.com/download/Ollama-darwin.zip',
    win: 'https://ollama.com/download/OllamaSetup.exe',
    linux: 'https://ollama.com/download/ollama-linux-amd64.tgz',
  }
  const url = urls[osName.value] || urls.linux
  if ((window as any).electronAPI) {
    (window as any).electronAPI.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

// 启动 Ollama（桌面端通过 electron shell）
function startOllama() {
  fetch('/api/desktop/ollama/check').then(r => r.json()).then(d => {
    if (d.running) {
      checkOllama()
    } else {
      // 提示用户手动启动
      alert('请在终端运行: ollama serve')
    }
  })
}

// 拉取模型
async function pullModel() {
  const modelName = selectedPullModel.value || customPullModel.value.trim()
  if (!modelName) return

  pulling.value = true
  pullProgress.value = `⏳ 开始拉取 ${modelName}...`

  try {
    const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
    const res = await fetch('/api/desktop/ollama/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ modelName }),
    })
    const data = await res.json()
    if (data.success) {
      pullProgress.value = `📥 ${modelName} 下载中（后台），请稍后刷新列表...`
      setTimeout(() => checkOllama(), 10000)
    } else {
      pullProgress.value = `❌ ${data.error}`
    }
  } catch (e: any) {
    pullProgress.value = `❌ 失败: ${e.message}`
  }
  pulling.value = false
}

// 删除模型
async function deleteModel(name: string) {
  if (!confirm(`确定删除模型 ${name}？`)) return
  // 暂不支持，通过 Ollama CLI
  pullProgress.value = `请在终端运行: ollama rm ${name}`
  setTimeout(() => { pullProgress.value = '' }, 5000)
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  return gb > 1 ? `${gb.toFixed(1)}GB` : `${(bytes / 1024 / 1024).toFixed(0)}MB`
}

function saveLocalConfig() {
  const config: Record<string, any> = {}
  for (const card of localModelCards) {
    config[card.key] = { enabled: card.enabled, model: card.modelName }
  }
  localStorage.setItem('local_mode_config', JSON.stringify(config))
  pullProgress.value = '✅ 本地模型配置已保存'
  setTimeout(() => { pullProgress.value = '' }, 2000)
}

function loadLocalConfig() {
  try {
    const raw = localStorage.getItem('local_mode_config')
    if (!raw) return
    const config = JSON.parse(raw)
    for (const card of localModelCards) {
      const c = config[card.key]
      if (c) {
        card.enabled = c.enabled
        card.modelName = c.model || ''
      }
    }
  } catch {}
}

onMounted(() => {
  // 检测系统
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) osName.value = 'mac'
  else if (p.includes('win')) osName.value = 'win'
  checkOllama()
  loadLocalConfig()
})

watch(() => props.visible, (v) => {
  if (v) {
    checkOllama()
    loadLocalConfig()
  }
})
</script>

<style scoped>
.ol-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}
.ol-modal {
  background: #0f1525;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  width: 640px;
  max-width: 94vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.ol-header {
  position: relative;
  padding: 22px 28px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ol-title { font-size: 1rem; font-weight: 700; color: #e4e4e7; margin: 0; }
.ol-desc { font-size: 0.7rem; color: #71717a; margin: 4px 0 0; }
.ol-close {
  position: absolute; top: 14px; right: 14px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; color: #71717a; font-size: 0.8rem; cursor: pointer;
}
.ol-close:hover { color: #e4e4e7; background: rgba(255,255,255,0.06); }

.ol-body {
  padding: 18px 24px;
  overflow-y: auto;
  flex: 1;
}

/* 分区 */
.ol-section {
  margin-bottom: 20px;
}
.ol-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #a1a1aa;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 状态卡片 */
.ol-status-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ol-status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 12px 16px;
}
.ol-status--ok { border-color: rgba(34,197,94,0.15); }
.ol-status--warn { border-color: rgba(234,179,8,0.15); }
.ol-status--err { border-color: rgba(239,68,68,0.15); }
.ol-status-icon { font-size: 1.2rem; }
.ol-status-info { flex: 1; }
.ol-status-label { font-size: 0.8rem; font-weight: 600; color: #e4e4e7; }
.ol-status-desc { font-size: 0.68rem; color: #71717a; margin-top: 2px; }

.ol-action-btn {
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.2);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 0.7rem;
  color: #60a5fa;
  cursor: pointer;
  white-space: nowrap;
}
.ol-action-btn:hover { background: rgba(59,130,246,0.15); }

/* 模型列表 */
.ol-model-list { display: flex; flex-direction: column; gap: 6px; }
.ol-model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
}
.ol-model-name { flex: 1; font-size: 0.8rem; font-weight: 600; color: #e4e4e7; font-family: monospace; }
.ol-model-size { font-size: 0.68rem; color: #71717a; }
.ol-model-del {
  background: transparent; border: 1px solid rgba(239,68,68,0.2);
  border-radius: 5px; padding: 2px 8px;
  font-size: 0.65rem; color: #ef4444; cursor: pointer;
}

.ol-empty-hint {
  padding: 20px; text-align: center;
  color: #71717a; font-size: 0.78rem;
}

/* 拉取新模型 */
.ol-pull-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.ol-select, .ol-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.78rem;
  color: #e4e4e7;
  outline: none;
  transition: border-color 0.2s;
}
.ol-select:focus, .ol-input:focus { border-color: #3b82f6; }
.ol-select { flex: 1; min-width: 180px; }
.ol-select option { background: #0f1525; color: #e4e4e7; }
.ol-input { flex: 1; min-width: 160px; }
.ol-select--sm { min-width: 0; }

.ol-pull-progress {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(59,130,246,0.06);
  border-radius: 8px;
  font-size: 0.72rem;
  color: #60a5fa;
}

.ol-btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition: all 0.2s;
}
.ol-btn--primary { background: linear-gradient(135deg,#3b82f6,#2563eb); color: #fff; }
.ol-btn--primary:hover:not(:disabled) { opacity: 0.9; }
.ol-btn--full { width: 100%; margin-top: 10px; }
.ol-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 本地配置 */
.ol-local-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ol-config-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
}
.ol-config-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #e4e4e7;
  flex: 1;
}

/* Toggle */
.ms-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
  display: inline-block;
  flex-shrink: 0;
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

/* 动画 */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
