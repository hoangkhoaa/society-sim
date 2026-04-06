// ── Enums & Literals ───────────────────────────────────────────────────────

export type Role = 'farmer' | 'craftsman' | 'scholar' | 'merchant' | 'guard' | 'leader'
export type Gender = 'male' | 'female'
export type ActionState = 'working' | 'resting' | 'socializing' | 'organizing' | 'fleeing' | 'complying' | 'confront'
export type DeathCause = 'natural' | 'accident' | 'disease' | 'violence'
export type InstitutionId = 'government' | 'market' | 'opposition' | 'community' | 'guard'
export type EventType =
  | 'storm' | 'drought' | 'flood' | 'epidemic' | 'resource_boom' | 'harsh_winter'
  | 'trade_offer' | 'refugee_wave' | 'ideology_import' | 'external_threat' | 'blockade'
  | 'scandal_leak' | 'charismatic_npc' | 'martyr' | 'tech_shift'
export type EventSource = 'player' | 'institution' | 'natural' | 'cascade'
export type MemoryType = 'trust_broken' | 'helped' | 'harmed' | 'crisis' | 'windfall' | 'loss'
export type MessageChannel = 'public' | 'private' | 'signal' | 'rumor'
export type MessageType = 'proposal' | 'warning' | 'commitment' | 'info' | 'appeal' | 'ultimatum'
export type FeedSeverity = 'info' | 'warning' | 'critical' | 'political' | 'player'

// ── Appearance ─────────────────────────────────────────────────────────────

export interface NPCAppearance {
  height: 'short' | 'average' | 'tall'
  build: 'slim' | 'average' | 'sturdy'
  hair: 'black' | 'brown' | 'gray' | 'white'
  skin: 'light' | 'medium' | 'dark'
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export interface NPCLifecycle {
  is_alive: boolean
  death_cause: DeathCause | null
  death_tick: number | null
  spouse_id: number | null
  children_ids: number[]
  fertility: number             // 0–1, decreases with age
}

// ── Trust ──────────────────────────────────────────────────────────────────

export interface TrustScore {
  competence: number            // tin họ đủ năng lực? (0–1)
  intention: number             // tin họ vì dân? (0–1)
}

export type TrustMap = Record<InstitutionId, TrustScore>

// ── Memory ─────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  event_id: string
  type: MemoryType
  emotional_weight: number      // -100 đến +100
  tick: number
}

// ── Worldview ──────────────────────────────────────────────────────────────

export interface Worldview {
  collectivism: number          // 0=individualist, 1=collectivist
  authority_trust: number       // 0=anti-authority, 1=obedient
  risk_tolerance: number        // 0=risk-averse, 1=risk-seeking
  time_preference: number       // 0=short-term, 1=long-term
}

// ── NPC ────────────────────────────────────────────────────────────────────

export interface NPC {
  id: number
  name: string
  age: number
  gender: Gender
  appearance: NPCAppearance
  lifecycle: NPCLifecycle
  occupation: string            // 'Blacksmith', 'Rice Farmer', etc.
  description: string           // static, template-based on init
  daily_thought: string         // dynamic, LLM-generated on click / event
  last_thought_tick: number

  zone: string
  x: number
  y: number
  role: Role

  // Needs (0–100)
  hunger: number
  exhaustion: number
  isolation: number
  fear: number

  // Worldview
  worldview: Worldview

  // Computed state
  stress: number
  happiness: number
  action_state: ActionState

  // Thresholds (fixed at init)
  stress_threshold: number
  collective_action_threshold: number
  adaptability: number
  base_skill: number

  // Memory (10 entries)
  memory: MemoryEntry[]

  // Network
  strong_ties: number[]         // 5–15 NPC ids
  weak_ties: number[]           // 50–150 NPC ids
  influence_score: number       // network centrality

  // Trust per institution (two-dimensional: competence and intention)
  trust_in: TrustMap

  // Resources
  wealth: number

  // Cascade mechanics
  grievance: number
  dissonance_acc: number
  susceptible: boolean
}

// ── Constitution ───────────────────────────────────────────────────────────

export type ValuePriority = 'security' | 'equality' | 'freedom' | 'growth'

export interface RoleRatios {
  farmer: number
  craftsman: number
  scholar: number
  merchant: number
  guard: number
  leader: number
}

export interface Constitution {
  // Economy
  gini_start: number            // 0–1
  market_freedom: number        // 0–1
  resource_scarcity: number     // 0–1

  // Politics
  state_power: number           // 0–1
  safety_net: number            // 0–1
  individual_rights_floor: number // 0–1

  // Society
  base_trust: number            // 0–1
  network_cohesion: number      // 0–1

  // Value priorities (rank 0 = most important)
  value_priority: [ValuePriority, ValuePriority, ValuePriority, ValuePriority]

  // Role ratios across the population (sum = 1.0)
  role_ratios: RoleRatios

  // Short description (from God Agent setup conversation)
  description: string
}

// ── Event ──────────────────────────────────────────────────────────────────

export interface EventEffects {
  food_stock_delta: number
  stress_delta: number
  trust_delta: number
  displacement_chance: number
}

export interface EventTrigger {
  condition: (state: WorldState) => boolean
  spawn: Partial<SimEvent>
}

export interface SimEvent {
  id: string
  type: EventType
  intensity: number             // 0–1
  zones: string[]
  duration_ticks: number
  elapsed_ticks: number
  effects_per_tick: EventEffects
  source: EventSource
  narrative_open: string
  triggers: EventTrigger[]
}

// ── Institution ────────────────────────────────────────────────────────────

export interface InstitutionRelation {
  trust: number
  active_deal: Deal | null
  last_interaction: number      // tick
}

