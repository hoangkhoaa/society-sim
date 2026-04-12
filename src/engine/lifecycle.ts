import type { WorldState, NPC } from '../types'
import { clamp } from '../sim/constitution'
import { createNPC, RESIDENTIAL_ZONES } from '../sim/npc'
import { MAX_STRONG_TIES, MAX_WEAK_TIES, MAX_INFO_TIES } from '../sim/network'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { tf } from '../i18n'
import {
  LIFECYCLE_MIN_BIRTH_SPACING_TICKS,
  LIFECYCLE_HEARTBREAK_COOLDOWN_TICKS,
  LIFECYCLE_ROMANCE_THRESHOLD,
} from '../constants/engine-lifecycle'
import { computeBirthChance } from '../formulas/lifecycle'

// ── Lifecycle Events (birth / marriage) ─────────────────────────────────────

// Maximum children per couple (varies with constitution safety net — wealthier / safer → fewer)
function maxChildrenPerCouple(state: WorldState): number {
  return Math.round(clamp(6 - state.constitution.safety_net * 3, 2, 8))
}

function computeBirthChancePerDay(a: NPC, b: NPC, state: WorldState): number {
  const baseFertility = Math.min(a.lifecycle.fertility, b.lifecycle.fertility)
  if (baseFertility <= 0) return 0

  // Enforce birth spacing — at least MIN_BIRTH_SPACING_TICKS since the last birth
  const lastA = a.lifecycle.last_birth_tick ?? -Infinity
  const lastB = b.lifecycle.last_birth_tick ?? -Infinity
  const lastBirth = Math.max(lastA, lastB)
  if (state.tick - lastBirth < LIFECYCLE_MIN_BIRTH_SPACING_TICKS) return 0

  // Enforce maximum children per couple
  const totalChildren = new Set([...a.lifecycle.children_ids, ...b.lifecycle.children_ids]).size
  if (totalChildren >= maxChildrenPerCouple(state)) return 0

  const avgHappiness = (a.happiness + b.happiness) / 2
  const avgStress = (a.stress + b.stress) / 2
  const avgFear = (a.fear + b.fear) / 2
  const avgHunger = (a.hunger + b.hunger) / 2
  const avgExhaustion = (a.exhaustion + b.exhaustion) / 2
  const avgWealth = (a.wealth + b.wealth) / 2
  const avgTrustGov =
    ((a.trust_in.government.intention + a.trust_in.government.competence) +
     (b.trust_in.government.intention + b.trust_in.government.competence)) / 4

  // Multipliers tune "readiness to have children" from micro + macro conditions.
  const happinessFactor = clamp(0.75 + avgHappiness / 200, 0.65, 1.25)
  const stressFactor = clamp(1 - avgStress / 120, 0.2, 1)
  const fearFactor = clamp(1 - avgFear / 140, 0.25, 1)
  const needsFactor = clamp(1 - ((avgHunger * 0.6 + avgExhaustion * 0.4) / 150), 0.25, 1)
  const wealthFactor = clamp(0.6 + avgWealth / 200, 0.6, 1.2)
  const trustFactor = clamp(0.75 + avgTrustGov * 0.35, 0.75, 1.1)
  const foodFactor = clamp(0.55 + state.macro.food / 150, 0.55, 1.2)

  // Base rate of 0.00015/day gives ~5 births/year at population 500 with ~125 couples,
  // producing ~1% annual growth (pre-modern realistic). Was 0.0008 which caused 16% growth.
  // With all factors maximally favorable the cap is 0.0006/day.
  // Spacing and max-children limits (maxChildrenPerCouple) ensure realistic lifetime family sizes.
  return computeBirthChance(baseFertility, happinessFactor, stressFactor, fearFactor, needsFactor, wealthFactor, trustFactor, foodFactor)
}

// ── Romance / Marriage helpers ──────────────────────────────────────────────

