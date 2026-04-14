import type { WorldState, Objective } from '../types'
import type { IndividualEvent, TickEventFlags } from '../sim/npc'
import { tickNPC } from '../sim/npc'
import { checkEmergencyRoleReassignment, checkAdaptiveRoleSwitching } from '../sim/roles'
import { checkFactions } from '../sim/factions'
import { accumulateResearch, checkDiscoveries } from '../sim/tech'
import { checkNarrativeEvents, checkRumors, checkMilestones } from '../sim/narratives'
import { addChronicle } from '../ui/feed'
import { tf } from '../i18n'
import { tickEvents, spawnEvent, applyInstantEventDeaths, getEventDeathsThisDay, resetEventDeaths } from './events'
import { applyInterventions, applyConstitutionPatch, applyWorldDelta, applyInstitutionDeltas, recordFormulaBreakthrough, GOD_AGENT_FORMULA_OVERRIDE_TITLE } from './interventions'
import { computeMacroStats, computeDriftScore, checkCrisis, checkPopulationViability } from './macro'
import { checkLifecycleEvents, checkImmigration } from './lifecycle'
import {
  maintainNetworkLinks, refreshInfoTies, formOrganicStrongTies, replenishWeakTies,
  spreadSolidarity, checkLaborStrikes, computeBridgeScores,
  applyMentorshipDynamics, applyOpinionLeaderDynamics, propagateCrossZoneOrganizing,
  applyCrisisBonding, checkIdeologicalSchism, applyDirectPersuasion,
} from './network-dynamics'
import { checkSeasonTransition, checkCommunityGroups, checkOrganizingOutcome, checkTrustRecovery, checkFeudsAndReconciliation } from './social'
import {
  applyWelfare, applyStateRationing, applyFeudalTribute, applyIncomeTax, getIncomeTaxRate,
  applyExternalTradeBalance, maybePrintEmergencyMoney, applyInflationDrift,
  applyGovernmentWages, spendTaxRevenue, applyIncomeInequalityEffects, processInheritance, checkWealthMobility,
  applyPropertyTax, applyDebtRelief,
} from './economy'
import {
  checkRegimeEvents, applyTheocracyEffect, applyCommuneEffect,
  checkLegendaryNPCs, checkReferendum, checkOppositionBehavior,
} from './politics'
import { checkShadowEconomy, checkSyndicates, checkGuardPatrol } from './crime'
import { checkEpidemicIntelligence, updatePublicHealth } from './health'
import { runElection, updateRunStats } from './elections'
import { MIN_NPC_COUNT, DEFAULT_NPC_COUNT, initWorld } from './world-init'

export {
  MIN_NPC_COUNT, DEFAULT_NPC_COUNT, initWorld,
  spawnEvent, applyInstantEventDeaths,
  applyInterventions, applyConstitutionPatch, applyWorldDelta, applyInstitutionDeltas,
  recordFormulaBreakthrough, GOD_AGENT_FORMULA_OVERRIDE_TITLE,
  computeMacroStats, getIncomeTaxRate,
  updatePublicHealth, runElection, updateRunStats,
}

// ── Tick ────────────────────────────────────────────────────────────────────

function buildTickEventFlags(active: WorldState['active_events']): TickEventFlags {
  let epidemic = false
  let external_threat = false
  let blockade = false
  for (const e of active) {
    if (e.type === 'epidemic') epidemic = true
    else if (e.type === 'external_threat') external_threat = true
    else if (e.type === 'blockade') blockade = true
    if (epidemic && external_threat && blockade) break
  }
  return { epidemic, external_threat, blockade }
}

