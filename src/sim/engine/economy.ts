import type { WorldState, NPC } from '../../types'
import { clamp } from '../constitution'
import { permanentRoleChange } from '../npc'
import { addFeedRaw, addChronicle } from '../../ui/feed'
import { tf } from '../../i18n'

let lastTaxSpendingDay = -1
let lastWealthMobilityDay = -1

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
  if (c.gini_start >= 0.55 && c.individual_rights_floor < 0.20) return 0.15  // feudal
  if (c.market_freedom >= 0.70 && c.state_power < 0.40) return 0.05  // libertarian
  return 0.10  // moderate
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

// Wages calibrated to match market income (~daily_income of a farmer/craftsman at avg productivity).
// farmer: 0.12 * 0.7 * 24 ≈ 2.0/day, craftsman: 0.14 * 0.7 * 24 ≈ 2.4/day
// Guard earns above farmer (dangerous work); leader earns significantly more (administrative burden + authority).
const GOVT_WAGE_GUARD  = 3.5
const GOVT_WAGE_LEADER = 6.0

export function applyGovernmentWages(state: WorldState): void {
  // No wages when government has dissolved due to population collapse
  if (state.collapse_phase !== 'normal') return
  if ((state.tax_pool ?? 0) <= 0) return

  const guards  = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard')
  const leaders = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'leader')
  const totalWageBill = guards.length * GOVT_WAGE_GUARD + leaders.length * GOVT_WAGE_LEADER

  if (totalWageBill <= 0) return

  const pool = state.tax_pool ?? 0
  const payRatio = pool >= totalWageBill ? 1.0 : pool / totalWageBill
  const poolSpent = Math.min(pool, totalWageBill)
  state.tax_pool = clamp(pool - poolSpent, 0, 9_999_999)

  for (const npc of guards) {
    const wage = GOVT_WAGE_GUARD * payRatio
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
    const wage = GOVT_WAGE_LEADER * payRatio
    npc.wealth = clamp(npc.wealth + wage, 0, 50000)
    npc.daily_income = npc.daily_income * 0.99 + wage * 0.01
    if (payRatio < 0.5) {
      npc.fear      = clamp(npc.fear + 3, 0, 100)
      npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }
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
  const spendAmount = pool * 0.10   // spend 10% of pool each day (smooth, steady disbursement)
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
      // Infrastructure: workers get cash + quality-of-life boost
      const workers = living.filter(n => n.role === 'farmer' || n.role === 'craftsman' || n.role === 'merchant')
      if (workers.length > 0) {
        const perWorker = spendAmount / workers.length
        for (const npc of workers) {
          npc.wealth     = clamp(npc.wealth + perWorker, 0, 50000)
          npc.exhaustion = clamp(npc.exhaustion - 8, 0, 100)
          npc.happiness  = clamp(npc.happiness  + 3, 0, 100)
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

const WEALTH_INVEST_THRESHOLD   = 6000   // minimum wealth to trigger investment behavior
const WEALTH_GANG_THRESHOLD     = 4000   // minimum wealth to risk becoming a gang boss
const WEALTH_INVEST_INTERVAL    = 24 * 7 // once per week per eligible NPC (staggered by id)


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
      state.tick % WEALTH_INVEST_INTERVAL === npc.id % WEALTH_INVEST_INTERVAL
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
      state.tick % (WEALTH_INVEST_INTERVAL * 2) === npc.id % (WEALTH_INVEST_INTERVAL * 2) &&
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
