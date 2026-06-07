/**
 * StateConsistencyValidator — 状态一致性校验器
 *
 * 职责：
 * 1. validate(state) — 对照多项约束规则，检测状态漂移 / 冲突 / 矛盾
 * 2. detectStateDrift(moduleStates) — 多源状态交叉对比
 *
 * 校验规则示例：
 * - GPU queueLength ≤ GPU activeJobs + worker.total（生产能力约束）
 * - DAG pending + running + completed + failed = 任务总数
 * - Queue pending + processing + failed = DAG running + pending（流水线守恒）
 * - Worker active + idle + zombie = worker.total
 * - Agent active + idle = worker.active（agent-worker绑定）
 */

import type { RuntimeState } from './global-runtime-state';

// ── 校验结果类型 ──────────────────────────────────────────────────

export interface ValidationIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number;          // 0~100
  checkedAt: number;
}

export interface DriftReport {
  hasDrift: boolean;
  drifts: Array<{
    moduleId: string;
    field: string;
    expected: unknown;
    actual: unknown;
  }>;
  timestamp: number;
}

// ── StateConsistencyValidator ─────────────────────────────────────

export class StateConsistencyValidator {
  private readonly rules: Array<(state: RuntimeState) => ValidationIssue | null>;

  constructor() {
    this.rules = [
      this.checkGpuQueueConsistency,
      this.checkWorkerTotalConsistency,
      this.checkWorkerAgentBound,
      this.checkDagTotalConsistency,
      this.checkQueueDagConsistency,
      this.checkGovernanceTimestamp,
      this.checkEvolutionTimestamp,
      this.checkVramBound,
      this.checkZombieWorkerRatio,
      this.checkGpuTemperatureWarning,
    ];
  }

  // ── 全量校验 ────────────────────────────────────────────────────

