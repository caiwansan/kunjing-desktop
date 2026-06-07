<template>
  <div class="music-generation-workspace">
    <div class="music-header">
      <h2 class="music-title">🎵 AI 音乐创作</h2>
      <p class="music-subtitle">AI 作词 + 作曲，为你的短剧创作主题曲与配乐</p>
    </div>

    <!-- ════ 左右分栏：左→主题描述 | 右→上歌词下碟片 ════ -->
    <div class="music-main">
      <!-- 左栏：主题描述（占一整个大模块） -->
      <div class="music-left">
        <div class="music-section theme-section">
          <!-- 风格选择 -->
          <div class="section-block">
            <label class="section-label">🎼 音乐风格</label>
            <div class="style-grid">
              <button
                v-for="style in musicStyles"
                :key="style.id"
                class="style-chip"
                :class="{ active: selectedStyle === style.id }"
                @click="selectedStyle = style.id"
              >
                <span class="style-icon">{{ style.icon }}</span>
                <span class="style-name">{{ style.name }}</span>
              </button>
            </div>
          </div>

          <!-- 情绪/氛围 -->
          <div class="section-block">
            <label class="section-label">💫 情绪氛围</label>
            <div class="mood-grid">
              <button
                v-for="mood in moods"
                :key="mood.id"
                class="mood-chip"
                :class="{ active: selectedMood === mood.id }"
                @click="selectedMood = mood.id"
              >
                {{ mood.emoji }} {{ mood.name }}
              </button>
            </div>
          </div>

          <!-- 高级参数 -->
          <div class="section-block">
            <label class="section-label">⚙️ 高级设置</label>
            <div class="param-row">
              <span class="param-label">时长</span>
              <div class="param-controls">
                <button class="param-btn" @click="duration = Math.max(15, duration - 15)">−</button>
                <span class="param-value">{{ duration }}秒</span>
                <button class="param-btn" @click="duration = Math.min(300, duration + 15)">+</button>
              </div>
            </div>
            <div class="param-row">
              <span class="param-label">BPM</span>
              <div class="param-controls">
                <button class="param-btn" @click="bpm = Math.max(40, bpm - 5)">−</button>
                <span class="param-value">{{ bpm }}</span>
                <button class="param-btn" @click="bpm = Math.min(200, bpm + 5)">+</button>
              </div>
            </div>
            <div class="param-row">
              <span class="param-label">乐器偏好</span>
              <div class="instrument-tags">
                <span
                  v-for="inst in instruments"
                  :key="inst"
                  class="inst-tag"
                  :class="{ active: selectedInstruments.includes(inst) }"
                  @click="toggleInstrument(inst)"
                >{{ inst }}</span>
              </div>
            </div>
          </div>

          <!-- 用户提示词 -->
          <div class="section-block">
            <label class="section-label">📝 描述歌曲主题</label>
            <textarea
              v-model="prompt"
              class="music-prompt"
              placeholder="例如：一首古风歌曲，描述深宫女子的思君之情，用古筝和箫伴奏..."
              rows="4"
            />
          </div>

          <!-- AI 创作歌词按钮 -->
          <button
            class="lyric-btn"
            :disabled="lyricGenerating"
            @click="generateLyrics"
          >
            <span v-if="lyricGenerating" class="btn-loading">✍️ 格律歌词创作中...</span>
            <span v-else>✍️ AI 创作歌词（格律押韵）</span>
          </button>
        </div>
      </div>

      <!-- 右栏：上歌词 + 下生成音乐 -->
      <div class="music-right">
        <!-- ===== 上半：歌词模块 ===== -->
        <div class="lyrics-panel">
          <div class="lyrics-panel-header">
            <span class="lyrics-panel-title">📜 歌词</span>
            <span v-if="currentLyrics" class="lyrics-status-badge">✅ 已生成</span>
          </div>
          <div class="lyrics-body" v-if="currentLyrics">
            <pre class="lyrics-text">{{ currentLyrics }}</pre>
          </div>
          <div class="lyrics-body lyrics-empty" v-else>
            <div class="empty-lyrics-icon">🎤</div>
            <p class="empty-lyrics-text">点击左侧「AI 创作歌词」<br/>格律歌词将在此展示</p>
          </div>
        </div>

        <!-- ===== 下半：生成音乐模块 ===== -->
        <div class="music-generate-panel">
          <!-- 生成音乐按钮 -->
          <button
            class="generate-music-btn"
            :disabled="musicGenerating || !currentLyrics"
            @click="generateMusic"
          >
            <span v-if="musicGenerating" class="btn-loading">🎵 音乐合成中...</span>
            <span v-else>🎵 生成音乐</span>
          </button>

          <!-- 9:16 竖版音乐碟片 -->
          <div class="album-disc-wrapper">
            <div class="album-disc" :class="{ 'disc-spinning': isPlaying }">
              <div class="disc-inner">
                <div class="disc-center-hole"></div>
              </div>
              <div class="disc-label">
                <div class="disc-label-text">{{ currentSong?.name || 'AI 创作' }}</div>
                <div class="disc-label-sub">{{ currentSong?.style || '' }}</div>
              </div>
            </div>

            <!-- 碟片底部信息 -->
            <div class="disc-info">
              <div class="disc-title">{{ currentSong?.name || '等待创作...' }}</div>
              <div class="disc-artist">{{ currentSong?.style || '' }}</div>
            </div>

            <!-- 卡拉 OK 歌词同步区 -->
            <div class="karaoke-lyrics" v-if="currentSong?.url && parsedSections.length > 0">
              <div class="karaoke-scroll">
                <div
                  v-for="(section, si) in parsedSections"
                  :key="si"
                  class="karaoke-section"
                >
                  <div class="karaoke-section-label">{{ section.type }}</div>
                  <div
                    v-for="(line, li) in section.lines"
                    :key="li"
                    class="karaoke-line"
                    :class="{
                      'karaoke-line-current': currentLineIdx === cumulativeLineIndex(si, li),
                      'karaoke-line-past': cumulativeLineIndex(si, li) < currentLineIdx
                    }"
                  >
                    <span class="karaoke-text">{{ line }}</span>
                    <span
                      v-if="currentLineIdx === cumulativeLineIndex(si, li)"
                      class="karaoke-highlight"
                      :style="{ width: karaokeProgress + '%' }"
                    >{{ line }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 音频播放器 + 进度条 -->
            <div class="disc-player-bar" v-if="currentSong?.url">
              <button class="play-btn" @click="togglePlay">
                <span v-if="isPlaying">⏸</span>
                <span v-else>▶️</span>
              </button>
              <div class="progress-bar-wrapper" ref="progressBar" @click="seekAudio">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
                </div>
              </div>
              <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration_s) }}</span>
              <input
                type="range"
                class="volume-slider"
                min="0"
                max="1"
                step="0.05"
                :value="volume"
                @input="setVolume"
              />
            </div>

            <!-- 操作按钮 -->
            <div class="disc-actions" v-if="currentSong">
              <button class="disc-action-btn primary" @click="download(currentSong)">
                ⬇ 下载 MP3
              </button>
              <button class="disc-action-btn" @click="showLyricsModal = true">
                📝 提取歌词文字
              </button>
              <button class="disc-action-btn secondary" @click="addToProject(currentSong)">
                📌 加入项目
              </button>
            </div>
          </div>

          <!-- 生成记录 -->
          <div v-if="history.length > 0" class="history-section">
            <label class="section-label">📋 生成记录</label>
            <div
              v-for="item in history"
              :key="item.id"
              class="history-item"
            >
              <div class="history-info">
                <span class="history-style">{{ item.style }} · {{ item.duration }}s</span>
                <span class="history-time">{{ item.createdAt }}</span>
              </div>
              <div class="history-actions">
                <button class="action-btn" @click="selectFromHistory(item)">▶ 播放</button>
                <button class="action-btn" @click="download(item)">⬇ 下载</button>
                <button class="action-btn danger" @click="deleteItem(item.id)">🗑</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 歌词提取弹窗 -->
    <Transition name="modal-fade">
      <div v-if="showLyricsModal" class="lyrics-modal-overlay" @click.self="showLyricsModal = false">
        <div class="lyrics-modal">
          <div class="lyrics-modal-header">
            <span>📝 歌词全文</span>
            <button class="lyrics-modal-close" @click="showLyricsModal = false">✕</button>
          </div>
          <pre class="lyrics-modal-body">{{ currentSong?.lyrics || currentLyrics || '' }}</pre>
          <div class="lyrics-modal-footer">
            <button class="lyrics-copy-btn" @click="copyLyrics">📋 复制歌词</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <div v-if="showToast" class="toast">{{ toastMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// ====== 状态 ======
const selectedStyle = ref('epic')
const selectedMood = ref('cinematic')
const duration = ref(30)
const bpm = ref(120)
const prompt = ref('')
const selectedInstruments = ref<string[]>([])

const lyricGenerating = ref(false)   // 歌词生成中
const musicGenerating = ref(false)   // 音乐合成中
const currentLyrics = ref('')        // 当前歌词文本
const currentSong = ref<any>(null)   // 当前完整歌曲
const showLyricsModal = ref(false)

const showToast = ref(false)
const toastMessage = ref('')
const audioPlayer = ref<HTMLAudioElement | null>(null)

// ====== 卡拉 OK 状态 ======
const isPlaying = ref(false)
const currentTime = ref(0)
const duration_s = ref(0)
const volume = ref(0.8)
const currentLineIdx = ref(0)
const karaokeProgress = ref(0)
const progressPercent = ref(0)
const progressBar = ref<HTMLElement | null>(null)
const karaokeInterval = ref<number | null>(null)

// ====== 数据 ======
const musicStyles = [
  { id: 'epic', name: '史诗', icon: '🏛️' },
  { id: 'chinese-classical', name: '古风', icon: '🏮' },
  { id: 'cinematic', name: '电影感', icon: '🎬' },
  { id: 'electronic', name: '电子', icon: '⚡' },
  { id: 'jazz', name: '爵士', icon: '🎷' },
  { id: 'ambient', name: '氛围', icon: '🌊' },
  { id: 'pop', name: '流行', icon: '🎤' },
  { id: 'rock', name: '摇滚', icon: '🎸' },
  { id: 'orchestral', name: '管弦乐', icon: '🎻' },
  { id: 'lofi', name: 'Lo-Fi', icon: '☕' },
]

const moods = [
  { id: 'cinematic', name: '电影叙事', emoji: '🎞️' },
  { id: 'happy', name: '欢快', emoji: '😊' },
  { id: 'sad', name: '伤感', emoji: '😢' },
  { id: 'tense', name: '紧张', emoji: '😰' },
  { id: 'mysterious', name: '神秘', emoji: '🔮' },
  { id: 'peaceful', name: '平和', emoji: '🧘' },
  { id: 'grand', name: '宏大', emoji: '🗿' },
  { id: 'romantic', name: '浪漫', emoji: '💕' },
  { id: 'playful', name: '俏皮', emoji: '😜' },
  { id: 'dark', name: '暗黑', emoji: '🌑' },
]

const instruments = ['钢琴', '吉他', '古筝', '笛子', '小提琴', '鼓', '贝斯', '琵琶', '二胡', '箫', '合成器', '大提琴']

const history = ref<any[]>([])

// ====== 解析歌词为段落 ======
const parsedSections = computed(() => {
  const text = currentLyrics.value || currentSong.value?.lyrics || ''
  if (!text) return []
  const sections: Array<{ type: string; lines: string[] }> = []
  let currentSection: { type: string; lines: string[] } | null = null
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentSection) { sections.push(currentSection); currentSection = null }
      continue
    }
    const typeMatch = trimmed.match(/^[【\[](.*?)[\]】]/)
    if (typeMatch) {
      if (currentSection) sections.push(currentSection)
      currentSection = { type: typeMatch[1], lines: [] }
    } else {
      if (!currentSection) currentSection = { type: '', lines: [] }
      currentSection.lines.push(trimmed)
    }
  }
  if (currentSection) sections.push(currentSection)
  return sections
})

