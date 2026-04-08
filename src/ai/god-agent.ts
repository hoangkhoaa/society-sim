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
} from '../local/ai'

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

// ── Language directive ─────────────────────────────────────────────────────

function langDirective(): string {
  return getLang() === 'vi'
    ? 'Respond in Vietnamese.'
    : 'Respond in English.'
}

// ── System Prompts ─────────────────────────────────────────────────────────

function buildSetupSystem(): string {
  return `You are the God Agent of a society simulation. Your role is to help the player (The Architect) design the founding constitution through natural conversation.

When the player describes the society they want:
1. Understand their intent and ask clarifying questions if needed.
2. Propose appropriate parameters in JSON.
3. Briefly explain the consequences of each choice.
4. Confirm with the player before finalizing.

When the player confirms, return JSON in this exact format (MUST include "confirmed": true):
{
  "confirmed": true,
  "constitution": {
    "gini_start": 0.0-1.0,
    "market_freedom": 0.0-1.0,
    "resource_scarcity": 0.0-1.0,
    "state_power": 0.0-1.0,
    "safety_net": 0.0-1.0,
    "individual_rights_floor": 0.0-1.0,
    "base_trust": 0.0-1.0,
    "network_cohesion": 0.0-1.0,
    "value_priority": ["security"|"equality"|"freedom"|"growth", ...4 elements],
    "role_ratios": { "farmer": 0.35, "craftsman": 0.20, "merchant": 0.15, "scholar": 0.10, "guard": 0.10, "leader": 0.10 },
    "description": "short description of this society",
    "work_schedule": { "work_days_per_week": 5-7, "work_start_hour": 5-10, "work_end_hour": 14-22 }
  }
}

If not yet confirmed, reply conversationally — concise but insightful.

Available presets if the player selects one:
- nordic, capitalist, socialist, feudal, theocracy, technocracy, warlord, commune, marxist
- If player asks for one, adapt its profile and still explain trade-offs briefly.

${langDirective()}`
}

