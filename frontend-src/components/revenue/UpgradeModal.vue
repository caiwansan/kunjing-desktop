<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal">
          <div class="modal-header">
            <div class="header-icon">💎</div>
            <h2>解锁完整 AI 导演能力</h2>
            <button class="close-btn" @click="$emit('close')">✕</button>
          </div>

          <div class="features">
            <div class="feature-item" v-for="f in features" :key="f.icon">
              <span class="feature-icon">{{ f.icon }}</span>
              <span class="feature-text">{{ f.text }}</span>
            </div>
          </div>

          <div class="plans-strip">
            <div
              v-for="plan in plans" :key="plan.id"
              class="plan-card"
              :class="{ active: selected === plan.id, highlight: plan.highlight }"
              @click="selected = plan.id"
            >
              <div v-if="plan.highlight" class="badge">推荐</div>
              <div class="plan-name">{{ plan.label }}</div>
              <div class="plan-price">¥{{ plan.price }}<span class="period">/{{ plan.period }}</span></div>
              <div class="plan-desc">{{ plan.description }}</div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-upgrade" @click="upgrade">
              立即升级 {{ selectedPlan?.label }}
            </button>
            <button class="btn-later" @click="$emit('close')">继续免费使用</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  upgrade: [planId: string]
}>()

const selected = ref('Pro')

const features = [
  { icon: '♾️', text: '无限 AI 调用，不限次数' },
  { icon: '🎯', text: '完整 DirectorAgent — 节奏/情绪/连续性分析' },
  { icon: '⚡', text: 'Prompt 编译优化 + 优先执行队列' },
  { icon: '🎨', text: 'Graph 深度分析 + 运镜建议' },
]

const plans = [
  { id: 'gold', label: '黄金会员', price: 199, period: '月', description: '无限 AI 调用 + 高级导演分析', highlight: false },
  { id: 'Pro', label: '钻石会员', price: 299, period: '月', description: '无限 AI + 完整 DirectorAgent + 优先队列', highlight: true },
  { id: 'director', label: '导演年卡', price: 2999, period: '年', description: '全部功能 + 年付优惠', highlight: false },
]

const selectedPlan = computed(() => plans.find(p => p.id === selected.value)!)

function upgrade() {
  emit('upgrade', selected.value)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(4px);
}
.modal {
  background: #0d0d18; border: 1px solid #1a1a28; border-radius: 16px;
  width: 460px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
}
.modal-header { display: flex; align-items: center; gap: 10px; padding: 24px 24px 0; }
.header-icon { font-size: 24px; }
.modal-header h2 { font-size: 16px; font-weight: 600; color: #d1d5db; flex: 1; }
.close-btn { background: none; border: none; color: #4b5563; font-size: 16px; cursor: pointer; }
.close-btn:hover { color: #9ca3af; }

.features { padding: 16px 24px; display: flex; flex-direction: column; gap: 8px; }
.feature-item { display: flex; align-items: center; gap: 8px; }
.feature-icon { font-size: 14px; }
.feature-text { font-size: 12px; color: #9ca3af; }

.plans-strip { display: flex; gap: 8px; padding: 0 24px 16px; }
.plan-card {
  flex: 1; position: relative; padding: 14px 10px;
  border: 1px solid #1a1a28; border-radius: 10px; cursor: pointer;
  text-align: center; transition: all 0.15s;
}
.plan-card:hover { background: #0d0d18; }
.plan-card.highlight { border-color: #10b981; background: rgba(16,185,129,0.05); }
.plan-card.active { border-color: #10b981; }
.badge { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; font-size: 8px; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
.plan-name { font-size: 11px; font-weight: 600; color: #d1d5db; margin-bottom: 4px; }
.plan-price { font-size: 18px; font-weight: 700; color: #10b981; }
.period { font-size: 10px; color: #6b7280; font-weight: 400; }
.plan-desc { font-size: 9px; color: #6b7280; margin-top: 4px; }

.modal-actions { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 8px; }
.btn-upgrade {
  background: linear-gradient(135deg, #10b981, #059669); border: none;
  color: white; font-size: 13px; font-weight: 600; padding: 12px;
  border-radius: 10px; cursor: pointer;
}
.btn-upgrade:hover { background: linear-gradient(135deg, #059669, #047857); }
.btn-later { background: none; border: 1px solid #1a1a28; color: #6b7280; font-size: 11px; padding: 8px; border-radius: 8px; cursor: pointer; }
.btn-later:hover { color: #9ca3af; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
