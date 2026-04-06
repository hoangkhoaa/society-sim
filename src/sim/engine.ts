import type { WorldState, Constitution, NPC, SimEvent, NarrativeEntry } from '../types'
import { createNPC, tickNPC, computeProductivity } from './npc'
import { buildNetwork } from './network'
import { initInstitutions, clamp } from './constitution'
import { addFeedRaw } from '../ui/feed'
import { t, tf } from '../i18n'

// ── World Initialization ────────────────────────────────────────────────────

const POPULATION = 500   // Phase 2 starting size; bump to 10k after testing

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

  // Tick all living NPCs
  for (const npc of state.npcs) {
    if (npc.lifecycle.is_alive) tickNPC(npc, state)
  }

  // Tick active events
  tickEvents(state)

  // Update macro every 24 ticks (daily)
  if (state.tick % 24 === 0) {
    state.macro = computeMacroStats(state)
    state.drift_score = computeDriftScore(state)
    checkCrisis(state)
  }

  // Lifecycle events (birth/marriage) — check once per day
  if (state.tick % 24 === 0) {
    checkLifecycleEvents(state)
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

function tickEvents(state: WorldState): void {
  for (const ev of state.active_events) {
    ev.elapsed_ticks++

    // Apply per-tick effects to NPCs in affected zones
    const affectedNPCs = state.npcs.filter(
      n => n.lifecycle.is_alive && (ev.zones.length === 0 || ev.zones.includes(n.zone)),
    )

    for (const npc of affectedNPCs) {
      npc.hunger     = clamp(npc.hunger     + ev.effects_per_tick.stress_delta * 0.3, 0, 100)
      npc.fear       = clamp(npc.fear       + ev.effects_per_tick.stress_delta * 0.5, 0, 100)
      npc.trust_in.government.intention = clamp(
        npc.trust_in.government.intention + ev.effects_per_tick.trust_delta / 100,
        0, 1,
      )
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
  const map: Record<string, SimEvent['effects_per_tick']> = {
    storm:           { food_stock_delta: -i * 50,  stress_delta: i * 2,  trust_delta: -i * 3,  displacement_chance: i * 0.1 },
    drought:         { food_stock_delta: -i * 80,  stress_delta: i * 1,  trust_delta: -i * 2,  displacement_chance: i * 0.05 },
    flood:           { food_stock_delta: -i * 60,  stress_delta: i * 3,  trust_delta: -i * 4,  displacement_chance: i * 0.15 },
    epidemic:        { food_stock_delta: 0,         stress_delta: i * 4,  trust_delta: -i * 5,  displacement_chance: i * 0.2 },
    resource_boom:   { food_stock_delta: +i * 100, stress_delta: -i * 2, trust_delta: +i * 3,  displacement_chance: 0 },
    harsh_winter:    { food_stock_delta: -i * 70,  stress_delta: i * 2,  trust_delta: -i * 2,  displacement_chance: i * 0.05 },
    trade_offer:     { food_stock_delta: +i * 60,  stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    refugee_wave:    { food_stock_delta: -i * 30,  stress_delta: i * 2,  trust_delta: -i * 1,  displacement_chance: 0 },
    ideology_import: { food_stock_delta: 0,         stress_delta: i * 1,  trust_delta: -i * 4,  displacement_chance: 0 },
    external_threat: { food_stock_delta: -i * 20,  stress_delta: i * 5,  trust_delta: -i * 3,  displacement_chance: i * 0.1 },
    blockade:        { food_stock_delta: -i * 90,  stress_delta: i * 3,  trust_delta: -i * 5,  displacement_chance: i * 0.05 },
    scandal_leak:    { food_stock_delta: 0,         stress_delta: i * 2,  trust_delta: -i * 10, displacement_chance: 0 },
    charismatic_npc: { food_stock_delta: 0,         stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    martyr:          { food_stock_delta: 0,         stress_delta: i * 3,  trust_delta: -i * 8,  displacement_chance: 0 },
    tech_shift:      { food_stock_delta: +i * 40,  stress_delta: i * 1,  trust_delta: +i * 1,  displacement_chance: 0 },
  }
  return map[type] ?? { food_stock_delta: 0, stress_delta: 0, trust_delta: 0, displacement_chance: 0 }
}

// ── Macro Stats ─────────────────────────────────────────────────────────────

export function computeMacroStats(state: WorldState): WorldState['macro'] {
  const npcs = state.npcs.filter(n => n.lifecycle.is_alive)
  if (npcs.length === 0) return state.macro

  // Food production
  const dailyProduction = npcs
    .filter(n => n.role === 'farmer')
    .reduce((s, n) => s + computeProductivity(n, state), 0) / 10
  state.food_stock = clamp((state.food_stock ?? 0) + dailyProduction - npcs.length * 0.04, 0, 999999)
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
  let sumAbs = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbs += Math.abs(sorted[i] - sorted[j])
    }
  }
  return sumAbs / (2 * n * total)
}

// ── Constitutional Crisis ────────────────────────────────────────────────────

function computeDriftScore(state: WorldState): number {
  const C = state.constitution
  const m = state.macro
  return (
    Math.abs(m.gini - C.gini_start) * 2.0 +
    Math.abs(m.trust - C.base_trust * 100) / 100 * 1.5 +
    (m.political_pressure > 70 ? 0.20 : 0) +
    (m.stability < 30 ? 0.15 : 0)
  )
}

let driftDaysHigh = 0

function checkCrisis(state: WorldState): void {
  if (state.drift_score > 0.35) {
    driftDaysHigh++
    if (driftDaysHigh >= 30 && !state.crisis_pending) {
      state.crisis_pending = true
      emitCrisisEvent(state)
    }
  } else {
    driftDaysHigh = Math.max(0, driftDaysHigh - 1)
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

function checkLifecycleEvents(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // Birth check: married couples with fertility
  for (const npc of living) {
    if (!npc.lifecycle.spouse_id) continue
    const spouse = state.npcs[npc.lifecycle.spouse_id]
    if (!spouse?.lifecycle.is_alive) continue

    const fertility = Math.min(npc.lifecycle.fertility, spouse.lifecycle.fertility)
    if (fertility > 0 && Math.random() < fertility * 0.0003) {
      spawnBirth(state, npc)
    }
  }

  // Marriage check: single adults
  const singles = living.filter(n =>
    !n.lifecycle.spouse_id &&
    n.age >= 18 &&
    n.age <= 45,
  )
  for (const npc of singles) {
    if (Math.random() > 0.0001) continue
    const candidate = singles.find(s =>
      s.id !== npc.id &&
      !s.lifecycle.spouse_id &&
      Math.abs(s.age - npc.age) <= 10 &&
      npc.strong_ties.includes(s.id),
    )
    if (candidate) {
      npc.lifecycle.spouse_id      = candidate.id
      candidate.lifecycle.spouse_id = npc.id
      npc.strong_ties              = [...new Set([...npc.strong_ties, candidate.id])]
      candidate.strong_ties        = [...new Set([...candidate.strong_ties, npc.id])]
      addFeedRaw(tf('engine.married', { a: npc.name, b: candidate.name }), 'info', state.year, state.day)
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
  addFeedRaw(tf('engine.birth', { parent: parent.name }), 'info', state.year, state.day)
}
