export interface SystemMetrics {
  stability: number;        // 0-100 稳定性评分
  latency: number;          // 平均延迟(ms)
  successRate: number;      // 0-1 成功率
  gpuUsage: number;         // 0-100 GPU利用率(%)
  cpuUsage: number;         // 0-100 CPU利用率(%)
  memoryUsage: number;      // 内存使用(MB)
  throughput: number;       // TPS
  errorRate: number;        // 0-1 错误率
}

export interface ComparisonReport {
  stability: {
    kernel: number;
    legacy: number;
    diff: number;
    verdict: 'better' | 'worse' | 'equal';
  };
  latency: {
    kernel: number;
    legacy: number;
    diff: number;
    verdict: 'better' | 'worse' | 'equal';
  };
  successRate: {
    kernel: number;
    legacy: number;
    diff: number;
    verdict: 'better' | 'worse' | 'equal';
  };
  gpuUsage: {
    kernel: number;
    legacy: number;
    diff: number;
    verdict: 'better' | 'worse' | 'equal';
  };
  recommendation: {
    shouldAdopt: boolean;
    confidence: number;
    reasons: string[];
    risks: string[];
  };
}

/**
 * KernelHealthComparator - 内核健康度比较器
 *
 * 对比Kernel和旧Runtime的性能指标，判断Kernel是否更优
 */
export class KernelHealthComparator {
  private lastKernelMetrics: SystemMetrics | null = null;
  private lastLegacyMetrics: SystemMetrics | null = null;
  private lastReport: ComparisonReport | null = null;
  private comparisonHistory: ComparisonReport[] = [];

  /**
   * 对比两套系统的健康指标
   */
  public compare(kernelMetrics: SystemMetrics, oldRuntimeMetrics: SystemMetrics): ComparisonReport {
    this.lastKernelMetrics = kernelMetrics;
    this.lastLegacyMetrics = oldRuntimeMetrics;

    const report: ComparisonReport = {
      stability: this.compareMetric('stability', kernelMetrics.stability, oldRuntimeMetrics.stability, 'higher'),
      latency: this.compareMetric('latency', kernelMetrics.latency, oldRuntimeMetrics.latency, 'lower'),
      successRate: this.compareMetric('successRate', kernelMetrics.successRate, oldRuntimeMetrics.successRate, 'higher'),
      gpuUsage: this.compareMetric('gpuUsage', kernelMetrics.gpuUsage, oldRuntimeMetrics.gpuUsage, 'lower'),
      recommendation: this.generateRecommendation(kernelMetrics, oldRuntimeMetrics),
    };

    this.lastReport = report;
    this.comparisonHistory.push(report);
    return report;
  }

  /**
   * 获取最新的对比报告
   */
  public getComparisonReport(): ComparisonReport | null {
    return this.lastReport;
  }

  /**
   * Kernel是否优于旧Runtime
   * 基于综合评分判断
   */
  public isKernelBetter(): boolean {
    if (!this.lastReport) return false;

    const { recommendation } = this.lastReport;
    return recommendation.shouldAdopt && recommendation.confidence >= 0.6;
  }

  /**
   * 获取历史比对结果
   */
  public getComparisonHistory(): ComparisonReport[] {
    return [...this.comparisonHistory];
  }

  /**
   * 获取Kernel综合健康评分 (0-100)
   */
  public getKernelHealthScore(metrics: SystemMetrics): number {
    const stabilityScore = metrics.stability * 0.3;
    const latencyScore = this.normalizeInverse(metrics.latency, 0, 500) * 0.2;
    const successScore = metrics.successRate * 100 * 0.3;
    const gpuScore = this.normalizeInverse(metrics.gpuUsage, 0, 100) * 0.1;
    const cpuScore = this.normalizeInverse(metrics.cpuUsage, 0, 100) * 0.05;
    const memScore = this.normalizeInverse(metrics.memoryUsage, 0, 4096) * 0.05;

    return Math.round(
      stabilityScore + latencyScore + successScore + gpuScore + cpuScore + memScore
    );
  }

