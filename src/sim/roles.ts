// ── Role Management ────────────────────────────────────────────────────────
// Single source of truth for all runtime role transitions in adults:
//
//   1. autoSurvivalRoleShift  — last-resort when population is near extinction
//   2. checkEmergencyRoleReassignment — proactive crisis response:
//        • Food crisis  (food < 15% for 3 days) → merchants/scholars become farmers
//        • Security crisis (guards < 5% + external threat) → craftsmen become guards
//        • Crisis resolved → NPCs revert to original roles (or make new role permanent)
//
// Child → Adult transitions live in npc.ts (transitionToAdultCareer) because
// they depend on private NPC creation helpers.

import type { WorldState, Role } from '../types'
import { clamp } from './constitution'
import { switchNPCRole, revertNPCRole, permanentRoleChange } from './npc'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { tf, t } from '../i18n'
import {
  ROLE_CRISIS_FOOD_THRESHOLD,
  ROLE_RECOVERY_FOOD_THRESHOLD,
  ROLE_GUARD_SHORTAGE_FRACTION,
  ROLE_CRISIS_PERSIST_DAYS,
  ROLE_RECOVERY_PERSIST_DAYS,
  ROLE_EMERGENCY_PERMANENT_DAYS,
  ROLE_MAX_SHIFT_FRACTION,
} from '../constants/role-crisis-thresholds'
import {
  ROLE_ADAPTIVE_MAX_SHIFT_FRACTION,
  ROLE_ADAPTIVE_MIN_DAILY_GAIN,
  ROLE_ADAPTIVE_SWITCH_THRESHOLD,
  ROLE_ADAPTIVE_COOLDOWN_DAYS,
  ROLE_ADAPTIVE_RETRAIN_DAYS,
  ROLE_ADAPTIVE_SWITCH_INCOME_FACTOR,
} from '../constants/role-adaptive-switch'

// ── Module-level state (hysteresis / throttling) ───────────────────────────
// These are deliberately module-scoped rather than WorldState fields:
// they are transient counters, not part of the save-worthy game state.

let foodCrisisDays     = 0
let foodRecoveryDays   = 0
let securityCrisisDays = 0
let lastEmergencyDay   = -1
let lastReversionDay   = -1
let lastSurvivalDay    = -1   // throttle for autoSurvivalRoleShift

const ADAPTIVE_SWITCH_ROLES = ['farmer', 'craftsman', 'merchant', 'scholar', 'healthcare'] as const
type AdaptiveSwitchRole = (typeof ADAPTIVE_SWITCH_ROLES)[number]

const ADAPTIVE_ROLE_MIN_FRACTION: Record<AdaptiveSwitchRole, number> = {
  farmer: 0.12,
  craftsman: 0.08,
  merchant: 0.06,
  scholar: 0.05,
  healthcare: 0.04,
}

function isAdaptiveRole(role: Role): role is AdaptiveSwitchRole {
  return (ADAPTIVE_SWITCH_ROLES as readonly string[]).includes(role)
}

function roleFit(npc: WorldState['npcs'][number], role: AdaptiveSwitchRole): number {
  const wv = npc.worldview
  switch (role) {
    case 'farmer':
      return clamp(wv.collectivism * 0.60 + wv.time_preference * 0.20 + (1 - wv.risk_tolerance) * 0.20, 0, 1)
    case 'craftsman':
      return clamp(wv.time_preference * 0.45 + (1 - wv.risk_tolerance) * 0.30 + wv.collectivism * 0.25, 0, 1)
    case 'merchant':
      return clamp(wv.risk_tolerance * 0.60 + (1 - wv.collectivism) * 0.40, 0, 1)
    case 'scholar':
      return clamp(wv.time_preference * 0.60 + (1 - wv.risk_tolerance) * 0.30 + wv.collectivism * 0.10, 0, 1)
    case 'healthcare':
      return clamp(wv.collectivism * 0.55 + (1 - wv.risk_tolerance) * 0.25 + wv.authority_trust * 0.20, 0, 1)
  }
}