const totalLyricLines = computed(() => {
  let n = 0
  for (const sec of parsedSections.value) n += sec.lines.length
  return n
})

function cumulativeLineIndex(si: number, li: number): number {
  let idx = 0
  for (let s = 0; s < si; s++) {
    idx += parsedSections.value[s]?.lines.length || 0
  }
  return idx + li
}

// ====== 卡拉 OK 控制 ======
function createAudio() {
  if (!currentSong.value?.url) return
  const audio = new Audio(currentSong.value.url)
  audio.volume = volume.value
  audio.addEventListener('loadedmetadata', () => {
    duration_s.value = audio.duration
  })
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
    progressPercent.value = duration_s.value > 0 ? (audio.currentTime / duration_s.value) * 100 : 0
    updateKaraokeLine(audio.currentTime, duration_s.value)
  })
  audio.addEventListener('ended', () => {
    isPlaying.value = false
    if (karaokeInterval.value) { clearInterval(karaokeInterval.value); karaokeInterval.value = null }
  })
  audioPlayer.value = audio
}

function togglePlay() {
  if (!audioPlayer.value && currentSong.value?.url) {
    createAudio()
  }
  if (!audioPlayer.value) return
  if (isPlaying.value) {
    audioPlayer.value.pause()
    if (karaokeInterval.value) { clearInterval(karaokeInterval.value); karaokeInterval.value = null }
  } else {
    audioPlayer.value.play().catch(() => {})
    startKaraokeTimer()
  }
  isPlaying.value = !isPlaying.value
}

