/**
 * Tax-funded wages and wealth mobility (`engine/economy.ts`).
 */

/** Daily wage paid from tax pool per guard (coins). */
export const GOVT_WAGE_GUARD_COINS = 2.5

/** Daily wage paid from tax pool per leader (coins). */
export const GOVT_WAGE_LEADER_COINS = 4.0

/** If payroll covers less than this ratio, government workers may quit. */
export const GOVT_WAGE_QUIT_PAY_RATIO_THRESHOLD = 0.30

/** Max fraction of guard/leader workers who can quit per day. */
export const GOVT_WAGE_MAX_QUITS_PER_DAY_FRACTION = 0.03

/** Minimum daily-income gain needed to justify role exit. */
export const GOVT_WAGE_QUIT_MIN_EXPECTED_GAIN = 0.8

/** Payroll stress must persist this many days before exits are considered. */
export const GOVT_WAGE_QUIT_UNDERFUNDED_DAYS = 7

/** Early-game grace period before government exits are allowed. */
export const GOVT_WAGE_QUIT_GRACE_DAYS = 21

/** Minimum guard share to preserve baseline public order capacity. */
export const GOVT_WAGE_MIN_GUARD_FRACTION = 0.04

/** Initial treasury seed in "days of payroll" at world init. */
export const GOVT_WAGE_INITIAL_TREASURY_PAYROLL_DAYS = 45

/** Baseline export turnover share of GDP per day before regime scaling. */
export const TRADE_BASE_EXPORT_GDP_SHARE = 0.14

/** Baseline import turnover share of GDP per day before regime scaling. */
export const TRADE_BASE_IMPORT_GDP_SHARE = 0.09

/** Additional export potential from available natural resources (0-100 macro scale). */
export const TRADE_RESOURCE_EXPORT_BONUS = 0.18

/** Additional import pressure when food/resources are scarce. */
export const TRADE_SCARCITY_IMPORT_PRESSURE = 0.22

/** Number of consecutive critical-tax days before money printing is allowed. */
export const MONEY_PRINT_CRITICAL_DAYS = 9

/** Cooldown between two printing operations (in days). */
export const MONEY_PRINT_COOLDOWN_DAYS = 14

/** Printed amount as a multiple of daily payroll once triggered. */
export const MONEY_PRINT_PAYROLL_MULTIPLIER = 1.8

/** Extra inflation pressure from money printing (scaled by printed/supply). */
export const MONEY_PRINT_INFLATION_MULTIPLIER = 1.2

/** Minimum wealth to trigger investment behavior. */
export const WEALTH_INVEST_THRESHOLD = 6000

/** Minimum wealth where “gang boss” transition becomes possible. */
export const WEALTH_GANG_THRESHOLD = 4000

/** Stagger interval for investment checks (ticks). */
export const WEALTH_INVEST_INTERVAL_TICKS = 24 * 7

// ── Property / Land Tax ────────────────────────────────────────────────────

/**
 * Daily levy rate on NPC wealth above PROPERTY_TAX_WEALTH_FLOOR.
 * Models a land/property tax — the most stable pre-modern revenue source.
 * 0.05 %/day ≈ ~18 %/year on accumulated wealth; mirrors historical land-tax
 * burdens across Rome, Tang China, Ottoman, and feudal Europe.
 */
export const PROPERTY_TAX_RATE = 0.0008

/**
 * Minimum wealth (coins) before property tax applies.
 * Protects subsistence-level NPCs; only taxable surplus above this floor.
 */
export const PROPERTY_TAX_WEALTH_FLOOR = 150

// ── Consumption / VAT-style Tax ────────────────────────────────────────────

/**
 * Fraction of each P2P consumer purchase added on top as an indirect tax.
 * The buyer pays spendAmount × (1 + CONSUMPTION_TAX_RATE); the tax portion
 * flows directly to tax_pool. Only applies when market_freedom ≥ 0.15.
 * Historically: sales taxes, market tolls, excise duties.
 */
export const CONSUMPTION_TAX_RATE = 0.05

// ── Experience / Learning-by-Doing Income Growth ──────────────────────────

/**
 * Fractional daily income growth per day spent in the same role.
 * E.g. 0.00003 / day → +1.1 % / year → +30 % cap after ~27 years.
 * Models "learning by doing" (Arrow 1962): workers get better at their job
 * through practice, which is the primary driver of pre-industrial growth.
 */
export const EXPERIENCE_INCOME_GROWTH_RATE = 0.00003

/**
 * Maximum income multiplier from accumulated experience (caps learning bonus).
 * At the cap (1.30) a veteran worker earns 30 % more than a novice in the
 * same role — consistent with historical wage differentials.
 */
export const EXPERIENCE_INCOME_MULT_CAP = 1.30