function computeRoleOpportunity(state: WorldState, roleAvgIncome: Record<AdaptiveSwitchRole, number>): Record<AdaptiveSwitchRole, number> {
  const foodScarcity = clamp((45 - state.macro.food) / 45, 0, 1)
  const foodSurplus = clamp((state.macro.food - 55) / 45, 0, 1)
  const resourceAbundance = clamp((state.macro.natural_resources - 30) / 70, 0, 1)
  const resourceStress = clamp((35 - state.macro.natural_resources) / 35, 0, 1)
  const literacyGap = clamp((60 - state.macro.literacy) / 60, 0, 1)
  const stabilityStress = clamp((45 - state.macro.stability) / 45, 0, 1)
  const marketOpen = clamp(state.constitution.market_freedom, 0, 1)
  const epidemic = state.active_events.some(e => e.type === 'epidemic') ? 1 : 0

  const maxIncome = Math.max(
    roleAvgIncome.farmer,
    roleAvgIncome.craftsman,
    roleAvgIncome.merchant,
    roleAvgIncome.scholar,
    roleAvgIncome.healthcare,
    0.1,
  )

  const incomeNorm = (r: AdaptiveSwitchRole) => clamp(roleAvgIncome[r] / maxIncome, 0, 1)

  return {
    farmer: 0.30 + foodScarcity * 1.35 + resourceAbundance * 0.15 + incomeNorm('farmer') * 0.35,
    craftsman: 0.25 + resourceAbundance * 0.55 + marketOpen * 0.30 + incomeNorm('craftsman') * 0.40 - resourceStress * 0.25,
    merchant: 0.22 + marketOpen * 0.95 + foodSurplus * 0.18 + incomeNorm('merchant') * 0.45,
    scholar: 0.20 + literacyGap * 0.65 + clamp(state.macro.stability / 100, 0, 1) * 0.15 + incomeNorm('scholar') * 0.30,
    healthcare: 0.24 + epidemic * 0.80 + stabilityStress * 0.25 + incomeNorm('healthcare') * 0.25,
  }
}

/**
 * Daily adaptive labor pass:
 * workers may voluntarily move toward higher-opportunity sectors before hard emergency drafts kick in.
 */
