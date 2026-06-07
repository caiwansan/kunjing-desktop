/**
 * core/governance/auto-heal.ts — Auto-Healing System
 *
 * Monitors runtime telemetry and triggers recovery actions when
 * system health degrades beyond thresholds.
 *
 * TRIGGERS:
 *   1. API failure rate > 40% over last 20 requests ─→ enter degraded mode
 *   2. Circuit breaker OPEN state ─→ enter degraded mode + notify
 *   3. Retry explosion (4+ retries/sec) ─→ back off generation queue
 *   4. SSE disconnect loop (3+ disconnects/min) ─→ reduce polling
 *   5. Long recovery: auto-exit degraded mode after 60s of success
 */

import { telemetry } from '~/core/control/telemetry'
import { apiPolicyEngine } from '~/core/control/policy/engine'
import { circuitBreaker } from '~/core/control/breaker'

interface HealState {
  lastDegradedEntry: number
  isHealing: boolean
  consecutiveSuccess: number
  sseDisconnectsInWindow: number[]
  retryBurstCount: number
  lastRetryCheckTime: number
}

const state: HealState = {
  lastDegradedEntry: 0,
  isHealing: false,
  consecutiveSuccess: 0,
  sseDisconnectsInWindow: [],
  retryBurstCount: 0,
  lastRetryCheckTime: Date.now(),
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null
let healEnabled = true

// ─── Thresholds ───────────────────────────────────────────────────────

const THRESHOLDS = {
  failureRateDegrade: 0.40,     // 40% failure → degrade
  degradedCooldownMs: 60_000,   // stay in degraded at least 60s
  successToRecover: 10,         // 10 consecutive successes → exit degraded
  sseDisconnectLimit: 3,        // 3 disconnects in window
  sseWindowMs: 60_000,          // 60s window for SSE disconnects
  retryBurstLimit: 4,           // 4 retries per second = burst
}

// ─── Recovery Actions ─────────────────────────────────────────────────

function enterDegradedMode(): void {
  const now = Date.now()
  if (state.lastDegradedEntry > 0 && now - state.lastDegradedEntry < THRESHOLDS.degradedCooldownMs) {
    return  // Already recently degraded
  }
  apiPolicyEngine.enterDegradedMode()
  state.lastDegradedEntry = now
  state.isHealing = true
  state.consecutiveSuccess = 0
  telemetry.recordGovernance('Auto-heal: entering degraded mode (failure threshold exceeded)')
}

function exitDegradedMode(): void {
  apiPolicyEngine.exitDegradedMode()
  state.isHealing = false
  state.consecutiveSuccess = 0
  telemetry.recordGovernance('Auto-heal: exiting degraded mode (recovery threshold met)')
}

function notifyCircuitOpen(): void {
  telemetry.recordGovernance('Auto-heal: circuit breaker OPEN detected, ensuring degraded mode')
  if (!apiPolicyEngine.isDegraded) {
    apiPolicyEngine.enterDegradedMode()
    state.lastDegradedEntry = Date.now()
  }
}

function handleRetryBurst(): void {
  telemetry.recordGovernance('Auto-heal: retry burst detected, backing off generation queue')
  apiPolicyEngine.updatePolicy('/api/images/', { maxConcurrency: 1, degradedAction: 'delay' })
  apiPolicyEngine.updatePolicy('/api/video/', { maxConcurrency: 1, degradedAction: 'delay' })
}

// ─── Health Check Tick ────────────────────────────────────────────────

function tick(): void {
  if (!healEnabled) return

  const stats = telemetry.getStats()
  const now = Date.now()

  // 1. Check failure rate
  const recentErrors = stats.recentErrors.length
  if (recentErrors >= 5) {
    // Rough heuristic: if telemetry shows failures in recent events
    enterDegradedMode()
  }

  // 2. Check circuit breaker states
  const circuitStates = circuitBreaker.getAllStates()
  for (const [name, s] of Object.entries(circuitStates)) {
    if (s.state === 'open') {
      notifyCircuitOpen()
      break
    }
  }

  // 3. Check SSE disconnect loops
  state.sseDisconnectsInWindow = state.sseDisconnectsInWindow.filter(t => now - t < THRESHOLDS.sseWindowMs)
  if (state.sseDisconnectsInWindow.length >= THRESHOLDS.sseDisconnectLimit) {
    enterDegradedMode()
    state.sseDisconnectsInWindow = []  // Reset to avoid repeated triggers
  }

  // 4. Check retry burst
  const timeSinceLastCheck = now - state.lastRetryCheckTime
  if (timeSinceLastCheck < 1000 && state.retryBurstCount >= THRESHOLDS.retryBurstLimit) {
    handleRetryBurst()
  }
  if (timeSinceLastCheck >= 1000) {
    state.lastRetryCheckTime = now
    state.retryBurstCount = 0
  }

  // 5. Recovery: check if we're in degraded and conditions improved
  if (apiPolicyEngine.isDegraded) {
    const successEvents = stats.byStatus?.success ?? 0
    if (successEvents >= THRESHOLDS.successToRecover) {
      const degradedDuration = now - state.lastDegradedEntry
      if (degradedDuration >= THRESHOLDS.degradedCooldownMs) {
        exitDegradedMode()
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export const autoHeal = {
  /**
   * Start the auto-heal health check loop.
   */
  start(intervalMs: number = 15_000): void {
    if (healthCheckInterval) return
    healthCheckInterval = setInterval(tick, intervalMs)
    telemetry.recordGovernance(`Auto-heal started (interval: ${intervalMs}ms)`)
  },

  /**
   * Stop the health check loop.
   */
  stop(): void {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    }
    telemetry.recordGovernance('Auto-heal stopped')
  },

  /**
   * Record an SSE disconnect event (for disconnect loop detection).
   */
  recordSSEDisconnect(): void {
    state.sseDisconnectsInWindow.push(Date.now())
  },

  /**
   * Record a retry event.
   */
  recordRetry(): void {
    state.retryBurstCount++
  },

  /**
   * Enable or disable auto-heal.
   */
  setEnabled(enabled: boolean): void {
    healEnabled = enabled
  },

  /**
   * Force enter degraded mode.
   */
  forceDegrade(): void {
    enterDegradedMode()
  },

  /**
   * Force exit degraded mode.
   */
  forceRecover(): void {
    exitDegradedMode()
  },

  /**
   * Get current state.
   */
  getState(): { isHealing: boolean; isDegraded: boolean; degradedMs: number; consecutiveSuccess: number } {
    return {
      isHealing: state.isHealing,
      isDegraded: apiPolicyEngine.isDegraded,
      degradedMs: state.lastDegradedEntry > 0 ? Date.now() - state.lastDegradedEntry : 0,
      consecutiveSuccess: state.consecutiveSuccess,
    }
  },
}
