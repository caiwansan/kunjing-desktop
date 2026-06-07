export type MetricName =
  | 'event_latency_ms'
  | 'scheduler_delay_ms'
  | 'gpu_utilization_pct'
  | 'worker_load_pct'
  | 'state_sync_delay_ms'
  | 'kernel_memory_mb'
  | 'kernel_cpu_pct'
  | 'throughput_tps';

export interface MetricPoint {
  name: MetricName;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: MetricName;
  points: MetricPoint[];
  min: number;
  max: number;
  avg: number;
  last: number;
  count: number;
}

export interface Alert {
  id: string;
  metric: MetricName;
  threshold: number;
  currentValue: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: number;
  acknowledged: boolean;
}

export interface ThresholdConfig {
  metric: MetricName;
  warning: number;
  critical: number;
  operator: 'gt' | 'lt';
}

/**
 * KernelObservabilityMirror - 内核可观测性镜像
 *
 * 监控维度：
 * - Event latency: 事件延迟
 * - Scheduler delay: 调度器延迟
 * - GPU utilization: GPU利用率
 * - Worker load: Worker负载
 * - State sync delay: 状态同步延迟
 */
export class KernelObservabilityMirror {
  private metrics: Map<MetricName, MetricPoint[]> = new Map();
  private alerts: Alert[] = [];
  private maxHistoryPoints: number = 1000;

  // 默认阈值配置
  private defaultThresholds: ThresholdConfig[] = [
    { metric: 'event_latency_ms', warning: 100, critical: 500, operator: 'gt' },
    { metric: 'scheduler_delay_ms', warning: 50, critical: 200, operator: 'gt' },
    { metric: 'gpu_utilization_pct', warning: 85, critical: 95, operator: 'gt' },
    { metric: 'worker_load_pct', warning: 80, critical: 90, operator: 'gt' },
    { metric: 'state_sync_delay_ms', warning: 200, critical: 1000, operator: 'gt' },
    { metric: 'kernel_memory_mb', warning: 1024, critical: 2048, operator: 'gt' },
    { metric: 'kernel_cpu_pct', warning: 70, critical: 90, operator: 'gt' },
    { metric: 'throughput_tps', warning: 50, critical: 20, operator: 'lt' },
  ];

  /**
   * 记录一个指标点
   */
  public recordMetric(name: MetricName, value: number, labels?: Record<string, string>): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: Date.now(),
      labels,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const series = this.metrics.get(name)!;
    series.push(point);

    // 限制历史点数量
    if (series.length > this.maxHistoryPoints) {
      series.splice(0, series.length - this.maxHistoryPoints);
    }
  }

  /**
   * 批量记录指标
   */
  public recordMetrics(points: { name: MetricName; value: number; labels?: Record<string, string> }[]): void {
    for (const p of points) {
      this.recordMetric(p.name, p.value, p.labels);
    }
  }

  /**
   * 获取某个指标的所有数据
   */
  public getMetric(name: MetricName): MetricPoint[] {
    return [...(this.metrics.get(name) || [])];
  }

  /**
   * 获取所有指标的最新值
   */
  public getLatestMetrics(): Record<MetricName, number | null> {
    const result: Record<string, number | null> = {};
    for (const [name, points] of this.metrics.entries()) {
      result[name] = points.length > 0 ? points[points.length - 1].value : null;
    }
    return result as Record<MetricName, number | null>;
  }

  /**
   * 获取所有指标的统计摘要
   */
  public getMetricSeries(): MetricSeries[] {
    const series: MetricSeries[] = [];

    for (const [name, points] of this.metrics.entries()) {
      if (points.length === 0) continue;

      const values = points.map(p => p.value);
      series.push({
        name,
        points: [...points],
        min: Math.min(...values),
        max: Math.max(...values),
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100,
        last: values[values.length - 1],
        count: points.length,
      });
    }

    return series;
  }

  /**
   * 获取所有指标
   */
  public getMetrics(): MetricPoint[] {
    const all: MetricPoint[] = [];
    for (const points of this.metrics.values()) {
      all.push(...points);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 阈值检测 —— 触发告警
   */
  public getAlert(thresholds?: ThresholdConfig[]): Alert[] {
    const configs = thresholds || this.defaultThresholds;
    const newAlerts: Alert[] = [];
    const latest = this.getLatestMetrics();

    for (const config of configs) {
      const currentValue = latest[config.metric];
      if (currentValue === null) continue;

      let triggered = false;
      switch (config.operator) {
        case 'gt':
          triggered = currentValue > config.critical;
          break;
        case 'lt':
          triggered = currentValue < config.critical;
          break;
      }

      if (triggered) {
        const alert: Alert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          metric: config.metric,
          threshold: config.critical,
          currentValue,
          operator: config.operator,
          severity: 'critical',
          message: this.buildAlertMessage(config.metric, currentValue, config.critical),
          triggeredAt: Date.now(),
          acknowledged: false,
        };
        newAlerts.push(alert);
        this.alerts.push(alert);
      }
    }

    return newAlerts;
  }

  /**
   * 获取所有历史告警
   */
  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * 获取未处理的告警
   */
  public getUnacknowledgedAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * 确认告警
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * 设置历史点上限
   */
  public setMaxHistoryPoints(max: number): void {
    this.maxHistoryPoints = max;
  }

  /**
   * 清空所有指标数据
   */
  public clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * 清空所有告警
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 获取最近 N 秒的指标
   */
  public getRecentMetrics(seconds: number): MetricPoint[] {
    const cutoff = Date.now() - seconds * 1000;
    const all: MetricPoint[] = [];

    for (const points of this.metrics.values()) {
      for (const p of points) {
        if (p.timestamp >= cutoff) {
          all.push(p);
        }
      }
    }

    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 构建告警消息
   */
  private buildAlertMessage(metric: MetricName, value: number, threshold: number): string {
    const metricNames: Record<MetricName, string> = {
      event_latency_ms: '事件延迟',
      scheduler_delay_ms: '调度延迟',
      gpu_utilization_pct: 'GPU利用率',
      worker_load_pct: 'Worker负载',
      state_sync_delay_ms: '状态同步延迟',
      kernel_memory_mb: 'Kernel内存',
      kernel_cpu_pct: 'Kernel CPU',
      throughput_tps: '吞吐量',
    };

    const name = metricNames[metric] || metric;
    return `${name} 异常: 当前值 ${value}，阈值 ${threshold}`;
  }
}
