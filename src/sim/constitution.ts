import type { Constitution, Institution, Worldview } from '../types'
import { INSTITUTION_NAMES } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function gaussian(mean: number, std: number): number {
  // Box-Muller
  const u1 = Math.random()
  const u2 = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
}

export function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

export function randInt(lo: number, hi: number): number {
  return Math.floor(rand(lo, hi + 1))
}

export function weightedRandom<K extends string>(weights: Record<K, number>): K {
  const total = Object.values<number>(weights).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const [key, w] of Object.entries<number>(weights)) {
    r -= w
    if (r <= 0) return key as K
  }
  return Object.keys(weights)[0] as K
}

// ── Institution Init ────────────────────────────────────────────────────────

export function initInstitutions(c: Constitution): Institution[] {
  const baseWorldview = (tweaks: Partial<Worldview>): Worldview => ({
    collectivism:    clamp(0.5 + (tweaks.collectivism ?? 0) + gaussian(0, 0.08), 0, 1),
    authority_trust: clamp(0.5 + (tweaks.authority_trust ?? 0) + gaussian(0, 0.08), 0, 1),
    risk_tolerance:  clamp(0.5 + (tweaks.risk_tolerance ?? 0) + gaussian(0, 0.08), 0, 1),
    time_preference: clamp(0.5 + (tweaks.time_preference ?? 0) + gaussian(0, 0.08), 0, 1),
  })

  const make = (
    id: Institution['id'],
    resources: number,
    power: number,
    worldviewTweaks: Partial<Worldview>,
  ): Institution => ({
    id,
    name: INSTITUTION_NAMES[id],
    resources,
    legitimacy: clamp(c.base_trust + gaussian(0, 0.1), 0.1, 1),
    power,
    worldview: baseWorldview(worldviewTweaks),
    inbox: [],
    sent: [],
    decisions: [],
    relations: {},
    last_decided_tick: 0,
    decide_interval: 720,   // 30 sim-days
    force_decide: false,
  })

  return [
    make('government',  500 * (0.5 + c.state_power),   c.state_power,   { collectivism: +0.20, authority_trust: +0.30, time_preference: +0.10 }),
    make('market',      500 * (0.5 + c.market_freedom), c.market_freedom, { collectivism: -0.20, risk_tolerance: +0.20 }),
    make('opposition',  100,                              0.2,             { authority_trust: -0.30, risk_tolerance: +0.10 }),
    make('community',   200,                              0.35,            { collectivism: +0.30, time_preference: -0.10 }),
    make('guard',       300 * (0.5 + c.state_power),   c.state_power * 0.8, { authority_trust: +0.40, risk_tolerance: +0.15 }),
  ]
}
