/**
 * Social graph caps used by NPC helpers (`sim/npc.ts`).
 */

/** Max simultaneous enmity entries; oldest evicted when full. */
export const NPC_MAX_ENMITY_IDS = 5

/** Zones treated as generic social hubs for movement / encounters. */
export const NPC_SOCIAL_HUB_ZONES = ['market_square', 'plaza'] as const
