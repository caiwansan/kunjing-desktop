// ============================================================
// AssetRuntime — 素材库运行时
// ============================================================

export type AssetType =
  | 'character'
  | 'scene'
  | 'storyboard'
  | 'video'
  | 'audio'
  | 'fx'
  | 'music'
  | 'style'
  | 'prompt'
  | 'prop'

export interface AssetEntry {
  id: string
  dbId?: string
  type: AssetType
  name: string
  thumbnail?: string
  url?: string
  prompt?: string
  tags: string[]
  version: number
  createdAt: string
  metadata?: Record<string, any>
}

export interface AssetRuntime {
  assets: AssetEntry[]
  activeCategory: AssetType | 'all'
  collapsed: boolean
}
