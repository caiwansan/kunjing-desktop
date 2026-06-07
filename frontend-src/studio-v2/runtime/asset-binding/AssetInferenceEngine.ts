// Asset 绑定系统 — 核心引擎
// 分析 Segment 语义，匹配已有资产

import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'
import type { CharacterRuntime } from '~/studio-v2/types/runtime/index'
import type { SceneRuntime } from '~/studio-v2/types/runtime/index'
import type { AssetBinding } from '~/studio-v2/runtime/director-ai/director-ai-types'

export function suggestAssetBindings(
  segment: SegmentRuntime,
  characters: CharacterRuntime[],
  scenes: SceneRuntime[]
): AssetBinding[] {
  const bindings: AssetBinding[] = []

  // 角色绑定
  for (const charId of segment.characters) {
    const char = characters.find(c => c.id === charId)
    if (char) {
      bindings.push({
        second: 0,
        type: 'character',
        assetId: char.id,
        assetName: char.name,
        confidence: 1,
      })
    }
  }

  // 场景绑定
  for (const sceneId of segment.scenes) {
    const scene = scenes.find(s => s.id === sceneId)
    if (scene) {
      bindings.push({
        second: 0,
        type: 'scene',
        assetId: scene.id,
        assetName: scene.name,
        confidence: 1,
      })
    }
  }

  // 逐帧语义匹配
  for (const frame of segment.timeline) {
    const frameBindings = matchFrameToAssets(frame, characters, scenes)
    bindings.push(...frameBindings)
  }

  return bindings
}

function matchFrameToAssets(
  frame: TimelineFrame,
  characters: CharacterRuntime[],
  scenes: SceneRuntime[]
): AssetBinding[] {
  const bindings: AssetBinding[] = []
  const visual = frame.visual?.toLowerCase() || ''

  if (!visual) return bindings

  // 按角色名匹配
  for (const char of characters) {
    if (visual.includes(char.name.toLowerCase())) {
      bindings.push({
        second: frame.second,
        type: 'character',
        assetId: char.id,
        assetName: char.name,
        confidence: 0.8,
      })
    }
  }

  // 按场景环境匹配
  for (const scene of scenes) {
    const keywords = [scene.name, scene.environment].filter(Boolean).map(k => k.toLowerCase())
    const matched = keywords.some(kw => visual.includes(kw))
    if (matched) {
      bindings.push({
        second: frame.second,
        type: 'scene',
        assetId: scene.id,
        assetName: scene.name,
        confidence: 0.7,
      })
    }
  }

  return bindings
}
