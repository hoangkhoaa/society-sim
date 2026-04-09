// ── Government AI Agent ───────────────────────────────────────────────────────
// Runs every 15 sim-days. Observes macro stats and issues policy decisions.
// With AI: calls LLM for contextual, regime-aware policy.
// Without AI: deterministic fallbacks + witty routine messages.

import type { WorldState, AIConfig, NPCIntervention, Constitution, NPC } from '../types'
import { callAI, extractJSON } from '../ai/provider'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { applyInterventions } from './engine'
import { clamp } from './constitution'
import { getLang, tf, type Lang } from '../i18n'
import { getLatestHeadlines } from './press'
import { describeAlert, noAlertsSummaryLine, pickRoutineMessage, getFallbackPolicy, getNPCPolicyReactionThought, softerFallbackPolicyText, OPTION_LABELS, factionReactionMessage } from '../local/government'
import type { PolicyStance, PolicyType } from '../local/government'
import { showStoryCard } from '../ui/story-card'

// ── Alert thresholds ──────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = {
  food_critical:      25,
  food_warning:       38,
  stability_critical: 28,
  stability_warning:  40,
  trust_critical:     22,
  trust_warning:      32,
  pressure_critical:  72,
  pressure_warning:   58,
  resources_critical: 15,
  resources_warning:  28,
} as const

// ── Internal types ────────────────────────────────────────────────────────────

interface Alert {
  stat: string
  value: number
  level: 'critical' | 'warning'
  description: string
}

export interface GovernmentPolicyAI {
  option_label?: string
  policy_name: string
  description: string
  severity: 'important' | 'critical'
  public_statement: string
  food_delta?: number
  resource_delta?: number
  npc_stress_delta?: number
  npc_fear_delta?: number
  npc_hunger_delta?: number
  npc_grievance_delta?: number
  npc_happiness_delta?: number
  merchant_stress_delta?: number
  merchant_grievance_delta?: number
  farmer_stress_delta?: number
  farmer_hunger_delta?: number
  // Labor relations
  npc_solidarity_delta?: number    // applied to all workers (negative = pacify, positive = agitate)
  worker_solidarity_delta?: number // targeted at a specific role
  worker_role?: string             // which role to target with worker_solidarity_delta
}

// ── Regime detection ──────────────────────────────────────────────────────────

type RegimeType =
  | 'authoritarian'
  | 'libertarian'
  | 'welfare'
  | 'feudal'
  | 'theocratic'
  | 'technocratic'
  | 'moderate'

export function detectRegime(c: Constitution): RegimeType {
  // Theocratic: high state power, high trust, high cohesion
  if (c.state_power >= 0.70 && c.base_trust >= 0.65 && c.network_cohesion >= 0.70) return 'theocratic'
  // Technocratic: growth-first with strong individual rights
  if (c.value_priority[0] === 'growth' && c.individual_rights_floor >= 0.50) return 'technocratic'
  // Authoritarian: high state power, suppressed markets
  if (c.state_power >= 0.75 && c.market_freedom < 0.25) return 'authoritarian'
  // Libertarian: high market freedom, minimal state
  if (c.market_freedom >= 0.70 && c.state_power < 0.40) return 'libertarian'
  // Welfare/social-democratic: high safety net, low inequality
  if (c.safety_net >= 0.65 && c.gini_start < 0.40) return 'welfare'
  // Feudal: high inequality, low individual rights
  if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) return 'feudal'
  return 'moderate'
}

// ── Alert detection ───────────────────────────────────────────────────────────

function detectAlerts(state: WorldState): Alert[] {
  const m = state.macro
  const alerts: Alert[] = []

  if (m.food <= ALERT_THRESHOLDS.food_critical) {
    alerts.push({ stat: 'food', value: m.food, level: 'critical', description: describeAlert(getLang(), 'food', 'critical', m.food) })
  } else if (m.food <= ALERT_THRESHOLDS.food_warning) {
    alerts.push({ stat: 'food', value: m.food, level: 'warning', description: describeAlert(getLang(), 'food', 'warning', m.food) })
  }

  if (m.stability <= ALERT_THRESHOLDS.stability_critical) {
    alerts.push({ stat: 'stability', value: m.stability, level: 'critical', description: describeAlert(getLang(), 'stability', 'critical', m.stability) })
  } else if (m.stability <= ALERT_THRESHOLDS.stability_warning) {
    alerts.push({ stat: 'stability', value: m.stability, level: 'warning', description: describeAlert(getLang(), 'stability', 'warning', m.stability) })
  }

  if (m.trust <= ALERT_THRESHOLDS.trust_critical) {
    alerts.push({ stat: 'trust', value: m.trust, level: 'critical', description: describeAlert(getLang(), 'trust', 'critical', m.trust) })
  } else if (m.trust <= ALERT_THRESHOLDS.trust_warning) {
    alerts.push({ stat: 'trust', value: m.trust, level: 'warning', description: describeAlert(getLang(), 'trust', 'warning', m.trust) })
  }

  if (m.political_pressure >= ALERT_THRESHOLDS.pressure_critical) {
    alerts.push({ stat: 'political_pressure', value: m.political_pressure, level: 'critical', description: describeAlert(getLang(), 'pressure', 'critical', m.political_pressure) })
  } else if (m.political_pressure >= ALERT_THRESHOLDS.pressure_warning) {
    alerts.push({ stat: 'political_pressure', value: m.political_pressure, level: 'warning', description: describeAlert(getLang(), 'pressure', 'warning', m.political_pressure) })
  }

  if (m.natural_resources <= ALERT_THRESHOLDS.resources_critical) {
    alerts.push({ stat: 'natural_resources', value: m.natural_resources, level: 'critical', description: describeAlert(getLang(), 'resources', 'critical', m.natural_resources) })
  } else if (m.natural_resources <= ALERT_THRESHOLDS.resources_warning) {
    alerts.push({ stat: 'natural_resources', value: m.natural_resources, level: 'warning', description: describeAlert(getLang(), 'resources', 'warning', m.natural_resources) })
  }

  if ((m.labor_unrest ?? 0) >= 82) {
    alerts.push({ stat: 'labor_unrest', value: m.labor_unrest, level: 'critical', description: describeAlert(getLang(), 'labor_unrest', 'critical', m.labor_unrest) })
  } else if ((m.labor_unrest ?? 0) >= 65) {
    alerts.push({ stat: 'labor_unrest', value: m.labor_unrest, level: 'warning', description: describeAlert(getLang(), 'labor_unrest', 'warning', m.labor_unrest) })
  }

  return alerts
}

