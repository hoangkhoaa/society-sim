// ── Enums & Literals ───────────────────────────────────────────────────────

export type Role = 'farmer' | 'craftsman' | 'scholar' | 'merchant' | 'guard' | 'leader' | 'child' | 'healthcare' | 'gang'

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
export type ActionState = 'working' | 'resting' | 'socializing' | 'family' | 'organizing' | 'fleeing' | 'complying' | 'confront'
export type DeathCause = 'natural' | 'accident' | 'disease' | 'violence' | 'starvation' | 'fled'
export type InstitutionId = 'government' | 'market' | 'opposition' | 'community' | 'guard'
export type EventType =
  | 'storm' | 'drought' | 'flood' | 'tsunami' | 'epidemic' | 'resource_boom' | 'harsh_winter'
  | 'trade_offer' | 'refugee_wave' | 'ideology_import' | 'external_threat' | 'blockade'
  | 'scandal_leak' | 'charismatic_npc' | 'martyr' | 'tech_shift' | 'wildfire' | 'earthquake'
  | 'nuclear_explosion' | 'bombing' | 'meteor_strike' | 'volcanic_eruption'
  | 'heatwave' | 'landslide' | 'tornado' | 'locust_plague'
  | 'festival' | 'golden_harvest' | 'cultural_renaissance'
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

export type NPCRelationEventType =
  | 'trade_fair'
  | 'tutored'
  | 'treated'
  | 'lent_money'
  | 'repaid_debt'
  | 'defaulted_debt'
  | 'conflict'
  | 'helped_direct'
  | 'persuaded'
  | 'reconciled'
  | 'witnessed_crime'

export interface NPCRelationEdge {
  competence: number            // perceived ability of this specific NPC (0-1)
  intention: number             // perceived goodwill of this specific NPC (0-1)
  affinity: number              // social closeness / liking (0-1)
  conflict: number              // active interpersonal tension (0-1)
  event_count: number           // number of recorded interactions on this edge
  last_event_tick: number       // recency marker for decay/eviction
  last_event_type: NPCRelationEventType
}

export interface NPCRelationEvent {
  other_id: number
  tick: number
  type: NPCRelationEventType
  delta_competence: number
  delta_intention: number
  delta_affinity: number
  delta_conflict: number
}

// ── Worldview ──────────────────────────────────────────────────────────────

export interface Worldview {
  collectivism: number          // 0=individualist, 1=collectivist
  authority_trust: number       // 0=anti-authority, 1=obedient
  risk_tolerance: number        // 0=risk-averse, 1=risk-seeking
  time_preference: number       // 0=short-term, 1=long-term
}

// ── Personality ────────────────────────────────────────────────────────────
// Fixed character traits assigned at birth.  They bias (but do not override)
// behaviour driven by needs and worldview.

export interface NPCPersonality {
  greed:      number  // 0–1: drives wealth hoarding, investment hunger, exploitation
  aggression: number  // 0–1: raises crime probability, conflict escalation, confrontation
  loyalty:    number  // 0–1: commitment to family, faction, and syndicate
  ambition:   number  // 0–1: drives career advancement, risk-taking, and investment
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

  // ── Class Solidarity / Labor Relations ─────────────────────────────────────
  // Models collective class consciousness — how strongly an NPC identifies with
  // their economic class and is willing to act collectively.
  // Spreads via weak_ties among same-role / same-wealth-bracket neighbors.
  // Distinct from grievance (personal suffering) and dissonance (ideological).
  class_solidarity: number       // 0–100: solidarity with their economic class
  on_strike: boolean             // currently participating in a labor strike

  // ── Network enrichment ─────────────────────────────────────────────────────
  // Betweenness centrality proxy: fraction of distinct zone-clusters in weak_ties.
  // High bridge_score = NPC bridges separate communities → higher influence.
  bridge_score: number           // 0–1

  // ── Mentorship ───────────────────────────────────────────────────────────
  // Youth and early-career NPCs can learn from a social mentor.
  mentor_id: number | null       // strong-tie adult mentor; null when unassigned

  // ── Tư liệu lao động (Means of Production) ─────────────────────────────────
  // Productive capital owned by this NPC — land, tools, machinery, trade stock.
  // High capital → productivity boost; zero capital → must rent or work bare-handed.
  // Accumulates slowly from surplus wealth; inherited on death; affected by policy.
  capital: number                    // 0–100: owned productive capital
  capital_rents_from: number | null  // NPC id of capital owner (null = self-owned or none found)
  capital_rent_paid: number          // coins/tick currently paying as rent (0 if self-owned)