  /**
   * 重置
   */
  public reset(): void {
    this.lastKernelMetrics = null;
    this.lastLegacyMetrics = null;
    this.lastReport = null;
    this.comparisonHistory = [];
  }

  /**
   * 比较单个指标
   */
  private compareMetric(
    name: string,
    kernel: number,
    legacy: number,
    betterDirection: 'higher' | 'lower',
  ): ComparisonReport['stability'] {
    const diff = Math.round((kernel - legacy) * 100) / 100;

    let verdict: 'better' | 'worse' | 'equal';
    const threshold = name === 'successRate' ? 0.01 : 5; // 1% or 5 units

    if (Math.abs(diff) <= threshold) {
      verdict = 'equal';
    } else if (betterDirection === 'higher') {
      verdict = diff > 0 ? 'better' : 'worse';
    } else {
      verdict = diff < 0 ? 'better' : 'worse';
    }

    return { kernel, legacy, diff, verdict };
  }

  /**
   * 生成采纳建议
   */
  private generateRecommendation(
    kernel: SystemMetrics,
    legacy: SystemMetrics,
  ): ComparisonReport['recommendation'] {
    const reasons: string[] = [];
    const risks: string[] = [];

    // 稳定性评估
    if (kernel.stability >= legacy.stability) {
      reasons.push(`Kernel稳定性 ${kernel.stability.toFixed(1)} >= 旧Runtime ${legacy.stability.toFixed(1)}`);
    } else {
      risks.push(`Kernel稳定性 ${kernel.stability.toFixed(1)} < 旧Runtime ${legacy.stability.toFixed(1)}`);
    }

    // 延迟评估
    if (kernel.latency <= legacy.latency) {
      reasons.push(`Kernel延迟 ${kernel.latency.toFixed(1)}ms <= 旧Runtime ${legacy.latency.toFixed(1)}ms`);
    } else {
      risks.push(`Kernel延迟 ${kernel.latency.toFixed(1)}ms > 旧Runtime ${legacy.latency.toFixed(1)}ms`);
    }

    // 成功率评估
    if (kernel.successRate >= legacy.successRate) {
      reasons.push(`Kernel成功率 ${(kernel.successRate * 100).toFixed(1)}% >= 旧Runtime ${(legacy.successRate * 100).toFixed(1)}%`);
    } else {
      risks.push(`Kernel成功率 ${(kernel.successRate * 100).toFixed(1)}% < 旧Runtime ${(legacy.successRate * 100).toFixed(1)}%`);
    }

    // GPU利用率（越低越好）
    if (kernel.gpuUsage <= legacy.gpuUsage) {
      reasons.push(`Kernel GPU利用率 ${kernel.gpuUsage.toFixed(1)}% <= 旧Runtime ${legacy.gpuUsage.toFixed(1)}%`);
    } else {
      risks.push(`Kernel GPU利用率 ${kernel.gpuUsage.toFixed(1)}% > 旧Runtime ${legacy.gpuUsage.toFixed(1)}%`);
    }

    // 错误率检查
    if (kernel.errorRate > 0.03) {
      risks.push(`Kernel错误率 ${(kernel.errorRate * 100).toFixed(1)}% 超过3%安全阈值`);
    }

    // 计算信心分数
    const betterCount = reasons.length;
    const worseCount = risks.length;
    const confidence = betterCount + worseCount > 0
      ? Math.round(betterCount / (betterCount + worseCount) * 100) / 100
      : 0.5;

    const shouldAdopt = confidence >= 0.6 && kernel.errorRate <= 0.03;

    return {
      shouldAdopt,
      confidence,
      reasons,
      risks,
    };
  }

  /**
   * 反转归一化值 (越低越好)
   */
  private normalizeInverse(value: number, min: number, max: number): number {
    if (value <= min) return 1;
    if (value >= max) return 0;
    return Math.round((1 - (value - min) / (max - min)) * 100);
  }
}
