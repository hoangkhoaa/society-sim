/**
 * Birth spacing, romance, and marriage tuning (`engine/lifecycle.ts`).
 */

/** Minimum ticks between births for the same couple (720 sim-days × 24 h). */
export const LIFECYCLE_MIN_BIRTH_SPACING_TICKS = 720 * 24

/** Ticks of heartbreak cooldown before new romance (30 sim-days × 24 h). */
export const LIFECYCLE_HEARTBREAK_COOLDOWN_TICKS = 30 * 24

/** Minimum romance score before propose / pair bonding advances. */
export const LIFECYCLE_ROMANCE_THRESHOLD = 45
