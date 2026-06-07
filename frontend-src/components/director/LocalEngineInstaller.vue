<!--
  components/director/LocalEngineInstaller.vue
  
  本地引擎安装引导面板
  三端（Windows / macOS / Linux）智能检测 + 精准下载
  支持：Ollama / ComfyUI / Wan2.1
  
  通信方式：
    桌面端 → electronAPI.engineCheck() → 主进程检测 PATH + 文件系统
    Web 端 → fetch /api/desktop/{engine}/check → 后端 API
  
  统一检测接口：
    { installed: boolean, running: boolean, path?: string, models?: string[], info?: object }
-->

<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="lei-overlay" @click.self="$emit('close')">
      <div class="lei-modal">
        <!-- Header -->
        <div class="lei-header">
          <div class="lei-header-left">
            <h3 class="lei-title">🔧 本地引擎总控</h3>
            <p class="lei-desc">一键安装管理本地 AI 引擎 · {{ platformName }}</p>
          </div>
          <button class="lei-close" @click="$emit('close')">✕</button>
        </div>

        <!-- 系统信息条 -->
        <div class="lei-sysbar">
          <span class="lei-sysitem">💻 {{ platformName }}</span>
          <span class="lei-sysitem">🖥️ {{ cpuArch }}</span>
          <span class="lei-sysitem">🎯 桌面环境{{ isDesktop ? ' ✅' : ' ❌（需 Electron 桌面版）' }}</span>
        </div>

        <div class="lei-body">
          <!-- ═══ Engine Tab 切换 ═══ -->
          <div class="lei-tabs">
            <button v-for="tab in engines" :key="tab.id"
              :class="['lei-tab', { 'lei-tab--active': activeTab === tab.id }]"
              @click="activeTab = tab.id">
              <span class="lei-tab-icon">{{ tab.icon }}</span>
              <span class="lei-tab-label">{{ tab.name }}</span>
              <span v-if="tab.status === 'ready'" class="lei-badge lei-badge--ok">已就绪</span>
              <span v-else-if="tab.status === 'installed'" class="lei-badge lei-badge--warn">未运行</span>
              <span v-else class="lei-badge lei-badge--err">未安装</span>
            </button>
          </div>

          <!-- ═══ Ollama 面板 ═══ -->
          <div v-if="activeTab === 'ollama'" class="lei-engine-panel">
            <h4 class="lei-panel-title">🦙 Ollama — 本地大语言模型</h4>
            <p class="lei-panel-desc">运行本地 LLM（Qwen2.5 / DeepSeek / Llama），离线推理</p>

            <!-- 状态卡片 -->
            <div class="lei-status-grid">
              <div class="lei-status-card" :class="ollama.installed ? 'lei-ok' : 'lei-err'">
                <div class="lei-status-icon">{{ ollama.installed ? '✅' : '❌' }}</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">Ollama 已安装</div>
                  <div class="lei-status-desc">{{ ollama.path || (ollama.installed ? '在 PATH 中' : '未检测到') }}</div>
                </div>
                <button v-if="!ollama.installed" class="lei-btn lei-btn--action" @click="installEngine('ollama')">
                  {{ osDownloadLabel('ollama') }}
                </button>
              </div>
              <div class="lei-status-card" :class="ollama.running ? 'lei-ok' : 'lei-warn'">
                <div class="lei-status-icon">{{ ollama.running ? '✅' : '⏸️' }}</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">服务运行中</div>
                  <div class="lei-status-desc">{{ ollama.running ? `已加载 ${ollama.models?.length || 0} 个模型` : '需要启动 ollama serve' }}</div>
                </div>
              </div>
            </div>

            <!-- 模型管理 -->
            <div class="lei-section">
              <div class="lei-section-title">📦 本地模型管理</div>
              <div v-if="ollama.running && ollama.models?.length" class="lei-model-list">
                <div v-for="m in ollama.models" :key="m" class="lei-model-item">
                  <span class="lei-model-dot">●</span>
                  <span class="lei-model-name">{{ m }}</span>
                </div>
              </div>
              <div v-else class="lei-empty">
                {{ ollama.running ? '暂无模型，拉取一个试试' : '启动后显示已安装模型' }}
              </div>

              <!-- 推荐模型拉取 -->
              <div v-if="ollama.running" class="lei-pull-row">
                <select v-model="selectedPullModel" class="lei-select">
                  <option value="">选一个推荐模型...</option>
                  <option v-for="m in ollamaRecommends" :key="m.name" :value="m.name">
                    {{ m.label }} ({{ m.size }})
                  </option>
                </select>
                <input v-model="customPullModel" class="lei-input" placeholder="或输入模型名如 qwen2.5:7b" />
                <button class="lei-btn lei-btn--primary" :disabled="pulling || (!selectedPullModel && !customPullModel)" @click="pullOllamaModel">
                  拉取
                </button>
              </div>
              <div v-if="pullProgress" class="lei-progress">{{ pullProgress }}</div>
            </div>

            <!-- 安装指引 -->
            <div v-if="!ollama.installed" class="lei-guide">
              <div class="lei-section-title">📖 安装指引（{{ platformName }}）</div>
              <pre class="lei-guide-text">{{ ollamaGuide }}</pre>
            </div>
          </div>

          <!-- ═══ ComfyUI 面板 ═══ -->
          <div v-if="activeTab === 'comfyui'" class="lei-engine-panel">
            <h4 class="lei-panel-title">🎨 ComfyUI — 本地图片/视频引擎</h4>
            <p class="lei-panel-desc">运行开源图像与视频模型（Wan2.1 / Stable Diffusion / FLUX / CogVideo）</p>

            <!-- 状态 -->
            <div class="lei-status-grid">
              <div class="lei-status-card" :class="comfyui.installed ? 'lei-ok' : 'lei-err'">
                <div class="lei-status-icon">{{ comfyui.installed ? '✅' : '❌' }}</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">ComfyUI 已安装</div>
                  <div class="lei-status-desc">{{ comfyui.path || '未检测到' }}</div>
                </div>
                <button v-if="!comfyui.installed" class="lei-btn lei-btn--action" @click="installEngine('comfyui')">
                  下载 ComfyUI
                </button>
              </div>
              <div class="lei-status-card" :class="comfyui.running ? 'lei-ok' : 'lei-warn'">
                <div class="lei-status-icon">{{ comfyui.running ? '✅' : '⏸️' }}</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">服务运行中（:8188）</div>
                  <div class="lei-status-desc">{{ comfyui.running ? `已加载 ${comfyui.models?.length || 0} 个模型` : '需要启动 python main.py' }}</div>
                </div>
              </div>
            </div>

            <!-- 模型管理 -->
            <div class="lei-section">
              <div class="lei-section-title">📦 可用模型（checkpoints/）</div>
              <div v-if="comfyui.models?.length" class="lei-model-list">
                <div v-for="m in comfyui.models" :key="m" class="lei-model-item">
                  <span class="lei-model-dot">●</span>
                  <span class="lei-model-name">{{ m }}</span>
                </div>
              </div>
              <div v-else class="lei-empty">
                {{ comfyui.installed ? '暂无模型，需下载 checkpoint 文件到 models/checkpoints/' : '安装后显示' }}
              </div>

              <!-- 视频模型推荐 -->
              <div v-if="comfyui.installed" class="lei-rec-models">
                <div class="lei-section-title" style="margin-top:12px">🔥 推荐下载</div>
                <div v-for="rec in comfyRecommends" :key="rec.name" class="lei-rec-item">
                  <span class="lei-rec-name">{{ rec.label }}</span>
                  <span class="lei-rec-desc">{{ rec.desc }}</span>
                  <button class="lei-btn lei-btn--sm" @click="openUrl(rec.url)">下载</button>
                </div>
              </div>
            </div>

            <div v-if="!comfyui.installed" class="lei-guide">
              <div class="lei-section-title">📖 安装指引（{{ platformName }}）</div>
              <pre class="lei-guide-text">{{ comfyuiGuide }}</pre>
            </div>
          </div>

          <!-- ═══ Wan2.1 面板 ═══ -->
          <div v-if="activeTab === 'wan2.1'" class="lei-engine-panel">
            <h4 class="lei-panel-title">🌊 Wan2.1 — 本地视频生成引擎</h4>
            <p class="lei-panel-desc">阿里开源，1.3B（8GB 显存可用）/ 14B 视频生成</p>

            <div class="lei-status-grid">
              <div class="lei-status-card" :class="wan.installed ? 'lei-ok' : 'lei-err'">
                <div class="lei-status-icon">{{ wan.installed ? '✅' : '❌' }}</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">Wan2.1 已安装</div>
                  <div class="lei-status-desc">{{ wan.path || '未检测到' }}</div>
                </div>
                <button v-if="!wan.installed" class="lei-btn lei-btn--action" @click="installEngine('wan2.1')">
                  获取 Wan2.1
                </button>
              </div>
              <div class="lei-status-card" :class="wan.running ? 'lei-ok' : 'lei-warn'">
                <div class="lei-status-icon">📦</div>
                <div class="lei-status-body">
                  <div class="lei-status-label">推理脚本</div>
                  <div class="lei-status-desc">{{ wan.installed ? '已就绪，可运行推理' : '未安装' }}</div>
                </div>
              </div>
            </div>

            <div class="lei-section">
              <div class="lei-section-title">📖 推荐工作流</div>
              <div class="lei-rec-item">
                <span class="lei-rec-name">ComfyUI + Wan2.1</span>
                <span class="lei-rec-desc">通过 ComfyUI 节点使用，支持文生视频和图生视频</span>
              </div>
              <div class="lei-rec-item">
                <span class="lei-rec-name">Wan2.1 原生推理</span>
                <span class="lei-rec-desc">python infer.py --prompt "..." — 性能最优</span>
              </div>
            </div>

            <div v-if="!wan.installed" class="lei-guide">
              <div class="lei-section-title">📖 安装指引</div>
              <pre class="lei-guide-text">{{ wanGuide }}</pre>
            </div>
          </div>

          <!-- ═══ 全局刷新 ═══ -->
          <div class="lei-footer">
            <button class="lei-btn lei-btn--ghost" @click="refreshAll">🔄 刷新所有引擎状态</button>
            <span class="lei-footer-status">{{ recentCheck }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

// ===== 平台检测 =====
const api = (window as any).electronAPI
const isDesktop = computed(() => !!api?.isDesktop)
const platformName = computed(() => {
  if (api?.platformName) return api.platformName
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) return 'macOS'
  if (p.includes('win')) return 'Windows'
  return 'Linux'
})
const cpuArch = computed(() => {
  // @ts-ignore
  return navigator.userAgent.includes('arm64') || navigator.userAgent.includes('aarch64') ? 'ARM64' : 'x86_64'
})

