import type { WorldState, Constitution, NPC, SimEvent, NarrativeEntry, NPCIntervention } from '../types'
import { createNPC, tickNPC, computeProductivity } from './npc'
import type { IndividualEvent } from './npc'
import { buildNetwork } from './network'
import { initInstitutions, clamp } from './constitution'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'

// ── Event death accumulator ────────────────────────────────────────────────
let eventDeathsThisDay = 0

// ── World Initialization ────────────────────────────────────────────────────

const POPULATION = 500          // Phase 2 starting size; bump to 10k after testing
const MAX_NPC_MEMORIES = 10     // Circular memory buffer size per NPC

export function initWorld(constitution: Constitution): WorldState {
  const npcs: NPC[] = []
  for (let i = 0; i < POPULATION; i++) {
    npcs.push(createNPC(i, POPULATION, constitution))
  }

  const { strong, weak, clusters } = buildNetwork(npcs, constitution)

  // Write ties back onto NPCs
  for (const [id, ties] of strong) {
    if (npcs[id]) npcs[id].strong_ties = [...ties]
  }
  for (const [id, ties] of weak) {
    if (npcs[id]) npcs[id].weak_ties = [...ties]
  }

  // Influence score = normalized strong-tie degree centrality
  const maxDegree = Math.max(...npcs.map(n => n.strong_ties.length), 1)
  for (const npc of npcs) {
    npc.influence_score = npc.strong_ties.length / maxDegree
  }

  const institutions = initInstitutions(constitution)

  const macro = computeMacroStats({ npcs, institutions, active_events: [], food_stock: POPULATION * 30, constitution } as unknown as WorldState)

  return {
    tick: 0,
    day: 1,
    year: 1,
    constitution,
    npcs,
    institutions,
    active_events: [],
    network: { strong, weak, clusters },
    macro,
    food_stock: POPULATION * 30,
    narrative_log: [],
    drift_score: 0,
    crisis_pending: false,
  }
}

