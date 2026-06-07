/**
 * core/api/circuit-breaker.ts — Circuit Breaker for API Runtime
 *
 * Prevents cascading failures by monitoring failure rates
 * and tripping to OPEN when thresholds are exceeded.
 *
 * States:
 *   HEALTHY  → normal operation
 *   DEGRADED → reduced retry (1 instead of 3)
 *   OPEN     → block all requests + emit 'circuit_open' event
 *
 * Reset: after a cooldown period (half-open), a single probe request
 * determines whether to close or stay open.
 */

export type CircuitState = 'healthy' | 'degraded' | 'open'

interface CircuitConfig {
  name: string
  failureThreshold: number      // e.g., 3 consecutive failures
  degradationThreshold: number  // e.g., 50% failure rate in window
  cooldownMs: number            // time before half-open probe
  windowSize: number            // rolling window size (events)
}

interface CircuitStateInternal {
  state: CircuitState
  failures: number[]
  lastFailureTime: number
  consecutiveFailures: number
  totalRequests: number
  totalFailures: number
  openedAt: number | null
}

const circuits = new Map<string, CircuitStateInternal>()

const DEFAULT_CONFIG: CircuitConfig = {
  name: 'default',
  failureThreshold: 3,
  degradationThreshold: 0.5,
  cooldownMs: 30_000,
  windowSize: 20,
}

export const circuitBreaker = {
  /**
   * Initialize or get a circuit.
   */
  getOrCreate(name: string, config?: Partial<CircuitConfig>): CircuitStateInternal {
    let c = circuits.get(name)
    if (!c) {
      const cfg = { ...DEFAULT_CONFIG, ...config, name }
      c = {
        state: 'healthy',
        failures: [],
        lastFailureTime: 0,
        consecutiveFailures: 0,
        totalRequests: 0,
        totalFailures: 0,
        openedAt: null,
      }
      circuits.set(name, c)
    }
    return c
  },

  /**
   * Check if a request should be allowed through.
   * Throws if circuit is OPEN.
   */
  check(name: string): { allowed: boolean; state: CircuitState; degraded: boolean } {
    const c = this.getOrCreate(name)
    c.totalRequests++

    // Prune old failures from window
    const now = Date.now()
    c.failures = c.failures.filter(t => now - t < 60_000)

    // If OPEN, check if cooldown expired
    if (c.state === 'open') {
      const config = this.getConfig(name)
      if (c.openedAt && now - c.openedAt >= config.cooldownMs) {
        // Half-open: allow probe
        c.state = 'degraded'
        return { allowed: true, state: 'degraded', degraded: true }
      }
      return { allowed: false, state: 'open', degraded: false }
    }

    // Check for transition conditions
    const failureRate = c.failures.length / Math.max(c.windowSize, 1)

    if (c.consecutiveFailures >= this.getConfig(name).failureThreshold) {
      // Trip to OPEN
      this.trip(name)
      return { allowed: false, state: 'open', degraded: false }
    }

    if (failureRate >= this.getConfig(name).degradationThreshold) {
      c.state = 'degraded'
      return { allowed: true, state: 'degraded', degraded: true }
    }

    return { allowed: true, state: c.state, degraded: false }
  },

  /**
   * Record a successful request.
   */
  recordSuccess(name: string): void {
    const c = circuits.get(name)
    if (!c) return
    c.consecutiveFailures = 0
    if (c.state === 'degraded') {
      // Auto-recover from degraded after a success
      c.state = 'healthy'
    }
  },

  /**
   * Record a failed request.
   */
  recordFailure(name: string): void {
    const c = circuits.get(name)
    if (!c) return
    const now = Date.now()
    c.failures.push(now)
    c.consecutiveFailures++
    c.totalFailures++
    c.lastFailureTime = now
  },

  /**
   * Trip the circuit to OPEN.
   */
  trip(name: string): void {
    const c = circuits.get(name)
    if (!c) return
    c.state = 'open'
    c.openedAt = Date.now()
    console.warn(`[CircuitBreaker] 🔴 ${name} — CIRCUIT OPEN`)
    // Dispatch event for global UI feedback
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('circuit:open', { detail: { name } }))
    }
  },

  /**
   * Manually reset a circuit.
   */
  reset(name: string): void {
    circuits.delete(name)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('circuit:close', { detail: { name } }))
    }
  },

  /**
   * Get circuit state for debugging.
   */
  getState(name: string): { state: CircuitState; consecutiveFailures: number; failureRate: number } | null {
    const c = circuits.get(name)
    if (!c) return null
    const rate = c.failures.length / Math.max(c.windowSize, 1)
    return {
      state: c.state,
      consecutiveFailures: c.consecutiveFailures,
      failureRate: rate,
    }
  },

  /**
   * Get all circuit states.
   */
  getAllStates(): Record<string, { state: CircuitState; consecutiveFailures: number; failureRate: number }> {
    const result: Record<string, any> = {}
    for (const [name] of circuits) {
      const s = this.getState(name)
      if (s) result[name] = s
    }
    return result
  },

  getConfig(name: string): CircuitConfig {
    const c = circuits.get(name)
    if (!c) return DEFAULT_CONFIG
    return DEFAULT_CONFIG  // Use shared config for now
  },
}
