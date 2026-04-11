/**
 * World event coverage helpers (`engine/events.ts`).
 */

/** Full zone list for epidemic spread when filling the map. */
export const EVENT_ALL_ZONES: readonly string[] = [
  'north_farm', 'south_farm', 'workshop_district', 'market_square',
  'scholar_quarter', 'residential_east', 'residential_west', 'guard_post', 'plaza',
  'clinic_district', 'underworld_quarter',
]

/**
 * Event types that must never apply instant-kill / mass death
 * even if the model returns a kill rate.
 */
export const NON_LETHAL_EVENT_TYPES = new Set<string>([
  'resource_boom', 'trade_offer', 'tech_shift', 'charismatic_npc', 'ideology_import',
  'festival', 'golden_harvest', 'cultural_renaissance',
])
