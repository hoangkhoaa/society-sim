/**
 * Central re-export for all simulation formula modules.
 *
 * Formula modules expose:
 *   1. An `*_EXPR` string constant — the raw expression that can be inspected
 *      or modified by players to experiment with alternative social dynamics.
 *   2. A compiled `*Fn` function created via `new Function()` from that string.
 *   3. A typed wrapper function (`compute*`) that applies clamping and passes
 *      the right arguments so engine/sim code stays clean.
 *
 * To customize a formula at runtime, reassign the expression string and
 * rebuild the compiled function, e.g.:
 *
 *   import * as MacroFormulas from './formulas'
 *   // Increase food weight in the stability formula:
 *   MacroFormulas.STABILITY_EXPR = "avgTrustGov * 25 + cohesion * 20 + (food / 100) * 35 + ..."
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
