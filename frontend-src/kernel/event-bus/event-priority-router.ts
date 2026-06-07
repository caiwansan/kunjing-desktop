// ============================================================
// Event Priority Router — Priority-Based Event Dispatch
// 火麒麟AI导演控制台
// ============================================================

import type { KernelEvent, EventPriority, EventHandler } from '../types'

/**
 * Priority-level FIFO queues for event dispatch.
 *
 * Ordering guarantee:
 * 1. CRITICAL events always dispatched before HIGH
 * 2. HIGH before NORMAL
 * 3. NORMAL before BACKGROUND
 * 4. Within the same priority: FIFO order
 * 5. CRITICAL events can "preempt" (insert at front of CRITICAL queue)
 */
export class EventPriorityRouter {
  /**
   * Per-priority queues of pending events.
   * Each queue is [event, ...handlers that match this event type][].
   */
  private readonly _queues: Record<EventPriority, Array<{
    event: KernelEvent
    handlers: EventHandler[]
    preempt: boolean
  }>> = {
    CRITICAL: [],
    HIGH: [],
    NORMAL: [],
    BACKGROUND: [],
  }

  /** Registered event handlers: eventType → handler[] */
  private readonly _handlers: Map<string, Set<EventHandler>> = new Map()

  /** Priority order for dispatch iteration */
  private static readonly PRIORITY_ORDER: EventPriority[] = [
    'CRITICAL',
    'HIGH',
    'NORMAL',
    'BACKGROUND',
  ]

  // ============================================================
  // Handler Management
  // ============================================================

  /**
   * Subscribe a handler to an event type.
   */
  subscribe(eventType: string, handler: EventHandler): void {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Set())
    }
    this._handlers.get(eventType)!.add(handler)
  }

  /**
   * Unsubscribe a handler from an event type.
   * Returns true if the handler was removed.
   */
  unsubscribe(eventType: string, handler: EventHandler): boolean {
    const handlers = this._handlers.get(eventType)
    if (!handlers) return false
    return handlers.delete(handler)
  }

  /**
   * Check if any handlers exist for an event type.
   */
  hasHandlers(eventType: string): boolean {
    return (this._handlers.get(eventType)?.size ?? 0) > 0
  }

  /**
   * Get the number of registered handlers for an event type.
   */
  handlerCount(eventType: string): number {
    return this._handlers.get(eventType)?.size ?? 0
  }

  // ============================================================
  // Event Enqueue
  // ============================================================

  /**
   * Enqueue an event for dispatch.
   * If preempt is true (only valid for CRITICAL), the event is inserted
   * at the front of the CRITICAL queue.
   *
   * Returns the number of handlers that will process this event.
   */
  enqueue(event: KernelEvent, preempt: boolean = false): number {
    const handlers = this._resolveHandlers(event.type)
    if (handlers.length === 0) return 0

    const priority = event.priority

    // Only CRITICAL priority is allowed to preempt
    const effectivePreempt = preempt && priority === 'CRITICAL'

    if (effectivePreempt) {
      // Insert at front of the priority queue
      this._queues[priority].unshift({ event, handlers, preempt: true })
    } else {
      // Normal FIFO append
      this._queues[priority].push({ event, handlers, preempt: false })
    }

    return handlers.length
  }

  // ============================================================
  // Dispatch
  // ============================================================

  /**
   * Dequeue and dispatch the next event based on priority ordering.
   *
   * Returns the dispatched event, or null if no events are pending.
   */
  dispatchNext(): KernelEvent | null {
    // Find the highest-priority non-empty queue
    for (const priority of EventPriorityRouter.PRIORITY_ORDER) {
      const queue = this._queues[priority]
      if (queue.length > 0) {
        const entry = queue.shift()!
        this._dispatchToHandlers(entry.event, entry.handlers)
        return entry.event
      }
    }

    return null
  }

  /**
   * Dispatch all pending events in priority order.
   * Processes until all queues are empty.
   * 
   * Warning: CRITICAL events enqueued during dispatch will be processed
   * before waiting lower-priority events, but within CRITICAL they are
   * still FIFO unless explicitly preempted.
   */
  dispatchAll(): KernelEvent[] {
    const dispatched: KernelEvent[] = []
    let event: KernelEvent | null

    while ((event = this.dispatchNext()) !== null) {
      dispatched.push(event)
    }

    return dispatched
  }

  /**
   * Check if there are any pending events.
   */
  get hasPending(): boolean {
    return (
      this._queues.CRITICAL.length > 0 ||
      this._queues.HIGH.length > 0 ||
      this._queues.NORMAL.length > 0 ||
      this._queues.BACKGROUND.length > 0
    )
  }

  /**
   * Get the count of pending events per priority.
   */
  get pendingCounts(): Record<EventPriority, number> {
    return {
      CRITICAL: this._queues.CRITICAL.length,
      HIGH: this._queues.HIGH.length,
      NORMAL: this._queues.NORMAL.length,
      BACKGROUND: this._queues.BACKGROUND.length,
    }
  }

  /**
   * Get the total number of pending events across all priorities.
   */
  get totalPending(): number {
    return Object.values(this._queues).reduce((sum, q) => sum + q.length, 0)
  }

  /**
   * Clear all pending events and registered handlers.
   */
  clear(): void {
    for (const priority of EventPriorityRouter.PRIORITY_ORDER) {
      this._queues[priority] = []
    }
    this._handlers.clear()
  }

  // ============================================================
  // Private
  // ============================================================

  /**
   * Resolve all handlers that match an event type.
   * Matches exact type and also wildcard '*' handlers.
   */
  private _resolveHandlers(eventType: string): EventHandler[] {
    const handlers: EventHandler[] = []

    // Exact type match
    const exactHandlers = this._handlers.get(eventType)
    if (exactHandlers) {
      handlers.push(...exactHandlers)
    }

    // Wildcard subscribers
    const wildHandlers = this._handlers.get('*')
    if (wildHandlers) {
      handlers.push(...wildHandlers)
    }

    return handlers
  }

  /**
   * Dispatch an event to all matched handlers.
   * Errors from individual handlers are caught and logged but
   * do not prevent other handlers from receiving the event.
   */
  private _dispatchToHandlers(event: KernelEvent, handlers: EventHandler[]): void {
    for (const handler of handlers) {
      try {
        const result = handler(event)
        // If the handler returns a Promise (async), we fire-and-forget
        // for async dispatch. For sync dispatch, callers use emitSync.
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(
              `[EventPriorityRouter] Async handler error for event '${event.type}':`,
              err
            )
          })
        }
      } catch (err) {
        console.error(
          `[EventPriorityRouter] Handler error for event '${event.type}':`,
          err
        )
      }
    }
  }
}
