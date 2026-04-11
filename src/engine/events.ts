import type { WorldState, SimEvent } from '../types'
import { clamp, ZONE_ADJACENCY } from '../sim/constitution'
import { EVENT_ALL_ZONES, NON_LETHAL_EVENT_TYPES } from '../constants/events-world'

// ── Event death accumulator ────────────────────────────────────────────────
let eventDeathsThisDay = 0

export function getEventDeathsThisDay(): number { return eventDeathsThisDay }
export function resetEventDeaths(): void { eventDeathsThisDay = 0 }

export function tickEvents(state: WorldState): void {
  for (const ev of state.active_events) {
    ev.elapsed_ticks++

    // Epidemic zone spread: every 48 ticks (2 sim-days), spread to adjacent zone
    if (ev.type === 'epidemic' && ev.elapsed_ticks % 48 === 0 && ev.zones.length < EVENT_ALL_ZONES.length) {
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
    let mortalityPerTick = ev.type === 'epidemic'
      ? ev.effects_per_tick.displacement_chance * 0.006
      : ev.effects_per_tick.displacement_chance * 0.002

    // Public health: hospital_capacity > 0 reduces epidemic per-tick mortality by 30%
    if (ev.type === 'epidemic' && (state.public_health?.hospital_capacity ?? 0) > 0) {
      mortalityPerTick *= 0.70
    }

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
    // ── Additional natural disasters ──────────────────────────────────────────
    heatwave:          { food_stock_delta: -i * 60,  stress_delta: i * 3,  trust_delta: -i * 2,  displacement_chance: i * 0.06 },
    landslide:         { food_stock_delta: -i * 90,  stress_delta: i * 7,  trust_delta: -i * 5,  displacement_chance: i * 0.35, instant_kill_rate: i * 0.12, instant_kill_cause: 'accident' },
    tornado:           { food_stock_delta: -i * 80,  stress_delta: i * 8,  trust_delta: -i * 6,  displacement_chance: i * 0.45, instant_kill_rate: i * 0.18, instant_kill_cause: 'accident' },
    locust_plague:     { food_stock_delta: -i * 180, stress_delta: i * 4,  trust_delta: -i * 3,  displacement_chance: i * 0.08 },
    // ── Positive social / economic events ─────────────────────────────────────
    festival:          { food_stock_delta: -i * 20,  stress_delta: -i * 5, trust_delta: +i * 4,  displacement_chance: 0 },
    golden_harvest:    { food_stock_delta: +i * 150, stress_delta: -i * 3, trust_delta: +i * 4,  displacement_chance: 0 },
    cultural_renaissance: { food_stock_delta: 0,     stress_delta: -i * 4, trust_delta: +i * 5,  displacement_chance: 0 },
  }
  return map[type] ?? { food_stock_delta: 0, stress_delta: 0, trust_delta: 0, displacement_chance: 0 }
}