function startKaraokeTimer() {
  if (karaokeInterval.value) clearInterval(karaokeInterval.value)
  karaokeInterval.value = window.setInterval(() => {
    if (audioPlayer.value) {
      karaokeProgress.value = totalLyricLines.value > 0
        ? ((audioPlayer.value.currentTime % (duration_s.value / Math.max(totalLyricLines.value, 1))) /
            (duration_s.value / Math.max(totalLyricLines.value, 1))) * 100
        : 0
    }
  }, 50)
}

function updateKaraokeLine(ct: number, dur: number) {
  if (dur <= 0 || totalLyricLines.value <= 0) return
  const lineDuration = dur / totalLyricLines.value
  const idx = Math.min(Math.floor(ct / lineDuration), totalLyricLines.value - 1)
  currentLineIdx.value = idx
  const lineProgress = ((ct % lineDuration) / lineDuration) * 100
  karaokeProgress.value = Math.min(lineProgress, 100)
}

function seekAudio(e: MouseEvent) {
  if (!audioPlayer.value || !progressBar.value) return
  const rect = progressBar.value.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  audioPlayer.value.currentTime = ratio * duration_s.value
}

function setVolume(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  volume.value = val
  if (audioPlayer.value) audioPlayer.value.volume = val
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function toggleInstrument(inst: string) {
  const idx = selectedInstruments.value.indexOf(inst)
  if (idx >= 0) {
    selectedInstruments.value.splice(idx, 1)
  } else {
    selectedInstruments.value.push(inst)
  }
}

// ====== 第一步：AI 创作歌词（只提交 DeepSeek 生成歌词） ======
async function generateLyrics() {
  if (!prompt.value.trim()) {
    showToastMessage('⚠️ 请先描述歌曲主题')
    return
  }

  lyricGenerating.value = true

  const style = musicStyles.find(s => s.id === selectedStyle.value)
  const mood = moods.find(m => m.id === selectedMood.value)
  const styleName = style?.name || '史诗'
  const moodName = mood?.name || '电影叙事'
  const instStr = selectedInstruments.value.length > 0
    ? `，乐器：${selectedInstruments.value.join('、')}`
    : ''

  try {
    const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
    const res = await fetch('/api/music/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        style: styleName,
        mood: moodName,
        duration: duration.value,
        bpm: bpm.value,
        instruments: selectedInstruments.value,
        prompt: `${prompt.value} 风格：${styleName}，情绪：${moodName}${instStr}`,
        onlyLyrics: true,
      }),
    })

    if (!res.ok) {
      showToastMessage('⚠️ 歌词生成失败，请检查 DeepSeek Key 配置')
      lyricGenerating.value = false
      return
    }

    const data = await res.json()
    if (data.success && data.data?.lyrics) {
      currentLyrics.value = data.data.lyrics
      // 更新当前歌曲（仅歌词，无音频）
      currentSong.value = {
        id: 'lyrics-' + Date.now(),
        name: data.data.title || prompt.value.slice(0, 20),
        url: '',
        lyrics: data.data.lyrics,
        duration: duration.value,
        style: styleName,
        createdAt: new Date().toLocaleString(),
      }
      showToastMessage('✅ 歌词创作完成！可点击「生成音乐」合成配乐')
    } else {
      showToastMessage('⚠️ 歌词生成异常：' + (data.data?.error || '请重试'))
    }
  } catch (e) {
    console.error('[Lyrics] Generation error:', e)
    showToastMessage('⚠️ 歌词生成请求失败')
  }

  lyricGenerating.value = false
}

