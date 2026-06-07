<template>
  <div class="video-style-panel">
    <div class="vp-header">
      <div class="vp-title">🎬 风格锁定</div>
      <button
        class="vp-lock-btn"
        :class="{ locked: locked }"
        @click="$emit('toggle-lock')"
        :title="locked ? '点击解锁，允许各卡片单独设置风格' : '点击锁定，所有卡片统一使用此风格'"
      >
        <span v-if="locked">🔒</span>
        <span v-else>🔓</span>
        <span class="vp-lock-text">{{ locked ? '已锁定' : '未锁定' }}</span>
      </button>
    </div>

    <!-- ⭐ 风格选择 -->
    <div class="vp-section">
      <div class="vp-label">🎬 视频风格</div>
      <!-- 加载中 -->
      <div v-if="loading" class="vp-loading">⏳ 加载风格配置...</div>
      <!-- 错误 -->
      <div v-else-if="error" class="vp-error">{{ error }}</div>
      <!-- 风格按钮网格（从后端 style_profiles 表读取，禁止硬编码） -->
      <div v-else class="vp-options">
        <button
          v-for="s in profileList"
          :key="s.name"
          class="vp-btn"
          :class="{ active: currentStyle === s.name }"
          @click="selectStyle(s.name)"
        >
          <span class="vp-icon">{{ s.icon }}</span>
          <span class="vp-text">{{ s.displayName }}</span>
        </button>
      </div>
    </div>

    <!-- 画面比例 -->
    <div class="vp-section">
      <div class="vp-label">📐 画面比例</div>
      <div class="vp-options">
        <button
          v-for="r in ratios"
          :key="r.id"
          class="vp-btn vp-ratio"
          :class="{ active: currentRatio === r.id }"
          @click="$emit('update:ratio', r.id)"
        >
          <span class="vp-icon">{{ r.label }}</span>
          <span class="vp-desc">{{ r.desc }}</span>
        </button>
      </div>
    </div>

    <!-- ⭐ 当前风格的详细参数（展开式） -->
    <details v-if="activeProfile" class="vp-details">
      <summary class="vp-details-summary">📋 风格详情</summary>
      <div class="vp-details-body">
        <p class="vp-desc-text">{{ activeProfile.description }}</p>
        <div v-if="activeProfile.styleTokens" class="vp-token-display">
          <span class="vp-token-label">🎨 正面修饰词</span>
          <code class="vp-token-code">{{ activeProfile.styleTokens }}</code>
        </div>
        <div v-if="activeProfile.negativeTokens" class="vp-token-display">
          <span class="vp-token-label">🚫 负面修饰词</span>
          <code class="vp-token-code">{{ activeProfile.negativeTokens }}</code>
        </div>
        <div v-if="activeProfile.modelRoutes?.video" class="vp-model-route">
          <span class="vp-token-label">🎥 视频模型</span>
          <code class="vp-token-code">{{ activeProfile.modelRoutes.video.provider }} / {{ activeProfile.modelRoutes.video.model }}</code>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

interface StyleProfile {
  name: string
  displayName: string
  icon: string
  description: string
  styleTokens: string
  negativeTokens: string
  promptOverrides: Record<string, string>
  modelRoutes: {
    image?: { provider: string; model: string }
    video?: { provider: string; model: string }
    llm?: { provider: string; model: string }
  }
  referenceImageUrl?: string
  parameters: Record<string, any>
  isDefault: boolean
  sortOrder: number
}

const props = defineProps<{
  currentStyle: string
  currentRatio: string
  locked: boolean
}>()

const emit = defineEmits<{
  'update:style': [value: string]
  'update:ratio': [value: string]
  'toggle-lock': []
  'style-loaded': [profile: StyleProfile]  // ⭐ 风格加载时通知父组件
}>()

const loading = ref(false)
const error = ref('')
const profiles = ref<StyleProfile[]>([])

const profileList = computed(() => profiles.value)

const activeProfile = computed(() =>
  profiles.value.find(p => p.name === props.currentStyle) || null
)

