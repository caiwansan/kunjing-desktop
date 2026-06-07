// ============================================================
// CutoverDecisionEngine — Auto-Decide Cutover Phase & Rollback
// 火麒麟AI导演控制台 — Kernel Safe Adoption System
// ============================================================

import type { CutoverScore, CutoverDecision } from '../types'
import { CutoverScoreEngine } from './cutover-score-engine'

export interface CutoverDecisionResult {
  decision: CutoverDecision
  reasoning: string[]
  actions: string[]
  score: CutoverScore
  timestamp: number
}

export interface DecisionHistoryEntry {
  id: string
  result: CutoverDecisionResult
  previousDecision: CutoverDecision | null
  autoApplied: boolean
}

export class CutoverDecisionEngine {
  private scoreEngine: CutoverScoreEngine
  private history: DecisionHistoryEntry[] = []
  private currentPhase: CutoverDecision = 'SAFE_MODE'
  private consecutiveFailures: number = 0
  private maxConsecutiveFailures: number = 3

  constructor(scoreEngine?: CutoverScoreEngine) {
    this.scoreEngine = scoreEngine ?? new CutoverScoreEngine()
  }

  /**
   * Make an automated cutover decision based on the latest score evaluation.
   */
  decide(score?: CutoverScore): CutoverDecisionResult {
    const evalScore = score ?? this.scoreEngine.evaluate()
    const previousDecision = this.currentPhase

    const { decision, reasoning, actions } = this.resolveDecision(evalScore)

    this.currentPhase = decision

    const result: CutoverDecisionResult = {
      decision,
      reasoning,
      actions,
      score: evalScore,
      timestamp: Date.now(),
    }

    this.history.push({
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      result,
      previousDecision,
      autoApplied: true,
    })

    // Track consecutive failures for rollback detection
    if (decision === 'SAFE_MODE') {
      this.consecutiveFailures++
    } else {
      this.consecutiveFailures = 0
    }

    return result
  }

  /**
   * Detect whether the system should rollback to a safer phase.
   * Triggers on: consecutive failures >= threshold, or unexpected score drops.
   */
  shouldRollback(): boolean {
    // Consecutive SAFE_MODE decisions indicate systemic failure
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.warn(
        `[CutoverDecisionEngine] ROLLBACK TRIGGERED: ${this.consecutiveFailures} consecutive failures.`
      )
      return true
    }

    // Check for score drops in history
    if (this.history.length >= 2) {
      const latest = this.history[this.history.length - 1].result.score
      const previous = this.history[this.history.length - 2].result.score

      // A drop of >30 points is considered dangerous
      if (previous.overall - latest.overall > 30) {
        console.warn(
          `[CutoverDecisionEngine] ROLLBACK TRIGGERED: Score dropped from ${previous.overall} to ${latest.overall}.`
        )
        return true
      }
    }

