/**
 * core/governance/request-policy.ts — Request Policy Engine
 *
 * Maps API request patterns to concrete behavior policies:
 *   - Timeout and retry strategy
 *   - Circuit breaker binding
 *   - Concurrency limits
 *   - Degraded mode behavior
 *
 * Used by the API Runtime Kernel to determine how to execute a request.
 * More dynamic than the static policy engine — can be updated at runtime.
 */

export interface RequestBehaviorPolicy {
  group: string
  timeout: number
  maxRetries: number
  circuitBreaker: boolean
  maxConcurrency: number
  degradeBehavior: 'allow' | 'delay' | 'block'
  description: string
}

const requestPolicies: Record<string, RequestBehaviorPolicy> = {
  'video-generation': {
    group: 'video-generation',
    timeout: 300_000,
    maxRetries: 0,
    circuitBreaker: true,
    maxConcurrency: 2,
    degradeBehavior: 'block',
    description: 'Video generation — long timeout, no retry, strict concurrency',
  },
  'character-generation': {
    group: 'character-generation',
    timeout: 120_000,
    maxRetries: 0,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'block',
    description: 'Character image generation — slow, no retry',
  },
  'scene-generation': {
    group: 'scene-generation',
    timeout: 120_000,
    maxRetries: 0,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'block',
    description: 'Scene image generation — slow, no retry',
  },
  'storyboard-generation': {
    group: 'storyboard-generation',
    timeout: 120_000,
    maxRetries: 0,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'block',
    description: 'Storyboard generation — slow, no retry',
  },
  'tts-voice': {
    group: 'tts-voice',
    timeout: 60_000,
    maxRetries: 1,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'delay',
    description: 'TTS voice generation — moderate timeout, one retry',
  },
  'frame-generation': {
    group: 'frame-generation',
    timeout: 120_000,
    maxRetries: 0,
    circuitBreaker: true,
    maxConcurrency: 2,
    degradeBehavior: 'block',
    description: 'Frame generation — slow, no retry, strict concurrency',
  },
  'export-pipeline': {
    group: 'export-pipeline',
    timeout: 30_000,
    maxRetries: 2,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'delay',
    description: 'Export pipeline — short timeout, 2 retries',
  },
  'project-data': {
    group: 'project-data',
    timeout: 15_000,
    maxRetries: 2,
    circuitBreaker: false,
    maxConcurrency: 10,
    degradeBehavior: 'allow',
    description: 'Project data reads — fast, low risk',
  },
  'auth': {
    group: 'auth',
    timeout: 10_000,
    maxRetries: 1,
    circuitBreaker: true,
    maxConcurrency: 5,
    degradeBehavior: 'allow',
    description: 'Authentication — short timeout, one retry',
  },
  'director-api': {
    group: 'director-api',
    timeout: 60_000,
    maxRetries: 1,
    circuitBreaker: true,
    maxConcurrency: 3,
    degradeBehavior: 'delay',
    description: 'Director AI APIs — moderate timeout, one retry',
  },
  'sse-stream': {
    group: 'sse-stream',
    timeout: 0,
    maxRetries: 0,
    circuitBreaker: false,
    maxConcurrency: 10,
    degradeBehavior: 'block',
    description: 'SSE event streams — no timeout, no retry, long-lived',
  },
  'system-health': {
    group: 'system-health',
    timeout: 5_000,
    maxRetries: 0,
    circuitBreaker: false,
    maxConcurrency: 10,
    degradeBehavior: 'allow',
    description: 'System health checks — fast, no retry',
  },
  'default': {
    group: 'default',
    timeout: 30_000,
    maxRetries: 1,
    circuitBreaker: true,
    maxConcurrency: 5,
    degradeBehavior: 'allow',
    description: 'Default fallback policy',
  },
}

export const requestPolicy = {
  /**
   * Resolve the request behavior policy for a URL.
   * Uses the API policy engine's endpoint resolution, then maps to
   * the request behavior policy.
   */
  resolve(url: string): RequestBehaviorPolicy {
    if (url.includes('/video/')) return requestPolicies['video-generation']
    if (url.includes('/images/')) return requestPolicies['character-generation']
    if (url.includes('/tts/')) return requestPolicies['tts-voice']
    if (url.includes('/export/')) return requestPolicies['export-pipeline']
    if (url.includes('/projects/') || url.includes('/execution')) return requestPolicies['project-data']
    if (url.includes('/auth/')) return requestPolicies['auth']
    if (url.includes('/v1/') || url.includes('/v2/')) return requestPolicies['director-api']
    if (url.includes('/runtime/')) return requestPolicies['sse-stream']
    if (url.includes('/health')) return requestPolicies['system-health']
    if (url.includes('/user/') || url.includes('/community/') || url.includes('/admin/')) return requestPolicies['project-data']
    return requestPolicies['default']
  },

  /**
   * Get all policies.
   */
  getAll(): RequestBehaviorPolicy[] {
    return Object.values(requestPolicies)
  },

  /**
   * Update a policy at runtime.
   */
  update(group: string, patch: Partial<RequestBehaviorPolicy>): void {
    if (requestPolicies[group]) {
      requestPolicies[group] = { ...requestPolicies[group], ...patch }
    }
  },
}
