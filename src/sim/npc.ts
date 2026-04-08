import type { NPC, Constitution, WorldState, Role, TrustMap, ActionState, WorkMotivationType, WorkSchedule } from '../types'
import { faker } from '@faker-js/faker'
import { clamp, gaussian, rand, randInt, weightedRandom, getSeason, ZONE_ADJACENCY } from './constitution'
import { t, tf, tOcc } from '../i18n'

// ── Constants ──────────────────────────────────────────────────────────────

const VALUE_WORLDVIEW_BIAS: Record<string, Partial<Record<string, number>>> = {
  security: { authority_trust: +0.15, risk_tolerance: -0.10, collectivism: +0.05 },
  equality: { collectivism: +0.20, authority_trust: +0.05 },
  freedom:  { risk_tolerance: +0.15, collectivism: -0.10, authority_trust: -0.10 },
  growth:   { time_preference: +0.20, risk_tolerance: +0.10 },
}

const ROLE_WORLDVIEW_BONUS: Record<Role, Partial<Record<string, number>>> = {
  guard:     { authority_trust: +0.20, risk_tolerance: +0.10 },
  leader:    { authority_trust: +0.10, time_preference: +0.20, collectivism: +0.10 },
  farmer:    { collectivism: +0.10, time_preference: +0.05 },
  scholar:   { risk_tolerance: -0.05, time_preference: +0.15 },
  merchant:  { collectivism: -0.15, risk_tolerance: +0.10 },
  craftsman: {},
  child:     {},
}

export const ROLE_WEALTH_EXPECTATION: Record<Role, number> = {
  leader:    1200,
  merchant:  1000,
  scholar:   800,
  craftsman: 600,
  guard:     550,
  farmer:    450,
  child:     0,   // children have no income expectation
}

// ── Role-based exhaustion rates (per tick while working) ────────────────────
// Different jobs tire workers at different rates. Guards and farmers do heavy
// physical labor; scholars and merchants do lighter mental/social work.

const ROLE_EXHAUSTION_RATE: Record<Role, number> = {
  guard:     0.55,   // heavy physical (patrols, standing watch)
  farmer:    0.50,   // hard manual labor
  craftsman: 0.40,   // skilled physical work
  leader:    0.25,   // administrative stress
  merchant:  0.25,   // moderate (negotiation, travel)
  scholar:   0.20,   // mental work, lighter physical demand
  child:     0.10,   // light activity
}

// ── Age-based exhaustion modifier ──────────────────────────────────────────
// Younger workers have more stamina; elderly tire faster.

function ageExhaustionModifier(age: number): number {
  if (age < 22)  return 0.85   // youthful energy
  if (age < 42)  return 1.00   // prime years
  if (age < 56)  return 1.15   // slight mid-life increase
  if (age < 66)  return 1.35   // noticeable
  return 1.60                   // elderly — significant fatigue
}

// ── Age-based rest recovery modifier ───────────────────────────────────────
// Elderly recover more slowly from exhaustion.

function ageRestModifier(age: number): number {
  if (age < 30)  return 1.10   // youthful bounce-back
  if (age < 50)  return 1.00   // baseline
  if (age < 65)  return 0.85   // slower recovery
  return 0.70                   // elderly — much slower recovery
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
  if (role === 'merchant')  { weights.achievement += 0.4 }
  if (role === 'scholar')   { weights.happiness += 0.4 }
  if (role === 'farmer')    { weights.survival += 0.2; weights.duty += 0.1 }

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
  const roles: Array<keyof typeof ratios> = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader']
  let cumulative = 0
  const frac = idx / total
  for (const role of roles) {
    cumulative += ratios[role]
    if (frac < cumulative) return role as Role
  }
  return 'farmer'
}

// Zones where children and families live. Exported so engine.ts can use the same list.
export const RESIDENTIAL_ZONES = ['residential_west', 'residential_east'] as const

