// ============================================================
// CutoverScoreEngine — Evaluate Kernel Readiness for Cutover
// 火麒麟AI导演控制台 — Kernel Safe Adoption System
// ============================================================
// Scores the shadow kernel across 5 weighted dimensions:
//   - eventConsistency    30%
//   - stateConsistency    25%
//   - schedulerStability  20%
//   - gpuCorrectness      15%
//   - latencyImpact       10%
//
// Decision thresholds:
//   < 70  → SAFE_MODE
//   70-85 → OBSERVE_ONLY
//   85-95 → PARTIAL_CUTOVER
//   > 95  → FULL_CUTOVER
// ============================================================

import type { CutoverScore, CutoverDecision } from '../types'
import { ShadowRuntimeKernel, ShadowEventMirror, ShadowStateReplayer } from '../shadow'

export interface ScoreDimensionInput {
  eventConsistency: number   // 0-100
  stateConsistency: number   // 0-100
  schedulerStability: number // 0-100
  gpuCorrectness: number     // 0-100
  latencyImpact: number      // 0-100 (inverted: lower latency = higher score)
}

export interface DetailedScoreReport {
  score: CutoverScore
  weights: {
    eventConsistency: number
    stateConsistency: number
    schedulerStability: number
    gpuCorrectness: number
    latencyImpact: number
  }
  contributions: {
    eventConsistency: number
    stateConsistency: number
    schedulerStability: number
    gpuCorrectness: number
    latencyImpact: number
  }
  decision: CutoverDecision
  recommendations: string[]
  timestamp: number
}

const WEIGHTS = {
  eventConsistency: 0.30,
  stateConsistency: 0.25,
  schedulerStability: 0.20,
  gpuCorrectness: 0.15,
  latencyImpact: 0.10,
}

export class CutoverScoreEngine {
  private shadowKernel: ShadowRuntimeKernel | null = null
  private scoreHistory: CutoverScore[] = []

  /**
   * Bind the engine to an active ShadowRuntimeKernel for live data collection.
   */
  attachShadowKernel(shadow: ShadowRuntimeKernel): void {
    this.shadowKernel = shadow
  }

  /**
   * Evaluate readiness based on shadow mirror data and dimension inputs.
   * If a ShadowRuntimeKernel is attached, pulls live stats automatically.
   */
  evaluate(input?: ScoreDimensionInput): CutoverScore {
    const dimensions = input ?? this.collectFromShadow()

    const contributions = {
      eventConsistency: dimensions.eventConsistency * WEIGHTS.eventConsistency,
      stateConsistency: dimensions.stateConsistency * WEIGHTS.stateConsistency,
      schedulerStability: dimensions.schedulerStability * WEIGHTS.schedulerStability,
      gpuCorrectness: dimensions.gpuCorrectness * WEIGHTS.gpuCorrectness,
      latencyImpact: dimensions.latencyImpact * WEIGHTS.latencyImpact,
    }

    const overall = Math.round(
      contributions.eventConsistency +
      contributions.stateConsistency +
      contributions.schedulerStability +
      contributions.gpuCorrectness +
      contributions.latencyImpact
    )

    const score: CutoverScore = {
      overall,
      dimensions: { ...dimensions },
      phase: this.getDecision(overall),
      timestamp: Date.now(),
    }

    this.scoreHistory.push(score)
    return score
  }

  /**
   * Determine the cutover phase/decision from an overall score.
   */
  getDecision(score: number): CutoverDecision {
    if (score >= 95) return 'FULL_CUTOVER'
    if (score >= 85) return 'PARTIAL_CUTOVER'
    if (score >= 70) return 'OBSERVE_ONLY'
    return 'SAFE_MODE'
  }

  /**
   * Generate a comprehensive report with weights, contributions, and recommendations.
   */
  getDetailedReport(input?: ScoreDimensionInput): DetailedScoreReport {
    const score = this.evaluate(input)

    const recommendations: string[] = this.buildRecommendations(score)

    const contributions = {
      eventConsistency: score.dimensions.eventConsistency * WEIGHTS.eventConsistency,
      stateConsistency: score.dimensions.stateConsistency * WEIGHTS.stateConsistency,
      schedulerStability: score.dimensions.schedulerStability * WEIGHTS.schedulerStability,
      gpuCorrectness: score.dimensions.gpuCorrectness * WEIGHTS.gpuCorrectness,
      latencyImpact: score.dimensions.latencyImpact * WEIGHTS.latencyImpact,
    }

    return {
      score,
      weights: { ...WEIGHTS },
      contributions,
      decision: score.phase,
      recommendations,
      timestamp: Date.now(),
    }
  }

