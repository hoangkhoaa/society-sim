import type { WorldState, NPC, ActiveStrike } from '../types'
import { clamp, ZONE_ADJACENCY } from '../sim/constitution'
import { MAX_STRONG_TIES, MAX_WEAK_TIES, MAX_INFO_TIES } from '../sim/network'
import { getRegimeProfile } from '../sim/regime-config'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'
import {
  WEAK_TIE_REPLENISHMENT_THRESHOLD,
  WEAK_TIE_REPLENISHMENT_SAMPLE_RATE,
} from '../constants/network-weak-ties'
import {
  NPC_PERSUASION_MIN_WORLDVIEW_GAP,
  NPC_PERSUASION_MAX_SHIFT,
} from '../constants/npc-social-limits'
import { applyMutualRelation } from '../sim/npc'

// ── Network dynamics cooldowns ───────────────────────────────────────────
let lastSchismTick = -9999
let lastOpinionFeedTick = -9999
let lastCrisisTick = -9999
let lastPersuasionFeedTick = -9999

// ── Network Maintenance ───────────────────────────────────────────────────────

/**
 * Daily: remove dead NPC IDs from all tie arrays and sync the network Maps.
 * Prevents arrays from bloating as NPCs die over time.
 */
export function maintainNetworkLinks(state: WorldState): void {
  const alive = new Set(state.npcs.filter(n => n.lifecycle.is_alive).map(n => n.id))

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    npc.strong_ties = npc.strong_ties.filter(id => alive.has(id))
    npc.weak_ties   = npc.weak_ties.filter(id => alive.has(id))
    npc.info_ties   = npc.info_ties.filter(id => alive.has(id))
  }

  // Sync the Map-based graph too
  for (const [, set] of state.network.strong) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
  for (const [, set] of state.network.weak) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
  for (const [, set] of state.network.info) {
    for (const id of [...set]) { if (!alive.has(id)) set.delete(id) }
  }
}

/**
 * Every 30 days: refresh a fraction of info ties to reflect worldview drift.
 * NPCs whose worldviews have diverged lose info ties; newly similar NPCs gain them.
 * This prevents the info network from becoming stale after prolonged ideological shifts.
 */
export function refreshInfoTies(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const restrictions = getRegimeProfile(state.constitution).simRestrictions
  const infoTarget = Math.round((10 + clamp(state.constitution.network_cohesion, 0.1, 1) * 30) * restrictions.info_ties_cap)

  // Process ~20% of living NPCs per refresh cycle (spread load across calls)
  const sample = living.filter(() => Math.random() < 0.20)

  for (const npc of sample) {
    // Drop ties where worldviews have significantly diverged
    npc.info_ties = npc.info_ties.filter(id => {
      const other = state.npcs[id]
      if (!other?.lifecycle.is_alive) return false
      const collectivismDiff = Math.abs(npc.worldview.collectivism - other.worldview.collectivism)
      const authorityDiff    = Math.abs(npc.worldview.authority_trust - other.worldview.authority_trust)
      const riskDiff         = Math.abs(npc.worldview.risk_tolerance - other.worldview.risk_tolerance)
      // Keep tie if still ideologically close, same role, or same community group
      return collectivismDiff < 0.40 || authorityDiff < 0.40 || riskDiff < 0.35
        || npc.role === other.role
        || (npc.community_group !== null && npc.community_group === other.community_group)
    })

    // Try to form new ties through friends-of-friends (triadic closure)
    if (npc.info_ties.length < infoTarget) {
      const candidates = new Set<number>()
      for (const tid of npc.strong_ties.slice(0, 5)) {
        const neighbor = state.npcs[tid]
        if (!neighbor?.lifecycle.is_alive) continue
        for (const iid of neighbor.info_ties) {
          if (iid !== npc.id && !npc.info_ties.includes(iid)) candidates.add(iid)
        }
      }
      for (const cid of candidates) {
        if (npc.info_ties.length >= infoTarget) break
        const other = state.npcs[cid]
        if (!other?.lifecycle.is_alive || other.info_ties.length >= MAX_INFO_TIES) continue
        const collectivismDiff = Math.abs(npc.worldview.collectivism - other.worldview.collectivism)
        const authorityDiff    = Math.abs(npc.worldview.authority_trust - other.worldview.authority_trust)
        if (collectivismDiff < 0.25 && authorityDiff < 0.25) {
          npc.info_ties.push(cid)
          state.network.info.get(npc.id)?.add(cid)
          other.info_ties.push(npc.id)
          state.network.info.get(cid)?.add(npc.id)
        }
      }
    }
  }
}

