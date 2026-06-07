// ─── Worker Map — routes each stage to its execution worker ───
import type { RuntimeStage, WorkerFn } from '@/runtime/execution/types'

// Workers are lazy-imported to avoid circular deps at module load time
const workerLoaders: Record<RuntimeStage, () => Promise<WorkerFn>> = {
  story:      () => import('@/workers/story.worker').then(m => m.storyWorker),
  character:  () => import('@/workers/character.worker').then(m => m.characterWorker),
  scene:      () => import('@/workers/scene.worker').then(m => m.sceneWorker),
  storyboard: () => import('@/workers/storyboard.worker').then(m => m.storyboardWorker),
  voice:      () => import('@/workers/voice.worker').then(m => m.voiceWorker),
  frame:      () => import('@/workers/frame.worker').then(m => m.frameWorker),
  director:   () => import('@/workers/director.worker').then(m => m.directorWorker),
  composite:  () => import('@/workers/composite.worker').then(m => m.compositeWorker),
  export:     () => import('@/workers/export.worker').then(m => m.exportWorker),
}

export async function getWorker(stage: RuntimeStage): Promise<WorkerFn> {
  const loader = workerLoaders[stage]
  if (!loader) throw new Error(`[WorkerMap] No worker registered for stage: ${stage}`)
  return loader()
}
