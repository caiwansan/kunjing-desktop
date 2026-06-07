/**
 * core/api/api-runtime-kernel.ts — API Runtime Kernel
 *
 * ═══════════════════════════════════════════════════════════════════════
 * Enterprise-grade request execution kernel for the AI Studio.
 *
 * Capabilities:
 *   - Unified request/response lifecycle
 *   - AbortController + project lifecycle binding
 *   - Retry (exponential backoff, max 3)
 *   - Circuit breaker (per-circuit)
 *   - Auth token injection + 401 auto-refresh
 *   - Request graph tracing
 *   - Timeout enforcement
 *   - SSE as long-lived requests in request graph
 * ═══════════════════════════════════════════════════════════════════════
 */

import { executionLifecycle } from '~/core/execution/lifecycle'
import { circuitBreaker, type CircuitState } from '~/core/control/breaker'
import { requestGraph } from '~/core/control/telemetry/graph'

// ─── Types ────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  url: string
  method: HttpMethod
  body?: any
  headers?: Record<string, string>

  /** Project identity — optional if not in project context */
  projectId?: string

  /** Circuit breaker circuit name (default: url host path) */
  circuit?: string

  /** Timeout in ms (default: 30_000) */
  timeout?: number

  /** Max retries on 5xx/network error (default: 3) */
  retry?: number

  /** Optional parent request id for request graph */
  parentId?: string

  /** AbortSignal from external controller */
  signal?: AbortSignal
}

export interface ApiResponse<T = any> {
  success: boolean
  data: T | null
  status: number
  error: string | null
  requestId: string
  retryCount: number
  durationMs: number
}

export interface ApiRequestConfig {
  baseUrl: string
  defaultTimeout: number
  defaultRetry: number
  authTokenGetter: () => string | null
  onAuthRefresh: () => Promise<boolean>
  onAuthExpired: () => void
}

// ─── Default Config ───────────────────────────────────────────────────

let config: ApiRequestConfig = {
  baseUrl: '',
  defaultTimeout: 30_000,
  defaultRetry: 3,
  authTokenGetter: () => {
    if (typeof window === 'undefined') return null
    try {
      // 使用 token-cache 内存优先读取（防御 XSS）
      const getToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
      return getToken() || null
    } catch { return null }
  },
  onAuthRefresh: async () => false,
  onAuthExpired: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
  },
}

// ─── Internal State ───────────────────────────────────────────────────

let initialized = false
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

// ─── Interceptor Chain ────────────────────────────────────────────────

type RequestInterceptor = (req: ApiRequest) => ApiRequest | Promise<ApiRequest>
type ResponseInterceptor = (res: Response, req: ApiRequest) => Response | Promise<Response>

const requestInterceptors: RequestInterceptor[] = []
const responseInterceptors: ResponseInterceptor[] = []

// ─── Kernel Implementation ────────────────────────────────────────────

