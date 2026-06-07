// ============================================================
// 视频编辑器核心状态（基于 opencut 扁平数据 + Vue reactivity）
// ============================================================

import { reactive, computed, ref } from 'vue'
import {
  type Clip, type Track, type TrackId, type ClipId,
  type TrackType, type ClipType, type Transition,
  type TransitionType, type EditorState, type ExportConfig,
  type Keyframe, type Bookmark, type TimelineState,
  createDefaultState, uid, DEFAULT_ZOOM,
} from './video-editor-types'

// ─── 可以传入外部 state 或创建新 state ───

let _defaultState: EditorState | null = null
function getOrCreateState(existing?: EditorState): EditorState {
  if (existing) return existing
  if (!_defaultState) _defaultState = reactive<EditorState>(createDefaultState())
  return _defaultState
}

// ─── 模块级单例 state ───
const state = getOrCreateState()

// ─── 计算属性 ───

/** 按 index 排序的轨道（越小越底层） */
const sortedTracks = computed(() =>
  [...state.tracks].sort((a, b) => a.index - b.index)
)

/** 当前播放时间点对应的主视频片段 */
const currentPreviewClip = computed<Clip | null>(() => {
  const t = state.timeline.currentTime
  for (const track of state.tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      if (t >= clip.start && t < clip.start + clip.duration) return clip
    }
  }
  return null
})

/** 所有片段的 flat 列表（用于快速查找） */
const allClips = computed(() => state.tracks.flatMap(t => t.clips))

/** 总片段数 */
const totalClips = computed(() => state.tracks.reduce((n, t) => n + t.clips.length, 0))

/** 时间轴总宽度（像素） */
const totalWidth = computed(() => state.timeline.duration * state.timeline.zoom)

// ─── 轨道操作 ───

function addTrack(type: TrackType, label?: string): Track {
  const maxIndex = Math.max(...state.tracks.map(t => t.index), -1)
  const id = `track-${uid()}`
  const labels: Record<TrackType, string> = {
    video: '视频', audio: '音频', text: '字幕', overlay: '画中画',
  }
  const track: Track = {
    id,
    type,
    label: label ?? labels[type],
    index: maxIndex + 1,
    clips: [],
    transitions: [],
    muted: false,
    locked: false,
  }
  state.tracks.push(track)
  return track
}

function removeTrack(trackId: TrackId) {
  const idx = state.tracks.findIndex(t => t.id === trackId)
  if (idx >= 0) state.tracks.splice(idx, 1)
}

function toggleTrackMute(trackId: TrackId) {
  const track = state.tracks.find(t => t.id === trackId)
  if (track) track.muted = !track.muted
}

function toggleTrackLock(trackId: TrackId) {
  const track = state.tracks.find(t => t.id === trackId)
  if (track) track.locked = !track.locked
}

// ─── 片段操作 ───

function addClip(trackId: TrackId, clip: Omit<Clip, 'id' | 'trackId'>): Clip {
  const newClip: Clip = {
    ...clip,
    id: `clip-${uid()}`,
    trackId,
    speed: clip.speed ?? 1.0,
    volume: clip.volume ?? 1.0,
  }
  const track = state.tracks.find(t => t.id === trackId)
  if (track) track.clips.push(newClip)
  updateDuration()
  return newClip
}

function removeClip(clipId: ClipId) {
  for (const track of state.tracks) {
    const idx = track.clips.findIndex(c => c.id === clipId)
    if (idx >= 0) {
      track.clips.splice(idx, 1)
      break
    }
  }
  updateDuration()
  state.selectedClipIds = state.selectedClipIds.filter(id => id !== clipId)
}

function updateClip(clipId: ClipId, patch: Partial<Clip>) {
  for (const track of state.tracks) {
    const clip = track.clips.find(c => c.id === clipId)
    if (clip) {
      Object.assign(clip, patch)
      updateDuration()
      return
    }
  }
}

