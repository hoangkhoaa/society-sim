import type { WorldState, Constitution, NPC, SimEvent, NarrativeEntry, NPCIntervention, ActiveStrike } from '../types'
import { createNPC, tickNPC, computeProductivity, RESIDENTIAL_ZONES } from './npc'
import type { IndividualEvent, TickEventFlags } from './npc'
import { buildNetwork, MAX_STRONG_TIES, MAX_WEAK_TIES, MAX_INFO_TIES } from './network'
import { initInstitutions, clamp, getSeason, getSeasonFactor, SEASON_LABELS, ZONE_ADJACENCY } from './constitution'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'
import { checkFactions } from './factions'
import { accumulateResearch, checkDiscoveries, getDiscoveryBonuses } from './tech'
import { checkNarrativeEvents, checkRumors, checkMilestones } from './narratives'

// ── Event death accumulator ────────────────────────────────────────────────
let eventDeathsThisDay = 0

// ── Season tracking ────────────────────────────────────────────────────────
let lastSeason = 'spring'

// ── Community collective action cooldown ──────────────────────────────────
// Maps community_group id → last tick a collective action event was emitted.
// Prevents spam: at most one event per group per 10 sim-days (240 ticks).
const groupCollectiveActionTick = new Map<number, number>()

// ── New social-dynamics cooldowns ────────────────────────────────────────
let lastSchismTick = -9999
let lastOpinionFeedTick = -9999
let lastCrisisTick = -9999

// ── World Initialization ────────────────────────────────────────────────────

const POPULATION = 500          // Phase 2 starting size; bump to 10k after testing
const MAX_NPC_MEMORIES = 10     // Circular memory buffer size per NPC