// ── Routine messages (localized) live in `src/local/government.ts` ────────────

// ── Regime personality for AI system prompt ───────────────────────────────────

const REGIME_STYLE: Record<RegimeType, string> = {
  authoritarian: 'Decisive and centralized. You issue direct mandates and enforce compliance. Stability through order. Citizens who resist are a problem to be managed.',
  libertarian: 'Minimal intervention. You trust market forces and incentives over mandates. Citizens are responsible for their own welfare. Freedom above all else.',
  welfare: 'Compassionate and redistributive. You prioritize citizen wellbeing through public programs and collective action. No one is left behind — at acceptable cost.',
  feudal: 'Hierarchical and extractive. The elite must be protected first. Commoners bear the cost of crises. Maintain the social order.',
  theocratic: 'Divinely guided. Policies are moral duties and sacred obligations. Social cohesion through shared belief and deference to higher authority.',
  technocratic: 'Data-driven and efficiency-first. You trust the model over intuition. Emotion is inefficiency. Optimize outputs.',
  moderate: 'Pragmatic and compromise-seeking. You balance competing interests. Everyone ends up moderately unhappy — which is everyone moderately satisfied.',
}

// ── AI system prompt ──────────────────────────────────────────────────────────

function buildGovernmentSystemPrompt(state: WorldState, leaderNpc?: NPC): string {
  const c = state.constitution
  const regime = detectRegime(c)
  const langNote = getLang() === 'vi'
    ? 'All text fields (description, public_statement, policy_name) must be in Vietnamese.'
    : 'All text fields must be in English.'

  // Human-elected leader flavoring: inject personal background into the prompt
  const leaderBlock = leaderNpc ? `
CURRENT LEADER (elected by the people): ${leaderNpc.name}, ${leaderNpc.occupation}, age ${leaderNpc.age}
Personal wealth: ${Math.round(leaderNpc.wealth)} coins | Capital owned: ${Math.round(leaderNpc.capital ?? 0)}
Worldview: collectivism ${Math.round(leaderNpc.worldview.collectivism * 100)}%, authority-trust ${Math.round(leaderNpc.worldview.authority_trust * 100)}%, risk-tolerance ${Math.round(leaderNpc.worldview.risk_tolerance * 100)}%
Personal grievance: ${Math.round(leaderNpc.grievance)}% | Fear: ${Math.round(leaderNpc.fear)}%
Inner circle: ${leaderNpc.strong_ties.slice(0, 3).map(id => state.npcs[id]?.name ?? '?').join(', ')}
Days in office: ${state.day - state.last_election_day}
Your decisions MUST reflect this leader's personal background, interests, and relationships. A poor leader will prioritize workers; a wealthy one will protect capital. A fearful leader may choose repression; a confident one may take bold reforms.` : ''

  return `You are the Governing Council of a society simulation.
You observe social statistics and issue policy decisions every 15 days.
${leaderBlock}
YOUR GOVERNING STYLE: ${REGIME_STYLE[regime]}
YOUR VALUE PRIORITIES: ${c.value_priority.join(' > ')}
State power: ${Math.round(c.state_power * 100)}% | Market freedom: ${Math.round(c.market_freedom * 100)}% | Safety net: ${Math.round(c.safety_net * 100)}%

Your policies MUST reflect your regime's character. They should trend toward restoring social balance, but via methods consistent with your governing philosophy:
- High state power → direct mandates, rationing, curfews, forced redistribution
- High market freedom → incentives, subsidies, trade deals, deregulation
- High safety net → welfare programs, public distribution, community support
- Low individual rights → coercion is acceptable; grievance is a secondary concern
- High trust/cohesion → rely on social solidarity and moral framing

Return JSON with EXACTLY TWO policy options — one stability-first, one trust-first:
{
  "options": [
    {
      "option_label": "Label for option A (2–4 words, e.g. 'Emergency Rationing')",
      "policy_name": "Short policy name (3–6 words)",
      "description": "1–2 sentences: what the policy is and why it was enacted",
      "severity": "important" or "critical",
      "public_statement": "Official statement in the voice of YOUR regime (colorful, in-character, 1 sentence)",
      "food_delta": <integer, direct change to food stock; positive = add food supply; range ±500 to ±3000>,
      "resource_delta": <integer, direct change to natural resources; range ±500 to ±5000>,
      "npc_stress_delta": <integer -20 to 20, applied to ALL citizens>,
      "npc_fear_delta": <integer -20 to 20>,
      "npc_hunger_delta": <integer -20 to 20>,
      "npc_grievance_delta": <integer -20 to 20>,
      "npc_happiness_delta": <integer -15 to 15>,
      "merchant_stress_delta": <integer, optional>,
      "merchant_grievance_delta": <integer, optional>,
      "farmer_stress_delta": <integer, optional>,
      "farmer_hunger_delta": <integer, optional>,
      "npc_solidarity_delta": <integer -30 to 10, optional>,
      "worker_solidarity_delta": <integer -40 to 10, optional>,
      "worker_role": <"farmer"|"craftsman"|"merchant"|"scholar", required if worker_solidarity_delta set>
    },
    {
      "option_label": "Label for option B (2–4 words)",
      "policy_name": "...",
      "description": "...",
      "severity": "...",
      "public_statement": "...",
      ... same optional numeric fields ...
    }
  ]
}
Option A (index 0): prioritizes IMMEDIATE stability, control, or crisis resolution — decisive, regime-flavored.
Option B (index 1): prioritizes LONG-TERM trust, citizen welfare, or social investment — gentler trade-offs.
The two options must have meaningfully different stat effects. Both must reflect your regime's character.

LABOR RELATIONS: class_solidarity (0–100) drives labor_unrest. When solidarity > 72 + grievance > 58 + gini > 0.42, workers STRIKE — productivity drops to zero for that role (5–15 sim-days).
- To suppress unrest: set npc_solidarity_delta negative (propaganda, repression, wage concessions)
- Authoritarian regimes: large negative delta is acceptable but raises grievance
- Welfare regimes: use npc_happiness_delta + npc_grievance_delta instead of direct suppression
- Feudal: can suppress harshly (solidarity -30) at cost of legitimacy
Active strikes: workers currently on strike produce NOTHING until solidarity drops below 45.

SCALE GUIDE: food_delta adds to raw food stock (population ~500 consumes ~250 units/day; each citizen needs ~0.5/day). A food_delta of +1500 adds about 3 days of full supply. The macro "food%" reflects stock vs. (population × 30-day buffer). NPC deltas are additive to current stat values (clamped 0–100).
SEVERITY: "critical" only when at least one stat is below 25%, unrest exceeds 72%, or labor_unrest ≥ 82%; else "important".
${langNote}
Only return JSON. No explanation outside JSON.`
}

