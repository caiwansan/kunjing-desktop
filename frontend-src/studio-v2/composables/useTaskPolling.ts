/**
 * useTaskPolling — 带指数退避的任务轮询 composable
 * 间隔：1s → 2s → 4s → 8s → 8s（最多 8s 间隔封顶）
 */
import { ref, onUnmounted } from 'vue'

export function useTaskPolling(
  fetchStatus: () => Promise<{ status: string; [key: string]: any }>,
  onComplete: (data: any) => void,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    onError?: (err: Error) => void
  } = {}
) {
  const { maxAttempts = 60, initialDelay = 1000, maxDelay = 8000 } = options
  const polling = ref(false)
  const attempts = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  async function start() {
    stopped = false
    polling.value = true
    attempts.value = 0
    await poll()
  }

  function stop() {
    stopped = true
    polling.value = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function poll() {
    if (stopped || attempts.value >= maxAttempts) {
      polling.value = false
      return
    }
    try {
      attempts.value++
      const data = await fetchStatus()
      if (data.status === 'completed' || data.status === 'succeeded') {
        polling.value = false
        onComplete(data)
        return
      }
      if (data.status === 'failed' || data.status === 'error') {
        polling.value = false
        options.onError?.(new Error(data.error || '任务失败'))
        return
      }
    } catch (err: any) {
      if (attempts.value >= 3) {
        options.onError?.(err)
        polling.value = false
        return
      }
    }
    // 指数退避
    const delay = Math.min(initialDelay * Math.pow(2, attempts.value - 1), maxDelay)
    timer = setTimeout(poll, delay)
  }

  onUnmounted(stop)

  return { polling, attempts, start, stop }
}
