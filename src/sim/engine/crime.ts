import type { WorldState, NPC, Syndicate } from '../../types'
import { clamp } from '../constitution'
import { addFeedRaw, addChronicle } from '../../ui/feed'
import { t, tf } from '../../i18n'

let lastShadowRaidTick = -9999
let nextSyndicateId = 1
let lastGuardPatrolDay = -1

// ── Shadow Economy ────────────────────────────────────────────────────────────
// In planned economies (market_freedom < 0.25) with a significant criminal
// population (>3%), an underground market emerges. Criminals earn extra wealth
// through illegal trade. Guards periodically raid and seize assets.
// Syndicate members are priority raid targets with 50% wealth-seizure rate.


export function checkShadowEconomy(state: WorldState): void {
  if (state.constitution.market_freedom >= 0.25) return

  const living    = state.npcs.filter(n => n.lifecycle.is_alive)
  // Gang-role NPCs are always part of the criminal underground; criminal_record others also participate
  const criminals = living.filter(n => n.criminal_record || n.role === 'gang')
  if (criminals.length / Math.max(living.length, 1) < 0.03) return

  // Guard raid: once per 5 days minimum
  if (state.tick - lastShadowRaidTick > 120) {
    const guardInst  = state.institutions.find(i => i.id === 'guard')
    const raidChance = (guardInst?.power ?? 0.3) * 0.08  // 2-8% per criminal per check

    // Collect syndicate member ids for priority targeting
    const syndicateMemberIds = new Set<number>()
    for (const syn of state.syndicates) {
      for (const id of syn.member_ids) syndicateMemberIds.add(id)
    }

    let raidCount = 0
    for (const npc of criminals) {
      const isSyndMember = syndicateMemberIds.has(npc.id)
      const effectiveChance = isSyndMember ? raidChance * SYNDICATE_RAID_MULTIPLIER : raidChance
      if (Math.random() < effectiveChance) {
        // Syndicate members lose 50% wealth; regular criminals lose 40%
        const seizureRate = isSyndMember ? 0.50 : 0.40
        const seized = npc.wealth * seizureRate
        npc.wealth    = clamp(npc.wealth - seized, 0, 50000)
        npc.fear      = clamp(npc.fear      + 25,  0, 100)
        npc.isolation = clamp(npc.isolation + 15,  0, 100)
        raidCount++
      }
    }

    if (raidCount > 0) {
      lastShadowRaidTick = state.tick
      const text = tf('engine.shadow_raid', { n: raidCount }) as string
      addFeedRaw(text, 'warning', state.year, state.day)
      addChronicle(text, state.year, state.day, 'major')
    } else if (Math.random() < 0.04) {
      // Ambient news: market thriving under the state's nose
      const pct = Math.round(criminals.length / living.length * 100)
      addFeedRaw(
        tf('engine.shadow_thrives', { pct }) as string,
        'info', state.year, state.day,
      )
    }
  }
}

// ── Organized Crime Syndicates ────────────────────────────────────────────────
// Criminal NPCs form syndicates when inequality is high and criminal population
// exceeds 4%. Syndicates collect dues, run protection rackets, bribe guards,
// and recruit. Guard crackdowns can partially bust them.

const SYNDICATE_FORMATION_PROBABILITY = 0.05   // daily formation check chance
const MIN_SYNDICATE_SIZE               = 4      // minimum members to form/keep a syndicate
const SYNDICATE_ACTION_INTERVAL        = 240    // ticks between special actions (10 days)
const SYNDICATE_DUES_RATE              = 0.08   // fraction of member wealth collected daily
const SYNDICATE_BUST_PROBABILITY       = 0.05   // daily bust chance when guard power > 0.55
const MEMBER_BUST_RATE                 = 0.30   // fraction of members removed on a bust
const RACKET_EXTRACTION_RATE           = 0.05   // fraction of merchant wealth extracted per racket
const SYNDICATE_RAID_MULTIPLIER        = 1.5    // shadow-economy raid chance multiplier for syndicate members