export function checkAdaptiveRoleSwitching(state: WorldState): void {
  const living = state.npcs.filter(
    (n): n is (WorldState['npcs'][number] & { role: AdaptiveSwitchRole }) => n.lifecycle.is_alive && isAdaptiveRole(n.role),
  )
  if (living.length < 20) return

  const roleBuckets: Record<AdaptiveSwitchRole, WorldState['npcs']> = {
    farmer: [],
    craftsman: [],
    merchant: [],
    scholar: [],
    healthcare: [],
  }
  for (const npc of living) roleBuckets[npc.role].push(npc)

  const roleCounts: Record<AdaptiveSwitchRole, number> = {
    farmer: roleBuckets.farmer.length,
    craftsman: roleBuckets.craftsman.length,
    merchant: roleBuckets.merchant.length,
    scholar: roleBuckets.scholar.length,
    healthcare: roleBuckets.healthcare.length,
  }

  const roleAvgIncome: Record<AdaptiveSwitchRole, number> = {
    farmer: roleBuckets.farmer.reduce((s, n) => s + n.daily_income, 0) / Math.max(roleBuckets.farmer.length, 1),
    craftsman: roleBuckets.craftsman.reduce((s, n) => s + n.daily_income, 0) / Math.max(roleBuckets.craftsman.length, 1),
    merchant: roleBuckets.merchant.reduce((s, n) => s + n.daily_income, 0) / Math.max(roleBuckets.merchant.length, 1),
    scholar: roleBuckets.scholar.reduce((s, n) => s + n.daily_income, 0) / Math.max(roleBuckets.scholar.length, 1),
    healthcare: roleBuckets.healthcare.reduce((s, n) => s + n.daily_income, 0) / Math.max(roleBuckets.healthcare.length, 1),
  }

  const roleOpportunity = computeRoleOpportunity(state, roleAvgIncome)
  const cooldownTicks = ROLE_ADAPTIVE_COOLDOWN_DAYS * 24
  const severeFoodStress = state.macro.food < 30

  const candidates: Array<{
    npc: WorldState['npcs'][number]
    from: AdaptiveSwitchRole
    to: AdaptiveSwitchRole
    pressure: number
    expectedGain: number
  }> = []

  for (const npc of living) {
    if (!isAdaptiveRole(npc.role)) continue
    if (npc.on_strike) continue
    if (npc.original_role !== undefined) continue  // don't compete with emergency reassignment

    const sinceLast = state.tick - (npc.last_role_switch_tick ?? -999999)
    if (sinceLast < cooldownTicks) continue

    const currentRole = npc.role
    const minCurrentFloor = Math.ceil(living.length * ADAPTIVE_ROLE_MIN_FRACTION[currentRole])
    if (roleCounts[currentRole] <= minCurrentFloor) continue

    const currentIncome = Math.max(roleAvgIncome[currentRole], 0.1)
    const personalIncomeStress = clamp((currentIncome - npc.daily_income) / currentIncome, 0, 1)
    const scarcityPush = currentRole !== 'farmer' ? clamp((35 - state.macro.food) / 35, 0, 1) : 0

    let bestTarget: AdaptiveSwitchRole | null = null
    let bestPressure = -Infinity
    let bestGain = 0

    for (const target of ADAPTIVE_SWITCH_ROLES) {
      if (target === currentRole) continue
      if (roleCounts[target] / living.length > 0.55) continue

      const expectedGain = roleAvgIncome[target] - roleAvgIncome[currentRole]
      const gainRatio = clamp(expectedGain / currentIncome, -1, 1)
      const opportunityDelta = roleOpportunity[target] - roleOpportunity[currentRole]
      const fitDelta = roleFit(npc, target) - roleFit(npc, currentRole)

      const pressure =
        opportunityDelta * 0.55
        + gainRatio * 0.25
        + personalIncomeStress * 0.20
        + scarcityPush * 0.18
        + fitDelta * 0.12
        - 0.25

      if (pressure > bestPressure) {
        bestPressure = pressure
        bestTarget = target
        bestGain = expectedGain
      }
    }

    if (!bestTarget) continue

    const canSwitchForGain = bestGain >= ROLE_ADAPTIVE_MIN_DAILY_GAIN
    const famineException = severeFoodStress && bestTarget === 'farmer' && bestPressure >= ROLE_ADAPTIVE_SWITCH_THRESHOLD - 0.08
    if ((bestPressure >= ROLE_ADAPTIVE_SWITCH_THRESHOLD && canSwitchForGain) || famineException) {
      candidates.push({
        npc,
        from: currentRole,
        to: bestTarget,
        pressure: bestPressure,
        expectedGain: bestGain,
      })
    }
  }

  if (candidates.length === 0) return

  candidates.sort((a, b) => b.pressure - a.pressure || b.expectedGain - a.expectedGain)

  const maxShift = Math.max(1, Math.ceil(living.length * ROLE_ADAPTIVE_MAX_SHIFT_FRACTION))
  const switchedByRole: Partial<Record<AdaptiveSwitchRole, number>> = {}
  let switched = 0

  for (const c of candidates) {
    if (switched >= maxShift) break

    const minFromFloor = Math.ceil(living.length * ADAPTIVE_ROLE_MIN_FRACTION[c.from])
    if (roleCounts[c.from] <= minFromFloor) continue

    permanentRoleChange(c.npc, c.to, state)
    c.npc.last_role_switch_tick = state.tick
    c.npc.role_retraining_until_tick = state.tick + ROLE_ADAPTIVE_RETRAIN_DAYS * 24
    c.npc.daily_income *= ROLE_ADAPTIVE_SWITCH_INCOME_FACTOR
    c.npc.grievance = clamp(c.npc.grievance - 3, 0, 100)

    roleCounts[c.from]--
    roleCounts[c.to]++
    switchedByRole[c.to] = (switchedByRole[c.to] ?? 0) + 1
    switched++
  }

  if (switched > 0) {
    const summary = (Object.entries(switchedByRole) as Array<[AdaptiveSwitchRole, number]>)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => `${count} ${t(`role.${role}`) as string}`)
      .join(', ')

    const text = tf('engine.adaptive_role_shift', { n: switched, summary }) as string
    addFeedRaw(text, 'info', state.year, state.day)
    addChronicle(text, state.year, state.day, 'minor')
  }
}

// ── Food crisis: reassign non-farmers to farming ───────────────────────────