  // ── Emergency role tracking ───────────────────────────────────────────────
  // Set when a food/security crisis forces a temporary role reassignment.
  // Cleared when the NPC reverts, or set to undefined after 90 days (role made permanent).
  original_role?:       Role    // role held before emergency reassignment
  emergency_role_tick?: number  // sim tick when the emergency switch happened

  // ── Voluntary role adaptation tracking ───────────────────────────────────
  // Used by the adaptive labor rebalancing pass (non-emergency market-like switching).
  last_role_switch_tick?: number       // sim tick of last voluntary permanent role switch
  role_retraining_until_tick?: number  // while active, productivity has a temporary retraining penalty

  // ── Persistent chat memory ────────────────────────────────────────────────
  // Compact summary of past player ↔ NPC conversations. Generated when the
  // chat panel closes after 3+ turns. Persisted via WorldState / localStorage.
  // Max ~300 chars. Passed to the NPC agent system prompt for continuity.
  chat_summary?: string

  // ── Personality (fixed at birth) ─────────────────────────────────────────
  // Character traits that bias (but do not override) need- and worldview-driven behaviour.
  // Optional for backward-compat with any serialised state that predates this field.
  personality?: NPCPersonality

  // ── Enmity (persistent grudges) ──────────────────────────────────────────
  // NPC ids toward whom this NPC holds active hostile feelings.  Enmity is
  // acquired when a NPC witnesses crimes committed by another NPC (direct
  // observation via strong_ties).  Maximum 5 entries — oldest grudge is
  // dropped when the list overflows.  Enemies in the same zone escalate to confront.
  // Optional for backward-compat with any serialised state that predates this field.
  enmity_ids?: number[]

  // ── Direct NPC relationship graph (sparse) ──────────────────────────────
  // Captures interpersonal trust and tension toward specific NPC ids.
  // Optional for backward-compat with saves created before this system.
  relation_map?: Record<number, NPCRelationEdge>
  relation_history?: NPCRelationEvent[]
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
  healthcare: number
  gang: number
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
  /** Fraction of affected NPCs killed immediately when event spawns (0–1). Used for catastrophic events. */
  instant_kill_rate?: number
  /** Death cause for instant kills: defaults to 'accident' if omitted */
  instant_kill_cause?: DeathCause
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
  rival_faction_id?: number      // id of primary opposing faction (set when conflict detected)
  conflict_score: number         // 0–100, escalates over time when rivals coexist
}

// ── Organized Crime Syndicate ─────────────────────────────────────────────
// Criminal NPCs self-organize into syndicates when criminal population exceeds
// 4% and inequality is high. Syndicates collect dues, run protection rackets,
// bribe guards, and recruit high-grievance NPCs. Guard crackdowns can bust them.

export interface Syndicate {
  id: number
  name: string
  boss_id: number               // NPC id of the highest-wealth criminal who founded it
  member_ids: number[]          // NPC ids of all members (including boss)
  territory: string[]           // zones this syndicate operates in
  resources: number             // accumulated wealth from dues and rackets
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
  planted_by_player?: boolean  // true = injected via God Agent
  suppressed?: boolean         // true = censorship caught it before spreading
}

// ── Cultural Scar ─────────────────────────────────────────────────────────
/** A collective trauma left by a major crisis — permanently shifts NPC worldviews */
export interface CulturalScar {
  id: string
  type: 'famine' | 'epidemic' | 'collapse' | 'war' | 'massacre'
  year: number
  day: number
  label: string            // e.g. "The Great Famine of Year 3"
  severity: number         // 0–1, how bad it was
  survivors: number        // how many NPCs were alive when it ended
  worldview_effect: Partial<Worldview>  // permanent drift applied to survivors
}

// ── History Milestone ──────────────────────────────────────────────────────

export interface HistoryMilestone {
  tick: number
  year: number
  day: number
  text: string
  icon: string
}

// ── Formula / Parameter Runtime Patching ─────────────────────────────────

/** All formula keys that can be patched at runtime. */
export type FormulaKey =
  | 'stability'
  | 'polarization'
  | 'labor_unrest'
  | 'stress'
  | 'happiness'
  | 'birth_chance'

/** A single formula expression patch — replaces the named formula with a new expression. */
export interface FormulaPatch {
  /** Which formula to replace. */
  key: FormulaKey
  /** New JS expression string. Must use the same parameter names as the original. */
  expr: string
}

/** Source category for a breakthrough (used for icon/filter display). */
export type BreakthroughSource = 'government_reform' | 'science_discovery' | 'god_agent'

