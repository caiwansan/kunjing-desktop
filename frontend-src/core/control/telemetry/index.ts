/**
 * core/governance/telemetry.ts — Runtime Telemetry System
 *
 * Records all significant runtime events for observability, debugging,
 * and auto-healing decision making.
 *
 * Event categories:
 *   - api: request success/failure/retry
 *   - sse: connection open/close/error
 *   - runtime: project switch, lifecycle action, timer registry
 *   - governance: policy violation, degraded mode toggle, circuit state change
 */

export type TelemetryEventType = 'api' | 'sse' | 'runtime' | 'governance'
export type TelemetryEventStatus = 'success' | 'fail' | 'retry' | 'info'

export interface TelemetryEvent {
  id: string
  type: TelemetryEventType
  status: TelemetryEventStatus
  category: string       // e.g., 'fetch', 'sse-connect', 'project-switch'
  message: string
  durationMs: number | null
  projectId: string | null
  timestamp: number
  metadata?: Record<string, any>
}

let eventCounter = 0
const events: TelemetryEvent[] = []
const MAX_EVENTS = 1000

function generateId(): string {
  return `tel_${++eventCounter}_${Date.now()}`
}

export const telemetry = {
  /**
   * Record a telemetry event.
   */
  record(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    const full: TelemetryEvent = {
      ...event,
      id: generateId(),
      timestamp: Date.now(),
    }
    events.push(full)

    // Trim to max size
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS)
    }

    // Dispatch for admin UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('telemetry:event', { detail: full }))
    }
  },

  /**
   * Convenience: record an API event.
   */
  recordAPI(url: string, status: TelemetryEventStatus, durationMs: number, projectId?: string, error?: string): void {
    this.record({
      type: 'api',
      status,
      category: 'fetch',
      message: status === 'success' ? `${url}` : `${url}: ${error ?? 'error'}`,
      durationMs,
      projectId: projectId ?? null,
      metadata: { url, error },
    })
  },

  /**
   * Record an SSE event.
   */
  recordSSE(url: string, status: TelemetryEventStatus, projectId?: string, error?: string): void {
    this.record({
      type: 'sse',
      status,
      category: 'sse-connect',
      message: status === 'success' ? `SSE: ${url}` : `SSE error: ${url}: ${error ?? 'unknown'}`,
      durationMs: null,
      projectId: projectId ?? null,
      metadata: { url, error },
    })
  },

  /**
   * Record a runtime lifecycle event.
   */
  recordRuntime(category: string, message: string, projectId?: string): void {
    this.record({
      type: 'runtime',
      status: 'info',
      category,
      message,
      durationMs: null,
      projectId: projectId ?? null,
    })
  },

  /**
   * Record a governance event.
   */
  recordGovernance(message: string, metadata?: Record<string, any>): void {
    this.record({
      type: 'governance',
      status: 'info',
      category: 'governance',
      message,
      durationMs: null,
      projectId: null,
      metadata,
    })
  },

  /**
   * Get all events matching optional filters.
   */
  query(filters?: {
    type?: TelemetryEventType
    status?: TelemetryEventStatus
    limit?: number
  }): TelemetryEvent[] {
    let result = [...events]
    if (filters?.type) result = result.filter(e => e.type === filters.type)
    if (filters?.status) result = result.filter(e => e.status === filters.status)
    if (filters?.limit) result = result.slice(-filters.limit)
    return result.reverse()  // newest first
  },

  /**
   * Get aggregated stats.
   */
  getStats(): {
    total: number
    byType: Record<string, number>
    byStatus: Record<string, number>
    apiSuccessRate: number
    recentErrors: TelemetryEvent[]
  } {
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let apiTotal = 0
    let apiSuccess = 0

    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
      if (e.type === 'api') {
        apiTotal++
        if (e.status === 'success') apiSuccess++
      }
    }

    return {
      total: events.length,
      byType,
      byStatus,
      apiSuccessRate: apiTotal > 0 ? apiSuccess / apiTotal : 1,
      recentErrors: events.filter(e => e.status === 'fail' || e.status === 'retry').slice(-10).reverse(),
    }
  },

  /**
   * Clear all events.
   */
  clear(): void {
    events.length = 0
  },
}
