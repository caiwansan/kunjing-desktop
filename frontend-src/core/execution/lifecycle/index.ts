// execution/lifecycle/index.ts — Unified lifecycle manager
// Exports backward-compatible executionLifecycle object

import { telemetry } from '~/core/control/telemetry'
import { projectKernel } from '~/core/identity/projectKernel'

// ─── Timer State ──────────────────────────────────────────────────────

const timerIds = new Set<ReturnType<typeof setInterval>>()
const timeoutIds = new Set<ReturnType<typeof setTimeout>>()
let onProjectSwitch: (() => void) | null = null

// ─── AbortState ───────────────────────────────────────────────────────

const controllers = new Set<AbortController>()

// ─── SSE State ────────────────────────────────────────────────────────

const sseConnections = new Set<EventSource>()

// ─── Public API (backward compatible) ─────────────────────────────────

export const executionLifecycle = {
  // ── Timers ──
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const id = setInterval(fn, ms)
    timerIds.add(id)
    return id
  },

  clearInterval(id: ReturnType<typeof setInterval>): void {
    clearInterval(id)
    timerIds.delete(id)
  },

  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(fn, ms)
    timeoutIds.add(id)
    return id
  },

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    clearTimeout(id)
    timeoutIds.delete(id)
  },

  // ── AbortControllers ──
  registerAbortController(ctrl: AbortController): void {
    controllers.add(ctrl)
  },

  removeAbortController(ctrl: AbortController): void {
    controllers.delete(ctrl)
  },

  // ── SSE ──
  createEventSource(url: string): EventSource {
    const es = new EventSource(url)
    sseConnections.add(es)
    es.addEventListener('error', () => {
      telemetry?.recordSSE?.(url, 'fail', undefined, 'connection error')
    })
    return es
  },

  registerSSE(es: EventSource): void {
    sseConnections.add(es)
  },

  // ── Cleanup (called on project switch) ──
  clearAll(): void {
    timerIds.forEach(id => clearInterval(id))
    timeoutIds.forEach(id => clearTimeout(id))
    timerIds.clear()
    timeoutIds.clear()

    controllers.forEach(ctrl => ctrl.abort())
    controllers.clear()

    sseConnections.forEach(es => es.close())
    sseConnections.clear()

    telemetry?.recordRuntime?.('lifecycle', 'cleared all async state')
  },

  subscribeOnSwitch(fn: () => void): void {
    onProjectSwitch = fn
  },

  // ── Inspect (for testing) ──
  get activeTimers(): number { return timerIds.size + timeoutIds.size },
  get activeSSE(): number { return sseConnections.size },
  get activeAbortControllers(): number { return controllers.size },
}

// ── Auto-wire project switch → clearAll ──
try {
  import.meta?.hot?.accept?.()
} catch {}

// Subscribe to project kernel switch events
if (typeof window !== 'undefined') {
  window.addEventListener('project:switch', () => {
    executionLifecycle.clearAll()
    onProjectSwitch?.()
  })
}

// ── Sub-module named exports ──
export const timerRegistry = {
  setInterval: executionLifecycle.setInterval.bind(executionLifecycle),
  setTimeout: executionLifecycle.setTimeout.bind(executionLifecycle),
  clearInterval: executionLifecycle.clearInterval.bind(executionLifecycle),
  clearTimeout: executionLifecycle.clearTimeout.bind(executionLifecycle),
  clearAll: executionLifecycle.clearAll.bind(executionLifecycle),
  get activeCount(): number { return executionLifecycle.activeTimers },
}

export const sseRegistry = {
  create: executionLifecycle.createEventSource.bind(executionLifecycle),
  register: executionLifecycle.registerSSE.bind(executionLifecycle),
  closeAll: () => executionLifecycle.clearAll(),
  get activeCount(): number { return executionLifecycle.activeSSE },
}

export const abortRegistry = {
  create(): AbortController {
    const ctrl = new AbortController()
    executionLifecycle.registerAbortController(ctrl)
    return ctrl
  },
  register: executionLifecycle.registerAbortController.bind(executionLifecycle),
  abortAll: () => executionLifecycle.clearAll(),
  get activeCount(): number { return executionLifecycle.activeAbortControllers },
}