/**
 * A recorded breakthrough — any permanent change to formula expressions or
 * constitution parameters driven by a government reform, scientific discovery,
 * or a direct god-agent command.
 *
 * Stored in `WorldState.breakthrough_log` so the player can review the
 * full history of how society's underlying rules have evolved.
 */
export interface BreakthroughRecord {
  id: string
  tick: number
  year: number
  day: number
  /** Human-readable category label */
  source: BreakthroughSource
  /** Short title shown in the log */
  title: string
  /** One-sentence description of what changed and why */
  description: string
  /** Formula patches applied (key → new expression) */
  formula_patches?: Array<{ key: FormulaKey; prev_expr: string; new_expr: string }>
  /** Constitution parameter deltas applied (key → delta value) */
  constitution_patch?: Partial<Constitution>
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
  corruption_level: number       // 0–1, accumulates over time
  last_purge_tick: number        // tick of last player-initiated purge (-1 = never)
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
  labor_unrest: number          // 0–100 (avg class_solidarity × gini; triggers govt alert ≥65)
  polarization: number          // 0–100 (ideological split from worldview variance)
  gdp: number                   // total daily income across all living NPCs (coins/day)
  extraction_rate: number       // 0–100: resource extraction efficiency relative to theoretical max
  economic_efficiency: number   // 0–100: actual economic output vs potential (productivity × roles)
  /** Days remaining of post-epidemic birth-rate bonus (1.5× multiplier). Decremented daily. */
  post_epidemic_birth_bonus_days?: number
  /** Consecutive days where imports exceeded exports; resets to 0 on any trade surplus. */
  trade_deficit_days?: number
}

// ── Labor Strike ───────────────────────────────────────────────────────────

export interface ActiveStrike {
  role: Role                    // which occupational class is striking
  start_tick: number
  duration_ticks: number        // automatically ends after this; can be shortened by govt policy
  demand: 'wages' | 'conditions' | 'rights'
}

// ── Network ────────────────────────────────────────────────────────────────

export interface NetworkGraph {
  strong: Map<number, Set<number>>
  weak: Map<number, Set<number>>
  info: Map<number, Set<number>>   // information network (similarity-based)
  clusters: Map<number, number>  // npcId → clusterId
}

// ── Objective ──────────────────────────────────────────────────────────────

export interface Objective {
  id: string             // unique e.g. 'food_target_1'
  type: 'stat_above' | 'stat_below' | 'sustain_above' | 'avoid_above'
  stat: keyof MacroStats // e.g. 'food', 'trust', 'gini'
  target: number         // threshold value
  duration_days: number  // how many days to sustain (for sustain/avoid types), or 0 for instant
  progress_days: number  // days already meeting condition
  deadline_day: number   // world.day + window to achieve it
  label: string          // e.g. "Giữ food > 50 trong 20 ngày"
  reward_desc: string    // e.g. "+150 coins"
  completed: boolean
  failed: boolean
}

// ── Dynasty ───────────────────────────────────────────────────────────────
export interface Dynasty {
  id: string
  founder_id: number          // NPC id of first tracked ancestor
  founder_name: string
  current_head_id: number | null   // richest living member
  member_ids: number[]         // all known descendants + founder
  total_wealth: number         // sum of all living members' wealth
  generation_depth: number     // how many generations tracked
  peak_wealth: number          // highest total_wealth ever
  founded_year: number
  oligarchy_warned: boolean    // true if oligarchy warning already fired
}

// ── Charismatic NPC Choice ────────────────────────────────────────────────
export interface CharismaticChoice {
  npc_id: number
  npc_name: string
  npc_role: string
  npc_zone: string
  triggered_day: number
  expires_day: number          // auto-resolves to 'ignore' after 5 days
}

// ── World State ────────────────────────────────────────────────────────────

