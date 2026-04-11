/**
 * Tax-funded wages and wealth mobility (`engine/economy.ts`).
 */

/** Daily wage paid from tax pool per guard (coins). */
export const GOVT_WAGE_GUARD_COINS = 3.5

/** Daily wage paid from tax pool per leader (coins). */
export const GOVT_WAGE_LEADER_COINS = 6.0

/** Minimum wealth to trigger investment behavior. */
export const WEALTH_INVEST_THRESHOLD = 6000

/** Minimum wealth where “gang boss” transition becomes possible. */
export const WEALTH_GANG_THRESHOLD = 4000

/** Stagger interval for investment checks (ticks). */
export const WEALTH_INVEST_INTERVAL_TICKS = 24 * 7
