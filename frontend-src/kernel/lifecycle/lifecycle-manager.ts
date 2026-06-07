// ============================================================
// Lifecycle Manager — Centralized Module State Machine
// 火麒麟AI导演控制台
// ============================================================

import type { KernelPhase, KernelModule } from '../types'
import { LifecycleGuard } from './lifecycle-guard'
import type { RuntimeRegistry } from '../runtime-registry/runtime-registry'

/**
 * LifecycleManager manages the state machine transitions for all
 * registered kernel modules.
 *
 * Every transition goes through LifecycleGuard first to enforce
 * legal state changes.
 *
 * LifecycleManager does NOT bootstrap or shutdown modules itself —
 * that is RuntimeKernel's responsibility. LifecycleManager only
 * manages the phase flags.
 */
export class LifecycleManager {
  private readonly _registry: RuntimeRegistry
  private readonly _guard: LifecycleGuard
  private readonly _listeners: Map<string, Array<(moduleId: string, from: KernelPhase, to: KernelPhase) => void>>

  constructor(registry: RuntimeRegistry) {
    this._registry = registry
    this._guard = new LifecycleGuard(registry)
    this._listeners = new Map()
  }

  /**
   * Get the LifecycleGuard instance (for external use by other subsystems).
   */
  get guard(): LifecycleGuard {
    return this._guard
  }

  // ============================================================
  // Phase Transitions
  // ============================================================

  /**
   * Transition a module from its current phase to a new phase.
   *
   * - Throws if the transition is illegal (via LifecycleGuard)
   * - Updates the module's phase in place
   * - Emits internal transition event
   *
   * Returns the previous phase for reference.
   */
  transition(moduleId: string, to: KernelPhase): KernelPhase {
    const mod = this._registry.get(moduleId)
    if (!mod) {
      throw new Error(
        `[LifecycleManager] Cannot transition unknown module '${moduleId}'.`
      )
    }

    const from = mod.phase

    // No-op for same phase
    if (from === to) {
      return from
    }

    // Validate through guard
    this._guard.assertTransition(moduleId, from, to)

    // Perform transition
    mod.phase = to

    // Notify listeners
    this._notify(moduleId, from, to)

    return from
  }

  /**
   * Transition a module using the module object directly.
   * Useful when the module isn't in the registry yet (e.g. during bootstrap).
   */
  transitionModule(mod: KernelModule, to: KernelPhase): KernelPhase {
    const from = mod.phase

    if (from === to) {
      return from
    }

    this._guard.assertTransition(mod.id, from, to)

    mod.phase = to
    this._notify(mod.id, from, to)

    return from
  }

  // ============================================================
  // Phase Queries
  // ============================================================

  /**
   * Get the current phase of a module.
   * Throws if the module is not registered.
   */
  getPhase(moduleId: string): KernelPhase {
    const mod = this._registry.get(moduleId)
    if (!mod) {
      throw new Error(
        `[LifecycleManager] Unknown module '${moduleId}'. Cannot query phase.`
      )
    }
    return mod.phase
  }

  /**
   * Assert that a module is currently in one of the allowed phases.
   * Throws if not.
   */
  assertPhase(moduleId: string, allowed: KernelPhase[]): void {
    const current = this.getPhase(moduleId)
    if (!allowed.includes(current)) {
      throw new Error(
        `[LifecycleManager] Module '${moduleId}' is in phase '${current}', ` +
        `but expected one of: ${allowed.join(', ')}.`
      )
    }
  }

  /**
   * Get the phases of all registered modules.
   */
  getAllPhases(): Record<string, KernelPhase> {
    const phases: Record<string, KernelPhase> = {}
    for (const mod of this._registry.getAll()) {
      phases[mod.id] = mod.phase
    }
    return phases
  }

  /**
   * Check if all modules are in the specified phase(s).
   */
  allInPhase(...phases: KernelPhase[]): boolean {
    const phaseSet = new Set(phases)
    for (const mod of this._registry.getAll()) {
      if (!phaseSet.has(mod.phase)) {
        return false
      }
    }
    return true
  }

  // ============================================================
  // Transition Listeners
  // ============================================================

  /**
   * Register a listener for phase transitions.
   * Returns an unsubscribe function.
   */
  onTransition(
    moduleId: string | '*',
    handler: (moduleId: string, from: KernelPhase, to: KernelPhase) => void
  ): () => void {
    const key = moduleId
    if (!this._listeners.has(key)) {
      this._listeners.set(key, [])
    }
    this._listeners.get(key)!.push(handler)

    return () => {
      const handlers = this._listeners.get(key)
      if (handlers) {
        const idx = handlers.indexOf(handler)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }

  private _notify(moduleId: string, from: KernelPhase, to: KernelPhase): void {
    // Notify module-specific listeners
    const modHandlers = this._listeners.get(moduleId)
    if (modHandlers) {
      for (const h of modHandlers) {
        try { h(moduleId, from, to) } catch { /* swallow */ }
      }
    }

    // Notify wildcard listeners
    const wildHandlers = this._listeners.get('*')
    if (wildHandlers) {
      for (const h of wildHandlers) {
        try { h(moduleId, from, to) } catch { /* swallow */ }
      }
    }
  }

  // ============================================================
  // Batch Operations
  // ============================================================

  /**
   * Transition multiple modules to the same phase.
   */
  transitionAll(to: KernelPhase): void {
    for (const mod of this._registry.getAll()) {
      this.transition(mod.id, to)
    }
  }
}
