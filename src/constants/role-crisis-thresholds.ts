/**
 * Emergency role reassignment hysteresis (`sim/roles.ts`).
 */

/** Food % below this for `CRISIS_PERSIST_DAYS` → farming draft. */
export const ROLE_CRISIS_FOOD_THRESHOLD = 15

/** Food % above this for `RECOVERY_PERSIST_DAYS` → allow reversion. */
export const ROLE_RECOVERY_FOOD_THRESHOLD = 35

/** Guards below this fraction of living pop → security crisis. */
export const ROLE_GUARD_SHORTAGE_FRACTION = 0.05

/** Days food crisis must persist before reassignment. */
export const ROLE_CRISIS_PERSIST_DAYS = 3

/** Days food must stay high before reverting emergency roles. */
export const ROLE_RECOVERY_PERSIST_DAYS = 2

/** Sim-days in emergency role before it becomes permanent. */
export const ROLE_EMERGENCY_PERMANENT_DAYS = 90

/** Max fraction of eligible NPCs reassigned per sim-day. */
export const ROLE_MAX_SHIFT_FRACTION = 0.30
