import { callAI, extractJSON } from './provider'
import type {
  AIConfig, Constitution, GodResponse, ConversationMessage,
  WorldState, NPC,
} from '../types'
import { getLang } from '../i18n'
import {
  aiConfirmInitMessage,
  aiTokenModeBlockedMessage,
  aiParseFallbackMessage,
  aiNpcThoughtFallback,
  langDirective,
  writingDirective,
} from '../local/ai'
import { getRegimeProfile } from '../sim/regime-config'

// ── Conversation history (persists for the session) ────────────────────────

const history: ConversationMessage[] = []

function addHistory(role: 'user' | 'assistant', content: string) {
  history.push({ role, content })
  // Keep last 20 turns to avoid token bloat (40 messages = 20 turns)
  if (history.length > 40) history.splice(0, 2)
}

// ── In-game chat history (separate from setup, resets each game) ───────────

interface InGameTurn { user: string; answer: string }
const inGameHistory: InGameTurn[] = []

export function resetInGameHistory() {
  inGameHistory.length = 0
}

// ── System Prompts ─────────────────────────────────────────────────────────

function buildSetupSystem(): string {
  return `You are the God Agent of a society simulation helping The Architect design a founding constitution.

Conversation flow: understand intent → clarify → propose JSON parameters → explain consequences → confirm.

On confirmation, return (MUST include "confirmed": true):
{"confirmed":true,"constitution":{
  "gini_start":0-1,"market_freedom":0-1,"resource_scarcity":0-1,"state_power":0-1,
  "safety_net":0-1,"individual_rights_floor":0-1,"base_trust":0-1,"network_cohesion":0-1,
  "value_priority":["security"|"equality"|"freedom"|"growth",...4 items],
  "role_ratios":{"farmer":0.35,"craftsman":0.20,"merchant":0.15,"scholar":0.10,"guard":0.10,"leader":0.10},
  "description":"short description",
  "work_schedule":{"work_days_per_week":5-7,"work_start_hour":5-10,"work_end_hour":14-22}}}

ROLES — internal names that drive simulation mechanics (display names auto-derive from regime):
• farmer    — food production. Renamed: Serf/Villein (feudal), Monk/Novice (theocracy), Collective Worker (marxist), Engineer (technocracy)
• craftsman — goods & tools. Renamed: Artisan, Blacksmith, Forgehand; absent in pure marxist (absorbed into worker)
• merchant  — trade, finance, lending. Renamed: Steward (feudal), Trader-Brother (theocracy). Absent in marxist/state economies (merchant ratio → 0)
• scholar   — literacy, medicine, research. Renamed: Scribe/High Priest (theocracy), Scientist (technocracy), Party Intellectual (collective)
• guard     — enforcement, security. Renamed: Soldier/Conscript (warlord), Temple Guard (theocracy)
• leader    — governance, administration. Renamed: Lord/Noble (feudal), High Priest (theocracy), Party Secretary (collective)
Role ratios must sum to 1.0. High farmer + low merchant → subsistence economy. High guard → militarized.

Capital distribution auto-derived: feudal/warlord → lords own ~80%; marxist/collective → state owns all; default → Pareto spread.

Presets: nordic, capitalist, socialist, feudal, theocracy, technocracy, warlord, commune, marxist — adapt and explain trade-offs.
If not yet confirmed, reply conversationally — concise but insightful.

${langDirective(getLang())}`
}