const activeTab = ref('ollama')
const pulling = ref(false)
const pullProgress = ref('')
const selectedPullModel = ref('')
const customPullModel = ref('')
const recentCheck = ref('')

// ===== 引擎状态 =====
const ollama = reactive({ installed: false, running: false, path: '', models: [] as string[] })
const comfyui = reactive({ installed: false, running: false, path: '', models: [] as string[] })
const wan = reactive({ installed: false, running: false, path: '' })

// ===== Tab 状态汇总 =====
const engines = computed(() => [
  { id: 'ollama', icon: '🦙', name: 'Ollama', status: ollama.running ? 'ready' : ollama.installed ? 'installed' : 'missing' },
  { id: 'comfyui', icon: '🎨', name: 'ComfyUI', status: comfyui.running ? 'ready' : comfyui.installed ? 'installed' : 'missing' },
  { id: 'wan2.1', icon: '🌊', name: 'Wan2.1', status: wan.installed ? 'installed' : 'missing' },
])

// ===== 推荐模型 =====
const ollamaRecommends = [
  { name: 'qwen2.5:7b', label: 'Qwen2.5 7B (中文好)', size: '4.7GB' },
  { name: 'qwen2.5:3b', label: 'Qwen2.5 3B (轻量)', size: '1.9GB' },
  { name: 'deepseek-r1:7b', label: 'DeepSeek R1 7B (编程)', size: '4.7GB' },
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B (英语)', size: '2.0GB' },
  { name: 'qwen2.5:14b', label: 'Qwen2.5 14B (更强)', size: '8.9GB' },
]

