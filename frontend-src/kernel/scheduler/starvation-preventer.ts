/**
 * StarvationPreventer — 饥饿预防器
 *
 * 职责：
 * - 维护每个任务的 waitingTime
 * - 每轮调度检查，等待超过阈值的任务自动提升优先级
 * - 输出饥饿统计
 *
 * 与 PriorityCoordinator 配合使用（可选组合），也可独立作为调度器的饥饿监控层。
 */

import type { TaskInQueue, PriorityLevel, PRIORITY_ORDER } from './kernel-scheduler';

// ── 常量 ──────────────────────────────────────────────────────────

const PRIORITY_LEVELS: PriorityLevel[] = [
  'SYSTEM_CRITICAL',
  'INTERACTIVE',
  'VIP',
  'NORMAL',
  'BACKGROUND',
];

export interface StarvationConfig {
  /** 饥饿阈值（ms）——超过此时间尚未执行则认为饥饿 */
  threshold: number;
  /** 提升步数（默认升一级） */
  step: number;
  /** 最大可提升到的优先级（不应提升到 SYSTEM_CRITICAL） */
  maxLevel: PriorityLevel;
  /** 是否启用自动饥饿预防 */
  enabled: boolean;
}

export interface AgingStats {
  totalTasks: number;
  starvingTasks: number;
  averageWaitingTime: number;
  maxWaitingTime: number;
  promotionsApplied: number;
  byPriority: Record<PriorityLevel, { count: number; avgWait: number }>;
}

// ── StarvationPreventer ───────────────────────────────────────────

export class StarvationPreventer {
  private config: StarvationConfig = {
    threshold: 30_000,     // 30s
    step: 1,
    maxLevel: 'VIP',       // 最多提升到 VIP
    enabled: true,
  };

  /** 历史的总提升次数 */
  private totalPromotions = 0;

  /** 上一次扫描时的饥饿任务数 */
  private lastStarvingCount = 0;

  // ── 配置 ────────────────────────────────────────────────────────

  configure(overrides: Partial<StarvationConfig>): void {
    Object.assign(this.config, overrides);
  }

  // ── 核心：预防饥饿 ──────────────────────────────────────────────

  /**
   * 扫描队列中的任务，对等待超过阈值的任务进行优先级提升
   * 返回被提升的任务数
   */
  preventStarvation(queues: Map<PriorityLevel, TaskInQueue[]> | Record<PriorityLevel, TaskInQueue[]>): number {
    if (!this.config.enabled) return 0;

    const now = Date.now();
    let promotions = 0;

    // 统一为 Map 格式以便遍历
    const queueMap = this.normalizeQueues(queues);

    for (const [tier, tasks] of queueMap.entries()) {
      const tierIdx = PRIORITY_LEVELS.indexOf(tier);
      if (tierIdx < 0) continue;

      for (let i = tasks.length - 1; i >= 0; i--) {
        const task = tasks[i];
        task.waitingTime = now - task.enqueuedAt;

        if (task.waitingTime >= this.config.threshold && tierIdx > 0) {
          const targetTierIdx = Math.max(
            0,
            tierIdx - this.config.step,
            PRIORITY_LEVELS.indexOf(this.config.maxLevel),
          );
          const targetTier = PRIORITY_LEVELS[targetTierIdx];

          if (targetTier !== task.effectivePriority) {
            task.effectivePriority = targetTier;
            // 注意：此处不移动队列元素，由调用方负责（PriorityCoordinator 或 Scheduler）
            promotions++;
          }
        }
      }
    }

    this.totalPromotions += promotions;
    return promotions;
  }

  // ── 饥饿统计 ────────────────────────────────────────────────────

  /**
   * 输出当前所有队列中任务的饥饿度统计
   */
  getAgingStats(
    queues: Map<PriorityLevel, TaskInQueue[]> | Record<PriorityLevel, TaskInQueue[]>,
  ): AgingStats {
    const queueMap = this.normalizeQueues(queues);
    const now = Date.now();

    let totalTasks = 0;
    let totalWait = 0;
    let maxWait = 0;
    let starvingCount = 0;

    const byPriority: AgingStats['byPriority'] = {
      SYSTEM_CRITICAL: { count: 0, avgWait: 0 },
      INTERACTIVE:     { count: 0, avgWait: 0 },
      VIP:             { count: 0, avgWait: 0 },
      NORMAL:          { count: 0, avgWait: 0 },
      BACKGROUND:      { count: 0, avgWait: 0 },
    };

    for (const [tier, tasks] of queueMap.entries()) {
      if (!byPriority[tier]) continue;

      for (const task of tasks) {
        const wait = now - task.enqueuedAt;
        task.waitingTime = wait;

        totalTasks++;
        totalWait += wait;
        maxWait = Math.max(maxWait, wait);
        byPriority[tier].count++;
        byPriority[tier].avgWait += wait;

        if (wait >= this.config.threshold) starvingCount++;
      }
    }

    // 计算平均等待时间
    for (const tier of Object.keys(byPriority) as PriorityLevel[]) {
      if (byPriority[tier].count > 0) {
        byPriority[tier].avgWait = Math.round(byPriority[tier].avgWait / byPriority[tier].count);
      }
    }

    this.lastStarvingCount = starvingCount;

    return {
      totalTasks,
      starvingTasks: starvingCount,
      averageWaitingTime: totalTasks > 0 ? Math.round(totalWait / totalTasks) : 0,
      maxWaitingTime: maxWait,
      promotionsApplied: this.totalPromotions,
      byPriority,
    };
  }

  // ── 工具 ────────────────────────────────────────────────────────

  private normalizeQueues(
    queues: Map<PriorityLevel, TaskInQueue[]> | Record<PriorityLevel, TaskInQueue[]>,
  ): Map<PriorityLevel, TaskInQueue[]> {
    if (queues instanceof Map) return queues;

    const map = new Map<PriorityLevel, TaskInQueue[]>();
    for (const key of Object.keys(queues) as PriorityLevel[]) {
      map.set(key, queues[key]);
    }
    return map;
  }
}
