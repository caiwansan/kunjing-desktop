// ============================================================
// ShadowEventMirror — Subscribe, Log, Compare, Replay Events
// 火麒麟AI导演控制台 — Kernel Safe Adoption System
// ============================================================

export interface ShadowEvent {
  id: string
  type: string
  payload: any
  timestamp: number
  source: string
}

export interface ConsistencyCheckResult {
  totalEvents: number
  matched: number
  mismatched: number
  missingFromShadow: number
  extraInShadow: number
  consistencyRate: number // 0-100
  diffs: Array<{
    eventId: string
    expected: any
    actual: any
    reason: string
  }>
}

export class ShadowEventMirror {
  private eventLog: ShadowEvent[] = []
  private realEventLog: ShadowEvent[] = []
  private maxLogSize: number = 10_000
  private isRecording: boolean = true

  /**
   * Handle an incoming event from the KernelEventBus.
   * Records the event into the shadow log for later analysis.
   */
  onEvent(event: ShadowEvent): void {
    if (!this.isRecording) return

    const entry: ShadowEvent = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp || Date.now(),
      source: event.source || 'shadow',
    }

    this.eventLog.push(entry)

    // Trim log if exceeding max size
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize)
    }
  }

  /**
   * Record an event from the real (non-shadow) runtime for comparison.
   */
  recordRealEvent(event: ShadowEvent): void {
    const entry: ShadowEvent = {
      id: event.id || `real_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp || Date.now(),
      source: 'real',
    }

    this.realEventLog.push(entry)

    if (this.realEventLog.length > this.maxLogSize) {
      this.realEventLog = this.realEventLog.slice(-this.maxLogSize)
    }
  }

  /**
   * Get the full shadow event log.
   */
  getEventLog(): ShadowEvent[] {
    return [...this.eventLog]
  }

  /**
   * Get the real runtime event log.
   */
  getRealEventLog(): ShadowEvent[] {
    return [...this.realEventLog]
  }

  /**
   * Compare shadow events against real events to determine consistency.
   */
  getConsistencyCheck(): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      totalEvents: 0,
      matched: 0,
      mismatched: 0,
      missingFromShadow: 0,
      extraInShadow: 0,
      consistencyRate: 100,
      diffs: [],
    }

    const realByType = new Map<string, ShadowEvent[]>()
    for (const evt of this.realEventLog) {
      const arr = realByType.get(evt.type) || []
      arr.push(evt)
      realByType.set(evt.type, arr)
    }

    const shadowByType = new Map<string, ShadowEvent[]>()
    for (const evt of this.eventLog) {
      const arr = shadowByType.get(evt.type) || []
      arr.push(evt)
      shadowByType.set(evt.type, arr)
    }

    // Check all real event types
    for (const [type, realEvents] of realByType.entries()) {
      const shadowEvents = shadowByType.get(type) || []

      for (let i = 0; i < Math.max(realEvents.length, shadowEvents.length); i++) {
        result.totalEvents++

        if (i >= shadowEvents.length) {
          // Real event has no shadow counterpart
          result.missingFromShadow++
          result.diffs.push({
            eventId: realEvents[i]?.id || 'unknown',
            expected: realEvents[i]?.payload,
            actual: null,
            reason: `Event type "${type}" missing from shadow log at index ${i}`,
          })
          continue
        }

        if (i >= realEvents.length) {
          // Extra shadow event with no real counterpart
          result.extraInShadow++
          result.diffs.push({
            eventId: shadowEvents[i]?.id || 'unknown',
            expected: null,
            actual: shadowEvents[i]?.payload,
            reason: `Extra shadow event type "${type}" at index ${i}`,
          })
          continue
        }

        // Compare payloads
        const realPayload = JSON.stringify(realEvents[i].payload)
        const shadowPayload = JSON.stringify(shadowEvents[i].payload)

        if (realPayload === shadowPayload) {
          result.matched++
        } else {
          result.mismatched++
          result.diffs.push({
            eventId: realEvents[i].id,
            expected: realEvents[i].payload,
            actual: shadowEvents[i].payload,
            reason: `Payload mismatch for event type "${type}" at index ${i}`,
          })
        }
      }
    }

    // Count extra shadow events for types real doesn't have
    for (const [type, shadowEvents] of shadowByType.entries()) {
      if (!realByType.has(type)) {
        for (const evt of shadowEvents) {
          result.totalEvents++
          result.extraInShadow++
          result.diffs.push({
            eventId: evt.id,
            expected: null,
            actual: evt.payload,
            reason: `Extra shadow event of unknown type "${type}"`,
          })
        }
      }
    }

    result.consistencyRate =
      result.totalEvents > 0
        ? Math.round((result.matched / result.totalEvents) * 100)
        : 100

    return result
  }

  /**
   * Replay a list of events back through the event bus.
   * Useful for testing kernel responses to historical event sequences.
   */
  replayEvents(events: ShadowEvent[]): void {
    console.log(`[ShadowEventMirror] Replaying ${events.length} events...`)

    for (const event of events) {
      // Re-register the event through the mirror (simulates bus dispatch)
      this.onEvent({
        ...event,
        id: `replay_${event.id}`,
        timestamp: Date.now(),
        source: 'replay',
      })

      console.log(
        `[ShadowEventMirror] Replayed event: ${event.type} (id=${event.id})`
      )
    }

    console.log(`[ShadowEventMirror] Replay complete.`)
  }

  /**
   * Clear all event logs.
   */
  clearLogs(): void {
    this.eventLog = []
    this.realEventLog = []
  }

  /**
   * Pause / resume event recording.
   */
  setRecording(enabled: boolean): void {
    this.isRecording = enabled
  }

  /**
   * Set the maximum number of events kept in the log.
   */
  setMaxLogSize(size: number): void {
    this.maxLogSize = size
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize)
    }
    if (this.realEventLog.length > this.maxLogSize) {
      this.realEventLog = this.realEventLog.slice(-this.maxLogSize)
    }
  }
}