// Returns true if a and b are direct blood relations (parent-child).
function isBloodRelation(a: NPC, b: NPC): boolean {
  return a.lifecycle.children_ids.includes(b.id) || b.lifecycle.children_ids.includes(a.id)
}

// Worldview similarity: 0 (completely opposite) → 1 (identical)
function worldviewSimilarity(a: NPC, b: NPC): number {
  const dims = ['collectivism', 'authority_trust', 'risk_tolerance', 'time_preference'] as const
  const totalDiff = dims.reduce((s, d) => s + Math.abs(a.worldview[d] - b.worldview[d]), 0)
  return 1 - totalDiff / dims.length   // 0–1; 1 = identical worldview
}

// Compatibility score for a couple (0–1); affects marriage probability and divorce risk.
// High score → more likely to marry, less likely to divorce.
function coupleCompatibility(a: NPC, b: NPC): number {
  const wv   = worldviewSimilarity(a, b)                         // 0–1
  const age  = Math.max(0, 1 - Math.abs(a.age - b.age) / 30)    // 0–1
  // Wealth compatibility: extreme ratio = incompatible
  const minW = Math.min(a.wealth, b.wealth) + 1
  const maxW = Math.max(a.wealth, b.wealth) + 1
  const wlth = Math.max(0, 1 - Math.log(maxW / minW) / Math.log(50))  // 0–1
  return clamp(wv * 0.55 + age * 0.25 + wlth * 0.20, 0, 1)
}

// Apply heartbreak to an NPC: cooldown + grievance + isolation spike.
function applyHeartbreak(npc: NPC, state: WorldState): void {
  npc.lifecycle.romance_target_id = null
  npc.lifecycle.romance_score     = 0
  npc.lifecycle.heartbreak_cooldown = LIFECYCLE_HEARTBREAK_COOLDOWN_TICKS
  npc.grievance  = clamp(npc.grievance  + 25, 0, 100)
  npc.isolation  = clamp(npc.isolation  + 20, 0, 100)
  // Memory entry for the heartbreak
  npc.memory.push({ event_id: `heartbreak_${state.tick}`, type: 'trust_broken', emotional_weight: -35, tick: state.tick })
  if (npc.memory.length > 10) npc.memory.shift()
}

// Dissolve a marriage and apply consequences to both partners.
function dissolveMarriage(npc: NPC, spouse: NPC, state: WorldState, reason: 'divorce' | 'widowed'): void {
  npc.lifecycle.spouse_id    = null
  spouse.lifecycle.spouse_id = null

  if (reason === 'divorce') {
    applyHeartbreak(npc,    state)
    applyHeartbreak(spouse, state)
    addChronicle(tf('engine.divorced', { a: npc.name, b: spouse.name }) as string, state.year, state.day, 'minor')
    addFeedRaw(tf('engine.divorced', { a: npc.name, b: spouse.name }) as string, 'info', state.year, state.day)
  }
}

