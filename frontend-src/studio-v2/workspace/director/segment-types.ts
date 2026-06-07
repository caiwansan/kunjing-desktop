// Segment 工厂函数

import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'

export function createEmptySegment(overrides?: Partial<SegmentRuntime>): SegmentRuntime {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    title: '',
    masterBeat: '',
    duration: 10,
    timeline: createEmptyTimeline(10),
    characters: [],
    scenes: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createEmptyTimeline(duration: number): TimelineFrame[] {
  return Array.from({ length: duration }, (_, i) => ({
    second: i,
    visual: '',
    camera: '',
    audio: '',
    emotion: '',
    fx: '',
  }))
}
