import type { WorldState, Role } from '../types'
import { clamp } from '../sim/constitution'
import { permanentRoleChange } from '../sim/npc'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'
import {
  GOVT_WAGE_GUARD_COINS,
  GOVT_WAGE_LEADER_COINS,
  GOVT_WAGE_QUIT_PAY_RATIO_THRESHOLD,
  GOVT_WAGE_MAX_QUITS_PER_DAY_FRACTION,
  GOVT_WAGE_QUIT_MIN_EXPECTED_GAIN,
  GOVT_WAGE_QUIT_UNDERFUNDED_DAYS,
  GOVT_WAGE_QUIT_GRACE_DAYS,
  GOVT_WAGE_MIN_GUARD_FRACTION,
  TRADE_BASE_EXPORT_GDP_SHARE,
  TRADE_BASE_IMPORT_GDP_SHARE,
  TRADE_RESOURCE_EXPORT_BONUS,
  TRADE_SCARCITY_IMPORT_PRESSURE,
  MONEY_PRINT_CRITICAL_DAYS,
  MONEY_PRINT_COOLDOWN_DAYS,
  MONEY_PRINT_PAYROLL_MULTIPLIER,
  MONEY_PRINT_INFLATION_MULTIPLIER,
  WEALTH_INVEST_THRESHOLD,
  WEALTH_GANG_THRESHOLD,
  WEALTH_INVEST_INTERVAL_TICKS,
  PROPERTY_TAX_RATE,
  PROPERTY_TAX_WEALTH_FLOOR,
} from '../constants/economy-tuning'

let lastTaxSpendingDay = -1
let lastWealthMobilityDay = -1
let lastMoneyPrintDay = -1
let underfundedPayrollDays = 0

// ── Recession / Debt-Relief tracking (module-level, not persisted) ──────────
// Tracks consecutive days of GDP contraction (≥2% daily drop) to trigger
// government debt-relief stimulus when the economy enters a sustained recession.
let _prevDayGdp = 0
let _gdpDeclineDays = 0

const GOVERNMENT_EXIT_TARGET_ROLES: Role[] = ['farmer', 'craftsman', 'merchant', 'scholar', 'healthcare']

function maybeExitGovernmentRoles(state: WorldState, payRatio: number): void {
  if (payRatio >= GOVT_WAGE_QUIT_PAY_RATIO_THRESHOLD) return
  if (state.day <= GOVT_WAGE_QUIT_GRACE_DAYS) return
  if (underfundedPayrollDays < GOVT_WAGE_QUIT_UNDERFUNDED_DAYS) return

  const govWorkers = state.npcs.filter(n =>
    n.lifecycle.is_alive && (n.role === 'guard' || n.role === 'leader'),
  )
  if (govWorkers.length === 0) return

  const aliveAdults = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child').length
  const currentGuards = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard').length
  const minGuardCount = Math.max(1, Math.ceil(aliveAdults * GOVT_WAGE_MIN_GUARD_FRACTION))

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  const avgIncomeByRole = Object.fromEntries(
    GOVERNMENT_EXIT_TARGET_ROLES.map(role => {
      const group = living.filter(n => n.role === role)
      const avg = group.length > 0
        ? group.reduce((s, n) => s + n.daily_income, 0) / group.length
        : 0
      return [role, avg]
    }),
  ) as Record<Role, number>

  const maxQuits = Math.max(1, Math.ceil(govWorkers.length * GOVT_WAGE_MAX_QUITS_PER_DAY_FRACTION))
  let quitCount = 0

  const ordered = [...govWorkers].sort((a, b) => (b.grievance + b.fear) - (a.grievance + a.fear))
  for (const npc of ordered) {
    if (quitCount >= maxQuits) break
    if (npc.role === 'guard' && currentGuards - quitCount <= minGuardCount) continue
    const sinceLastSwitch = state.tick - (npc.last_role_switch_tick ?? -999999)
    if (sinceLastSwitch < 20 * 24) continue

    const currentIncome = Math.max(npc.daily_income, npc.role === 'leader' ? GOVT_WAGE_LEADER_COINS * payRatio : GOVT_WAGE_GUARD_COINS * payRatio)
    const targetRole = [...GOVERNMENT_EXIT_TARGET_ROLES]
      .sort((a, b) => avgIncomeByRole[b] - avgIncomeByRole[a])[0]
    const expectedGain = avgIncomeByRole[targetRole] - currentIncome
    if (expectedGain < GOVT_WAGE_QUIT_MIN_EXPECTED_GAIN) continue

    // Low payroll pushes stressed officers toward better-paying civilian roles.
    const quitPressure = clamp((1 - payRatio) * 0.4 + npc.grievance / 260 + npc.fear / 280, 0, 0.85)
    if (Math.random() > quitPressure) continue

    const fromRole = npc.role
    permanentRoleChange(npc, targetRole, state)
    npc.last_role_switch_tick = state.tick
    npc.role_retraining_until_tick = state.tick + 10 * 24
    npc.daily_income = Math.max(0, npc.daily_income * 0.65)

    const roleLabel = t(`role.${fromRole}`) as string
    const targetLabel = t(`role.${targetRole}`) as string
    addFeedRaw(
      tf('engine.gov_payroll_exit', { role: roleLabel, to: targetLabel }) as string,
      'warning',
      state.year,
      state.day,
    )
    quitCount++
  }
}

