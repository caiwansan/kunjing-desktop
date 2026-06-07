// ============================================================
// Runtime Registry — Module Registration & Dependency Resolution
// 火麒麟AI导演控制台
// ============================================================

import type { KernelModule } from '../types'

/**
 * RuntimeRegistry manages all registered kernel modules.
 *
 * Responsibilities:
 * - Register / unregister modules
 * - Resolve topological dependency order
 * - Detect circular dependencies
 * - Validate module integrity (missing deps, cycles, duplicates)
 *
 * This is the first subsystem bootstrapped by RuntimeKernel.
 * All other subsystems and runtime modules must be registered here
 * before they can be managed.
 */
export class RuntimeRegistry {
  private readonly _modules: Map<string, KernelModule> = new Map()

  // ============================================================
  // Registration
  // ============================================================

  /**
   * Register a kernel module.
   * Throws if a module with the same id is already registered.
   */
  register(module: KernelModule): void {
    if (this._modules.has(module.id)) {
      throw new Error(
        `[RuntimeRegistry] Module '${module.id}' is already registered. ` +
        `Use unregister() first if you intend to replace it.`
      )
    }
    this._modules.set(module.id, module)
  }

  /**
   * Unregister a module by id.
   * Returns true if the module was removed, false if not found.
   */
  unregister(moduleId: string): boolean {
    return this._modules.delete(moduleId)
  }

  /**
   * Get a registered module by id.
   * Returns undefined if not found.
   */
  get(moduleId: string): KernelModule | undefined {
    return this._modules.get(moduleId)
  }

  /**
   * Get all registered modules as a readonly array.
   */
  getAll(): ReadonlyArray<KernelModule> {
    return Array.from(this._modules.values())
  }

  /**
   * Check whether a module is registered.
   */
  has(moduleId: string): boolean {
    return this._modules.has(moduleId)
  }

  /**
   * Return the number of registered modules.
   */
  get size(): number {
    return this._modules.size
  }

  // ============================================================
  // Dependency Resolution
  // ============================================================

  /**
   * Detect circular dependencies using topological sort (Kahn's algorithm).
   * Returns true if a cycle exists.
   *
   * Algorithm:
   * 1. Compute in-degree for every module
   * 2. Start with modules that have zero in-degree
   * 3. Process each, decrementing in-degree of dependents
   * 4. If remaining nodes > 0, a cycle exists
   */
  detectCircularDependencies(): boolean {
    const allIds = this._modules.keys()
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // Initialize
    for (const id of allIds) {
      inDegree.set(id, 0)
      adjacency.set(id, [])
    }

    // Build graph: if module A depends on B, then B → A edge
    for (const [id, mod] of this._modules) {
      for (const dep of mod.dependencies) {
        // Skip dependencies that haven't been registered (handled by validateIntegrity)
        if (!this._modules.has(dep)) continue
        adjacency.get(dep)!.push(id)
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
      }
    }

    // Kahn's algorithm
    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    let processed = 0
    while (queue.length > 0) {
      const node = queue.shift()!
      processed++
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) queue.push(neighbor)
      }
    }

    return processed !== this._modules.size
  }

  /**
   * Resolve modules in topological order (dependencies first).
   * Throws if circular dependencies are detected.
   *
   * Returns an array of module IDs in bootstrap order.
   */
  resolveDependencyOrder(): string[] {
    const allIds = Array.from(this._modules.keys())
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    const depMap = new Map<string, string[]>()

    for (const id of allIds) {
      inDegree.set(id, 0)
      adjacency.set(id, [])
      depMap.set(id, [])
    }

    for (const [id, mod] of this._modules) {
      depMap.set(id, mod.dependencies)
      for (const dep of mod.dependencies) {
        if (!this._modules.has(dep)) continue
        adjacency.get(dep)!.push(id)
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) queue.push(neighbor)
      }
    }

    if (result.length !== this._modules.size) {
      throw new Error(
        `[RuntimeRegistry] Circular dependency detected among modules. ` +
        `Resolved ${result.length}/${this._modules.size} modules. ` +
        `Remaining unprocessed: ${allIds.filter(id => !result.includes(id)).join(', ')}`
      )
    }

    return result
  }

  /**
   * Resolve modules in reverse topological order (for shutdown).
   */
  resolveShutdownOrder(): string[] {
    return this.resolveDependencyOrder().reverse()
  }

  // ============================================================
  // Integrity Validation
  // ============================================================

  /**
   * Validate the integrity of all registered modules.
   *
   * Checks:
   * 1. No circular dependencies
   * 2. All declared dependencies are registered
   * 3. No duplicate module IDs (enforced by register())
   *
   * Returns an array of error messages. Empty array = valid.
   */
  validateIntegrity(): string[] {
    const errors: string[] = []

    // Check unregistered dependencies
    for (const [id, mod] of this._modules) {
      for (const dep of mod.dependencies) {
        if (!this._modules.has(dep)) {
          errors.push(
            `Module '${id}' depends on '${dep}', which is not registered.`
          )
        }
      }
    }

    // Check circular dependencies
    if (this.detectCircularDependencies()) {
      errors.push(
        `Circular dependency detected among registered modules.`
      )
    }

    return errors
  }

  /**
   * Clear all registered modules (for testing / reset).
   */
  clear(): void {
    this._modules.clear()
  }
}
