import type { WorldState, Objective } from '../types'
import type { IndividualEvent, TickEventFlags } from '../sim/npc'
import { tickNPC } from '../sim/npc'
import { checkEmergencyRoleReassignment, checkAdaptiveRoleSwitching } from '../sim/roles'
import { checkFactions, checkFactionConflict } from '../sim/factions'
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
import { tickCorruption } from '../sim/government'

export {
  MIN_NPC_COUNT, DEFAULT_NPC_COUNT, initWorld,
  spawnEvent, applyInstantEventDeaths,
  applyInterventions, applyConstitutionPatch, applyWorldDelta, applyInstitutionDeltas,
  recordFormulaBreakthrough, GOD_AGENT_FORMULA_OVERRIDE_TITLE,
  computeMacroStats, getIncomeTaxRate,
  updatePublicHealth, runElection, updateRunStats,
}

// ── Charismatic NPC Choice ───────────────────────────────────────────────────

// Track which NPC IDs have already triggered a choice event (module-level, lives for the session)
const _triggeredCharismaticNPCs = new Set<number>()

function checkCharismaticNPC(state: WorldState): void {
  // Skip if already pending a choice
  if (state.pending_charismatic_choice !== null) {
    // Auto-resolve expired choices to 'ignore'
    if (state.day >= state.pending_charismatic_choice.expires_day) {
      applyCharismaticChoice(state, 'ignore')
    }
    return
  }

  const candidate = state.npcs.find(n =>
    n.lifecycle.is_alive &&
    n.legendary &&
    n.influence_score > 0.75 &&
    !_triggeredCharismaticNPCs.has(n.id)
  )
  if (!candidate) return

  _triggeredCharismaticNPCs.add(candidate.id)
  state.pending_charismatic_choice = {
    npc_id: candidate.id,
    npc_name: candidate.name,
    npc_role: candidate.occupation,
    npc_zone: candidate.zone,
    triggered_day: state.day,
    expires_day: state.day + 5,
  }

  addChronicle(
    `A new figure rises: ${candidate.name} (${candidate.occupation}) has gained extraordinary influence in ${candidate.zone}. The people look to them for guidance.`,
    state.year, state.day, 'major'
  )
}

export function applyCharismaticChoice(state: WorldState, choice: 'champion' | 'suppress' | 'ignore'): void {
  const pending = state.pending_charismatic_choice
  if (!pending) return

  const npc = state.npcs.find(n => n.id === pending.npc_id)
  state.pending_charismatic_choice = null

  if (choice === 'champion') {
    // NPC becomes co-leader: massive influence boost, government loses some power
    if (npc) {
      npc.influence_score = Math.min(npc.influence_score + 0.2, 1)
      npc.happiness = Math.min(npc.happiness + 30, 100)
    }
    const govt = state.institutions.find(i => i.id === 'government')
    if (govt) govt.power = Math.max(govt.power - 0.1, 0)
    // Trust boost among community in the same zone
    for (const n of state.npcs) {
      if (n.lifecycle.is_alive && n.zone === pending.npc_zone) {
        n.trust_in.community.intention = Math.min(n.trust_in.community.intention + 0.05, 1)
      }
    }
    addChronicle(`${pending.npc_name} has been championed by the people. Their influence now rivals the government.`, state.year, state.day, 'major')

  } else if (choice === 'suppress') {
    if (npc) {
      npc.lifecycle.is_alive = false
      npc.lifecycle.death_cause = 'violence'
      npc.lifecycle.death_tick = state.tick
    }
    // Martyr effect: opposition surges, trust collapses
    for (const n of state.npcs) {
      if (!n.lifecycle.is_alive) continue
      n.trust_in.government.intention = Math.max(n.trust_in.government.intention - 0.08, 0)
      n.grievance = Math.min(n.grievance + 20, 100)
    }
    const opp = state.institutions.find(i => i.id === 'opposition')
    if (opp) opp.power = Math.min(opp.power + 0.2, 1)
    addChronicle(`${pending.npc_name} has been silenced by the authorities — but martyrdom may prove more powerful than the person.`, state.year, state.day, 'critical')

  } else {
    // ignore: emergent — NPC develops naturally, no intervention
    addChronicle(`The rising influence of ${pending.npc_name} was left unchecked. Their story will unfold on its own terms.`, state.year, state.day, 'minor')
  }
}