export async function initWorld(constitution: Constitution): Promise<WorldState> {
  const npcs: NPC[] = []
  for (let i = 0; i < POPULATION; i++) {
    npcs.push(createNPC(i, POPULATION, constitution))
    // Yield to the browser event loop every 50 NPCs to keep the UI responsive
    if (i % 50 === 49) await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  // buildNetwork is async — it yields internally so the UI stays responsive
  const { strong, weak, info, clusters } = await buildNetwork(npcs, constitution)

  // Write ties back onto NPCs
  for (const [id, ties] of strong) {
    if (npcs[id]) npcs[id].strong_ties = [...ties]
  }
  for (const [id, ties] of weak) {
    if (npcs[id]) npcs[id].weak_ties = [...ties]
  }
  for (const [id, ties] of info) {
    if (npcs[id]) npcs[id].info_ties = [...ties]
  }

  // Influence score = normalized strong-tie degree centrality
  const maxDegree = Math.max(...npcs.map(n => n.strong_ties.length), 1)
  for (const npc of npcs) {
    npc.influence_score = npc.strong_ties.length / maxDegree
  }

  const institutions = initInstitutions(constitution)

  // Natural resource pool: starts at 100k × (1 - scarcity)
  const naturalResourcesInit = clamp(100000 * (1 - constitution.resource_scarcity), 10000, 100000)

  // computeMacroStats calls computeProductivity, which reads state.macro.natural_resources
  const macroStub = {
    food: 50,
    stability: 50,
    trust: 50,
    gini: constitution.gini_start,
    political_pressure: 0,
    natural_resources: clamp(naturalResourcesInit / 1000, 0, 100),
    energy: 50,
    literacy: 50,
    labor_unrest: 0,
    polarization: 15,
    gdp: 0,
    extraction_rate: 50,
    economic_efficiency: 50,
  }
  const macro = computeMacroStats({
    tick: 0,
    day: 1,
    year: 1,
    constitution,
    npcs,
    institutions,
    active_events: [],
    food_stock: POPULATION * 30,
    natural_resources: naturalResourcesInit,
    macro: macroStub,
    narrative_log: [],
    drift_score: 0,
    crisis_pending: false,
    tax_pool: 0,
  } as unknown as WorldState)

  return {
    tick: 0,
    day: 1,
    year: 1,
    constitution,
    npcs,
    institutions,
    active_events: [],
    network: { strong, weak, info, clusters },
    macro,
    food_stock: POPULATION * 30,
    natural_resources: naturalResourcesInit,
    narrative_log: [],
    drift_score: 0,
    crisis_pending: false,
    factions: [],
    research_points: 0,
    discoveries: [],
    referendum: null,
    quarantine_zones: [],
    rumors: [],
    milestones: [],
    births_total: 0,
    immigration_total: 0,
    active_strikes: [],
    tax_pool: 0,
  }
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
    state.drift_score = computeDriftScore(state)
    checkCrisis(state)

    // Flush event-caused deaths to chronicle
    if (eventDeathsThisDay > 0) {
      addChronicle(tf('engine.event_deaths', { n: eventDeathsThisDay }) as string, state.year, state.day, 'major')
      eventDeathsThisDay = 0
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
    applyIncomeTax(state)
    applyGovernmentWages(state)
    spendTaxRevenue(state)
    applyIncomeInequalityEffects(state)
    processInheritance(state)
    checkRegimeEvents(state)
    applyTheocracyEffect(state)
    applyCommuneEffect(state)
    checkLegendaryNPCs(state)
    checkFactions(state)
    accumulateResearch(state)
    checkDiscoveries(state)
    checkShadowEconomy(state)
    checkReferendum(state)
    checkEpidemicIntelligence(state)
    checkNarrativeEvents(state)
    checkRumors(state)
    checkMilestones(state)
    checkImmigration(state)

    // Network maintenance: prune dead links daily, organic tie formation daily
    maintainNetworkLinks(state)
    applyMentorshipDynamics(state)
    applyOpinionLeaderDynamics(state)
    propagateCrossZoneOrganizing(state)
    applyCrisisBonding(state)
    formOrganicStrongTies(state)
    computeBridgeScores(state)
    checkIdeologicalSchism(state)

    // Info tie refresh: every 30 sim-days (720 ticks)
    if (state.day % 30 === 0) {
      refreshInfoTies(state)
    }

    // Class solidarity spreads daily; strikes checked daily
    spreadSolidarity(state)
    checkLaborStrikes(state)
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

// All 9 zones for epidemic full-spread reference
const ALL_ZONES = [
  'north_farm', 'south_farm', 'workshop_district', 'market_square',
  'scholar_quarter', 'residential_east', 'residential_west', 'guard_post', 'plaza',
]
// ZONE_ADJACENCY is imported from constitution.ts

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

    // Apply per-tick effects to NPCs in affected zones (scan npcs once per event, no filter alloc)
    // Epidemic uses a higher mortality multiplier calibrated to give ~30% deaths at intensity=1
    // over a default 7-day event (168 ticks): per-tick rate ≈ intensity * 0.0024
    const mortalityPerTick = ev.type === 'epidemic'
      ? ev.effects_per_tick.displacement_chance * 0.006
      : ev.effects_per_tick.displacement_chance * 0.002

    for (const npc of state.npcs) {
      if (!npc.lifecycle.is_alive) continue
      if (ev.zones.length > 0 && !ev.zones.includes(npc.zone)) continue

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

export function spawnEvent(state: WorldState, partial: Partial<SimEvent>): SimEvent {
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
  return ev
}

/**
 * Apply immediate zone-targeted deaths when a catastrophic event spawns.
 * Uses the event's `instant_kill_rate` field. Returns the number of NPCs killed.
 */
export function applyInstantEventDeaths(state: WorldState, ev: SimEvent): number {
  const rate = ev.effects_per_tick.instant_kill_rate ?? 0
  if (rate <= 0) return 0

  const cause = ev.effects_per_tick.instant_kill_cause ?? 'accident'
  const affected = state.npcs.filter(
    n => n.lifecycle.is_alive && (ev.zones.length === 0 || ev.zones.includes(n.zone)),
  )

  let killed = 0
  for (const npc of affected) {
    if (Math.random() < rate) {
      npc.lifecycle.is_alive = false
      npc.lifecycle.death_cause = cause
      npc.lifecycle.death_tick = state.tick
      killed++
    }
  }
  return killed
}

function defaultEffects(type: string, intensity: number): SimEvent['effects_per_tick'] {
  const i = intensity
  // displacement_chance: per-tick mortality rate factor (applied in tickEvents as × 0.002)
  // instant_kill_rate: fraction of zone NPCs killed immediately on event spawn
  const map: Record<string, SimEvent['effects_per_tick']> = {
    storm:            { food_stock_delta: -i * 50,  stress_delta: i * 2,  trust_delta: -i * 3,  displacement_chance: i * 0.10 },
    drought:          { food_stock_delta: -i * 80,  stress_delta: i * 1,  trust_delta: -i * 2,  displacement_chance: i * 0.05 },
    flood:            { food_stock_delta: -i * 60,  stress_delta: i * 3,  trust_delta: -i * 4,  displacement_chance: i * 0.20 },
    tsunami:          { food_stock_delta: -i * 200, stress_delta: i * 8,  trust_delta: -i * 6,  displacement_chance: i * 0.60, instant_kill_rate: i * 0.35, instant_kill_cause: 'accident' },
    earthquake:       { food_stock_delta: -i * 100, stress_delta: i * 6,  trust_delta: -i * 5,  displacement_chance: i * 0.40, instant_kill_rate: i * 0.15, instant_kill_cause: 'accident' },
    wildfire:         { food_stock_delta: -i * 70,  stress_delta: i * 4,  trust_delta: -i * 3,  displacement_chance: i * 0.25 },
    epidemic:         { food_stock_delta: 0,         stress_delta: i * 4,  trust_delta: -i * 5,  displacement_chance: i * 0.40 },
    resource_boom:    { food_stock_delta: +i * 100, stress_delta: -i * 2, trust_delta: +i * 3,  displacement_chance: 0 },
    harsh_winter:     { food_stock_delta: -i * 70,  stress_delta: i * 2,  trust_delta: -i * 2,  displacement_chance: i * 0.08 },
    trade_offer:      { food_stock_delta: +i * 60,  stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    refugee_wave:     { food_stock_delta: -i * 30,  stress_delta: i * 2,  trust_delta: -i * 1,  displacement_chance: 0 },
    ideology_import:  { food_stock_delta: 0,         stress_delta: i * 1,  trust_delta: -i * 4,  displacement_chance: 0 },
    external_threat:  { food_stock_delta: -i * 20,  stress_delta: i * 5,  trust_delta: -i * 3,  displacement_chance: i * 0.10 },
    blockade:         { food_stock_delta: -i * 90,  stress_delta: i * 3,  trust_delta: -i * 5,  displacement_chance: i * 0.05 },
    scandal_leak:     { food_stock_delta: 0,         stress_delta: i * 2,  trust_delta: -i * 10, displacement_chance: 0 },
    charismatic_npc:  { food_stock_delta: 0,         stress_delta: -i * 1, trust_delta: +i * 2,  displacement_chance: 0 },
    martyr:           { food_stock_delta: 0,         stress_delta: i * 3,  trust_delta: -i * 8,  displacement_chance: 0 },
    tech_shift:       { food_stock_delta: +i * 40,  stress_delta: i * 1,  trust_delta: +i * 1,  displacement_chance: 0 },
    // ── Catastrophic man-made events ──────────────────────────────────────────
    nuclear_explosion: { food_stock_delta: -i * 500, stress_delta: i * 20, trust_delta: -i * 20, displacement_chance: i * 1.0, instant_kill_rate: i * 0.55, instant_kill_cause: 'violence' },
    bombing:           { food_stock_delta: -i * 150, stress_delta: i * 15, trust_delta: -i * 15, displacement_chance: i * 0.70, instant_kill_rate: i * 0.30, instant_kill_cause: 'violence' },
    meteor_strike:     { food_stock_delta: -i * 400, stress_delta: i * 18, trust_delta: -i * 18, displacement_chance: i * 0.90, instant_kill_rate: i * 0.45, instant_kill_cause: 'accident' },
    volcanic_eruption: { food_stock_delta: -i * 350, stress_delta: i * 16, trust_delta: -i * 16, displacement_chance: i * 0.80, instant_kill_rate: i * 0.40, instant_kill_cause: 'accident' },
  }
  return map[type] ?? { food_stock_delta: 0, stress_delta: 0, trust_delta: 0, displacement_chance: 0 }
}

// ── Direct NPC Interventions ─────────────────────────────────────────────────

export function applyInterventions(state: WorldState, interventions: NPCIntervention[]): { affected: number; killed: number } {
  let totalAffected = 0
  let totalKilled = 0

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

    if (iv.kill) totalKilled += candidates.length
    totalAffected += candidates.length
  }

  return { affected: totalAffected, killed: totalKilled }
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

  // Solidarity delta
  if (iv.solidarity_delta !== undefined) {
    npc.class_solidarity = clamp(npc.class_solidarity + iv.solidarity_delta, 0, 100)
    // End strike if solidarity drops below threshold
    if (npc.class_solidarity < 45 && npc.on_strike) npc.on_strike = false
  }

  // Memory injection
  if (iv.memory) {
    npc.memory.push({ event_id: 'intervention', type: iv.memory.type, emotional_weight: iv.memory.emotional_weight, tick: state.tick })
    if (npc.memory.length > MAX_NPC_MEMORIES) npc.memory.shift()
  }
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
      if (npc.action_state !== 'fleeing' && npc.action_state !== 'confront' && npc.action_state !== 'organizing') {
        activeProdSum += prod
      }
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
  const dailyProduction = farmerProd * 4 * scarcityFactor * seasonFactor * techBonuses.foodMult
  const dailyConsumption = n * 0.8
  state.food_stock = clamp((state.food_stock ?? 0) + dailyProduction - dailyConsumption, 0, 999999)
  const food = clamp(state.food_stock / (n * 30) * 100, 0, 100)

  // Natural resources — craftsmen and farmers extract resources; natural regeneration
  // Regen rate 0.00015 balances extraction at ~25k equilibrium (was 0.00002, too low)
  const extractionRate = (craftsmanProd * 0.3 + farmerProd * 0.1) * scarcityFactor
  const regenRate = (state.natural_resources ?? 50000) * 0.00015
  state.natural_resources = clamp(
    (state.natural_resources ?? 50000) + regenRate - extractionRate,
    0, 100000,
  )
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

  const stability = clamp(
    avgTrustGov * 30 +
    cohesion * 20 +
    (food / 100) * 25 +
    (1 - avgStress / 100) * 15 +
    (1 - politicalPressure / 100) * 10,
    0, 100,
  )

  const avgSolidarity = workerCount > 0 ? solidaritySum / workerCount : 0
  const labor_unrest = clamp(avgSolidarity * (0.4 + gini * 0.6), 0, 100)

  // Polarization index (0–100): variance in ideology + distance from center.
  const meanCollectivism = collectivismSum / n
  const meanAuthority = authorityTrustSum / n
  const varCollectivism = Math.max(0, collectivismSqSum / n - meanCollectivism * meanCollectivism)
  const varAuthority = Math.max(0, authoritySqSum / n - meanAuthority * meanAuthority)
  const stdCollectivism = Math.sqrt(varCollectivism)
  const stdAuthority = Math.sqrt(varAuthority)
  const centerDrift = Math.abs(meanCollectivism - 0.5) + Math.abs(meanAuthority - 0.5)
  const polarization = clamp(stdCollectivism * 90 + stdAuthority * 90 + centerDrift * 40, 0, 100)

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

// Minimum sim-ticks between births for the same couple.
// 720 sim-days × 24 ticks/day = 17 280 ticks ≈ 2 sim-years inter-birth interval.
const MIN_BIRTH_SPACING_TICKS = 720 * 24

// Maximum children per couple (varies with constitution safety net — wealthier / safer → fewer)
function maxChildrenPerCouple(state: WorldState): number {
  return Math.round(clamp(6 - state.constitution.safety_net * 3, 2, 8))
}

function computeBirthChancePerDay(a: NPC, b: NPC, state: WorldState): number {
  const baseFertility = Math.min(a.lifecycle.fertility, b.lifecycle.fertility)
  if (baseFertility <= 0) return 0

  // Enforce birth spacing — at least MIN_BIRTH_SPACING_TICKS since the last birth
  const lastA = a.lifecycle.last_birth_tick ?? -Infinity
  const lastB = b.lifecycle.last_birth_tick ?? -Infinity
  const lastBirth = Math.max(lastA, lastB)
  if (state.tick - lastBirth < MIN_BIRTH_SPACING_TICKS) return 0

  // Enforce maximum children per couple
  const totalChildren = new Set([...a.lifecycle.children_ids, ...b.lifecycle.children_ids]).size
  if (totalChildren >= maxChildrenPerCouple(state)) return 0

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

  // Base rate of 0.00015/day gives ~5 births/year at population 500 with ~125 couples,
  // producing ~1% annual growth (pre-modern realistic). Was 0.0008 which caused 16% growth.
  // With all factors maximally favorable the cap is 0.0006/day.
  // Spacing and max-children limits (maxChildrenPerCouple) ensure realistic lifetime family sizes.
  const chance = 0.00015 * baseFertility
    * happinessFactor
    * stressFactor
    * fearFactor
    * needsFactor
    * wealthFactor
    * trustFactor
    * foodFactor

  return clamp(chance, 0, 0.0006)
}

// ── Romance / Marriage helpers ──────────────────────────────────────────────

// Heartbreak cooldown length: 30 sim-days (30 days × 24 ticks/day = 720 ticks)
const HEARTBREAK_COOLDOWN_TICKS = 30 * 24

// Minimum romance score required before either partner can propose
const ROMANCE_THRESHOLD = 45

// Returns true if a and b are direct blood relations (parent-child).
function isBloodRelation(a: NPC, b: NPC): boolean {
  return a.lifecycle.children_ids.includes(b.id) || b.lifecycle.children_ids.includes(a.id)
}

// Worldview similarity: 0 (completely opposite) → 1 (identical)
function worldviewSimilarity(a: NPC, b: NPC): number {
  const dims = ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference'] as const
  const totalDiff = dims.reduce((s, d) => s + Math.abs(a.worldview[d] - b.worldview[d]), 0)
  return 1 - totalDiff / dims.length   // 0–1; 1 = identical worldview
}

// Compatibility score for a couple (0–1); affects marriage probability and divorce risk.
// High score → more likely to marry, less likely to divorce.
function coupleCompatibility(a: NPC, b: NPC): number {
  const wv   = worldviewSimilarity(a, b)                         // 0–1
  const age  = Math.max(0, 1 - Math.abs(a.age - b.age) / 30)    // 0–1
  // Wealth compatibility: extreme ratio = incompatible
  const minW = Math.min(a.wealth, b.wealth) + 1
  const maxW = Math.max(a.wealth, b.wealth) + 1
  const wlth = Math.max(0, 1 - Math.log(maxW / minW) / Math.log(50))  // 0–1
  return clamp(wv * 0.55 + age * 0.25 + wlth * 0.20, 0, 1)
}

// Apply heartbreak to an NPC: cooldown + grievance + isolation spike.
function applyHeartbreak(npc: NPC, state: WorldState): void {
  npc.lifecycle.romance_target_id = null
  npc.lifecycle.romance_score     = 0
  npc.lifecycle.heartbreak_cooldown = HEARTBREAK_COOLDOWN_TICKS
  npc.grievance  = clamp(npc.grievance  + 25, 0, 100)
  npc.isolation  = clamp(npc.isolation  + 20, 0, 100)
  // Memory entry for the heartbreak
  npc.memory.push({ event_id: `heartbreak_${state.tick}`, type: 'trust_broken', emotional_weight: -35, tick: state.tick })
  if (npc.memory.length > 10) npc.memory.shift()
}

// Dissolve a marriage and apply consequences to both partners.
function dissolveMarriage(npc: NPC, spouse: NPC, state: WorldState, reason: 'divorce' | 'widowed'): void {
  npc.lifecycle.spouse_id    = null
  spouse.lifecycle.spouse_id = null

  if (reason === 'divorce') {
    applyHeartbreak(npc,    state)
    applyHeartbreak(spouse, state)
    addChronicle(tf('engine.divorced', { a: npc.name, b: spouse.name }) as string, state.year, state.day, 'minor')
    addFeedRaw(tf('engine.divorced', { a: npc.name, b: spouse.name }) as string, 'info', state.year, state.day)
  }
}

function checkLifecycleEvents(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── 0. Tick heartbreak cooldowns ──────────────────────────────────────────
  for (const npc of living) {
    if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
      npc.lifecycle.heartbreak_cooldown = Math.max(0, npc.lifecycle.heartbreak_cooldown - 24)
    }
  }

  // ── 1. Birth check ────────────────────────────────────────────────────────
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

  // ── 2. Romance accumulation ───────────────────────────────────────────────
  // Each day, single adults who are not in heartbreak develop or deepen feelings
  // toward eligible contacts in their strong_ties (proximity + compatibility).
  const romanceCandidates = living.filter(n =>
    n.lifecycle.spouse_id === null &&
    n.age >= 18 &&
    n.age <= 55 &&
    (n.lifecycle.heartbreak_cooldown ?? 0) === 0,
  )
  for (const npc of romanceCandidates) {
    // Invalidate existing romance target if they've become unavailable
    const currentTarget = npc.lifecycle.romance_target_id !== null
      ? state.npcs[npc.lifecycle.romance_target_id]
      : null
    if (currentTarget) {
      if (!currentTarget.lifecycle.is_alive || currentTarget.lifecycle.spouse_id !== null) {
        // Target married someone else — heartbreak
        const wasMarried = currentTarget.lifecycle.spouse_id !== null
        if (wasMarried && npc.lifecycle.romance_score >= 20) {
          applyHeartbreak(npc, state)
        } else {
          npc.lifecycle.romance_target_id = null
          npc.lifecycle.romance_score     = 0
        }
        continue
      }
    }

    // Find eligible strong-tie partners (different gender, age-compatible, not blood-related, single)
    const eligible = npc.strong_ties
      .map(id => state.npcs[id])
      .filter(s =>
        s?.lifecycle.is_alive &&
        s.lifecycle.spouse_id === null &&
        s.gender !== npc.gender &&
        s.age >= 18 &&
        s.age <= 55 &&
        (s.lifecycle.heartbreak_cooldown ?? 0) === 0 &&
        Math.abs(s.age - npc.age) <= 20 &&
        !isBloodRelation(npc, s),
      ) as NPC[]

    if (eligible.length === 0) continue

    // Pick the most attractive candidate (by compatibility + same-zone proximity)
    let best: NPC | null = null
    let bestScore = -Infinity
    for (const s of eligible) {
      const compat   = coupleCompatibility(npc, s)
      const sameZone = npc.zone === s.zone ? 0.25 : 0
      const score    = compat + sameZone
      if (score > bestScore) { bestScore = score; best = s }
    }
    if (!best) continue

    // If no romance target yet, start developing feelings toward the best candidate
    if (npc.lifecycle.romance_target_id === null) {
      // Only start a new crush if both are happy enough (stress < 70 and happiness > 30)
      if (npc.stress < 70 && npc.happiness > 30 && Math.random() < 0.08) {
        npc.lifecycle.romance_target_id = best.id
        npc.lifecycle.romance_score     = 5
      }
      continue
    }

    // Deepen existing feelings if still eligible
    if (npc.lifecycle.romance_target_id !== best.id) continue
    // Proximity + happiness drive attraction growth (0.5–2.0 per day)
    const zoneBonus = npc.zone === best.zone ? 0.8 : 0
    const happyBonus = npc.happiness > 60 ? 0.5 : npc.happiness > 40 ? 0.2 : 0
    const growthRate = 0.5 + zoneBonus + happyBonus
    npc.lifecycle.romance_score = clamp(npc.lifecycle.romance_score + growthRate, 0, 100)
  }

  // ── 3. Mutual love → Marriage ─────────────────────────────────────────────
  for (const npc of romanceCandidates) {
    if (npc.lifecycle.spouse_id !== null) continue
    if (npc.lifecycle.romance_target_id === null) continue
    if (npc.lifecycle.romance_score < ROMANCE_THRESHOLD) continue

    const target = state.npcs[npc.lifecycle.romance_target_id]
    if (!target?.lifecycle.is_alive) continue
    if (target.lifecycle.spouse_id !== null) continue
    // Mutual love: both must have the other as their romance target
    if (target.lifecycle.romance_target_id !== npc.id) continue
    if (target.lifecycle.romance_score < ROMANCE_THRESHOLD) continue
    if (npc.id > target.id) continue  // canonical — lower id processes

    // Compatibility determines marriage probability: 0.2%–1.5% per day
    const compat = coupleCompatibility(npc, target)
    const marriageChance = clamp(0.002 + compat * 0.013, 0.002, 0.015)
    if (Math.random() > marriageChance) continue

    // They get married
    npc.lifecycle.spouse_id    = target.id
    target.lifecycle.spouse_id = npc.id
    npc.lifecycle.romance_target_id    = null
    target.lifecycle.romance_target_id = null
    npc.lifecycle.romance_score    = 0
    target.lifecycle.romance_score = 0
    if (npc.strong_ties.length    < MAX_STRONG_TIES) npc.strong_ties    = [...new Set([...npc.strong_ties,    target.id])]
    if (target.strong_ties.length < MAX_STRONG_TIES) target.strong_ties = [...new Set([...target.strong_ties, npc.id])]
    // Marriage happiness boost
    npc.happiness    = clamp(npc.happiness    + 12, 0, 100)
    target.happiness = clamp(target.happiness + 12, 0, 100)

    const msg = tf('engine.married', { a: npc.name, b: target.name }) as string
    addChronicle(msg, state.year, state.day, 'minor')
    addFeedRaw(msg, 'info', state.year, state.day)
  }

  // ── 4. Divorce check ─────────────────────────────────────────────────────
  // Triggers on: high combined stress + low happiness OR large worldview divergence.
  for (const npc of living) {
    if (npc.lifecycle.spouse_id === null) continue
    if (npc.id > npc.lifecycle.spouse_id) continue  // avoid double-processing
    const spouse = state.npcs[npc.lifecycle.spouse_id]
    if (!spouse?.lifecycle.is_alive) {
      npc.lifecycle.spouse_id = null  // widowed — clear ref
      continue
    }

    const avgStress    = (npc.stress    + spouse.stress)    / 2
    const avgHappiness = (npc.happiness + spouse.happiness) / 2

    // Stress + unhappiness factor
    const stressChance = Math.max(0, (avgStress - 70) / 100) * Math.max(0, (50 - avgHappiness) / 50) * 0.003

    // Worldview divergence factor: large accumulated ideological gap → strain
    const wvDivergence = 1 - worldviewSimilarity(npc, spouse)  // 0–1; 1 = opposites
    const divergenceChance = Math.max(0, wvDivergence - 0.55) * 0.004  // only kicks in above 55% divergence

    const divorceChance = stressChance + divergenceChance
    if (divorceChance > 0 && Math.random() < divorceChance) {
      dissolveMarriage(npc, spouse, state, 'divorce')
    }
  }

  // ── 5. Network limit during heartbreak ───────────────────────────────────
  // NPCs in heartbreak withdraw socially: cap strong_ties at 8 new connections.
  for (const npc of living) {
    if ((npc.lifecycle.heartbreak_cooldown ?? 0) <= 0) continue
    if (npc.strong_ties.length <= 8) continue
    // Keep the first 8 ties (oldest connections — don't cut long-standing friendships)
    npc.strong_ties = npc.strong_ties.slice(0, 8)
  }
}

function spawnBirth(state: WorldState, parent: NPC): void {
  const { constitution, npcs } = state
  const newId = npcs.length
  const baby  = createNPC(newId, npcs.length + 1, constitution)

  // Babies start as children — they will grow up and choose a career at age 18
  baby.age              = 0
  baby.role             = 'child'
  baby.zone             = (RESIDENTIAL_ZONES as readonly string[]).includes(parent.zone)
    ? parent.zone : RESIDENTIAL_ZONES[Math.floor(Math.random() * RESIDENTIAL_ZONES.length)]
  baby.lifecycle.fertility    = 0
  baby.lifecycle.children_ids = []
  baby.mentor_id = parent.id

  parent.lifecycle.children_ids.push(newId)
  parent.lifecycle.last_birth_tick = state.tick

  if (parent.lifecycle.spouse_id !== null) {
    const spouse = npcs[parent.lifecycle.spouse_id]
    if (spouse) {
      spouse.lifecycle.children_ids.push(newId)
      spouse.lifecycle.last_birth_tick = state.tick
    }
  }

  // Add to network
  state.network.strong.set(newId, new Set([parent.id]))
  state.network.info.set(newId, new Set())
  baby.strong_ties = [parent.id]
  baby.info_ties   = []

  npcs.push(baby)
  state.births_total += 1
  addChronicle(tf('engine.birth', { parent: parent.name }) as string, state.year, state.day, 'minor')
}

function spawnImmigrant(state: WorldState): void {
  const { constitution, npcs } = state
  const newId = npcs.length
  const immigrant = createNPC(newId, npcs.length + 1, constitution)
  immigrant.age = Math.max(18, Math.min(55, immigrant.age))
  immigrant.lifecycle.spouse_id = null
  immigrant.lifecycle.children_ids = []
  immigrant.memory = []

  const living = npcs.filter(n => n.lifecycle.is_alive)
  const sameZone = living.filter(n => n.zone === immigrant.zone)
  const tiePool = sameZone.length > 0 ? sameZone : living
  const strongTargets = tiePool.sort(() => Math.random() - 0.5).slice(0, 2)
  const weakTargets = tiePool.sort(() => Math.random() - 0.5).slice(0, 8)
  const infoTargets = tiePool.sort(() => Math.random() - 0.5).slice(0, 5)

  state.network.strong.set(newId, new Set(strongTargets.map(n => n.id)))
  state.network.weak.set(newId, new Set(weakTargets.map(n => n.id)))
  state.network.info.set(newId, new Set(infoTargets.map(n => n.id)))

  immigrant.strong_ties = strongTargets.map(n => n.id)
  immigrant.weak_ties = weakTargets.map(n => n.id)
  immigrant.info_ties = infoTargets.map(n => n.id)

  for (const target of strongTargets) {
    if (target.strong_ties.length < MAX_STRONG_TIES) {
      state.network.strong.get(target.id)?.add(newId)
      target.strong_ties = [...new Set([...target.strong_ties, newId])]
    }
  }
  for (const target of weakTargets) {
    if (target.weak_ties.length < MAX_WEAK_TIES) {
      state.network.weak.get(target.id)?.add(newId)
      target.weak_ties = [...new Set([...target.weak_ties, newId])]
    }
  }
  for (const target of infoTargets) {
    if (target.info_ties.length < MAX_INFO_TIES) {
      state.network.info.get(target.id)?.add(newId)
      target.info_ties = [...new Set([...target.info_ties, newId])]
    }
  }

  npcs.push(immigrant)
  state.immigration_total += 1
}

function checkImmigration(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length >= 1200) return

  const hasSevereCrisis = state.macro.food < 35 || state.macro.stability < 35 || state.macro.political_pressure > 70
  if (hasSevereCrisis) return

  const attractiveness =
    state.macro.stability * 0.35 +
    state.macro.trust * 0.30 +
    state.macro.food * 0.25 +
    (100 - state.macro.political_pressure) * 0.10

  const chance = clamp((attractiveness - 55) / 120, 0, 0.35)
  if (Math.random() >= chance) return

  const arrivals = 1 + Math.floor(Math.random() * (attractiveness > 75 ? 4 : 2))
  for (let i = 0; i < arrivals; i++) spawnImmigrant(state)

  const text = tf('engine.immigration_wave', { n: arrivals })
  addFeedRaw(text, 'info', state.year, state.day)
  addChronicle(text, state.year, state.day, 'minor')
}

// ── Network Maintenance ───────────────────────────────────────────────────────

/**
 * Daily: remove dead NPC IDs from all tie arrays and sync the network Maps.
 * Prevents arrays from bloating as NPCs die over time.
 */
function maintainNetworkLinks(state: WorldState): void {
  const alive = new Set(state.npcs.filter(n => n.lifecycle.is_alive).map(n => n.id))

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    npc.strong_ties = npc.strong_ties.filter(id => alive.has(id))
    npc.weak_ties   = npc.weak_ties.filter(id => alive.has(id))
    npc.info_ties   = npc.info_ties.filter(id => alive.has(id))
  }

  // Sync the Map-based graph too
  for (const [, set] of state.network.strong) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
  for (const [, set] of state.network.weak) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
  for (const [, set] of state.network.info) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
}

/**
 * Every 30 days: refresh a fraction of info ties to reflect worldview drift.
 * NPCs whose worldviews have diverged lose info ties; newly similar NPCs gain them.
 * This prevents the info network from becoming stale after prolonged ideological shifts.
 */
function refreshInfoTies(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const infoTarget = Math.round(10 + clamp(state.constitution.network_cohesion, 0.1, 1) * 30)

  // Process ~20% of living NPCs per refresh cycle (spread load across calls)
  const sample = living.filter(() => Math.random() < 0.20)

  for (const npc of sample) {
    // Drop ties where worldviews have significantly diverged
    npc.info_ties = npc.info_ties.filter(id => {
      const other = state.npcs[id]
      if (!other?.lifecycle.is_alive) return false
      const collectivismDiff = Math.abs(npc.worldview.collectivism - other.worldview.collectivism)
      const authorityDiff    = Math.abs(npc.worldview.authority_trust - other.worldview.authority_trust)
      const riskDiff         = Math.abs(npc.worldview.risk_tolerance - other.worldview.risk_tolerance)
      // Keep tie if still ideologically close, same role, or same community group
      return collectivismDiff < 0.40 || authorityDiff < 0.40 || riskDiff < 0.35
        || npc.role === other.role
        || (npc.community_group !== null && npc.community_group === other.community_group)
    })

    // Try to form new ties through friends-of-friends (triadic closure)
    if (npc.info_ties.length < infoTarget) {
      const candidates = new Set<number>()
      for (const tid of npc.strong_ties.slice(0, 5)) {
        const neighbor = state.npcs[tid]
        if (!neighbor?.lifecycle.is_alive) continue
        for (const iid of neighbor.info_ties) {
          if (iid !== npc.id && !npc.info_ties.includes(iid)) candidates.add(iid)
        }
      }
      for (const cid of candidates) {
        if (npc.info_ties.length >= infoTarget) break
        const other = state.npcs[cid]
        if (!other?.lifecycle.is_alive || other.info_ties.length >= MAX_INFO_TIES) continue
        const collectivismDiff = Math.abs(npc.worldview.collectivism - other.worldview.collectivism)
        const authorityDiff    = Math.abs(npc.worldview.authority_trust - other.worldview.authority_trust)
        if (collectivismDiff < 0.25 && authorityDiff < 0.25) {
          npc.info_ties.push(cid)
          state.network.info.get(npc.id)?.add(cid)
          other.info_ties.push(npc.id)
          state.network.info.get(cid)?.add(npc.id)
        }
      }
    }
  }
}

/**
 * Daily: NPCs who are socializing in the same zone have a small chance to
 * form a new strong tie — organic friendship through repeated contact.
 * Rate: ~1% per socializing pair per day. Capped by MAX_STRONG_TIES.
 */
function formOrganicStrongTies(state: WorldState): void {
  const byZone: Record<string, NPC[]> = {}
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.action_state !== 'socializing') continue
    if (npc.strong_ties.length >= MAX_STRONG_TIES) continue
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  for (const group of Object.values(byZone)) {
    if (group.length < 2) continue
    // Sample a small subset of pairs to avoid O(N²) per zone
    const maxPairs = Math.min(group.length, 8)
    for (let i = 0; i < maxPairs; i++) {
      const a = group[i]
      const b = group[Math.floor(Math.random() * group.length)]
      if (a.id === b.id || a.strong_ties.includes(b.id)) continue
      if (b.strong_ties.length >= MAX_STRONG_TIES) continue
      if (Math.random() < 0.01) {   // ~1% daily chance per encountered pair
        a.strong_ties.push(b.id)
        b.strong_ties.push(a.id)
        state.network.strong.get(a.id)?.add(b.id)
        state.network.strong.get(b.id)?.add(a.id)
      }
    }
  }
}

// ── Class Solidarity & Labor Strikes ─────────────────────────────────────────

/**
 * Daily: spread class solidarity through weak_ties among same-role / same-class neighbors.
 * High inequality accelerates spread; rising personal income and govt trust slow it.
 * Leaders and guards naturally resist (structural interest in the status quo).
 */
function spreadSolidarity(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const gini   = state.macro.gini
  if (gini < 0.15) return  // solidarity is meaningless in truly egalitarian societies

  const avgIncome = living.reduce((s, n) => s + n.daily_income, 0) / Math.max(living.length, 1)

  for (const npc of living) {
    // Elites and enforcers drift toward lower solidarity (structural interest)
    if (npc.role === 'leader' || npc.role === 'guard') {
      npc.class_solidarity = clamp(npc.class_solidarity - 0.3, 0, 100)
      continue
    }
    if (npc.role === 'child') continue

    let delta = 0

    // Pull from same-class weak-tie neighbors with high solidarity + grievance
    let pullCount = 0
    for (const tid of npc.weak_ties.slice(0, 25)) {
      const neighbor = state.npcs[tid]
      if (!neighbor?.lifecycle.is_alive) continue
      const wealthRatio = Math.max(npc.wealth, neighbor.wealth) / (Math.min(npc.wealth, neighbor.wealth) + 1)
      const sameClass   = npc.role === neighbor.role || wealthRatio < 2.5
      if (!sameClass) continue
      if (neighbor.class_solidarity > npc.class_solidarity + 10 && neighbor.grievance > 45) {
        delta += (neighbor.class_solidarity - npc.class_solidarity) * 0.025
        pullCount++
      }
    }
    if (pullCount > 0) delta = delta / pullCount

    // Inequality amplifier: high gini turbocharges spread
    delta *= (0.5 + gini * 1.5)

    // Personal prosperity counters solidarity (rational self-interest)
    if (npc.daily_income > avgIncome * 1.25) delta -= 0.8
    if (npc.wealth > 2000) delta -= 0.4

    // High government trust dampens solidarity
    const govTrust = (npc.trust_in.government.intention + npc.trust_in.government.competence) / 2
    if (govTrust > 0.55) delta -= govTrust * 0.6

    // Natural gravity toward gini-calibrated baseline (long-run equilibrium)
    const baseline = clamp((gini - 0.25) * 90, 0, 60)
    delta += (baseline - npc.class_solidarity) * 0.005

    npc.class_solidarity = clamp(npc.class_solidarity + delta, 0, 100)
  }
}

// Cooldown: prevent the same role from striking twice within 60 sim-days
const strikeCooldown: Record<string, number> = {}

/**
 * Daily: detect whether worker solidarity has crossed the strike threshold.
 * A strike triggers when: avg solidarity > 72, avg grievance > 58, gini > 0.42.
 * Existing strikes advance and end naturally or via government policy.
 */
function checkLaborStrikes(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── Advance active strikes ──────────────────────────────────────────────
  state.active_strikes = (state.active_strikes ?? []).filter(strike => {
    const elapsed = state.tick - strike.start_tick
    if (elapsed >= strike.duration_ticks) {
      // Strike ends — exhaustion from sustained action drops solidarity
      addFeedRaw(tf('engine.strike_end', { role: t(`role.${strike.role}`) as string }) as string, 'info', state.year, state.day)
      addChronicle(tf('engine.strike_end', { role: t(`role.${strike.role}`) as string }) as string, state.year, state.day, 'major')
      for (const npc of living.filter(n => n.role === strike.role)) {
        npc.class_solidarity = clamp(npc.class_solidarity - 18, 0, 100)
        npc.on_strike = false
      }
      return false
    }

    // While striking: hold action_state as 'organizing', maintain on_strike flag
    for (const npc of living.filter(n => n.role === strike.role && n.class_solidarity > 45)) {
      npc.on_strike      = true
      npc.action_state   = 'organizing'
    }
    return true
  })

  // ── Detect new strikes ──────────────────────────────────────────────────
  const strikeable = ['farmer', 'craftsman', 'merchant', 'scholar'] as const
  for (const role of strikeable) {
    if ((state.active_strikes ?? []).some(s => s.role === role)) continue
    const cooldownEnd = strikeCooldown[role] ?? 0
    if (state.tick - cooldownEnd < 24 * 60) continue  // 60-day cooldown per role

    const roleNPCs       = living.filter(n => n.role === role)
    if (roleNPCs.length < 4) continue
    const avgSolidarity  = roleNPCs.reduce((s, n) => s + n.class_solidarity, 0) / roleNPCs.length
    const avgGrievance   = roleNPCs.reduce((s, n) => s + n.grievance,        0) / roleNPCs.length

    if (avgSolidarity > 72 && avgGrievance > 58 && state.macro.gini > 0.42) {
      const demand: ActiveStrike['demand'] = avgGrievance > 80 ? 'rights'
        : state.macro.gini > 0.60          ? 'wages'
        :                                    'conditions'
      const durationTicks = (5 + Math.floor(Math.random() * 10)) * 24   // 5–15 sim-days
      const strike: ActiveStrike = { role, start_tick: state.tick, duration_ticks: durationTicks, demand }
      state.active_strikes.push(strike)
      strikeCooldown[role] = state.tick

      const roleLabel   = t(`role.${role}`) as string
      const demandLabel = t(`strike.demand.${demand}`) as string
      addFeedRaw(tf('engine.strike_start', { role: roleLabel, demand: demandLabel }) as string, 'critical', state.year, state.day)
      addChronicle(tf('engine.strike_start', { role: roleLabel, demand: demandLabel }) as string, state.year, state.day, 'major')
    }
  }
}

/**
 * Daily: recompute bridge_score (betweenness proxy) for each NPC and
 * update influence_score to reflect both strong-tie centrality and bridging power.
 * Bridge score = fraction of distinct zone-clusters spanned by an NPC's weak_ties.
 * A high bridge NPC controls cross-community information flow → more influence.
 */
function computeBridgeScores(state: WorldState): void {
  const totalClusters = Math.max(new Set([...state.network.clusters.values()]).size, 1)
  const maxDegree = Math.max(...state.npcs.map(n => n.strong_ties.length), 1)

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) { npc.bridge_score = 0; continue }

    const spannedClusters = new Set<number>()
    for (const tid of npc.weak_ties) {
      const cluster = state.network.clusters.get(tid)
      if (cluster !== undefined) spannedClusters.add(cluster)
    }
    npc.bridge_score = spannedClusters.size / totalClusters

    // Combined influence: 60% strong-tie centrality + 40% bridging power
    const strongCentrality  = npc.strong_ties.length / maxDegree
    npc.influence_score = clamp(strongCentrality * 0.6 + npc.bridge_score * 0.4, 0, 1)
  }
}

