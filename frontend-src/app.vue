<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// 兼容 ?admin 查询参数 → 重定向到 /admin/
if (process.client) {
  const params = new URLSearchParams(window.location.search)
  if (params.has('admin')) {
    const target = '/admin/aigc/login'
    window.location.replace(target)
  }
}
</script>
