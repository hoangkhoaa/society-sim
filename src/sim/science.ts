// ── Science Discovery AI Agent ────────────────────────────────────────────
//
// Runs rarely (~every 45–90 sim-days, probability-gated). Observes societal
// conditions and generates scientific breakthroughs that permanently alter
// the simulation: constitution patches, NPC stat shifts, food bonuses, etc.
//
// Two modes:
//   1. AI mode  (config != null): calls LLM for contextual, social-inspired discoveries
//   2. Template mode (fallback):  picks from SCIENCE_TEMPLATES matched to conditions

import type { WorldState, AIConfig } from '../types'
import { callAI } from '../ai/provider'
import { getLang } from '../i18n'
import { addFeedRaw, addChronicle, addBreakthroughToLog } from '../ui/feed'
import { clamp } from './constitution'
import {
  scienceSystemPrompt,
  scienceSnapshotPrompt,
  SCIENCE_TEMPLATES,
  resolveScienceTemplate,
  type ScienceScan,
  type ScienceDiscovery,
} from '../local/science'
import { recordFormulaBreakthrough } from '../engine/interventions'

// Runtime state ──────────────────────────────────────────────────────────────

let _lastScienceDay     = -999   // sim-day of last fired discovery
let _lastCheckedPeriod  = -1     // period index of last random check (avoids rechecking same period)
let _scienceBusy        = false

/** Minimum sim-days between consecutive science cycle checks. */
const SCIENCE_CYCLE_MIN_DAYS = 45

/** Base random probability that a cycle check fires a discovery (before bonuses). */
const SCIENCE_BASE_PROBABILITY = 0.30

export function resetScienceRuntimeState(): void {
  _lastScienceDay    = -999
  _lastCheckedPeriod = -1
  _scienceBusy       = false
}

// ── Society scan ──────────────────────────────────────────────────────────

function scanSocietyForScience(state: WorldState): ScienceScan {
  const living     = state.npcs.filter(n => n.lifecycle.is_alive)
  const n          = living.length || 1
  const m          = state.macro
  const scholars   = living.filter(npc => npc.role === 'scholar')
  const healthcare = living.filter(npc => npc.role === 'healthcare')

  return {
    population:           living.length,
    literacy:             m.literacy,
    stability:            m.stability,
    food:                 m.food,
    gini:                 m.gini,
    trust:                m.trust,
    avgHappiness:         living.reduce((s, x) => s + x.happiness, 0) / n,
    avgStress:            living.reduce((s, x) => s + x.stress,    0) / n,
    avgGrievance:         living.reduce((s, x) => s + x.grievance, 0) / n,
    scholarPct:           scholars.length / n * 100,
    scholarAvgHappiness:  scholars.length ? scholars.reduce((s, x) => s + x.happiness, 0) / scholars.length : 50,
    sickPct:              living.filter(npc => npc.sick).length / n * 100,
    epidemicActive:       state.active_events.some(e => e.type === 'epidemic'),
    droughtActive:        state.active_events.some(e => e.type === 'drought'),
    foodCrisisRecent:     m.food < 30,
    highInequality:       m.gini > 0.55,
    organizingPct:        living.filter(npc => npc.action_state === 'organizing').length / n * 100,
    researchPoints:       state.research_points,
    discoveriesCount:     state.discoveries.length,
    healthcarePresence:   healthcare.length > 0,
  }
}

// ── Probability gating ────────────────────────────────────────────────────

function shouldFireDiscovery(state: WorldState, scan: ScienceScan): boolean {
  if (state.day - _lastScienceDay < SCIENCE_CYCLE_MIN_DAYS) return false

  let prob = SCIENCE_BASE_PROBABILITY
  // Favorable intellectual conditions
  if (scan.literacy > 60)              prob += 0.15
  if (scan.scholarPct > 8)             prob += 0.10
  if (scan.scholarAvgHappiness > 60)   prob += 0.08
  // Social crises drive applied innovation
  if (scan.epidemicActive)             prob += 0.20
  if (scan.droughtActive)              prob += 0.15
  if (scan.foodCrisisRecent)           prob += 0.10
  if (scan.avgGrievance > 60)          prob += 0.08
  // Diminishing returns: many past discoveries slow new ones (knowledge consolidation lag)
  prob -= scan.discoveriesCount * 0.04

  return Math.random() < clamp(prob, 0.05, 0.80)
}

// ── AI discovery generation ────────────────────────────────────────────────

async function generateAIDiscovery(
  state: WorldState,
  scan: ScienceScan,
  config: AIConfig,
): Promise<ScienceDiscovery | null> {
  const lang = getLang()
  const raw  = await callAI(config, scienceSystemPrompt(lang), scienceSnapshotPrompt(state, scan, lang))
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as ScienceDiscovery
  } catch {
    return null
  }
}