const comfyRecommends = [
  { name: 'sd3.5_large', label: 'SD3.5 Large', desc: 'Stable Diffusion 3.5 文生图', url: 'https://huggingface.co/stabilityai/stable-diffusion-3.5-large' },
  { name: 'wan2.1_i2v_480p', label: 'Wan2.1 I2V 480p', desc: '阿里 Wan2.1 图生视频 1.3B', url: 'https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P' },
  { name: 'hunyuan_video', label: 'HunyuanVideo', desc: '腾讯文生视频模型', url: 'https://huggingface.co/Tencent/HunyuanVideo' },
]

// ===== 安装指引（各平台） =====
const ollamaGuide = computed(() => {
  if (platformName.value === 'macOS') return `curl -fsSL https://ollama.com/install.sh | sh

  或访问 ollama.com/download 下载 macOS 版`
  if (platformName.value === 'Windows') return `1. 访问 https://ollama.com/download
  2. 下载 OllamaSetup.exe
  3. 双击安装
  4. 安装后运行: ollama serve`
  return `curl -fsSL https://ollama.com/install.sh | sh

  或手动下载:
  wget https://ollama.com/download/ollama-linux-amd64.tgz
  tar -xzf ollama-linux-amd64.tgz
  sudo mv ollama /usr/local/bin/`
})