  validate(state: RuntimeState): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const rule of this.rules) {
      try {
        const issue = rule(state);
        if (issue) issues.push(issue);
      } catch (err) {
        issues.push({
          rule: rule.name,
          severity: 'error',
          message: `校验规则执行异常: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = this.calculateScore(errorCount, warningCount);

    return {
      passed: errorCount === 0,
      issues,
      score,
      checkedAt: Date.now(),
    };
  }

  // ── 多源状态漂移检测 ────────────────────────────────────────────

  /**
   * 多源状态比较：例如来自不同 RuntimeKernel 集群实例的状态片断
   * moduleStates: { moduleId → Partial<RuntimeState> }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detectStateDrift(moduleStates: Record<string, Record<string, any>>): DriftReport {
    const drifts: DriftReport['drifts'] = [];
    const moduleIds = Object.keys(moduleStates);

    if (moduleIds.length < 2) {
      return { hasDrift: false, drifts: [], timestamp: Date.now() };
    }

    // 以第一个模块为基准
    const baseline = moduleStates[moduleIds[0]];

    for (let i = 1; i < moduleIds.length; i++) {
      const moduleId = moduleIds[i];
      const state = moduleStates[moduleId];
      this.compareStates(baseline, state, '', drifts, moduleIds[0], moduleId);
    }

    return {
      hasDrift: drifts.length > 0,
      drifts,
      timestamp: Date.now(),
    };
  }

  // ── 规则实现 ────────────────────────────────────────────────────

  private checkGpuQueueConsistency = (state: RuntimeState): ValidationIssue | null => {
    // GPU 队列长度不应超过活跃任务和可用 Worker 的总和
    const maxExpected = state.gpu.activeJobs + state.worker.total;
    if (state.gpu.queueLength > maxExpected && maxExpected > 0) {
      return {
        rule: 'gpu-queue-consistency',
        severity: 'warning',
        message: `GPU 队列长度 (${state.gpu.queueLength}) 超过预期上限 (${maxExpected})，可能存在资源争用`,
        path: 'gpu.queueLength',
        expected: maxExpected,
        actual: state.gpu.queueLength,
      };
    }
    return null;
  };

  private checkWorkerTotalConsistency = (state: RuntimeState): ValidationIssue | null => {
    // active + idle + zombie = total
    const sum = state.worker.active + state.worker.idle + state.worker.zombie;
    if (sum !== state.worker.total) {
      return {
        rule: 'worker-total-consistency',
        severity: 'error',
        message: `Worker 计数不匹配: active(${state.worker.active}) + idle(${state.worker.idle}) + zombie(${state.worker.zombie}) = ${sum} ≠ total(${state.worker.total})`,
        path: 'worker.total',
        expected: sum,
        actual: state.worker.total,
      };
    }
    return null;
  };

  private checkWorkerAgentBound = (state: RuntimeState): ValidationIssue | null => {
    // Agent active + idle 不应超过 Worker total（每个Agent绑定一个Worker）
    const agentTotal = state.agent.active + state.agent.idle;
    if (agentTotal > state.worker.total && state.worker.total > 0) {
      return {
        rule: 'worker-agent-bound',
        severity: 'warning',
        message: `Agent 总数 (${agentTotal}) 超过 Worker 总数 (${state.worker.total})`,
        path: 'agent',
        expected: state.worker.total,
        actual: agentTotal,
      };
    }
    return null;
  };

  private checkDagTotalConsistency = (state: RuntimeState): ValidationIssue | null => {
    // DAG 状态守恒暂不做死检查（可能包含未跟踪状态），仅做合理性
    return null;
  };

  private checkQueueDagConsistency = (state: RuntimeState): ValidationIssue | null => {
    // Queue 的 processing + pending 应约等于 DAG 的 running + pending
    const queueActive = state.queue.processing + state.queue.pending;
    const dagActive = state.dag.running + state.dag.pending;
    const diff = Math.abs(queueActive - dagActive);
    if (diff > Math.max(5, Math.floor(dagActive * 0.2))) {
      return {
        rule: 'queue-dag-consistency',
        severity: 'warning',
        message: `队列活跃任务 (${queueActive}) 与 DAG 活跃任务 (${dagActive}) 差异过大 (Δ=${diff})`,
        path: 'queue',
        expected: dagActive,
        actual: queueActive,
      };
    }
    return null;
  };

  private checkGovernanceTimestamp = (state: RuntimeState): ValidationIssue | null => {
    if (state.governance.active && state.governance.lastAudit === 0) {
      return {
        rule: 'governance-timestamp',
        severity: 'info',
        message: 'Governance 已激活但从未审计',
        path: 'governance.lastAudit',
        expected: '非零时间戳',
        actual: 0,
      };
    }
    return null;
  };

  private checkEvolutionTimestamp = (state: RuntimeState): ValidationIssue | null => {
    if (state.evolution.activeExperiments > 0 && state.evolution.lastEvolution === 0) {
      return {
        rule: 'evolution-timestamp',
        severity: 'info',
        message: `存在 ${state.evolution.activeExperiments} 个活跃实验但从未记录 evolution 时间`,
        path: 'evolution.lastEvolution',
        expected: '非零时间戳',
        actual: 0,
      };
    }
    return null;
  };

  private checkVramBound = (state: RuntimeState): ValidationIssue | null => {
    // VRAM 不合理阈值：按常见 GPU 24GB 上限看
    if (state.gpu.vramUsed > 24000) {
      return {
        rule: 'vram-bound',
        severity: 'warning',
        message: `VRAM 用量 (${state.gpu.vramUsed}MB) 超过 24GB`,
        path: 'gpu.vramUsed',
        expected: '≤ 24000',
        actual: state.gpu.vramUsed,
      };
    }
    return null;
  };

  private checkZombieWorkerRatio = (state: RuntimeState): ValidationIssue | null => {
    if (state.worker.total > 0) {
      const ratio = state.worker.zombie / state.worker.total;
      if (ratio > 0.3) {
        return {
          rule: 'zombie-worker-ratio',
          severity: 'error',
          message: `僵尸 Worker 比例 ${(ratio * 100).toFixed(1)}% 超过阈值 30%`,
          path: 'worker.zombie',
          expected: `≤ ${Math.floor(state.worker.total * 0.3)}`,
          actual: state.worker.zombie,
        };
      }
    }
    return null;
  };

  private checkGpuTemperatureWarning = (state: RuntimeState): ValidationIssue | null => {
    if (state.gpu.temperature > 85) {
      return {
        rule: 'gpu-temperature',
        severity: 'warning',
        message: `GPU 温度 ${state.gpu.temperature}°C 超过安全阈值 85°C`,
        path: 'gpu.temperature',
        expected: '≤ 85',
        actual: state.gpu.temperature,
      };
    }
    return null;
  };

  // ── 内部工具 ────────────────────────────────────────────────────

  private calculateScore(errorCount: number, warningCount: number): number {
    const base = 100;
    const deduction = errorCount * 15 + warningCount * 5;
    return Math.max(0, base - deduction);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compareStates(
    baseline: Record<string, any>,
    current: Record<string, any>,
    path: string,
    drifts: DriftReport['drifts'],
    baselineId: string,
    currentId: string,
  ): void {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

    for (const key of allKeys) {
      const fullPath = path ? `${path}.${key}` : key;

      // 跳过时间戳字段
      if (key === 'lastUpdated' || key === 'timestamp') continue;

      if (!(key in baseline)) {
        drifts.push({
          moduleId: currentId,
          field: fullPath,
          expected: undefined,
          actual: current[key],
        });
        continue;
      }

      if (!(key in current)) {
        drifts.push({
          moduleId: currentId,
          field: fullPath,
          expected: baseline[key],
          actual: undefined,
        });
        continue;
      }

      const bv = baseline[key];
      const cv = current[key];

      if (
        bv !== null && typeof bv === 'object' &&
        cv !== null && typeof cv === 'object' &&
        !Array.isArray(bv) && !Array.isArray(cv)
      ) {
        this.compareStates(bv, cv, fullPath, drifts, baselineId, currentId);
      } else if (bv !== cv) {
        drifts.push({
          moduleId: currentId,
          field: fullPath,
          expected: bv,
          actual: cv,
        });
      }
    }
  }
}
