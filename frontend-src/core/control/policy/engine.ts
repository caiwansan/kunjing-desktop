/**
 * core/governance/api-policy-engine.ts — API Governance Policy Engine
 *
 * Defines and enforces rules for every API endpoint group.
 * Policies control: retry behavior, circuit breaker group, rate limiting,
 * and whether the endpoint is currently allowed.
 */

export interface EndpointPolicy {
  endpoint: string       // prefix match, e.g., '/api/projects/'
  allowed: boolean
  circuitGroup: string
  maxRetries: number
  timeout: number
  maxConcurrency: number
  degradedAction: 'allow' | 'delay' | 'block'
}

type PolicyMatch = { policy: EndpointPolicy; params: Record<string, string> }

const policies: EndpointPolicy[] = [
  // ── Authentication ──
  { endpoint: '/api/auth/', allowed: true, circuitGroup: 'auth', maxRetries: 1, timeout: 10_000, maxConcurrency: 5, degradedAction: 'allow' },

  // ── Project Data ──
  { endpoint: '/api/projects/', allowed: true, circuitGroup: 'projects', maxRetries: 2, timeout: 15_000, maxConcurrency: 10, degradedAction: 'allow' },

  // ── Character / Image Generation ──
  { endpoint: '/api/images/', allowed: true, circuitGroup: 'generation', maxRetries: 0, timeout: 120_000, maxConcurrency: 3, degradedAction: 'block' },

  // ── Video Generation ──
  { endpoint: '/api/video/', allowed: true, circuitGroup: 'generation', maxRetries: 0, timeout: 300_000, maxConcurrency: 2, degradedAction: 'block' },

  // ── TTS / Voice ──
  { endpoint: '/api/tts/', allowed: true, circuitGroup: 'generation', maxRetries: 1, timeout: 60_000, maxConcurrency: 3, degradedAction: 'delay' },

  // ── Export ──
  { endpoint: '/api/export/', allowed: true, circuitGroup: 'export', maxRetries: 2, timeout: 30_000, maxConcurrency: 3, degradedAction: 'delay' },

  // ── Exec Results ──
  { endpoint: '/api/execution-images/', allowed: true, circuitGroup: 'projects', maxRetries: 2, timeout: 15_000, maxConcurrency: 5, degradedAction: 'allow' },

  // ── V1 Director ──
  { endpoint: '/api/v1/', allowed: true, circuitGroup: 'director', maxRetries: 1, timeout: 60_000, maxConcurrency: 3, degradedAction: 'delay' },

  // ── V2 Director ──
  { endpoint: '/api/v2/', allowed: true, circuitGroup: 'director', maxRetries: 1, timeout: 60_000, maxConcurrency: 3, degradedAction: 'delay' },

  // ── SSE / Runtime ──
  { endpoint: '/api/runtime/', allowed: true, circuitGroup: 'sse', maxRetries: 0, timeout: 0, maxConcurrency: 10, degradedAction: 'block' },

  // ── User Model Config ──
  { endpoint: '/api/user/', allowed: true, circuitGroup: 'user', maxRetries: 1, timeout: 10_000, maxConcurrency: 5, degradedAction: 'allow' },

  // ── Community ──
  { endpoint: '/api/community/', allowed: true, circuitGroup: 'community', maxRetries: 1, timeout: 10_000, maxConcurrency: 5, degradedAction: 'allow' },

  // ── Admin ──
  { endpoint: '/api/admin/', allowed: true, circuitGroup: 'admin', maxRetries: 1, timeout: 10_000, maxConcurrency: 5, degradedAction: 'allow' },

  // ── Health / Status ──
  { endpoint: '/api/health', allowed: true, circuitGroup: 'system', maxRetries: 0, timeout: 5_000, maxConcurrency: 10, degradedAction: 'allow' },

  // ── Default (catch-all) ──
  { endpoint: '/api/', allowed: true, circuitGroup: 'default', maxRetries: 1, timeout: 30_000, maxConcurrency: 5, degradedAction: 'allow' },
]

// ─── Dynamic State ────────────────────────────────────────────────────

let isDegradedMode = false

const activeEndpointCount = new Map<string, number>()  // endpoint → active requests

// ─── Engine ───────────────────────────────────────────────────────────

export const apiPolicyEngine = {
  /**
   * Resolve the policy for a given URL (longest prefix match).
   */
  resolve(url: string): EndpointPolicy {
    const normalized = url.startsWith('/') ? url : new URL(url, 'http://localhost').pathname
    let best: EndpointPolicy | null = null
    let bestLen = 0
    for (const p of policies) {
      if (normalized.startsWith(p.endpoint) && p.endpoint.length > bestLen) {
        best = p
        bestLen = p.endpoint.length
      }
    }
    return best ?? policies[policies.length - 1]  // default fallback
  },

  /**
   * Check whether a request is allowed through.
   */
  check(url: string): { allowed: boolean; policy: EndpointPolicy; reason?: string } {
    const policy = this.resolve(url)

    // Explicit block
    if (!policy.allowed) {
      return { allowed: false, policy, reason: 'Endpoint disabled by policy' }
    }

    // Degraded mode blocking
    if (isDegradedMode && policy.degradedAction === 'block') {
      return { allowed: false, policy, reason: `Degraded mode: ${policy.circuitGroup} blocked` }
    }

    // Concurrency limit (approximate)
    const activeCount = activeEndpointCount.get(policy.circuitGroup) ?? 0
    if (activeCount >= policy.maxConcurrency) {
      return { allowed: false, policy, reason: `Concurrency limit: ${policy.circuitGroup} (${activeCount}/${policy.maxConcurrency})` }
    }

    return { allowed: true, policy }
  },

  /**
   * Increment concurrency counter for a circuit group.
   */
  incrementCount(url: string): void {
    const policy = this.resolve(url)
    const current = activeEndpointCount.get(policy.circuitGroup) ?? 0
    activeEndpointCount.set(policy.circuitGroup, current + 1)
  },

  /**
   * Decrement concurrency counter.
   */
  decrementCount(url: string): void {
    const policy = this.resolve(url)
    const current = activeEndpointCount.get(policy.circuitGroup) ?? 0
    if (current > 0) activeEndpointCount.set(policy.circuitGroup, current - 1)
  },

  /**
   * Enter degraded mode.
   */
  enterDegradedMode(): void {
    isDegradedMode = true
    console.warn('[Governance] ⚠️ Entering degraded mode — heavy endpoints blocked')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('governance:degraded', { detail: { active: true } }))
    }
  },

  /**
   * Exit degraded mode.
   */
  exitDegradedMode(): void {
    isDegradedMode = false
    console.log('[Governance] ✅ Exiting degraded mode')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('governance:degraded', { detail: { active: false } }))
    }
  },

  get isDegraded(): boolean { return isDegradedMode },

  /**
   * Get all policies (for admin UI / debugging).
   */
  getAllPolicies(): EndpointPolicy[] {
    return [...policies]
  },

  /**
   * Update a policy at runtime.
   */
  updatePolicy(endpoint: string, patch: Partial<EndpointPolicy>): void {
    const idx = policies.findIndex(p => p.endpoint === endpoint)
    if (idx >= 0) {
      policies[idx] = { ...policies[idx], ...patch }
    }
  },
}
