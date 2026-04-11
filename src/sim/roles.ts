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
import { switchNPCRole, revertNPCRole } from './npc'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { tf } from '../i18n'
import {
  ROLE_CRISIS_FOOD_THRESHOLD,
  ROLE_RECOVERY_FOOD_THRESHOLD,
  ROLE_GUARD_SHORTAGE_FRACTION,
  ROLE_CRISIS_PERSIST_DAYS,
  ROLE_RECOVERY_PERSIST_DAYS,
  ROLE_EMERGENCY_PERMANENT_DAYS,
  ROLE_MAX_SHIFT_FRACTION,
} from '../constants/role-crisis-thresholds'

// ── Module-level state (hysteresis / throttling) ───────────────────────────
// These are deliberately module-scoped rather than WorldState fields:
// they are transient counters, not part of the save-worthy game state.

let foodCrisisDays     = 0
let foodRecoveryDays   = 0
let securityCrisisDays = 0
let lastEmergencyDay   = -1
let lastReversionDay   = -1
let lastSurvivalDay    = -1   // throttle for autoSurvivalRoleShift

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
