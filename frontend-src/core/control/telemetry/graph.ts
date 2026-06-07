/**
 * core/api/request-graph.ts — Request DAG / Traceability
 *
 * Records every API request as a node in a directed graph.
 * Supports parent/child tracking for composite workflows,
 * retry chain visualization, and SSE lifecycle tracing.
 */

export interface RequestNode {
  id: string
  projectId: string
  url: string
  method: string
  status: 'pending' | 'success' | 'error' | 'aborted'
  parentId: string | null
  children: string[]
  retryCount: number
  retryOf: string | null
  durationMs: number | null
  statusCode: number | null
  errorMessage: string | null
  timestamp: number
  completedAt: number | null
  /** UI source file/component that initiated this request (set via markUIOrigin) */
  source: string | null
}

const nodes = new Map<string, RequestNode>()
const projectNodes = new Map<string, string[]>()  // projectId → nodeId[]

let nodeCounter = 0

// ─── UI Trace (Kernel Hook) ──────────────────────────────────────────

/** Currently active UI origin — set by markUIOrigin() before apiKernel calls */
let activeUIOrigin: string | null = null

/**
 * Mark the current UI component as origin for subsequent apiKernel calls.
 * Call this BEFORE apiKernel.execute/stream/command to tag the request chain.
 *
 * @example
 * ```ts
 * import { markUIOrigin } from '~/core/control/telemetry/graph'
 * markUIOrigin('FrameProduction.vue')
 * apiKernel.execute(...)
 * ```
 */
export function markUIOrigin(name: string): void {
  activeUIOrigin = name
}

/** Reset UI origin (after a batch of requests) */
export function clearUIOrigin(): void {
  activeUIOrigin = null
}

/** Get the currently active UI origin */
export function getUIOrigin(): string | null {
  return activeUIOrigin
}

function generateId(): string {
  return `req_${++nodeCounter}_${Date.now()}`
}

export const requestGraph = {
  /**
   * Start tracking a request. Returns the node id.
   */
  start(params: {
    url: string
    method: string
    projectId: string
    parentId?: string
    retryOf?: string
  }): string {
    const id = generateId()
    const node: RequestNode = {
      id,
      projectId: params.projectId,
      url: params.url,
      method: params.method,
      status: 'pending',
      parentId: params.parentId ?? null,
      children: [],
      retryCount: 0,
      retryOf: params.retryOf ?? null,
      durationMs: null,
      statusCode: null,
      errorMessage: null,
      timestamp: Date.now(),
      completedAt: null,
      source: activeUIOrigin,
    }

    nodes.set(id, node)

    // Register to project index
    const existing = projectNodes.get(params.projectId) ?? []
    existing.push(id)
    projectNodes.set(params.projectId, existing)

    // Link to parent
    if (params.parentId) {
      const parent = nodes.get(params.parentId)
      if (parent) {
        parent.children.push(id)
      }
    }

    return id
  },

  /**
   * Mark a request as completed (success or error).
   */
  complete(id: string, result: {
    status: 'success' | 'error' | 'aborted'
    statusCode?: number
    errorMessage?: string
  }): void {
    const node = nodes.get(id)
    if (!node) return

    node.status = result.status
    node.statusCode = result.statusCode ?? null
    node.errorMessage = result.errorMessage ?? null
    node.completedAt = Date.now()
    node.durationMs = node.completedAt - node.timestamp
  },

  /**
   * Record a retry attempt (creates child node).
   */
  retry(parentId: string, url: string, method: string, projectId: string): string {
    const node = nodes.get(parentId)
    const retryCount = node ? node.retryCount + 1 : 0
    const childId = this.start({
      url,
      method,
      projectId,
      parentId,
      retryOf: parentId,
    })
    // Increment parent retry count
    if (node) node.retryCount = retryCount
    return childId
  },

  /**
   * Get full trace for a request chain (follow parentId up to root).
   */
  getTrace(id: string): RequestNode[] {
    const trace: RequestNode[] = []
    let current = nodes.get(id)
    while (current) {
      trace.unshift(current)
      current = current.parentId ? nodes.get(current.parentId) : undefined
    }
    return trace
  },

  /**
   * Get all requests for a project.
   */
  getProjectRequests(projectId: string): RequestNode[] {
    const ids = projectNodes.get(projectId) ?? []
    return ids.map(id => nodes.get(id)).filter(Boolean) as RequestNode[]
  },

  /**
   * Get pending requests for a project (to abort on switch).
   */
  getPendingProjectRequests(projectId: string): RequestNode[] {
    return this.getProjectRequests(projectId).filter(n => n.status === 'pending')
  },

  /**
   * Get the entire graph (for debugging / admin UI).
   */
  getAllNodes(): RequestNode[] {
    return Array.from(nodes.values())
  },

  /**
   * Dump the UI → endpoint trace graph.
   * Groups all recorded requests by source, showing the IO cluster shape.
   *
   * Returns: `{ edges: { from, to, url, type }[], sources: string[], endpoints: string[] }`
   */
  getUITrace(): { edges: { from: string; to: string; url: string; type: string }[]; sources: string[]; endpoints: string[] } {
    const edges: { from: string; to: string; url: string; type: string }[] = []
    const sourcesSet = new Set<string>()
    const endpointsSet = new Set<string>()

    for (const node of nodes.values()) {
      if (node.source) {
        sourcesSet.add(node.source)
        endpointsSet.add(node.url)
        edges.push({
          from: node.source,
          to: node.url,
          url: node.url,
          type: node.method,
        })
      }
    }

    return {
      edges,
      sources: Array.from(sourcesSet).sort(),
      endpoints: Array.from(endpointsSet).sort(),
    }
  },

  /**
   * Export the trace as a Mermaid flowchart.
   * ```mermaid
   * graph TD
   *   FrameProduction.vue --> /execution-images/frames
   * ```
   */
  exportMermaidGraph(): string {
    const trace = this.getUITrace()
    const lines: string[] = ['graph TD']
    const seen = new Set<string>()
    for (const edge of trace.edges) {
      const key = `${edge.from}>>${edge.to}`
      if (!seen.has(key)) {
        seen.add(key)
        lines.push(`  ${edge.from} -->|${edge.type}| ${edge.to}`)
      }
    }
    return lines.join('\n')
  },

  /**
   * Reset all trace data AND the UI origin.
   */
  clear(): void {
    nodes.clear()
    projectNodes.clear()
    nodeCounter = 0
    activeUIOrigin = null
  },
}
