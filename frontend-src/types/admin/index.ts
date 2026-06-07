// ===== 管理后台 - 核心类型定义 =====

// 用户角色
export type AdminRole = 'SuperAdmin' | 'Operator' | 'Reviewer' | 'Finance' | 'CustomerService' | 'Developer'

// 会员等级
export type MemberLevel = 'Free' | 'Pro' | 'Director' | 'Enterprise'

// 模型提供商
export type ModelProvider = 'OpenAI' | 'Gemini' | 'Seedream' | 'Flux' | 'SDXL' | 'Kling' | 'Runway' | 'Veo' | 'Wan' | 'Hunyuan'

// 模型类型
export type ModelType = 'image' | 'video'

// Agent 类型
export type AgentType = 'director' | 'writer' | 'camera' | 'editor' | 'dub' | 'operator'

// 审核状态
export type ModerationStatus = 'pending' | 'passed' | 'rejected' | 'reviewing'

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// 审核分类
export type ModerationCategory = 'political' | 'violent' | 'pornographic' | 'copyright' | 'sensitive_person'

// 用户状态
export type UserStatus = 'active' | 'frozen' | 'banned'

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'refunding' | 'refunded' | 'cancelled'

// API Key 状态
export type ApiKeyStatus = 'active' | 'expired' | 'error'

// GPU 状态
export type GpuStatus = 'idle' | 'busy' | 'error' | 'offline'

// 工作流节点类型
export type WorkflowNodeType = 'prompt' | 'character' | 'storyboard' | 'image' | 'video' | 'audio' | 'subtitle' | 'review' | 'export'

// 服务状态
export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'maintenance'

// ===== 用户管理 =====
export interface AdminUser {
  id: string
  avatar: string
  nickname: string
  phone: string
  email: string
  level: MemberLevel
  tokensUsed: number
  tokensRemaining: number
  status: UserStatus
  role: AdminRole
  createdAt: string
  lastLogin: string
  totalProjects: number
  totalVideos: number
  totalImages: number
}

export interface UserDetail extends AdminUser {
  generateHistory: GenerateRecord[]
  consumptionStats: ConsumptionStats
  modelPreferences: ModelPreference[]
}

export interface GenerateRecord {
  id: string
  type: 'image' | 'video'
  model: string
  prompt: string
  status: 'success' | 'failed'
  tokens: number
  createdAt: string
  duration: number
}

export interface ConsumptionStats {
  totalTokens: number
  totalCost: number
  dailyAvg: number
  peakDay: string
  peakTokens: number
}

export interface ModelPreference {
  model: string
  count: number
  percentage: number
}

// ===== 会员系统 =====
export interface MemberTier {
  level: MemberLevel
  name: string
  price: number
  priceYearly: number
  features: string[]
  dailyQuota: number
  monthlyQuota: number
  maxResolution: string
  maxDuration: number
  concurrentTasks: number
  priority: number
  apiAccess: boolean
  watermark: boolean
  customModel: boolean
  teamMembers: number
}

export interface PermissionMatrix {
  role: AdminRole
  permissions: string[]
  memberLevels: MemberLevel[]
}

// ===== API Hub =====
export interface ModelInfo {
  id: string
  name: string
  provider: ModelProvider
  type: ModelType
  status: 'online' | 'offline' | 'degraded'
  latency: number
  errorRate: number
  dailyRequests: number
  balance: number
  costPerRequest: number
  healthScore: number
  description: string
  version: string
  lastChecked: string
}

export interface ApiKey {
  id: string
  name: string
  key: string
  provider: ModelProvider
  status: ApiKeyStatus
  balance: number
  monthlyLimit: number
  usedThisMonth: number
  lastUsed: string
  created: string
  expiresAt: string
}

// ===== Render Intelligence =====
export interface RouteDecision {
  id: string
  taskType: string
  inputSize: string
  selectedModel: string
  candidates: RouteCandidate[]
  factors: DecisionFactor[]
  timestamp: string
  executionTime: number
  cost: number
  quality: number
}

export interface RouteCandidate {
  model: string
  cost: number
  quality: number
  speed: number
  confidence: number
  totalScore: number
}

export interface DecisionFactor {
  name: string
  weight: number
  value: number
  contribution: number
}

