<template>
  <div class="timeline-header">
    <div class="header-corner"></div>
    <div
      v-for="s in seconds"
      :key="s"
      class="header-second"
      :class="{ active: activeSecond === s }"
    >
      <span class="second-label">{{ s }}s</span>
      <div class="second-tick"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  duration: number
  activeSecond?: number
}>()

const seconds = computed(() => Array.from({ length: props.duration }, (_, i) => i))
</script>

<style scoped>
.timeline-header {
  display: grid;
  grid-template-columns: 80px repeat(v-bind('duration'), 1fr);
  border-bottom: 1px solid #1a1a28;
}
.header-corner {
  width: 80px;
  border-right: 1px solid #1a1a28;
}
.header-second {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px 4px;
  border-right: 1px solid #0a0a14;
  transition: background 0.15s;
  position: relative;
}
.header-second.active {
  background: #111833;
}
.header-second.active .second-tick {
  background: #3b82f6;
}
.second-label {
  font-size: 10px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.second-tick {
  width: 1px;
  height: 12px;
  background: #1a1a28;
}
</style>