function moveClip(clipId: ClipId, newStart: number, destTrackId?: TrackId) {
  for (const track of state.tracks) {
    const idx = track.clips.findIndex(c => c.id === clipId)
    if (idx >= 0) {
      const clip = track.clips[idx]
      // 移入不同轨道
      if (destTrackId && destTrackId !== track.id) {
        track.clips.splice(idx, 1)
        const destTrack = state.tracks.find(t => t.id === destTrackId)
        if (destTrack) {
          clip.trackId = destTrackId
          clip.start = Math.max(0, newStart)
          destTrack.clips.push(clip)
        }
      } else {
        clip.start = Math.max(0, newStart)
      }
      updateDuration()
      return
    }
  }
}

function trimClip(clipId: ClipId, newStart: number, newDuration: number) {
  const clip = findClip(clipId)
  if (!clip) return
  clip.start = Math.max(0, newStart)
  clip.duration = Math.max(0.1, newDuration)
  updateDuration()
}

function splitClip(clipId: ClipId, splitTime: number) {
  const clip = findClip(clipId)
  if (!clip) return
  if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) return
  const splitOffset = splitTime - clip.start
  const newClip: Clip = {
    ...clip,
    id: `clip-${uid()}`,
    start: splitTime,
    duration: clip.duration - splitOffset,
    trimStart: clip.trimStart + splitOffset,
  }
  clip.duration = splitOffset
  clip.trimEnd = clip.trimStart + splitOffset
  const track = state.tracks.find(t => t.id === clip.trackId)
  if (track) {
    track.clips.push(newClip)
    track.clips.sort((a, b) => a.start - b.start)
  }
  updateDuration()
}

function duplicateClip(clipId: ClipId) {
  const clip = findClip(clipId)
  if (!clip) return
  const newClip: Clip = {
    ...clip,
    id: `clip-${uid()}`,
    start: clip.start + clip.duration + 1, // 后接 1 秒空隙
  }
  const track = state.tracks.find(t => t.id === clip.trackId)
  if (track) track.clips.push(newClip)
  updateDuration()
}

function setClipSpeed(clipId: ClipId, speed: number) {
  const clip = findClip(clipId)
  if (!clip) return
  clip.speed = Math.max(0.1, Math.min(10, speed))
  // 变速后时长调整
  clip.duration = clip.sourceDuration / clip.speed
  updateDuration()
}

/** 查找片段 */
function findClip(clipId: ClipId): Clip | undefined {
  for (const track of state.tracks) {
    const clip = track.clips.find(c => c.id === clipId)
    if (clip) return clip
  }
  return undefined
}

/** 查找片段所在轨道 */
function findClipTrack(clipId: ClipId): Track | undefined {
  return state.tracks.find(t => t.clips.find(c => c.id === clipId))
}

/** 在轨道上找到下一个空位 */
function findNextSlot(trackId: TrackId): number {
  const track = state.tracks.find(t => t.id === trackId)
  if (!track || track.clips.length === 0) return 0
  return Math.max(...track.clips.map(c => c.start + c.duration)) + 0.5
}

// ─── 选区操作 ───

function selectClip(clipId: ClipId, addToSelection = false) {
  if (addToSelection) {
    const idx = state.selectedClipIds.indexOf(clipId)
    if (idx >= 0) state.selectedClipIds.splice(idx, 1)
    else state.selectedClipIds.push(clipId)
  } else {
    state.selectedClipIds = [clipId]
  }
}

function clearSelection() {
  state.selectedClipIds = []
}

// ─── 时间轴操作 ───

function updateDuration() {
  let maxEnd = 0
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      maxEnd = Math.max(maxEnd, clip.start + clip.duration)
    }
  }
  state.timeline.duration = Math.max(maxEnd, 10)
}

function setCurrentTime(time: number) {
  state.timeline.currentTime = Math.max(0, Math.min(time, state.timeline.duration))
}