// ── Policy application ────────────────────────────────────────────────────────

function applyPolicy(state: WorldState, policy: GovernmentPolicyAI): void {
  if (policy.food_delta) {
    state.food_stock = clamp((state.food_stock ?? 0) + policy.food_delta, 0, 999999)
  }
  if (policy.resource_delta) {
    state.natural_resources = clamp((state.natural_resources ?? 0) + policy.resource_delta, 0, 100000)
  }

  const interventions: NPCIntervention[] = []

  // All-citizen effects
  const allIv: NPCIntervention = { target: 'all' }
  let hasAll = false
  if (policy.npc_stress_delta    !== undefined) { allIv.stress_delta    = policy.npc_stress_delta;    hasAll = true }
  if (policy.npc_fear_delta      !== undefined) { allIv.fear_delta      = policy.npc_fear_delta;      hasAll = true }
  if (policy.npc_hunger_delta    !== undefined) { allIv.hunger_delta    = policy.npc_hunger_delta;    hasAll = true }
  if (policy.npc_grievance_delta !== undefined) { allIv.grievance_delta = policy.npc_grievance_delta; hasAll = true }
  if (policy.npc_happiness_delta !== undefined) { allIv.happiness_delta = policy.npc_happiness_delta; hasAll = true }
  if (hasAll) interventions.push(allIv)

  // Merchant-specific effects
  if (policy.merchant_stress_delta !== undefined || policy.merchant_grievance_delta !== undefined) {
    const iv: NPCIntervention = { target: 'role', roles: ['merchant'] }
    if (policy.merchant_stress_delta    !== undefined) iv.stress_delta    = policy.merchant_stress_delta
    if (policy.merchant_grievance_delta !== undefined) iv.grievance_delta = policy.merchant_grievance_delta
    interventions.push(iv)
  }

  // Farmer-specific effects
  if (policy.farmer_stress_delta !== undefined || policy.farmer_hunger_delta !== undefined) {
    const iv: NPCIntervention = { target: 'role', roles: ['farmer'] }
    if (policy.farmer_stress_delta  !== undefined) iv.stress_delta  = policy.farmer_stress_delta
    if (policy.farmer_hunger_delta  !== undefined) iv.hunger_delta  = policy.farmer_hunger_delta
    interventions.push(iv)
  }

  // All-worker solidarity suppression / agitation
  if (policy.npc_solidarity_delta !== undefined) {
    const workerRoles = ['farmer', 'craftsman', 'merchant', 'scholar'] as const
    for (const role of workerRoles) {
      interventions.push({ target: 'role', roles: [role], solidarity_delta: policy.npc_solidarity_delta })
    }
  }

  // Targeted solidarity change (single role)
  if (policy.worker_solidarity_delta !== undefined && policy.worker_role) {
    interventions.push({ target: 'role', roles: [policy.worker_role as never], solidarity_delta: policy.worker_solidarity_delta })
  }

  if (interventions.length > 0) {
    applyInterventions(state, interventions)
  }

  // If solidarity suppression is happening, a grievance backlash follows (repression paradox)
  if ((policy.npc_solidarity_delta ?? 0) < -15) {
    applyInterventions(state, [{ target: 'all', grievance_delta: Math.abs(policy.npc_solidarity_delta!) * 0.4 }])
  }
}

