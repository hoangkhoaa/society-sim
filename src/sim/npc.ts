import type { NPC, Constitution, WorldState, Role, TrustMap, ActionState, WorkMotivationType, WorkSchedule, NPCPersonality } from '../types'
import { faker } from '@faker-js/faker'
import { clamp, gaussian, rand, randInt, weightedRandom, getSeason, ZONE_ADJACENCY } from './constitution'
import { t, tf, tOccVariant } from '../i18n'
import { getRegimeProfile, type SimRestrictions } from './regime-config'
import { NPC_MAX_ENMITY_IDS, NPC_SOCIAL_HUB_ZONES } from '../constants/npc-social-limits'
import { NPC_TRADE_EFFICIENCY, NPC_MERCHANT_MARKUP, NPC_SURVIVAL_COST_PER_TICK } from '../constants/npc-wealth-trade'
import { NPC_TRUST_DELTAS, type NpcTrustEvent } from '../constants/npc-trust-deltas'

// ── Active sim restrictions (set once per game from regime profile) ───────────
// Cached here to avoid calling getRegimeProfile() in the per-NPC hot path.

const _defaultRestrictions: SimRestrictions = {
  info_spread_mult: 0.75,
  info_ties_cap:    0.85,
  censorship_prob:  0.10,
  cross_zone_ties:  true,
  trade_mult:       0.75,
  rent_market:      true,
  private_lending:  true,
}

let _simRestrictions: SimRestrictions = { ..._defaultRestrictions }

/** Called from main.ts after applyRegimeDefaults — syncs restriction values for the sim tick. */
export function setActiveSimRestrictions(r: SimRestrictions): void {
  _simRestrictions = { ...r }
}

// ── Role Configuration ─────────────────────────────────────────────────────
// Single source of truth for ALL per-role constants.
// Adding or modifying a role requires editing only this table.

interface RoleConfig {
  /** Worldview bonuses applied at NPC creation. */
  worldview_bonus: Partial<Record<string, number>>
  /** Expected wealth; used in stress and fairness calculations. 0 = non-earner. */
  wealth_expectation: number
  /** Exhaustion per tick while working (stacks with base metabolic 0.15). */
  exhaustion_rate: number
  /** Work-hour offset vs. regime baseline. Special roles override normalRoutine directly. */
  schedule_offset: { start: number; end: number }
  /** Market income per tick at productivity=1.0. 0 = paid via tax pool. */
  income_rate: number
  /** True = paid from tax pool, not market labor income. */
  govt_paid: boolean
  /** Possible work/home zones for this role (randomly selected at init). */
  zones: string[]
  /** Can participate in class solidarity spread and labor strikes. */
  can_strike: boolean
  /** Can enter organizing/confront states when under stress. */
  can_protest: boolean
}

const ROLE_CONFIG: Record<Role, RoleConfig> = {
  farmer: {
    worldview_bonus:    { collectivism: +0.10, time_preference: +0.05 },
    wealth_expectation: 450,
    exhaustion_rate:    0.50,   // hard manual labor
    schedule_offset:    { start: -1, end: -1 },  // early-bird; done before dark
    income_rate:        0.12,   // raw resource + food production
    govt_paid:          false,
    zones:              ['north_farm', 'south_farm'],
    can_strike:         true,
    can_protest:        true,
  },
  craftsman: {
    worldview_bonus:    {},
    wealth_expectation: 600,
    exhaustion_rate:    0.40,   // skilled physical work
    schedule_offset:    { start:  0, end:  0 },  // follows regime baseline
    income_rate:        0.14,   // processed goods
    govt_paid:          false,
    zones:              ['workshop_district'],
    can_strike:         true,
    can_protest:        true,
  },
  merchant: {
    worldview_bonus:    { collectivism: -0.15, risk_tolerance: +0.10 },
    wealth_expectation: 1000,
    exhaustion_rate:    0.25,   // moderate — negotiation and travel
    schedule_offset:    { start:  0, end: +1 },  // stays open late
    income_rate:        0.10,   // base; boosted by P2P trade markup
    govt_paid:          false,
    zones:              ['market_square'],
    can_strike:         true,
    can_protest:        true,
  },
  scholar: {
    worldview_bonus:    { risk_tolerance: -0.05, time_preference: +0.15 },
    wealth_expectation: 800,
    exhaustion_rate:    0.20,   // mental work; lighter physical demand
    schedule_offset:    { start: +1, end:  0 },  // slightly later start
    income_rate:        0.11,   // education/medicine services
    govt_paid:          false,
    zones:              ['scholar_quarter'],
    can_strike:         true,
    can_protest:        true,
  },
  guard: {
    worldview_bonus:    { authority_trust: +0.20, risk_tolerance: +0.10 },
    wealth_expectation: 550,
    exhaustion_rate:    0.55,   // heavy physical — patrols, standing watch
    schedule_offset:    { start:  0, end:  0 },  // handled by rotation logic in normalRoutine
    income_rate:        0.00,   // paid via tax pool (see engine/economy applyGovernmentWages)
    govt_paid:          true,
    zones:              ['guard_post', 'plaza'],
    can_strike:         false,  // guards ARE the enforcement arm; striking is incoherent
    can_protest:        false,  // guards enforce order — organizing against govt makes no sense
  },
  leader: {
    worldview_bonus:    { authority_trust: +0.10, time_preference: +0.20, collectivism: +0.10 },
    wealth_expectation: 1200,
    exhaustion_rate:    0.25,   // administrative stress
    schedule_offset:    { start: -1, end: +1 },  // handled by long-hours logic in normalRoutine
    income_rate:        0.00,   // paid via tax pool
    govt_paid:          true,
    zones:              ['plaza', 'scholar_quarter'],
    can_strike:         false,  // leaders ARE the government; can't strike against themselves
    can_protest:        false,  // leaders manage crises through policy, not protest
  },
  child: {
    worldview_bonus:    {},
    wealth_expectation: 0,
    exhaustion_rate:    0.10,   // light activity
    schedule_offset:    { start:  0, end:  0 },  // handled by child-specific logic in normalRoutine
    income_rate:        0.00,   // no market income
    govt_paid:          false,
    zones:              ['residential_west', 'residential_east'],
    can_strike:         false,
    can_protest:        false,  // children don't participate in adult political action
  },
  healthcare: {
    worldview_bonus:    { collectivism: +0.10, authority_trust: +0.05 },
    wealth_expectation: 750,
    exhaustion_rate:    0.45,   // demanding physical and mental work; shift-based
    schedule_offset:    { start: -1, end: +2 },  // early start, extended end — long clinical shifts
    income_rate:        0.12,   // medical services; partially subsidized
    govt_paid:          false,
    zones:              ['clinic_district'],
    can_strike:         true,
    can_protest:        true,
  },
  gang: {
    worldview_bonus:    { authority_trust: -0.25, risk_tolerance: +0.20, collectivism: -0.10 },
    wealth_expectation: 500,
    exhaustion_rate:    0.35,   // irregular bursts of activity; mostly night operations
    schedule_offset:    { start: 0, end: 0 },  // unused: gang is always a night-shift worker via isNightShiftWorker
    income_rate:        0.08,   // illicit earnings from shadow economy
    govt_paid:          false,
    zones:              ['underworld_quarter'],
    can_strike:         false,  // gang members don't engage in formal labor action
    can_protest:        false,  // operate outside legitimate political channels
  },
}

// ── Derived maps (export for backward-compat with engine / UI consumers) ───
export const ROLE_WEALTH_EXPECTATION: Record<Role, number> = Object.fromEntries(
  Object.entries(ROLE_CONFIG).map(([r, cfg]) => [r, cfg.wealth_expectation]),
) as Record<Role, number>

// ── Constants ──────────────────────────────────────────────────────────────

const VALUE_WORLDVIEW_BIAS: Record<string, Partial<Record<string, number>>> = {
  security: { authority_trust: +0.15, risk_tolerance: -0.10, collectivism: +0.05 },
  equality: { collectivism: +0.20, authority_trust: +0.05 },
  freedom:  { risk_tolerance: +0.15, collectivism: -0.10, authority_trust: -0.10 },
  growth:   { time_preference: +0.20, risk_tolerance: +0.10 },
}

// ── Age-based exhaustion modifier ──────────────────────────────────────────
// Younger workers have more stamina; elderly tire faster.

function ageExhaustionModifier(age: number): number {
  if (age < 22)  return 0.85   // youthful energy
  if (age < 42)  return 1.00   // prime years
  if (age < 56)  return 1.15   // slight mid-life increase
  if (age < 66)  return 1.30   // noticeable
  return 1.30                   // elderly — capped to avoid guaranteed burnout
}

// ── Age-based rest recovery modifier ───────────────────────────────────────
// Elderly recover more slowly from exhaustion.

function ageRestModifier(age: number): number {
  if (age < 30)  return 1.10   // youthful bounce-back
  if (age < 50)  return 1.00   // baseline
  if (age < 65)  return 0.85   // slower recovery
  return 0.80                   // elderly — slower recovery (was 0.70)
}

// ── Work Schedule Inference ────────────────────────────────────────────────
// Derives a default work schedule from constitution parameters when the
// constitution does not explicitly define one. Exported so tests can use it.

export function inferWorkSchedule(c: Constitution): WorkSchedule {
  // Authoritarian / Warlord: no days off, dawn-to-dusk
  if (c.state_power >= 0.75 && c.individual_rights_floor < 0.25) {
    return { work_days_per_week: 7, work_start_hour: 5, work_end_hour: 20 }
  }
  // Feudal: near-constant labor, one day off
  if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) {
    return { work_days_per_week: 6, work_start_hour: 5, work_end_hour: 19 }
  }
  // Theocratic: 6-day week with one religious rest day
  if (c.state_power >= 0.70 && c.base_trust >= 0.65 && c.network_cohesion >= 0.70) {
    return { work_days_per_week: 6, work_start_hour: 6, work_end_hour: 18 }
  }
  // Welfare / Nordic: short work week, humane hours
  if (c.safety_net >= 0.65 && c.gini_start < 0.40) {
    return { work_days_per_week: 5, work_start_hour: 8, work_end_hour: 16 }
  }
  // Technocratic: 5-day, flexible start
  if (c.value_priority[0] === 'growth' && c.individual_rights_floor >= 0.50) {
    return { work_days_per_week: 5, work_start_hour: 9, work_end_hour: 18 }
  }
  // Competitive market / Libertarian: 6-day, long hours
  if (c.market_freedom >= 0.70 && c.state_power < 0.40) {
    return { work_days_per_week: 6, work_start_hour: 7, work_end_hour: 19 }
  }
  // Socialist / State-heavy: 6-day, standard hours
  if (c.state_power >= 0.70 && c.market_freedom < 0.30) {
    return { work_days_per_week: 6, work_start_hour: 6, work_end_hour: 16 }
  }
  // Commune: 6-day, shorter hours, community-focused
  if (c.market_freedom < 0.25 && c.state_power < 0.35) {
    return { work_days_per_week: 6, work_start_hour: 7, work_end_hour: 17 }
  }
  // Default / Moderate
  return { work_days_per_week: 5, work_start_hour: 7, work_end_hour: 18 }
}

// ── Work Motivation Inference ──────────────────────────────────────────────
// Assigns a motivation type aligned with the regime's character, with
// individual noise so not everyone in the same regime is identical.