export function checkLifecycleEvents(state: WorldState): void {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── 0. Tick heartbreak cooldowns ──────────────────────────────────────────
  for (const npc of living) {
    if ((npc.lifecycle.heartbreak_cooldown ?? 0) > 0) {
      npc.lifecycle.heartbreak_cooldown = Math.max(0, npc.lifecycle.heartbreak_cooldown - 24)
    }
  }

  // ── 1. Birth check ────────────────────────────────────────────────────────
  for (const npc of living) {
    if (npc.lifecycle.spouse_id === null) continue
    const sid = npc.lifecycle.spouse_id
    if (npc.id > sid) continue
    const spouse = state.npcs[sid]
    if (!spouse?.lifecycle.is_alive) continue

    const birthChance = computeBirthChancePerDay(npc, spouse, state)
    if (birthChance > 0 && Math.random() < birthChance) {
      spawnBirth(state, npc)
    }
  }

  // ── 2. Romance accumulation ───────────────────────────────────────────────
  // Each day, single adults who are not in heartbreak develop or deepen feelings
  // toward eligible contacts in their strong_ties (proximity + compatibility).
  const romanceCandidates = living.filter(n =>
    n.lifecycle.spouse_id === null &&
    n.age >= 18 &&
    n.age <= 55 &&
    (n.lifecycle.heartbreak_cooldown ?? 0) === 0,
  )
  for (const npc of romanceCandidates) {
    // Invalidate existing romance target if they've become unavailable
    const currentTarget = npc.lifecycle.romance_target_id !== null
      ? state.npcs[npc.lifecycle.romance_target_id]
      : null
    if (currentTarget) {
      if (!currentTarget.lifecycle.is_alive || currentTarget.lifecycle.spouse_id !== null) {
        // Target married someone else — heartbreak
        const wasMarried = currentTarget.lifecycle.spouse_id !== null
        if (wasMarried && npc.lifecycle.romance_score >= 20) {
          applyHeartbreak(npc, state)
        } else {
          npc.lifecycle.romance_target_id = null
          npc.lifecycle.romance_score     = 0
        }
        continue
      }
    }

    // Find eligible strong-tie partners (different gender, age-compatible, not blood-related, single)
    const eligible = npc.strong_ties
      .map(id => state.npcs[id])
      .filter(s =>
        s?.lifecycle.is_alive &&
        s.lifecycle.spouse_id === null &&
        s.gender !== npc.gender &&
        s.age >= 18 &&
        s.age <= 55 &&
        (s.lifecycle.heartbreak_cooldown ?? 0) === 0 &&
        Math.abs(s.age - npc.age) <= 20 &&
        !isBloodRelation(npc, s),
      ) as NPC[]

    if (eligible.length === 0) continue

    // Pick the most attractive candidate (by compatibility + same-zone proximity)
    let best: NPC | null = null
    let bestScore = -Infinity
    for (const s of eligible) {
      const compat   = coupleCompatibility(npc, s)
      const sameZone = npc.zone === s.zone ? 0.25 : 0
      const score    = compat + sameZone
      if (score > bestScore) { bestScore = score; best = s }
    }
    if (!best) continue

    // If no romance target yet, start developing feelings toward the best candidate
    if (npc.lifecycle.romance_target_id === null) {
      // Only start a new crush if both are happy enough (stress < 70 and happiness > 30)
      if (npc.stress < 70 && npc.happiness > 30 && Math.random() < 0.08) {
        npc.lifecycle.romance_target_id = best.id
        npc.lifecycle.romance_score     = 5
      }
      continue
    }

    // Deepen existing feelings if still eligible
    if (npc.lifecycle.romance_target_id !== best.id) continue
    // Proximity + happiness drive attraction growth (0.5–2.0 per day)
    const zoneBonus = npc.zone === best.zone ? 0.8 : 0
    const happyBonus = npc.happiness > 60 ? 0.5 : npc.happiness > 40 ? 0.2 : 0
    const growthRate = 0.5 + zoneBonus + happyBonus
    npc.lifecycle.romance_score = clamp(npc.lifecycle.romance_score + growthRate, 0, 100)
  }

  // ── 3. Mutual love → Marriage ─────────────────────────────────────────────
  for (const npc of romanceCandidates) {
    if (npc.lifecycle.spouse_id !== null) continue
    if (npc.lifecycle.romance_target_id === null) continue
    if (npc.lifecycle.romance_score < LIFECYCLE_ROMANCE_THRESHOLD) continue

    const target = state.npcs[npc.lifecycle.romance_target_id]
    if (!target?.lifecycle.is_alive) continue
    if (target.lifecycle.spouse_id !== null) continue
    // Mutual love: both must have the other as their romance target
    if (target.lifecycle.romance_target_id !== npc.id) continue
    if (target.lifecycle.romance_score < LIFECYCLE_ROMANCE_THRESHOLD) continue
    if (npc.id > target.id) continue  // canonical — lower id processes

    // Compatibility determines marriage probability: 0.2%–1.5% per day
    const compat = coupleCompatibility(npc, target)
    const marriageChance = clamp(0.002 + compat * 0.013, 0.002, 0.015)
    if (Math.random() > marriageChance) continue

    // They get married
    npc.lifecycle.spouse_id    = target.id
    target.lifecycle.spouse_id = npc.id
    npc.lifecycle.romance_target_id    = null
    target.lifecycle.romance_target_id = null
    npc.lifecycle.romance_score    = 0
    target.lifecycle.romance_score = 0
    if (npc.strong_ties.length    < MAX_STRONG_TIES) npc.strong_ties    = [...new Set([...npc.strong_ties,    target.id])]
    if (target.strong_ties.length < MAX_STRONG_TIES) target.strong_ties = [...new Set([...target.strong_ties, npc.id])]
    // Marriage happiness boost
    npc.happiness    = clamp(npc.happiness    + 12, 0, 100)
    target.happiness = clamp(target.happiness + 12, 0, 100)

    const msg = tf('engine.married', { a: npc.name, b: target.name }) as string
    addChronicle(msg, state.year, state.day, 'minor')
    addFeedRaw(msg, 'info', state.year, state.day)
  }

  // ── 4. Divorce check ─────────────────────────────────────────────────────
  // Triggers on: high combined stress + low happiness OR large worldview divergence.
  for (const npc of living) {
    if (npc.lifecycle.spouse_id === null) continue
    if (npc.id > npc.lifecycle.spouse_id) continue  // avoid double-processing
    const spouse = state.npcs[npc.lifecycle.spouse_id]
    if (!spouse?.lifecycle.is_alive) {
      npc.lifecycle.spouse_id = null  // widowed — clear ref
      continue
    }

    const avgStress    = (npc.stress    + spouse.stress)    / 2
    const avgHappiness = (npc.happiness + spouse.happiness) / 2

    // Stress + unhappiness factor
    const stressChance = Math.max(0, (avgStress - 70) / 100) * Math.max(0, (50 - avgHappiness) / 50) * 0.003

    // Worldview divergence factor: large accumulated ideological gap → strain
    const wvDivergence = 1 - worldviewSimilarity(npc, spouse)  // 0–1; 1 = opposites
    const divergenceChance = Math.max(0, wvDivergence - 0.55) * 0.004  // only kicks in above 55% divergence

    const divorceChance = stressChance + divergenceChance
    if (divorceChance > 0 && Math.random() < divorceChance) {
      dissolveMarriage(npc, spouse, state, 'divorce')
    }
  }

  // ── 5. Network limit during heartbreak ───────────────────────────────────
  // NPCs in heartbreak withdraw socially: trim strong_ties to 8.
  // Also remove the reciprocal edge from the dropped ties so the graph stays symmetric.
  for (const npc of living) {
    if ((npc.lifecycle.heartbreak_cooldown ?? 0) <= 0) continue
    if (npc.strong_ties.length <= 8) continue
    const dropped = npc.strong_ties.slice(8)
    npc.strong_ties = npc.strong_ties.slice(0, 8)
    state.network.strong.get(npc.id)?.forEach((id, _, s) => { if (dropped.includes(id)) s.delete(id) })
    for (const oid of dropped) {
      const other = state.npcs[oid]
      if (!other?.lifecycle.is_alive) continue
      other.strong_ties = other.strong_ties.filter(id => id !== npc.id)
      state.network.strong.get(oid)?.delete(npc.id)
    }
  }
}