// ── Mentorship Dynamics ─────────────────────────────────────────────────────
// Youth and early-career NPCs learn faster when paired with a trusted mentor.

function applyMentorshipDynamics(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  for (const npc of living) {
    // Resolve invalid mentors (dead / no longer a strong tie)
    if (npc.mentor_id !== null) {
      const mentor = state.npcs[npc.mentor_id]
      if (!mentor?.lifecycle.is_alive || !npc.strong_ties.includes(mentor.id)) {
        npc.mentor_id = null
      }
    }

    // Assign mentor for youths and early-career adults
    const needsMentor = npc.age >= 14 && npc.age <= 25 && npc.mentor_id === null
    if (needsMentor) {
      const candidates = npc.strong_ties
        .map(id => state.npcs[id])
        .filter((m): m is NPC => !!m && m.lifecycle.is_alive && m.age >= 25 && m.role !== 'child')
        .sort((a, b) => b.influence_score - a.influence_score)

      const mentor = candidates[0]
      if (mentor && mentor.influence_score > 0.25) {
        npc.mentor_id = mentor.id
      }
    }

    if (npc.mentor_id === null) continue
    const mentor = state.npcs[npc.mentor_id]
    if (!mentor?.lifecycle.is_alive) continue

    // Skill transfer and emotional buffering
    const mentorshipStrength = clamp(mentor.influence_score * 0.8 + (mentor.happiness / 100) * 0.2, 0.1, 1)
    npc.base_skill = clamp(npc.base_skill + 0.0006 * mentorshipStrength, 0.2, 1.2)
    npc.stress = clamp(npc.stress - 0.25 * mentorshipStrength, 0, 100)

    // Ideological apprenticeship (gentle pull, not hard indoctrination)
    npc.worldview.collectivism = clamp(
      npc.worldview.collectivism + (mentor.worldview.collectivism - npc.worldview.collectivism) * 0.0012,
      0,
      1,
    )
    npc.worldview.authority_trust = clamp(
      npc.worldview.authority_trust + (mentor.worldview.authority_trust - npc.worldview.authority_trust) * 0.0012,
      0,
      1,
    )
  }
}

