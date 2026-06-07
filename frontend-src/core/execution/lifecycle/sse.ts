// sse.ts — SSE Registry (formerly part of lifecycle system)
import { telemetry } from '~/core/control/telemetry'

const sseConnections = new Set<EventSource>()

export const sseRegistry = {
  create(url: string): EventSource {
    const es = new EventSource(url)
    sseConnections.add(es)
    es.addEventListener('error', () => {
      telemetry.recordSSE(url, 'fail', undefined, 'connection error')
    })
    return es
  },
  register(es: EventSource): void {
    sseConnections.add(es)
  },
  close(es: EventSource): void {
    es.close()
    sseConnections.delete(es)
  },
  closeAll(): void {
    sseConnections.forEach(es => es.close())
    const count = sseConnections.size
    sseConnections.clear()
    telemetry.recordRuntime('lifecycle', `closed ${count} SSE connections`)
  },
  get activeCount(): number { return sseConnections.size },
}
