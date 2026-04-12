import type { WorldState, Constitution, NPC, NPCIntervention, WorldDelta, InstitutionDelta, BreakthroughRecord, FormulaPatch, BreakthroughSource } from '../types'
import { clamp } from '../sim/constitution'
import { permanentRoleChange } from '../sim/npc'
import { MAX_NPC_MEMORIES } from '../constants/engine-interventions'
import { patchFormula, getFormulaExpr } from '../formulas/registry'

/** Default title used when a formula patch originates from a god-agent response. */
export const GOD_AGENT_FORMULA_OVERRIDE_TITLE = 'God Agent Formula Override'

// ── Direct NPC Interventions ─────────────────────────────────────────────────

export function applyInterventions(state: WorldState, interventions: NPCIntervention[]): { affected: number; killed: number } {
  let totalAffected = 0
  let totalKilled = 0

  for (const iv of interventions) {
    // Select candidate NPCs
    let candidates = state.npcs.filter(n => n.lifecycle.is_alive)

    if (iv.target === 'zone' && iv.zones?.length) {
      candidates = candidates.filter(n => iv.zones!.includes(n.zone))
    } else if (iv.target === 'role' && iv.roles?.length) {
      candidates = candidates.filter(n => iv.roles!.includes(n.role))
    } else if (iv.target === 'id_list' && iv.npc_ids?.length) {
      const idSet = new Set(iv.npc_ids)
      candidates = candidates.filter(n => idSet.has(n.id))
    }

    // kill_pct: kill a percentage of candidates (takes priority over count)
    if (iv.kill && iv.kill_pct !== undefined) {
      const killCount = Math.round(candidates.length * Math.min(100, Math.max(0, iv.kill_pct)) / 100)
      candidates = candidates
        .map(n => ({ n, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, killCount)
        .map(x => x.n)
    // Optionally cap by count (random sample)
    } else if (iv.count !== undefined && iv.count < candidates.length) {
      candidates = candidates
        .map(n => ({ n, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, iv.count)
        .map(x => x.n)
    }

    for (const npc of candidates) {
      applyInterventionToNPC(npc, iv, state)
    }

    if (iv.kill) totalKilled += candidates.length
    totalAffected += candidates.length
  }

  return { affected: totalAffected, killed: totalKilled }
}

function applyInterventionToNPC(npc: NPC, iv: NPCIntervention, state: WorldState): void {
  // Kill
  if (iv.kill) {
    npc.lifecycle.is_alive = false
    npc.lifecycle.death_cause = iv.kill_cause ?? 'violence'
    npc.lifecycle.death_tick = state.tick
    return  // dead NPCs skip further changes
  }

  // Action state override
  if (iv.action_state !== undefined) {
    npc.action_state = iv.action_state
  }

  // Permanent role reassignment (clears emergency tracking)
  if (iv.new_role !== undefined && iv.new_role !== npc.role) {
    permanentRoleChange(npc, iv.new_role, state)
  }

  // Additive stat deltas
  if (iv.stress_delta !== undefined)   npc.stress    = clamp(npc.stress    + iv.stress_delta,    0, 100)
  if (iv.fear_delta !== undefined)     npc.fear      = clamp(npc.fear      + iv.fear_delta,      0, 100)
  if (iv.hunger_delta !== undefined)   npc.hunger    = clamp(npc.hunger    + iv.hunger_delta,    0, 100)
  if (iv.grievance_delta !== undefined) npc.grievance = clamp(npc.grievance + iv.grievance_delta, 0, 100)
  if (iv.happiness_delta !== undefined) npc.happiness = clamp(npc.happiness + iv.happiness_delta, 0, 100)

  // Worldview deltas
  if (iv.worldview_delta) {
    const wd = iv.worldview_delta
    const wv = npc.worldview
    if (wd.collectivism   !== undefined) wv.collectivism    = clamp(wv.collectivism    + wd.collectivism,    0, 1)
    if (wd.authority_trust !== undefined) wv.authority_trust = clamp(wv.authority_trust + wd.authority_trust, 0, 1)
    if (wd.risk_tolerance  !== undefined) wv.risk_tolerance  = clamp(wv.risk_tolerance  + wd.risk_tolerance,  0, 1)
    if (wd.time_preference !== undefined) wv.time_preference = clamp(wv.time_preference + wd.time_preference, 0, 1)
  }

  // Solidarity delta
  if (iv.solidarity_delta !== undefined) {
    npc.class_solidarity = clamp(npc.class_solidarity + iv.solidarity_delta, 0, 100)
    // End strike if solidarity drops below threshold
    if (npc.class_solidarity < 45 && npc.on_strike) npc.on_strike = false
  }

  // Extended NPC fields
  if (iv.wealth_delta !== undefined)
    npc.wealth = Math.max(0, npc.wealth + iv.wealth_delta)

  if (iv.work_motivation !== undefined)
    npc.work_motivation = iv.work_motivation

  if (iv.trust_delta !== undefined) {
    const ts = npc.trust_in[iv.trust_delta.institution]
    if (ts) {
      if (iv.trust_delta.competence !== undefined)
        ts.competence = clamp(ts.competence + iv.trust_delta.competence, 0, 1)
      if (iv.trust_delta.intention !== undefined)
        ts.intention = clamp(ts.intention + iv.trust_delta.intention, 0, 1)
    }
  }

  if (iv.sick !== undefined) {
    npc.sick = iv.sick
    if (iv.sick) npc.sick_ticks = Math.max(npc.sick_ticks, 48)
  }

  if (iv.exhaustion_delta !== undefined)
    npc.exhaustion = clamp(npc.exhaustion + iv.exhaustion_delta, 0, 100)

  if (iv.capital_delta !== undefined)
    npc.capital = clamp((npc.capital ?? 0) + iv.capital_delta, 0, 100)

  // Memory injection
  if (iv.memory) {
    npc.memory.push({ event_id: 'intervention', type: iv.memory.type, emotional_weight: iv.memory.emotional_weight, tick: state.tick })
    if (npc.memory.length > MAX_NPC_MEMORIES) npc.memory.shift()
  }
}

// ── World-level intervention functions ────────────────────────────────────────

/** Apply a live constitution patch. Only safe mid-game fields are applied.
 *  role_ratios and description are blocked because they only matter at init time. */
export function applyConstitutionPatch(state: WorldState, patch: Partial<Constitution>): void {
  const safe: Array<keyof Constitution> = [
    'market_freedom', 'state_power', 'safety_net',
    'individual_rights_floor', 'base_trust', 'network_cohesion',
    'resource_scarcity', 'gini_start',
  ]
  for (const key of safe) {
    if (patch[key] !== undefined)
      (state.constitution as unknown as Record<string, unknown>)[key] = patch[key]
  }
  if (patch.value_priority?.length === 4)
    state.constitution.value_priority = patch.value_priority
  if (patch.work_schedule)
    state.constitution.work_schedule = { ...state.constitution.work_schedule, ...patch.work_schedule }
}

/** Apply macro-level world state changes (food, resources, treasury, quarantine, rumors). */
export function applyWorldDelta(state: WorldState, delta: WorldDelta): void {
  if (delta.food_stock_delta !== undefined) {
    const deltaFoodCap = Math.max(600, state.npcs.filter(n => n.lifecycle.is_alive).length * 60)
    state.food_stock = clamp(state.food_stock + delta.food_stock_delta, 0, deltaFoodCap)
  }
  if (delta.natural_resources_delta !== undefined)
    state.natural_resources = clamp(state.natural_resources + delta.natural_resources_delta, 0, 100000)
  if (delta.tax_pool_delta !== undefined)
    state.tax_pool = Math.max(0, state.tax_pool + delta.tax_pool_delta)
  if (delta.quarantine_add?.length) {
    for (const z of delta.quarantine_add)
      if (!state.quarantine_zones.includes(z)) state.quarantine_zones.push(z)
  }
  if (delta.quarantine_remove?.length)
    state.quarantine_zones = state.quarantine_zones.filter(z => !delta.quarantine_remove!.includes(z))
  if (delta.seed_rumor) {
    const r = delta.seed_rumor
    state.rumors.push({
      id: crypto.randomUUID(),
      content: r.content,
      subject: r.subject,
      effect: r.effect,
      reach: 0,
      born_tick: state.tick,
      expires_tick: state.tick + (r.duration_days ?? 15) * 24,
    })
  }
  if (delta.trigger_referendum && state.referendum === null) {
    const tr = delta.trigger_referendum
    const c  = state.constitution as unknown as Record<string, number>
    state.referendum = {
      proposal_text:  tr.proposal_text,
      field:          tr.field,
      current_value:  c[tr.field] ?? 0,
      proposed_value: clamp(tr.proposed_value, 0, 1),
      expires_tick:   state.tick + 168,  // 7 days
    }
  }
  if (delta.formula_patch?.length) {
    recordFormulaBreakthrough(
      state,
      delta.formula_patch,
      'god_agent',
      GOD_AGENT_FORMULA_OVERRIDE_TITLE,
      'The Architect directly rewrote a simulation formula.',
    )
  }
}

/**
 * Apply a set of formula patches and record them in `breakthrough_log`.
 * Called by science discoveries, government reforms, or god-agent commands.
 *
 * @param state       - Current world state (breakthrough_log is mutated).
 * @param patches     - Array of { key, expr } formula patches to apply.
 * @param source      - Origin category for display/filtering.
 * @param title       - Short human-readable title for the log entry.
 * @param description - One-sentence description of the breakthrough.
 */
export function recordFormulaBreakthrough(
  state: WorldState,
  patches: FormulaPatch[],
  source: BreakthroughSource,
  title: string,
  description: string,
): BreakthroughRecord | null {
  if (!patches.length) return null

  const skipped: string[] = []
  const applied: BreakthroughRecord['formula_patches'] = []
  for (const p of patches) {
    try {
      const prevExpr = getFormulaExpr(p.key)
      patchFormula(p.key, p.expr)
      applied.push({ key: p.key, prev_expr: prevExpr, new_expr: p.expr })
    } catch (err) {
      // Skip invalid expressions without crashing the sim, but track which ones failed
      console.warn(`[formula-patch] invalid expr for "${p.key}" (expr: ${p.expr}):`, err)
      skipped.push(p.key)
    }
  }

  if (!applied.length) return null

  const record: BreakthroughRecord = {
    id:               crypto.randomUUID(),
    tick:             state.tick,
    year:             state.year,
    day:              state.day,
    source,
    title,
    description:      skipped.length
      ? `${description} (skipped invalid patches: ${skipped.join(', ')})`
      : description,
    formula_patches:  applied,
  }

  state.breakthrough_log.push(record)
  return record
}

/** Apply power/legitimacy/resources changes to institutions. */
export function applyInstitutionDeltas(state: WorldState, deltas: InstitutionDelta[]): void {
  for (const d of deltas) {
    const inst = state.institutions.find(i => i.id === d.id)
    if (!inst) continue
    if (d.power_delta !== undefined)
      inst.power = clamp(inst.power + d.power_delta, 0, 1)
    if (d.resources_delta !== undefined)
      inst.resources = Math.max(0, inst.resources + d.resources_delta)
    if (d.legitimacy_delta !== undefined)
      inst.legitimacy = clamp(inst.legitimacy + d.legitimacy_delta, 0, 1)
  }
}
