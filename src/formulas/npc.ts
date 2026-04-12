/**
 * NPC-level individual psychological formulas.
 *
 * These expressions determine each NPC's moment-to-moment mental state.
 * Stored as inspectable strings so players can tune how stress and
 * happiness respond to the environment.
 *
 * Example — make hunger affect stress more severely:
 *   Change the hunger weight from 0.30 to 0.45 in STRESS_EXPR.
 */

import { clamp } from '../sim/constitution'

// ── Stress ─────────────────────────────────────────────────────────────────
//
// Variables (all numeric):
//   hunger        – NPC hunger level (0–100)
//   exhaustion    – NPC exhaustion level (0–100)
//   isolation     – NPC isolation level (0–100)
//   fear          – NPC fear level (0–100)
//   identityStress – wealth-identity gap contribution (0–0.10)
//   socialBuffer  – social ties buffering effect (0–0.08)
//
// Non-linear exponents mean high values hurt disproportionately.
// The inner sum is multiplied by 100 to return a 0–100 value; callers clamp.

export const STRESS_EXPR = `
  Math.pow(hunger / 100, 1.3) * 0.30
  + Math.pow(exhaustion / 100, 1.2) * 0.15
  + Math.pow(isolation / 100, 1.2) * 0.18
  + Math.pow(fear / 100, 1.5) * 0.22
  + identityStress
  - socialBuffer
`.trim()

export const stressFn = new Function(
  "hunger", "exhaustion", "isolation", "fear", "identityStress", "socialBuffer",
  `return (${STRESS_EXPR}) * 100`,
) as (hunger: number, exhaustion: number, isolation: number, fear: number, identityStress: number, socialBuffer: number) => number

export function computeStressScore(
  hunger: number,
  exhaustion: number,
  isolation: number,
  fear: number,
  identityStress: number,
  socialBuffer: number,
): number {
  return clamp(stressFn(hunger, exhaustion, isolation, fear, identityStress, socialBuffer), 0, 100)
}

// ── Happiness ─────────────────────────────────────────────────────────────
//
// Variables (all numeric):
//   stressPenalty   – stress × 0.55 (0–55)
//   relativeStatus  – wealth vs neighbours, clamped −12 to +12
//   inequalityPain  – gini × collectivism sensitivity (0–18)
//   memoryEffect    – emotional memory sum, clamped −15 to +15
//   trustBonus      – average institutional trust × 8 (0–8)
//
// Base is 50; callers clamp result to 0–100.

export const HAPPINESS_EXPR =
  "50 - stressPenalty + relativeStatus - inequalityPain + memoryEffect + trustBonus"

export const happinessFn = new Function(
  "stressPenalty", "relativeStatus", "inequalityPain", "memoryEffect", "trustBonus",
  `return ${HAPPINESS_EXPR}`,
) as (stressPenalty: number, relativeStatus: number, inequalityPain: number, memoryEffect: number, trustBonus: number) => number

export function computeHappinessScore(
  stressPenalty: number,
  relativeStatus: number,
  inequalityPain: number,
  memoryEffect: number,
  trustBonus: number,
): number {
  return clamp(happinessFn(stressPenalty, relativeStatus, inequalityPain, memoryEffect, trustBonus), 0, 100)
}
