// Segment Runtime — 导演工作区状态管理

import { computed } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import type { SegmentRuntime, TimelineFrame } from '~/studio-v2/types/runtime/index'
import { createEmptySegment } from './segment-types'

export function useSegmentRuntime() {
  const { state, setSegments, updateSegment, updateTimelineFrame } = useStudioStore()

  const segments = computed(() => state.workspace.segments)
  const count = computed(() => segments.value.length)
  const activeIndex = computed(() => state.workspace.activeSegmentIndex)

  const activeSegment = computed(() => {
    const idx = activeIndex.value
    if (idx < 0 || idx >= segments.value.length) return null
    return segments.value[idx]
  })

  function addSegment(overrides?: Partial<SegmentRuntime>) {
    const seg = createEmptySegment(overrides)
    setSegments([...segments.value, seg])
  }

  function removeSegment(id: string) {
    setSegments(segments.value.filter(s => s.id !== id))
  }

  function updateTimeline(segmentId: string, timeline: TimelineFrame[]) {
    updateSegment(segmentId, { timeline })
  }

  return {
    segments,
    count,
    activeIndex,
    activeSegment,
    addSegment,
    removeSegment,
    updateTimeline,
    updateSegment,
    updateTimelineFrame,
  }
}
