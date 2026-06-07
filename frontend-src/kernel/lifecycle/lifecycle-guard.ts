// ============================================================
// Lifecycle Guard — Transition & Execution Enforcement
// 火麒麟AI导演控制台
// ============================================================

import type { KernelPhase } from '../types'
import { LEGAL_TRANSITIONS, EXECUTABLE_PHASES, SCHEDULABLE_PHASES } from '../types'
import type { RuntimeRegistry } from '../runtime-registry/runtime-registry'

/**
 * LifecycleGuard enforces strict rules around module state transitions
 * and execution/scheduling permissions.
 *
 * Purpose:
 * - Prevent illegal state transitions (e.g. BOOTING → STOPPED)
 * - Prevent execution of modules that haven't finished initialization
 * - Prevent scheduling on paused modules
 * - Act as a security layer between LifecycleManager and the module state
 */
export class LifecycleGuard {
  private readonly _registry: RuntimeRegistry

  constructor(registry: RuntimeRegistry) {
    this._registry = registry
  }

  // ============================================================
  // Transition Guard
  // ============================================================

  /**
   * Check whether a transition from `from` to `to` is legal.
   *
   * Returns { allowed: true } if the transition is permitted.
   * Returns { allowed: false, reason } if it is not.
   */
  guardTransition(
    moduleId: string,
    from: KernelPhase,
    to: KernelPhase
  ): { allowed: true } | { allowed: false; reason: string } {
    // If the module is not registered, reject
    if (!this._registry.has(moduleId)) {
      return {
        allowed: false,
        reason: `Module '${moduleId}' is not registered. Cannot transition ${from} → ${to}.`,
      }
    }

    // Same-phase transitions are no-ops (allowed, just ignored)
    if (from === to) {
      return { allowed: true }
    }

    const allowedNext = LEGAL_TRANSITIONS[from]
    if (!allowedNext || !allowedNext.has(to)) {
      return {
        allowed: false,
        reason: `Illegal state transition: ${from} → ${to} for module '${moduleId}'. ` +
          `Allowed next states from '${from}': ${Array.from(allowedNext ?? []).join(', ') || 'none'}.`,
      }
    }

    return { allowed: true }
  }

  /**
   * Assert that transitioning `from → to` is legal.
   * Throws an error if the transition is not allowed.
   */
  assertTransition(moduleId: string, from: KernelPhase, to: KernelPhase): void {
    const result = this.guardTransition(moduleId, from, to)
    if (!result.allowed) {
      throw new Error(`[LifecycleGuard] ${result.reason}`)
    }
  }

  // ============================================================
  // Execution Guard
  // ============================================================

  /**
   * Check whether a module is allowed to execute code (do work).
   *
   * Allowed phases: RUNNING, DEGRADED, RECOVERING
   * Disallowed: BOOTING, INITIALIZING, READY, PAUSED, SAFE_MODE, SHUTTING_DOWN, STOPPED
   */
  guardExecution(moduleId: string): { allowed: boolean; reason?: string } {
    if (!this._registry.has(moduleId)) {
      return {
        allowed: false,
        reason: `Module '${moduleId}' is not registered. Cannot execute.`,
      }
    }

    const mod = this._registry.get(moduleId)!
    if (EXECUTABLE_PHASES.has(mod.phase)) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `Module '${moduleId}' is in phase '${mod.phase}', which does not allow execution. ` +
        `Allowed phases: ${Array.from(EXECUTABLE_PHASES).join(', ')}.`,
    }
  }

  /**
   * Assert that a module is allowed to execute.
   * Throws if execution is not permitted.
   */
  assertExecution(moduleId: string): void {
    const result = this.guardExecution(moduleId)
    if (!result.allowed) {
      throw new Error(`[LifecycleGuard] ${result.reason}`)
    }
  }

  // ============================================================
  // Scheduling Guard
  // ============================================================

  /**
   * Check whether a module is allowed to receive scheduled tasks.
   *
   * Allowed phases: RUNNING, DEGRADED
   * Disallowed: RECOVERING (recovery is a one-shot process, not continuous work),
   *   PAUSED, SAFE_MODE, etc.
   */
  guardScheduling(moduleId: string): { allowed: boolean; reason?: string } {
    if (!this._registry.has(moduleId)) {
      return {
        allowed: false,
        reason: `Module '${moduleId}' is not registered. Cannot schedule.`,
      }
    }

    const mod = this._registry.get(moduleId)!
    if (SCHEDULABLE_PHASES.has(mod.phase)) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `Module '${moduleId}' is in phase '${mod.phase}', which does not allow scheduling. ` +
        `Allowed phases: ${Array.from(SCHEDULABLE_PHASES).join(', ')}.`,
    }
  }

  /**
   * Assert that a module is allowed to receive scheduled tasks.
   * Throws if scheduling is not permitted.
   */
  assertScheduling(moduleId: string): void {
    const result = this.guardScheduling(moduleId)
    if (!result.allowed) {
      throw new Error(`[LifecycleGuard] ${result.reason}`)
    }
  }
}