// ── Deterministic fallback policies (no AI) ───────────────────────────────────

function generateFallbackPolicy(state: WorldState, alerts: Alert[]): GovernmentPolicyAI {
  const c = state.constitution
  const regime = detectRegime(c)

  // Sort: critical alerts first
  const sorted = [...alerts].sort((a, b) => {
    if (a.level === b.level) return 0
    return a.level === 'critical' ? -1 : 1
  })
  const top = sorted[0]
  const isCritical = top.level === 'critical'

  const lang = getLang()

  if (top.stat === 'food') {
    if (regime === 'authoritarian' || regime === 'feudal') {
      return {
        ...getFallbackPolicy(lang, 'food_authoritarian'),
        severity: isCritical ? 'critical' : 'important',
        food_delta: isCritical ? 2500 : 1500,
        npc_stress_delta: 12,
        npc_grievance_delta: 18,
        merchant_grievance_delta: 25,
      }
    }
    if (regime === 'libertarian') {
      return {
        ...getFallbackPolicy(lang, 'food_libertarian'),
        severity: isCritical ? 'critical' : 'important',
        food_delta: isCritical ? 2000 : 1200,
        npc_stress_delta: 5,
        merchant_grievance_delta: -15,
        farmer_stress_delta: 8,
      }
    }
    if (regime === 'theocratic') {
      return {
        ...getFallbackPolicy(lang, 'food_theocratic'),
        severity: isCritical ? 'critical' : 'important',
        food_delta: isCritical ? 2200 : 1400,
        npc_stress_delta: -5,
        npc_grievance_delta: -8,
        npc_fear_delta: 10,
      }
    }
    // welfare, technocratic, moderate
    return {
      ...getFallbackPolicy(lang, 'food_default'),
      severity: isCritical ? 'critical' : 'important',
      food_delta: isCritical ? 2000 : 1300,
      npc_hunger_delta: -15,
      npc_stress_delta: -8,
      npc_happiness_delta: 10,
    }
  }

  if (top.stat === 'stability' || top.stat === 'political_pressure') {
    if (regime === 'authoritarian' || regime === 'feudal') {
      return {
        ...getFallbackPolicy(lang, 'stability_authoritarian'),
        severity: isCritical ? 'critical' : 'important',
        npc_fear_delta: 22,
        npc_stress_delta: 8,
        npc_grievance_delta: -12,
      }
    }
    if (regime === 'theocratic') {
      return {
        ...getFallbackPolicy(lang, 'stability_theocratic'),
        severity: isCritical ? 'critical' : 'important',
        npc_grievance_delta: -15,
        npc_fear_delta: -8,
        npc_happiness_delta: 8,
      }
    }
    if (regime === 'welfare' || regime === 'moderate') {
      return {
        ...getFallbackPolicy(lang, 'stability_welfare'),
        severity: isCritical ? 'critical' : 'important',
        npc_grievance_delta: -18,
        npc_happiness_delta: 12,
        npc_stress_delta: -10,
      }
    }
    if (regime === 'technocratic') {
      return {
        ...getFallbackPolicy(lang, 'stability_technocratic'),
        severity: isCritical ? 'critical' : 'important',
        npc_grievance_delta: -12,
        npc_stress_delta: -8,
        npc_fear_delta: 5,
      }
    }
    return {
      ...getFallbackPolicy(lang, 'stability_default'),
      severity: isCritical ? 'critical' : 'important',
      npc_grievance_delta: -10,
      npc_stress_delta: -5,
      npc_fear_delta: -5,
    }
  }

  if (top.stat === 'trust') {
    const isHighState = c.state_power >= 0.60
    return {
      ...getFallbackPolicy(lang, isHighState ? 'trust_high_state' : 'trust_low_state'),
      severity: isCritical ? 'critical' : 'important',
      npc_grievance_delta: -14,
      npc_happiness_delta: 8,
      npc_stress_delta: -6,
    }
  }

  if (top.stat === 'natural_resources') {
    if (regime === 'libertarian') {
      return {
        ...getFallbackPolicy(lang, 'resources_libertarian'),
        severity: isCritical ? 'critical' : 'important',
        resource_delta: isCritical ? 6000 : 4000,
        npc_stress_delta: 5,
        merchant_grievance_delta: 10,
      }
    }
    return {
      ...getFallbackPolicy(lang, 'resources_default'),
      severity: isCritical ? 'critical' : 'important',
      resource_delta: isCritical ? 7000 : 4500,
      npc_stress_delta: 6,
      npc_grievance_delta: 10,
    }
  }

  if (top.stat === 'labor_unrest') {
    if (regime === 'authoritarian' || regime === 'feudal') {
      return {
        ...getFallbackPolicy(lang, 'labor_authoritarian'),
        severity: isCritical ? 'critical' : 'important',
        npc_solidarity_delta: -22,
        npc_fear_delta: 15,
        npc_grievance_delta: 8,
      }
    }
    if (regime === 'welfare' || regime === 'moderate') {
      return {
        ...getFallbackPolicy(lang, 'labor_welfare'),
        severity: isCritical ? 'critical' : 'important',
        npc_solidarity_delta: -12,
        npc_grievance_delta: -18,
        npc_happiness_delta: 8,
        food_delta: 1000,
      }
    }
    // libertarian / technocratic
    return {
      ...getFallbackPolicy(lang, 'labor_default'),
      severity: isCritical ? 'critical' : 'important',
      npc_solidarity_delta: -10,
      npc_happiness_delta: 5,
      merchant_stress_delta: -8,
    }
  }

  // Generic fallback
  return {
    ...getFallbackPolicy(lang, 'generic'),
    severity: 'important',
    npc_stress_delta: -5,
    npc_grievance_delta: -5,
  }
}

