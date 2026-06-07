/**
 * PriorityCoordinator — 优先级协调器
 *
 * 5 级优先级体系：
 *   SYSTEM_CRITICAL > INTERACTIVE > VIP > NORMAL > BACKGROUND
 *
 * 核心能力：
 * - getNextTask(queues) — 综合优先级 + 饥饿度打分选任务
 * - enqueue(task) — 入队
 * - 支持 aging（动态提升等待中的低优先级任务）
 */

import type { TaskInQueue, PriorityLevel, TaskType } from './kernel-scheduler';

export const PRIORITY_TIERS: PriorityLevel[] = [
  'SYSTEM_CRITICAL',
  'INTERACTIVE',
  'VIP',
  'NORMAL',
  'BACKGROUND',
];

export const PRIORITY_SCORE: Record<PriorityLevel, number> = {
  SYSTEM_CRITICAL: 100,
  INTERACTIVE:     80,
  VIP:             60,
  NORMAL:          40,
  BACKGROUND:      20,
};

export type Queues = Record<PriorityLevel, TaskInQueue[]>;

// ── PriorityCoordinator ───────────────────────────────────────────

export class PriorityCoordinator {
  /** 优先级队列表 */
  private queues: Queues = {
    SYSTEM_CRITICAL: [],
    INTERACTIVE: [],
    VIP: [],
    NORMAL: [],
    BACKGROUND: [],
  };

  /** 饥饿阈值（ms）：超过此时间则提升优先级 */
  private agingThreshold = 30_000; // 30s

  /** 饥饿提升等级步数 */
  private agingStep = 1;

  /** 统计 */
  private stats = {
    agingPromotions: 0,
    totalEnqueued: 0,
    totalDequeued: 0,
  };

  // ── 配置 ────────────────────────────────────────────────────────

  configure(options: { agingThreshold?: number; agingStep?: number }): void {
    if (options.agingThreshold !== undefined) this.agingThreshold = options.agingThreshold;
    if (options.agingStep !== undefined) this.agingStep = options.agingStep;
  }

  // ── 入队 ────────────────────────────────────────────────────────

  enqueue(task: TaskInQueue): void {
    this.queues[task.effectivePriority].push(task);
    this.stats.totalEnqueued++;
  }

  // ── 选下一个任务（综合打分） ────────────────────────────────────

  /**
   * 从所有队列中按综合分数选择下一个执行的任务。
   * 分数 = 基础优先级分 + 饥饿加分
   * 饥饿加分 = Math.min(waitingTime / agingThreshold, 1) * 30
   */
  getNextTask(): TaskInQueue | null {
    let bestTask: TaskInQueue | null = null;
    let bestScore = -1;

    for (const tier of PRIORITY_TIERS) {
      const queue = this.queues[tier];
      if (queue.length === 0) continue;
      const baseScore = PRIORITY_SCORE[tier];

      // 取队列头部（FIFO）
      const task = queue[0];

      // 饥饿加分
      const hungerBonus = Math.min(task.waitingTime / this.agingThreshold, 1) * 30;
      const totalScore = baseScore + hungerBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestTask = task;
      }
    }

    // 从对应队列移除
    if (bestTask) {
      const queue = this.queues[bestTask.effectivePriority];
      const idx = queue.findIndex(t => t.id === bestTask!.id);
      if (idx >= 0) {
        queue.splice(idx, 1);
        this.stats.totalDequeued++;
      }
    }

    return bestTask;
  }

  // ── 老化（Aging） ───────────────────────────────────────────────

  /**
   * 更新所有任务的 waitingTime，将超过阈值的任务提升一级优先级
   * 返回被提升的任务数
   */
  applyAging(): number {
    const now = Date.now();
    let promotions = 0;

    for (let tierIdx = PRIORITY_TIERS.length - 1; tierIdx >= 0; tierIdx--) {
      const tier = PRIORITY_TIERS[tierIdx];
      const queue = this.queues[tier];

      for (let i = queue.length - 1; i >= 0; i--) {
        const task = queue[i];
        task.waitingTime = now - task.enqueuedAt;

        // 超过饥饿阈值，提升一级
        if (task.waitingTime >= this.agingThreshold && tierIdx > 0) {
          const targetTierIdx = Math.max(0, tierIdx - this.agingStep);
          const targetTier = PRIORITY_TIERS[targetTierIdx];

          // 不能提升到 SYSTEM_CRITICAL（除非原本就是）
          if (targetTier !== task.effectivePriority) {
            task.effectivePriority = targetTier;
            this.queues[targetTier].push(task);
            queue.splice(i, 1);
            promotions++;
            this.stats.agingPromotions++;
          }
        }
      }
    }

    return promotions;
  }

  // ── 队列访问 ────────────────────────────────────────────────────

  getQueues(): Readonly<Queues> {
    return this.queues;
  }

  getQueueLength(): number {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }

  getQueueLengthByTier(): Record<PriorityLevel, number> {
    const result: Record<string, number> = {};
    for (const tier of PRIORITY_TIERS) {
      result[tier] = this.queues[tier].length;
    }
    return result as Record<PriorityLevel, number>;
  }

  // ── 统计 ────────────────────────────────────────────────────────

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  // ── 重置 ────────────────────────────────────────────────────────

  reset(): void {
    this.queues = {
      SYSTEM_CRITICAL: [],
      INTERACTIVE: [],
      VIP: [],
      NORMAL: [],
      BACKGROUND: [],
    };
    this.stats = {
      agingPromotions: 0,
      totalEnqueued: 0,
      totalDequeued: 0,
    };
  }
}