export interface PublicHealth {
  sanitation: number            // 0–100: water/waste management quality; decays daily, boosted by scholars
  hospital_capacity: number     // 0 or 1: unlocked by health_investment policy spending ≥500
  disease_resistance: number    // 0–1: derived from sanitation (sanitation/100)
  funded_tick: number           // tick when last health_investment was funded (0 = never)
}

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
  civil_war_phase: 'none' | 'escalating' | 'active' | 'resolved'
  civil_war_start_day?: number
  factions: Faction[]
  syndicates: Syndicate[]
  research_points: number
  discoveries: TechDiscovery[]
  referendum: Referendum | null
  quarantine_zones: string[]    // zones locked by guard quarantine during epidemics
  active_strikes: ActiveStrike[]

  // History & rumor
  rumors: Rumor[]
  milestones: HistoryMilestone[]
  cultural_scars: CulturalScar[]
  /** Permanent formula / parameter breakthroughs — government reforms, science, god agent. */
  breakthrough_log: BreakthroughRecord[]
  births_total: number
  immigration_total: number
  pending_charismatic_choice: CharismaticChoice | null

  // Economy
  tax_pool: number              // government treasury — collected from income tax, spent by regime
  money_supply: number          // total nominal money in circulation (coins)
  inflation_rate: number        // cumulative inflation pressure (0-1+), affects real purchasing power
  trade_exports_last_day: number
  trade_imports_last_day: number
  trade_balance_last_day: number
  trade_revenue_last_day: number
  money_printed_last_day: number
  tax_pool_critical_days: number

  // Cumulative economic statistics (all-time since game start)
  total_taxes_collected: number  // income tax + property tax + feud tribute ever collected
  total_money_printed: number    // emergency money printed by the state (all-time)
  total_trade_revenue: number    // net trade revenue (duties + tariffs, all-time)
  total_exports: number          // cumulative export value
  total_imports: number          // cumulative import value
  peak_gdp: number               // highest daily GDP ever recorded

  // Public health infrastructure
  public_health: PublicHealth

  // Human-driven governance (opt-in via settings)
  leader_id: number | null      // id of currently elected leader NPC (null = no election yet)
  last_election_day: number     // sim-day of last election (-1 = never)

  // Population collapse tracking
  collapse_phase: 'normal' | 'critical' | 'collapse' | 'ruins'
  collapse_days_streak: number     // consecutive days in 'collapse' phase
  ruins_era: boolean               // true after society has been rebuilt from ruins

  // Starting population — used as reference for immigration cap (not a hard max, just a baseline)
  initial_population: number

  // Gameplay statistics for achievements / end-of-run report
  stats: RunStats

  // Emergency government cycle tracking
  // Set to state.day when an emergency cycle fires; prevents re-triggering every single day.
  last_emergency_govt_cycle_day?: number

  // Player objectives (short-term goals with rewards)
  objectives?: Objective[]
  objectives_next_gen_day?: number

  // Dynasty tracking
  dynasties: Dynasty[]
}

export interface RunStats {
  god_calls: number          // how many times the player sent a chat message to the God Agent
  intervention_count: number // direct NPC/world interventions executed
  policy_count: number       // government policies enacted
  min_population: number     // lowest living population ever recorded
  max_population: number     // peak population (mirrors peakPopulation in main.ts)
  fled_total: number         // total emigrations (death_cause === 'fled')
  deaths_natural: number     // natural + starvation + disease deaths
  deaths_violent: number     // violence deaths
  elections_held: number     // number of elections that occurred
  npc_chats: number          // total player messages sent to individual NPCs
  npc_edits: number          // number of times player opened the Edit Stats panel (manual tweaks)
  // which achievement milestones have already fired (day checkpoints)
  achieved_days: number[]
}

// ── AI Types ───────────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'ollama_cloud'
export type TokenMode = 'events_only' | 'events_plus_npc_control' | 'unlimited'

export interface AIConfig {
  provider: AIProvider
  keys: string[]              // Array of API keys; first valid one is used, falls back to next on error
  model?: string
  token_mode: TokenMode
  base_url?: string
  rpm_limit: number           // user-configured requests per minute (0 = unlimited)
}

// ── NPC Intervention ───────────────────────────────────────────────────────

export interface NPCIntervention {
  /** Direct change to class_solidarity (−100 to 100). Positive = agitate, negative = pacify. */
  solidarity_delta?: number
  /** Which NPCs to target */
  target: 'all' | 'zone' | 'role' | 'id_list'
  zones?: string[]      // when target === 'zone'
  roles?: Role[]        // when target === 'role'
  npc_ids?: number[]    // when target === 'id_list'
  count?: number        // max NPCs to affect (random selection if population > count)

  // Direct effects
  kill?: boolean
  kill_pct?: number    // 0-100: kill this % of selected candidates randomly (use instead of count for percentage-based kills)
  kill_cause?: DeathCause
  action_state?: ActionState
  new_role?: Role      // permanently reassign NPC to this role (clears emergency tracking)

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

