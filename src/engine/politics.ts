import type { WorldState } from '../types'
import { clamp } from '../sim/constitution'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { t, tf } from '../i18n'
import { POLITICS_MAX_LEGENDARY_PER_DAY } from '../constants/engine-politics'

let lastCapitalistCrashTick = -9999
let lastPeasantRevoltTick   = -9999
let lastRationingCrisisTick = -9999
let lastHeresyCrisisTick    = -9999

let legendaryRecognizedToday = 0
let legendaryLastDay = -1

// Track last dissent statement day to enforce the 20-day interval.
let lastOppositionDissentDay = -999

// ── Regime-specific spontaneous events ────────────────────────────────────────
// Three regime archetypes generate periodic events when their structural
// conditions are met — making each model feel mechanically distinct over time.
//   Capitalist: market crash when high gini + high market_freedom
//   Feudal:     peasant revolt when farmer grievance crosses threshold
//   Socialist:  emergency rationing attempt (succeeds or fails) when food < 35


export function checkRegimeEvents(state: WorldState): void {
  const c = state.constitution

  // ── Capitalist market crash ──────────────────────────────────────────────
  // High market freedom + entrenched inequality → speculative bubble bursts periodically.
  // Raised gini threshold (0.55) and cooldown (120d) so crashes don't fire before the
  // economy has had time to develop genuine speculative inequality.
  if (c.market_freedom > 0.65 && state.macro.gini > 0.55
      && state.tick - lastCapitalistCrashTick > 120 * 24
      && Math.random() < 0.003) {
    lastCapitalistCrashTick = state.tick

    const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
    const sorted = [...living].sort((a, b) => a.wealth - b.wealth)
    const n = sorted.length

    // Top 20% lose 25–40% wealth; everyone's stress and grievance spike
    for (const npc of sorted.slice(Math.floor(n * 0.80))) {
      const loss = npc.wealth * (0.25 + Math.random() * 0.15)
      npc.wealth    = clamp(npc.wealth    - loss, 0, 50000)
      npc.grievance = clamp(npc.grievance + 20,   0, 100)
      npc.stress    = clamp(npc.stress    + 15,   0, 100)
    }
    for (const npc of sorted.slice(0, Math.floor(n * 0.40))) {
      npc.grievance = clamp(npc.grievance + 10, 0, 100)
      npc.fear      = clamp(npc.fear      + 8,  0, 100)
    }

    const mInst = state.institutions.find(i => i.id === 'market')
    if (mInst) mInst.legitimacy = clamp(mInst.legitimacy - 0.10, 0, 1)

    const text = t('engine.market_crash') as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'critical', state.year, state.day)
  }

  // ── Feudal peasant revolt ────────────────────────────────────────────────
  // High gini + high state power + high farmer grievance → periodic levy revolts.
  // Probability raised to 1.2%/day so revolts fire reliably when conditions are met.
  if (c.gini_start > 0.55 && c.state_power > 0.60
      && state.tick - lastPeasantRevoltTick > 60 * 24
      && Math.random() < 0.012) {
    const farmers = state.npcs.filter(n => n.lifecycle.is_alive && n.role === 'farmer')
    const avgGrievance = farmers.reduce((s, n) => s + n.grievance, 0) / Math.max(farmers.length, 1)

    if (avgGrievance > 55) {
      lastPeasantRevoltTick = state.tick

      const revolters = farmers.filter(n => n.grievance > 45)
      for (const npc of revolters) {
        npc.action_state   = Math.random() < 0.6 ? 'organizing' : 'confront'
        npc.dissonance_acc = clamp(npc.dissonance_acc + 20, 0, 100)
      }

      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.07, 0, 1)

      const pct  = Math.round(revolters.length / Math.max(farmers.length, 1) * 100)
      const text = tf('engine.peasant_revolt', { pct }) as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }

  // ── Socialist rationing crisis ───────────────────────────────────────────
  // High state power + severe food shortage → forced emergency rationing declaration.
  // Threshold lowered to food < 25 (was 35) to differentiate from normal daily rationing
  // (applyStateRationing handles the 25–35 range without narrative weight).
  if (c.state_power > 0.70 && state.macro.food < 25
      && state.tick - lastRationingCrisisTick > 30 * 24
      && Math.random() < 0.005) {
    lastRationingCrisisTick = state.tick

    const living = state.npcs.filter(n => n.lifecycle.is_alive && n.role !== 'child')
    const hungry = living.filter(n => n.hunger > 40)
    const cost   = hungry.length * c.safety_net * 1.5

    if (state.food_stock > cost && hungry.length > 0) {
      state.food_stock = clamp(state.food_stock - cost, 0, 999999)
      for (const npc of hungry) {
        npc.hunger = clamp(npc.hunger - 12, 0, 100)
        npc.trust_in.government.intention = clamp(
          npc.trust_in.government.intention + 0.015 * c.state_power, 0, 1,
        )
      }
      const text = tf('engine.rationing_emergency', { n: hungry.length }) as string
      addChronicle(text, state.year, state.day, 'major')
      addFeedRaw(text, 'warning', state.year, state.day)
    } else {
      // Rationing fails — state promise with no delivery
      for (const npc of living) {
        npc.grievance = clamp(npc.grievance + 12, 0, 100)
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.03, 0, 1)
        npc.trust_in.government.competence = clamp(npc.trust_in.government.competence - 0.02, 0, 1)
      }
      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.12, 0, 1)

      const text = t('engine.rationing_crisis') as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }

  // ── Theocracy: Heresy outbreak ───────────────────────────────────────────
  // Rising political pressure in a theocratic society exposes hidden dissenters.
  // The state cracks down: dissenters flee or mobilize, loyalists are reassured,
  // moderates grow quietly fearful. Unlike daily scholar suppression, this is a
  // visible crisis that harms government legitimacy and leaves a lasting scar.
  if (c.state_power >= 0.70 && c.base_trust >= 0.65 && c.network_cohesion >= 0.70
      && state.macro.political_pressure > 55
      && state.tick - lastHeresyCrisisTick > 60 * 24
      && Math.random() < 0.006) {
    const dissidents = state.npcs.filter(n =>
      n.lifecycle.is_alive &&
      n.worldview.authority_trust < 0.35 &&
      n.grievance > 40,
    )
    if (dissidents.length >= 5) {
      lastHeresyCrisisTick = state.tick

      for (const npc of dissidents) {
        npc.fear         = clamp(npc.fear         + 20, 0, 100)
        npc.isolation    = clamp(npc.isolation    + 10, 0, 100)
        npc.action_state = Math.random() < 0.55 ? 'fleeing' : 'organizing'
        npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.05, 0, 1)
      }

      // Broader population: loyalists feel vindicated; moderates grow fearful
      const dissident_ids = new Set(dissidents.map(n => n.id))
      for (const npc of state.npcs) {
        if (!npc.lifecycle.is_alive || dissident_ids.has(npc.id)) continue
        if (npc.worldview.authority_trust > 0.55) {
          npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.01, 0, 1)
        } else {
          npc.fear = clamp(npc.fear + 5, 0, 100)
        }
      }

      const govInst = state.institutions.find(i => i.id === 'government')
      if (govInst) govInst.legitimacy = clamp(govInst.legitimacy - 0.05, 0, 1)

      const n_d = dissidents.length
      const text = tf('engine.heresy_outbreak', { n: n_d }) as string
      addChronicle(text, state.year, state.day, 'critical')
      addFeedRaw(text, 'critical', state.year, state.day)
    }
  }
}

