// ============================================================
// director-bridge.ts — AI 导演 ↔ 视频编辑器 桥接层
// 适配新版 video-editor-types（Clip / Track 扁平模型）
// ============================================================

import type { Clip, Track, TransitionType } from './video-editor-types'
import { uid } from './video-editor-types'

/**
 * AI 分镜输入结构
 */
export interface SegmentBridgeInput {
  id: string
  title: string
  duration: number
  timeline: {
    second: number
    visual: string
    camera: string
    audio: string
    emotion: string
    fx: string
  }[]
  characters?: { name: string; image?: string }[]
  scenes?: { title: string; image?: string }[]
  transitionHint?: string
  subtitles?: { time: number; text: string; duration?: number }[]
}

export interface BridgeOutput {
  tracks: Track[]
  duration: number
  log: string[]
}

/**
 * 从 AI 分镜创建编辑器轨道
 */
export function segmentToTracks(input: SegmentBridgeInput): BridgeOutput {
  const log: string[] = []
  const tracks: Track[] = []

  // ─── 1. 主视频轨 ───
  const videoTrack: Track = {
    id: `track-video-${uid()}`,
    type: 'video',
    label: `${input.title} — 视频`,
    index: 0,
    clips: [],
    transitions: [],
    muted: false,
    locked: false,
  }

  let currentVisual = ''
  let currentClip: Clip | null = null
  let clipDuration = 0

  const timelineData = input.timeline

  if (timelineData.length > 0) {
    for (let i = 0; i < timelineData.length; i++) {
      const frame = timelineData[i]
      const frameDuration = 1

      if (frame.visual !== currentVisual && currentVisual !== '' && currentClip) {
        // 视觉变化 → 完成当前片段
        currentClip.duration = clipDuration
        currentClip.sourceDuration = clipDuration
        log.push(`📹 片段 ${videoTrack.clips.length}: "${currentClip.label}" (${currentClip.start}s~${currentClip.start + clipDuration}s)`)
      }

      if (frame.visual !== currentVisual) {
        // 新片段
        currentClip = {
          id: `clip-${uid()}`,
          trackId: videoTrack.id,
          type: 'video',
          src: '',
          label: frame.visual || `场景 ${videoTrack.clips.length + 1}`,
          start: i,  // 从当前秒开始
          duration: frameDuration,
          sourceDuration: frameDuration,
          trimStart: 0,
          trimEnd: frameDuration,
          thumbnail: findImageForVisual(frame.visual, input.characters, input.scenes),
          speed: 1.0,
          volume: 1.0,
        }
        videoTrack.clips.push(currentClip)
        currentVisual = frame.visual
        clipDuration = frameDuration
      } else if (currentClip) {
        clipDuration += frameDuration
        currentClip.duration = clipDuration
        currentClip.sourceDuration = clipDuration
      }
    }

    if (currentClip) {
      log.push(`📹 最后片段: "${currentClip.label}" (${currentClip.start}s~${currentClip.start + currentClip.duration}s)`)
    }

    // 自动添加转场
    if (videoTrack.clips.length > 1 && input.transitionHint) {
      const transType = detectTransitionType(input.transitionHint)
      for (let i = 0; i < videoTrack.clips.length - 1; i++) {
        const from = videoTrack.clips[i]
        const to = videoTrack.clips[i + 1]
        videoTrack.transitions.push({
          id: `trans-${uid()}`,
          trackId: videoTrack.id,
          fromClipId: from.id,
          toClipId: to.id,
          type: transType,
          duration: Math.min(0.5, from.duration * 0.1, to.duration * 0.1),
        })
        log.push(`🔄 转场: ${transType} (${from.label} → ${to.label})`)
      }
    }
  }

  tracks.push(videoTrack)

  // ─── 2. 字幕转轨道（用文本 clip 表示字幕） ───
  if (input.subtitles && input.subtitles.length > 0) {
    const textTrack: Track = {
      id: `track-text-${uid()}`,
      type: 'text',
      label: `${input.title} — 字幕`,
      index: 1,
      clips: input.subtitles.filter(s => s.text.trim()).map((s, i) => ({
        id: `clip-text-${uid()}`,
        trackId: `track-text`,
        type: 'text' as const,
        label: `字幕 ${i + 1}`,
        src: '',
        start: s.time,
        duration: s.duration ?? 2,
        sourceDuration: s.duration ?? 2,
        trimStart: 0,
        trimEnd: s.duration ?? 2,
        speed: 1.0,
        volume: 1.0,
      })),
      transitions: [],
      muted: false,
      locked: false,
    }
    tracks.push(textTrack)
    log.push(`📝 字幕: ${textTrack.clips.length} 条`)
  }

  const totalDuration = timelineData.length > 0
    ? timelineData[timelineData.length - 1].second + 1
    : input.duration

  log.push(`📊 总计: ${videoTrack.clips.length} 个视频片段, ${tracks.length} 条轨道, ${totalDuration}s`)

  return { tracks, duration: totalDuration, log }
}

// ─── 辅助函数 ───

function findImageForVisual(
  visual: string,
  characters?: { name: string; image?: string }[],
  scenes?: { title: string; image?: string }[],
): string | undefined {
  if (!visual) return undefined
  if (characters) {
    for (const ch of characters) {
      if (visual.includes(ch.name) && ch.image) return ch.image
    }
  }
  if (scenes) {
    for (const sc of scenes) {
      if (visual.includes(sc.title) && sc.image) return sc.image
    }
  }
  return undefined
}

function detectTransitionType(hint: string): TransitionType {
  if (/溶解|cross|fade/i.test(hint)) return 'crossfade'
  if (/滑动|slide/i.test(hint)) return 'slide'
  if (/推|push|zoom/i.test(hint)) return 'zoom'
  if (/擦除|wipe/i.test(hint)) return 'wipe'
  if (/淡出|black/i.test(hint)) return 'dissolve'
  return 'crossfade'
}

/**
 * 从多个 AI 分镜创建完整的编辑器轨道列表
 */
export function createEditorStateFromSegments(
  segments: SegmentBridgeInput[],
  existingTracks?: Track[],
): { tracks: Track[]; duration: number; log: string[] } {
  const allLogs: string[] = []
  // 使用扩展运算符复制，避免修改原始数组
  const allTracks: Track[] = existingTracks ? [...existingTracks] : []

  let trackIndex = allTracks.length
  let totalDuration = 0

  for (const seg of segments) {
    const result = segmentToTracks(seg)
    allLogs.push(...result.log)
    for (const track of result.tracks) {
      track.index = trackIndex++
      allTracks.push(track)
    }
    totalDuration = Math.max(totalDuration, result.duration)
  }

  return { tracks: allTracks, duration: totalDuration, log: allLogs }
}