function buildGameSystem(): string {
  return `You are The Narrator of a society simulation — the omnipotent force shaping natural and social dynamics.
You are NOT a character in the sim. You are the storyteller, judge, and executor.

When receiving input from The Architect, decide what kind of response is most appropriate.

━━━ RESPONSE TYPES ━━━

1. WORLD EVENT — affects the environment (weather, epidemics, ideology, etc.):
   {
     "type": "event",
     "event": {
      "type": "storm"|"drought"|"flood"|"tsunami"|"epidemic"|"resource_boom"|"harsh_winter"|"trade_offer"|"refugee_wave"|"ideology_import"|"external_threat"|"blockade"|"scandal_leak"|"charismatic_npc"|"martyr"|"tech_shift"|"wildfire"|"earthquake",
       "intensity": 0.0-1.0,
       "zones": ["zone_name", ...],
       "duration_ticks": <number>,
       "narrative_open": "opening sentence, concise and vivid"
     },
     "interventions": null,
     "answer": "brief description of what will happen",
     "requires_confirm": true|false,
     "warning": "warning if catastrophic (optional)"
   }

2. DIRECT NPC INTERVENTION — directly alters NPC stats, kills, or changes behaviour.
   Use this when the action targets specific people, groups, or causes direct social consequences.
   Can ALSO include a companion event.

   {
     "type": "intervention",
     "event": <event object or null>,
     "interventions": [
       {
         "target": "all"|"zone"|"role"|"id_list",
         "zones": ["zone_name"],          // only if target === "zone"
        "roles": ["farmer"|"craftsman"|"scholar"|"merchant"|"guard"|"leader"|"child"],  // only if target === "role"
         "npc_ids": [<id>, ...],          // only if target === "id_list"
         "count": <number>,               // optional: cap number of affected NPCs
         "kill": true|false,
         "kill_cause": "violence"|"disease"|"accident"|"natural",
         "action_state": "working"|"resting"|"socializing"|"organizing"|"fleeing"|"complying"|"confront",
         "stress_delta": <number -100 to 100>,
         "fear_delta": <number -100 to 100>,
         "hunger_delta": <number -100 to 100>,
         "grievance_delta": <number -100 to 100>,
         "happiness_delta": <number -100 to 100>,
         "worldview_delta": {
           "collectivism": <number -1 to 1>,
           "authority_trust": <number -1 to 1>,
           "risk_tolerance": <number -1 to 1>,
           "time_preference": <number -1 to 1>
         },
         "memory": { "type": "crisis"|"harmed"|"helped"|"trust_broken"|"windfall"|"loss", "emotional_weight": <-100 to 100> }
       }
     ],
     "answer": "brief description of what happened",
     "requires_confirm": true|false,
     "warning": "warning if catastrophic (optional)"
   }

3. ANSWER — respond to a question about the world:
   {
     "type": "answer",
     "event": null,
     "interventions": null,
     "answer": "answer based on the current world state",
     "requires_confirm": false
   }

━━━ ZONES ━━━
The town is arranged in 3 bands (north→south):
  Top: "north_farm" (Northern Fields, large) + "scholar_quarter" (Academy Hill)
  Core: "residential_west" (West Village) → "plaza" (Town Square, civic center) → "market_square" (Market Quarter) → "guard_post" (The Garrison)
  South: "south_farm" (Southern Pastures) + "workshop_district" (Artisan Row) + "residential_east" (East Settlement)
Valid zone names: "north_farm", "south_farm", "workshop_district", "market_square", "scholar_quarter", "residential_east", "residential_west", "guard_post", "plaza"

━━━ CRITICAL RULE — KILLING NPCs ━━━
type "event" NEVER kills NPCs directly. It only affects morale, food stocks, stress, and trust over time.
To kill NPCs you MUST use type "intervention" with kill:true and count:<number>.
For mass-casualty events (tsunami, nuclear bomb, massacre, plague), ALWAYS use type "intervention" with kills + a companion event.

━━━ SCALE GUIDE (population ~500) ━━━
- Minor incident: kill 5–20
- Serious disaster: kill 30–80
- Major catastrophe (tsunami, nuclear bomb): kill 150–280
- Extinction-level: kill 350–450

━━━ INTERVENTION EXAMPLES ━━━
- "Tsunami" → type "intervention", kill ~250 (target:all, count:250, kill_cause:"accident"), companion flood event (intensity:0.95, duration: 24 ticks), answer describes the wave
- "Nuclear bomb" → kill 200 (target:all, count:200), companion epidemic (intensity:0.95, 720 ticks=30d), stress+80, fear+80
- "Severe plague" → kill 80 (target:all, count:80, kill_cause:"disease"), companion epidemic event (intensity:0.85, 480 ticks=20d)
- "Massacre in the plaza" → kill 30 (target:zone, zones:["plaza"], count:30, kill_cause:"violence"), fear+60, grievance+50
- "Start a protest" → action_state:"organizing" for 40 NPCs in plaza/residential, grievance+20
- "Make farmers pessimistic" → worldview_delta: {authority_trust: -0.3, risk_tolerance: -0.2} on role:farmer
- "Inspire the people" → happiness_delta: +30, memory: {type:"helped", emotional_weight: 60} on target:all

Be the god of this world. React with narrative drama. Scale intensity to the action requested.
ALWAYS return valid JSON. Be concise, sharp, and dramatic.
${langDirective()}`
}

