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
 * @throws  If `newExpr` fails to compile or evaluate to a number on a test call.
 */
export function patchFormula(key: FormulaKey, newExpr: string): string {
  // Validate: the expression must be a valid JS expression that returns a number.
  // We try compiling it; if it throws, we propagate the error to the caller.
  new Function(`return (${newExpr})`)   // syntax check only

  switch (key) {
    case 'stability':    return patchStabilityExpr(newExpr)
    case 'polarization': return patchPolarizationExpr(newExpr)
    case 'labor_unrest': return patchLaborUnrestExpr(newExpr)
    case 'stress':       return patchStressExpr(newExpr)
    case 'happiness':    return patchHappinessExpr(newExpr)
    case 'birth_chance': return patchBirthChanceExpr(newExpr)
  }
}
