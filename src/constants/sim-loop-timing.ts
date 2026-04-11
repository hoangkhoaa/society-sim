/**
 * Real-time ↔ sim-time pacing and government cycle length in sim-days.
 */

/** Sim-hours advanced per outer loop iteration at 1× speed (1 tick = 1 sim-hour). */
export const SIM_BASE_TICK_MS = 1000

/** `runGovernmentCycle` scheduling period in sim-days. */
export const GOVERNMENT_POLICY_PERIOD_DAYS = 15
