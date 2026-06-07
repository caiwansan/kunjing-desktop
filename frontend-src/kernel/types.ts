// ============================================================
// Runtime Kernel Architecture v1 — Core Types
// 火麒麟AI导演控制台
// ============================================================

/**
 * Kernel lifecycle phases.
 * Defines every possible state a module or the kernel itself can be in.
 */
export type KernelPhase =
  | 'BOOTING'
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'DEGRADED'
  | 'SAFE_MODE'
  | 'RECOVERING'
  | 'PAUSED'
  | 'SHUTTING_DOWN'
  | 'STOPPED'

/**
 * A registrable kernel module.
 * Every subsystem (runtime, service, infrastructure) implements this interface
 * so the RuntimeKernel can manage its lifecycle uniformly.
 */
export interface KernelModule {
  /** Unique module identifier (e.g. 'dag-compiler', 'event-bus') */
  id: string
  /** Human-readable name */
  name: string
  /** IDs of modules that must be bootstrapped before this one */
  dependencies: string[]
  /** Current lifecycle phase — managed by LifecycleManager */
  phase: KernelPhase
  /** Start the module. Called by RuntimeKernel during bootstrap. */
  bootstrap(): Promise<void>
  /** Stop the module. Called by RuntimeKernel during shutdown. */
  shutdown(): Promise<void>
  /** Return a health snapshot of this module. */
  healthCheck(): KernelHealth
}

/**
 * Health check result for a single module.
 */
export interface KernelHealth {
  moduleId: string
  status: 'healthy' | 'degraded' | 'critical'
  /** Numeric health score 0-100 */
  score: number
  /** Arbitrary metrics the module wants to expose */
  metrics: Record<string, number>
  /** Unix timestamp (ms) when the check was performed */
  timestamp: number
}

/**
 * Global kernel configuration.
 * Loaded once during bootstrap and immutable for the lifetime of the kernel.
 */
export interface KernelConfig {
  /** Automatically attempt recovery when a module enters DEGRADED */
  autoRecover: boolean
  /** Maximum retry attempts for failed bootstrap/shutdown/recovery operations */
  maxRetries: number
  /** Graceful shutdown timeout in ms before force-killing a module */
  shutdownTimeout: number
  /** Enable kernel-level diagnostics (event tracing, metrics, etc.) */
  enableDiagnostics: boolean
  /** Enable convergence engine integration */
  enableConvergence: boolean
  /** Enable governance protection (policy enforcement at kernel level) */
  enableGovProtection: boolean
}

// ============================================================
// Event System Types
// ============================================================

/**
 * Event priority levels used by EventPriorityRouter.
 */
export type EventPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'BACKGROUND'

/**
 * Built-in kernel event types.
 */
export type KernelEventType =
  | 'GPU_OVERLOAD'
  | 'WORKER_TIMEOUT'
  | 'DAG_FAILED'
  | 'TASK_RETRY'
  | 'STRATEGY_DEPLOYED'
  | 'SYSTEM_DEGRADED'
  | 'QUEUE_OVERFLOW'
  | 'WORLD_STATE_CHANGED'
  | 'REALITY_VALIDATION_FAILED'
  | 'EVENT_LOOP_DETECTED'
  | (string & {})

/**
 * A kernel event.
 */
export interface KernelEvent {
  /** Unique event identifier (UUID or nanoid) */
  id: string
  /** Event type */
  type: KernelEventType
  /** Priority level */
  priority: EventPriority
  /** Source module/component that emitted the event */
  source: string
  /** Unix timestamp (ms) when the event was created */
  timestamp: number
  /** Arbitrary payload */
  payload: unknown
  /** Time-to-live (max propagation depth). Decremented each hop. Default 10. */
  ttl?: number
}

/**
 * Event handler function type.
 */
export type EventHandler = (event: KernelEvent) => void | Promise<void>

/**
 * Snapshot of the entire kernel state (for rollback / recovery).
 */
export interface KernelStateSnapshot {
  id: string
  timestamp: number
  modulePhases: Record<string, KernelPhase>
  config: KernelConfig
  metadata?: Record<string, unknown>
}

// ============================================================
// Lifecycle Transition Rules
// ============================================================

/**
 * Legal state transitions as a readonly map.
 * Key = current phase, Value = set of allowed next phases.
 */
export const LEGAL_TRANSITIONS: Record<KernelPhase, ReadonlySet<KernelPhase>> = {
  BOOTING: new Set<KernelPhase>(['INITIALIZING', 'SHUTTING_DOWN']),
  INITIALIZING: new Set<KernelPhase>(['READY', 'SHUTTING_DOWN']),
  READY: new Set<KernelPhase>(['RUNNING', 'DEGRADED', 'SHUTTING_DOWN']),
  RUNNING: new Set<KernelPhase>(['DEGRADED', 'PAUSED', 'SHUTTING_DOWN']),
  DEGRADED: new Set<KernelPhase>(['RUNNING', 'SAFE_MODE', 'SHUTTING_DOWN']),
  SAFE_MODE: new Set<KernelPhase>(['RECOVERING', 'SHUTTING_DOWN']),
  RECOVERING: new Set<KernelPhase>(['READY', 'DEGRADED', 'SHUTTING_DOWN']),
  PAUSED: new Set<KernelPhase>(['RUNNING', 'SHUTTING_DOWN']),
  SHUTTING_DOWN: new Set<KernelPhase>(['STOPPED']),
  STOPPED: new Set<KernelPhase>([]),
}

/**
 * Phases in which a module is considered "executable" (can do work).
 */
export const EXECUTABLE_PHASES: ReadonlySet<KernelPhase> = new Set<KernelPhase>([
  'RUNNING',
  'DEGRADED',
  'RECOVERING',
])

/**
 * Phases in which a module is considered "schedulable" (can receive scheduled tasks).
 */
export const SCHEDULABLE_PHASES: ReadonlySet<KernelPhase> = new Set<KernelPhase>([
  'RUNNING',
  'DEGRADED',
])

/**
 * Default kernel configuration.
 */
export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  autoRecover: true,
  maxRetries: 3,
  shutdownTimeout: 10_000,
  enableDiagnostics: true,
  enableConvergence: true,
  enableGovProtection: true,
}

// ─── Kernel Adoption Types ───
export type RuntimeMode = 'WEB_RUNTIME' | 'DESKTOP_RUNTIME' | 'SHADOW_KERNEL' | 'CUTOVER_KERNEL' | 'FULL_KERNEL'
export type CutoverPhase = 'SHADOW_ONLY' | 'READONLY_CUTOVER' | 'PARTIAL_EXECUTION' | 'FULL_SCHEDULER' | 'FULL_CONTROL'
export type CutoverDecision = 'SAFE_MODE' | 'OBSERVE_ONLY' | 'PARTIAL_CUTOVER' | 'FULL_CUTOVER' | 'ROLLBACK'

export interface CutoverScore {
  overall: number
  dimensions: {
    eventConsistency: number
    stateConsistency: number
    schedulerStability: number
    gpuCorrectness: number
    latencyImpact: number
  }
  phase: CutoverDecision
  timestamp: number
}

export interface DualExecutionResult {
  taskId: string
  oldRuntime: { result: any; latency: number; resources: any }
  kernelShadow: { result: any; latency: number; resources: any }
  matchRate: number
  diff: any
  passed: boolean
}

export interface KernelHealthMetrics {
  eventLatency: number
  schedulerDelay: number
  gpuUtilization: number
  workerLoad: number
  stateSyncDelay: number
  errorRate: number
  memoryUsage: number
}
