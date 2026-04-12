/**
 * Central re-export for all simulation formula modules.
 *
 * Formula modules expose:
 *   1. An `*_EXPR` mutable string — the raw expression that can be patched
 *      at runtime via government reforms, scientific breakthroughs, or
 *      god-agent commands.
 *   2. A compiled `*Fn` function created via `new Function()` from that string.
 *   3. A typed wrapper function (`compute*`) that applies clamping and passes
 *      the right arguments so engine/sim code stays clean.
 *
 * To patch a formula at runtime, use `patchFormula` from `./registry`.
 * All changes are recorded in `WorldState.breakthrough_log`.
 */

export {
  STABILITY_EXPR,
  stabilityFn,
  computeStability,
  POLARIZATION_EXPR,
  polarizationFn,
  computePolarization,
  LABOR_UNREST_EXPR,
  laborUnrestFn,
  computeLaborUnrest,
} from './macro'

export {
  STRESS_EXPR,
  stressFn,
  computeStressScore,
  HAPPINESS_EXPR,
  happinessFn,
  computeHappinessScore,
} from './npc'

export {
  BIRTH_CHANCE_EXPR,
  birthChanceFn,
  computeBirthChance,
} from './lifecycle'

export { patchFormula, getFormulaExpr } from './registry'
