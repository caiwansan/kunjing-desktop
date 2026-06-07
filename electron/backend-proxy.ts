/**
 * 昆仑镜桌面版 - API 后端代理
 * 闭源：负责所有对外 API 请求的转发和管理
 * 确保密钥不会暴露给前端渲染进程
 */
import { KeyStore } from './store'

export class BackendProxy {
  private keyStore: KeyStore

  constructor(keyStore: KeyStore) {
    this.keyStore = keyStore
  }

  private getApiHost(): string {
    return this.keyStore.get('apiHost') || '__API_HOST__'
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const token = this.keyStore.get('jwtToken')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async request(method: string, apiPath: string, body?: any, params?: Record<string, string>): Promise<any> {
    const host = this.getApiHost()
    let url = `${host}${apiPath}`
    if (params) {
      const qs = new URLSearchParams(params).toString()
      url += `?${qs}`
    }

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)
    return res.json()
  }

  /**
   * 测试与后端 API 的连通性
   */
  async testConnection(apiHost: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${apiHost}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        return { success: true, message: '连接成功！' }
      }
      return { success: false, message: `服务器返回 ${res.status}` }
    } catch (err: any) {
      return { success: false, message: `无法连接: ${err.message}` }
    }
  }

  getAvailableVideoModels(): Array<{ id: string; name: string; provider: string }> {
    const volKey = this.keyStore.get('volcengineApiKey')
    const aliyunKey = this.keyStore.get('aliyunApiKey')
    const models: Array<{ id: string; name: string; provider: string }> = []

    if (volKey) {
      models.push(
        { id: 'doubao-seedance-2-0-pro-260510', name: 'Seedance 2.0 Pro（豆包）', provider: 'volcengine' },
        { id: 'doubao-seedance-1-5-pro-251215', name: 'Seedance 1.5 Pro（豆包）', provider: 'volcengine' },
        { id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro（豆包）', provider: 'volcengine' },
      )
    }
    if (aliyunKey) {
      models.push(
        { id: 'wan2.1-i2v-14b', name: 'Wan 2.1（通义万相）', provider: 'aliyun' },
        { id: 'wan2.1-t2v-14b', name: 'Wan 2.1 Text-to-Video（通义万相）', provider: 'aliyun' },
      )
    }

    return models
  }
}
