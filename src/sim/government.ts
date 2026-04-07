// ── Government AI Agent ───────────────────────────────────────────────────────
// Runs every 15 sim-days. Observes macro stats and issues policy decisions.
// With AI: calls LLM for contextual, regime-aware policy.
// Without AI: deterministic fallbacks + witty routine messages.

import type { WorldState, AIConfig, NPCIntervention, Constitution } from '../types'
import { callAI, extractJSON } from '../ai/provider'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { applyInterventions } from './engine'
import { clamp } from './constitution'
import { getLang, tf } from '../i18n'
import { getLatestHeadlines } from './press'
import { describeAlert, noAlertsSummaryLine, pickRoutineMessage } from '../local/government'

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

interface GovernmentPolicyAI {
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

function detectRegime(c: Constitution): RegimeType {
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

function buildGovernmentSystemPrompt(state: WorldState): string {
  const c = state.constitution
  const regime = detectRegime(c)
  const langNote = getLang() === 'vi'
    ? 'All text fields (description, public_statement, policy_name) must be in Vietnamese.'
    : 'All text fields must be in English.'

  return `You are the Governing Council of a society simulation.
You observe social statistics and issue policy decisions every 15 days.

YOUR GOVERNING STYLE: ${REGIME_STYLE[regime]}
YOUR VALUE PRIORITIES: ${c.value_priority.join(' > ')}
State power: ${Math.round(c.state_power * 100)}% | Market freedom: ${Math.round(c.market_freedom * 100)}% | Safety net: ${Math.round(c.safety_net * 100)}%

Your policies MUST reflect your regime's character. They should trend toward restoring social balance, but via methods consistent with your governing philosophy:
- High state power → direct mandates, rationing, curfews, forced redistribution
- High market freedom → incentives, subsidies, trade deals, deregulation
- High safety net → welfare programs, public distribution, community support
- Low individual rights → coercion is acceptable; grievance is a secondary concern
- High trust/cohesion → rely on social solidarity and moral framing

Return JSON in EXACTLY this format (all numeric values are optional, omit if not applicable):
{
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
  "merchant_stress_delta": <integer, optional — extra effect on merchants only>,
  "merchant_grievance_delta": <integer, optional>,
  "farmer_stress_delta": <integer, optional>,
  "farmer_hunger_delta": <integer, optional>
}

SCALE GUIDE: food_delta adds to raw food stock (population ~500 consumes ~250 units/day; each citizen needs ~0.5/day). A food_delta of +1500 adds about 3 days of full supply. The macro "food%" reflects stock vs. (population × 30-day buffer). NPC deltas are additive to current stat values (clamped 0–100).
SEVERITY: "critical" only when at least one stat is below 25% or unrest exceeds 72%; else "important".
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

  if (interventions.length > 0) {
    applyInterventions(state, interventions)
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

  if (top.stat === 'food') {
    if (regime === 'authoritarian' || regime === 'feudal') {
      return {
        policy_name: 'Emergency Food Requisition Order',
        description: 'The Council ordered mandatory food requisitioning from all surplus households to replenish state reserves.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'By decree of the High Council: all surplus grain is hereby state property until reserves stabilize.',
        food_delta: isCritical ? 2500 : 1500,
        npc_stress_delta: 12,
        npc_grievance_delta: 18,
        merchant_grievance_delta: 25,
      }
    }
    if (regime === 'libertarian') {
      return {
        policy_name: 'Emergency Trade Route Stimulus',
        description: 'The Market Board announced zero-tariff zones and expedited trade licenses to attract external food suppliers.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'The Market is the solution. All barriers to food trade are hereby suspended.',
        food_delta: isCritical ? 2000 : 1200,
        npc_stress_delta: 5,
        merchant_grievance_delta: -15,
        farmer_stress_delta: 8,
      }
    }
    if (regime === 'theocratic') {
      return {
        policy_name: 'Sacred Fast and Community Sharing Decree',
        description: 'The High Council proclaimed a period of sacred communal sharing; temple storehouses opened to the people.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'The divine calls us to share. Temple granaries are open. Those who hoard shall answer to higher authority.',
        food_delta: isCritical ? 2200 : 1400,
        npc_stress_delta: -5,
        npc_grievance_delta: -8,
        npc_fear_delta: 10,
      }
    }
    // welfare, technocratic, moderate
    return {
      policy_name: 'Emergency Food Distribution Program',
      description: 'The Council activated emergency reserves and organized distribution centers across all districts.',
      severity: isCritical ? 'critical' : 'important',
      public_statement: 'The Governing Council assures all citizens: no one will go hungry. Emergency rations are now available at distribution centers.',
      food_delta: isCritical ? 2000 : 1300,
      npc_hunger_delta: -15,
      npc_stress_delta: -8,
      npc_happiness_delta: 10,
    }
  }

  if (top.stat === 'stability' || top.stat === 'political_pressure') {
    if (regime === 'authoritarian' || regime === 'feudal') {
      return {
        policy_name: 'Order Restoration Decree',
        description: 'The Council deployed guard forces and imposed curfews to suppress civil disturbances and restore order.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'Order will be maintained. Elements of disorder will be removed. Citizens are advised to return to their duties immediately.',
        npc_fear_delta: 22,
        npc_stress_delta: 8,
        npc_grievance_delta: -12,
      }
    }
    if (regime === 'theocratic') {
      return {
        policy_name: 'Spiritual Renewal and Reconciliation Edict',
        description: 'The High Council declared a period of communal prayer and moral renewal to heal social rifts.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'We are one people under divine guidance. Let us lay down discord and renew our sacred covenant.',
        npc_grievance_delta: -15,
        npc_fear_delta: -8,
        npc_happiness_delta: 8,
      }
    }
    if (regime === 'welfare' || regime === 'moderate') {
      return {
        policy_name: 'Social Stability and Dialogue Initiative',
        description: 'The Council launched community dialogue programs and increased social support services to address underlying grievances.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'The Council listens. Community centers and conflict-resolution services are now open across all districts.',
        npc_grievance_delta: -18,
        npc_happiness_delta: 12,
        npc_stress_delta: -10,
      }
    }
    if (regime === 'technocratic') {
      return {
        policy_name: 'Algorithmic Grievance Optimization Protocol',
        description: 'The Algorithm Advisory Board deployed predictive social management tools to preemptively resolve instability vectors.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'Analysis complete. Social instability corrected to within acceptable parameters. Comply with recommended behavioral adjustments.',
        npc_grievance_delta: -12,
        npc_stress_delta: -8,
        npc_fear_delta: 5,
      }
    }
    return {
      policy_name: 'Civil Reconciliation Measures',
      description: 'The Council held emergency sessions to address grievances and announced a package of reform pledges.',
      severity: isCritical ? 'critical' : 'important',
      public_statement: 'The Council hears the people\'s concerns and pledges meaningful reforms. Dialogue is open.',
      npc_grievance_delta: -10,
      npc_stress_delta: -5,
      npc_fear_delta: -5,
    }
  }

  if (top.stat === 'trust') {
    const isHighState = c.state_power >= 0.60
    return {
      policy_name: isHighState ? 'Public Unity and Trust Decree' : 'Transparency and Accountability Initiative',
      description: isHighState
        ? 'The Council launched a mandatory civic unity campaign alongside increased public services to rebuild trust.'
        : 'The Council announced transparency measures and public consultation forums to restore citizen confidence.',
      severity: isCritical ? 'critical' : 'important',
      public_statement: isHighState
        ? 'The Council reaffirms its commitment to the people. Unity is not optional — it is the foundation of our society.'
        : 'The Governing Council opens its books and its doors. Citizens deserve honesty, and we deliver it.',
      npc_grievance_delta: -14,
      npc_happiness_delta: 8,
      npc_stress_delta: -6,
    }
  }

  if (top.stat === 'natural_resources') {
    if (regime === 'libertarian') {
      return {
        policy_name: 'Resource Market Efficiency Act',
        description: 'The Council introduced tradeable extraction quotas and market incentives for resource conservation.',
        severity: isCritical ? 'critical' : 'important',
        public_statement: 'Market-based conservation is the answer. Extraction quotas are now tradeable assets.',
        resource_delta: isCritical ? 6000 : 4000,
        npc_stress_delta: 5,
        merchant_grievance_delta: 10,
      }
    }
    return {
      policy_name: 'Resource Conservation Mandate',
      description: 'The Council mandated reduced extraction rates, banned non-essential resource use, and invested in regeneration programs.',
      severity: isCritical ? 'critical' : 'important',
      public_statement: 'Sustainable use of natural resources is now mandatory. Extraction quotas have been set. The land must recover.',
      resource_delta: isCritical ? 7000 : 4500,
      npc_stress_delta: 6,
      npc_grievance_delta: 10,
    }
  }

  // Generic fallback
  return {
    policy_name: 'Emergency Stabilization Measures',
    description: 'The Council convened an emergency session and implemented a package of stabilization measures to address the current crisis.',
    severity: 'important',
    public_statement: 'The Council is taking decisive action. Citizens should remain calm and trust that the situation is being managed.',
    npc_stress_delta: -5,
    npc_grievance_delta: -5,
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

let _governmentBusy = false

export async function runGovernmentCycle(
  state: WorldState,
  config: AIConfig | null,
): Promise<void> {
  if (_governmentBusy) return
  _governmentBusy = true

  try {
    const alerts = detectAlerts(state)
    const hasCritical = alerts.some(a => a.level === 'critical')
    const feedSeverity = hasCritical ? 'critical' : 'political'
    const alertSummary = alerts.length > 0
      ? alerts.map(a => `• ${a.description}`).join('\n')
      : noAlertsSummaryLine(getLang())

    if (!config) {
      // No API key — deterministic mode
      if (alerts.length === 0) {
        const regime = detectRegime(state.constitution)
        addFeedRaw(`🏛 ${pickRoutineMessage(getLang(), regime)}`, 'political', state.year, state.day)
      } else {
        const policy = generateFallbackPolicy(state, alerts)
        applyPolicy(state, policy)
        const msg = [
          tf('gov.feed_title', { policy: policy.policy_name }),
          policy.description,
          tf('gov.feed_public_statement', { statement: policy.public_statement }),
          tf('gov.feed_alerts', { alerts: alertSummary }),
        ].join('\n')
        addFeedRaw(msg, feedSeverity, state.year, state.day)
        addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
      }
      return
    }

    // AI-powered policy decision — always runs when config is available
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
      ? 'Decide your government\'s policy response to these alerts.'
      : 'No critical alerts currently. Review the overall state and decide on PROACTIVE policy — investments, infrastructure, trade deals, reforms, preparations, or public morale initiatives. Your regime should still act, not idle.'

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
      ...eventsBlock,
      ...pressBlock,
      '',
      directive,
    ].join('\n')

    try {
      const raw = await callAI(config, buildGovernmentSystemPrompt(state), prompt)
      const policy = JSON.parse(extractJSON(raw)) as GovernmentPolicyAI
      applyPolicy(state, policy)
      const msg = [
        tf('gov.feed_title', { policy: policy.policy_name }),
        policy.description,
        tf('gov.feed_public_statement', { statement: policy.public_statement }),
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
    } catch {
      // AI call failed — use deterministic fallback or routine message
      if (alerts.length > 0) {
        const policy = generateFallbackPolicy(state, alerts)
        applyPolicy(state, policy)
        const msg = [
          tf('gov.feed_title', { policy: policy.policy_name }),
          policy.description,
          tf('gov.feed_public_statement', { statement: policy.public_statement }),
        ].join('\n')
        addFeedRaw(msg, feedSeverity, state.year, state.day)
        addChronicle(tf('gov.chronicle_enacted', { policy: policy.policy_name }), state.year, state.day, hasCritical ? 'critical' : 'major')
      } else {
        const regime = detectRegime(state.constitution)
        addFeedRaw(`🏛 ${pickRoutineMessage(getLang(), regime)}`, 'political', state.year, state.day)
      }
    }
  } finally {
    _governmentBusy = false
  }
}