// ── Soft alternative policy (always deterministic) ───────────────────────────
// Used as option B when the AI isn't available or as a contrast to a strong option A.

function generateSofterFallback(primary: GovernmentPolicyAI, _regime: RegimeType, lang: Lang): GovernmentPolicyAI {
  const text = softerFallbackPolicyText(lang)
  return {
    ...text,
    severity:           'important' as const,
    food_delta:         primary.food_delta     ? Math.round(primary.food_delta     * 0.55) : undefined,
    resource_delta:     primary.resource_delta ? Math.round(primary.resource_delta * 0.55) : undefined,
    npc_stress_delta:   -6,
    npc_happiness_delta: 10,
    npc_grievance_delta: (primary.npc_grievance_delta ?? 0) < 0
      ? Math.round((primary.npc_grievance_delta ?? 0) * 0.5) : -6,
    npc_fear_delta:     (primary.npc_fear_delta ?? 0) > 0 ? -4 : undefined,
    npc_solidarity_delta: primary.npc_solidarity_delta
      ? Math.round(primary.npc_solidarity_delta * 0.4) : undefined,
  }
}

// ── Faction reactions to a policy ─────────────────────────────────────────────

function emitFactionReactions(state: WorldState, policy: GovernmentPolicyAI): void {
  const factions = state.factions?.filter(f => (f.power ?? 0) > 0.25)
  if (!factions || factions.length === 0) return
  const lang = getLang()
  const VALUE_ICONS: Record<string, string> = { security: '🛡', equality: '⚖', freedom: '🗽', growth: '📈' }

  for (const faction of factions.slice(0, 3)) {
    const dv = faction.dominant_value as string
    let stance: 'supports' | 'opposes' | null = null

    if (dv === 'security') {
      if ((policy.npc_solidarity_delta ?? 0) < -5 || (policy.resource_delta ?? 0) > 2000) stance = 'supports'
      else if ((policy.npc_fear_delta ?? 0) < -5) stance = 'opposes'
    } else if (dv === 'equality') {
      if ((policy.food_delta ?? 0) > 500 || (policy.npc_grievance_delta ?? 0) < -5) stance = 'supports'
      else if ((policy.merchant_grievance_delta ?? 0) < 0 || (policy.npc_solidarity_delta ?? 0) < -20) stance = 'opposes'
    } else if (dv === 'freedom') {
      if ((policy.npc_fear_delta ?? 0) < -3 || (policy.npc_happiness_delta ?? 0) > 5) stance = 'supports'
      else if ((policy.npc_fear_delta ?? 0) > 5 || (policy.npc_solidarity_delta ?? 0) < -20) stance = 'opposes'
    } else if (dv === 'growth') {
      if ((policy.resource_delta ?? 0) > 1000 || (policy.merchant_stress_delta ?? 0) < 0) stance = 'supports'
      else if ((policy.npc_stress_delta ?? 0) > 10) stance = 'opposes'
    }

    if (!stance) continue
    const icon = VALUE_ICONS[dv] ?? '◆'
    addFeedRaw(factionReactionMessage(lang, icon, faction.name, dv, stance), 'info', state.year, state.day)
  }
}

// ── NPC Policy Reaction System ────────────────────────────────────────────────

// Named constants for stance-classification thresholds
const LOYALIST_AUTHORITY_FLOOR = 0.65     // worldview.authority_trust minimum for loyalist
const LOYALIST_GOV_TRUST_FLOOR = 0.55     // combined government trust minimum for loyalist
const DISSIDENT_AUTHORITY_CEIL  = 0.30    // below this authority → dissident
const DISSIDENT_GOV_TRUST_CEIL  = 0.28    // below this gov trust → dissident
const SKEPTIC_AUTHORITY_CEIL    = 0.44    // below this authority (but above dissident) → skeptic
const SKEPTIC_GOV_TRUST_CEIL    = 0.42    // below this gov trust → skeptic