/**
 * Daily: NPCs who are socializing in the same zone have a small chance to
 * form a new strong tie — organic friendship through repeated contact.
 * Rate: ~1% per socializing pair per day. Capped by MAX_STRONG_TIES.
 */
export function formOrganicStrongTies(state: WorldState): void {
  const byZone: Record<string, NPC[]> = {}
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || (npc.action_state !== 'socializing' && npc.action_state !== 'family')) continue
    if (npc.strong_ties.length >= MAX_STRONG_TIES) continue
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  for (const group of Object.values(byZone)) {
    if (group.length < 2) continue
    // Sample a small subset of pairs to avoid O(N²) per zone
    const maxPairs = Math.min(group.length, 8)
    for (let i = 0; i < maxPairs; i++) {
      const a = group[i]
      const b = group[Math.floor(Math.random() * group.length)]
      if (a.id === b.id || a.strong_ties.includes(b.id)) continue
      if (b.strong_ties.length >= MAX_STRONG_TIES) continue
      // Personality compatibility: loyal↔loyal bonds faster; greed↔loyalty repels
      const loyalA = a.personality?.loyalty ?? 0.5
      const loyalB = b.personality?.loyalty ?? 0.5
      const greedA = a.personality?.greed ?? 0.5
      const greedB = b.personality?.greed ?? 0.5
      const aggrA  = a.personality?.aggression ?? 0.5
      const aggrB  = b.personality?.aggression ?? 0.5
      const personalityBoost   = loyalA * loyalB * 0.40 + aggrA * aggrB * 0.15
      const personalityPenalty = Math.max(greedA - 0.6, 0) * Math.max(loyalB - 0.6, 0) * 0.5
                                + Math.max(greedB - 0.6, 0) * Math.max(loyalA - 0.6, 0) * 0.5
      const tieP = clamp(0.003 * (1 + personalityBoost - personalityPenalty), 0.0005, 0.010)
      if (Math.random() < tieP) {  // ~0.3% base daily chance — real friendships take weeks/months
        a.strong_ties.push(b.id)
        b.strong_ties.push(a.id)
        state.network.strong.get(a.id)?.add(b.id)
        state.network.strong.get(b.id)?.add(a.id)
        // Promoted to strong: remove the now-redundant weak tie between them
        a.weak_ties = a.weak_ties.filter(id => id !== b.id)
        b.weak_ties = b.weak_ties.filter(id => id !== a.id)
        state.network.weak.get(a.id)?.delete(b.id)
        state.network.weak.get(b.id)?.delete(a.id)
      }
    }
  }
}

/**
 * Weekly: rebuild weak ties for NPCs whose networks have contracted from fear or death.
 * Mirrors the geographic tie logic in buildNetwork. Only activates when the NPC's fear
 * is low — recovering societies naturally re-knit social fabric.
 * Processes ~10% of eligible NPCs per call to spread the load.
 */
export function replenishWeakTies(state: WorldState): void {
  const cohesion = clamp(state.constitution.network_cohesion, 0.1, 1)
  const weakTarget = Math.round(50 + cohesion * 100)
  const restrictions = getRegimeProfile(state.constitution).simRestrictions

  // Build zone index
  const byZone: Record<string, NPC[]> = {}
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (!byZone[npc.zone]) byZone[npc.zone] = []
    byZone[npc.zone].push(npc)
  }

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  // Only NPCs with depleted weak ties and low enough fear are eligible
  const eligible = living.filter(n => n.fear < 50 && n.weak_ties.length < weakTarget * WEAK_TIE_REPLENISHMENT_THRESHOLD)

  for (const npc of eligible) {
    if (Math.random() >= WEAK_TIE_REPLENISHMENT_SAMPLE_RATE) continue

    const hop2 = (ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => ZONE_ADJACENCY[z] ?? [])
    const pool = restrictions.cross_zone_ties
      ? [...(byZone[npc.zone] ?? []),
         ...(ZONE_ADJACENCY[npc.zone] ?? []).flatMap(z => byZone[z] ?? []),
         ...hop2.flatMap(z => byZone[z] ?? [])]
      : [...(byZone[npc.zone] ?? [])]

    const existingWeak = new Set(npc.weak_ties)
    const strongSet    = new Set(npc.strong_ties)
    const candidates   = pool
      .filter(c => c.id !== npc.id && !existingWeak.has(c.id) && !strongSet.has(c.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(5, weakTarget - npc.weak_ties.length))

    for (const other of candidates) {
      if (other.weak_ties.length >= MAX_WEAK_TIES) continue
      npc.weak_ties.push(other.id)
      other.weak_ties.push(npc.id)
      state.network.weak.get(npc.id)?.add(other.id)
      state.network.weak.get(other.id)?.add(npc.id)
    }
  }
}