// ── Theocracy: Scholar moral authority ────────────────────────────────────────
// Theocracy indicator: individual_rights_floor < 0.30, base_trust > 0.60, security top priority.
// Top scholars act as moral authorities — their worldview radiates through info-networks,
// reinforcing authority_trust and dampening dissent society-wide.
// This makes theocracies more cohesive but ideologically homogeneous.

export function applyTheocracyEffect(state: WorldState): void {
  const c = state.constitution
  if (c.individual_rights_floor > 0.30 || c.base_trust < 0.60) return
  if (c.value_priority[0] !== 'security') return

  const scholars = state.npcs
    .filter(n => n.lifecycle.is_alive && n.role === 'scholar' && n.influence_score > 0.4)
    .sort((a, b) => b.influence_score - a.influence_score)
    .slice(0, Math.max(1, Math.ceil(state.npcs.filter(n => n.role === 'scholar').length * 0.30)))

  for (const scholar of scholars) {
    // Scholar prominence grows in theocracy (moral authority = social capital)
    scholar.influence_score = clamp(scholar.influence_score + 0.001, 0, 1)

    for (const tid of scholar.info_ties.slice(0, 8)) {
      const follower = state.npcs[tid]
      if (!follower?.lifecycle.is_alive) continue
      // Followers absorb authority-trusting worldview (homogenization)
      follower.worldview.authority_trust = clamp(
        follower.worldview.authority_trust + 0.0008, 0, 1,
      )
      // Dissonance suppressed — dissent is socially discouraged
      follower.dissonance_acc = clamp(follower.dissonance_acc - 0.5, 0, 100)
      // Conditional trust boost: state and religion reinforce each other
      follower.trust_in.government.intention = clamp(
        follower.trust_in.government.intention + 0.0004, 0, 1,
      )
    }
  }
}

