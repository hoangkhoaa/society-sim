/**
 * Per-tick wealth / barter tuning (`sim/npc.ts` wealthTick).
 */

/** P2P trade efficiency when no merchant intermediates (friction). */
export const NPC_TRADE_EFFICIENCY = 0.80

/** Merchant cut on mediated trades. */
export const NPC_MERCHANT_MARKUP = 0.22

/** Survival spending per tick (food, shelter); scales daily drain. */
export const NPC_SURVIVAL_COST_PER_TICK = 0.06

// ── Farmer supply-chain ────────────────────────────────────────────────────

/** Productivity fraction kept for subsistence; surplus starts above this floor. */
export const FARMER_SUPPLY_SUBSISTENCE_FLOOR = 0.3
/** Multiplier that converts raw productivity surplus into a saleable fraction. */
export const FARMER_SUPPLY_SURPLUS_SCALE = 0.8
/** Base volume multiplier — scales stated sale value relative to market freedom. */
export const FARMER_SUPPLY_SALE_VOLUME = 3
/** Fraction of sale value a merchant buyer pays (reseller margin deducted). */
export const FARMER_SUPPLY_MERCHANT_RATIO = 0.70
/** Fraction of sale value a craftsman buyer pays (no reseller margin). */
export const FARMER_SUPPLY_CRAFTSMAN_RATIO = 0.90
/** How far into strong_ties the farmer searches for buyers. */
export const FARMER_SUPPLY_STRONG_LIMIT = 6
/** How far into weak_ties the farmer searches for buyers. */
export const FARMER_SUPPLY_WEAK_LIMIT = 8

// ── Craftsman materials ────────────────────────────────────────────────────

/** Base cost multiplier for raw materials purchase (× market_freedom × trade_mult). */
export const CRAFTSMAN_MATERIAL_COST_BASE = 1.5
/** How far into strong_ties the craftsman searches for material suppliers. */
export const CRAFTSMAN_SUPPLY_STRONG_LIMIT = 4
/** How far into weak_ties the craftsman searches for material suppliers. */
export const CRAFTSMAN_SUPPLY_WEAK_LIMIT = 8

// ── Scholar tutoring ───────────────────────────────────────────────────────

/** Base tuition rate (× market_freedom) per student per session. */
export const SCHOLAR_TUITION_BASE = 0.5
/** Maximum students a scholar can tutor per sim-day. */
export const SCHOLAR_MAX_STUDENTS = 2
/** Minimum stress level that makes an NPC willing to pay for tutoring. */
export const SCHOLAR_STRESS_THRESHOLD = 25
/** Minimum dissonance level that makes an NPC willing to pay for tutoring. */
export const SCHOLAR_DISSONANCE_THRESHOLD = 20
/** Stress removed from student per tutoring session. */
export const SCHOLAR_STRESS_RELIEF = 2.5
/** Dissonance removed from student per tutoring session. */
export const SCHOLAR_DISSONANCE_RELIEF = 2.0
/** How far into strong_ties the scholar searches for students. */
export const SCHOLAR_STRONG_LIMIT = 4
/** How far into weak_ties the scholar searches for students. */
export const SCHOLAR_WEAK_LIMIT = 6

// ── Healthcare ─────────────────────────────────────────────────────────────

/** Base consultation fee rate (× market_freedom) per patient per session. */
export const HEALTHCARE_FEE_BASE = 0.8
/** Maximum patients a healthcare worker can treat per sim-day. */
export const HEALTHCARE_MAX_PATIENTS = 2
/** Minimum hunger level that makes an NPC seek medical treatment. */
export const HEALTHCARE_HUNGER_THRESHOLD = 45
/** Sick ticks removed per treatment (accelerated recovery). */
export const HEALTHCARE_SICK_TICKS_RELIEF = 12
/** Hunger reduced per treatment session. */
export const HEALTHCARE_HUNGER_RELIEF = 8
/** Stress reduced per treatment session. */
export const HEALTHCARE_STRESS_RELIEF = 3
/** How far into strong_ties the healthcare worker searches for patients. */
export const HEALTHCARE_STRONG_LIMIT = 4
/** How far into weak_ties the healthcare worker searches for patients. */
export const HEALTHCARE_WEAK_LIMIT = 6

// ── Consumer spending split ────────────────────────────────────────────────

/** Fraction of a 6-tick spending window spent on a single social purchase. */
export const CONSUMER_SPEND_FRACTION = 0.5
/** Modulo base used to stagger craftsman-preferring spending cycles. */
export const CONSUMER_CRAFTSMAN_MODULO = 5
/** Spending cycles (out of CONSUMER_CRAFTSMAN_MODULO) that prefer craftsmen. */
export const CONSUMER_CRAFTSMAN_CYCLES = 2

// ── Craftsman social goods sales ──────────────────────────────────────────

/** Base price rate for craftsman goods sold to neighbours (× mf × trade_mult). */
export const CRAFTSMAN_GOODS_PRICE_BASE = 0.6
/** Happiness added to the buyer after purchasing craftsman goods. */
export const CRAFTSMAN_GOODS_HAPPINESS_BONUS = 0.8

// ── Farmer social food sales ──────────────────────────────────────────────

/** Base price rate for food sold directly to hungry neighbours (× mf × trade_mult). */
export const FARMER_FOOD_PRICE_BASE = 0.4
/** Minimum hunger level that makes a neighbour want to buy food. */
export const FARMER_FOOD_HUNGER_THRESHOLD = 35
/** Hunger reduced per food purchase. */
export const FARMER_FOOD_HUNGER_RELIEF = 15
/** Minimum productivity required for a farmer to sell food socially. */
export const FARMER_FOOD_MIN_PRODUCTIVITY = 0.4
