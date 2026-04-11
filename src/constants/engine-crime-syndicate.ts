/**
 * Organized crime + shadow-economy tuning (`engine/crime.ts`).
 */

/** Daily probability roll to form a new syndicate when conditions hold. */
export const SYNDICATE_FORMATION_PROBABILITY = 0.05

/** Minimum members to keep or form a syndicate. */
export const MIN_SYNDICATE_SIZE = 4

/** Ticks between syndicate special actions (10 sim-days). */
export const SYNDICATE_ACTION_INTERVAL_TICKS = 240

/** Daily dues as a fraction of member wealth. */
export const SYNDICATE_DUES_RATE = 0.08

/** Daily bust chance when guard institution power > 0.55. */
export const SYNDICATE_BUST_PROBABILITY = 0.05

/** Fraction of members removed on a successful bust. */
export const SYNDICATE_MEMBER_BUST_RATE = 0.30

/** Protection racket: fraction of merchant wealth extracted per tick. */
export const SYNDICATE_RACKET_EXTRACTION_RATE = 0.05

/** Multiplier on guard raid chance vs syndicate members (shadow economy). */
export const SYNDICATE_RAID_CHANCE_MULTIPLIER = 1.5

/** Procedural names when a new syndicate spawns. */
export const SYNDICATE_NAME_POOL: readonly string[] = [
  'Iron Veil Brotherhood', 'Shadow Compact', 'Red Hand Society', 'Crimson Tide Outfit',
  'Black Market League', 'Night Crown Syndicate', 'Hollow Sun Cartel', 'Grey Wolf Ring',
  'Ember Court Gang', 'Silent Scale Consortium',
]