function assignZone(role: Role): string {
  const ROLE_ZONES: Record<Role, string[]> = {
    farmer:    ['north_farm', 'south_farm'],
    craftsman: ['workshop_district'],
    merchant:  ['market_square'],
    scholar:   ['scholar_quarter'],
    guard:     ['guard_post', 'plaza'],
    leader:    ['plaza', 'scholar_quarter'],
    child:     [...RESIDENTIAL_ZONES],  // children live in residential zones
  }
  const zoneList = ROLE_ZONES[role]
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
  const rb = ROLE_WORLDVIEW_BONUS[role]

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

  // Occupation strings are locale-aware — fetched via i18n
  const occupation = tOcc(`occ.${role}`)

  const appearance = {
    height: (['short', 'average', 'tall'] as const)[randInt(0, 2)],
    build:  (['slim', 'average', 'sturdy'] as const)[randInt(0, 2)],
    hair:   age < 40 ? (['black', 'brown'] as const)[randInt(0, 1)]
           : age < 60 ? (['brown', 'gray'] as const)[randInt(0, 1)]
           : (['gray', 'white'] as const)[randInt(0, 1)],
    skin:   (['light', 'medium', 'dark'] as const)[randInt(0, 2)],
  }

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
    isolation:  rand(5, 25),
    fear:       rand(0, 15),
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
    daily_income: 0,
    trust_in,
    wealth: paretoSample(constitution.gini_start),
    grievance: rand(0, 20),
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
  }

  return {
    ...npcPartial,
    description: generateDescription(npcPartial),
  }
}

// ── Per-tick NPC update ────────────────────────────────────────────────────

export function tickNPC(npc: NPC, state: WorldState, events?: IndividualEvent[]): void {
  if (!npc.lifecycle.is_alive) return
  const wasBelowBurnoutThreshold = (npc.burnout_ticks ?? 0) < 480
  decayNeeds(npc, state)
  // Emit burnout event once when crossing the threshold
  if (wasBelowBurnoutThreshold && (npc.burnout_ticks ?? 0) >= 480) {
    events?.push({ type: 'burnout', npc })
  }
  npc.stress    = computeStress(npc)
  npc.happiness = computeHappiness(npc, state)
  updateGrievance(npc, state)
  updateWorldview(npc, state)
  applyResistanceBehavior(npc, state)
  npc.action_state = selectAction(npc, state)
  updateZone(npc, state)
  wealthTick(npc, state)
  checkLifecycle(npc, state, events)
}

// ── Resistance / self-preservation behavior ─────────────────────────────────
// NPCs adaptively resist societal conditions to protect their own interests.
// Each behavior fires only when a specific condition is met and is weighted
// by the NPC's worldview so identical crises produce heterogeneous responses.

