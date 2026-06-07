// ============================================================
// Runtime Kernel — Central Orchestrator & Singleton
// 火麒麟AI导演控制台
// ============================================================
//
// This is the ONE kernel. No Web vs Desktop split.
// All modules go through this. All communication goes through EventBus.
//
// Bootstrap order:
//   Registry → Lifecycle → EventBus → State → Scheduler →
//   Resource → Memory → Diagnostics → Runtime Modules
//
// Shutdown order: reverse of bootstrap.
//
// ============================================================

import type {
  KernelModule,
  KernelPhase,
  KernelConfig,
  KernelHealth,
  KernelStateSnapshot,
} from './types'
import { DEFAULT_KERNEL_CONFIG } from './types'
import { RuntimeRegistry } from './runtime-registry/runtime-registry'
import { LifecycleManager } from './lifecycle/lifecycle-manager'
import { KernelEventBus } from './event-bus/kernel-event-bus'

/**
 * Minimal interface for the Scheduler module.
 * The actual Scheduler implementation lives in the scheduler/ package
 * and registers with the kernel during bootstrap.
 */
export interface KernelScheduler {
  /** Unique module id */
  readonly id: string
  /** Start the scheduler. No tasks run until this is called. */
  start(): Promise<void>
  /** Pause all scheduled tasks */
  pause(): Promise<void>
  /** Resume paused tasks */
  resume(): Promise<void>
  /** Stop the scheduler and cancel all pending tasks */
  stop(): Promise<void>
}

/**
 * Minimal interface for the State module.
 * The actual global state tree lives in state-manager/ package.
 */
export interface KernelState {
  readonly id: string
  /** Get a value by path (dot-notation) */
  get<T = unknown>(path: string): T | undefined
  /** Set a value at path */
  set(path: string, value: unknown): void
  /** Create a snapshot of the entire state tree */
  snapshot(): Record<string, unknown>
  /** Load a snapshot into the state tree */
  loadSnapshot(data: Record<string, unknown>): void
}

/**
 * Minimal interface for the Resource Manager.
 */
export interface KernelResourceManager {
  readonly id: string
  /** Get current resource utilization (CPU, GPU, memory) */
  getUtilization(): Record<string, number>
}

/**
 * Minimal interface for the Memory Manager.
 */
export interface KernelMemoryManager {
  readonly id: string
  /** Get memory usage stats */
  getStats(): Record<string, number>
}

/**
 * Minimal interface for the Diagnostics module.
 */
export interface KernelDiagnostics {
  readonly id: string
  /** Collect a full diagnostics report */
  collectReport(): Promise<Record<string, unknown>>
  /** Get kernel-level metrics */
  getMetrics(): Record<string, number>
}

// ============================================================
// RuntimeKernel (Singleton)
// ============================================================

export class RuntimeKernel {
  private static _instance: RuntimeKernel | null = null

  // ---- Subsystems (internal) ----
  private readonly _registry: RuntimeRegistry
  private readonly _lifecycle: LifecycleManager
  private readonly _eventBus: KernelEventBus

  // ---- Subsystems (injected during boostrap) ----
  private _scheduler: KernelScheduler | null = null
  private _state: KernelState | null = null
  private _resourceManager: KernelResourceManager | null = null
  private _memoryManager: KernelMemoryManager | null = null
  private _diagnostics: KernelDiagnostics | null = null

  // ---- Kernel state ----
  private _phase: KernelPhase = 'STOPPED'
  private _config: KernelConfig
  private _snapshots: KernelStateSnapshot[] = []
  private _runtimeModules: Map<string, KernelModule> = new Map()
  private _bootError: Error | null = null

  // ============================================================
  // Singleton
  // ============================================================

  private constructor(config: Partial<KernelConfig> = {}) {
    this._config = { ...DEFAULT_KERNEL_CONFIG, ...config }
    this._registry = new RuntimeRegistry()
    this._lifecycle = new LifecycleManager(this._registry)
    this._eventBus = new KernelEventBus()
  }

  /**
   * Get the singleton RuntimeKernel instance.
   * Creates one if it doesn't exist yet.
   */
  static getInstance(config?: Partial<KernelConfig>): RuntimeKernel {
    if (!RuntimeKernel._instance) {
      RuntimeKernel._instance = new RuntimeKernel(config)
    } else if (config) {
      // Config is only applied on first creation
      console.warn('[RuntimeKernel] Instance already exists. Config ignored.')
    }
    return RuntimeKernel._instance
  }

