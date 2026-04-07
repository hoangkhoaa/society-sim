import type { NPC, Constitution, WorldState, Role, TrustMap, ActionState } from '../types'
import { VIETNAMESE_NAMES_MALE, VIETNAMESE_NAMES_FEMALE } from '../types'
import { clamp, gaussian, rand, randInt, weightedRandom } from './constitution'
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
}

export const ROLE_WEALTH_EXPECTATION: Record<Role, number> = {
  leader:    120,
  merchant:  100,
  scholar:   80,
  craftsman: 60,
  guard:     55,
  farmer:    45,
}

// ── Pareto wealth distribution ─────────────────────────────────────────────

function paretoSample(gini: number): number {
  // alpha from gini: gini = 1/(2*alpha - 1)  →  alpha = (1 + 1/gini) / 2
  // clamped to avoid extreme values
  const alpha = clamp((1 + 1 / Math.max(gini, 0.05)) / 2, 1.1, 5)
  const u = Math.random()
  return Math.max(10, 30 * Math.pow(1 - u, -1 / alpha))
}

// ── Role assignment ────────────────────────────────────────────────────────

function assignRole(idx: number, total: number, ratios: Constitution['role_ratios']): Role {
  const roles: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'guard', 'leader']
  let cumulative = 0
  const frac = idx / total
  for (const role of roles) {
    cumulative += ratios[role]
    if (frac < cumulative) return role
  }
  return 'farmer'
}

function assignZone(role: Role): string {
  const ROLE_ZONES: Record<Role, string[]> = {
    farmer:    ['north_farm', 'south_farm'],
    craftsman: ['workshop_district'],
    merchant:  ['market_square'],
    scholar:   ['scholar_quarter'],
    guard:     ['guard_post', 'plaza'],
    leader:    ['plaza', 'scholar_quarter'],
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
  const role = assignRole(idx, total, constitution.role_ratios)
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female'
  const namePool = gender === 'male' ? VIETNAMESE_NAMES_MALE : VIETNAMESE_NAMES_FEMALE
  const surname = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ']
  const name = `${surname[Math.floor(Math.random() * surname.length)]} ${namePool[Math.floor(Math.random() * namePool.length)]}`
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
    },
    occupation,
    daily_thought: '',
    last_thought_tick: -999,
    zone,
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
  }

  return {
    ...npcPartial,
    description: generateDescription(npcPartial),
  }
}

// ── Per-tick NPC update ────────────────────────────────────────────────────

export function tickNPC(npc: NPC, state: WorldState, events?: IndividualEvent[]): void {
  if (!npc.lifecycle.is_alive) return
  decayNeeds(npc, state)
  npc.stress    = computeStress(npc)
  npc.happiness = computeHappiness(npc, state)
  updateGrievance(npc, state)
  updateWorldview(npc, state)
  npc.action_state = selectAction(npc, state)
  wealthTick(npc, state)
  checkLifecycle(npc, state, events)
}

// ── Needs Decay ────────────────────────────────────────────────────────────