async function loadProfiles() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/v1/style-profiles')
    const json = await res.json()
    if (json.success && Array.isArray(json.data)) {
      profiles.value = json.data
    } else {
      error.value = '加载风格配置失败'
    }
  } catch (e: any) {
    error.value = '网络错误: ' + e.message
  } finally {
    loading.value = false
  }
}

function selectStyle(name: string) {
  emit('update:style', name)
  const profile = profiles.value.find(p => p.name === name)
  if (profile) {
    emit('style-loaded', profile)
  }
}

// ⭐ 监听 activeProfile 变化，通知父组件
watch(activeProfile, (profile) => {
  if (profile) {
    emit('style-loaded', profile)
  }
})

const ratios = [
  { id: '16:9', label: '16:9', desc: '横屏 · 宽银幕' },
  { id: '9:16', label: '9:16', desc: '竖屏 · 短视频' },
  { id: '1:1', label: '1:1', desc: '正方形' },
  { id: '4:3', label: '4:3', desc: '经典电视' },
]

onMounted(loadProfiles)
</script>

<style scoped>
.video-style-panel {
  background: linear-gradient(145deg, rgba(25, 28, 38, 0.97), rgba(16, 18, 26, 0.97));
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  padding: 16px;
  width: 100%;
  max-width: 360px;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.3),
    0 4px 12px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.06);
}
.vp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.vp-title { font-size: 15px; font-weight: 600; }
.vp-lock-btn {
  display: flex; align-items: center; gap: 4px;
  background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
  border: 1px solid rgba(255,255,255,0.12); border-bottom-width: 2px;
  border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
  transition: all .15s;
  text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.vp-lock-btn:active { transform: translateY(1px); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.vp-lock-btn.locked {
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.15));
  border-color: #3b82f6; color: #93c5fd;
  box-shadow: 0 2px 4px rgba(59,130,246,0.15), inset 0 1px 0 rgba(147,197,253,0.15);
}
.vp-section { margin-bottom: 16px; }
.vp-label { font-size: 13px; color: #9ca3af; margin-bottom: 8px; }
.vp-options { display: flex; flex-wrap: wrap; gap: 6px; }
.vp-btn {
  display: flex; align-items: center; gap: 4px;
  background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.10); border-bottom-width: 2px;
  border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
  transition: all .15s; white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.vp-btn:hover {
  background: linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
  border-color: rgba(255,255,255,0.18);
  box-shadow: 0 3px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10);
  transform: translateY(-1px);
}
.vp-btn:active { transform: translateY(1px); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.vp-btn.active {
  background: linear-gradient(145deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.15));
  border-color: #3b82f6; color: #93c5fd;
  box-shadow: 0 2px 6px rgba(59,130,246,0.2), inset 0 1px 0 rgba(147,197,253,0.12);
}
.vp-icon { font-size: 16px; }
.vp-text {
  color: #ffffff;
  font-weight: 600;
  text-shadow:
    0 1px 0 #666,
    0 2px 0 #555,
    0 3px 0 #444,
    0 4px 4px rgba(0,0,0,0.4);
  letter-spacing: 0.3px;
}
.vp-btn.active .vp-text {
  color: #ffffff;
  text-shadow:
    0 1px 0 #2563eb,
    0 2px 0 #1d4ed8,
    0 3px 0 #1e40af,
    0 4px 4px rgba(37,99,235,0.3);
}
.vp-ratio { min-width: 60px; justify-content: center; }
.vp-desc { font-size: 11px; color: #6b7280; }
.vp-loading, .vp-error { font-size: 13px; color: #9ca3af; padding: 8px 0; }
.vp-error { color: #f87171; }
.vp-details { margin-top: 8px; }
.vp-details-summary { font-size: 13px; color: #9ca3af; cursor: pointer; padding: 4px 0; }
.vp-details-body { padding: 8px 0 0 0; }
.vp-desc-text { font-size: 13px; color: #d1d5db; margin-bottom: 8px; }
.vp-token-display { margin-bottom: 6px; }
.vp-token-label { font-size: 12px; color: #9ca3af; display: block; margin-bottom: 2px; }
.vp-token-code { 
  display: block; font-size: 12px; color: #d1d5db; 
  background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 6px;
  word-break: break-all; line-height: 1.5;
}
.vp-model-route { margin-bottom: 6px; }
</style>
