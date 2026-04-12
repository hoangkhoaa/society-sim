import type { WorldState } from '../types'
import { clamp, getSeason, SEASON_LABELS } from '../sim/constitution'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'
import { applyMutualRelation, removeEnmity } from '../sim/npc'
import {
  NPC_RECONCILIATION_AFFINITY_THRESHOLD,
  NPC_RECONCILIATION_DAILY_CHANCE,
  NPC_FEUD_ESCALATION_AGGRESSION_MIN,
  NPC_FEUD_ESCALATION_DAILY_CHANCE,
} from '../constants/npc-social-limits'

// ── Season tracking ───────────────────────────────────────────────
let lastSeason = 'spring'

// ── Community collective action cooldown ────────────────────────────
// Maps community_group id → last tick a collective action event was emitted.
// Prevents spam: at most one event per group per 10 sim-days (240 ticks).
const groupCollectiveActionTick = new Map<number, number>()

let nextGroupId = 1
let lastOutcomeTick = -9999
let lastReconciliationFeedTick = -9999

// ── Season Transition ────────────────────────────────────────────────────────

export function checkSeasonTransition(state: WorldState): void {
  const current = getSeason(state.day)
  if (current === lastSeason) return
  lastSeason = current

  const label = SEASON_LABELS[current]
  const text = tf(`engine.season.${current}`, { season: label }) as string
  addChronicle(text, state.year, state.day, 'minor')
  addFeedRaw(text, 'info', state.year, state.day)
}

// ── Community Groups ─────────────────────────────────────────────────────────


export function checkCommunityGroups(state: WorldState): void {
  // ── Collective action outcome ──────────────────────────────────────────────
  // If a group has 3+ members organizing, they cross the threshold into collective
  // action: emit a chronicle event and push members toward confront (once per 10 days).
  const organizingByGroup = new Map<number, typeof state.npcs>()
  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive || npc.community_group === null) continue
    if (npc.action_state !== 'organizing') continue
    const g = npc.community_group
    if (!organizingByGroup.has(g)) organizingByGroup.set(g, [])
    organizingByGroup.get(g)!.push(npc)
  }

  for (const [groupId, members] of organizingByGroup) {
    if (members.length < 3) continue
    const lastTick = groupCollectiveActionTick.get(groupId) ?? -9999
    if (state.tick - lastTick < 240) continue   // 10-day cooldown

    groupCollectiveActionTick.set(groupId, state.tick)
    const zone = members[0].zone
    const zoneLabel = t(`zone.${zone}`) as string
    const text = tf('engine.community_mobilized', { zone: zoneLabel, n: members.length }) as string
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'warning', state.year, state.day)

    // Escalate: push members' dissonance and grievance — makes confront more likely next tick
    for (const m of members) {
      m.dissonance_acc = clamp(m.dissonance_acc + 15, 0, 100)
      m.grievance      = clamp(m.grievance      + 10, 0, 100)
      // Solidarity: brief trust boost with community institution
      m.trust_in.community.intention  = clamp(m.trust_in.community.intention  + 0.05, 0, 1)
      m.trust_in.community.competence = clamp(m.trust_in.community.competence + 0.03, 0, 1)
    }
  }

  // ── Formation ─────────────────────────────────────────────────────────────
  // 3+ socializing NPCs with mutual strong ties who have no group yet
  if (Math.random() > 0.05) {
    // Skip formation this day (~95% of days); still do dissolution below
  } else {
    const candidates = state.npcs.filter(n =>
      n.lifecycle.is_alive &&
      n.community_group === null &&
      (n.action_state === 'socializing' || n.action_state === 'family'),
    )

    for (const npc of candidates) {
      if (npc.community_group !== null) continue
      const coMembers = npc.strong_ties
        .map(id => state.npcs[id])
        .filter(n => n?.lifecycle.is_alive && n.community_group === null
          && (n.action_state === 'socializing' || n.action_state === 'family'))
      if (coMembers.length < 2) continue

      const groupId = nextGroupId++
      npc.community_group = groupId
      for (const m of coMembers.slice(0, 4)) {
        m.community_group = groupId
      }
      addChronicle(tf('engine.community_formed', {}) as string, state.year, state.day, 'major')
      break
    }
  }

  // ── Dissolution ───────────────────────────────────────────────────────────
  // Groups where fewer than 2 members are still alive
  const groupCounts = new Map<number, number>()
  for (const npc of state.npcs) {
    if (npc.community_group !== null && npc.lifecycle.is_alive) {
      groupCounts.set(npc.community_group, (groupCounts.get(npc.community_group) ?? 0) + 1)
    }
  }
  for (const npc of state.npcs) {
    if (npc.community_group !== null) {
      const count = groupCounts.get(npc.community_group) ?? 0
      if (count < 2) npc.community_group = null
    }
  }
}

