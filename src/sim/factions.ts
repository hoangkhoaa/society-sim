// ── Political Factions ─────────────────────────────────────────────────────
// NPCs with aligned worldviews in the same community groups self-organize into
// political factions that push their agenda every 10 sim-days.
// Max 6 factions; each has a dominant value that drives its collective action.

import type { WorldState, Faction, ValuePriority } from '../types'
import { clamp } from './constitution'
import { addChronicle, addFeedRaw } from '../ui/feed'

let nextFactionId = 1

const FACTION_NAMES: Record<ValuePriority, string[]> = {
  security:  ['Iron Order', 'Shield Compact', 'Aegis League', 'Stalwart Alliance', 'Guardian Front'],
  equality:  ["People's Front", 'Equal Rights Circle', 'Common Cause', 'Fair Share Movement', 'Solidarity Bloc'],
  freedom:   ['Liberty Society', 'Free Thought Collective', 'Open Roads Guild', 'Autonomy League', 'Dissent Circle'],
  growth:    ['Progress Union', "Builder's Compact", 'Frontier Alliance', 'Growth Coalition', 'Venture Guild'],
}

// Infer dominant value from worldview dimensions
function dominantValue(collectivism: number, authority_trust: number, risk_tolerance: number): ValuePriority {
  if (collectivism > 0.65 && authority_trust > 0.60) return 'security'
  if (collectivism > 0.60 && authority_trust <= 0.60) return 'equality'
  if (collectivism <= 0.45 && risk_tolerance > 0.55)  return 'freedom'
  return 'growth'
}

export function checkFactions(state: WorldState): void {
  // ── Formation ─────────────────────────────────────────────────────────────
  // Only attempt on ~5% of days; community groups with 4+ aligned members form factions.
  if (Math.random() > 0.05) {
    // Still run politics & dissolution below even when skipping formation
  } else if (state.factions.length < 6) {
    const byGroup = new Map<number, typeof state.npcs>()
    for (const npc of state.npcs) {
      if (!npc.lifecycle.is_alive || npc.community_group === null || npc.faction_id !== null) continue
      const g = npc.community_group
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g)!.push(npc)
    }

    for (const [, members] of byGroup) {
      if (members.length < 4) continue
      if (state.factions.length >= 6) break

      // Require 65%+ worldview alignment around a dominant value
      const dominant = dominantValue(
        members.reduce((s, n) => s + n.worldview.collectivism,    0) / members.length,
        members.reduce((s, n) => s + n.worldview.authority_trust, 0) / members.length,
        members.reduce((s, n) => s + n.worldview.risk_tolerance,  0) / members.length,
      )
      const aligned = members.filter(n =>
        dominantValue(n.worldview.collectivism, n.worldview.authority_trust, n.worldview.risk_tolerance) === dominant,
      )
      if (aligned.length / members.length < 0.65) continue

      const fid   = nextFactionId++
      const usedNames = new Set(state.factions.map(f => f.name))
      const name  = FACTION_NAMES[dominant].find(n => !usedNames.has(n)) ?? `${dominant} faction ${fid}`

      const faction: Faction = {
        id: fid,
        name,
        dominant_value: dominant,
        member_ids: aligned.map(n => n.id),
        power: aligned.reduce((s, n) => s + n.influence_score, 0),
        founded_tick: state.tick,
        last_action_tick: state.tick,
      }
      state.factions.push(faction)
      for (const npc of aligned) npc.faction_id = fid

      const text = `New faction: "${name}" — ${aligned.length} members united around ${dominant} values.`
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'political', state.year, state.day)
    }
  }

  // ── Faction politics (every 10 days per faction) ──────────────────────────
  for (const faction of state.factions) {
    if (state.tick - faction.last_action_tick < 240) continue

    const members = faction.member_ids
      .map(id => state.npcs[id])
      .filter((n): n is typeof state.npcs[0] => !!n && n.lifecycle.is_alive)

    if (members.length === 0) continue
    faction.last_action_tick = state.tick
    faction.power = members.reduce((s, n) => s + n.influence_score, 0)

    switch (faction.dominant_value) {
      case 'security':
        // Rally: strengthen compliance and reduce fear among members
        for (const m of members) {
          m.trust_in.guard.intention = clamp(m.trust_in.guard.intention + 0.05, 0, 1)
          m.fear = clamp(m.fear - 8, 0, 100)
          m.stress = clamp(m.stress - 5, 0, 100)
        }
        addChronicle(`"${faction.name}" rallied members for order and security.`, state.year, state.day, 'minor')
        break

      case 'equality':
        // Internal solidarity: levy on the wealthiest member, share to the poorest
        members.sort((a, b) => b.wealth - a.wealth)
        if (members.length > 1 && members[0].wealth > 300) {
          const levy = members[0].wealth * 0.06
          members[0].wealth -= levy
          const share = levy / (members.length - 1)
          for (const m of members.slice(1)) m.wealth = clamp(m.wealth + share, 0, 50000)
        }
        // All members get grievance relief from collective action
        for (const m of members) m.grievance = clamp(m.grievance - 6, 0, 100)
        addChronicle(`"${faction.name}" organized internal redistribution.`, state.year, state.day, 'minor')
        break

      case 'freedom':
        // Public demonstration: push members toward organizing, lower dissonance threshold
        for (const m of members) {
          m.dissonance_acc = clamp(m.dissonance_acc + 10, 0, 100)
          if ((m.action_state === 'working' || m.action_state === 'socializing') && Math.random() < 0.35) {
            m.action_state = 'organizing'
          }
          m.trust_in.government.intention = clamp(m.trust_in.government.intention - 0.02, 0, 1)
        }
        addChronicle(`"${faction.name}" staged a public demonstration for autonomy.`, state.year, state.day, 'minor')
        break

      case 'growth': {
        // Investment drive: scholars and merchants get a morale boost
        const productive = members.filter(m => m.role === 'scholar' || m.role === 'merchant' || m.role === 'craftsman')
        for (const m of productive) {
          m.happiness  = clamp(m.happiness  + 12, 0, 100)
          m.exhaustion = clamp(m.exhaustion - 12, 0, 100)
        }
        // Trade Guild special: if 40%+ merchants, inject food_stock bonus
        const merchantFrac = members.filter(m => m.role === 'merchant').length / Math.max(members.length, 1)
        if (merchantFrac >= 0.40) {
          state.food_stock = clamp(state.food_stock + members.length * 3, 0, 999999)
          addChronicle(`"${faction.name}" (Trade Guild) sourced extra supplies — food stocks boosted.`, state.year, state.day, 'minor')
        } else {
          addChronicle(`"${faction.name}" launched a productivity drive.`, state.year, state.day, 'minor')
        }
        break
      }
    }
  }

  // ── Dissolution ───────────────────────────────────────────────────────────
  state.factions = state.factions.filter(f => {
    const aliveCount = f.member_ids.filter(id => state.npcs[id]?.lifecycle.is_alive).length
    if (aliveCount < 2) {
      for (const id of f.member_ids) {
        if (state.npcs[id]) state.npcs[id].faction_id = null
      }
      addChronicle(`Faction "${f.name}" has dissolved.`, state.year, state.day, 'minor')
      return false
    }
    f.member_ids = f.member_ids.filter(id => state.npcs[id]?.lifecycle.is_alive)
    return true
  })
}