// ── Commune: decentralized communal society ────────────────────────────────────
// Commune indicator: market_freedom < 0.25 AND state_power < 0.35.
// Community assembly grows stronger; market and guard institutions weaken.
// High-collectivism NPCs pool resources voluntarily (soft wealth equalization).
// Communal living reduces isolation for all collectivist members.

export function applyCommuneEffect(state: WorldState): void {
  const c = state.constitution
  if (c.market_freedom > 0.25 || c.state_power > 0.35) return

  // Institutional power shift: community rises, market and guard decay
  const communityInst = state.institutions.find(i => i.id === 'community')
  const marketInst    = state.institutions.find(i => i.id === 'market')
  const guardInst     = state.institutions.find(i => i.id === 'guard')

  if (communityInst) {
    communityInst.power      = clamp(communityInst.power      + 0.0002, 0, 1)
    communityInst.legitimacy = clamp(communityInst.legitimacy + 0.0001, 0, 1)
  }
  if (marketInst) marketInst.power = clamp(marketInst.power - 0.0001, 0.01, 1)
  if (guardInst)  guardInst.power  = clamp(guardInst.power  - 0.0001, 0.01, 1)

  // Communal resource pooling: high-collectivism NPCs share wealth daily
  const living = state.npcs.filter(n =>
    n.lifecycle.is_alive && n.role !== 'child' && n.worldview.collectivism > 0.60,
  )
  if (living.length < 5) return

  const sorted    = [...living].sort((a, b) => a.wealth - b.wealth)
  const n         = sorted.length
  const topStart  = Math.floor(n * 0.75)
  const bottomEnd = Math.floor(n * 0.25)

  // Top 25% contributors give 0.3%/day to bottom 25%
  let pool = 0
  for (const npc of sorted.slice(topStart)) {
    const contribution = npc.wealth * 0.003
    npc.wealth = clamp(npc.wealth - contribution, 0, 50000)
    pool += contribution
  }
  if (pool > 0 && bottomEnd > 0) {
    const share = pool / bottomEnd
    for (const npc of sorted.slice(0, bottomEnd)) {
      npc.wealth = clamp(npc.wealth + share, 0, 50000)
      npc.isolation = clamp(npc.isolation - 1.0, 0, 100)
      npc.trust_in.community.intention = clamp(npc.trust_in.community.intention + 0.002, 0, 1)
    }
  }

  // All collectivist NPCs benefit from communal belonging (lower isolation)
  for (const npc of living) {
    npc.isolation = clamp(npc.isolation - 0.3, 0, 100)
  }
}

