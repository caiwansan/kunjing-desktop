<template>
  <div class="ai-director-panel">
    <div class="panel-header">
      <span class="panel-title">AI Director 建议</span>
      <button class="btn-analyze" @click="analyze" :disabled="analyzing">
        {{ analyzing ? '分析中…' : '分析' }}
      </button>
    </div>

    <!-- Error Banner -->
    <div v-if="errorState" class="error-banner">
      <div class="error-icon">⚠️</div>
      <div class="error-body">
        <div class="error-title">{{ errorState.message }}</div>
        <div class="error-detail">
          阶段: {{ errorState.stage === 'DIRECTOR' ? 'AI 分析' : errorState.stage }}
          {{ errorState.recoverable ? ' · 可重试' : '' }}
        </div>
      </div>
      <button class="error-retry" @click="analyze">重试</button>
    </div>

    <div class="tab-bar">
      <button
        v-for="t in tabs" :key="t.id"
        class="tab-btn"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
    </div>

    <!-- Tab: 优化建议 -->
    <div v-if="activeTab === 'optimize'" class="tab-content-scroll">
      <div v-if="analysis" class="score-section">
        <div class="score-row">
          <div class="score-item">
            <span class="score-value" :class="scoreClass(analysis.pacingScore)">{{ (analysis.pacingScore * 100).toFixed(0) }}%</span>
            <span class="score-label">节奏</span>
          </div>
          <div class="score-item">
            <span class="score-value" :class="scoreClass(analysis.emotionClarity)">{{ (analysis.emotionClarity * 100).toFixed(0) }}%</span>
            <span class="score-label">情绪</span>
          </div>
          <div class="score-item">
            <span class="score-value" :class="scoreClass(analysis.visualDensity)">{{ (analysis.visualDensity * 100).toFixed(0) }}%</span>
            <span class="score-label">画面</span>
          </div>
        </div>
      </div>

      <div v-if="analysis?.continuityIssues.length" class="section">
        <div class="section-title">⚠️ 连续性问题</div>
        <div v-for="(issue, i) in analysis.continuityIssues" :key="i" class="issue-item">{{ issue }}</div>
      </div>

      <div v-if="optimization?.suggestions.length" class="section">
        <div class="section-title">优化建议 ({{ optimization.suggestions.filter(s => !s.applied).length }})</div>
        <div v-for="s in optimization.suggestions" :key="s.id" class="suggestion-item" :class="{ applied: s.applied }">
          <div class="suggestion-header">
            <span class="suggestion-type" :class="s.type">{{ typeLabel(s.type) }}</span>
            <span class="suggestion-second">@{{ s.second }}s</span>
            <button v-if="!s.applied" class="btn-apply" @click="applySuggestion(s)">采纳</button>
            <span v-else class="applied-badge">✓</span>
          </div>
          <div class="suggestion-title">{{ s.title }}</div>
          <div class="suggestion-detail">
            <span class="label">当前:</span> {{ s.currentState }} <span class="arrow">→</span>
            <span class="suggested">{{ s.suggestedState }}</span>
          </div>
          <div v-if="s.description" class="suggestion-desc">{{ s.description }}</div>
          <div class="suggestion-confidence">置信度: {{ (s.confidence * 100).toFixed(0) }}%</div>
        </div>
      </div>

      <div v-if="bindings.length" class="section">
        <div class="section-title">自动绑定资产 ({{ bindings.length }})</div>
        <div v-for="(b, i) in bindings" :key="i" class="binding-item">
          <span class="binding-type">{{ b.type }}</span>
          <span class="binding-name">{{ b.assetName }}</span>
          <span class="binding-second">@{{ b.second }}s</span>
        </div>
      </div>

      <div v-if="!analysis && !optimization && !bindings.length" class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-text">点击分析获取 AI 导演建议</div>
      </div>
    </div>

    <!-- Tab: Graph 视图（内化） -->
    <div v-if="activeTab === 'graph'" class="tab-content-scroll">
      <div v-if="decideResult">
        <div class="section">
          <div class="section-title">场景连续性评分</div>
          <div class="score-bar">
            <div class="score-fill" :style="{ width: (decideResult.graphHints.sceneConsistencyScore * 100) + '%', background: scoreColor(decideResult.graphHints.sceneConsistencyScore) }"></div>
            <span class="score-num">{{ (decideResult.graphHints.sceneConsistencyScore * 100).toFixed(0) }}%</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" :style="{ width: (decideResult.graphHints.emotionContinuityScore * 100) + '%', background: scoreColor(decideResult.graphHints.emotionContinuityScore) }"></div>
            <span class="score-num">{{ (decideResult.graphHints.emotionContinuityScore * 100).toFixed(0) }}%</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" :style="{ width: (decideResult.graphHints.cameraFlowScore * 100) + '%', background: scoreColor(decideResult.graphHints.cameraFlowScore) }"></div>
            <span class="score-num">{{ (decideResult.graphHints.cameraFlowScore * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <div v-if="decideResult.graphHints.emotionCurve.segments.length" class="section">
          <div class="section-title">情绪曲线</div>
          <div class="emotion-strip">
            <div v-for="s in decideResult.graphHints.emotionCurve.segments" :key="s.second" class="emotion-block" :title="`${s.second}s: ${s.emotion}`">
              <span class="emoji">{{ emotionEmoji(s.emotion) }}</span>
              <span class="emotion-label">{{ s.emotion }}</span>
            </div>
          </div>
        </div>

        <div v-if="decideResult.graphHints.emotionWarnings.length" class="section">
          <div class="section-title">⚠️ 情绪警告 ({{ decideResult.graphHints.emotionWarnings.length }})</div>
          <div v-for="(w, i) in decideResult.graphHints.emotionWarnings" :key="i" class="issue-item">{{ w.description }}</div>
        </div>

        <div v-if="decideResult.graphHints.sceneContinuityNotes.length" class="section">
          <div class="section-title">场景连续性</div>
          <div v-for="(note, i) in decideResult.graphHints.sceneContinuityNotes" :key="i" class="graph-note">{{ note }}</div>
        </div>

        <div v-if="decideResult.graphHints.cameraFlow.note" class="section">
          <div class="section-title">📷 镜头流</div>
          <div class="graph-note">{{ decideResult.graphHints.cameraFlow.note }}</div>
        </div>

        <div v-if="decideResult.graphHints.cameraFlow.nodes.length" class="section">
          <div class="section-title">运镜节点 ({{ decideResult.graphHints.cameraFlow.nodes.length }})</div>
          <div v-for="(n, i) in decideResult.graphHints.cameraFlow.nodes" :key="i" class="camera-node">
            <span class="cam-sec">@{{ n.second }}s</span>
            <span class="cam-move">{{ n.movement }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">点击分析生成 Graph 数据</div>
      </div>
    </div>

    <!-- Tab: Continuity 视图（内化） -->
    <div v-if="activeTab === 'continuity'" class="tab-content-scroll">
      <div v-if="continuityData">
        <div class="overview-section">
          <div class="row-label">Continuity 综合评分</div>
          <div class="big-score" :class="scoreClass(continuityData.report.overallScore)">{{ (continuityData.report.overallScore * 100).toFixed(0) }}%</div>
        </div>

        <div class="detail-grid">
          <div v-for="(val, key) in continuityData.report.scores" :key="key" class="detail-item">
            <span class="detail-label">{{ labelMap[key] || key }}</span>
            <span class="detail-score" :class="scoreClass(val)">{{ (val * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Production Constraints</div>
          <div class="constraint-summary">
            <span class="passed">✓ {{ continuityData.constraint.summary.passed }}</span>
            <span class="failed">✗ {{ continuityData.constraint.summary.failed }}</span>
            <span v-if="continuityData.constraint.summary.hardFailures > 0" class="hard-failed">! {{ continuityData.constraint.summary.hardFailures }} hard</span>
          </div>
          <div v-for="check in continuityData.constraint.checks" :key="check.constraintId" class="check-item" :class="{ failed: !check.passed }">
            <span class="check-icon">{{ check.passed ? '✓' : '✗' }}</span>
            <span class="check-detail">{{ check.detail }}</span>
          </div>
        </div>

        <div v-if="continuityData.report.violations.length" class="section">
          <div class="section-title">违规 ({{ continuityData.report.violations.length }})</div>
          <div v-for="(v, i) in continuityData.report.violations" :key="i" class="violation-item" :class="v.severity">
            <div class="violation-header">
              <span class="violation-type">{{ severityLabel(v.severity) }}</span>
              <span class="violation-tag">{{ v.type }}</span>
            </div>
            <div class="violation-desc">{{ v.description }}</div>
            <div class="violation-fix">→ {{ v.fixSuggestion }}</div>
          </div>
        </div>

        <div v-if="continuityData.correction?.corrections.length" class="section">
          <div class="section-title">自动修正计划 ({{ continuityData.correction.corrections.length }})</div>
          <div v-for="(c, i) in continuityData.correction.corrections" :key="i" class="correction-item">
            <span class="corr-type">{{ c.type }}</span>
            <span class="corr-action">{{ c.action }}</span>
            <span class="corr-target">@{{ c.targetSecond }}s</span>
            <span class="corr-suggest">→ {{ c.suggestedValue }}</span>
          </div>
          <div class="improvement">预期提升: +{{ (continuityData.correction.expectedScoreImprovement * 100).toFixed(0) }}%</div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">🎬</div>
        <div class="empty-text">暂无 Continuity 数据</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'
import type { AIAnalysisResult, SegmentOptimization, OptimizationSuggestion, AssetBinding } from '~/studio-v2/runtime/director-ai/director-ai-types'
import { directorAgent } from '~/studio-v2/runtime/director-ai/DirectorAgent'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const props = defineProps<{ segment: SegmentRuntime | null }>()
const emit = defineEmits<{ applySuggestion: [s: OptimizationSuggestion] }>()

const { state } = useStudioStore()
const characters = computed(() => state.workspace.characters)
const allScenes = computed(() => state.workspace.scenes)
const allSegments = computed(() => state.workspace.segments)

const activeTab = ref('optimize')
const tabs = [
  { id: 'optimize', label: '优化建议' },
  { id: 'graph', label: 'Graph 视图' },
  { id: 'continuity', label: 'Continuity' },
]

const analyzing = ref(false)
const errorState = ref<{ code: string; message: string; stage: string; recoverable: boolean } | null>(null)
const analysis = ref<AIAnalysisResult | null>(null)
const optimization = ref<SegmentOptimization | null>(null)
const bindings = ref<AssetBinding[]>([])
const decideResult = ref<any>(null)
const continuityData = ref<{ report: any; constraint: any; correction: any } | null>(null)

watch(() => props.segment?.id, () => {
  analysis.value = null; optimization.value = null; bindings.value = []
  decideResult.value = null; continuityData.value = null; analyzing.value = false; errorState.value = null
})

function analyze() {
  if (!props.segment || !props.segment.timeline) return
  analyzing.value = true
  errorState.value = null

  try {
    setTimeout(() => {
      try {
        if (!props.segment) { analyzing.value = false; return }
        analysis.value = directorAgent.analyze(props.segment, allSegments.value, allScenes.value)
        optimization.value = directorAgent.suggestOptimizations(props.segment)
        bindings.value = directorAgent.suggestAssets(props.segment, characters.value, allScenes.value)

        const result = directorAgent.decide(props.segment, allSegments.value, allScenes.value, true)
        decideResult.value = result.optimizedSegment.graphHints || null

        if (result.continuityReport && result.constraintReport) {
          continuityData.value = {
            report: result.continuityReport,
            constraint: result.constraintReport,
            correction: result.correctionPlan || null,
          }
        }
        analyzing.value = false
      } catch (err) {
        analyzing.value = false
        errorState.value = {
          code: 'AI_ANALYSIS_FAILED',
          message: `AI 分析失败: ${err instanceof Error ? err.message : '未知错误'}`,
          stage: 'DIRECTOR',
          recoverable: true,
        }
      }
    }, 300)
  } catch (err) {
    analyzing.value = false
    errorState.value = {
      code: 'AI_ANALYSIS_CRASH',
      message: `系统异常: ${err instanceof Error ? err.message : '未知错误'}`,
      stage: 'DIRECTOR',
      recoverable: true,
    }
  }
}

function applySuggestion(s: OptimizationSuggestion) {
  if (!optimization.value) return
  s.applied = true
  emit('applySuggestion', s)
}

function scoreClass(v: number): string {
  if (v >= 0.7) return 'good'
  if (v >= 0.4) return 'mid'
  return 'bad'
}

function scoreColor(v: number): string {
  if (v >= 0.7) return '#10b981'
  if (v >= 0.4) return '#f59e0b'
  return '#ef4444'
}

function typeLabel(t: string): string {
  const map: Record<string, string> = { camera: '运镜', emotion: '情绪', pacing: '节奏', asset: '资产', visual: '画面', continuity: '连续' }
  return map[t] || t
}

function severityLabel(s: string): string {
  return { minor: '轻微', major: '主要', critical: '严重' }[s] || s
}

function emotionEmoji(emotion: string): string {
  const map: Record<string, string> = { '平静': '😐', '开心': '😊', '悲伤': '😢', '愤怒': '😠', '恐惧': '😨', '紧张': '😰', '浪漫': '🥰', '悬疑': '🤔', '惊喜': '😲', '震撼': '😮' }
  return map[emotion] || '❓'
}

const labelMap: Record<string, string> = {
  sceneContinuity: '场景连续性',
  characterConsistency: '角色一致性',
  cameraStyleConsistency: '镜头一致性',
  emotionFlowStability: '情绪流畅度',
}
</script>

<style scoped>
.ai-director-panel { display: flex; flex-direction: column; overflow: hidden; height: 100%; }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 8px; }
.panel-title { font-size: 13px; font-weight: 600; color: #d1d5db; }
.btn-analyze { background: #0f3a3a; border: 1px solid #1a4a4a; color: #10b981; font-size: 10px; padding: 4px 12px; border-radius: 6px; cursor: pointer; }
.btn-analyze:hover:not(:disabled) { background: #144a4a; }
.btn-analyze:disabled { opacity: 0.5; cursor: default; }

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px;
  padding: 8px 12px;
  background: #1a0a0a;
  border: 1px solid #3a1a1a;
  border-radius: 8px;
}
.error-icon { font-size: 14px; }
.error-body { flex: 1; min-width: 0; }
.error-title { font-size: 11px; color: #f87171; font-weight: 500; }
.error-detail { font-size: 9px; color: #6b7280; margin-top: 1px; }
.error-retry {
  background: #2a1a1a;
  border: 1px solid #3a2a2a;
  color: #f87171;
  font-size: 9px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.error-retry:hover { background: #3a1a1a; }

.tab-bar { display: flex; gap: 4px; padding: 0 16px 6px; border-bottom: 1px solid #1a1a28; }
.tab-btn { padding: 4px 12px; font-size: 10px; color: #6b7280; background: none; border: none; border-radius: 4px; cursor: pointer; }
.tab-btn.active { background: #1a1a28; color: #d1d5db; }

.tab-content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }

.score-section { background: #0d0d18; border-radius: 8px; padding: 12px; }
.score-row { display: flex; justify-content: space-around; }
.score-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.score-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.score-value.good { color: #10b981; }
.score-value.mid { color: #f59e0b; }
.score-value.bad { color: #ef4444; }
.score-label { font-size: 10px; color: #6b7280; }
.section-title { font-size: 11px; color: #6b7280; font-weight: 600; margin-bottom: 6px; }

.issue-item { background: #1a0a0a; border: 1px solid #2a1a1a; border-radius: 6px; padding: 6px 8px; font-size: 10px; color: #f87171; margin-bottom: 4px; }

.suggestion-item { background: #0d0d18; border: 1px solid #1a1a28; border-radius: 8px; padding: 10px; margin-bottom: 6px; }
.suggestion-item.applied { opacity: 0.4; }
.suggestion-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.suggestion-type { font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.suggestion-type.camera { background: #0f1a3a; color: #60a5fa; }
.suggestion-type.emotion { background: #1a0f3a; color: #a78bfa; }
.suggestion-type.pacing { background: #1a1a0a; color: #fbbf24; }
.suggestion-type.visual { background: #0f1a1a; color: #34d399; }
.suggestion-type.continuity { background: #1a0a0a; color: #f87171; }
.suggestion-type.asset { background: #0f1a0f; color: #34d399; }
.suggestion-second { font-size: 9px; color: #4b5563; margin-left: auto; }
.btn-apply { background: #0f3a3a; border: none; color: #10b981; font-size: 9px; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
.btn-apply:hover { background: #144a4a; }
.applied-badge { color: #10b981; font-size: 11px; }
.suggestion-title { font-size: 11px; color: #d1d5db; font-weight: 500; margin-bottom: 4px; }
.suggestion-detail { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
.suggestion-detail .label { color: #4b5563; }
.suggestion-detail .arrow { color: #4b5563; margin: 0 4px; }
.suggestion-detail .suggested { color: #10b981; }
.suggestion-desc { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
.suggestion-confidence { font-size: 9px; color: #4b5563; }

.binding-item { display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: #0d0d18; border-radius: 6px; font-size: 10px; margin-bottom: 4px; }
.binding-type { font-size: 9px; padding: 1px 5px; border-radius: 4px; text-transform: uppercase; background: #0f1a0f; color: #34d399; }
.binding-name { color: #d1d5db; flex: 1; }
.binding-second { color: #4b5563; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 0; }
.empty-icon { font-size: 24px; opacity: 0.2; }
.empty-text { font-size: 11px; color: #4b5563; }

/* Graph Tab */
.score-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; background: #0d0d18; border-radius: 4px; padding: 4px; }
.score-fill { height: 16px; border-radius: 3px; transition: width 0.3s; min-width: 4px; }
.score-num { font-size: 10px; color: #9ca3af; font-variant-numeric: tabular-nums; white-space: nowrap; }
.emotion-strip { display: flex; gap: 2px; flex-wrap: wrap; }
.emotion-block { display: flex; flex-direction: column; align-items: center; gap: 1px; background: #0d0d18; border: 1px solid #1a1a28; border-radius: 4px; padding: 3px 5px; }
.emoji { font-size: 12px; }
.emotion-label { font-size: 8px; color: #6b7280; white-space: nowrap; }
.graph-note { font-size: 10px; color: #d1d5db; padding: 6px; background: #0d0d18; border-radius: 6px; margin-bottom: 3px; }
.camera-node { display: flex; gap: 6px; font-size: 10px; padding: 4px; background: #0d0d18; border-radius: 4px; margin-bottom: 2px; }
.cam-sec { color: #4b5563; }
.cam-move { color: #60a5fa; }

/* Continuity Tab */
.overview-section { background: #0d0d18; border-radius: 8px; padding: 12px; }
.row-label { font-size: 10px; color: #6b7280; margin-bottom: 6px; text-align: center; }
.big-score { font-size: 28px; font-weight: 700; text-align: center; }
.big-score.good { color: #10b981; }
.big-score.mid { color: #f59e0b; }
.big-score.bad { color: #ef4444; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.detail-item { background: #0d0d18; border: 1px solid #1a1a28; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 9px; color: #6b7280; }
.detail-score { font-size: 14px; font-weight: 600; }
.detail-score.good { color: #10b981; }
.detail-score.mid { color: #f59e0b; }
.detail-score.bad { color: #ef4444; }

.constraint-summary { display: flex; gap: 10px; margin-bottom: 6px; font-size: 10px; }
.passed { color: #10b981; }
.failed { color: #f87171; }
.hard-failed { color: #ef4444; font-weight: 600; }
.check-item { font-size: 10px; padding: 4px 6px; display: flex; gap: 4px; color: #6b7280; }
.check-item.failed { color: #f87171; background: #1a0a0a; border-radius: 4px; }

.violation-item { border-radius: 6px; padding: 8px; margin-bottom: 4px; font-size: 10px; border: 1px solid #1a1a28; }
.violation-item.critical { background: #1a0a0a; border-color: #3a1a1a; }
.violation-item.major { background: #1a1a0a; border-color: #3a3a1a; }
.violation-item.minor { background: #0d0d18; }
.violation-header { display: flex; gap: 6px; margin-bottom: 4px; }
.violation-type { font-size: 9px; padding: 1px 5px; border-radius: 4px; }
.violation-item.critical .violation-type { background: #3a1a1a; color: #f87171; }
.violation-item.major .violation-type { background: #3a3a1a; color: #fbbf24; }
.violation-tag { font-size: 9px; color: #4b5563; }
.violation-desc { color: #d1d5db; }
.violation-fix { color: #6b7280; margin-top: 2px; }

.correction-item { font-size: 10px; padding: 6px 8px; background: #0d0d18; border-radius: 6px; margin-bottom: 3px; display: flex; gap: 8px; }
.corr-type { color: #60a5fa; }
.corr-action { color: #fbbf24; }
.corr-target { color: #4b5563; }
.corr-suggest { color: #10b981; }
.improvement { font-size: 10px; color: #10b981; margin-top: 4px; }
</style>