// ── Tick ────────────────────────────────────────────────────────────────────

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

  // Tick all living NPCs, collecting individual life events
  const indivEvents: IndividualEvent[] = []
  for (const npc of state.npcs) {
    if (npc.lifecycle.is_alive) tickNPC(npc, state, indivEvents)
  }

  // Chronicle individual events (at most 3 per tick to avoid spam)
  let chronicled = 0
  for (const ev of indivEvents) {
    if (chronicled >= 3) break
    if (ev.type === 'accident') {
      addChronicle(tf('engine.accident', { name: ev.npc.name }) as string, state.year, state.day)
      chronicled++
    } else if (ev.type === 'illness') {
      addChronicle(tf('engine.fell_ill', { name: ev.npc.name }) as string, state.year, state.day)
      chronicled++
    } else if (ev.type === 'recovery') {
      addChronicle(tf('engine.recovered', { name: ev.npc.name }) as string, state.year, state.day)
      chronicled++
    } else if (ev.type === 'crime') {
      addChronicle(tf('engine.crime', { name: ev.npc.name }) as string, state.year, state.day)
      chronicled++
    }
  }

  // Tick active events
  tickEvents(state)

  // Update macro every 24 ticks (daily)
  if (state.tick % 24 === 0) {
    state.macro = computeMacroStats(state)
    state.drift_score = computeDriftScore(state)
    checkCrisis(state)

    // Flush event-caused deaths to chronicle
    if (eventDeathsThisDay > 0) {
      addChronicle(`💀 ${eventDeathsThisDay} người tử vong do thiên tai.`, state.year, state.day)
      eventDeathsThisDay = 0
    }
  }

  // Lifecycle events (birth/marriage/divorce/community) — check once per day
  if (state.tick % 24 === 0) {
    checkLifecycleEvents(state)
    checkCommunityGroups(state)
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

// All 9 zones for epidemic full-spread reference
const ALL_ZONES = [
  'north_farm', 'south_farm', 'workshop_district', 'market_square',
  'scholar_quarter', 'residential_east', 'residential_west', 'guard_post', 'plaza',
]

// Adjacent zones for contagion spread
const ZONE_ADJACENCY: Record<string, string[]> = {
  north_farm:        ['south_farm', 'residential_west'],
  south_farm:        ['north_farm', 'market_square'],
  workshop_district: ['market_square', 'residential_east'],
  market_square:     ['south_farm', 'workshop_district', 'plaza'],
  scholar_quarter:   ['plaza', 'residential_east'],
  residential_east:  ['residential_west', 'workshop_district', 'scholar_quarter'],
  residential_west:  ['residential_east', 'north_farm', 'guard_post'],
  guard_post:        ['residential_west', 'plaza'],
  plaza:             ['market_square', 'guard_post', 'scholar_quarter'],
}

function tickEvents(state: WorldState): void {
  for (const ev of state.active_events) {
    ev.elapsed_ticks++

    // Epidemic zone spread: every 48 ticks (2 sim-days), spread to adjacent zone
    if (ev.type === 'epidemic' && ev.elapsed_ticks % 48 === 0 && ev.zones.length < ALL_ZONES.length) {
      const spreadChance = ev.intensity * 0.6
      if (Math.random() < spreadChance) {
        const neighbours = new Set<string>()
        for (const z of ev.zones) {
          for (const adj of (ZONE_ADJACENCY[z] ?? [])) {
            if (!ev.zones.includes(adj)) neighbours.add(adj)
          }
        }
        const candidates = [...neighbours]
        if (candidates.length > 0) {
          ev.zones.push(candidates[Math.floor(Math.random() * candidates.length)])
        }
      }
    }

    // Apply per-tick effects to NPCs in affected zones
    const affectedNPCs = state.npcs.filter(
      n => n.lifecycle.is_alive && (ev.zones.length === 0 || ev.zones.includes(n.zone)),
    )

    // Epidemic uses a higher mortality multiplier calibrated to give ~30% deaths at intensity=1
    // over a default 7-day event (168 ticks): per-tick rate ≈ intensity * 0.0024
    const mortalityPerTick = ev.type === 'epidemic'
      ? ev.effects_per_tick.displacement_chance * 0.006
      : ev.effects_per_tick.displacement_chance * 0.002

    for (const npc of affectedNPCs) {
      npc.hunger     = clamp(npc.hunger     + ev.effects_per_tick.stress_delta * 0.3, 0, 100)
      npc.fear       = clamp(npc.fear       + ev.effects_per_tick.stress_delta * 0.5, 0, 100)
      npc.trust_in.government.intention = clamp(
        npc.trust_in.government.intention + ev.effects_per_tick.trust_delta / 100,
        0, 1,
      )
      // Sustained event mortality (epidemic, flood, etc.)
      if (mortalityPerTick > 0 && Math.random() < mortalityPerTick) {
        npc.lifecycle.is_alive    = false
        npc.lifecycle.death_cause = ev.type === 'epidemic' ? 'disease' : 'accident'
        npc.lifecycle.death_tick  = state.tick
        eventDeathsThisDay++
      }
    }

    // Food stock
    state.food_stock = clamp(state.food_stock + ev.effects_per_tick.food_stock_delta, 0, 999999)

    // Check cascade triggers
    for (const trigger of ev.triggers) {
      if (trigger.condition(state)) {
        spawnEvent(state, trigger.spawn as SimEvent)
      }
    }
  }

  // Remove expired events
  state.active_events = state.active_events.filter(ev => ev.elapsed_ticks < ev.duration_ticks)
}

export function spawnEvent(state: WorldState, partial: Partial<SimEvent>): void {
  const ev: SimEvent = {
    id: crypto.randomUUID(),
    type: partial.type ?? 'storm',
    intensity: partial.intensity ?? 0.5,
    zones: partial.zones ?? [],
    duration_ticks: partial.duration_ticks ?? 24 * 7,
    elapsed_ticks: 0,
    effects_per_tick: partial.effects_per_tick ?? defaultEffects(partial.type ?? 'storm', partial.intensity ?? 0.5),
    source: partial.source ?? 'player',
    narrative_open: partial.narrative_open ?? '',
    triggers: partial.triggers ?? [],
  }
  state.active_events.push(ev)
}

function defaultEffects(type: string, intensity: number): SimEvent['effects_per_tick'] {
  const i = intensity
  // displacement_chance: per-tick mortality rate factor (applied in tickEvents as × 0.002)
  const map: Record<string, SimEvent['effects_per_tick']> = {
    storm:           { food_stock_delta: -i * 50,  stress_delta: i * 2,  trust_delta: -i * 3,  displacement_chance: i * 0.10 },
    drought:         { food_stock_delta: -i * 80,  stress_delta: i * 1,  trust_delta: -i * 2,  displacement_chance: i * 0.05 },
    flood:           { food_stock_delta: -i * 60,  stress_delta: i * 3,  trust_delta: -i * 4,  displacement_chance: i * 0.20 },
    tsunami:         { food_stock_delta: -i * 200, stress_delta: i * 8,  trust_delta: -i * 6,  displacement_chance: i * 0.80 },
    earthquake:      { food_stock_delta: -i * 100, stress_delta: i * 6,  trust_delta: -i * 5,  displacement_chance: i * 0.50 },
    wildfire:        { food_stock_delta: -i * 70,  stress_delta: i * 4,  trust_delta: -i * 3,  displacement_chance: i * 0.25 },
    epidemic:        { food_stock_delta: 0,         stress_delta: i * 4,  trust_delta: -i * 5,  displacement_chance: i * 0.40 },
    resource_boom:   { food_stock_delta: +i * 100, stress_delta: -i * 2, trust_delta: +i * 3,  displacement_chance: 0 },
    harsh_winter:    { food_stock_delta: -i * 70,  stress_delta: i * 2,  trust_delta: -i * 2,  displacement_chance: i * 0.08 },
    trade_offer:     { food_stock_delta: +i * 60,  stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    refugee_wave:    { food_stock_delta: -i * 30,  stress_delta: i * 2,  trust_delta: -i * 1,  displacement_chance: 0 },
    ideology_import: { food_stock_delta: 0,         stress_delta: i * 1,  trust_delta: -i * 4,  displacement_chance: 0 },
    external_threat: { food_stock_delta: -i * 20,  stress_delta: i * 5,  trust_delta: -i * 3,  displacement_chance: i * 0.10 },
    blockade:        { food_stock_delta: -i * 90,  stress_delta: i * 3,  trust_delta: -i * 5,  displacement_chance: i * 0.05 },
    scandal_leak:    { food_stock_delta: 0,         stress_delta: i * 2,  trust_delta: -i * 10, displacement_chance: 0 },
    charismatic_npc: { food_stock_delta: 0,         stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    martyr:          { food_stock_delta: 0,         stress_delta: i * 3,  trust_delta: -i * 8,  displacement_chance: 0 },
    tech_shift:      { food_stock_delta: +i * 40,  stress_delta: i * 1,  trust_delta: +i * 1,  displacement_chance: 0 },
  }
  return map[type] ?? { food_stock_delta: 0, stress_delta: 0, trust_delta: 0, displacement_chance: 0 }
}

// ── Direct NPC Interventions ─────────────────────────────────────────────────

export function applyInterventions(state: WorldState, interventions: NPCIntervention[]): number {
  let totalAffected = 0

  for (const iv of interventions) {
    // Select candidate NPCs
    let candidates = state.npcs.filter(n => n.lifecycle.is_alive)

    if (iv.target === 'zone' && iv.zones?.length) {
      candidates = candidates.filter(n => iv.zones!.includes(n.zone))
    } else if (iv.target === 'role' && iv.roles?.length) {
      candidates = candidates.filter(n => iv.roles!.includes(n.role))
    } else if (iv.target === 'id_list' && iv.npc_ids?.length) {
      const idSet = new Set(iv.npc_ids)
      candidates = candidates.filter(n => idSet.has(n.id))
    }

    // Optionally cap by count (random sample)
    if (iv.count !== undefined && iv.count < candidates.length) {
      candidates = candidates
        .map(n => ({ n, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, iv.count)
        .map(x => x.n)
    }

    for (const npc of candidates) {
      applyInterventionToNPC(npc, iv, state)
    }

    totalAffected += candidates.length
  }

  return totalAffected
}

function applyInterventionToNPC(npc: NPC, iv: NPCIntervention, state: WorldState): void {
  // Kill
  if (iv.kill) {
    npc.lifecycle.is_alive = false
    npc.lifecycle.death_cause = iv.kill_cause ?? 'violence'
    npc.lifecycle.death_tick = state.tick
    return  // dead NPCs skip further changes
  }

  // Action state override
  if (iv.action_state !== undefined) {
    npc.action_state = iv.action_state
  }

  // Additive stat deltas
  if (iv.stress_delta !== undefined)   npc.stress    = clamp(npc.stress    + iv.stress_delta,    0, 100)
  if (iv.fear_delta !== undefined)     npc.fear      = clamp(npc.fear      + iv.fear_delta,      0, 100)
  if (iv.hunger_delta !== undefined)   npc.hunger    = clamp(npc.hunger    + iv.hunger_delta,    0, 100)
  if (iv.grievance_delta !== undefined) npc.grievance = clamp(npc.grievance + iv.grievance_delta, 0, 100)
  if (iv.happiness_delta !== undefined) npc.happiness = clamp(npc.happiness + iv.happiness_delta, 0, 100)

  // Worldview deltas
  if (iv.worldview_delta) {
    const wd = iv.worldview_delta
    const wv = npc.worldview
    if (wd.collectivism   !== undefined) wv.collectivism    = clamp(wv.collectivism    + wd.collectivism,    0, 1)
    if (wd.authority_trust !== undefined) wv.authority_trust = clamp(wv.authority_trust + wd.authority_trust, 0, 1)
    if (wd.risk_tolerance  !== undefined) wv.risk_tolerance  = clamp(wv.risk_tolerance  + wd.risk_tolerance,  0, 1)
    if (wd.time_preference !== undefined) wv.time_preference = clamp(wv.time_preference + wd.time_preference, 0, 1)
  }

  // Memory injection
  if (iv.memory) {
    npc.memory.push({ event_id: 'intervention', type: iv.memory.type, emotional_weight: iv.memory.emotional_weight, tick: state.tick })
    if (npc.memory.length > MAX_NPC_MEMORIES) npc.memory.shift()
  }
}



export function computeMacroStats(state: WorldState): WorldState['macro'] {
  const npcs = state.npcs.filter(n => n.lifecycle.is_alive)
  if (npcs.length === 0) return state.macro

  // Food production — each farmer at average productivity feeds ~3-4 people
  const farmers = npcs.filter(n => n.role === 'farmer')
  const scarcityFactor = 1 - state.constitution.resource_scarcity * 0.5
  const dailyProduction = farmers.reduce((s, n) => s + computeProductivity(n, state), 0) * 4 * scarcityFactor
  const dailyConsumption = npcs.length * 0.5
  state.food_stock = clamp((state.food_stock ?? 0) + dailyProduction - dailyConsumption, 0, 999999)
  const food = clamp(state.food_stock / (npcs.length * 30) * 100, 0, 100)

  // Gini
  const wealths = npcs.map(n => n.wealth).sort((a, b) => a - b)
  const gini = computeGini(wealths)

  // Political pressure
  const politicalPressure = clamp(
    npcs.filter(n => ['organizing', 'confront', 'fleeing'].includes(n.action_state)).length / npcs.length * 200,
    0, 100,
  )

  // Trust (avg government intention)
  const trust = npcs.reduce((s, n) => s + n.trust_in.government.intention, 0) / npcs.length * 100

  // Stability
  const avgTrustGov = npcs.reduce((s, n) =>
    s + (n.trust_in.government.competence + n.trust_in.government.intention) / 2, 0) / npcs.length
  const cohesion = 1 - npcs.filter(n => n.action_state === 'fleeing').length / npcs.length
  const avgStress = npcs.reduce((s, n) => s + n.stress, 0) / npcs.length

  const stability = clamp(
    avgTrustGov * 30 +
    cohesion * 20 +
    (food / 100) * 25 +
    (1 - avgStress / 100) * 15 +
    (1 - politicalPressure / 100) * 10,
    0, 100,
  )

  return { food, gini, political_pressure: politicalPressure, trust, stability }
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

function computeDriftScore(state: WorldState): number {
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

function checkCrisis(state: WorldState): void {
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

// ── Lifecycle Events (birth / marriage) ─────────────────────────────────────

function computeBirthChancePerDay(a: NPC, b: NPC, state: WorldState): number {
  const baseFertility = Math.min(a.lifecycle.fertility, b.lifecycle.fertility)
  if (baseFertility <= 0) return 0

  const avgHappiness = (a.happiness + b.happiness) / 2
  const avgStress = (a.stress + b.stress) / 2
  const avgFear = (a.fear + b.fear) / 2
  const avgHunger = (a.hunger + b.hunger) / 2
  const avgExhaustion = (a.exhaustion + b.exhaustion) / 2
  const avgWealth = (a.wealth + b.wealth) / 2
  const avgTrustGov =
    ((a.trust_in.government.intention + a.trust_in.government.competence) +
     (b.trust_in.government.intention + b.trust_in.government.competence)) / 4

  // Multipliers tune "readiness to have children" from micro + macro conditions.
  const happinessFactor = clamp(0.75 + avgHappiness / 200, 0.65, 1.25)
  const stressFactor = clamp(1 - avgStress / 120, 0.2, 1)
  const fearFactor = clamp(1 - avgFear / 140, 0.25, 1)
  const needsFactor = clamp(1 - ((avgHunger * 0.6 + avgExhaustion * 0.4) / 150), 0.25, 1)
  const wealthFactor = clamp(0.6 + avgWealth / 200, 0.6, 1.2)
  const trustFactor = clamp(0.75 + avgTrustGov * 0.35, 0.75, 1.1)
  const foodFactor = clamp(0.55 + state.macro.food / 150, 0.55, 1.2)

  const chance = 0.025 * baseFertility
    * happinessFactor
    * stressFactor
    * fearFactor
    * needsFactor
    * wealthFactor
    * trustFactor
    * foodFactor

  return clamp(chance, 0, 0.06)
}

function checkLifecycleEvents(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // Birth check: married couples with fertility (one roll per couple per day — lower id is canonical)
  for (const npc of living) {
    if (npc.lifecycle.spouse_id === null) continue
    const sid = npc.lifecycle.spouse_id
    if (npc.id > sid) continue
    const spouse = state.npcs[sid]
    if (!spouse?.lifecycle.is_alive) continue

    const birthChance = computeBirthChancePerDay(npc, spouse, state)
    if (birthChance > 0 && Math.random() < birthChance) {
      spawnBirth(state, npc)
    }
  }

  // Marriage check: single adults
  const singles = living.filter(n =>
    n.lifecycle.spouse_id === null &&
    n.age >= 18 &&
    n.age <= 45,
  )
  for (const npc of singles) {
    if (npc.lifecycle.spouse_id !== null) continue
    // ~0.4% per single per day (~0.2–0.8 marriage attempts/day at N≈500; was 0.01%)
    if (Math.random() > 0.004) continue
    const candidate = singles.find(s =>
      s.id !== npc.id &&
      s.lifecycle.spouse_id === null &&
      s.gender !== npc.gender &&
      Math.abs(s.age - npc.age) <= 12 &&
      npc.strong_ties.includes(s.id),
    )
    if (candidate) {
      npc.lifecycle.spouse_id      = candidate.id
      candidate.lifecycle.spouse_id = npc.id
      npc.strong_ties              = [...new Set([...npc.strong_ties, candidate.id])]
      candidate.strong_ties        = [...new Set([...candidate.strong_ties, npc.id])]
      addChronicle(tf('engine.married', { a: npc.name, b: candidate.name }) as string, state.year, state.day)
    }
  }

  // Divorce check: high combined stress + low happiness
  for (const npc of living) {
    if (npc.lifecycle.spouse_id === null) continue
    if (npc.id > npc.lifecycle.spouse_id) continue  // avoid double-processing
    const spouse = state.npcs[npc.lifecycle.spouse_id]
    if (!spouse?.lifecycle.is_alive) {
      npc.lifecycle.spouse_id = null  // widowed — clear ref
      continue
    }
    const avgStress    = (npc.stress + spouse.stress) / 2
    const avgHappiness = (npc.happiness + spouse.happiness) / 2
    // Chance ramps up sharply above stress=70, happiness<30
    const divorceChance = Math.max(0, (avgStress - 70) / 100) * Math.max(0, (50 - avgHappiness) / 50) * 0.003
    if (divorceChance > 0 && Math.random() < divorceChance) {
      npc.lifecycle.spouse_id   = null
      spouse.lifecycle.spouse_id = null
      npc.grievance    = clamp(npc.grievance    + 20, 0, 100)
      spouse.grievance = clamp(spouse.grievance + 20, 0, 100)
      addChronicle(tf('engine.divorced', { a: npc.name, b: spouse.name }) as string, state.year, state.day)
    }
  }
}

function spawnBirth(state: WorldState, parent: NPC): void {
  const { constitution, npcs } = state
  const newId = npcs.length
  const baby  = createNPC(newId, npcs.length + 1, constitution)
  baby.age     = 0
  baby.lifecycle.fertility = 0
  baby.lifecycle.children_ids = []

  parent.lifecycle.children_ids.push(newId)
  if (parent.lifecycle.spouse_id !== null) {
    const spouse = npcs[parent.lifecycle.spouse_id]
    if (spouse) spouse.lifecycle.children_ids.push(newId)
  }

  // Add to network
  state.network.strong.set(newId, new Set([parent.id]))
  baby.strong_ties = [parent.id]

  npcs.push(baby)
  addChronicle(tf('engine.birth', { parent: parent.name }) as string, state.year, state.day)
}

// ── Community Groups ─────────────────────────────────────────────────────────

let nextGroupId = 1

function checkCommunityGroups(state: WorldState): void {
  // Formation: 3+ socializing NPCs with mutual strong ties who have no group yet
  // Only run occasionally (every 24 ticks = daily) and with low probability per check
  if (Math.random() > 0.05) return  // ~5% chance per day a new group forms

  const candidates = state.npcs.filter(n =>
    n.lifecycle.is_alive &&
    n.community_group === null &&
    n.action_state === 'socializing',
  )

  for (const npc of candidates) {
    if (npc.community_group !== null) continue
    // Find at least 2 strong-tie socializing neighbours also without a group
    const coMembers = npc.strong_ties
      .map(id => state.npcs[id])
      .filter(n => n?.lifecycle.is_alive && n.community_group === null && n.action_state === 'socializing')
    if (coMembers.length < 2) continue

    const groupId = nextGroupId++
    npc.community_group = groupId
    for (const m of coMembers.slice(0, 4)) {   // cap at 5 members (npc + 4)
      m.community_group = groupId
    }
    addChronicle(tf('engine.community_formed', {}) as string, state.year, state.day)
    break  // only one new group per daily check
  }

  // Dissolution: groups where fewer than 2 members are alive
  const groupCounts = new Map<number, number>()
  for (const npc of state.npcs) {
    if (npc.community_group !== null && npc.lifecycle.is_alive) {
      groupCounts.set(npc.community_group, (groupCounts.get(npc.community_group) ?? 0) + 1)
    }
  }
  for (const npc of state.npcs) {
    if (npc.community_group !== null) {
      const count = groupCounts.get(npc.community_group) ?? 0
      if (count < 2) npc.community_group = null
    }
  }
}
