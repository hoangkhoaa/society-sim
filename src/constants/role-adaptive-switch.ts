/**
 * Voluntary occupation switching (market-like adaptation) tuning.
 * Complements emergency reassignment, does not replace it.
 */

/** Max fraction of switch-eligible workers that can switch per sim-day. */
export const ROLE_ADAPTIVE_MAX_SHIFT_FRACTION = 0.08

/** Minimum expected daily income gain required for a normal (non-famine) switch. */
export const ROLE_ADAPTIVE_MIN_DAILY_GAIN = 0.8

/** Base pressure threshold for voluntary switching. */
export const ROLE_ADAPTIVE_SWITCH_THRESHOLD = 0.40

/** Minimum cooldown before the same NPC can switch again (sim-days). */
export const ROLE_ADAPTIVE_COOLDOWN_DAYS = 30

/** Retraining duration after a voluntary switch (sim-days). */
export const ROLE_ADAPTIVE_RETRAIN_DAYS = 18

/** Immediate daily-income EMA shock on switch (learning curve). */
export const ROLE_ADAPTIVE_SWITCH_INCOME_FACTOR = 0.70

/** Minimum stat-readiness score required to switch into a target role. */
export const ROLE_ADAPTIVE_MIN_READINESS_SCORE = 0.52

/** Hard cap: exhausted workers above this cannot switch jobs voluntarily. */
export const ROLE_ADAPTIVE_MAX_EXHAUSTION_FOR_SWITCH = 82

/** Hard cap: hunger above this blocks non-emergency role switching. */
export const ROLE_ADAPTIVE_MAX_HUNGER_FOR_SWITCH = 78

/** Hard cap: stress above this blocks non-emergency role switching. */
export const ROLE_ADAPTIVE_MAX_STRESS_FOR_SWITCH = 80