  /**
   * Destroy the singleton (for testing / hard reset).
   */
  static destroyInstance(): void {
    RuntimeKernel._instance = null
  }

  // ============================================================
  // Properties
  // ============================================================

  /** Current kernel phase */
  get phase(): KernelPhase {
    return this._phase
  }

  /** Kernel configuration (immutable after bootstrap) */
  get config(): Readonly<KernelConfig> {
    return Object.freeze({ ...this._config })
  }

  /** Last boot error, if any */
  get bootError(): Error | null {
    return this._bootError
  }

  // ============================================================
  // Bootstrap
  // ============================================================

  /**
   * Bootstrap the kernel and all registered modules.
   *
   * Order:
   * 1. Registry (self)
   * 2. Lifecycle (self)
   * 3. EventBus (self)
   * 4. State module
   * 5. Scheduler module
   * 6. Resource Manager module
   * 7. Memory Manager module
   * 8. Diagnostics module
   * 9. All runtime modules (in dependency order)
   */
  async bootstrap(): Promise<void> {
    if (this._phase !== 'STOPPED') {
      throw new Error(
        `[RuntimeKernel] Cannot bootstrap from phase '${this._phase}'. ` +
        `Must be 'STOPPED'.`
      )
    }

    this._phase = 'BOOTING'
    this._bootError = null

    try {
      // ---- Phase 1: Core subsystems (built-in) ----
      this._transitionTo('INITIALIZING', 'Booting core subsystems...')

      // Register the built-in kernel modules
      // (These are not registered in the normal registry — they ARE the kernel)

      // ---- Phase 2: EventBus (needed early for module communication) ----
      this._transitionTo('INITIALIZING', 'Initializing EventBus...')
      // EventBus is ready from construction

      // ---- Phase 3: External subsystems ----
      // State
      if (this._state) {
        this._transitionTo('INITIALIZING', 'Booting State module...')
        await this._bootstrapModule(this._state)
      }

      // Scheduler
      if (this._scheduler) {
        this._transitionTo('INITIALIZING', 'Booting Scheduler...')
        await this._bootstrapModule(this._scheduler)
      }

      // Resource Manager
      if (this._resourceManager) {
        this._transitionTo('INITIALIZING', 'Booting Resource Manager...')
        await this._bootstrapModule(this._resourceManager)
      }

      // Memory Manager
      if (this._memoryManager) {
        this._transitionTo('INITIALIZING', 'Booting Memory Manager...')
        await this._bootstrapModule(this._memoryManager)
      }

      // Diagnostics
      if (this._diagnostics) {
        this._transitionTo('INITIALIZING', 'Booting Diagnostics...')
        await this._bootstrapModule(this._diagnostics)
      }

      // ---- Phase 4: Runtime modules (dependency-ordered) ----
      const runtimeModuleIds = this._registry.resolveDependencyOrder()
      // Filter out any that are kernel-level subsystems (they're handled above)
      const kernelSubsystemIds = new Set([
        this._state?.id,
        this._scheduler?.id,
        this._resourceManager?.id,
        this._memoryManager?.id,
        this._diagnostics?.id,
      ].filter(Boolean) as string[])

      for (const moduleId of runtimeModuleIds) {
        if (kernelSubsystemIds.has(moduleId)) continue

        const mod = this._registry.get(moduleId)
        if (!mod) continue

        this._transitionTo('INITIALIZING', `Booting module '${mod.name}'...`)
        await this._bootstrapModule(mod)
      }

      // ---- Phase 5: Ready ----
      // Take the first snapshot
      this._takeSnapshot()

      this._phase = 'READY'
      console.log('[RuntimeKernel] Bootstrap complete. Kernel is READY.')

      // ---- Phase 6: Enter RUNNING by default ----
      this._phase = 'RUNNING'
      this._transitionTo('RUNNING', 'Kernel is now running.')

    } catch (err) {
      this._bootError = err instanceof Error ? err : new Error(String(err))
      console.error('[RuntimeKernel] Bootstrap failed:', this._bootError)

      // Attempt to enter SAFE_MODE
      this._phase = 'SAFE_MODE'

      if (this._config.autoRecover) {
        await this.recover()
      }

      throw this._bootError
    }
  }

