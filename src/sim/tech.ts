// ── Technology Tree ────────────────────────────────────────────────────────
// Scholars accumulate research points each sim-day through their work output.
// When cumulative points cross a milestone threshold, a discovery is unlocked:
//   Agriculture (500 pts)  → +15% food production
//   Medicine   (1500 pts)  → −50% sickness rate
//   Commerce   (3000 pts)  → +5% merchant markup efficiency
//   Printing   (5000 pts)  → +10 literacy, faster worldview spread
//
// Discoveries are stored in WorldState.discoveries and checked inline where
// they apply — no circular imports needed.

import type { WorldState, TechDiscovery } from '../types'
import { addChronicle, addFeedRaw } from '../ui/feed'
import { computeProductivity } from './npc'

interface Milestone {
  id: string
  name: string
  threshold: number
  description: string
}

export const TECH_MILESTONES: Milestone[] = [
  {
    id: 'agriculture',
    name: 'Advanced Agriculture',
    threshold: 500,
    description: 'Scholars unlock crop rotation techniques — food production increases by 15%.',
  },
  {
    id: 'medicine',
    name: 'Folk Medicine',
    threshold: 1500,
    description: 'Healers develop herbal treatments — sickness rates drop by half.',
  },
  {
    id: 'commerce',
    name: 'Trade Networks',
    threshold: 3000,
    description: 'Merchants establish formalized trade routes — market efficiency improves.',
  },
  {
    id: 'printing',
    name: 'Printing & Record-Keeping',
    threshold: 5000,
    description: 'Scholars introduce written records — literacy and information spread accelerate.',
  },
  {
    id: 'engineering',
    name: 'Engineering & Craftsmanship',
    threshold: 9000,
    description: 'Craftsmen master structural techniques — workshops produce more with less labour.',
  },
  {
    id: 'finance',
    name: 'Banking & Finance',
    threshold: 14000,
    description: 'Merchants develop credit and capital markets — investment accelerates growth.',
  },
]

// Called once per sim-day to accumulate scholar output into the research pool.
export function accumulateResearch(state: WorldState): void {
  const scholars = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'scholar')
  if (scholars.length === 0) return
  // Each scholar contributes half their daily productivity to the research pool
  const dailyGain = scholars.reduce((s, n) => s + computeProductivity(n, state), 0) * 0.5
  state.research_points += dailyGain
}

// Called once per sim-day to check and unlock the next milestone.
export function checkDiscoveries(state: WorldState): void {
  const discovered = new Set(state.discoveries.map(d => d.id))
  for (const ms of TECH_MILESTONES) {
    if (discovered.has(ms.id)) continue   // already unlocked
    if (state.research_points < ms.threshold) break  // milestones are ordered by threshold

    // Credit the most influential living scholar
    const topScholar = state.npcs
      .filter(n => n.lifecycle.is_alive && n.role === 'scholar')
      .sort((a, b) => b.influence_score - a.influence_score)[0]

    const discovery: TechDiscovery = {
      id: ms.id,
      name: ms.name,
      discovered_tick: state.tick,
      researcher_name: topScholar?.name ?? 'an unknown scholar',
    }
    state.discoveries.push(discovery)

    // Mark the lead researcher as legendary
    if (topScholar) topScholar.legendary = true

    const text = `📚 ${ms.name} — ${ms.description} (discovered by ${discovery.researcher_name})`
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'info', state.year, state.day)
    break  // one discovery per day maximum
  }
}

// Returns active bonuses from all unlocked discoveries.
// Used in computeMacroStats and NPC tick functions (checked via state directly).
export function getDiscoveryBonuses(discoveries: TechDiscovery[]): {
  foodMult: number
  sickMult: number
  merchantBonus: number
  literacyBonus: number
} {
  const ids = new Set(discoveries.map(d => d.id))
  return {
    foodMult:      ids.has('agriculture') ? 1.15 : 1.0,
    sickMult:      ids.has('medicine')    ? 0.50 : 1.0,
    merchantBonus: ids.has('commerce')    ? 0.05 : 0.0,
    literacyBonus: ids.has('printing')    ? 10.0 : 0.0,
  }
}
