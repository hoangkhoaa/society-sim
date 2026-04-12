/**
 * Macro-level society formulas.
 *
 * These expressions determine key macro statistics that drive the simulation.
 * Each formula is stored as a mutable string so that government reforms,
 * scientific breakthroughs, or god-agent commands can change them at runtime.
 *
 * To patch a formula at runtime, use `patchFormula` from `./registry`.
 * The `computeX` wrapper functions automatically use the latest compiled `Fn`.
 */

import { clamp } from '../sim/constitution'

// ── Stability ─────────────────────────────────────────────────────────────
//
// Variables (all numeric):
//   avgTrustGov       – average government trust (0–1)
//   cohesion          – 1 minus fraction of fleeing NPCs (0–1)
//   food              – current food supply level (0–100)
//   avgStress         – population mean stress (0–100)
//   politicalPressure – fraction of NPCs in unrest × 200, clamped 0–100
//
// Result: raw stability score; callers clamp to 0–100.

export let STABILITY_EXPR = `
  avgTrustGov * 30
  + cohesion * 20
  + (food / 100) * 25
  + (1 - avgStress / 100) * 15
  + (1 - politicalPressure / 100) * 10
`.trim()

export let stabilityFn = new Function(
  "avgTrustGov", "cohesion", "food", "avgStress", "politicalPressure",
  `return ${STABILITY_EXPR}`,
) as (avgTrustGov: number, cohesion: number, food: number, avgStress: number, politicalPressure: number) => number

export function patchStabilityExpr(newExpr: string): string {
  const prev = STABILITY_EXPR
  STABILITY_EXPR = newExpr
  stabilityFn = new Function(
    "avgTrustGov", "cohesion", "food", "avgStress", "politicalPressure",
    `return ${STABILITY_EXPR}`,
  ) as typeof stabilityFn
  return prev
}

export function computeStability(
  avgTrustGov: number,
  cohesion: number,
  food: number,
  avgStress: number,
  politicalPressure: number,
): number {
  return clamp(stabilityFn(avgTrustGov, cohesion, food, avgStress, politicalPressure), 0, 100)
}

// ── Polarization ──────────────────────────────────────────────────────────
//
// Variables:
//   stdCollectivism – std-dev of NPC collectivism worldview (0+)
//   stdAuthority    – std-dev of NPC authority_trust worldview (0+)
//   centerDrift     – absolute deviation of mean ideology from 0.5 (0–1)
//
// Result: raw polarization index; callers clamp to 0–100.

export let POLARIZATION_EXPR =
  "stdCollectivism * 90 + stdAuthority * 90 + centerDrift * 40"

export let polarizationFn = new Function(
  "stdCollectivism", "stdAuthority", "centerDrift",
  `return ${POLARIZATION_EXPR}`,
) as (stdCollectivism: number, stdAuthority: number, centerDrift: number) => number

export function patchPolarizationExpr(newExpr: string): string {
  const prev = POLARIZATION_EXPR
  POLARIZATION_EXPR = newExpr
  polarizationFn = new Function(
    "stdCollectivism", "stdAuthority", "centerDrift",
    `return ${POLARIZATION_EXPR}`,
  ) as typeof polarizationFn
  return prev
}

export function computePolarization(
  stdCollectivism: number,
  stdAuthority: number,
  centerDrift: number,
): number {
  return clamp(polarizationFn(stdCollectivism, stdAuthority, centerDrift), 0, 100)
}

// ── Labor Unrest ──────────────────────────────────────────────────────────
//
// Variables:
//   avgSolidarity – mean class solidarity among non-child, non-leader/guard NPCs (0–100)
//   gini          – Gini coefficient of wealth distribution (0–1)
//
// Result: raw labor unrest score; callers clamp to 0–100.

export let LABOR_UNREST_EXPR =
  "avgSolidarity * (0.4 + gini * 0.6)"

export let laborUnrestFn = new Function(
  "avgSolidarity", "gini",
  `return ${LABOR_UNREST_EXPR}`,
) as (avgSolidarity: number, gini: number) => number

export function patchLaborUnrestExpr(newExpr: string): string {
  const prev = LABOR_UNREST_EXPR
  LABOR_UNREST_EXPR = newExpr
  laborUnrestFn = new Function(
    "avgSolidarity", "gini",
    `return ${LABOR_UNREST_EXPR}`,
  ) as typeof laborUnrestFn
  return prev
}

export function computeLaborUnrest(avgSolidarity: number, gini: number): number {
  return clamp(laborUnrestFn(avgSolidarity, gini), 0, 100)
}
