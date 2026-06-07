export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export type TripReason =
  | 'kernel_crash'
  | 'event_storm'
  | 'scheduler_degradation'
  | 'manual';

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  trippedAt: number | null;
  reason: TripReason | null;
  failCount: number;
  halfOpenAttempts: number;
  lastFailureAt: number | null;
  isRecovering: boolean;
}

export interface TripEvent {
  state: CircuitBreakerState;
  reason: TripReason;
  trippedAt: number;
  details: string;
}

/**
 * KernelCircuitBreaker - 内核断路器
 *
 * 三种保护：
 * 1. Kernel崩溃隔离 — 防止级联故障
 * 2. Event风暴熔断 — 过载时切断事件流
 * 3. Scheduler降级 — Scheduler异常时切到后备模式
 */
export class KernelCircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private trippedAt: number | null = null;
  private reason: TripReason | null = null;
  private failCount: number = 0;
  private halfOpenAttempts: number = 0;
  private lastFailureAt: number | null = null;
  private tripEvents: TripEvent[] = [];

  // 配置
  private failureThreshold: number = 5;          // 连续失败多少次后熔断
  private halfOpenMaxAttempts: number = 3;        // 半开状态最大尝试次数
  private recoveryTimeoutMs: number = 30000;      // 半开状态自动恢复时间

  // 受保护的子系统状态
  private kernelCrashed: boolean = false;
  private eventStormActive: boolean = false;
  private schedulerDegraded: boolean = false;

  /**
   * 触发熔断
   */
  public trip(reason: TripReason, details?: string): void {
    if (this.state === 'open') {
      return; // 已熔断，无需重复触发
    }

    const previousState = this.state;
    this.state = 'open';
    this.trippedAt = Date.now();
    this.reason = reason;
    this.lastFailureAt = Date.now();

    // 更新子系统标记
    switch (reason) {
      case 'kernel_crash':
        this.kernelCrashed = true;
        break;
      case 'event_storm':
        this.eventStormActive = true;
        break;
      case 'scheduler_degradation':
        this.schedulerDegraded = true;
        break;
    }

    this.tripEvents.push({
      state: previousState,
      reason,
      trippedAt: this.trippedAt,
      details: details || `断路器触发: ${reason}`,
    });

    this.failCount++;
  }

  /**
   * 记录一次失败（累积到阈值后自动熔断）
   */
  public recordFailure(reason?: TripReason): void {
    this.failCount++;
    this.lastFailureAt = Date.now();

    if (this.failCount >= this.failureThreshold) {
      this.trip(reason || 'kernel_crash', `连续失败达阈值 (${this.failCount}/${this.failureThreshold})`);
    }
  }

  /**
   * 是否已熔断
   */
  public isTripped(): boolean {
    return this.state === 'open';
  }

  /**
   * 重置熔断 — 回到关闭状态
   */
  public reset(): void {
    this.state = 'closed';
    this.trippedAt = null;
    this.reason = null;
    this.failCount = 0;
    this.halfOpenAttempts = 0;
    this.kernelCrashed = false;
    this.eventStormActive = false;
    this.schedulerDegraded = false;
  }

  /**
   * 半开状态 — 尝试恢复
   * 返回 true 表示允许请求通过进行探测
   */
  public halfOpen(): boolean {
    if (this.state !== 'open') {
      return false;
    }

    // 检查是否过了恢复时间窗口
    if (this.trippedAt && Date.now() - this.trippedAt < this.recoveryTimeoutMs) {
      return false; // 还处于冷却期
    }

    this.state = 'half-open';
    this.halfOpenAttempts++;

    return true;
  }

  /**
   * 半开探测成功 —— 关闭断路器
   */
  public recoverySucceeded(): void {
    if (this.state !== 'half-open') return;

    this.state = 'closed';
    this.trippedAt = null;
    this.reason = null;
    this.failCount = 0;
    this.halfOpenAttempts = 0;
    this.kernelCrashed = false;
    this.eventStormActive = false;
    this.schedulerDegraded = false;
  }

  /**
   * 半开探测失败 —— 恢复熔断状态
   */
  public recoveryFailed(): void {
    if (this.state !== 'half-open') return;

    this.state = 'open';
    this.trippedAt = Date.now();
    this.lastFailureAt = Date.now();
    this.failCount++;

    // 如果半开尝试超过阈值，延长冷却时间
    if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      this.recoveryTimeoutMs *= 2; // 指数退避
    }
  }

  /**
   * 获取当前状态
   */
  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      trippedAt: this.trippedAt,
      reason: this.reason,
      failCount: this.failCount,
      halfOpenAttempts: this.halfOpenAttempts,
      lastFailureAt: this.lastFailureAt,
      isRecovering: this.state === 'half-open',
    };
  }

  /**
   * 获取熔断事件历史
   */
  public getTripEvents(): TripEvent[] {
    return [...this.tripEvents];
  }

  /**
   * 配置熔断参数
   */
  public configure(config: {
    failureThreshold?: number;
    halfOpenMaxAttempts?: number;
    recoveryTimeoutMs?: number;
  }): void {
    if (config.failureThreshold !== undefined) {
      this.failureThreshold = config.failureThreshold;
    }
    if (config.halfOpenMaxAttempts !== undefined) {
      this.halfOpenMaxAttempts = config.halfOpenMaxAttempts;
    }
    if (config.recoveryTimeoutMs !== undefined) {
      this.recoveryTimeoutMs = config.recoveryTimeoutMs;
    }
  }

  /**
   * 检查Kernel是否崩溃被隔离
   */
  public isKernelIsolated(): boolean {
    return this.kernelCrashed;
  }

  /**
   * 检查是否存在Event风暴
   */
  public isEventStormActive(): boolean {
    return this.eventStormActive;
  }

  /**
   * 检查Scheduler是否降级
   */
  public isSchedulerDegraded(): boolean {
    return this.schedulerDegraded;
  }
}
