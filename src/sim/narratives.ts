// ── Rich Narrative Events ──────────────────────────────────────────────────
// Fires 0–2 vivid chronicle stories per sim-day drawn from real simulation data.
// Each story type has: a cooldown, a condition check, and a text generator.
// This makes the Chronicle feel like a living newspaper rather than a system log.
//
// Also manages the rumor system: daily gossip spreads through info_ties and
// nudges NPC trust/worldview over time.

import type { WorldState, Rumor } from '../types'
import { clamp, getSeason } from './constitution'
import { addChronicle, addFeedRaw } from '../ui/feed'
import { getLang } from '../i18n'
import { NT } from '../local/narratives'
import { showStoryCard } from '../ui/story-card'
import { getRegimeProfile } from './regime-config'

// ── Cooldown tracking ────────────────────────────────────────────────────────

const _cooldowns = new Map<string, number>()

function cooldown(id: string, minTicks: number, tick: number): boolean {
  return tick - (_cooldowns.get(id) ?? -99999) < minTicks
}

function stamp(id: string, tick: number) { _cooldowns.set(id, tick) }

// ── Story pool ────────────────────────────────────────────────────────────────

interface Story {
  id: string
  minTicks: number          // minimum ticks between repeats
  severity: 'minor' | 'major' | 'critical'
  feedSeverity?: 'info' | 'warning' | 'political'
  check: (state: WorldState) => string | null  // returns text or null if conditions not met
}