const comfyuiGuide = computed(() => {
  if (platformName.value === 'Windows') return `1. 安装 Python 3.10+
  2. git clone https://github.com/comfyanonymous/ComfyUI
  3. cd ComfyUI && pip install -r requirements.txt
  4. python main.py (默认 http://127.0.0.1:8188)`
  return `1. 安装 Python 3.10+
  git clone https://github.com/comfyanonymous/ComfyUI
  cd ComfyUI
  pip install -r requirements.txt
  python main.py
  # 浏览器打开 http://127.0.0.1:8188`
})

const wanGuide = computed(() => {
  return `1. 安装 Python 3.10+ 和 CUDA
2. git clone https://github.com/Wan-Video/Wan2.1
3. cd Wan2.1 && pip install -r requirements.txt
4. 下载模型：
   wget https://huggingface.co/Wan-AI/Wan2.1-T2V-14B/resolve/main/model.safetensors
5. 运行：python infer.py --prompt "..."`
})

// ===== 下载按钮标签（各平台） =====
function osDownloadLabel(engine: string): string {
  if (engine === 'ollama') return `下载 Ollama ${platformName.value}版`
  if (engine === 'comfyui') return `获取 ComfyUI`
  return `获取 Wan2.1`
}

// ===== 检测引擎状态 =====
async function checkEngine(engine: string): Promise<any> {
  if (isDesktop.value && api) {
    return api.checkEngine(engine)
  }
  // Web fallback: 后端 API
  try {
    const res = await fetch(`/api/desktop/${engine === 'wan2.1' ? 'video' : engine}/check`)
    const data = await res.json()
    if (engine === 'ollama') {
      return { installed: data.running, running: data.running, models: data.models || [] }
    }
    if (engine === 'comfyui') {
      return { installed: true, running: data.comfyui?.running, models: data.comfyui?.models || [] }
    }
    if (engine === 'wan2.1') {
      return { installed: data.wan2_1?.available, running: data.wan2_1?.available }
    }
  } catch {}
  return { installed: false, running: false }
}

