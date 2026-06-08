// ============================================================
// 视频编辑器核心类型定义（轻量版，基于 opencut 设计理念）
// ============================================================

/** 片段唯一标识 */
export type ClipId = string
export type TrackId = string

/** 片段类型 */
export type ClipType = 'video' | 'audio' | 'image' | 'text'

/** 轨道类型 */
export type TrackType = 'video' | 'audio' | 'overlay' | 'text'

/** 转场类型 */
export type TransitionType = 'crossfade' | 'fade' | 'slide' | 'wipe' | 'zoom' | 'dissolve'

/** 关键帧属性 */
export interface Keyframe {
  time: number        // 相对 clip 起始的时间（秒）
  props: Partial<{
    scale: number
    offsetX: number
    offsetY: number
    rotation: number
    opacity: number
  }>
}

/** 视频/音频片段 */
export interface Clip {
  id: ClipId
  trackId: TrackId
  type: ClipType

  // ─── 源文件 ───
  src: string           // blob URL 或远程 URL
  label: string

  // ─── 时间轴定位 ───
  start: number         // 在轨道上的起始时间（秒）
  duration: number      // 剪辑后的时长（秒）

  // ─── 源素材时间 ───
  sourceDuration: number // 原始素材总长（秒）
  trimStart: number     // 从源素材的什么位置开始取（秒）
  trimEnd: number       // 取到源素材的什么位置（秒），trimEnd - trimStart = duration

  // ─── 显示 ───
  thumbnail?: string    // 缩略图（data URI 或 blob URL）

  // ─── 变速 ───
  speed: number         // 播放速度倍率，默认 1.0

  // ─── 变换（仅 video/overlay） ───
  transform?: {
    scale: number       // 缩放，默认 1.0
    offsetX: number     // X 偏移（像素）
    offsetY: number     // Y 偏移（像素）
    rotation: number    // 旋转角度（度）
    opacity: number     // 透明度 0-1
  }

  // ─── 关键帧动画 ───
  keyframes?: Keyframe[]

  // ─── 滤镜/效果 ───
  filters?: string[]    // CSS filter 字符串数组

  // ─── 音频 ───
  volume: number        // 音量 0-1，默认 1.0
}

/** 转场 */
export interface Transition {
  id: string
  trackId: TrackId
  fromClipId: ClipId
  toClipId: ClipId
  type: TransitionType
  duration: number       // 转场时长（秒）
}

/** 轨道 */
export interface Track {
  id: TrackId
  type: TrackType
  label: string
  index: number          // 排序优先级，小的在下层
  clips: Clip[]
  transitions: Transition[]
  muted: boolean
  locked: boolean
}

/** 时间轴状态 */
export interface TimelineState {
  currentTime: number    // 当前播放位置（秒）
  duration: number       // 总时长（秒）
  isPlaying: boolean
  zoom: number           // 像素/秒
  scrollX: number        // 水平滚动偏移（像素）
  scrollY: number        // 垂直滚动偏移（像素）
  playbackRate: number   // 播放速率，默认 1.0
}

/** 导出配置 */
export interface ExportConfig {
  resolution: '1080p' | '720p' | '480p'
  fps: number
  quality: 'high' | 'medium' | 'low'
  format: 'mp4' | 'webm'
}

/** 书签 */
export interface Bookmark {
  id: string
  time: number
  label: string
  color?: string
}

/** 编辑器完整状态 */
export interface EditorState {
  timeline: TimelineState
  tracks: Track[]
  bookmarks: Bookmark[]
  selectedClipIds: ClipId[]
  exportConfig: ExportConfig
}

// ─── 默认值 ───

export const DEFAULT_ZOOM = 50  // 50px/s
export const MIN_ZOOM = 10
export const MAX_ZOOM = 200

export function createDefaultTimeline(): TimelineState {
  return {
    currentTime: 0,
    duration: 10,
    isPlaying: false,
    zoom: DEFAULT_ZOOM,
    scrollX: 0,
    scrollY: 0,
    playbackRate: 1.0,
  }
}

export function createDefaultExportConfig(): ExportConfig {
  return {
    resolution: '1080p',
    fps: 30,
    quality: 'high',
    format: 'mp4',
  }
}

export function createDefaultState(): EditorState {
  return {
    timeline: createDefaultTimeline(),
    tracks: [],
    bookmarks: [],
    selectedClipIds: [],
    exportConfig: createDefaultExportConfig(),
  }
}

let _nextId = 0
export function uid(): string {
  return `${Date.now().toString(36)}-${(++_nextId).toString(36)}`
}
