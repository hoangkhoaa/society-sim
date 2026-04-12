import type { WorldState, NarrativeEntry, NPC } from '../types'
import { clamp, getSeasonFactor } from '../sim/constitution'
import { computeProductivity } from '../sim/npc'
import { autoSurvivalRoleShift } from '../sim/roles'
import { getDiscoveryBonuses } from '../sim/tech'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t } from '../i18n'
import { computeStability, computePolarization, computeLaborUnrest } from '../formulas/macro'

/**
 * Multiplier for macro `energy` (daily productive output vs max productivity).
 * `computeMacroStats` runs at the daily boundary when `tick % 24 === 0`, i.e. hour 0.
 * At that moment `normalRoutine` puts almost everyone in `resting`, so using the raw
 * `action_state` snapshot would count ~0.15× productivity for the whole population and
 * collapse energy to single digits. Use a typical diurnal average for routine states;
 * keep explicit weights for unrest and fleeing.
 */
export function macroEnergyActivityWeight(npc: NPC): number {
  if (npc.role === 'child') return 0
  if (npc.action_state === 'fleeing') return 0
  if (npc.action_state === 'organizing' || npc.action_state === 'confront') return 0.30
  if (npc.action_state === 'complying') return 0.50
  // ~10 h working at 1.0 + ~14 h off-duty at 0.15 → ≈0.50 mean (varies by role/schedule)
  const dailyAvgRoutineWeight = 0.50
  return dailyAvgRoutineWeight
}

