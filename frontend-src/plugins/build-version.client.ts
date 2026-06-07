/**
 * plugins/build-version.client.ts — P3-lite: Build Version Consistency
 *
 * 前端启动时校验前端 + 后端版本是否一致。
 * 版本不匹配时触发刷新。
 *
 * 版本格式：${buildTime}-${buildId}
 * build-* 前缀的后端版本（PM2 每次重启生成）跳过精确匹配，
 * 因为前后端 buildTime 天然不同。
 *
 * 校验规则：
 *   1. 忽略 dev 版本（buildVersion 以 "dev-" 开头）
 *   2. 后端不可达时不阻塞，进入 degraded mode
 *   3. 后端版本以 "build-" 开头 → 跳过精确匹配（PM2 重启版本）
 *   4. 版本不一致时：刷新页面
 */

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const buildVersion = config.public.buildVersion as string

  // 跳过 dev 版本检查
  if (!buildVersion || buildVersion.startsWith('dev-')) return

  let success = false
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      const res = await fetch('/api/system/version', { signal: controller.signal })
      clearTimeout(timeout)

      if (!res.ok) continue
      const data = await res.json()
      const serverVersion = data?.version as string

      // 后端版本以 "build-" 开头 → PM2 重启生成，跳过精确匹配
      if (serverVersion && serverVersion.includes('-build-')) {
        success = true
        break
      }

      // 只有精确版本号（如 git commit hash）才需要精确匹配
      if (serverVersion && serverVersion !== buildVersion) {
        console.warn(
          `[BuildVersion] Mismatch! frontend=${buildVersion} backend=${serverVersion}. Reloading...`
        )
        const jitter = 1000 + Math.random() * 4000
        setTimeout(() => { window.location.reload() }, jitter)
        return
      }

      success = true
      break
    } catch {
      // 重试
    }
  }

  if (!success) {
    console.warn('[BuildVersion] Cannot reach backend — running in degraded consistency mode')
  }
})