function spawnBirth(state: WorldState, parent: NPC): void {
  const { constitution, npcs } = state
  const newId = npcs.length
  const baby  = createNPC(newId, npcs.length + 1, constitution)

  // Babies start as children — they will grow up and choose a career at age 18
  baby.age              = 0
  baby.role             = 'child'
  baby.zone             = (RESIDENTIAL_ZONES as readonly string[]).includes(parent.zone)
    ? parent.zone : RESIDENTIAL_ZONES[Math.floor(Math.random() * RESIDENTIAL_ZONES.length)]
  baby.lifecycle.fertility    = 0
  baby.lifecycle.children_ids = []
  baby.mentor_id = parent.id

  parent.lifecycle.children_ids.push(newId)
  parent.lifecycle.last_birth_tick = state.tick

  if (parent.lifecycle.spouse_id !== null) {
    const spouse = npcs[parent.lifecycle.spouse_id]
    if (spouse) {
      spouse.lifecycle.children_ids.push(newId)
      spouse.lifecycle.last_birth_tick = state.tick
    }
  }

  // Add to network — mutual parent↔child strong tie
  state.network.strong.set(newId, new Set([parent.id]))
  state.network.info.set(newId, new Set())
  baby.strong_ties = [parent.id]
  baby.info_ties   = []
  // Back-link: parent knows their child
  if (parent.strong_ties.length < MAX_STRONG_TIES) {
    parent.strong_ties.push(newId)
    state.network.strong.get(parent.id)?.add(newId)
  }
  // Spouse also gets the child as a strong tie
  const spouseForTie = parent.lifecycle.spouse_id != null ? npcs[parent.lifecycle.spouse_id] : null
  if (spouseForTie && spouseForTie.lifecycle.is_alive && spouseForTie.strong_ties.length < MAX_STRONG_TIES) {
    if (!spouseForTie.strong_ties.includes(newId)) {
      spouseForTie.strong_ties.push(newId)
      state.network.strong.get(spouseForTie.id)?.add(newId)
      baby.strong_ties.push(spouseForTie.id)
      state.network.strong.get(newId)?.add(spouseForTie.id)
    }
  }

  npcs.push(baby)
  state.births_total += 1
  addChronicle(tf('engine.birth', { parent: parent.name }) as string, state.year, state.day, 'minor')
}