// ====== 第二步：生成音乐（将歌词提交给音乐大模型） ======
async function generateMusic() {
  if (!currentLyrics.value) {
    showToastMessage('⚠️ 请先创作歌词')
    return
  }

  musicGenerating.value = true

  const style = musicStyles.find(s => s.id === selectedStyle.value)
  const mood = moods.find(m => m.id === selectedMood.value)
  const styleName = style?.name || '史诗'
  const moodName = mood?.name || '电影叙事'

  try {
    // 获取用户配置的音乐模型凭据
    const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
    if (!token) {
      showToastMessage('⚠️ 请先登录昆仑镜')
      musicGenerating.value = false
      return
    }

    const configRes = await fetch('/api/v2/user/model-config/unified', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const configJson = await configRes.json()
    const musicConfig = configJson?.data

    if (!musicConfig?.musicEnabled || !musicConfig?.hasMusicApiKey) {
      showToastMessage('⚠️ 请先在大模型设置中配置音乐模型 API Key')
      musicGenerating.value = false
      return
    }

    // 提交歌词给音乐大模型
    const musicRes = await fetch('/api/music/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        style: styleName,
        mood: moodName,
        duration: duration.value,
        bpm: bpm.value,
        instruments: selectedInstruments.value,
        prompt: `为以下歌词配乐：${currentLyrics.value}`,
        title: currentSong.value?.name || prompt.value.slice(0, 20),
        lyrics: currentLyrics.value,
        provider: musicConfig.musicProvider,
        model: musicConfig.musicModel,
      }),
    })

    if (musicRes.ok) {
      const musicData = await musicRes.json()
      if (musicData.success && musicData.data?.audioUrl) {
        currentSong.value = {
          id: musicData.data.taskId || 'music-' + Date.now(),
          name: musicData.data.title || currentSong.value?.name || 'AI 歌曲',
          url: musicData.data.audioUrl,
          lyrics: currentLyrics.value,
          duration: musicData.data.duration || duration.value,
          style: styleName,
          createdAt: new Date().toLocaleString(),
        }
        showToastMessage('🎵 音乐生成成功！')
      } else {
        showToastMessage('📝 音频合成暂不可用：' + (musicData.data?.error || '请检查 API Key'))
      }
    } else {
      showToastMessage('⚠️ 音乐合成失败（' + musicRes.status + '）')
    }

    // 加入历史
    if (currentSong.value?.url) {
      history.value.unshift({ ...currentSong.value })
    }
  } catch (e) {
    console.error('[Music] Generation error:', e)
    showToastMessage('⚠️ 音乐合成请求失败')
  }

  musicGenerating.value = false
}

