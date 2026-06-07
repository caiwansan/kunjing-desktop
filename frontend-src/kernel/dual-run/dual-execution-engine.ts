export interface DualTask {
  id: string;
  type: string;
  payload: unknown;
  submittedAt?: number;
}

export interface ExecutionResult {
  taskId: string;
  source: 'legacy' | 'kernel' | 'shadow';
  success: boolean;
  output: unknown;
  latencyMs: number;
  resourceUsage: ResourceUsage;
  error?: string;
  completedAt: number;
}

export interface ResourceUsage {
  cpuMs: number;
  memoryMb: number;
  gpuMs: number;
  gpuMemoryMb: number;
}

export interface DualExecutionReport {
  taskId: string;
  legacy: ExecutionResult;
  kernel: ExecutionResult;
  match: boolean;
  matchScore: number;
  latencyDiffMs: number;
  resourceDiff: {
    cpuMs: number;
    memoryMb: number;
    gpuMs: number;
    gpuMemoryMb: number;
  };
  comparedAt: number;
}

export class DualExecutionEngine {
  private executionHistory: DualExecutionReport[] = [];
  private matchCount: number = 0;
  private totalCount: number = 0;
  private totalLegacyLatency: number = 0;
  private totalKernelLatency: number = 0;
  private totalLegacyCpu: number = 0;
  private totalKernelCpu: number = 0;
  private totalLegacyMemory: number = 0;
  private totalKernelMemory: number = 0;
  private totalLegacyGpu: number = 0;
  private totalKernelGpu: number = 0;
  private totalLegacyGpuMem: number = 0;
  private totalKernelGpuMem: number = 0;

  /**
   * 同时提交到旧Runtime和Kernel Shadow执行
   */
  public async executeTask(task: DualTask): Promise<DualExecutionReport> {
    task.submittedAt = Date.now();

    const [legacyResult, kernelResult] = await Promise.all([
      this.executeInLegacy(task),
      this.executeInKernel(task),
    ]);

    const report = this.compareResults(legacyResult, kernelResult);
    this.executionHistory.push(report);
    this.totalCount++;

    return report;
  }

  /**
   * 对比两组输出并生成报告
   */
  public compareResults(legacy: ExecutionResult, kernel: ExecutionResult): DualExecutionReport {
    const match = this.deepEqual(legacy.output, kernel.output);
    const matchScore = match ? 1 : this.calculateSimilarity(legacy.output, kernel.output);
    const latencyDiffMs = kernel.latencyMs - legacy.latencyMs;

    if (match) {
      this.matchCount++;
    }

    // 累加统计
    this.totalLegacyLatency += legacy.latencyMs;
    this.totalKernelLatency += kernel.latencyMs;
    this.totalLegacyCpu += legacy.resourceUsage.cpuMs;
    this.totalKernelCpu += kernel.resourceUsage.cpuMs;
    this.totalLegacyMemory += legacy.resourceUsage.memoryMb;
    this.totalKernelMemory += kernel.resourceUsage.memoryMb;
    this.totalLegacyGpu += legacy.resourceUsage.gpuMs;
    this.totalKernelGpu += kernel.resourceUsage.gpuMs;
    this.totalLegacyGpuMem += legacy.resourceUsage.gpuMemoryMb;
    this.totalKernelGpuMem += kernel.resourceUsage.gpuMemoryMb;

    return {
      taskId: legacy.taskId,
      legacy,
      kernel,
      match,
      matchScore,
      latencyDiffMs,
      resourceDiff: {
        cpuMs: kernel.resourceUsage.cpuMs - legacy.resourceUsage.cpuMs,
        memoryMb: kernel.resourceUsage.memoryMb - legacy.resourceUsage.memoryMb,
        gpuMs: kernel.resourceUsage.gpuMs - legacy.resourceUsage.gpuMs,
        gpuMemoryMb: kernel.resourceUsage.gpuMemoryMb - legacy.resourceUsage.gpuMemoryMb,
      },
      comparedAt: Date.now(),
    };
  }

  /**
   * 获取匹配率 (0-1)
   */
  public getMatchRate(): number {
    if (this.totalCount === 0) return 0;
    return this.matchCount / this.totalCount;
  }

  /**
   * 获取平均延迟差异 (ms)
   * 正数 = Kernel更慢，负数 = Kernel更快
   */
  public getLatencyDiff(): number {
    if (this.totalCount === 0) return 0;
    const avgLegacy = this.totalLegacyLatency / this.totalCount;
    const avgKernel = this.totalKernelLatency / this.totalCount;
    return Math.round((avgKernel - avgLegacy) * 100) / 100;
  }

  /**
   * 获取平均资源消耗差异
   */
  public getResourceDiff(): {
    cpuMs: number;
    memoryMb: number;
    gpuMs: number;
    gpuMemoryMb: number;
  } {
    if (this.totalCount === 0) {
      return { cpuMs: 0, memoryMb: 0, gpuMs: 0, gpuMemoryMb: 0 };
    }

    return {
      cpuMs: Math.round((this.totalKernelCpu - this.totalLegacyCpu) / this.totalCount * 100) / 100,
      memoryMb: Math.round((this.totalKernelMemory - this.totalLegacyMemory) / this.totalCount * 100) / 100,
      gpuMs: Math.round((this.totalKernelGpu - this.totalLegacyGpu) / this.totalCount * 100) / 100,
      gpuMemoryMb: Math.round((this.totalKernelGpuMem - this.totalLegacyGpuMem) / this.totalCount * 100) / 100,
    };
  }