export function inferMotivationType(role: Role, c: Constitution, npcId: number): WorkMotivationType {
  const ALL_TYPES: WorkMotivationType[] = ['survival', 'coerced', 'mandatory', 'happiness', 'achievement', 'duty']

  // Build regime-weighted probability for each motivation type
  const weights: Record<WorkMotivationType, number> = {
    survival:    0,
    coerced:     0,
    mandatory:   0,
    happiness:   0,
    achievement: 0,
    duty:        0,
  }

  // Coercion: authoritarian / low rights / feudal repression
  const coercionFactor = clamp((1 - c.individual_rights_floor) * c.state_power, 0, 1)
  weights.coerced = coercionFactor * 2.0

  // Survival: high inequality + weak safety net → work just to survive
  weights.survival = clamp((c.gini_start - 0.35) * 2, 0, 1) * clamp(1 - c.safety_net * 1.5, 0, 1) * 2.5

  // Happiness / fulfillment: welfare, high safety net, low inequality
  weights.happiness = c.safety_net * (1 - c.gini_start) * 2.0

  // Achievement / self-proving: competitive market, growth-focused
  const growthRank = c.value_priority.indexOf('growth')
  const growthWeight = growthRank >= 0 ? (4 - growthRank) / 4 : 0
  weights.achievement = c.market_freedom * (0.5 + growthWeight * 0.5) * 2.0

  // Duty / cultural obligation: high trust, high cohesion, theocratic/communal
  weights.duty = c.base_trust * c.network_cohesion * 2.0

  // Mandatory / collective obligation: socialist / state-directed, not fully coerced
  weights.mandatory = clamp(c.state_power * (1 - coercionFactor * 0.6), 0, 1) * 1.5

  // Role overrides
  if (role === 'leader') { weights.achievement += 0.6; weights.duty += 0.3 }
  if (role === 'guard')  { weights.duty += 0.5; weights.coerced = Math.max(0, weights.coerced - 0.4) }
  if (role === 'merchant')    { weights.achievement += 0.4 }
  if (role === 'scholar')     { weights.happiness += 0.4 }
  if (role === 'farmer')      { weights.survival += 0.2; weights.duty += 0.1 }
  if (role === 'healthcare')  { weights.happiness += 0.5; weights.duty += 0.3 }  // vocation-driven
  if (role === 'gang')        { weights.survival += 0.6; weights.coerced += 0.3 } // desperation/threat

  // Clamp negatives
  for (const k of ALL_TYPES) weights[k] = Math.max(0, weights[k])

  // Deterministic weighted sample by NPC id (stable across runs)
  const total = ALL_TYPES.reduce((s, k) => s + weights[k], 0)
  if (total <= 0) return 'mandatory'
  const h = Math.sin((npcId + 1) * 12.9898 + 999 * 78.233) * 43758.5453
  let r = (h - Math.floor(h)) * total
  for (const k of ALL_TYPES) {
    r -= weights[k]
    if (r <= 0) return k
  }
  return 'mandatory'
}

// ── Personality generation ─────────────────────────────────────────────────
// Stable character traits fixed at birth.  Uses a deterministic hash of the
// NPC id so traits are reproducible.  Role biases are applied on top.

/** Returns the fractional (post-decimal) part of a number. */
function fractional(n: number): number { return n - Math.floor(n) }

/**
 * Deterministic pseudo-random value in [0, 1) for the given seed.
 * Uses the standard "sin hash" pattern: multiply by a large prime-like
 * constant (43758.5453) after a sin transform to scatter the output uniformly.
 * The offset constants 127.1 and 311.7 break up regular low-frequency patterns.
 */
function hashFrac(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return fractional(Math.abs(s))
}

export function generatePersonality(npcId: number, role: Role): NPCPersonality {
  const base = {
    greed:      clamp(hashFrac(npcId * 3 + 1) * 1.2 - 0.1, 0, 1),
    aggression: clamp(hashFrac(npcId * 5 + 2) * 1.2 - 0.1, 0, 1),
    loyalty:    clamp(hashFrac(npcId * 7 + 3) * 1.2 - 0.1, 0, 1),
    ambition:   clamp(hashFrac(npcId * 11 + 4) * 1.2 - 0.1, 0, 1),
  }

  // Role biases (additive, then re-clamped)
  if (role === 'merchant') { base.greed += 0.15; base.ambition += 0.10 }
  if (role === 'gang')     { base.aggression += 0.20; base.greed += 0.10 }
  if (role === 'guard')    { base.aggression += 0.10; base.loyalty += 0.15 }
  if (role === 'leader')   { base.ambition += 0.20; base.loyalty += 0.10 }
  if (role === 'farmer')   { base.loyalty += 0.10; base.greed -= 0.05 }
  if (role === 'scholar')  { base.ambition += 0.10; base.greed -= 0.10 }
  if (role === 'healthcare') { base.loyalty += 0.15; base.aggression -= 0.10 }

  return {
    greed:      clamp(base.greed,      0, 1),
    aggression: clamp(base.aggression, 0, 1),
    loyalty:    clamp(base.loyalty,    0, 1),
    ambition:   clamp(base.ambition,   0, 1),
  }
}


// ── Enmity helpers ─────────────────────────────────────────────────────────
// An NPC can hold grudges against up to 5 others.  When the list is full the
// oldest entry is evicted (shift).

export function addEnmity(npc: NPC, targetId: number): void {
  if (npc.id === targetId) return
  if (!npc.enmity_ids) npc.enmity_ids = []
  if (npc.enmity_ids.includes(targetId)) return
  if (npc.enmity_ids.length >= NPC_MAX_ENMITY_IDS) npc.enmity_ids.shift()
  npc.enmity_ids.push(targetId)
}

export function removeEnmity(npc: NPC, targetId: number): void {
  if (!npc.enmity_ids) return
  npc.enmity_ids = npc.enmity_ids.filter(id => id !== targetId)
}

// Means of production distributed at society start according to regime type.

function initialCapital(role: Role, constitution: Constitution): number {
  if (role === 'child' || role === 'guard') return 0

  const profile = getRegimeProfile(constitution)

  // State ownership (marxist): state provides tools & equipment to all workers.
  // Workers don't own capital privately, but have access to state means of production.
  if (profile.capitalMode === 'state') return role === 'leader' ? randInt(15, 30) : randInt(8, 20)

  // Collective: flat small share for everyone (commune / socialist)
  if (profile.capitalMode === 'collective') {
    return role === 'leader' ? randInt(25, 45) : randInt(8, 25)
  }

  // Feudal / warlord: extreme concentration in ruling class
  if (profile.capitalMode === 'feudal') {
    if (role === 'leader') return randInt(55, 90)
    // ~10% of farmers/craftsmen are minor lords or freeholders
    if ((role === 'farmer' || role === 'craftsman') && Math.random() < 0.10) return randInt(15, 35)
    return 0  // everyone else: landless/bonded
  }

  // Pareto (default, capitalist): gini-based spread
  const BASE_RANGE: Record<Role, [number, number]> = {
    leader:     [35, 80],
    merchant:   [20, 65],
    craftsman:  [10, 40],
    farmer:     [5, 30],
    scholar:    [0, 15],
    guard:      [0, 0],
    child:      [0, 0],
    healthcare: [5, 25],
    gang:       [0, 20],
  }
  const [lo, hi] = BASE_RANGE[role]
  const landlessChance = clamp(0.10 + constitution.gini_start * 0.35, 0, 0.55)
  if (role !== 'leader' && role !== 'merchant' && Math.random() < landlessChance) return 0
  const spread = (hi - lo) * (0.6 + constitution.gini_start * 0.4)
  return clamp(Math.round(lo + Math.random() * spread), 0, 100)
}

// ── Pareto wealth distribution ─────────────────────────────────────────────

function paretoSample(gini: number): number {
  // alpha from gini: gini = 1/(2*alpha - 1)  →  alpha = (1 + 1/gini) / 2
  // clamped to avoid extreme values
  const alpha = clamp((1 + 1 / Math.max(gini, 0.05)) / 2, 1.1, 5)
  const u = Math.random()
  return Math.max(100, 300 * Math.pow(1 - u, -1 / alpha))
}

// ── Role assignment ────────────────────────────────────────────────────────

function assignRole(idx: number, total: number, ratios: Constitution['role_ratios']): Role {
  // 'child' is excluded from initial population assignment — only newborns get it
  const roles: Array<keyof typeof ratios> = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader', 'healthcare', 'gang']
  let cumulative = 0
  const frac = idx / total
  for (const role of roles) {
    cumulative += ratios[role]
    if (frac < cumulative) return role as Role
  }
  return 'farmer'
}

// Zones where children and families live. Exported so the sim engine can use the same list.
export const RESIDENTIAL_ZONES = ['residential_west', 'residential_east'] as const

function assignZone(role: Role): string {
  const zoneList = ROLE_CONFIG[role].zones
  return zoneList[Math.floor(Math.random() * zoneList.length)]
}

// ── NPC Description template ───────────────────────────────────────────────

function generateDescription(npc: Omit<NPC, 'description' | 'daily_thought'>): string {
  const ageStage = npc.age < 30 ? t('npc.age_young') : npc.age < 50 ? t('npc.age_mid') : t('npc.age_old')
  const mood     = npc.grievance > 60 ? t('npc.mood_bad') : npc.happiness > 65 ? t('npc.mood_good') : t('npc.mood_ok')
  const social   = npc.worldview.collectivism > 0.6 ? t('npc.social_col') : t('npc.social_ind')
  const prefix   = npc.gender === 'male' ? t('npc.mr') : t('npc.ms')
  return tf('npc.desc', {
    prefix: prefix as string,
    name:   npc.name,
    age:    npc.age,
    occ:    npc.occupation,
    ageStage: ageStage as string,
    mood:   mood as string,
    social: social as string,
  })
}

// ── Fertility by age ───────────────────────────────────────────────────────

function fertilityByAge(age: number, gender: 'male' | 'female'): number {
  if (gender === 'male') return age < 20 ? 0 : age < 50 ? 0.8 : age < 65 ? 0.3 : 0
  return age < 18 ? 0 : age < 35 ? 0.9 : age < 45 ? 0.5 : 0
}

// ── Create NPC ─────────────────────────────────────────────────────────────

export function createNPC(idx: number, total: number, constitution: Constitution): NPC {
  // In planned economies (market_freedom < 0.10), private merchant class doesn't exist —
  // redistribute their population share to craftsmen (state-run production).
  const effectiveRatios = { ...constitution.role_ratios }
  if (constitution.market_freedom < 0.10) {
    effectiveRatios.craftsman = clamp(effectiveRatios.craftsman + effectiveRatios.merchant, 0, 1)
    effectiveRatios.merchant  = 0
  }
  const role = assignRole(idx, total, effectiveRatios)
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female'
  const name = faker.person.fullName({ sex: gender })
  const age = randInt(18, 70)
  const zone = assignZone(role)

  // Worldview: base + value bias + role bonus + noise
  const valueBias: Record<string, number> = {}
  constitution.value_priority.forEach((val, rank) => {
    const bias = VALUE_WORLDVIEW_BIAS[val] ?? {}
    const weight = (4 - rank) / 10
    for (const [dim, b] of Object.entries(bias)) {
      valueBias[dim] = (valueBias[dim] ?? 0) + (b as number) * weight
    }
  })
  const rb = ROLE_CONFIG[role].worldview_bonus

  const worldview = {
    collectivism:    clamp(0.5 + (valueBias.collectivism ?? 0) + (rb.collectivism ?? 0) + gaussian(0, 0.15), 0, 1),
    authority_trust: clamp(constitution.base_trust + (valueBias.authority_trust ?? 0) + (rb.authority_trust ?? 0) + gaussian(0, 0.20), 0, 1),
    risk_tolerance:  clamp(0.4 + (valueBias.risk_tolerance ?? 0) + (rb.risk_tolerance ?? 0) + gaussian(0, 0.20), 0, 1),
    time_preference: clamp(constitution.safety_net * 0.5 + (valueBias.time_preference ?? 0) + (rb.time_preference ?? 0) + gaussian(0, 0.15), 0, 1),
  }

  const trust_in: TrustMap = Object.fromEntries(
    (['government', 'market', 'opposition', 'community', 'guard'] as const).map(inst => [
      inst,
      {
        competence: clamp(constitution.base_trust + gaussian(0, 0.10), 0, 1),
        intention:  clamp(constitution.base_trust + gaussian(0, 0.10), 0, 1),
      },
    ]),
  ) as TrustMap

  // Regime profile: drives occupation names, stat tweaks, capital distribution
  const regimeProfile = getRegimeProfile(constitution)

  // Occupation strings are locale-aware and regime-flavoured
  const occupation = tOccVariant(role, regimeProfile.variant)

  const appearance = {
    height: (['short', 'average', 'tall'] as const)[randInt(0, 2)],
    build:  (['slim', 'average', 'sturdy'] as const)[randInt(0, 2)],
    hair:   age < 40 ? (['black', 'brown'] as const)[randInt(0, 1)]
           : age < 60 ? (['brown', 'gray'] as const)[randInt(0, 1)]
           : (['gray', 'white'] as const)[randInt(0, 1)],
    skin:   (['light', 'medium', 'dark'] as const)[randInt(0, 2)],
  }

  const tw = regimeProfile.npcTweaks

  const npcPartial = {
    id: idx,
    name,
    age,
    gender,
    appearance,
    lifecycle: {
      is_alive: true,
      death_cause: null,
      death_tick: null,
      spouse_id: null,
      children_ids: [],
      fertility: fertilityByAge(age, gender),
      last_birth_tick: null,
      romance_target_id: null,
      romance_score: 0,
      heartbreak_cooldown: 0,
    },
    occupation,
    daily_thought: '',
    last_thought_tick: -999,
    zone,
    home_zone: zone,   // permanent work/residence zone; zone changes dynamically
    x: rand(0, 1),
    y: rand(0, 1),
    role,
    hunger:     rand(10, 30),
    exhaustion: rand(10, 30),
    isolation:  clamp(rand(5, 25) + tw.isolation_bonus, 0, 80),
    fear:       clamp(rand(0, 15) + tw.fear_bonus,      0, 80),
    worldview,
    stress: 0,
    happiness: 60,
    action_state: 'working' as ActionState,
    stress_threshold:            40 + rand(-10, 10),
    collective_action_threshold: rand(0.10, 0.70),
    adaptability:                rand(0.1, 0.9),
    base_skill:                  rand(0.4, 1.0),
    memory: [],
    strong_ties: [],
    weak_ties: [],
    info_ties: [],
    influence_score: 0,
    // Seed EMA at estimated steady-state so GDP is non-zero from tick 1.
    // Uses base_skill (already set above) * income_rate * 24 ticks/day.
    // govt_paid roles get 0 market income (wages come from tax pool instead).
    daily_income: ROLE_CONFIG[role].govt_paid ? 0 : rand(0.4, 1.0) * ROLE_CONFIG[role].income_rate * 24,
    trust_in,
    wealth: paretoSample(constitution.gini_start),
    grievance: clamp(rand(0, 20) + tw.grievance_bonus, 0, 80),
    dissonance_acc: 0,
    susceptible: false,
    sick: false,
    sick_ticks: 0,
    criminal_record: false,
    community_group: null,
    burnout_ticks: 0,
    debt: 0,
    debt_to: null,
    faction_id: null,
    legendary: false,
    work_motivation: inferMotivationType(role, constitution, idx),
    bio_clock_offset: clamp(Math.round(gaussian(0, 1.2)), -2, 3),

    // Class solidarity: children have none (not yet in the workforce).
    // Laborers start higher in unequal societies; regime tweaks apply.
    class_solidarity: role === 'child' ? 0 : clamp(
      (role === 'farmer' || role === 'craftsman' ? 20 : 10)
      + constitution.gini_start * 30
      + tw.class_solidarity_bonus
      + gaussian(0, 8),
      0, 70,
    ),
    on_strike: false,
    bridge_score: 0,
    mentor_id: null,

    // Tư liệu lao động
    capital: initialCapital(role, constitution),
    capital_rents_from: null,
    capital_rent_paid: 0,

    // Personality and enmity (new depth features)
    personality: generatePersonality(idx, role),
    enmity_ids: [],
  }

  return {
    ...npcPartial,
    description: generateDescription(npcPartial),
  }
}