// ── Opinion Leaders / Propaganda Dynamics ─────────────────────────────────
// High-influence NPCs shape public trust and grievance through info networks.

function applyOpinionLeaderDynamics(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const leaders = [...living]
    .filter(n => n.influence_score > 0.60 && n.info_ties.length >= 8)
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, 12)

  if (leaders.length === 0) return

  let proGov = 0
  let antiGov = 0

  for (const leader of leaders) {
    const govTrust = (leader.trust_in.government.intention + leader.trust_in.government.competence) / 2
    const isProGov = govTrust > 0.62 && leader.grievance < 45
    const isAntiGov = govTrust < 0.35 || leader.grievance > 65
    if (!isProGov && !isAntiGov) continue

    if (isProGov) proGov++
    if (isAntiGov) antiGov++

    for (const tid of leader.info_ties.slice(0, 16)) {
      const follower = state.npcs[tid]
      if (!follower?.lifecycle.is_alive) continue

      if (isProGov) {
        follower.trust_in.government.intention = clamp(follower.trust_in.government.intention + 0.0035, 0, 1)
        follower.grievance = clamp(follower.grievance - 0.25, 0, 100)
      } else if (isAntiGov) {
        follower.trust_in.government.intention = clamp(follower.trust_in.government.intention - 0.0035, 0, 1)
        follower.grievance = clamp(follower.grievance + 0.3, 0, 100)
      }
    }
  }

  if (state.tick - lastOpinionFeedTick > 15 * 24 && (proGov + antiGov) >= 2) {
    lastOpinionFeedTick = state.tick
    if (antiGov > proGov) {
      addFeedRaw('Influential voices are turning against the regime and amplifying dissent across districts.', 'political', state.year, state.day)
      addChronicle('Opinion leaders coordinated anti-government narratives through information networks.', state.year, state.day, 'major')
    } else if (proGov > antiGov) {
      addFeedRaw('High-profile voices are defending the regime and calming public anger.', 'political', state.year, state.day)
      addChronicle('Opinion leaders rallied support for institutional stability.', state.year, state.day, 'major')
    }
  }
}

// ── Cross-zone Organizing via Info Network ────────────────────────────────
// Organizing in one zone can spill into other zones through info ties.

function propagateCrossZoneOrganizing(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const byZone = new Map<string, NPC[]>()
  for (const npc of living) {
    const arr = byZone.get(npc.zone)
    if (arr) arr.push(npc)
    else byZone.set(npc.zone, [npc])
  }

  const hotZones = new Set<string>()
  for (const [zone, group] of byZone) {
    const organizingRate = group.filter(n => n.action_state === 'organizing' || n.action_state === 'confront').length / Math.max(group.length, 1)
    if (organizingRate > 0.15) hotZones.add(zone)
  }
  if (hotZones.size === 0) return

  for (const npc of living) {
    if (hotZones.has(npc.zone)) continue
    if (npc.action_state === 'organizing' || npc.action_state === 'confront') continue

    let signal = 0
    for (const tid of npc.info_ties.slice(0, 20)) {
      const other = state.npcs[tid]
      if (!other?.lifecycle.is_alive) continue
      if (!hotZones.has(other.zone)) continue
      if (other.action_state === 'organizing' || other.action_state === 'confront') {
        signal += 1 + other.influence_score * 0.6
      }
    }

    if (signal <= 0) continue
    npc.grievance = clamp(npc.grievance + Math.min(signal * 0.18, 2.5), 0, 100)
    npc.dissonance_acc = clamp(npc.dissonance_acc + Math.min(signal * 0.12, 2.0), 0, 100)

    const joinChance = clamp(signal / 45, 0, 0.22)
    if (npc.grievance > 45 && Math.random() < joinChance) {
      npc.action_state = 'organizing'
    }
  }
}