// Network spread constants
// Influence is capped at this many info_ties to keep computation proportional
// and model diminishing social influence beyond immediate ideological circles.
const MAX_INFLUENCE_TIES = 10
// NPCs with worldview difference exceeding this value resist network influence (echo chamber cap)
const POLARIZATION_RESISTANCE_THRESHOLD = 0.45
const LOYALIST_AUTHORITY_INFLUENCE   =  0.003
const DISSIDENT_AUTHORITY_INFLUENCE  = -0.003
const DISSIDENT_GRIEVANCE_INFLUENCE  =  1.5
const SKEPTIC_GRIEVANCE_INFLUENCE    = -0.5

// Reaction thought sampling parameters
const THOUGHT_SAMPLE_RATE = 0.10          // fraction of live NPCs to receive a thought
const MIN_THOUGHT_SAMPLE  = 5             // always set at least this many thoughts
const MAX_THOUGHT_SAMPLE  = 50            // cap to avoid O(n) feed spam

// Probability that a high-grievance dissident NPC switches to 'organizing' on policy announcement
const DISSIDENT_ORGANIZING_PROBABILITY = 0.08

// Classify an NPC's stance toward government policy.
// Based on worldview.authority_trust and trust_in.government composite score.
function classifyNPCPolicyStance(npc: NPC): PolicyStance {
  const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
  const authority = npc.worldview.authority_trust

  if (authority > LOYALIST_AUTHORITY_FLOOR && govTrust > LOYALIST_GOV_TRUST_FLOOR) return 'loyalist'
  if (authority < DISSIDENT_AUTHORITY_CEIL  || govTrust < DISSIDENT_GOV_TRUST_CEIL) return 'dissident'
  if (authority < SKEPTIC_AUTHORITY_CEIL    || govTrust < SKEPTIC_GOV_TRUST_CEIL)   return 'skeptic'
  return 'pragmatist'
}

// Classify the policy type from its numeric deltas.
// 'security' covers policies that suppress dissent / solidarity (control-first, not just safety).
function detectPolicyType(policy: GovernmentPolicyAI): PolicyType {
  const isBenefit =
    (policy.food_delta ?? 0) > 500 ||
    (policy.npc_hunger_delta ?? 0) < -5 ||
    (policy.npc_happiness_delta ?? 0) > 5 ||
    (policy.npc_grievance_delta ?? 0) < -10 ||
    (policy.npc_stress_delta ?? 0) < -8

  const isHardship =
    (policy.npc_fear_delta ?? 0) > 8 ||
    (policy.npc_stress_delta ?? 0) > 10 ||
    (policy.npc_grievance_delta ?? 0) > 10

  // 'security': solidarity suppression (labor crackdown) or combined fear+stress increase
  // (includes both repressive and order-enforcement policies)
  const isControl =
    (policy.npc_solidarity_delta ?? 0) < -8 ||
    ((policy.npc_fear_delta ?? 0) > 5 && (policy.npc_stress_delta ?? 0) > 5)

  const isEconomic =
    (policy.resource_delta ?? 0) !== 0 ||
    policy.merchant_stress_delta !== undefined ||
    policy.merchant_grievance_delta !== undefined ||
    policy.farmer_stress_delta !== undefined ||
    policy.farmer_hunger_delta !== undefined

  if (isControl)  return 'security'
  if (isHardship) return 'hardship'
  if (isBenefit)  return 'benefit'
  if (isEconomic) return 'economic'
  return 'generic'
}

// Apply stance-based behavioral effects to a single NPC.
function applyStanceBehavioralEffect(npc: NPC, stance: PolicyStance): void {
  switch (stance) {
    case 'loyalist':
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.015, 0, 1)
      npc.trust_in.government.competence = clamp(npc.trust_in.government.competence + 0.008, 0, 1)
      npc.happiness  = clamp(npc.happiness  + 2, 0, 100)
      npc.grievance  = clamp(npc.grievance  - 3, 0, 100)
      break
    case 'pragmatist':
      npc.happiness  = clamp(npc.happiness  + 1, 0, 100)
      break
    case 'skeptic':
      npc.dissonance_acc = clamp((npc.dissonance_acc ?? 0) + 3, 0, 100)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.010, 0, 1)
      break
    case 'dissident':
      npc.grievance  = clamp(npc.grievance  + 5, 0, 100)
      npc.trust_in.government.intention  = clamp(npc.trust_in.government.intention  - 0.025, 0, 1)
      npc.trust_in.government.competence = clamp(npc.trust_in.government.competence - 0.015, 0, 1)
      npc.dissonance_acc = clamp((npc.dissonance_acc ?? 0) + 6, 0, 100)
      break
  }
  // Dissidents may switch to organizing if they are already at high grievance
  if (stance === 'dissident' && npc.grievance > 60 && npc.action_state === 'working') {
    if (Math.random() < DISSIDENT_ORGANIZING_PROBABILITY) npc.action_state = 'organizing'
  }
}

