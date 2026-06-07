// ============================================================
// SnapshotRuntime — 工作台快照结构（Phase 7B）
// 用于序列化/反序列化 WorkbenchSnapshot
// ============================================================

import type { NarrativeRuntime, StoryboardImage } from './index'
import type { CharacterRuntime } from './character-runtime'
import type { SceneRuntime } from './scene-runtime'
import type { SegmentRuntime } from './segment-runtime'
import type { AssetEntry } from './asset-runtime'

export interface WorkbenchUIState {
  activeStage: string
  activeSegmentId?: string
  selectedCharacterId?: string
  selectedSceneId?: string
}

export interface WorkbenchMetadata {
  runtimeVersion: number
  lastSavedAt: string
}

export interface WorkbenchSnapshotData {
  narrative: NarrativeRuntime
  characters: CharacterRuntime[]
  scenes: SceneRuntime[]
  segments: SegmentRuntime[]
  assets: AssetEntry[]
  uiState: WorkbenchUIState
  metadata: WorkbenchMetadata
  storyboardImages?: StoryboardImage[]
}
