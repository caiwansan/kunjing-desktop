export interface DagNode {
  id: string;
  name: string;
  type: string;
  dependencies: string[];
  params?: Record<string, unknown>;
}

export interface DagPath {
  nodes: DagNode[];
  executionOrder: string[];
  parallelGroups: string[][];
}

export interface WorkerAssignment {
  workerId: string;
  workerType: string;
  taskCount: number;
  resourceAllocation: {
    cpu: number;
    memory: number;
    gpu: number;
  };
}

export interface GpuAllocation {
  deviceId: string;
  memoryMb: number;
  computeUnits: number;
  priority: number;
  taskIds: string[];
}

export interface FinalResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ComparisonScore {
  matchScore: number;  // 0-1
  details: string[];
}

export interface DagComparisonResult {
  structureMatch: ComparisonScore;
  orderMatch: ComparisonScore;
  parallelMatch: ComparisonScore;
  overallScore: number;
  details: string[];
}

export interface WorkerComparisonResult {
  selectionMatch: ComparisonScore;
  loadBalanceMatch: ComparisonScore;
  resourceMatch: ComparisonScore;
  overallScore: number;
  details: string[];
}

export interface GpuComparisonResult {
  deviceMatch: ComparisonScore;
  memoryMatch: ComparisonScore;
  priorityMatch: ComparisonScore;
  overallScore: number;
  details: string[];
}

export interface ResultComparisonResult {
  structureMatch: ComparisonScore;
  valueMatch: ComparisonScore;
  errorMatch: ComparisonScore;
  overallScore: number;
  details: string[];
}

export interface FullComparisonReport {
  dag: DagComparisonResult;
  worker: WorkerComparisonResult;
  gpu: GpuComparisonResult;
  result: ResultComparisonResult;
  overallMatchScore: number;
  comparedAt: number;
}

/**
 * DualComparisonEngine - 对比新旧两套系统的DAG执行路径、Worker选择、GPU分配、最终结果
 */
export class DualComparisonEngine {
  private comparisonHistory: FullComparisonReport[] = [];

  /**
   * 全面对比新旧系统的执行情况
   */
  public compareAll(
    realDag: DagPath,
    shadowDag: DagPath,
    realWorker: WorkerAssignment,
    shadowWorker: WorkerAssignment,
    realGpu: GpuAllocation,
    shadowGpu: GpuAllocation,
    realResult: FinalResult,
    shadowResult: FinalResult,
  ): FullComparisonReport {
    const dagResult = this.compareDagPath(realDag, shadowDag);
    const workerResult = this.compareWorkerAssignment(realWorker, shadowWorker);
    const gpuResult = this.compareGpuAllocation(realGpu, shadowGpu);
    const resultResult = this.compareFinalResult(realResult, shadowResult);

    const overallMatchScore = Math.round(
      (dagResult.overallScore +
        workerResult.overallScore +
        gpuResult.overallScore +
        resultResult.overallScore) / 4 * 100
    ) / 100;

    const report: FullComparisonReport = {
      dag: dagResult,
      worker: workerResult,
      gpu: gpuResult,
      result: resultResult,
      overallMatchScore,
      comparedAt: Date.now(),
    };

    this.comparisonHistory.push(report);
    return report;
  }

