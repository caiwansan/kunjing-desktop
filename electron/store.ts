/**
 * 昆仑镜桌面版 - 加密密钥存储
 * 闭源：使用 OS 原生加密（macOS Keychain / Windows Credential Manager）
 */
import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

interface StoreData {
  apiHost?: string
  jwtToken?: string
  volcengineApiKey?: string
  aliyunApiKey?: string
  deepseekApiKey?: string
  minioEndpoint?: string
  minioAccessKey?: string
  minioSecretKey?: string
  [key: string]: string | undefined
}

export class KeyStore {
  private storePath: string
  private data: StoreData = {}

  constructor() {
    const userDataPath = app.getPath('userData')
    this.storePath = path.join(userDataPath, 'config.encrypted')
    this.load()
  }

  private load() {
    try {
      if (!fs.existsSync(this.storePath)) return
      const encrypted = fs.readFileSync(this.storePath)
      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encrypted)
        this.data = JSON.parse(decrypted)
      } else {
        // fallback: base64 编码（加密不可用时）
        const raw = Buffer.from(encrypted.toString(), 'base64').toString()
        this.data = JSON.parse(raw)
      }
    } catch {
      this.data = {}
    }
  }

  private saveStore() {
    const dir = path.dirname(this.storePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const raw = JSON.stringify(this.data)
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(raw)
      fs.writeFileSync(this.storePath, encrypted)
    } else {
      // fallback: base64 编码
      fs.writeFileSync(this.storePath, Buffer.from(raw).toString('base64'))
    }
  }

  hasApiKeys(): boolean {
    return !!(this.data.apiHost && (this.data.volcengineApiKey || this.data.aliyunApiKey))
  }

  getStatus() {
    return {
      configured: this.hasApiKeys(),
      hasApiHost: !!this.data.apiHost,
      hasVolcengine: !!this.data.volcengineApiKey,
      hasAliyun: !!this.data.aliyunApiKey,
      hasDeepSeek: !!this.data.deepseekApiKey,
    }
  }

  get(key: string): string | undefined {
    return this.data[key]
  }

  getAll(): StoreData {
    return { ...this.data }
  }

  save(config: Record<string, string>) {
    Object.assign(this.data, config)
    this.saveStore()
  }

  clear() {
    this.data = {}
    if (fs.existsSync(this.storePath)) {
      fs.unlinkSync(this.storePath)
    }
  }
}
