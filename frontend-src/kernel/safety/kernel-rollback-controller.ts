export interface RollbackCondition {
  name: string;
  description: string;
  threshold: number;
  currentValue: number;
  isTriggered: boolean;
}

export interface RollbackSnapshot {
  id: string;
  triggeredAt: number;
  reason: string;
  conditions: RollbackCondition[];
  state: Record<string, unknown>;
  completedAt: number | null;
  success: boolean | null;
}

export interface RollbackHistoryEntry {
  snapshotId: string;
  triggeredAt: number;
  reason: string;
  completedAt: number;
  success: boolean;
  durationMs: number;
}

/**
 * KernelRollbackController - 内核回滚控制器
 *
 * 触发条件：
 * - errorRate > 3%
 * - gpuException > 5%
 * - eventDisorder 发生
 * - stateConflict 发生
 */
export class KernelRollbackController {
  private snapshots: RollbackSnapshot[] = [];
  private history: RollbackHistoryEntry[] = [];
  private isRollingBack: boolean = false;
  private isFrozen: boolean = false;
  private kernelActive: boolean = true;

  // 当前健康指标
  private errorRate: number = 0;
  private gpuExceptionRate: number = 0;
  private eventDisorderDetected: boolean = false;
  private stateConflictDetected: boolean = false;

  // 阈值配置
  private errorRateThreshold: number = 0.03;     // 3%
  private gpuExceptionThreshold: number = 0.05;  // 5%

  /**
   * 设置当前指标值
   */
  public setMetrics(
    errorRate: number,
    gpuExceptionRate: number,
    eventDisorder: boolean,
    stateConflict: boolean,
  ): void {
    this.errorRate = errorRate;
    this.gpuExceptionRate = gpuExceptionRate;
    this.eventDisorderDetected = eventDisorder;
    this.stateConflictDetected = stateConflict;
  }

  /**
   * 配置阈值
   */
  public setThresholds(errorRate: number, gpuException: number): void {
    this.errorRateThreshold = errorRate;
    this.gpuExceptionThreshold = gpuException;
  }

  /**
   * 检测是否需要回滚
   * 返回触发回滚的条件详情
   */
  public checkRollbackConditions(): RollbackCondition[] {
    const conditions: RollbackCondition[] = [
      {
        name: 'errorRate',
        description: '错误率超过阈值',
        threshold: this.errorRateThreshold,
        currentValue: this.errorRate,
        isTriggered: this.errorRate > this.errorRateThreshold,
      },
      {
        name: 'gpuException',
        description: 'GPU异常率超过阈值',
        threshold: this.gpuExceptionThreshold,
        currentValue: this.gpuExceptionRate,
        isTriggered: this.gpuExceptionRate > this.gpuExceptionThreshold,
      },
      {
        name: 'eventDisorder',
        description: '事件乱序检测',
        threshold: 1,
        currentValue: this.eventDisorderDetected ? 1 : 0,
        isTriggered: this.eventDisorderDetected,
      },
      {
        name: 'stateConflict',
        description: '状态冲突检测',
        threshold: 1,
        currentValue: this.stateConflictDetected ? 1 : 0,
        isTriggered: this.stateConflictDetected,
      },
    ];

    return conditions;
  }

  /**
   * 获取所有触发回滚的条件
   */
  public getTriggeredConditions(): RollbackCondition[] {
    return this.checkRollbackConditions().filter(c => c.isTriggered);
  }

  /**
   * 是否需要回滚（任何条件触发）
   */
  public needsRollback(): boolean {
    return this.getTriggeredConditions().length > 0;
  }

