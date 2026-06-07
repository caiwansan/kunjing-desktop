<template>
  <div class="wardrobe-panel">
    <div class="panel-header">
      <span class="panel-title">换装管理</span>
    </div>

    <!-- 角色选择 -->
    <div class="character-select">
      <label>角色</label>
      <select v-model="selectedCharId">
        <option value="">— 选择角色 —</option>
        <option v-for="ch in characters" :key="ch.id" :value="ch.id">
          {{ ch.name }}
        </option>
      </select>
    </div>

    <!-- 当前服装 -->
    <div v-if="selectedChar" class="current-outfit">
      <div class="section-label">当前服装</div>
      <div class="outfit-display">{{ selectedChar.costume || '未设定' }}</div>
    </div>

    <!-- 换装建议 -->
    <div v-if="selectedChar" class="outfit-suggestions">
      <div class="section-label">AI 换装建议</div>
      <div class="suggestion-list">
        <div
          v-for="(suggestion, i) in outfitSuggestions"
          :key="i"
          class="suggestion-item"
          @click="applyOutfit(suggestion)"
        >
          <div class="suggestion-name">{{ suggestion.name }}</div>
          <div class="suggestion-desc">{{ suggestion.description }}</div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!selectedChar && characters.length > 0" class="empty-state">
      <div class="empty-hint">请选择角色</div>
    </div>
    <div v-if="characters.length === 0" class="empty-state">
      <div class="empty-hint">暂无角色，请在角色设定中添加</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const { state, updateCharacter } = useStudioStore()
const characters = computed(() => state.workspace.characters)
const selectedCharId = ref('')

const selectedChar = computed(() =>
  characters.value.find(c => c.id === selectedCharId.value)
)

const outfitSuggestions = computed(() => {
  if (!selectedChar.value) return []
  const personality = selectedChar.value.personality || ''
  const desc = selectedChar.value.description || ''
  const suggestions = generateOutfitSuggestions(personality, desc)
  return suggestions
})

function generateOutfitSuggestions(personality: string, description: string): { name: string; description: string }[] {
  const suggestions: { name: string; description: string }[] = []

  if (personality.includes('冷酷') || personality.includes('严肃')) {
    suggestions.push({ name: '经典正装', description: '深色西装/礼服，线条利落' })
    suggestions.push({ name: '战术装束', description: '功能性强，暗色调搭配金属装饰' })
  }
  if (personality.includes('温柔') || personality.includes('善良')) {
    suggestions.push({ name: '温暖居家', description: '柔和色系，棉麻材质' })
    suggestions.push({ name: '自然简约', description: '素色纯棉，清爽干净' })
  }
  if (personality.includes('活泼') || personality.includes('开朗')) {
    suggestions.push({ name: '青春休闲', description: '明亮色系，运动风格' })
    suggestions.push({ name: '潮流混搭', description: '个性配饰，层次感丰富' })
  }
  if (description.includes('古代') || description.includes('古装')) {
    suggestions.push({ name: '文人墨客', description: '长袍广袖，飘逸素雅' })
    suggestions.push({ name: '戎装英姿', description: '铠甲兵器，威武刚健' })
  }
  if (description.includes('科幻') || description.includes('未来')) {
    suggestions.push({ name: '赛博风尚', description: '霓虹色调，发光材料' })
    suggestions.push({ name: '机甲战斗', description: '机械外骨骼，金属质感' })
  }
  if (description.includes('职场') || description.includes('上班')) {
    suggestions.push({ name: '职场精英', description: '简约质感套装，低调配饰' })
  }

  if (suggestions.length === 0) {
    suggestions.push({ name: '经典款', description: '百搭基础款，适合多种场合' })
    suggestions.push({ name: '个性款', description: '凸显角色性格的特色着装' })
  }

  return suggestions
}

function applyOutfit(suggestion: { name: string; description: string }) {
  if (!selectedCharId.value) return
  updateCharacter(selectedCharId.value, { costume: `${suggestion.name}: ${suggestion.description}` })
}
</script>

<style scoped>
.wardrobe-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-title { font-size: 13px; font-weight: 600; color: #d1d5db; }

.section-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }

.character-select label { font-size: 11px; color: #6b7280; display: block; margin-bottom: 4px; }
.character-select select {
  width: 100%;
  background: #0d0d18;
  border: 1px solid #1a1a28;
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d5db;
  font-size: 12px;
}

.current-outfit {
  background: #0d0d18;
  border-radius: 8px;
  padding: 12px;
}
.outfit-display { font-size: 12px; color: #9ca3af; line-height: 1.4; }

.suggestion-list { display: flex; flex-direction: column; gap: 6px; }
.suggestion-item {
  background: #0d0d18;
  border: 1px solid #1a1a28;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.suggestion-item:hover { border-color: #2a2a3a; background: #111122; }
.suggestion-name { font-size: 12px; color: #d1d5db; font-weight: 500; margin-bottom: 2px; }
.suggestion-desc { font-size: 10px; color: #6b7280; }

.empty-state { text-align: center; padding: 20px 0; }
.empty-hint { font-size: 11px; color: #4b5563; }
</style>
