// ── Government AI Agent ───────────────────────────────────────────────────────
// Runs every 15 sim-days. Observes macro stats and issues policy decisions.
// With AI: calls LLM for contextual, regime-aware policy.
// Without AI: deterministic fallbacks + witty routine messages.

import type { WorldState, AIConfig, NPCIntervention, Constitution } from '../types'
import { callAI, extractJSON } from '../ai/provider'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { applyInterventions } from './engine'
import { clamp } from './constitution'
import { getLang } from '../i18n'

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
    alerts.push({ stat: 'food', value: m.food, level: 'critical', description: `food supply critically low (${Math.round(m.food)}%)` })
  } else if (m.food <= ALERT_THRESHOLDS.food_warning) {
    alerts.push({ stat: 'food', value: m.food, level: 'warning', description: `food supply low (${Math.round(m.food)}%)` })
  }

  if (m.stability <= ALERT_THRESHOLDS.stability_critical) {
    alerts.push({ stat: 'stability', value: m.stability, level: 'critical', description: `societal stability dangerously low (${Math.round(m.stability)}%)` })
  } else if (m.stability <= ALERT_THRESHOLDS.stability_warning) {
    alerts.push({ stat: 'stability', value: m.stability, level: 'warning', description: `stability declining (${Math.round(m.stability)}%)` })
  }

  if (m.trust <= ALERT_THRESHOLDS.trust_critical) {
    alerts.push({ stat: 'trust', value: m.trust, level: 'critical', description: `trust in government at crisis level (${Math.round(m.trust)}%)` })
  } else if (m.trust <= ALERT_THRESHOLDS.trust_warning) {
    alerts.push({ stat: 'trust', value: m.trust, level: 'warning', description: `government trust declining (${Math.round(m.trust)}%)` })
  }

  if (m.political_pressure >= ALERT_THRESHOLDS.pressure_critical) {
    alerts.push({ stat: 'political_pressure', value: m.political_pressure, level: 'critical', description: `civil unrest at critical level (${Math.round(m.political_pressure)}%)` })
  } else if (m.political_pressure >= ALERT_THRESHOLDS.pressure_warning) {
    alerts.push({ stat: 'political_pressure', value: m.political_pressure, level: 'warning', description: `political pressure rising (${Math.round(m.political_pressure)}%)` })
  }

  if (m.natural_resources <= ALERT_THRESHOLDS.resources_critical) {
    alerts.push({ stat: 'natural_resources', value: m.natural_resources, level: 'critical', description: `natural resources critically depleted (${Math.round(m.natural_resources)}%)` })
  } else if (m.natural_resources <= ALERT_THRESHOLDS.resources_warning) {
    alerts.push({ stat: 'natural_resources', value: m.natural_resources, level: 'warning', description: `natural resources depleting (${Math.round(m.natural_resources)}%)` })
  }

  return alerts
}

// ── Routine messages (no alerts, no AI needed) ────────────────────────────────

