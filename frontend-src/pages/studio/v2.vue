<template>
  <div style="width:100%;height:100%">
    <StudioWorkspaceLayout />
  </div>
</template>

<script setup lang="ts">
console.log('[PHASE2] studio/v2.vue script setup start')
// v2 Runtime Workspace
import StudioWorkspaceLayout from '~/studio-v2/layout/StudioWorkspaceLayout.vue'
console.log('[PHASE2] StudioWorkspaceLayout imported')
</script>

<style>
/* Full height page reset */
html, body, #__nuxt {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
