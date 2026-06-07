/**
 * RuntimeDiagnosticsEngine — 运行时诊断引擎
 *
 * 检测 7 类运行时问题：
 * 1. 死锁        — DAG / 队列任务相互等待
 * 2. Event 风暴  — 短时间内事件数量暴增
 * 3. Queue 堆积  — 队列任务数持续增长
 * 4. Worker 泄漏 — 已注册但长时间无心跳
 * 5. GPU 泄漏    — 已分配但超时未释放
 * 6. 状态漂移    — 多源状态不一致
 * 7. Agent 循环  — Agent 反复执行相同操作
 */

import { GlobalRuntimeState, type RuntimeState } from '../state-tree/global-runtime-state';
import { StateConsistencyValidator } from '../state-tree/state-consistency-validator';

// ── 类型定义 ──────────────────────────────────────────────────────

export interface DiagnosticIssue {
  type: DiagnosticType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export type DiagnosticType =
  | 'deadlock'
  | 'event-storm'
  | 'queue-backlog'
  | 'worker-leak'
  | 'gpu-leak'
  | 'state-drift'
  | 'agent-loop';

export interface DiagnosticReport {
  timestamp: number;
  issues: DiagnosticIssue[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  healthScore: number;   // 0~100
}

interface DiagnosticDetector {
  name: string;
  run: (state: RuntimeState) => Promise<DiagnosticIssue[]>;
}

// ── RuntimeDiagnosticsEngine ──────────────────────────────────────

export class RuntimeDiagnosticsEngine {
  private stateState: GlobalRuntimeState;
  private consistencyValidator: StateConsistencyValidator;

  /** 诊断检测器注册表 */
  private detectors: DiagnosticDetector[] = [];

  /** 历史快照（用于 Agent 循环检测） */
  private historySnapshots: RuntimeState[] = [];
  private readonly maxHistory = 10;

  /** Event 风暴计数 */
  private eventCounts: number[] = [];
  private readonly eventWindowSize = 10; // 检查最近 10 个时间窗口

  constructor() {
    this.stateState = GlobalRuntimeState.getInstance();
    this.consistencyValidator = new StateConsistencyValidator();

    // 注册默认检测器
    this.registerDefaultDetectors();
  }

  // ── 注册检测器 ──────────────────────────────────────────────────

  registerDetector(detector: DiagnosticDetector): void {
    this.detectors.push(detector);
  }

  private registerDefaultDetectors(): void {
    this.registerDetector({
      name: 'deadlock-detector',
      run: async (state) => this.detectDeadlocks(state),
    });
    this.registerDetector({
      name: 'event-storm-detector',
      run: async () => this.detectEventStorm(),
    });
    this.registerDetector({
      name: 'queue-backlog-detector',
      run: async (state) => this.detectQueueBacklog(state),
    });
    this.registerDetector({
      name: 'worker-leak-detector',
      run: async (state) => this.detectWorkerLeak(state),
    });
    this.registerDetector({
      name: 'gpu-leak-detector',
      run: async (state) => this.detectGPULeak(state),
    });
    this.registerDetector({
      name: 'state-drift-detector',
      run: async (state) => this.detectStateDrift(state),
    });
    this.registerDetector({
      name: 'agent-loop-detector',
      run: async () => this.detectAgentLoop(),
    });
  }

  // ── 全量诊断 ────────────────────────────────────────────────────