const ROUTINE_MESSAGES: Record<RegimeType, string[]> = {
  authoritarian: [
    'The Governing Council convened its quarterly session. All indicators were declared optimal. Dissenting statistics have been corrected.',
    'The Ministry of Information reports record public satisfaction. Citizens are reminded that unauthorized happiness surveys remain prohibited.',
    'Council Decree #4471 passed unanimously: next quarter\'s production quotas are hereby retroactively fulfilled ahead of schedule.',
    'The Council has renewed its oversight mandate. For efficiency, the opposition was not consulted — or notified.',
    'State media celebrates 100% voter participation in last night\'s unscheduled policy referendum. The motion passed.',
  ],
  libertarian: [
    'The Market Advisory Board recommends the market continue self-regulating. The Board considers its quarterly job complete.',
    'Deregulation Directive #892 passed: forms previously required to submit deregulation requests are now officially optional.',
    'This quarter\'s Council meeting was canceled. The scheduling committee deemed it "excessive government intervention."',
    'The Council reaffirms: the invisible hand is working. Citizens asking where it went are encouraged to trust the process.',
    'Wealth concentration report: the top 10% hold 71% of assets. The Council calls this "robust growth metrics."',
  ],
  welfare: [
    'The Social Welfare Committee approved version 5.2 of the Parental Leave Integration Policy Framework (Revised).',
    'The Council passed a motion to commission a comprehensive study on the efficacy of commissioning comprehensive studies.',
    'A 0.3% increase to the Community Enrichment Fund was approved. Celebration was cautiously measured.',
    'An accessibility audit of all public benches has been ordered. Results expected sometime in the next two to four quarters.',
    'The Wellness Subcommittee submitted 87 pages of recommendations. Three will be reviewed. One may be implemented.',
  ],
  feudal: [
    'The High Council reaffirmed the noble right to collect grain levies. Serfs are reminded that gratitude is an expected civic response.',
    'The Lord\'s Chamberlain announces the bi-annual land permit renewal period. Late fees apply at the Lord\'s sole discretion.',
    'The Council has graciously chosen not to raise tithes this season. Formal praise should be submitted in triplicate before month\'s end.',
    'A petition from the peasant quarter was received, reviewed by a herald, and filed appropriately.',
    'The Guild of Heralds confirms: the nobility\'s proclamation of continued authority has been duly proclaimed.',
  ],
  theocratic: [
    'The High Council of Elders completed its biweekly prayer session. All omens were declared favorable. Dissenters will pray harder.',
    'The Office of Sacred Texts has updated the civic rulebook. Revisions are divinely inspired and thus not subject to appeal.',
    'The Council confirmed that last month\'s tremor was an omen of approval, not disapproval. Theological consensus was unanimous.',
    'The annual Festival of Compliance approaches. Attendance is voluntary. The divine is observing.',
    'A citizen inquiry about secular governance was forwarded to the Department of Doctrinal Correction for appropriate counseling.',
  ],
  technocratic: [
    'The Algorithm Advisory Board completed its 15-day review cycle. All output metrics are nominal. No human intuition was required.',
    'Efficiency Council Session 847 concluded: the society is operating at 94.7% of projected optimal parameters. Cause unknown.',
    'The Data Ethics Committee has optimized the ethics review process, achieving a 12% reduction in ethics overhead.',
    'Resource Allocation Model v3.1 has been deployed. Citizens are reminded their behavioral data contributes to the model.',
    'The Innovation Index Committee reports all 17 innovation metrics trending upward. The definition of "upward" was also revised upward.',
  ],
  moderate: [
    'The Governing Council completed its quarterly review. Everything is broadly fine. Probably.',
    'A motion to rename the Council Chamber was tabled for the seventh consecutive session. No consensus was reached.',
    'The Trade Oversight Committee submitted its 34-page report on optimal cart axle width standards. Distribution is pending.',
    'Council approved installation of a new fountain in the Plaza. Construction commences once funding is finalized.',
    'The Agricultural Advisory Board recommended farmers "try harder this season." The board considers this actionable guidance.',
    'The Committee on Committee Oversight held its monthly meeting. Quorum was achieved with two members to spare.',
  ],
}

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

SCALE GUIDE: food_delta 1000 feeds ~33 citizens for 1 month. NPC deltas are additive to current stat values (clamped 0–100).
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
  const sorted = [...alerts].sort((a, b) => (a.level === 'critical' ? -1 : 1) - (b.level === 'critical' ? -1 : 1))
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

    if (alerts.length === 0) {
      // No alerts — log a witty routine message; no API key required
      const regime = detectRegime(state.constitution)
      const pool = ROUTINE_MESSAGES[regime]
      const msg = pool[Math.floor(Math.random() * pool.length)]
      addFeedRaw(`🏛 ${msg}`, 'political', state.year, state.day)
      return
    }

    const hasCritical = alerts.some(a => a.level === 'critical')
    const feedSeverity = hasCritical ? 'critical' : 'political'
    const alertSummary = alerts.map(a => `• ${a.description}`).join('\n')

    if (!config) {
      // No API key — deterministic fallback policy
      const policy = generateFallbackPolicy(state, alerts)
      applyPolicy(state, policy)
      const msg = [
        `🏛 [Government Policy] ${policy.policy_name}`,
        policy.description,
        `📢 "${policy.public_statement}"`,
        `📊 Alerts: ${alertSummary}`,
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(`🏛 Government enacted: ${policy.policy_name}`, state.year, state.day, hasCritical ? 'critical' : 'major')
      return
    }

    // AI-powered policy decision
    const prompt = [
      `GOVERNMENT REVIEW — Day ${state.day}, Year ${state.year}`,
      '',
      'ACTIVE ALERTS:',
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
      '',
      'Decide your government\'s policy response to these alerts.',
    ].join('\n')

    try {
      const raw = await callAI(config, buildGovernmentSystemPrompt(state), prompt)
      const policy = JSON.parse(extractJSON(raw)) as GovernmentPolicyAI
      applyPolicy(state, policy)
      const msg = [
        `🏛 [Government Policy] ${policy.policy_name}`,
        policy.description,
        `📢 "${policy.public_statement}"`,
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(`🏛 Government enacted: ${policy.policy_name}`, state.year, state.day, hasCritical ? 'critical' : 'major')
    } catch {
      // AI call failed — use deterministic fallback silently
      const policy = generateFallbackPolicy(state, alerts)
      applyPolicy(state, policy)
      const msg = [
        `🏛 [Government Policy] ${policy.policy_name}`,
        policy.description,
        `📢 "${policy.public_statement}"`,
      ].join('\n')
      addFeedRaw(msg, feedSeverity, state.year, state.day)
      addChronicle(`🏛 Government enacted: ${policy.policy_name}`, state.year, state.day, hasCritical ? 'critical' : 'major')
    }
  } finally {
    _governmentBusy = false
  }
}