// ── Class Solidarity & Labor Strikes ─────────────────────────────────────────

/**
 * Daily: spread class solidarity through weak_ties among same-role / same-class neighbors.
 * High inequality accelerates spread; rising personal income and govt trust slow it.
 * Leaders and guards naturally resist (structural interest in the status quo).
 */
export function spreadSolidarity(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const gini   = state.macro.gini
  if (gini < 0.15) return  // solidarity is meaningless in truly egalitarian societies

  const avgIncome = living.reduce((s, n) => s + n.daily_income, 0) / Math.max(living.length, 1)

  for (const npc of living) {
    // Elites and enforcers drift toward lower solidarity (structural interest)
    if (npc.role === 'leader' || npc.role === 'guard') {
      npc.class_solidarity = clamp(npc.class_solidarity - 0.3, 0, 100)
      continue
    }
    if (npc.role === 'child') continue

    let delta = 0

    // Pull from same-class weak-tie neighbors with high solidarity + grievance
    let pullCount = 0
    for (const tid of npc.weak_ties.slice(0, 25)) {
      const neighbor = state.npcs[tid]
      if (!neighbor?.lifecycle.is_alive) continue
      const wealthRatio = Math.max(npc.wealth, neighbor.wealth) / (Math.min(npc.wealth, neighbor.wealth) + 1)
      const sameClass   = npc.role === neighbor.role || wealthRatio < 2.5
      if (!sameClass) continue
      if (neighbor.class_solidarity > npc.class_solidarity + 10 && neighbor.grievance > 45) {
        delta += (neighbor.class_solidarity - npc.class_solidarity) * 0.025
        pullCount++
      }
    }
    if (pullCount > 0) delta = delta / pullCount

    // Inequality amplifier: high gini turbocharges spread
    delta *= (0.5 + gini * 1.5)

    // Personal prosperity counters solidarity (rational self-interest)
    if (npc.daily_income > avgIncome * 1.25) delta -= 0.8
    if (npc.wealth > 2000) delta -= 0.4

    // High government trust dampens solidarity
    const govTrust = (npc.trust_in.government.intention + npc.trust_in.government.competence) / 2
    if (govTrust > 0.55) delta -= govTrust * 0.6

    // Natural gravity toward gini-calibrated baseline (long-run equilibrium)
    const baseline = clamp((gini - 0.25) * 90, 0, 60)
    delta += (baseline - npc.class_solidarity) * 0.005

    npc.class_solidarity = clamp(npc.class_solidarity + delta, 0, 100)
  }
}

// Cooldown: prevent the same role from striking twice within 60 sim-days
const strikeCooldown: Record<string, number> = {}

/**
 * Daily: detect whether worker solidarity has crossed the strike threshold.
 * A strike triggers when: avg solidarity > 72, avg grievance > 58, gini > 0.42.
 * Existing strikes advance and end naturally or via government policy.
 */