function spawnImmigrant(state: WorldState): void {
  const { constitution, npcs } = state
  const newId = npcs.length
  const immigrant = createNPC(newId, npcs.length + 1, constitution)
  immigrant.age = Math.max(18, Math.min(55, immigrant.age))
  immigrant.lifecycle.spouse_id = null
  immigrant.lifecycle.children_ids = []
  immigrant.memory = []

  const living = npcs.filter(n => n.lifecycle.is_alive)
  const sameZone = living.filter(n => n.zone === immigrant.zone)
  const tiePool = sameZone.length > 0 ? sameZone : living
  // Shuffle independently for each tier so selections don't overlap deterministically
  const shuffled1 = tiePool.slice().sort(() => Math.random() - 0.5)
  const shuffled2 = tiePool.slice().sort(() => Math.random() - 0.5)
  const shuffled3 = tiePool.slice().sort(() => Math.random() - 0.5)
  const strongTargets = shuffled1.slice(0, 2)
  const weakTargets   = shuffled2.slice(0, 8)
  const infoTargets   = shuffled3.slice(0, 5)

  state.network.strong.set(newId, new Set(strongTargets.map(n => n.id)))
  state.network.weak.set(newId, new Set(weakTargets.map(n => n.id)))
  state.network.info.set(newId, new Set(infoTargets.map(n => n.id)))

  immigrant.strong_ties = strongTargets.map(n => n.id)
  immigrant.weak_ties = weakTargets.map(n => n.id)
  immigrant.info_ties = infoTargets.map(n => n.id)

  for (const target of strongTargets) {
    if (target.strong_ties.length < MAX_STRONG_TIES) {
      state.network.strong.get(target.id)?.add(newId)
      target.strong_ties = [...new Set([...target.strong_ties, newId])]
    }
  }
  for (const target of weakTargets) {
    if (target.weak_ties.length < MAX_WEAK_TIES) {
      state.network.weak.get(target.id)?.add(newId)
      target.weak_ties = [...new Set([...target.weak_ties, newId])]
    }
  }
  for (const target of infoTargets) {
    if (target.info_ties.length < MAX_INFO_TIES) {
      state.network.info.get(target.id)?.add(newId)
      target.info_ties = [...new Set([...target.info_ties, newId])]
    }
  }

  npcs.push(immigrant)
  state.immigration_total += 1
}

