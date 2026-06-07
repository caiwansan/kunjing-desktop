/**
 * core/runtime/project-kernel.ts — Project Identity Runtime Kernel
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SINGLE SOURCE OF TRUTH for project identity.
 *
 * ARCHITECTURE:
 *   Kernel (this file)  → 唯一真源
 *     ├── sync → localStorage (persistence adapter, passive only)
 *     ├── sync → hydrationStore (projection)
 *     ├── sync → pipelineStore  (projection)
 *     ├── sync → studioStore    (projection)
 *     └── sync → route          (primary init source)
 *
 * RULES:
 *   1. ONLY this file may write 'current_project_id' to localStorage
 *   2. ONLY projectKernel.setProject() may change projectId
 *   3. ALL other code MUST use projectKernel.projectId (readonly)
 *   4. NO falling back to localStorage as state source
 *   5. NO silent defaults — missing state = explicit error
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Persistence Key ─────────────────────────────────────────────────
const LS_KEY = 'current_project_id'

// ─── State ───────────────────────────────────────────────────────────

type ProjectKernelState = {
  projectId: string | null
  /** Monotonic version — increments on every setProject() */
  version: number
  /** Timestamp of last change */
  updatedAt: number
  /** Runtime consistency guard */
  inconsistent: boolean
}

let state: ProjectKernelState = {
  projectId: null,
  version: 0,
  updatedAt: 0,
  inconsistent: false,
}

// ─── Versioned Subscribers ───────────────────────────────────────────

type Subscriber = (pid: string | null, oldPid: string | null) => void
const subscribers = new Set<Subscriber>()

function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notify(pid: string | null, oldPid: string | null) {
  for (const fn of subscribers) fn(pid, oldPid)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('project:switch', { detail: { from: oldPid, to: pid } }))
  }
}

// ─── Persistence Adapter (passive) ───────────────────────────────────

function loadFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

function persistToStorage(pid: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (pid) localStorage.setItem(LS_KEY, pid)
    else localStorage.removeItem(LS_KEY)
  } catch { /* silent */ }
}

// ─── Runtime Guard ──────────────────────────────────────────────────

/**
 * Check runtime consistency between kernel state and route / another source.
 * Does NOT throw — sets `state.inconsistent` flag instead.
 * Consumers should check `projectKernel.inconsistent` and act accordingly.
 */
function checkConsistency(routePid: string | null, label: string = 'route'): void {
  const kPid = state.projectId
  if (kPid && routePid && kPid !== routePid) {
    console.error(
      `[ProjectKernel] ⚠ RUNTIME INCONSISTENT: kernel=${kPid} ${label}=${routePid}. ` +
      `Falling back to kernel value.`
    )
    state.inconsistent = true
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export const projectKernel = {
  /**
   * ONLY legal write path for project identity.
   *
   * - Updates internal state
   * - Notifies subscribers (projection stores)
   * - Persists to localStorage (passive)
   */
  setProject(pid: string | null): void {
    const old = state.projectId
    if (pid === old) return  // no-op
    state.projectId = pid
    state.version++
    state.updatedAt = Date.now()
    state.inconsistent = false  // explicit set clears inconsistency
    persistToStorage(pid)
    notify(pid, old)
  },

  /**
   * Init kernel from route param + localStorage fallback.
   * Call ONCE at app bootstrap (production.vue onMounted).
   *
   * Priority: route param > localStorage > null
   */
  init(routeProjectId?: string | null): void {
    const fromRoute = routeProjectId || null
    const fromStorage = loadFromStorage()
    const resolved = fromRoute || fromStorage || null

    state.projectId = resolved
    state.version = 1
    state.updatedAt = Date.now()

    if (resolved) persistToStorage(resolved)

    // Guard: if route and storage disagree, flag inconsistency
    if (fromRoute && fromStorage && fromRoute !== fromStorage) {
      state.inconsistent = true
      console.warn(
        `[ProjectKernel] ⚠ Init: route=${fromRoute} ≠ storage=${fromStorage}. ` +
        `Using route value.`
      )
    }

    console.log(`[ProjectKernel] ✅ init: projectId=${resolved}, inconsistent=${state.inconsistent}`)
  },

  /**
   * Reset kernel to null (e.g. logout / project delete).
   */
  reset(): void {
    projectKernel.setProject(null)
    state.version = 0
    state.inconsistent = false
  },

  // ─── Reactive Bindings ──────────────────────────────────────────

  /**
   * Subscribe to project id changes.
   * Returns unsubscribe function.
   */
  onProjectChange(fn: Subscriber): () => void {
    return subscribe(fn)
  },

  // ─── Readonly Accessors ──────────────────────────────────────────

  get projectId(): string | null {
    return state.projectId
  },
  get version(): number {
    return state.version
  },
  get updatedAt(): number {
    return state.updatedAt
  },
  get inconsistent(): boolean {
    return state.inconsistent
  },
}
