/**
 * WorkerResourceManager — Worker 资源管理器 (单例)
 *
 * 职责：
 * - registerWorker(worker)     — 注册 Worker
 * - unregisterWorker(workerId) — 注销 Worker
 * - getAvailable()             — 获取可用 Worker
 * - healthCheck()              — 心跳检测，标记僵尸 Worker
 */

// ── Worker 状态 ───────────────────────────────────────────────────

export type WorkerStatus = 'active' | 'idle' | 'zombie' | 'busy';

export interface WorkerInfo {
  id: string;
  name?: string;
  status: WorkerStatus;
  /** 注册时间戳 */
  registeredAt: number;
  /** 最后心跳时间戳 */
  lastHeartbeat: number;
  /** 正在处理的任务 ID（如果有） */
  currentTaskId?: string;
  /** Worker 元数据 */
  metadata?: Record<string, unknown>;
}

export interface WorkerHealthReport {
  timestamp: number;
  totalWorkers: number;
  active: number;
  idle: number;
  busy: number;
  zombie: number;
  zombieIds: string[];
  /** 从 zombie 恢复的 Worker 数 */
  recovered: number;
}

// ── WorkerResourceManager ─────────────────────────────────────────

export class WorkerResourceManager {
  private static instance: WorkerResourceManager;

  /** Worker 注册表 */
  private workers: Map<string, WorkerInfo> = new Map();

  /** 心跳超时阈值（ms），超过此时间无心跳则标记为 zombie */
  private heartbeatTimeout = 60_000; // 60s

  /** 每次 healthCheck 最多恢复的 zombie 上限 */
  private maxRecoverPerCheck = 5;

  private constructor() {}

  static getInstance(): WorkerResourceManager {
    if (!WorkerResourceManager.instance) {
      WorkerResourceManager.instance = new WorkerResourceManager();
    }
    return WorkerResourceManager.instance;
  }

  // ── 配置 ────────────────────────────────────────────────────────

  configure(options: { heartbeatTimeout?: number; maxRecoverPerCheck?: number }): void {
    if (options.heartbeatTimeout !== undefined) this.heartbeatTimeout = options.heartbeatTimeout;
    if (options.maxRecoverPerCheck !== undefined) this.maxRecoverPerCheck = options.maxRecoverPerCheck;
  }

  // ── 注册 ────────────────────────────────────────────────────────

  registerWorker(worker: Omit<WorkerInfo, 'registeredAt' | 'lastHeartbeat'>): WorkerInfo {
    const now = Date.now();
    const info: WorkerInfo = {
      ...worker,
      registeredAt: now,
      lastHeartbeat: now,
    };

    this.workers.set(worker.id, info);

    // 同步更新 GlobalRuntimeState
    this.syncWorkerCounts();

    return info;
  }

  // ── 注销 ────────────────────────────────────────────────────────

  unregisterWorker(workerId: string): boolean {
    const existed = this.workers.delete(workerId);
    if (existed) {
      this.syncWorkerCounts();
    }
    return existed;
  }

  // ── 获取可用 Worker ─────────────────────────────────────────────

  /**
   * 返回当前 idle 的 Worker 列表
   * 可选按条件过滤
   */
  getAvailable(): WorkerInfo[] {
    return Array.from(this.workers.values()).filter(w => w.status === 'idle');
  }

  /**
   * 获取下一个可用的 idle Worker，并自动标记为 busy
   * 如果没有可用 Worker，返回 null
   */
  acquireAvailable(taskId?: string): WorkerInfo | null {
    for (const [, worker] of this.workers) {
      if (worker.status === 'idle') {
        worker.status = 'busy';
        worker.currentTaskId = taskId;
        this.syncWorkerCounts();
        return worker;
      }
    }
    return null;
  }

  /**
   * 释放 Worker（完成任务后调用）
   */
  releaseWorker(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) return false;

    worker.status = 'idle';
    worker.currentTaskId = undefined;
    worker.lastHeartbeat = Date.now();
    this.syncWorkerCounts();
    return true;
  }

  // ── 心跳检测 ────────────────────────────────────────────────────

  /**
   * 遍历所有 Worker，检查心跳超时
   * - 超时 → 标记为 zombie
   * - 之前是 zombie 但最近有心跳 → 恢复为 idle
   */
  healthCheck(): WorkerHealthReport {
    const now = Date.now();
    let active = 0, idle = 0, busy = 0, zombie = 0;
    const zombieIds: string[] = [];
    let recovered = 0;

    for (const [, worker] of this.workers) {
      const elapsed = now - worker.lastHeartbeat;

      if (elapsed > this.heartbeatTimeout) {
        // 心跳超时
        if (worker.status !== 'zombie') {
          worker.status = 'zombie';
        }
      } else if (worker.status === 'zombie') {
        // 从 zombie 恢复
        worker.status = 'idle';
        worker.currentTaskId = undefined;
        recovered++;
      }

      // 计数
      switch (worker.status) {
        case 'active': active++; break;
        case 'idle':   idle++; break;
        case 'busy':   busy++; break;
        case 'zombie': zombie++; zombieIds.push(worker.id); break;
      }
    }

    this.syncWorkerCounts();

    return {
      timestamp: now,
      totalWorkers: this.workers.size,
      active,
      idle,
      busy,
      zombie,
      zombieIds,
      recovered,
    };
  }

  // ── 信息查询 ────────────────────────────────────────────────────

  getWorker(id: string): WorkerInfo | undefined {
    return this.workers.get(id);
  }

  getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  getWorkerCounts(): { active: number; idle: number; zombie: number; busy: number; total: number } {
    let active = 0, idle = 0, zombie = 0, busy = 0;
    for (const [, w] of this.workers) {
      switch (w.status) {
        case 'active': active++; break;
        case 'idle':   idle++; break;
        case 'zombie': zombie++; break;
        case 'busy':   busy++; break;
      }
    }
    return { active, idle, zombie, busy, total: this.workers.size };
  }

  // ── 重置 ────────────────────────────────────────────────────────

  reset(): void {
    this.workers.clear();
    this.syncWorkerCounts();
  }

  // ── 状态同步 ────────────────────────────────────────────────────

  /**
   * 将 Worker 计数值同步到 GlobalRuntimeState
   * 延迟导入避免循环依赖
   */
  private syncWorkerCounts(): void {
    try {
      // 动态导入 — 运行时获取 singleton
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GlobalRuntimeState } = require('../state-tree/global-runtime-state') as typeof import('../state-tree/global-runtime-state');
      const state = GlobalRuntimeState.getInstance();
      const counts = this.getWorkerCounts();
      state.update('worker.active', counts.active + counts.busy);
      state.update('worker.idle', counts.idle);
      state.update('worker.zombie', counts.zombie);
      state.update('worker.total', counts.total);
    } catch {
      // GlobalRuntimeState 可能尚未初始化，静默忽略
    }
  }
}