const SYNDICATE_NAMES = [
  'Iron Veil Brotherhood', 'Shadow Compact', 'Red Hand Society', 'Crimson Tide Outfit',
  'Black Market League', 'Night Crown Syndicate', 'Hollow Sun Cartel', 'Grey Wolf Ring',
  'Ember Court Gang', 'Silent Scale Consortium',
]

export function checkSyndicates(state: WorldState): void {
  const living    = state.npcs.filter(n => n.lifecycle.is_alive)
  const criminals = living.filter(n => n.criminal_record)
  const criminalRate = criminals.length / Math.max(living.length, 1)

  // ── Formation ──────────────────────────────────────────────────────────────
  // Conditions: >4% criminal population AND gini > 0.45 AND fewer than 3 syndicates
  if (
    criminalRate > 0.04 &&
    state.macro.gini > 0.45 &&
    state.syndicates.length < 3 &&
    Math.random() < SYNDICATE_FORMATION_PROBABILITY
  ) {
    // Find the highest-wealth criminal NPC who is not already in a syndicate
    const existingSyndicateMemberIds = new Set<number>()
    for (const syn of state.syndicates) {
      for (const id of syn.member_ids) existingSyndicateMemberIds.add(id)
    }

    const candidates = criminals.filter(n => !existingSyndicateMemberIds.has(n.id))
    if (candidates.length >= MIN_SYNDICATE_SIZE) {
      // Boss = highest-wealth criminal with at least 3 mutual strong ties to other criminals
      const criminalIds = new Set(candidates.map(n => n.id))
      const boss = candidates
        .filter(n => n.strong_ties.filter(tid => criminalIds.has(tid)).length >= 3)
        .sort((a, b) => b.wealth - a.wealth)[0]

      if (boss) {
        // Recruit boss + up to 9 mutual-strong-tie criminals in same zone cluster
        const recruits: NPC[] = [boss]
        for (const candidate of candidates) {
          if (candidate.id === boss.id) continue
          if (boss.strong_ties.includes(candidate.id)) {
            recruits.push(candidate)
            if (recruits.length >= 10) break
          }
        }

        if (recruits.length >= MIN_SYNDICATE_SIZE) {
          const territory = [...new Set(recruits.map(n => n.zone))]
          const usedNames = new Set(state.syndicates.map(s => s.name))
          const name = SYNDICATE_NAMES.find(n => !usedNames.has(n))
            ?? `Crime Syndicate ${nextSyndicateId}`

          const syndicate: Syndicate = {
            id: nextSyndicateId++,
            name,
            boss_id: boss.id,
            member_ids: recruits.map(n => n.id),
            territory,
            resources: 0,
            founded_tick: state.tick,
            last_action_tick: state.tick,
          }
          state.syndicates.push(syndicate)

          const text = tf('engine.syndicate_formed', { name, n: recruits.length }) as string
          addChronicle(text, state.year, state.day, 'critical')
          addFeedRaw(text, 'warning', state.year, state.day)
        }
      }
    }
  }

  const guardInst = state.institutions.find(i => i.id === 'guard')
  const guardPower = guardInst?.power ?? 0.3

  // ── Guard-Syndicate Conflict ────────────────────────────────────────────────
  // When guard power > 0.55, 5% daily chance of bust per syndicate
  if (guardPower > 0.55) {
    for (const syn of state.syndicates) {
      if (Math.random() < SYNDICATE_BUST_PROBABILITY) {
        // Bust: remove MEMBER_BUST_RATE fraction of members, halve resources
        const before = syn.member_ids.length
        syn.member_ids = syn.member_ids.filter(id => {
          const npc = state.npcs[id]
          if (!npc?.lifecycle.is_alive) return false
          if (Math.random() < MEMBER_BUST_RATE) {
            // Busted member gets extra fear/isolation
            npc.fear      = clamp(npc.fear      + 35, 0, 100)
            npc.isolation = clamp(npc.isolation + 20, 0, 100)
            return false
          }
          return true
        })
        const busted = before - syn.member_ids.length
        syn.resources = Math.floor(syn.resources * 0.50)

        const text = tf('engine.syndicate_bust', { name: syn.name, n: busted }) as string
        addChronicle(text, state.year, state.day, 'critical')
        addFeedRaw(text, 'critical', state.year, state.day)
      }
    }
  }

  // ── Daily Actions ──────────────────────────────────────────────────────────
  for (const syn of state.syndicates) {
    // Sync member list to living members only
    syn.member_ids = syn.member_ids.filter(id => state.npcs[id]?.lifecycle.is_alive)
    if (syn.member_ids.length < 2) continue

    const members = syn.member_ids.map(id => state.npcs[id]).filter((n): n is NPC => !!n)

    // Collect dues from all members daily
    let dues = 0
    for (const m of members) {
      const due = m.wealth * SYNDICATE_DUES_RATE
      m.wealth = clamp(m.wealth - due, 0, 50000)
      dues += due
    }
    syn.resources = Math.min(syn.resources + Math.floor(dues), 999999)

    // Every 10 days, perform one special action
    if (state.tick - syn.last_action_tick < SYNDICATE_ACTION_INTERVAL) continue
    syn.last_action_tick = state.tick

    const roll = Math.random()

    if (roll < 0.33 && syn.resources > 200) {
      // Bribe guard: reduce trust-in-government by 0.1 for members' zone
      syn.resources -= 200
      for (const npc of living) {
        if (syn.territory.includes(npc.zone)) {
          npc.trust_in.government.intention = clamp(
            npc.trust_in.government.intention - 0.10, 0, 1,
          )
        }
      }
      const text = tf('engine.syndicate_bribe', { name: syn.name }) as string
      addFeedRaw(text, 'warning', state.year, state.day)
      addChronicle(text, state.year, state.day, 'major')

    } else if (roll < 0.66) {
      // Protection racket: extract RACKET_EXTRACTION_RATE wealth from merchants in territory
      let extorted = 0
      for (const npc of living) {
        if (npc.role === 'merchant' && syn.territory.includes(npc.zone) && !syn.member_ids.includes(npc.id)) {
          const take = npc.wealth * RACKET_EXTRACTION_RATE
          npc.wealth = clamp(npc.wealth - take, 0, 50000)
          npc.fear   = clamp(npc.fear + 10, 0, 100)
          syn.resources += Math.floor(take)
          extorted++
        }
      }
      if (extorted > 0) {
        const text = tf('engine.syndicate_racket', { name: syn.name, n: extorted }) as string
        addFeedRaw(text, 'warning', state.year, state.day)
        addChronicle(text, state.year, state.day, 'major')
      }

    } else {
      // Recruit high-grievance NPC in territory zone
      const existingMemberIds = new Set(syn.member_ids)
      const recruitCandidates = living.filter(n =>
        syn.territory.includes(n.zone) &&
        n.grievance > 60 &&
        !existingMemberIds.has(n.id) &&
        !n.criminal_record,
      )
      if (recruitCandidates.length > 0) {
        const target = recruitCandidates.sort((a, b) => b.grievance - a.grievance)[0]
        target.criminal_record = true
        syn.member_ids.push(target.id)
        const text = tf('engine.syndicate_recruit', { name: syn.name, recruit: target.name }) as string
        addFeedRaw(text, 'warning', state.year, state.day)
        addChronicle(text, state.year, state.day, 'minor')
      }
    }

    // Syndicate power erodes market legitimacy and government trust
    const marketInst = state.institutions.find(i => i.id === 'market')
    if (marketInst) {
      marketInst.legitimacy = clamp(marketInst.legitimacy - 0.02, 0, 1)
    }
    if (guardInst) {
      guardInst.legitimacy = clamp(guardInst.legitimacy - 0.01, 0, 1)
    }
  }

  // ── Dissolution ────────────────────────────────────────────────────────────
  state.syndicates = state.syndicates.filter(syn => {
    if (syn.member_ids.length < 2) {
      const text = tf('engine.syndicate_dissolved', { name: syn.name }) as string
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'info', state.year, state.day)
      return false
    }
    return true
  })
}

