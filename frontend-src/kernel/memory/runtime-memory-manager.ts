/**
 * RuntimeMemoryManager — 运行时内存管理器 (单例)
 *
 * 统一管理五类内存：
 *   Cache         → 缓存结果 / 中间数据
 *   Trace         → 运行时追踪数据
 *   State         → DAG / 队列状态
 *   GPU Buffer    → GPU 显存映射
 *   Worker Memory → Worker 进程内存
 *
 * 提供：内存用量查询 / 分配记录 / 释放 / 压力评估
 */

// ── 类型定义 ──────────────────────────────────────────────────────

export type MemoryType = 'cache' | 'trace' | 'state' | 'gpu' | 'worker';

export interface MemoryUsage {
  cache: number;       // bytes
  trace: number;
  state: number;
  gpu: number;
  worker: number;
  total: number;
}

export interface MemoryAllocation {
  type: MemoryType;
  size: number;
  timestamp: number;
  label?: string;
}

export interface MemoryPressureReport {
  level: MemoryPressureLevel;
  usage: MemoryUsage;
  /** 各类型占比（0~1） */
  ratios: Record<MemoryType, number>;
  /** 系统可用内存预估（bytes，仅参考） */
  systemAvailable: number;
}

export type MemoryPressureLevel = 'low' | 'medium' | 'high' | 'critical';

/** 内存上限（bytes）——按类型 */
const DEFAULT_LIMITS: Record<MemoryType, number> = {
  cache:  512 * 1024 * 1024,   // 512 MB
  trace:  256 * 1024 * 1024,   // 256 MB
  state:  128 * 1024 * 1024,   // 128 MB
  gpu:    2048 * 1024 * 1024,  // 2 GB
  worker: 1024 * 1024 * 1024,  // 1 GB
};

/** 压力阈值（占总上限的百分比） */
const PRESSURE_THRESHOLDS = {
  medium:  0.5,   // 50%
  high:    0.75,  // 75%
  critical: 0.9,  // 90%
};

// ── RuntimeMemoryManager ──────────────────────────────────────────

export class RuntimeMemoryManager {
  private static instance: RuntimeMemoryManager;

  /** 各类内存当前用量 */
  private usage: Record<MemoryType, number> = {
    cache: 0,
    trace: 0,
    state: 0,
    gpu: 0,
    worker: 0,
  };

  /** 各类型上限 */
  private limits: Record<MemoryType, number> = { ...DEFAULT_LIMITS };

  /** 分配记录（环形缓冲区，保留最近 1000 条） */
  private allocations: MemoryAllocation[] = [];
  private readonly maxRecords = 1000;

  private constructor() {}

  static getInstance(): RuntimeMemoryManager {
    if (!RuntimeMemoryManager.instance) {
      RuntimeMemoryManager.instance = new RuntimeMemoryManager();
    }
    return RuntimeMemoryManager.instance;
  }

  // ── 设置上限 ────────────────────────────────────────────────────

  setLimit(type: MemoryType, bytes: number): void {
    this.limits[type] = bytes;
  }

  // ── 内存用量 ────────────────────────────────────────────────────

  getMemoryUsage(): MemoryUsage {
    const total = Object.values(this.usage).reduce((sum, v) => sum + v, 0);
    return {
      cache:  this.usage.cache,
      trace:  this.usage.trace,
      state:  this.usage.state,
      gpu:    this.usage.gpu,
      worker: this.usage.worker,
      total,
    };
  }

  // ── 分配记录 ────────────────────────────────────────────────────

  recordAllocation(type: MemoryType, size: number, label?: string): boolean {
    // 检查是否超过上限
    const newUsage = this.usage[type] + size;
    if (newUsage > this.limits[type]) {
      return false;
    }

    this.usage[type] = newUsage;

    this.allocations.push({ type, size, timestamp: Date.now(), label });
    if (this.allocations.length > this.maxRecords) {
      this.allocations.shift();
    }

    return true;
  }

  // ── 释放 ────────────────────────────────────────────────────────

  release(type: MemoryType, size: number, label?: string): void {
    this.usage[type] = Math.max(0, this.usage[type] - size);

    this.allocations.push({ type, size: -size, timestamp: Date.now(), label });
    if (this.allocations.length > this.maxRecords) {
      this.allocations.shift();
    }
  }

  // ── 压力评估 ────────────────────────────────────────────────────

  /**
   * 基于总量占比计算内存压力等级
   * 同时返回各类型相对自身上限的比率
   */
  getPressure(): MemoryPressureReport {
    const usage = this.getMemoryUsage();
    const totalLimit = Object.values(this.limits).reduce((s, v) => s + v, 0);
    const totalRatio = totalLimit > 0 ? usage.total / totalLimit : 0;

    let level: MemoryPressureLevel = 'low';
    if (totalRatio >= PRESSURE_THRESHOLDS.critical) {
      level = 'critical';
    } else if (totalRatio >= PRESSURE_THRESHOLDS.high) {
      level = 'high';
    } else if (totalRatio >= PRESSURE_THRESHOLDS.medium) {
      level = 'medium';
    }

    const ratios: Record<MemoryType, number> = {
      cache:  this.limits.cache  > 0 ? this.usage.cache  / this.limits.cache  : 0,
      trace:  this.limits.trace  > 0 ? this.usage.trace  / this.limits.trace  : 0,
      state:  this.limits.state  > 0 ? this.usage.state  / this.limits.state  : 0,
      gpu:    this.limits.gpu    > 0 ? this.usage.gpu    / this.limits.gpu    : 0,
      worker: this.limits.worker > 0 ? this.usage.worker / this.limits.worker : 0,
    };

    return {
      level,
      usage,
      ratios,
      systemAvailable: Math.max(0, totalLimit - usage.total),
    };
  }

  // ── 获取分配历史 ────────────────────────────────────────────────

  getAllocationHistory(): readonly MemoryAllocation[] {
    return this.allocations;
  }

  // ── 获取当前各类型限制 ──────────────────────────────────────────

  getLimits(): Record<MemoryType, number> {
    return { ...this.limits };
  }

  // ── 重置 ────────────────────────────────────────────────────────

  reset(): void {
    this.usage = { cache: 0, trace: 0, state: 0, gpu: 0, worker: 0 };
    this.allocations = [];
    this.limits = { ...DEFAULT_LIMITS };
  }
}