// ── Per-tick NPC update ────────────────────────────────────────────────────

/** Precomputed once per sim tick from active_events — avoids O(NPCs × events) .some() calls. */
export interface TickEventFlags {
  epidemic: boolean
  external_threat: boolean
  blockade: boolean
}

export function tickNPC(npc: NPC, state: WorldState, events: IndividualEvent[] | undefined, eventFlags: TickEventFlags): void {
  if (!npc.lifecycle.is_alive) return
  const wasBelowBurnoutThreshold = (npc.burnout_ticks ?? 0) < 480
  decayNeeds(npc, state)
  // Emit burnout event once when crossing the threshold
  if (wasBelowBurnoutThreshold && (npc.burnout_ticks ?? 0) >= 480) {
    events?.push({ type: 'burnout', npc })
  }
  npc.stress    = computeStress(npc)
  npc.happiness = computeHappiness(npc, state)
  // Sleeping NPCs don't process social grievances or worldview drift —
  // these only shift during waking hours when NPCs experience the world.
  if (npc.action_state !== 'resting') {
    updateGrievance(npc, state)
    updateWorldview(npc, state)
  }
  applyResistanceBehavior(npc, state, eventFlags)
  npc.action_state = selectAction(npc, state)
  updateZone(npc, state)
  wealthTick(npc, state)
  checkLifecycle(npc, state, events)
}

// ── Resistance / self-preservation behavior ─────────────────────────────────
// NPCs adaptively resist societal conditions to protect their own interests.
// Each behavior fires only when a specific condition is met and is weighted
// by the NPC's worldview so identical crises produce heterogeneous responses.

function applyResistanceBehavior(npc: NPC, state: WorldState, flags: TickEventFlags): void {
  if (npc.role === 'child') return
  const m = state.macro
  const c = state.constitution

  // Epidemic → self-isolation: reduce social activity desire
  if (flags.epidemic) {
    const caution = 1 - npc.worldview.risk_tolerance
    npc.isolation += caution * 0.8
    npc.fear += caution * 0.4
    if (npc.action_state === 'socializing' && Math.random() < caution * 0.20) {
      npc.action_state = 'resting'
    }
  }

  // High inequality + high taxes (state_power > 0.6) → reduce trade activity
  // ("I won't buy if the state takes it all anyway")
  if (m.gini > 0.45 && c.state_power > 0.55 && npc.grievance > 35) {
    const tradeResist = npc.worldview.collectivism * 0.3
    npc.daily_income *= (1 - tradeResist * 0.02)
  }

  // Food crisis → universal fear/stress (everyone is anxious when public supply fails)
  // Hoarding benefit is wealth-gated: only those with private reserves can supplement their diet.
  // Poor NPCs have nothing to hoard; their situation is entirely captured by Fix A (wealthFoodMod).
  if (m.food < 25) {
    npc.stress = clamp(npc.stress + 0.3, 0, 100)
    npc.fear   = clamp(npc.fear   + 0.2, 0, 100)
    // Private hoarding: only meaningful above comfortable wealth (wealthNorm > 1.0)
    // Scales with surplus wealth — a lord can hoard much more than a middle-class artisan
    const wealthNorm = clamp(npc.wealth / 150, 0, 2.0)
    if (wealthNorm > 1.0 && npc.hunger > 30) {
      const hoardBonus = (wealthNorm - 1.0) * 0.15   // 0 at wealth=150, 0.15 at wealth≥300
      npc.hunger = clamp(npc.hunger - hoardBonus, 0, 100)
    }
  }

  // Government crackdown (high guard power + low individual rights) → fear-driven compliance OR defiance
  const guardPower = state.institutions.find(i => i.id === 'guard')?.power ?? 0.3
  if (guardPower > 0.7 && c.individual_rights_floor < 0.25) {
    if (npc.worldview.authority_trust > 0.55) {
      npc.fear = clamp(npc.fear + 0.5, 0, 100)
      npc.dissonance_acc = clamp(npc.dissonance_acc - 0.3, 0, 100)
    } else {
      npc.grievance = clamp(npc.grievance + 0.4, 0, 100)
      npc.dissonance_acc = clamp(npc.dissonance_acc + 0.5, 0, 100)
    }
  }

  // Market crash / resource depletion → merchants & craftsmen reduce risk
  if (m.energy < 30 && (npc.role === 'merchant' || npc.role === 'craftsman')) {
    npc.worldview.risk_tolerance = clamp(npc.worldview.risk_tolerance - 0.002, 0, 1)
    npc.stress = clamp(npc.stress + 0.3, 0, 100)
  }

  // High political pressure → scholars become more vocal (radicalize faster)
  if (m.political_pressure > 50 && npc.role === 'scholar') {
    npc.dissonance_acc = clamp(npc.dissonance_acc + 0.4, 0, 100)
    npc.worldview.collectivism = clamp(npc.worldview.collectivism + 0.001, 0, 1)
  }

  // External threat → rally-around-the-flag (temporary trust boost for obedient NPCs)
  if (flags.external_threat && npc.worldview.authority_trust > 0.5) {
    npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.003, 0, 1)
    npc.fear = clamp(npc.fear + 0.3, 0, 100)
  }

  // Blockade → merchants suffer most (trade halted), farmers hoard
  if (flags.blockade) {
    if (npc.role === 'merchant') {
      npc.grievance = clamp(npc.grievance + 0.6, 0, 100)
      npc.stress    = clamp(npc.stress    + 0.4, 0, 100)
    }
    if (npc.role === 'farmer') {
      npc.worldview.time_preference = clamp(npc.worldview.time_preference + 0.002, 0, 1)
    }
  }

  // Low trust in government → tax evasion (wealth preserved more, but isolation up)
  if (npc.trust_in.government.intention < 0.25 && c.state_power > 0.4) {
    npc.isolation = clamp(npc.isolation + 0.2, 0, 100)
  }

  // Widespread unrest → moderate NPCs withdraw; extremists double down
  if (m.stability < 30) {
    if (npc.worldview.risk_tolerance < 0.35) {
      npc.fear = clamp(npc.fear + 0.4, 0, 100)
    } else {
      npc.grievance = clamp(npc.grievance + 0.3, 0, 100)
    }
  }
}

// ── Zone Movement ─────────────────────────────────────────────────────────
// home_zone = workplace (or duty post); zone = current sim location.
// Location follows action_state, which uses per-NPC daily rhythms (staggered
// commute, night-shift workers, children’s shorter days).

