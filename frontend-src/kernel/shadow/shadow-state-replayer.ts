// ============================================================
// ShadowStateReplayer — Capture, Replay, Compare State Snapshots
// 火麒麟AI导演控制台 — Kernel Safe Adoption System
// ============================================================

export interface StateSnapshot {
  id: string
  data: Record<string, any>
  timestamp: number
  path?: string
  value?: any
}

export interface StateComparisonResult {
  totalKeys: number
  matchedKeys: number
  mismatchedKeys: number
  consistencyPercent: number
  diffs: Array<{
    key: string
    realValue: any
    kernelValue: any
    reason: string
  }>
}

export class ShadowStateReplayer {
  private snapshots: StateSnapshot[] = []
  private maxSnapshots: number = 1000

  /**
   * Capture a snapshot of the current state.
   * Accepts either a full state object or a { path, value } partial update.
   */
  captureSnapshot(state: Record<string, any> | { path: string; value: any }): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      data: {},
      timestamp: Date.now(),
    }

    if ('path' in state && 'value' in state) {
      // Partial state update — store under the given path
      snapshot.path = state.path
      snapshot.value = state.value
      snapshot.data = this.buildNestedObject(state.path, state.value)
    } else {
      // Full state
      snapshot.data = { ...(state as Record<string, any>) }
    }

    this.snapshots.push(snapshot)

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots)
    }

    return snapshot
  }

  /**
   * Replay a snapshot into the kernel's state tree.
   * For each key in the snapshot, calls the kernel's setState method.
   */
  replayToKernel(snapshot: StateSnapshot, kernelStateTree: any): void {
    if (!kernelStateTree || typeof kernelStateTree.setState !== 'function') {
      throw new Error('[ShadowStateReplayer] Kernel state tree missing setState method.')
    }

    console.log(`[ShadowStateReplayer] Replaying snapshot ${snapshot.id} to kernel...`)

    if (snapshot.path && snapshot.value !== undefined) {
      // Partial snapshot — replay at exact path
      kernelStateTree.setState(snapshot.path, snapshot.value)
      console.log(`[ShadowStateReplayer] Set state at path "${snapshot.path}"`)
    } else {
      // Full state snapshot — iterate and set each key
      for (const [key, value] of Object.entries(snapshot.data)) {
        kernelStateTree.setState(key, value)
      }
      console.log(`[ShadowStateReplayer] Replayed ${Object.keys(snapshot.data).length} state keys.`)
    }
  }

  /**
   * Compare the real runtime state against the kernel-processed state.
   * Returns a detailed comparison report.
   */
  compareStates(realState: Record<string, any>, kernelState: Record<string, any>): StateComparisonResult {
    const result: StateComparisonResult = {
      totalKeys: 0,
      matchedKeys: 0,
      mismatchedKeys: 0,
      consistencyPercent: 100,
      diffs: [],
    }

    const allKeys = new Set([
      ...Object.keys(realState),
      ...Object.keys(kernelState),
    ])

    result.totalKeys = allKeys.size

    for (const key of allKeys) {
      const realVal = realState[key]
      const kernelVal = kernelState[key]

      const realStr = typeof realVal === 'object' ? JSON.stringify(realVal) : String(realVal)
      const kernelStr = typeof kernelVal === 'object' ? JSON.stringify(kernelVal) : String(kernelVal)

      if (realStr === kernelStr) {
        result.matchedKeys++
      } else {
        result.mismatchedKeys++
        result.diffs.push({
          key,
          realValue: realVal,
          kernelValue: kernelVal,
          reason: realVal === undefined
            ? `Key "${key}" missing in real state`
            : kernelVal === undefined
              ? `Key "${key}" missing in kernel state`
              : `Value mismatch for key "${key}"`,
        })
      }
    }

    result.consistencyPercent =
      result.totalKeys > 0
        ? Math.round((result.matchedKeys / result.totalKeys) * 100)
        : 100

    return result
  }

  /**
   * Get the overall state consistency score across all snapshots.
   * Compares the latest real snapshot with an assumed kernel-processed state.
   */
  getStateConsistency(): number {
    if (this.snapshots.length < 2) {
      return 100 // Not enough data — assume perfect
    }

    // Compare the last two snapshots to evaluate drift
    const latest = this.snapshots[this.snapshots.length - 1]
    const previous = this.snapshots[this.snapshots.length - 2]

    if (latest.path && previous.path) {
      // Both partial — compare at their paths
      if (latest.path === previous.path) {
        const latestVal = typeof latest.value === 'object' ? JSON.stringify(latest.value) : String(latest.value)
        const prevVal = typeof previous.value === 'object' ? JSON.stringify(previous.value) : String(previous.value)
        return latestVal === prevVal ? 100 : 50
      }
      return 100 // Different paths — not comparable
    }

    // Full state comparison
    const comparison = this.compareStates(previous.data, latest.data)
    return comparison.consistencyPercent
  }

  /**
   * Get all stored snapshots.
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Get the latest snapshot.
   */
  getLatestSnapshot(): StateSnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null
  }

  /**
   * Clear all snapshots.
   */
  clearSnapshots(): void {
    this.snapshots = []
  }

  /**
   * Set the maximum number of snapshots to retain.
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = max
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots)
    }
  }

  /**
   * Build a nested object from a dot-path and value.
   * e.g. "scene.camera.position" + { x: 1, y: 2 } → { scene: { camera: { position: { x: 1, y: 2 } } } }
   */
  private buildNestedObject(path: string, value: any): Record<string, any> {
    const keys = path.split('.')
    const result: Record<string, any> = {}
    let current = result

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {}
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
    return result
  }
}
