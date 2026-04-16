// ── Political Factions ─────────────────────────────────────────────────────
// NPCs with aligned worldviews in the same community groups self-organize into
// political factions that push their agenda every 10 sim-days.
// Max 6 factions; each has a dominant value that drives its collective action.

import type { WorldState, Faction, ValuePriority } from '../types'
import { clamp } from './constitution'
import { addChronicle, addFeedRaw } from '../ui/feed'

let nextFactionId = 1

const FACTION_NAMES: Record<ValuePriority, string[]> = {
  security:  ['Iron Order', 'Shield Compact', 'Aegis League', 'Stalwart Alliance', 'Guardian Front',
              'Bulwark Society', 'Citadel Pact', 'Vanguard Order', 'Ironclad Council', 'Sentinel Union'],
  equality:  ["People's Front", 'Equal Rights Circle', 'Common Cause', 'Fair Share Movement', 'Solidarity Bloc',
              'Commons Alliance', 'Balanced Scale Union', 'Equity Assembly', 'United Voices', "Levelers' League"],
  freedom:   ['Liberty Society', 'Free Thought Collective', 'Open Roads Guild', 'Autonomy League', 'Dissent Circle',
              'Free Minds Compact', 'Unbounded Guild', 'Open Horizon Society', 'Sovereign Path League', 'Unchained Assembly'],
  growth:    ['Progress Union', "Builder's Compact", 'Frontier Alliance', 'Growth Coalition', 'Venture Guild',
              'Rising Tide Compact', 'Prosperity Council', 'Harvest League', 'Bold Horizon Society', 'Innovation Front'],
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
        conflict_score: 0,
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

// ── Inter-Faction Conflict ──────────────────────────────────────────────────
// Run after faction politics. Opposing factions escalate conflict when both are strong.
// Opposition pairs: security ↔ freedom, equality ↔ growth

export function checkFactionConflict(state: WorldState): void {
  if (state.civil_war_phase === 'resolved') return
  if (state.civil_war_phase === 'escalating' || state.civil_war_phase === 'active') {
    // Civil war tick: members attack opponents, unrest spreads
    tickCivilWar(state)
    return
  }

  const OPPONENT: Record<ValuePriority, ValuePriority> = {
    security: 'freedom',
    freedom: 'security',
    equality: 'growth',
    growth: 'equality',
  }

  for (const faction of state.factions) {
    const opponentValue = OPPONENT[faction.dominant_value]
    const rival = state.factions.find(f =>
      f.id !== faction.id && f.dominant_value === opponentValue && f.member_ids.length >= 5
    )
    if (!rival) continue

    faction.rival_faction_id = rival.id
    rival.rival_faction_id = faction.id

    // Only escalate if both factions are strong (power > 8)
    if (faction.power < 8 || rival.power < 8) continue

    // Escalate conflict score
    const escalationRate = Math.min(faction.power, rival.power) * 0.1
    faction.conflict_score = Math.min(faction.conflict_score + escalationRate, 100)
    rival.conflict_score = Math.min(rival.conflict_score + escalationRate, 100)

    // Trigger warning at 50
    if (faction.conflict_score >= 50 && faction.conflict_score - escalationRate < 50) {
      addChronicle(
        `Tensions between "${faction.name}" and "${rival.name}" are reaching a breaking point. Violence could erupt at any time.`,
        state.year, state.day, 'major'
      )
      addFeedRaw(`⚠️ Faction conflict escalating: "${faction.name}" vs "${rival.name}"`, 'warning', state.year, state.day)
    }

    // Trigger civil war at 100
    if (faction.conflict_score >= 100) {
      startCivilWar(state, faction, rival)
      return
    }

    // Skirmishes: opposing members sometimes confront each other
    if (Math.random() < 0.15) {
      const aggressor = state.npcs[faction.member_ids[Math.floor(Math.random() * faction.member_ids.length)]]
      const target = state.npcs[rival.member_ids[Math.floor(Math.random() * rival.member_ids.length)]]
      if (aggressor?.lifecycle.is_alive && target?.lifecycle.is_alive) {
        aggressor.action_state = 'confront'
        target.stress = Math.min(target.stress + 15, 100)
        target.fear = Math.min(target.fear + 10, 100)
        addFeedRaw(
          `Skirmish: ${aggressor.name} (${faction.name}) confronts ${target.name} (${rival.name}) in ${aggressor.zone}.`,
          'warning', state.year, state.day
        )
      }
    }
  }
}

function startCivilWar(state: WorldState, factionA: Faction, factionB: Faction): void {
  if (state.civil_war_phase === 'escalating' || state.civil_war_phase === 'active' || state.civil_war_phase === 'resolved') {
    return
  }
  state.civil_war_phase = 'escalating'
  state.civil_war_start_day = state.day

  // Force both factions into opposing mobilization
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  for (const npc of living) {
    if (factionA.member_ids.includes(npc.id)) {
      npc.action_state = 'organizing'
      npc.grievance = Math.min(npc.grievance + 30, 100)
    } else if (factionB.member_ids.includes(npc.id)) {
      npc.action_state = 'organizing'
      npc.grievance = Math.min(npc.grievance + 30, 100)
    }
  }

  // After 3 days of escalation, transition to active
  // (actual 'active' transition happens in tickCivilWar on day +3)

  addChronicle(
    `⚔️ CIVIL WAR BREAKS OUT — "${factionA.name}" and "${factionB.name}" take up arms. The city is divided.`,
    state.year, state.day, 'critical'
  )
  addFeedRaw(`⚔️ CIVIL WAR: "${factionA.name}" vs "${factionB.name}"`, 'warning', state.year, state.day)
}

function tickCivilWar(state: WorldState): void {
  // Transition escalating → active after 3 days
  if (state.civil_war_phase === 'escalating') {
    if (state.day - (state.civil_war_start_day ?? state.day) >= 3) {
      state.civil_war_phase = 'active'
    }
    return
  }

  // Active civil war: daily casualties, food drain, trust collapse
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // 1% daily casualty rate among faction members
  for (const faction of state.factions) {
    if (!faction.rival_faction_id) continue
    const members = faction.member_ids
      .map(id => state.npcs[id])
      .filter((n): n is typeof state.npcs[0] => !!n && n.lifecycle.is_alive)

    const casualties = Math.floor(members.length * 0.01)
    for (let i = 0; i < casualties; i++) {
      const victim = members[Math.floor(Math.random() * members.length)]
      if (victim) {
        victim.lifecycle.is_alive = false
        victim.lifecycle.death_cause = 'violence'
        victim.lifecycle.death_tick = state.tick
      }
    }
  }

  // Macro effects: food drain, trust collapse
  state.food_stock = Math.max(state.food_stock - living.length * 0.5, 0)
  for (const inst of state.institutions) {
    inst.legitimacy = Math.max(inst.legitimacy - 0.002, 0)
  }

  // Resolution: civil war ends when one faction is eliminated or both < 3 members
  const activeFactions = state.factions.filter(f => f.rival_faction_id !== undefined)
  const allWeak = activeFactions.every(f =>
    f.member_ids.filter(id => state.npcs[id]?.lifecycle.is_alive).length < 3
  )
  if (allWeak || activeFactions.length < 2) {
    state.civil_war_phase = 'resolved'
    addChronicle(
      `The civil war has ended, leaving a fractured society in its wake. Survivors begin to rebuild.`,
      state.year, state.day, 'critical'
    )
    addFeedRaw('🕊️ Civil war resolved. Rebuilding begins.', 'warning', state.year, state.day)
    // Reset conflict scores
    for (const faction of state.factions) {
      faction.conflict_score = 0
      faction.rival_faction_id = undefined
    }
  }
}
