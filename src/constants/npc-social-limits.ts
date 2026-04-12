/**
 * Social graph caps used by NPC helpers (`sim/npc.ts`).
 */

/** Max simultaneous enmity entries; oldest evicted when full. */
export const NPC_MAX_ENMITY_IDS = 5

/** Max tracked direct relationship edges per NPC (sparse social graph). */
export const NPC_MAX_RELATION_EDGES = 12

/** Max retained relationship events in the per-NPC rolling log. */
export const NPC_MAX_RELATION_HISTORY = 24

/** Daily conflict decay applied to direct NPC-to-NPC edges. */
export const NPC_RELATION_CONFLICT_DECAY_PER_DAY = 0.03

/** Stale relation edges older than this (ticks) become eviction candidates. */
export const NPC_RELATION_STALE_TICKS = 24 * 30

/** Zones treated as generic social hubs for movement / encounters. */
export const NPC_SOCIAL_HUB_ZONES = ['market_square', 'plaza'] as const

// ── Phase-2 behavioral tuning ─────────────────────────────────────────────

/** Minimum worldview-dimension gap that triggers a persuasion debate. */
export const NPC_PERSUASION_MIN_WORLDVIEW_GAP = 0.35

/** Maximum worldview shift per winning debate (base = 3%, random up to this). */
export const NPC_PERSUASION_MAX_SHIFT = 0.05

/** Minimum averaged residual affinity (both edges) needed to qualify for reconciliation. */
export const NPC_RECONCILIATION_AFFINITY_THRESHOLD = 0.65

/** Daily probability of reconciliation when all soft conditions are met. */
export const NPC_RECONCILIATION_DAILY_CHANCE = 0.05

/** Minimum aggression score for feud escalation to confront roll. */
export const NPC_FEUD_ESCALATION_AGGRESSION_MIN = 0.55

/** Daily probability of feud escalating to confront when aggression threshold is met. */
export const NPC_FEUD_ESCALATION_DAILY_CHANCE = 0.04