async function refreshAll() {
  recentCheck.value = '检测中...'

  const [o, c, w] = await Promise.all([
    checkEngine('ollama'),
    checkEngine('comfyui'),
    checkEngine('wan2.1'),
  ])

  ollama.installed = o.installed
  ollama.running = o.running
  ollama.path = o.path || ''
  ollama.models = o.models || []

  comfyui.installed = c.installed
  comfyui.running = c.running
  comfyui.path = c.path || ''
  comfyui.models = c.models || []

  wan.installed = w.installed
  wan.running = w.running
  wan.path = w.path || ''

  const now = new Date()
  recentCheck.value = `最后更新: ${now.toLocaleTimeString('zh-CN', { hour12: false })}`
}

// ===== 安装引擎 =====
function installEngine(engine: string) {
  if (isDesktop.value && api) {
    api.installEngine(engine)
  } else {
    // Web 版：打开下载页面
    const urls: Record<string, string> = {
      ollama: 'https://ollama.com/download',
      comfyui: 'https://github.com/comfyanonymous/ComfyUI',
      'wan2.1': 'https://github.com/Wan-Video/Wan2.1',
    }
    const url = urls[engine] || 'https://github.com'
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }
}

// ===== 拉取 Ollama 模型 =====
async function pullOllamaModel() {
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
    pullProgress.value = data.success
      ? `📥 ${modelName} 下载中，稍后刷新...`
      : `❌ ${data.error}`
    if (data.success) setTimeout(() => checkEngine('ollama').then(r => { ollama.models = r.models || [] }), 10000)
  } catch (e: any) {
    pullProgress.value = `❌ 失败: ${e.message}`
  }
  pulling.value = false
}

function openUrl(url: string) {
  if (api?.openExternal) api.openExternal(url)
  else window.open(url, '_blank')
}

onMounted(() => refreshAll())
watch(() => props.visible, (v) => { if (v) refreshAll() })
</script>

