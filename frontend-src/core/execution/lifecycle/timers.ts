// timers.ts — Timer Registry (formerly part of lifecycle system)
import { telemetry } from '~/core/control/telemetry'

const timerIds = new Set<ReturnType<typeof setInterval>>()
const timeoutIds = new Set<ReturnType<typeof setTimeout>>()

export const timerRegistry = {
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const id = setInterval(fn, ms)
    timerIds.add(id)
    return id
  },
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(fn, ms)
    timeoutIds.add(id)
    return id
  },
  clearInterval(id?: ReturnType<typeof setInterval>): void {
    if (id) { clearInterval(id); timerIds.delete(id) }
  },
  clearTimeout(id?: ReturnType<typeof setTimeout>): void {
    if (id) { clearTimeout(id); timeoutIds.delete(id) }
  },
  clearAll(): void {
    timerIds.forEach(id => clearInterval(id))
    timeoutIds.forEach(id => clearTimeout(id))
    timerIds.clear()
    timeoutIds.clear()
    telemetry.recordRuntime('lifecycle', `cleared ${timerIds.size + timeoutIds.size} timers`)
  },
  get activeCount(): number { return timerIds.size + timeoutIds.size },
}