const STORIES: Story[] = [

  // ── Human drama ─────────────────────────────────────────────────────────

  {
    id: 'rags_to_riches',
    minTicks: 480,
    severity: 'major',
    check(state) {
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.wealth > 500
        && n.memory.some(m => (m.type === 'windfall' || m.type === 'helped') && m.emotional_weight > 15
          && state.tick - m.tick < 240),
      )
      if (!candidate) return null
      return NT.ragsToRiches(getLang(), candidate.name, candidate.occupation)
    },
  },

  {
    id: 'fall_from_grace',
    minTicks: 480,
    severity: 'major',
    check(state) {
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.wealth < 80 && n.daily_income < -0.05
        && n.memory.some(m => m.type === 'loss' && m.emotional_weight < -30 && state.tick - m.tick < 360),
      )
      if (!candidate) return null
      return NT.fallFromGrace(getLang(), candidate.name, candidate.occupation)
    },
  },

  {
    id: 'widow_tragedy',
    minTicks: 360,
    severity: 'major',
    check(state) {
      const candidate = state.npcs.find(n => {
        if (!n.lifecycle.is_alive) return false
        if (n.lifecycle.spouse_id === null) return false
        const ex = state.npcs[n.lifecycle.spouse_id]
        return ex && !ex.lifecycle.is_alive && ex.lifecycle.death_tick !== null
          && state.tick - ex.lifecycle.death_tick < 168
          && n.lifecycle.children_ids.some(id => state.npcs[id]?.lifecycle.is_alive)
      })
      if (!candidate) return null
      const childCount = candidate.lifecycle.children_ids.filter(id => state.npcs[id]?.lifecycle.is_alive).length
      return NT.widowTragedy(getLang(), candidate.name, childCount)
    },
  },

  {
    id: 'scholar_debate',
    minTicks: 288,
    severity: 'minor',
    check(state) {
      const scholars = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'scholar')
      for (const a of scholars) {
        const b = scholars.find(s =>
          s.id !== a.id && s.zone === a.zone
          && Math.abs(s.worldview.authority_trust - a.worldview.authority_trust) > 0.50,
        )
        if (b) {
          const topic = a.worldview.authority_trust > b.worldview.authority_trust
            ? 'the necessity of authority'
            : 'the limits of state power'
          return NT.scholarDebate(getLang(), a.name, b.name, a.zone, topic)
        }
      }
      return null
    },
  },

  {
    id: 'forbidden_friendship',
    minTicks: 720,
    severity: 'minor',
    check(state) {
      const guards = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard')
      for (const guard of guards) {
        const criminal = guard.strong_ties
          .map(id => state.npcs[id])
          .find(n => n?.lifecycle.is_alive && n.criminal_record)
        if (criminal) {
          return NT.forbiddenFriendship(getLang(), guard.name, criminal.name, criminal.occupation)
        }
      }
      return null
    },
  },

  {
    id: 'lone_elder',
    minTicks: 1440,
    severity: 'major',
    check(state) {
      const elders = state.npcs.filter(n => n.lifecycle.is_alive && n.age >= 72)
      if (elders.length !== 1) return null
      const e = elders[0]
      return NT.loneElder(getLang(), e.name, e.age)
    },
  },

  {
    id: 'crisis_hero',
    minTicks: 240,
    severity: 'major',
    feedSeverity: 'info',
    check(state) {
      const hasEvent = state.active_events.some(e =>
        ['epidemic', 'external_threat', 'flood', 'earthquake', 'tsunami'].includes(e.type),
      )
      if (!hasEvent) return null
      const hero = state.npcs.find(n =>
        n.lifecycle.is_alive && n.action_state === 'confront'
        && n.fear < 25 && n.influence_score > 0.45,
      )
      if (!hero) return null
      return NT.crisisHero(getLang(), hero.name, hero.occupation)
    },
  },

  {
    id: 'silent_conversion',
    minTicks: 480,
    severity: 'minor',
    check(state) {
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.dissonance_acc > 88 && n.susceptible,
      )
      if (!candidate) return null
      const shift = candidate.worldview.collectivism > 0.65 ? 'individualism' : 'collective solidarity'
      return NT.silentConversion(getLang(), candidate.name, shift)
    },
  },

  {
    id: 'midnight_laborer',
    minTicks: 360,
    severity: 'minor',
    check(state) {
      const hour = state.tick % 24
      if (hour < 22 && hour > 5) return null  // only at night
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.exhaustion > 87 && n.action_state === 'working',
      )
      if (!candidate) return null
      return NT.midnightLaborer(getLang(), candidate.name)
    },
  },

  {
    id: 'reformed_criminal',
    minTicks: 720,
    severity: 'major',
    check(state) {
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.criminal_record && n.grievance < 18 && n.happiness > 58 && n.age > 35,
      )
      if (!candidate) return null
      return NT.reformedCriminal(getLang(), candidate.name)
    },
  },

  {
    id: 'the_forgotten',
    minTicks: 480,
    severity: 'minor',
    check(state) {
      const candidate = state.npcs.find(n =>
        n.lifecycle.is_alive && n.strong_ties.length === 0 && n.age > 30 && n.isolation > 75,
      )
      if (!candidate) return null
      return NT.forgotten(getLang(), candidate.name, candidate.occupation, candidate.age, candidate.zone)
    },
  },

  {
    id: 'merchant_empire',
    minTicks: 720,
    severity: 'major',
    feedSeverity: 'info',
    check(state) {
      const merchants = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'merchant')
      if (merchants.length === 0) return null
      const richest = merchants.reduce((a, b) => a.wealth > b.wealth ? a : b)
      if (richest.wealth < 2500) return null
      return NT.merchantEmpire(getLang(), richest.name, richest.wealth, richest.zone)
    },
  },

  {
    id: 'mass_exodus',
    minTicks: 168,
    severity: 'critical',
    feedSeverity: 'warning',
    check(state) {
      const zoneCount: Record<string, number> = {}
      for (const n of state.npcs) {
        if (n.lifecycle.is_alive && n.action_state === 'fleeing') {
          zoneCount[n.zone] = (zoneCount[n.zone] ?? 0) + 1
        }
      }
      const [zone, count] = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0] ?? []
      if (!zone || count < 12) return null
      return NT.massExodus(getLang(), zone, count)
    },
  },

  {
    id: 'good_times',
    minTicks: 960,
    severity: 'minor',
    check(state) {
      if (state.macro.stability < 75 || state.macro.food < 68) return null
      if (getSeason(state.day) !== 'summer') return null
      const zone = ['market_square', 'plaza'][Math.floor(Math.random() * 2)]
      return NT.goodTimes(getLang(), zone)
    },
  },

  {
    id: 'faction_power',
    minTicks: 480,
    severity: 'major',
    feedSeverity: 'political',
    check(state) {
      const large = state.factions.find(f => f.member_ids.length >= 15)
      if (!large) return null
      return NT.factionPower(getLang(), large.name, large.member_ids.length, large.dominant_value)
    },
  },

  {
    id: 'veteran_guard',
    minTicks: 1440,
    severity: 'minor',
    check(state) {
      const vets = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'guard' && n.age >= 52)
      if (vets.length === 0) return null
      const v = vets[0]
      return NT.veteranGuard(getLang(), v.name, v.age, v.zone)
    },
  },

  {
    id: 'tech_anticipation',
    minTicks: 720,
    severity: 'minor',
    check(state) {
      const pct = Math.round(state.research_points / 500 * 100)
      if (pct < 60 || pct > 90 || state.discoveries.length > 0) return null
      const topScholar = state.npcs
        .filter(n => n.lifecycle.is_alive && n.role === 'scholar')
        .sort((a, b) => b.influence_score - a.influence_score)[0]
      if (!topScholar) return null
      return NT.techAnticipation(getLang(), topScholar.name)
    },
  },

  {
    id: 'legendary_alive',
    minTicks: 1440,
    severity: 'major',
    check(state) {
      const legends = state.npcs.filter(n => n.lifecycle.is_alive && n.legendary)
      if (legends.length === 0) return null
      const l = legends[Math.floor(Math.random() * legends.length)]
      const reason = NT.legendaryReason(getLang(), l)
      return NT.legendaryAlive(getLang(), l.name, l.occupation, l.age, reason)
    },
  },

]

