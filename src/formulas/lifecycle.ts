/**
 * Lifecycle formulas for birth, death, and demographic transitions.
 *
 * These expressions determine how the population grows and shrinks.
 * Stored as mutable strings so government reforms, scientific breakthroughs,
 * or god-agent commands can change them at runtime.
 *
 * To patch a formula at runtime, use `patchFormula` from `./registry`.
 */

import { clamp } from '../sim/constitution'

// ── Birth Chance ──────────────────────────────────────────────────────────
//
// Variables (all numeric):
//   baseFertility   – minimum fertility of the two parents (0–1)
//   happinessFactor – life-satisfaction multiplier (0.65–1.25)
//   stressFactor    – stress penalty on reproduction (0.20–1)
//   fearFactor      – fear penalty on reproduction (0.25–1)
//   needsFactor     – hunger + exhaustion penalty (0.25–1)
//   wealthFactor    – wealth readiness multiplier (0.60–1.20)
//   trustFactor     – government trust multiplier (0.75–1.10)
//   foodFactor      – food supply multiplier (0.55–1.20)
//
// Base rate 0.00015/day ≈ 1 % annual growth at realistic population sizes.
// Result: raw daily probability; callers clamp to 0–0.0006.

export let BIRTH_CHANCE_EXPR =
  "0.00015 * baseFertility * happinessFactor * stressFactor * fearFactor * needsFactor * wealthFactor * trustFactor * foodFactor"

export let birthChanceFn = new Function(
  "baseFertility", "happinessFactor", "stressFactor", "fearFactor",
  "needsFactor", "wealthFactor", "trustFactor", "foodFactor",
  `return ${BIRTH_CHANCE_EXPR}`,
) as (
  baseFertility: number,
  happinessFactor: number,
  stressFactor: number,
  fearFactor: number,
  needsFactor: number,
  wealthFactor: number,
  trustFactor: number,
  foodFactor: number,
) => number

export function patchBirthChanceExpr(newExpr: string): string {
  const prev = BIRTH_CHANCE_EXPR
  BIRTH_CHANCE_EXPR = newExpr
  birthChanceFn = new Function(
    "baseFertility", "happinessFactor", "stressFactor", "fearFactor",
    "needsFactor", "wealthFactor", "trustFactor", "foodFactor",
    `return ${BIRTH_CHANCE_EXPR}`,
  ) as typeof birthChanceFn
  return prev
}

export function computeBirthChance(
  baseFertility: number,
  happinessFactor: number,
  stressFactor: number,
  fearFactor: number,
  needsFactor: number,
  wealthFactor: number,
  trustFactor: number,
  foodFactor: number,
): number {
  return clamp(
    birthChanceFn(
      baseFertility, happinessFactor, stressFactor, fearFactor,
      needsFactor, wealthFactor, trustFactor, foodFactor,
    ),
    0, 0.0006,
  )
}
