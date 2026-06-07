/**
 * GarbageCollector — 垃圾回收器
 *
 * 提供 5 种回收操作，支持按需调用或全量回收：
 *   - collectZombieWorkers()  — 清理僵尸 Worker
 *   - collectDeadQueues()     — 清理死队列
 *   - collectExpiredTraces()  — 清理过期 Trace
 *   - collectOldCaches()      — 清理旧 Cache
 *   - run()                   — 一键全量垃圾回收
 *
 * 与 RuntimeMemoryManager 配合使用：回收后自动更新内存用量。
 */

import type { MemoryType } from './runtime-memory-manager';
import { RuntimeMemoryManager } from './runtime-memory-manager';

// ── 类型定义 ──────────────────────────────────────────────────────

export interface GarbageCollectionReport {
  timestamp: number;
  phases: Array<{
    name: string;
    collected: number;     // 回收项目数
    freedBytes: number;    // 释放的字节数
    durationMs: number;
    success: boolean;
    error?: string;
  }>;
  totalFreed: number;
  durationMs: number;
}

// ── GarbageCollector ──────────────────────────────────────────────

export class GarbageCollector {
  private memoryManager: RuntimeMemoryManager;

  constructor() {
    this.memoryManager = RuntimeMemoryManager.getInstance();
  }

  // ── 各回收阶段 ──────────────────────────────────────────────────

  /**
   * 清理僵尸 Worker
   * 僵尸 Worker 定义为：已注册但超过 60s 无心跳的 Worker
   * 实际清理逻辑由 WorkerResourceManager 提供，此处模拟接口
   */
  async collectZombieWorkers(onCollect?: () => Promise<{ count: number; freed: number }>): Promise<{
    count: number;
    freed: number;
  }> {
    if (onCollect) {
      return onCollect();
    }
    // 默认无操作——实际集成时由 WorkerResourceManager 注册回调
    return { count: 0, freed: 0 };
  }

  /**
   * 清理死队列
   * 死队列定义为：已完成且被消费完但尚未清理的 DAG 队列
   */
  async collectDeadQueues(onCollect?: () => Promise<{ count: number; freed: number }>): Promise<{
    count: number;
    freed: number;
  }> {
    if (onCollect) {
      return onCollect();
    }
    return { count: 0, freed: 0 };
  }

  /**
   * 清理过期 Trace
   * 默认：超过 5 分钟的 Trace 数据视为过期
   */
  async collectExpiredTraces(
    maxAgeMs = 300_000,
    onCollect?: (maxAgeMs: number) => Promise<{ count: number; freed: number }>,
  ): Promise<{ count: number; freed: number }> {
    if (onCollect) {
      return onCollect(maxAgeMs);
    }
    return { count: 0, freed: 0 };
  }

  /**
   * 清理旧 Cache
   * 默认：超过 10 分钟的缓存视为陈旧
   */
  async collectOldCaches(
    maxAgeMs = 600_000,
    onCollect?: (maxAgeMs: number) => Promise<{ count: number; freed: number }>,
  ): Promise<{ count: number; freed: number }> {
    if (onCollect) {
      return onCollect(maxAgeMs);
    }
    return { count: 0, freed: 0 };
  }

  // ── 一键全量垃圾回收 ────────────────────────────────────────────

  /**
   * 按顺序执行全部 4 种回收操作
   * 回收后自动更新 RuntimeMemoryManager 中的对应内存计数
   */
  async run(options?: {
    traceMaxAge?: number;
    cacheMaxAge?: number;
    collectors?: {
      zombieWorkers?: () => Promise<{ count: number; freed: number }>;
      deadQueues?: () => Promise<{ count: number; freed: number }>;
      expiredTraces?: (maxAge: number) => Promise<{ count: number; freed: number }>;
      oldCaches?: (maxAge: number) => Promise<{ count: number; freed: number }>;
    };
  }): Promise<GarbageCollectionReport> {
    const startTime = Date.now();
    const phases: GarbageCollectionReport['phases'] = [];
    let totalFreed = 0;

    // 1. 僵尸 Worker
    {
      const phaseStart = Date.now();
      try {
        const result = await this.collectZombieWorkers(options?.collectors?.zombieWorkers);
        const duration = Date.now() - phaseStart;
        if (result.freed > 0) {
          this.memoryManager.release('worker', result.freed, 'gc:zombie-workers');
        }
        totalFreed += result.freed;
        phases.push({
          name: 'zombie-workers',
          collected: result.count,
          freedBytes: result.freed,
          durationMs: duration,
          success: true,
        });
      } catch (err) {
        phases.push({
          name: 'zombie-workers',
          collected: 0,
          freedBytes: 0,
          durationMs: Date.now() - phaseStart,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. 死队列
    {
      const phaseStart = Date.now();
      try {
        const result = await this.collectDeadQueues(options?.collectors?.deadQueues);
        const duration = Date.now() - phaseStart;
        if (result.freed > 0) {
          this.memoryManager.release('state', result.freed, 'gc:dead-queues');
        }
        totalFreed += result.freed;
        phases.push({
          name: 'dead-queues',
          collected: result.count,
          freedBytes: result.freed,
          durationMs: duration,
          success: true,
        });
      } catch (err) {
        phases.push({
          name: 'dead-queues',
          collected: 0,
          freedBytes: 0,
          durationMs: Date.now() - phaseStart,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3. 过期 Trace
    {
      const phaseStart = Date.now();
      try {
        const maxAge = options?.traceMaxAge ?? 300_000;
        const result = await this.collectExpiredTraces(maxAge, options?.collectors?.expiredTraces);
        const duration = Date.now() - phaseStart;
        if (result.freed > 0) {
          this.memoryManager.release('trace', result.freed, 'gc:expired-traces');
        }
        totalFreed += result.freed;
        phases.push({
          name: 'expired-traces',
          collected: result.count,
          freedBytes: result.freed,
          durationMs: duration,
          success: true,
        });
      } catch (err) {
        phases.push({
          name: 'expired-traces',
          collected: 0,
          freedBytes: 0,
          durationMs: Date.now() - phaseStart,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. 旧 Cache
    {
      const phaseStart = Date.now();
      try {
        const maxAge = options?.cacheMaxAge ?? 600_000;
        const result = await this.collectOldCaches(maxAge, options?.collectors?.oldCaches);
        const duration = Date.now() - phaseStart;
        if (result.freed > 0) {
          this.memoryManager.release('cache', result.freed, 'gc:old-caches');
        }
        totalFreed += result.freed;
        phases.push({
          name: 'old-caches',
          collected: result.count,
          freedBytes: result.freed,
          durationMs: duration,
          success: true,
        });
      } catch (err) {
        phases.push({
          name: 'old-caches',
          collected: 0,
          freedBytes: 0,
          durationMs: Date.now() - phaseStart,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      timestamp: startTime,
      phases,
      totalFreed,
      durationMs: totalDuration,
    };
  }
}
