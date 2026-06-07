<template>
  <div class="ad-workspace">
    <!-- ====== 中间栏：两列布局 ====== -->
    <div class="ad-main">
      <!-- 左列：广告脚本 -->
      <div class="ad-left">
        <div class="ad-panel">
          <div class="ad-panel-header">
            <span class="ad-panel-icon">📝</span>
            <span>广告脚本</span>
          </div>
          <div class="ad-script-area">
            <textarea
              v-model="adScript"
              class="ad-textarea"
              placeholder="输入广告脚本内容，例如产品卖点、目标受众、广告风格等…"
              rows="12"
            ></textarea>
          </div>
          <button
            class="ad-btn ad-btn-primary"
            :disabled="optimizingScript"
            @click="optimizeAdScript"
          >
            {{ optimizingScript ? '⏳ 优化中…' : '🤖 AI 优化脚本' }}
          </button>

          <!-- 优化结果 -->
          <div v-if="optimizedScript" class="ad-optimized-section">
            <div class="ad-panel-header" style="margin-top:16px;">
              <span class="ad-panel-icon">✨</span>
              <span>优化结果</span>
              <button class="ad-btn-sm" @click="applyOptimizedScript">📋 应用到下方</button>
              <button class="ad-btn-sm" style="margin-left:6px;" @click="toggleShotsEdit">✏️ {{ editingShots ? '完成编辑' : '编辑分镜' }}</button>
            </div>
            <div class="ad-opt-content" v-if="!editingShots">
              <!-- 分镜时间轴（展示模式） -->
              <template v-if="optimizedScript.shots && optimizedScript.shots.length > 0">
                <div class="ad-opt-label">🎬 分镜时间轴（{{ totalShots }}镜 / {{ totalTime }}s）</div>
                <div class="ad-shots-timeline">
                  <div v-for="(shot, si) in optimizedScript.shots" :key="si" class="ad-shot-card">
                    <div class="ad-shot-header">
                      <span class="ad-shot-num">{{ shot.shot }}</span>
                      <span class="ad-shot-time">⏱ {{ shot.time }}s</span>
                      <span class="ad-shot-camera">{{ shot.camera || '-' }}</span>
                      <span v-if="shot.action" class="ad-shot-action">📌 {{ shot.action }}</span>
                    </div>
                    <div class="ad-shot-scene">{{ shot.scene }}</div>
                  </div>
                </div>
              </template>
              <!-- 旧格式兼容 -->
              <template v-else>
                <div class="ad-opt-label">🎬 广告脚本</div>
                <pre class="ad-opt-text">{{ optimizedScript.narrative }}</pre>
              </template>
              <div class="ad-opt-label">💬 对话/旁白（可编辑）</div>
              <textarea
                v-model="optimizedScript.dialogue"
                class="ad-textarea ad-field-input"
                rows="2"
                placeholder="对话或旁白内容…"
              ></textarea>
              <div class="ad-opt-label">🔊 音效（可编辑）</div>
              <textarea
                v-model="optimizedScript.effects"
                class="ad-textarea ad-field-input"
                rows="2"
                placeholder="背景音乐和音效描述…"
              ></textarea>
              <div class="ad-opt-label">✨ 特效（可编辑）</div>
              <textarea
                v-model="optimizedScript.vfx"
                class="ad-textarea ad-field-input"
                rows="2"
                placeholder="视觉特效描述（如粒子、光效、转场等）…"
              ></textarea>
            </div>
            <!-- 编辑模式：可编辑的 JSON 文本区域 -->
            <div class="ad-opt-content" v-else>
              <div class="ad-opt-label">✏️ 编辑分镜数据（JSON 格式）</div>
              <div class="ad-shots-edit-hint">修改后点击「完成编辑」保存，再点「应用到下方」生效</div>
              <textarea
                v-model="editableShotsJson"
                class="ad-textarea ad-field-input ad-shots-edit-area"
                rows="12"
                spellcheck="false"
              ></textarea>
              <div v-if="shotsParseError" class="ad-shots-parse-error">{{ shotsParseError }}</div>
            </div>
          </div>
        </div>

        <!-- 视频生成卡片 -->
        <div class="ad-panel" style="margin-top:12px;">
          <div class="ad-panel-header">
            <span class="ad-panel-icon">🎥</span>
            <span>视频生成</span>
          </div>
          <div class="ad-gen-section">
            <div class="ad-field">
              <label class="ad-field-label">📝 视频描述</label>
              <textarea
                v-model="videoDescription"
                class="ad-textarea ad-field-input"
                placeholder="从优化后的脚本获取视频描述…"
                rows="4"
              ></textarea>
            </div>
            <div class="ad-field">
              <label class="ad-field-label">🚫 Negative Prompt</label>
              <textarea
                v-model="negativePrompt"
                class="ad-textarea ad-field-input"
                placeholder="负面提示词（可选）…"
                rows="2"
              ></textarea>
            </div>
            <div class="ad-field-row">
              <div class="ad-field" style="flex:1;">
                <label class="ad-field-label">⏱️ 时长（秒）</label>
                <select v-model.number="videoDuration" class="ad-select">
                  <option :value="5">5 秒</option>
                  <option :value="8">8 秒</option>
                  <option :value="10">10 秒</option>
                  <option :value="15">15 秒</option>
                </select>
              </div>
              <div class="ad-field" style="flex:1;">
                <label class="ad-field-label">🎬 风格</label>
                <select v-model="adStyle" class="ad-select">
                  <option value="realistic">写实风格</option>
                  <option value="anime">动漫风格</option>
                  <option value="cyberpunk">赛博朋克</option>
                  <option value="ink">水墨国风</option>
                  <option value="clay">黏土动画</option>
                  <option value="pixel">像素复古</option>
                </select>
              </div>
            </div>
            <div class="ad-field-row">
              <div class="ad-field" style="flex:1;">
                <label class="ad-field-label">📐 画面比例</label>
                <select v-model="aspectRatio" class="ad-select">
                  <option value="9:16">9:16 竖屏（抖音/快手）</option>
                  <option value="16:9">16:9 横屏（YouTube）</option>
                  <option value="1:1">1:1 正方形</option>
                  <option value="4:5">4:5 微竖屏（小红书）</option>
                </select>
              </div>
              <div class="ad-field" style="flex:1;">
                <label class="ad-field-label">🎲 种子（Seed）</label>
                <div style="display:flex; gap:4px; align-items:center;">
                  <input v-model.number="videoSeed" type="number" class="ad-input" placeholder="留空随机" min="0" style="flex:1;" />
                  <span v-if="videoSeed" @click="videoSeed = undefined" style="cursor:pointer;color:#999;font-size:12px;">✕</span>
                </div>
              </div>
            </div>
            <div class="ad-field-row">
              <div class="ad-field" style="flex:1;">
                <label class="ad-field-label">🤖 视频模型 <span class="dim">（从设置读取）</span></label>
                <div class="ad-model-display">{{ userVideoModelLabel || '读取中…' }}</div>
              </div>
            </div>
            <button
              class="ad-btn ad-btn-primary"
              :disabled="generatingVideo"
              @click="generateAdVideo"
              style="margin-top:8px;"
            >
              {{ generatingVideo ? '⏳ 生成中…' : '🎬 生成广告视频' }}
            </button>

            <!-- 参考视频上传（多模态参考） -->
            <div class="ad-ref-section" style="margin-top:10px;">
              <label class="ad-field-label">🎥 参考视频（可选）</label>
              <div class="ad-ref-upload" @click="triggerVideoRefUpload">
                <div v-if="videoPreview" class="ad-ref-preview" style="position:relative;">
                  <video :src="videoPreview" class="ad-ref-img" style="object-fit:cover;"></video>
                  <span class="ad-ref-remove" @click.stop="clearVideoRef">✕</span>
                </div>
                <div v-else class="ad-ref-placeholder">
                  <span class="ad-ref-icon">🎬</span>
                  <span class="ad-ref-text">点击上传参考视频（Seedance 2.0 多模态参考）</span>
                </div>
              </div>
              <input
                ref="videoRefInput"
                type="file"
                accept="video/*"
                style="display:none"
                @change="onVideoRefChange"
              />
            </div>

            <!-- 视频预览 -->
            <div v-if="generatedVideoUrl" class="ad-video-preview" style="margin-top:12px;">
              <div class="ad-panel-header">
                <span class="ad-panel-icon">✅</span>
                <span>已生成视频</span>
              </div>
              <video :src="generatedVideoUrl" controls class="ad-video-player"></video>
            </div>
          </div>
        </div>
      </div>

      <!-- 右列：图片生成 -->
      <div class="ad-right">
        <div class="ad-panel">
          <div class="ad-panel-header">
            <span class="ad-panel-icon">🎨</span>
            <span>图片生成</span>
          </div>

          <!-- 参考图上传 -->
          <div class="ad-ref-section">
            <label class="ad-field-label">🖼️ 参考图（可选）</label>
            <div class="ad-ref-upload" @click="triggerRefUpload">
              <div v-if="refImagePreview" class="ad-ref-preview">
                <img :src="refImagePreview" class="ad-ref-img" />
                <span class="ad-ref-remove" @click.stop="clearRefImage">✕</span>
              </div>
              <div v-else class="ad-ref-placeholder">
                <span class="ad-ref-icon">📤</span>
                <span class="ad-ref-text">点击上传参考图</span>
              </div>
            </div>
            <input
              ref="refInput"
              type="file"
              accept="image/*"
              style="display:none"
              @change="onRefImageChange"
            />
          </div>

          <!-- 图生图提示词 -->
          <div class="ad-field">
            <label class="ad-field-label">🤖 图生图提示词</label>
            <textarea
              v-model="imagePrompt"
              class="ad-textarea ad-field-input"
              placeholder="从优化后的脚本获取图片提示词…"
              rows="4"
            ></textarea>
          </div>
          <div class="ad-field">
            <label class="ad-field-label">🚫 负面提示词</label>
            <textarea
              v-model="imageNegativePrompt"
              class="ad-textarea ad-field-input"
              placeholder="负面提示词…"
              rows="2"
            ></textarea>
          </div>
          <button class="ad-btn ad-btn-secondary" :disabled="optimizingImagePrompt" @click="optimizeImagePrompt">
            {{ optimizingImagePrompt ? '⏳ 优化中…' : '🤖 AI 优化提示词' }}
          </button>
          <button
            class="ad-btn ad-btn-primary"
            style="margin-top:8px;"
            :disabled="generatingImage"
            @click="generateAdImage"
          >
            {{ generatingImage ? '⏳ 生成中…' : '🎨 生成图片' }}
          </button>

          <!-- 生成结果 -->
          <div v-if="generatedImages.length > 0" class="ad-image-results">
            <div class="ad-panel-header" style="margin-top:16px;">
              <span class="ad-panel-icon">🖼️</span>
              <span>生成结果（{{ generatedImages.length }}）</span>
            </div>
            <div class="ad-image-grid">
              <div v-for="(img, i) in generatedImages" :key="i" class="ad-image-item">
                <img :src="img" class="ad-image-thumb" @click="previewImageUrl = img" />
              </div>
            </div>
          </div>

          <!-- 已在使用的模型 -->
          <div class="ad-model-info">
            <span class="ad-model-info-icon">🧠</span>
            <span class="ad-model-info-text">语言模型：{{ userLLMLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 大图预览 -->
    <div v-if="previewImageUrl" class="ad-preview-overlay" @click.self="previewImageUrl = ''">
      <img :src="previewImageUrl" class="ad-preview-large" />
      <span class="ad-preview-close" @click="previewImageUrl = ''">✕</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ─── 广告脚本 ───
const adScript = ref('')
const optimizingScript = ref(false)
const optimizedScript = ref<{ 
  narrative: string; 
  dialogue: string; 
  effects: string;
  vfx?: string;  // ⭐ 新增：视觉特效
  shots?: Array<{ shot: string; time: number; scene: string; camera: string; visual?: string; branding?: string; dialogue?: string; effects?: string }>;
} | null>(null)

// ─── 视频 ───
const videoDescription = ref('')

// 分镜时间轴计算属性
const totalShots = computed(() => optimizedScript.value?.shots?.length || 0)
const totalTime = computed(() => optimizedScript.value?.shots?.reduce((sum, s) => sum + (s.time || 0), 0) || 0)

// 分镜编辑状态
const editingShots = ref(false)
const editableShotsJson = ref('')
const shotsParseError = ref('')

function toggleShotsEdit() {
  if (editingShots.value) {
    // 完成编辑：验证 JSON 并写回
    try {
      const parsed = JSON.parse(editableShotsJson.value)
      if (Array.isArray(parsed)) {
        optimizedScript.value = { ...optimizedScript.value!, shots: parsed }
        shotsParseError.value = ''
        editingShots.value = false
      } else {
        shotsParseError.value = 'JSON 必须是数组格式，如 [{"shot":"Shot 1","time":3,...}]'
      }
    } catch (e: any) {
      shotsParseError.value = 'JSON 格式错误: ' + e.message
    }
  } else {
    // 进入编辑：将当前 shots 序列化为 JSON
    if (optimizedScript.value?.shots) {
      editableShotsJson.value = JSON.stringify(optimizedScript.value.shots, null, 2)
    }
    shotsParseError.value = ''
    editingShots.value = true
  }
}

const negativePrompt = ref('')
const videoDuration = ref(8)
const adStyle = ref('realistic')
const videoSeed = ref<number | undefined>(undefined)
const aspectRatio = ref('9:16')
const generatingVideo = ref(false)
const generatedVideoUrl = ref('')
const userVideoModelLabel = ref('读取中…')
const userVideoProvider = ref('')
const userVideoModelName = ref('')

// ─── 用户模型配置 ───
const userLLMLabel = ref('读取中…')
const userLLMProvider = ref('')
const userLLMModelName = ref('')

// ─── 图片模型配置 ───
const userImageLabel = ref('读取中…')
const userImageProvider = ref('')
const userImageModelName = ref('')

// ─── 图片 ───
const refInput = ref<HTMLInputElement | null>(null)
const refImagePreview = ref('')
const refImageFile = ref<File | null>(null)
const imagePrompt = ref('')
const imageNegativePrompt = ref('')
const optimizingImagePrompt = ref(false)
const generatingImage = ref(false)
const generatedImages = ref<string[]>([])
const previewImageUrl = ref('')

// ─── 视频参考（多模态上传） ───
const videoFile = ref<File | null>(null)
const videoPreview = ref('')
const videoRefInput = ref<HTMLInputElement | null>(null)

// ─── 辅助函数 ───
function getAuthToken(): string {
  try {
    return (window as any).__NUXT__?.token || (window as any).localStorage?.getItem('auth_token') || ''
  } catch {
    return ''
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const TEN_MB = 10 * 1024 * 1024

/**
 * 上传视频文件：<= 10MB 用 base64，> 10MB 用 FormData 分块上传
 */
async function uploadVideoFile(file: File): Promise<string> {
  if (file.size <= TEN_MB) {
    // 小文件：沿用 base64（后端期望）
    return await fileToBase64(file)
  }
  // 大文件：FormData 分块上传到专用端点
  const token = getAuthToken()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', '00000000-0000-0000-0000-000000000000')
  const res = await fetch('/api/upload/video', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const json = await res.json()
  if (json.success && json.url) {
    return json.url  // 返回服务端文件 URL 而非 base64
  }
  throw new Error(json.error || '视频上传失败')
}

// ⭐ 从用户大模型设置读取模型配置
async function loadUserModelConfig() {
  try {
    const token = getAuthToken()
    const res = await fetch('/api/user/llm-config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data) {
        // LLM 配置
        const llm = json.data.llm
        if (llm?.provider) {
          userLLMProvider.value = llm.provider
          userLLMModelName.value = llm.modelName || ''
          userLLMLabel.value = `${llm.providerLabel || llm.provider}${llm.modelName ? ' · ' + llm.modelName : ''}`
        } else {
          userLLMLabel.value = '未配置（使用默认）'
        }
        // 视频模型配置
        const video = json.data.video
        if (video?.provider) {
          userVideoProvider.value = video.provider
          userVideoModelName.value = video.modelName || ''
          userVideoModelLabel.value = `${video.providerLabel || video.provider}${video.modelName ? ' · ' + video.modelName : ''}`
        } else {
          userVideoModelLabel.value = '未配置（使用默认）'
        }
        // 图片模型配置
        const image = json.data.image
        if (image?.provider) {
          userImageProvider.value = image.provider
          userImageModelName.value = image.modelName || ''
          userImageLabel.value = `${image.providerLabel || image.provider}${image.modelName ? ' · ' + image.modelName : ''}`
        } else {
          userImageLabel.value = '未配置（使用默认）'
        }
      }
    }
  } catch {
    userLLMLabel.value = '读取失败'
    userVideoModelLabel.value = '读取失败'
  }
}

// ─── AI 优化广告脚本（使用用户的 LLM） ───
async function optimizeAdScript() {
  if (!adScript.value.trim()) { alert('请先填写广告脚本'); return }
  optimizingScript.value = true
  try {
    const token = getAuthToken()
    const res = await fetch('/api/ai/optimize-ad-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        script: adScript.value,
        style: adStyle.value,
      }),
    })
    const json = await res.json()
    if (json.success && json.data) {
      optimizedScript.value = json.data
    } else {
      alert('优化失败: ' + (json.error || '未知错误'))
    }
  } catch (err: any) {
    alert('优化出错: ' + (err.message || '未知错误'))
  } finally {
    optimizingScript.value = false
  }
}

function applyOptimizedScript() {
  if (!optimizedScript.value) return
  // 如果 narrative 看起来是 JSON 对象字符串，尝试提取纯文本描述
  let narrative = optimizedScript.value.narrative || ''
  if (narrative.startsWith('{') || narrative.startsWith('[') || narrative.startsWith('"')) {
    try {
      const parsed = JSON.parse(narrative)
      if (typeof parsed === 'string') narrative = parsed
      else if (parsed.narrative) narrative = parsed.narrative
      else if (parsed.description) narrative = parsed.description
      else narrative = JSON.stringify(parsed, null, 2)
    } catch {}
  }
  // 替换可能的转义符号，清理展示
  narrative = narrative.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ')
  videoDescription.value = narrative
  imagePrompt.value = '广告画面：' + (narrative.slice(0, 120) || '')
  // 强制写入负面提示词（视频 + 图片共用）
  const defaultNegative = '低质量，模糊，扭曲变形，不自然的动作，闪烁，跳帧，画面撕裂，分辨率低，颜色溢出，鬼影，过度锐化，伪影，文字模糊，不稳定的镜头，曝光不足/过度，色差，摩尔纹，噪点过多，边缘锯齿，光晕过重，动作僵硬，表情不自然，穿帮，光影不一致，透视错误，比例失调，背景杂乱，文字，水印，LOGO，字幕，标题，数字，时间戳，UI界面，弹幕，涂鸦，混乱'
  negativePrompt.value = defaultNegative
  imageNegativePrompt.value = defaultNegative
}

// ─── 视频生成（使用用户的视频模型） ───
async function generateAdVideo() {
  if (!videoDescription.value.trim()) { alert('请填写视频描述'); return }
  generatingVideo.value = true
  try {
    const token = getAuthToken()
    // 如果有已生成的图片，传第一张作为视频参考图（图生视频）
    const referenceImage = generatedImages.value[0] || ''
    // 如果有上传的参考视频：<=10MB 用 base64，>10MB 用 FormData 分块上传
    let referenceVideo = ''
    if (videoFile.value) {
      referenceVideo = await uploadVideoFile(videoFile.value)
    }
    const res = await fetch('/api/ai/generate-ad-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt: videoDescription.value,
        shots: optimizedScript.value?.shots || [],
        narrative: optimizedScript.value?.narrative || '',
        dialogue: optimizedScript.value?.dialogue || '',
        effects: optimizedScript.value?.effects || '',
        vfx: optimizedScript.value?.vfx || '',
        negativePrompt: negativePrompt.value,
        duration: videoDuration.value,
        style: adStyle.value,
        aspectRatio: aspectRatio.value,
        provider: userVideoProvider.value,
        modelName: userVideoModelName.value,
        referenceImage,
        referenceVideo: referenceVideo || undefined,
        seed: videoSeed.value || undefined,
        generate_audio: true,
        camera_fixed: false,
      }),
    })
    const json = await res.json()
    if (json.success && json.task) {
      // 异步视频任务，轮询等待完成
      const taskId = json.task.id
      if (!taskId) { alert('任务 ID 为空'); return }

      // 长轮询：最多 10 分钟（600 次 × 1 秒）
      for (let poll = 0; poll < 600; poll++) {
        await new Promise(r => setTimeout(r, 1000))
        try {
          const pollRes = await fetch(`/api/tasks/${taskId}/status`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!pollRes.ok) continue
          const pollJson = await pollRes.json()
          const task = pollJson.task || pollJson.data
          if (!task) continue

          // 任务还在排队或运行中，继续等待
          if (task.status === 'queued' || task.status === 'pending' || task.status === 'running' || task.status === 'processing' || task.status === 'generating') {
            if (poll > 0 && poll % 30 === 0) {
              console.log(`[ad-video] 等待中 ${Math.floor(poll/60)}分钟... status=${task.status}`)
            }
            continue
          }

          if (task.status === 'completed' || task.status === 'success' || task.status === 'done') {
            // 尝试多种字段获取视频 URL
            const result = task.result || {}
            generatedVideoUrl.value = result.videoUrl || result.url || result.output?.url || result.output?.videoUrl || ''
            if (generatedVideoUrl.value) {
              return
            }
            // 继续轮询等 result 填充
            continue
          } else if (task.status === 'failed' || task.status === 'error') {
            alert('视频生成失败: ' + (task.error || task.result?.error || task.result?.output?.error || '未知错误'))
            return
          }
        } catch { /* 继续轮询 */ }
      }
      // 超时后检查最后一次状态
      try {
        const lastRes = await fetch(`/api/tasks/${taskId}/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const lastJson = await lastRes.json()
        const lastTask = lastJson.task || lastJson.data
        if (lastTask?.status === 'completed' && lastTask?.result) {
          const r = lastTask.result
          generatedVideoUrl.value = r.videoUrl || r.url || ''
        }
        if (!generatedVideoUrl.value) {
          alert(`视频生成尚未完成，当前状态: ${lastTask?.status || 'unknown'}，请稍后在任务列表中查看`)
        }
      } catch {
        alert('视频生成超时，请稍后查看')
      }
    } else {
      alert('生成失败: ' + (json.error || '未知错误'))
    }
  } catch (err: any) {
    alert('生成出错: ' + (err.message || '未知错误'))
  } finally {
    generatingVideo.value = false
  }
}

// ─── 参考图上传 ───
function triggerRefUpload() {
  refInput.value?.click()
}

function onRefImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  refImageFile.value = input.files[0]
  const reader = new FileReader()
  reader.onload = () => {
    refImagePreview.value = reader.result as string
  }
  reader.readAsDataURL(input.files[0])
}

function clearRefImage() {
  refImagePreview.value = ''
  refImageFile.value = null
}

// ─── 参考视频上传 ───
function triggerVideoRefUpload() {
  videoRefInput.value?.click()
}

function onVideoRefChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]
  videoFile.value = file
  // 使用 createObjectURL 预览，避免大文件 OOM
  if (videoPreview.value) URL.revokeObjectURL(videoPreview.value)
  videoPreview.value = URL.createObjectURL(file)
}

function clearVideoRef() {
  if (videoPreview.value) {
    URL.revokeObjectURL(videoPreview.value)
  }
  videoPreview.value = ''
  videoFile.value = null
}

// ─── AI 优化图片提示词 ───
async function optimizeImagePrompt() {
  if (!imagePrompt.value.trim() && !optimizedScript.value) {
    alert('请先填写提示词或先优化广告脚本'); return
  }
  optimizingImagePrompt.value = true
  try {
    const basePrompt = imagePrompt.value || optimizedScript.value?.narrative || ''
    const token = getAuthToken()
    const res = await fetch('/api/ai/optimize-image-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt: basePrompt,
        negativePrompt: imageNegativePrompt.value,
        hasRefImage: !!refImageFile.value,
      }),
    })
    const json = await res.json()
    if (json.success && json.data?.optimizedPrompt) {
      imagePrompt.value = json.data.optimizedPrompt
      alert('✅ 提示词已优化')
    } else {
      alert('优化失败: ' + (json.error || '未知错误'))
    }
  } catch (err: any) {
    alert('优化出错: ' + (err.message || '未知错误'))
  } finally {
    optimizingImagePrompt.value = false
  }
}

// ─── 图片生成 ───
async function generateAdImage() {
  if (!imagePrompt.value.trim()) { alert('请填写图生图提示词'); return }
  generatingImage.value = true
  try {
    const token = getAuthToken()
    const model = userImageModelName.value || ''
    const mode = refImageFile.value ? 'img2img' : 'txt2img'

    // 直接调用任务队列 API（JSON 接口）
    let referenceImage = ''
    if (refImageFile.value) {
      referenceImage = refImagePreview.value // dataURL 格式
    }

    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000000',
        taskType: 'image',
        input: {
          prompt: imagePrompt.value,
          negativePrompt: imageNegativePrompt.value,
          mode,
          model,
          referenceImage,
          n: 1,
        },
      }),
    })
    const json = await res.json()
    if (json.success && json.task) {
      // 异步任务，轮询等待完成
      const taskId = json.task.id
      if (!taskId) { alert('任务 ID 为空'); return }
      for (let poll = 0; poll < 30; poll++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const pollRes = await fetch(`/api/tasks/${taskId}/status`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!pollRes.ok) continue
          const pollJson = await pollRes.json()
          const task = pollJson.task || pollJson.data
          if (!task) continue
          if (task.status === 'completed' || task.status === 'success' || task.status === 'done') {
            if (task.result?.imageUrl) {
              generatedImages.value.unshift(task.result.imageUrl)
            } else if (task.result?.images?.length) {
              for (const img of task.result.images) {
                generatedImages.value.unshift(typeof img === 'string' ? img : img.url)
              }
            } else {
              alert('图片已生成但未返回图片 URL')
            }
            return
          } else if (task.status === 'failed' || task.status === 'error') {
            alert('图片生成失败: ' + (task.error || task.result?.error || '未知错误'))
            return
          }
        } catch { /* 继续轮询 */ }
      }
      alert('图片生成超时，请稍后查看任务状态')
    } else {
      alert('生成失败: ' + (json.error || '未知错误'))
    }
  } catch (err: any) {
    alert('生成出错: ' + (err.message || '未知错误'))
  } finally {
    generatingImage.value = false
  }
}

onMounted(() => {
  loadUserModelConfig()
})
</script>

<style scoped>
.ad-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  background: #0a0a10;
}
.ad-main {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.ad-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ad-right {
  width: 420px;
  min-width: 420px;
}
.ad-panel {
  background: #0f0f18;
  border: 1px solid #1a1a28;
  border-radius: 12px;
  padding: 16px;
}
.ad-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 12px;
}
.ad-panel-icon { font-size: 16px; }
.ad-textarea {
  width: 100%;
  background: #0a0a14;
  border: 1px solid #1f2937;
  border-radius: 8px;
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.6;
  padding: 10px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.ad-textarea:focus { outline: none; border-color: #3b82f6; }
.ad-select {
  width: 100%;
  background: #0a0a14;
  border: 1px solid #1f2937;
  border-radius: 8px;
  color: #d1d5db;
  font-size: 12px;
  padding: 8px 10px;
  font-family: inherit;
}
.ad-btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.ad-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ad-btn-primary { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; }
.ad-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.ad-btn-secondary { background: #1f2937; color: #d1d5db; margin-top: 8px; }
.ad-btn-secondary:hover:not(:disabled) { background: #374151; }
.ad-btn-sm {
  margin-left: auto;
  background: #1f2937;
  border: none;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
}
.ad-optimized-section { margin-top: 8px; }
.ad-opt-content { margin-top: 8px; }
.ad-opt-label {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  margin: 8px 0 4px;
}
.ad-opt-text {
  background: #0a0a14;
  border: 1px solid #1a1a28;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  color: #d1d5db;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

/* 分镜时间轴卡片 */
.ad-shots-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.ad-shot-card {
  background: #12121e;
  border: 1px solid #1a1a2e;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}
.ad-shot-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-weight: 600;
}
.ad-shot-num {
  color: #4a6cf7;
  background: #1a1a3e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.ad-shot-time {
  color: #999;
  font-size: 11px;
}
.ad-shot-camera {
  color: #888;
  font-size: 11px;
  font-weight: 400;
}
.ad-shot-scene {
  color: #d1d5db;
  line-height: 1.5;
  margin-bottom: 4px;
}
.ad-shot-dialogue,
.ad-shot-effects,
.ad-shot-visual {
  font-size: 11px;
  margin-top: 3px;
  line-height: 1.4;
}
.ad-shot-dialogue { color: #66bb6a; }
.ad-shot-effects { color: #ce93d8; }
.ad-shot-visual { color: #64b5f6; }

.ad-shots-edit-hint {
  font-size: 11px;
  color: #888;
  margin-bottom: 6px;
}
.ad-shots-edit-area {
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  line-height: 1.5 !important;
}
.ad-shots-parse-error {
  color: #ef5350;
  font-size: 12px;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(239,83,80,0.1);
  border-radius: 4px;
}

.ad-field { margin-bottom: 10px; }
.ad-field-label {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  margin-bottom: 4px;
}
.ad-field-input { margin-top: 0; }
.ad-field-row { display: flex; gap: 10px; }
.ad-ref-section { margin-bottom: 12px; }
.ad-ref-upload {
  border: 1px dashed #374151;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 4px;
}
.ad-ref-upload:hover { border-color: #3b82f6; }
.ad-ref-preview { position: relative; display: inline-block; }
.ad-ref-img { max-height: 120px; border-radius: 6px; display: block; }
.ad-ref-remove {
  position: absolute; top: -6px; right: -6px;
  width: 20px; height: 20px; background: #ef4444; color: #fff;
  border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 11px; cursor: pointer;
}
.ad-ref-placeholder {
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 8px;
}
.ad-ref-icon { font-size: 24px; opacity: 0.5; }
.ad-ref-text { font-size: 11px; color: #6b7280; }
.ad-image-results { margin-top: 8px; }
.ad-image-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; }
.ad-image-item { border-radius: 8px; overflow: hidden; cursor: pointer; }
.ad-image-thumb { width: 100%; height: auto; display: block; border-radius: 8px; }
.ad-video-preview { margin-top: 8px; }
.ad-video-player { width: 100%; border-radius: 8px; margin-top: 8px; max-height: 400px; }
.ad-preview-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer;
}
.ad-preview-large { max-width: 90vw; max-height: 90vh; border-radius: 12px; }
.ad-preview-close {
  position: fixed; top: 20px; right: 30px; font-size: 28px;
  color: #fff; cursor: pointer; opacity: 0.7;
}
.ad-preview-close:hover { opacity: 1; }
.dim { font-weight: 400; font-size: 10px; color: #6b7280; }
.ad-model-display {
  background: #0a0a14; border: 1px solid #1f2937;
  border-radius: 8px; padding: 8px 10px; color: #d1d5db;
  font-size: 12px; min-height: 18px;
}
.ad-model-info {
  display: flex; align-items: center; gap: 6px;
  margin-top: 16px; padding: 8px 10px;
  background: #0a0a14; border-radius: 8px; font-size: 11px;
  color: #6b7280;
}
.ad-model-info-icon { font-size: 14px; }
.ad-model-info-text { flex: 1; }
</style>