export function checkLaborStrikes(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── Advance active strikes ──────────────────────────────────────────────
  state.active_strikes = (state.active_strikes ?? []).filter(strike => {
    const elapsed = state.tick - strike.start_tick
    if (elapsed >= strike.duration_ticks) {
      // Strike ends — exhaustion from sustained action drops solidarity
      addFeedRaw(tf('engine.strike_end', { role: t(`role.${strike.role}`) as string }) as string, 'info', state.year, state.day)
      addChronicle(tf('engine.strike_end', { role: t(`role.${strike.role}`) as string }) as string, state.year, state.day, 'major')
      for (const npc of living.filter(n => n.role === strike.role)) {
        npc.class_solidarity = clamp(npc.class_solidarity - 18, 0, 100)
        npc.on_strike = false
      }
      return false
    }

    // While striking: hold action_state as 'organizing', maintain on_strike flag
    for (const npc of living.filter(n => n.role === strike.role && n.class_solidarity > 45)) {
      npc.on_strike      = true
      npc.action_state   = 'organizing'
    }
    return true
  })

  // ── Detect new strikes ──────────────────────────────────────────────────
  const strikeable = ['farmer', 'craftsman', 'merchant', 'scholar', 'healthcare'] as const
  for (const role of strikeable) {
    if ((state.active_strikes ?? []).some(s => s.role === role)) continue
    const cooldownEnd = strikeCooldown[role] ?? 0
    if (state.tick - cooldownEnd < 24 * 60) continue  // 60-day cooldown per role

    const roleNPCs       = living.filter(n => n.role === role)
    if (roleNPCs.length < 4) continue
    const avgSolidarity  = roleNPCs.reduce((s, n) => s + n.class_solidarity, 0) / roleNPCs.length
    const avgGrievance   = roleNPCs.reduce((s, n) => s + n.grievance,        0) / roleNPCs.length

    if (avgSolidarity > 72 && avgGrievance > 58 && state.macro.gini > 0.42) {
      const demand: ActiveStrike['demand'] = avgGrievance > 80 ? 'rights'
        : state.macro.gini > 0.60          ? 'wages'
        :                                    'conditions'
      const durationTicks = (5 + Math.floor(Math.random() * 10)) * 24   // 5–15 sim-days
      const strike: ActiveStrike = { role, start_tick: state.tick, duration_ticks: durationTicks, demand }
      state.active_strikes.push(strike)
      strikeCooldown[role] = state.tick

      const roleLabel   = t(`role.${role}`) as string
      const demandLabel = t(`strike.demand.${demand}`) as string
      addFeedRaw(tf('engine.strike_start', { role: roleLabel, demand: demandLabel }) as string, 'critical', state.year, state.day)
      addChronicle(tf('engine.strike_start', { role: roleLabel, demand: demandLabel }) as string, state.year, state.day, 'major')
    }
  }
}

/**
 * Daily: recompute bridge_score (betweenness proxy) for each NPC and
 * update influence_score to reflect both strong-tie centrality and bridging power.
 * Bridge score = fraction of distinct zone-clusters spanned by an NPC's info_ties.
 * Using info_ties (ideological/information network) correctly captures cross-community
 * information flow — geographic acquaintances (weak_ties) do not drive influence.
 */
// Reference degree for influence normalization — "well-connected" = 15 strong ties.
// Using a fixed reference (not population max) prevents inflation in small communities
// where 5 ties out of a max-5 would otherwise score 1.0 influence.
export const INFLUENCE_REFERENCE_DEGREE = 15

export function computeBridgeScores(state: WorldState): void {
  const totalClusters = Math.max(new Set([...state.network.clusters.values()]).size, 1)

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) { npc.bridge_score = 0; continue }

    const spannedClusters = new Set<number>()
    for (const tid of npc.info_ties) {
      const cluster = state.network.clusters.get(tid)
      if (cluster !== undefined) spannedClusters.add(cluster)
    }
    npc.bridge_score = spannedClusters.size / totalClusters

    // Combined influence: 60% strong-tie centrality + 40% bridging power.
    // Centrality is normalized against a fixed reference degree, not the population max,
    // so influence scores are stable and comparable across different community sizes.
    const strongCentrality = npc.strong_ties.length / INFLUENCE_REFERENCE_DEGREE
    npc.influence_score = clamp(strongCentrality * 0.6 + npc.bridge_score * 0.4, 0, 1)
  }
}

// ── Mentorship Dynamics ─────────────────────────────────────────────────────
// Youth and early-career NPCs learn faster when paired with a trusted mentor.