export function tick(state: WorldState): void {
  state.tick++

  // Advance time (1 tick = 1 sim-hour, 24 ticks = 1 day)
  if (state.tick % 24 === 0) {
    state.day++
    if (state.day > 360) {
      state.day = 1
      state.year++
    }
  }

  const eventFlags = buildTickEventFlags(state.active_events)

  // Tick all living NPCs, collecting individual life events
  const indivEvents: IndividualEvent[] = []
  for (const npc of state.npcs) {
    if (npc.lifecycle.is_alive) tickNPC(npc, state, indivEvents, eventFlags)
  }

  // Chronicle individual events (at most 3 per tick to avoid spam)
  let chronicled = 0
  for (const ev of indivEvents) {
    if (chronicled >= 3) break
    if (ev.type === 'accident') {
      addChronicle(tf('engine.accident', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    } else if (ev.type === 'illness') {
      addChronicle(tf('engine.fell_ill', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    } else if (ev.type === 'recovery') {
      addChronicle(tf('engine.recovered', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    } else if (ev.type === 'crime') {
      addChronicle(tf('engine.crime', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    } else if (ev.type === 'overwork') {
      addChronicle(tf('engine.overwork', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    } else if (ev.type === 'burnout') {
      addChronicle(tf('engine.burnout', { name: ev.npc.name }) as string, state.year, state.day, 'minor')
      chronicled++
    }
  }

  // Tick active events
  tickEvents(state)

  // Update macro every 24 ticks (daily)
  if (state.tick % 24 === 0) {
    state.macro = computeMacroStats(state)
    if ((state.macro.gdp ?? 0) > (state.peak_gdp ?? 0)) state.peak_gdp = state.macro.gdp
    state.drift_score = computeDriftScore(state)
    checkCrisis(state)
    checkPopulationViability(state)

    // Flush event-caused deaths to chronicle
    if (getEventDeathsThisDay() > 0) {
      addChronicle(tf('engine.event_deaths', { n: getEventDeathsThisDay() }) as string, state.year, state.day, 'major')
      resetEventDeaths()
    }
  }

  // Lifecycle events (birth/marriage/divorce/community) — check once per day
  if (state.tick % 24 === 0) {
    checkLifecycleEvents(state)
    checkCommunityGroups(state)
    checkSeasonTransition(state)
    checkOrganizingOutcome(state)
    checkTrustRecovery(state)
    applyWelfare(state)
    applyStateRationing(state)
    applyFeudalTribute(state)
    applyPropertyTax(state)
    applyIncomeTax(state)
    applyDebtRelief(state)
    applyExternalTradeBalance(state)
    maybePrintEmergencyMoney(state)
    applyGovernmentWages(state)
    spendTaxRevenue(state)
    applyInflationDrift(state)
    applyIncomeInequalityEffects(state)
    processInheritance(state)
    checkRegimeEvents(state)
    checkEmergencyRoleReassignment(state)
    checkAdaptiveRoleSwitching(state)
    applyTheocracyEffect(state)
    applyCommuneEffect(state)
    checkLegendaryNPCs(state)
    checkFactions(state)
    accumulateResearch(state)
    checkDiscoveries(state)
    checkShadowEconomy(state)
    checkSyndicates(state)
    checkReferendum(state)
    checkOppositionBehavior(state)
    checkEpidemicIntelligence(state)
    updatePublicHealth(state)
    checkNarrativeEvents(state)
    checkRumors(state)
    checkMilestones(state)
    checkImmigration(state)
    checkWealthMobility(state)
    checkGuardPatrol(state)

    // Network maintenance: prune dead links daily, organic tie formation daily
    maintainNetworkLinks(state)
    applyMentorshipDynamics(state)
    applyOpinionLeaderDynamics(state)
    applyDirectPersuasion(state)
    propagateCrossZoneOrganizing(state)
    applyCrisisBonding(state)
    formOrganicStrongTies(state)
    computeBridgeScores(state)
    checkIdeologicalSchism(state)
    checkFeudsAndReconciliation(state)

    // Info tie refresh: every 30 sim-days (720 ticks)
    if (state.day % 30 === 0) {
      refreshInfoTies(state)
    }

    // Weak tie replenishment: every 7 sim-days — recovering societies re-knit social fabric
    if (state.day % 7 === 0) {
      replenishWeakTies(state)
    }

    // Class solidarity spreads daily; strikes checked daily
    spreadSolidarity(state)
    checkLaborStrikes(state)

    // Update per-run statistics used for achievement medals
    updateRunStats(state)

    // Objectives: check progress then generate new ones if needed
    checkObjectives(state)
    generateObjectives(state)
  }
}

// ── Objectives ──────────────────────────────────────────────────────────────

export function generateObjectives(state: WorldState): void {
  if (!state.objectives) state.objectives = []
  const active = state.objectives.filter(o => !o.completed && !o.failed)
  if (active.length >= 3) return

  const m = state.macro
  const day = state.day
  const candidates: Objective[] = []

  // Food objective
  if (m.food < 60) candidates.push({
    id: `food_${day}`, type: 'sustain_above', stat: 'food', target: 50,
    duration_days: 20, progress_days: 0,
    deadline_day: day + 40,
    label: tf('obj.food.label', {}),
    reward_desc: tf('obj.food.reward', {}),
    completed: false, failed: false,
  })

  // Trust objective
  if (m.trust < 50) candidates.push({
    id: `trust_${day}`, type: 'stat_above', stat: 'trust', target: 40,
    duration_days: 0, progress_days: 0,
    deadline_day: day + 30,
    label: tf('obj.trust.label', { val: m.trust.toFixed(0) }),
    reward_desc: tf('obj.trust.reward', {}),
    completed: false, failed: false,
  })

  // Gini objective
  if (m.gini > 0.55) candidates.push({
    id: `gini_${day}`, type: 'avoid_above', stat: 'gini', target: 0.70,
    duration_days: 15, progress_days: 0,
    deadline_day: day + 20,
    label: tf('obj.gini.label', {}),
    reward_desc: tf('obj.gini.reward', {}),
    completed: false, failed: false,
  })

  // Political pressure objective
  if (m.political_pressure > 40) candidates.push({
    id: `pressure_${day}`, type: 'stat_below', stat: 'political_pressure', target: 30,
    duration_days: 0, progress_days: 0,
    deadline_day: day + 25,
    label: tf('obj.pressure.label', { val: m.political_pressure.toFixed(0) }),
    reward_desc: tf('obj.pressure.reward', {}),
    completed: false, failed: false,
  })

  // Tech objective (if few discoveries)
  const discovered = state.discoveries?.length ?? 0
  if (discovered < 3) candidates.push({
    id: `tech_${day}`, type: 'stat_above', stat: 'literacy', target: 20,
    duration_days: 0, progress_days: 0,
    deadline_day: day + 60,
    label: tf('obj.literacy.label', {}),
    reward_desc: tf('obj.literacy.reward', {}),
    completed: false, failed: false,
  })

  // Pick candidates not already active (deduplicate by stat+type)
  const activeIds = new Set(active.map(o => o.stat + o.type))
  const newOnes = candidates.filter(c => !activeIds.has(c.stat + c.type)).slice(0, 3 - active.length)
  state.objectives.push(...newOnes)
}

export function checkObjectives(state: WorldState): void {
  if (!state.objectives) return
  const m = state.macro

  for (const obj of state.objectives) {
    if (obj.completed || obj.failed) continue

    const val = m[obj.stat] as number

    // Check failure: deadline passed without completion
    if (state.day > obj.deadline_day) { obj.failed = true; continue }

    if (obj.type === 'stat_above') {
      if (val >= obj.target) { obj.completed = true; applyObjectiveReward(state, obj) }
    } else if (obj.type === 'stat_below') {
      if (val <= obj.target) { obj.completed = true; applyObjectiveReward(state, obj) }
    } else if (obj.type === 'sustain_above') {
      if (val >= obj.target) {
        obj.progress_days++
        if (obj.progress_days >= obj.duration_days) { obj.completed = true; applyObjectiveReward(state, obj) }
      } else {
        obj.progress_days = Math.max(0, obj.progress_days - 1)
      }
    } else if (obj.type === 'avoid_above') {
      if (val > obj.target) { obj.failed = true; continue }
      obj.progress_days++
      if (obj.progress_days >= obj.duration_days) { obj.completed = true; applyObjectiveReward(state, obj) }
    }
  }

  // Keep only active + recently resolved (completed/failed within last 3 days)
  state.objectives = state.objectives.filter(o =>
    !o.completed && !o.failed || (state.day - o.deadline_day < 3)
  )
}

function applyObjectiveReward(state: WorldState, obj: Objective): void {
  if (obj.stat === 'food') {
    state.tax_pool = (state.tax_pool || 0) + 150
  } else if (obj.stat === 'trust') {
    const gi = state.institutions?.find(i => i.id === 'government')
    if (gi) gi.legitimacy = Math.min(1, gi.legitimacy + 0.10)
  } else if (obj.stat === 'gini') {
    const mi = state.institutions?.find(i => i.id === 'market')
    if (mi) mi.legitimacy = Math.min(1, mi.legitimacy + 0.10)
  } else if (obj.stat === 'political_pressure') {
    state.macro.stability = Math.min(100, state.macro.stability + 5)
  } else if (obj.stat === 'literacy') {
    state.research_points = (state.research_points || 0) + 200
  }
}
