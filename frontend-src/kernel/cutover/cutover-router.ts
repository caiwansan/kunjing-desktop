export type TaskRiskLevel = 'low' | 'high' | 'critical' | 'unclassified';

export interface Task {
  id: string;
  type: string;
  name: string;
  category?: string;
  riskLevel?: TaskRiskLevel;
  metadata?: Record<string, unknown>;
}

export type RouteDecision = 'legacy' | 'kernel' | 'dual';

export interface RoutingResult {
  taskId: string;
  decision: RouteDecision;
  riskLevel: TaskRiskLevel;
  reason: string;
  routedAt: number;
}

export interface RoutingStats {
  legacyCount: number;
  kernelCount: number;
  dualCount: number;
  totalCount: number;
  legacyPct: number;
  kernelPct: number;
  dualPct: number;
}

/**
 * CutoverRouter - 决定任务走旧Runtime / Kernel / 双执行
 *
 * 路由规则：
 * - 低风险任务（静默后台任务、历史数据查询）→ Kernel
 * - 高风险任务（生产Agent、用户交互）→ 旧Runtime
 * - 关键任务（支付、会员）→ 旧Runtime
 * - 未分类 → 双执行
 */
export class CutoverRouter {
  private routingHistory: RoutingResult[] = [];
  private legacyCount: number = 0;
  private kernelCount: number = 0;
  private dualCount: number = 0;

  // 可配置的关键字规则
  private lowRiskKeywords: string[] = [
    'background', 'silent', 'history', 'query', 'readonly', 'report', 'log',
    '静默', '后台', '历史', '查询', '只读', '报表', '日志',
  ];

  private highRiskKeywords: string[] = [
    'agent', 'interactive', 'user', 'ui', 'production', 'live',
    'agent', '交互', '用户', '生产', '实时',
  ];

  private criticalKeywords: string[] = [
    'payment', 'pay', 'member', 'vip', 'subscription', 'order', 'auth',
    '支付', '会员', '订阅', '订单', '权限', '认证',
  ];

  /**
   * 路由一个任务
   */
  public routeTask(task: Task): RoutingResult {
    const riskLevel = this.classifyRisk(task);
    const decision = this.makeDecision(riskLevel, task);
    const reason = this.getDecisionReason(riskLevel, decision);

    const result: RoutingResult = {
      taskId: task.id,
      decision,
      riskLevel,
      reason,
      routedAt: Date.now(),
    };

    // 统计
    switch (decision) {
      case 'legacy':
        this.legacyCount++;
        break;
      case 'kernel':
        this.kernelCount++;
        break;
      case 'dual':
        this.dualCount++;
        break;
    }

    this.routingHistory.push(result);
    return result;
  }

  /**
   * 批量路由任务
   */
  public routeTasks(tasks: Task[]): RoutingResult[] {
    return tasks.map(task => this.routeTask(task));
  }

  /**
   * 获取路由统计数据
   */
  public getRoutingStats(): RoutingStats {
    const total = this.legacyCount + this.kernelCount + this.dualCount;
    return {
      legacyCount: this.legacyCount,
      kernelCount: this.kernelCount,
      dualCount: this.dualCount,
      totalCount: total,
      legacyPct: total > 0 ? Math.round((this.legacyCount / total) * 10000) / 100 : 0,
      kernelPct: total > 0 ? Math.round((this.kernelCount / total) * 10000) / 100 : 0,
      dualPct: total > 0 ? Math.round((this.dualCount / total) * 10000) / 100 : 0,
    };
  }

  /**
   * 获取路由历史
   */
  public getRoutingHistory(): RoutingResult[] {
    return [...this.routingHistory];
  }

  /**
   * 清空统计
   */
  public reset(): void {
    this.routingHistory = [];
    this.legacyCount = 0;
    this.kernelCount = 0;
    this.dualCount = 0;
  }

  /**
   * 配置低风险关键字
   */
  public setLowRiskKeywords(keywords: string[]): void {
    this.lowRiskKeywords = [...keywords];
  }

  /**
   * 配置高风险关键字
   */
  public setHighRiskKeywords(keywords: string[]): void {
    this.highRiskKeywords = [...keywords];
  }

  /**
   * 配置关键任务关键字
   */
  public setCriticalKeywords(keywords: string[]): void {
    this.criticalKeywords = [...keywords];
  }

  /**
   * 根据任务类型和名称分类风险等级
   */
  private classifyRisk(task: Task): TaskRiskLevel {
    // 如果任务已显式标注风险等级，直接使用
    if (task.riskLevel) {
      return task.riskLevel;
    }

    const checkText = `${task.type} ${task.name} ${task.category || ''} ${JSON.stringify(task.metadata || {})}`.toLowerCase();

    // 检查关键任务
    for (const kw of this.criticalKeywords) {
      if (checkText.includes(kw.toLowerCase())) {
        return 'critical';
      }
    }

    // 检查高风险任务
    for (const kw of this.highRiskKeywords) {
      if (checkText.includes(kw.toLowerCase())) {
        return 'high';
      }
    }

    // 检查低风险任务
    for (const kw of this.lowRiskKeywords) {
      if (checkText.includes(kw.toLowerCase())) {
        return 'low';
      }
    }

    return 'unclassified';
  }

  /**
   * 根据风险等级和任务做出路由决策
   */
  private makeDecision(riskLevel: TaskRiskLevel, _task: Task): RouteDecision {
    switch (riskLevel) {
      case 'low':
        return 'kernel';
      case 'high':
        return 'legacy';
      case 'critical':
        return 'legacy';
      case 'unclassified':
        return 'dual';
      default:
        return 'dual';
    }
  }

  /**
   * 生成路由原因描述
   */
  private getDecisionReason(riskLevel: TaskRiskLevel, decision: RouteDecision): string {
    const riskMap: Record<TaskRiskLevel, string> = {
      low: '低风险任务',
      high: '高风险任务',
      critical: '关键任务',
      unclassified: '未分类任务',
    };

    const decisionMap: Record<RouteDecision, string> = {
      legacy: '→ 旧Runtime（安全优先）',
      kernel: '→ Kernel（低风险通道）',
      dual: '→ 双执行（验证模式）',
    };

    return `${riskMap[riskLevel]} ${decisionMap[decision]}`;
  }
}