  /**
   * 执行回滚 —— 全部切回旧Runtime + 冻结Kernel + 记录快照
   */
  public async executeRollback(): Promise<RollbackSnapshot> {
    if (this.isRollingBack) {
      throw new Error('Rollback already in progress');
    }

    const triggeredConditions = this.getTriggeredConditions();
    const reason = this.buildRollbackReason(triggeredConditions);

    this.isRollingBack = true;

    const snapshot: RollbackSnapshot = {
      id: `rollback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      triggeredAt: Date.now(),
      reason,
      conditions: triggeredConditions,
      state: this.captureState(),
      completedAt: null,
      success: null,
    };

    this.snapshots.push(snapshot);

    try {
      // 模拟回滚执行
      await this.performRollback();

      // 冻结Kernel
      this.freezeKernel();

      snapshot.completedAt = Date.now();
      snapshot.success = true;

      this.history.push({
        snapshotId: snapshot.id,
        triggeredAt: snapshot.triggeredAt,
        reason: snapshot.reason,
        completedAt: snapshot.completedAt,
        success: true,
        durationMs: snapshot.completedAt - snapshot.triggeredAt,
      });

      this.isRollingBack = false;
      this.kernelActive = false;

      return snapshot;
    } catch (err) {
      snapshot.completedAt = Date.now();
      snapshot.success = false;

      this.history.push({
        snapshotId: snapshot.id,
        triggeredAt: snapshot.triggeredAt,
        reason: snapshot.reason,
        completedAt: snapshot.completedAt,
        success: false,
        durationMs: snapshot.completedAt - snapshot.triggeredAt,
      });

      this.isRollingBack = false;
      throw err;
    }
  }

  /**
   * 获取回滚历史
   */
  public getRollbackHistory(): RollbackHistoryEntry[] {
    return [...this.history];
  }

  /**
   * 检查是否可回滚
   * 条件：Kernel活跃、未处于回滚中、未冻结
   */
  public canRollback(): boolean {
    return this.kernelActive && !this.isRollingBack && !this.isFrozen;
  }

  /**
   * 是否已执行回滚（Kernel不活跃）
   */
  public isKernelActive(): boolean {
    return this.kernelActive;
  }

  /**
   * 是否已冻结
   */
  public getIsFrozen(): boolean {
    return this.isFrozen;
  }

  /**
   * 是否正在回滚
   */
  public getIsRollingBack(): boolean {
    return this.isRollingBack;
  }

  /**
   * 解冻Kernel（手动恢复）
   */
  public unfreezeKernel(): void {
    this.isFrozen = false;
    this.kernelActive = true;
  }

  /**
   * 获取所有快照
   */
  public getSnapshots(): RollbackSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * 获取最后一次回滚的快照
   */
  public getLastSnapshot(): RollbackSnapshot | null {
    if (this.snapshots.length === 0) return null;
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * 构建回滚原因
   */
  private buildRollbackReason(conditions: RollbackCondition[]): string {
    if (conditions.length === 0) {
      return 'Manual rollback';
    }

    const reasons = conditions.map(c => {
      switch (c.name) {
        case 'errorRate':
          return `错误率 ${(c.currentValue * 100).toFixed(1)}% 超过阈值 ${(c.threshold * 100).toFixed(1)}%`;
        case 'gpuException':
          return `GPU异常率 ${(c.currentValue * 100).toFixed(1)}% 超过阈值 ${(c.threshold * 100).toFixed(1)}%`;
        case 'eventDisorder':
          return '检测到事件乱序';
        case 'stateConflict':
          return '检测到状态冲突';
        default:
          return c.description;
      }
    });

    return `回滚触发: ${reasons.join('; ')}`;
  }

  /**
   * 捕获当前系统状态快照
   */
  private captureState(): Record<string, unknown> {
    return {
      kernelActive: this.kernelActive,
      isFrozen: this.isFrozen,
      errorRate: this.errorRate,
      gpuExceptionRate: this.gpuExceptionRate,
      eventDisorder: this.eventDisorderDetected,
      stateConflict: this.stateConflictDetected,
      capturedAt: Date.now(),
    };
  }

  /**
   * 执行回滚操作（模拟）
   */
  private async performRollback(): Promise<void> {
    // 模拟异步回滚操作
    await new Promise(resolve => setTimeout(resolve, 50));
    // 实际实现中：
    // 1. 停止所有Kernel线程/Worker
    // 2. 将流量全部切回旧Runtime
    // 3. 刷新状态缓冲区
  }

  /**
   * 冻结Kernel
   */
  private freezeKernel(): void {
    this.isFrozen = true;
    this.kernelActive = false;
  }
}