<style scoped>
.lei-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; backdrop-filter: blur(4px);
}
.lei-modal {
  background: #0f1525;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  width: 720px;
  max-width: 94vw;
  max-height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

.lei-header {
  display: flex; align-items: flex-start;
  padding: 22px 28px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.lei-header-left { flex: 1; }
.lei-title { font-size: 1rem; font-weight: 700; color: #e4e4e7; margin: 0; }
.lei-desc { font-size: 0.7rem; color: #71717a; margin: 4px 0 0; }
.lei-close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; color: #71717a; font-size: 0.8rem; cursor: pointer;
}

.lei-sysbar {
  display: flex; gap: 16px; flex-wrap: wrap;
  padding: 8px 28px;
  background: rgba(255,255,255,0.02);
  font-size: 0.72rem; color: #71717a;
}
.lei-sysitem { display: flex; align-items: center; gap: 4px; }

.lei-body {
  padding: 18px 24px;
  overflow-y: auto; flex: 1;
}

/* === Tabs === */
.lei-tabs {
  display: flex; gap: 6px;
  margin-bottom: 16px;
}
.lei-tab {
  flex: 1;
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.lei-tab:hover { background: rgba(255,255,255,0.04); }
.lei-tab--active {
  background: rgba(59,130,246,0.08);
  border-color: rgba(59,130,246,0.15);
}
.lei-tab-icon { font-size: 1rem; }
.lei-tab-label { font-size: 0.75rem; font-weight: 600; color: #d4d4d8; flex: 1; }

.lei-badge {
  font-size: 0.62rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.lei-badge--ok { background: rgba(34,197,94,0.1); color: #22c55e; }
.lei-badge--warn { background: rgba(234,179,8,0.1); color: #eab308; }
.lei-badge--err { background: rgba(239,68,68,0.1); color: #ef4444; }

/* === 引擎面板 === */
.lei-engine-panel { }
.lei-panel-title { font-size: 0.85rem; font-weight: 700; color: #e4e4e7; margin: 0 0 2px; }
.lei-panel-desc { font-size: 0.7rem; color: #71717a; margin: 0 0 12px; }

/* === 状态网格 === */
.lei-status-grid {
  display: flex; gap: 8px;
  margin-bottom: 14px;
}
.lei-status-card {
  flex: 1;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}
.lei-ok { border-color: rgba(34,197,94,0.15); }
.lei-warn { border-color: rgba(234,179,8,0.15); }
.lei-err { border-color: rgba(239,68,68,0.15); }
.lei-status-icon { font-size: 1.2rem; }
.lei-status-body { flex: 1; min-width: 0; }
.lei-status-label { font-size: 0.8rem; font-weight: 600; color: #e4e4e7; }
.lei-status-desc { font-size: 0.68rem; color: #71717a; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* === 分区 === */
.lei-section { margin-bottom: 12px; }
.lei-section-title {
  font-size: 0.7rem; font-weight: 700;
  color: #a1a1aa; margin-bottom: 8px;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.lei-empty {
  padding: 14px; text-align: center;
  color: #71717a; font-size: 0.75rem;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}

/* === 模型列表 === */
.lei-model-list { display: flex; flex-direction: column; gap: 4px; }
.lei-model-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
}
.lei-model-dot { color: #22c55e; font-size: 0.7rem; }
.lei-model-name { font-size: 0.78rem; color: #d4d4d8; font-family: monospace; }

/* === 拉取模型 === */
.lei-pull-row {
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
  margin-top: 8px;
}
.lei-select, .lei-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 8px 10px;
  font-size: 0.75rem; color: #e4e4e7; outline: none;
}
.lei-select:focus, .lei-input:focus { border-color: #3b82f6; }
.lei-select { flex: 0 0 180px; }
.lei-input { flex: 1; min-width: 140px; }
.lei-select option { background: #0f1525; color: #e4e4e7; }

.lei-progress {
  margin-top: 6px; padding: 8px 10px;
  background: rgba(59,130,246,0.06);
  border-radius: 8px;
  font-size: 0.7rem; color: #60a5fa;
}

/* === 推荐下载 === */
.lei-rec-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
  margin-bottom: 4px;
}
.lei-rec-name { font-size: 0.78rem; font-weight: 600; color: #d4d4d8; min-width: 130px; }
.lei-rec-desc { flex: 1; font-size: 0.68rem; color: #71717a; }

/* === 安装指引 === */
.lei-guide {
  margin-top: 12px;
  padding: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 10px;
}
.lei-guide-text {
  font-size: 0.7rem; color: #a1a1aa; line-height: 1.6;
  white-space: pre-wrap; font-family: 'SF Mono','Menlo','monospace';
  margin: 0;
}

/* === 按钮 === */
.lei-btn {
  padding: 6px 14px; border-radius: 8px;
  font-size: 0.7rem; font-weight: 600; cursor: pointer;
  border: none; white-space: nowrap;
  transition: all 0.2s;
}
.lei-btn--primary { background: linear-gradient(135deg,#3b82f6,#2563eb); color: #fff; }
.lei-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
.lei-btn--action { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #60a5fa; }
.lei-btn--ghost { background: transparent; border: 1px solid rgba(255,255,255,0.06); color: #71717a; }
.lei-btn--sm { padding: 3px 10px; font-size: 0.65rem; background: rgba(59,130,246,0.06); color: #60a5fa; }
.lei-btn:hover { opacity: 0.85; }

/* === 底部 === */
.lei-footer {
  display: flex; align-items: center; gap: 12px;
  margin-top: 16px; padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.lei-footer-status { font-size: 0.68rem; color: #52525b; }

/* === 动画 === */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