function applyResistanceBehavior(npc: NPC, state: WorldState): void {
  if (npc.role === 'child') return
  const m = state.macro
  const c = state.constitution

  // Epidemic → self-isolation: reduce social activity desire
  const epidemicActive = state.active_events.some(e => e.type === 'epidemic')
  if (epidemicActive) {
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

  // Food crisis → hoarding: NPCs eat less (hunger decays slower) but gain stress
  if (m.food < 25 && npc.hunger > 30) {
    npc.hunger = clamp(npc.hunger - 0.15, 0, 100)
    npc.stress = clamp(npc.stress + 0.3, 0, 100)
    npc.fear   = clamp(npc.fear   + 0.2, 0, 100)
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
  const threatActive = state.active_events.some(e => e.type === 'external_threat')
  if (threatActive && npc.worldview.authority_trust > 0.5) {
    npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.003, 0, 1)
    npc.fear = clamp(npc.fear + 0.3, 0, 100)
  }

  // Blockade → merchants suffer most (trade halted), farmers hoard
  const blockadeActive = state.active_events.some(e => e.type === 'blockade')
  if (blockadeActive) {
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

const SOCIAL_HUBS = ['market_square', 'plaza'] as const

/** Stable 0–1 from id — same every session. */
function scheduleUnit(id: number, salt: number): number {
  const x = Math.sin((id + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function residentialBed(npc: NPC): string {
  return npc.id % 2 === 0 ? 'residential_east' : 'residential_west'
}

function isNightShiftWorker(npc: NPC): boolean {
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
      npc.zone = SOCIAL_HUBS[npc.id % SOCIAL_HUBS.length]
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
  npc.isolation += 0.2
  npc.fear      += violenceActive ? 2.0 : -0.3

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
    const roleRate = ROLE_EXHAUSTION_RATE[npc.role] ?? 0.30
    npc.exhaustion += (baseMetabolic + roleRate) * ageMod * sickMod
  } else if (npc.action_state === 'socializing') {
    // Socializing: light activity (+0.10 on top of base)
    npc.exhaustion += (baseMetabolic + 0.10) * ageMod * sickMod
  } else {
    // Organizing, fleeing, confronting, complying — moderate exertion
    const actionRate = (npc.action_state === 'fleeing' || npc.action_state === 'confront') ? 0.35 : 0.15
    npc.exhaustion += (baseMetabolic + actionRate) * ageMod * sickMod
  }

  // Graduated food recovery when working: more food → better hunger reduction
  // food > 60: full recovery; food 30–60: reduced; food < 10: none
  const hungerRecovery = foodLevel > 60 ? 2.0
    : foodLevel > 30 ? 1.4
    : foodLevel > 10 ? 0.7
    : 0
  if (npc.action_state === 'working' && hungerRecovery > 0) npc.hunger -= hungerRecovery
  if (npc.action_state === 'socializing') {
    npc.isolation -= 2.5
    if (npc.strong_ties.length < 3) npc.isolation += 1.0
  }

  // Social ostracism: neighbors gradually distance themselves from known criminals
  if (npc.criminal_record) npc.isolation += 0.3

  // Community group: belonging reduces isolation even when not actively socializing
  if (npc.community_group !== null) {
    npc.isolation -= 0.4
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
  const h = Math.pow(npc.hunger     / 100, 1.6) * 0.35
  const e = Math.pow(npc.exhaustion / 100, 1.3) * 0.20
  const i = Math.pow(npc.isolation  / 100, 1.4) * 0.20
  const f = Math.pow(npc.fear       / 100, 1.8) * 0.25

  const roleExpected = ROLE_WEALTH_EXPECTATION[npc.role]
  const identity = Math.max(0, (roleExpected - npc.wealth) / roleExpected) * 0.10

  return clamp((h + e + i + f + identity) * 100, 0, 100)
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

// Role-based adjustments to regime work hours (relative to regime baseline).
const ROLE_SCHEDULE_OFFSET: Record<Role, { start: number; end: number }> = {
  farmer:    { start: -1, end: -1 },   // early bird — dawn start, done before dark
  craftsman: { start:  0, end:  0 },   // follows regime baseline
  merchant:  { start:  0, end: +1 },   // stays open late
  scholar:   { start: +1, end:  0 },   // slightly later start
  guard:     { start:  0, end:  0 },   // handled separately
  leader:    { start: -1, end: +1 },   // long hours
  child:     { start:  0, end:  0 },   // handled separately
}

function normalRoutine(npc: NPC, state: WorldState): ActionState {
  const hour = state.tick % 24
  const c    = state.constitution
  const sched: WorkSchedule = c.work_schedule ?? inferWorkSchedule(c)

  // Determine whether today is a designated rest day for this regime.
  // (state.day - 1) % 7 gives 0–6; days ≥ work_days_per_week are off.
  const dayOfWeek = (state.day - 1) % 7
  const isRestDay = dayOfWeek >= sched.work_days_per_week

  // ── Guards: rotation schedule ──────────────────────────────────────────
  // Guards in humane regimes (safety_net > 0.40) get true rest days; in harsh
  // regimes they are always on duty with only a short sleep window.
  if (npc.role === 'guard') {
    const guardHasRestDay = isRestDay && c.safety_net > 0.40
    if (guardHasRestDay) {
      if (hour >= 22 || hour < 8) return 'resting'
      if (hour >= 14) return 'socializing'
      return 'resting'
    }
    if (hour >= 23 || hour < 5) return 'resting'
    return 'working'
  }

  // ── Leaders: long hours; work even on rest days but take social time ───
  if (npc.role === 'leader') {
    if (isRestDay) {
      if (hour >= 23 || hour < 7) return 'resting'
      if (hour >= 13) return 'socializing'
      return 'working'  // leaders rarely fully disconnect
    }
    const leaderStart = Math.max(3, sched.work_start_hour - 1)
    const leaderEnd   = Math.min(23, sched.work_end_hour   + 1)
    if (hour >= 23 || hour < leaderStart) return 'resting'
    if (hour >= leaderEnd) return 'socializing'
    return 'working'
  }

  // ── Children: age-appropriate fixed schedule ───────────────────────────
  if (npc.role === 'child') {
    const wake  = 7 + Math.floor(scheduleUnit(npc.id, 15) * 2)   // 7–8
    const sleep = 20 + Math.floor(scheduleUnit(npc.id, 16) * 2)  // 20–21
    if (hour >= sleep || hour < wake) return 'resting'
    if (isRestDay || hour >= 16) return 'socializing'
    return 'working'
  }

  // ── Rest day (all other adults) ─────────────────────────────────────────
  if (isRestDay) {
    const offset   = npc.bio_clock_offset
    const wakeTime = clamp(8 + offset, 6, 12)
    if (hour < wakeTime || hour >= 22) return 'resting'
    if (hour >= 10) return 'socializing'
    return 'resting'
  }

  // ── Night-shift workers (existing logic preserved) ─────────────────────
  if (isNightShiftWorker(npc)) {
    const lateSleeper = scheduleUnit(npc.id, 12) < 0.35
    const sleepStart  = lateSleeper ? 10 : 8
    const sleepEnd    = lateSleeper ? 18 : 17
    if (hour >= sleepStart && hour < sleepEnd) return 'resting'
    if (hour >= 17 && hour < 20) return 'socializing'
    return 'working'
  }

  // ── Typical working day: regime schedule + role offset + bio clock ─────
  const roleAdj   = ROLE_SCHEDULE_OFFSET[npc.role]
  const offset    = npc.bio_clock_offset
  const workStart = clamp(sched.work_start_hour + roleAdj.start + offset, 3, 12)
  const workEnd   = clamp(sched.work_end_hour   + roleAdj.end   + offset, 12, 23)
  // Social window before sleep: 1–3 hours after work, scaled by NPC id
  const socialHours = 1 + Math.floor(scheduleUnit(npc.id, 1) * 3)     // 1–3 h
  const sleepHour   = Math.min(workEnd + socialHours, 23)

  if (hour >= sleepHour || hour < workStart) return 'resting'
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

  if (npc.stress < npc.stress_threshold) return normalRoutine(npc, state)

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
    const allSimilarWorldview = infoInfluencers.every(n => n.dissonance_acc >= 20)

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
  const stressPenalty   = npc.stress / 120   // was /200; stress 100 → 0.83 penalty
  const sickPenalty     = npc.sick ? 0.5 : 0
  const ageFactor       = ageProductivityFactor(npc.age)
  // Craftsmen can't work without raw materials
  const resourcePenalty = (npc.role === 'craftsman' && state.macro.natural_resources < 20)
    ? (20 - state.macro.natural_resources) / 20 * 0.50
    : 0
  // Fatigue penalty: exhaustion above 50 progressively reduces output (max 40% at 100)
  const fatiguePenalty = npc.exhaustion > 50
    ? (npc.exhaustion - 50) / 50 * 0.40
    : 0
  // Burnout penalty: chronic overwork severely reduces output
  const burnoutPenalty = (npc.burnout_ticks ?? 0) >= 480 ? 0.50 : 0
  return Math.max(0,
    npc.base_skill * motivation * ageFactor
    * (1 - fairnessPenalty)
    * (1 - stressPenalty)
    * (1 - sickPenalty)
    * (1 - resourcePenalty)
    * (1 - fatiguePenalty)
    * (1 - burnoutPenalty),
  )
}

// ── Wealth tick ────────────────────────────────────────────────────────────
// Labor income + 3 trade modes:
//   Merchant-as-seller: earns markup (profit) on each transaction
//   Non-merchant P2P:   wealth flows from richer to poorer (barter/gifts)
//   Merchant lending:   offers loans to poor neighbors at 30% interest

const TRADE_EFFICIENCY = 0.80   // non-merchant P2P friction
const MERCHANT_MARKUP  = 0.22   // merchant profit margin per transaction

function wealthTick(npc: NPC, state: WorldState): void {
  if (npc.role === 'child') return
  if (npc.action_state === 'fleeing' || npc.action_state === 'confront') return

  const productivity = computeProductivity(npc, state)
  const laborIncome  = (productivity - 0.5) * 0.1
  npc.wealth     = clamp(npc.wealth + laborIncome, 0, 50000)
  npc.daily_income = npc.daily_income * 0.99 + Math.max(0, laborIncome) * 24

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

  // ── P2P trade (every 12 ticks, staggered by id) ────────────────────────
  if (npc.action_state === 'socializing' && state.tick % 12 === npc.id % 12) {
    const mf = state.constitution.market_freedom
    for (const tid of npc.strong_ties.slice(0, 3)) {
      const partner = state.npcs[tid]
      if (!partner?.lifecycle.is_alive) continue

      // Commerce discovery boosts merchant trade efficiency
      const effectiveMarkup = MERCHANT_MARKUP + ((state.discoveries ?? []).some(d => d.id === 'commerce') ? 0.05 : 0)
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
          partner.wealth = clamp(partner.wealth + transfer * TRADE_EFFICIENCY, 0, 50000)
        }
      }
    }
  }

  // ── Merchant lending (once per day, staggered) ─────────────────────────
  // Planned economies (mf < 0.20) don't allow private lending — state credit only.
  if (npc.role === 'merchant' && npc.wealth > 1000
      && state.constitution.market_freedom >= 0.20
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
    const deathChance = (npc.age - 70) * 0.0001   // per tick
    if (Math.random() < deathChance) {
      npc.lifecycle.is_alive   = false
      npc.lifecycle.death_cause = 'natural'
      npc.lifecycle.death_tick  = state.tick
      return
    }
  }

  // Death by starvation
  if (npc.hunger >= 99 && Math.random() < 0.001) {
    npc.lifecycle.is_alive   = false
    npc.lifecycle.death_cause = 'starvation'
    npc.lifecycle.death_tick  = state.tick
    return
  }

  // ★ Illness tick-down & death
  if (npc.sick) {
    npc.sick_ticks--
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
    const sicknessP = 0.0002
      * ageIllnessMult(npc.age)
      * medicineMult
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
    const accP = 0.00005
      * dangerMod
      * (1 + npc.exhaustion / 100)
      * (1 + npc.fear / 100)
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
  if (!npc.criminal_record && state.tick % 6 === npc.id % 6) {
    const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    const crimeP = 0.00004
      * Math.max(0, npc.grievance - 50) / 50
      * (1 - govTrust)
      * (npc.wealth < 30 ? 2 : 1)
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
        }
      }
      events?.push({ type: 'crime', npc })
    }
  }

  // ★ Recidivism: repeat offenders reoffend at higher rate, lower threshold
  if (npc.criminal_record && state.tick % 6 === npc.id % 6) {
    const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    const recidivismP = 0.00008
      * Math.max(0, npc.grievance - 30) / 70
      * (1 - govTrust)
      * (npc.wealth < 50 ? 2 : 1)
    if (Math.random() < recidivismP) {
      npc.wealth = clamp(npc.wealth + 25 + Math.random() * 35, 0, 5000)
      npc.grievance = clamp(npc.grievance - 10, 0, 100)
      // Witnesses react more strongly to known repeat offenders
      for (const tid of npc.strong_ties.slice(0, 3)) {
        const witness = state.npcs[tid]
        if (witness?.lifecycle.is_alive) {
          witness.trust_in.community.intention = clamp(witness.trust_in.community.intention - 0.06, 0, 1)
          witness.fear     = clamp(witness.fear     + 5, 0, 100)
          witness.grievance = clamp(witness.grievance + 8, 0, 100)
        }
      }
      events?.push({ type: 'crime', npc })
    }
  }

  // ★ Guard detection: scaled by guard power AND individual_rights_floor
  // High rights → due process makes arbitrary arrest harder
  // Low rights  → suspects can be arrested on little evidence
  if (npc.criminal_record && state.tick % 24 === npc.id % 24) {
    const guardInst = state.institutions.find(i => i.id === 'guard')
    const rights     = state.constitution.individual_rights_floor
    // High rights = harder to catch (legal protections); low rights = arbitrary enforcement
    const detectionP = (guardInst?.power ?? 0.3) * 0.02 * (1 - rights * 0.55)
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
  npc.occupation      = tOcc(selectedRole)
  npc.work_motivation = inferMotivationType(selectedRole, state.constitution, npc.id)
  npc.description     = generateDescription(npc)  // refresh description with new role
}

// ── Trust update ───────────────────────────────────────────────────────────

type TrustEvent =
  | 'promise_kept' | 'crisis_handled' | 'promise_broken'
  | 'corruption'   | 'helped_me'      | 'harmed_me' | 'silent_in_crisis'

const TRUST_DELTAS: Record<TrustEvent, { competence: number; intention: number }> = {
  promise_kept:     { competence: +0.03, intention: +0.02 },
  crisis_handled:   { competence: +0.05, intention: +0.03 },
  promise_broken:   { competence: -0.06, intention: -0.08 },
  corruption:       { competence: -0.05, intention: -0.20 },
  helped_me:        { competence: +0.02, intention: +0.04 },
  harmed_me:        { competence: -0.08, intention: -0.12 },
  silent_in_crisis: { competence: -0.04, intention: -0.06 },
}

export function updateTrust(
  npc: NPC,
  institutionId: keyof TrustMap,
  eventType: TrustEvent,
  magnitude = 1.0,
): void {
  const t = npc.trust_in[institutionId]
  const d = TRUST_DELTAS[eventType]
  t.competence = clamp(t.competence + d.competence * magnitude, 0, 1)
  t.intention  = clamp(t.intention  + d.intention  * magnitude, 0, 1)

  // Intention once badly broken: recovery is slow and capped at 0.65
  // (trust is rebuilt through sustained good governance, not instantly)
  if (t.intention < 0.1 && d.intention > 0) {
    t.intention = Math.min(t.intention + d.intention * magnitude, 0.65)
  }
}
