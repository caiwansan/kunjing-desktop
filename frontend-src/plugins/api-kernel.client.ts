/**
 * plugins/api-kernel.client.ts — Bootstrap API Runtime Kernel + Governance Layer
 *
 * Registers:
 *   - API Runtime Kernel (auth, interceptors, circuit breaker)
 *   - Runtime Guard (runtime violation monitoring)
 *   - Request Policy Engine (per-API-group behavior)
 *   - Telemetry (event observability)
 *   - Auto-Healing (degraded mode, recovery)
 */

import { defineNuxtPlugin } from '#app'
import { apiKernel } from '~/core/control/api'
import { runtimeGuard } from '~/core/control/policy/guard'
import { telemetry } from '~/core/control/telemetry'
import { autoHeal } from '~/core/control/policy/heal'

export default defineNuxtPlugin((nuxtApp) => {
  // 1. Install Runtime Guard (must be first — wraps localStorage, timers)
  if (process.client) {
    runtimeGuard.install()
  }

  // 2. Initialize API Kernel
  apiKernel.initialize({
    baseUrl: '',
    defaultTimeout: 30_000,
    defaultRetry: 3,
    authTokenGetter: () => {
      try {
        const getToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
        return getToken() || null
      } catch {
        return null
      }
    },
    onAuthRefresh: async () => false,
    onAuthExpired: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
      telemetry.recordGovernance('Auth token expired')
    },
  })

  // 3. Request interceptor: telemetry + project auto-attach
  apiKernel.addRequestInterceptor(async (req) => {
    if (!req.projectId) {
      try {
        const { projectKernel } = await import('~/core/identity/projectKernel')
        if (projectKernel?.projectId) {
          req.projectId = projectKernel.projectId
        }
      } catch {}
    }
    return req
  })

  // 4. Response interceptor: telemetry + 5xx logging
  apiKernel.addResponseInterceptor(async (res) => {
    if (res.status >= 500) {
      console.error(`[ApiKernel] 5xx: ${res.url} → ${res.status}`)
      telemetry.recordAPI(res.url, 'fail', 0, undefined, `HTTP ${res.status}`)
    }
    return res
  })

  // 5. Wire telemetry into circuit breaker events
  if (typeof window !== 'undefined') {
    window.addEventListener('circuit:open', ((e: CustomEvent) => {
      telemetry.recordGovernance(`Circuit OPEN: ${e.detail.name}`)
    }) as EventListener)

    window.addEventListener('circuit:close', ((e: CustomEvent) => {
      telemetry.recordGovernance(`Circuit CLOSED: ${e.detail.name}`)
    }) as EventListener)
  }

  // 6. Start auto-heal (15s check interval)
  if (process.client) {
    autoHeal.start(15_000)
  }

  // 7. Provide $api for template usage
  nuxtApp.provide('api', apiKernel)

  telemetry.recordRuntime('bootstrap', 'Governance layer installed (kernel + guard + policy + telemetry + auto-heal)')
  console.log('[Governance] ✅ All layers installed')
})