// ── Trade-driven state revenue + external money flow ───────────────────────
// Simulates exports/imports as a macro loop linked to production and scarcity.
// Trade balance changes overall money_supply (external inflow/outflow), while
// duties/tariffs create direct treasury income.

export function applyExternalTradeBalance(state: WorldState): void {
  if (state.collapse_phase !== 'normal') return

  const c = state.constitution
  const gdp = Math.max(state.macro.gdp ?? 0, 0)
  const resourceLevel = clamp((state.macro.natural_resources ?? 0) / 100, 0, 1)
  const foodStress = clamp((55 - (state.macro.food ?? 50)) / 55, 0, 1)
  const resourceStress = clamp((45 - (state.macro.natural_resources ?? 50)) / 45, 0, 1)

  const tradeVolume = clamp(0.50 + c.market_freedom * 0.95 - c.state_power * 0.12, 0.30, 1.45)
  const exportShare = TRADE_BASE_EXPORT_GDP_SHARE
    * tradeVolume
    * (1 + resourceLevel * TRADE_RESOURCE_EXPORT_BONUS)
    * (1 - c.resource_scarcity * 0.35)
  const importShare = TRADE_BASE_IMPORT_GDP_SHARE
    * clamp(0.85 + c.safety_net * 0.12 + (1 - c.market_freedom) * 0.10, 0.60, 1.25)
    * (1 + (foodStress + resourceStress) * TRADE_SCARCITY_IMPORT_PRESSURE)

  const exportsValue = Math.max(0, gdp * exportShare)
  const importsValue = Math.max(0, gdp * importShare)
  const tradeBalance = exportsValue - importsValue

  const exportDuty = clamp(0.07 + c.state_power * 0.05, 0.05, 0.14)
  const importTariff = clamp(0.03 + (1 - c.market_freedom) * 0.06, 0.02, 0.11)
  let tradeRevenue = exportsValue * exportDuty + importsValue * importTariff

  // High-state regimes often subsidize strategic imports when the economy runs a deficit.
  if (tradeBalance < 0 && c.state_power > 0.45) {
    const subsidy = Math.abs(tradeBalance) * 0.08 * c.state_power
    tradeRevenue -= subsidy
  }

  state.tax_pool = clamp((state.tax_pool ?? 0) + tradeRevenue, 0, 9_999_999)
  state.money_supply = clamp((state.money_supply ?? 0) + tradeBalance, 1, 99_999_999)

  state.trade_exports_last_day = exportsValue
  state.trade_imports_last_day = importsValue
  state.trade_balance_last_day = tradeBalance
  state.trade_revenue_last_day = tradeRevenue
}

// ── Emergency money printing (critical treasury backstop) ──────────────────
// If tax_pool remains critical for multiple days, state can print money.
// This rescues payroll short-term but raises inflation pressure.

export function maybePrintEmergencyMoney(state: WorldState): void {
  if (state.collapse_phase !== 'normal') return
  state.money_printed_last_day = 0

  const guards = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard').length
  const leaders = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'leader').length
  const dailyPayroll = guards * GOVT_WAGE_GUARD_COINS + leaders * GOVT_WAGE_LEADER_COINS
  if (dailyPayroll <= 0) return

  const criticalThreshold = Math.max(80, dailyPayroll * 2.5)
  if ((state.tax_pool ?? 0) < criticalThreshold) state.tax_pool_critical_days = (state.tax_pool_critical_days ?? 0) + 1
  else state.tax_pool_critical_days = 0

  if ((state.tax_pool_critical_days ?? 0) < MONEY_PRINT_CRITICAL_DAYS) return
  if (lastMoneyPrintDay >= 0 && state.day - lastMoneyPrintDay < MONEY_PRINT_COOLDOWN_DAYS) return

  const printed = Math.max(120, dailyPayroll * MONEY_PRINT_PAYROLL_MULTIPLIER * (0.9 + state.constitution.state_power * 0.4))
  state.tax_pool = clamp((state.tax_pool ?? 0) + printed, 0, 9_999_999)
  state.money_supply = clamp((state.money_supply ?? 0) + printed, 1, 99_999_999)
  state.money_printed_last_day = printed
  state.tax_pool_critical_days = 0
  lastMoneyPrintDay = state.day

  const priorSupply = Math.max((state.money_supply ?? 1) - printed, 1)
  const inflationShock = (printed / priorSupply) * MONEY_PRINT_INFLATION_MULTIPLIER
  state.inflation_rate = clamp((state.inflation_rate ?? 0) + inflationShock, 0, 2)

  addFeedRaw(
    tf('engine.money_printing', {
      amount: Math.round(printed),
      inf: ((state.inflation_rate ?? 0) * 100).toFixed(1),
    }) as string,
    'warning',
    state.year,
    state.day,
  )
}

