// ============================================================
// Event Loop Detector — Cycle Detection & Circuit Breaking
// 火麒麟AI导演控制台
// ============================================================

import type { KernelEvent } from '../types'

/**
 * Represents a node in the event propagation call chain.
 */
interface EventChainNode {
  eventId: string
  eventType: string
  source: string
  depth: number
  parentEventId: string | null
}

/**
 * EventLoopDetector monitors event propagation chains and detects
 * circular event loops (A → B → C → A).
 *
 * Features:
 * - Tracks event call chains using a directed graph
 * - Detects cycles in the propagation graph
 * - Auto-circuit-break: forcibly halts event chains that loop
 * - TTL-based depth limiting (each event has a max propagation depth)
 *
 * This is integrated into KernelEventBus to provide self-healing
 * against accidental event storms caused by handler bugs.
 */
export class EventLoopDetector {
  /**
   * Directed graph of event propagation: edge A → B means
   * event A triggered event B as a side-effect.
   */
  private readonly _chainGraph: Map<string, Set<string>> = new Map()

  /**
   * Detailed node info keyed by event ID.
   */
  private readonly _nodes: Map<string, EventChainNode> = new Map()

  /**
   * Chain roots: event ID → root event ID
   */
  private readonly _chainRoots: Map<string, string> = new Map()

  /**
   * Events that have been circuit-broken (permanently halted).
   */
  private readonly _circuitBroken: Set<string> = new Set()

  /** Maximum depth before auto-circuit-break */
  private readonly _maxDepth: number

  /** Number of loops detected since creation */
  private _loopCount: number = 0

  constructor(maxDepth: number = 10) {
    this._maxDepth = maxDepth
  }

  // ============================================================
  // Recording
  // ============================================================

  /**
   * Record an event being emitted/fired.
   *
   * If `parentEventId` is provided, this event was triggered as
   * a side-effect of another event handler.
   *
   * Returns: { shouldPropagate: true } if the event is okay to continue,
   *          { shouldPropagate: false, reason } if it should be halted.
   */
  recordEvent(
    event: KernelEvent,
    parentEventId: string | null = null
  ): { shouldPropagate: boolean; reason?: string } {
    const eventId = event.id
    const effectiveTtl = event.ttl ?? this._maxDepth

    // === Check circuit break ===
    if (this._circuitBroken.has(eventId)) {
      return {
        shouldPropagate: false,
        reason: `Event '${eventId}' has been circuit-broken.`,
      }
    }

    // === Determine depth ===
    let depth: number
    if (parentEventId) {
      const parentNode = this._nodes.get(parentEventId)
      depth = parentNode ? parentNode.depth + 1 : 1

      // Record edge in the chain graph
      if (!this._chainGraph.has(parentEventId)) {
        this._chainGraph.set(parentEventId, new Set())
      }
      this._chainGraph.get(parentEventId)!.add(eventId)

      // Inherit chain root
      const rootId = this._chainRoots.get(parentEventId) ?? parentEventId
      this._chainRoots.set(eventId, rootId)
    } else {
      depth = 0
      this._chainRoots.set(eventId, eventId)
    }

    // === TTL check ===
    if (depth >= effectiveTtl) {
      // Auto-circuit-break this event and its ancestors
      this._autoBreakChain(eventId, `TTL exceeded (depth ${depth} >= ${effectiveTtl})`)
      return {
        shouldPropagate: false,
        reason: `Event '${eventId}' exceeded TTL (depth ${depth}/${effectiveTtl}). Chain circuit-broken.`,
      }
    }

    // === Store node ===
    this._nodes.set(eventId, {
      eventId,
      eventType: event.type,
      source: event.source,
      depth,
      parentEventId,
    })

    return { shouldPropagate: true }
  }

  // ============================================================
  // Loop Detection
  // ============================================================

  /**
   * Detect any cycles in the current event propagation graph.
   *
   * Uses DFS with coloring (WHITE/GRAY/BLACK) to find back-edges.
   *
   * Returns an array of cycle paths, where each cycle is an array
   * of event IDs forming the cycle.
   */
  detectLoop(): string[][] {
    const cycles: string[][] = []
    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    const parent = new Map<string, string | null>()

    // Initialize all nodes to WHITE
    for (const id of this._nodes.keys()) {
      color.set(id, WHITE)
      parent.set(id, null)
    }

    // DFS
    for (const startId of this._nodes.keys()) {
      if (color.get(startId) === WHITE) {
        this._dfsVisit(startId, color, parent, cycles)
      }
    }

    if (cycles.length > 0) {
      this._loopCount += cycles.length
    }

    return cycles
  }

  private _dfsVisit(
    nodeId: string,
    color: Map<string, number>,
    parent: Map<string, string | null>,
    cycles: string[][]
  ): void {
    color.set(nodeId, GRAY)

    const neighbors = this._chainGraph.get(nodeId) ?? new Set()
    for (const neighbor of neighbors) {
      if (!this._nodes.has(neighbor)) continue

      if (color.get(neighbor) === GRAY) {
        // Found a back-edge: reconstruct cycle
        const cycle: string[] = [neighbor, nodeId]
        let cur: string | null = nodeId
        while (cur !== null && cur !== neighbor) {
          cur = parent.get(cur) ?? null
          if (cur && cur !== neighbor) {
            cycle.push(cur)
          }
        }
        cycle.reverse()
        cycles.push(cycle)
      } else if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, nodeId)
        this._dfsVisit(neighbor, color, parent, cycles)
      }
    }

    color.set(nodeId, BLACK)
  }

  // ============================================================
  // Circuit Breaking
  // ============================================================

  /**
   * Automatically break a chain originating from the given event.
   * All events sharing the same root will be circuit-broken.
   */
  autoCircuitBreak(): string[] {
    const cycles = this.detectLoop()
    const broken: string[] = []

    for (const cycle of cycles) {
      // Break all events in the cycle and their children
      for (const eventId of cycle) {
        if (!this._circuitBroken.has(eventId)) {
          this._circuitBroken.add(eventId)
          broken.push(eventId)

          // Also break all descendants
          this._breakDescendants(eventId, broken)
        }
      }
    }

    return broken
  }

  /**
   * Check if an event has been circuit-broken.
   */
  isCircuitBroken(eventId: string): boolean {
    return this._circuitBroken.has(eventId)
  }

  /**
   * Get the total number of loops detected since creation.
   */
  get loopCount(): number {
    return this._loopCount
  }

  /**
   * Reset all detector state.
   */
  reset(): void {
    this._chainGraph.clear()
    this._nodes.clear()
    this._chainRoots.clear()
    this._circuitBroken.clear()
    this._loopCount = 0
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private _autoBreakChain(eventId: string, reason: string): void {
    // Find the root of this chain
    const rootId = this._chainRoots.get(eventId) ?? eventId

    // Break root and all descendants
    const broken: string[] = []
    this._circuitBroken.add(rootId)
    broken.push(rootId)
    this._breakDescendants(rootId, broken)
  }

  private _breakDescendants(eventId: string, broken: string[]): void {
    const children = this._chainGraph.get(eventId)
    if (!children) return

    for (const childId of children) {
      if (!this._circuitBroken.has(childId)) {
        this._circuitBroken.add(childId)
        broken.push(childId)
        this._breakDescendants(childId, broken)
      }
    }
  }
}
