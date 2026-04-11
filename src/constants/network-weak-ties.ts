/**
 * Weak-tie replenishment cadence (`engine/network-dynamics.ts`).
 */

/** Eligible when weak ties fall below this fraction of personal target. */
export const WEAK_TIE_REPLENISHMENT_THRESHOLD = 0.70

/** Fraction of eligible NPCs processed per weekly replenishment pass. */
export const WEAK_TIE_REPLENISHMENT_SAMPLE_RATE = 0.10