export function applyInflationDrift(state: WorldState): void {
  const foodPressure = clamp((45 - (state.macro.food ?? 50)) / 45, 0, 1)
  const resourcePressure = clamp((35 - (state.macro.natural_resources ?? 50)) / 35, 0, 1)
  const deficitPressure = state.trade_balance_last_day < 0
    ? clamp(Math.abs(state.trade_balance_last_day) / Math.max(state.macro.gdp ?? 1, 1), 0, 1)
    : 0

  const inflationUp = foodPressure * 0.002 + resourcePressure * 0.0015 + deficitPressure * 0.0015
  const inflationDown = 0.0012 + state.constitution.market_freedom * 0.0005
  state.inflation_rate = clamp((state.inflation_rate ?? 0) + inflationUp - inflationDown, 0, 2)
}

// ── Welfare Redistribution ───────────────────────────────────────────────────
// `safety_net` (0–1) drives daily wealth transfer from the top 20% to the
// bottom 30%. At safety_net = 1.0 the top earners lose ~0.5% of wealth per day.
// Recipients get a small trust boost — they feel helped by the system.

export function applyWelfare(state: WorldState): void {
  // High state_power societies use direct state rationing instead (applyStateRationing)
  if (state.constitution.state_power > 0.70) return
  const safetyNet = state.constitution.safety_net
  if (safetyNet < 0.05) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 10) return

  const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
  const n = sorted.length
  const topStart    = Math.floor(n * 0.80)   // top 20% pay
  const bottomEnd   = Math.floor(n * 0.30)   // bottom 30% receive

  // Collect tax from wealthy
  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const tax = npc.wealth * safetyNet * 0.005   // 0–0.5%/day based on safety_net
    npc.wealth = clamp(npc.wealth - tax, 0, 50000)
    pool += tax
  }
  if (pool <= 0) return

  // Distribute to poor — money + direct hunger/stress relief (welfare isn't just cash)
  const recipients = sorted.slice(0, bottomEnd)
  if (recipients.length === 0) return
  const share = pool / recipients.length
  for (const npc of recipients) {
    npc.wealth  = clamp(npc.wealth + share, 0, 50000)
    npc.hunger  = clamp(npc.hunger - 5 * safetyNet, 0, 100)   // food vouchers / aid
    npc.stress  = clamp(npc.stress - 3 * safetyNet, 0, 100)   // financial relief reduces anxiety
    if (share > 1) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.002, 0, 1)
    }
  }
}

// ── State Rationing (high state_power societies) ──────────────────────────────
// Replaces market-based welfare when state_power > 0.70.
// The government directly draws from food_stock to feed hungry citizens,
// and enforces equality through aggressive wealth leveling (top 30% → bottom 40%).

export function applyStateRationing(state: WorldState): void {
  const { state_power, safety_net } = state.constitution
  if (state_power <= 0.70 || safety_net < 0.10) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 10) return

  // Food rationing: state draws from food_stock to relieve hunger
  const hungry    = living.filter(n => n.hunger > 45)
  const totalCost = hungry.length * safety_net * 0.5
  if (state.food_stock > totalCost && hungry.length > 0) {
    state.food_stock = clamp(state.food_stock - totalCost, 0, 999999)
    for (const npc of hungry) {
      npc.hunger = clamp(npc.hunger - 8 * safety_net, 0, 100)
      // Citizens feel helped — small trust boost for active state care
      npc.trust_in.government.intention = clamp(
        npc.trust_in.government.intention + 0.002 * state_power, 0, 1,
      )
    }
  }

  // Wealth leveling: state levy on top 30%, distributed to bottom 40%
  const sorted    = [...living].sort((a, b) => a.wealth - b.wealth)
  const n         = sorted.length
  const topStart  = Math.floor(n * 0.70)
  const bottomEnd = Math.floor(n * 0.40)

  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const levy = npc.wealth * state_power * safety_net * 0.008
    npc.wealth  = clamp(npc.wealth - levy, 0, 50000)
    pool += levy
  }
  if (pool > 0 && bottomEnd > 0) {
    const share = pool / bottomEnd
    for (const npc of sorted.slice(0, bottomEnd)) {
      npc.wealth = clamp(npc.wealth + share, 0, 50000)
    }
  }
}

// ── Feudal Tribute ────────────────────────────────────────────────────────────
// In high-inequality + high-state-power societies (Feudal, Warlord, Authoritarian),
// farmers and craftsmen pay a daily wealth tribute to leaders and guards.
// Generates grievance and trust erosion among tribute payers.
// Rate = (gini - 0.40) × state_power × 0.005 per day (zero for egalitarian societies).