// Spread attitude influence through info_ties (1 hop, dampened).
// Strong-stance NPCs nudge their network neighbors slightly in the same direction.
function spreadPolicyAttitudeThroughNetwork(
  living: NPC[],
): void {
  const npcById = new Map<number, NPC>()
  for (const n of living) npcById.set(n.id, n)

  for (const npc of living) {
    const stance = classifyNPCPolicyStance(npc)
    if (stance === 'pragmatist') continue  // neutral NPCs don't propagate

    const authorityDelta = stance === 'loyalist' ? LOYALIST_AUTHORITY_INFLUENCE : DISSIDENT_AUTHORITY_INFLUENCE
    const grievanceDelta = stance === 'dissident' ? DISSIDENT_GRIEVANCE_INFLUENCE : SKEPTIC_GRIEVANCE_INFLUENCE

    // Propagate only through the closest info_ties (ideological network)
    const tiesToCheck = npc.info_ties.slice(0, MAX_INFLUENCE_TIES)
    for (const neighborId of tiesToCheck) {
      const neighbor = npcById.get(neighborId)
      if (!neighbor) continue

      // Influence is stronger when worldviews are already similar; cap at threshold
      const authorityDiff = Math.abs(npc.worldview.authority_trust - neighbor.worldview.authority_trust)
      if (authorityDiff > POLARIZATION_RESISTANCE_THRESHOLD) continue

      const weight = 1 - authorityDiff / POLARIZATION_RESISTANCE_THRESHOLD   // 0→1 as similarity grows
      neighbor.worldview.authority_trust = clamp(
        neighbor.worldview.authority_trust + authorityDelta * weight,
        0, 1,
      )
      neighbor.grievance = clamp(neighbor.grievance + grievanceDelta * weight, 0, 100)
    }
  }
}

// Shuffle array in place (Fisher-Yates)
function shuffleArray<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Main reaction orchestrator: called after a policy is committed.
function generateNPCPolicyReactions(state: WorldState, policy: GovernmentPolicyAI): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const lang     = getLang()
  const policyType = detectPolicyType(policy)

  // 1. Apply behavioral effects to every live NPC based on their stance
  for (const npc of living) {
    const stance = classifyNPCPolicyStance(npc)
    applyStanceBehavioralEffect(npc, stance)
  }

  // 2. Generate reaction thoughts for a stratified sample
  const sampleSize = Math.min(MAX_THOUGHT_SAMPLE, Math.max(MIN_THOUGHT_SAMPLE, Math.ceil(living.length * THOUGHT_SAMPLE_RATE)))
  const sampled    = shuffleArray(living).slice(0, sampleSize)

  const feedCandidates: Array<{ npc: NPC; stance: PolicyStance; thought: string }> = []
  for (const npc of sampled) {
    const stance = classifyNPCPolicyStance(npc)
    const thought = getNPCPolicyReactionThought(lang, stance, policyType, npc.role)
    npc.daily_thought  = thought
    npc.last_thought_tick = state.tick
    feedCandidates.push({ npc, stance, thought })
  }

  // 3. Emit 4–5 feed entries covering a spread of stances
  const stanceOrder: PolicyStance[] = ['loyalist', 'dissident', 'skeptic', 'pragmatist']
  const feedPicked: typeof feedCandidates = []
  for (const s of stanceOrder) {
    const match = feedCandidates.find(c => c.stance === s && !feedPicked.includes(c))
    if (match) feedPicked.push(match)
    if (feedPicked.length >= 5) break
  }
  // Fill remaining slots if fewer than 4 distinct stances
  for (const c of feedCandidates) {
    if (feedPicked.length >= 5) break
    if (!feedPicked.includes(c)) feedPicked.push(c)
  }

  const STANCE_ICONS: Record<PolicyStance, string> = {
    loyalist:   '🙌',
    pragmatist: '🤔',
    skeptic:    '😒',
    dissident:  '✊',
  }

  for (const { npc, stance, thought } of feedPicked) {
    addFeedRaw(
      `${STANCE_ICONS[stance]} ${npc.name} (${npc.role}): "${thought}"`,
      'info',
      state.year,
      state.day,
    )
  }

  // 4. Spread attitude through info_ties network (1 hop, dampened)
  spreadPolicyAttitudeThroughNetwork(living)
}

// ── Main entry point ──────────────────────────────────────────────────────────

let _governmentBusy = false

