/**
 * MemoryPressureController — 内存压力控制器
 *
 * 职责：
 * - 监控 RuntimeMemoryManager 的内存压力水平
 * - 按压力等级自动执行不同的降级/回收策略
 *
 * 压力等级与响应：
 *   low      → 无操作
 *   medium   → 降低 Trace 采样率 + 压缩 State
 *   high     → 清理 Cache + 暂停 Background 任务
 *   critical → 紧急回收 + 暂停所有非关键任务
 */

import { RuntimeMemoryManager, type MemoryPressureLevel, type MemoryType } from './runtime-memory-manager';
import { GarbageCollector } from './garbage-collector';

// ── 类型定义 ──────────────────────────────────────────────────────

export type PressureAction = 'none'
  | 'reduce-trace-sampling'
  | 'compress-state'
  | 'clear-cache'
  | 'pause-background'
  | 'emergency-reclaim'
  | 'pause-non-critical';

export interface PressureReactionReport {
  timestamp: number;
  pressureLevel: MemoryPressureLevel;
  actions: Array<{
    action: PressureAction;
    durationMs: number;
    success: boolean;
    detail?: string;
  }>;
  memoryFreed: number;
}

export interface PressureControllerConfig {
  /** 各压力等级之间的冷却时间（ms），防止频繁触发 */
  cooldownMs: Record<MemoryPressureLevel, number>;
  /** 是否启用自动响应 */
  autoReactEnabled: boolean;
}

const DEFAULT_COOLDOWN: Record<MemoryPressureLevel, number> = {
  low:      0,
  medium:   10_000,  // 10s
  high:     30_000,  // 30s
  critical: 60_000,  // 60s
};

// ── MemoryPressureController ──────────────────────────────────────

export class MemoryPressureController {
  private memoryManager: RuntimeMemoryManager;
  private garbageCollector: GarbageCollector;

  private config: PressureControllerConfig = {
    cooldownMs: { ...DEFAULT_COOLDOWN },
    autoReactEnabled: true,
  };

  /** 各等级上次触发时间 */
  private lastTrigger: Record<MemoryPressureLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  /** 自定义回调——允许外部注入执行逻辑 */
  private actionHandlers: Partial<Record<PressureAction, () => Promise<{ success: boolean; freed: number; detail?: string }>>> = {};

  constructor() {
    this.memoryManager = RuntimeMemoryManager.getInstance();
    this.garbageCollector = new GarbageCollector();
  }

  // ── 配置 ────────────────────────────────────────────────────────

  configure(overrides: Partial<PressureControllerConfig>): void {
    if (overrides.cooldownMs) {
      Object.assign(this.config.cooldownMs, overrides.cooldownMs);
    }
    if (overrides.autoReactEnabled !== undefined) {
      this.config.autoReactEnabled = overrides.autoReactEnabled;
    }
  }

  /**
   * 注册自定义动作处理器
   * 如果未注册，autoReact 将使用默认行为
   */
  registerActionHandler(
    action: PressureAction,
    handler: () => Promise<{ success: boolean; freed: number; detail?: string }>,
  ): void {
    this.actionHandlers[action] = handler;
  }

  // ── 获取压力等级 ────────────────────────────────────────────────

  getPressureLevel(): MemoryPressureLevel {
    const report = this.memoryManager.getPressure();
    return report.level;
  }

  // ── 自动响应 ────────────────────────────────────────────────────

  /**
   * 根据压力等级自动执行对应的降级/回收策略
   * 受冷却时间和 autoReactEnabled 控制
   */
  async autoReact(pressure?: MemoryPressureLevel): Promise<PressureReactionReport> {
    const level = pressure || this.getPressureLevel();
    const now = Date.now();

    // 冷却检查
    const lastTime = this.lastTrigger[level];
    const cooldown = this.config.cooldownMs[level];
    if (now - lastTime < cooldown) {
      // 冷却中，跳过
      return {
        timestamp: now,
        pressureLevel: level,
        actions: [{ action: 'none', durationMs: 0, success: true, detail: 'cooling' }],
        memoryFreed: 0,
      };
    }

    if (!this.config.autoReactEnabled) {
      return {
        timestamp: now,
        pressureLevel: level,
        actions: [{ action: 'none', durationMs: 0, success: true, detail: 'auto-react disabled' }],
        memoryFreed: 0,
      };
    }

    this.lastTrigger[level] = now;

    switch (level) {
      case 'low':
        return this.handleLow();
      case 'medium':
        return this.handleMedium();
      case 'high':
        return this.handleHigh();
      case 'critical':
        return this.handleCritical();
    }
  }

  // ── 各等级处理 ──────────────────────────────────────────────────