// ── Main export ───────────────────────────────────────────────────────────────

export function checkNarrativeEvents(state: WorldState): void {
  // Shuffle stories so we don't always check the same ones first
  const shuffled = [...STORIES].sort(() => Math.random() - 0.5)

  let fired = 0
  for (const story of shuffled) {
    if (fired >= 2) break                            // max 2 narrative events per day
    if (cooldown(story.id, story.minTicks, state.tick)) continue

    const text = story.check(state)
    if (!text) continue

    stamp(story.id, state.tick)
    fired++

    addChronicle(text, state.year, state.day, story.severity)
    if (story.feedSeverity) {
      addFeedRaw(text, story.feedSeverity, state.year, state.day)
    }
    // Show cinematic story card for major/critical events
    showStoryCard(text, story.severity === 'critical' ? '⚡' : '📜', story.severity)
  }
}

// ── Rumor System ──────────────────────────────────────────────────────────────
// Rumors are generated based on current societal conditions and spread virally
// through info_ties, gradually shifting NPC trust and worldview over 15 days.

const RUMOR_TEMPLATES: Array<{
  condition: (state: WorldState) => boolean
  generate: (state: WorldState) => Pick<Rumor, 'content' | 'subject' | 'effect'>
}> = [
  {
    condition: _s => _s.macro.trust < 30,
    generate: _s => ({
      content: NT.rumor.govCorruption(getLang(), ['market_square', 'plaza', 'residential_east'][Math.floor(Math.random() * 3)]),
      subject: 'government',
      effect: 'trust_down',
    }),
  },
  {
    condition: s => s.npcs.some(n => n.lifecycle.is_alive && n.legendary),
    generate: s => {
      const legend = s.npcs.find(n => n.lifecycle.is_alive && n.legendary)!
      return {
        content: NT.rumor.legendTale(getLang(), legend.name),
        subject: legend.id,
        effect: 'trust_up',
      }
    },
  },
  {
    condition: s => s.macro.food < 35,
    generate: () => ({
      content: NT.rumor.hiddenFamine(getLang()),
      subject: 'government',
      effect: 'fear_up',
    }),
  },
  {
    condition: s => s.macro.gini > 0.55,
    generate: () => ({
      content: NT.rumor.richHoarding(getLang()),
      subject: 'market',
      effect: 'grievance_up',
    }),
  },
  {
    condition: s => s.active_events.some(e => e.type === 'epidemic'),
    generate: () => ({
      content: NT.rumor.epidemicHidden(getLang()),
      subject: 'guard',
      effect: 'fear_up',
    }),
  },
  {
    condition: s => s.constitution.market_freedom < 0.25
      && s.npcs.filter(n => n.lifecycle.is_alive && n.criminal_record).length > 10,
    generate: () => ({
      content: NT.rumor.blackMarket(getLang()),
      subject: 'community',
      effect: 'trust_up',
    }),
  },
  {
    condition: s => s.factions.length >= 2,
    generate: s => {
      const f = s.factions[Math.floor(Math.random() * s.factions.length)]
      return {
        content: NT.rumor.factionPlot(getLang(), f.name),
        subject: 'community',
        effect: 'fear_up',
      }
    },
  },
]

let lastRumorTick = -9999

export function resetNarrativeRuntimeState(): void {
  lastRumorTick = -9999
  _milestonesFired.clear()
}