// ── Cultural Scar Detection ──────────────────────────────────────────────────

let _prevFood = 100
let _hadEpidemic = false
let _prevCollapsePhase: string = 'normal'

function checkCrisisEnd(state: WorldState): void {
  if (!state.cultural_scars) state.cultural_scars = []

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const survivors = living.length

  function clampWv(v: number): number { return Math.min(1, Math.max(0, v)) }

  function applyScarWorldview(effect: import('../types').CulturalScar['worldview_effect']): void {
    for (const npc of living) {
      if (effect.authority_trust !== undefined)
        npc.worldview.authority_trust = clampWv(npc.worldview.authority_trust + effect.authority_trust)
      if (effect.risk_tolerance !== undefined)
        npc.worldview.risk_tolerance = clampWv(npc.worldview.risk_tolerance + effect.risk_tolerance)
      if (effect.collectivism !== undefined)
        npc.worldview.collectivism = clampWv(npc.worldview.collectivism + effect.collectivism)
    }
  }

  // Detect famine end: food was < 15 last tick, now >= 25
  const curFood = state.macro.food
  if (_prevFood < 15 && curFood >= 25) {
    const severity = Math.max(0, Math.min(1, 1 - _prevFood / 15))
    const label = `The Famine of Year ${state.year}`
    const effect = { authority_trust: 0, risk_tolerance: -0.06 }
    const scar: import('../types').CulturalScar = {
      id: crypto.randomUUID(),
      type: 'famine',
      year: state.year,
      day: state.day,
      label,
      severity,
      survivors,
      worldview_effect: effect,
    }
    state.cultural_scars.push(scar)
    applyScarWorldview(effect)
    // Apply fear separately (it's a 0-100 need, not worldview)
    for (const npc of living) npc.fear = Math.min(100, npc.fear + 8)
    addChronicle(`Year ${state.year}: ${label} passes into collective memory. The survivors carry the weight of hunger for years to come.`, state.year, state.day, 'major')
  }

  // Detect epidemic end: had epidemic last tick, no longer active
  const hasEpidemic = state.active_events.some(e => e.type === 'epidemic')
  if (_hadEpidemic && !hasEpidemic) {
    const label = `The Epidemic of Year ${state.year}`
    const effect = { authority_trust: 0.04, risk_tolerance: 0 }
    const scar: import('../types').CulturalScar = {
      id: crypto.randomUUID(),
      type: 'epidemic',
      year: state.year,
      day: state.day,
      label,
      severity: 0.6,
      survivors,
      worldview_effect: effect,
    }
    state.cultural_scars.push(scar)
    applyScarWorldview(effect)
    for (const npc of living) npc.fear = Math.min(100, npc.fear + 10)
    addChronicle(`Year ${state.year}: ${label} passes into collective memory. Fear of disease lingers in every cough and crowd.`, state.year, state.day, 'major')
  }

  // Detect collapse recovery: collapse_phase was 'collapse', now 'critical'
  if (_prevCollapsePhase === 'collapse' && state.collapse_phase === 'critical') {
    const label = `The Collapse of Year ${state.year}`
    const effect = { authority_trust: -0.10, risk_tolerance: -0.08 }
    const scar: import('../types').CulturalScar = {
      id: crypto.randomUUID(),
      type: 'collapse',
      year: state.year,
      day: state.day,
      label,
      severity: 0.85,
      survivors,
      worldview_effect: effect,
    }
    state.cultural_scars.push(scar)
    applyScarWorldview(effect)
    addChronicle(`Year ${state.year}: ${label} passes into collective memory. Trust in authority lies shattered; the people remember.`, state.year, state.day, 'major')
  }

  // Update prev state for next tick
  _prevFood = curFood
  _hadEpidemic = hasEpidemic
  _prevCollapsePhase = state.collapse_phase
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
    checkCharismaticNPC(state)
    checkFactions(state)
    checkFactionConflict(state)
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
    checkCrisisEnd(state)
    checkImmigration(state)
    checkWealthMobility(state)
    checkGuardPatrol(state)
    tickCorruption(state)

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