function reassignToFarming(state: WorldState): void {
  const living  = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  const farmers = living.filter(n => n.role === 'farmer')
  if (farmers.length / Math.max(living.length, 1) >= 0.45) return  // already enough farmers

  const isMandatory = state.constitution.state_power > 0.60

  // Candidates: merchants first (most substitutable in famine), then scholars.
  // Sort by willingness: high collectivism + high hunger → most willing to switch.
  const candidates = living
    .filter(n => (n.role === 'merchant' || n.role === 'scholar') && !n.on_strike)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'merchant' ? -1 : 1
      const wA = a.worldview.collectivism * 0.5 + (a.hunger / 100) * 0.5
      const wB = b.worldview.collectivism * 0.5 + (b.hunger / 100) * 0.5
      return wB - wA
    })

  if (candidates.length === 0) return

  const maxShift = Math.ceil(candidates.length * ROLE_MAX_SHIFT_FRACTION)
  let shifted    = 0

  for (const npc of candidates) {
    if (shifted >= maxShift) break
    const ratioNow = (farmers.length + shifted) / Math.max(living.length, 1)
    if (ratioNow >= 0.45) break

    if (!isMandatory) {
      // Voluntary: NPC must be hungry, scared, or collectivist enough to sacrifice career
      const willingness = npc.worldview.collectivism * 0.4 + (npc.hunger / 100) * 0.4 + (npc.fear / 100) * 0.2
      if (willingness < 0.35) continue
    }

    switchNPCRole(npc, 'farmer', state)
    npc.grievance = clamp(
      npc.grievance + (isMandatory ? 12 : -5),
      0, 100,
    )
    if (!isMandatory) {
      // Voluntary sacrifice → slight solidarity boost
      npc.class_solidarity = clamp(npc.class_solidarity + 8, 0, 100)
    }
    shifted++
  }

  if (shifted > 0) {
    const mode = isMandatory ? 'mandatory' : 'voluntary'
    const text = tf('engine.emergency_farming', { n: shifted, mode }) as string
    addFeedRaw(text, 'warning', state.year, state.day)
    addChronicle(text, state.year, state.day, 'major')
  }
}

// ── Security crisis: conscript civilians into guard duty ───────────────────

function conscriptToGuard(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  const guards = living.filter(n => n.role === 'guard')
  if (guards.length / Math.max(living.length, 1) >= ROLE_GUARD_SHORTAGE_FRACTION) return

  const isMandatory = state.constitution.state_power > 0.60

  // Craftsmen preferred (physical work, less food-critical than farmers).
  // Sort by willingness: high authority_trust + high fear → most willing to serve.
  const candidates = living
    .filter(n => (n.role === 'craftsman' || n.role === 'farmer') && !n.on_strike)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'craftsman' ? -1 : 1
      const wA = a.worldview.authority_trust * 0.6 + (a.fear / 100) * 0.4
      const wB = b.worldview.authority_trust * 0.6 + (b.fear / 100) * 0.4
      return wB - wA
    })

  if (candidates.length === 0) return

  const needed   = Math.ceil(living.length * ROLE_GUARD_SHORTAGE_FRACTION) - guards.length
  const maxShift = Math.min(needed + 2, Math.ceil(candidates.length * ROLE_MAX_SHIFT_FRACTION))
  let conscripted = 0

  for (const npc of candidates) {
    if (conscripted >= maxShift) break

    if (!isMandatory) {
      const willingness = npc.worldview.authority_trust * 0.5 + (npc.fear / 100) * 0.5
      if (willingness < 0.45) continue
    }

    switchNPCRole(npc, 'guard', state)
    npc.grievance = clamp(npc.grievance + (isMandatory ? 18 : 5), 0, 100)
    npc.fear      = clamp(npc.fear      + (isMandatory ?  8 : 3), 0, 100)
    conscripted++
  }

  if (conscripted > 0) {
    const mode = isMandatory ? 'mandatory' : 'voluntary'
    const text = tf('engine.emergency_conscription', { n: conscripted, mode }) as string
    addFeedRaw(text, 'warning', state.year, state.day)
    addChronicle(text, state.year, state.day, 'major')
  }
}

// ── Crisis resolution: revert or permanently adopt new roles ───────────────