// ── Legendary NPCs ────────────────────────────────────────────────────────────
// NPCs who achieve notable milestones are marked legendary — an elder who lived
// long through crises, a high-influence figure, or a great merchant.
// On their death, a major chronicle entry mourns them and their strong-tie
// contacts receive a grief memory.


export function checkLegendaryNPCs(state: WorldState): void {
  // Reset per-day counter
  if (state.day !== legendaryLastDay) {
    legendaryRecognizedToday = 0
    legendaryLastDay = state.day
  }

  for (const npc of state.npcs) {
    if (!npc.lifecycle.is_alive) {
      // Detect legendary death within the past day
      if (npc.legendary && npc.lifecycle.death_tick !== null
          && state.tick - npc.lifecycle.death_tick < 24) {
        const cause = npc.lifecycle.death_cause ?? (t('death.unknown') as string)
        const text = tf('engine.legendary_death', {
          name: npc.name,
          occupation: npc.occupation,
          age: npc.age,
          cause,
        })
        addChronicle(text, state.year, state.day, 'critical')
        // Grief ripples through their network
        for (const tid of npc.strong_ties.slice(0, 8)) {
          const contact = state.npcs[tid]
          if (!contact?.lifecycle.is_alive) continue
          contact.grievance = clamp(contact.grievance + 12, 0, 100)
          contact.memory.push({
            event_id: `legendary_death_${npc.id}`,
            type: 'loss',
            emotional_weight: -35,
            tick: state.tick,
          })
          if (contact.memory.length > 10) contact.memory.shift()
        }
      }
      continue
    }

    if (npc.legendary) continue  // already marked

    // Cap recognitions per day to avoid spam when many NPCs cross thresholds simultaneously
    if (legendaryRecognizedToday >= POLITICS_MAX_LEGENDARY_PER_DAY) continue

    // Minimum: NPC must have been alive for at least 60 sim-days (lived through hardship, not just arrived)
    const ticksAlive = npc.lifecycle.death_tick == null ? state.tick - (npc.id * 3) : 0  // rough proxy
    const daysInWorld = state.day - Math.max(0, state.day - Math.floor(ticksAlive / 24))
    if (daysInWorld < 60 && npc.age < 40) continue  // newcomers can't be legendary

    // Conditions for legendary status — all thresholds are high to make this a rare, meaningful event.
    // influence_score with INFLUENCE_REFERENCE_DEGREE=15 means 0.85 requires ~13+ strong ties AND good bridge.
    const isLongLived    = npc.age >= 75 && npc.stress < 40 && npc.happiness > 65
    const isInfluential  = npc.influence_score > 0.85 && npc.strong_ties.length >= 14 && npc.age >= 35
    const isWealthy      = npc.wealth > 20000 && npc.age >= 50
    const isReformed     = npc.criminal_record && npc.grievance < 8 && npc.age >= 50 && npc.happiness > 60
    const isFactionElder = npc.faction_id !== null
      && state.factions.some(f => f.id === npc.faction_id && state.tick - f.founded_tick > 7200)  // 300 days

    if (isLongLived || isInfluential || isWealthy || isReformed || isFactionElder) {
      npc.legendary = true
      legendaryRecognizedToday++
      const reasonKey = isInfluential ? 'engine.legendary_reason.influential'
        : isWealthy    ? 'engine.legendary_reason.wealthy'
        : isReformed   ? 'engine.legendary_reason.reformed'
        : isFactionElder ? 'engine.legendary_reason.faction_elder'
        : 'engine.legendary_reason.elder'
      const reason = t(reasonKey) as string
      addChronicle(
        tf('engine.legendary_recognized', { name: npc.name, occupation: npc.occupation, reason }),
        state.year, state.day, 'major',
      )
    }
  }
}

