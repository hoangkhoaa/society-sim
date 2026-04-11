/**
 * Strike UI thresholds — mirrors engine labor logic for warnings and tension bars.
 * Solidarity / grievance are 0–100 scale; Gini gate matches feed warning in `main.ts`.
 */

export const STRIKEABLE_ROLES = ['farmer', 'craftsman', 'merchant', 'scholar', 'healthcare'] as const
export type StrikeableRole = (typeof STRIKEABLE_ROLES)[number]

/** Engine: average solidarity above this contributes to strike. */
export const STRIKE_SOLIDARITY_THRESHOLD = 72

/** Engine: average grievance above this contributes to strike. */
export const STRIKE_GRIEVANCE_THRESHOLD = 58

/** UI warning at 80% of engine thresholds (feed + labor panel “at risk”). */
export const STRIKE_WARN_SOLIDARITY = STRIKE_SOLIDARITY_THRESHOLD * 0.80

export const STRIKE_WARN_GRIEVANCE = STRIKE_GRIEVANCE_THRESHOLD * 0.80

/** Gini floor for strike-readiness feed warning (matches `checkStrikeReadiness`). */
export const STRIKE_READINESS_GINI_FLOOR = 0.42