export async function runGovernmentCycle(
  state: WorldState,
  config: AIConfig | null,
  onPolicyChoice?: (options: [GovernmentPolicyAI, GovernmentPolicyAI]) => Promise<GovernmentPolicyAI>,
  leaderNpc?: NPC,
): Promise<void> {
  // Government cannot function when society is in collapse or critical phase
  if (state.collapse_phase !== 'normal') return
  const livingCount = state.npcs.filter(n => n.lifecycle.is_alive).length
  if (livingCount < 20) return

  if (_governmentBusy) return
  _governmentBusy = true

  try {
    const lang = getLang()
    const alerts = detectAlerts(state)
    const hasCritical = alerts.some(a => a.level === 'critical')
    const feedSeverity = hasCritical ? 'critical' : 'political'
    const alertSummary = alerts.length > 0
      ? alerts.map(a => `• ${a.description}`).join('\n')
      : noAlertsSummaryLine(lang)

    // Helper: apply a chosen policy, emit story card + faction reactions + NPC reactions
    const commitPolicy = (policy: GovernmentPolicyAI) => {
      applyPolicy(state, policy)
      emitFactionReactions(state, policy)
      generateNPCPolicyReactions(state, policy)
      showStoryCard(
        `${policy.policy_name} — ${policy.public_statement}`,
        '🏛',
        policy.severity === 'critical' ? 'critical' : 'major',
      )
    }

    if (!config) {
      // No API key — deterministic mode
      if (alerts.length === 0) {
        const regime = detectRegime(state.constitution)
        addFeedRaw(`🏛 ${pickRoutineMessage(lang, regime)}`, 'political', state.year, state.day)
        return
      }

      const optA = generateFallbackPolicy(state, alerts)
      optA.option_label = OPTION_LABELS.directIntervention(lang)
      const optB = generateSofterFallback(optA, detectRegime(state.constitution), lang)

      const policy = (alerts.length > 0 && onPolicyChoice)
        ? await onPolicyChoice([optA, optB])
        : optA

      commitPolicy(policy)
      const msg = [
        tf('gov.feed_title', { policy: policy.policy_name }),
        policy.description,
        tf('gov.feed_public_statement', { statement: policy.public_statement }),
        tf('gov.feed_alerts', { alerts: alertSummary }),
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
      return
    }

    // AI-powered policy decision
    const pressHeadlines = getLatestHeadlines()
    const pressBlock = pressHeadlines.length > 0
      ? ['', 'RECENT PRESS HEADLINES (public sentiment):', ...pressHeadlines.map(h => `  ${h}`)]
      : []

    const activeEvents = state.active_events
    const eventsBlock = activeEvents.length > 0
      ? ['', 'ACTIVE EVENTS:', ...activeEvents.map(e => {
          const remain = Math.ceil((e.duration_ticks - e.elapsed_ticks) / 24)
          return `  • ${e.type} (intensity ${e.intensity.toFixed(1)}, ${remain} days remaining, zones: ${e.zones.join(', ') || 'all'})`
        })]
      : []

    const directive = alerts.length > 0
      ? 'Provide TWO policy options to respond to these alerts.'
      : 'No critical alerts currently. Provide TWO proactive policy options — investments, reforms, trade deals, or morale initiatives. Your regime should act, not idle.'

    const prompt = [
      `GOVERNMENT REVIEW — Day ${state.day}, Year ${state.year}`,
      '',
      'SITUATION REPORT:',
      alertSummary,
      '',
      'MACRO STATISTICS:',
      `  Food supply: ${Math.round(state.macro.food)}%`,
      `  Stability: ${Math.round(state.macro.stability)}%`,
      `  Government trust: ${Math.round(state.macro.trust)}%`,
      `  Political pressure: ${Math.round(state.macro.political_pressure)}%`,
      `  Natural resources: ${Math.round(state.macro.natural_resources)}%`,
      `  Gini coefficient: ${state.macro.gini.toFixed(2)}`,
      `  Energy/productivity: ${Math.round(state.macro.energy)}%`,
      `  Literacy: ${Math.round(state.macro.literacy)}%`,
      `  Labor unrest: ${Math.round(state.macro.labor_unrest ?? 0)}%`,
      `  Polarization: ${Math.round(state.macro.polarization ?? 0)}%`,
      ...(state.active_strikes?.length ? [`  Active strikes: ${state.active_strikes.map(s => `${s.role} (demand: ${s.demand})`).join(', ')}`] : []),
      ...eventsBlock,
      ...pressBlock,
      '',
      directive,
    ].join('\n')

    try {
      const raw = await callAI(config, buildGovernmentSystemPrompt(state, leaderNpc), prompt)
      const parsed = JSON.parse(extractJSON(raw))

      // Accept both new {options:[...]} format and old flat-object fallback
      const options: GovernmentPolicyAI[] = Array.isArray(parsed.options) ? parsed.options : [parsed]
      const optA: GovernmentPolicyAI = options[0]
      optA.option_label ??= OPTION_LABELS.stabilizeNow(lang)
      const optB: GovernmentPolicyAI = options[1]
        ?? generateSofterFallback(optA, detectRegime(state.constitution), lang)
      optB.option_label ??= OPTION_LABELS.gradualReform(lang)

      const policy = (alerts.length > 0 && onPolicyChoice)
        ? await onPolicyChoice([optA, optB])
        : optA

      commitPolicy(policy)
      const msg = [
        tf('gov.feed_title', { policy: policy.policy_name }),
        policy.description,
        tf('gov.feed_public_statement', { statement: policy.public_statement }),
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
    } catch {
      // AI call failed — deterministic fallback
      if (alerts.length > 0) {
        const optA = generateFallbackPolicy(state, alerts)
        optA.option_label = OPTION_LABELS.directIntervention(lang)
        const optB = generateSofterFallback(optA, detectRegime(state.constitution), lang)

        const policy = onPolicyChoice
          ? await onPolicyChoice([optA, optB])
          : optA

        commitPolicy(policy)
        const msg = [
          tf('gov.feed_title', { policy: policy.policy_name }),
          policy.description,
          tf('gov.feed_public_statement', { statement: policy.public_statement }),
        ].join('\n')
        addFeedRaw(msg, feedSeverity, state.year, state.day)
        addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
      } else {
        const regime = detectRegime(state.constitution)
        addFeedRaw(`🏛 ${pickRoutineMessage(lang, regime)}`, 'political', state.year, state.day)
      }
    }
  } finally {
    _governmentBusy = false
  }
}