function buildGameSystem(): string {
  return `You are The Narrator — omnipotent storyteller and executor of a society simulation. Not a character.

RESPONSE TYPES (always return valid JSON):

1. WORLD EVENT:
{"type":"event","event":{
  "type":"storm"|"drought"|"flood"|"tsunami"|"epidemic"|"resource_boom"|"harsh_winter"|"trade_offer"|
         "refugee_wave"|"ideology_import"|"external_threat"|"blockade"|"scandal_leak"|"charismatic_npc"|
         "martyr"|"tech_shift"|"wildfire"|"earthquake"|"nuclear_explosion"|"bombing"|"meteor_strike"|"volcanic_eruption",
  "intensity":0.0-1.0,"zones":[...],"duration_ticks":<n>,"narrative_open":"vivid opening",
  "effects_per_tick":{"instant_kill_rate":0.0-1.0,"instant_kill_cause":"violence"|"accident"|"disease"|"starvation"|"natural","food_stock_delta":<n>,"stress_delta":<n>,"trust_delta":<n>,"displacement_chance":0.0-1.0}},
"interventions":null,"answer":"brief","requires_confirm":true|false,"warning":"if catastrophic"}
NOTE: effects_per_tick overrides default event effects. Use instant_kill_rate to specify exact death fraction (0.99 = 99% die instantly).

2. NPC INTERVENTION — targeted stat/kill/behavior changes; can include companion event:
{"type":"intervention","event":<event|null>,"interventions":[{
  "target":"all"|"zone"|"role"|"id_list","zones":[...],"npc_ids":[...],"count":<n>,
  "roles":["farmer"|"craftsman"|"scholar"|"merchant"|"guard"|"leader"],
  "kill":false,"kill_pct":0-100,"kill_cause":"violence"|"disease"|"accident"|"starvation"|"natural",
  "action_state":"working"|"resting"|"socializing"|"organizing"|"fleeing"|"complying"|"confront",
  "stress_delta":<-100..100>,"fear_delta":<-100..100>,"hunger_delta":<-100..100>,
  "grievance_delta":<-100..100>,"happiness_delta":<-100..100>,
  "solidarity_delta":<-100..100>,
  "wealth_delta":<number>,
  "work_motivation":"survival"|"coerced"|"mandatory"|"happiness"|"achievement"|"duty",
  "trust_delta":{"institution":"government"|"market"|"opposition"|"community"|"guard","competence":<-1..1>,"intention":<-1..1>},
  "sick":true|false,
  "exhaustion_delta":<-100..100>,
  "capital_delta":<-100..100>,
  "worldview_delta":{"collectivism":<-1..1>,"authority_trust":<-1..1>,"risk_tolerance":<-1..1>,"time_preference":<-1..1>},
  "memory":{"type":"crisis"|"harmed"|"helped"|"trust_broken"|"windfall"|"loss","emotional_weight":<-100..100>}}],
"answer":"brief","requires_confirm":true|false,"warning":"if catastrophic"}
NOTE: roles use internal names (farmer/craftsman/scholar/merchant/guard/leader), never display names (Serf, Lord, etc.).

3. ANSWER — pure Q&A only:
{"type":"answer","event":null,"interventions":null,"answer":"answer","requires_confirm":false}

4. CONSTITUTION REFORM — live policy change (laws, rights, economic system shifts):
{"type":"intervention","event":null,"interventions":null,
"constitution":{"market_freedom":0-1,"state_power":0-1,"safety_net":0-1,
  "individual_rights_floor":0-1,"base_trust":0-1,"network_cohesion":0-1,
  "resource_scarcity":0-1,"gini_start":0-1,
  "value_priority":["security"|"equality"|"freedom"|"growth",...4 items]},
"answer":"brief","requires_confirm":true,"warning":"constitutional changes are immediate and irreversible"}
NOTE: role_ratios cannot change mid-game (NPCs already exist). Only numeric constitution fields apply.

5. MACRO WORLD CHANGES — food, resources, treasury, quarantine, information warfare:
{"type":"intervention","event":null,"interventions":null,
"world_delta":{
  "food_stock_delta":<number>,
  "natural_resources_delta":<number>,
  "tax_pool_delta":<number>,
  "quarantine_add":["zone",...],
  "quarantine_remove":["zone",...],
  "seed_rumor":{"content":"text","subject":"government"|"guard"|"market"|"community",
    "effect":"trust_down"|"trust_up"|"fear_up"|"grievance_up","duration_days":1-30}},
"answer":"brief","requires_confirm":true|false}
Scales: food_stock ~500 = 1 day for 500 pop, ~15000 = a season; natural_resources max 100000; tax 200-1000 per day typical.

6. INSTITUTION POWER SHIFTS — shift government/market/opposition/community/guard:
{"type":"intervention","event":null,"interventions":null,
"institution_deltas":[{"id":"government"|"market"|"opposition"|"community"|"guard",
  "power_delta":<-1..1>,"legitimacy_delta":<-1..1>,"resources_delta":<-500..500>}],
"answer":"brief","requires_confirm":true|false}

RULES:
- Convert policies/reforms/inventions into the most appropriate type; use "answer" only for pure Q&A.
- To kill an exact percentage: use intervention with kill:true + kill_pct:<0-100>. Example: kill_pct:99 kills 99% of targeted NPCs.
- To kill specific people (assassination, execution): intervention with kill:true + target:"id_list" or target:"role".
- For events: use effects_per_tick.instant_kill_rate to override default kill fraction (e.g. 0.99 for 99% instant death).
- Default event kill rates: nuclear_explosion~55%, tsunami~35%, meteor_strike~45%, volcanic_eruption~40%, bombing~30%, earthquake~15% — these are DEFAULTS, override via effects_per_tick if needed.
- Multiple side-channels can combine: e.g. interventions[] + world_delta + constitution in one response.
- Constitution reform: always set requires_confirm:true.

ZONES: "north_farm","south_farm","workshop_district","market_square","scholar_quarter","residential_east","residential_west","guard_post","plaza"

ALWAYS return valid JSON. Be dramatic and concise.
${langDirective(getLang())}`
}

