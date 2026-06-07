/**
 * shared/runtime/validate-narrative-schema.ts — Runtime Schema Validator v1
 *
 * Runtime Constitution Phase 5: Boundary Enforcement
 *
 * 宪法规定：
 *   1. 所有 AI 输出 → normalize 后 → validateCanonicalNarrative() → 才能写入 DB
 *   2. 所有从 DB 读取的数据 → validateCanonicalNarrative() → 才能前端 hydration
 *   3. 校验失败抛出详细错误，不允许未 canonicalize 的数据流转
 *
 * 校验内容:
 *   - ID 必须全部为 string 格式
 *   - required field 不允许 null / undefined / ''
 *   - unknown field 不能进入 runtime（会 warning）
 *   - 禁止 union id types（string | number）
 */

import type {
  NarrativeProjectSnapshot,
  NarrativeCharacter,
  NarrativeScene,
  NarrativeDialogue,
  NarrativeAction,
  NarrativeVoice,
  NarrativeProp,
  NarrativeVideoSegment,
  NarrativeStoryboardBeat,
  NarrativeEmotionCurve,
} from './narrative-schema'

export interface ValidationIssue {
  path: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  expected?: string
  actual?: unknown
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

// ============================================================
// ID 校验
// ============================================================

function validateId(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (value === undefined || value === null) {
    issues.push({
      path,
      severity: 'critical',
      message: `ID 不允许为 null/undefined`,
      expected: 'string',
      actual: value,
    })
  } else if (typeof value === 'number') {
    issues.push({
      path,
      severity: 'critical',
      message: `ID 必须是 string，收到 number: ${value}`,
      expected: 'string',
      actual: `${value} (number)`,
    })
  } else if (typeof value !== 'string') {
    issues.push({
      path,
      severity: 'critical',
      message: `ID 类型错误`,
      expected: 'string',
      actual: typeof value,
    })
  } else if (value.length === 0) {
    issues.push({
      path,
      severity: 'critical',
      message: `ID 不允许为空字符串`,
      expected: 'non-empty string',
      actual: '""',
    })
  }
  return issues
}

// ============================================================
// Nullable 校验
// ============================================================

function validateNullable(value: unknown, path: string, fieldName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (value === undefined) {
    issues.push({
      path: `${path}.${fieldName}`,
      severity: 'warning',
      message: `字段 ${fieldName} 为 undefined，应统一为 null`,
      expected: 'null',
      actual: 'undefined',
    })
  }
  if (typeof value === 'string' && value === '') {
    issues.push({
      path: `${path}.${fieldName}`,
      severity: 'warning',
      message: `字段 ${fieldName} 为空字符串 ''，应统一为 null`,
      expected: 'null',
      actual: '""',
    })
  }
  return issues
}

// ============================================================
// unknown field 检查
// ============================================================

const ALLOWED_CHARACTER_FIELDS = new Set([
  'id', 'name', 'description', 'personality', 'appearance',
  'gender', 'age', 'role', 'voiceType', 'imagePrompt',
  'negativePrompt', 'clothingVariants',
])

const ALLOWED_SCENE_FIELDS = new Set([
  'id', 'name', 'description', 'type', 'timeOfDay', 'lighting',
  'mood', 'colorTone', 'keyProps', 'environment',
  'imagePrompt', 'negativePrompt',
])

const ALLOWED_VOICE_FIELDS = new Set([
  'id', 'characterName', 'voiceType', 'pitch', 'speed',
  'tone', 'speakingStyle', 'description', 'ttsPrompt',
])

const ALLOWED_DIALOGUE_FIELDS = new Set([
  'id', 'sceneName', 'segmentId', 'characterName', 'dialogue', 'tone',
])

const ALLOWED_ACTION_FIELDS = new Set([
  'id', 'sceneName', 'segmentId', 'characterName', 'action', 'expression',
])

const ALLOWED_PROP_FIELDS = new Set([
  'id', 'name', 'category', 'description', 'sceneIds',
  'characterNames', 'imagePrompt', 'metadata',
])

const ALLOWED_SEGMENT_FIELDS = new Set([
  'id', 'title', 'scene', 'duration', 'beats',
  'characters', 'transition', 'dialogues', 'actions',
])

const ALLOWED_BEAT_FIELDS = new Set([
  'start', 'end', 'camera', 'visual', 'dialogue',
  'effect', 'sound', 'emotion', 'label',
])

function checkUnknownFields(
  obj: Record<string, unknown>,
  allowedFields: Set<string>,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const key of Object.keys(obj)) {
    if (!allowedFields.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        severity: 'warning',
        message: `未知字段 "${key}" 混入 runtime（请检查 normalize 映射）`,
        expected: `one of: ${[...allowedFields].join(', ')}`,
        actual: key,
      })
    }
  }
  return issues
}

