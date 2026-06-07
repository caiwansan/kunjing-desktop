/**
 * KernelHealthMonitor — 内核健康监控器
 *
 * 6 维度健康评分：
 *   Stability / Memory / GPU / Scheduler / EventBus / StateConsistency
 *
 * 提供：
 * - getHealthScore() → { overall, dimensions, recommendations }
 * - 低于阈值自动报警（通过回调）
 */

import type { RuntimeState } from '../state-tree/global-runtime-state';
import { GlobalRuntimeState } from '../state-tree/global-runtime-state';
import { StateConsistencyValidator } from '../state-tree/state-consistency-validator';
import { RuntimeMemoryManager } from '../memory/runtime-memory-manager';
import type { MemoryPressureLevel } from '../memory/runtime-memory-manager';

// ── 类型定义 ──────────────────────────────────────────────────────

export type HealthDimension =
  | 'stability'
  | 'memory'
  | 'gpu'
  | 'scheduler'
  | 'eventBus'
  | 'stateConsistency';

export interface DimensionScore {
  dimension: HealthDimension;
  score: number;         // 0~100
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: string;
}

export interface HealthScoreReport {
  overall: number;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  dimensions: DimensionScore[];
  recommendations: string[];
  timestamp: number;
}

export interface HealthMonitorConfig {
  /** 各维度权重（总和应为 1.0） */
  weights: Record<HealthDimension, number>;
  /** 告警阈值（overall 低于此值触发 alarm） */
  alarmThreshold: number;
  /** 告警冷却时间（ms） */
  alarmCooldown: number;
  /** 是否启用自动告警 */
  alarmEnabled: boolean;
}

const DEFAULT_WEIGHTS: Record<HealthDimension, number> = {
  stability:          0.20,
  memory:             0.20,
  gpu:                0.15,
  scheduler:          0.20,
  eventBus:           0.10,
  stateConsistency:   0.15,
};

// ── KernelHealthMonitor ───────────────────────────────────────────

export class KernelHealthMonitor {
  private stateState: GlobalRuntimeState;
  private memoryManager: RuntimeMemoryManager;
  private consistencyValidator: StateConsistencyValidator;

  private config: HealthMonitorConfig = {
    weights: { ...DEFAULT_WEIGHTS },
    alarmThreshold: 60,
    alarmCooldown: 300_000,   // 5 min
    alarmEnabled: true,
  };

  /** 上次告警时间 */
  private lastAlarmTime = 0;

  /** 告警回调 */
  private alarmCallback: ((report: HealthScoreReport) => void) | null = null;

  constructor() {
    this.stateState = GlobalRuntimeState.getInstance();
    this.memoryManager = RuntimeMemoryManager.getInstance();
    this.consistencyValidator = new StateConsistencyValidator();
  }

  // ── 配置 ────────────────────────────────────────────────────────

  configure(overrides: Partial<HealthMonitorConfig>): void {
    if (overrides.weights) {
      Object.assign(this.config.weights, overrides.weights);
    }
    if (overrides.alarmThreshold !== undefined) this.config.alarmThreshold = overrides.alarmThreshold;
    if (overrides.alarmCooldown !== undefined) this.config.alarmCooldown = overrides.alarmCooldown;
    if (overrides.alarmEnabled !== undefined) this.config.alarmEnabled = overrides.alarmEnabled;
  }

  /**
   * 注册告警回调（低于阈值时触发）
   */
  onAlarm(callback: (report: HealthScoreReport) => void): void {
    this.alarmCallback = callback;
  }

  // ── 健康评分 ────────────────────────────────────────────────────

  getHealthScore(): HealthScoreReport {
    const state = this.stateState.getSnapshot();

    const stability     = this.scoreStability(state);
    const memory        = this.scoreMemory();
    const gpu           = this.scoreGPU(state);
    const scheduler     = this.scoreScheduler(state);
    const eventBus      = this.scoreEventBus();
    const stateConsist  = this.scoreStateConsistency(state);

    const dimensions: DimensionScore[] = [
      stability, memory, gpu, scheduler, eventBus, stateConsist,
    ];

    // 加权总分
    let overall = 0;
    let totalWeight = 0;
    for (const dim of dimensions) {
      const w = this.config.weights[dim.dimension];
      overall += dim.score * w;
      totalWeight += w;
    }
    overall = totalWeight > 0 ? Math.round(overall / totalWeight) : 0;

    const overallStatus = overall >= 80 ? 'healthy' : overall >= 60 ? 'degraded' : 'unhealthy';

    // 建议
    const recommendations = this.generateRecommendations(dimensions, state);

    const report: HealthScoreReport = {
      overall,
      overallStatus,
      dimensions,
      recommendations,
      timestamp: Date.now(),
    };

    // 告警检查
    if (this.config.alarmEnabled && overall < this.config.alarmThreshold) {
      this.triggerAlarm(report);
    }

    return report;
  }

  // ── 各维度评分 ──────────────────────────────────────────────────

  private scoreStability(state: RuntimeState): DimensionScore {
    let score = 100;

    // 僵尸 Worker 扣分
    if (state.worker.zombie > 0) {
      score -= Math.min(40, state.worker.zombie * 8);
    }

    // 失败任务扣分
    if (state.dag.failed > 0) {
      score -= Math.min(30, state.dag.failed * 3);
    }
    if (state.queue.failed > 0) {
      score -= Math.min(20, state.queue.failed * 2);
    }

    // Agent 错误
    if (state.agent.errors > 0) {
      score -= Math.min(30, state.agent.errors * 5);
    }

    score = Math.max(0, score);

    return {
      dimension: 'stability',
      score,
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      details: `Workers: ${state.worker.active} active, ${state.worker.zombie} zombie; DAG failed: ${state.dag.failed}; Agent errors: ${state.agent.errors}`,
    };
  }

