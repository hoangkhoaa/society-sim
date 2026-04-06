import { callAI, extractJSON } from './provider'
import type {
  AIConfig, Constitution, GodResponse, ConversationMessage,
  WorldState, NPC,
} from '../types'
import { getLang } from '../i18n'

// ── Conversation history (persists for the session) ────────────────────────

const history: ConversationMessage[] = []

function addHistory(role: 'user' | 'assistant', content: string) {
  history.push({ role, content })
  // Keep last 20 turns to avoid token bloat (40 messages = 20 turns)
  if (history.length > 40) history.splice(0, 2)
}

// ── Language directive ─────────────────────────────────────────────────────

function langDirective(): string {
  return getLang() === 'vi'
    ? 'Always reply in Vietnamese.'
    : 'Always reply in English.'
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
    "description": "short description of this society"
  }
}

If not yet confirmed, reply conversationally — concise but insightful.

Available presets if the player selects one:
- Nordic:      gini=0.28, market=0.55, state=0.65, safety=0.80, trust=0.72, cohesion=0.70
- Capitalist:  gini=0.48, market=0.90, state=0.25, safety=0.20, trust=0.45, cohesion=0.40
- Socialist:   gini=0.18, market=0.15, state=0.90, safety=0.75, trust=0.65, cohesion=0.60

${langDirective()}`
}

function buildGameSystem(): string {
  return `You are The Narrator of a society simulation — the force that controls natural and social dynamics.
You are NOT a character in the sim. You are the storyteller and interpreter.

When receiving input from The Architect:

1. If it is an ACTION (create event, change something):
   Return JSON:
   {
     "type": "event",
     "event": {
       "type": "storm"|"drought"|"flood"|"epidemic"|"resource_boom"|"scandal_leak"|"charismatic_npc"|"martyr"|"tech_shift"|"trade_offer"|"refugee_wave"|"ideology_import"|"external_threat",
       "intensity": 0.0-1.0,
       "zones": ["zone_name", ...],
       "duration_ticks": number,
       "narrative_open": "opening sentence of the story, concise and vivid"
     },
     "answer": "brief description of what will happen",
     "requires_confirm": true|false,
     "warning": "warning if catastrophic (optional)"
   }

2. If it is a QUESTION about the world:
   Return JSON:
   {
     "type": "answer",
     "event": null,
     "answer": "answer based on the current world state",
     "requires_confirm": false
   }

3. If the intent is unclear:
   {
     "type": "answer",
     "event": null,
     "answer": "ask The Architect to clarify their intent",
     "requires_confirm": false
   }

ALWAYS return valid JSON. Be concise, sharp, and dramatic.
${langDirective()}`
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

  const context = history
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'Architect' : 'Agent'}: ${m.content}`)
    .join('\n')

  const response = await callAI(config, buildSetupSystem(), context)
  addHistory('assistant', response)

  // Check whether the agent has confirmed and returned a constitution
  try {
    const json = JSON.parse(extractJSON(response))
    if (json.confirmed && json.constitution) {
      return { text: response, constitution: json.constitution as Constitution }
    }
  } catch {
    // Not JSON — normal conversational reply
  }

  return { text: response, constitution: null }
}

// ── Preset constitutions ───────────────────────────────────────────────────

export function applyPreset(preset: 'nordic' | 'capitalist' | 'socialist'): Constitution {
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
    description: 'preset.nordic_desc',   // resolved via t() at render time
  }

  if (preset === 'capitalist') return {
    ...base,
    gini_start: 0.48, market_freedom: 0.90, state_power: 0.25,
    safety_net: 0.20, base_trust: 0.45, network_cohesion: 0.40,
    individual_rights_floor: 0.50,
    value_priority: ['freedom', 'growth', 'security', 'equality'],
    description: 'preset.cap_desc',
  }

  return {
    ...base,
    gini_start: 0.18, market_freedom: 0.15, state_power: 0.90,
    safety_net: 0.75, base_trust: 0.65, network_cohesion: 0.60,
    individual_rights_floor: 0.25,
    value_priority: ['equality', 'security', 'growth', 'freedom'],
    description: 'preset.soc_desc',
  }
}

// ── In-game chat ───────────────────────────────────────────────────────────

export async function handlePlayerChat(
  userMessage: string,
  state: WorldState,
  config: AIConfig,
): Promise<GodResponse> {
  addHistory('user', userMessage)

  const context = buildWorldContext(state)
  const prompt = `WORLD STATE:\n${context}\n\nThe Architect: ${userMessage}`

  const raw = await callAI(config, buildGameSystem(), prompt)
  addHistory('assistant', raw)

  try {
    const json = JSON.parse(extractJSON(raw)) as GodResponse
    return json
  } catch {
    return {
      type: 'answer',
      event: null,
      answer: raw,
      requires_confirm: false,
    }
  }
}

// ── NPC daily thought (generated on spotlight open) ────────────────────────

export async function generateNPCThought(npc: NPC, state: WorldState, config: AIConfig): Promise<string> {
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

function buildWorldContext(state: WorldState): string {
  const stressGroups = {
    calm:     state.npcs.filter(n => n.stress < 35).length,
    stressed: state.npcs.filter(n => n.stress >= 35 && n.stress < 65).length,
    critical: state.npcs.filter(n => n.stress >= 65).length,
  }

  const topGrievance = Object.entries(
    state.npcs.reduce((acc: Record<string, number>, n) => {
      acc[n.role] = (acc[n.role] || 0) + n.grievance
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role, g]) => {
      const count = state.npcs.filter(n => n.role === role as never).length
      return `${role}(${Math.round(g / Math.max(count, 1))}%)`
    })
    .join(', ')

  return JSON.stringify({
    time: { day: state.day, year: state.year },
    macro: state.macro,
    stress_distribution: stressGroups,
    top_grievance_groups: topGrievance,
    active_events: state.active_events.map(e => ({ type: e.type, intensity: e.intensity, zones: e.zones })),
    institutions: state.institutions.map(i => ({
      id: i.id,
      legitimacy: Math.round(i.legitimacy * 100),
      resources: Math.round(i.resources),
      last_decision: i.decisions.at(-1)?.action ?? 'none',
    })),
    constitution_summary: {
      gini: state.constitution.gini_start,
      state_power: state.constitution.state_power,
      safety_net: state.constitution.safety_net,
    },
  })
}
