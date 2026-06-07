/**
 * useFetchWithFallback - A composable for fetching with mock data fallback.
 * Tries the real API first, falls back to mock data if 404 or network error.
 *
 * Token 从 Pinia store 内存变量获取（非 localStorage），防御 XSS 窃取。
 */
import { ref, type Ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

export function useFetchWithFallback<T = any>() {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchWithFallback(
    url: string,
    mockData: T,
    options: RequestInit = {}
  ): Promise<T> {
    loading.value = true
    error.value = null

    // 【安全】从 Pinia store 内存变量获取 token，避免直接读 localStorage（防 XSS 窃取）
    const auth = useAuthStore()
    const token = process.client ? auth.getToken() : null
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const res = await fetch(url, { ...options, headers })
      if (res.ok) {
        const d = await res.json()
        data.value = d
        return d
      } else if (res.status === 404) {
        // Fallback to mock
        data.value = mockData
        return mockData
      } else {
        throw new Error(`API error: ${res.status}`)
      }
    } catch (e: any) {
      // Fallback to mock on error
      data.value = mockData
      return mockData
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    fetchWithFallback,
  }
}
