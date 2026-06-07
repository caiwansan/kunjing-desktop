// Character 内部类型 & 工厂函数

import type { CharacterRuntime } from '~/studio-v2/types/runtime/index'

export function createEmptyCharacter(overrides?: Partial<CharacterRuntime>): CharacterRuntime {
  return {
    id: '',
    name: '',
    description: '',
    personality: '',
    costume: '',
    expressionSet: [],
    visualRef: '',
    locked: false,
    voiceRef: '',
    relationships: [],
    ...overrides,
  }
}