export function applyFeudalTribute(state: WorldState): void {
  // No tribute system when society is in collapse or critical phase
  if (state.collapse_phase !== 'normal') return
  const { state_power } = state.constitution
  // Use live macro.gini (actual wealth distribution) instead of constitution gini_start.
  // This means tribute intensifies as real inequality grows, not just starting conditions.
  const liveGini = state.macro.gini ?? state.constitution.gini_start
  const tributeRate = Math.max(0, (liveGini - 0.40) * state_power * 0.005)
  if (tributeRate < 0.0001) return

  const living     = state.npcs.filter(n => n.lifecycle.is_alive)
  const payers     = living.filter(n => n.role === 'farmer'  || n.role === 'craftsman')
  const collectors = living.filter(n => n.role === 'leader'  || n.role === 'guard')
  if (collectors.length === 0 || payers.length === 0) return

  let pool = 0
  for (const npc of payers) {
    const tribute = npc.wealth * tributeRate
    if (tribute < 0.01) continue
    npc.wealth    = clamp(npc.wealth - tribute, 0, 50000)
    pool         += tribute
    // Tribute generates grievance and erodes trust in government
    npc.grievance = clamp(npc.grievance + tributeRate * 300, 0, 100)
    npc.trust_in.government.intention = clamp(
      npc.trust_in.government.intention - tributeRate * 0.3, 0, 1,
    )
  }
  if (pool <= 0) return

  const share = pool / collectors.length
  for (const npc of collectors) {
    npc.wealth = clamp(npc.wealth + share, 0, 50000)
  }
}

// ── Income Tax Collection ─────────────────────────────────────────────────────
// All market-working NPCs (non-government roles) pay a fraction of their daily
// income as income tax into the state treasury (tax_pool). Tax rate depends on
// the constitutional regime:
//   authoritarian/socialist  → 25 %
//   welfare/theocratic       → 20 %
//   feudal                   → 15 %
//   moderate                 → 10 %
//   libertarian              →  5 %
// Workers who earn very little (daily_income < 5) are exempt to protect the poor.

export function getIncomeTaxRate(state: WorldState): number {
  const c = state.constitution
  if (c.state_power >= 0.75 && c.market_freedom < 0.25) return 0.25  // authoritarian
  if (c.safety_net >= 0.65 && c.gini_start < 0.40) return 0.20       // welfare
  if (c.state_power >= 0.70 && c.base_trust >= 0.65) return 0.20     // theocratic
  if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) return 0.18  // feudal (was 0.15)
  if (c.market_freedom >= 0.70 && c.state_power < 0.40) return 0.05  // libertarian
  return 0.15  // moderate (was 0.10)
}

export function applyIncomeTax(state: WorldState): void {
  // No tax collection when society has collapsed or is critical (government dissolved)
  if (state.collapse_phase !== 'normal') return
  const taxRate = getIncomeTaxRate(state)
  if (taxRate <= 0) return

  const EXEMPT_THRESHOLD = 1   // daily_income below this is exempt

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.role === 'child') continue
    if (npc.role === 'guard' || npc.role === 'leader') continue  // govt workers don't pay income tax
    if (npc.daily_income < EXEMPT_THRESHOLD) continue

    // Tax = daily_income × rate (collected once per day, matching wage cadence).
    const taxAmount = npc.daily_income * taxRate
    if (taxAmount < 0.01) continue
    npc.wealth = clamp(npc.wealth - taxAmount, 0, 50000)
    state.tax_pool = clamp((state.tax_pool ?? 0) + taxAmount, 0, 9_999_999)

    // High tax with low perceived government competence → grievance
    if (taxRate >= 0.20 && npc.trust_in.government.competence < 0.40) {
      npc.grievance = clamp(npc.grievance + 0.5, 0, 100)
    }
    // Tax in welfare states with good trust → slight happiness boost (safety net working)
    if (taxRate >= 0.15 && npc.trust_in.government.intention > 0.60) {
      npc.happiness = clamp(npc.happiness + 0.2, 0, 100)
    }
  }
}

// ── Government Wage Payments ──────────────────────────────────────────────────
// Guards and leaders receive daily wages from the tax_pool.
// Base wages: guard=8, leader=14 coins/day.
// If the pool is insufficient, wages are prorated (government insolvency).
// Running out of money triggers guard morale collapse (fear spike).