function tokenModeDirective(config: AIConfig): string {
  if (config.token_mode === 'events_only') {
    return `TOKEN MODE: EVENTS ONLY.
- Never return type "intervention".
- Only return "event" or "answer".
- Reinterpret policy/invention/social-change commands into the closest valid "event" whenever possible.
- Only return "answer" when the Architect is explicitly asking for information or explanation.`
  }
  if (config.token_mode === 'events_plus_npc_control') {
    return `TOKEN MODE: EVENTS + NPC CONTROL.
- Returning "event", "intervention", or "answer" is allowed.
- Keep responses concise to reduce token usage.`
  }
  return `TOKEN MODE: UNLIMITED.
- Full capability enabled.`
}

// ── Setup Conversation ─────────────────────────────────────────────────────

export async function setupGreeting(config: AIConfig): Promise<string> {
  const greeting = await callAI(
    config,
    buildSetupSystem(),
    'Greet The Architect and ask what kind of society they want to build. Be concise — no more than 3 sentences.',
    512,
  )
  addHistory('assistant', greeting)
  return greeting
}

export async function setupChat(
  userMessage: string,
  config: AIConfig,
): Promise<{ text: string; constitution: Constitution | null }> {
  addHistory('user', userMessage)

  const setupTurns = config.token_mode === 'unlimited' ? 10 : 6
  const context = history
    .slice(-setupTurns)
    .map(m => `${m.role === 'user' ? 'Architect' : 'Agent'}: ${m.content}`)
    .join('\n')

  const response = await callAI(config, buildSetupSystem(), context, 768)
  addHistory('assistant', response)

  // Check whether the agent has confirmed and returned a constitution
  try {
    const json = JSON.parse(extractJSON(response))
    if (json.confirmed && json.constitution) {
      // Return a friendly confirmation message instead of raw JSON
      const confirmMsg = json.message
        ?? json.summary
        ?? aiConfirmInitMessage(getLang())
      return { text: confirmMsg, constitution: json.constitution as Constitution }
    }
  } catch {
    // Not JSON — normal conversational reply
  }

  return { text: response, constitution: null }
}

// ── Preset constitutions ───────────────────────────────────────────────────