// ====== 选择历史记录 ======
function selectFromHistory(item: any) {
  currentSong.value = { ...item, lyrics: item.lyrics || currentLyrics.value }
}

// ====== 下载 ======
function download(item: any) {
  if (!item.url) {
    showToastMessage('⚠️ 暂无音频可下载')
    return
  }
  const a = document.createElement('a')
  a.href = item.url
  a.download = `昆仑镜-${item.style}-${Date.now()}.mp3`
  a.click()
  showToastMessage('⬇ 下载中...')
}

function addToProject(item: any) {
  showToastMessage(`✅ 「${item.name}」已加入项目资源库`)
}

function deleteItem(id: string) {
  history.value = history.value.filter(h => h.id !== id)
}

// ====== 复制歌词 ======
function copyLyrics() {
  const text = currentSong.value?.lyrics || currentLyrics.value || ''
  navigator.clipboard.writeText(text).then(() => {
    showToastMessage('📋 歌词已复制到剪贴板')
  }).catch(() => {
    showToastMessage('⚠️ 复制失败，请手动选择文本')
  })
}

function showToastMessage(msg: string) {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 3000)
}
</script>

<style scoped>
.music-generation-workspace {
  @apply flex flex-col h-full bg-gray-900 text-gray-100;
}

.music-header {
  @apply px-6 py-4 border-b border-gray-700 bg-gray-800/50;
}

.music-title {
  @apply text-lg font-bold text-white;
}

.music-subtitle {
  @apply text-sm text-gray-400 mt-1;
}