/** Stable 0–1 from id — same every session. */
function scheduleUnit(id: number, salt: number): number {
  const x = Math.sin((id + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function residentialBed(npc: NPC): string {
  return npc.id % 2 === 0 ? 'residential_east' : 'residential_west'
}

function isNightShiftWorker(npc: NPC): boolean {
  if (npc.role === 'gang') return true
  // ~20% of healthcare workers cover overnight shifts
  if (npc.role === 'healthcare') return scheduleUnit(npc.id, 11) < 0.20
  if (npc.role !== 'merchant' && npc.role !== 'craftsman') return false
  return scheduleUnit(npc.id, 11) < 0.11
}

function updateZone(npc: NPC, state: WorldState): void {
  // Quarantine: NPCs cannot leave a quarantined zone (except active fleeing)
  if ((state.quarantine_zones ?? []).includes(npc.zone) && npc.action_state !== 'fleeing') {
    return
  }

  // Epidemic flee: risk-averse NPCs preemptively move away from infected zones
  const epidemicInZone = state.active_events.some(
    e => e.type === 'epidemic' && e.zones.includes(npc.zone),
  )
  if (epidemicInZone && npc.worldview.risk_tolerance < 0.40 && Math.random() < 0.03) {
    const adj  = ZONE_ADJACENCY[npc.zone] ?? []
    const safe = adj.filter(z => !state.active_events.some(e => e.type === 'epidemic' && e.zones.includes(z)))
    if (safe.length > 0) {
      npc.zone = safe[Math.floor(Math.random() * safe.length)]
      return
    }
  }

  // Fleeing: move to a random adjacent zone every 6 ticks
  if (npc.action_state === 'fleeing') {
    if (state.tick % 6 === npc.id % 6) {
      const adj = ZONE_ADJACENCY[npc.zone]
      if (adj?.length) npc.zone = adj[Math.floor(Math.random() * adj.length)]
    }
    return
  }

  // Resting → home (residential for most; guard/leader stay at their post/quarters)
  if (npc.action_state === 'resting') {
    if (npc.role === 'guard' || npc.role === 'leader') npc.zone = npc.home_zone
    else npc.zone = residentialBed(npc)
    return
  }

  // Evening social: occasional drift to a hub (still staggered by tick % 12)
  if (npc.action_state === 'socializing' && state.tick % 12 === npc.id % 12) {
    if (Math.random() < 0.28) {
      npc.zone = NPC_SOCIAL_HUB_ZONES[npc.id % NPC_SOCIAL_HUB_ZONES.length]
      return
    }
  }

  npc.zone = npc.home_zone
}

// ── Age Productivity Factor ────────────────────────────────────────────────
// Productivity peaks 20–40, declines gradually, significant drop 65+.

function ageProductivityFactor(age: number): number {
  if (age < 16)  return 0.30   // children/early teens
  if (age < 22)  return 0.70   // apprentice years
  if (age < 42)  return 1.00   // peak working years
  if (age < 56)  return 0.90   // slight mid-life decline
  if (age < 66)  return 0.75   // noticeable decline
  return 0.55                   // elderly: significant decline
}

// Elderly illness multiplier: risk scales with age past 45.
function ageIllnessMult(age: number): number {
  if (age < 45) return 1.0
  if (age < 60) return 1.6
  return 2.8
}

// ── Needs Decay ────────────────────────────────────────────────────────────

function decayNeeds(npc: NPC, state: WorldState): void {
  const foodLevel      = state.macro.food   // 0–100
  const violenceActive = state.active_events.some(e => e.type === 'epidemic' || e.type === 'external_threat')
  const isWinter       = getSeason(state.day) === 'winter'

  // Winter: cold + scarcity raises baseline hunger faster
  const hungerBase = isWinter ? 0.8 : 0.5

  // Graduated scarcity penalty: food shortage accelerates hunger
  // food < 30 → mild penalty; food < 10 → famine conditions
  const scarcityPenalty = foodLevel < 30 ? (30 - foodLevel) / 100 * 0.9 : 0
  npc.hunger    += hungerBase + scarcityPenalty
  // Isolation baseline: +0.08/tick (was 0.2). Working and resting now actively reduce isolation
  // because those activities involve meaningful human contact or structured routine.
  npc.isolation += 0.08
  npc.fear      += violenceActive ? 1.2 : -0.5

  // ── Exhaustion: role-based gain + age modifier ──────────────────────────
  // Base metabolic cost always applies (+0.15/hr). Activity cost varies by
  // role and action state. Sick NPCs tire 50% faster.
  const baseMetabolic = 0.15
  const ageMod        = ageExhaustionModifier(npc.age)
  const sickMod       = npc.sick ? 1.5 : 1.0

  if (npc.action_state === 'resting') {
    // Resting: base metabolic still ticks, but recovery offsets it.
    // Graduated recovery: deep fatigue (sleep debt) recovers slower.
    const baseRecovery = 1.2
    const recoveryMod  = ageRestModifier(npc.age)
    const recoveryEfficiency = npc.exhaustion > 70 ? 0.70
      : npc.exhaustion > 40 ? 0.85
      : 1.0
    const netRest = baseMetabolic * ageMod * sickMod - baseRecovery * recoveryMod * recoveryEfficiency
    npc.exhaustion += netRest
  } else if (npc.action_state === 'working') {
    // Working: role-specific exhaustion rate on top of base metabolic
    const roleRate = ROLE_CONFIG[npc.role].exhaustion_rate
    npc.exhaustion += (baseMetabolic + roleRate) * ageMod * sickMod
  } else if (npc.action_state === 'socializing') {
    // Socializing: light activity (+0.10 on top of base)
    npc.exhaustion += (baseMetabolic + 0.10) * ageMod * sickMod
  } else {
    // Organizing, fleeing, confronting, complying — moderate exertion
    const actionRate = (npc.action_state === 'fleeing' || npc.action_state === 'confront') ? 0.35 : 0.15
    npc.exhaustion += (baseMetabolic + actionRate) * ageMod * sickMod
  }

  // All NPCs eat when food is available.
  // In equal societies (high safety_net) food is rationed uniformly.
  // In stratified societies (low safety_net) wealth determines access during scarcity:
  //   - lords/wealthy eat from private stores even in shortages
  //   - serfs/destitute get almost nothing when public supply runs low
  // When food is plentiful (>60%) class distinctions disappear — there's enough for all.
  const inequalityEffect = 1.0 - state.constitution.safety_net  // 0 = equal dist., 1 = fully stratified
  const wealthNorm       = clamp(npc.wealth / 150, 0, 2.0)      // 0 = destitute, 1 = comfortable, 2 = wealthy
  // Modifier to food recovery rate based on wealth position
  const wealthFoodMod = clamp(
    foodLevel > 60
      ? 1.0                                                                // plentiful → equal access
      : foodLevel > 30
      ? 1.0 + (wealthNorm - 1.0) * 0.35 * inequalityEffect               // moderate scarcity
      : 1.0 + (wealthNorm - 1.0) * 0.55 * inequalityEffect,              // severe scarcity
    0.05, 2.0,
  )

  const baseRecovery = foodLevel > 60 ? 0.55
    : foodLevel > 30 ? 0.38
    : foodLevel > 10 ? 0.18
    : 0
  const workBonus = npc.action_state === 'working' ? 0.25 : 0
  const hungerRecovery = (baseRecovery + workBonus) * wealthFoodMod
  if (hungerRecovery > 0) npc.hunger -= hungerRecovery

  // Isolation changes by action state:
  // Working = structured daily contact with coworkers → mild reduction
  // Resting = recovery time, some social media/casual contact → very mild reduction
  // Socializing = active social interaction → strongest reduction
  // Organizing = group activity → moderate reduction
  // Fleeing/confront = panic isolation → increase
  if (npc.action_state === 'working') {
    npc.isolation -= 0.12   // coworker contact, daily structure
  } else if (npc.action_state === 'resting') {
    npc.isolation -= 0.05   // passive social contact
  } else if (npc.action_state === 'family') {
    npc.isolation -= 0.65   // family time: strongest isolation reducer
    npc.happiness  = clamp(npc.happiness + 0.15, 0, 100)
    npc.stress     = clamp(npc.stress    - 0.10, 0, 100)
  } else if (npc.action_state === 'socializing') {
    npc.isolation -= 0.55
    if (npc.strong_ties.length < 3) npc.isolation += 0.25  // socializing but no real friends
  } else if (npc.action_state === 'organizing') {
    npc.isolation -= 0.20   // collective action builds solidarity
  } else if (npc.action_state === 'fleeing' || npc.action_state === 'confront') {
    npc.isolation += 0.20   // panic/crisis cuts people off
  }

  // Social ostracism: neighbors gradually distance themselves from known criminals
  if (npc.criminal_record) npc.isolation += 0.15

  // Community group: belonging reduces isolation even when not actively socializing
  if (npc.community_group !== null) {
    npc.isolation -= 0.20
    // In winter, community provides mutual support against cold/fear
    if (isWinter) npc.fear = clamp(npc.fear - 0.5, 0, 100)
  }

  // ── Burnout tracking ────────────────────────────────────────────────────
  // When both stress and exhaustion exceed 70 for extended periods (480 ticks
  // = 20 sim-days), the NPC enters burnout: forced compliance + reduced output.
  if (npc.stress > 70 && npc.exhaustion > 70) {
    npc.burnout_ticks = (npc.burnout_ticks ?? 0) + 1
  } else {
    // Slowly decay burnout accumulation when conditions improve
    npc.burnout_ticks = Math.max(0, (npc.burnout_ticks ?? 0) - 0.5)
  }

  npc.hunger     = clamp(npc.hunger,     0, 100)
  npc.exhaustion = clamp(npc.exhaustion, 0, 100)
  npc.isolation  = clamp(npc.isolation,  0, 100)
  npc.fear       = clamp(npc.fear,       0, 100)
}

// ── Stress ─────────────────────────────────────────────────────────────────

function computeStress(npc: NPC): number {
  const h = Math.pow(npc.hunger     / 100, 1.3) * 0.30
  const e = Math.pow(npc.exhaustion / 100, 1.2) * 0.15
  const i = Math.pow(npc.isolation  / 100, 1.2) * 0.18
  const f = Math.pow(npc.fear       / 100, 1.5) * 0.22

  const roleExpected = ROLE_WEALTH_EXPECTATION[npc.role]
  // Guard: roleExpected=0 for children — avoid division by zero.
  const identity = roleExpected > 0
    ? Math.max(0, (roleExpected - npc.wealth) / roleExpected) * 0.10
    : 0
  const socialBuffer = Math.min(npc.strong_ties.length, 12) / 12 * 0.08

  return clamp((h + e + i + f + identity - socialBuffer) * 100, 0, 100)
}

// ── Happiness ──────────────────────────────────────────────────────────────

function avgWealth(ids: number[], npcs: NPC[]): number {
  if (ids.length === 0) return 50
  let sum = 0, count = 0
  for (const id of ids) {
    if (npcs[id]) { sum += npcs[id].wealth; count++ }
  }
  return count > 0 ? sum / count : 50
}

function computeHappiness(npc: NPC, state: WorldState): number {
  const stressPenalty   = npc.stress * 0.55
  const neighborAvg     = avgWealth(npc.weak_ties, state.npcs)
  const relativeStatus  = clamp((npc.wealth - neighborAvg) / 100, -1, 1) * 12
  const inequalityPain  = state.macro.gini * (npc.worldview.collectivism * 0.5 + 0.2) * 18
  const memorySum       = npc.memory.reduce((s, m) => s + m.emotional_weight, 0)
  const memoryEffect    = clamp(memorySum / 10, -15, 15)
  const avgTrust        = Object.values(npc.trust_in).reduce((s, t) => s + (t.competence + t.intention) / 2, 0) / 5
  const trustBonus      = avgTrust * 8

  return clamp(50 - stressPenalty + relativeStatus - inequalityPain + memoryEffect + trustBonus, 0, 100)
}

// ── Action Selection ───────────────────────────────────────────────────────

function normalRoutine(npc: NPC, state: WorldState): ActionState {
  const hour = state.tick % 24
  const c    = state.constitution
  const sched: WorkSchedule = c.work_schedule ?? inferWorkSchedule(c)

  // Determine whether today is a designated rest day for this regime.
  // (state.day - 1) % 7 gives 0–6; days ≥ work_days_per_week are off.
  const dayOfWeek = (state.day - 1) % 7
  const isRestDay = dayOfWeek >= sched.work_days_per_week

  // Helper: does this NPC have close family (spouse or children) to spend time with?
  const hasFamily = npc.lifecycle.spouse_id !== null
    || npc.lifecycle.children_ids.length > 0

  // ── Guards: rotation schedule ──────────────────────────────────────────
  // Guards in humane regimes (safety_net > 0.40) get true rest days; in harsh
  // regimes they are always on duty with only a short sleep window.
  if (npc.role === 'guard') {
    const guardHasRestDay = isRestDay && c.safety_net > 0.40
    if (guardHasRestDay) {
      if (hour >= 22 || hour < 8) return 'resting'
      if (hasFamily && hour >= 12 && hour < 18) return 'family'
      if (hour >= 14) return 'socializing'
      return 'resting'
    }
    if (hour >= 23 || hour < 5) return 'resting'
    // Even on duty, guards with family get a brief evening window
    if (hasFamily && hour >= 20 && hour < 22 && c.safety_net > 0.30) return 'family'
    return 'working'
  }

  // ── Leaders: long hours; work even on rest days but take social time ───
  if (npc.role === 'leader') {
    if (isRestDay) {
      if (hour >= 23 || hour < 7) return 'resting'
      if (hasFamily && hour >= 10 && hour < 15) return 'family'
      if (hour >= 13) return 'socializing'
      return 'working'
    }
    const leaderStart = Math.max(3, sched.work_start_hour - 1)
    const leaderEnd   = Math.min(22, sched.work_end_hour + 1)
    if (hour >= 23 || hour < leaderStart) return 'resting'
    if (hasFamily && hour >= leaderEnd && hour < leaderEnd + 2) return 'family'
    if (hour >= leaderEnd) return 'socializing'
    return 'working'
  }

  // ── Children: age-appropriate fixed schedule ───────────────────────────
  if (npc.role === 'child') {
    const wake  = 7 + Math.floor(scheduleUnit(npc.id, 15) * 2)   // 7–8
    const sleep = 20 + Math.floor(scheduleUnit(npc.id, 16) * 2)  // 20–21
    if (hour >= sleep || hour < wake) return 'resting'
    if (isRestDay || hour >= 15) return 'family'  // children spend free time with family
    return 'working'
  }

  // ── Rest day (all other adults) ─────────────────────────────────────────
  if (isRestDay) {
    const offset   = npc.bio_clock_offset
    const wakeTime = clamp(8 + offset, 6, 11)
    if (hour < wakeTime || hour >= 22) return 'resting'
    // Rest day priority: family first (morning + mid-day), then socializing, then resting
    if (hasFamily) {
      if (hour >= wakeTime && hour < 13) return 'family'    // morning with family
      if (hour >= 17 && hour < 21) return 'family'          // evening meal / bedtime routines
    }
    if (hour >= 10) return 'socializing'
    return 'resting'
  }

  // ── Night-shift workers ────────────────────────────────────────────────
  if (isNightShiftWorker(npc)) {
    const lateSleeper = scheduleUnit(npc.id, 12) < 0.35
    const sleepStart  = lateSleeper ? 10 : 8
    const sleepEnd    = lateSleeper ? 18 : 17
    if (hour >= sleepStart && hour < sleepEnd) return 'resting'
    if (hasFamily && hour >= 17 && hour < 20) return 'family'
    if (hour >= 17 && hour < 20) return 'socializing'
    return 'working'
  }

  // ── Typical working day: regime schedule + role offset + bio clock ─────
  const roleAdj   = ROLE_CONFIG[npc.role].schedule_offset
  const offset    = npc.bio_clock_offset
  const workStart = clamp(sched.work_start_hour + roleAdj.start + offset, 3, 12)
  const workEnd   = clamp(sched.work_end_hour   + roleAdj.end   + offset, 12, 22)

  // Evening window: 2–4 hours after work (was 1–3). Family NPCs spend first part with family.
  const eveningHours = 2 + Math.floor(scheduleUnit(npc.id, 1) * 3)    // 2–4 h total
  const sleepHour    = Math.min(workEnd + eveningHours, 23)
  // Family time: first 1–2 hours of evening for NPCs with spouse/children
  const familyHours  = hasFamily ? 1 + Math.floor(scheduleUnit(npc.id, 7) * 2) : 0  // 1–2 h

  if (hour >= sleepHour || hour < workStart) return 'resting'
  if (hasFamily && hour >= workEnd && hour < workEnd + familyHours) return 'family'
  if (hour >= workEnd) return 'socializing'
  return 'working'
}

function selectAction(npc: NPC, state: WorldState): ActionState {
  // Burnout override: burned-out NPCs are too exhausted for anything but compliance or rest
  if ((npc.burnout_ticks ?? 0) >= 480) {
    const hour = state.tick % 24
    return (hour >= 22 || hour < 7) ? 'resting' : 'complying'
  }

  // Overwork exhaustion: very high exhaustion forces rest regardless of stress
  if (npc.exhaustion > 90 && npc.action_state !== 'fleeing') {
    return 'resting'
  }

  // Roles that cannot enter political action states always follow their normal routine.
  // Children lack political agency; guards/leaders ARE the state apparatus.
  if (!ROLE_CONFIG[npc.role].can_protest) return normalRoutine(npc, state)

  // Sleep override: if normalRoutine says resting (sleep hours), always sleep —
  // even stressed NPCs must rest at night; political action happens while awake.
  const routineState = normalRoutine(npc, state)
  if (routineState === 'resting') return 'resting'
  // Family time is protected: stressed NPCs still go home to their family
  if (routineState === 'family') return 'family'

  if (npc.stress < npc.stress_threshold) return routineState

  const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
  const guardInst = state.institutions.find(i => i.id === 'guard')
  const govInst   = state.institutions.find(i => i.id === 'government')
  const perceivedRisk = 1 - ((guardInst?.power ?? 0.3) * 0.7 + (govInst?.power ?? 0.3) * 0.3)

  const w = npc.worldview
  const weights: Record<string, number> = {
    complying:   Math.max(0, govTrust * (1 - npc.stress / 120)),
    resting:     Math.max(0, (1 - w.collectivism) * (npc.stress / 100)),
    organizing:  Math.max(0, w.collectivism * (1 - govTrust) * (npc.grievance / 100)),
    fleeing:     Math.max(0, (1 - w.risk_tolerance) * (npc.fear / 100)),
    confront:    Math.max(0, w.risk_tolerance * (1 - govTrust) * perceivedRisk * (npc.stress / 100)),
  }

  // Macro-sensitive behavior: collapse conditions shift behavior to collective action/fleeing.
  const instability = clamp((35 - state.macro.stability) / 35, 0, 1)
  const pressure = state.macro.political_pressure / 100
  const polarization = state.macro.polarization / 100
  weights.organizing *= 1 + instability * 0.5 + pressure * 0.4 + polarization * 0.2
  weights.confront *= 1 + pressure * 0.35 + polarization * 0.25
  weights.fleeing *= 1 + instability * 0.45
  weights.complying *= 1 - Math.min(0.45, instability * 0.35 + pressure * 0.25)

  // value_priority biases: societal values shape how stressed NPCs respond.
  // pm(val) → 1.24 when val is top priority (rank 0), 1.00 when rank 3.
  const vp = state.constitution.value_priority
  const pm = (val: typeof vp[number]) => 1 + (3 - vp.indexOf(val)) * 0.08
  // security → comply/flee preferred; organizing/confront discouraged
  weights.complying  *= pm('security')
  weights.fleeing    *= pm('security')
  weights.organizing *= (2 - pm('security'))
  weights.confront   *= (2 - pm('security'))
  // freedom → confront/organize amplified; comply discouraged
  weights.confront   *= pm('freedom')
  weights.organizing *= pm('freedom')
  weights.complying  *= (2 - pm('freedom'))
  // equality → collective action amplified (shared cause against inequality)
  weights.organizing *= pm('equality')
  weights.confront   *= pm('equality')
  // growth → individual coping; less collective action
  weights.resting    *= pm('growth')
  weights.organizing *= (2 - pm('growth'))
  // Clamp all weights to non-negative
  for (const k of Object.keys(weights)) weights[k] = Math.max(0, weights[k])

  // Community group amplifies collective action: seeing group-mates organize
  // lowers the activation threshold (social proof / safety in numbers)
  if (npc.community_group !== null) {
    const groupOrganizing = npc.strong_ties.some(id => {
      const t = state.npcs[id]
      return t?.community_group === npc.community_group &&
        (t.action_state === 'organizing' || t.action_state === 'confront')
    })
    if (groupOrganizing) {
      weights.organizing = (weights.organizing ?? 0) * 1.8
      weights.confront   = (weights.confront   ?? 0) * 1.4
    }
  }

  // Personality: aggression amplifies confront/crime tendency; loyalty reduces fleeing
  if (npc.personality) {
    weights.confront   = (weights.confront ?? 0) * (1 + npc.personality.aggression * 0.5)
    weights.fleeing    = (weights.fleeing  ?? 0) * (1 - npc.personality.loyalty * 0.3)
  }

  // Enmity escalation: if an enemy is in the same zone and socializing/working,
  // highly aggressive NPCs have a chance to escalate directly to confront.
  if ((npc.enmity_ids?.length ?? 0) > 0 && npc.personality && npc.personality.aggression > 0.55) {
    const enemyNearby = (npc.enmity_ids ?? []).some(eid => {
      const enemy = state.npcs[eid]
      return enemy?.lifecycle.is_alive && enemy.zone === npc.zone
        && (enemy.action_state === 'socializing' || enemy.action_state === 'working')
    })
    if (enemyNearby) {
      weights.confront = (weights.confront ?? 0) + npc.personality.aggression * 0.4
    }
  }

  return weightedRandom(weights) as ActionState
}

// ── Grievance ──────────────────────────────────────────────────────────────

function updateGrievance(npc: NPC, state: WorldState): void {
  let delta = 0

  if (npc.hunger > 60) delta += (npc.hunger - 60) * 0.08

  const neighborAvg  = avgWealth(npc.weak_ties, state.npcs)
  // Equality-prioritizing societies feel wealth gaps more acutely (political culture effect)
  const equalityRank = state.constitution.value_priority.indexOf('equality')
  const equalityMult = 1 + (3 - equalityRank) * 0.30   // 1.90 rank-0 → 1.00 rank-3
  if (npc.wealth < neighborAvg) delta += (neighborAvg - npc.wealth) / 200 * equalityMult

  const recentBetrayal = npc.memory.find(m => m.type === 'trust_broken' && state.tick - m.tick < 720)
  if (recentBetrayal) delta += Math.abs(recentBetrayal.emotional_weight) * 0.05

  const recentHelp = npc.memory.find(m => m.type === 'helped' && state.tick - m.tick < 240)
  if (recentHelp) delta -= 4

  delta -= (npc.strong_ties.length / 15) * 1.5

  if (npc.happiness > 65) delta -= 0.8

  // Resource depletion: craftsmen and farmers feel it directly (can't work, income drops)
  if ((npc.role === 'craftsman' || npc.role === 'farmer') && state.macro.natural_resources < 20) {
    delta += (20 - state.macro.natural_resources) / 20 * 0.6
  }

  // Community group membership buffers grievance — sense of collective agency
  if (npc.community_group !== null) delta -= 0.4

  npc.grievance = clamp(npc.grievance + delta, 0, 100)
}

// ── Worldview Drift ────────────────────────────────────────────────────────
// Information-network ties (info_ties) drive ideological echo-chamber effects.
// Direct social ties (strong_ties) drive mutual radicalization when both are unstable.

function updateWorldview(npc: NPC, state: WorldState): void {
  let dDelta = 0
  if (npc.stress > npc.stress_threshold) dDelta += (npc.stress - npc.stress_threshold) * 0.08
  if (state.macro.stability < 35) dDelta += (35 - state.macro.stability) * 0.12
  if (state.macro.political_pressure > 55) dDelta += (state.macro.political_pressure - 55) * 0.06
  if (state.macro.polarization > 60) dDelta += (state.macro.polarization - 60) * 0.05
  if (npc.memory.some(m => m.type === 'trust_broken' && state.tick - m.tick < 168)) dDelta += 10
  if (npc.memory.some(m => m.type === 'windfall'     && state.tick - m.tick < 72))  dDelta -= 4
  dDelta -= (npc.strong_ties.length / 15) * 2

  npc.dissonance_acc = clamp(npc.dissonance_acc + dDelta, 0, 100)
  npc.susceptible    = npc.dissonance_acc > 60

  if (!npc.susceptible) return

  // Worldview influence comes from the information network (info_ties):
  // NPCs are shaped by what they read/watch/share, not just who they meet face-to-face.
  const infoInfluencers = npc.info_ties
    .map(id => state.npcs[id])
    .filter(Boolean)
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, 5)

  if (infoInfluencers.length > 0) {
    const dims = ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference'] as const
    // Echo-chamber check: if most info contacts share similar views, reinforce them
    const allSimilarWorldview = infoInfluencers.every(n =>
      Math.abs(n.worldview.collectivism    - npc.worldview.collectivism)    < 0.20 &&
      Math.abs(n.worldview.authority_trust - npc.worldview.authority_trust) < 0.20
    )

    for (const dim of dims) {
      const avgNeighbor = infoInfluencers.reduce((s, n) => s + n.worldview[dim], 0) / infoInfluencers.length
      // Info-network pull is stronger than direct-contact pull (media echo chamber)
      const pull = (avgNeighbor - npc.worldview[dim]) * npc.adaptability * 0.008
      npc.worldview[dim] = clamp(npc.worldview[dim] + pull, 0, 1)
    }

    if (allSimilarWorldview) {
      // Information echo chamber: shared content reinforces extreme views
      for (const dim of ['collectivism', 'authority_trust'] as const) {
        npc.worldview[dim] = npc.worldview[dim] > 0.5
          ? clamp(npc.worldview[dim] + 0.003, 0, 1)
          : clamp(npc.worldview[dim] - 0.003, 0, 1)
      }
    }
  }

  // Direct social ties (strong_ties) add a secondary mutual radicalization effect
  // when face-to-face contacts are also unstable — physical protest dynamics
  const directInfluencers = npc.strong_ties
    .map(id => state.npcs[id])
    .filter(Boolean)
    .filter(n => n.dissonance_acc >= 30)
    .slice(0, 3)

  if (directInfluencers.length >= 2) {
    // Mutual radicalization through direct contact (street-level escalation)
    for (const dim of ['collectivism', 'authority_trust'] as const) {
      npc.worldview[dim] = npc.worldview[dim] > 0.5
        ? clamp(npc.worldview[dim] + 0.002, 0, 1)
        : clamp(npc.worldview[dim] - 0.002, 0, 1)
    }
  }
}

// ── Wealth tick ────────────────────────────────────────────────────────────

// Compute a motivation factor (0–1) based on the NPC's work_motivation type.
// Different motivation types respond differently to needs and worldview.
function computeMotivationFactor(npc: NPC): number {
  switch (npc.work_motivation) {
    case 'survival':
      // Moderately hungry → works hard to eat; starving or satisfied → reduced drive
      if (npc.hunger > 70) return 0.40 + (100 - npc.hunger) / 100 * 0.25   // exhausted by hunger
      if (npc.hunger > 25) return 0.65 + (npc.hunger - 25) / 100 * 0.30    // rising urgency
      return 0.55 + (npc.happiness / 100) * 0.20                             // fed — modest effort

    case 'coerced':
      // Fear drives compliance but erodes output above threshold (terror paralysis)
      return Math.max(0.15,
        0.60 - Math.max(0, npc.fear - 50) / 100 * 0.40
        + (npc.happiness / 100) * 0.10,
      )

    case 'mandatory':
      // Steady, duty-bound output; happiness gives modest lift
      return 0.60 + (npc.happiness / 100) * 0.25

    case 'happiness':
      // Strongly happiness-driven — output tracks life satisfaction closely
      return 0.35 + (npc.happiness / 100) * 0.60

    case 'achievement':
      // Skill-expression + competition drive; happiness provides smaller bonus
      return 0.50 + npc.base_skill * 0.30 + (npc.happiness / 100) * 0.20

    case 'duty':
      // Collectivist loyalty; stable regardless of personal happiness
      return 0.55 + npc.worldview.collectivism * 0.25 + (npc.happiness / 100) * 0.10

    default:
      return 0.50 + (npc.happiness / 100) * 0.50
  }
}

export function computeProductivity(npc: NPC, state: WorldState): number {
  const motivation    = computeMotivationFactor(npc)
  const expected      = ROLE_WEALTH_EXPECTATION[npc.role]
  const fairness      = clamp(npc.wealth / Math.max(expected, 1), 0, 2.0)
  // Below expectation → penalty (under-resourced, unmotivated); above → no bonus (incentive satisfied)
  const fairnessPenalty = fairness < 1.0 ? (1.0 - fairness) * 0.18 : 0
  const stressPenalty   = Math.min(npc.stress / 120, 0.65)   // capped at 65% to prevent death spiral
  const sickPenalty     = npc.sick ? 0.40 : 0
  const ageFactor       = ageProductivityFactor(npc.age)
  // Resource scarcity penalty — craftsmen need raw materials, farmers need fertile land/water
  // Craftsmen hit hard below 20% (can't process without inputs)
  // Farmers hit below 30% (soil degradation, water scarcity)
  const resourcePenalty = npc.role === 'craftsman'
    ? (state.macro.natural_resources < 20 ? (20 - state.macro.natural_resources) / 20 * 0.55 : 0)
    : npc.role === 'farmer'
      ? (state.macro.natural_resources < 30 ? (30 - state.macro.natural_resources) / 30 * 0.35 : 0)
      : 0
  // Fatigue penalty: exhaustion above 50 progressively reduces output (max 40% at 100)
  const fatiguePenalty = npc.exhaustion > 50
    ? (npc.exhaustion - 50) / 50 * 0.40
    : 0
  // Burnout penalty: chronic overwork severely reduces output
  const burnoutPenalty = (npc.burnout_ticks ?? 0) >= 480 ? 0.50 : 0
  // Short retraining phase after voluntary career change: output is temporarily lower.
  const retrainingPenalty = (npc.role_retraining_until_tick ?? -1) > state.tick ? 0.18 : 0
  // Strike: participating workers produce nothing
  if (npc.on_strike) return 0
  // Capital multiplier: owning means of production amplifies output efficiency.
  // Renting has slight overhead drag; no access at all imposes a bare-hands penalty.
  // Guards and children are exempt (state-supplied or no production role).
  const capitalMult = (npc.role === 'guard' || npc.role === 'child')
    ? 1.0
    : (npc.capital ?? 0) > 0
      ? 1.0 + (npc.capital / 100) * 0.35   // own capital: up to +35%
      : (npc.capital_rents_from != null)
        ? 0.92                               // renting: -8% overhead
        : 0.82                               // bare-hands: -18%
  return Math.max(0.08,
    npc.base_skill * motivation * ageFactor
    * capitalMult
    * (1 - fairnessPenalty)
    * (1 - stressPenalty)
    * (1 - sickPenalty)
    * (1 - resourcePenalty)
    * (1 - fatiguePenalty)
    * (1 - burnoutPenalty)
    * (1 - retrainingPenalty)
  )
}

// ── Wealth tick ────────────────────────────────────────────────────────────
// Labor income + 3 trade modes:
//   Merchant-as-seller: earns markup (profit) on each transaction
//   Non-merchant P2P:   wealth flows from richer to poorer (barter/gifts)
//   Merchant lending:   offers loans to poor neighbors at 30% interest

// ── Role-based income sources (derived from ROLE_CONFIG) ─────────────────
// Government-paid roles (guard, leader) earn via the tax pool, not market labor.

function wealthTick(npc: NPC, state: WorldState): void {
  if (npc.role === 'child') return
  if (npc.action_state === 'fleeing' || npc.action_state === 'confront') return

  const productivity = computeProductivity(npc, state)

  // Gross earned income: always non-negative, scales with productivity.
  // Government-paid roles earn 0 from market labor (paid via tax pool instead).
  const incomeRate   = ROLE_CONFIG[npc.role].income_rate
  const grossIncome  = productivity * incomeRate

  // ── Farmer → Merchant supply-chain bonus ────────────────────────────────
  // Farmers with merchant contacts earn extra income by selling surplus
  // produce. Merchants within strong-ties benefit proportionally.
  // trade_mult restricts this in regimes where lords/state mediate all markets.
  // This runs once per day (staggered per NPC id) while the farmer is working.
  if (npc.role === 'farmer' && npc.action_state === 'working'
      && state.tick % 24 === npc.id % 24
      && state.constitution.market_freedom >= 0.10
      && _simRestrictions.trade_mult > 0.20) {
    const farmerSurplusRate = clamp(productivity - 0.3, 0, 1) * 0.8  // surplus above subsistence
    if (farmerSurplusRate > 0) {
      for (const tid of npc.strong_ties.slice(0, 4)) {
        const merchant = state.npcs[tid]
        if (!merchant?.lifecycle.is_alive || merchant.role !== 'merchant') continue
        // Farmer sells produce to merchant — regime trade_mult scales the volume
        const saleValue = farmerSurplusRate * 3 * state.constitution.market_freedom * _simRestrictions.trade_mult
        const buyerCost = saleValue * 0.7  // merchant pays 70%; keeps 30% as inventory margin
        if (merchant.wealth >= buyerCost) {
          npc.wealth      = clamp(npc.wealth      + saleValue,   0, 50000)
          merchant.wealth = clamp(merchant.wealth - buyerCost,   0, 50000)
        }
        break  // one sale per day per farmer
      }
    }
  }

  // ── Craftsman resource dependency ──────────────────────────────────────
  // Craftsmen buy raw materials from merchants or farmers when available.
  // Without a supply source, they can still work at reduced efficiency
  // (resource penalty already applied in computeProductivity).
  if (npc.role === 'craftsman' && npc.action_state === 'working'
      && state.tick % 24 === npc.id % 24
      && state.constitution.market_freedom >= 0.10
      && _simRestrictions.trade_mult > 0.20) {
    for (const tid of npc.strong_ties.slice(0, 4)) {
      const supplier = state.npcs[tid]
      if (!supplier?.lifecycle.is_alive) continue
      if (supplier.role !== 'merchant' && supplier.role !== 'farmer') continue
      const materialCost = 1.5 * state.constitution.market_freedom * _simRestrictions.trade_mult
      if (supplier.wealth >= materialCost * 2) {
        // Craftsman pays for raw materials — supplier earns income
        npc.wealth      = clamp(npc.wealth      - materialCost, 0, 50000)
        supplier.wealth = clamp(supplier.wealth + materialCost, 0, 50000)
      }
      break  // one purchase per day
    }
  }

  // Net wealth change: gross earnings minus cost of living.
  // Government-paid roles still pay survival cost (deducted, compensated by wages).
  const laborIncome = ROLE_CONFIG[npc.role].govt_paid
    ? -NPC_SURVIVAL_COST_PER_TICK                  // only cost of living; wages come from tax pool
    : grossIncome - NPC_SURVIVAL_COST_PER_TICK     // net market income

  npc.wealth = clamp(npc.wealth + laborIncome, 0, 50000)

  // ── Consumer spending flows to merchants ────────────────────────────────
  // Survival cost represents daily purchases (food, shelter, goods).
  // A fraction flows to a nearby merchant, simulating real market circulation.
  // Only when market freedom allows trade and NPC has enough wealth.
  if (npc.wealth > 1 && state.constitution.market_freedom >= 0.15 && state.tick % 6 === npc.id % 6) {
    const spendAmount = NPC_SURVIVAL_COST_PER_TICK * 6 * 0.5  // half of 6-tick spending
    const merchant = (() => {
      for (const tid of npc.weak_ties) {
        const t = state.npcs[tid]
        if (t?.lifecycle.is_alive && t.role === 'merchant') return t
      }
      for (const tid of npc.strong_ties) {
        const t = state.npcs[tid]
        if (t?.lifecycle.is_alive && t.role === 'merchant') return t
      }
      return null
    })()
    if (merchant) {
      npc.wealth     = clamp(npc.wealth - spendAmount, 0, 50000)
      merchant.wealth = clamp(merchant.wealth + spendAmount, 0, 50000)
    }
  }

  // Daily income: exponential moving average of gross daily earnings.
  // EMA of daily income (coins/day). Factor 0.01 matches the govt wages formula so
  // both market and state workers sit on the same scale: converges to grossIncome × 24.
  npc.daily_income = npc.daily_income * 0.99 + grossIncome * 24 * 0.01

  // ── Shadow market (planned economies, criminals only) ─────────────────
  // Criminal NPCs in low-market-freedom societies earn illicit income by
  // trading outside state oversight — selling surplus food/goods at black prices.
  const mfCheck = state.constitution.market_freedom
  if (npc.criminal_record && mfCheck < 0.25 && npc.action_state === 'socializing'
      && state.tick % 12 === npc.id % 12 && Math.random() < 0.15) {
    const illicit = 20 + Math.random() * 25
    npc.wealth = clamp(npc.wealth + illicit, 0, 50000)
    // Sell food to hungry neighbors at a black-market premium
    for (const tid of npc.strong_ties.slice(0, 2)) {
      const buyer = state.npcs[tid]
      if (!buyer?.lifecycle.is_alive || buyer.wealth < 15 || buyer.hunger < 45) continue
      if (Math.random() < 0.50) {
        buyer.wealth = clamp(buyer.wealth - 12, 0, 50000)
        buyer.hunger = clamp(buyer.hunger - 18, 0, 100)
        npc.wealth   = clamp(npc.wealth   + 12, 0, 50000)
      }
    }
  }

  // ── Capital rental market (once per day, staggered by NPC id) ──────────────
  // Landless workers find a capital owner in their network to rent from.
  // Disabled in state-ownership or collective regimes (no private capital rental).
  if (npc.role !== 'guard'
      && _simRestrictions.rent_market                // regime allows private rental
      && state.constitution.market_freedom >= 0.10   // and economy has market activity
      && state.tick % 24 === npc.id % 24) {

    if ((npc.capital ?? 0) === 0) {
      // Re-validate existing rental arrangement
      if (npc.capital_rents_from != null) {
        const owner = state.npcs[npc.capital_rents_from]
        if (!owner?.lifecycle.is_alive || (owner.capital ?? 0) < 5) {
          npc.capital_rents_from = null
          npc.capital_rent_paid  = 0
        }
      }
      // Search network for an available capital owner
      if (npc.capital_rents_from == null) {
        const candidates = [...npc.strong_ties, ...npc.weak_ties.slice(0, 12)]
        for (const tid of candidates) {
          const owner = state.npcs[tid]
          if (!owner?.lifecycle.is_alive || owner.id === npc.id) continue
          if ((owner.capital ?? 0) >= 10) { npc.capital_rents_from = owner.id; break }
        }
      }
      // Pay daily rent to owner
      if (npc.capital_rents_from != null) {
        const owner = state.npcs[npc.capital_rents_from]
        if (owner?.lifecycle.is_alive) {
          const dailyRent   = (owner.capital / 100) * 0.50  // proportional to owner's capital
          const perTickRent = dailyRent / 24
          npc.capital_rent_paid = perTickRent
          if (npc.wealth >= dailyRent * 0.5) {
            npc.wealth   = clamp(npc.wealth   - perTickRent, 0, 50000)
            owner.wealth = clamp(owner.wealth + perTickRent, 0, 50000)
          } else {
            // Can't afford rent → grievance builds
            npc.grievance = clamp((npc.grievance ?? 0) + 0.08, 0, 100)
          }
        }
      }
    } else {
      // Owner: clear stale rental reference and reset rent tracking
      npc.capital_rents_from = null
      npc.capital_rent_paid  = 0
    }

    // Slow capital accumulation from wealth surplus (wealthy NPCs invest over time)
    if ((npc.capital ?? 0) < 100
        && npc.wealth > ROLE_WEALTH_EXPECTATION[npc.role] * 2
        && state.constitution.market_freedom >= 0.15) {
      const accumRate = 0.05 * (npc.wealth / Math.max(ROLE_WEALTH_EXPECTATION[npc.role], 100))
      npc.capital = clamp((npc.capital ?? 0) + accumRate, 0, 100)
    }
  }

  // ── P2P trade (every 12 ticks, staggered by id) ────────────────────────
  // trade_mult stacks with market_freedom: regime restrictions reduce trade volume
  // independently of the market-freedom slider (e.g. feudal lord-controlled markets).
  if (npc.action_state === 'socializing' && state.tick % 12 === npc.id % 12) {
    const mf = state.constitution.market_freedom * _simRestrictions.trade_mult
    for (const tid of npc.strong_ties.slice(0, 3)) {
      const partner = state.npcs[tid]
      if (!partner?.lifecycle.is_alive) continue

      // Commerce discovery boosts merchant trade efficiency
      const effectiveMarkup = NPC_MERCHANT_MARKUP + ((state.discoveries ?? []).some(d => d.id === 'commerce') ? 0.05 : 0)
      if (npc.role === 'merchant') {
        // Planned economies suppress private trade — merchants can't earn markup
        if (mf < 0.15) continue
        const price = 0.5 * mf
        if (partner.wealth >= price * 3) {
          partner.wealth = clamp(partner.wealth - price, 0, 50000)
          npc.wealth     = clamp(npc.wealth + price * (1 + effectiveMarkup), 0, 50000)
        }
      } else if (partner.role === 'merchant') {
        if (mf < 0.15) continue
        const price = 0.5 * mf
        if (npc.wealth >= price * 3) {
          npc.wealth     = clamp(npc.wealth - price, 0, 50000)
          partner.wealth = clamp(partner.wealth + price * (1 + effectiveMarkup), 0, 50000)
        }
      } else {
        // Non-merchant barter: richer gives to poorer
        if (npc.wealth > partner.wealth + 10) {
          const transfer = 0.2 * mf * Math.min(1, (npc.wealth - partner.wealth) / 500)
          npc.wealth     = clamp(npc.wealth     - transfer, 0, 50000)
          partner.wealth = clamp(partner.wealth + transfer * NPC_TRADE_EFFICIENCY, 0, 50000)
        }
      }
    }
  }

  // ── Merchant lending (once per day, staggered) ─────────────────────────
  // Planned economies and usury-banning regimes block private lending.
  if (npc.role === 'merchant' && npc.wealth > 1000
      && _simRestrictions.private_lending            // regime allows private lending
      && state.constitution.market_freedom >= 0.20   // and market is active enough
      && npc.action_state === 'socializing'
      && state.tick % 24 === npc.id % 24) {
    for (const tid of npc.strong_ties.slice(0, 3)) {
      const borrower = state.npcs[tid]
      if (!borrower?.lifecycle.is_alive || borrower.role === 'child') continue
      if (borrower.debt > 0 || borrower.wealth > 300) continue   // already in debt or not poor
      if (Math.random() > 0.05) continue                          // 5% chance per eligible neighbor/day

      const loan = clamp(npc.wealth * 0.08, 50, 300)
      npc.wealth      = clamp(npc.wealth - loan, 0, 50000)
      borrower.wealth  = clamp(borrower.wealth + loan, 0, 50000)
      borrower.debt    = loan * 1.30   // 30% total interest
      borrower.debt_to = npc.id
      borrower.memory.push({
        event_id: 'loan_' + state.tick,
        type: 'helped',
        emotional_weight: 20,
        tick: state.tick,
      })
      if (borrower.memory.length > 10) borrower.memory.shift()
      break   // one loan per merchant per day
    }
  }

  // ── Debt repayment / default (once per day, staggered) ────────────────
  if (npc.debt > 0 && npc.debt_to !== null && state.tick % 24 === npc.id % 24) {
    const creditor = state.npcs[npc.debt_to]
    if (!creditor?.lifecycle.is_alive) {
      // Creditor dead — debt forgiven
      npc.debt = 0; npc.debt_to = null
    } else if (npc.wealth < 5) {
      // Default: too poor to repay → creditor loses 50%, NPC gets fear/grievance
      creditor.wealth = clamp(creditor.wealth - npc.debt * 0.50, 0, 50000)
      creditor.trust_in.community.intention = clamp(creditor.trust_in.community.intention - 0.04, 0, 1)
      npc.fear      = clamp(npc.fear      + 20, 0, 100)
      npc.grievance  = clamp(npc.grievance  + 15, 0, 100)
      npc.debt = 0; npc.debt_to = null
    } else {
      // Normal repayment: 5% of current wealth per day
      const repayment = Math.min(npc.debt, npc.wealth * 0.05)
      npc.wealth      = clamp(npc.wealth      - repayment, 0, 50000)
      creditor.wealth  = clamp(creditor.wealth + repayment, 0, 50000)
      npc.debt -= repayment
      if (npc.debt < 0.01) { npc.debt = 0; npc.debt_to = null }
    }
  }
}

// ── Lifecycle checks ───────────────────────────────────────────────────────

export type IndividualEvent = { type: 'accident' | 'illness' | 'recovery' | 'crime' | 'overwork' | 'burnout'; npc: NPC }

function checkLifecycle(npc: NPC, state: WorldState, events?: IndividualEvent[]): void {
  // Natural death by age
  if (npc.age > 70) {
    const deathChance = (npc.age - 70) * 0.0006   // per tick — Gompertz-like curve
    if (Math.random() < deathChance) {
      npc.lifecycle.is_alive   = false
      npc.lifecycle.death_cause = 'natural'
      npc.lifecycle.death_tick  = state.tick
      return
    }
  }

  // Death by starvation — scaled by how long and how severely starving
  // At hunger=99: ~6%/day base. Elderly (>60) or sick die faster.
  if (npc.hunger >= 85) {
    const severityMult = (npc.hunger - 85) / 15   // 0 at 85, 1 at 100
    const ageMult = npc.age > 60 ? 1.8 : npc.age < 10 ? 1.5 : 1.0
    const sickMult = npc.sick ? 2.0 : 1.0
    const deathP = 0.0025 * severityMult * ageMult * sickMult
    if (Math.random() < deathP) {
      npc.lifecycle.is_alive   = false
      npc.lifecycle.death_cause = 'starvation'
      npc.lifecycle.death_tick  = state.tick
      return
    }
  }

  // Death by environmental degradation — low natural resources → polluted water/air
  // When resources < 15% the environment is severely degraded; NPCs get sick and die faster.
  if (state.macro.natural_resources < 15) {
    const pollutionP = (15 - state.macro.natural_resources) / 15   // 0–1
    const envDeathP = 0.00008 * pollutionP * (npc.sick ? 3 : 1) * (npc.age > 55 ? 1.5 : 1)
    if (Math.random() < envDeathP) {
      npc.lifecycle.is_alive   = false
      npc.lifecycle.death_cause = 'disease'
      npc.lifecycle.death_tick  = state.tick
      return
    }
    // Also: polluted environment makes NPCs sick more often (added to illness onset below)
  }

  // ★ Illness tick-down & death
  if (npc.sick) {
    // Public health: hospital_capacity > 0 → sick NPCs in clinic_district or scholar_quarter recover 2× faster
    const inHospitalZone = (npc.zone === 'clinic_district' || npc.zone === 'scholar_quarter') && (state.public_health?.hospital_capacity ?? 0) > 0
    const recoveryRate = inHospitalZone ? 2 : 1
    npc.sick_ticks -= recoveryRate
    if (npc.sick_ticks <= 0) {
      npc.sick = false
      events?.push({ type: 'recovery', npc })
    } else if (npc.sick_ticks % 24 === 0) {
      // Daily mortality while sick: base 0.1% + hunger/exhaustion factor
      const deathP = 0.001 + (npc.hunger / 100 + npc.exhaustion / 100) * 0.002
      if (Math.random() < deathP) {
        npc.lifecycle.is_alive   = false
        npc.lifecycle.death_cause = 'disease'
        npc.lifecycle.death_tick  = state.tick
        return
      }
    }
  }

  // ★ Random illness onset — elderly get sick more often
  if (!npc.sick) {
    const medicineMult = (state.discoveries ?? []).some(d => d.id === 'medicine') ? 0.50 : 1.0
    // Environmental pollution: low natural resources → contaminated water/air → more illness
    const pollutionMult = state.macro.natural_resources < 20
      ? 1 + (20 - state.macro.natural_resources) / 20 * 2.5   // up to 3.5× at resources=0
      : 1.0
    // Public health: disease_resistance reduces sickness probability
    const healthMult = 1 - (state.public_health?.disease_resistance ?? 0) * 0.5
    const sicknessP = 0.00006
      * ageIllnessMult(npc.age)
      * medicineMult
      * pollutionMult
      * healthMult
      * (1 + npc.exhaustion / 80)
      * (1 + npc.hunger / 80)
      * (1 + (state.active_events.some(e => e.type === 'epidemic') ? 4 : 0))
    if (Math.random() < sicknessP) {
      npc.sick = true
      npc.sick_ticks = (5 + Math.random() * 10 | 0) * 24   // 5–15 sim-days
      npc.exhaustion = clamp(npc.exhaustion + 30, 0, 100)
      events?.push({ type: 'illness', npc })
    }
  }

  // ★ Overwork collapse — working at extreme exhaustion risks sudden illness
  // Simulates physical collapse from chronic fatigue. Higher chance when very exhausted.
  if (!npc.sick && npc.exhaustion > 85 && npc.action_state === 'working') {
    const collapseProbability = (npc.exhaustion - 85) / 15 * 0.003 * ageExhaustionModifier(npc.age)
    if (Math.random() < collapseProbability) {
      npc.sick = true
      npc.sick_ticks = (3 + Math.random() * 7 | 0) * 24   // 3–10 sim-days
      npc.exhaustion = 100
      npc.stress = clamp(npc.stress + 15, 0, 100)
      events?.push({ type: 'overwork', npc })
    }
  }

  // ★ Accident (risk scales with fear, exhaustion, fleeing/confront action)
  if (state.tick % 3 === npc.id % 3) {   // stagger checks: every 3 ticks per NPC
    const dangerMod = npc.action_state === 'fleeing' || npc.action_state === 'confront' ? 3 : 1
    const rawMult = (1 + npc.exhaustion / 100) * (1 + npc.fear / 100)
    const accP = 0.00005
      * dangerMod
      * Math.min(rawMult, 2.5)   // cap multiplier to prevent crisis explosion
    if (Math.random() < accP) {
      const fatal = Math.random() < 0.15   // 15% of accidents are fatal
      if (fatal) {
        npc.lifecycle.is_alive   = false
        npc.lifecycle.death_cause = 'accident'
        npc.lifecycle.death_tick  = state.tick
        return
      }
      npc.exhaustion = clamp(npc.exhaustion + 40, 0, 100)
      npc.fear       = clamp(npc.fear + 20, 0, 100)
      npc.wealth     = clamp(npc.wealth - npc.wealth * 0.15, 0, 5000)  // medical cost
      npc.memory.push({ event_id: 'accident_' + state.tick, type: 'accident', emotional_weight: -40, tick: state.tick })
      if (npc.memory.length > 10) npc.memory.shift()
      events?.push({ type: 'accident', npc })
    }
  }

  // ★ Crime: first offense — grievance + poverty + low trust in government
  // Aggression personality amplifies crime probability; guards deter more.
  if (!npc.criminal_record && state.tick % 6 === npc.id % 6) {
    const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    const aggressionBoost = 1 + (npc.personality?.aggression ?? 0) * 1.5
    const crimeP = 0.00004
      * Math.max(0, npc.grievance - 50) / 50
      * (1 - govTrust)
      * (npc.wealth < 30 ? 2 : 1)
      * aggressionBoost
    if (Math.random() < crimeP) {
      npc.criminal_record = true
      npc.wealth = clamp(npc.wealth + 15 + Math.random() * 20, 0, 5000)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.10, 0, 1)
      npc.trust_in.community.intention  = clamp(npc.trust_in.community.intention  - 0.08, 0, 1)
      npc.grievance = clamp(npc.grievance - 15, 0, 100)
      npc.memory.push({ event_id: 'crime_' + state.tick, type: 'crime', emotional_weight: -20, tick: state.tick })
      if (npc.memory.length > 10) npc.memory.shift()
      for (const tid of npc.strong_ties.slice(0, 3)) {
        const witness = state.npcs[tid]
        if (witness?.lifecycle.is_alive) {
          witness.trust_in.community.intention = clamp(witness.trust_in.community.intention - 0.04, 0, 1)
          witness.grievance = clamp(witness.grievance + 5, 0, 100)
          // Witnesses develop enmity toward the criminal perpetrator
          addEnmity(witness, npc.id)
        }
      }
      events?.push({ type: 'crime', npc })
    }
  }

  // ★ Recidivism: repeat offenders reoffend at higher rate, lower threshold
  if (npc.criminal_record && state.tick % 6 === npc.id % 6) {
    const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    const aggressionBoost = 1 + (npc.personality?.aggression ?? 0) * 1.0
    const recidivismP = 0.00008
      * Math.max(0, npc.grievance - 30) / 70
      * (1 - govTrust)
      * (npc.wealth < 50 ? 2 : 1)
      * aggressionBoost
    if (Math.random() < recidivismP) {
      npc.wealth = clamp(npc.wealth + 25 + Math.random() * 35, 0, 5000)
      npc.grievance = clamp(npc.grievance - 10, 0, 100)
      // Witnesses react more strongly to known repeat offenders and develop enmity
      for (const tid of npc.strong_ties.slice(0, 3)) {
        const witness = state.npcs[tid]
        if (witness?.lifecycle.is_alive) {
          witness.trust_in.community.intention = clamp(witness.trust_in.community.intention - 0.06, 0, 1)
          witness.fear     = clamp(witness.fear     + 5, 0, 100)
          witness.grievance = clamp(witness.grievance + 8, 0, 100)
          addEnmity(witness, npc.id)
        }
      }
      events?.push({ type: 'crime', npc })
    }
  }

  // ★ Guard detection: scaled by guard power AND individual_rights_floor
  // High rights → due process makes arbitrary arrest harder
  // Low rights  → suspects can be arrested on little evidence
  if (npc.criminal_record && state.tick % 24 === npc.id % 24) {
    // Natural desistance: criminals with low grievance can reform over time
    if (npc.grievance < 30 && Math.random() < 0.001) {
      npc.criminal_record = false
    }

    const guardInst = state.institutions.find(i => i.id === 'guard')
    const rights     = state.constitution.individual_rights_floor
    // High rights = harder to catch (legal protections); low rights = arbitrary enforcement
    const detectionP = (guardInst?.power ?? 0.3) * 0.04 * (1 - rights * 0.55)
    if (Math.random() < detectionP) {
      // Low rights = brutal punishment; high rights = lighter fine + due process
      const fearDelta  = Math.round(15 + (1 - rights) * 25)   // 15–40
      const fineFrac   = 0.15 + (1 - rights) * 0.20           // 15–35% of wealth
      const trustLoss  = 0.04 + (1 - rights) * 0.06           // 0.04–0.10
      npc.fear      = clamp(npc.fear      + fearDelta,          0, 100)
      npc.wealth    = clamp(npc.wealth    - npc.wealth * fineFrac, 0, 50000)
      npc.isolation = clamp(npc.isolation + 25,                 0, 100)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - trustLoss, 0, 1)
      npc.memory.push({ event_id: 'arrested_' + state.tick, type: 'harmed', emotional_weight: -60, tick: state.tick })
      if (npc.memory.length > 10) npc.memory.shift()
    }
  }

  // ★ Illness contagion: sick NPC infects strong-tie contacts
  if (npc.sick && state.tick % 24 === npc.id % 24) {   // once per sim-day
    const spreadP = 0.08 * (npc.sick_ticks / 240)  // more contagious when recently infected
    for (const tid of npc.strong_ties) {
      const contact = state.npcs[tid]
      if (contact?.lifecycle.is_alive && !contact.sick && Math.random() < spreadP) {
        contact.sick       = true
        contact.sick_ticks = (4 + Math.random() * 8 | 0) * 24
        contact.exhaustion = clamp(contact.exhaustion + 20, 0, 100)
      }
    }
  }

  // Age up once per sim-year (360 days × 24 = 8640 ticks/year)
  if (state.tick > 0 && state.tick % 8640 === npc.id % 8640) {
    npc.age++
    npc.lifecycle.fertility = fertilityByAge(npc.age, npc.gender)

    // Career transition: children become adults at 18 and choose an occupation
    if (npc.role === 'child' && npc.age >= 18) {
      transitionToAdultCareer(npc, state)
    }
  }
}