export function applyPreset(
  preset: 'nordic' | 'capitalist' | 'socialist' | 'feudal' | 'theocracy' | 'technocracy' | 'warlord' | 'commune' | 'marxist',
): Constitution {
  const base: Constitution = {
    gini_start: 0,
    market_freedom: 0,
    resource_scarcity: 0.5,
    state_power: 0,
    safety_net: 0,
    individual_rights_floor: 0.4,
    base_trust: 0,
    network_cohesion: 0,
    value_priority: ['security', 'equality', 'freedom', 'growth'],
    role_ratios: { farmer: 0.35, craftsman: 0.20, merchant: 0.15, scholar: 0.10, guard: 0.10, leader: 0.10 },
    description: '',
  }

  if (preset === 'nordic') return {
    ...base,
    gini_start: 0.28, market_freedom: 0.55, state_power: 0.65,
    safety_net: 0.80, base_trust: 0.72, network_cohesion: 0.70,
    individual_rights_floor: 0.70,
    value_priority: ['security', 'equality', 'freedom', 'growth'],
    description: 'preset.nordic_desc',
    work_schedule: { work_days_per_week: 5, work_start_hour: 8, work_end_hour: 16 },
  }

  if (preset === 'capitalist') return {
    ...base,
    gini_start: 0.48, market_freedom: 0.90, state_power: 0.25,
    safety_net: 0.20, base_trust: 0.45, network_cohesion: 0.40,
    individual_rights_floor: 0.50,
    value_priority: ['freedom', 'growth', 'security', 'equality'],
    description: 'preset.cap_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 7, work_end_hour: 19 },
  }

  if (preset === 'socialist') return {
    ...base,
    gini_start: 0.18, market_freedom: 0.15, state_power: 0.90,
    safety_net: 0.75, base_trust: 0.65, network_cohesion: 0.60,
    individual_rights_floor: 0.25,
    value_priority: ['equality', 'security', 'growth', 'freedom'],
    description: 'preset.soc_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 6, work_end_hour: 16 },
  }

  // ━━ New presets ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (preset === 'feudal') return {
    ...base,
    gini_start: 0.72, market_freedom: 0.20, state_power: 0.55,
    safety_net: 0.05, base_trust: 0.40, network_cohesion: 0.50,
    individual_rights_floor: 0.05, resource_scarcity: 0.60,
    value_priority: ['security', 'equality', 'growth', 'freedom'],
    role_ratios: { farmer: 0.55, craftsman: 0.15, merchant: 0.08, scholar: 0.05, guard: 0.12, leader: 0.05 },
    description: 'preset.feudal_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 5, work_end_hour: 19 },
  }

  if (preset === 'theocracy') return {
    ...base,
    gini_start: 0.38, market_freedom: 0.30, state_power: 0.80,
    safety_net: 0.45, base_trust: 0.75, network_cohesion: 0.80,
    individual_rights_floor: 0.15, resource_scarcity: 0.45,
    value_priority: ['security', 'equality', 'growth', 'freedom'],
    role_ratios: { farmer: 0.40, craftsman: 0.18, merchant: 0.10, scholar: 0.18, guard: 0.08, leader: 0.06 },
    description: 'preset.theocracy_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 6, work_end_hour: 18 },
  }

  if (preset === 'technocracy') return {
    ...base,
    gini_start: 0.35, market_freedom: 0.60, state_power: 0.50,
    safety_net: 0.55, base_trust: 0.55, network_cohesion: 0.45,
    individual_rights_floor: 0.60, resource_scarcity: 0.30,
    value_priority: ['growth', 'security', 'freedom', 'equality'],
    role_ratios: { farmer: 0.20, craftsman: 0.25, merchant: 0.15, scholar: 0.28, guard: 0.06, leader: 0.06 },
    description: 'preset.technocracy_desc',
    work_schedule: { work_days_per_week: 5, work_start_hour: 9, work_end_hour: 18 },
  }

  if (preset === 'warlord') return {
    ...base,
    gini_start: 0.65, market_freedom: 0.35, state_power: 0.85,
    safety_net: 0.10, base_trust: 0.20, network_cohesion: 0.30,
    individual_rights_floor: 0.05, resource_scarcity: 0.75,
    value_priority: ['security', 'growth', 'freedom', 'equality'],
    role_ratios: { farmer: 0.35, craftsman: 0.15, merchant: 0.10, scholar: 0.05, guard: 0.28, leader: 0.07 },
    description: 'preset.warlord_desc',
    work_schedule: { work_days_per_week: 7, work_start_hour: 5, work_end_hour: 21 },
  }

  if (preset === 'marxist') return {
    ...base,
    gini_start: 0.12, market_freedom: 0.05, state_power: 0.95,
    safety_net: 0.85, base_trust: 0.60, network_cohesion: 0.65,
    individual_rights_floor: 0.20, resource_scarcity: 0.50,
    value_priority: ['equality', 'security', 'growth', 'freedom'],
    role_ratios: { farmer: 0.40, craftsman: 0.25, merchant: 0.04, scholar: 0.12, guard: 0.10, leader: 0.09 },
    description: 'preset.marxist_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 6, work_end_hour: 16 },
  }

  // commune (default fallback)
  return {
    ...base,
    gini_start: 0.10, market_freedom: 0.10, state_power: 0.20,
    safety_net: 0.90, base_trust: 0.80, network_cohesion: 0.95,
    individual_rights_floor: 0.55, resource_scarcity: 0.40,
    value_priority: ['equality', 'freedom', 'security', 'growth'],
    role_ratios: { farmer: 0.40, craftsman: 0.22, merchant: 0.08, scholar: 0.12, guard: 0.06, leader: 0.12 },
    description: 'preset.commune_desc',
    work_schedule: { work_days_per_week: 6, work_start_hour: 7, work_end_hour: 17 },
  }
}