function togglePlay() {
  state.timeline.isPlaying = !state.timeline.isPlaying
}

function play() { state.timeline.isPlaying = true }
function pause() { state.timeline.isPlaying = false }

function zoomIn() {
  state.timeline.zoom = Math.min(200, state.timeline.zoom * 1.3)
}

function zoomOut() {
  state.timeline.zoom = Math.max(10, state.timeline.zoom / 1.3)
}

function zoomToFit() {
  // 根据轨道总宽度自适应缩放
  const containerWidth = 800 // 大致值，实际从 DOM 获取
  if (state.timeline.duration > 0) {
    state.timeline.zoom = Math.max(10, Math.min(200, containerWidth / state.timeline.duration))
  }
}

// ─── 转场 ───

function addTransition(
  trackId: TrackId, fromClipId: ClipId, toClipId: ClipId,
  type: TransitionType, duration: number
) {
  const track = state.tracks.find(t => t.id === trackId)
  if (!track) return
  const trans: Transition = {
    id: `trans-${uid()}`,
    trackId, fromClipId, toClipId, type, duration,
  }
  track.transitions.push(trans)
}

function removeTransition(transId: string) {
  for (const track of state.tracks) {
    const idx = track.transitions.findIndex(t => t.id === transId)
    if (idx >= 0) { track.transitions.splice(idx, 1); return }
  }
}

// ─── 书签 ───

function addBookmark(time: number, label?: string, color?: string) {
  state.bookmarks.push({
    id: `bm-${uid()}`,
    time,
    label: label || `标记 ${state.bookmarks.length + 1}`,
    color,
  })
}

function removeBookmark(bmId: string) {
  const idx = state.bookmarks.findIndex(b => b.id === bmId)
  if (idx >= 0) state.bookmarks.splice(idx, 1)
}

// ─── 导出 ───

function updateExportConfig(patch: Partial<ExportConfig>) {
  Object.assign(state.exportConfig, patch)
}

// ─── 撤销/重做（简版，用快照） ───

const undoStack: string[] = []
const redoStack: string[] = []
const MAX_UNDO = 30

function saveSnapshot() {
  const json = JSON.stringify(state)
  undoStack.push(json)
  if (undoStack.length > MAX_UNDO) undoStack.shift()
  redoStack.length = 0
}

function undo() {
  if (undoStack.length === 0) return
  const current = JSON.stringify(state)
  redoStack.push(current)
  const prev = undoStack.pop()!
  Object.assign(state, JSON.parse(prev))
}

function redo() {
  if (redoStack.length === 0) return
  const current = JSON.stringify(state)
  undoStack.push(current)
  const next = redoStack.pop()!
  Object.assign(state, JSON.parse(next))
}

// ─── 全量重置 ───

function resetState() {
  Object.assign(state, createDefaultState())
}

// ─── 公开接口 ───

export function useVideoEditor() {
  return {
    // 状态
    state,
    sortedTracks,
    currentPreviewClip,
    allClips,
    totalClips,
    totalWidth,

    // 轨道
    addTrack,
    removeTrack,
    toggleTrackMute: toggleTrackMute,
    toggleTrackLock: toggleTrackLock,

    // 片段
    addClip,
    removeClip,
    updateClip,
    moveClip,
    trimClip,
    splitClip,
    duplicateClip,
    setClipSpeed,
    findClip,
    findClipTrack,
    findNextSlot,

    // 选区
    selectClip,
    clearSelection,

    // 时间轴
    setCurrentTime,
    togglePlay,
    play,
    pause,
    zoomIn,
    zoomOut,
    zoomToFit,
    updateDuration,

    // 转场
    addTransition,
    removeTransition,

    // 书签
    addBookmark,
    removeBookmark,

    // 导出
    updateExportConfig,

    // 撤销
    saveSnapshot,
    undo,
    redo,

    // 重置
    resetState,
  }
}