// ── Career transition (child → adult) ─────────────────────────────────────
// When a child turns 18, they are assigned an adult role based on:
//   1. Parent role (social class / apprenticeship — boosts parent's role weight by 40%)
//   2. Constitution role_ratios (societal demand — base weight ×35)
//   3. Personal worldview (individual aptitude — additional ±15 points per dimension)
// 'leader' is suppressed for born-in-society NPCs unless the society is feudal.

function transitionToAdultCareer(npc: NPC, state: WorldState): void {
  const adultRoles: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader']
  const ratios = state.constitution.role_ratios
  const wv = npc.worldview

  // Base weights from constitution's role demand
  const weights: Record<string, number> = {
    farmer:    ratios.farmer * 35,
    craftsman: ratios.craftsman * 35,
    merchant:  ratios.merchant * 35,
    scholar:   ratios.scholar * 35,
    guard:     ratios.guard * 35,
    leader:    ratios.leader * 35,
  }

  // Worldview adjustments (personal inclination)
  weights.guard    += wv.authority_trust * 15 + wv.risk_tolerance * 5
  weights.leader   += wv.authority_trust * 10 + wv.time_preference * 8
  weights.scholar  += wv.time_preference * 12 + (1 - wv.risk_tolerance) * 5
  weights.merchant += wv.risk_tolerance * 15 + (1 - wv.collectivism) * 8
  weights.farmer   += wv.collectivism * 8 + wv.time_preference * 5
  weights.craftsman += wv.time_preference * 8 + wv.collectivism * 5

  // Parent role bonus: find the NPC whose children_ids includes this NPC — that is the parent.
  // Check via strong_ties (parent was added to network at birth).
  for (const tid of npc.strong_ties) {
    const contact = state.npcs[tid]
    if (contact?.lifecycle.children_ids.includes(npc.id) && contact.role !== 'child') {
      // This contact is a parent — class inheritance boosts their role by 40%
      const parentRole = contact.role
      if (parentRole in weights) {
        weights[parentRole] = (weights[parentRole] ?? 0) * 1.4
      }
      break
    }
  }

  // In planned economies, merchant role is absorbed into craftsman
  if (state.constitution.market_freedom < 0.10) {
    weights.craftsman = (weights.craftsman ?? 0) + (weights.merchant ?? 0)
    weights.merchant  = 0.001
  }

  // Suppress the 'leader' role for society-born NPCs (leaders emerge from adult selection,
  // not from hereditary birth — unless it's a feudal/high-inequality society)
  const isFeudal = state.constitution.gini_start > 0.60 && state.constitution.state_power > 0.50
  if (!isFeudal) weights.leader *= 0.3

  // Ensure all weights are positive
  for (const role of adultRoles) {
    if (weights[role] <= 0) weights[role] = 0.1
  }

  // Pick role using weighted random selection
  const selectedRole = weightedRandom(weights as Record<string, number>) as Role
  npc.role            = selectedRole
  npc.zone            = assignZone(selectedRole)
  npc.home_zone       = npc.zone   // critical: update work zone so updateZone routes correctly
  npc.occupation      = tOccVariant(selectedRole, getRegimeProfile(state.constitution).variant)
  npc.work_motivation = inferMotivationType(selectedRole, state.constitution, npc.id)
  npc.description     = generateDescription(npc)  // refresh description with new role

  // Capital: blend parent inheritance with role-based starting capital
  const parent = npc.strong_ties
    .map(tid => state.npcs[tid])
    .find(c => c?.lifecycle.children_ids.includes(npc.id))
  const parentCapital = parent?.capital ?? 0
  npc.capital            = clamp(Math.round(parentCapital * 0.3 + initialCapital(selectedRole, state.constitution) * 0.7), 0, 100)
  npc.capital_rents_from = null
  npc.capital_rent_paid  = 0
}