  /**
   * 对比DAG执行路径差异
   * 比较：节点结构、执行顺序、并行分组
   */
  public compareDagPath(real: DagPath, shadow: DagPath): DagComparisonResult {
    const details: string[] = [];

    // 节点结构对比
    const realNodeIds = new Set(real.nodes.map(n => n.id));
    const shadowNodeIds = new Set(shadow.nodes.map(n => n.id));
    const commonNodes = real.nodes.filter(n => shadowNodeIds.has(n.id));
    const structureMatchScore = real.nodes.length > 0
      ? commonNodes.length / Math.max(real.nodes.length, shadow.nodes.length)
      : 1;
    details.push(`DAG结构匹配: ${commonNodes.length}/${Math.max(real.nodes.length, shadow.nodes.length)} 节点相同`);

    // 执行顺序对比
    const orderMatches = real.executionOrder.filter((id, i) => shadow.executionOrder[i] === id);
    const orderMatchScore = real.executionOrder.length > 0
      ? orderMatches.length / Math.max(real.executionOrder.length, shadow.executionOrder.length)
      : 1;
    details.push(`执行顺序匹配: ${orderMatches.length}/${Math.max(real.executionOrder.length, shadow.executionOrder.length)}`);

    // 并行分组对比
    const parallelMatches = this.compareParallelGroups(real.parallelGroups, shadow.parallelGroups);
    details.push(`并行分组匹配: ${parallelMatches.matchCount}/${parallelMatches.total} 组相同`);

    const overallScore = Math.round(
      (structureMatchScore + orderMatchScore + parallelMatches.score) / 3 * 100
    ) / 100;

    return {
      structureMatch: {
        matchScore: structureMatchScore,
        details: [`结构: ${structureMatchScore >= 0.9 ? '高度匹配' : structureMatchScore >= 0.5 ? '部分匹配' : '差异较大'}`],
      },
      orderMatch: {
        matchScore: orderMatchScore,
        details: [`顺序: ${orderMatchScore >= 0.9 ? '完全一致' : orderMatchScore >= 0.5 ? '基本一致' : '顺序不同'}`],
      },
      parallelMatch: {
        matchScore: parallelMatches.score,
        details: [`并行: ${parallelMatches.score >= 0.9 ? '并行策略一致' : parallelMatches.score >= 0.5 ? '部分一致' : '并行策略不同'}`],
      },
      overallScore,
      details,
    };
  }

  /**
   * 对比Worker选择
   */
  public compareWorkerAssignment(real: WorkerAssignment, shadow: WorkerAssignment): WorkerComparisonResult {
    const details: string[] = [];

    // Worker选择对比
    const selectionMatchScore = real.workerId === shadow.workerId ? 1 : 0;
    details.push(`Worker选择: ${selectionMatchScore === 1 ? '相同' : '不同'} (real=${real.workerId}, shadow=${shadow.workerId})`);

    // 负载均衡对比
    const loadDiff = Math.abs(real.taskCount - shadow.taskCount);
    const loadBalanceMatchScore = loadDiff <= 1 ? 1 : loadDiff <= 3 ? 0.5 : 0;
    details.push(`负载差异: ${loadDiff} 个任务`);

    // 资源分配对比
    const cpuMatch = real.resourceAllocation.cpu === shadow.resourceAllocation.cpu ? 1 : 0.3;
    const memMatch = real.resourceAllocation.memory === shadow.resourceAllocation.memory ? 1 : 0.3;
    const gpuMatch = real.resourceAllocation.gpu === shadow.resourceAllocation.gpu ? 1 : 0.3;
    const resourceMatchScore = Math.round((cpuMatch + memMatch + gpuMatch) / 3 * 100) / 100;
    details.push(`资源分配匹配度: ${Math.round(resourceMatchScore * 100)}%`);

    const overallScore = Math.round(
      (selectionMatchScore + loadBalanceMatchScore + resourceMatchScore) / 3 * 100
    ) / 100;

    return {
      selectionMatch: {
        matchScore: selectionMatchScore,
        details: [`Worker ${selectionMatchScore === 1 ? '一致' : '替换'}`],
      },
      loadBalanceMatch: {
        matchScore: loadBalanceMatchScore,
        details: [`负载差异 ${loadDiff}`],
      },
      resourceMatch: {
        matchScore: resourceMatchScore,
        details: [`CPU:${cpuMatch === 1 ? '一致' : '差异'} 内存:${memMatch === 1 ? '一致' : '差异'} GPU:${gpuMatch === 1 ? '一致' : '差异'}`],
      },
      overallScore,
      details,
    };
  }

