/**
 * Formula registry — central hub for runtime patching of simulation formulas.
 *
 * Call `patchFormula(key, newExpr)` to permanently replace a formula expression
 * for the current session. The change takes effect immediately on the next
 * simulation tick that calls the affected `compute*` function.
 *
 * Returns the previous expression string so callers can record it in
 * `WorldState.breakthrough_log`.
 */

import type { FormulaKey } from '../types'
import {
  STABILITY_EXPR,    patchStabilityExpr,
  POLARIZATION_EXPR, patchPolarizationExpr,
  LABOR_UNREST_EXPR, patchLaborUnrestExpr,
} from './macro'
import {
  STRESS_EXPR,    patchStressExpr,
  HAPPINESS_EXPR, patchHappinessExpr,
} from './npc'
import {
  BIRTH_CHANCE_EXPR, patchBirthChanceExpr,
} from './lifecycle'

/** Return the current expression string for a formula key. */
export function getFormulaExpr(key: FormulaKey): string {
  switch (key) {
    case 'stability':    return STABILITY_EXPR
    case 'polarization': return POLARIZATION_EXPR
    case 'labor_unrest': return LABOR_UNREST_EXPR
    case 'stress':       return STRESS_EXPR
    case 'happiness':    return HAPPINESS_EXPR
    case 'birth_chance': return BIRTH_CHANCE_EXPR
  }
}

/**
 * Patch a simulation formula expression at runtime.
 *
 * @param key     - Which formula to replace.
 * @param newExpr - Replacement JS expression (must use same parameter names).
 * @returns The previous expression string.
 * @throws  If `newExpr` fails to compile or evaluates to a non-numeric result.
 */

/** Sample parameter sets used to validate formula expressions at patch time. */
const FORMULA_SAMPLE_PARAMS: Record<FormulaKey, Record<string, number>> = {
  stability:    { avgTrustGov: 0.5, cohesion: 0.8, food: 60, avgStress: 40, politicalPressure: 30 },
  polarization: { stdCollectivism: 0.15, stdAuthority: 0.12, centerDrift: 0.2 },
  labor_unrest: { avgSolidarity: 40, gini: 0.35 },
  stress:       { hunger: 30, exhaustion: 40, isolation: 20, fear: 15, identityStress: 0.02, socialBuffer: 0.03 },
  happiness:    { stressPenalty: 20, relativeStatus: 2, inequalityPain: 8, memoryEffect: 3, trustBonus: 5 },
  birth_chance: { baseFertility: 0.8, happinessFactor: 1.0, stressFactor: 0.8, fearFactor: 0.9, needsFactor: 0.85, wealthFactor: 1.0, trustFactor: 0.9, foodFactor: 1.0 },
}

export function patchFormula(key: FormulaKey, newExpr: string): string {
  // Validate: the expression must be syntactically valid JS that returns a finite number.
  // NOTE: formula expressions come exclusively from trusted AI outputs
  // (god-agent LLM, government AI, science AI) — never from raw user text input.
  const sample = FORMULA_SAMPLE_PARAMS[key]
  const paramNames = Object.keys(sample)
  const paramValues = Object.values(sample)
  const testFn = new Function(...paramNames, `return (${newExpr})`) as (...args: number[]) => unknown
  const result = testFn(...paramValues)
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new TypeError(`Formula expression for "${key}" must return a finite number; got ${result}`)
  }

  switch (key) {
    case 'stability':    return patchStabilityExpr(newExpr)
    case 'polarization': return patchPolarizationExpr(newExpr)
    case 'labor_unrest': return patchLaborUnrestExpr(newExpr)
    case 'stress':       return patchStressExpr(newExpr)
    case 'happiness':    return patchHappinessExpr(newExpr)
    case 'birth_chance': return patchBirthChanceExpr(newExpr)
  }
}
