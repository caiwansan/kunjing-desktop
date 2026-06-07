// ============================================================
// script-breakdown.ts — Narrative Compiler v2 Structured IR
// 
// AI 直接输出的结构化拆解结果，不再经过 prompt 编辑层
// output schema = 给 AI 的 task spec
// ============================================================

/** 角色表 — 固定需求1 */
export interface BreakdownCharacter {
  name: string
  description: string          // 详细形象描述（年龄、外貌、衣着、气质）
  voiceStyle: string           // 音色描述（语气特征、语速、音高）
}

/** 场景表 — 固定需求2 */
export interface BreakdownScene {
  name: string
  description: string          // 详细环境描述（时间、光线、氛围、陈设）
}

/** 对话表 — 固定需求3 */
export interface BreakdownDialogue {
  scene: string                // 所属场景名
  character: string            // 角色名
  dialogue: string             // 台词内容
  tone: string                 // 语气描述
}

/** 动作表情表 — 固定需求4 */
export interface BreakdownAction {
  scene: string                // 所属场景名
  character: string            // 角色名
  action: string               // 详细动作描述
  expression: string           // 面部表情描述
}

/** 每个镜头节拍 — 一段 videoSegment 内部按镜头语义切分 */
export interface VideoBeat {
  start: number                // 该 beat 在本段中的起始秒（0-based）
  end: number                  // 该 beat 在本段中的结束秒
  visual: string               // 画面描述（固定需求5）
  camera: string               // 镜头类型（特写/中景/远景/推/拉/摇/移/跟）
  dialogue: string             // 该 beat 的台词（如果有）
  effect: string               // 特效描述
  sound: string                // 音效描述
}

/** 视频段落 — 8-10s 一段，每段按镜头切分成 beats */
export interface VideoSegment {
  id: number
  title: string                // 段落标题
  scene: string                // 所属场景名
  duration: number             // 8-10s
  beats: VideoBeat[]           // 镜头节拍列表（语义切分，不要求固定秒数）
  characters: string[]         // 参与角色名列表
  transition: string           // 段落转场方式
}

/** 音色表 — 固定需求6（角色关联） */
export interface BreakdownVoice {
  character: string            // 角色名
  style: string                // 音色风格描述
  pitch: string                // 音高描述
  speed: string                // 语速描述
}

// ============================================================
// ScriptBreakdown — AI 输出的完整结构化拆解结果
// ============================================================

export interface ScriptBreakdown {
  projectName: string
  title: string
  totalDuration: number
  characters: BreakdownCharacter[]
  scenes: BreakdownScene[]
  dialogues: BreakdownDialogue[]
  actions: BreakdownAction[]
  videoSegments: VideoSegment[]
  voices: BreakdownVoice[]
}
