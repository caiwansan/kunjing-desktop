// abort.ts — AbortController Registry (formerly part of lifecycle system)
import { telemetry } from '~/core/control/telemetry'

const controllers = new Set<AbortController>()

export const abortRegistry = {
  create(): AbortController {
    const ctrl = new AbortController()
    controllers.add(ctrl)
    return ctrl
  },
  register(ctrl: AbortController): void {
    controllers.add(ctrl)
  },
  abortAll(): void {
    controllers.forEach(ctrl => ctrl.abort())
    const count = controllers.size
    controllers.clear()
    telemetry.recordRuntime('lifecycle', `aborted ${count} pending requests`)
  },
  get activeCount(): number { return controllers.size },
}