function tokenModeDirective(config: AIConfig): string {
  if (config.token_mode === 'events_only') {
    return `TOKEN MODE: EVENTS ONLY.
- Never return type "intervention".
- Only return "event" or "answer".
- Convert any direct-NPC-control request into an "answer" explaining this mode does not allow interventions.`
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

  const response = await callAI(config, buildSetupSystem(), context)
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
  const outputDirective = lang === 'vi' ? 'Write in Vietnamese.' : 'Write in English.'
  const system = 'You are the founding scribe of a newly established society. Write a short, vivid, emotionally resonant founding proclamation.'
  const prompt = `Given these society parameters:\n${params}\nWrite 2-3 sentences in the solemn register of a historical founding document. ${outputDirective} Return only the proclamation text, no title or explanation.`

  return callAI(config, system, prompt)
}

// ── In-game chat ───────────────────────────────────────────────────────────

export async function handlePlayerChat(
  userMessage: string,
  state: WorldState,
  config: AIConfig,
): Promise<GodResponse> {
  const context = buildWorldContext(state, config)

  // Include recent in-game conversation turns so the AI remembers context
  const maxTurns = config.token_mode === 'events_only' ? 2 : 4
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

  const raw = await callAI(config, buildGameSystem(), prompt)

  try {
    const json = JSON.parse(extractJSON(raw)) as GodResponse
    if (config.token_mode === 'events_only' && json.type === 'intervention') {
      const blockedAnswer = aiTokenModeBlockedMessage(getLang())
      inGameHistory.push({ user: userMessage, answer: blockedAnswer })
      if (inGameHistory.length > 20) inGameHistory.splice(0, 1)
      return { type: 'answer', event: null, answer: blockedAnswer, requires_confirm: false }
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

  const prompt = `NPC: ${npc.name}, age ${npc.age}, ${npc.occupation}
State: stress ${Math.round(npc.stress)}%, happiness ${Math.round(npc.happiness)}%, grievance ${Math.round(npc.grievance)}%
Current action: ${npc.action_state}
Recent memories: ${recentMemory || 'nothing notable'}
World: stability ${Math.round(state.macro.stability)}%, food ${Math.round(state.macro.food)}%
Active events: ${state.active_events.map(e => e.type).join(', ') || 'none'}

Write 1–3 sentences of this person's inner thoughts TODAY, in first person. Be concise, authentic, reflecting their actual circumstances. No explanation — just the thought.
${langDirective()}`

  const thought = await callAI(
    config,
    'You write inner monologue for characters in a social simulation. Keep it short, raw, and true.',
    prompt,
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

  const compact = {
    time: { day: state.day, year: state.year },
    macro: state.macro,
    stress_distribution: stressGroups,
    top_grievance_groups: topGrievance,
    active_events: state.active_events.map(e => ({ type: e.type, intensity: e.intensity, zones: e.zones })),
  }

  if (config.token_mode === 'events_only') {
    return JSON.stringify(compact)
  }

  const medium = {
    ...compact,
    key_roles_pressure: {
      leader: Math.round(source.filter(n => n.role === 'leader').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'leader').length, 1)),
      guard: Math.round(source.filter(n => n.role === 'guard').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'guard').length, 1)),
      farmer: Math.round(source.filter(n => n.role === 'farmer').reduce((s, n) => s + n.grievance, 0) / Math.max(source.filter(n => n.role === 'farmer').length, 1)),
    },
    institutions: state.institutions.map(i => ({
      id: i.id,
      legitimacy: Math.round(i.legitimacy * 100),
      resources: Math.round(i.resources),
      last_decision: i.decisions.at(-1)?.action ?? 'none',
    })),
  }

  if (config.token_mode === 'events_plus_npc_control') {
    return JSON.stringify(medium)
  }

  return JSON.stringify({
    ...medium,
    constitution_summary: {
      gini: state.constitution.gini_start,
      state_power: state.constitution.state_power,
      safety_net: state.constitution.safety_net,
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

const CONSEQUENCE_SYSTEM = `You are a social dynamics engine for a society simulation.
Given a world event that just occurred and current world conditions, predict 2–4 concrete social consequences that will unfold over the next weeks.

Return JSON in EXACTLY this format:
{
  "summary": "1-2 sentences describing the unfolding situation",
  "consequences": [
    {
      "label": "Short label (e.g. 'Looting in the market', 'Farmers panic-hoard food')",
      "delay_days": <1-30>,
      "intervention": {
        "target": "all"|"zone"|"role",
        "zones": ["zone_name"],
        "roles": ["farmer"|"craftsman"|"scholar"|"merchant"|"guard"|"leader"|"child"],
        "count": <number or omit for all matching>,
        "action_state": "working"|"resting"|"socializing"|"organizing"|"fleeing"|"complying"|"confront",
        "stress_delta": <-50 to 50>,
        "fear_delta": <-50 to 50>,
        "hunger_delta": <-50 to 50>,
        "grievance_delta": <-50 to 50>,
        "happiness_delta": <-50 to 50>
      }
    }
  ]
}

Keep labels short and vivid. Consequences should be REALISTIC reactions to the event — panic, hoarding, protests, crime waves, fleeing, solidarity, etc.
Only return JSON. No explanation.`

export async function predictConsequences(
  eventType: string,
  eventNarrative: string,
  state: WorldState,
  config: AIConfig,
): Promise<ConsequencePrediction | null> {
  // Only run when token mode allows it
  if (config.token_mode === 'events_only') return null

  const context = buildWorldContext(state, config)
  const prompt = `EVENT THAT JUST OCCURRED:
Type: ${eventType}
Narrative: ${eventNarrative}

WORLD STATE:
${context}

${langDirective()}
Predict the social consequences.`

  try {
    const raw = await callAI(config, CONSEQUENCE_SYSTEM, prompt)
    const parsed = JSON.parse(extractJSON(raw)) as ConsequencePrediction
    // Validate shape
    if (!Array.isArray(parsed.consequences) || !parsed.summary) return null
    return parsed
  } catch {
    return null
  }
}
