/**
 * GPUResourceManager — GPU 资源管理器 (单例)
 *
 * 职责：
 * - allocate(request)  — 分配 GPU 资源（VRAM / 队列），返回 sessionId
 * - release(sessionId) — 释放资源
 * - getUtilization()   — GPU 利用率报告
 * - preventLeak()      — 检测并回收泄漏资源（超时未释放自动回收）
 */

// ── 类型定义 ──────────────────────────────────────────────────────

export interface GPUAllocateRequest {
  /** 请求的 VRAM 大小（MB） */
  vramMB: number;
  /** 请求占用的队列槽位数 */
  queueSlots: number;
  /** 允许的最大等待时间（ms），超时则分配失败 */
  timeout?: number;
  /** 请求方标识 */
  requester: string;
  /** 任务标签 */
  label?: string;
}

export interface GPUAllocation {
  sessionId: string;
  vramMB: number;
  queueSlots: number;
  requester: string;
  label?: string;
  allocatedAt: number;
  /** 预期的持有时长（ms），用于 leak 检测 */
  ttl?: number;
}

export interface GPUUtilization {
  /** 已分配的 VRAM 总计（MB） */
  allocatedVRAM: number;
  /** 总 VRAM */
  totalVRAM: number;
  /** VRAM 利用率 (0~1) */
  vramUtilization: number;
  /** 已占用的队列槽位数 */
  allocatedQueueSlots: number;
  /** 总队列槽位数 */
  totalQueueSlots: number;
  /** 队列利用率 (0~1) */
  queueUtilization: number;
  /** 当前活跃的分配会话数 */
  activeSessions: number;
  /** 疑似泄漏的会话数 */
  leakedSessions: number;
}

// ── GPUResourceManager ────────────────────────────────────────────

export class GPUResourceManager {
  private static instance: GPUResourceManager;

  /** 硬件总资源 */
  private totalVRAM = 24576;       // 24 GB (MB)
  private totalQueueSlots = 8;     // 8 个队列槽位

  /** 当前已分配 */
  private allocatedVRAM = 0;
  private allocatedQueueSlots = 0;

  /** 活跃分配会话 */
  private allocations: Map<string, GPUAllocation> = new Map();

  /** 会话 ID 计数器 */
  private sessionCounter = 0;

  /** Leak 检测 —— 超过此时间（ms）未释放且无 TTL 的视为泄漏 */
  private leakThreshold = 600_000; // 10 分钟

  private constructor() {}

  static getInstance(): GPUResourceManager {
    if (!GPUResourceManager.instance) {
      GPUResourceManager.instance = new GPUResourceManager();
    }
    return GPUResourceManager.instance;
  }

  // ── 配置 ────────────────────────────────────────────────────────

  configure(options: { totalVRAM?: number; totalQueueSlots?: number; leakThreshold?: number }): void {
    if (options.totalVRAM !== undefined) this.totalVRAM = options.totalVRAM;
    if (options.totalQueueSlots !== undefined) this.totalQueueSlots = options.totalQueueSlots;
    if (options.leakThreshold !== undefined) this.leakThreshold = options.leakThreshold;
  }

  // ── 分配 ────────────────────────────────────────────────────────

  /**
   * 分配 GPU 资源
   * 如果资源不足，抛异常（或返回 null）
   */
  allocate(request: GPUAllocateRequest): GPUAllocation {
    // 检查资源是否充足
    if (this.allocatedVRAM + request.vramMB > this.totalVRAM) {
      throw new Error(
        `GPU VRAM 不足: 已分配 ${this.allocatedVRAM}MB，请求 ${request.vramMB}MB，上限 ${this.totalVRAM}MB`,
      );
    }
    if (this.allocatedQueueSlots + request.queueSlots > this.totalQueueSlots) {
      throw new Error(
        `GPU 队列槽位不足: 已占用 ${this.allocatedQueueSlots}，请求 ${request.queueSlots}，总槽位 ${this.totalQueueSlots}`,
      );
    }

    // 分配
    this.allocatedVRAM += request.vramMB;
    this.allocatedQueueSlots += request.queueSlots;

    const sessionId = `gpu-session-${++this.sessionCounter}-${Date.now()}`;
    const allocation: GPUAllocation = {
      sessionId,
      vramMB: request.vramMB,
      queueSlots: request.queueSlots,
      requester: request.requester,
      label: request.label,
      allocatedAt: Date.now(),
      ttl: request.timeout,
    };

    this.allocations.set(sessionId, allocation);

    return allocation;
  }

  // ── 释放 ────────────────────────────────────────────────────────

  /**
   * 释放之前分配的 GPU 资源
   */
  release(sessionId: string): boolean {
    const alloc = this.allocations.get(sessionId);
    if (!alloc) return false;

    this.allocatedVRAM -= alloc.vramMB;
    this.allocatedQueueSlots -= alloc.queueSlots;
    this.allocations.delete(sessionId);

    return true;
  }

  // ── 利用率 ──────────────────────────────────────────────────────

  getUtilization(): GPUUtilization {
    const leakedSessions = this.detectLeakedSessions();

    return {
      allocatedVRAM: this.allocatedVRAM,
      totalVRAM: this.totalVRAM,
      vramUtilization: this.totalVRAM > 0 ? this.allocatedVRAM / this.totalVRAM : 0,
      allocatedQueueSlots: this.allocatedQueueSlots,
      totalQueueSlots: this.totalQueueSlots,
      queueUtilization: this.totalQueueSlots > 0 ? this.allocatedQueueSlots / this.totalQueueSlots : 0,
      activeSessions: this.allocations.size,
      leakedSessions: leakedSessions.length,
    };
  }

  // ── Leak 预防 ───────────────────────────────────────────────────

  /**
   * 检测并回收泄漏资源（超时未释放的分配）
   * 返回回收的会话数
   */
  preventLeak(): number {
    const leaked = this.detectLeakedSessions();
    for (const alloc of leaked) {
      this.release(alloc.sessionId);
    }
    return leaked.length;
  }

  /**
   * 返回所有活跃分配
   */
  getAllocations(): ReadonlyMap<string, GPUAllocation> {
    return this.allocations;
  }

  // ── 重置 ────────────────────────────────────────────────────────

  reset(): void {
    this.allocatedVRAM = 0;
    this.allocatedQueueSlots = 0;
    this.allocations.clear();
    this.sessionCounter = 0;
  }

  // ── 内部工具 ────────────────────────────────────────────────────

  private detectLeakedSessions(): GPUAllocation[] {
    const now = Date.now();
    const leaked: GPUAllocation[] = [];

    for (const [, alloc] of this.allocations) {
      const age = now - alloc.allocatedAt;
      const effectiveTtl = alloc.ttl !== undefined ? alloc.ttl : this.leakThreshold;
      if (age > effectiveTtl) {
        leaked.push(alloc);
      }
    }

    return leaked;
  }
}