  /**
   * Get the score evaluation history.
   */
  getScoreHistory(): CutoverScore[] {
    return [...this.scoreHistory]
  }

  /**
   * Get the latest score evaluation.
   */
  getLatestScore(): CutoverScore | null {
    return this.scoreHistory.length > 0
      ? this.scoreHistory[this.scoreHistory.length - 1]
      : null
  }

  /**
   * Reset evaluation history.
   */
  resetHistory(): void {
    this.scoreHistory = []
  }

  // ─── Private Helpers ───

  /**
   * Collect dimension data from the attached shadow kernel's live stats.
   */
  private collectFromShadow(): ScoreDimensionInput {
    if (!this.shadowKernel) {
      // No shadow kernel — return worst-case (safe default)
      return {
        eventConsistency: 0,
        stateConsistency: 0,
        schedulerStability: 0,
        gpuCorrectness: 0,
        latencyImpact: 0,
      }
    }

    const stats = this.shadowKernel.getMirrorStats()
    const eventMirror = this.shadowKernel.getEventMirror()
    const stateReplayer = this.shadowKernel.getStateReplayer()

    // Derive consistency scores from mirror stats
    const eventConsistency = this.calculateEventConsistency(eventMirror)
    const stateConsistency = stateReplayer.getStateConsistency()

    // Scheduler stability: inversely proportional to error rate
    const schedulerStability = stats.schedulesMirrored > 0
      ? Math.max(0, 100 - (stats.errors / (stats.schedulesMirrored + stats.eventsMirrored)) * 100)
      : 100

    // GPU correctness: assume high if no errors
    const gpuCorrectness = stats.gpuTasksMirrored > 0
      ? Math.max(0, 100 - (stats.errors / stats.gpuTasksMirrored) * 100)
      : 100

    // Latency impact: inversely proportional to task volume (simplified)
    const totalTasks = stats.eventsMirrored + stats.schedulesMirrored + stats.gpuTasksMirrored
    const latencyImpact = totalTasks > 0
      ? Math.min(100, Math.max(0, 100 - (stats.errors / totalTasks) * 50))
      : 100

    return {
      eventConsistency,
      stateConsistency,
      schedulerStability,
      gpuCorrectness,
      latencyImpact,
    }
  }

  /**
   * Calculate event consistency by querying the event mirror's consistency check.
   */
  private calculateEventConsistency(eventMirror: ShadowEventMirror): number {
    const check = eventMirror.getConsistencyCheck()
    return check.consistencyRate
  }

  /**
   * Build human-readable recommendations based on the score dimensions.
   */
  private buildRecommendations(score: CutoverScore): string[] {
    const recs: string[] = []

    if (score.dimensions.eventConsistency < 70) {
      recs.push(`Low event consistency (${score.dimensions.eventConsistency}%). Fix event bus sync before cutover.`)
    }
    if (score.dimensions.stateConsistency < 70) {
      recs.push(`Low state consistency (${score.dimensions.stateConsistency}%). State tree drift detected.`)
    }
    if (score.dimensions.schedulerStability < 70) {
      recs.push(`Unstable scheduler (${score.dimensions.schedulerStability}%). Review tick timing.`)
    }
    if (score.dimensions.gpuCorrectness < 70) {
      recs.push(`GPU task divergence (${score.dimensions.gpuCorrectness}%). Check pipeline output.`)
    }
    if (score.dimensions.latencyImpact < 70) {
      recs.push(`Significant latency impact (${score.dimensions.latencyImpact}%). Profile hot paths.`)
    }

    if (score.overall >= 95) {
      recs.push('Kernel is ready for FULL_CUTOVER. All dimensions optimal.')
    } else if (score.overall >= 85) {
      recs.push('Kernel is ready for PARTIAL_CUTOVER. Monitor remaining gaps.')
    } else if (score.overall >= 70) {
      recs.push('Recommend OBSERVE_ONLY mode. Continue shadowing and collecting data.')
    } else {
      recs.push('Kernel is NOT ready. Stay in SAFE_MODE. Address critical issues first.')
    }

    return recs
  }
}