// ── Apply discovery effects ────────────────────────────────────────────────

function applyDiscoveryEffects(state: WorldState, discovery: ScienceDiscovery): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // Permanent constitution changes
  if (discovery.constitution_patch) {
    const p = discovery.constitution_patch
    if (p.safety_net             != null) state.constitution.safety_net             = clamp(state.constitution.safety_net             + p.safety_net,             0, 1)
    if (p.market_freedom         != null) state.constitution.market_freedom         = clamp(state.constitution.market_freedom         + p.market_freedom,         0, 1)
    if (p.network_cohesion       != null) state.constitution.network_cohesion       = clamp(state.constitution.network_cohesion       + p.network_cohesion,       0, 1)
    if (p.base_trust             != null) state.constitution.base_trust             = clamp(state.constitution.base_trust             + p.base_trust,             0, 1)
    if (p.individual_rights_floor != null) state.constitution.individual_rights_floor = clamp(state.constitution.individual_rights_floor + p.individual_rights_floor, 0, 1)
  }

  // NPC stat effects
  if (discovery.npc_happiness_delta != null) {
    const delta = discovery.npc_happiness_delta
    for (const npc of living) npc.happiness = clamp(npc.happiness + delta, 0, 100)
  }
  if (discovery.npc_stress_delta != null) {
    const delta = discovery.npc_stress_delta
    for (const npc of living) npc.stress = clamp(npc.stress + delta, 0, 100)
  }
  if (discovery.npc_grievance_delta != null) {
    const delta = discovery.npc_grievance_delta
    for (const npc of living) npc.grievance = clamp(npc.grievance + delta, 0, 100)
  }
  if (discovery.scholar_happiness_delta != null) {
    const delta = discovery.scholar_happiness_delta
    for (const npc of living.filter(npc => npc.role === 'scholar')) {
      npc.happiness = clamp(npc.happiness + delta, 0, 100)
    }
  }

  // Food stock one-time bonus
  if (discovery.food_stock_delta != null) {
    state.food_stock = Math.max(0, state.food_stock + discovery.food_stock_delta)
  }

  // Permanent formula expression patches — paradigm-shifting breakthroughs
  if (discovery.formula_patch?.length) {
    const record = recordFormulaBreakthrough(
      state,
      discovery.formula_patch,
      'science_discovery',
      discovery.name,
      discovery.description,
    )
    if (record) addBreakthroughToLog(record)
  }

  // Register discovery in the discoveries log
  state.discoveries.push({
    id:               `science_${state.tick}_${discovery.field}`,
    name:             discovery.name,
    discovered_tick:  state.tick,
    researcher_name:  discovery.discoverer_name ?? 'an unknown thinker',
  })

  // Mark the top scholar as legendary
  const topScholar = living
    .filter(npc => npc.role === 'scholar')
    .sort((a, b) => b.influence_score - a.influence_score)[0]
  if (topScholar && !topScholar.legendary) topScholar.legendary = true
}

// ── Main cycle ────────────────────────────────────────────────────────────

async function runScienceCycle(
  state: WorldState,
  config: AIConfig | null,
  scan: ScienceScan,
): Promise<void> {
  const lang = getLang()
  let discovery: ScienceDiscovery | null = null

  if (config) {
    try {
      discovery = await generateAIDiscovery(state, scan, config)
    } catch {
      // AI failed — fall through to template
    }
  }

  if (!discovery) {
    discovery = resolveScienceTemplate(scan, lang)
  }

  if (!discovery) return

  applyDiscoveryEffects(state, discovery)

  const discoverer = discovery.discoverer_name ?? 'an unknown thinker'
  const text = `🔬 ${discovery.name} — ${discovery.description} (by ${discoverer})`
  addChronicle(text, state.year, state.day, 'critical')
  addFeedRaw(text, 'critical', state.year, state.day)
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Should be called from the sim loop.  Probabilistically fires a science
 * discovery cycle when conditions are ripe.  Returns true if a cycle was
 * started this tick.
 */
export function checkScienceTrigger(state: WorldState, config: AIConfig | null): boolean {
  if (_scienceBusy) return false
  if (state.collapse_phase !== 'normal') return false
  const livingCount = state.npcs.filter(n => n.lifecycle.is_alive).length
  if (livingCount < 20) return false
  if (state.day < 30) return false

  // Only run the probability check once per sim-day (not every tick)
  if (state.day === _lastCheckedPeriod) return false
  _lastCheckedPeriod = state.day

  const scan = scanSocietyForScience(state)
  if (!shouldFireDiscovery(state, scan)) return false

  _lastScienceDay = state.day
  _scienceBusy    = true
  void runScienceCycle(state, config, scan).finally(() => { _scienceBusy = false })
  return true
}

/** Used by SCIENCE_TEMPLATES — exported for tests / external access. */
export { SCIENCE_TEMPLATES }