export function applyMentorshipDynamics(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  for (const npc of living) {
    // Resolve invalid mentors (dead / no longer a strong tie)
    if (npc.mentor_id !== null) {
      const mentor = state.npcs[npc.mentor_id]
      if (!mentor?.lifecycle.is_alive || !npc.strong_ties.includes(mentor.id)) {
        npc.mentor_id = null
      }
    }

    // Assign mentor for youths and early-career adults
    const needsMentor = npc.age >= 14 && npc.age <= 25 && npc.mentor_id === null
    if (needsMentor) {
      const candidates = npc.strong_ties
        .map(id => state.npcs[id])
        .filter((m): m is NPC => !!m && m.lifecycle.is_alive && m.age >= 25 && m.role !== 'child')
        .sort((a, b) => b.influence_score - a.influence_score)

      const mentor = candidates[0]
      if (mentor && mentor.influence_score > 0.25) {
        npc.mentor_id = mentor.id
      }
    }

    if (npc.mentor_id === null) continue
    const mentor = state.npcs[npc.mentor_id]
    if (!mentor?.lifecycle.is_alive) continue

    // Skill transfer and emotional buffering
    const mentorshipStrength = clamp(mentor.influence_score * 0.8 + (mentor.happiness / 100) * 0.2, 0.1, 1)
    npc.base_skill = clamp(npc.base_skill + 0.0006 * mentorshipStrength, 0.2, 1.2)
    npc.stress = clamp(npc.stress - 0.25 * mentorshipStrength, 0, 100)

    // Ideological apprenticeship (gentle pull, not hard indoctrination)
    npc.worldview.collectivism = clamp(
      npc.worldview.collectivism + (mentor.worldview.collectivism - npc.worldview.collectivism) * 0.0012,
      0,
      1,
    )
    npc.worldview.authority_trust = clamp(
      npc.worldview.authority_trust + (mentor.worldview.authority_trust - npc.worldview.authority_trust) * 0.0012,
      0,
      1,
    )
  }
}

// ── Opinion Leaders / Propaganda Dynamics ─────────────────────────────────
// High-influence NPCs shape public trust and grievance through info networks.

export function applyOpinionLeaderDynamics(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const leaders = [...living]
    .filter(n => n.influence_score > 0.60 && n.info_ties.length >= 8)
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, 12)

  if (leaders.length === 0) return

  let proGov = 0
  let antiGov = 0

  for (const leader of leaders) {
    const govTrust = (leader.trust_in.government.intention + leader.trust_in.government.competence) / 2
    const isProGov = govTrust > 0.62 && leader.grievance < 45
    const isAntiGov = govTrust < 0.35 || leader.grievance > 65
    if (!isProGov && !isAntiGov) continue

    if (isProGov) proGov++
    if (isAntiGov) antiGov++

    for (const tid of leader.info_ties.slice(0, 16)) {
      const follower = state.npcs[tid]
      if (!follower?.lifecycle.is_alive) continue

      if (isProGov) {
        follower.trust_in.government.intention = clamp(follower.trust_in.government.intention + 0.0035, 0, 1)
        follower.grievance = clamp(follower.grievance - 0.25, 0, 100)
      } else if (isAntiGov) {
        follower.trust_in.government.intention = clamp(follower.trust_in.government.intention - 0.0035, 0, 1)
        follower.grievance = clamp(follower.grievance + 0.3, 0, 100)
      }
    }
  }

  if (state.tick - lastOpinionFeedTick > 15 * 24 && (proGov + antiGov) >= 2) {
    lastOpinionFeedTick = state.tick
    if (antiGov > proGov) {
      addFeedRaw(t('engine.opinion_anti_feed') as string, 'political', state.year, state.day)
      addChronicle(t('engine.opinion_anti_chronicle') as string, state.year, state.day, 'major')
    } else if (proGov > antiGov) {
      addFeedRaw(t('engine.opinion_pro_feed') as string, 'political', state.year, state.day)
      addChronicle(t('engine.opinion_pro_chronicle') as string, state.year, state.day, 'major')
    }
  }
}

// ── Direct Persuasion ────────────────────────────────────────────────────────
// Socializing NPCs with ideological gaps can debate and shift each other's
// worldview. Winner biases loser's view ~3–5%. Personality and influence matter.
// Staggered by NPC id so cost stays O(N/24) per tick.