// ── Crisis Bonding & Network Contraction ──────────────────────────────────
// Shared danger builds local solidarity, while fear contracts weak ties.

function applyCrisisBonding(state: WorldState): void {
  const inCrisis = state.active_events.length > 0 || state.macro.stability < 35 || state.macro.food < 25
  if (inCrisis) lastCrisisTick = state.tick

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  // Fear-driven contraction: high-fear NPCs drop peripheral weak ties.
  for (const npc of living) {
    if (npc.fear <= 70 || npc.weak_ties.length < 12) continue
    const dropCount = 1 + Math.floor((npc.fear - 70) / 20)
    for (let i = 0; i < dropCount && npc.weak_ties.length > 8; i++) {
      const idx = Math.floor(Math.random() * npc.weak_ties.length)
      const removed = npc.weak_ties.splice(idx, 1)[0]
      state.network.weak.get(npc.id)?.delete(removed)
      state.network.weak.get(removed)?.delete(npc.id)
      const other = state.npcs[removed]
      if (other) other.weak_ties = other.weak_ties.filter(id => id !== npc.id)
    }
  }

  // Shared-trauma bonding: while crisis is active, survivors in same zone can form new ties faster.
  const zoneMap = new Map<string, NPC[]>()
  for (const npc of living) {
    const arr = zoneMap.get(npc.zone)
    if (arr) arr.push(npc)
    else zoneMap.set(npc.zone, [npc])
  }

  for (const group of zoneMap.values()) {
    if (group.length < 2) continue
    const attempts = Math.min(group.length, 10)
    for (let i = 0; i < attempts; i++) {
      const a = group[i]
      const b = group[Math.floor(Math.random() * group.length)]
      if (a.id === b.id) continue
      if (a.strong_ties.includes(b.id)) continue
      if (a.strong_ties.length >= MAX_STRONG_TIES || b.strong_ties.length >= MAX_STRONG_TIES) continue

      const bothUnderStress = a.fear > 45 && b.fear > 45
      const tieChance = inCrisis
        ? (bothUnderStress ? 0.05 : 0.02)
        : (state.tick - lastCrisisTick < 20 * 24 ? 0.02 : 0.01)
      if (Math.random() >= tieChance) continue

      a.strong_ties.push(b.id)
      b.strong_ties.push(a.id)
      state.network.strong.get(a.id)?.add(b.id)
      state.network.strong.get(b.id)?.add(a.id)
    }
  }
}

// ── Ideological Schism Event ───────────────────────────────────────────────
// High polarization can fracture society into antagonistic camps.

function checkIdeologicalSchism(state: WorldState): void {
  if (state.macro.polarization < 65) return
  if (state.tick - lastSchismTick < 45 * 24) return
  if (Math.random() > 0.18) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length < 40) return

  lastSchismTick = state.tick

  const campA = living.filter(n => n.worldview.collectivism >= 0.55)
  const campB = living.filter(n => n.worldview.collectivism < 0.45)
  if (campA.length < 15 || campB.length < 15) return

  // Cut a fraction of cross-camp info ties and weaken social trust.
  for (const npc of living) {
    npc.info_ties = npc.info_ties.filter(id => {
      const other = state.npcs[id]
      if (!other?.lifecycle.is_alive) return false
      const crossCamp = (npc.worldview.collectivism >= 0.55 && other.worldview.collectivism < 0.45)
        || (npc.worldview.collectivism < 0.45 && other.worldview.collectivism >= 0.55)
      if (!crossCamp) return true
      return Math.random() > 0.30
    })
    state.network.info.set(npc.id, new Set(npc.info_ties))
  }

  for (const npc of living) {
    if (npc.worldview.collectivism >= 0.55 || npc.worldview.collectivism < 0.45) {
      npc.grievance = clamp(npc.grievance + 6, 0, 100)
      npc.fear = clamp(npc.fear + 5, 0, 100)
    }
  }

  state.drift_score = clamp(state.drift_score + 0.08, 0, 1)
  addChronicle('Ideological schism: information bridges collapsed as society split into rival camps.', state.year, state.day, 'critical')
  addFeedRaw('Society fractures into opposing camps as polarization crosses a critical threshold.', 'critical', state.year, state.day)
}

// ── Season Transition ────────────────────────────────────────────────────────

function checkSeasonTransition(state: WorldState): void {
  const current = getSeason(state.day)
  if (current === lastSeason) return
  lastSeason = current

  const label = SEASON_LABELS[current]
  const descriptions: Record<string, string> = {
    spring: `${label} — farmers return to the fields. Food stores running low.`,
    summer: `${label} — crops are growing. The society settles into its rhythm.`,
    autumn: `${label} — harvest season. Food production at its peak.`,
    winter: `${label} — cold sets in. Food production drops sharply; hunger rises.`,
  }
  const text = descriptions[current]
  addChronicle(text, state.year, state.day, 'minor')
  addFeedRaw(text, 'info', state.year, state.day)
}

// ── Community Groups ─────────────────────────────────────────────────────────

let nextGroupId = 1

function checkCommunityGroups(state: WorldState): void {
  // ── Collective action outcome ──────────────────────────────────────────────
  // If a group has 3+ members organizing, they cross the threshold into collective
  // action: emit a chronicle event and push members toward confront (once per 10 days).
  const organizingByGroup = new Map<number, typeof state.npcs>()
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.community_group === null) continue
    if (npc.action_state !== 'organizing') continue
    const g = npc.community_group
    if (!organizingByGroup.has(g)) organizingByGroup.set(g, [])
    organizingByGroup.get(g)!.push(npc)
  }

  for (const [groupId, members] of organizingByGroup) {
    if (members.length < 3) continue
    const lastTick = groupCollectiveActionTick.get(groupId) ?? -9999
    if (state.tick - lastTick < 240) continue   // 10-day cooldown

    groupCollectiveActionTick.set(groupId, state.tick)
    const zone = members[0].zone
    const text = `A community group in the ${zone.replace(/_/g, ' ')} has mobilized — ${members.length} members marching together.`
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'warning', state.year, state.day)

    // Escalate: push members' dissonance and grievance — makes confront more likely next tick
    for (const m of members) {
      m.dissonance_acc = clamp(m.dissonance_acc + 15, 0, 100)
      m.grievance      = clamp(m.grievance      + 10, 0, 100)
      // Solidarity: brief trust boost with community institution
      m.trust_in.community.intention  = clamp(m.trust_in.community.intention  + 0.05, 0, 1)
      m.trust_in.community.competence = clamp(m.trust_in.community.competence + 0.03, 0, 1)
    }
  }

  // ── Formation ─────────────────────────────────────────────────────────────
  // 3+ socializing NPCs with mutual strong ties who have no group yet
  if (Math.random() > 0.05) {
    // Skip formation this day (~95% of days); still do dissolution below
  } else {
    const candidates = state.npcs.filter(n =>
      n.lifecycle.is_alive &&
      n.community_group === null &&
      n.action_state === 'socializing',
    )

    for (const npc of candidates) {
      if (npc.community_group !== null) continue
      const coMembers = npc.strong_ties
        .map(id => state.npcs[id])
        .filter(n => n?.lifecycle.is_alive && n.community_group === null && n.action_state === 'socializing')
      if (coMembers.length < 2) continue

      const groupId = nextGroupId++
      npc.community_group = groupId
      for (const m of coMembers.slice(0, 4)) {
        m.community_group = groupId
      }
      addChronicle(tf('engine.community_formed', {}) as string, state.year, state.day, 'major')
      break
    }
  }

  // ── Dissolution ───────────────────────────────────────────────────────────
  // Groups where fewer than 2 members are still alive
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

// ── Organizing Outcome ───────────────────────────────────────────────────────
// When unrest exceeds 12% of population, the government must respond:
//   - Suppression (strong guard + state power)
//   - Negotiation (weak guard or moderate trust)
//   - Standoff   (too weak to suppress, too distrusted to negotiate)
// 15-day cooldown prevents spam.

let lastOutcomeTick = -9999

function checkOrganizingOutcome(state: WorldState): void {
  if (state.tick - lastOutcomeTick < 15 * 24) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const unrestNPCs = living.filter(n => n.action_state === 'organizing' || n.action_state === 'confront')
  const unrestRate = unrestNPCs.length / living.length
  if (unrestRate < 0.12) return

  const guardInst  = state.institutions.find(i => i.id === 'guard')
  const govInst    = state.institutions.find(i => i.id === 'government')
  const guardPower = guardInst?.power ?? 0.3
  const govTrust   = state.macro.trust / 100
  const pct        = Math.round(unrestRate * 100)

  lastOutcomeTick = state.tick

  if (guardPower > 0.5 && state.constitution.state_power > 0.55) {
    const rights = state.constitution.individual_rights_floor

    // High rights (>0.75) block violent suppression — legal protections hold
    if (rights > 0.75) {
      const text = `Suppression attempted but legal protections hold — government forced to negotiate (rights floor: ${Math.round(rights * 100)}%).`
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'political', state.year, state.day)
      // Fall through to negotiation below
    } else {
      // Suppression: brutality scales inversely with individual rights
      // Low rights → high fear, brutal dispersal; high rights → softer response
      const fearDelta      = Math.round(12 + (1 - rights) * 28)   // 12–40
      const grievanceDelta = Math.round(8  + (1 - rights) * 18)   // 8–26
      const trustLoss      = 0.05 + (1 - rights) * 0.07           // 0.05–0.12

      const text = `Authorities suppress unrest — ${pct}% mobilizing. Rights floor: ${Math.round(rights * 100)}%.`
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)

      const target = unrestNPCs.slice(0, Math.ceil(unrestNPCs.length * 0.65))
      for (const npc of target) {
        npc.fear       = clamp(npc.fear       + fearDelta,      0, 100)
        npc.grievance   = clamp(npc.grievance   + grievanceDelta, 0, 100)
        npc.action_state = Math.random() < 0.45 ? 'fleeing' : 'complying'
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - trustLoss, 0, 1)
      }
      if (guardInst) guardInst.legitimacy = clamp(guardInst.legitimacy - 0.03 - (1 - rights) * 0.04, 0, 1)
      return
    }
  }

  if (govTrust > 0.35 || state.constitution.state_power < 0.45) {
    // Negotiation: government opens dialogue
    const text = `Government opens dialogue — ${pct}% of population organizing.`
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'political', state.year, state.day)

    for (const npc of unrestNPCs) {
      npc.grievance = clamp(npc.grievance - 12, 0, 100)
      npc.stress    = clamp(npc.stress    -  8, 0, 100)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.04, 0, 1)
    }
    if (govInst) govInst.legitimacy = clamp(govInst.legitimacy + 0.02, 0, 1)
    return
  }

  // Standoff: government can neither suppress nor negotiate
  const text = `Standoff: ${pct}% of citizens in open dissent — government cannot suppress or negotiate.`
  addChronicle(text, state.year, state.day, 'critical')
  addFeedRaw(text, 'critical', state.year, state.day)
  state.drift_score = clamp(state.drift_score + 0.10, 0, 1)
}

// ── Trust Recovery ───────────────────────────────────────────────────────────
// When the government maintains sustained stability (>60) and trust is still
// below base, a slow passive recovery trickles trust back toward the founding
// level — representing rebuilt credibility through consistent governance.
// Recovery stops at 0.65 to model the lasting scar of past betrayals.

function checkTrustRecovery(state: WorldState): void {
  if (state.macro.stability < 60) return
  if (state.macro.trust > 65)     return   // already healthy

  const recoveryRate = 0.0003   // per NPC per day — slow rebuild
  const cap = Math.min(state.constitution.base_trust * 0.9, 0.65)

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (npc.trust_in.government.intention >= cap) continue
    npc.trust_in.government.intention = clamp(
      npc.trust_in.government.intention + recoveryRate,
      0, cap,
    )
  }
}

