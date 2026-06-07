<template>
  <div class="auth-redirect-page">
    <div class="redirect-card">
      <div class="spinner"></div>
      <p>授权完成，正在登录…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('wechat_token') || urlParams.get('qq_token') || ''
  const username = urlParams.get('wechat_user') || urlParams.get('qq_user') || ''
  const error = urlParams.get('error') || ''

  if (error) {
    // 通知父窗口出错
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_ERROR', error }, window.location.origin)
    }
  } else if (token) {
    // 使用 token-cache 统一保存（内存 + localStorage）
    const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
    setToken(token)
    if (username) {
      setUser({ username })
    }

    // 通知父窗口
    if (window.opener) {
      window.opener.postMessage({
        type: 'OAUTH_LOGIN',
        token,
        user: { username: username || '用户' }
      }, window.location.origin)
    }
  }

  // 短暂延迟后关闭窗口
  setTimeout(() => {
    if (window.opener) {
      window.close()
    } else {
      // 没有 opener（直接访问），重定向到首页
      window.location.href = '/'
    }
  }, 500)
})
</script>

<style scoped>
.auth-redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050508;
  color: #d1d5db;
  font-family: system-ui, -apple-system, sans-serif;
}
.redirect-card {
  text-align: center;
  padding: 40px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #1a1a2e;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
p { font-size: 13px; color: #6b7280; }
</style>