// ============================================================
// 实体校验器
// ============================================================

function validateCharacter(c: NarrativeCharacter, index: number): ValidationIssue[] {
  const path = `characters[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(c.id, `${path}.id`),
    ...(c.name ? [] : [{ path: `${path}.name`, severity: 'critical' as const, message: `角色 name 为空` }]),
  ]
  if (c.description === undefined) issues.push(...validateNullable(c.description, path, 'description'))
  if (c.personality === undefined) issues.push(...validateNullable(c.personality, path, 'personality'))
  if (c.appearance === undefined) issues.push(...validateNullable(c.appearance, path, 'appearance'))
  if (c.gender === undefined) issues.push(...validateNullable(c.gender, path, 'gender'))
  if (c.role === undefined) issues.push(...validateNullable(c.role, path, 'role'))
  if (c.voiceType === undefined) issues.push(...validateNullable(c.voiceType, path, 'voiceType'))
  issues.push(...checkUnknownFields(c as unknown as Record<string, unknown>, ALLOWED_CHARACTER_FIELDS, path))
  return issues
}

function validateScene(s: NarrativeScene, index: number): ValidationIssue[] {
  const path = `scenes[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(s.id, `${path}.id`),
  ]
  if (s.environment === undefined) issues.push(...validateNullable(s.environment, path, 'environment'))
  issues.push(...checkUnknownFields(s as unknown as Record<string, unknown>, ALLOWED_SCENE_FIELDS, path))
  return issues
}

function validateVoice(v: NarrativeVoice, index: number): ValidationIssue[] {
  const path = `voices[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(v.id, `${path}.id`),
    ...(v.characterName ? [] : [{ path: `${path}.characterName`, severity: 'critical' as const, message: `voice characterName 为空` }]),
    ...(v.voiceType ? [] : [{ path: `${path}.voiceType`, severity: 'critical' as const, message: `voiceType 为空` }]),
  ]
  issues.push(...checkUnknownFields(v as unknown as Record<string, unknown>, ALLOWED_VOICE_FIELDS, path))
  return issues
}

function validateDialogue(d: NarrativeDialogue, index: number): ValidationIssue[] {
  const path = `dialogues[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(d.id, `${path}.id`),
    ...(d.characterName ? [] : [{ path: `${path}.characterName`, severity: 'critical' as const, message: `dialogue characterName 为空` }]),
    ...(d.dialogue ? [] : [{ path: `${path}.dialogue`, severity: 'critical' as const, message: `dialogue content 为空` }]),
  ]
  issues.push(...checkUnknownFields(d as unknown as Record<string, unknown>, ALLOWED_DIALOGUE_FIELDS, path))
  return issues
}

function validateAction(a: NarrativeAction, index: number): ValidationIssue[] {
  const path = `actions[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(a.id, `${path}.id`),
    ...(a.action ? [] : [{ path: `${path}.action`, severity: 'critical' as const, message: `action description 为空` }]),
  ]
  issues.push(...checkUnknownFields(a as unknown as Record<string, unknown>, ALLOWED_ACTION_FIELDS, path))
  return issues
}

function validateProp(p: NarrativeProp, index: number): ValidationIssue[] {
  const path = `props[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(p.id, `${path}.id`),
    ...(p.name ? [] : [{ path: `${path}.name`, severity: 'critical' as const, message: `prop name 为空` }]),
  ]
  issues.push(...checkUnknownFields(p as unknown as Record<string, unknown>, ALLOWED_PROP_FIELDS, path))
  return issues
}