export interface Institution {
  id: InstitutionId
  name: string
  resources: number
  legitimacy: number            // 0–1
  power: number                 // 0–1

  worldview: Worldview

  inbox: InstitutionMessage[]
  sent: InstitutionMessage[]
  decisions: Decision[]

  relations: Partial<Record<InstitutionId, InstitutionRelation>>

  last_decided_tick: number
  decide_interval: number
  force_decide: boolean
}

// ── Communication ──────────────────────────────────────────────────────────

export interface InstitutionMessage {
  id: string
  from: InstitutionId
  to: InstitutionId | 'all'
  channel: MessageChannel
  type: MessageType
  content: string
  public_cover: string
  credibility: number
  can_leak: boolean
  tick: number
}

export interface Deal {
  terms: string
  expires_tick: number
  parties: InstitutionId[]
}

export interface Decision {
  action: string
  target: string
  resources_spent: number
  timeline: 'immediate' | '3_days' | '1_week'
  public_statement: string
  private_intent: string
  signal_to: InstitutionId | null
  messages: InstitutionMessage[]
  tick: number
}

// ── Narrative ──────────────────────────────────────────────────────────────

export interface NarrativeEntry {
  id: string
  tick: number
  day: number
  year: number
  text: string
  icon: string
  severity: FeedSeverity
  related_npc_ids: number[]
  related_zones: string[]
}

// ── Macro Stats ────────────────────────────────────────────────────────────

export interface MacroStats {
  food: number                  // 0–100
  stability: number             // 0–100
  trust: number                 // 0–100 (avg govt intention)
  gini: number                  // 0–1
  political_pressure: number    // 0–100
}

// ── Network ────────────────────────────────────────────────────────────────

export interface NetworkGraph {
  strong: Map<number, Set<number>>
  weak: Map<number, Set<number>>
  clusters: Map<number, number>  // npcId → clusterId
}

// ── World State ────────────────────────────────────────────────────────────

export interface WorldState {
  tick: number                  // 1 tick = 1 giờ sim
  day: number
  year: number

  constitution: Constitution
  npcs: NPC[]
  institutions: Institution[]
  active_events: SimEvent[]
  network: NetworkGraph

  macro: MacroStats
  food_stock: number            // raw pool, tính food % từ đây

  narrative_log: NarrativeEntry[]

  drift_score: number
  crisis_pending: boolean
}

// ── AI Types ───────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'anthropic' | 'openai'

export interface AIConfig {
  provider: AIProvider
  key: string
  model?: string
}

export interface GodResponse {
  type: 'event' | 'answer' | 'warning' | 'setup'
  event: Partial<SimEvent> | null
  answer: string
  requires_confirm: boolean
  warning?: string
  constitution?: Partial<Constitution>  // khi type === 'setup'
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── UI Types ───────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string
  body: string
  onConfirm: () => void
  onCancel?: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────

export const INSTITUTION_NAMES: Record<InstitutionId, string> = {
  government: 'Governing Council',
  market: 'Merchants Guild',
  opposition: 'Opposition',
  community: 'Community Assembly',
  guard: 'Guard Corps',
}

export const ROLE_OCCUPATIONS: Record<Role, string[]> = {
  farmer:    ['Rice Farmer', 'Vegetable Grower', 'Livestock Keeper', 'Gardener'],
  craftsman: ['Blacksmith', 'Carpenter', 'Weaver', 'Potter', 'Mason'],
  merchant:  ['Trader', 'Innkeeper', 'Money Changer', 'Peddler'],
  scholar:   ['Teacher', 'Physician', 'Scholar', 'Philosopher', 'Scribe'],
  guard:     ['Sentry', 'Militia', 'Patrol Officer', 'Squad Leader'],
  leader:    ['Council Member', 'District Chief', 'Elder', 'Official'],
}

export const ZONES = [
  'north_farm', 'south_farm',
  'workshop_district',
  'market_square',
  'scholar_quarter',
  'residential_east', 'residential_west',
  'guard_post',
  'plaza',
] as const

export type Zone = typeof ZONES[number]

export const ZONE_LABELS: Record<string, string> = {
  north_farm: 'North Farmlands',
  south_farm: 'South Farmlands',
  workshop_district: 'Workshop District',
  market_square: 'Market Square',
  scholar_quarter: 'Scholar Quarter',
  residential_east: 'East Residential',
  residential_west: 'West Residential',
  guard_post: 'Guard Post',
  plaza: 'Plaza',
}

export const FEED_ICONS: Record<string, string> = {
  nature: '🌿',
  economic: '📈',
  rumor: '💬',
  social: '👥',
  political: '⚡',
  critical: '⚠',
  player: '🌐',
  birth: '👶',
  death: '💀',
  marriage: '💍',
}

export const VIETNAMESE_NAMES_MALE = [
  'An', 'Bình', 'Dũng', 'Hùng', 'Long', 'Minh', 'Nam', 'Phong',
  'Quân', 'Sơn', 'Tâm', 'Tuấn', 'Việt', 'Xuân', 'Khoa', 'Đức',
  'Hải', 'Kiên', 'Lâm', 'Nhân', 'Quý', 'Thịnh', 'Uy', 'Văn',
]

export const VIETNAMESE_NAMES_FEMALE = [
  'Châu', 'Em', 'Giang', 'Hoa', 'Lan', 'Linh', 'Mai', 'Oanh',
  'Thảo', 'Uyên', 'Xuân', 'Yến', 'Ánh', 'Chi', 'Duyên', 'Hằng',
  'Khánh', 'Lệ', 'Ngọc', 'Phương', 'Quỳnh', 'Thanh', 'Vân', 'Diễm',
]