function revertEmergencyRoles(state: WorldState): void {
  const inEmergency = state.npcs.filter(n => n.lifecycle.is_alive && n.original_role !== undefined)
  if (inEmergency.length === 0) return

  let reverted      = 0
  let madePermanent = 0

  const hasExternalThreat = state.active_events.some(e => e.type === 'external_threat')

  for (const npc of inEmergency) {
    const daysInEmergencyRole = (state.tick - (npc.emergency_role_tick ?? state.tick)) / 24

    // After ROLE_EMERGENCY_PERMANENT_DAYS: the NPC has rebuilt their life in the new role
    if (daysInEmergencyRole >= ROLE_EMERGENCY_PERMANENT_DAYS) {
      npc.original_role        = undefined
      npc.emergency_role_tick  = undefined
      madePermanent++
      continue
    }

    const orig = npc.original_role!
    // Determine if the specific crisis that triggered this NPC's switch has resolved
    const crisisResolved =
      ((orig === 'merchant' || orig === 'scholar') && foodRecoveryDays >= ROLE_RECOVERY_PERSIST_DAYS)
      || ((orig === 'craftsman' || orig === 'farmer') && !hasExternalThreat)

    if (!crisisResolved) continue

    revertNPCRole(npc, state)
    reverted++
  }

  if (reverted > 0) {
    const text = tf('engine.emergency_role_revert', { n: reverted }) as string
    addFeedRaw(text, 'info', state.year, state.day)
  }
  if (madePermanent > 0) {
    const text = tf('engine.emergency_role_permanent', { n: madePermanent }) as string
    addFeedRaw(text, 'info', state.year, state.day)
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Called once per sim-day from the engine tick.
 * Updates hysteresis counters and triggers reassignment / reversion as needed.
 */
export function checkEmergencyRoleReassignment(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 10) return  // too few people for role management to matter

  const food             = state.macro.food
  const hasExternalThreat = state.active_events.some(e => e.type === 'external_threat')
  const guardRatio       = living.filter(n => n.role === 'guard').length / living.length

  // ── Update hysteresis counters ──────────────────────────────────────────
  if (food < ROLE_CRISIS_FOOD_THRESHOLD) {
    foodCrisisDays++
    foodRecoveryDays = 0
  } else if (food >= ROLE_RECOVERY_FOOD_THRESHOLD) {
    foodRecoveryDays++
    foodCrisisDays = 0
  } else {
    // In the middle band: no progress either way
    foodRecoveryDays = 0
  }

  if (hasExternalThreat && guardRatio < ROLE_GUARD_SHORTAGE_FRACTION) {
    securityCrisisDays++
  } else {
    securityCrisisDays = 0
  }

  // ── Crisis response (once per day, after hysteresis period) ────────────
  if (state.day !== lastEmergencyDay) {
    if (foodCrisisDays >= ROLE_CRISIS_PERSIST_DAYS) {
      reassignToFarming(state)
      lastEmergencyDay = state.day
    }
    if (securityCrisisDays >= ROLE_CRISIS_PERSIST_DAYS) {
      conscriptToGuard(state)
      lastEmergencyDay = state.day
    }
  }

  // ── Crisis resolution (once per day) ────────────────────────────────────
  if (state.day !== lastReversionDay) {
    const foodOk    = foodRecoveryDays >= ROLE_RECOVERY_PERSIST_DAYS
    const threatOver = !hasExternalThreat
    if (foodOk || threatOver) {
      revertEmergencyRoles(state)
      lastReversionDay = state.day
    }
  }
}

// ── autoSurvivalRoleShift ─────────────────────────────────────────────────
// Last-resort: when population is critically low, abandon non-essential roles
// and focus on farming. Called from checkPopulationViability in engine/macro.

export function autoSurvivalRoleShift(state: WorldState, livingCount: number): void {
  if (state.day === lastSurvivalDay) return

  const living  = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  const farmers = living.filter(n => n.role === 'farmer')
  const food    = state.macro.food

  if (food >= 40 && livingCount >= 30) return  // not dire enough

  const nonEssential: Role[] = livingCount < 30
    ? ['scholar', 'merchant', 'guard', 'leader']
    : ['scholar', 'merchant']

  const candidates = living.filter(n => (nonEssential as string[]).includes(n.role))
  if (candidates.length === 0) return

  const maxShift   = Math.ceil(candidates.length * 0.30)
  let shifted      = 0

  for (const npc of candidates) {
    if (shifted >= maxShift) break
    const ratio = (farmers.length + shifted) / Math.max(living.length, 1)
    if (ratio >= 0.40) break

    switchNPCRole(npc, 'farmer', state)
    shifted++
  }

  if (shifted > 0) {
    lastSurvivalDay = state.day
    const text = tf('engine.collapse_roleshift', { count: shifted }) as string
    addFeedRaw(text, 'warning', state.year, state.day)
    addChronicle(text, state.year, state.day, 'major')
  }
}