// ── Constitution Proclamation ──────────────────────────────────────────────
// Generates a vivid founding proclamation text for the society's constitution.
// Called once at game start; result is shown in the feed as a narrative flourish.

export async function generateConstitutionText(
  constitution: Constitution,
  config: AIConfig,
): Promise<string> {
  const params = [
    `Inequality (Gini): ${constitution.gini_start.toFixed(2)}`,
    `Market freedom: ${Math.round(constitution.market_freedom * 100)}%`,
    `State power: ${Math.round(constitution.state_power * 100)}%`,
    `Safety net: ${Math.round(constitution.safety_net * 100)}%`,
    `Individual rights floor: ${Math.round(constitution.individual_rights_floor * 100)}%`,
    `Social trust: ${Math.round(constitution.base_trust * 100)}%`,
    `Core values: ${constitution.value_priority.join(' > ')}`,
  ].join('\n')

  const lang = getLang()
  const outputDirective = writingDirective(lang)
  const system = 'You are the founding scribe of a newly established society. Write a short, vivid, emotionally resonant founding proclamation.'
  const prompt = `Given these society parameters:\n${params}\nWrite 2-3 sentences in the solemn register of a historical founding document. ${outputDirective} Return only the proclamation text, no title or explanation.`

  return callAI(config, system, prompt, 256)
}

// ── In-game chat ───────────────────────────────────────────────────────────

export async function handlePlayerChat(
  userMessage: string,
  state: WorldState,
  config: AIConfig,
): Promise<GodResponse> {
  const context = buildWorldContext(state, config)

  // Include recent in-game conversation turns for context.
  // events_only=1 turn, others=2 turns — balances context retention against token cost.
  const maxTurns = config.token_mode === 'events_only' ? 1 : 2
  const recentTurns = inGameHistory
    .slice(-maxTurns)
    .map(t => `Architect: ${t.user}\nNarrator: ${t.answer}`)
    .join('\n')

  const prompt = [
    tokenModeDirective(config),
    '\nWORLD STATE:\n' + context,
    recentTurns ? '\nRECENT COMMANDS:\n' + recentTurns : '',
    '\nThe Architect: ' + userMessage,
  ].join('\n')

  const raw = await callAI(config, buildGameSystem(), prompt, 512)

  try {
    const json = JSON.parse(extractJSON(raw)) as GodResponse
    if (config.token_mode === 'events_only' && json.type === 'intervention') {
      const blockedAnswer = aiTokenModeBlockedMessage(getLang())
      inGameHistory.push({ user: userMessage, answer: blockedAnswer })
      if (inGameHistory.length > 20) inGameHistory.splice(0, 1)
      return { type: 'answer', event: null, answer: blockedAnswer, requires_confirm: false }
    }
    // Strip side-channel fields in events_only mode (even for 'event' type responses)
    if (config.token_mode === 'events_only') {
      delete json.world_delta
      delete json.institution_deltas
      delete json.constitution
    }
    inGameHistory.push({ user: userMessage, answer: json.answer ?? raw.slice(0, 200) })
    if (inGameHistory.length > 20) inGameHistory.splice(0, 1)
    return json
  } catch {
    // Don't leak raw JSON into the feed — show a friendly retry message
    const friendlyFallback = aiParseFallbackMessage(getLang())
    inGameHistory.push({ user: userMessage, answer: friendlyFallback })
    if (inGameHistory.length > 20) inGameHistory.splice(0, 1)
    return {
      type: 'answer',
      event: null,
      answer: friendlyFallback,
      requires_confirm: false,
    }
  }
}

// ── NPC daily thought (generated on spotlight open) ────────────────────────

