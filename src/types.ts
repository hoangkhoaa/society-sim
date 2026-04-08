// ── Enums & Literals ───────────────────────────────────────────────────────

export type Role = 'farmer' | 'craftsman' | 'scholar' | 'merchant' | 'guard' | 'leader' | 'child'

// ── Work Motivation ────────────────────────────────────────────────────────
// survival   – works to meet basic needs (poverty-driven; productivity spikes when hungry)
// coerced    – works under threat or force (fear-driven; output degrades under high fear)
// mandatory  – works because duty or social norms require it (steady but uninspired)
// happiness  – works for personal fulfillment (output strongly follows happiness)
// achievement– works to prove competence and compete (skill-driven, competitive boost)
// duty       – works out of loyalty or cultural obligation (stable, collectivism-linked)
export type WorkMotivationType = 'survival' | 'coerced' | 'mandatory' | 'happiness' | 'achievement' | 'duty'

// ── Work Schedule ──────────────────────────────────────────────────────────
// Regime-level daily rhythm: how many days a week people work and when.
export interface WorkSchedule {
  work_days_per_week: number    // 1–7  (7 = no days off)
  work_start_hour:   number    // 0–23 (regime/role baseline start)
  work_end_hour:     number    // 0–23 (regime/role baseline end)
}
export type Gender = 'male' | 'female'
export type ActionState = 'working' | 'resting' | 'socializing' | 'organizing' | 'fleeing' | 'complying' | 'confront'
export type DeathCause = 'natural' | 'accident' | 'disease' | 'violence' | 'starvation'
export type InstitutionId = 'government' | 'market' | 'opposition' | 'community' | 'guard'
export type EventType =
  | 'storm' | 'drought' | 'flood' | 'tsunami' | 'epidemic' | 'resource_boom' | 'harsh_winter'
  | 'trade_offer' | 'refugee_wave' | 'ideology_import' | 'external_threat' | 'blockade'
  | 'scandal_leak' | 'charismatic_npc' | 'martyr' | 'tech_shift' | 'wildfire' | 'earthquake'
export type EventSource = 'player' | 'institution' | 'natural' | 'cascade'
export type MemoryType = 'trust_broken' | 'helped' | 'harmed' | 'crisis' | 'windfall' | 'loss' | 'illness' | 'crime' | 'accident'
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
  last_birth_tick: number | null  // sim tick of the most recent child birth (for spacing)

  // ── Romance system ────────────────────────────────────────────────────────
  romance_target_id: number | null  // id of NPC they currently have feelings for (courtship)
  romance_score: number             // accumulated attraction 0–100; marriage triggers at high mutual score
  heartbreak_cooldown: number       // ticks remaining where new romance is suppressed after a breakup
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

  zone: string                  // current location (changes with action/time of day)
  home_zone: string             // permanent work/residence zone (never changes)
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
  strong_ties: number[]         // 5–15 NPC ids — direct face-to-face connections
  weak_ties: number[]           // 50–150 NPC ids — geographic acquaintances
  info_ties: number[]           // 10–40 NPC ids — information network (social media, groups, shared interests)
  influence_score: number       // network centrality

  // Economics
  daily_income: number          // average daily earnings (rolling average)

  // Trust per institution (two-dimensional: competence and intention)
  trust_in: TrustMap

  // Resources
  wealth: number

  // Cascade mechanics
  grievance: number
  dissonance_acc: number
  susceptible: boolean

  // Individual life events
  sick: boolean                 // currently ill — reduces productivity, can spread
  sick_ticks: number            // ticks remaining sick
  criminal_record: boolean      // has a crime record — reduces trust, social ties
  community_group: number | null // id of community group they belong to (-1 = none)

  // Burnout tracking
  burnout_ticks: number         // consecutive ticks with stress>70 AND exhaustion>70; burnout triggers at 480 (20 days)

  // Debt (merchant lending system)
  debt: number                  // total amount owed (0 = debt-free)
  debt_to: number | null        // creditor NPC id

  // Faction & Legacy
  faction_id: number | null     // political faction membership (null = independent)
  legendary: boolean            // marked as a historical figure

  // Work rhythm & motivation
  work_motivation: WorkMotivationType   // what drives this NPC to work (regime-aligned + individual noise)
  bio_clock_offset: number              // individual biological clock offset in hours (−2 to +3)
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

  // Regime work schedule (optional — derived from other params when absent)
  work_schedule?: WorkSchedule
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

// ── Faction ────────────────────────────────────────────────────────────────

export interface Faction {
  id: number
  name: string
  dominant_value: ValuePriority
  member_ids: number[]
  power: number               // sum of member influence_scores
  founded_tick: number
  last_action_tick: number
}

