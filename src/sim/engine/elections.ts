import type { WorldState, NPC } from '../../types'
import { addFeedRaw, addChronicle } from '../../ui/feed'
import { tf } from '../../i18n'

// ── Human-Driven Elections ────────────────────────────────────────────────────
// NPCs vote for candidates based on worldview alignment, faction, and network.
// Winner becomes state.leader_id and drives the government AI prompt.

export function runElection(state: WorldState): NPC | null {
  const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
  if (living.length < 5) return null

  // Candidate pool: top NPCs by influence + bridge centrality (up to 4 candidates)
  const sorted = [...living].sort(
    (a, b) => (b.influence_score + b.bridge_score * 0.5) - (a.influence_score + a.bridge_score * 0.5),
  )
  const poolSize = Math.max(2, Math.ceil(living.length * 0.03))
  const candidates = sorted.slice(0, Math.min(poolSize, 4))

  // Vote tallying — each NPC votes for the candidate that best aligns with their interests
  const votes: Record<number, number> = {}
  for (const c of candidates) votes[c.id] = 0

  for (const voter of living) {
    let bestId   = candidates[0].id
    let bestScore = -Infinity
    for (const c of candidates) {
      const wvSim = 1 - (
        Math.abs(voter.worldview.collectivism - c.worldview.collectivism) +
        Math.abs(voter.worldview.authority_trust - c.worldview.authority_trust)
      ) / 2
      const factionBonus   = voter.faction_id != null && voter.faction_id === c.faction_id ? 0.30 : 0
      const networkBonus   = voter.strong_ties.includes(c.id) ? 0.40
                           : voter.weak_ties.includes(c.id)   ? 0.10 : 0
      // Grieved voters prefer lower-wealth (anti-establishment) candidates
      const antiEstab      = voter.grievance > 55 ? Math.max(0, 1 - c.wealth / 5000) * 0.20 : 0
      const score = wvSim + factionBonus + networkBonus + antiEstab
      if (score > bestScore) { bestScore = score; bestId = c.id }
    }
    votes[bestId] = (votes[bestId] ?? 0) + 1
  }

  // Find winner
  let winner = candidates[0]
  for (const c of candidates) {
    if ((votes[c.id] ?? 0) > (votes[winner.id] ?? 0)) winner = c
  }

  const prevLeader = state.leader_id != null ? state.npcs[state.leader_id] : null
  state.leader_id        = winner.id
  state.last_election_day = state.day

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const winPct     = Math.round((votes[winner.id] / Math.max(totalVotes, 1)) * 100)

  const msg = prevLeader && prevLeader.id !== winner.id
    ? tf('election.new_leader', { name: winner.name, occ: winner.occupation, pct: winPct, prev: prevLeader.name })
    : tf('election.first_leader', { name: winner.name, occ: winner.occupation, pct: winPct })
  addChronicle(msg, state.year, state.day, 'major')
  addFeedRaw(msg, 'info', state.year, state.day)

  state.stats.elections_held++

  return winner
}

// ── Run statistics updater (called daily) ──────────────────────────────────

export function updateRunStats(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive).length
  if (living < state.stats.min_population) state.stats.min_population = living
  if (living > state.stats.max_population) state.stats.max_population = living

  // Tally deaths by cause (reset-proof: recount from npcs array each day is O(n) but simple)
  let natural = 0, violent = 0, fled = 0
  for (const n of state.npcs) {
    if (n.lifecycle.is_alive) continue
    const cause = n.lifecycle.death_cause
    if (cause === 'natural' || cause === 'starvation' || cause === 'disease' || cause === 'accident') natural++
    else if (cause === 'violence') violent++
    else if (cause === 'fled') fled++
  }
  state.stats.deaths_natural = natural
  state.stats.deaths_violent = violent
  state.stats.fled_total = fled
}
