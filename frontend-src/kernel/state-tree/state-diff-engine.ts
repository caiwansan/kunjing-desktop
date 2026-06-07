/**
 * StateDiffEngine — 状态差异引擎
 *
 * 提供三组核心能力：
 * 1. computeDiff(old, new) → 深度比较，只返回变化的部分
 * 2. applyPatch(base, patch)   → 将差异应用到 base 状态上
 * 3. serializeDiff(diff)        → 序列化为紧凑 JSON 格式（减少 DB 写入量）
 */

import type { StateDiff, StatePath } from './global-runtime-state';

// ── 公开类型 ──────────────────────────────────────────────────────

export interface CompactDiff {
  /** 时间戳 */
  t: number;
  /** changed: [path, oldValue, newValue][] */
  c?: Array<[string, unknown, unknown]>;
  /** added: [path, value][] */
  a?: Array<[string, unknown]>;
  /** removed: [path, oldValue][] */
  r?: Array<[string, unknown]>;
}

export type JSONPatch = CompactDiff;

// ── StateDiffEngine ───────────────────────────────────────────────

export class StateDiffEngine {
  // ── 计算差异 ────────────────────────────────────────────────────

  /**
   * 深度比较两个状态对象，返回 StateDiff
   * 只包含真实变化的节点（跳过未变子树）
   */
  computeDiff(oldState: Record<string, unknown>, newState: Record<string, unknown>): StateDiff {
    const changed: StateDiff['changed'] = [];
    const added: StateDiff['added'] = [];
    const removed: StateDiff['removed'] = [];

    this.traverse('', oldState, newState, changed, added, removed);

    return { changed, added, removed, timestamp: Date.now() };
  }

  // ── 应用补丁 ────────────────────────────────────────────────────

  /**
   * 将 StateDiff 应用到 baseState 的深拷贝上，返回新的状态
   * 不会修改原对象
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPatch(baseState: Record<string, any>, diff: StateDiff): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = JSON.parse(JSON.stringify(baseState));

    // 处理 removed — 删除路径
    for (const item of diff.removed) {
      this.removePath(result, item.path);
    }

    // 处理 added — 添加路径
    for (const item of diff.added) {
      this.setPath(result, item.path, item.value);
    }

    // 处理 changed — 更新路径
    for (const item of diff.changed) {
      this.setPath(result, item.path, item.newValue);
    }

    return result;
  }

  // ── 序列化 ──────────────────────────────────────────────────────

  /**
   * 将 StateDiff 序列化为紧凑 JSON 格式
   * 使用单字母 key 减少体积，适合 DB 写入
   */
  serializeDiff(diff: StateDiff): string {
    const compact: CompactDiff = { t: diff.timestamp };

    if (diff.changed.length > 0) {
      compact.c = diff.changed.map(item => [item.path, item.oldValue, item.newValue]);
    }
    if (diff.added.length > 0) {
      compact.a = diff.added.map(item => [item.path, item.value]);
    }
    if (diff.removed.length > 0) {
      compact.r = diff.removed.map(item => [item.path, item.oldValue]);
    }

    return JSON.stringify(compact);
  }

  /**
   * 从紧凑格式反序列化为标准 StateDiff
   */
  deserializeDiff(json: string): StateDiff {
    const compact: CompactDiff = JSON.parse(json);

    const diff: StateDiff = {
      changed: [],
      added: [],
      removed: [],
      timestamp: compact.t,
    };

    if (compact.c) {
      diff.changed = compact.c.map(([path, oldVal, newVal]) => ({
        path,
        oldValue: oldVal,
        newValue: newVal,
      }));
    }
    if (compact.a) {
      diff.added = compact.a.map(([path, value]) => ({ path, value }));
    }
    if (compact.r) {
      diff.removed = compact.r.map(([path, oldValue]) => ({ path, oldValue }));
    }

    return diff;
  }

  // ── 内部工具 ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private traverse(
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
          this.traverse(fullPath, oldVal[key], newVal[key], changed, added, removed);
        }
      }
    } else {
      changed.push({ path: basePath, oldValue: oldVal, newValue: newVal });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setPath(obj: Record<string, any>, path: StatePath, value: unknown): void {
    const segments = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!(seg in current) || current[seg] === null || typeof current[seg] !== 'object') {
        current[seg] = {};
      }
      current = current[seg];
    }
    current[segments[segments.length - 1]] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private removePath(obj: Record<string, any>, path: StatePath): void {
    const segments = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;
    for (let i = 0; i < segments.length - 1; i++) {
      if (!(segments[i] in current)) return;
      current = current[segments[i]];
    }
    delete current[segments[segments.length - 1]];
  }
}