  // Extended NPC fields
  wealth_delta?: number                   // additive, clamped min 0
  work_motivation?: WorkMotivationType    // override work motivation type directly
  trust_delta?: {                         // per-institution trust nudge
    institution: InstitutionId
    competence?: number                   // -1..1
    intention?: number                    // -1..1
  }
  sick?: boolean                          // infect (true) or cure (false)
  exhaustion_delta?: number               // additive, clamped 0-100
  capital_delta?: number                  // additive, clamped 0-100

  // Inject a memory entry
  memory?: {
    type: MemoryType
    emotional_weight: number
  }
}

export interface WorldDelta {
  food_stock_delta?: number
  natural_resources_delta?: number
  tax_pool_delta?: number
  quarantine_add?: string[]
  quarantine_remove?: string[]
  seed_rumor?: {
    content: string
    subject: 'government' | 'guard' | 'market' | 'community'
    effect: 'trust_down' | 'trust_up' | 'fear_up' | 'grievance_up'
    duration_days?: number
    planted_by_player?: boolean  // true = injected by player via God Agent chat
  }
  trigger_referendum?: {
    field: 'safety_net' | 'individual_rights_floor' | 'market_freedom' | 'state_power'
    proposed_value: number
    proposal_text: string
  }
  /** Patch one or more simulation formula expressions permanently. */
  formula_patch?: FormulaPatch[]
}

export interface InstitutionDelta {
  id: InstitutionId
  power_delta?: number        // additive, clamped 0-1
  resources_delta?: number    // additive
  legitimacy_delta?: number   // additive, clamped 0-1
}

export interface GodResponse {
  type: 'event' | 'answer' | 'warning' | 'setup' | 'intervention'
  event: Partial<SimEvent> | null
  interventions?: NPCIntervention[]   // direct NPC/world manipulations
  answer: string
  requires_confirm: boolean
  warning?: string
  constitution?: Partial<Constitution>  // live constitution reform (was dead code — now applied)
  world_delta?: WorldDelta              // macro world changes (food, resources, tax, quarantine, rumors)
  institution_deltas?: InstitutionDelta[] // institution power/legitimacy/resources shifts
  /** Direct formula expression patches — permanent change to simulation math. */
  formula_patch?: FormulaPatch[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

/** How the player presents when talking to an NPC (affects prompts, reactions, and effect caps). */
export type PlayerChatPersona = 'stranger' | 'supernatural'

export interface NPCChatTurn {
  speaker: 'player' | 'npc'
  text: string
  /** Set on player turns — which persona was used when sending this line. */
  persona?: PlayerChatPersona
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
  farmer:     ['Rice Farmer', 'Vegetable Grower', 'Livestock Keeper', 'Gardener'],
  craftsman:  ['Blacksmith', 'Carpenter', 'Weaver', 'Potter', 'Mason'],
  merchant:   ['Trader', 'Innkeeper', 'Money Changer', 'Peddler'],
  scholar:    ['Teacher', 'Physician', 'Scholar', 'Philosopher', 'Scribe'],
  guard:      ['Sentry', 'Militia', 'Patrol Officer', 'Squad Leader'],
  leader:     ['Council Member', 'District Chief', 'Elder', 'Official'],
  child:      ['Child'],
  healthcare: ['Doctor', 'Nurse', 'Medic', 'Surgeon', 'Pharmacist', 'Midwife'],
  gang:       ['Enforcer', 'Fence', 'Lookout', 'Smuggler', 'Racketeer', 'Thug'],
}

export const ZONES = [
  'north_farm', 'south_farm',
  'workshop_district',
  'market_square',
  'scholar_quarter',
  'residential_east', 'residential_west',
  'guard_post',
  'plaza',
  'clinic_district',
  'underworld_quarter',
] as const

export type Zone = typeof ZONES[number]

/**
 * Map display: underlay only / underlay + blurred district grid / sharp synthetic map.
 * Custom art: `setMapBackgroundPainter` (see map module).
 */
export type MapBackgroundMode = 'background_only' | 'background_blurred_layout' | 'layout_only'

export interface GameSettings {
  // AI-Driven features
  enable_human_elections:        boolean   // Step 6: NPCs elect a real leader NPC
  election_cycle_days:           number    // how often elections happen (sim-days)
  enable_government_ai:          boolean   // LLM drives policy generation
  enable_npc_thoughts:           boolean   // LLM generates spotlight daily thoughts
  enable_press_ai:               boolean   // LLM generates press headlines
  enable_science_ai:             boolean   // LLM generates rare society-inspired scientific discoveries
  enable_consequence_prediction: boolean   // LLM predicts event ripple effects
  /** Town map: street fill + markings, custom underlay + layout, or zones only. */
  map_background_mode:           MapBackgroundMode
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