// ── Welfare Redistribution ───────────────────────────────────────────────────
// `safety_net` (0–1) drives daily wealth transfer from the top 20% to the
// bottom 30%. At safety_net = 1.0 the top earners lose ~0.5% of wealth per day.
// Recipients get a small trust boost — they feel helped by the system.

function applyWelfare(state: WorldState): void {
  // High state_power societies use direct state rationing instead (applyStateRationing)
  if (state.constitution.state_power > 0.70) return
  const safetyNet = state.constitution.safety_net
  if (safetyNet < 0.05) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 10) return

  const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
  const n = sorted.length
  const topStart    = Math.floor(n * 0.80)   // top 20% pay
  const bottomEnd   = Math.floor(n * 0.30)   // bottom 30% receive

  // Collect tax from wealthy
  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const tax = npc.wealth * safetyNet * 0.005   // 0–0.5%/day based on safety_net
    npc.wealth = clamp(npc.wealth - tax, 0, 50000)
    pool += tax
  }
  if (pool <= 0) return

  // Distribute to poor
  const recipients = sorted.slice(0, bottomEnd)
  if (recipients.length === 0) return
  const share = pool / recipients.length
  for (const npc of recipients) {
    npc.wealth = clamp(npc.wealth + share, 0, 50000)
    // Small trust boost: social contract works
    if (share > 1) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.001, 0, 1)
    }
  }
}

// ── State Rationing (high state_power societies) ──────────────────────────────
// Replaces market-based welfare when state_power > 0.70.
// The government directly draws from food_stock to feed hungry citizens,
// and enforces equality through aggressive wealth leveling (top 30% → bottom 40%).

function applyStateRationing(state: WorldState): void {
  const { state_power, safety_net } = state.constitution
  if (state_power <= 0.70 || safety_net < 0.10) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 10) return

  // Food rationing: state draws from food_stock to relieve hunger
  const hungry    = living.filter(n => n.hunger > 45)
  const totalCost = hungry.length * safety_net * 0.5
  if (state.food_stock > totalCost && hungry.length > 0) {
    state.food_stock = clamp(state.food_stock - totalCost, 0, 999999)
    for (const npc of hungry) {
      npc.hunger = clamp(npc.hunger - 8 * safety_net, 0, 100)
      // Citizens feel helped — small trust boost for active state care
      npc.trust_in.government.intention = clamp(
        npc.trust_in.government.intention + 0.002 * state_power, 0, 1,
      )
    }
  }

  // Wealth leveling: state levy on top 30%, distributed to bottom 40%
  const sorted    = [...living].sort((a, b) => a.wealth - b.wealth)
  const n         = sorted.length
  const topStart  = Math.floor(n * 0.70)
  const bottomEnd = Math.floor(n * 0.40)

  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const levy = npc.wealth * state_power * safety_net * 0.008
    npc.wealth  = clamp(npc.wealth - levy, 0, 50000)
    pool += levy
  }
  if (pool > 0 && bottomEnd > 0) {
    const share = pool / bottomEnd
    for (const npc of sorted.slice(0, bottomEnd)) {
      npc.wealth = clamp(npc.wealth + share, 0, 50000)
    }
  }
}

// ── Feudal Tribute ────────────────────────────────────────────────────────────
// In high-inequality + high-state-power societies (Feudal, Warlord, Authoritarian),
// farmers and craftsmen pay a daily wealth tribute to leaders and guards.
// Generates grievance and trust erosion among tribute payers.
// Rate = (gini - 0.40) × state_power × 0.005 per day (zero for egalitarian societies).

function applyFeudalTribute(state: WorldState): void {
  const { gini_start, state_power } = state.constitution
  const tributeRate = Math.max(0, (gini_start - 0.40) * state_power * 0.005)
  if (tributeRate < 0.0001) return

  const living     = state.npcs.filter(n => n.lifecycle.is_alive)
  const payers     = living.filter(n => n.role === 'farmer'  || n.role === 'craftsman')
  const collectors = living.filter(n => n.role === 'leader'  || n.role === 'guard')
  if (collectors.length === 0 || payers.length === 0) return

  let pool = 0
  for (const npc of payers) {
    const tribute = npc.wealth * tributeRate
    if (tribute < 0.01) continue
    npc.wealth    = clamp(npc.wealth - tribute, 0, 50000)
    pool         += tribute
    // Tribute generates grievance and erodes trust in government
    npc.grievance = clamp(npc.grievance + tributeRate * 300, 0, 100)
    npc.trust_in.government.intention = clamp(
      npc.trust_in.government.intention - tributeRate * 0.3, 0, 1,
    )
  }
  if (pool <= 0) return

  const share = pool / collectors.length
  for (const npc of collectors) {
    npc.wealth = clamp(npc.wealth + share, 0, 50000)
  }
}

// ── Income Tax Collection ─────────────────────────────────────────────────────
// All market-working NPCs (non-government roles) pay a fraction of their daily
// income as income tax into the state treasury (tax_pool). Tax rate depends on
// the constitutional regime:
//   authoritarian/socialist  → 25 %
//   welfare/theocratic       → 20 %
//   feudal                   → 15 %
//   moderate                 → 10 %
//   libertarian              →  5 %
// Workers who earn very little (daily_income < 5) are exempt to protect the poor.

export function getIncomeTaxRate(state: WorldState): number {
  const c = state.constitution
  if (c.state_power >= 0.75 && c.market_freedom < 0.25) return 0.25  // authoritarian
  if (c.safety_net >= 0.65 && c.gini_start < 0.40) return 0.20       // welfare
  if (c.state_power >= 0.70 && c.base_trust >= 0.65) return 0.20     // theocratic
  if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) return 0.15  // feudal
  if (c.market_freedom >= 0.70 && c.state_power < 0.40) return 0.05  // libertarian
  return 0.10  // moderate
}

function applyIncomeTax(state: WorldState): void {
  const taxRate = getIncomeTaxRate(state)
  if (taxRate <= 0) return

  const EXEMPT_THRESHOLD = 5   // daily_income below this is exempt

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.role === 'child') continue
    if (npc.role === 'guard' || npc.role === 'leader') continue  // govt workers don't pay income tax
    if (npc.daily_income < EXEMPT_THRESHOLD) continue

    // Tax is deducted from wealth (proxy for earned and held income).
    // Applied as 25% of the annual tax amount per day (quarterly collection cadence).
    const taxAmount = npc.daily_income * taxRate * 0.25
    if (taxAmount < 0.01) continue
    npc.wealth = clamp(npc.wealth - taxAmount, 0, 50000)
    state.tax_pool = clamp((state.tax_pool ?? 0) + taxAmount, 0, 9_999_999)

    // High tax with low perceived government competence → grievance
    if (taxRate >= 0.20 && npc.trust_in.government.competence < 0.40) {
      npc.grievance = clamp(npc.grievance + 0.5, 0, 100)
    }
    // Tax in welfare states with good trust → slight happiness boost (safety net working)
    if (taxRate >= 0.15 && npc.trust_in.government.intention > 0.60) {
      npc.happiness = clamp(npc.happiness + 0.2, 0, 100)
    }
  }
}

// ── Government Wage Payments ──────────────────────────────────────────────────
// Guards and leaders receive daily wages from the tax_pool.
// Base wages: guard=8, leader=14 coins/day.
// If the pool is insufficient, wages are prorated (government insolvency).
// Running out of money triggers guard morale collapse (fear spike).

const GOVT_WAGE_GUARD  = 8
const GOVT_WAGE_LEADER = 14

function applyGovernmentWages(state: WorldState): void {
  if ((state.tax_pool ?? 0) <= 0) return

  const guards  = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard')
  const leaders = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'leader')
  const totalWageBill = guards.length * GOVT_WAGE_GUARD + leaders.length * GOVT_WAGE_LEADER

  if (totalWageBill <= 0) return

  const pool = state.tax_pool ?? 0
  const payRatio = pool >= totalWageBill ? 1.0 : pool / totalWageBill
  const poolSpent = Math.min(pool, totalWageBill)
  state.tax_pool = clamp(pool - poolSpent, 0, 9_999_999)

  for (const npc of guards) {
    const wage = GOVT_WAGE_GUARD * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    npc.daily_income = npc.daily_income * 0.99 + wage  // update income EMA with daily wage
    if (payRatio < 0.5) {
      // Government insolvency → guards become demoralized and fearful
      npc.fear      = clamp(npc.fear + 5, 0, 100)
      npc.grievance = clamp(npc.grievance + 3, 0, 100)
    }
  }
  for (const npc of leaders) {
    const wage = GOVT_WAGE_LEADER * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    npc.daily_income = npc.daily_income * 0.99 + wage  // update income EMA with daily wage
    if (payRatio < 0.5) {
      npc.fear      = clamp(npc.fear + 3, 0, 100)
      npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }
}

// ── Regime-Based Tax Spending ─────────────────────────────────────────────────
// Every 7 days the government spends accumulated tax revenue on regime-specific
// investments. Each spending type applies macro or NPC-level bonuses and emits
// a feed message explaining the policy.

let lastTaxSpendingDay = -1

function spendTaxRevenue(state: WorldState): void {
  // Only spend every 7 days; skip if pool is too small to matter
  if (state.day === lastTaxSpendingDay) return
  if (state.day % 7 !== 0) return
  if ((state.tax_pool ?? 0) < 50) return
  lastTaxSpendingDay = state.day

  const pool = state.tax_pool ?? 0
  const spendAmount = pool * 0.50   // spend up to 50% of accumulated pool each cycle
  state.tax_pool = clamp(pool - spendAmount, 0, 9_999_999)

  const c = state.constitution
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length === 0) return

  // Detect regime for spending pattern
  let spendType: 'infrastructure' | 'research' | 'military' | 'welfare' | 'temples' | 'balanced'
  if (c.state_power >= 0.75 && c.market_freedom < 0.25) {
    spendType = 'military'           // authoritarian: military + surveillance
  } else if (c.safety_net >= 0.65 && c.gini_start < 0.40) {
    spendType = 'welfare'            // welfare state: social programs
  } else if (c.state_power >= 0.70 && c.base_trust >= 0.65) {
    spendType = 'temples'            // theocratic: religious/civic projects
  } else if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) {
    spendType = 'military'           // feudal: lords spend on armies
  } else if (c.value_priority[0] === 'growth' && c.individual_rights_floor >= 0.50) {
    spendType = 'research'           // technocratic: R&D
  } else if (c.market_freedom >= 0.50) {
    spendType = 'infrastructure'     // moderate/libertarian: infrastructure
  } else {
    spendType = 'balanced'
  }

  const perNPC = spendAmount / living.length
  let feedMsg = ''

  switch (spendType) {
    case 'infrastructure': {
      // Infrastructure investment: boosts productivity by reducing stress/exhaustion
      const workers = living.filter(n => n.role === 'farmer' || n.role === 'craftsman' || n.role === 'merchant')
      for (const npc of workers) {
        npc.exhaustion = clamp(npc.exhaustion - 5, 0, 100)
        npc.happiness  = clamp(npc.happiness  + 3, 0, 100)
        npc.wealth     = clamp(npc.wealth + perNPC * 0.5, 0, 50000)
      }
      feedMsg = `Government invests ${Math.round(spendAmount)} coins in infrastructure — worker productivity rises.`
      break
    }
    case 'research': {
      // R&D spending: boosts literacy (scholars become more effective)
      const scholars = living.filter(n => n.role === 'scholar')
      for (const npc of scholars) {
        npc.wealth    = clamp(npc.wealth + perNPC * 2.0, 0, 50000)
        npc.happiness = clamp(npc.happiness + 4, 0, 100)
      }
      for (const npc of living) {
        npc.happiness = clamp(npc.happiness + 1, 0, 100)
      }
      feedMsg = `Research investment of ${Math.round(spendAmount)} coins: scholars receive funding, literacy improves.`
      break
    }
    case 'military': {
      // Military spending: guards get bonuses; civilians get fear/grievance
      const guards = living.filter(n => n.role === 'guard')
      for (const npc of guards) {
        npc.wealth    = clamp(npc.wealth + perNPC * 3.0, 0, 50000)
        npc.happiness = clamp(npc.happiness + 5, 0, 100)
      }
      for (const npc of living.filter(n => n.role !== 'guard' && n.role !== 'leader')) {
        npc.fear = clamp(npc.fear + 2, 0, 100)
      }
      feedMsg = `${Math.round(spendAmount)} coins allocated to military and enforcement — security forces are bolstered.`
      break
    }
    case 'welfare': {
      // Welfare redistribution: direct cash transfer to the bottom half
      const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
      const bottom = sorted.slice(0, Math.ceil(sorted.length * 0.50))
      for (const npc of bottom) {
        npc.wealth    = clamp(npc.wealth + perNPC * 2.0, 0, 50000)
        npc.hunger    = clamp(npc.hunger - 8, 0, 100)
        npc.happiness = clamp(npc.happiness + 5, 0, 100)
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.015, 0, 1)
      }
      feedMsg = `${Math.round(spendAmount)} coins distributed as welfare — the poorest 50% receive direct aid.`
      break
    }
    case 'temples': {
      // Theocratic civic projects: community cohesion and happiness
      for (const npc of living) {
        npc.isolation = clamp(npc.isolation - 4, 0, 100)
        npc.happiness = clamp(npc.happiness + 4, 0, 100)
        if (npc.worldview.authority_trust > 0.5) {
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.01, 0, 1)
        }
      }
      feedMsg = `${Math.round(spendAmount)} coins invested in civic and religious projects — community cohesion strengthens.`
      break
    }
    case 'balanced': {
      // Balanced spending: moderate boost to all
      for (const npc of living) {
        npc.wealth    = clamp(npc.wealth + perNPC * 0.8, 0, 50000)
        npc.happiness = clamp(npc.happiness + 2, 0, 100)
      }
      feedMsg = `${Math.round(spendAmount)} coins in balanced public spending — modest gains for all citizens.`
      break
    }
  }

  if (feedMsg) {
    addFeedRaw(feedMsg, 'political', state.year, state.day)
  }
}