function emigrate(npc: NPC, state: WorldState): void {
  npc.lifecycle.is_alive    = false
  npc.lifecycle.death_cause = 'fled'
  npc.lifecycle.death_tick  = state.tick
}

export function checkImmigration(state: WorldState): void {
  // Snapshot living list once; used for both emigration checks and immigration gate
  let living = state.npcs.filter(n => n.lifecycle.is_alive)

  // ── Emigration ─────────────────────────────────────────────────────────────
  // Two pathways:
  //   A) Crisis flight — NPCs already in 'fleeing' state depart permanently
  //   B) Voluntary emigration — discontented NPCs leave due to sustained hardship

  const hasSevereCrisis = state.macro.food < 30 || state.macro.stability < 30 || state.macro.political_pressure > 75

  let totalDeparted = 0

  // A) Crisis flight: fleeing NPCs convert to permanent emigrants
  const fleeing = living.filter(n => n.action_state === 'fleeing')
  if (fleeing.length > 0) {
    const flightChance = hasSevereCrisis ? 0.40 : 0.10
    if (Math.random() < flightChance) {
      const maxDepart = hasSevereCrisis ? Math.min(5, fleeing.length) : Math.min(2, fleeing.length)
      const departCount = 1 + Math.floor(Math.random() * maxDepart)
      for (const npc of fleeing.slice(0, departCount)) {
        emigrate(npc, state)
        totalDeparted++
      }
    }
  }

  // B) Voluntary emigration: discontented NPCs quietly leave
  const voluntaryPressure =
    clamp((state.macro.political_pressure - 50) / 50, 0, 1) * 0.4 +
    clamp((80 - state.macro.stability) / 80, 0, 1)          * 0.35 +
    clamp((50 - state.macro.food)       / 50, 0, 1)         * 0.25
  const voluntaryChance = clamp((voluntaryPressure - 0.2) / 0.8 * 0.08, 0, 0.08)
  if (voluntaryChance > 0 && Math.random() < voluntaryChance) {
    const candidates = living
      .filter(n => n.lifecycle.is_alive && n.action_state !== 'fleeing' && n.role !== 'child')
      .sort((a, b) => b.grievance - a.grievance)
    for (const npc of candidates.slice(0, 1 + Math.floor(Math.random() * 2))) {
      if (npc.grievance < 45) break
      emigrate(npc, state)
      totalDeparted++
    }
  }

  if (totalDeparted > 0) {
    const text = tf('engine.emigration_wave', { n: totalDeparted }) as string
    addFeedRaw(text, 'warning', state.year, state.day)
    addChronicle(text, state.year, state.day, 'major')
  }

  // During severe crisis, skip immigration entirely
  if (hasSevereCrisis) return

  // ── Immigration: attractive conditions draw newcomers ─────────────────────
  // Re-count living after emigration so immigration cap is evaluated on current pop
  living = state.npcs.filter(n => n.lifecycle.is_alive)
  const immigrationCap = Math.round((state.initial_population ?? 1200) * 1.3)
  if (living.length >= immigrationCap) return

  const attractiveness =
    state.macro.stability * 0.35 +
    state.macro.trust     * 0.30 +
    state.macro.food      * 0.25 +
    (100 - state.macro.political_pressure) * 0.10

  // Needs to be genuinely appealing (>55) to attract migrants
  const chance = clamp((attractiveness - 55) / 120, 0, 0.25)
  if (Math.random() >= chance) return

  const arrivals = 1 + Math.floor(Math.random() * (attractiveness > 75 ? 3 : 1))
  for (let i = 0; i < arrivals; i++) spawnImmigrant(state)

  const text = tf('engine.immigration_wave', { n: arrivals }) as string
  addFeedRaw(text, 'info', state.year, state.day)
  addChronicle(text, state.year, state.day, 'minor')
}