// When political pressure is high and drift is significant, a referendum is
// automatically proposed based on the most pressing crisis. NPCs "vote" based
// on worldview alignment. After 7 days (168 ticks) it resolves — approved
// referendums amend the constitution in real time.

export function checkReferendum(state: WorldState): void {
  // Resolve pending referendum
  if (state.referendum !== null) {
    if (state.tick >= state.referendum.expires_tick) {
      resolveReferendum(state)
    }
    return
  }

  // Trigger condition
  if (state.macro.political_pressure < 65 || state.drift_score < 0.38) return
  if (Math.random() > 0.02) return  // 2% daily chance once conditions met

  const m = state.macro
  const c = state.constitution

  // Pick the most relevant proposal
  let field: 'safety_net' | 'individual_rights_floor' | 'market_freedom' | 'state_power'
  let proposed: number
  let proposal_text: string

  if (m.food < 28 && c.safety_net < 0.70) {
    field    = 'safety_net'
    proposed = clamp(c.safety_net + 0.20, 0, 1)
    proposal_text = tf('engine.referendum.proposal.food_relief', { from: Math.round(c.safety_net * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.gini > 0.55 && c.safety_net < 0.65) {
    field    = 'safety_net'
    proposed = clamp(c.safety_net + 0.15, 0, 1)
    proposal_text = tf('engine.referendum.proposal.redistribution', { from: Math.round(c.safety_net * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.trust < 28 && c.individual_rights_floor < 0.60) {
    field    = 'individual_rights_floor'
    proposed = clamp(c.individual_rights_floor + 0.20, 0, 1)
    proposal_text = tf('engine.referendum.proposal.rights', { from: Math.round(c.individual_rights_floor * 100), to: Math.round(proposed * 100) }) as string
  } else if (m.political_pressure > 75 && c.market_freedom < 0.70) {
    field    = 'market_freedom'
    proposed = clamp(c.market_freedom + 0.15, 0, 1)
    proposal_text = tf('engine.referendum.proposal.market', { from: Math.round(c.market_freedom * 100), to: Math.round(proposed * 100) }) as string
  } else {
    return  // no clear crisis to propose on
  }

  state.referendum = {
    proposal_text,
    field,
    current_value: c[field] as number,
    proposed_value: proposed,
    expires_tick: state.tick + 168,  // 7 days
  }

  const text = tf('engine.referendum.proposed', { proposal: proposal_text }) as string
  addChronicle(text, state.year, state.day, 'critical')
  addFeedRaw(text, 'political', state.year, state.day)
}

function resolveReferendum(state: WorldState): void {
  const ref = state.referendum!
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  if (living.length === 0) { state.referendum = null; return }

  // NPCs vote based on worldview alignment with the proposal
  let supportCount = 0
  for (const npc of living) {
    let supports = false
    switch (ref.field) {
      case 'safety_net':
        supports = npc.worldview.collectivism > 0.50 || npc.hunger > 50
        break
      case 'individual_rights_floor':
        supports = npc.worldview.authority_trust < 0.45 || npc.criminal_record
        break
      case 'market_freedom':
        supports = npc.worldview.risk_tolerance > 0.55 || npc.role === 'merchant'
        break
      case 'state_power':
        supports = npc.worldview.authority_trust > 0.60 || npc.role === 'guard' || npc.role === 'leader'
        break
    }
    if (supports) supportCount++
  }

  const supportPct = Math.round(supportCount / living.length * 100)
  const approved   = supportPct > 50

  if (approved) {
    // Amend the constitution
    ;(state.constitution as unknown as Record<string, number>)[ref.field] = ref.proposed_value
    const text = tf('engine.referendum.passed', { pct: supportPct, proposal: ref.proposal_text }) as string
    addChronicle(text, state.year, state.day, 'critical')
    addFeedRaw(text, 'political', state.year, state.day)
    // Trust boost from successful democratic process
    for (const npc of living) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention + 0.03, 0, 1)
    }
  } else {
    const text = tf('engine.referendum.rejected', { pct: supportPct, proposal: ref.proposal_text }) as string
    addChronicle(text, state.year, state.day, 'major')
    addFeedRaw(text, 'political', state.year, state.day)
    // Disappointment among supporters
    for (const npc of living) {
      if (npc.grievance > 40) npc.grievance = clamp(npc.grievance + 5, 0, 100)
    }
  }

  state.referendum = null
}

// ── Opposition Institution Autonomous Behavior ────────────────────────────────
// The Opposition institution gains legitimacy under pressure and acts as a
// meaningful counter-force: publishing dissent, boosting solidarity, and
// triggering rights referendums when conditions are dire enough.


export function checkOppositionBehavior(state: WorldState): void {
  const oppInst = state.institutions.find(i => i.id === 'opposition')
  if (!oppInst) return

  const m = state.macro

  // ── 1. Daily legitimacy drift ─────────────────────────────────────────
  const gainCondition = m.political_pressure > 55 || m.trust < 40 || (m.labor_unrest ?? 0) > 50
  const loseCondition = m.stability > 65 && m.trust > 55
  if (gainCondition) {
    oppInst.legitimacy = clamp(oppInst.legitimacy + 0.002, 0, 1)
  } else if (loseCondition) {
    oppInst.legitimacy = clamp(oppInst.legitimacy - 0.002, 0, 1)
  }

  // ── 2. Dissent statement every 20 days when legitimacy > 0.35 ─────────
  if (oppInst.legitimacy > 0.35 && state.day - lastOppositionDissentDay >= 20) {
    lastOppositionDissentDay = state.day
    const living = state.npcs.filter(n => n.lifecycle.is_alive)
    const highGrievance = living.filter(n => n.grievance > 60)
    const affected = Math.floor(highGrievance.length * 0.15)
    // Fisher-Yates shuffle for unbiased random sampling
    const pool = highGrievance.slice()
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const sample = pool.slice(0, affected)
    for (const npc of sample) {
      npc.trust_in.government.intention = clamp(npc.trust_in.government.intention - 0.01, 0, 1)
    }
    const msg = t('engine.opposition.dissent_statement') as string
    addChronicle(msg, state.year, state.day, 'major')
    addFeedRaw(msg, 'political', state.year, state.day)
  }

  // ── 3. Active strikes + legitimacy > 0.3 → solidarity boost for striking role ──
  if (oppInst.legitimacy > 0.3 && (state.active_strikes ?? []).length > 0) {
    const living = state.npcs.filter(n => n.lifecycle.is_alive)
    for (const strike of state.active_strikes) {
      for (const npc of living) {
        if (npc.role === strike.role && npc.on_strike) {
          // Apply 1.3× multiplier effect: add 30% of excess solidarity above baseline
          const excess = npc.class_solidarity - 45
          if (excess > 0) {
            npc.class_solidarity = clamp(npc.class_solidarity + excess * 0.3, 0, 100)
          }
        }
      }
    }
  }

  // ── 4. Referendum trigger when legitimacy > 0.65 and pressure > 70 ────
  if (oppInst.legitimacy > 0.65 && m.political_pressure > 70 && state.referendum === null) {
    const c = state.constitution
    const proposed = clamp(c.individual_rights_floor + 0.20, 0, 1)
    const proposal_text = tf('engine.referendum.proposal.rights', {
      from: Math.round(c.individual_rights_floor * 100),
      to: Math.round(proposed * 100),
    }) as string
    state.referendum = {
      proposal_text,
      field: 'individual_rights_floor',
      current_value: c.individual_rights_floor,
      proposed_value: proposed,
      expires_tick: state.tick + 168,
    }
    const msg = tf('engine.opposition.referendum_triggered', { pct: Math.round(oppInst.legitimacy * 100) }) as string
    addChronicle(msg, state.year, state.day, 'critical')
    addFeedRaw(msg, 'political', state.year, state.day)
  }
}