// ── Trust update ───────────────────────────────────────────────────────────

// ── Role switching helpers ─────────────────────────────────────────────────
// Used by roles.ts for emergency reassignments and crisis reversions.
// Encapsulated here because they need access to private helpers
// (assignZone, tOccVariant, inferMotivationType, generateDescription).

/**
 * Switch an NPC to a new role, preserving their original role for later reversion.
 * Safe to call multiple times — original_role is only set on the first call.
 */
export function switchNPCRole(npc: NPC, newRole: Role, state: WorldState): void {
  if (npc.original_role === undefined) {
    npc.original_role       = npc.role
    npc.emergency_role_tick = state.tick
  }
  npc.role            = newRole
  npc.zone            = assignZone(newRole)
  npc.home_zone       = npc.zone
  npc.occupation      = tOccVariant(newRole, getRegimeProfile(state.constitution).variant)
  npc.work_motivation = inferMotivationType(newRole, state.constitution, npc.id)
  npc.daily_income   *= 0.5   // learning curve — income resets as they adapt to new role
  npc.description     = generateDescription(npc)
}

/**
 * Permanently change an NPC's role (manual edits, god-agent interventions).
 * Unlike switchNPCRole, this clears any emergency tracking so the change
 * is treated as the NPC's new permanent career — not reverted by crisis logic.
 */