  /**
   * 对比GPU分配
   */
  public compareGpuAllocation(real: GpuAllocation, shadow: GpuAllocation): GpuComparisonResult {
    const details: string[] = [];

    // GPU设备选择
    const deviceMatchScore = real.deviceId === shadow.deviceId ? 1 : 0;
    details.push(`GPU设备: ${deviceMatchScore === 1 ? '相同' : '不同'} (real=${real.deviceId}, shadow=${shadow.deviceId})`);

    // 内存分配
    const memDiff = Math.abs(real.memoryMb - shadow.memoryMb);
    const memoryMatchScore = memDiff <= 10 ? 1 : memDiff <= 100 ? 0.5 : 0.2;
    details.push(`GPU内存差异: ${memDiff}MB`);

    // 优先级
    const priorityMatchScore = real.priority === shadow.priority ? 1 : 0.5;
    details.push(`优先级: ${priorityMatchScore === 1 ? '相同' : '不同'} (real=${real.priority}, shadow=${shadow.priority})`);

    const overallScore = Math.round(
      (deviceMatchScore + memoryMatchScore + priorityMatchScore) / 3 * 100
    ) / 100;

    return {
      deviceMatch: {
        matchScore: deviceMatchScore,
        details: [`设备: ${deviceMatchScore === 1 ? '一致' : '不同设备'}`],
      },
      memoryMatch: {
        matchScore: memoryMatchScore,
        details: [`内存差异: ${memDiff}MB`],
      },
      priorityMatch: {
        matchScore: priorityMatchScore,
        details: [`优先级: ${priorityMatchScore === 1 ? '一致' : '调整'}`],
      },
      overallScore,
      details,
    };
  }

  /**
   * 对比最终结果
   */
  public compareFinalResult(real: FinalResult, shadow: FinalResult): ResultComparisonResult {
    const details: string[] = [];

    // 结构对比
    const structureMatchScore = typeof real.data === typeof shadow.data ? 1 : 0;
    details.push(`结果类型: ${structureMatchScore === 1 ? '一致' : '不同'}`);

    // 值对比
    const valueMatchScore = this.deepEqual(real.data, shadow.data) ? 1 : 0.3;
    details.push(`结果值: ${valueMatchScore === 1 ? '完全匹配' : '存在差异'}`);

    // 错误对比
    const errorMatchScore = (real.error === undefined || real.error === null)
      === (shadow.error === undefined || shadow.error === null)
      ? 1 : 0.5;
    details.push(`错误状态: ${errorMatchScore === 1 ? '一致' : '不同'}`);

    const overallScore = Math.round(
      (structureMatchScore + valueMatchScore + errorMatchScore) / 3 * 100
    ) / 100;

    return {
      structureMatch: {
        matchScore: structureMatchScore,
        details: [`结果结构: ${structureMatchScore === 1 ? '一致' : '不一致'}`],
      },
      valueMatch: {
        matchScore: valueMatchScore,
        details: [`结果值: ${valueMatchScore >= 0.9 ? '相等' : '存在差异'}`],
      },
      errorMatch: {
        matchScore: errorMatchScore,
        details: [`错误: ${errorMatchScore === 1 ? '一致' : '差异'}`],
      },
      overallScore,
      details,
    };
  }

  /**
   * 获取对比历史
   */
  public getComparisonHistory(): FullComparisonReport[] {
    return [...this.comparisonHistory];
  }

  /**
   * 重置
   */
  public reset(): void {
    this.comparisonHistory = [];
  }

  /**
   * 比较并行分组
   */
  private compareParallelGroups(
    real: string[][],
    shadow: string[][]
  ): { matchCount: number; total: number; score: number } {
    if (real.length === 0 && shadow.length === 0) {
      return { matchCount: 1, total: 1, score: 1 };
    }

    let matchCount = 0;
    const total = Math.max(real.length, shadow.length);

    for (let i = 0; i < Math.min(real.length, shadow.length); i++) {
      const realGroup = new Set(real[i]);
      const shadowGroup = new Set(shadow[i]);
      const common = real[i].filter(id => shadowGroup.has(id));
      if (common.length === Math.max(real[i].length, shadow[i].length)) {
        matchCount++;
      }
    }

    return {
      matchCount,
      total,
      score: total > 0 ? matchCount / total : 1,
    };
  }

  /**
   * 深层比较
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== typeof b) return false;
    if (typeof a !== 'object') return a === b;

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )) {
        return false;
      }
    }

    return true;
  }
}