export function applyGovernmentWages(state: WorldState): void {
  // No wages when government has dissolved due to population collapse
  if (state.collapse_phase !== 'normal') return
  if (state.tick <= 24) underfundedPayrollDays = 0
  if ((state.tax_pool ?? 0) <= 0) {
    underfundedPayrollDays++
    maybeExitGovernmentRoles(state, 0)
    return
  }

  const guards  = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard')
  const leaders = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'leader')
  const totalWageBill = guards.length * GOVT_WAGE_GUARD_COINS + leaders.length * GOVT_WAGE_LEADER_COINS

  if (totalWageBill <= 0) return

  const pool = state.tax_pool ?? 0

  // Dynamic fiscal health bonus: when treasury is very healthy (>45 days payroll),
  // government workers receive a small prosperity bonus — reflects real-world public
  // sector raises during surplus years and builds loyalty/reduces future unrest.
  const fiscalHealthDays = pool / Math.max(totalWageBill, 1)
  const wageHealthBonus = fiscalHealthDays > 45 ? 1.06   // +6% when flush
    : fiscalHealthDays > 20 ? 1.02                       // +2% when comfortable
    : 1.0                                                // standard

  const effectiveWageBill = totalWageBill * wageHealthBonus
  const payRatio = pool >= effectiveWageBill ? wageHealthBonus : pool / totalWageBill
  const poolSpent = Math.min(pool, effectiveWageBill)
  state.tax_pool = clamp(pool - poolSpent, 0, 9_999_999)
  if (payRatio < GOVT_WAGE_QUIT_PAY_RATIO_THRESHOLD) underfundedPayrollDays++
  else underfundedPayrollDays = 0

  for (const npc of guards) {
    const wage = GOVT_WAGE_GUARD_COINS * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    // daily_income for govt roles: EMA toward actual daily wage.
    // wage is already in coins/day; no ×24 needed (this is a per-day update, not per-tick).
    npc.daily_income = npc.daily_income * 0.99 + wage * 0.01
    if (payRatio < 0.5) {
      npc.fear      = clamp(npc.fear + 5, 0, 100)
      npc.grievance = clamp(npc.grievance + 3, 0, 100)
    }
  }
  for (const npc of leaders) {
    const wage = GOVT_WAGE_LEADER_COINS * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    npc.daily_income = npc.daily_income * 0.99 + wage * 0.01
    if (payRatio < 0.5) {
      npc.fear      = clamp(npc.fear + 3, 0, 100)
      npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }

  maybeExitGovernmentRoles(state, payRatio)
}

// ── Regime-Based Tax Spending ─────────────────────────────────────────────────
// Every 7 days the government spends accumulated tax revenue on regime-specific
// investments. Each spending type applies macro or NPC-level bonuses and emits
// a feed message explaining the policy.