export function permanentRoleChange(npc: NPC, newRole: Role, state: WorldState): void {
  npc.role                 = newRole
  npc.zone                 = assignZone(newRole)
  npc.home_zone            = npc.zone
  npc.occupation           = tOccVariant(newRole, getRegimeProfile(state.constitution).variant)
  npc.work_motivation      = inferMotivationType(newRole, state.constitution, npc.id)
  npc.original_role        = undefined   // this is not an emergency switch — treat as permanent
  npc.emergency_role_tick  = undefined
  npc.description          = generateDescription(npc)
}

/**
 * Revert an NPC to their pre-emergency role.
 * No-op if NPC has no saved original_role.
 */
export function revertNPCRole(npc: NPC, state: WorldState): void {
  if (npc.original_role === undefined) return
  const orig          = npc.original_role
  npc.role            = orig
  npc.zone            = assignZone(orig)
  npc.home_zone       = npc.zone
  npc.occupation      = tOccVariant(orig, getRegimeProfile(state.constitution).variant)
  npc.work_motivation = inferMotivationType(orig, state.constitution, npc.id)
  npc.daily_income   *= 0.7   // partial income recovery — skills haven't fully atrophied
  npc.original_role        = undefined
  npc.emergency_role_tick  = undefined
  npc.description     = generateDescription(npc)
}

export function updateTrust(
  npc: NPC,
  institutionId: keyof TrustMap,
  eventType: NpcTrustEvent,
  magnitude = 1.0,
): void {
  const t = npc.trust_in[institutionId]
  const d = NPC_TRUST_DELTAS[eventType]
  t.competence = clamp(t.competence + d.competence * magnitude, 0, 1)
  t.intention  = clamp(t.intention  + d.intention  * magnitude, 0, 1)

  // Intention once badly broken: recovery is slow and capped at 0.65
  // (trust is rebuilt through sustained good governance, not instantly)
  if (t.intention < 0.1 && d.intention > 0) {
    t.intention = Math.min(t.intention + d.intention * magnitude, 0.65)
  }
}