// ── Organizing Outcome ───────────────────────────────────────────────────────
// When unrest exceeds 12% of population, the government must respond:
//   - Suppression (strong guard + state power)
//   - Negotiation (weak guard or moderate trust)
//   - Standoff   (too weak to suppress, too distrusted to negotiate)
// 15-day cooldown prevents spam.


export function checkOrganizingOutcome(state: WorldState): void {
  if (state.tick - lastOutcomeTick < 15 * 24) return

  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) return

  const unrestNPCs = living.filter(n => n.action_state === 'organizing' || n.action_state === 'confront')
  const unrestRate = unrestNPCs.length / living.length
  if (unrestRate < 0.12) return

  const guardInst  = state.institutions.find(i => i.id === 'guard')
  const govInst    = state.institutions.find(i => i.id === 'government')
  const guardPower = guardInst?.power ?? 0.3
  const govTrust   = state.macro.trust / 100
  const pct        = Math.round(unrestRate * 100)

  lastOutcomeTick = state.tick

  if (guardPower > 0.5 && state.constitution.state_power > 0.55) {
    const rights = state.constitution.individual_rights_floor

    // High rights (>0.75) block violent suppression — legal protections hold
    if (rights > 0.75) {
      const text = tf('engine.unrest.suppression_blocked', { rights: Math.round(rights * 100) }) as string
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'political', state.year, state.day)
      // Fall through to negotiation below
    } else {
      // Suppression: brutality scales inversely with individual rights
      // Low rights → high fear, brutal dispersal; high rights → softer response
      const fearDelta      = Math.round(12 + (1 - rights) * 28)   // 12–40
      const grievanceDelta = Math.round(8  + (1 - rights) * 18)   // 8–26
      const trustLoss      = 0.05 + (1 - rights) * 0.07           // 0.05–0.12

      const text = tf('engine.unrest.suppressed', { pct, rights: Math.round(rights * 100) }) as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)

      const target = unrestNPCs.slice(0, Math.ceil(unrestNPCs.length * 0.65))
      for (const npc of target) {
        npc.fear       = clamp(npc.fear       + fearDelta,      0, 100)
        npc.grievance   = clamp(npc.grievance   + grievanceDelta, 0, 100)
        npc.action_state = Math.random() < 0.45 ? 'fleeing' : 'complying'
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - trustLoss, 0, 1)
      }
      if (guardInst) guardInst.legitimacy = clamp(guardInst.legitimacy - 0.03 - (1 - rights) * 0.04, 0, 1)
      return
    }
  }

  if (govTrust > 0.35 || state.constitution.state_power < 0.45) {
    // Negotiation: government opens dialogue
    const text = tf('engine.unrest.dialogue', { pct }) as string
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'political', state.year, state.day)

    for (const npc of unrestNPCs) {
      npc.grievance = clamp(npc.grievance - 12, 0, 100)
      npc.stress    = clamp(npc.stress    -  8, 0, 100)
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.04, 0, 1)
    }
    if (govInst) govInst.legitimacy = clamp(govInst.legitimacy + 0.02, 0, 1)
    return
  }

  // Standoff: government can neither suppress nor negotiate
  const text = tf('engine.unrest.standoff', { pct }) as string
  addChronicle(text, state.year, state.day, 'critical')
  addFeedRaw(text, 'critical', state.year, state.day)
  state.drift_score = clamp(state.drift_score + 0.10, 0, 1)
}

