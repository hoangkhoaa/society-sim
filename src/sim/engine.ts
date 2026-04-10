import type { WorldState, Constitution, NPC, SimEvent, NarrativeEntry, NPCIntervention, ActiveStrike, WorldDelta, InstitutionDelta } from '../types'
import { createNPC, tickNPC, computeProductivity, RESIDENTIAL_ZONES, permanentRoleChange } from './npc'
import type { IndividualEvent, TickEventFlags } from './npc'
import { checkEmergencyRoleReassignment, autoSurvivalRoleShift } from './roles'
import { buildNetwork, MAX_STRONG_TIES, MAX_WEAK_TIES, MAX_INFO_TIES } from './network'
import { initInstitutions, clamp, getSeason, getSeasonFactor, SEASON_LABELS, ZONE_ADJACENCY } from './constitution'
import { getRegimeProfile } from './regime-config'
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

export const MIN_NPC_COUNT = 500
const MAX_NPC_MEMORIES = 10     // Circular memory buffer size per NPC

export async function initWorld(constitution: Constitution, npcCount: number = MIN_NPC_COUNT): Promise<WorldState> {
  const population = Math.max(MIN_NPC_COUNT, Math.round(npcCount))
  const npcs: NPC[] = []
  for (let i = 0; i < population; i++) {
    npcs.push(createNPC(i, population, constitution))
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

  // Influence score: use the same formula as the daily computeBridgeScores() so
  // scores are consistent from tick 0 onward (no discontinuity on first daily update).
  // bridge_score = fraction of distinct zone-clusters spanned by an NPC's info_ties.
  const totalClusters = Math.max(new Set([...clusters.values()]).size, 1)
  for (const npc of npcs) {
    const spannedClusters = new Set<number>()
    for (const tid of npc.info_ties) {
      const cluster = clusters.get(tid)
      if (cluster !== undefined) spannedClusters.add(cluster)
    }
    npc.bridge_score = spannedClusters.size / totalClusters
    const strongCentrality = npc.strong_ties.length / INFLUENCE_REFERENCE_DEGREE
    npc.influence_score = clamp(strongCentrality * 0.6 + npc.bridge_score * 0.4, 0, 1)
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
    food_stock: population * 30,
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
    food_stock: population * 30,
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
    leader_id: null,
    last_election_day: -1,
    collapse_phase: 'normal',
    initial_population: population,
    stats: {
      god_calls: 0,
      intervention_count: 0,
      policy_count: 0,
      min_population: population,
      max_population: population,
      fled_total: 0,
      deaths_natural: 0,
      deaths_violent: 0,
      elections_held: 0,
      npc_chats: 0,
      npc_edits: 0,
      achieved_days: [],
    },
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
    checkPopulationViability(state)

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
    checkEmergencyRoleReassignment(state)
    applyTheocracyEffect(state)
    applyCommuneEffect(state)
    checkLegendaryNPCs(state)
    checkFactions(state)
    accumulateResearch(state)
    checkDiscoveries(state)
    checkShadowEconomy(state)
    checkReferendum(state)
    checkOppositionBehavior(state)
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

    // Weak tie replenishment: every 7 sim-days — recovering societies re-knit social fabric
    if (state.day % 7 === 0) {
      replenishWeakTies(state)
    }

    // Class solidarity spreads daily; strikes checked daily
    spreadSolidarity(state)
    checkLaborStrikes(state)

    // Update per-run statistics used for achievement medals
    updateRunStats(state)
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

    // Food stock (cap at 60 days for current population to prevent infinite stockpiling)
    const eventFoodCap = Math.max(600, state.npcs.filter(n => n.lifecycle.is_alive).length * 60)
    state.food_stock = clamp(state.food_stock + ev.effects_per_tick.food_stock_delta, 0, eventFoodCap)

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
// Positive event types that should NEVER kill NPCs regardless of what AI returns
const NON_LETHAL_EVENT_TYPES = new Set([
  'resource_boom', 'trade_offer', 'tech_shift', 'charismatic_npc', 'ideology_import',
])

export function applyInstantEventDeaths(state: WorldState, ev: SimEvent): number {
  if (NON_LETHAL_EVENT_TYPES.has(ev.type)) return 0
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

    // kill_pct: kill a percentage of candidates (takes priority over count)
    if (iv.kill && iv.kill_pct !== undefined) {
      const killCount = Math.round(candidates.length * Math.min(100, Math.max(0, iv.kill_pct)) / 100)
      candidates = candidates
        .map(n => ({ n, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, killCount)
        .map(x => x.n)
    // Optionally cap by count (random sample)
    } else if (iv.count !== undefined && iv.count < candidates.length) {
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

  // Permanent role reassignment (clears emergency tracking)
  if (iv.new_role !== undefined && iv.new_role !== npc.role) {
    permanentRoleChange(npc, iv.new_role, state)
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

  // Extended NPC fields
  if (iv.wealth_delta !== undefined)
    npc.wealth = Math.max(0, npc.wealth + iv.wealth_delta)

  if (iv.work_motivation !== undefined)
    npc.work_motivation = iv.work_motivation

  if (iv.trust_delta !== undefined) {
    const ts = npc.trust_in[iv.trust_delta.institution]
    if (ts) {
      if (iv.trust_delta.competence !== undefined)
        ts.competence = clamp(ts.competence + iv.trust_delta.competence, 0, 1)
      if (iv.trust_delta.intention !== undefined)
        ts.intention = clamp(ts.intention + iv.trust_delta.intention, 0, 1)
    }
  }

  if (iv.sick !== undefined) {
    npc.sick = iv.sick
    if (iv.sick) npc.sick_ticks = Math.max(npc.sick_ticks, 48)
  }

  if (iv.exhaustion_delta !== undefined)
    npc.exhaustion = clamp(npc.exhaustion + iv.exhaustion_delta, 0, 100)

  if (iv.capital_delta !== undefined)
    npc.capital = clamp((npc.capital ?? 0) + iv.capital_delta, 0, 100)

  // Memory injection
  if (iv.memory) {
    npc.memory.push({ event_id: 'intervention', type: iv.memory.type, emotional_weight: iv.memory.emotional_weight, tick: state.tick })
    if (npc.memory.length > MAX_NPC_MEMORIES) npc.memory.shift()
  }
}

// ── World-level intervention functions ────────────────────────────────────────

/** Apply a live constitution patch. Only safe mid-game fields are applied.
 *  role_ratios and description are blocked because they only matter at init time. */
export function applyConstitutionPatch(state: WorldState, patch: Partial<Constitution>): void {
  const safe: Array<keyof Constitution> = [
    'market_freedom', 'state_power', 'safety_net',
    'individual_rights_floor', 'base_trust', 'network_cohesion',
    'resource_scarcity', 'gini_start',
  ]
  for (const key of safe) {
    if (patch[key] !== undefined)
      (state.constitution as unknown as Record<string, unknown>)[key] = patch[key]
  }
  if (patch.value_priority?.length === 4)
    state.constitution.value_priority = patch.value_priority
  if (patch.work_schedule)
    state.constitution.work_schedule = { ...state.constitution.work_schedule, ...patch.work_schedule }
}

/** Apply macro-level world state changes (food, resources, treasury, quarantine, rumors). */
export function applyWorldDelta(state: WorldState, delta: WorldDelta): void {
  if (delta.food_stock_delta !== undefined) {
    const deltaFoodCap = Math.max(600, state.npcs.filter(n => n.lifecycle.is_alive).length * 60)
    state.food_stock = clamp(state.food_stock + delta.food_stock_delta, 0, deltaFoodCap)
  }
  if (delta.natural_resources_delta !== undefined)
    state.natural_resources = clamp(state.natural_resources + delta.natural_resources_delta, 0, 100000)
  if (delta.tax_pool_delta !== undefined)
    state.tax_pool = Math.max(0, state.tax_pool + delta.tax_pool_delta)
  if (delta.quarantine_add?.length) {
    for (const z of delta.quarantine_add)
      if (!state.quarantine_zones.includes(z)) state.quarantine_zones.push(z)
  }
  if (delta.quarantine_remove?.length)
    state.quarantine_zones = state.quarantine_zones.filter(z => !delta.quarantine_remove!.includes(z))
  if (delta.seed_rumor) {
    const r = delta.seed_rumor
    state.rumors.push({
      id: crypto.randomUUID(),
      content: r.content,
      subject: r.subject,
      effect: r.effect,
      reach: 0,
      born_tick: state.tick,
      expires_tick: state.tick + (r.duration_days ?? 15) * 24,
    })
  }
}

/** Apply power/legitimacy/resources changes to institutions. */
export function applyInstitutionDeltas(state: WorldState, deltas: InstitutionDelta[]): void {
  for (const d of deltas) {
    const inst = state.institutions.find(i => i.id === d.id)
    if (!inst) continue
    if (d.power_delta !== undefined)
      inst.power = clamp(inst.power + d.power_delta, 0, 1)
    if (d.resources_delta !== undefined)
      inst.resources = Math.max(0, inst.resources + d.resources_delta)
    if (d.legitimacy_delta !== undefined)
      inst.legitimacy = clamp(inst.legitimacy + d.legitimacy_delta, 0, 1)
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
      // family/resting/socializing = off duty but present in economy
      // organizing/confront = partial (distracted workers)
      // fleeing = fully absent
      if (npc.action_state === 'fleeing') {
        // no contribution
      } else if (npc.action_state === 'organizing' || npc.action_state === 'confront') {
        activeProdSum += prod * 0.30
      } else if (npc.action_state === 'family' || npc.action_state === 'resting' || npc.action_state === 'socializing') {
        // Off-duty but contributes to economic baseline (demand, informal economy)
        activeProdSum += prod * 0.15
      } else {
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

// ── Population Viability & Societal Collapse ─────────────────────────────────
//
// Thresholds scale with initial_population (proportional, not absolute):
//   collapse  < 3%  — society cannot sustain itself; trigger end-game
//   critical  < 6%  — government dissolves; survival role-shifts begin
//   survival  < 12% — partial role-shift (scholars/merchants → farmers if food scarce)
//   normal   >= 12% — everything operates normally
// Minimum floors (15 / 30 / 60) prevent degenerate edge cases in tiny games.

let lastCollapseWarnDay = -1

function checkPopulationViability(state: WorldState): void {
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
  // NPCs in heartbreak withdraw socially: trim strong_ties to 8.
  // Also remove the reciprocal edge from the dropped ties so the graph stays symmetric.
  for (const npc of living) {
    if ((npc.lifecycle.heartbreak_cooldown ?? 0) <= 0) continue
    if (npc.strong_ties.length <= 8) continue
    const dropped = npc.strong_ties.slice(8)
    npc.strong_ties = npc.strong_ties.slice(0, 8)
    state.network.strong.get(npc.id)?.forEach((id, _, s) => { if (dropped.includes(id)) s.delete(id) })
    for (const oid of dropped) {
      const other = state.npcs[oid]
      if (!other?.lifecycle.is_alive) continue
      other.strong_ties = other.strong_ties.filter(id => id !== npc.id)
      state.network.strong.get(oid)?.delete(npc.id)
    }
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

  // Add to network — mutual parent↔child strong tie
  state.network.strong.set(newId, new Set([parent.id]))
  state.network.info.set(newId, new Set())
  baby.strong_ties = [parent.id]
  baby.info_ties   = []
  // Back-link: parent knows their child
  if (parent.strong_ties.length < MAX_STRONG_TIES) {
    parent.strong_ties.push(newId)
    state.network.strong.get(parent.id)?.add(newId)
  }
  // Spouse also gets the child as a strong tie
  const spouseForTie = parent.lifecycle.spouse_id != null ? npcs[parent.lifecycle.spouse_id] : null
  if (spouseForTie && spouseForTie.lifecycle.is_alive && spouseForTie.strong_ties.length < MAX_STRONG_TIES) {
    if (!spouseForTie.strong_ties.includes(newId)) {
      spouseForTie.strong_ties.push(newId)
      state.network.strong.get(spouseForTie.id)?.add(newId)
      baby.strong_ties.push(spouseForTie.id)
      state.network.strong.get(newId)?.add(spouseForTie.id)
    }
  }

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
  // Shuffle independently for each tier so selections don't overlap deterministically
  const shuffled1 = tiePool.slice().sort(() => Math.random() - 0.5)
  const shuffled2 = tiePool.slice().sort(() => Math.random() - 0.5)
  const shuffled3 = tiePool.slice().sort(() => Math.random() - 0.5)
  const strongTargets = shuffled1.slice(0, 2)
  const weakTargets   = shuffled2.slice(0, 8)
  const infoTargets   = shuffled3.slice(0, 5)

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

function emigrate(npc: NPC, state: WorldState): void {
  npc.lifecycle.is_alive    = false
  npc.lifecycle.death_cause = 'fled'
  npc.lifecycle.death_tick  = state.tick
}

function checkImmigration(state: WorldState): void {
  // Snapshot living list once; used for both emigration checks and immigration gate
  let living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── Emigration ─────────────────────────────────────────────────────────────
  // Two pathways:
  //   A) Crisis flight — NPCs already in 'fleeing' state depart permanently
  //   B) Voluntary emigration — discontented NPCs leave due to sustained hardship

  const hasSevereCrisis = state.macro.food < 30 || state.macro.stability < 30 || state.macro.political_pressure > 75

  let totalDeparted = 0

  // A) Crisis flight: fleeing NPCs convert to permanent emigrants
  const fleeing = living.filter(n => n.action_state === 'fleeing')
  if (fleeing.length > 0) {
    const flightChance = hasSevereCrisis ? 0.40 : 0.10
    if (Math.random() < flightChance) {
      const maxDepart = hasSevereCrisis ? Math.min(5, fleeing.length) : Math.min(2, fleeing.length)
      const departCount = 1 + Math.floor(Math.random() * maxDepart)
      for (const npc of fleeing.slice(0, departCount)) {
        emigrate(npc, state)
        totalDeparted++
      }
    }
  }

  // B) Voluntary emigration: discontented NPCs quietly leave
  const voluntaryPressure =
    clamp((state.macro.political_pressure - 50) / 50, 0, 1) * 0.4 +
    clamp((80 - state.macro.stability) / 80, 0, 1)          * 0.35 +
    clamp((50 - state.macro.food)       / 50, 0, 1)         * 0.25
  const voluntaryChance = clamp((voluntaryPressure - 0.2) / 0.8 * 0.08, 0, 0.08)
  if (voluntaryChance > 0 && Math.random() < voluntaryChance) {
    const candidates = living
      .filter(n => n.lifecycle.is_alive && n.action_state !== 'fleeing' && n.role !== 'child')
      .sort((a, b) => b.grievance - a.grievance)
    for (const npc of candidates.slice(0, 1 + Math.floor(Math.random() * 2))) {
      if (npc.grievance < 45) break
      emigrate(npc, state)
      totalDeparted++
    }
  }

  if (totalDeparted > 0) {
    const text = tf('engine.emigration_wave', { n: totalDeparted }) as string
    addFeedRaw(text, 'warning', state.year, state.day)
    addChronicle(text, state.year, state.day, 'major')
  }

  // During severe crisis, skip immigration entirely
  if (hasSevereCrisis) return

  // ── Immigration: attractive conditions draw newcomers ─────────────────────
  // Re-count living after emigration so immigration cap is evaluated on current pop
  living = state.npcs.filter(n => n.lifecycle.is_alive)
  const immigrationCap = Math.round((state.initial_population ?? 1200) * 1.3)
  if (living.length >= immigrationCap) return

  const attractiveness =
    state.macro.stability * 0.35 +
    state.macro.trust     * 0.30 +
    state.macro.food      * 0.25 +
    (100 - state.macro.political_pressure) * 0.10

  // Needs to be genuinely appealing (>55) to attract migrants
  const chance = clamp((attractiveness - 55) / 120, 0, 0.25)
  if (Math.random() >= chance) return

  const arrivals = 1 + Math.floor(Math.random() * (attractiveness > 75 ? 3 : 1))
  for (let i = 0; i < arrivals; i++) spawnImmigrant(state)

  const text = tf('engine.immigration_wave', { n: arrivals }) as string
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
  const restrictions = getRegimeProfile(state.constitution).simRestrictions
  const infoTarget = Math.round((10 + clamp(state.constitution.network_cohesion, 0.1, 1) * 30) * restrictions.info_ties_cap)

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
    if (!npc.lifecycle.is_alive || (npc.action_state !== 'socializing' && npc.action_state !== 'family')) continue
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
      if (Math.random() < 0.003) {  // ~0.3% daily chance — real friendships take weeks/months
        a.strong_ties.push(b.id)
        b.strong_ties.push(a.id)
        state.network.strong.get(a.id)?.add(b.id)
        state.network.strong.get(b.id)?.add(a.id)
        // Promoted to strong: remove the now-redundant weak tie between them
        a.weak_ties = a.weak_ties.filter(id => id !== b.id)
        b.weak_ties = b.weak_ties.filter(id => id !== a.id)
        state.network.weak.get(a.id)?.delete(b.id)
        state.network.weak.get(b.id)?.delete(a.id)
      }
    }
  }
}

/**
 * Weekly: rebuild weak ties for NPCs whose networks have contracted from fear or death.
 * Mirrors the geographic tie logic in buildNetwork. Only activates when the NPC's fear
 * is low — recovering societies naturally re-knit social fabric.
 * Processes ~10% of eligible NPCs per call to spread the load.
 */
// NPC is eligible for replenishment when weak ties fall below this fraction of target.
const WEAK_TIE_REPLENISHMENT_THRESHOLD = 0.70
// Fraction of eligible NPCs processed per weekly call (load-spreading).
const WEAK_TIE_REPLENISHMENT_SAMPLE_RATE = 0.10

function replenishWeakTies(state: WorldState): void {
  const cohesion = clamp(state.constitution.network_cohesion, 0.1, 1)
  const weakTarget = Math.round(50 + cohesion * 100)
  const restrictions = getRegimeProfile(state.constitution).simRestrictions

  // Build zone index
  const byZone: Record<string, NPC[]> = {}
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  // Only NPCs with depleted weak ties and low enough fear are eligible
  const eligible = living.filter(n => n.fear < 50 && n.weak_ties.length < weakTarget * WEAK_TIE_REPLENISHMENT_THRESHOLD)

  for (const npc of eligible) {
    if (Math.random() >= WEAK_TIE_REPLENISHMENT_SAMPLE_RATE) continue

    const hop2 = (ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => ZONE_ADJACENCY[z] ?? [])
    const pool = restrictions.cross_zone_ties
      ? [...(byZone[npc.zone] ?? []),
         ...(ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []),
         ...hop2.flatMap(z => byZone[z] ?? [])]
      : [...(byZone[npc.zone] ?? [])]

    const existingWeak = new Set(npc.weak_ties)
    const strongSet    = new Set(npc.strong_ties)
    const candidates   = pool
      .filter(c => c.id !== npc.id && !existingWeak.has(c.id) && !strongSet.has(c.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(5, weakTarget - npc.weak_ties.length))

    for (const other of candidates) {
      if (other.weak_ties.length >= MAX_WEAK_TIES) continue
      npc.weak_ties.push(other.id)
      other.weak_ties.push(npc.id)
      state.network.weak.get(npc.id)?.add(other.id)
      state.network.weak.get(other.id)?.add(npc.id)
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
 * Bridge score = fraction of distinct zone-clusters spanned by an NPC's info_ties.
 * Using info_ties (ideological/information network) correctly captures cross-community
 * information flow — geographic acquaintances (weak_ties) do not drive influence.
 */
// Reference degree for influence normalization — "well-connected" = 15 strong ties.
// Using a fixed reference (not population max) prevents inflation in small communities
// where 5 ties out of a max-5 would otherwise score 1.0 influence.
const INFLUENCE_REFERENCE_DEGREE = 15

function computeBridgeScores(state: WorldState): void {
  const totalClusters = Math.max(new Set([...state.network.clusters.values()]).size, 1)

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) { npc.bridge_score = 0; continue }

    const spannedClusters = new Set<number>()
    for (const tid of npc.info_ties) {
      const cluster = state.network.clusters.get(tid)
      if (cluster !== undefined) spannedClusters.add(cluster)
    }
    npc.bridge_score = spannedClusters.size / totalClusters

    // Combined influence: 60% strong-tie centrality + 40% bridging power.
    // Centrality is normalized against a fixed reference degree, not the population max,
    // so influence scores are stable and comparable across different community sizes.
    const strongCentrality = npc.strong_ties.length / INFLUENCE_REFERENCE_DEGREE
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
      addFeedRaw(t('engine.opinion_anti_feed') as string, 'political', state.year, state.day)
      addChronicle(t('engine.opinion_anti_chronicle') as string, state.year, state.day, 'major')
    } else if (proGov > antiGov) {
      addFeedRaw(t('engine.opinion_pro_feed') as string, 'political', state.year, state.day)
      addChronicle(t('engine.opinion_pro_chronicle') as string, state.year, state.day, 'major')
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
        ? (bothUnderStress ? 0.015 : 0.005)  // crisis bonding: reduced from 5%/2% to 1.5%/0.5%
        : (state.tick - lastCrisisTick < 20 * 24 ? 0.004 : 0.002)
      if (Math.random() >= tieChance) continue

      a.strong_ties.push(b.id)
      b.strong_ties.push(a.id)
      state.network.strong.get(a.id)?.add(b.id)
      state.network.strong.get(b.id)?.add(a.id)
      // Promoted to strong: remove the now-redundant weak tie between them
      if (a.weak_ties.includes(b.id)) {
        a.weak_ties = a.weak_ties.filter(id => id !== b.id)
        b.weak_ties = b.weak_ties.filter(id => id !== a.id)
        state.network.weak.get(a.id)?.delete(b.id)
        state.network.weak.get(b.id)?.delete(a.id)
      }
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
  addChronicle(t('engine.schism_chronicle') as string, state.year, state.day, 'critical')
  addFeedRaw(t('engine.schism_feed') as string, 'critical', state.year, state.day)
}

// ── Season Transition ────────────────────────────────────────────────────────

function checkSeasonTransition(state: WorldState): void {
  const current = getSeason(state.day)
  if (current === lastSeason) return
  lastSeason = current

  const label = SEASON_LABELS[current]
  const text = tf(`engine.season.${current}`, { season: label }) as string
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
    const zoneLabel = t(`zone.${zone}`) as string
    const text = tf('engine.community_mobilized', { zone: zoneLabel, n: members.length }) as string
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
      (n.action_state === 'socializing' || n.action_state === 'family'),
    )

    for (const npc of candidates) {
      if (npc.community_group !== null) continue
      const coMembers = npc.strong_ties
        .map(id => state.npcs[id])
        .filter(n => n?.lifecycle.is_alive && n.community_group === null
          && (n.action_state === 'socializing' || n.action_state === 'family'))
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
      const text = tf('engine.unrest.suppression_blocked', { rights: Math.round(rights * 100) }) as string
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'political', state.year, state.day)
      // Fall through to negotiation below
    } else {
      // Suppression: brutality scales inversely with individual rights
      // Low rights → high fear, brutal dispersal; high rights → softer response
      const fearDelta      = Math.round(12 + (1 - rights) * 28)   // 12–40
      const grievanceDelta = Math.round(8  + (1 - rights) * 18)   // 8–26
      const trustLoss      = 0.05 + (1 - rights) * 0.07           // 0.05–0.12

      const text = tf('engine.unrest.suppressed', { pct, rights: Math.round(rights * 100) }) as string
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
    const text = tf('engine.unrest.dialogue', { pct }) as string
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
  const text = tf('engine.unrest.standoff', { pct }) as string
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

  // Distribute to poor — money + direct hunger/stress relief (welfare isn't just cash)
  const recipients = sorted.slice(0, bottomEnd)
  if (recipients.length === 0) return
  const share = pool / recipients.length
  for (const npc of recipients) {
    npc.wealth  = clamp(npc.wealth + share, 0, 50000)
    npc.hunger  = clamp(npc.hunger - 5 * safetyNet, 0, 100)   // food vouchers / aid
    npc.stress  = clamp(npc.stress - 3 * safetyNet, 0, 100)   // financial relief reduces anxiety
    if (share > 1) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.002, 0, 1)
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
  // No tribute system when society is in collapse or critical phase
  if (state.collapse_phase !== 'normal') return
  const { state_power } = state.constitution
  // Use live macro.gini (actual wealth distribution) instead of constitution gini_start.
  // This means tribute intensifies as real inequality grows, not just starting conditions.
  const liveGini = state.macro.gini ?? state.constitution.gini_start
  const tributeRate = Math.max(0, (liveGini - 0.40) * state_power * 0.005)
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
  // No tax collection when society has collapsed or is critical (government dissolved)
  if (state.collapse_phase !== 'normal') return
  const taxRate = getIncomeTaxRate(state)
  if (taxRate <= 0) return

  const EXEMPT_THRESHOLD = 1   // daily_income below this is exempt

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.role === 'child') continue
    if (npc.role === 'guard' || npc.role === 'leader') continue  // govt workers don't pay income tax
    if (npc.daily_income < EXEMPT_THRESHOLD) continue

    // Tax = daily_income × rate (collected once per day, matching wage cadence).
    const taxAmount = npc.daily_income * taxRate
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

// Wages calibrated to match market income (~daily_income of a farmer/craftsman at avg productivity).
// farmer: 0.12 * 0.7 * 24 ≈ 2.0/day, craftsman: 0.14 * 0.7 * 24 ≈ 2.4/day
// Guard earns above farmer (dangerous work); leader earns significantly more (administrative burden + authority).
const GOVT_WAGE_GUARD  = 3.5
const GOVT_WAGE_LEADER = 6.0

function applyGovernmentWages(state: WorldState): void {
  // No wages when government has dissolved due to population collapse
  if (state.collapse_phase !== 'normal') return
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
    // daily_income for govt roles: EMA toward actual daily wage.
    // wage is already in coins/day; no ×24 needed (this is a per-day update, not per-tick).
    npc.daily_income = npc.daily_income * 0.99 + wage * 0.01
    if (payRatio < 0.5) {
      npc.fear      = clamp(npc.fear + 5, 0, 100)
      npc.grievance = clamp(npc.grievance + 3, 0, 100)
    }
  }
  for (const npc of leaders) {
    const wage = GOVT_WAGE_LEADER * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    npc.daily_income = npc.daily_income * 0.99 + wage * 0.01
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
  // No government spending when population has collapsed
  if (state.collapse_phase !== 'normal') return
  // Spend daily: ~10% of pool per day. Prevents the 7-day lump-sum from
  // creating oversized single-day effects that dilute any visible impact.
  if (state.day === lastTaxSpendingDay) return
  if ((state.tax_pool ?? 0) < 20) return
  lastTaxSpendingDay = state.day

  const pool = state.tax_pool ?? 0
  const spendAmount = pool * 0.10   // spend 10% of pool each day (smooth, steady disbursement)
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

  let feedMsg = ''

  switch (spendType) {
    case 'infrastructure': {
      // Infrastructure: workers get cash + quality-of-life boost
      const workers = living.filter(n => n.role === 'farmer' || n.role === 'craftsman' || n.role === 'merchant')
      if (workers.length > 0) {
        const perWorker = spendAmount / workers.length
        for (const npc of workers) {
          npc.wealth     = clamp(npc.wealth + perWorker, 0, 50000)
          npc.exhaustion = clamp(npc.exhaustion - 8, 0, 100)
          npc.happiness  = clamp(npc.happiness  + 3, 0, 100)
        }
      }
      feedMsg = tf('engine.tax_spend.infrastructure', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'research': {
      // R&D: scholars get large bonus; everyone gets literacy/happiness
      const scholars = living.filter(n => n.role === 'scholar')
      if (scholars.length > 0) {
        const perScholar = spendAmount * 0.6 / scholars.length
        for (const npc of scholars) {
          npc.wealth    = clamp(npc.wealth + perScholar, 0, 50000)
          npc.happiness = clamp(npc.happiness + 5, 0, 100)
        }
        // Remainder distributed to all as general prosperity
        const remainder = spendAmount * 0.4 / living.length
        for (const npc of living) {
          npc.wealth    = clamp(npc.wealth + remainder, 0, 50000)
          npc.happiness = clamp(npc.happiness + 1, 0, 100)
        }
      } else {
        const perNPC = spendAmount / living.length
        for (const npc of living) npc.wealth = clamp(npc.wealth + perNPC, 0, 50000)
      }
      feedMsg = tf('engine.tax_spend.research', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'military': {
      // Military: 70% to guards (soldiers), 30% to leaders (officers/commanders)
      // Civilians feel the oppressive presence but receive nothing
      const guards  = living.filter(n => n.role === 'guard')
      const leaders = living.filter(n => n.role === 'leader')
      if (guards.length > 0) {
        const perGuard = spendAmount * 0.70 / guards.length
        for (const npc of guards) {
          npc.wealth    = clamp(npc.wealth + perGuard, 0, 50000)
          npc.happiness = clamp(npc.happiness + 6, 0, 100)
          npc.fear      = clamp(npc.fear - 5, 0, 100)
        }
      }
      if (leaders.length > 0) {
        const perLeader = spendAmount * 0.30 / leaders.length
        for (const npc of leaders) {
          npc.wealth    = clamp(npc.wealth + perLeader, 0, 50000)
          npc.happiness = clamp(npc.happiness + 4, 0, 100)
        }
      }
      for (const npc of living.filter(n => n.role !== 'guard' && n.role !== 'leader')) {
        npc.fear = clamp(npc.fear + 3, 0, 100)
      }
      feedMsg = tf('engine.tax_spend.military', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'welfare': {
      // Welfare: bottom 40% get direct cash transfer — real money from tax pool
      const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
      const bottom = sorted.slice(0, Math.ceil(sorted.length * 0.40))
      if (bottom.length > 0) {
        const perRecipient = spendAmount / bottom.length
        for (const npc of bottom) {
          npc.wealth    = clamp(npc.wealth + perRecipient, 0, 50000)
          npc.hunger    = clamp(npc.hunger - 10, 0, 100)
          npc.stress    = clamp(npc.stress  - 5, 0, 100)
          npc.happiness = clamp(npc.happiness + 6, 0, 100)
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.02, 0, 1)
        }
      }
      feedMsg = tf('engine.tax_spend.welfare', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'temples': {
      // Temples / civic projects: 60% as direct wealth (offerings, wages), 40% as social goods
      // Social goods = isolation drop, happiness, trust — not money, so the full spendAmount is accounted for.
      const perNPC = spendAmount / living.length
      for (const npc of living) {
        npc.wealth    = clamp(npc.wealth + perNPC * 0.6, 0, 50000)
        npc.isolation = clamp(npc.isolation - 6, 0, 100)
        npc.happiness = clamp(npc.happiness + 5, 0, 100)
        npc.stress    = clamp(npc.stress - 3, 0, 100)
        if (npc.worldview.authority_trust > 0.5) {
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.015, 0, 1)
        }
      }
      feedMsg = tf('engine.tax_spend.temples', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'balanced': {
      // Balanced: distribute evenly to all — universal dividend
      const perNPC = spendAmount / living.length
      for (const npc of living) {
        npc.wealth    = clamp(npc.wealth + perNPC, 0, 50000)
        npc.happiness = clamp(npc.happiness + 2, 0, 100)
      }
      feedMsg = tf('engine.tax_spend.balanced', { amount: Math.round(spendAmount) }) as string
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
    const capitalShare = ((npc.capital ?? 0) * 0.60) / livingChildren.length
    for (const child of livingChildren) {
      child.wealth = clamp(child.wealth + share, 0, 50000)
      // Capital inheritance: productive assets passed to heirs
      if (capitalShare > 0) {
        child.capital = clamp((child.capital ?? 0) + capitalShare, 0, 100)
        // Heir now owns capital — clear any existing rental arrangement
        if ((child.capital ?? 0) > 5 && child.capital_rents_from != null) {
          child.capital_rents_from = null
          child.capital_rent_paid  = 0
        }
      }
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
    npc.wealth  = 0   // mark as distributed
    npc.capital = 0
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
let lastHeresyCrisisTick    = -9999

function checkRegimeEvents(state: WorldState): void {
  const c = state.constitution

  // ── Capitalist market crash ──────────────────────────────────────────────
  // High market freedom + entrenched inequality → speculative bubble bursts periodically.
  // Raised gini threshold (0.55) and cooldown (120d) so crashes don't fire before the
  // economy has had time to develop genuine speculative inequality.
  if (c.market_freedom > 0.65 && state.macro.gini > 0.55
      && state.tick - lastCapitalistCrashTick > 120 * 24
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

    const text = t('engine.market_crash') as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'critical', state.year, state.day)
  }

  // ── Feudal peasant revolt ────────────────────────────────────────────────
  // High gini + high state power + high farmer grievance → periodic levy revolts.
  // Probability raised to 1.2%/day so revolts fire reliably when conditions are met.
  if (c.gini_start > 0.55 && c.state_power > 0.60
      && state.tick - lastPeasantRevoltTick > 60 * 24
      && Math.random() < 0.012) {
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
      const text = tf('engine.peasant_revolt', { pct }) as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }

  // ── Socialist rationing crisis ───────────────────────────────────────────
  // High state power + severe food shortage → forced emergency rationing declaration.
  // Threshold lowered to food < 25 (was 35) to differentiate from normal daily rationing
  // (applyStateRationing handles the 25–35 range without narrative weight).
  if (c.state_power > 0.70 && state.macro.food < 25
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
      const text = tf('engine.rationing_emergency', { n: hungry.length }) as string
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

      const text = t('engine.rationing_crisis') as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }

  // ── Theocracy: Heresy outbreak ───────────────────────────────────────────
  // Rising political pressure in a theocratic society exposes hidden dissenters.
  // The state cracks down: dissenters flee or mobilize, loyalists are reassured,
  // moderates grow quietly fearful. Unlike daily scholar suppression, this is a
  // visible crisis that harms government legitimacy and leaves a lasting scar.
  if (c.state_power >= 0.70 && c.base_trust >= 0.65 && c.network_cohesion >= 0.70
      && state.macro.political_pressure > 55
      && state.tick - lastHeresyCrisisTick > 60 * 24
      && Math.random() < 0.006) {
    const dissidents = state.npcs.filter(n =>
      n.lifecycle.is_alive &&
      n.worldview.authority_trust < 0.35 &&
      n.grievance > 40,
    )
    if (dissidents.length >= 5) {
      lastHeresyCrisisTick = state.tick

      for (const npc of dissidents) {
        npc.fear         = clamp(npc.fear         + 20, 0, 100)
        npc.isolation    = clamp(npc.isolation    + 10, 0, 100)
        npc.action_state = Math.random() < 0.55 ? 'fleeing' : 'organizing'
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.05, 0, 1)
      }

      // Broader population: loyalists feel vindicated; moderates grow fearful
      const dissident_ids = new Set(dissidents.map(n => n.id))
      for (const npc of state.npcs) {
        if (!npc.lifecycle.is_alive || dissident_ids.has(npc.id)) continue
        if (npc.worldview.authority_trust > 0.55) {
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.01, 0, 1)
        } else {
          npc.fear = clamp(npc.fear + 5, 0, 100)
        }
      }

      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.05, 0, 1)

      const n_d = dissidents.length
      const text = tf('engine.heresy_outbreak', { n: n_d }) as string
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

// Maximum legendary recognitions per sim-day (prevents spam when many NPCs hit thresholds together)
const MAX_LEGENDARY_PER_DAY = 1
let legendaryRecognizedToday = 0
let legendaryLastDay = -1

function checkLegendaryNPCs(state: WorldState): void {
  // Reset per-day counter
  if (state.day !== legendaryLastDay) {
    legendaryRecognizedToday = 0
    legendaryLastDay = state.day
  }

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

    // Cap recognitions per day to avoid spam when many NPCs cross thresholds simultaneously
    if (legendaryRecognizedToday >= MAX_LEGENDARY_PER_DAY) continue

    // Minimum: NPC must have been alive for at least 60 sim-days (lived through hardship, not just arrived)
    const ticksAlive = npc.lifecycle.death_tick == null ? state.tick - (npc.id * 3) : 0  // rough proxy
    const daysInWorld = state.day - Math.max(0, state.day - Math.floor(ticksAlive / 24))
    if (daysInWorld < 60 && npc.age < 40) continue  // newcomers can't be legendary

    // Conditions for legendary status — all thresholds are high to make this a rare, meaningful event.
    // influence_score with INFLUENCE_REFERENCE_DEGREE=15 means 0.85 requires ~13+ strong ties AND good bridge.
    const isLongLived    = npc.age >= 75 && npc.stress < 40 && npc.happiness > 65
    const isInfluential  = npc.influence_score > 0.85 && npc.strong_ties.length >= 14 && npc.age >= 35
    const isWealthy      = npc.wealth > 20000 && npc.age >= 50
    const isReformed     = npc.criminal_record && npc.grievance < 8 && npc.age >= 50 && npc.happiness > 60
    const isFactionElder = npc.faction_id !== null
      && state.factions.some(f => f.id === npc.faction_id && state.tick - f.founded_tick > 7200)  // 300 days

    if (isLongLived || isInfluential || isWealthy || isReformed || isFactionElder) {
      npc.legendary = true
      legendaryRecognizedToday++
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
      const text = tf('engine.shadow_raid', { n: raidCount }) as string
      addFeedRaw(text, 'warning', state.year, state.day)
      addChronicle(text, state.year, state.day, 'major')
    } else if (Math.random() < 0.04) {
      // Ambient news: market thriving under the state's nose
      const pct = Math.round(criminals.length / living.length * 100)
      addFeedRaw(
        tf('engine.shadow_thrives', { pct }) as string,
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
    proposal_text = tf('engine.referendum.proposal.food_relief', { from: Math.round(c.safety_net * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.gini > 0.55 && c.safety_net < 0.65) {
    field    = 'safety_net'
    proposed = clamp(c.safety_net + 0.15, 0, 1)
    proposal_text = tf('engine.referendum.proposal.redistribution', { from: Math.round(c.safety_net * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.trust < 28 && c.individual_rights_floor < 0.60) {
    field    = 'individual_rights_floor'
    proposed = clamp(c.individual_rights_floor + 0.20, 0, 1)
    proposal_text = tf('engine.referendum.proposal.rights', { from: Math.round(c.individual_rights_floor * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.political_pressure > 75 && c.market_freedom < 0.70) {
    field    = 'market_freedom'
    proposed = clamp(c.market_freedom + 0.15, 0, 1)
    proposal_text = tf('engine.referendum.proposal.market', { from: Math.round(c.market_freedom * 100), to: Math.round(proposed * 100) }) as string
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

  const text = tf('engine.referendum.proposed', { proposal: proposal_text }) as string
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
    const text = tf('engine.referendum.passed', { pct: supportPct, proposal: ref.proposal_text }) as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'political', state.year, state.day)
    // Trust boost from successful democratic process
    for (const npc of living) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.03, 0, 1)
    }
  } else {
    const text = tf('engine.referendum.rejected', { pct: supportPct, proposal: ref.proposal_text }) as string
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'political', state.year, state.day)
    // Disappointment among supporters
    for (const npc of living) {
      if (npc.grievance > 40) npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }

  state.referendum = null
}

// ── Opposition Institution Autonomous Behavior ────────────────────────────────
// The Opposition institution gains legitimacy under pressure and acts as a
// meaningful counter-force: publishing dissent, boosting solidarity, and
// triggering rights referendums when conditions are dire enough.

// Track last dissent statement day to enforce the 20-day interval.
let lastOppositionDissentDay = -999

function checkOppositionBehavior(state: WorldState): void {
  const oppInst = state.institutions.find(i => i.id === 'opposition')
  if (!oppInst) return

  const m = state.macro

  // ── 1. Daily legitimacy drift ─────────────────────────────────────────
  const gainCondition = m.political_pressure > 55 || m.trust < 40 || (m.labor_unrest ?? 0) > 50
  const loseCondition = m.stability > 65 && m.trust > 55
  if (gainCondition) {
    oppInst.legitimacy = clamp(oppInst.legitimacy + 0.002, 0, 1)
  } else if (loseCondition) {
    oppInst.legitimacy = clamp(oppInst.legitimacy - 0.002, 0, 1)
  }

  // ── 2. Dissent statement every 20 days when legitimacy > 0.35 ─────────
  if (oppInst.legitimacy > 0.35 && state.day - lastOppositionDissentDay >= 20) {
    lastOppositionDissentDay = state.day
    const living = state.npcs.filter(n => n.lifecycle.is_alive)
    const highGrievance = living.filter(n => n.grievance > 60)
    const affected = Math.floor(highGrievance.length * 0.15)
    const sample = highGrievance.slice().sort(() => Math.random() - 0.5).slice(0, affected)
    for (const npc of sample) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.01, 0, 1)
    }
    const msg = tf('engine.opposition.dissent_statement') as string
    addChronicle(msg, state.year, state.day, 'major')
    addFeedRaw(msg, 'political', state.year, state.day)
  }

  // ── 3. Active strikes + legitimacy > 0.3 → solidarity boost for striking role ──
  if (oppInst.legitimacy > 0.3 && (state.active_strikes ?? []).length > 0) {
    const living = state.npcs.filter(n => n.lifecycle.is_alive)
    for (const strike of state.active_strikes) {
      for (const npc of living) {
        if (npc.role === strike.role && npc.on_strike) {
          // Apply 1.3× multiplier effect: add 30% of excess solidarity above baseline
          const excess = npc.class_solidarity - 45
          if (excess > 0) {
            npc.class_solidarity = clamp(npc.class_solidarity + excess * 0.3, 0, 100)
          }
        }
      }
    }
  }

  // ── 4. Referendum trigger when legitimacy > 0.65 and pressure > 70 ────
  if (oppInst.legitimacy > 0.65 && m.political_pressure > 70 && state.referendum === null) {
    const c = state.constitution
    const proposed = clamp(c.individual_rights_floor + 0.20, 0, 1)
    const proposal_text = tf('engine.referendum.proposal.rights', {
      from: Math.round(c.individual_rights_floor * 100),
      to: Math.round(proposed * 100),
    }) as string
    state.referendum = {
      proposal_text,
      field: 'individual_rights_floor',
      current_value: c.individual_rights_floor,
      proposed_value: proposed,
      expires_tick: state.tick + 168,
    }
    const msg = tf('engine.opposition.referendum_triggered', { pct: Math.round(oppInst.legitimacy * 100) }) as string
    addChronicle(msg, state.year, state.day, 'critical')
    addFeedRaw(msg, 'political', state.year, state.day)
  }
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
      const zoneLabels = newQuarantines.map(z => t(`zone.${z}`) as string).join(', ')
      const text = tf('engine.epidemic_quarantine', { zones: zoneLabels }) as string
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
    const heroName   = topScholar?.name ?? (t('engine.scholars_collective') as string)
    const text = tf('engine.cure_breakthrough', { name: heroName }) as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'info', state.year, state.day)

    if (topScholar) topScholar.legendary = true

    // Lift quarantines after cure
    state.quarantine_zones = []
  }
}

// ── Human-Driven Elections ────────────────────────────────────────────────────
// NPCs vote for candidates based on worldview alignment, faction, and network.
// Winner becomes state.leader_id and drives the government AI prompt.

export function runElection(state: WorldState): NPC | null {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 5) return null

  // Candidate pool: top NPCs by influence + bridge centrality (up to 4 candidates)
  const sorted = [...living].sort(
    (a, b) => (b.influence_score + b.bridge_score * 0.5) - (a.influence_score + a.bridge_score * 0.5),
  )
  const poolSize = Math.max(2, Math.ceil(living.length * 0.03))
  const candidates = sorted.slice(0, Math.min(poolSize, 4))

  // Vote tallying — each NPC votes for the candidate that best aligns with their interests
  const votes: Record<number, number> = {}
  for (const c of candidates) votes[c.id] = 0

  for (const voter of living) {
    let bestId   = candidates[0].id
    let bestScore = -Infinity
    for (const c of candidates) {
      const wvSim = 1 - (
        Math.abs(voter.worldview.collectivism - c.worldview.collectivism) +
        Math.abs(voter.worldview.authority_trust - c.worldview.authority_trust)
      ) / 2
      const factionBonus   = voter.faction_id != null && voter.faction_id === c.faction_id ? 0.30 : 0
      const networkBonus   = voter.strong_ties.includes(c.id) ? 0.40
                           : voter.weak_ties.includes(c.id)   ? 0.10 : 0
      // Grieved voters prefer lower-wealth (anti-establishment) candidates
      const antiEstab      = voter.grievance > 55 ? Math.max(0, 1 - c.wealth / 5000) * 0.20 : 0
      const score = wvSim + factionBonus + networkBonus + antiEstab
      if (score > bestScore) { bestScore = score; bestId = c.id }
    }
    votes[bestId] = (votes[bestId] ?? 0) + 1
  }

  // Find winner
  let winner = candidates[0]
  for (const c of candidates) {
    if ((votes[c.id] ?? 0) > (votes[winner.id] ?? 0)) winner = c
  }

  const prevLeader = state.leader_id != null ? state.npcs[state.leader_id] : null
  state.leader_id        = winner.id
  state.last_election_day = state.day

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const winPct     = Math.round((votes[winner.id] / Math.max(totalVotes, 1)) * 100)

  const msg = prevLeader && prevLeader.id !== winner.id
    ? tf('election.new_leader', { name: winner.name, occ: winner.occupation, pct: winPct, prev: prevLeader.name })
    : tf('election.first_leader', { name: winner.name, occ: winner.occupation, pct: winPct })
  addChronicle(msg, state.year, state.day, 'major')
  addFeedRaw(msg, 'info', state.year, state.day)

  state.stats.elections_held++

  return winner
}

// ── Run statistics updater (called daily) ──────────────────────────────────

export function updateRunStats(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive).length
  if (living < state.stats.min_population) state.stats.min_population = living
  if (living > state.stats.max_population) state.stats.max_population = living

  // Tally deaths by cause (reset-proof: recount from npcs array each day is O(n) but simple)
  let natural = 0, violent = 0, fled = 0
  for (const n of state.npcs) {
    if (n.lifecycle.is_alive) continue
    const cause = n.lifecycle.death_cause
    if (cause === 'natural' || cause === 'starvation' || cause === 'disease' || cause === 'accident') natural++
    else if (cause === 'violence') violent++
    else if (cause === 'fled') fled++
  }
  state.stats.deaths_natural = natural
  state.stats.deaths_violent = violent
  state.stats.fled_total = fled
}