  /**
   * 获取所有执行报告
   */
  public getExecutionHistory(): DualExecutionReport[] {
    return [...this.executionHistory];
  }

  /**
   * 获取执行统计摘要
   */
  public getStats(): {
    totalExecutions: number;
    matchRate: number;
    avgLatencyDiffMs: number;
    avgResourceDiff: ReturnType<DualExecutionEngine['getResourceDiff']>;
  } {
    return {
      totalExecutions: this.totalCount,
      matchRate: this.getMatchRate(),
      avgLatencyDiffMs: this.getLatencyDiff(),
      avgResourceDiff: this.getResourceDiff(),
    };
  }

  /**
   * 重置所有统计
   */
  public reset(): void {
    this.executionHistory = [];
    this.matchCount = 0;
    this.totalCount = 0;
    this.totalLegacyLatency = 0;
    this.totalKernelLatency = 0;
    this.totalLegacyCpu = 0;
    this.totalKernelCpu = 0;
    this.totalLegacyMemory = 0;
    this.totalKernelMemory = 0;
    this.totalLegacyGpu = 0;
    this.totalKernelGpu = 0;
    this.totalLegacyGpuMem = 0;
    this.totalKernelGpuMem = 0;
  }

  /**
   * 在旧Runtime中执行
   */
  private async executeInLegacy(task: DualTask): Promise<ExecutionResult> {
    const startTime = performance.now();
    try {
      // 模拟旧Runtime执行 —— 实际对接由外部注入
      const output = await this.simulateLegacyExecution(task);
      return {
        taskId: task.id,
        source: 'legacy',
        success: true,
        output,
        latencyMs: Math.round(performance.now() - startTime),
        resourceUsage: {
          cpuMs: Math.round(Math.random() * 50 + 10),
          memoryMb: Math.round(Math.random() * 100 + 20),
          gpuMs: Math.round(Math.random() * 30 + 5),
          gpuMemoryMb: Math.round(Math.random() * 500 + 100),
        },
        completedAt: Date.now(),
      };
    } catch (err) {
      return {
        taskId: task.id,
        source: 'legacy',
        success: false,
        output: null,
        latencyMs: Math.round(performance.now() - startTime),
        resourceUsage: { cpuMs: 0, memoryMb: 0, gpuMs: 0, gpuMemoryMb: 0 },
        error: err instanceof Error ? err.message : String(err),
        completedAt: Date.now(),
      };
    }
  }

  /**
   * 在Kernel Shadow中执行
   */
  private async executeInKernel(task: DualTask): Promise<ExecutionResult> {
    const startTime = performance.now();
    try {
      const output = await this.simulateKernelExecution(task);
      return {
        taskId: task.id,
        source: 'kernel',
        success: true,
        output,
        latencyMs: Math.round(performance.now() - startTime),
        resourceUsage: {
          cpuMs: Math.round(Math.random() * 40 + 8),
          memoryMb: Math.round(Math.random() * 80 + 15),
          gpuMs: Math.round(Math.random() * 25 + 3),
          gpuMemoryMb: Math.round(Math.random() * 400 + 80),
        },
        completedAt: Date.now(),
      };
    } catch (err) {
      return {
        taskId: task.id,
        source: 'kernel',
        success: false,
        output: null,
        latencyMs: Math.round(performance.now() - startTime),
        resourceUsage: { cpuMs: 0, memoryMb: 0, gpuMs: 0, gpuMemoryMb: 0 },
        error: err instanceof Error ? err.message : String(err),
        completedAt: Date.now(),
      };
    }
  }

  /**
   * 模拟旧Runtime执行（占位，实际应由外部注入）
   */
  private async simulateLegacyExecution(task: DualTask): Promise<unknown> {
    // 模拟异步延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
    return { success: true, taskId: task.id, source: 'legacy', data: task.payload };
  }

  /**
   * 模拟Kernel执行（占位，实际应由外部注入）
   */
  private async simulateKernelExecution(task: DualTask): Promise<unknown> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 15 + 3));
    return { success: true, taskId: task.id, source: 'kernel', data: task.payload };
  }

  /**
   * 深层比较两个值是否完全相等
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

  /**
   * 计算两个输出的相似度 (0-1)
   */
  private calculateSimilarity(a: unknown, b: unknown): number {
    // 简单的基于类型的相似度估算
    if (typeof a !== typeof b) return 0;

    if (typeof a === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a as Record<string, unknown>);
      const keysB = Object.keys(b as Record<string, unknown>);
      const commonKeys = keysA.filter(k => keysB.includes(k));
      if (keysA.length === 0 && keysB.length === 0) return 1;
      return commonKeys.length / Math.max(keysA.length, keysB.length);
    }

    return a === b ? 1 : 0;
  }
}
