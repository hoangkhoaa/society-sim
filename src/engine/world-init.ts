import type { WorldState, Constitution, NPC } from '../types'
import { createNPC } from '../sim/npc'
import { buildNetwork } from '../sim/network'
import { initInstitutions, clamp } from '../sim/constitution'
import { computeMacroStats } from './macro'
import { INFLUENCE_REFERENCE_DEGREE } from './network-dynamics'
import {
  GOVT_WAGE_GUARD_COINS,
  GOVT_WAGE_LEADER_COINS,
  GOVT_WAGE_INITIAL_TREASURY_PAYROLL_DAYS,
} from '../constants/economy-tuning'

// ── World Initialization ────────────────────────────────────────────────────

export const MIN_NPC_COUNT = 500
/** Default starting population when onboarding / initWorld omit an explicit count. */
export const DEFAULT_NPC_COUNT = 1000

export async function initWorld(constitution: Constitution, npcCount: number = DEFAULT_NPC_COUNT): Promise<WorldState> {
  const population = Math.max(MIN_NPC_COUNT, Math.round(npcCount))
  const npcs: NPC[] = []
  for (let i = 0; i < population; i++) {
    npcs.push(createNPC(i, population, constitution))
    // Yield to the browser event loop every 50 NPCs to keep the UI responsive
    if (i % 50 === 49) await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  // buildNetwork is async — it yields internally so the UI stays responsive
  const { strong, weak, info, clusters } = await buildNetwork(npcs, constitution)

  // Write ties back onto NPCs
  for (const [id, ties] of strong) {
    if (npcs[id]) npcs[id].strong_ties = [...ties]
  }
  for (const [id, ties] of weak) {
    if (npcs[id]) npcs[id].weak_ties = [...ties]
  }
  for (const [id, ties] of info) {
    if (npcs[id]) npcs[id].info_ties = [...ties]
  }

  // Influence score: use the same formula as the daily computeBridgeScores() so
  // scores are consistent from tick 0 onward (no discontinuity on first daily update).
  // bridge_score = fraction of distinct zone-clusters spanned by an NPC's info_ties.
  const totalClusters = Math.max(new Set([...clusters.values()]).size, 1)
  for (const npc of npcs) {
    const spannedClusters = new Set<number>()
    for (const tid of npc.info_ties) {
      const cluster = clusters.get(tid)
      if (cluster !== undefined) spannedClusters.add(cluster)
    }
    npc.bridge_score = spannedClusters.size / totalClusters
    const strongCentrality = npc.strong_ties.length / INFLUENCE_REFERENCE_DEGREE
    npc.influence_score = clamp(strongCentrality * 0.6 + npc.bridge_score * 0.4, 0, 1)
  }

  const institutions = initInstitutions(constitution)

  // Natural resource pool: starts at 100k × (1 - scarcity)
  const naturalResourcesInit = clamp(100000 * (1 - constitution.resource_scarcity), 10000, 100000)
  const guardsInit = npcs.filter(n => n.role === 'guard').length
  const leadersInit = npcs.filter(n => n.role === 'leader').length
  const dailyPayrollInit = guardsInit * GOVT_WAGE_GUARD_COINS + leadersInit * GOVT_WAGE_LEADER_COINS
  const initialTaxPool = Math.round(dailyPayrollInit * GOVT_WAGE_INITIAL_TREASURY_PAYROLL_DAYS)
  const initialPrivateMoney = npcs.reduce((sum, npc) => sum + npc.wealth, 0)
  const initialMoneySupply = Math.round(initialPrivateMoney + initialTaxPool)

  // computeMacroStats calls computeProductivity, which reads state.macro.natural_resources
  const macroStub = {
    food: 50,
    stability: 50,
    trust: 50,
    gini: constitution.gini_start,
    political_pressure: 0,
    natural_resources: clamp(naturalResourcesInit / 1000, 0, 100),
    energy: 50,
    literacy: 50,
    labor_unrest: 0,
    polarization: 15,
    gdp: 0,
    extraction_rate: 50,
    economic_efficiency: 50,
  }
  const macro = computeMacroStats({
    tick: 0,
    day: 1,
    year: 1,
    constitution,
    npcs,
    institutions,
    active_events: [],
    food_stock: population * 30,
    natural_resources: naturalResourcesInit,
    macro: macroStub,
    narrative_log: [],
    drift_score: 0,
    crisis_pending: false,
    tax_pool: initialTaxPool,
    money_supply: initialMoneySupply,
    inflation_rate: 0,
    trade_exports_last_day: 0,
    trade_imports_last_day: 0,
    trade_balance_last_day: 0,
    trade_revenue_last_day: 0,
    money_printed_last_day: 0,
    tax_pool_critical_days: 0,
    total_taxes_collected: 0,
    total_money_printed: 0,
    total_trade_revenue: 0,
    total_exports: 0,
    total_imports: 0,
    peak_gdp: 0,
  } as unknown as WorldState)

  return {
    tick: 0,
    day: 1,
    year: 1,
    constitution,
    npcs,
    institutions,
    active_events: [],
    network: { strong, weak, info, clusters },
    macro,
    food_stock: population * 30,
    natural_resources: naturalResourcesInit,
    narrative_log: [],
    drift_score: 0,
    crisis_pending: false,
    factions: [],
    syndicates: [],
    research_points: 0,
    discoveries: [],
    referendum: null,
    quarantine_zones: [],
    rumors: [],
    milestones: [],
    breakthrough_log: [],
    births_total: 0,
    immigration_total: 0,
    active_strikes: [],
    tax_pool: initialTaxPool,
    money_supply: initialMoneySupply,
    inflation_rate: 0,
    trade_exports_last_day: 0,
    trade_imports_last_day: 0,
    trade_balance_last_day: 0,
    trade_revenue_last_day: 0,
    money_printed_last_day: 0,
    tax_pool_critical_days: 0,
    total_taxes_collected: 0,
    total_money_printed: 0,
    total_trade_revenue: 0,
    total_exports: 0,
    total_imports: 0,
    peak_gdp: 0,
    leader_id: null,
    last_election_day: -1,
    collapse_phase: 'normal',
    initial_population: population,
    public_health: {
      sanitation: 30,
      hospital_capacity: 0,
      disease_resistance: 0.30,
      funded_tick: 0,
    },
    stats: {
      god_calls: 0,
      intervention_count: 0,
      policy_count: 0,
      min_population: population,
      max_population: population,
      fled_total: 0,
      deaths_natural: 0,
      deaths_violent: 0,
      elections_held: 0,
      npc_chats: 0,
      npc_edits: 0,
      achieved_days: [],
    },
  }
}
