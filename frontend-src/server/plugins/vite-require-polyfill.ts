// server/plugins/vite-require-polyfill.ts - Vite 插件：将 require('~/utils/token-cache') 替换为 window.__tc__
import { defineNitroPlugin } from 'nitropack/runtime/plugin'

export default defineNitroPlugin(() => {
  // 这是一个 Nitro 插件占位符，实际逻辑通过 nuxt.config hook 处理
})
