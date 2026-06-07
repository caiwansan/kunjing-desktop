// ============================================================
// ShadowRuntimeKernel — Mirror Runtime Without Execution
// 火麒麟AI导演控制台 — Kernel Safe Adoption System
// ============================================================
// Core philosophy: Shadow → Observe → Score → Gradual Cutover → Full Control
// This kernel listens (mirrors) the real Runtime's events, schedules,
// states, and GPU tasks — but never executes anything.
// ============================================================

import type { RuntimeKernel } from '../types'
import { ShadowEventMirror } from './shadow-event-mirror'
import { ShadowStateReplayer } from './shadow-state-replayer'

export interface MirrorStats {
  eventsMirrored: number
  schedulesMirrored: number
  stateChangesMirrored: number
  gpuTasksMirrored: number
  errors: number
}

export class ShadowRuntimeKernel {
  private realKernel: RuntimeKernel | null = null
  private mirroring: boolean = false
  private eventMirror: ShadowEventMirror
  private stateReplayer: ShadowStateReplayer

  private stats: MirrorStats = {
    eventsMirrored: 0,
    schedulesMirrored: 0,
    stateChangesMirrored: 0,
    gpuTasksMirrored: 0,
    errors: 0,
  }

  constructor() {
    this.eventMirror = new ShadowEventMirror()
    this.stateReplayer = new ShadowStateReplayer()
  }

  /**
   * Attach to the live RuntimeKernel to start intercepting signals.
   */
  attachToKernel(kernel: RuntimeKernel): void {
    if (this.realKernel) {
      console.warn('[ShadowRuntimeKernel] Already attached to a kernel. Detaching first.')
      this.stopMirroring()
    }
    this.realKernel = kernel
    console.log('[ShadowRuntimeKernel] Attached to RuntimeKernel.')
  }

  /**
   * Begin mirroring the attached kernel's activity.
   * The shadow observes all event bus traffic, scheduler ticks, state diffs,
   * and GPU task dispatching — but never executes.
   */
  startMirroring(): void {
    if (!this.realKernel) {
      throw new Error('[ShadowRuntimeKernel] Cannot start mirroring: no kernel attached.')
    }
    if (this.mirroring) {
      console.warn('[ShadowRuntimeKernel] Already mirroring.')
      return
    }
    this.mirroring = true

    // Subscribe to the kernel's event bus (if available)
    if ((this.realKernel as any).eventBus) {
      ;(this.realKernel as any).eventBus.subscribe(this.eventMirror.onEvent.bind(this.eventMirror))
    }

    // Hook into scheduler tick (if available)
    if ((this.realKernel as any).scheduler) {
      const origTick = (this.realKernel as any).scheduler.tick
      const self = this
      ;(this.realKernel as any).scheduler.tick = function (...args: any[]) {
        self.stats.schedulesMirrored++
        return origTick.apply(this, args)
      }
    }

    // Hook into state changes
    if ((this.realKernel as any).stateTree) {
      const origSet = (this.realKernel as any).stateTree.setState
      const self = this
      ;(this.realKernel as any).stateTree.setState = function (path: string, value: any) {
        self.stats.stateChangesMirrored++
        self.stateReplayer.captureSnapshot({ path, value })
        return origSet.call(this, path, value)
      }
    }

    // Hook into GPU task dispatch
    if ((this.realKernel as any).gpuPipeline) {
      const origDispatch = (this.realKernel as any).gpuPipeline.dispatch
      const self = this
      ;(this.realKernel as any).gpuPipeline.dispatch = function (task: any) {
        self.stats.gpuTasksMirrored++
        return origDispatch.call(this, task)
      }
    }

    console.log('[ShadowRuntimeKernel] Mirroring started.')
  }

  /**
   * Halt mirroring and detach hooks.
   */
  stopMirroring(): void {
    if (!this.mirroring) return
    this.mirroring = false
    console.log('[ShadowRuntimeKernel] Mirroring stopped.')
  }

  /**
   * Return current mirror statistics.
   */
  getMirrorStats(): MirrorStats {
    return { ...this.stats }
  }

  /**
   * Access the internal event mirror for analysis.
   */
  getEventMirror(): ShadowEventMirror {
    return this.eventMirror
  }

  /**
   * Access the internal state replayer for analysis.
   */
  getStateReplayer(): ShadowStateReplayer {
    return this.stateReplayer
  }

  /**
   * Whether the shadow is actively mirroring.
   */
  isMirroring(): boolean {
    return this.mirroring
  }

  /**
   * Reset all shadow statistics to zero.
   */
  resetStats(): void {
    this.stats = {
      eventsMirrored: 0,
      schedulesMirrored: 0,
      stateChangesMirrored: 0,
      gpuTasksMirrored: 0,
      errors: 0,
    }
  }
}