export function applyDirectPersuasion(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  for (const npc of living) {
    if (state.tick % 24 !== npc.id % 24) continue
    if (npc.action_state !== 'socializing') continue

    // Pick one candidate from strong or info ties in same zone
    const candidates = [...npc.strong_ties, ...npc.info_ties]
      .map(id => state.npcs[id])
      .filter((o): o is NPC => !!(o?.lifecycle.is_alive && o.zone === npc.zone && o.action_state === 'socializing'))
    if (candidates.length === 0) continue

    const other = candidates[Math.floor(Math.random() * candidates.length)]

    // Find the worldview dimension with the largest gap
    const dims = ['collectivism', 'authority_trust', 'risk_tolerance'] as const
    let maxGap = 0
    let debateDim: (typeof dims)[number] = 'collectivism'
    for (const dim of dims) {
      const gap = Math.abs(npc.worldview[dim] - other.worldview[dim])
      if (gap > maxGap) { maxGap = gap; debateDim = dim }
    }
    if (maxGap < NPC_PERSUASION_MIN_WORLDVIEW_GAP) continue  // Not enough ideological distance to debate

    // Persuasion scores: influence + ambition vs loyalty-backed resistance
    const npcStrength    = npc.influence_score * 0.6 + (npc.personality?.ambition   ?? 0.5) * 0.4
    const npcResistance  = (npc.personality?.loyalty  ?? 0.5) * 0.6 + 0.4
    const othStrength    = other.influence_score * 0.6 + (other.personality?.ambition  ?? 0.5) * 0.4
    const othResistance  = (other.personality?.loyalty ?? 0.5) * 0.6 + 0.4

    const npcScore = npcStrength  / othResistance
    const othScore = othStrength  / npcResistance

    const npcWins = npcScore >= othScore
    const winner  = npcWins ? npc : other
    const loser   = npcWins ? other : npc

    // Loser's worldview nudges toward winner's on the debated dimension
    const shift = 0.03 + Math.random() * (NPC_PERSUASION_MAX_SHIFT - 0.03)
    loser.worldview[debateDim] = clamp(
      loser.worldview[debateDim] + (winner.worldview[debateDim] - loser.worldview[debateDim]) * shift,
      0, 1,
    )

    // Winner: slight competence/intention gain; loser: small conflict bump
    applyMutualRelation(
      winner, loser,
      { event: 'persuaded', competence: 0.015, intention: 0.010, affinity: -0.005 },
      { event: 'persuaded', competence: -0.010, intention: -0.015, affinity: -0.010, conflict: 0.020 },
      state.tick,
    )

    // Emit feed entry at most once per 15 sim-days
    if (state.tick - lastPersuasionFeedTick > 15 * 24) {
      lastPersuasionFeedTick = state.tick
      addFeedRaw(
        tf('engine.persuasion_win', { winner: winner.name, loser: loser.name }) as string,
        'info', state.year, state.day,
      )
    }
  }
}

// ── Cross-zone Organizing via Info Network ────────────────────────────────
// Organizing in one zone can spill into other zones through info ties.

export function propagateCrossZoneOrganizing(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const byZone = new Map<string, NPC[]>()
  for (const npc of living) {
    const arr = byZone.get(npc.zone)
    if (arr) arr.push(npc)
    else byZone.set(npc.zone, [npc])
  }

  const hotZones = new Set<string>()
  for (const [zone, group] of byZone) {
    const organizingRate = group.filter(n => n.action_state === 'organizing' || n.action_state === 'confront').length / Math.max(group.length, 1)
    if (organizingRate > 0.15) hotZones.add(zone)
  }
  if (hotZones.size === 0) return

  for (const npc of living) {
    if (hotZones.has(npc.zone)) continue
    if (npc.action_state === 'organizing' || npc.action_state === 'confront') continue

    let signal = 0
    for (const tid of npc.info_ties.slice(0, 20)) {
      const other = state.npcs[tid]
      if (!other?.lifecycle.is_alive) continue
      if (!hotZones.has(other.zone)) continue
      if (other.action_state === 'organizing' || other.action_state === 'confront') {
        signal += 1 + other.influence_score * 0.6
      }
    }

    if (signal <= 0) continue
    npc.grievance = clamp(npc.grievance + Math.min(signal * 0.18, 2.5), 0, 100)
    npc.dissonance_acc = clamp(npc.dissonance_acc + Math.min(signal * 0.12, 2.0), 0, 100)

    const joinChance = clamp(signal / 45, 0, 0.22)
    if (npc.grievance > 45 && Math.random() < joinChance) {
      npc.action_state = 'organizing'
    }
  }
}

// ── Crisis Bonding & Network Contraction ──────────────────────────────────
// Shared danger builds local solidarity, while fear contracts weak ties.

