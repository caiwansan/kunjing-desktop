/**
 * KernelScheduler — 核心调度器 (单例)
 *
 * 统一调度所有任务类型：
 *   worker | gpu | maintenance | evolution | background
 *
 * 内部维护优先级队列，按优先级 + 饥饿度消费
 * 支持：提交 / 取消 / 状态查询
 */

import type { KernelModuleId } from '../types';

// ── 任务类型 ──────────────────────────────────────────────────────

export type TaskType = 'worker' | 'gpu' | 'maintenance' | 'evolution' | 'background';

export type PriorityLevel = 'SYSTEM_CRITICAL' | 'INTERACTIVE' | 'VIP' | 'NORMAL' | 'BACKGROUND';

export const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  SYSTEM_CRITICAL: 5,
  INTERACTIVE:     4,
  VIP:             3,
  NORMAL:          2,
  BACKGROUND:      1,
};

export interface KernelTask {
  id: string;
  type: TaskType;
  priority: PriorityLevel;
  moduleId: KernelModuleId;
  execute: () => Promise<void>;
  timeout: number;        // ms
  retries: number;
  /** 可选标签用于日志 / 监控 */
  label?: string;
  /** 创建时间（自动设置） */
  createdAt?: number;
}

export interface TaskInQueue extends KernelTask {
  createdAt: number;
  /** 入队时间（用于饥饿度计算） */
  enqueuedAt: number;
  /** 当前已重试次数 */
  retryCount: number;
  /** 是否正在执行 */
  isRunning: boolean;
  /** 等待时间（毫秒）——由 StarvationPreventer 更新 */
  waitingTime: number;
  /** 当前实际优先级（可能因 aging 提升） */
  effectivePriority: PriorityLevel;
}

export interface SchedulerStatus {
  queueLength: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  tasksByType: Record<TaskType, number>;
  tasksByPriority: Record<PriorityLevel, number>;
  isPaused: boolean;
  uptime: number;
}

// ── KernelScheduler ───────────────────────────────────────────────

export class KernelScheduler {
  private static instance: KernelScheduler;

  /** 主优先级队列（按 effectivePriority 排序） */
  private queue: TaskInQueue[] = [];

  /** 正在运行的任务 */
  private runningTasks: Map<string, { task: TaskInQueue; startTime: number }> = new Map();

  /** 统计 */
  private stats = {
    completed: 0,
    failed: 0,
    cancelled: 0,
    startedAt: Date.now(),
  };

  private isPaused = false;

  /** 定时器引用 */
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;

  /** 调度间隔（默认 100ms） */
  private tickInterval = 100;

  /** 最大并行任务数 */
  private maxConcurrency = 8;

  private constructor() {
    // 私有构造
  }

  static getInstance(): KernelScheduler {
    if (!KernelScheduler.instance) {
      KernelScheduler.instance = new KernelScheduler();
    }
    return KernelScheduler.instance;
  }

  // ── 启动/停止 ───────────────────────────────────────────────────

  start(options?: { tickInterval?: number; maxConcurrency?: number }): void {
    if (this.schedulerTimer) return;

    if (options?.tickInterval) this.tickInterval = options.tickInterval;
    if (options?.maxConcurrency) this.maxConcurrency = options.maxConcurrency;

    this.schedulerTimer = setInterval(() => this.tick(), this.tickInterval);
  }

  stop(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  // ── 核心操作 ────────────────────────────────────────────────────

  schedule(task: KernelTask): void {
    if (!task.createdAt) task.createdAt = Date.now();

    const queueTask: TaskInQueue = {
      ...task,
      createdAt: task.createdAt,
      enqueuedAt: Date.now(),
      retryCount: 0,
      isRunning: false,
      waitingTime: 0,
      effectivePriority: task.priority,
    };

    this.queue.push(queueTask);
    // 按优先级排序（高优先级在前，同级按 FIFO）
    this.sortQueue();
  }

  cancel(taskId: string): boolean {
    // 从队列移除
    const queueIdx = this.queue.findIndex(t => t.id === taskId);
    if (queueIdx >= 0) {
      this.queue.splice(queueIdx, 1);
      this.stats.cancelled++;
      return true;
    }

    // 从运行中移除（立即中止）
    const running = this.runningTasks.get(taskId);
    if (running) {
      this.runningTasks.delete(taskId);
      this.stats.cancelled++;
      return true;
    }

    return false;
  }

  getStatus(): SchedulerStatus {
    const tasksByType: Record<TaskType, number> = {
      worker: 0, gpu: 0, maintenance: 0, evolution: 0, background: 0,
    };
    const tasksByPriority: Record<PriorityLevel, number> = {
      SYSTEM_CRITICAL: 0, INTERACTIVE: 0, VIP: 0, NORMAL: 0, BACKGROUND: 0,
    };

    for (const t of this.queue) {
      tasksByType[t.type] = (tasksByType[t.type] || 0) + 1;
      tasksByPriority[t.effectivePriority] = (tasksByPriority[t.effectivePriority] || 0) + 1;
    }
    for (const [, entry] of this.runningTasks) {
      tasksByType[entry.task.type] = (tasksByType[entry.task.type] || 0) + 1;
      tasksByPriority[entry.task.effectivePriority] = (tasksByPriority[entry.task.effectivePriority] || 0) + 1;
    }

    return {
      queueLength: this.queue.length,
      running: this.runningTasks.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      cancelled: this.stats.cancelled,
      tasksByType,
      tasksByPriority,
      isPaused: this.isPaused,
      uptime: Date.now() - this.stats.startedAt,
    };
  }

  getQueue(): readonly TaskInQueue[] {
    return this.queue;
  }

  getRunningTasks(): ReadonlyMap<string, { task: TaskInQueue; startTime: number }> {
    return this.runningTasks;
  }

  // ── 内部调度循环 ────────────────────────────────────────────────

  private tick(): void {
    if (this.isPaused) return;

    // 检查超时任务
    this.checkTimeouts();

    // 消费尽可能多的任务
    while (this.runningTasks.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.executeTask(task);
    }
  }

  private async executeTask(task: TaskInQueue): Promise<void> {
    task.isRunning = true;
    this.runningTasks.set(task.id, { task, startTime: Date.now() });

    try {
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Task ${task.id} timed out after ${task.timeout}ms`)), task.timeout),
      );

      await Promise.race([task.execute(), timeoutPromise]);

      this.runningTasks.delete(task.id);
      this.stats.completed++;
    } catch (err) {
      this.runningTasks.delete(task.id);

      if (task.retryCount < task.retries) {
        task.retryCount++;
        task.enqueuedAt = Date.now();
        task.isRunning = false;
        task.waitingTime = 0;
        this.queue.push(task);
        this.sortQueue();
      } else {
        this.stats.failed++;
      }
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();
    const maxRunTime = Math.max(...this.queue.filter(t => t.timeout).map(t => t.timeout), 5000);

    for (const [id, entry] of this.runningTasks.entries()) {
      const elapsed = now - entry.startTime;
      if (elapsed > entry.task.timeout) {
        this.runningTasks.delete(id);
        const task = entry.task;
        if (task.retryCount < task.retries) {
          task.retryCount++;
          task.enqueuedAt = Date.now();
          task.isRunning = false;
          task.waitingTime = 0;
          this.queue.push(task);
          this.sortQueue();
        } else {
          this.stats.failed++;
        }
      }
    }
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.effectivePriority] || 0;
      const pb = PRIORITY_ORDER[b.effectivePriority] || 0;
      if (pa !== pb) return pb - pa;
      // 同优先级按入队时间
      return a.enqueuedAt - b.enqueuedAt;
    });
  }
}