export function spendTaxRevenue(state: WorldState): void {
  // No government spending when population has collapsed
  if (state.collapse_phase !== 'normal') return
  // Spend daily: ~10% of pool per day. Prevents the 7-day lump-sum from
  // creating oversized single-day effects that dilute any visible impact.
  if (state.day === lastTaxSpendingDay) return
  if ((state.tax_pool ?? 0) < 20) return
  lastTaxSpendingDay = state.day

  const pool = state.tax_pool ?? 0
  const guards = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard').length
  const leaders = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'leader').length
  const dailyPayroll = guards * GOVT_WAGE_GUARD_COINS + leaders * GOVT_WAGE_LEADER_COINS
  const protectedReserve = dailyPayroll * 5
  const spendablePool = Math.max(0, pool - protectedReserve)
  if (spendablePool < 20) return
  const spendAmount = spendablePool * 0.10   // spend 10%/day from pool above payroll reserve
  state.tax_pool = clamp(pool - spendAmount, 0, 9_999_999)

  const c = state.constitution
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length === 0) return

  // Detect regime for spending pattern
  let spendType: 'infrastructure' | 'research' | 'military' | 'welfare' | 'temples' | 'balanced'
  if (c.state_power >= 0.75 && c.market_freedom < 0.25) {
    spendType = 'military'           // authoritarian: military + surveillance
  } else if (c.safety_net >= 0.65 && c.gini_start < 0.40) {
    spendType = 'welfare'            // welfare state: social programs
  } else if (c.state_power >= 0.70 && c.base_trust >= 0.65) {
    spendType = 'temples'            // theocratic: religious/civic projects
  } else if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) {
    spendType = 'military'           // feudal: lords spend on armies
  } else if (c.value_priority[0] === 'growth' && c.individual_rights_floor >= 0.50) {
    spendType = 'research'           // technocratic: R&D
  } else if (c.market_freedom >= 0.50) {
    spendType = 'infrastructure'     // moderate/libertarian: infrastructure
  } else {
    spendType = 'balanced'
  }

  let feedMsg = ''

  switch (spendType) {
    case 'infrastructure': {
      // Infrastructure: workers get cash + quality-of-life boost + skill development
      const workers = living.filter(n => n.role === 'farmer' || n.role === 'craftsman' || n.role === 'merchant')
      if (workers.length > 0) {
        const perWorker = spendAmount / workers.length
        for (const npc of workers) {
          npc.wealth     = clamp(npc.wealth + perWorker, 0, 50000)
          npc.exhaustion = clamp(npc.exhaustion - 8, 0, 100)
          npc.happiness  = clamp(npc.happiness  + 3, 0, 100)
          // Infrastructure investment builds worker skills over time (learning by doing)
          npc.base_skill = clamp(npc.base_skill + 0.02, 0, 1.0)
        }
      }
      feedMsg = tf('engine.tax_spend.infrastructure', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'research': {
      // R&D: scholars get large bonus; everyone gets literacy/happiness
      const scholars = living.filter(n => n.role === 'scholar')
      if (scholars.length > 0) {
        const perScholar = spendAmount * 0.6 / scholars.length
        for (const npc of scholars) {
          npc.wealth    = clamp(npc.wealth + perScholar, 0, 50000)
          npc.happiness = clamp(npc.happiness + 5, 0, 100)
        }
        // Remainder distributed to all as general prosperity
        const remainder = spendAmount * 0.4 / living.length
        for (const npc of living) {
          npc.wealth    = clamp(npc.wealth + remainder, 0, 50000)
          npc.happiness = clamp(npc.happiness + 1, 0, 100)
        }
      } else {
        const perNPC = spendAmount / living.length
        for (const npc of living) npc.wealth = clamp(npc.wealth + perNPC, 0, 50000)
      }
      feedMsg = tf('engine.tax_spend.research', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'military': {
      // Military: 70% to guards (soldiers), 30% to leaders (officers/commanders)
      // Civilians feel the oppressive presence but receive nothing
      const guards  = living.filter(n => n.role === 'guard')
      const leaders = living.filter(n => n.role === 'leader')
      if (guards.length > 0) {
        const perGuard = spendAmount * 0.70 / guards.length
        for (const npc of guards) {
          npc.wealth    = clamp(npc.wealth + perGuard, 0, 50000)
          npc.happiness = clamp(npc.happiness + 6, 0, 100)
          npc.fear      = clamp(npc.fear - 5, 0, 100)
        }
      }
      if (leaders.length > 0) {
        const perLeader = spendAmount * 0.30 / leaders.length
        for (const npc of leaders) {
          npc.wealth    = clamp(npc.wealth + perLeader, 0, 50000)
          npc.happiness = clamp(npc.happiness + 4, 0, 100)
        }
      }
      for (const npc of living.filter(n => n.role !== 'guard' && n.role !== 'leader')) {
        npc.fear = clamp(npc.fear + 3, 0, 100)
      }
      feedMsg = tf('engine.tax_spend.military', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'welfare': {
      // Welfare: bottom 40% get direct cash transfer — real money from tax pool
      const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
      const bottom = sorted.slice(0, Math.ceil(sorted.length * 0.40))
      if (bottom.length > 0) {
        const perRecipient = spendAmount / bottom.length
        for (const npc of bottom) {
          npc.wealth    = clamp(npc.wealth + perRecipient, 0, 50000)
          npc.hunger    = clamp(npc.hunger - 10, 0, 100)
          npc.stress    = clamp(npc.stress  - 5, 0, 100)
          npc.happiness = clamp(npc.happiness + 6, 0, 100)
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.02, 0, 1)
        }
      }
      feedMsg = tf('engine.tax_spend.welfare', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'temples': {
      // Temples / civic projects: 60% as direct wealth (offerings, wages), 40% as social goods
      // Social goods = isolation drop, happiness, trust — not money, so the full spendAmount is accounted for.
      const perNPC = spendAmount / living.length
      for (const npc of living) {
        npc.wealth    = clamp(npc.wealth + perNPC * 0.6, 0, 50000)
        npc.isolation = clamp(npc.isolation - 6, 0, 100)
        npc.happiness = clamp(npc.happiness + 5, 0, 100)
        npc.stress    = clamp(npc.stress - 3, 0, 100)
        if (npc.worldview.authority_trust > 0.5) {
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.015, 0, 1)
        }
      }
      feedMsg = tf('engine.tax_spend.temples', { amount: Math.round(spendAmount) }) as string
      break
    }
    case 'balanced': {
      // Balanced: distribute evenly to all — universal dividend
      const perNPC = spendAmount / living.length
      for (const npc of living) {
        npc.wealth    = clamp(npc.wealth + perNPC, 0, 50000)
        npc.happiness = clamp(npc.happiness + 2, 0, 100)
      }
      feedMsg = tf('engine.tax_spend.balanced', { amount: Math.round(spendAmount) }) as string
      break
    }
  }

  if (feedMsg) {
    addFeedRaw(feedMsg, 'political', state.year, state.day)
  }
}

// ── Income Inequality Effects ─────────────────────────────────────────────────
// NPCs earning significantly above/below average experience secondary effects:
//   High earners (≥2× avg): happiness boost, slight isolation (workaholic)
//   Low earners (≤0.3× avg): stress and grievance increase

export function applyIncomeInequalityEffects(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length === 0) return

  const avgIncome = living.reduce((s, n) => s + n.daily_income, 0) / living.length
  if (avgIncome < 1) return  // not enough economic activity to compute meaningful effects

  for (const npc of living) {
    const ratio = npc.daily_income / avgIncome
    if (ratio >= 2.0) {
      // Prosperous: happiness up, slight isolation (all work no play)
      npc.happiness  = clamp(npc.happiness  + 0.5, 0, 100)
      npc.isolation  = clamp(npc.isolation  + 0.3, 0, 100)
    } else if (ratio <= 0.30 && npc.daily_income < 3) {
      // Struggling: stress and grievance
      npc.stress     = clamp(npc.stress    + 1.0, 0, 100)
      npc.grievance  = clamp(npc.grievance + 0.8, 0, 100)
    }
  }
}
// When an NPC dies, 60% of their wealth passes to living children equally.
// The remaining 40% dissipates (estate costs, decomposition of assets).
// The wealth field is reset to 0 to prevent double-distribution.

export function processInheritance(state: WorldState): void {
  for (const npc of state.npcs) {
    if (npc.lifecycle.is_alive || npc.wealth < 1) continue

    const livingChildren = npc.lifecycle.children_ids
      .map(id => state.npcs[id])
      .filter((c): c is typeof npc => !!c && c.lifecycle.is_alive)

    if (livingChildren.length === 0) {
      npc.wealth = 0   // no heirs — wealth lost
      continue
    }

    const share = (npc.wealth * 0.60) / livingChildren.length
    const capitalShare = ((npc.capital ?? 0) * 0.60) / livingChildren.length
    for (const child of livingChildren) {
      child.wealth = clamp(child.wealth + share, 0, 50000)
      // Capital inheritance: productive assets passed to heirs
      if (capitalShare > 0) {
        child.capital = clamp((child.capital ?? 0) + capitalShare, 0, 100)
        // Heir now owns capital — clear any existing rental arrangement
        if ((child.capital ?? 0) > 5 && child.capital_rents_from != null) {
          child.capital_rents_from = null
          child.capital_rent_paid  = 0
        }
      }
      // Memory: windfall from inheritance (emotional weight scales with amount)
      const emotionalWeight = clamp(share / 20, 2, 40)
      child.memory.push({
        event_id: 'inheritance_' + state.tick,
        type: 'windfall',
        emotional_weight: emotionalWeight,
        tick: state.tick,
      })
      if (child.memory.length > 10) child.memory.shift()
    }
    npc.wealth  = 0   // mark as distributed
    npc.capital = 0
  }
}

// ── Wealth Mobility & Role Changes ───────────────────────────────────────────
// Very wealthy NPCs invest surplus capital in research, infrastructure, or
// (when aggressive) transition to organised crime as gang bosses.
// Very poor, high-grievance NPCs face increased pressure to turn to crime.

export function checkWealthMobility(state: WorldState): void {
  if (state.day === lastWealthMobilityDay) return
  lastWealthMobilityDay = state.day

  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')

  for (const npc of living) {
    // ── Rich NPC: invest in research or infrastructure ─────────────────────
    if (
      npc.wealth >= WEALTH_INVEST_THRESHOLD &&
      (npc.personality?.ambition ?? 0.3) > 0.5 &&
      npc.role !== 'gang' &&
      state.tick % WEALTH_INVEST_INTERVAL_TICKS === npc.id % WEALTH_INVEST_INTERVAL_TICKS
    ) {
      const investAmt = npc.wealth * 0.08   // invest 8% of surplus wealth
      npc.wealth = clamp(npc.wealth - investAmt, 0, 50000)

      const roll = Math.random()
      if (roll < 0.50) {
        // Fund research: boost research points
        const boost = investAmt * 0.5
        state.research_points = (state.research_points ?? 0) + boost
        const text = tf('engine.wealth_invest_research', { name: npc.name, amount: Math.round(investAmt) }) as string
        addFeedRaw(text, 'info', state.year, state.day)
      } else {
        // Fund infrastructure: reduce resource_scarcity slightly
        const reduction = clamp(investAmt / 100000, 0, 0.01)
        state.constitution.resource_scarcity = clamp(state.constitution.resource_scarcity - reduction, 0, 1)
        // Boost food stock modestly as improved infrastructure aids distribution
        const foodCap = Math.max(600, living.length * 60)
        state.food_stock = clamp(state.food_stock + investAmt * 0.2, 0, foodCap)
        const text = tf('engine.wealth_invest_infra', { name: npc.name, amount: Math.round(investAmt) }) as string
        addFeedRaw(text, 'info', state.year, state.day)
      }
    }

    // ── Rich & aggressive NPC: transition to gang boss ──────────────────────
    // Only targets NPCs who do not yet have a criminal record — the transition
    // itself marks the first step into organised crime (criminal_record = true).
    // This represents a previously law-abiding but ruthlessly ambitious individual
    // deciding to use their wealth to build a criminal network from scratch.
    if (
      npc.wealth >= WEALTH_GANG_THRESHOLD &&
      (npc.personality?.aggression ?? 0) > 0.68 &&
      npc.role !== 'gang' &&
      npc.role !== 'guard' &&
      npc.role !== 'leader' &&
      !npc.criminal_record &&
      state.tick % (WEALTH_INVEST_INTERVAL_TICKS * 2) === npc.id % (WEALTH_INVEST_INTERVAL_TICKS * 2) &&
      Math.random() < 0.08
    ) {
      const oldRole = npc.role
      permanentRoleChange(npc, 'gang', state)
      npc.criminal_record = true   // transitioning to gang marks their first criminal act
      const text = tf('engine.wealthy_turned_gang', { name: npc.name, old_role: oldRole }) as string
      addFeedRaw(text, 'warning', state.year, state.day)
      addChronicle(text, state.year, state.day, 'major')
    }
  }
}

// ── Property / Land Tax ───────────────────────────────────────────────────────
// Levied once per day on all living adult NPCs whose accumulated wealth exceeds
// PROPERTY_TAX_WEALTH_FLOOR. Only the taxable surplus (wealth − floor) is taxed.
//
// This models the land/property tax that was the primary revenue source for
// pre-modern states worldwide (Rome, Tang China, Ottoman, medieval Europe).
// Unlike income tax, it is stable across business cycles because it targets
// accumulated stock, not volatile flow.
//
// Rate: PROPERTY_TAX_RATE (0.05 %/day) on surplus wealth above the floor.
// At avg wealth 300, floor 100: 200 × 0.0005 = 0.10 coins/day per NPC.
// For 200 NPCs: ~20 coins/day into the treasury.

export function applyPropertyTax(state: WorldState): void {
  if (state.collapse_phase !== 'normal') return

  let poolGain = 0
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.role === 'child') continue
    const taxableWealth = npc.wealth - PROPERTY_TAX_WEALTH_FLOOR
    if (taxableWealth <= 0) continue

    const tax = taxableWealth * PROPERTY_TAX_RATE
    if (tax < 0.01) continue
    npc.wealth = clamp(npc.wealth - tax, 0, 50000)
    poolGain  += tax
  }

  if (poolGain > 0) {
    state.tax_pool = clamp((state.tax_pool ?? 0) + poolGain, 0, 9_999_999)
  }
}

// ── Recession Stabilizer: Debt Relief Program ─────────────────────────────
// Automatic stabilizer inspired by real-world debt jubilees and government
// stimulus programs. Triggered when:
//   1. GDP has declined ≥2% for 5+ consecutive days (recession detected)
//   2. Government treasury has ≥8 days of payroll reserves
//
// Mechanism: government buys distressed debt at 50 cents on the dollar,
//   • Debtors get debt cleared → can resume spending → multiplier effect
//   • Creditors receive partial compensation from treasury → no wealth destruction
//   • Treasury cost is spread across a 30%-batch of debtors per trigger
//
// Cooldown: resets _gdpDeclineDays to 0 after each program, preventing
// re-triggering until the next fresh recession.

export function applyDebtRelief(state: WorldState): void {
  if (state.collapse_phase !== 'normal') return

  // Track daily GDP trend (called once per sim-day)
  const currentGdp = state.macro?.gdp ?? 0
  if (_prevDayGdp > 0) {
    if (currentGdp < _prevDayGdp * 0.98) {
      _gdpDeclineDays++
    } else {
      _gdpDeclineDays = Math.max(0, _gdpDeclineDays - 1)
    }
  }
  _prevDayGdp = currentGdp

  // Need sustained recession (5+ days of ≥2% daily drop)
  if (_gdpDeclineDays < 5) return

  // Need fiscal reserves: estimate payroll from living govt employees
  const govtNpcs = state.npcs.filter(n => n.lifecycle.is_alive && (n.role === 'guard' || n.role === 'leader'))
  const guards   = govtNpcs.filter(n => n.role === 'guard').length
  const leaders  = govtNpcs.filter(n => n.role === 'leader').length
  const dailyPayroll = guards * GOVT_WAGE_GUARD_COINS + leaders * GOVT_WAGE_LEADER_COINS
  if (dailyPayroll <= 0 || (state.tax_pool ?? 0) < dailyPayroll * 8) return

  // Find debtors eligible for relief (alive, has debt with a living creditor)
  const debtors = state.npcs.filter(n =>
    n.lifecycle.is_alive &&
    n.debt > 0 &&
    n.debt_to !== null &&
    state.npcs[n.debt_to]?.lifecycle.is_alive,
  )
  if (debtors.length === 0) return

  // Forgive 30% of debtors per program (sorted by debt size — largest relief first)
  debtors.sort((a, b) => b.debt - a.debt)
  const batch = debtors.slice(0, Math.max(1, Math.ceil(debtors.length * 0.30)))

  let costToGovt = 0
  for (const npc of batch) {
    const creditor = state.npcs[npc.debt_to!]
    if (creditor?.lifecycle.is_alive) {
      // Government pays creditor 50 cents on the dollar — partial compensation
      const payment = npc.debt * 0.50
      creditor.wealth = clamp(creditor.wealth + payment, 0, 50_000)
      costToGovt += payment
    }
    npc.debt    = 0
    npc.debt_to = null
  }

  state.tax_pool = clamp((state.tax_pool ?? 0) - costToGovt, 0, 9_999_999)
  _gdpDeclineDays = 0  // cooldown — wait for fresh recession before re-triggering

  const msg = `🏦 Debt relief: government forgave ${batch.length} debts (treasury cost: ${Math.round(costToGovt)} coins) to counter economic contraction.`
  addFeedRaw(msg, 'info', state.year, state.day)
}