export function computeMacroStats(state: WorldState): WorldState['macro'] {
  const scarcityFactor = 1 - state.constitution.resource_scarcity * 0.5
  const seasonFactor = getSeasonFactor(state.day)
  const techBonuses = getDiscoveryBonuses(state.discoveries ?? [])
  const maxScholarRatio = Math.max(state.constitution.role_ratios.scholar, 0.01)

  let n = 0
  let farmerProd = 0
  let craftsmanProd = 0
  let scholarProd = 0
  const wealths: number[] = []
  let workforce = 0
  let activeProdSum = 0
  let politicalCount = 0
  let trustSum = 0
  let trustGovSum = 0
  let fleeingCount = 0
  let stressSum = 0
  let workerCount = 0
  let solidaritySum = 0
  let collectivismSum = 0
  let authorityTrustSum = 0
  let collectivismSqSum = 0
  let authoritySqSum = 0

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    n++
    wealths.push(npc.wealth)
    trustSum += npc.trust_in.government.intention
    trustGovSum += (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    stressSum += npc.stress
    collectivismSum += npc.worldview.collectivism
    authorityTrustSum += npc.worldview.authority_trust
    collectivismSqSum += npc.worldview.collectivism * npc.worldview.collectivism
    authoritySqSum += npc.worldview.authority_trust * npc.worldview.authority_trust

    const prod = computeProductivity(npc, state)
    if (npc.role === 'farmer') farmerProd += prod
    if (npc.role === 'craftsman') craftsmanProd += prod
    if (npc.role === 'scholar') scholarProd += prod

    if (npc.role !== 'child') {
      workforce++
      activeProdSum += prod * macroEnergyActivityWeight(npc)
    }

    if (npc.action_state === 'organizing' || npc.action_state === 'confront' || npc.action_state === 'fleeing') {
      politicalCount++
    }
    if (npc.action_state === 'fleeing') fleeingCount++

    if (npc.role !== 'leader' && npc.role !== 'guard' && npc.role !== 'child') {
      workerCount++
      solidaritySum += npc.class_solidarity
    }
  }

  if (n === 0) return state.macro

  // Food production — each farmer at average productivity feeds ~3-4 people
  // When natural resources are depleted (soil degradation, water scarcity), food yield drops
  const resourceState = clamp(state.natural_resources / 1000, 0, 100)  // 0–100%
  const soilFactor = resourceState < 30
    ? 0.4 + (resourceState / 30) * 0.6   // 0.4 at 0%, 1.0 at 30%
    : 1.0
  const dailyProduction = farmerProd * 4 * scarcityFactor * seasonFactor * techBonuses.foodMult * soilFactor
  const dailyConsumption = n * 0.8
  // Storage cap: maximum 60 days of food for the current population.
  // Surplus beyond this spoils (no cold storage for a pre-modern society).
  const storageCapacity = n * 60
  const rawStock = (state.food_stock ?? 0) + dailyProduction - dailyConsumption
  // Spoilage: food above 80% of cap decays at 3%/day to prevent permanent 100% accumulation
  const spoilageFactor = rawStock > storageCapacity * 0.8
    ? (rawStock - storageCapacity * 0.8) * 0.03
    : 0
  state.food_stock = clamp(rawStock - spoilageFactor, 0, storageCapacity)
  const food = clamp(state.food_stock / (n * 30) * 100, 0, 100)

  // Natural resources — craftsmen and farmers extract resources; natural regeneration
  // Extraction scales with productivity of producers; scarcity constitution reduces both sides
  const extractionRate = (craftsmanProd * 0.3 + farmerProd * 0.1) * scarcityFactor

  // Regen: base logistic growth (slows near cap, accelerates in mid-range)
  // Tech discovery "ecology" or low exploitation boosts regen
  const rawPool = state.natural_resources ?? 50000
  const ecoBonus = (state.discoveries ?? []).some(d => d.id === 'ecology' || d.id === 'medicine') ? 1.4 : 1.0
  // Logistic regen: fastest at 50% of max (25k/50k), slows as it approaches cap
  const regenRate = rawPool * 0.00018 * (1 - rawPool / 110000) * ecoBonus
  state.natural_resources = clamp(rawPool + regenRate - extractionRate, 0, 100000)
  const natural_resources = clamp(state.natural_resources / 1000, 0, 100)

  const maxScholarOutput = n * maxScholarRatio
  const literacy = clamp(scholarProd / maxScholarOutput * 100 + (techBonuses?.literacyBonus ?? 0), 0, 100)

  const maxPossibleProductivity = workforce * 1.0
  const literacyBonus = 1 + (Math.min(literacy + techBonuses.literacyBonus, 100) / 100) * 0.12
  const foodEnergyMod = food > 60 ? 1.0
    : food > 30 ? 0.70 + (food - 30) / 30 * 0.30
    : food > 10 ? 0.40 + (food - 10) / 20 * 0.30
    : 0.20 + (food / 10) * 0.20
  const rawEnergy = activeProdSum / Math.max(maxPossibleProductivity, 1) * 100 * literacyBonus
  const energy = clamp(rawEnergy * foodEnergyMod, 0, 100)

  wealths.sort((a, b) => a - b)
  const gini = computeGini(wealths)

  const politicalPressure = clamp(politicalCount / n * 200, 0, 100)
  const trust = trustSum / n * 100
  const avgTrustGov = trustGovSum / n
  const cohesion = 1 - fleeingCount / n
  const avgStress = stressSum / n

  const stability = computeStability(avgTrustGov, cohesion, food, avgStress, politicalPressure)

  const avgSolidarity = workerCount > 0 ? solidaritySum / workerCount : 0
  const labor_unrest = computeLaborUnrest(avgSolidarity, gini)

  // Polarization index (0–100): variance in ideology + distance from center.
  const meanCollectivism = collectivismSum / n
  const meanAuthority = authorityTrustSum / n
  const varCollectivism = Math.max(0, collectivismSqSum / n - meanCollectivism * meanCollectivism)
  const varAuthority = Math.max(0, authoritySqSum / n - meanAuthority * meanAuthority)
  const stdCollectivism = Math.sqrt(varCollectivism)
  const stdAuthority = Math.sqrt(varAuthority)
  const centerDrift = Math.abs(meanCollectivism - 0.5) + Math.abs(meanAuthority - 0.5)
  const polarization = computePolarization(stdCollectivism, stdAuthority, centerDrift)

  // GDP: sum of all living NPC daily incomes (coins earned per day).
  let gdpSum = 0
  let producerCount = 0
  let producerProdSum = 0
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.role === 'child') continue
    gdpSum += npc.daily_income
    if (npc.role === 'farmer' || npc.role === 'craftsman') {
      producerCount++
      producerProdSum += computeProductivity(npc, state)
    }
  }
  const gdp = gdpSum

  // Extraction rate (0–100): how efficiently producers are extracting/processing resources
  // relative to their theoretical maximum output (producer count × 1.0 max productivity × 0.13 avg rate).
  const maxExtraction = Math.max(producerCount * 0.13, 0.01)
  const actualExtraction = producerProdSum * 0.13
  const extraction_rate = clamp(actualExtraction / maxExtraction * 100, 0, 100)

  // Economic efficiency (0–100): ratio of actual GDP to potential GDP
  // (all working-age NPCs at full productivity).
  const potentialGDP = workforce * 0.12 * 24   // full productivity × avg income rate × day
  const economic_efficiency = clamp(gdp / Math.max(potentialGDP, 1) * 100, 0, 100)

  return {
    food,
    gini,
    political_pressure: politicalPressure,
    trust,
    stability,
    natural_resources,
    energy,
    literacy,
    labor_unrest,
    polarization,
    gdp,
    extraction_rate,
    economic_efficiency,
  }
}