  // ============================================================
  // Shutdown
  // ============================================================

  /**
   * Shut down the kernel and all modules in reverse order.
   */
  async shutdown(): Promise<void> {
    const previousPhase = this._phase
    this._phase = 'SHUTTING_DOWN'

    console.log('[RuntimeKernel] Shutting down...')

    try {
      // Shutdown runtime modules (reverse dependency order)
      const runtimeModuleIds = this._registry.resolveShutdownOrder()
      const kernelSubsystemIds = new Set([
        this._diagnostics?.id,
        this._memoryManager?.id,
        this._resourceManager?.id,
        this._scheduler?.id,
        this._state?.id,
      ].filter(Boolean) as string[])

      for (const moduleId of runtimeModuleIds) {
        if (kernelSubsystemIds.has(moduleId)) continue
        const mod = this._registry.get(moduleId)
        if (!mod) continue
        await this._shutdownModule(mod)
      }

      // Shutdown kernel subsystems (reverse order)
      if (this._diagnostics) await this._shutdownModule(this._diagnostics)
      if (this._memoryManager) await this._shutdownModule(this._memoryManager)
      if (this._resourceManager) await this._shutdownModule(this._resourceManager)
      if (this._scheduler) await this._shutdownModule(this._scheduler)
      if (this._state) await this._shutdownModule(this._state)

      // EventBus
      this._eventBus.reset()

      // Lifecycle & Registry: clear
      this._registry.clear()

      this._phase = 'STOPPED'
      console.log('[RuntimeKernel] Shutdown complete.')

    } catch (err) {
      console.error('[RuntimeKernel] Shutdown error:', err)
      this._phase = 'STOPPED'
    }
  }

  // ============================================================
  // Accessors
  // ============================================================

  getRegistry(): RuntimeRegistry {
    return this._registry
  }

  getLifecycle(): LifecycleManager {
    return this._lifecycle
  }

  getEventBus(): KernelEventBus {
    return this._eventBus
  }

  getScheduler(): KernelScheduler | null {
    return this._scheduler
  }

  getState(): KernelState | null {
    return this._state
  }

  getResourceManager(): KernelResourceManager | null {
    return this._resourceManager
  }

  getMemoryManager(): KernelMemoryManager | null {
    return this._memoryManager
  }

  getDiagnostics(): KernelDiagnostics | null {
    return this._diagnostics
  }

  // ============================================================
  // Inject subsystem implementations
  // ============================================================

  /**
   * Set the state manager implementation.
   * Must be called before bootstrap().
   */
  setState(state: KernelState): void {
    if (this._phase !== 'STOPPED' && this._phase !== 'BOOTING') {
      throw new Error('[RuntimeKernel] Cannot set State after kernel has started.')
    }
    this._state = state
  }

  /**
   * Set the scheduler implementation.
   * Must be called before bootstrap().
   */
  setScheduler(scheduler: KernelScheduler): void {
    if (this._phase !== 'STOPPED' && this._phase !== 'BOOTING') {
      throw new Error('[RuntimeKernel] Cannot set Scheduler after kernel has started.')
    }
    this._scheduler = scheduler
  }

  /**
   * Set the resource manager implementation.
   * Must be called before bootstrap().
   */
  setResourceManager(rm: KernelResourceManager): void {
    if (this._phase !== 'STOPPED' && this._phase !== 'BOOTING') {
      throw new Error('[RuntimeKernel] Cannot set ResourceManager after kernel has started.')
    }
    this._resourceManager = rm
  }

  /**
   * Set the memory manager implementation.
   * Must be called before bootstrap().
   */
  setMemoryManager(mm: KernelMemoryManager): void {
    if (this._phase !== 'STOPPED' && this._phase !== 'BOOTING') {
      throw new Error('[RuntimeKernel] Cannot set MemoryManager after kernel has started.')
    }
    this._memoryManager = mm
  }

  /**
   * Set the diagnostics implementation.
   * Must be called before bootstrap().
   */
  setDiagnostics(diag: KernelDiagnostics): void {
    if (this._phase !== 'STOPPED' && this._phase !== 'BOOTING') {
      throw new Error('[RuntimeKernel] Cannot set Diagnostics after kernel has started.')
    }
    this._diagnostics = diag
  }