/* ═══════ 左右分栏：左→主题 | 右→上歌词下碟片 ═══════ */
.music-main {
  @apply flex flex-1 overflow-hidden min-h-0;
}

.music-left {
  @apply w-1/2 p-4 overflow-y-auto;
}

.music-right {
  @apply w-1/2 p-4 border-l border-gray-700 overflow-y-auto flex flex-col gap-3;
}

/* 左栏主题描述用一个大卡片包住 */
.theme-section {
  @apply bg-gray-800 rounded-lg p-5 shadow-sm space-y-4;
}

.section-block {
  @apply block;
}

.section-label {
  @apply text-sm font-semibold text-gray-300 mb-2 block;
}

.style-grid {
  @apply flex flex-wrap gap-2;
}

.style-chip {
  @apply flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-600
    text-sm text-gray-400 hover:border-blue-400 hover:text-blue-300
    transition-all cursor-pointer;
}

.style-chip.active {
  @apply bg-blue-900/40 border-blue-400 text-blue-300 font-medium;
}

.style-icon { font-size: 1.1em; }
.style-name { font-size: 0.85em; }

.mood-grid {
  @apply flex flex-wrap gap-2;
}

.mood-chip {
  @apply px-3 py-1.5 rounded-full border border-gray-600 text-sm text-gray-400
    hover:border-purple-400 hover:text-purple-300 transition-all cursor-pointer;
}

.mood-chip.active {
  @apply bg-purple-900/40 border-purple-400 text-purple-300 font-medium;
}

.param-row {
  @apply flex items-center justify-between py-1.5;
}

.param-label {
  @apply text-sm text-gray-400;
}

.param-controls {
  @apply flex items-center gap-2;
}

.param-btn {
  @apply w-7 h-7 rounded-full border border-gray-600 flex items-center justify-center
    text-gray-400 hover:bg-gray-700 transition-colors;
}

.param-value {
  @apply text-sm font-medium min-w-[50px] text-center text-gray-200;
}

.instrument-tags {
  @apply flex flex-wrap gap-1.5 mt-1;
}

.inst-tag {
  @apply px-2 py-0.5 rounded text-xs border border-gray-600 text-gray-400
    cursor-pointer hover:border-green-400 hover:text-green-300 transition-colors;
}

.inst-tag.active {
  @apply bg-green-900/40 border-green-400 text-green-300;
}

.music-prompt {
  @apply w-full border border-gray-600 rounded-lg p-3 text-sm resize-none
    bg-gray-700 text-gray-200 placeholder-gray-500
    focus:outline-none focus:border-blue-400 transition-colors;
}

.lyric-btn {
  @apply w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600
    text-white font-semibold text-sm transition-all hover:opacity-90
    disabled:opacity-60 disabled:cursor-not-allowed;
}

/* ===== 右下半：生成音乐模块 ===== */
.music-generate-panel {
  @apply bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col items-center gap-3
    border border-gray-700/50;
}

/* 歌词面板 */
.lyrics-panel {
  @apply bg-gray-800 rounded-lg shadow-sm flex-1 flex flex-col border border-gray-700/50;
}

.lyrics-panel-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-700;
}

.lyrics-panel-title {
  @apply text-sm font-semibold text-gray-300;
}

.lyrics-status-badge {
  @apply text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300;
}

.lyrics-body {
  @apply flex-1 overflow-y-auto p-4;
}

.lyrics-text {
  @apply text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-sans;
}

.lyrics-empty {
  @apply flex flex-col items-center justify-center text-gray-500;
}

.empty-lyrics-icon {
  @apply text-5xl mb-3;
}

.empty-lyrics-text {
  @apply text-sm text-center;
}

/* ═══════ 下半部分：碟片 ═══════ */
.generate-music-btn {
  @apply w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600
    text-white font-semibold text-base transition-all hover:opacity-90
    disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20;
}

.btn-loading {
  @apply animate-pulse;
}

/* 9:16 竖版音乐碟片 */
.album-disc-wrapper {
  @apply flex flex-col items-center;
}

