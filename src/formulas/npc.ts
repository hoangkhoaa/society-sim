/**
 * NPC-level individual psychological formulas.
 *
 * These expressions determine each NPC's moment-to-moment mental state.
 * Stored as mutable strings so government reforms, scientific breakthroughs,
 * or god-agent commands can change them at runtime.
 *
 * To patch a formula at runtime, use `patchFormula` from `./registry`.
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

export let STRESS_EXPR = `
  Math.pow(hunger / 100, 1.3) * 0.30
  + Math.pow(exhaustion / 100, 1.2) * 0.15
  + Math.pow(isolation / 100, 1.2) * 0.18
  + Math.pow(fear / 100, 1.5) * 0.22
  + identityStress
  - socialBuffer
`.trim()

export let stressFn = new Function(
  "hunger", "exhaustion", "isolation", "fear", "identityStress", "socialBuffer",
  `return (${STRESS_EXPR}) * 100`,
) as (hunger: number, exhaustion: number, isolation: number, fear: number, identityStress: number, socialBuffer: number) => number

export function patchStressExpr(newExpr: string): string {
  const prev = STRESS_EXPR
  STRESS_EXPR = newExpr
  stressFn = new Function(
    "hunger", "exhaustion", "isolation", "fear", "identityStress", "socialBuffer",
    `return (${STRESS_EXPR}) * 100`,
  ) as typeof stressFn
  return prev
}

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

export let HAPPINESS_EXPR =
  "50 - stressPenalty + relativeStatus - inequalityPain + memoryEffect + trustBonus"

export let happinessFn = new Function(
  "stressPenalty", "relativeStatus", "inequalityPain", "memoryEffect", "trustBonus",
  `return ${HAPPINESS_EXPR}`,
) as (stressPenalty: number, relativeStatus: number, inequalityPain: number, memoryEffect: number, trustBonus: number) => number

export function patchHappinessExpr(newExpr: string): string {
  const prev = HAPPINESS_EXPR
  HAPPINESS_EXPR = newExpr
  happinessFn = new Function(
    "stressPenalty", "relativeStatus", "inequalityPain", "memoryEffect", "trustBonus",
    `return ${HAPPINESS_EXPR}`,
  ) as typeof happinessFn
  return prev
}

export function computeHappinessScore(
  stressPenalty: number,
  relativeStatus: number,
  inequalityPain: number,
  memoryEffect: number,
  trustBonus: number,
): number {
  return clamp(happinessFn(stressPenalty, relativeStatus, inequalityPain, memoryEffect, trustBonus), 0, 100)
}

// ── Trade computation helpers ──────────────────────────────────────────────
//
// Pure functions that encode the economic exchange formulas used in wealthTick.
// Keeping them here (a) separates policy-relevant math from engine mechanics,
// (b) makes them easy to find and reason about, and (c) mirrors the
// refactorable-formula philosophy of the rest of this module.

import {
  FARMER_SUPPLY_SUBSISTENCE_FLOOR,
  FARMER_SUPPLY_SURPLUS_SCALE,
  FARMER_SUPPLY_SALE_VOLUME,
  SCHOLAR_TUITION_BASE,
  HEALTHCARE_FEE_BASE,
  CRAFTSMAN_MATERIAL_COST_BASE,
  CRAFTSMAN_GOODS_PRICE_BASE,
  FARMER_FOOD_PRICE_BASE,
} from '../constants/npc-wealth-trade'

/** Fraction of productivity available as surplus produce (above subsistence floor). */
export function computeFarmerSurplusRate(productivity: number): number {
  return clamp(productivity - FARMER_SUPPLY_SUBSISTENCE_FLOOR, 0, 1) * FARMER_SUPPLY_SURPLUS_SCALE
}

/** Market value of a farmer's surplus sale given current market conditions. */
export function computeFarmerSaleValue(surplusRate: number, market_freedom: number, trade_mult: number): number {
  return surplusRate * FARMER_SUPPLY_SALE_VOLUME * market_freedom * trade_mult
}

/** Scholar tuition charged per student session. */
export function computeScholarTuition(market_freedom: number): number {
  return SCHOLAR_TUITION_BASE * market_freedom
}

/** Healthcare consultation fee charged per patient session. */
export function computeHealthcareFee(market_freedom: number): number {
  return HEALTHCARE_FEE_BASE * market_freedom
}

/** Cost of raw materials purchased by a craftsman per supply run. */
export function computeCraftsmanMaterialCost(market_freedom: number, trade_mult: number): number {
  return CRAFTSMAN_MATERIAL_COST_BASE * market_freedom * trade_mult
}

/** Price of craftsman goods sold directly to neighbours while socialising. */
export function computeCraftsmanGoodsPrice(market_freedom: number, trade_mult: number): number {
  return CRAFTSMAN_GOODS_PRICE_BASE * market_freedom * trade_mult
}

/** Price of farmer food sold directly to hungry neighbours while socialising. */
export function computeFarmerFoodPrice(market_freedom: number, trade_mult: number): number {
  return FARMER_FOOD_PRICE_BASE * market_freedom * trade_mult
}