  // ============================================================
  // Rollback
  // ============================================================

  /**
   * Rollback the kernel to a previous state snapshot.
   *
   * This restores the phase of every registered module to their
   * state at the time the snapshot was taken.
   *
   * State restore must be done at the application level via the
   * state manager's loadSnapshot().
   */
  async rollback(targetState: KernelStateSnapshot): Promise<void> {
    console.log(`[RuntimeKernel] Rolling back to snapshot '${targetState.id}'...`)

    // Restore module phases
    for (const [moduleId, phase] of Object.entries(targetState.modulePhases)) {
      try {
        const mod = this._registry.get(moduleId)
        if (mod) {
          this._lifecycle.transition(moduleId, phase)
        }
      } catch (err) {
        console.warn(
          `[RuntimeKernel] Could not restore phase for '${moduleId}':`,
          err
        )
      }
    }

    // Restore kernel config
    this._config = { ...targetState.config }

    // Restore state if state manager is available
    if (this._state && targetState.metadata?.stateSnapshot) {
      this._state.loadSnapshot(
        targetState.metadata.stateSnapshot as Record<string, unknown>
      )
    }

    this._phase = 'RECOVERING'
    console.log(`[RuntimeKernel] Rollback to '${targetState.id}' complete. Entering RECOVERING.`)
  }

  // ============================================================
  // Recovery
  // ============================================================

  /**
   * Attempt to recover the kernel from SAFE_MODE or DEGRADED state.
   *
   * Strategy:
   * 1. Find modules in CRITICAL state and attempt restart
   * 2. Fall back to last known good snapshot if available
   * 3. Transition to READY if recovery succeeds, or stay in SAFE_MODE
   */
  async recover(): Promise<boolean> {
    if (this._phase !== 'SAFE_MODE' && this._phase !== 'DEGRADED') {
      throw new Error(
        `[RuntimeKernel] Can only recover from SAFE_MODE or DEGRADED. Current: ${this._phase}`
      )
    }

    console.log('[RuntimeKernel] Attempting recovery...')
    this._phase = 'RECOVERING'

    // Strategy 1: Check health of all modules and restart critical ones
    const criticalModules: KernelModule[] = []
    const degradedModules: KernelModule[] = []

    for (const mod of this._registry.getAll()) {
      try {
        const health = mod.healthCheck()
        if (health.status === 'critical') {
          criticalModules.push(mod)
        } else if (health.status === 'degraded') {
          degradedModules.push(mod)
        }
      } catch {
        criticalModules.push(mod)
      }
    }

    // Try restarting critical modules
    let recovered = true
    for (const mod of criticalModules) {
      try {
        console.log(`[RuntimeKernel] Re-bootstrapping module '${mod.name}'...`)
        mod.phase = 'BOOTING'
        await mod.bootstrap()
        mod.phase = 'READY'
        this._lifecycle.transition(mod.id, 'READY')
        console.log(`[RuntimeKernel] Module '${mod.name}' recovered.`)
      } catch (err) {
        console.error(
          `[RuntimeKernel] Failed to recover module '${mod.name}':`,
          err
        )
        recovered = false
      }
    }

    // Strategy 2: Try restarting degraded modules
    for (const mod of degradedModules) {
      try {
        // Simply re-check health — some modules self-heal
        const health = mod.healthCheck()
        if (health.status === 'healthy') {
          this._lifecycle.transition(mod.id, 'RUNNING')
        } else if (health.status === 'degraded') {
          // Try re-bootstrap
          mod.phase = 'BOOTING'
          await mod.bootstrap()
          mod.phase = 'READY'
          this._lifecycle.transition(mod.id, 'READY')
        }
      } catch {
        recovered = false
      }
    }

    // Strategy 3: Fall back to last snapshot
    if (!recovered && this._snapshots.length > 0) {
      const lastGood = this._snapshots[this._snapshots.length - 1]
      console.log('[RuntimeKernel] Falling back to last snapshot...')
      await this.rollback(lastGood)
    }

    if (recovered) {
      this._phase = 'READY'
      console.log('[RuntimeKernel] Recovery successful. Kernel is READY.')
    } else {
      this._phase = 'SAFE_MODE'
      console.warn('[RuntimeKernel] Recovery incomplete. Kernel in SAFE_MODE.')
    }

    return recovered
  }

