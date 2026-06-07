export enum CutoverPhase {
  Phase1_EventBus = 'Phase1_EventBus',       // 只读接管
  Phase2_StateTree = 'Phase2_StateTree',     // 镜像写入
  Phase3_Scheduler = 'Phase3_Scheduler',     // Shadow调度
  Phase4_Worker = 'Phase4_Worker',           // 部分任务
  Phase5_GPUQueue = 'Phase5_GPUQueue',       // 低优先级GPU
}

export const CutoverPhaseOrder: CutoverPhase[] = [
  CutoverPhase.Phase1_EventBus,
  CutoverPhase.Phase2_StateTree,
  CutoverPhase.Phase3_Scheduler,
  CutoverPhase.Phase4_Worker,
  CutoverPhase.Phase5_GPUQueue,
];

export interface PhaseProgress {
  phase: CutoverPhase;
  startedAt: number;
  completedAt: number | null;
  score: number;          // 0-100
  safeToAdvance: boolean;
}

export interface CutoverSnapshot {
  phase: CutoverPhase;
  timestamp: number;
  state: Record<string, unknown>;
}

export class GradualKernelAdopter {
  private currentPhase: CutoverPhase = CutoverPhase.Phase1_EventBus;
  private phaseHistory: PhaseProgress[] = [];
  private rollbackSnapshots: CutoverSnapshot[] = [];
  private isRolledBack: boolean = false;
  private overallProgress: number = 0; // 0-100

  constructor() {
    this.phaseHistory.push({
      phase: CutoverPhase.Phase1_EventBus,
      startedAt: Date.now(),
      completedAt: null,
      score: 0,
      safeToAdvance: false,
    });
  }

  /**
   * 启动指定阶段
   */
  public startPhase(phase: CutoverPhase): void {
    const idx = CutoverPhaseOrder.indexOf(phase);
    if (idx === -1) {
      throw new Error(`Unknown phase: ${phase}`);
    }

    // 检查顺序 —— 不允许跳过阶段
    const currentIdx = CutoverPhaseOrder.indexOf(this.currentPhase);
    if (idx > currentIdx + 1) {
      throw new Error(
        `Cannot jump to phase ${phase}. Current phase is ${this.currentPhase}. ` +
        `Only phase ${CutoverPhaseOrder[currentIdx + 1] || 'none'} can be started next.`
      );
    }

    if (idx <= currentIdx && phase !== this.currentPhase) {
      // 回滚场景：通过 rollbackTo 处理
      throw new Error(
        `Cannot start previous phase ${phase}. Use rollbackTo() instead.`
      );
    }

    this.currentPhase = phase;
    this.isRolledBack = false;

    // 记录或更新阶段历史
    const existing = this.phaseHistory.find(p => p.phase === phase);
    if (existing) {
      existing.startedAt = Date.now();
      existing.completedAt = null;
      existing.score = 0;
      existing.safeToAdvance = false;
    } else {
      this.phaseHistory.push({
        phase,
        startedAt: Date.now(),
        completedAt: null,
        score: 0,
        safeToAdvance: false,
      });
    }

    this.recalculateProgress();
  }

  /**
   * 自动推进到下一阶段（基于评分）
   */
  public advanceToNext(): CutoverPhase | null {
    const currentIdx = CutoverPhaseOrder.indexOf(this.currentPhase);

    if (!this.isSafeToAdvance()) {
      return null;
    }

    // 标记当前阶段完成
    const currentProgress = this.phaseHistory.find(p => p.phase === this.currentPhase);
    if (currentProgress) {
      currentProgress.completedAt = Date.now();
      currentProgress.score = 100;
      currentProgress.safeToAdvance = true;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx >= CutoverPhaseOrder.length) {
      // 所有阶段已完成
      this.overallProgress = 100;
      return null;
    }

    const nextPhase = CutoverPhaseOrder[nextIdx];
    this.currentPhase = nextPhase;

    // 记录新阶段
    this.phaseHistory.push({
      phase: nextPhase,
      startedAt: Date.now(),
      completedAt: null,
      score: 0,
      safeToAdvance: false,
    });

    this.recalculateProgress();
    return nextPhase;
  }

  /**
   * 回滚到指定阶段
   */
  public rollbackTo(phase: CutoverPhase): void {
    const idx = CutoverPhaseOrder.indexOf(phase);
    if (idx === -1) {
      throw new Error(`Unknown phase: ${phase}`);
    }

    // 记录回滚前的快照
    this.rollbackSnapshots.push({
      phase: this.currentPhase,
      timestamp: Date.now(),
      state: {
        phase: this.currentPhase,
        progress: this.overallProgress,
      },
    });

    // 截断历史（删除目标阶段之后的所有记录）
    const targetIdx = CutoverPhaseOrder.indexOf(phase);
    this.phaseHistory = this.phaseHistory.filter(p => {
      const pIdx = CutoverPhaseOrder.indexOf(p.phase);
      return pIdx <= targetIdx;
    });

    this.currentPhase = phase;
    this.isRolledBack = true;

    // 重置当前阶段的状态
    const current = this.phaseHistory.find(p => p.phase === phase);
    if (current) {
      current.completedAt = null;
      current.score = 0;
      current.safeToAdvance = false;
    }

    this.recalculateProgress();
  }

  /**
   * 获取当前阶段
   */
  public getCurrentPhase(): CutoverPhase {
    return this.currentPhase;
  }

  /**
   * 获取整体接管进度百分比 (0-100)
   */
  public getProgress(): number {
    return this.overallProgress;
  }

  /**
   * 检查是否可以推进到下一阶段
   * 基于：当前阶段评分 >= 80，且无安全警告
   */
  public isSafeToAdvance(): boolean {
    const current = this.phaseHistory.find(p => p.phase === this.currentPhase);
    if (!current) {
      return false;
    }
    return current.score >= 80 && current.safeToAdvance;
  }

  /**
   * 更新某个阶段的评分
   */
  public updatePhaseScore(phase: CutoverPhase, score: number, safeToAdvance: boolean): void {
    const progress = this.phaseHistory.find(p => p.phase === phase);
    if (progress) {
      progress.score = Math.max(0, Math.min(100, score));
      progress.safeToAdvance = safeToAdvance;
    }
    this.recalculateProgress();
  }

  /**
   * 获取所有阶段的进度详情
   */
  public getPhaseHistory(): PhaseProgress[] {
    return [...this.phaseHistory];
  }

  /**
   * 获取回滚快照历史
   */
  public getRollbackSnapshots(): CutoverSnapshot[] {
    return [...this.rollbackSnapshots];
  }

  /**
   * 获取当前阶段索引
   */
  public getPhaseIndex(): number {
    return CutoverPhaseOrder.indexOf(this.currentPhase);
  }

  /**
   * 是否处于回滚状态
   */
  public getIsRolledBack(): boolean {
    return this.isRolledBack;
  }

  /**
   * 重新计算总体进度
   */
  private recalculateProgress(): void {
    if (this.phaseHistory.length === 0) {
      this.overallProgress = 0;
      return;
    }

    let totalScore = 0;
    for (const phase of CutoverPhaseOrder) {
      const p = this.phaseHistory.find(h => h.phase === phase);
      if (p) {
        totalScore += p.score;
      }
    }

    this.overallProgress = Math.round(totalScore / CutoverPhaseOrder.length);
  }
}