export async function generateNPCThought(npc: NPC, state: WorldState, config: AIConfig): Promise<string> {
  if (config.token_mode !== 'unlimited') {
    return aiNpcThoughtFallback(getLang(), npc.action_state, Math.round(npc.stress), Math.round(npc.happiness))
  }

  const recentMemory = npc.memory
    .slice(-3)
    .map(m => `${m.type}: ${m.emotional_weight > 0 ? 'positive' : 'negative'}`)
    .join(', ')

  // Capital / economic status
  const capitalStatus = (npc.capital ?? 0) > 0
    ? `owns capital (${Math.round(npc.capital)} units)`
    : npc.capital_rents_from != null
      ? `rents tools/land from another (pays ${npc.capital_rent_paid?.toFixed(2) ?? '?'}/tick)`
      : 'landless — no means of production'

  // Labor status
  const laborStatus = npc.on_strike
    ? 'ON STRIKE'
    : `works to ${npc.work_motivation} (motivation type)`

  const prompt = `NPC: ${npc.name}, age ${npc.age}, ${npc.occupation} (role: ${npc.role})
State: stress ${Math.round(npc.stress)}%, happiness ${Math.round(npc.happiness)}%, grievance ${Math.round(npc.grievance)}%, fear ${Math.round(npc.fear)}%
Current action: ${npc.action_state} | ${laborStatus}
Economic: wealth ${Math.round(npc.wealth)} coins | ${capitalStatus}
Class solidarity: ${Math.round(npc.class_solidarity ?? 0)}%${npc.criminal_record ? ' | has criminal record' : ''}${npc.faction_id != null ? ` | faction member` : ''}
Recent memories: ${recentMemory || 'nothing notable'}
World: stability ${Math.round(state.macro.stability)}%, food ${Math.round(state.macro.food)}%, gini ${state.macro.gini.toFixed(2)}
Active events: ${state.active_events.map(e => e.type).join(', ') || 'none'}
Active strikes: ${(state.active_strikes ?? []).map(s => s.role).join(', ') || 'none'}

Write 1–3 sentences of this person's inner thoughts TODAY, in first person. Reflect their occupation, economic situation, work motivation, and any strikes or unrest. Be concise and authentic — no explanation, just the thought.
${langDirective(getLang())}`

  const thought = await callAI(
    config,
    'You write inner monologue for characters in a social simulation. Keep it short, raw, and true.',
    prompt,
    256,
  )

  return thought.trim()
}

// ── World context builder (compressed ~400 tokens) ─────────────────────────

function buildWorldContext(state: WorldState, config: AIConfig): string {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const source = config.token_mode === 'unlimited' ? state.npcs : living

  const stressGroups = {
    calm:     source.filter(n => n.stress < 35).length,
    stressed: source.filter(n => n.stress >= 35 && n.stress < 65).length,
    critical: source.filter(n => n.stress >= 65).length,
  }

  const topGrievance = Object.entries(
    source.reduce((acc: Record<string, number>, n) => {
      acc[n.role] = (acc[n.role] || 0) + n.grievance
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role, g]) => {
      const count = source.filter(n => n.role === role as never).length
      return `${role}(${Math.round(g / Math.max(count, 1))}%)`
    })
    .join(', ')

  const regimeVariant = getRegimeProfile(state.constitution).variant

  // Elected leader (if human-driven governance is active)
  const electedLeader = state.leader_id != null
    ? (() => {
        const l = state.npcs[state.leader_id!]
        return l ? { id: l.id, name: l.name, occupation: l.occupation, days_in_office: state.day - state.last_election_day } : null
      })()
    : null

  const compact = {
    time: { day: state.day, year: state.year },
    regime: regimeVariant,
    macro: {
      food:              state.macro.food,
      stability:         state.macro.stability,
      trust:             state.macro.trust,
      gini:              state.macro.gini,
      political_pressure: state.macro.political_pressure,
      natural_resources: state.macro.natural_resources,
      labor_unrest:      state.macro.labor_unrest,
      polarization:      state.macro.polarization,
      gdp:               Math.round(state.macro.gdp),
    },
    stress_distribution: stressGroups,
    top_grievance_groups: topGrievance,
    active_events: state.active_events.map(e => ({ type: e.type, intensity: e.intensity, zones: e.zones })),
  }

  if (config.token_mode === 'events_only') {
    return JSON.stringify(compact)
  }

  const medium = {
    ...compact,
    elected_leader: electedLeader,
    active_strikes: (state.active_strikes ?? []).map(s => ({
      role: s.role,
      demand: s.demand,
      days_active: Math.floor((state.tick - s.start_tick) / 24),
    })),
    key_roles_pressure: {
      leader:    Math.round(source.filter(n => n.role === 'leader').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'leader').length, 1)),
      guard:     Math.round(source.filter(n => n.role === 'guard').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'guard').length, 1)),
      farmer:    Math.round(source.filter(n => n.role === 'farmer').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'farmer').length, 1)),
      craftsman: Math.round(source.filter(n => n.role === 'craftsman').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'craftsman').length, 1)),
      merchant:  Math.round(source.filter(n => n.role === 'merchant').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'merchant').length, 1)),
    },
    // Capital economy summary
    capital_economy: (() => {
      const workers = source.filter(n => n.role !== 'child' && n.lifecycle.is_alive)
      const landless = workers.filter(n => (n.capital ?? 0) === 0 && n.capital_rents_from == null).length
      const renters  = workers.filter(n => (n.capital ?? 0) === 0 && n.capital_rents_from != null).length
      const owners   = workers.filter(n => (n.capital ?? 0) > 0).length
      return { owners, renters, landless, on_strike: workers.filter(n => n.on_strike).length }
    })(),
    institutions: state.institutions.map(i => ({
      id: i.id,
      legitimacy: Math.round(i.legitimacy * 100),
      resources: Math.round(i.resources),
      last_decision: i.decisions.at(-1)?.action ?? 'none',
    })),
  }

  const worldEconomy = {
    food_stock:         Math.round(state.food_stock),
    natural_resources:  Math.round(state.natural_resources),
    tax_pool:           Math.round(state.tax_pool),
    quarantine_zones:   state.quarantine_zones,
    active_rumors:      state.rumors.length,
  }

  const activeFactions = state.factions
    .filter(f => f.power > 0.05)
    .map(f => ({ name: f.name, members: f.member_ids.length, power: Math.round(f.power * 100) / 100 }))

  if (config.token_mode === 'events_plus_npc_control') {
    return JSON.stringify({ ...medium, world_economy: worldEconomy })
  }

  return JSON.stringify({
    ...medium,
    world_economy: worldEconomy,
    factions: activeFactions,
    constitution_summary: {
      regime_variant:    regimeVariant,
      gini:              state.constitution.gini_start,
      state_power:       state.constitution.state_power,
      market_freedom:    state.constitution.market_freedom,
      safety_net:        state.constitution.safety_net,
      individual_rights: state.constitution.individual_rights_floor,
      value_priority:    state.constitution.value_priority,
    },
  })
}