// ── Income Inequality Effects ─────────────────────────────────────────────────
// NPCs earning significantly above/below average experience secondary effects:
//   High earners (≥2× avg): happiness boost, slight isolation (workaholic)
//   Low earners (≤0.3× avg): stress and grievance increase

function applyIncomeInequalityEffects(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length === 0) return

  const avgIncome = living.reduce((s, n) => s + n.daily_income, 0) / living.length
  if (avgIncome < 1) return  // not enough economic activity to compute meaningful effects

  for (const npc of living) {
    const ratio = npc.daily_income / avgIncome
    if (ratio >= 2.0) {
      // Prosperous: happiness up, slight isolation (all work no play)
      npc.happiness  = clamp(npc.happiness  + 0.5, 0, 100)
      npc.isolation  = clamp(npc.isolation  + 0.3, 0, 100)
    } else if (ratio <= 0.30 && npc.daily_income < 3) {
      // Struggling: stress and grievance
      npc.stress     = clamp(npc.stress    + 1.0, 0, 100)
      npc.grievance  = clamp(npc.grievance + 0.8, 0, 100)
    }
  }
}
// When an NPC dies, 60% of their wealth passes to living children equally.
// The remaining 40% dissipates (estate costs, decomposition of assets).
// The wealth field is reset to 0 to prevent double-distribution.

function processInheritance(state: WorldState): void {
  for (const npc of state.npcs) {
    if (npc.lifecycle.is_alive || npc.wealth < 1) continue

    const livingChildren = npc.lifecycle.children_ids
      .map(id => state.npcs[id])
      .filter((c): c is typeof npc => !!c && c.lifecycle.is_alive)

    if (livingChildren.length === 0) {
      npc.wealth = 0   // no heirs — wealth lost
      continue
    }

    const share = (npc.wealth * 0.60) / livingChildren.length
    for (const child of livingChildren) {
      child.wealth = clamp(child.wealth + share, 0, 50000)
      // Memory: windfall from inheritance (emotional weight scales with amount)
      const emotionalWeight = clamp(share / 20, 2, 40)
      child.memory.push({
        event_id: 'inheritance_' + state.tick,
        type: 'windfall',
        emotional_weight: emotionalWeight,
        tick: state.tick,
      })
      if (child.memory.length > 10) child.memory.shift()
    }
    npc.wealth = 0   // mark as distributed
  }
}

// ── Regime-specific spontaneous events ────────────────────────────────────────
// Three regime archetypes generate periodic events when their structural
// conditions are met — making each model feel mechanically distinct over time.
//   Capitalist: market crash when high gini + high market_freedom
//   Feudal:     peasant revolt when farmer grievance crosses threshold
//   Socialist:  emergency rationing attempt (succeeds or fails) when food < 35

let lastCapitalistCrashTick = -9999
let lastPeasantRevoltTick   = -9999
let lastRationingCrisisTick = -9999

function checkRegimeEvents(state: WorldState): void {
  const c = state.constitution

  // ── Capitalist market crash ──────────────────────────────────────────────
  // High market freedom + entrenched inequality → speculative bubble bursts periodically.
  if (c.market_freedom > 0.65 && state.macro.gini > 0.50
      && state.tick - lastCapitalistCrashTick > 90 * 24
      && Math.random() < 0.003) {
    lastCapitalistCrashTick = state.tick

    const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
    const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
    const n = sorted.length

    // Top 20% lose 25–40% wealth; everyone's stress and grievance spike
    for (const npc of sorted.slice(Math.floor(n * 0.80))) {
      const loss = npc.wealth * (0.25 + Math.random() * 0.15)
      npc.wealth    = clamp(npc.wealth    - loss, 0, 50000)
      npc.grievance = clamp(npc.grievance + 20,   0, 100)
      npc.stress    = clamp(npc.stress    + 15,   0, 100)
    }
    for (const npc of sorted.slice(0, Math.floor(n * 0.40))) {
      npc.grievance = clamp(npc.grievance + 10, 0, 100)
      npc.fear      = clamp(npc.fear      + 8,  0, 100)
    }

    const mInst = state.institutions.find(i => i.id === 'market')
    if (mInst) mInst.legitimacy = clamp(mInst.legitimacy - 0.10, 0, 1)

    const text = `Market crash — the speculative bubble has burst. Merchants and investors lose fortunes overnight.`
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'critical', state.year, state.day)
  }

  // ── Feudal peasant revolt ────────────────────────────────────────────────
  // High gini + high state power + high farmer grievance → periodic levy revolts.
  if (c.gini_start > 0.55 && c.state_power > 0.60
      && state.tick - lastPeasantRevoltTick > 60 * 24
      && Math.random() < 0.004) {
    const farmers = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'farmer')
    const avgGrievance = farmers.reduce((s, n) => s + n.grievance, 0) / Math.max(farmers.length, 1)

    if (avgGrievance > 55) {
      lastPeasantRevoltTick = state.tick

      const revolters = farmers.filter(n => n.grievance > 45)
      for (const npc of revolters) {
        npc.action_state   = Math.random() < 0.6 ? 'organizing' : 'confront'
        npc.dissonance_acc = clamp(npc.dissonance_acc + 20, 0, 100)
      }

      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.07, 0, 1)

      const pct  = Math.round(revolters.length / Math.max(farmers.length, 1) * 100)
      const text = `Peasant levy revolt — ${pct}% of farmers refuse tribute and take to the streets.`
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }

  // ── Socialist rationing crisis ───────────────────────────────────────────
  // High state power + food shortage → forced emergency rationing declaration.
  // If reserves are sufficient: hunger relief + trust boost.
  // If reserves are depleted:   legitimacy collapse.
  if (c.state_power > 0.70 && state.macro.food < 35
      && state.tick - lastRationingCrisisTick > 30 * 24
      && Math.random() < 0.005) {
    lastRationingCrisisTick = state.tick

    const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
    const hungry = living.filter(n => n.hunger > 40)
    const cost   = hungry.length * c.safety_net * 1.5

    if (state.food_stock > cost && hungry.length > 0) {
      state.food_stock = clamp(state.food_stock - cost, 0, 999999)
      for (const npc of hungry) {
        npc.hunger = clamp(npc.hunger - 12, 0, 100)
        npc.trust_in.government.intention = clamp(
          npc.trust_in.government.intention + 0.015 * c.state_power, 0, 1,
        )
      }
      const text = `Emergency rationing declared — the state draws on strategic reserves to feed ${hungry.length} hungry citizens.`
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'warning', state.year, state.day)
    } else {
      // Rationing fails — state promise with no delivery
      for (const npc of living) {
        npc.grievance = clamp(npc.grievance + 12, 0, 100)
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.03, 0, 1)
        npc.trust_in.government.competence = clamp(npc.trust_in.government.competence - 0.02, 0, 1)
      }
      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.12, 0, 1)

      const text = `Rationing crisis — state reserves exhausted. Citizens receive nothing; government legitimacy collapses.`
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }
}

// ── Theocracy: Scholar moral authority ────────────────────────────────────────
// Theocracy indicator: individual_rights_floor < 0.30, base_trust > 0.60, security top priority.
// Top scholars act as moral authorities — their worldview radiates through info-networks,
// reinforcing authority_trust and dampening dissent society-wide.
// This makes theocracies more cohesive but ideologically homogeneous.

function applyTheocracyEffect(state: WorldState): void {
  const c = state.constitution
  if (c.individual_rights_floor > 0.30 || c.base_trust < 0.60) return
  if (c.value_priority[0] !== 'security') return

  const scholars = state.npcs
    .filter(n => n.lifecycle.is_alive && n.role === 'scholar' && n.influence_score > 0.4)
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, Math.max(1, Math.ceil(state.npcs.filter(n => n.role === 'scholar').length * 0.30)))

  for (const scholar of scholars) {
    // Scholar prominence grows in theocracy (moral authority = social capital)
    scholar.influence_score = clamp(scholar.influence_score + 0.001, 0, 1)

    for (const tid of scholar.info_ties.slice(0, 8)) {
      const follower = state.npcs[tid]
      if (!follower?.lifecycle.is_alive) continue
      // Followers absorb authority-trusting worldview (homogenization)
      follower.worldview.authority_trust = clamp(
        follower.worldview.authority_trust + 0.0008, 0, 1,
      )
      // Dissonance suppressed — dissent is socially discouraged
      follower.dissonance_acc = clamp(follower.dissonance_acc - 0.5, 0, 100)
      // Conditional trust boost: state and religion reinforce each other
      follower.trust_in.government.intention = clamp(
        follower.trust_in.government.intention + 0.0004, 0, 1,
      )
    }
  }
}

// ── Commune: decentralized communal society ────────────────────────────────────
// Commune indicator: market_freedom < 0.25 AND state_power < 0.35.
// Community assembly grows stronger; market and guard institutions weaken.
// High-collectivism NPCs pool resources voluntarily (soft wealth equalization).
// Communal living reduces isolation for all collectivist members.

function applyCommuneEffect(state: WorldState): void {
  const c = state.constitution
  if (c.market_freedom > 0.25 || c.state_power > 0.35) return

  // Institutional power shift: community rises, market and guard decay
  const communityInst = state.institutions.find(i => i.id === 'community')
  const marketInst    = state.institutions.find(i => i.id === 'market')
  const guardInst     = state.institutions.find(i => i.id === 'guard')

  if (communityInst) {
    communityInst.power      = clamp(communityInst.power      + 0.0002, 0, 1)
    communityInst.legitimacy = clamp(communityInst.legitimacy + 0.0001, 0, 1)
  }
  if (marketInst) marketInst.power = clamp(marketInst.power - 0.0001, 0.01, 1)
  if (guardInst)  guardInst.power  = clamp(guardInst.power  - 0.0001, 0.01, 1)

  // Communal resource pooling: high-collectivism NPCs share wealth daily
  const living = state.npcs.filter(n =>
    n.lifecycle.is_alive && n.role !== 'child' && n.worldview.collectivism > 0.60,
  )
  if (living.length < 5) return

  const sorted    = [...living].sort((a, b) => a.wealth - b.wealth)
  const n         = sorted.length
  const topStart  = Math.floor(n * 0.75)
  const bottomEnd = Math.floor(n * 0.25)

  // Top 25% contributors give 0.3%/day to bottom 25%
  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const contribution = npc.wealth * 0.003
    npc.wealth = clamp(npc.wealth - contribution, 0, 50000)
    pool += contribution
  }
  if (pool > 0 && bottomEnd > 0) {
    const share = pool / bottomEnd
    for (const npc of sorted.slice(0, bottomEnd)) {
      npc.wealth = clamp(npc.wealth + share, 0, 50000)
      npc.isolation = clamp(npc.isolation - 1.0, 0, 100)
      npc.trust_in.community.intention = clamp(npc.trust_in.community.intention + 0.002, 0, 1)
    }
  }

  // All collectivist NPCs benefit from communal belonging (lower isolation)
  for (const npc of living) {
    npc.isolation = clamp(npc.isolation - 0.3, 0, 100)
  }
}