    return false
  }

  /**
   * Get full decision history.
   */
  getHistory(): DecisionHistoryEntry[] {
    return [...this.history]
  }

  /**
   * Get the current active phase.
   */
  getCurrentPhase(): CutoverDecision {
    return this.currentPhase
  }

  /**
   * Manually set the current phase (for external overrides).
   */
  setCurrentPhase(phase: CutoverDecision): void {
    this.currentPhase = phase
    console.log(`[CutoverDecisionEngine] Phase manually set to: ${phase}`)
  }

  /**
   * Reset decision history and counters.
   */
  reset(): void {
    this.history = []
    this.currentPhase = 'SAFE_MODE'
    this.consecutiveFailures = 0
  }

  /**
   * Bind a score engine for live evaluation.
   */
  attachScoreEngine(engine: CutoverScoreEngine): void {
    this.scoreEngine = engine
  }

  /**
   * Set the threshold for consecutive failures before auto-rollback.
   */
  setMaxConsecutiveFailures(max: number): void {
    this.maxConsecutiveFailures = max
  }

  // ─── Private ───

  /**
   * Core decision logic: maps scores to decisions with reasoning and actions.
   */
  private resolveDecision(score: CutoverScore): {
    decision: CutoverDecision
    reasoning: string[]
    actions: string[]
  } {
    const overall = score.overall
    const dims = score.dimensions

    if (overall >= 95) {
      return {
        decision: 'FULL_CUTOVER',
        reasoning: [
          `Overall score ${overall} meets FULL_CUTOVER threshold (>= 95).`,
          `Event consistency: ${dims.eventConsistency}% — excellent sync.`,
          `State consistency: ${dims.stateConsistency}% — no drift.`,
          `Scheduler stability: ${dims.schedulerStability}% — rock solid.`,
          `GPU correctness: ${dims.gpuCorrectness}% — output matches.`,
          `Latency impact: ${dims.latencyImpact}% — minimal overhead.`,
        ],
        actions: [
          'Switch RuntimeMode to FULL_KERNEL',
          'Transition CutoverPhase to FULL_CONTROL',
          'Disable shadow mirroring to save resources',
          'Notify system operators of successful cutover',
          'Archive shadow logs for post-mortem analysis',
        ],
      }
    }

    if (overall >= 85) {
      return {
        decision: 'PARTIAL_CUTOVER',
        reasoning: [
          `Overall score ${overall} in PARTIAL_CUTOVER range (85-94).`,
          `Strong performance across most dimensions.`,
          this.dimensionWarning('Event consistency', dims.eventConsistency),
          this.dimensionWarning('State consistency', dims.stateConsistency),
          this.dimensionWarning('Scheduler stability', dims.schedulerStability),
          this.dimensionWarning('GPU correctness', dims.gpuCorrectness),
          this.dimensionWarning('Latency impact', dims.latencyImpact),
        ].filter(Boolean),
        actions: [
          'Switch RuntimeMode to CUTOVER_KERNEL',
          'Transition CutoverPhase to PARTIAL_EXECUTION',
          'Route 50% of real traffic through kernel for validation',
          'Keep shadow mirroring active on remaining traffic',
          'Schedule full evaluation in 30 minutes',
        ],
      }
    }

    if (overall >= 70) {
      return {
        decision: 'OBSERVE_ONLY',
        reasoning: [
          `Overall score ${overall} in OBSERVE_ONLY range (70-84).`,
          'Kernel is functional but not ready for production cutover.',
          this.dimensionWarning('Event consistency', dims.eventConsistency),
          this.dimensionWarning('State consistency', dims.stateConsistency),
          this.dimensionWarning('Scheduler stability', dims.schedulerStability),
          this.dimensionWarning('GPU correctness', dims.gpuCorrectness),
          this.dimensionWarning('Latency impact', dims.latencyImpact),
        ].filter(Boolean),
        actions: [
          'Maintain RuntimeMode as SHADOW_KERNEL',
          'Keep CutoverPhase as SHADOW_ONLY',
          'Increase data collection granularity',
          'Identify and fix low-scoring dimensions',
          'Re-evaluate in 1 hour',
        ],
      }
    }

    // Default: SAFE_MODE (score < 70)
    return {
      decision: 'SAFE_MODE',
      reasoning: [
        `Overall score ${overall} below SAFE_MODE threshold (< 70).`,
        'Kernel is NOT ready for any cutover activity.',
        'Critical issues detected across multiple dimensions:',
        this.dimensionWarning('Event consistency', dims.eventConsistency),
        this.dimensionWarning('State consistency', dims.stateConsistency),
        this.dimensionWarning('Scheduler stability', dims.schedulerStability),
        this.dimensionWarning('GPU correctness', dims.gpuCorrectness),
        this.dimensionWarning('Latency impact', dims.latencyImpact),
      ].filter(Boolean),
      actions: [
        'Switch RuntimeMode to WEB_RUNTIME or DESKTOP_RUNTIME',
        'Ensure no kernel code path is active in production',
        'Engage engineering team for root cause analysis',
        'Increase shadow data sampling for diagnostics',
        'Lock cutover evaluation until score exceeds 70',
        'File incident report for each dimension below threshold',
      ],
    }
  }

  /**
   * Generate a warning string for a dimension below 70%.
   * Returns null if the dimension is acceptable.
   */
  private dimensionWarning(name: string, value: number): string | null {
    if (value < 50) {
      return `${name}: ${value}% — CRITICAL. Immediate attention required.`
    }
    if (value < 70) {
      return `${name}: ${value}% — BELOW THRESHOLD. Needs improvement.`
    }
    if (value < 85) {
      return `${name}: ${value}% — ACCEPTABLE but room for improvement.`
    }
    return null // No warning needed
  }
}
