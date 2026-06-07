/**
 * kernel/index.ts — 统一导出
 *
 * 导出所有 kernel 子模块，提供单一入口点。
 * 使用方式：
 *   import * as Kernel from '@/kernel';
 *   或按需导入：import { GlobalRuntimeState, KernelScheduler } from '@/kernel';
 */

// ── State Tree ────────────────────────────────────────────────────

export { GlobalRuntimeState } from './state-tree/global-runtime-state';
export type {
  ModuleRuntimeState,
  GPUState,
  WorkerState,
  DAGState,
  QueueState,
  GovernanceState,
  EvolutionState,
  WorldState,
  AgentState,
  RuntimeState,
  StatePath,
  StateDiff,
} from './state-tree/global-runtime-state';

export { StateDiffEngine } from './state-tree/state-diff-engine';
export type { CompactDiff, JSONPatch } from './state-tree/state-diff-engine';

export { StateConsistencyValidator } from './state-tree/state-consistency-validator';
export type {
  ValidationIssue,
  ValidationResult,
  DriftReport,
} from './state-tree/state-consistency-validator';

// ── Scheduler ─────────────────────────────────────────────────────

export { KernelScheduler, PRIORITY_ORDER } from './scheduler/kernel-scheduler';
export type {
  TaskType,
  PriorityLevel,
  KernelTask,
  TaskInQueue,
  SchedulerStatus,
} from './scheduler/kernel-scheduler';

export { PriorityCoordinator, PRIORITY_TIERS, PRIORITY_SCORE } from './scheduler/priority-coordinator';
export type { Queues } from './scheduler/priority-coordinator';

export { StarvationPreventer } from './scheduler/starvation-preventer';
export type { StarvationConfig, AgingStats } from './scheduler/starvation-preventer';

// ── Memory ────────────────────────────────────────────────────────

export { RuntimeMemoryManager } from './memory/runtime-memory-manager';
export type {
  MemoryType,
  MemoryUsage,
  MemoryAllocation,
  MemoryPressureReport,
  MemoryPressureLevel,
} from './memory/runtime-memory-manager';

export { GarbageCollector } from './memory/garbage-collector';
export type { GarbageCollectionReport } from './memory/garbage-collector';

export { MemoryPressureController } from './memory/memory-pressure-controller';
export type { PressureAction, PressureReactionReport, PressureControllerConfig } from './memory/memory-pressure-controller';

// ── Resource ──────────────────────────────────────────────────────

export { GPUResourceManager } from './resource/gpu-resource-manager';
export type {
  GPUAllocateRequest,
  GPUAllocation,
  GPUUtilization,
} from './resource/gpu-resource-manager';

export { WorkerResourceManager } from './resource/worker-resource-manager';
export type {
  WorkerStatus,
  WorkerInfo,
  WorkerHealthReport,
} from './resource/worker-resource-manager';

// ── Diagnostics ───────────────────────────────────────────────────

export { RuntimeDiagnosticsEngine } from './diagnostics/runtime-diagnostics-engine';
export type {
  DiagnosticIssue,
  DiagnosticType,
  DiagnosticReport,
} from './diagnostics/runtime-diagnostics-engine';

export { KernelHealthMonitor } from './diagnostics/kernel-health-monitor';
export type {
  HealthDimension,
  DimensionScore,
  HealthScoreReport,
  HealthMonitorConfig,
} from './diagnostics/kernel-health-monitor';