// ── Tech Tree ──────────────────────────────────────────────────────────────

export interface TechDiscovery {
  id: string
  name: string
  discovered_tick: number
  researcher_name: string
}

// ── Referendum ─────────────────────────────────────────────────────────────

export interface Referendum {
  proposal_text: string
  field: 'safety_net' | 'individual_rights_floor' | 'market_freedom' | 'state_power'
  current_value: number
  proposed_value: number
  expires_tick: number        // auto-resolves after 7 days
}

// ── Rumor ──────────────────────────────────────────────────────────────────

export interface Rumor {
  id: string
  content: string
  subject: 'government' | 'guard' | 'market' | 'community' | number  // number = NPC id
  effect: 'trust_down' | 'trust_up' | 'fear_up' | 'grievance_up'
  reach: number               // how many NPCs have been exposed
  born_tick: number
  expires_tick: number
}

// ── History Milestone ──────────────────────────────────────────────────────

export interface HistoryMilestone {
  tick: number
  year: number
  day: number
  text: string
  icon: string
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
  natural_resources: number     // 0–100 (remaining extractable resource pool)
  energy: number                // 0–100 (society's productive energy output)
  literacy: number              // 0–100 (driven by scholar output; boosts economy & info spread)
}

// ── Network ────────────────────────────────────────────────────────────────

export interface NetworkGraph {
  strong: Map<number, Set<number>>
  weak: Map<number, Set<number>>
  info: Map<number, Set<number>>   // information network (similarity-based)
  clusters: Map<number, number>  // npcId → clusterId
}

// ── World State ────────────────────────────────────────────────────────────

export interface WorldState {
  tick: number                  // 1 tick = 1 sim hour, 24 ticks = 1 day
  day: number
  year: number

  constitution: Constitution
  npcs: NPC[]
  institutions: Institution[]
  active_events: SimEvent[]
  network: NetworkGraph

  macro: MacroStats
  food_stock: number            // raw pool, compute food % from here
  natural_resources: number     // raw natural resource pool (0–100 000)

  narrative_log: NarrativeEntry[]

  drift_score: number
  crisis_pending: boolean

  // Extended systems
  factions: Faction[]
  research_points: number
  discoveries: TechDiscovery[]
  referendum: Referendum | null
  quarantine_zones: string[]    // zones locked by guard quarantine during epidemics

  // History & rumor
  rumors: Rumor[]
  milestones: HistoryMilestone[]
  births_total: number
  immigration_total: number
}

// ── AI Types ───────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'ollama_cloud'
export type TokenMode = 'events_only' | 'events_plus_npc_control' | 'unlimited'

export interface AIConfig {
  provider: AIProvider
  key: string
  model?: string
  token_mode: TokenMode
  base_url?: string
  rpm_limit: number             // user-configured requests per minute (0 = unlimited)
}

// ── NPC Intervention ───────────────────────────────────────────────────────

export interface NPCIntervention {
  /** Which NPCs to target */
  target: 'all' | 'zone' | 'role' | 'id_list'
  zones?: string[]      // when target === 'zone'
  roles?: Role[]        // when target === 'role'
  npc_ids?: number[]    // when target === 'id_list'
  count?: number        // max NPCs to affect (random selection if population > count)

  // Direct effects
  kill?: boolean
  kill_cause?: DeathCause
  action_state?: ActionState

  // Additive stat deltas (clamped to valid ranges after application)
  stress_delta?: number
  fear_delta?: number
  hunger_delta?: number
  grievance_delta?: number
  happiness_delta?: number

  // Worldview shifts (additive, clamped 0-1)
  worldview_delta?: {
    collectivism?: number
    authority_trust?: number
    risk_tolerance?: number
    time_preference?: number
  }

  // Inject a memory entry
  memory?: {
    type: MemoryType
    emotional_weight: number
  }
}

export interface GodResponse {
  type: 'event' | 'answer' | 'warning' | 'setup' | 'intervention'
  event: Partial<SimEvent> | null
  interventions?: NPCIntervention[]   // direct NPC/world manipulations
  answer: string
  requires_confirm: boolean
  warning?: string
  constitution?: Partial<Constitution>  // when type === 'setup'
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
  child:     ['Child'],
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
  north_farm: 'Northern Fields',
  south_farm: 'Southern Pastures',
  workshop_district: 'Artisan Row',
  market_square: 'Market Quarter',
  scholar_quarter: 'Academy Hill',
  residential_east: 'East Settlement',
  residential_west: 'West Village',
  guard_post: 'The Garrison',
  plaza: 'Town Square',
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