// ── Guard Patrol: active order maintenance ────────────────────────────────────
// Guards present in zones actively deter and de-escalate conflict.
// High guard power means faster resolution of confrontations and faster crime
// detection.  Guards also break up enmity-driven encounters between enemies.


export function checkGuardPatrol(state: WorldState): void {
  if (state.day === lastGuardPatrolDay) return
  lastGuardPatrolDay = state.day

  const guardInst  = state.institutions.find(i => i.id === 'guard')
  const guardPower = guardInst?.power ?? 0.3
  if (guardPower < 0.20) return   // too weak to patrol

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const guards  = living.filter(n => n.role === 'guard')
  if (guards.length === 0) return

  // Build a set of zones that have at least one on-duty guard
  const patrolledZones = new Set<string>()
  for (const g of guards) {
    if (g.action_state === 'working') patrolledZones.add(g.zone)
  }
  if (patrolledZones.size === 0) return

  const rights = state.constitution.individual_rights_floor

  for (const npc of living) {
    if (!patrolledZones.has(npc.zone)) continue

    // ── 1. De-escalate confront / organizing → complying ─────────────────
    if (npc.action_state === 'confront' || npc.action_state === 'organizing') {
      // Probability of de-escalation scales with guard power and inversely with rights
      const deescalateP = guardPower * 0.25 * (1 + (1 - rights) * 0.5)
      if (Math.random() < deescalateP) {
        npc.action_state = 'complying'
        npc.fear = clamp(npc.fear + 10, 0, 100)
      }
    }

    // ── 2. Enmity suppression: enemies in same patrolled zone are deterred ─
    if ((npc.enmity_ids?.length ?? 0) > 0) {
      // Guards in the zone deter enemies from escalating; oldest grudge fades first
      if (Math.random() < guardPower * 0.08) {
        npc.enmity_ids?.shift()
      }
    }

    // ── 3. Faster crime detection in patrolled zones ────────────────────────
    if (npc.criminal_record && state.tick % 48 === npc.id % 48) {
      const bonusDetection = guardPower * 0.06 * (1 - rights * 0.40)
      if (Math.random() < bonusDetection) {
        const fineFrac = 0.10 + (1 - rights) * 0.15
        const seized   = npc.wealth * fineFrac
        npc.wealth    = clamp(npc.wealth - seized, 0, 50000)
        npc.fear      = clamp(npc.fear + 15, 0, 100)
        npc.isolation = clamp(npc.isolation + 10, 0, 100)
        // Successful patrol improves guard institution legitimacy slightly
        if (guardInst) guardInst.legitimacy = clamp(guardInst.legitimacy + 0.003, 0, 1)
      }
    }
  }

  // ── 4. Guard presence reduces overall crime in zone ──────────────────────
  // Zones with strong patrols see reduced crime probability in checkLifecycle.
  // This is handled via guard power scaling in npc.ts — no extra flag needed.

  // Chronicle: report patrol activity (low frequency to avoid spam)
  if (guards.filter(g => g.action_state === 'working').length > 0 && Math.random() < 0.04) {
    const confrontCount = living.filter(n =>
      n.action_state === 'confront' && patrolledZones.has(n.zone)
    ).length
    if (confrontCount > Math.ceil(living.length * 0.05)) {
      const text = tf('engine.guard_patrol_deescalate', {
        n: guards.filter(g => g.action_state === 'working').length,
      }) as string
      addFeedRaw(text, 'warning', state.year, state.day)
    }
  }
}