function decayNeeds(npc: NPC, state: WorldState): void {
  const foodAvailable = state.macro.food > 15
  const violenceActive = state.active_events.some(e => e.type === 'epidemic' || e.type === 'external_threat')

  npc.hunger     += 0.5
  npc.exhaustion += npc.sick ? 0.6 : 0.3   // sick NPCs tire faster
  npc.isolation  += 0.2
  npc.fear       += violenceActive ? 2.0 : -0.3

  if (npc.action_state === 'working' && foodAvailable) npc.hunger -= 2.0
  if (npc.action_state === 'resting')                  npc.exhaustion -= 3.0
  if (npc.action_state === 'socializing') {
    npc.isolation -= 2.5
    if (npc.strong_ties.length < 3) npc.isolation += 1.0
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

function normalRoutine(npc: NPC): ActionState {
  const hour = (npc.id + Date.now()) % 24   // cheap deterministic hour simulation
  if (hour >= 22 || hour < 6) return 'resting'
  if (hour >= 18) return 'socializing'
  return 'working'
}

function selectAction(npc: NPC, state: WorldState): ActionState {
  if (npc.stress < npc.stress_threshold) return normalRoutine(npc)

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

  return weightedRandom(weights) as ActionState
}

// ── Grievance ──────────────────────────────────────────────────────────────

function updateGrievance(npc: NPC, state: WorldState): void {
  let delta = 0

  if (npc.hunger > 60) delta += (npc.hunger - 60) * 0.08

  const neighborAvg = avgWealth(npc.weak_ties, state.npcs)
  if (npc.wealth < neighborAvg) delta += (neighborAvg - npc.wealth) / 200

  const recentBetrayal = npc.memory.find(m => m.type === 'trust_broken' && state.tick - m.tick < 720)
  if (recentBetrayal) delta += Math.abs(recentBetrayal.emotional_weight) * 0.05

  const recentHelp = npc.memory.find(m => m.type === 'helped' && state.tick - m.tick < 240)
  if (recentHelp) delta -= 4

  delta -= (npc.strong_ties.length / 15) * 1.5

  if (npc.happiness > 65) delta -= 0.8

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

export function computeProductivity(npc: NPC, _state: WorldState): number {
  const motivation     = 0.5 + (npc.happiness / 100) * 0.5
  const expected       = ROLE_WEALTH_EXPECTATION[npc.role]
  const fairness       = clamp(npc.wealth / expected, 0, 1.5)
  const fairnessBonus  = (fairness - 1.0) * 0.2
  const stressPenalty  = npc.stress / 200
  const sickPenalty    = npc.sick ? 0.5 : 0   // sick → half productivity
  return Math.max(0, npc.base_skill * motivation * (1 + fairnessBonus) * (1 - stressPenalty) * (1 - sickPenalty))
}

// ── Wealth tick ────────────────────────────────────────────────────────────
// Each NPC earns from labor (productivity-based) and small peer-to-peer trades
// via direct connections (strong_ties). Information-network ties (info_ties)
// spread economic opportunity awareness but do not directly transfer wealth.

// Fraction of a direct trade that the recipient keeps (rest is friction/overhead).
const TRADE_EFFICIENCY = 0.8

function wealthTick(npc: NPC, state: WorldState): void {
  if (npc.action_state === 'fleeing' || npc.action_state === 'confront') return

  const productivity = computeProductivity(npc, state)
  const laborIncome = (productivity - 0.5) * 0.1
  npc.wealth = clamp(npc.wealth + laborIncome, 0, 5000)

  // Exponential moving average of daily income.
  // Decay: 0.99 per tick × 24 ticks/day gives ~a 100-tick (4-day) half-life.
  // Multiplier: ×24 converts per-tick earnings to a per-day rate estimate.
  npc.daily_income = npc.daily_income * 0.99 + Math.max(0, laborIncome) * 24

  // Peer-to-peer economic exchange via direct connections (strong_ties).
  // Checked every 12 ticks (≈ twice a sim-day), staggered by NPC id so that
  // not all 500 NPCs trigger trade on the same tick (distributes CPU load).
  if (npc.action_state === 'socializing' && state.tick % 12 === npc.id % 12) {
    const marketFreedom = state.constitution.market_freedom
    for (const tid of npc.strong_ties.slice(0, 3)) {
      const partner = state.npcs[tid]
      if (!partner?.lifecycle.is_alive) continue

      // Merchants facilitate larger trades; others do small exchanges (food, goods)
      const isMerchantTrade = npc.role === 'merchant' || partner.role === 'merchant'
      const baseTransfer = isMerchantTrade ? 0.8 : 0.2

      // Wealth flows from richer to poorer through direct trade.
      // Market freedom scales how actively wealth circulates.
      if (npc.wealth > partner.wealth + 10) {
        const transfer = baseTransfer * marketFreedom * Math.min(1, (npc.wealth - partner.wealth) / 200)
        npc.wealth     = clamp(npc.wealth     - transfer, 0, 5000)
        partner.wealth = clamp(partner.wealth + transfer * TRADE_EFFICIENCY, 0, 5000)
      }
    }
  }
}

// ── Lifecycle checks ───────────────────────────────────────────────────────

export type IndividualEvent = { type: 'accident' | 'illness' | 'recovery' | 'crime'; npc: NPC }

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
    npc.lifecycle.death_cause = 'disease'
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

  // ★ Random illness onset (~0.02% per tick in normal conditions)
  if (!npc.sick) {
    const sicknessP = 0.0002
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

  // ★ Crime: high grievance + low trust in government + low wealth → crime attempt
  if (!npc.criminal_record && state.tick % 6 === npc.id % 6) {
    const govTrust = (npc.trust_in.government.competence + npc.trust_in.government.intention) / 2
    const crimeP = 0.00004
      * Math.max(0, npc.grievance - 50) / 50
      * (1 - govTrust)
      * (npc.wealth < 30 ? 2 : 1)
    if (Math.random() < crimeP) {
      npc.criminal_record = true
      // Reward: wealth gain; risk: trust penalty from community/government
      npc.wealth = clamp(npc.wealth + 15 + Math.random() * 20, 0, 5000)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.10, 0, 1)
      npc.trust_in.community.intention  = clamp(npc.trust_in.community.intention  - 0.08, 0, 1)
      npc.grievance = clamp(npc.grievance - 15, 0, 100)   // crime relieves frustration temporarily
      npc.memory.push({ event_id: 'crime_' + state.tick, type: 'crime', emotional_weight: -20, tick: state.tick })
      if (npc.memory.length > 10) npc.memory.shift()
      // Nearby NPCs lose trust if they witness it
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
  }
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

  // Intention once broken: caps recovery at 0.35
  if (t.intention < 0.1 && d.intention > 0) {
    t.intention = Math.min(t.intention + d.intention * magnitude, 0.35)
  }
}
