<template>
  <div class="error-page">
    <div class="error-card">
      <h1>😵 页面渲染出错了</h1>
      <p class="error-msg">{{ error?.statusMessage || error?.message || '未知错误' }}</p>
      <p class="error-hint">这可能是浏览器缓存了旧版本，按 <kbd>Ctrl+F5</kbd> 硬刷新后重试</p>
      <button class="retry-btn" @click="handleRefresh">🔄 硬刷新</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  error: Object,
})

function handleRefresh() {
  // 强制无缓存刷新
  window.location.reload(true)
}
</script>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0b0f14;
  color: #b0b8c8;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.error-card {
  background: #1a1f26;
  border: 1px solid #2a3038;
  border-radius: 12px;
  padding: 48px 40px;
  max-width: 500px;
  text-align: center;
}

h1 {
  font-size: 22px;
  margin: 0 0 16px;
  color: #e8edf5;
}

.error-msg {
  font-size: 14px;
  color: #ff6b6b;
  margin: 0 0 12px;
  word-break: break-all;
}

.error-hint {
  font-size: 13px;
  color: #8892a0;
  margin: 0 0 24px;
}

kbd {
  background: #2a3038;
  border: 1px solid #3a4048;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

.retry-btn {
  background: #4a6cf7;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #5a7cff;
}
</style>
