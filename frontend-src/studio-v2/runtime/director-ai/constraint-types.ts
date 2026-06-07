// Production Constraint — 工业约束类型定义

export interface ProductionConstraint {
  id: string
  name: string
  description: string
  severity: 'hard' | 'soft'    // hard=必须遵守, soft=推荐
  scope: 'global' | 'per-segment'
}

export interface ConstraintCheckResult {
  constraintId: string
  passed: boolean
  detail: string
}

export interface ConstraintReport {
  checks: ConstraintCheckResult[]
  summary: {
    total: number
    passed: number
    failed: number
    hardFailures: number
  }
}

// ─── 预定义约束表 ───

export const BUILTIN_CONSTRAINTS: ProductionConstraint[] = [
  {
    id: 'max-scene-change',
    name: '最大场景切换',
    description: '单个 segment 最多1次场景切换',
    severity: 'hard',
    scope: 'per-segment',
  },
  {
    id: 'emotion-jump-limit',
    name: '情绪跳变限制',
    description: '相邻帧情绪强度变化不超过30%',
    severity: 'hard',
    scope: 'per-segment',
  },
  {
    id: 'camera-style-lock',
    name: '镜头风格锁定',
    description: 'segment 内镜头风格最多2种',
    severity: 'soft',
    scope: 'per-segment',
  },
  {
    id: 'character-wardrobe-lock',
    name: '角色服装锁定',
    description: '同一角色在 segment 内服装一致',
    severity: 'soft',
    scope: 'per-segment',
  },
  {
    id: 'scene-transition-required',
    name: '场景过渡标记',
    description: '场景切换必须标记过渡帧',
    severity: 'hard',
    scope: 'global',
  },
]