.album-disc {
  position: relative;
  width: 220px;
  height: 390px; /* 9:16 比例 */
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.disc-inner {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #2d3436, #0a0a0a);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.05), inset 0 0 60px rgba(0, 0, 0, 0.5);
  animation: none;
  position: relative;
}

.disc-center-hole {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #1a1a2e;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
}

.disc-label {
  margin-top: 24px;
  text-align: center;
  padding: 0 16px;
}

.disc-label-text {
  font-size: 16px;
  font-weight: 700;
  color: #e0e0e0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disc-label-sub {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}

/* 光碟旋转 */
.disc-spinning .disc-inner {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.disc-info {
  text-align: center;
  margin-top: 12px;
}

.disc-title {
  font-size: 14px;
  font-weight: 600;
  color: #d0d0d0;
}

.disc-artist {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.disc-player {
  width: 100%;
  max-width: 360px;
  margin-top: 8px;
}

.disc-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.disc-action-btn {
  @apply px-5 py-2 rounded-full text-xs font-medium transition-all;
  background: rgba(255, 255, 255, 0.08);
  color: #ccc;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.disc-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.disc-action-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
}

.disc-action-btn.primary:hover {
  opacity: 0.9;
}

.disc-action-btn.secondary {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.disc-action-btn.secondary:hover {
  background: rgba(16, 185, 129, 0.35);
}

/* 历史记录 */
.history-section {
  @apply w-full max-w-md space-y-2;
}

.history-item {
  @apply bg-gray-800 rounded-lg p-3 shadow-sm flex items-center justify-between;
}

.history-info {
  @apply text-xs text-gray-400;
}

.history-style {
  @apply block;
}

.history-time {
  @apply block text-gray-500;
}

.history-actions {
  @apply flex gap-2;
}

.action-btn {
  @apply px-3 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300
    hover:bg-gray-600 transition-colors;
}

.action-btn.danger {
  @apply bg-red-900/40 text-red-300 hover:bg-red-800/50;
}

/* 歌词弹窗 */
.lyrics-modal-overlay {
  @apply fixed inset-0 bg-black/60 flex items-center justify-center z-50;
}

.lyrics-modal {
  @apply bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl;
}

.lyrics-modal-header {
  @apply flex items-center justify-between px-6 py-4 border-b border-gray-700 text-gray-200 font-semibold;
}

.lyrics-modal-close {
  @apply w-8 h-8 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white;
}

.lyrics-modal-body {
  @apply flex-1 overflow-y-auto p-6 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed;
}

.lyrics-modal-footer {
  @apply px-6 py-4 border-t border-gray-700 flex justify-end;
}

.lyrics-copy-btn {
  @apply px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
    hover:bg-blue-500 transition-colors;
}

/* Toast */
.toast {
  @apply fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg
    bg-gray-700 text-white text-sm shadow-lg z-50;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 弹窗动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* ═══════ 卡拉 OK 歌词同步 ═══════ */
.karaoke-lyrics {
  width: 100%;
  max-height: 200px;
  overflow: hidden;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  position: relative;
}

.karaoke-scroll {
  padding: 12px 16px;
  overflow-y: auto;
  max-height: 190px;
  scroll-behavior: smooth;
}

.karaoke-section {
  margin-bottom: 8px;
}

.karaoke-section-label {
  font-size: 10px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 2px;
}

.karaoke-line {
  position: relative;
  padding: 3px 6px;
  margin: 2px 0;
  border-radius: 4px;
  transition: all 0.15s ease;
  font-size: 13px;
  line-height: 1.6;
  color: #555;
}

.karaoke-line-past {
  color: #999;
}

.karaoke-line-current {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

.karaoke-text {
  position: relative;
  z-index: 1;
}

.karaoke-highlight {
  position: absolute;
  left: 6px;
  top: 3px;
  white-space: nowrap;
  overflow: hidden;
  color: #fbbf24;
  z-index: 2;
  font-weight: 600;
  pointer-events: none;
}

/* 播放器控制条 */
.disc-player-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 24px;
}

.play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s;
}

.play-btn:hover {
  transform: scale(1.08);
}

.play-btn:active {
  transform: scale(0.95);
}

.progress-bar-wrapper {
  flex: 1;
  cursor: pointer;
  height: 24px;
  display: flex;
  align-items: center;
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #fbbf24);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.time-display {
  font-size: 11px;
  color: #888;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  min-width: 70px;
  text-align: center;
}

.volume-slider {
  width: 60px;
  height: 3px;
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
}

/* 自定义滚动条 */
.karaoke-scroll::-webkit-scrollbar {
  width: 3px;
}

.karaoke-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.karaoke-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
</style>