// ── Legendary NPCs ────────────────────────────────────────────────────────────
// NPCs who achieve notable milestones are marked legendary — an elder who lived
// long through crises, a high-influence figure, or a great merchant.
// On their death, a major chronicle entry mourns them and their strong-tie
// contacts receive a grief memory.

function checkLegendaryNPCs(state: WorldState): void {
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) {
      // Detect legendary death within the past day
      if (npc.legendary && npc.lifecycle.death_tick !== null
          && state.tick - npc.lifecycle.death_tick < 24) {
        const cause = npc.lifecycle.death_cause ?? (t('death.unknown') as string)
        const text = tf('engine.legendary_death', {
          name: npc.name,
          occupation: npc.occupation,
          age: npc.age,
          cause,
        })
        addChronicle(text, state.year, state.day, 'critical')
        // Grief ripples through their network
        for (const tid of npc.strong_ties.slice(0, 8)) {
          const contact = state.npcs[tid]
          if (!contact?.lifecycle.is_alive) continue
          contact.grievance = clamp(contact.grievance + 12, 0, 100)
          contact.memory.push({
            event_id: `legendary_death_${npc.id}`,
            type: 'loss',
            emotional_weight: -35,
            tick: state.tick,
          })
          if (contact.memory.length > 10) contact.memory.shift()
        }
      }
      continue
    }

    if (npc.legendary) continue  // already marked

    // Conditions for legendary status
    const isLongLived    = npc.age >= 65 && npc.stress < 60
    const isInfluential  = npc.influence_score > 0.75
    const isWealthy      = npc.wealth > 8000
    const isReformed     = npc.criminal_record && npc.grievance < 15 && npc.age >= 40
    const isFactionElder = npc.faction_id !== null
      && state.factions.some(f => f.id === npc.faction_id && state.tick - f.founded_tick > 1800)  // 75 days

    if (isLongLived || isInfluential || isWealthy || isReformed || isFactionElder) {
      npc.legendary = true
      const reasonKey = isInfluential ? 'engine.legendary_reason.influential'
        : isWealthy    ? 'engine.legendary_reason.wealthy'
        : isReformed   ? 'engine.legendary_reason.reformed'
        : isFactionElder ? 'engine.legendary_reason.faction_elder'
        : 'engine.legendary_reason.elder'
      const reason = t(reasonKey) as string
      addChronicle(
        tf('engine.legendary_recognized', { name: npc.name, occupation: npc.occupation, reason }),
        state.year, state.day, 'major',
      )
    }
  }
}

// ── Shadow Economy ────────────────────────────────────────────────────────────
// In planned economies (market_freedom < 0.25) with a significant criminal
// population (>3%), an underground market emerges. Criminals earn extra wealth
// through illegal trade. Guards periodically raid and seize assets.

let lastShadowRaidTick = -9999

function checkShadowEconomy(state: WorldState): void {
  if (state.constitution.market_freedom >= 0.25) return

  const living    = state.npcs.filter(n => n.lifecycle.is_alive)
  const criminals = living.filter(n => n.criminal_record)
  if (criminals.length / Math.max(living.length, 1) < 0.03) return

  // Guard raid: once per 5 days minimum
  if (state.tick - lastShadowRaidTick > 120) {
    const guardInst  = state.institutions.find(i => i.id === 'guard')
    const raidChance = (guardInst?.power ?? 0.3) * 0.08  // 2-8% per criminal per check

    let raidCount = 0
    for (const npc of criminals) {
      if (Math.random() < raidChance) {
        const seized = npc.wealth * 0.40
        npc.wealth    = clamp(npc.wealth - seized, 0, 50000)
        npc.fear      = clamp(npc.fear      + 25,  0, 100)
        npc.isolation = clamp(npc.isolation + 15,  0, 100)
        raidCount++
      }
    }

    if (raidCount > 0) {
      lastShadowRaidTick = state.tick
      const text = `Guard raids the underground market — ${raidCount} shadow traders apprehended, assets seized.`
      addFeedRaw(text, 'warning', state.year, state.day)
      addChronicle(text, state.year, state.day, 'major')
    } else if (Math.random() < 0.04) {
      // Ambient news: market thriving under the state's nose
      const pct = Math.round(criminals.length / living.length * 100)
      addFeedRaw(
        `Shadow market thrives in the dark — ${pct}% of citizens trade outside state oversight.`,
        'info', state.year, state.day,
      )
    }
  }
}

// ── Constitutional Referendum ─────────────────────────────────────────────────
// When political pressure is high and drift is significant, a referendum is
// automatically proposed based on the most pressing crisis. NPCs "vote" based
// on worldview alignment. After 7 days (168 ticks) it resolves — approved
// referendums amend the constitution in real time.

function checkReferendum(state: WorldState): void {
  // Resolve pending referendum
  if (state.referendum !== null) {
    if (state.tick >= state.referendum.expires_tick) {
      resolveReferendum(state)
    }
    return
  }

  // Trigger condition
  if (state.macro.political_pressure < 65 || state.drift_score < 0.38) return
  if (Math.random() > 0.02) return  // 2% daily chance once conditions met

  const m = state.macro
  const c = state.constitution

  // Pick the most relevant proposal
  let field: 'safety_net' | 'individual_rights_floor' | 'market_freedom' | 'state_power'
  let proposed: number
  let proposal_text: string

  if (m.food < 28 && c.safety_net < 0.70) {
    field    = 'safety_net'
    proposed = clamp(c.safety_net + 0.20, 0, 1)
    proposal_text = `Emergency food relief act — raise safety net from ${Math.round(c.safety_net * 100)}% to ${Math.round(proposed * 100)}%`
  } else if (m.gini > 0.55 && c.safety_net < 0.65) {
    field    = 'safety_net'
    proposed = clamp(c.safety_net + 0.15, 0, 1)
    proposal_text = `Wealth redistribution reform — safety net from ${Math.round(c.safety_net * 100)}% → ${Math.round(proposed * 100)}%`
  } else if (m.trust < 28 && c.individual_rights_floor < 0.60) {
    field    = 'individual_rights_floor'
    proposed = clamp(c.individual_rights_floor + 0.20, 0, 1)
    proposal_text = `Democratic rights reform — raise individual rights floor from ${Math.round(c.individual_rights_floor * 100)}% to ${Math.round(proposed * 100)}%`
  } else if (m.political_pressure > 75 && c.market_freedom < 0.70) {
    field    = 'market_freedom'
    proposed = clamp(c.market_freedom + 0.15, 0, 1)
    proposal_text = `Economic liberalization — market freedom from ${Math.round(c.market_freedom * 100)}% → ${Math.round(proposed * 100)}%`
  } else {
    return  // no clear crisis to propose on
  }

  state.referendum = {
    proposal_text,
    field,
    current_value: c[field] as number,
    proposed_value: proposed,
    expires_tick: state.tick + 168,  // 7 days
  }

  const text = `🗳️ Referendum proposed: "${proposal_text}". Citizens will vote over the next 7 days.`
  addChronicle(text, state.year, state.day, 'critical')
  addFeedRaw(text, 'political', state.year, state.day)
}

function resolveReferendum(state: WorldState): void {
  const ref = state.referendum!
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) { state.referendum = null; return }

  // NPCs vote based on worldview alignment with the proposal
  let supportCount = 0
  for (const npc of living) {
    let supports = false
    switch (ref.field) {
      case 'safety_net':
        supports = npc.worldview.collectivism > 0.50 || npc.hunger > 50
        break
      case 'individual_rights_floor':
        supports = npc.worldview.authority_trust < 0.45 || npc.criminal_record
        break
      case 'market_freedom':
        supports = npc.worldview.risk_tolerance > 0.55 || npc.role === 'merchant'
        break
      case 'state_power':
        supports = npc.worldview.authority_trust > 0.60 || npc.role === 'guard' || npc.role === 'leader'
        break
    }
    if (supports) supportCount++
  }

  const supportPct = Math.round(supportCount / living.length * 100)
  const approved   = supportPct > 50

  if (approved) {
    // Amend the constitution
    ;(state.constitution as unknown as Record<string, number>)[ref.field] = ref.proposed_value
    const text = `✅ Referendum passed (${supportPct}% support): "${ref.proposal_text}" — constitution amended.`
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'political', state.year, state.day)
    // Trust boost from successful democratic process
    for (const npc of living) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.03, 0, 1)
    }
  } else {
    const text = `❌ Referendum rejected (${supportPct}% support): "${ref.proposal_text}" — no change.`
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'political', state.year, state.day)
    // Disappointment among supporters
    for (const npc of living) {
      if (npc.grievance > 40) npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }

  state.referendum = null
}

// ── Epidemic Intelligence ─────────────────────────────────────────────────────
// When an epidemic is active scholars work toward a cure (accumulating cure_progress).
// Guards can quarantine epidemic zones (blocking NPC movement).
// Cure breakthrough: epidemic intensity halved and quarantine lifted.

const cureProgress = { value: 0, lastResetTick: -1, epidemicId: '' }

function checkEpidemicIntelligence(state: WorldState): void {
  const epidemic = state.active_events.find(e => e.type === 'epidemic')

  if (!epidemic) {
    // No epidemic: lift all quarantines and reset cure progress
    if (state.quarantine_zones.length > 0) {
      state.quarantine_zones = []
    }
    cureProgress.value = 0
    cureProgress.lastResetTick = -1
    cureProgress.epidemicId = ''
    return
  }

  // Reset cure counter when a new epidemic starts (detected by epidemic ID change)
  if (cureProgress.epidemicId !== epidemic.id) {
    cureProgress.value = 0
    cureProgress.lastResetTick = state.tick
    cureProgress.epidemicId = epidemic.id
  }

  // Scholars in scholar_quarter accumulate cure progress each day
  const scholars = state.npcs.filter(n =>
    n.lifecycle.is_alive && n.role === 'scholar' && n.zone === 'scholar_quarter',
  )
  const dailyCureGain = scholars.reduce((s, n) => s + computeProductivity(n, state), 0) * 0.8
  cureProgress.value += dailyCureGain

  // Quarantine: guards enforce zone lockdown on epidemic zones after 3 days
  const guardInst = state.institutions.find(i => i.id === 'guard')
  if ((guardInst?.power ?? 0) > 0.40 && epidemic.elapsed_ticks > 72) {
    const newQuarantines = epidemic.zones.filter(z => !state.quarantine_zones.includes(z))
    if (newQuarantines.length > 0) {
      state.quarantine_zones = [...state.quarantine_zones, ...newQuarantines]
      const text = `🔒 Guard quarantines ${newQuarantines.join(', ')} — movement restricted to contain the epidemic.`
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'warning', state.year, state.day)
    }
  }

  // Cure breakthrough: when scholars have researched enough
  const cureThreshold = 200 + epidemic.intensity * 300  // 200–500 research units
  if (cureProgress.value >= cureThreshold) {
    epidemic.intensity = clamp(epidemic.intensity * 0.50, 0.01, 1)
    epidemic.effects_per_tick.stress_delta  *= 0.50
    epidemic.effects_per_tick.displacement_chance *= 0.50
    cureProgress.value = 0

    const topScholar = scholars.sort((a, b) => b.influence_score - a.influence_score)[0]
    const heroName   = topScholar?.name ?? 'the scholars'
    const text = `💊 Cure breakthrough! ${heroName} has developed a treatment — epidemic intensity halved.`
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'info', state.year, state.day)

    if (topScholar) topScholar.legendary = true

    // Lift quarantines after cure
    state.quarantine_zones = []
  }
}