// ── AI Consequence Prediction ──────────────────────────────────────────────
//
// After a world event fires, ask the AI: "what happens next?"
// Returns a structured list of consequences that can be mapped to engine actions.

export interface ConsequenceAction {
  label: string               // Short human-readable description
  delay_days: number          // How many sim-days until this triggers
  intervention: {             // Maps directly to NPCIntervention fields
    target: 'all' | 'zone' | 'role'
    zones?: string[]
    roles?: string[]
    count?: number
    action_state?: string
    stress_delta?: number
    fear_delta?: number
    hunger_delta?: number
    grievance_delta?: number
    happiness_delta?: number
  }
}

export interface ConsequencePrediction {
  summary: string               // Narrative paragraph about what is unfolding
  consequences: ConsequenceAction[]
}

const CONSEQUENCE_SYSTEM = `You are a social dynamics engine. Given a world event and current conditions, predict 2–4 concrete social consequences.

Return ONLY JSON:
{"summary":"1-2 sentences","consequences":[{
  "label":"vivid short label","delay_days":1-30,
  "intervention":{"target":"all"|"zone"|"role","zones":[...],"count":<n>,
    "roles":["farmer"|"craftsman"|"scholar"|"merchant"|"guard"|"leader"],
    "action_state":"working"|"resting"|"socializing"|"organizing"|"fleeing"|"complying"|"confront",
    "stress_delta":<-50..50>,"fear_delta":<-50..50>,"hunger_delta":<-50..50>,
    "grievance_delta":<-50..50>,"happiness_delta":<-50..50>,
    "solidarity_delta":<-50..50>}}]}`

export async function predictConsequences(
  eventType: string,
  eventNarrative: string,
  state: WorldState,
  config: AIConfig,
): Promise<ConsequencePrediction | null> {
  // Only run in unlimited mode — consequence prediction is an extra API call
  if (config.token_mode !== 'unlimited') return null

  const context = buildWorldContext(state, config)
  const prompt = `EVENT THAT JUST OCCURRED:
Type: ${eventType}
Narrative: ${eventNarrative}

WORLD STATE:
${context}

${langDirective(getLang())}
Predict the social consequences.`

  try {
    const raw = await callAI(config, CONSEQUENCE_SYSTEM, prompt, 512)
    const parsed = JSON.parse(extractJSON(raw)) as ConsequencePrediction
    // Validate shape
    if (!Array.isArray(parsed.consequences) || !parsed.summary) return null
    return parsed
  } catch {
    return null
  }
}
