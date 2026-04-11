/**
 * Per-tick wealth / barter tuning (`sim/npc.ts` wealthTick).
 */

/** P2P trade efficiency when no merchant intermediates (friction). */
export const NPC_TRADE_EFFICIENCY = 0.80

/** Merchant cut on mediated trades. */
export const NPC_MERCHANT_MARKUP = 0.22

/** Survival spending per tick (food, shelter); scales daily drain. */
export const NPC_SURVIVAL_COST_PER_TICK = 0.07