  private scoreMemory(): DimensionScore {
    const report = this.memoryManager.getPressure();
    const pressureMap: Record<MemoryPressureLevel, number> = {
      low:      100,
      medium:   70,
      high:     40,
      critical: 15,
    };

    const score = pressureMap[report.level] ?? 100;

    return {
      dimension: 'memory',
      score,
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      details: `Pressure: ${report.level}; Total: ${(report.usage.total / 1024 / 1024).toFixed(1)}MB; System available: ${(report.systemAvailable / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  private scoreGPU(state: RuntimeState): DimensionScore {
    let score = 100;

    // 温度过高扣分
    if (state.gpu.temperature > 85) {
      score -= 40;
    } else if (state.gpu.temperature > 75) {
      score -= 20;
    }

    // VRAM 利用率扣分
    const vramRatio = state.gpu.vramUsed / 24000; // 假设总 24GB
    if (vramRatio > 0.9) {
      score -= 30;
    } else if (vramRatio > 0.75) {
      score -= 15;
    }

    // 队列太长
    if (state.gpu.queueLength > 10) {
      score -= Math.min(20, state.gpu.queueLength * 2);
    }

    score = Math.max(0, score);

    return {
      dimension: 'gpu',
      score,
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      details: `Temp: ${state.gpu.temperature}°C; VRAM: ${(state.gpu.vramUsed / 1024).toFixed(1)}GB; Queue: ${state.gpu.queueLength}`,
    };
  }

  private scoreScheduler(state: RuntimeState): DimensionScore {
    let score = 100;

    // 队列堆积
    if (state.queue.pending > 50) {
      score -= 30;
    } else if (state.queue.pending > 20) {
      score -= 15;
    } else if (state.queue.pending > 10) {
      score -= 5;
    }

    // 无可用 Worker 但有 pending 任务
    if (state.queue.pending > 0 && state.worker.idle === 0 && state.worker.active === 0) {
      score -= 40;
    }

    // DAG 失败比例
    const dagTotal = state.dag.pending + state.dag.running + state.dag.completed + state.dag.failed;
    if (dagTotal > 0) {
      const failRatio = state.dag.failed / dagTotal;
      if (failRatio > 0.3) score -= 30;
      else if (failRatio > 0.1) score -= 15;
    }

    score = Math.max(0, score);

    return {
      dimension: 'scheduler',
      score,
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      details: `Queue: ${state.queue.pending}p/${state.queue.processing}proc; Workers: ${state.worker.idle} idle/${state.worker.active} active`,
    };
  }

  private scoreEventBus(): DimensionScore {
    // EventBus 健康评分暂用启发式（EventBus 状态暂不在 RuntimeState 中）
    // 实际集成时由 EventBus 上报心跳
    return {
      dimension: 'eventBus',
      score: 85,
      status: 'healthy',
      details: 'EventBus is operational (heuristic)',
    };
  }

  private scoreStateConsistency(state: RuntimeState): DimensionScore {
    const result = this.consistencyValidator.validate(state);

    const score = result.score;

    return {
      dimension: 'stateConsistency',
      score,
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      details: `Consistency check: ${result.passed ? 'passed' : 'failed'}; Violations: ${result.issues.length}`,
    };
  }

  // ── 建议生成 ────────────────────────────────────────────────────

  private generateRecommendations(dimensions: DimensionScore[], state: RuntimeState): string[] {
    const recs: string[] = [];

    for (const dim of dimensions) {
      if (dim.status === 'unhealthy') {
        switch (dim.dimension) {
          case 'stability':
            if (state.worker.zombie > 0) recs.push('运行 GarbageCollector.collectZombieWorkers() 清理僵尸 Worker');
            if (state.queue.failed > 0) recs.push('检查并处理失败队列任务');
            if (state.agent.errors > 0) recs.push('检查 Agent 执行错误日志');
            break;
          case 'memory':
            recs.push('运行 MemoryPressureController.autoReact("high") 或执行全量 GC');
            break;
          case 'gpu':
            if (state.gpu.temperature > 85) recs.push('GPU 温度过高，考虑降低渲染负载或检查散热');
            if (state.gpu.vramUsed > 20000) recs.push('VRAM 使用超过 20GB，建议释放部分 GPU 资源');
            break;
          case 'scheduler':
            if (state.queue.pending > 20) recs.push('队列堆积严重，建议扩容 Worker 或检查调度器');
            break;
          case 'eventBus':
            recs.push('检查 EventBus 连接状态');
            break;
          case 'stateConsistency':
            recs.push('运行状态一致性校验，手动修正状态冲突');
            break;
        }
      } else if (dim.status === 'degraded') {
        switch (dim.dimension) {
          case 'stability':
            recs.push('监控稳定性指标，准备故障恢复预案');
            break;
          case 'memory':
            recs.push('内存压力中等，建议在低峰期执行 GC');
            break;
          case 'gpu':
            recs.push('GPU 负载较高，监控温度与 VRAM 趋势');
            break;
          case 'scheduler':
            recs.push('调度器负载偏高，考虑增加 Worker 或优化任务');
            break;
          case 'stateConsistency':
            recs.push('检查状态一致性警告项');
            break;
        }
      }
    }

    return recs;
  }

  // ── 告警 ────────────────────────────────────────────────────────

  private triggerAlarm(report: HealthScoreReport): void {
    const now = Date.now();
    if (now - this.lastAlarmTime < this.config.alarmCooldown) return;

    this.lastAlarmTime = now;

    if (this.alarmCallback) {
      try {
        this.alarmCallback(report);
      } catch {
        // 回调异常静默处理
      }
    }
  }
}