// ── Trust Recovery ───────────────────────────────────────────────────────────
// When the government maintains sustained stability (>60) and trust is still
// below base, a slow passive recovery trickles trust back toward the founding
// level — representing rebuilt credibility through consistent governance.
// Recovery stops at 0.65 to model the lasting scar of past betrayals.

export function checkTrustRecovery(state: WorldState): void {
  if (state.macro.stability < 60) return
  if (state.macro.trust > 65)     return   // already healthy

  const recoveryRate = 0.0003   // per NPC per day — slow rebuild
  const cap = Math.min(state.constitution.base_trust * 0.9, 0.65)

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) continue
    if (npc.trust_in.government.intention >= cap) continue
    npc.trust_in.government.intention = clamp(
      npc.trust_in.government.intention + recoveryRate,
      0, cap,
    )
  }
}

// ── Feud Escalation & Reconciliation ─────────────────────────────────────────
// NPCs with active enmity in the same zone can escalate to confront.
// If their relation_map shows residual affinity AND a scholar/healthcare strong
// tie is shared by both, a 5%/day reconciliation roll can clear the grudge,
// emit a chronicle event, and boost mutual affinity.

export function checkFeudsAndReconciliation(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  for (const npc of living) {
    if (!npc.enmity_ids || npc.enmity_ids.length === 0) continue

    for (const enemyId of [...npc.enmity_ids]) {
      const enemy = state.npcs[enemyId]
      if (!enemy?.lifecycle.is_alive) continue

      // ── Escalation: enmity + same zone + aggression → confront ─────────
      if (
        npc.zone === enemy.zone &&
        npc.action_state !== 'confront' &&
        (npc.personality?.aggression ?? 0.5) > NPC_FEUD_ESCALATION_AGGRESSION_MIN &&
        Math.random() < NPC_FEUD_ESCALATION_DAILY_CHANCE
      ) {
        npc.action_state = 'confront'
        applyMutualRelation(
          npc, enemy,
          { event: 'conflict', conflict: 0.030, affinity: -0.020 },
          { event: 'conflict', conflict: 0.025, affinity: -0.015 },
          state.tick,
        )
        continue
      }

      // ── Reconciliation: mutual residual affinity + mediator ─────────────
      if (npc.zone !== enemy.zone) continue

      const npcEdge   = npc.relation_map?.[enemyId]
      const enemyEdge = enemy.relation_map?.[npc.id]
      const mutualAffinity = ((npcEdge?.affinity ?? 0.5) + (enemyEdge?.affinity ?? 0.5)) / 2
      if (mutualAffinity < NPC_RECONCILIATION_AFFINITY_THRESHOLD) continue

      // Mediator must be an alive scholar or healthcare NPC strong-tied to both
      const mediator = living.find(m =>
        (m.role === 'scholar' || m.role === 'healthcare') &&
        m.strong_ties.includes(npc.id) &&
        m.strong_ties.includes(enemyId),
      )
      if (!mediator) continue

      // 5% daily chance when all conditions are met
      if (Math.random() > NPC_RECONCILIATION_DAILY_CHANCE) continue

      removeEnmity(npc, enemyId)
      removeEnmity(enemy, npc.id)

      applyMutualRelation(
        npc, enemy,
        { event: 'reconciled', affinity: 0.08, intention: 0.05, conflict: -0.10 },
        { event: 'reconciled', affinity: 0.08, intention: 0.05, conflict: -0.10 },
        state.tick,
      )

      if (state.tick - lastReconciliationFeedTick > 10 * 24) {
        lastReconciliationFeedTick = state.tick
        const text = tf('engine.reconciliation', { a: npc.name, b: enemy.name, mediator: mediator.name }) as string
        addChronicle(text, state.year, state.day, 'minor')
        addFeedRaw(text, 'info', state.year, state.day)
      }
      break  // One reconciliation per NPC per day is enough
    }
  }
}