  // ============================================================
  // Health
  // ============================================================

  /**
   * Perform health check on all registered modules and the kernel itself.
   */
  async healthCheck(): Promise<{
    kernel: KernelHealth
    modules: KernelHealth[]
  }> {
    const kernelHealth: KernelHealth = {
      moduleId: 'runtime-kernel',
      status: 'healthy',
      score: 100,
      metrics: {
        phase: Object.values(KernelPhase).indexOf(this._phase),
        registeredModules: this._registry.size,
        eventCount: this._eventBus.totalEvents,
        pendingEvents: this._eventBus.pendingCount,
        snapshotCount: this._snapshots.length,
      },
      timestamp: Date.now(),
    }

    const moduleHealth: KernelHealth[] = []
    let worstStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'

    for (const mod of this._registry.getAll()) {
      try {
        const health = mod.healthCheck()
        moduleHealth.push(health)

        if (health.status === 'critical') worstStatus = 'critical'
        else if (health.status === 'degraded' && worstStatus !== 'critical') {
          worstStatus = 'degraded'
        }
      } catch (err) {
        moduleHealth.push({
          moduleId: mod.id,
          status: 'critical',
          score: 0,
          metrics: {},
          timestamp: Date.now(),
        })
        worstStatus = 'critical'
      }
    }

    kernelHealth.status = worstStatus
    kernelHealth.score = worstStatus === 'healthy' ? 100 : worstStatus === 'degraded' ? 60 : 20

    return { kernel: kernelHealth, modules: moduleHealth }
  }

  // ============================================================
  // Snapshot
  // ============================================================

  /**
   * Take a snapshot of the current kernel state.
   */
  private _takeSnapshot(): KernelStateSnapshot {
    const snapshot: KernelStateSnapshot = {
      id: `snap_${Date.now()}_${this._snapshots.length}`,
      timestamp: Date.now(),
      modulePhases: this._lifecycle.getAllPhases(),
      config: { ...this._config },
    }

    // Include state snapshot if available
    if (this._state) {
      snapshot.metadata = {
        stateSnapshot: this._state.snapshot(),
      }
    }

    this._snapshots.push(snapshot)

    // Keep only last 10 snapshots
    if (this._snapshots.length > 10) {
      this._snapshots.shift()
    }

    return snapshot
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private _transitionTo(phase: KernelPhase, message?: string): void {
    this._phase = phase
    if (message) {
      console.log(`[RuntimeKernel] ${message}`)
    }
  }

  private async _bootstrapModule(
    mod: KernelModule | KernelScheduler | KernelState | KernelResourceManager | KernelMemoryManager | KernelDiagnostics
  ): Promise<void> {
    const moduleId = mod.id

    // If it's a full KernelModule, use its bootstrap
    if ('bootstrap' in mod && typeof mod.bootstrap === 'function') {
      // Set phase to BOOTING
      if (mod instanceof Object && 'phase' in mod) {
        (mod as KernelModule).phase = 'BOOTING'
      }

      await mod.bootstrap()

      // Set phase to READY
      if (mod instanceof Object && 'phase' in mod) {
        (mod as KernelModule).phase = 'READY'
      }
    }
  }

  private async _shutdownModule(
    mod: KernelModule | KernelScheduler | KernelState | KernelResourceManager | KernelMemoryManager | KernelDiagnostics
  ): Promise<void> {
    const moduleId = mod.id

    // Set phase to SHUTTING_DOWN
    if ('phase' in mod) {
      (mod as KernelModule).phase = 'SHUTTING_DOWN'
    }

    // If it's a full KernelModule, use its shutdown
    if ('shutdown' in mod && typeof mod.shutdown === 'function') {
      const timeout = this._config.shutdownTimeout
      const shutdownPromise = mod.shutdown()

      // Apply shutdown timeout
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Module '${moduleId}' shutdown timed out after ${timeout}ms`)),
          timeout
        )
      )

      await Promise.race([shutdownPromise, timeoutPromise]).catch((err) => {
        console.warn(`[RuntimeKernel] Shutdown warning for '${moduleId}':`, err)
      })
    }

    // Set phase to STOPPED
    if ('phase' in mod) {
      (mod as KernelModule).phase = 'STOPPED'
    }
  }
}