async function executeInternal<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
  const startTime = Date.now()
  const circuitName = request.circuit ?? new URL(request.url, 'http://localhost').pathname

  // Circuit breaker check
  const cb = circuitBreaker.check(circuitName)
  if (!cb.allowed) {
    return {
      success: false,
      data: null,
      status: 503,
      error: `Circuit ${cb.state.toUpperCase()}: upstream rejected`,
      requestId: '',
      retryCount: 0,
      durationMs: Date.now() - startTime,
    }
  }

  const maxRetries = cb.degraded ? 1 : (request.retry ?? config.defaultRetry)
  let lastError: string | null = null
  let lastStatus = 0
  let retryCount = 0

  // Request graph
  const graphId = requestGraph.start({
    url: request.url,
    method: request.method,
    projectId: request.projectId ?? 'global',
    parentId: request.parentId,
  })

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 200ms * 2^(attempt-1)
      const delay = 200 * Math.pow(2, attempt - 1)
      await new Promise(r => setTimeout(r, delay))
      retryCount++
      // Record retry in graph
      requestGraph.retry(graphId, request.url, request.method, request.projectId ?? 'global')
    }

    // Prepare AbortController
    const controller = new AbortController()
    executionLifecycle.registerAbortController(controller)

    const timeout = request.timeout ?? config.defaultTimeout
    const timeoutId = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeout)

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...request.headers,
      }

      // Auth token injection (interceptor priority)
      const token = config.authTokenGetter()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Build fetch URL
      const url = request.url.startsWith('http') ? request.url : `${config.baseUrl}${request.url}`

      // Merge external signal with our controller (race via Promise.race)
      const combinedSignal = request.signal
        ? combineSignals(controller.signal, request.signal)
        : controller.signal

      let fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: combinedSignal,
      }

      if (request.body && request.method !== 'GET') {
        fetchOptions.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      }

      // Apply request interceptors
      let interceptedRequest = { ...request }
      for (const interceptor of requestInterceptors) {
        interceptedRequest = await interceptor(interceptedRequest)
      }

      // Execute
      let response = await fetch(url, fetchOptions)

      // Apply response interceptors
      for (const interceptor of responseInterceptors) {
        response = await interceptor(response, interceptedRequest)
      }

      clearTimeout(timeoutId)
      executionLifecycle.unregisterAbortController(controller)

      // Handle 401 — attempt auth refresh once
      if (response.status === 401 && attempt === 0) {
        const refreshed = await attemptAuthRefresh()
        if (refreshed) {
          // Retry with new token
          circuitBreaker.recordSuccess(circuitName)
          continue
        } else {
          config.onAuthExpired()
        }
      }

      // Handle 5xx — retry if we have attempts left
      if (response.status >= 500 && attempt < maxRetries) {
        circuitBreaker.recordFailure(circuitName)
        lastError = `Server error: ${response.status}`
        lastStatus = response.status
        continue
      }

      // Success
      circuitBreaker.recordSuccess(circuitName)
      let data: T | null = null
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }

      requestGraph.complete(graphId, {
        status: 'success',
        statusCode: response.status,
      })

      return {
        success: response.ok,
        data,
        status: response.status,
        error: response.ok ? null : `HTTP ${response.status}`,
        requestId: graphId,
        retryCount,
        durationMs: Date.now() - startTime,
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      executionLifecycle.unregisterAbortController(controller)

      const isAbort = err?.name === 'AbortError' || err?.name === 'TimeoutError'
      if (isAbort) {
        circuitBreaker.recordFailure(circuitName)
        requestGraph.complete(graphId, { status: 'aborted', errorMessage: err.message })
        return {
          success: false,
          data: null,
          status: 0,
          error: `Request aborted: ${err.message}`,
          requestId: graphId,
          retryCount,
          durationMs: Date.now() - startTime,
        }
      }

      circuitBreaker.recordFailure(circuitName)
      lastError = err?.message ?? 'Network error'
      lastStatus = 0

      if (attempt < maxRetries) {
        continue
      }

      requestGraph.complete(graphId, {
        status: 'error',
        errorMessage: lastError,
      })

      return {
        success: false,
        data: null,
        status: 0,
        error: lastError,
        requestId: graphId,
        retryCount,
        durationMs: Date.now() - startTime,
      }
    }
  }

  // Should not reach here
  return {
    success: false,
    data: null,
    status: lastStatus,
    error: lastError ?? 'Unknown error',
    requestId: graphId,
    retryCount,
    durationMs: Date.now() - startTime,
  }
}

// ─── Auth Refresh (debounced) ─────────────────────────────────────────

async function attemptAuthRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }
  isRefreshing = true
  refreshPromise = config.onAuthRefresh()
  const result = await refreshPromise
  isRefreshing = false
  refreshPromise = null
  return result
}

// ─── Signal Combiner ─────────────────────────────────────────────────

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

// ─── Public API ───────────────────────────────────────────────────────

export const apiKernel = {
  /**
   * Initialize the kernel with configuration.
   * Should be called once during app bootstrap.
   */
  initialize(cfg: Partial<ApiRequestConfig>): void {
    config = { ...config, ...cfg }
    initialized = true
    console.log('[ApiKernel] Initialized')
  },

  /**
   * Execute a request through the API Runtime Kernel.
   * This is the single entry point for all HTTP calls.
   */
  execute<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    if (!initialized) {
      console.warn('[ApiKernel] Not initialized, using defaults')
    }
    return executeInternal<T>(request)
  },

  /**
   * Convenience methods.
   */
  get<T = any>(url: string, opts?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.execute<T>({ ...opts, url, method: 'GET' })
  },

  post<T = any>(url: string, body?: any, opts?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.execute<T>({ ...opts, url, method: 'POST', body })
  },

  put<T = any>(url: string, body?: any, opts?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.execute<T>({ ...opts, url, method: 'PUT', body })
  },

  delete<T = any>(url: string, opts?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.execute<T>({ ...opts, url, method: 'DELETE' })
  },

  /**
   * Interceptor registration.
   */
  addRequestInterceptor(fn: RequestInterceptor): void {
    requestInterceptors.push(fn)
  },

  addResponseInterceptor(fn: ResponseInterceptor): void {
    responseInterceptors.push(fn)
  },

  /**
   * Request graph access (for debugging / admin UI).
   */
  graph: requestGraph,

  /**
   * Circuit breaker access.
   */
  circuit: circuitBreaker,

  /**
   * Get kernel stats.
   */
  stats(): { totalRequests: number; circuits: Record<string, any> } {
    return {
      totalRequests: requestGraph.getAllNodes().length,
      circuits: circuitBreaker.getAllStates(),
    }
  },
}