export function checkRumors(state: WorldState): void {
  const restrictions = getRegimeProfile(state.constitution).simRestrictions

  // Generate new rumor (15% daily chance, one at a time)
  if (state.tick - lastRumorTick > 72 && Math.random() < 0.15) {
    const valid = RUMOR_TEMPLATES.filter(t => t.condition(state))
    if (valid.length > 0 && state.rumors.length < 5) {
      // State censorship: suppress rumor before it can spread
      if (Math.random() < restrictions.censorship_prob) {
        lastRumorTick = state.tick  // reset cooldown so censored rumors still burn the slot
        return
      }
      const template = valid[Math.floor(Math.random() * valid.length)]
      const partial   = template.generate(state)
      const rumor: Rumor = {
        id: crypto.randomUUID(),
        ...partial,
        reach: 0,
        born_tick: state.tick,
        expires_tick: state.tick + 360,  // 15-day lifespan
      }
      state.rumors.push(rumor)
      lastRumorTick = state.tick

      addChronicle(`🗣️ ${rumor.content}`, state.year, state.day, 'minor')
    }
  }

  // Spread rumors through info_ties plus face-to-face relays.
  // info_spread_mult slows propagation in censored/restricted regimes.
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  for (const rumor of state.rumors) {
    // Opinion leaders and socially central NPCs spread faster.
    const spreaders = living.filter(n =>
      (n.info_ties.length > 15 || n.strong_ties.length > 10) &&
      (n.dissonance_acc > 25 || n.influence_score > 0.55),
    )
    const leaderBonus = spreaders.filter(n => n.influence_score > 0.65).length * 0.6
    const newReach  = Math.floor((spreaders.length * 0.08 + leaderBonus) * restrictions.info_spread_mult)
    rumor.reach = Math.min(rumor.reach + newReach, living.length)

    // Apply effect when rumor has reached enough people (threshold: 20% of pop)
    const threshold = Math.floor(living.length * 0.20)
    if (rumor.reach >= threshold) {
      const affected = living.filter(n => n.dissonance_acc > 20)
      for (const npc of affected) {
        switch (rumor.effect) {
          case 'trust_down':
            if (typeof rumor.subject === 'string' && rumor.subject in npc.trust_in) {
              npc.trust_in[rumor.subject as keyof typeof npc.trust_in].intention =
                clamp(npc.trust_in[rumor.subject as keyof typeof npc.trust_in].intention - 0.003, 0, 1)
            }
            break
          case 'trust_up':
            npc.trust_in.community.intention = clamp(npc.trust_in.community.intention + 0.002, 0, 1)
            break
          case 'fear_up':
            npc.fear = clamp(npc.fear + 0.5, 0, 100)
            break
          case 'grievance_up':
            npc.grievance = clamp(npc.grievance + 0.4, 0, 100)
            break
        }
      }
    }
  }

  // Expire old rumors
  state.rumors = state.rumors.filter(r => state.tick < r.expires_tick)
}

// ── Milestone Tracking ─────────────────────────────────────────────────────────
// Records once-in-a-game historical moments: first faction, first discovery,
// population peaks, worst crises, etc.

const _milestonesFired = new Set<string>()

export function checkMilestones(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const pop    = living.length

  function record(id: string, icon: string, text: string) {
    if (_milestonesFired.has(id)) return
    _milestonesFired.add(id)
    state.milestones.push({ tick: state.tick, year: state.year, day: state.day, text, icon })
  }

  // Population milestones
  if (pop >= 600) record('pop_600', '👥', NT.milestone.pop600(getLang()))
  if (pop >= 700) record('pop_700', '👥', NT.milestone.pop700(getLang()))
  if (pop >= 800) record('pop_800', '🏘️', NT.milestone.pop800(getLang()))

  // First faction
  if (state.factions.length > 0)
    record('first_faction', '⚑', NT.milestone.firstFaction(getLang(), state.factions[0].name))

  // First tech discovery
  if (state.discoveries.length > 0)
    record('first_discovery', '📚', NT.milestone.firstDiscovery(getLang(), state.discoveries[0].name, state.discoveries[0].researcher_name))

  // First legendary NPC
  const firstLegend = state.npcs.find(n => n.legendary)
  if (firstLegend)
    record('first_legendary', '⭐', NT.milestone.firstLegend(getLang(), firstLegend.name))

  // First referendum
  if (state.referendum !== null || state.milestones.some(m => m.text.includes('Referendum')))
    record('first_referendum', '🗳️', NT.milestone.firstReferendum(getLang()))

  // Crisis records
  if (state.macro.food < 10)
    record('famine', '🌾', NT.milestone.famine(getLang(), state.year))
  if (state.macro.gini > 0.70)
    record('peak_inequality', '⚖️', NT.milestone.inequality(getLang(), state.year, state.macro.gini))
  if (state.macro.trust < 15)
    record('trust_collapse', '💔', NT.milestone.trustCollapse(getLang(), state.year, state.macro.trust))
  if (state.macro.stability < 10)
    record('near_collapse', '⚡', NT.milestone.nearCollapse(getLang(), state.year))
  if (state.macro.polarization > 70)
    record('ideological_schism', '🧭', `Year ${state.year}: Ideological polarization crossed ${Math.round(state.macro.polarization)}%, splitting public discourse.`)

  // First cure breakthrough
  if (state.discoveries.length === 0 && state.research_points > 1200)
    record('research_progress', '🔬', NT.milestone.researchProgress(getLang()))
}
