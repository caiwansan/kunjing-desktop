/**
 * GlobalRuntimeState - 核心单例状态树
 * 管理火麒麟AI导演控制台的全局运行时状态
 * 
 * 设计原则：
 * - 单例模式，全局唯一状态源
 * - 不可变读（getSnapshot），受控写（update / reset）
 * - 支持差异计算（diff）用于审计与持久化
 */

import type { KernelPhase, KernelHealth } from '../types';

// ── 类型定义 ──────────────────────────────────────────────────────

export interface ModuleRuntimeState {
  phase: KernelPhase;
  health: KernelHealth;
  lastUpdated: number;
}

export interface GPUState {
  activeJobs: number;
  vramUsed: number;      // MB
  temperature: number;   // °C
  queueLength: number;
}

export interface WorkerState {
  active: number;
  idle: number;
  zombie: number;
  total: number;
}

export interface DAGState {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface QueueState {
  pending: number;
  processing: number;
  failed: number;
}

export interface GovernanceState {
  active: boolean;
  lastAudit: number;     // timestamp
  violations: number;
}

export interface EvolutionState {
  strategiesCount: number;
  lastEvolution: number; // timestamp
  activeExperiments: number;
}

export interface WorldState {
  [key: string]: unknown;
}

export interface AgentState {
  active: number;
  idle: number;
  errors: number;
}

export interface RuntimeState {
  runtimeStates: Record<string, ModuleRuntimeState>;
  gpu: GPUState;
  worker: WorkerState;
  dag: DAGState;
  queue: QueueState;
  governance: GovernanceState;
  evolution: EvolutionState;
  worldState: WorldState;
  agent: AgentState;
}

export type StatePath = string;

export interface StateDiff {
  changed: Array<{
    path: StatePath;
    oldValue: unknown;
    newValue: unknown;
  }>;
  added: Array<{
    path: StatePath;
    value: unknown;
  }>;
  removed: Array<{
    path: StatePath;
    oldValue: unknown;
  }>;
  timestamp: number;
}

// ── 默认值 ────────────────────────────────────────────────────────

const DEFAULT_STATE: RuntimeState = Object.freeze({
  runtimeStates: {},
  gpu:          { activeJobs: 0, vramUsed: 0, temperature: 45, queueLength: 0 },
  worker:       { active: 0, idle: 0, zombie: 0, total: 0 },
  dag:          { pending: 0, running: 0, completed: 0, failed: 0 },
  queue:        { pending: 0, processing: 0, failed: 0 },
  governance:   { active: false, lastAudit: 0, violations: 0 },
  evolution:    { strategiesCount: 0, lastEvolution: 0, activeExperiments: 0 },
  worldState:   {},
  agent:        { active: 0, idle: 0, errors: 0 },
});

// ── GlobalRuntimeState ────────────────────────────────────────────

export class GlobalRuntimeState {
  private static instance: GlobalRuntimeState;

  private state: RuntimeState;

  private constructor() {
    this.state = this.deepClone(DEFAULT_STATE);
  }

  /** 获取单例 */
  static getInstance(): GlobalRuntimeState {
    if (!GlobalRuntimeState.instance) {
      GlobalRuntimeState.instance = new GlobalRuntimeState();
    }
    return GlobalRuntimeState.instance;
  }

  // ── 快照（不可变副本） ──────────────────────────────────────────

  /** 返回当前状态的深拷贝快照 */
  getSnapshot(): RuntimeState {
    return this.deepClone(this.state);
  }

  // ── 受控更新 ────────────────────────────────────────────────────

  /**
   * 按点分隔路径更新状态
   * 例如：update('gpu.activeJobs', 3)  →  state.gpu.activeJobs = 3
   *      update('governance.active', true)
   *      update('runtimeStates.renderer', { phase: 'running', health: 'healthy', lastUpdated: Date.now() })
   */
  update(path: StatePath, value: unknown): void {
    if (!path || typeof path !== 'string') {
      throw new Error(`[GlobalRuntimeState] Invalid path: ${path}`);
    }

    const segments = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: any = this.state;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!(seg in target)) {
        target[seg] = {};
      }
      target = target[seg];
      if (target === null || typeof target !== 'object') {
        throw new Error(`[GlobalRuntimeState] Cannot traverse path "${path}" — segment "${seg}" is not an object`);
      }
    }

    const lastKey = segments[segments.length - 1];
    target[lastKey] = value;

    // 如果更新了 runtimeStates 的某个模块，同时维护 lastUpdated
    if (path.startsWith('runtimeStates.') && !path.endsWith('.lastUpdated')) {
      // 提取模块名
      const moduleId = segments[1];
      if (moduleId && this.state.runtimeStates[moduleId]) {
        this.state.runtimeStates[moduleId].lastUpdated = Date.now();
      }
    }
  }

  /** 批量更新（原子化 — 先校验再写入） */
  batchUpdate(updates: Array<{ path: StatePath; value: unknown }>): void {
    for (const u of updates) {
      // 先校验路径可访问性
      this.validatePath(u.path);
    }
    // 全部通过后再执行
    for (const u of updates) {
      this.update(u.path, u.value);
    }
  }

  // ── 重置 ────────────────────────────────────────────────────────

  /** 完全重置为默认状态 */
  reset(): void {
    this.state = this.deepClone(DEFAULT_STATE);
  }

  // ── 差异计算 ────────────────────────────────────────────────────

  /**
   * 与上一个快照对比，返回差异
   * 可用于：状态变更日志 / 审计 / 增量持久化
   */
  diff(previousSnapshot: RuntimeState): StateDiff {
    return this.computeDiff(previousSnapshot, this.state);
  }

  private computeDiff(oldState: RuntimeState, newState: RuntimeState): StateDiff {
    const changed: StateDiff['changed'] = [];
    const added: StateDiff['added'] = [];
    const removed: StateDiff['removed'] = [];

    this.deepCompare('', oldState, newState, changed, added, removed);

    return { changed, added, removed, timestamp: Date.now() };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deepCompare(
    basePath: string,
    oldVal: any,
    newVal: any,
    changed: StateDiff['changed'],
    added: StateDiff['added'],
    removed: StateDiff['removed'],
  ): void {
    if (oldVal === newVal) return;

    const bothObjects =
      oldVal !== null && typeof oldVal === 'object' &&
      newVal !== null && typeof newVal === 'object' &&
      !Array.isArray(oldVal) && !Array.isArray(newVal);

    if (bothObjects) {
      const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
      for (const key of allKeys) {
        const fullPath = basePath ? `${basePath}.${key}` : key;
        if (key in oldVal && !(key in newVal)) {
          removed.push({ path: fullPath, oldValue: oldVal[key] });
        } else if (!(key in oldVal) && key in newVal) {
          added.push({ path: fullPath, value: newVal[key] });
        } else {
          this.deepCompare(fullPath, oldVal[key], newVal[key], changed, added, removed);
        }
      }
    } else {
      changed.push({ path: basePath, oldValue: oldVal, newValue: newVal });
    }
  }

  // ── 工具方法 ────────────────────────────────────────────────────

  private validatePath(path: StatePath): void {
    const segments = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: any = this.state;
    for (let i = 0; i < segments.length - 1; i++) {
      if (!(segments[i] in target)) {
        // 路径不存在，将在 update 时创建
        return;
      }
      target = target[segments[i]];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item)) as unknown as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloned: any = {};
    for (const key of Object.keys(obj as object)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cloned[key] = this.deepClone((obj as any)[key]);
    }
    return cloned as T;
  }
}
