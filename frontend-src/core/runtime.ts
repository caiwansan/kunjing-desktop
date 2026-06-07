// runtime.ts — Unified Runtime Entry
// Identity → Execution → Control

export { projectKernel } from './identity/projectKernel'
export { timerRegistry, sseRegistry, abortRegistry } from './execution/lifecycle'
export { apiKernel } from './control/api'
export { circuitBreaker } from './control/breaker'
export { apiPolicyEngine, runtimeGuard, autoHeal, requestPolicy } from './control/policy'
export { telemetry } from './control/telemetry'
export { markUIOrigin, clearUIOrigin, getUIOrigin } from './control/telemetry/graph'

/**
 * Runtime health check — run after project switch to verify cleanup.
 * Call during development to assert no orphan async state.
 */
export function runtimeHealthCheck(): {
  activeTimers: number
  activeSSE: number
  activeAbortControllers: number
  clean: boolean
} {
  const activeTimers = timerRegistry.activeCount
  const activeSSE = sseRegistry.activeCount
  const activeAbortControllers = abortRegistry.activeCount
  const clean = activeTimers === 0 && activeSSE === 0 && activeAbortControllers === 0
  return { activeTimers, activeSSE, activeAbortControllers, clean }
}