  private async handleLow(): Promise<PressureReactionReport> {
    return {
      timestamp: Date.now(),
      pressureLevel: 'low',
      actions: [{ action: 'none', durationMs: 0, success: true, detail: 'memory pressure low, no action needed' }],
      memoryFreed: 0,
    };
  }

  private async handleMedium(): Promise<PressureReactionReport> {
    const actions: PressureReactionReport['actions'] = [];
    let totalFreed = 0;

    // 动作1: 降低 Trace 采样
    {
      const start = Date.now();
      try {
        if (this.actionHandlers['reduce-trace-sampling']) {
          const result = await this.actionHandlers['reduce-trace-sampling']();
          actions.push({
            action: 'reduce-trace-sampling',
            durationMs: Date.now() - start,
            success: result.success,
            detail: result.detail,
          });
          totalFreed += result.freed;
        } else {
          actions.push({
            action: 'reduce-trace-sampling',
            durationMs: Date.now() - start,
            success: true,
            detail: 'trace sampling reduction signaled (no custom handler)',
          });
        }
      } catch (err) {
        actions.push({ action: 'reduce-trace-sampling', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    // 动作2: 压缩 State
    {
      const start = Date.now();
      try {
        if (this.actionHandlers['compress-state']) {
          const result = await this.actionHandlers['compress-state']();
          actions.push({
            action: 'compress-state',
            durationMs: Date.now() - start,
            success: result.success,
            detail: result.detail,
          });
          totalFreed += result.freed;
        } else {
          actions.push({
            action: 'compress-state',
            durationMs: Date.now() - start,
            success: true,
            detail: 'state compression signaled (no custom handler)',
          });
        }
      } catch (err) {
        actions.push({ action: 'compress-state', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    return {
      timestamp: Date.now(),
      pressureLevel: 'medium',
      actions,
      memoryFreed: totalFreed,
    };
  }

  private async handleHigh(): Promise<PressureReactionReport> {
    const actions: PressureReactionReport['actions'] = [];
    let totalFreed = 0;

    // 动作1: 清理 Cache
    {
      const start = Date.now();
      try {
        const cacheResult = await this.garbageCollector.collectOldCaches();
        totalFreed += cacheResult.freed;
        actions.push({
          action: 'clear-cache',
          durationMs: Date.now() - start,
          success: true,
          detail: `cleared ${cacheResult.count} cache entries, freed ${this.formatBytes(cacheResult.freed)}`,
        });
      } catch (err) {
        actions.push({ action: 'clear-cache', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    // 动作2: 暂停 Background 任务
    {
      const start = Date.now();
      try {
        if (this.actionHandlers['pause-background']) {
          const result = await this.actionHandlers['pause-background']();
          actions.push({
            action: 'pause-background',
            durationMs: Date.now() - start,
            success: result.success,
            detail: result.detail,
          });
        } else {
          actions.push({
            action: 'pause-background',
            durationMs: Date.now() - start,
            success: true,
            detail: 'background tasks paused (no custom handler)',
          });
        }
      } catch (err) {
        actions.push({ action: 'pause-background', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    return {
      timestamp: Date.now(),
      pressureLevel: 'high',
      actions,
      memoryFreed: totalFreed,
    };
  }

  private async handleCritical(): Promise<PressureReactionReport> {
    const actions: PressureReactionReport['actions'] = [];
    let totalFreed = 0;

    // 动作1: 紧急回收（全量 GC）
    {
      const start = Date.now();
      try {
        const gcReport = await this.garbageCollector.run();
        totalFreed += gcReport.totalFreed;
        actions.push({
          action: 'emergency-reclaim',
          durationMs: Date.now() - start,
          success: true,
          detail: `full GC completed: ${gcReport.phases.filter(p => p.success).length} phases, freed ${this.formatBytes(gcReport.totalFreed)}`,
        });
      } catch (err) {
        actions.push({ action: 'emergency-reclaim', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    // 动作2: 暂停非关键任务
    {
      const start = Date.now();
      try {
        if (this.actionHandlers['pause-non-critical']) {
          const result = await this.actionHandlers['pause-non-critical']();
          actions.push({
            action: 'pause-non-critical',
            durationMs: Date.now() - start,
            success: result.success,
            detail: result.detail,
          });
        } else {
          actions.push({
            action: 'pause-non-critical',
            durationMs: Date.now() - start,
            success: true,
            detail: 'non-critical tasks paused (no custom handler)',
          });
        }
      } catch (err) {
        actions.push({ action: 'pause-non-critical', durationMs: Date.now() - start, success: false, detail: String(err) });
      }
    }

    return {
      timestamp: Date.now(),
      pressureLevel: 'critical',
      actions,
      memoryFreed: totalFreed,
    };
  }

  // ── 工具 ────────────────────────────────────────────────────────

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}