export function applyCrisisBonding(state: WorldState): void {
  const inCrisis = state.active_events.length > 0 || state.macro.stability < 35 || state.macro.food < 25
  if (inCrisis) lastCrisisTick = state.tick

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  // Fear-driven contraction: high-fear NPCs drop peripheral weak ties.
  for (const npc of living) {
    if (npc.fear <= 70 || npc.weak_ties.length < 12) continue
    const dropCount = 1 + Math.floor((npc.fear - 70) / 20)
    for (let i = 0; i < dropCount && npc.weak_ties.length > 8; i++) {
      const idx = Math.floor(Math.random() * npc.weak_ties.length)
      const removed = npc.weak_ties.splice(idx, 1)[0]
      state.network.weak.get(npc.id)?.delete(removed)
      state.network.weak.get(removed)?.delete(npc.id)
      const other = state.npcs[removed]
      if (other) other.weak_ties = other.weak_ties.filter(id => id !== npc.id)
    }
  }

  // Shared-trauma bonding: while crisis is active, survivors in same zone can form new ties faster.
  const zoneMap = new Map<string, NPC[]>()
  for (const npc of living) {
    const arr = zoneMap.get(npc.zone)
    if (arr) arr.push(npc)
    else zoneMap.set(npc.zone, [npc])
  }

  for (const group of zoneMap.values()) {
    if (group.length < 2) continue
    const attempts = Math.min(group.length, 10)
    for (let i = 0; i < attempts; i++) {
      const a = group[i]
      const b = group[Math.floor(Math.random() * group.length)]
      if (a.id === b.id) continue
      if (a.strong_ties.includes(b.id)) continue
      if (a.strong_ties.length >= MAX_STRONG_TIES || b.strong_ties.length >= MAX_STRONG_TIES) continue

      const bothUnderStress = a.fear > 45 && b.fear > 45
      const tieChance = inCrisis
        ? (bothUnderStress ? 0.015 : 0.005)  // crisis bonding: reduced from 5%/2% to 1.5%/0.5%
        : (state.tick - lastCrisisTick < 20 * 24 ? 0.004 : 0.002)
      if (Math.random() >= tieChance) continue

      a.strong_ties.push(b.id)
      b.strong_ties.push(a.id)
      state.network.strong.get(a.id)?.add(b.id)
      state.network.strong.get(b.id)?.add(a.id)
      // Promoted to strong: remove the now-redundant weak tie between them
      if (a.weak_ties.includes(b.id)) {
        a.weak_ties = a.weak_ties.filter(id => id !== b.id)
        b.weak_ties = b.weak_ties.filter(id => id !== a.id)
        state.network.weak.get(a.id)?.delete(b.id)
        state.network.weak.get(b.id)?.delete(a.id)
      }
    }
  }
}

// ── Ideological Schism Event ───────────────────────────────────────────────
// High polarization can fracture society into antagonistic camps.

export function checkIdeologicalSchism(state: WorldState): void {
  if (state.macro.polarization < 65) return
  if (state.tick - lastSchismTick < 45 * 24) return
  if (Math.random() > 0.18) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length < 40) return

  lastSchismTick = state.tick

  const campA = living.filter(n => n.worldview.collectivism >= 0.55)
  const campB = living.filter(n => n.worldview.collectivism < 0.45)
  if (campA.length < 15 || campB.length < 15) return

  // Cut a fraction of cross-camp info ties and weaken social trust.
  for (const npc of living) {
    npc.info_ties = npc.info_ties.filter(id => {
      const other = state.npcs[id]
      if (!other?.lifecycle.is_alive) return false
      const crossCamp = (npc.worldview.collectivism >= 0.55 && other.worldview.collectivism < 0.45)
        || (npc.worldview.collectivism < 0.45 && other.worldview.collectivism >= 0.55)
      if (!crossCamp) return true
      return Math.random() > 0.30
    })
    state.network.info.set(npc.id, new Set(npc.info_ties))
  }

  for (const npc of living) {
    if (npc.worldview.collectivism >= 0.55 || npc.worldview.collectivism < 0.45) {
      npc.grievance = clamp(npc.grievance + 6, 0, 100)
      npc.fear = clamp(npc.fear + 5, 0, 100)
    }
  }

  state.drift_score = clamp(state.drift_score + 0.08, 0, 1)
  addChronicle(t('engine.schism_chronicle') as string, state.year, state.day, 'critical')
  addFeedRaw(t('engine.schism_feed') as string, 'critical', state.year, state.day)
}