function validateBeat(b: NarrativeStoryboardBeat, index: number, segId: string): ValidationIssue[] {
  const path = `videoSegments[${segId}].beats[${index}]`
  const issues: ValidationIssue[] = []
  if (typeof b.start !== 'number') {
    issues.push({ path: `${path}.start`, severity: 'warning', message: `beat start 不是数字`, actual: b.start })
  }
  if (typeof b.end !== 'number') {
    issues.push({ path: `${path}.end`, severity: 'warning', message: `beat end 不是数字`, actual: b.end })
  }
  issues.push(...checkUnknownFields(b as unknown as Record<string, unknown>, ALLOWED_BEAT_FIELDS, path))
  return issues
}

function validateSegment(seg: NarrativeVideoSegment, index: number): ValidationIssue[] {
  const path = `videoSegments[${index}]`
  const issues: ValidationIssue[] = [
    ...validateId(seg.id, `${path}.id`),
  ]
  if (seg.beats) {
    seg.beats.forEach((b, bi) => issues.push(...validateBeat(b, bi, seg.id)))
  }
  if (seg.dialogues) {
    seg.dialogues.forEach((d, di) => issues.push(...validateDialogue(d, di)))
  }
  if (seg.actions) {
    seg.actions.forEach((a, ai) => issues.push(...validateAction(a, ai)))
  }
  issues.push(...checkUnknownFields(seg as unknown as Record<string, unknown>, ALLOWED_SEGMENT_FIELDS, path))
  return issues
}

function validateEmotionCurve(curve: NarrativeEmotionCurve | null): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!curve) return issues
  curve.points.forEach((p, i) => {
    if (typeof p.second !== 'number') {
      issues.push({
        path: `emotionCurve.points[${i}].second`,
        severity: 'warning',
        message: `emotionCurve second 不是 number`,
        actual: p.second,
      })
    }
    if (!p.emotion) {
      issues.push({
        path: `emotionCurve.points[${i}].emotion`,
        severity: 'warning',
        message: `emotionCurve emotion 为空`,
      })
    }
  })
  return issues
}

// ============================================================
// 顶层校验器
// ============================================================

/**
 * 校验 canonical NarrativeProjectSnapshot
 *
 * 返回所有 issues: critical（阻塞）/ warning（记录）/ info（建议）
 * 如果有 critical 级别 issues，视为校验不通过
 */
export function validateCanonicalNarrative(snapshot: NarrativeProjectSnapshot): ValidationResult {
  const issues: ValidationIssue[] = []

  // 版本检查
  if (snapshot.version !== 'v2') {
    issues.push({
      path: 'version',
      severity: 'critical',
      message: `版本必须为 "v2"，收到 "${snapshot.version}"`,
      expected: 'v2',
      actual: snapshot.version,
    })
  }

  // 遍历每个实体
  snapshot.characters.forEach((c, i) => issues.push(...validateCharacter(c, i)))
  snapshot.scenes.forEach((s, i) => issues.push(...validateScene(s, i)))
  snapshot.voices.forEach((v, i) => issues.push(...validateVoice(v, i)))
  snapshot.dialogues.forEach((d, i) => issues.push(...validateDialogue(d, i)))
  snapshot.actions.forEach((a, i) => issues.push(...validateAction(a, i)))
  snapshot.props.forEach((p, i) => issues.push(...validateProp(p, i)))
  snapshot.videoSegments.forEach((s, i) => issues.push(...validateSegment(s, i)))
  issues.push(...validateEmotionCurve(snapshot.emotionCurve))

  const criticals = issues.filter(i => i.severity === 'critical')

  return {
    valid: criticals.length === 0,
    issues,
  }
}

/**
 * 格式化校验结果为可读文本
 */
export function formatValidationResult(result: ValidationResult): string {
  const criticals = result.issues.filter(i => i.severity === 'critical')
  const warnings = result.issues.filter(i => i.severity === 'warning')
  const infos = result.issues.filter(i => i.severity === 'info')

  const lines: string[] = []
  lines.push(`[Schema Validator] valid=${result.valid}`)
  lines.push(`  critical: ${criticals.length}, warning: ${warnings.length}, info: ${infos.length}`)

  for (const c of criticals) {
    lines.push(`  🔴 ${c.path}: ${c.message}`)
    if (c.expected) lines.push(`     expected: ${c.expected}, actual: ${c.actual}`)
  }
  for (const w of warnings) {
    lines.push(`  🟡 ${w.path}: ${w.message}`)
  }
  for (const i of infos) {
    lines.push(`  🔵 ${i.path}: ${i.message}`)
  }

  return lines.join('\n')
}