// ===== Agent 系统 =====
export interface Agent {
  id: string
  type: AgentType
  name: string
  avatar: string
  status: 'idle' | 'working' | 'error' | 'paused'
  currentTask: string
  completedTasks: number
  failedTasks: number
  avgInferenceTime: number
  totalCost: number
  tokensUsed: number
  lastActive: string
  temperature: number
  model: string
}

export interface AgentMessage {
  id: string
  from: AgentType
  to: AgentType
  content: string
  type: 'instruction' | 'feedback' | 'result' | 'error'
  timestamp: string
  duration: number
}

// ===== GPU 中心 =====
export interface GpuDevice {
  id: string
  name: string
  utilization: number
  memoryUsed: number
  memoryTotal: number
  temperature: number
  power: number
  status: GpuStatus
  processes: GpuProcess[]
  lastUpdated: string
}

export interface GpuProcess {
  pid: number
  name: string
  memory: number
  user: string
}

export interface RenderTask {
  id: string
  type: string
  model: string
  userId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  estimatedTime: number
  elapsedTime: number
  gpuId: string | null
  createdAt: string
}

// ===== 审核系统 =====
export interface ModerationItem {
  id: string
  type: 'image' | 'video' | 'text'
  content: string
  thumbnail: string
  userId: string
  nickname: string
  categories: ModerationCategory[]
  riskLevel: RiskLevel
  status: ModerationStatus
  pipelineStep: 'llm' | 'image' | 'video' | 'human'
  score: number
  reporter: string
  createdAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string
}

export interface ModerationLog {
  id: string
  itemId: string
  action: 'auto_pass' | 'auto_reject' | 'human_pass' | 'human_reject' | 'escalate'
  reviewer: string
  oldStatus: ModerationStatus
  newStatus: ModerationStatus
  reason: string
  timestamp: string
}

// ===== 财务系统 =====
export interface Order {
  id: string
  userId: string
  nickname: string
  type: 'membership' | 'credits' | 'custom'
  plan: string
  amount: number
  currency: string
  status: OrderStatus
  paymentMethod: string
  coupon: string | null
  invoice: string | null
  createdAt: string
  paidAt: string | null
  refundedAt: string | null
}

export interface Invoice {
  id: string
  orderId: string
  userId: string
  companyName: string
  taxId: string
  amount: number
  status: 'pending' | 'issued' | 'cancelled'
  createdAt: string
  issuedAt: string | null
}

// ===== 工作流 =====
export interface WorkflowNodeData {
  type: WorkflowNodeType
  label: string
  icon: string
  status: 'idle' | 'running' | 'success' | 'error'
  config: Record<string, any>
  progress?: number
  output?: string
}

// ===== 运维 =====
export interface ServiceInfo {
  name: string
  type: 'docker' | 'redis' | 'postgresql' | 'sse' | 'api'
  status: ServiceStatus
  uptime: string
  cpu: number
  memory: number
  version: string
  updatedAt: string
}

export interface LogEntry {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  service: string
  message: string
  timestamp: string
  trace: string | null
}

// ===== 系统配置 =====
export interface SystemConfig {
  key: string
  name: string
  type: 'switch' | 'text' | 'number' | 'select' | 'json' | 'password'
  value: any
  defaultValue: any
  description: string
  category: 'system' | 'model' | 'prompt' | 'storage' | 'email' | 'payment'
  editable: boolean
}

// ===== Dashboard =====
export interface DashboardStats {
  todayGenerations: number
  onlineUsers: number
  gpuUtilization: number
  apiCalls: number
  successRate: number
  todayRevenue: number
  trend: 'up' | 'down' | 'stable'
  percentage: number
}

export interface PipelineNode {
  id: string
  name: string
  icon: string
  status: 'idle' | 'processing' | 'done' | 'error'
}

export interface ModelRanking {
  model: string
  calls: number
  successRate: number
  avgLatency: number
}

export interface AlertItem {
  id: string
  level: RiskLevel
  title: string
  message: string
  time: string
  source: string
}

// ===== 数据分析 =====
export interface AnalyticsData {
  date: string
  value: number
}

export interface ModelCallRanking {
  model: string
  count: number
  percentage: number
  trend: 'up' | 'down'
}