function computeGini(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const total = sorted.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  // O(n) formula for sorted array: gini = (2*sum((i+1)*x[i]) - (n+1)*total) / (n*total)
  let weightedSum = 0
  for (let i = 0; i < n; i++) weightedSum += (i + 1) * sorted[i]
  return (2 * weightedSum - (n + 1) * total) / (n * total)
}

// ── Constitutional Crisis ────────────────────────────────────────────────────

export function computeDriftScore(state: WorldState): number {
  const C = state.constitution
  const m = state.macro

  // Gini drift: allow ±0.15 natural fluctuation before counting
  const giniDrift = Math.max(0, Math.abs(m.gini - C.gini_start) - 0.15) * 1.2

  // Trust drift: only care when trust DROPS significantly below founding level
  const trustDrift = Math.max(0, (C.base_trust * 100 - m.trust) / 100 - 0.10) * 1.0

  // Acute political indicators
  const pressureBonus = m.political_pressure > 70 ? 0.15 : 0
  const instabilityBonus = m.stability < 25 ? 0.15 : 0

  return giniDrift + trustDrift + pressureBonus + instabilityBonus
}

let driftDaysHigh = 0

export function checkCrisis(state: WorldState): void {
  if (state.drift_score > 0.55) {
    driftDaysHigh++
    if (driftDaysHigh >= 90 && !state.crisis_pending) {
      state.crisis_pending = true
      emitCrisisEvent(state)
    }
  } else {
    driftDaysHigh = Math.max(0, driftDaysHigh - 2)
  }
}

function emitCrisisEvent(state: WorldState): void {
  const text = t('engine.crisis') as string
  const entry: NarrativeEntry = {
    id: crypto.randomUUID(),
    tick: state.tick,
    day: state.day,
    year: state.year,
    text,
    icon: '⚡',
    severity: 'critical',
    related_npc_ids: [],
    related_zones: [],
  }
  state.narrative_log.unshift(entry)
  addFeedRaw(text, 'critical', state.year, state.day)
}

// ── Population Viability & Societal Collapse ─────────────────────────────────
//
// Thresholds scale with initial_population (proportional, not absolute):
//   collapse  < 3%  — society cannot sustain itself; trigger end-game
//   critical  < 6%  — government dissolves; survival role-shifts begin
//   survival  < 12% — partial role-shift (scholars/merchants → farmers if food scarce)
//   normal   >= 12% — everything operates normally
// Minimum floors (15 / 30 / 60) prevent degenerate edge cases in tiny games.

let lastCollapseWarnDay = -1

export function checkPopulationViability(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive).length
  const initPop = state.initial_population ?? 500
  const collapseThreshold = Math.max(15, Math.round(initPop * 0.03))
  const criticalThreshold = Math.max(30, Math.round(initPop * 0.06))
  const survivalThreshold = Math.max(60, Math.round(initPop * 0.12))

  if (living < collapseThreshold) {
    if (state.collapse_phase !== 'collapse') {
      state.collapse_phase = 'collapse'
      const text = t('engine.societal_collapse') as string
      state.narrative_log.unshift({
        id: crypto.randomUUID(),
        tick: state.tick,
        day: state.day,
        year: state.year,
        text,
        icon: '💀',
        severity: 'critical',
        related_npc_ids: [],
        related_zones: [],
      })
      addFeedRaw(text, 'critical', state.year, state.day)
    }
    return
  }

  if (living < criticalThreshold) {
    if (state.collapse_phase === 'normal') {
      // Government dissolves — emit once
      const govText = t('engine.collapse_govfail') as string
      addFeedRaw(govText, 'critical', state.year, state.day)
      addChronicle(govText, state.year, state.day, 'critical')
    }
    state.collapse_phase = 'critical'
    autoSurvivalRoleShift(state, living)
    return
  }

  if (living < survivalThreshold) {
    state.collapse_phase = living < criticalThreshold ? 'critical' : 'normal'
    autoSurvivalRoleShift(state, living)

    // Emit a warning periodically (not more than once per 5 days)
    if (state.day !== lastCollapseWarnDay && state.day % 5 === 0) {
      lastCollapseWarnDay = state.day
      addFeedRaw(t('engine.collapse_warning') as string, 'critical', state.year, state.day)
    }
    return
  }

  // Population recovered — restore normal phase
  state.collapse_phase = 'normal'
}

// autoSurvivalRoleShift and its throttle state have moved to roles.ts