  async runDiagnostics(): Promise<DiagnosticReport> {
    const snapshot = this.stateState.getSnapshot();

    // 记录历史快照
    this.historySnapshots.push(snapshot);
    if (this.historySnapshots.length > this.maxHistory) {
      this.historySnapshots.shift();
    }

    const allIssues: DiagnosticIssue[] = [];

    for (const detector of this.detectors) {
      try {
        const issues = await detector.run(snapshot);
        allIssues.push(...issues);
      } catch (err) {
        allIssues.push({
          type: 'deadlock',
          severity: 'info',
          message: `检测器 "${detector.name}" 执行异常: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        });
      }
    }

    const critical = allIssues.filter(i => i.severity === 'critical').length;
    const warning = allIssues.filter(i => i.severity === 'warning').length;
    const info = allIssues.filter(i => i.severity === 'info').length;

    const healthScore = this.calculateHealthScore(critical, warning);

    return {
      timestamp: Date.now(),
      issues: allIssues,
      summary: { total: allIssues.length, critical, warning, info },
      healthScore,
    };
  }

  // ── 获取报告 ────────────────────────────────────────────────────

  getReport(): string {
    return JSON.stringify(
      {
        engine: 'RuntimeDiagnosticsEngine v1',
        detectors: this.detectors.map(d => d.name),
        historySnapshotsCount: this.historySnapshots.length,
      },
      null,
      2,
    );
  }

  // ── 注入外部事件计数（由 EventBus 调用） ────────────────────────

  recordEvent(count: number): void {
    this.eventCounts.push(count);
    if (this.eventCounts.length > this.eventWindowSize) {
      this.eventCounts.shift();
    }
  }

  // ── 各检测器实现 ────────────────────────────────────────────────

  private async detectDeadlocks(state: RuntimeState): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    // 死锁启发：DAG 中大量 pending 但 running 为 0
    if (state.dag.pending > 10 && state.dag.running === 0 && state.worker.active === 0) {
      issues.push({
        type: 'deadlock',
        severity: 'critical',
        message: `疑似死锁: DAG 中 ${state.dag.pending} 个任务 pending，但 running=0 且无活跃 Worker`,
        details: { dagPending: state.dag.pending, dagRunning: state.dag.running, activeWorkers: state.worker.active },
        timestamp: Date.now(),
      });
    }

    // Queue 堆积但无人消费
    if (state.queue.pending > 20 && state.queue.processing === 0 && state.worker.idle === 0 && state.worker.active === 0) {
      issues.push({
        type: 'deadlock',
        severity: 'warning',
        message: `队列中有 ${state.queue.pending} 个 pending 任务，但 processing=0 且无 Worker`,
        details: { queuePending: state.queue.pending, queueProcessing: state.queue.processing },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private async detectEventStorm(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    if (this.eventCounts.length < 3) return issues;

    const recent = this.eventCounts.slice(-5);
    const avg = recent.reduce((s, c) => s + c, 0) / recent.length;
    const last = recent[recent.length - 1];

    if (last > avg * 3 && last > 100) {
      issues.push({
        type: 'event-storm',
        severity: 'warning',
        message: `检测到 Event 风暴: 最近窗口事件数 ${last}，是均值 ${Math.round(avg)} 的 ${(last / avg).toFixed(1)} 倍`,
        details: { current: last, average: Math.round(avg), threshold: avg * 3 },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private async detectQueueBacklog(state: RuntimeState): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    if (state.queue.pending > 50) {
      issues.push({
        type: 'queue-backlog',
        severity: 'warning',
        message: `队列堆积: ${state.queue.pending} 个 pending 任务`,
        details: { pending: state.queue.pending, processing: state.queue.processing, failed: state.queue.failed },
        timestamp: Date.now(),
      });
    }

    if (state.queue.failed > 20) {
      issues.push({
        type: 'queue-backlog',
        severity: 'critical',
        message: `队列中有 ${state.queue.failed} 个失败任务，需要手动处理`,
        details: { failed: state.queue.failed },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private async detectWorkerLeak(state: RuntimeState): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    if (state.worker.zombie > 0) {
      const ratio = state.worker.total > 0 ? (state.worker.zombie / state.worker.total * 100).toFixed(1) : '0';
      issues.push({
        type: 'worker-leak',
        severity: state.worker.zombie > 5 ? 'critical' : 'warning',
        message: `检测到 ${state.worker.zombie} 个僵尸 Worker (占比 ${ratio}%)`,
        details: { zombie: state.worker.zombie, total: state.worker.total, ratio: `${ratio}%` },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private async detectGPULeak(state: RuntimeState): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    // GPU activeJobs > 0 但 DAG 中没有 running 且没有 Worker 在跑
    if (state.gpu.activeJobs > 0 && state.dag.running === 0 && state.worker.active === 0) {
      issues.push({
        type: 'gpu-leak',
        severity: 'warning',
        message: `疑似 GPU 泄漏: ${state.gpu.activeJobs} 个活跃 GPU 任务，但 DAG running=0 且 Worker active=0`,
        details: { gpuActiveJobs: state.gpu.activeJobs, dagRunning: state.dag.running },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private async detectStateDrift(state: RuntimeState): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    const validationResult = this.consistencyValidator.validate(state);

    if (!validationResult.passed) {
      for (const issue of validationResult.issues) {
        if (issue.severity === 'error') {
          issues.push({
            type: 'state-drift',
            severity: 'warning',
            message: `状态漂移: ${issue.message}`,
            details: { rule: issue.rule, path: issue.path, expected: issue.expected, actual: issue.actual },
            timestamp: Date.now(),
          });
        }
      }
    }

    return issues;
  }

  private async detectAgentLoop(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    if (this.historySnapshots.length < 4) return issues;

    // 检查最近的快照中 agent 状态是否完全相同
    const recent = this.historySnapshots.slice(-4);
    const agentStates = recent.map(s => JSON.stringify(s.agent));

    // 如果连续 4 次快照的 agent 状态完全相同，可能是循环
    if (agentStates.every(s => s === agentStates[0])) {
      issues.push({
        type: 'agent-loop',
        severity: 'warning',
        message: `检测到 Agent 循环: 连续 ${recent.length} 次快照中 Agent 状态未变化`,
        details: { agentState: recent[recent.length - 1].agent },
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  // ── 健康分 ──────────────────────────────────────────────────────

  private calculateHealthScore(critical: number, warning: number): number {
    const base = 100;
    return Math.max(0, base - critical * 25 - warning * 5);
  }
}
